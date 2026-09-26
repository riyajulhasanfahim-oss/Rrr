import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { rtdbGet, rtdbSet, rtdbList, rtdbRemove, rtdbUpdate } from '../../lib/rtdb';
import imageCompression from 'browser-image-compression';
import {
  StorageAccount,
  StoredFileRecord,
  StoragePoolStats,
  UploadOptions,
  StorageProvider,
} from './types';
import { GoogleDriveProvider } from './GoogleDriveProvider';

class StorageManagerService {
  private providers: Map<string, StorageProvider> = new Map();

  constructor() {
    const driveProvider = new GoogleDriveProvider();
    this.providers.set('google_drive', driveProvider);
  }

  /**
   * Register or swap storage provider for future migration (e.g. Cloud Storage, S3)
   */
  registerProvider(type: string, provider: StorageProvider) {
    this.providers.set(type, provider);
  }

  getProvider(type: string = 'google_drive'): StorageProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Storage provider '${type}' is not registered`);
    }
    return provider;
  }

  /**
   * Local storage cache key for persistent storage pool backup
   */
  private static LOCAL_CACHE_KEY = 'rj_storage_accounts_persistent_v2';

  private getCachedAccounts(): StorageAccount[] {
    try {
      const raw = localStorage.getItem(StorageManagerService.LOCAL_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (_) {}
    return [];
  }

  private saveCachedAccounts(accounts: StorageAccount[]) {
    try {
      localStorage.setItem(StorageManagerService.LOCAL_CACHE_KEY, JSON.stringify(accounts));
    } catch (_) {}
  }

  /**
   * Get all connected storage accounts from Firestore and local cache
   */
  async getConnectedAccounts(): Promise<StorageAccount[]> {
    const cachedAccounts = this.getCachedAccounts();
    const accountMap = new Map<string, StorageAccount>();

    // Seed with cached accounts first
    cachedAccounts.forEach((acc) => {
      accountMap.set(acc.id, { ...acc, status: 'Connected' });
    });

    // 1. Fetch from RTDB
    try {
      const rtdbAccounts = await rtdbList<any>('storage_accounts');
      rtdbAccounts.forEach(({ id, data }) => {
        if (data) {
          accountMap.set(id, {
            id,
            ...data,
            status: 'Connected',
          });
        }
      });
    } catch (rtdbErr) {
      console.warn('RTDB fetch notice for storage accounts:', rtdbErr);
    }

    // 2. Fetch from Firestore as fallback
    try {
      const snap = await getDocs(collection(db, 'storage_accounts'));
      snap.forEach((d) => {
        const data = d.data() as any;
        const fullAcc: StorageAccount = {
          id: d.id,
          ...data,
          status: 'Connected', // Guarantee it remains Connected unless explicitly disconnected
        };
        accountMap.set(d.id, fullAcc);
      });
    } catch (error) {
      console.warn('Firestore fetch notice for storage accounts, using cached store:', error);
    }

    const merged = Array.from(accountMap.values()).sort(
      (a, b) => (b.connectedAt || 0) - (a.connectedAt || 0)
    );

    // Keep persistent cache updated
    if (merged.length > 0) {
      this.saveCachedAccounts(merged);
    }

    return merged;
  }

  /**
   * Calculate global pooled storage statistics across all connected drives
   */
  async getStoragePoolStats(): Promise<StoragePoolStats> {
    const accounts = await this.getConnectedAccounts();
    const activeAccounts = accounts; // All connected accounts in the pool remain active

    let totalCapacityBytes = 0;
    let totalUsedBytes = 0;
    let totalAvailableBytes = 0;

    activeAccounts.forEach((acc) => {
      totalCapacityBytes += acc.totalStorage || 0;
      totalUsedBytes += acc.usedStorage || 0;
      totalAvailableBytes += acc.availableStorage || 0;
    });

    const usedPercentage =
      totalCapacityBytes > 0
        ? Math.min(100, Math.round((totalUsedBytes / totalCapacityBytes) * 100))
        : 0;

    // Get total stored files count from storage_files
    let totalStoredFiles = 0;
    let totalStoredFilesSize = 0;
    try {
      const filesSnap = await getDocs(collection(db, 'storage_files'));
      totalStoredFiles = filesSnap.size;
      filesSnap.forEach((d) => {
        const data = d.data();
        totalStoredFilesSize += data.fileSize || 0;
      });
    } catch (err) {
      console.warn('Could not aggregate storage files', err);
    }

    return {
      totalAccounts: accounts.length,
      activeAccounts: activeAccounts.length,
      totalCapacityBytes,
      totalUsedBytes,
      totalAvailableBytes,
      usedPercentage,
      totalStoredFiles,
      totalStoredFilesSize,
    };
  }

  /**
   * Save or update a connected Google Drive account in Firestore and persistent storage
   */
  async saveStorageAccount(
    accountData: Omit<StorageAccount, 'id'> & { id?: string }
  ): Promise<StorageAccount> {
    const rawEmail = (accountData.email || 'drive_account@google.com').trim().toLowerCase();
    const accountId =
      accountData.id ||
      `gdrive_${rawEmail.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    const accountRef = doc(db, 'storage_accounts', accountId);

    const fullAccount: StorageAccount = {
      id: accountId,
      provider: accountData.provider || 'google_drive',
      email: rawEmail,
      name: accountData.name || rawEmail,
      picture: accountData.picture || '',
      accessToken: accountData.accessToken || '',
      tokenExpiry: accountData.tokenExpiry || Date.now() + 3600000,
      totalStorage: Number(accountData.totalStorage) > 0 ? Number(accountData.totalStorage) : 16106127360,
      usedStorage: Number(accountData.usedStorage) >= 0 ? Number(accountData.usedStorage) : 0,
      availableStorage: Number(accountData.availableStorage) > 0 ? Number(accountData.availableStorage) : 16106127360,
      folderId: accountData.folderId || 'root',
      status: 'Connected', // ALWAYS Connected until explicitly disconnected
      connectedAt: accountData.connectedAt || Date.now(),
      lastCheckedAt: Date.now(),
    };

    // Clean any undefined keys before writing to Firestore
    const sanitizedAccount: any = {};
    Object.entries(fullAccount).forEach(([k, v]) => {
      if (v !== undefined) {
        sanitizedAccount[k] = v;
      }
    });

    try {
      await setDoc(accountRef, sanitizedAccount, { merge: true });
    } catch (firestoreErr) {
      console.warn('Could not write account to Firestore, saving to persistent cache:', firestoreErr);
    }

    // Save to RTDB
    try {
      await rtdbSet(`storage_accounts/${accountId}`, sanitizedAccount);
    } catch (rtdbErr) {
      console.warn('Could not write account to RTDB:', rtdbErr);
    }

    // Update persistent cache
    const currentCached = this.getCachedAccounts().filter((a) => a.id !== accountId && a.email.toLowerCase() !== rawEmail);
    currentCached.unshift(fullAccount);
    this.saveCachedAccounts(currentCached);

    return fullAccount;
  }

  /**
   * Remove a connected storage account ONLY when explicitly invoked by admin
   */
  async disconnectAccount(accountId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'storage_accounts', accountId));
    } catch (err) {
      console.warn('Error deleting from Firestore:', err);
    }

    try {
      await rtdbRemove(`storage_accounts/${accountId}`);
    } catch (rtdbErr) {
      console.warn('Error deleting from RTDB:', rtdbErr);
    }

    // Remove from local persistent cache
    const updated = this.getCachedAccounts().filter((a) => a.id !== accountId);
    this.saveCachedAccounts(updated);
  }

  /**
   * Refresh quota and check health for an account
   */
  async refreshAccount(accountId: string): Promise<StorageAccount | null> {
    try {
      const accRef = doc(db, 'storage_accounts', accountId);
      const accSnap = await getDoc(accRef);
      if (!accSnap.exists()) return null;

      const account = { id: accSnap.id, ...(accSnap.data() as any) } as StorageAccount;
      const provider = this.getProvider(account.provider || 'google_drive');

      const updatedQuota = await provider.refreshAccountQuota(account);

      const updatedAccount: StorageAccount = {
        ...account,
        ...updatedQuota,
        lastCheckedAt: Date.now(),
      };

      await updateDoc(accRef, {
        totalStorage: updatedQuota.totalStorage,
        usedStorage: updatedQuota.usedStorage,
        availableStorage: updatedQuota.availableStorage,
        status: updatedQuota.status,
        lastCheckedAt: Date.now(),
      });

      return updatedAccount;
    } catch (error) {
      console.error(`Error refreshing account ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Client-side image validation and smart compression
   */
  async optimizeImage(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) {
      return file;
    }

    try {
      const options = {
        maxSizeMB: 0.8, // Target max 800 KB for optimal speed & quality
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
      };
      const compressedBlob = await imageCompression(file, options);
      return new File([compressedBlob], file.name, {
        type: compressedBlob.type || file.type,
      });
    } catch (err) {
      console.warn('Image optimization fallback to original file', err);
      return file;
    }
  }

  /**
   * Uploads an image using the Global Shared Storage Pool.
   * Automatically picks the best available connected Google Drive,
   * falls back across drives if one fails, and records metadata in Firestore.
   */
  async uploadProductImage(
    rawFile: File,
    options: UploadOptions = {}
  ): Promise<StoredFileRecord> {
    // 1. Validation
    if (!rawFile) {
      throw new Error('No file provided for upload.');
    }

    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
      'image/bmp',
    ];
    if (!validTypes.includes(rawFile.type)) {
      throw new Error(
        'Invalid image format. Supported formats: JPG, PNG, WEBP, GIF, AVIF, BMP.'
      );
    }

    if (rawFile.size > 25 * 1024 * 1024) {
      throw new Error('Image size must be less than 25MB.');
    }

    // 2. Compress/Optimize
    const file = await this.optimizeImage(rawFile);

    // 3. Find connected storage accounts in the pool
    const accounts = await this.getConnectedAccounts();
    const activeAccounts = accounts.filter((a) => a.status === 'Connected');

    if (activeAccounts.length === 0) {
      // If no admin drive is connected, fallback to server upload proxy if available
      console.warn(
        'No active connected Google Drive found in pool. Attempting fallback upload.'
      );
      return await this.fallbackServerUpload(file, options);
    }

    // Sort active accounts by available storage descending (highest free space first)
    const sortedAccounts = [...activeAccounts].sort(
      (a, b) => (b.availableStorage || 0) - (a.availableStorage || 0)
    );

    let uploadResult: {
      fileId: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
    } | null = null;
    let usedAccount: StorageAccount | null = null;
    let lastError: any = null;

    // 4. Try upload with automatic drive failover
    for (const account of sortedAccounts) {
      try {
        const provider = this.getProvider(account.provider || 'google_drive');
        const filename = `product_${options.productId || 'new'}_${Date.now()}_${file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        )}`;

        uploadResult = await provider.uploadFile(account, file, filename, options);
        usedAccount = account;

        // Update local quota estimate on the account
        try {
          const newUsed = (account.usedStorage || 0) + file.size;
          const newAvailable = Math.max(0, (account.totalStorage || 0) - newUsed);
          await updateDoc(doc(db, 'storage_accounts', account.id), {
            usedStorage: newUsed,
            availableStorage: newAvailable,
          });
        } catch (_) {}

        break; // Upload succeeded!
      } catch (err: any) {
        console.warn(`Upload failed on drive account ${account.email}, trying next drive:`, err);
        lastError = err;
        // Keep account in pool; do not automatically disconnect or mark expired
      }
    }

    if (!uploadResult || !usedAccount) {
      console.warn('All Google Drive storage accounts failed. Falling back to server upload.');
      return await this.fallbackServerUpload(file, options);
    }

    // 5. Store File Metadata in Firestore `storage_files`
    const fileRecordId = `file_${uploadResult.fileId || Date.now()}`;
    const fileRecord: StoredFileRecord = {
      id: fileRecordId,
      productId: options.productId || '',
      vendorId: options.vendorId || '',
      storageProvider: 'google_drive',
      driveAccountId: usedAccount.id,
      fileId: uploadResult.fileId,
      fileUrl: uploadResult.fileUrl,
      thumbnailUrl: uploadResult.fileUrl,
      originalFilename: rawFile.name,
      fileSize: uploadResult.fileSize || file.size,
      mimeType: uploadResult.mimeType || file.type,
      uploadTimestamp: Date.now(),
    };

    try {
      await setDoc(doc(db, 'storage_files', fileRecordId), fileRecord);
    } catch (metaErr) {
      console.error('Failed to save file metadata to Firestore:', metaErr);
    }

    return fileRecord;
  }

  /**
   * Fallback server upload if no Google Drive is connected or all drives fail
   */
  private async fallbackServerUpload(
    file: File,
    options: UploadOptions
  ): Promise<StoredFileRecord> {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          const response = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Data }),
          });
          const data = await response.json();
          if (data.success && data.url) {
            const id = `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            const record: StoredFileRecord = {
              id,
              productId: options.productId || '',
              vendorId: options.vendorId || '',
              storageProvider: 'cloud_storage',
              driveAccountId: 'server_fallback',
              fileId: id,
              fileUrl: data.url,
              thumbnailUrl: data.url,
              originalFilename: file.name,
              fileSize: file.size,
              mimeType: file.type,
              uploadTimestamp: Date.now(),
            };
            try {
              await setDoc(doc(db, 'storage_files', id), record);
            } catch (_) {}
            resolve(record);
          } else {
            throw new Error(data.error || 'Fallback upload failed.');
          }
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
    });
  }

  /**
   * Delete all images associated with a product from Google Drive & Firestore
   */
  async deleteProductImages(productId: string): Promise<{ deletedCount: number }> {
    if (!productId) return { deletedCount: 0 };

    let deletedCount = 0;
    try {
      // 1. Query all files associated with this productId in Firestore
      const q = query(
        collection(db, 'storage_files'),
        where('productId', '==', productId)
      );
      const snap = await getDocs(q);

      const accounts = await this.getConnectedAccounts();
      const accountsMap = new Map<string, StorageAccount>();
      accounts.forEach((a) => accountsMap.set(a.id, a));

      // Also get product document to find any un-indexed drive image URLs
      try {
        const prodSnap = await getDoc(doc(db, 'products', productId));
        if (prodSnap.exists()) {
          const pData = prodSnap.data();
          const allUrls = [
            pData.image,
            pData.featuredImage,
            ...(Array.isArray(pData.images) ? pData.images : []),
          ].filter(Boolean);

          for (const url of allUrls) {
            // Extract Google Drive file ID if present
            const match =
              url.match(/id=([a-zA-Z0-9_-]{20,})/i) ||
              url.match(/\/d\/([a-zA-Z0-9_-]{20,})/i);
            if (match && match[1]) {
              const fileId = match[1];
              // Check if already in snap
              let inSnap = false;
              snap.forEach((d) => {
                if (d.data().fileId === fileId) inSnap = true;
              });

              if (!inSnap) {
                // Try deleting across all connected drives
                for (const acc of accounts) {
                  const prov = this.getProvider(acc.provider || 'google_drive');
                  const deleted = await prov.deleteFile(acc, fileId);
                  if (deleted) {
                    deletedCount++;
                    break;
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not parse product URLs for cleanup', err);
      }

      // Delete each indexed file from Drive and Firestore
      for (const d of snap.docs) {
        const fileRecord = d.data() as StoredFileRecord;
        const account = accountsMap.get(fileRecord.driveAccountId) || accounts[0];

        if (account && fileRecord.fileId && fileRecord.storageProvider === 'google_drive') {
          const provider = this.getProvider(account.provider || 'google_drive');
          await provider.deleteFile(account, fileRecord.fileId);
        }

        await deleteDoc(d.ref);
        deletedCount++;
      }
    } catch (error) {
      console.error(`Error deleting product images for ${productId}:`, error);
    }

    return { deletedCount };
  }

  /**
   * Delete a single stored file by its record ID or Google Drive fileId
   */
  async deleteFile(fileRecordId: string): Promise<boolean> {
    try {
      const fileRef = doc(db, 'storage_files', fileRecordId);
      const snap = await getDoc(fileRef);

      if (snap.exists()) {
        const record = snap.data() as StoredFileRecord;
        if (record.storageProvider === 'google_drive' && record.fileId) {
          const accSnap = await getDoc(doc(db, 'storage_accounts', record.driveAccountId));
          if (accSnap.exists()) {
            const acc = { id: accSnap.id, ...(accSnap.data() as any) } as StorageAccount;
            const prov = this.getProvider('google_drive');
            await prov.deleteFile(acc, record.fileId);
          }
        }
        await deleteDoc(fileRef);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting stored file:', error);
      return false;
    }
  }

  /**
   * Fetch recent uploaded files for admin storage inspection
   */
  async getRecentStorageFiles(count: number = 50): Promise<StoredFileRecord[]> {
    try {
      const q = query(
        collection(db, 'storage_files'),
        orderBy('uploadTimestamp', 'desc'),
        firestoreLimit(count)
      );
      const snap = await getDocs(q);
      const files: StoredFileRecord[] = [];
      snap.forEach((d) => {
        files.push({ id: d.id, ...(d.data() as any) });
      });
      return files;
    } catch (error) {
      console.error('Error fetching recent storage files:', error);
      return [];
    }
  }
}

export const StorageManager = new StorageManagerService();
