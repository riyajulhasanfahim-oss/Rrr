import imageCompression from 'browser-image-compression';
import config from '../../firebase-applet-config.json';

export const GOOGLE_CLIENT_ID = (config as any).oAuthClientId || '';

interface GoogleDriveFolder {
  id: string;
  name: string;
}

export class GoogleDriveService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async fetchAPI(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Drive API Error:', response.status, errorText);
      throw new Error(`Google Drive API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async findFolder(name: string, parentId?: string): Promise<string | null> {
    let q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
    if (parentId) {
      q += ` and '${parentId}' in parents`;
    }

    const data = await this.fetchAPI(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
    
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  }

  async createFolder(name: string, parentId?: string): Promise<string> {
    const body: any = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      body.parents = [parentId];
    }

    const data = await this.fetchAPI('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return data.id;
  }

  async initializeFolders(): Promise<Record<string, string>> {
    const rootFolderName = 'RJ WORLD BD';
    let rootFolderId = await this.findFolder(rootFolderName);

    if (!rootFolderId) {
      rootFolderId = await this.createFolder(rootFolderName);
    }

    const subFolders = [
      'Profile Photos',
      'Product Images',
      'Shop Logos',
      'Shop Banners',
      'Documents',
      'Invoices',
      'Reseller Photos'
    ];

    const folderIds: Record<string, string> = { root: rootFolderId };

    for (const folderName of subFolders) {
      let folderId = await this.findFolder(folderName, rootFolderId);
      if (!folderId) {
        folderId = await this.createFolder(folderName, rootFolderId);
      }
      folderIds[folderName] = folderId;
    }

    return folderIds;
  }

  async makeFilePublic(fileId: string): Promise<void> {
    await this.fetchAPI(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  }

  async compressImage(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file;
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };
    try {
      const compressedBlob = await imageCompression(file, options);
      return new File([compressedBlob], file.name, { type: file.type });
    } catch (error) {
      console.error('Image compression failed', error);
      return file;
    }
  }

  uploadFileWithProgress(file: File, folderId: string, onProgress: (progress: number) => void): Promise<{ id: string, webViewLink: string, webContentLink: string }> {
    return new Promise(async (resolve, reject) => {
      try {
        const compressedFile = await this.compressImage(file);
        const metadata = {
          name: compressedFile.name,
          parents: [folderId],
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', compressedFile);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink', true);
        xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = async () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } else {
            reject(new Error(`Upload failed: ${xhr.responseText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(form);
      } catch (err) {
        reject(err);
      }
    });
  }
}
