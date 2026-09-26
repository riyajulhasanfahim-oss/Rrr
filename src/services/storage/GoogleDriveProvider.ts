import { StorageAccount, StorageAccountStatus, StorageProvider, UploadOptions } from './types';

export class GoogleDriveProvider implements StorageProvider {
  providerType: 'google_drive' = 'google_drive';

  /**
   * Helper to perform authenticated requests to Google APIs
   */
  private async fetchGoogleAPI(
    url: string,
    accessToken: string,
    options: RequestInit = {}
  ): Promise<any> {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${accessToken}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `Google Drive API error (${response.status} ${response.statusText}): ${errorText}`
        );
      }

      if (response.status === 204) {
        return null;
      }

      return response.json().catch(() => null);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Find or create folder in target Google Drive
   */
  async getOrCreateFolder(accessToken: string, folderName: string = 'RJ_Product_Images'): Promise<string> {
    const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=files(id,name)`;

    try {
      const searchRes = await this.fetchGoogleAPI(searchUrl, accessToken);
      if (searchRes?.files && searchRes.files.length > 0) {
        return searchRes.files[0].id;
      }

      // Create folder
      const createUrl = 'https://www.googleapis.com/drive/v3/files';
      const createRes = await this.fetchGoogleAPI(createUrl, accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        }),
      });

      return createRes.id;
    } catch (error) {
      console.warn('Could not create folder in Drive, using root directory', error);
      return 'root';
    }
  }

  /**
   * Make a file publicly viewable
   */
  async makeFilePublic(accessToken: string, fileId: string): Promise<void> {
    try {
      await this.fetchGoogleAPI(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        accessToken,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'reader',
            type: 'anyone',
          }),
        }
      );
    } catch (err) {
      console.warn('Failed to set public reader permissions on Drive file', err);
    }
  }

  /**
   * Upload file to target Google Drive account with progress reporting
   */
  async uploadFile(
    account: StorageAccount,
    file: File | Blob,
    filename: string,
    options?: UploadOptions
  ): Promise<{ fileId: string; fileUrl: string; fileSize: number; mimeType: string }> {
    const accessToken = account.accessToken;
    const folderId = account.folderId || (await this.getOrCreateFolder(accessToken, options?.folderName || 'RJ_Product_Images'));

    const mimeType = file.type || 'image/jpeg';
    const metadata = {
      name: filename,
      parents: folderId !== 'root' ? [folderId] : undefined,
    };

    const formData = new FormData();
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    formData.append('file', file, filename);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        'POST',
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink',
        true
      );
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

      if (options?.onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            options.onProgress?.(percent);
          }
        };
      }

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            const fileId = result.id;

            // Make public for image access in catalog & storefront
            await this.makeFilePublic(accessToken, fileId);

            // Construct direct image URLs using reliable Google UserContent CDN
            const fileUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

            resolve({
              fileId,
              fileUrl,
              fileSize: file.size,
              mimeType,
            });
          } catch (parseErr) {
            reject(new Error(`Failed to parse Drive upload response: ${parseErr}`));
          }
        } else {
          let errDetail = '';
          try {
            errDetail = xhr.responseText;
          } catch (_) {}
          reject(new Error(`Google Drive upload failed (${xhr.status}): ${errDetail}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error occurred during Google Drive upload'));
      };

      xhr.send(formData);
    });
  }

  /**
   * Delete a file permanently from Google Drive
   */
  async deleteFile(account: StorageAccount, fileId: string): Promise<boolean> {
    try {
      await this.fetchGoogleAPI(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        account.accessToken,
        {
          method: 'DELETE',
        }
      );
      return true;
    } catch (error) {
      console.error(`Failed to delete file ${fileId} from Drive account ${account.email}:`, error);
      return false;
    }
  }

  /**
   * Refresh account quota and health status
   */
  async refreshAccountQuota(
    account: StorageAccount
  ): Promise<{ totalStorage: number; usedStorage: number; availableStorage: number; status: StorageAccountStatus }> {
    try {
      const data = await this.fetchGoogleAPI(
        'https://www.googleapis.com/drive/v3/about?fields=user,storageQuota',
        account.accessToken
      );

      const quota = data.storageQuota || {};
      const total = parseInt(quota.limit || '16106127360', 10); // default 15GB if unlimited/unspecified
      const used = parseInt(quota.usage || '0', 10);
      const available = Math.max(0, total - used);

      return {
        totalStorage: total > 0 ? total : (account.totalStorage || 16106127360),
        usedStorage: used >= 0 ? used : (account.usedStorage || 0),
        availableStorage: available > 0 ? available : (account.availableStorage || 16106127360),
        status: 'Connected',
      };
    } catch (error: any) {
      console.warn(`Quota check warning for account ${account.email} (keeping connected):`, error);
      return {
        totalStorage: account.totalStorage || 16106127360,
        usedStorage: account.usedStorage || 0,
        availableStorage: account.availableStorage || 16106127360,
        status: 'Connected',
      };
    }
  }
}
