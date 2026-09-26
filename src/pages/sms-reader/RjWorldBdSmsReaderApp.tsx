import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Power,
  ArrowUpDown,
  Sliders,
  ShieldCheck,
  AlertCircle,
  HardDrive,
  Layers,
  Search,
  ChevronRight,
  PlusCircle,
  RotateCw,
  MessageSquare,
  ShieldAlert,
  Send,
  Copy,
  Info,
  Check,
  CloudCheck,
  Radio
} from 'lucide-react';
import {
  smsReaderSyncManager,
  LocalSmsReaderTransaction,
  SmsReaderSettings
} from '../../services/smsReaderOfflineQueue';
import { RawIncomingSms } from '../../services/smsParserService';
import { PaymentMethodType, PaymentUserType } from '../../types/paymentVerification';

export default function RjWorldBdSmsReaderApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'settings'>('dashboard');
  const [serviceActive, setServiceActive] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<LocalSmsReaderTransaction[]>([]);
  const [settings, setSettings] = useState<SmsReaderSettings>(smsReaderSyncManager.getSettings());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  type StatusFilter = 'all' | 'pending_sync' | 'synced' | 'verified' | 'rejected' | 'pending';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Permission prompt modal
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);

  // SMS Simulator / Detection Test State
  const [showSmsSimulator, setShowSmsSimulator] = useState<boolean>(false);
  const [simSender, setSimSender] = useState<string>('bKash');
  const [simBody, setSimBody] = useState<string>(
    'You have received Tk 1,500.00 from 01712345678. Fee Tk 0.00. Balance Tk 4,250.00. TrxID BL99XYZ123 at 05/09/2026 14:30'
  );
  const [detectionLogs, setDetectionLogs] = useState<Array<{ id: string; time: string; message: string; type: 'success' | 'rejected' | 'duplicate' }>>([]);

  useEffect(() => {
    const unsubTx = smsReaderSyncManager.subscribeTransactions((txs) => {
      setTransactions(txs);
    });

    const unsubStatus = smsReaderSyncManager.subscribeStatus((active, online, permGranted) => {
      setServiceActive(active);
      setIsOnline(online);
      setHasPermission(permGranted);
      if (!permGranted) {
        setShowPermissionModal(true);
      }
    });

    // Check permission initially
    const initialPerm = smsReaderSyncManager.getSmsPermission();
    setHasPermission(initialPerm);
    if (!initialPerm) {
      setShowPermissionModal(true);
    }

    // Refresh from Firebase if online
    smsReaderSyncManager.refreshFromFirebase();

    return () => {
      unsubTx();
      unsubStatus();
    };
  }, []);

  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleGrantPermission = () => {
    smsReaderSyncManager.setSmsPermission(true);
    setHasPermission(true);
    setServiceActive(true);
    setShowPermissionModal(false);
    showToast('SMS Permission Granted! RJ World BD SMS Reader is now active.', 'success');
  };

  const handleDenyPermission = () => {
    smsReaderSyncManager.setSmsPermission(false);
    setHasPermission(false);
    setServiceActive(false);
    setShowPermissionModal(false);
    showToast('SMS Permission Denied. Service cannot operate without permission.', 'warning');
  };

  const handleToggleService = () => {
    if (!hasPermission) {
      setShowPermissionModal(true);
      return;
    }
    const nextState = !serviceActive;
    smsReaderSyncManager.setServiceActive(nextState);
    setServiceActive(nextState);
    showToast(nextState ? 'Service Activated' : 'Service Paused', nextState ? 'success' : 'warning');
  };

  const handleToggleSimulatedNetwork = () => {
    const nextOnline = !isOnline;
    smsReaderSyncManager.setSimulatedNetworkStatus(nextOnline);
    setIsOnline(nextOnline);
    showToast(nextOnline ? 'Network restored (ONLINE)' : 'Network disconnected (OFFLINE)', nextOnline ? 'success' : 'warning');
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const { successCount, failedCount } = await smsReaderSyncManager.triggerAutoSync();
      await smsReaderSyncManager.refreshFromFirebase();
      showToast(
        `Sync completed: ${successCount} synced${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        failedCount > 0 ? 'warning' : 'success'
      );
    } catch (e: any) {
      showToast(`Sync failed: ${e.message || 'Network error'}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Simulates an incoming payment SMS to verify detection engine
  const handleSimulateIncomingSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simBody.trim()) return;

    const rawSms: RawIncomingSms = {
      sender: simSender.trim(),
      body: simBody.trim(),
      timestamp: Date.now()
    };

    const result = await smsReaderSyncManager.processIncomingSms(rawSms);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (result.success && result.transaction) {
      setDetectionLogs(prev => [
        { id: String(Date.now()), time: nowTime, message: result.message, type: 'success' },
        ...prev.slice(0, 9)
      ]);
      showToast(result.message, 'success');
    } else if (result.isDuplicate) {
      setDetectionLogs(prev => [
        { id: String(Date.now()), time: nowTime, message: result.message, type: 'duplicate' },
        ...prev.slice(0, 9)
      ]);
      showToast(result.message, 'warning');
    } else {
      setDetectionLogs(prev => [
        { id: String(Date.now()), time: nowTime, message: result.message, type: 'rejected' },
        ...prev.slice(0, 9)
      ]);
      showToast(result.message, 'error');
    }
  };

  // Quick preset templates for testing
  const applyPreset = (type: 'bkash' | 'nagad' | 'rocket' | 'upay' | 'promo' | 'duplicate') => {
    if (type === 'bkash') {
      const randomTrx = `BL${Math.floor(1000 + Math.random() * 9000)}XYZ${Math.floor(10 + Math.random() * 89)}`;
      setSimSender('bKash');
      setSimBody(`You have received Tk 1,200.00 from 01798765432. Fee Tk 0.00. Balance Tk 5,400.00. TrxID ${randomTrx} at ${new Date().toLocaleDateString()}`);
    } else if (type === 'nagad') {
      const randomTrx = `71GH${Math.floor(1000 + Math.random() * 9000)}`;
      setSimSender('Nagad');
      setSimBody(`Cash In of Tk 500.00 from 01811223344 is successful. TxnID: ${randomTrx}. Balance: Tk 1,800.00. Fee: Tk 0.00.`);
    } else if (type === 'rocket') {
      const randomTrx = `3089${Math.floor(100000 + Math.random() * 900000)}`;
      setSimSender('16216');
      setSimBody(`Tk 2,500.00 credited to A/C: 01712345678-9 from A/C: 01998877665-1. TxnId: ${randomTrx}. Bal: Tk 12,000.00.`);
    } else if (type === 'upay') {
      const randomTrx = `9876${Math.floor(1000 + Math.random() * 9000)}`;
      setSimSender('upay');
      setSimBody(`You have received Tk 350.00 from 01655443322. TrxID ${randomTrx}. Bal Tk 750.00.`);
    } else if (type === 'promo') {
      setSimSender('GP-OFFER');
      setSimBody(`Dhamaka Internet Offer! 1GB only 19 Tk for 3 days. Dial *121*123# to activate. Valid till tonight.`);
    } else if (type === 'duplicate') {
      if (transactions.length > 0) {
        const existing = transactions[0];
        setSimSender(existing.paymentMethod);
        setSimBody(`Duplicate Alert: You have received Tk ${existing.expectedAmount}.00. TrxID ${existing.transactionId}`);
      } else {
        setSimSender('bKash');
        setSimBody(`You have received Tk 500.00. TrxID TESTDUP123`);
      }
    }
  };

  // Counters
  const totalCount = transactions.length;
  const pendingCount = transactions.filter(t => t.status === 'pending').length;
  const syncedCount = transactions.filter(t => t.syncStatus === 'synced').length;
  const verifiedCount = transactions.filter(t => t.status === 'verified').length;
  const rejectedCount = transactions.filter(t => t.status === 'rejected').length;
  const pendingSyncCount = transactions.filter(t => t.syncStatus !== 'synced').length;

  const filteredTransactions = transactions.filter(t => {
    if (statusFilter === 'pending_sync' && t.syncStatus === 'synced') return false;
    if (statusFilter === 'synced' && t.syncStatus !== 'synced') return false;
    if (statusFilter === 'verified' && t.status !== 'verified') return false;
    if (statusFilter === 'rejected' && t.status !== 'rejected') return false;
    if (statusFilter === 'pending' && t.status !== 'pending') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.transactionId.toLowerCase().includes(q) ||
        t.invoiceId.toLowerCase().includes(q) ||
        t.paymentMethod.toLowerCase().includes(q) ||
        (t.senderNumber && t.senderNumber.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-sky-500 selection:text-white">
      {/* Device Shell Container */}
      <div className="w-full max-w-lg mx-auto flex flex-col flex-1 shadow-2xl bg-slate-950 border-x border-slate-800 min-h-screen">
        
        {/* ========================================================================= */}
        {/* ANDROID STATUS BAR */}
        {/* ========================================================================= */}
        <div className="bg-slate-950 px-4 py-2 flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-slate-800/80 select-none">
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-slate-300">
            <span>RJ World BD</span>
            <span className="text-slate-600">•</span>
            <span className="text-[10px] text-sky-400 uppercase font-semibold">SMS Reader</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSimulatedNetwork}
              title={isOnline ? 'Online (Click to toggle offline simulation)' : 'Offline (Click to toggle online)'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                isOnline ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
              }`}
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </button>
            <div className="flex items-center gap-1 text-slate-400">
              <span>98%</span>
              <div className="w-4 h-2 border border-slate-500 rounded-xs p-0.5 flex items-center">
                <div className="w-full h-full bg-emerald-400 rounded-xs"></div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PERSISTENT FOREGROUND NOTIFICATION (Requirement 4) */}
        {/* ========================================================================= */}
        {settings.keepPersistentNotification && (
          serviceActive && hasPermission ? (
            <div className="bg-gradient-to-r from-slate-900 via-sky-950/70 to-slate-900 border-b border-sky-500/30 p-3 sm:px-4 flex items-center gap-3 shadow-inner">
              <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
                <Smartphone className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <p className="text-xs font-bold text-white tracking-wide">
                      RJ World BD Payment Service
                    </p>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-950 border border-sky-700 text-sky-300 font-semibold">
                    Active
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-300 mt-0.5">
                  Pending: <strong className="text-amber-300">{pendingCount}</strong> | Synced: <strong className="text-sky-300">{syncedCount}</strong>
                  {pendingSyncCount > 0 && (
                    <span className="text-amber-400 ml-1 font-sans text-[10px]">
                      ({pendingSyncCount} Pending Sync)
                    </span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-rose-950/40 border-b border-rose-900/60 p-2.5 px-4 flex items-center justify-between text-xs text-rose-300">
              <div className="flex items-center gap-2">
                <Power className="w-4 h-4 text-rose-400" />
                <div>
                  <p className="font-bold text-rose-200">RJ World BD Payment Service</p>
                  <p className="text-[11px] text-rose-300/80">
                    Pending: {pendingCount} | Synced: {syncedCount} • Inactive
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleService}
                className="text-[11px] px-2.5 py-1 bg-rose-900/80 hover:bg-rose-800 text-white rounded-md font-bold cursor-pointer transition-colors"
              >
                Enable
              </button>
            </div>
          )
        )}

        {/* Permission Required Banner if missing */}
        {!hasPermission && (
          <div className="bg-gradient-to-r from-amber-950/90 via-amber-900/70 to-amber-950/90 border-b border-amber-600/40 p-2.5 px-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
              <span className="text-xs text-amber-200 font-medium">SMS Permission Not Granted</span>
            </div>
            <button
              onClick={() => setShowPermissionModal(true)}
              className="px-2.5 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded cursor-pointer"
            >
              Grant
            </button>
          </div>
        )}

        {/* Feedback Alert Bar */}
        {feedback && (
          <div className={`text-xs px-4 py-2 flex items-center justify-between border-b transition-all ${
            feedback.type === 'success' ? 'bg-emerald-950 text-emerald-200 border-emerald-800' :
            feedback.type === 'warning' ? 'bg-amber-950 text-amber-200 border-amber-800' :
            'bg-rose-950 text-rose-200 border-rose-800'
          }`}>
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> :
               feedback.type === 'warning' ? <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> :
               <XCircle className="w-3.5 h-3.5 text-rose-400" />}
              <span>{feedback.text}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white font-bold ml-2">✕</button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MAIN BODY */}
        {/* ========================================================================= */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* ========================================================================= */}
          {/* OPTION 1: DASHBOARD */}
          {/* ========================================================================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              
              {/* Header Title */}
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Dashboard
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-Time SMS Reader & Sync Status
                  </p>
                </div>
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing || !isOnline}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-50 text-xs font-semibold text-sky-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync</span>
                </button>
              </div>

              {/* 1. Real-Time Status Indicators (Requirement 1):
                  - Service Status: Active / Offline
                  - SMS Permission: Granted / Not Granted
                  - Internet: Online / Offline */}
              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 block mb-2">
                  System Status
                </span>
                <div className="grid grid-cols-3 gap-2">
                  
                  {/* Service Status: Active / Offline */}
                  <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Service Status
                    </span>
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        serviceActive && hasPermission ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                      }`}></span>
                      <span className={`text-xs sm:text-sm font-black ${
                        serviceActive && hasPermission ? 'text-emerald-300' : 'text-rose-400'
                      }`}>
                        {serviceActive && hasPermission ? 'Active' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  {/* SMS Permission: Granted / Not Granted */}
                  <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      SMS Permission
                    </span>
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        hasPermission ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}></span>
                      <span className={`text-xs sm:text-sm font-black ${
                        hasPermission ? 'text-emerald-300' : 'text-amber-400'
                      }`}>
                        {hasPermission ? 'Granted' : 'Not Granted'}
                      </span>
                    </div>
                  </div>

                  {/* Internet: Online / Offline */}
                  <button
                    onClick={handleToggleSimulatedNetwork}
                    title="Click to toggle network simulation"
                    className="bg-slate-900 hover:bg-slate-800/80 rounded-xl p-3 border border-slate-800 text-center cursor-pointer transition-colors"
                  >
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Internet
                    </span>
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        isOnline ? 'bg-emerald-400' : 'bg-rose-500'
                      }`}></span>
                      <span className={`text-xs sm:text-sm font-black ${
                        isOnline ? 'text-emerald-300' : 'text-rose-400'
                      }`}>
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Real-Time Dynamic Transaction Metrics (Requirement 1):
                  - Total Transactions
                  - Pending
                  - Verified
                  - Rejected
                  - Pending Sync
                  (All dynamically derived from local queue & Firebase) */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Transaction Metrics
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  
                  {/* 1. Total Transactions */}
                  <div className="bg-slate-900 rounded-xl p-3.5 border border-slate-800 text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Total Transactions
                    </div>
                    <div className="text-2xl font-black text-white mt-1">
                      {totalCount}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Dynamically Tracked</div>
                  </div>

                  {/* 2. Pending */}
                  <div className="bg-amber-950/20 rounded-xl p-3.5 border border-amber-800/40 text-center">
                    <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                      Pending
                    </div>
                    <div className="text-2xl font-black text-amber-300 mt-1">
                      {pendingCount}
                    </div>
                    <div className="text-[10px] text-amber-500/80 mt-0.5">Awaiting Match</div>
                  </div>

                  {/* 3. Verified */}
                  <div className="bg-emerald-950/20 rounded-xl p-3.5 border border-emerald-800/40 text-center">
                    <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                      Verified
                    </div>
                    <div className="text-2xl font-black text-emerald-300 mt-1">
                      {verifiedCount}
                    </div>
                    <div className="text-[10px] text-emerald-500/80 mt-0.5">Approved & Matched</div>
                  </div>

                  {/* 4. Rejected */}
                  <div className="bg-rose-950/20 rounded-xl p-3.5 border border-rose-800/40 text-center">
                    <div className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                      Rejected
                    </div>
                    <div className="text-2xl font-black text-rose-300 mt-1">
                      {rejectedCount}
                    </div>
                    <div className="text-[10px] text-rose-500/80 mt-0.5">Mismatch / Cancelled</div>
                  </div>

                  {/* 5. Pending Sync */}
                  <div className="bg-amber-950/30 rounded-xl p-3.5 border border-amber-600/50 text-center">
                    <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      Pending Sync
                    </div>
                    <div className="text-2xl font-black text-amber-200 mt-1">
                      {pendingSyncCount}
                    </div>
                    <div className="text-[10px] text-amber-400/80 mt-0.5">
                      {pendingSyncCount > 0 ? (isOnline ? 'Syncing...' : 'In Offline Queue') : 'All Synced'}
                    </div>
                  </div>

                  {/* 6. Synced (In Cloud) */}
                  <div className="bg-sky-950/20 rounded-xl p-3.5 border border-sky-800/40 text-center">
                    <div className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">
                      Synced
                    </div>
                    <div className="text-2xl font-black text-sky-300 mt-1">
                      {syncedCount}
                    </div>
                    <div className="text-[10px] text-sky-500/80 mt-0.5">Uploaded to Firebase</div>
                  </div>
                </div>
              </div>

              {/* Supported Providers Badge Container */}
              <div className="bg-slate-900/60 rounded-xl p-3.5 border border-slate-800/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Supported 4 Payment Methods
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Strict Parser</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold pt-1">
                  <div className="bg-pink-950/40 border border-pink-700/50 text-pink-300 py-1.5 rounded-lg">bKash</div>
                  <div className="bg-orange-950/40 border border-orange-700/50 text-orange-300 py-1.5 rounded-lg">Nagad</div>
                  <div className="bg-purple-950/40 border border-purple-700/50 text-purple-300 py-1.5 rounded-lg">Rocket</div>
                  <div className="bg-blue-950/40 border border-blue-700/50 text-blue-300 py-1.5 rounded-lg">Upay</div>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight pt-1">
                  * শুধুমাত্র bKash, Nagad, Rocket এবং Upay-এর পেমেন্ট SMS প্রসেস করা হবে। অন্য কোনো SMS কখনো রেকর্ড বা আপলোড হবে না।
                </p>
              </div>

              {/* Test / Simulate Incoming Payment SMS Action */}
              <div className="pt-1">
                <button
                  onClick={() => setShowSmsSimulator(!showSmsSimulator)}
                  className="w-full h-11 bg-gradient-to-r from-sky-600 to-primary-main hover:from-sky-500 hover:to-sky-600 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{showSmsSimulator ? 'Hide SMS Simulator' : 'Test Payment SMS Detection (Simulator)'}</span>
                </button>
              </div>

              {/* SMS Simulator Expansion Panel */}
              {showSmsSimulator && (
                <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-4 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-sky-400 animate-pulse" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                        Incoming SMS Detection Simulator
                      </h3>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Test Parser & Queue</span>
                  </div>

                  {/* Preset Template Buttons */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400">Load Test Preset:</span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyPreset('bkash')}
                        className="px-2 py-1 rounded bg-pink-950/60 hover:bg-pink-900/80 text-pink-200 border border-pink-800 text-[11px] font-semibold cursor-pointer"
                      >
                        bKash SMS
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('nagad')}
                        className="px-2 py-1 rounded bg-orange-950/60 hover:bg-orange-900/80 text-orange-200 border border-orange-800 text-[11px] font-semibold cursor-pointer"
                      >
                        Nagad SMS
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('rocket')}
                        className="px-2 py-1 rounded bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-800 text-[11px] font-semibold cursor-pointer"
                      >
                        Rocket SMS
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('upay')}
                        className="px-2 py-1 rounded bg-blue-950/60 hover:bg-blue-900/80 text-blue-200 border border-blue-800 text-[11px] font-semibold cursor-pointer"
                      >
                        Upay SMS
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('promo')}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                      >
                        Invalid (Promo SMS)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('duplicate')}
                        className="px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800 text-[11px] font-semibold cursor-pointer"
                      >
                        Duplicate TrxID
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleSimulateIncomingSms} className="space-y-2.5 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">SMS Sender (Address):</label>
                      <input
                        type="text"
                        value={simSender}
                        onChange={(e) => setSimSender(e.target.value)}
                        placeholder="e.g. bKash, Nagad, 16216, upay"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono outline-none focus:border-sky-500 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">SMS Text Content:</label>
                      <textarea
                        rows={3}
                        value={simBody}
                        onChange={(e) => setSimBody(e.target.value)}
                        placeholder="Paste SMS content..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs font-mono outline-none focus:border-sky-500 leading-relaxed"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!hasPermission || !serviceActive}
                      className="w-full h-9 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-md"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Trigger Incoming SMS Detection</span>
                    </button>
                  </form>

                  {/* Detection Log Stream */}
                  {detectionLogs.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detection Logs:</span>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {detectionLogs.map((log) => (
                          <div
                            key={log.id}
                            className={`p-2 rounded-lg text-[11px] font-mono leading-tight flex items-start gap-2 ${
                              log.type === 'success' ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/60' :
                              log.type === 'duplicate' ? 'bg-amber-950/40 text-amber-300 border border-amber-900/60' :
                              'bg-rose-950/40 text-rose-300 border border-rose-900/60'
                            }`}
                          >
                            <span className="text-slate-500 shrink-0">[{log.time}]</span>
                            <span>{log.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Recent Detected Transactions Snapshot */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>Recent SMS Activity</span>
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className="text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                  >
                    View All <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {transactions.length === 0 ? (
                  <div className="bg-slate-900/40 rounded-xl p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800">
                    No payment SMS detected yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions.slice(0, 3).map((tx) => (
                      <div
                        key={tx.id}
                        className="bg-slate-900 rounded-xl p-3 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white uppercase font-mono">
                              {tx.transactionId}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded uppercase font-semibold bg-slate-800 text-slate-300">
                              {tx.paymentMethod}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            ৳{tx.expectedAmount} • {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        <div>
                          {tx.syncStatus === 'pending_sync' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              <Clock className="w-3 h-3" /> Pending Sync
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-800">
                              <CheckCircle2 className="w-3 h-3" /> Synced
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* OPTION 2: TRANSACTIONS (Requirement 2) */}
          {/* ========================================================================= */}
          {activeTab === 'transactions' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <div>
                  <h1 className="text-xl font-black text-white tracking-tight">
                    Transactions
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Detected bKash, Nagad, Rocket & Upay Payments Only
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-slate-900 border border-slate-800 text-sky-400">
                  {filteredTransactions.length} Record{filteredTransactions.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Filters & Search */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by TrxID, Method, Sender Number..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500 placeholder:text-slate-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {([
                    { key: 'all', label: 'All' },
                    { key: 'pending_sync', label: 'Pending Sync' },
                    { key: 'synced', label: 'Synced' },
                    { key: 'verified', label: 'Verified' },
                    { key: 'rejected', label: 'Rejected' },
                    { key: 'pending', label: 'Pending' }
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setStatusFilter(tab.key)}
                      className={`px-3 py-1 rounded-lg font-semibold cursor-pointer transition-colors whitespace-nowrap text-xs ${
                        statusFilter === tab.key
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transactions List */}
              {filteredTransactions.length === 0 ? (
                <div className="bg-slate-900/50 rounded-2xl p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800">
                  No payment transactions match your current search or filter.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTransactions.map((tx) => {
                    const methodUpper = (tx.paymentMethod || '').toUpperCase();
                    const methodBadgeColor =
                      methodUpper.includes('BKASH') ? 'bg-pink-950/60 text-pink-300 border-pink-700/60' :
                      methodUpper.includes('NAGAD') ? 'bg-orange-950/60 text-orange-300 border-orange-700/60' :
                      methodUpper.includes('ROCKET') ? 'bg-purple-950/60 text-purple-300 border-purple-700/60' :
                      'bg-blue-950/60 text-blue-300 border-blue-700/60';

                    return (
                      <div
                        key={tx.id}
                        className="bg-slate-900 rounded-xl p-3.5 border border-slate-800 shadow-sm space-y-2.5 hover:border-slate-700 transition-colors"
                      >
                        {/* Top Row: Method & Transaction ID & Status Badge */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${methodBadgeColor}`}>
                              {tx.paymentMethod}
                            </span>
                            <span className="font-mono font-bold text-sm text-white tracking-wide">
                              {tx.transactionId}
                            </span>
                          </div>

                          {/* Primary Status Badge */}
                          <div>
                            {tx.syncStatus === 'pending_sync' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700 animate-pulse">
                                <Clock className="w-3 h-3" /> Pending Sync
                              </span>
                            ) : tx.status === 'verified' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                                <CheckCircle2 className="w-3 h-3" /> Verified
                              </span>
                            ) : tx.status === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                <XCircle className="w-3 h-3" /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-800">
                                <CheckCircle2 className="w-3 h-3" /> Synced
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle Row: Amount & Sender details */}
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 border-t border-slate-800/60 pt-2">
                          <div>
                            <span className="text-slate-500">Amount: </span>
                            <span className="font-black text-white text-sm">৳{tx.expectedAmount}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500">Sender: </span>
                            <span className="font-mono text-slate-300">{tx.senderNumber || 'Unknown'}</span>
                          </div>
                        </div>

                        {/* Bottom Row: Received Time, Sync Status, and Verification Status (Requirement 2) */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/50 pt-2">
                          <div>
                            <span className="text-slate-500">Received Time: </span>
                            <span className="text-slate-300">
                              {new Date(tx.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                              {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[10px]">
                            <div>
                              <span className="text-slate-500">Sync: </span>
                              <span className={tx.syncStatus === 'synced' ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-bold'}>
                                {tx.syncStatus === 'synced' ? 'Synced' : 'Pending Sync'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Verification: </span>
                              <span className={
                                tx.status === 'verified' ? 'text-emerald-400 font-bold' :
                                tx.status === 'rejected' ? 'text-rose-400 font-bold' :
                                'text-amber-300 font-semibold'
                              }>
                                {tx.status === 'verified' ? 'Verified' : tx.status === 'rejected' ? 'Rejected' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* OPTION 3: SETTINGS (Requirement 3) */}
          {/* ========================================================================= */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="pb-1 border-b border-slate-800">
                <h1 className="text-xl font-black text-white tracking-tight">
                  Settings
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Service, Notification & Firebase Sync Controls
                </p>
              </div>

              {/* Service Controls Container */}
              <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 space-y-4 text-xs">
                
                {/* 1. Master Control: Enable/Disable Payment SMS Monitoring */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="space-y-0.5 pr-2">
                    <p className="font-bold text-white">Payment SMS Monitoring</p>
                    <p className="text-slate-400 text-[11px]">
                      Enable or disable background SMS reader service. When disabled, monitoring stops and dashboard shows Offline.
                    </p>
                  </div>
                  <button
                    onClick={handleToggleService}
                    className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                      hasPermission && serviceActive ? 'bg-emerald-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        hasPermission && serviceActive ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* 2. SMS Permission Status */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="space-y-0.5 pr-2">
                    <p className="font-bold text-white">SMS Permission Status</p>
                    <p className="text-slate-400 text-[11px]">
                      Current: <strong className={hasPermission ? 'text-emerald-400' : 'text-amber-400'}>
                        {hasPermission ? 'Granted' : 'Not Granted'}
                      </strong>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!hasPermission) {
                        setShowPermissionModal(true);
                      } else {
                        // Toggle permission for test / revoke simulation
                        smsReaderSyncManager.setSmsPermission(false);
                        setHasPermission(false);
                        setServiceActive(false);
                        showToast('SMS Permission revoked', 'warning');
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      hasPermission ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    {hasPermission ? 'Revoke' : 'Grant Now'}
                  </button>
                </div>

                {/* 3. Notification Status */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="space-y-0.5 pr-2">
                    <p className="font-bold text-white">Notification Status</p>
                    <p className="text-slate-400 text-[11px]">
                      Persistent Android status bar showing: <span className="font-mono text-slate-300">Pending: X | Synced: X</span>
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.keepPersistentNotification}
                    onChange={(e) => {
                      const upd = smsReaderSyncManager.saveSettings({ keepPersistentNotification: e.target.checked });
                      setSettings(upd);
                      showToast(`Notification ${e.target.checked ? 'Enabled' : 'Disabled'}`, 'success');
                    }}
                    className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                  />
                </div>

                {/* 4. Background Service Status */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="space-y-0.5 pr-2">
                    <p className="font-bold text-white">Background Service Status</p>
                    <p className="text-slate-400 text-[11px]">
                      Foreground Service: <strong className={serviceActive && hasPermission ? 'text-emerald-400' : 'text-rose-400'}>
                        {serviceActive && hasPermission ? 'Active (Running in Background)' : 'Offline (Stopped)'}
                      </strong>
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    serviceActive && hasPermission ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}>
                    {serviceActive && hasPermission ? 'Active' : 'Offline'}
                  </span>
                </div>

                {/* 5. Firebase Sync Status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-white">Firebase Sync Status</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      isOnline ? 'bg-sky-950 text-sky-300 border border-sky-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {isOnline ? 'Connected' : 'Waiting for Internet'}
                    </span>
                  </div>
                  
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Target Node:</span>
                      <span className="font-mono font-bold text-sky-400">payments</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Local Queue (Pending Sync):</span>
                      <span className={`font-mono font-bold ${pendingSyncCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {pendingSyncCount} record(s)
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing || !isOnline}
                    className="w-full h-9 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Syncing with Firebase...' : 'Force Sync Now'}</span>
                  </button>
                </div>
              </div>

              {/* Security & Scope Summary */}
              <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800/80 space-y-2 text-xs text-slate-400">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Security & Architecture Rules
                </p>
                <ul className="text-[11px] space-y-1 list-disc pl-4 text-slate-400">
                  <li>শুধুমাত্র bKash, Nagad, Rocket এবং Upay-এর SMS প্রসেস করা হবে।</li>
                  <li>অন্য কোনো SMS-এর কন্টেন্ট স্টোর বা Firebase-এ আপলোড হবে না।</li>
                  <li>ডুপ্লিকেট TrxID এলে স্বয়ংক্রিয়ভাবে বাতিল হবে।</li>
                  <li>পেমেন্ট ভেরিফিকেশনের কর্তৃত্ব সম্পূর্ণ সুরক্ষিত ব্যাকএন্ড/Firebase লজিকের কাছেই থাকবে।</li>
                </ul>
              </div>

              <div className="text-center text-[11px] text-slate-500 pt-1">
                RJ World BD SMS Reader • Dashboard • Transactions • Settings
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* ANDROID BOTTOM NAVIGATION (3 Options) */}
        {/* ========================================================================= */}
        <div className="bg-slate-950 border-t border-slate-800/90 px-3 py-2 flex items-center justify-around select-none">
          
          {/* 1. Dashboard */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl cursor-pointer transition-colors ${
              activeTab === 'dashboard' ? 'text-sky-400 font-bold' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span className="text-[11px]">Dashboard</span>
          </button>

          {/* 2. Transactions */}
          <button
            onClick={() => setActiveTab('transactions')}
            className={`relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl cursor-pointer transition-colors ${
              activeTab === 'transactions' ? 'text-sky-400 font-bold' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <ArrowUpDown className="w-5 h-5" />
            <span className="text-[11px]">Transactions</span>
            {pendingSyncCount > 0 && (
              <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-amber-400"></span>
            )}
          </button>

          {/* 3. Settings */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl cursor-pointer transition-colors ${
              activeTab === 'settings' ? 'text-sky-400 font-bold' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Sliders className="w-5 h-5" />
            <span className="text-[11px]">Settings</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SMS PERMISSION DIALOG (Required on first launch or when revoked) */}
      {/* ========================================================================= */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
            
            {/* Permission Icon */}
            <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>

            {/* Title & Clear Explanation */}
            <div className="text-center space-y-2">
              <h2 className="text-lg font-black text-white">
                SMS Permission Required
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                <strong>RJ World BD</strong> App-এর স্বয়ংক্রিয় পেমেন্ট ভেরিফিকেশনের জন্য SMS পড়ার অনুমতি প্রয়োজন।
              </p>
            </div>

            {/* Privacy & Scope Notice */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-left">
              <p className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                কঠোর প্রাইভেসি নিশ্চয়তা:
              </p>
              <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc pl-4">
                <li>
                  শুধুমাত্র <strong>bKash, Nagad, Rocket ও Upay</strong>-এর payment SMS শনাক্ত করা হবে।
                </li>
                <li>
                  অন্য কোনো ব্যক্তিগত SMS পড়া, প্রসেস বা সংরক্ষণ করা হবে <strong>না</strong>।
                </li>
                <li>
                  সম্পূর্ণ SMS টেক্সট Firebase-এ আপলোড করা হবে না; শুধুমাত্র Transaction ID এবং টাকার পরিমাণ নেওয়া হবে।
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleGrantPermission}
                className="w-full h-11 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Allow SMS Permission</span>
              </button>
              <button
                type="button"
                onClick={handleDenyPermission}
                className="w-full h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                Don't Allow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
