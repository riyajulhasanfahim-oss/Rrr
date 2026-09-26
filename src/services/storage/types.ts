export type StorageProviderType = 'google_drive' | 'cloud_storage' | 's3' | 'firebase_storage';

export type StorageAccountStatus = 'Connected' | 'Expired' | 'Error';

export interface StorageAccount {
  id: string; // Document ID (e.g. gdrive_user_id or uuid)
  provider: StorageProviderType;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  tokenExpiry: number; // Timestamp in ms
  totalStorage: number; // Total storage in bytes
  usedStorage: number; // Used storage in bytes
  availableStorage: number; // Available storage in bytes
  folderId?: string; // Target folder ID on Google Drive
  status: StorageAccountStatus;
  connectedAt: number;
  lastCheckedAt: number;
  errorMessage?: string;
}

export interface StoredFileRecord {
  id: string; // Doc ID in Firestore
  productId?: string;
  vendorId?: string;
  storageProvider: StorageProviderType;
  driveAccountId: string; // ID of the StorageAccount used
  fileId: string; // Google Drive file ID
  fileUrl: string; // Public view URL
  thumbnailUrl?: string;
  originalFilename: string;
  fileSize: number; // In bytes
  mimeType: string;
  uploadTimestamp: number;
}

export interface StoragePoolStats {
  totalAccounts: number;
  activeAccounts: number;
  totalCapacityBytes: number;
  totalUsedBytes: number;
  totalAvailableBytes: number;
  usedPercentage: number;
  totalStoredFiles: number;
  totalStoredFilesSize: number;
}

export interface UploadOptions {
  productId?: string;
  vendorId?: string;
  userId?: string;
  folderName?: string;
  onProgress?: (percent: number) => void;
}

export interface StorageProvider {
  providerType: StorageProviderType;
  uploadFile(
    account: StorageAccount,
    file: File | Blob,
    filename: string,
    options?: UploadOptions
  ): Promise<{ fileId: string; fileUrl: string; fileSize: number; mimeType: string }>;
  
  deleteFile(account: StorageAccount, fileId: string): Promise<boolean>;
  
  refreshAccountQuota(
    account: StorageAccount
  ): Promise<{ totalStorage: number; usedStorage: number; availableStorage: number; status: StorageAccountStatus }>;
}
