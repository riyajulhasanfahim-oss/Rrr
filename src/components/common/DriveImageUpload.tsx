import { safeStorage } from "../../utils/storage";
import React, { useState, useRef, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { GoogleDriveService } from '../../lib/googleDrive';
import { UploadCloud, X, Loader2, FolderKey, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface DriveImageUploadProps {
  onUploadSuccess: (url: string, id: string) => void;
  folderName: 'Profile Photos' | 'Product Images' | 'Shop Logos' | 'Shop Banners' | 'Documents' | 'Invoices' | 'Reseller Photos' | 'Review Photos' | 'Chat Images';
  className?: string;
  multiple?: boolean;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

// Global variable to keep the token for the session
let driveService: GoogleDriveService | null = null;
let initializedFolders: Record<string, string> | null = null;

const TOKEN_KEY = 'google_drive_auth_token';
const EXPIRY_KEY = 'google_drive_auth_expiry';

export const DriveImageUpload: React.FC<DriveImageUploadProps> = ({ onUploadSuccess, folderName, className = '', multiple = false }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if token exists and is valid
    const token = safeStorage.getItem(TOKEN_KEY);
    const expiry = safeStorage.getItem(EXPIRY_KEY);
    
    if (token && expiry) {
      if (Date.now() < parseInt(expiry, 10)) {
        driveService = new GoogleDriveService(token);
        setIsAuthenticated(true);
      } else {
        // Token expired
        safeStorage.removeItem(TOKEN_KEY);
        safeStorage.removeItem(EXPIRY_KEY);
        driveService = null;
        setIsAuthenticated(false);
      }
    }
  }, []);

  const handleConnect = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.setCustomParameters({
        prompt: 'select_account consent'
      });

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (!token) {
        throw new Error('No access token received from Google.');
      }

      const expiry = Date.now() + 55 * 60 * 1000; 
      safeStorage.setItem(TOKEN_KEY, token);
      safeStorage.setItem(EXPIRY_KEY, expiry.toString());
      
      driveService = new GoogleDriveService(token);
      setIsAuthenticated(true);
      toast.success('Google Drive Connected!');
      
      if (!initializedFolders) {
        try {
          initializedFolders = await driveService.initializeFolders();
        } catch (e) {
          console.error('Failed to initialize folders', e);
        }
      }
    } catch (error: any) {
      console.error('Google Login Error:', error);
      if (error?.code !== 'auth/popup-closed-by-user' && error?.code !== 'auth/cancelled-popup-request') {
        toast.error(error?.message || 'Failed to connect to Google Drive');
      }
    }
  };

  const uploadSingleFile = async (uploadFile: UploadingFile) => {
    if (!driveService) return;
    
    try {
      if (!initializedFolders) {
        initializedFolders = await driveService.initializeFolders();
      }
      
      const folderId = initializedFolders[folderName];
      if (!folderId) {
        throw new Error(`Folder ${folderName} not found`);
      }

      setUploadQueue(prev => prev.map(f => f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f));

      const result = await driveService.uploadFileWithProgress(
        uploadFile.file, 
        folderId,
        (progress) => {
          setUploadQueue(prev => prev.map(f => f.id === uploadFile.id ? { ...f, progress } : f));
        }
      );
      
      // Make file public
      await driveService.makeFilePublic(result.id);
      
      // Convert to public direct CDN link using Google userContent CDN
      const publicUrl = `https://lh3.googleusercontent.com/d/${result.id}`;

      setUploadQueue(prev => prev.map(f => f.id === uploadFile.id ? { ...f, status: 'success', progress: 100 } : f));
      
      onUploadSuccess(publicUrl, result.id);
      toast.success(`${uploadFile.file.name} uploaded!`);
      
      // Remove from queue after success (optional, or leave it for a moment)
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(f => f.id !== uploadFile.id));
      }, 3000);
      
    } catch (error: any) {
      console.error('Upload Error:', error);
      setUploadQueue(prev => prev.map(f => f.id === uploadFile.id ? { ...f, status: 'error', error: error.message || 'Failed to upload' } : f));
      toast.error(`Failed to upload ${uploadFile.file.name}`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!isAuthenticated || !driveService) {
      toast.error('Please connect Google Drive first');
      return;
    }

    const newFiles: UploadingFile[] = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: 'uploading'
    }));

    setUploadQueue(prev => [...prev, ...newFiles]);

    // Start uploads
    for (const f of newFiles) {
      uploadSingleFile(f);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const retryUpload = (id: string) => {
    const fileToRetry = uploadQueue.find(f => f.id === id);
    if (fileToRetry) {
      uploadSingleFile(fileToRetry);
    }
  };

  const removeFile = (id: string) => {
    setUploadQueue(prev => prev.filter(f => f.id !== id));
  };

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={handleConnect}
        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-main hover:bg-sky-50 transition-colors cursor-pointer text-gray-500 hover:text-primary-main w-full ${className}`}
      >
        <FolderKey className="w-8 h-8 mb-2" />
        <span className="text-sm font-medium">Connect Google Drive</span>
        <span className="text-xs mt-1 text-gray-400">Required for uploads</span>
      </button>
    );
  }

  return (
    <div className="w-full">
      <div 
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-main hover:bg-sky-50 transition-colors cursor-pointer group w-full ${className}`}
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud className="w-8 h-8 mb-2 text-gray-400 group-hover:text-primary-main" />
        <span className="text-sm font-medium text-gray-600 group-hover:text-primary-main">
          Click to Upload to Drive
        </span>
        <span className="text-xs mt-1 text-gray-400">
          Stores in {folderName}
        </span>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
          multiple={multiple}
        />
      </div>

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadQueue.map(fileObj => (
            <div key={fileObj.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {fileObj.status === 'uploading' ? (
                  <Loader2 className="w-5 h-5 text-primary-main animate-spin flex-shrink-0" />
                ) : fileObj.status === 'error' ? (
                  <RefreshCw 
                    className="w-5 h-5 text-red-500 cursor-pointer flex-shrink-0 hover:text-red-700" 
                    onClick={() => retryUpload(fileObj.id)}
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{fileObj.file.name}</p>
                  {fileObj.status === 'uploading' && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div 
                        className="bg-primary-main h-1.5 rounded-full transition-all duration-300" 
                        style={{ width: `${fileObj.progress}%` }}
                      />
                    </div>
                  )}
                  {fileObj.status === 'error' && (
                    <p className="text-xs text-red-500 mt-0.5">{fileObj.error}</p>
                  )}
                </div>
              </div>
              
              <button 
                type="button"
                onClick={() => removeFile(fileObj.id)}
                className="p-1 ml-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
