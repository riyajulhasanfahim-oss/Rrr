/**
 * RJ World BD SMS Reader - Offline Queue, Permission & Sync Manager
 * 
 * Manages:
 * 1. SMS Permission state (must be granted to activate service)
 * 2. Strict Payment SMS processing (bKash, Nagad, Rocket, Upay only)
 * 3. Duplicate Transaction ID suppression
 * 4. Local encrypted/persistent queuing when offline
 * 5. Automatic Firebase synchronization when internet is restored
 * 6. Security: Never uploads full SMS text to Firebase
 */

import {
  PaymentVerificationStatus,
  PaymentMethodType,
  PaymentUserType
} from '../types/paymentVerification';
import {
  parseIncomingPaymentSms,
  RawIncomingSms,
  ExtractedPaymentSms
} from './smsParserService';
import { listPaymentVerifications } from './paymentVerificationService';
import { RTDB_BASE_URL } from '../lib/firebase';

export interface LocalSmsReaderTransaction {
  id: string;
  paymentId: string;
  invoiceId: string;
  userId: string;
  userType: PaymentUserType;
  paymentMethod: PaymentMethodType;
  expectedAmount: number;
  transactionId: string;
  status: PaymentVerificationStatus;
  senderNumber?: string | null;
  receivedAmount?: number | null;
  verifiedAt?: number | null;
  createdAt: number;
  rejectionReason?: string | null;
  syncStatus: 'synced' | 'pending_sync' | 'sync_failed';
  isOfflineCreated: boolean;
}

const LOCAL_STORAGE_KEY = 'rj_world_bd_sms_reader_txs';
const SETTINGS_STORAGE_KEY = 'rj_world_bd_sms_reader_settings';
const SERVICE_STATE_KEY = 'rj_world_bd_service_active';
const PERMISSION_STORAGE_KEY = 'rj_world_bd_sms_permission_granted';

export interface SmsReaderSettings {
  autoStartOnBoot: boolean;
  syncIntervalSeconds: number;
  deviceIdentifier: string;
  keepPersistentNotification: boolean;
  soundAlertOnTransaction: boolean;
}

export const DEFAULT_SETTINGS: SmsReaderSettings = {
  autoStartOnBoot: true,
  syncIntervalSeconds: 15,
  deviceIdentifier: 'RJ-WORLD-READER-01',
  keepPersistentNotification: true,
  soundAlertOnTransaction: true
};

class SmsReaderSyncManager {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isServiceActive: boolean = false;
  private isSmsPermissionGranted: boolean = false;
  private syncListeners: Array<(txs: LocalSmsReaderTransaction[]) => void> = [];
  private statusListeners: Array<(active: boolean, online: boolean, permGranted: boolean) => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const savedPerm = localStorage.getItem(PERMISSION_STORAGE_KEY);
      this.isSmsPermissionGranted = savedPerm === 'true';

      const savedService = localStorage.getItem(SERVICE_STATE_KEY);
      // Service can only be active if SMS permission is granted
      this.isServiceActive = this.isSmsPermissionGranted && (savedService !== null ? savedService === 'true' : true);

      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyStatusListeners();
        this.triggerAutoSync();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyStatusListeners();
      });

      // Start realtime Firestore sync listener
      this.initFirestoreRealtimeListener();
    }
  }

  private initFirestoreRealtimeListener(): void {
    // Single source of truth is Firebase Realtime Database payments node.
  }

  public getSmsPermission(): boolean {
    return this.isSmsPermissionGranted;
  }

  public setSmsPermission(granted: boolean): void {
    this.isSmsPermissionGranted = granted;
    if (typeof window !== 'undefined') {
      localStorage.setItem(PERMISSION_STORAGE_KEY, String(granted));
    }
    if (!granted) {
      this.setServiceActive(false);
    } else {
      this.setServiceActive(true);
    }
    this.notifyStatusListeners();
  }

  public getServiceActive(): boolean {
    return this.isServiceActive && this.isSmsPermissionGranted;
  }

  public setServiceActive(active: boolean): void {
    if (active && !this.isSmsPermissionGranted) {
      console.warn('Cannot activate SMS Reader service without SMS Permission.');
      this.isServiceActive = false;
      this.notifyStatusListeners();
      return;
    }
    this.isServiceActive = active;
    if (typeof window !== 'undefined') {
      localStorage.setItem(SERVICE_STATE_KEY, String(active));
    }
    this.notifyStatusListeners();
  }

  public getNetworkOnline(): boolean {
    return this.isOnline;
  }

  public setSimulatedNetworkStatus(online: boolean): void {
    this.isOnline = online;
    this.notifyStatusListeners();
    if (online) {
      this.triggerAutoSync();
    }
  }

  public getSettings(): SmsReaderSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const data = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public saveSettings(settings: Partial<SmsReaderSettings>): SmsReaderSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    if (typeof window !== 'undefined') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  }

  public getTransactions(): LocalSmsReaderTransaction[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse local SMS Reader transactions', e);
      return [];
    }
  }

  public saveTransactions(txs: LocalSmsReaderTransaction[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(txs));
    this.notifyListeners(txs);
  }

  /**
   * Checks if a Transaction ID already exists in the system (Duplicate Prevention)
   */
  public isDuplicateTransaction(trxId: string): boolean {
    const clean = (trxId || '').trim().toUpperCase();
    if (!clean) return false;
    const txs = this.getTransactions();
    return txs.some(t => (t.transactionId || '').trim().toUpperCase() === clean);
  }

  /**
   * Processes an incoming raw SMS:
   * 1. Checks SMS permission
   * 2. Checks provider (bKash, Nagad, Rocket, Upay only). Rejects any other SMS.
   * 3. Validates and extracts TrxID, Amount, Sender
   * 4. Checks duplicate TrxID (suppresses duplicate)
   * 5. Enqueues locally and syncs to Firebase when online.
   * 6. SECURITY: Never uploads raw SMS body to Firebase.
   */
  public async processIncomingSms(rawSms: RawIncomingSms): Promise<{
    success: boolean;
    reason?: string;
    message: string;
    isDuplicate?: boolean;
    extracted?: ExtractedPaymentSms;
    transaction?: LocalSmsReaderTransaction;
  }> {
    if (!this.isSmsPermissionGranted) {
      return {
        success: false,
        reason: 'permission_required',
        message: 'SMS Permission Required: Service cannot read SMS without granted permission.'
      };
    }

    if (!this.isServiceActive) {
      return {
        success: false,
        reason: 'service_offline',
        message: 'RJ World BD SMS Reader Service is currently paused/offline.'
      };
    }

    // Step 1: Parse & Validate
    const parseResult = parseIncomingPaymentSms(rawSms);
    if (parseResult.success === false) {
      // Ignore non-payment SMS. Do not save, do not count, do not upload.
      return {
        success: false,
        reason: parseResult.reason,
        message: parseResult.details || 'Ignored: Non-payment or unsupported SMS.'
      };
    }

    const { data } = parseResult;

    // Step 2: Duplicate check
    if (this.isDuplicateTransaction(data.transactionId)) {
      console.warn(`Duplicate SMS detected for TrxID: ${data.transactionId}. Skipping creation.`);
      return {
        success: false,
        isDuplicate: true,
        reason: 'duplicate_trx',
        message: `Duplicate Transaction ID detected (${data.transactionId}). No duplicate record created.`,
        extracted: data
      };
    }

    // Step 3: Create Local Record
    const isOffline = !this.isOnline;
    const paymentId = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const invoiceId = `INV-${Date.now().toString().slice(-6)}`;

    const newTx: LocalSmsReaderTransaction = {
      id: `LOCAL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      paymentId,
      invoiceId,
      userId: 'customer_sms_detected',
      userType: 'customer',
      paymentMethod: data.paymentMethod,
      expectedAmount: data.amount,
      receivedAmount: data.amount,
      transactionId: data.transactionId,
      status: 'pending', // Verification status is pending until matching logic runs
      senderNumber: data.senderNumber,
      verifiedAt: null,
      createdAt: data.receivedAt || Date.now(),
      rejectionReason: null,
      syncStatus: 'pending_sync', // Initially queued
      isOfflineCreated: isOffline
    };

    const currentTxs = this.getTransactions();
    const updated = [newTx, ...currentTxs];
    this.saveTransactions(updated);

    // Step 4: Sync to Firebase if Online
    if (this.isOnline) {
      await this.syncSingleTransaction(newTx);
    }

    return {
      success: true,
      message: `Verified SMS received from ${data.providerName}: ৳${data.amount} (TrxID: ${data.transactionId})`,
      extracted: data,
      transaction: newTx
    };
  }

  /**
   * Records a new transaction manually or from test queue
   */
  public async queueTransaction(
    tx: Omit<LocalSmsReaderTransaction, 'id' | 'createdAt' | 'syncStatus' | 'isOfflineCreated'>
  ): Promise<LocalSmsReaderTransaction> {
    const isOffline = !this.isOnline || !this.isServiceActive;
    const newTx: LocalSmsReaderTransaction = {
      ...tx,
      id: `LOCAL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
      status: tx.status || 'pending',
      syncStatus: 'pending_sync',
      isOfflineCreated: isOffline
    };

    const currentTxs = this.getTransactions();
    const updated = [newTx, ...currentTxs];
    this.saveTransactions(updated);

    if (this.isOnline && this.isServiceActive) {
      await this.syncSingleTransaction(newTx);
    }

    return newTx;
  }

  public updateTransactionStatus(idOrTrxId: string, status: PaymentVerificationStatus): void {
    const clean = idOrTrxId.trim().toUpperCase();
    const all = this.getTransactions();
    const updated = all.map(t => {
      if (t.transactionId.toUpperCase() === clean || t.paymentId.toUpperCase() === clean || t.id === idOrTrxId) {
        return {
          ...t,
          status,
          verifiedAt: status === 'verified' ? Date.now() : t.verifiedAt
        };
      }
      return t;
    });
    this.saveTransactions(updated);
  }

  /**
   * Syncs a single queued transaction to Firebase Realtime Database 'payments' node
   * SECURITY: Only uploads extracted payment fields, never full SMS text.
   * Status is strictly 'SYNCED'. No verifiedAt is written.
   */
  private async syncSingleTransaction(tx: LocalSmsReaderTransaction): Promise<boolean> {
    try {
      const now = Date.now();
      const rtdbPayload = {
        amount: Number(tx.receivedAmount || tx.expectedAmount) || 0,
        paymentMethod: tx.paymentMethod,
        receivedAt: tx.createdAt || now,
        senderNumber: tx.senderNumber || '',
        status: 'SYNCED',
        syncedAt: now,
        transactionId: (tx.transactionId || '').trim().replace(/\s+/g, '').toUpperCase()
      };

      try {
        await fetch('/api/payment/sms-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rtdbPayload)
        });
      } catch {
        await fetch(`${RTDB_BASE_URL}/payments.json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rtdbPayload)
        });
      }

      // Mark locally as synced
      const all = this.getTransactions();
      const updated = all.map(item =>
        item.id === tx.id ? { ...item, syncStatus: 'synced' as const } : item
      );
      this.saveTransactions(updated);

      return true;
    } catch (err) {
      console.warn(`Sync failed for tx ${tx.id}:`, err);
      const all = this.getTransactions();
      const updated = all.map(item =>
        item.id === tx.id ? { ...item, syncStatus: 'sync_failed' as const } : item
      );
      this.saveTransactions(updated);
      return false;
    }
  }

  /**
   * Trigger automatic synchronization of all pending queued transactions
   */
  public async triggerAutoSync(): Promise<{ successCount: number; failedCount: number }> {
    if (!this.isOnline || !this.isServiceActive) {
      return { successCount: 0, failedCount: 0 };
    }

    const txs = this.getTransactions();
    const pending = txs.filter(t => t.syncStatus !== 'synced');

    let successCount = 0;
    let failedCount = 0;

    for (const tx of pending) {
      const ok = await this.syncSingleTransaction(tx);
      if (ok) successCount++;
      else failedCount++;
    }

    return { successCount, failedCount };
  }

  /**
   * Loads and merges remote Firebase payment records into local cache
   */
  public async refreshFromFirebase(): Promise<void> {
    if (!this.isOnline) return;
    try {
      const remoteRecords = await listPaymentVerifications({ limitCount: 40 });
      const local = this.getTransactions();
      const localMap = new Map<string, LocalSmsReaderTransaction>();
      local.forEach(t => localMap.set(t.paymentId, t));

      remoteRecords.forEach(remote => {
        const existing = localMap.get(remote.paymentId);
        if (!existing) {
          localMap.set(remote.paymentId, {
            id: `REMOTE-${remote.paymentId}`,
            paymentId: remote.paymentId,
            invoiceId: remote.invoiceId,
            userId: remote.userId,
            userType: remote.userType,
            paymentMethod: remote.paymentMethod,
            expectedAmount: remote.expectedAmount,
            transactionId: remote.transactionId,
            status: remote.status,
            senderNumber: remote.senderNumber,
            receivedAmount: remote.receivedAmount,
            verifiedAt: remote.verifiedAt,
            createdAt: remote.createdAt,
            rejectionReason: remote.rejectionReason,
            syncStatus: 'synced',
            isOfflineCreated: false
          });
        } else {
          localMap.set(remote.paymentId, {
            ...existing,
            status: remote.status,
            receivedAmount: remote.receivedAmount,
            verifiedAt: remote.verifiedAt,
            rejectionReason: remote.rejectionReason,
            syncStatus: 'synced'
          });
        }
      });

      const merged = Array.from(localMap.values()).sort((a, b) => b.createdAt - a.createdAt);
      this.saveTransactions(merged);
    } catch (e) {
      console.warn('Could not refresh from Firebase:', e);
    }
  }

  public subscribeTransactions(listener: (txs: LocalSmsReaderTransaction[]) => void): () => void {
    this.syncListeners.push(listener);
    listener(this.getTransactions());
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  public subscribeStatus(listener: (active: boolean, online: boolean, permGranted: boolean) => void): () => void {
    this.statusListeners.push(listener);
    listener(this.isServiceActive, this.isOnline, this.isSmsPermissionGranted);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(txs: LocalSmsReaderTransaction[]): void {
    this.syncListeners.forEach(fn => fn(txs));
  }

  private notifyStatusListeners(): void {
    this.statusListeners.forEach(fn => fn(this.isServiceActive, this.isOnline, this.isSmsPermissionGranted));
  }
}

export const smsReaderSyncManager = new SmsReaderSyncManager();
