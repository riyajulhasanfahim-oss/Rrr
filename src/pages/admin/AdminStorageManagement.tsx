import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { rtdbSubscribe } from '../../lib/rtdb';
import {
  HardDrive,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ShieldCheck,
  Layers,
  Database,
  Search,
  Image as ImageIcon,
  Folder,
  ArrowUpRight,
  Info,
  Server,
  Cloud,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { StorageManager } from '../../services/storage/StorageManager';
import {
  StorageAccount,
  StoragePoolStats,
  StoredFileRecord,
} from '../../services/storage/types';
import { GoogleDriveProvider } from '../../services/storage/GoogleDriveProvider';

export default function AdminStorageManagement() {
  const [accounts, setAccounts] = useState<StorageAccount[]>([]);
  const [stats, setStats] = useState<StoragePoolStats | null>(null);
  const [recentFiles, setRecentFiles] = useState<StoredFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [activeTab, setActiveTab] = useState<'drives' | 'files' | 'architecture'>('drives');
  const [fileSearch, setFileSearch] = useState('');
  const [disconnectModalAccount, setDisconnectModalAccount] = useState<StorageAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const connectToastRef = React.useRef<string | null>(null);
  const connectTimeoutRef = React.useRef<any>(null);

  const clearConnectTimeout = () => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  };

  const endConnectionLoading = (errorMsg?: string) => {
    clearConnectTimeout();
    setIsConnecting(false);
    if (connectToastRef.current) {
      if (errorMsg) {
        toast.error(errorMsg, { id: connectToastRef.current });
      } else {
        toast.dismiss(connectToastRef.current);
      }
      connectToastRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearConnectTimeout();
      if (connectToastRef.current) {
        toast.dismiss(connectToastRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadData();

    // Setup real-time listener on storage_accounts so connected drives are always synced and never lost
    const unsubscribe = rtdbSubscribe<Record<string, any>>('storage_accounts', async (data) => {
      if (data && typeof data === 'object') {
        const accs: StorageAccount[] = Object.entries(data).map(([id, val]) => ({
          id,
          ...val,
          status: 'Connected',
        }));
        accs.sort((a, b) => (b.connectedAt || 0) - (a.connectedAt || 0));
        setAccounts(accs);
        const poolStats = await StorageManager.getStoragePoolStats();
        setStats(poolStats);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accs, poolStats, files] = await Promise.all([
        StorageManager.getConnectedAccounts(),
        StorageManager.getStoragePoolStats(),
        StorageManager.getRecentStorageFiles(50),
      ]);
      setAccounts(accs);
      setStats(poolStats);
      setRecentFiles(files);
    } catch (err) {
      console.error('Error loading storage data:', err);
      toast.error('Failed to load storage accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    try {
      setIsRefreshingAll(true);
      toast.loading('Refreshing all connected drives...', { id: 'refresh-all' });
      for (const acc of accounts) {
        await StorageManager.refreshAccount(acc.id);
      }
      await loadData();
      toast.success('All storage quotas refreshed!', { id: 'refresh-all' });
    } catch (err) {
      toast.error('Failed to refresh some drive quotas', { id: 'refresh-all' });
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const handleRefreshSingle = async (accountId: string) => {
    try {
      setRefreshingId(accountId);
      const updated = await StorageManager.refreshAccount(accountId);
      if (updated) {
        setAccounts((prev) => prev.map((a) => (a.id === accountId ? updated : a)));
        const poolStats = await StorageManager.getStoragePoolStats();
        setStats(poolStats);
        toast.success('Account quota refreshed');
      } else {
        toast.error('Failed to refresh quota');
      }
    } catch (err) {
      toast.error('Error refreshing drive quota');
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDisconnectConfirm = async () => {
    if (!disconnectModalAccount) return;
    try {
      await StorageManager.disconnectAccount(disconnectModalAccount.id);
      toast.success(`Disconnected ${disconnectModalAccount.email}`);
      setDisconnectModalAccount(null);
      await loadData();
    } catch (err) {
      toast.error('Failed to disconnect account');
    }
  };

  const handleDeleteFile = async (fileRecord: StoredFileRecord) => {
    if (window.confirm(`Delete ${fileRecord.originalFilename} from Google Drive and storage index?`)) {
      try {
        const deleted = await StorageManager.deleteFile(fileRecord.id);
        if (deleted) {
          toast.success('Image deleted from storage pool');
          setRecentFiles((prev) => prev.filter((f) => f.id !== fileRecord.id));
          const poolStats = await StorageManager.getStoragePoolStats();
          setStats(poolStats);
        } else {
          toast.error('Could not delete image file');
        }
      } catch (e) {
        toast.error('Failed to delete file');
      }
    }
  };

  const handleStartConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);

    const toastId = toast.loading('Connecting Google Drive account...');
    connectToastRef.current = toastId;

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.setCustomParameters({
        prompt: 'select_account',
      });

      const result = await signInWithPopup(auth, provider);
      toast.loading('Finalizing Google Drive connection...', { id: toastId });

      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;
      if (!accessToken) {
        throw new Error('No access token received from Google OAuth. Please check Drive permissions.');
      }

      const expiresIn = 3599;
      const tokenExpiry = Date.now() + expiresIn * 1000;

      // Extract user profile details
      const email =
        result.user.email ||
        `gdrive_${Date.now()}@google.com`;
      const name =
        result.user.displayName ||
        email;
      const picture =
        result.user.photoURL ||
        '';
      const userId =
        result.user.uid ||
        email.replace(/[^a-zA-Z0-9]/g, '_');

      // Fetch Storage Quota & Ensure Products folder concurrently for maximum speed
      const quotaPromise = (async () => {
        try {
          const controller = new AbortController();
          const qTimer = setTimeout(() => controller.abort(), 4000);
          const quotaRes = await fetch(
            'https://www.googleapis.com/drive/v3/about?fields=user,storageQuota',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: controller.signal,
            }
          );
          clearTimeout(qTimer);
          if (quotaRes.ok) {
            return await quotaRes.json();
          }
        } catch (qErr) {
          console.warn('Fast fallback for quota:', qErr);
        }
        return {};
      })();

      const folderPromise = (async () => {
        try {
          const driveProvider = new GoogleDriveProvider();
          return await driveProvider.getOrCreateFolder(
            accessToken,
            'RJ_Product_Images'
          );
        } catch (fErr) {
          console.warn('Could not create/locate RJ_Product_Images folder, using root:', fErr);
          return 'root';
        }
      })();

      const [quotaData, folderId] = await Promise.all([quotaPromise, folderPromise]);

      // Extract storage quota safely (default 15 GB if unspecified)
      const quota = quotaData?.storageQuota || {};
      const totalStorage =
        Number(quota.limit) > 0 ? Number(quota.limit) : 16106127360;
      const usedStorage =
        Number(quota.usage) >= 0 ? Number(quota.usage) : 0;
      const availableStorage = Math.max(0, totalStorage - usedStorage);

      // Save into Firestore Storage Accounts pool
      const accountDocId = `gdrive_${(email || userId).trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const savedAccount = await StorageManager.saveStorageAccount({
        id: accountDocId,
        provider: 'google_drive',
        email,
        name,
        picture,
        accessToken,
        tokenExpiry,
        totalStorage,
        usedStorage,
        availableStorage,
        folderId: folderId || 'root',
        status: 'Connected',
        connectedAt: Date.now(),
        lastCheckedAt: Date.now(),
      });

      toast.success(`Google Drive (${savedAccount.email}) connected successfully!`, {
        id: toastId,
      });
      connectToastRef.current = null;
      await loadData();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        endConnectionLoading();
      } else {
        console.error('Error connecting Google Drive:', err);
        let errorMsg = err?.message || 'Failed to connect Google Drive account';
        if (err?.code === 'auth/popup-blocked') {
          errorMsg = 'Google authorization popup was blocked by browser. Please allow popups for this site.';
        }
        endConnectionLoading(errorMsg);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const formatBytes = (bytes: number = 0) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = recentFiles.filter(
    (f) =>
      (f.originalFilename || '').toLowerCase().includes(fileSearch.toLowerCase()) ||
      (f.productId || '').toLowerCase().includes(fileSearch.toLowerCase()) ||
      (f.driveAccountId || '').toLowerCase().includes(fileSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-main">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Google Drive Storage Pool
              </h1>
              <p className="text-sm text-slate-500">
                Manage connected Google Drive accounts as a unified shared storage pool for vendor product images.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshingAll || accounts.length === 0}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            title="Refresh Quota for All Drives"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingAll ? 'animate-spin' : ''}`} />
            Sync All Quotas
          </button>

          <button
            onClick={handleStartConnect}
            disabled={isConnecting}
            className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-primary-main hover:bg-primary-dark text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm shadow-primary-main/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
          >
            {isConnecting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {isConnecting ? 'Connecting...' : 'Connect Google Drive'}
          </button>
        </div>
      </div>

      {/* Global Storage Pool Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Capacity */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Pool Capacity
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatBytes(stats?.totalCapacityBytes || 0)}
          </p>
          <div className="mt-2 flex items-center text-xs text-slate-500">
            <span>Across {accounts.length} drive {accounts.length === 1 ? 'account' : 'accounts'}</span>
          </div>
        </div>

        {/* Free Storage */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Available Free Space
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {formatBytes(stats?.totalAvailableBytes || 0)}
          </p>
          <div className="mt-2 flex items-center text-xs text-slate-500">
            <span>Ready for vendor uploads</span>
          </div>
        </div>

        {/* Used Storage */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Used Storage
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatBytes(stats?.totalUsedBytes || 0)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full ${
                  (stats?.usedPercentage || 0) > 85
                    ? 'bg-red-500'
                    : (stats?.usedPercentage || 0) > 60
                    ? 'bg-amber-500'
                    : 'bg-primary-main'
                }`}
                style={{ width: `${stats?.usedPercentage || 0}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
              {stats?.usedPercentage || 0}%
            </span>
          </div>
        </div>

        {/* Total Stored Files */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Stored Product Images
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <ImageIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {stats?.totalStoredFiles || 0}
          </p>
          <div className="mt-2 flex items-center text-xs text-slate-500">
            <span>{formatBytes(stats?.totalStoredFilesSize || 0)} indexed files</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('drives')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'drives'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          Connected Drives ({accounts.length})
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'files'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Storage Files Explorer ({recentFiles.length})
        </button>

        <button
          onClick={() => setActiveTab('architecture')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'architecture'
              ? 'border-primary-main text-primary-main'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Server className="w-4 h-4" />
          Provider Abstraction & Migration
        </button>
      </div>

      {/* TAB 1: Connected Drives List */}
      {activeTab === 'drives' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main mx-auto mb-3" />
              <p className="text-sm text-slate-500">Loading connected Google Drive accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-main flex items-center justify-center mx-auto">
                <Cloud className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">No Google Drive Accounts Connected</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                  Connect your Google Drive accounts via official Google OAuth. You can connect multiple Google accounts to pool their 15 GB storage together for vendor product images.
                </p>
              </div>
              <button
                onClick={handleStartConnect}
                disabled={isConnecting}
                className="px-6 py-3 rounded-xl bg-primary-main hover:bg-primary-dark text-white font-semibold text-sm inline-flex items-center gap-2 shadow-md transition-all disabled:opacity-60"
              >
                {isConnecting ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                {isConnecting ? 'Connecting...' : 'Connect Your First Google Drive'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((acc, index) => {
                const usedPercent =
                  acc.totalStorage > 0
                    ? Math.min(100, Math.round((acc.usedStorage / acc.totalStorage) * 100))
                    : 0;

                const isRefreshing = refreshingId === acc.id;

                return (
                  <div
                    key={acc.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between space-y-4 relative overflow-hidden"
                  >
                    {/* Top status & header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {acc.picture ? (
                          <img
                            src={acc.picture}
                            alt={acc.name}
                            className="w-12 h-12 rounded-full border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600">
                            {acc.name ? acc.name.charAt(0).toUpperCase() : 'G'}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-base">{acc.name || 'Google Drive'}</h3>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              Drive #{index + 1}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{acc.email}</p>
                        </div>
                      </div>

                      {/* Status badge */}
                      <div>
                        {acc.status === 'Connected' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Connected
                          </span>
                        ) : acc.status === 'Expired' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3.5 h-3.5" />
                            Error
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Storage Progress Bar */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-600">
                          {formatBytes(acc.usedStorage)} used of {formatBytes(acc.totalStorage)}
                        </span>
                        <span className="font-bold text-slate-900">{usedPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all ${
                            usedPercent > 85
                              ? 'bg-red-500'
                              : usedPercent > 60
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${usedPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Free: {formatBytes(acc.availableStorage)}</span>
                        <span className="flex items-center gap-1">
                          <Folder className="w-3 h-3 text-slate-400" />
                          RJ_Product_Images
                        </span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-400">
                        Checked: {new Date(acc.lastCheckedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRefreshSingle(acc.id)}
                          disabled={isRefreshing}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          title="Refresh Quota"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                          Sync
                        </button>

                        <button
                          onClick={handleStartConnect}
                          disabled={isConnecting}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          title="Refresh OAuth Token"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          Reconnect
                        </button>

                        <button
                          onClick={() => setDisconnectModalAccount(acc)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                          title="Disconnect Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Storage Files Explorer */}
      {activeTab === 'files' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-50">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by filename, product ID, or drive..."
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-main/20"
              />
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Showing {filteredFiles.length} indexed files
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Image & Filename</th>
                  <th className="px-6 py-3.5">Storage Provider</th>
                  <th className="px-6 py-3.5">Product / Vendor</th>
                  <th className="px-6 py-3.5">Size</th>
                  <th className="px-6 py-3.5">Uploaded</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No files found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map((file) => (
                    <tr key={file.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {file.fileUrl ? (
                              <img
                                src={file.fileUrl}
                                alt={file.originalFilename}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback placeholder if image load fails
                                  (e.target as any).style.display = 'none';
                                }}
                              />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm max-w-xs truncate" title={file.originalFilename}>
                              {file.originalFilename}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5 max-w-xs truncate">
                              ID: {file.fileId}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                          <HardDrive className="w-3.5 h-3.5" />
                          Google Drive
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-xs">
                          <p className="font-semibold text-slate-800">
                            Prod: {file.productId || 'Direct / Form'}
                          </p>
                          <p className="text-slate-500 mt-0.5">
                            Vendor: {file.vendorId || 'Admin'}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs font-mono font-medium text-slate-600">
                        {formatBytes(file.fileSize)}
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500">
                        {file.uploadTimestamp
                          ? new Date(file.uploadTimestamp).toLocaleDateString() +
                            ' ' +
                            new Date(file.uploadTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'N/A'}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {file.fileUrl && (
                            <a
                              href={file.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                              title="Open image in new tab"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteFile(file)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                            title="Delete file permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Provider Abstraction & Migration */}
      {activeTab === 'architecture' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-5 h-5 text-primary-main" />
              Storage Provider Abstraction Layer
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              The storage system is decoupled through the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-primary-main font-mono text-xs">StorageProvider</code> interface. Product documents and vendor uploads do not depend directly on Google Drive APIs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-primary-200 bg-primary-50/40 space-y-2">
              <div className="flex items-center gap-2 font-bold text-primary-main">
                <Check className="w-4 h-4" />
                Active: Google Drive Pool
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Connects unlimited personal or workspace Google accounts. Balances uploads across accounts with the highest free space and handles automatic failover.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 opacity-80">
              <div className="flex items-center gap-2 font-bold text-slate-700">
                <Cloud className="w-4 h-4 text-slate-400" />
                Future: AWS S3 / Cloudflare R2
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                When you're ready to migrate to dedicated S3 or R2 buckets, simply plug in the S3 provider adapter without altering product data.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 opacity-80">
              <div className="flex items-center gap-2 font-bold text-slate-700">
                <Database className="w-4 h-4 text-slate-400" />
                Future: Google Cloud Storage
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Enterprise GCS buckets can be attached as a high-throughput provider seamlessly through the same StorageManager interface.
              </p>
            </div>
          </div>

          {/* Key Security & Operation Highlights */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 text-sm">Security & Reliability Guarantees:</h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>No Passwords Stored:</strong> Authenticates strictly via official Google OAuth 2.0. Tokens are scoped to image files.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Vendor Abstraction:</strong> Vendors have zero Google account requirements. They upload seamlessly into the pooled storage.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Automatic Product Deletion:</strong> When a product is deleted by a vendor or admin, its Drive images are automatically deleted from Google Drive to reclaim space.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Client-Side Image Optimization:</strong> Images are auto-compressed prior to upload for fast loading and reduced bandwidth consumption.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Disconnect Warning Modal */}
      {disconnectModalAccount && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Disconnect Google Drive?</h3>
              <p className="text-sm text-slate-500 mt-1">
                Are you sure you want to disconnect <strong>{disconnectModalAccount.email}</strong>?
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <p>• Future vendor uploads will no longer route to this Google Drive account.</p>
              <p>• Existing product images already uploaded to this drive will remain accessible unless deleted in Google Drive.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDisconnectModalAccount(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnectConfirm}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-sm"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
