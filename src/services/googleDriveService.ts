import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import toast from 'react-hot-toast';

let cachedAccessToken: string | null = null;

export const authenticateGoogleDrive = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;

  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    // Force prompt to ensure we get a fresh token if needed
    provider.setCustomParameters({
      prompt: 'consent'
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      return cachedAccessToken;
    }
    throw new Error('No access token found');
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      return null;
    }
    console.error('Drive Authentication Error:', error);
    toast.error('Failed to connect to Google Drive');
    return null;
  }
};

export const getAccessToken = () => cachedAccessToken;

export const uploadImageToDrive = async (file: File): Promise<{ fileId: string; viewUrl: string; mimeType: string; name: string } | null> => {
  const token = await authenticateGoogleDrive();
  if (!token) return null;

  try {
    const metadata = {
      name: file.name,
      mimeType: file.type,
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    // Upload file
    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload failed: ${errText}`);
    }

    const data = await uploadRes.json();
    const fileId = data.id;

    // Set permission to anyone with link can view
    const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });

    if (!permRes.ok) {
      console.warn('Failed to set public permission, image might not be viewable by others.');
    }

    // Construct reliable public CDN URL using lh3.googleusercontent.com
    const publicUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

    return {
      fileId,
      viewUrl: publicUrl,
      mimeType: data.mimeType,
      name: data.name
    };
  } catch (error) {
    console.error("Upload error", error);
    toast.error("Failed to upload image to Google Drive");
    return null;
  }
};
