import React, { useState, useEffect, useMemo } from 'react';
import { 
  RotateCcw, Clock, CheckCircle2, XCircle, AlertTriangle, 
  Search, RefreshCw, ExternalLink, Copy, Check, ShieldAlert,
  ArrowRight, DollarSign, User, Store, Package, FileText, X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { 
  ResellerProfitReversalRecord, 
  fetchAllProfitReversals, 
  subscribeToProfitReversals,
  adminApproveProfitReversal,
  adminRejectProfitReversal
} from '../../services/resellerCancellationService';
import { rtdbGet } from '../../lib/rtdb';

export default function AdminResellerReversalsTab() {
  const { user, userData } = useAuth();
  const [reversals, setReversals] = useState<ResellerProfitReversalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'reversed' | 'unresolved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [approveModalItem, setApproveModalItem] = useState<ResellerProfitReversalRecord | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<ResellerProfitReversalRecord | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<ResellerProfitReversalRecord | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [currentResellerBalance, setCurrentResellerBalance] = useState<number | null>(null);
  const [balanceCheckLoading, setBalanceCheckLoading] = useState(false);

  const loadData = async () => {
    try {
      const items = await fetchAllProfitReversals();
      setReversals(items);
    } catch (err) {
      console.error('Error fetching profit reversals:', err);
      toast.error('রিভার্সাল তালিকা লোড করতে ব্যর্থ হয়েছে।');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToProfitReversals((items) => {
      setReversals(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCopy = (text: string, idKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idKey);
    toast.success('কপি করা হয়েছে!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Inspect Reseller's live available balance when opening approval modal
  const openApproveModal = async (item: ResellerProfitReversalRecord) => {
    setApproveModalItem(item);
    setAdminNote('');
    setCurrentResellerBalance(null);
    setBalanceCheckLoading(true);

    try {
      if (item.resellerId) {
        const wallet = await rtdbGet<any>(`reseller_wallet/${item.resellerId}`);
        const avail = Number(wallet?.availableBalance ?? wallet?.walletBalance ?? 0);
        setCurrentResellerBalance(avail);
      }
    } catch (e) {
      console.warn('Error checking reseller balance:', e);
    } finally {
      setBalanceCheckLoading(false);
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = reversals.length;
    const pending = reversals.filter(r => r.status === 'PENDING_ADMIN_REVIEW').length;
    const reversed = reversals.filter(r => r.status === 'REVERSED').length;
    const unresolved = reversals.filter(r => r.status === 'REVERSAL_PENDING').length;
    const rejected = reversals.filter(r => r.status === 'REJECTED').length;

    const pendingAmount = reversals
      .filter(r => r.status === 'PENDING_ADMIN_REVIEW')
      .reduce((sum, r) => sum + (r.reversalAmount || 0), 0);
    const reversedAmount = reversals
      .filter(r => r.status === 'REVERSED')
      .reduce((sum, r) => sum + (r.reversalAmount || 0), 0);
    const unresolvedAmount = reversals
      .filter(r => r.status === 'REVERSAL_PENDING')
      .reduce((sum, r) => sum + (r.shortfall || r.reversalAmount || 0), 0);

    return { total, pending, reversed, unresolved, rejected, pendingAmount, reversedAmount, unresolvedAmount };
  }, [reversals]);

  // Filtered List
  const filteredList = useMemo(() => {
    return reversals.filter(item => {
      if (filterTab === 'pending' && item.status !== 'PENDING_ADMIN_REVIEW') return false;
      if (filterTab === 'reversed' && item.status !== 'REVERSED') return false;
      if (filterTab === 'unresolved' && item.status !== 'REVERSAL_PENDING') return false;
      if (filterTab === 'rejected' && item.status !== 'REJECTED') return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchOrder = String(item.orderId).toLowerCase().includes(q);
        const matchReq = String(item.reversalRequestId).toLowerCase().includes(q);
        const matchReseller = item.resellerName?.toLowerCase().includes(q) || item.resellerId?.toLowerCase().includes(q);
        const matchVendor = item.vendorShopName?.toLowerCase().includes(q) || item.vendorId?.toLowerCase().includes(q);
        const matchReason = item.reason?.toLowerCase().includes(q);
        return matchOrder || matchReq || matchReseller || matchVendor || matchReason;
      }

      return true;
    });
  }, [reversals, filterTab, searchTerm]);

  // Handle Approve Confirm
  const handleApproveConfirm = async () => {
    if (!approveModalItem) return;

    try {
      setActionLoading(true);
      const res = await adminApproveProfitReversal({
        orderId: approveModalItem.orderId,
        reversalRequestId: approveModalItem.reversalRequestId,
        adminId: user?.uid || 'admin',
        adminEmail: user?.email || userData?.email || 'admin@rjworldbd.com',
        adminName: userData?.name || 'Admin',
        adminNote: adminNote.trim()
      });

      if (res.success && res.status === 'REVERSED') {
        toast.success(res.message);
        setApproveModalItem(null);
        loadData();
      } else if (res.status === 'REVERSAL_PENDING') {
        toast.error(res.message, { duration: 6000 });
        setApproveModalItem(null);
        setFilterTab('unresolved');
        loadData();
      } else {
        toast.error(res.message || 'অনুমোদন ব্যর্থ হয়েছে।');
      }
    } catch (err: any) {
      console.error('Error approving profit reversal:', err);
      toast.error(err.message || 'অনুমোদন প্রক্রিয়ায় ত্রুটি হয়েছে।');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reject Confirm
  const handleRejectConfirm = async () => {
    if (!rejectModalItem) return;
    if (!rejectionReason.trim()) {
      toast.error('বাতিল করার কারণ উল্লেখ করা আবশ্যক।');
      return;
    }

    try {
      setActionLoading(true);
      const res = await adminRejectProfitReversal({
        orderId: rejectModalItem.orderId,
        reversalRequestId: rejectModalItem.reversalRequestId,
        rejectionReason: rejectionReason.trim(),
        adminId: user?.uid || 'admin',
        adminEmail: user?.email || userData?.email || 'admin@rjworldbd.com',
        adminName: userData?.name || 'Admin'
      });

      if (res.success) {
        toast.success(res.message);
        setRejectModalItem(null);
        setRejectionReason('');
        loadData();
      } else {
        toast.error(res.message || 'বাতিলকরণ ব্যর্থ হয়েছে।');
      }
    } catch (err: any) {
      console.error('Error rejecting profit reversal:', err);
      toast.error(err.message || 'বাতিল করার সময় সমস্যা হয়েছে।');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Informational Guidance Box */}
      <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-purple-950">
              পোস্ট-ডেলিভারি রিটার্ন ও প্রফিট রিভার্সাল নীতি (Profit Reversal Safeguard)
            </h4>
            <p className="text-xs text-purple-800 font-medium leading-relaxed">
              ডেলিভারি সম্পন্ন হওয়া অর্ডারে রিসেলারের অ্যাকাউন্টে প্রফিট ইতিমধ্যে <strong>RELEASED</strong> হয়েছে। 
              অ্যাডমিন যাচাই করার পর রিসেলারের ব্যালেন্স পর্যাপ্ত থাকলে ব্যালেন্স কর্তন করে ভেন্ডরের ওয়ালেটে রিফান্ড করা হবে। 
              রিসেলারের ব্যালেন্স অপর্যাপ্ত হলে <strong>নেগেটিভ ব্যালেন্স এড়াতে</strong> স্বয়ংক্রিয়ভাবে <span className="font-bold text-amber-900">REVERSAL_PENDING</span> স্ট্যাটাসে সংরক্ষিত হবে।
            </p>
          </div>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-purple-100 text-purple-700 text-xs font-bold transition-all border border-purple-200 cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          রিফ্রেশ
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Pending Card */}
        <div
          onClick={() => setFilterTab('pending')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'pending'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">পেন্ডিং রিভার্সাল</span>
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-950">{stats.pending}</span>
            <span className="text-[11px] font-bold text-amber-700">টি আবেদন</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-800 font-semibold truncate">
            রিভার্সাল মূল্য: ৳{stats.pendingAmount.toLocaleString('bn-BD')}
          </p>
        </div>

        {/* Unresolved Shortfall Card (CRITICAL REQUIREMENT) */}
        <div
          onClick={() => setFilterTab('unresolved')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'unresolved'
              ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-400/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900 flex items-center gap-1">
              <span>অপর্যাপ্ত ব্যালেন্স</span>
              {stats.unresolved > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
              )}
            </span>
            <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-950">{stats.unresolved}</span>
            <span className="text-[11px] font-bold text-rose-700">টি Unresolved</span>
          </div>
          <p className="mt-1 text-[11px] text-rose-800 font-semibold truncate">
            মোট ঘাটতি: ৳{stats.unresolvedAmount.toLocaleString('bn-BD')}
          </p>
        </div>

        {/* Reversed Card */}
        <div
          onClick={() => setFilterTab('reversed')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'reversed'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">রিভার্সাল সম্পন্ন</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-950">{stats.reversed}</span>
            <span className="text-[11px] font-bold text-emerald-700">টি অর্ডার</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-800 font-semibold truncate">
            ভেন্ডর ওয়ালেটে রিফান্ড: ৳{stats.reversedAmount.toLocaleString('bn-BD')}
          </p>
        </div>

        {/* Total Card */}
        <div
          onClick={() => setFilterTab('all')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${filterTab === 'all' ? 'text-slate-300' : 'text-slate-600'}`}>
              সর্বমোট রিকুয়েস্ট
            </span>
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
              filterTab === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
            }`}>
              <RotateCcw className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${filterTab === 'all' ? 'text-white' : 'text-slate-900'}`}>
              {stats.total}
            </span>
            <span className={`text-[11px] font-bold ${filterTab === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>
              টি সর্বমোট
            </span>
          </div>
          <p className={`mt-1 text-[11px] font-semibold truncate ${filterTab === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
            সব রেকর্ড সংরক্ষিত
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          <button
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === 'pending'
                ? 'bg-white text-amber-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            অনুমোদনের অপেক্ষায় ({stats.pending})
          </button>
          <button
            onClick={() => setFilterTab('unresolved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              filterTab === 'unresolved'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-rose-700 hover:text-rose-900 bg-rose-50/50'
            }`}
          >
            <span>অপর্যাপ্ত ব্যালেন্স ({stats.unresolved})</span>
          </button>
          <button
            onClick={() => setFilterTab('reversed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === 'reversed'
                ? 'bg-white text-emerald-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            রিভার্সাল সম্পন্ন ({stats.reversed})
          </button>
          <button
            onClick={() => setFilterTab('rejected')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === 'rejected'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            বাতিলকৃত ({stats.rejected})
          </button>
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            সবগুলো ({stats.total})
          </button>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="অর্ডার বা রিসেলার আইডি খুঁজুন..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          />
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <RefreshCw className="w-7 h-7 text-purple-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600">প্রফিট রিভার্সাল ডেটা লোড হচ্ছে...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">কোনো প্রফিট রিভার্সাল রিকুয়েস্ট পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchTerm ? 'অনুসন্ধানের সাথে কোনো রেকর্ড মিলছে না।' : 'নির্বাচিত ফিল্টারে এই মুহূর্তে কোনো রিভার্সাল রিকুয়েস্ট পেন্ডিং নেই।'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((item) => {
            const isUnresolved = item.status === 'REVERSAL_PENDING';
            const isPending = item.status === 'PENDING_ADMIN_REVIEW';
            const isReversed = item.status === 'REVERSED';
            const isRejected = item.status === 'REJECTED';

            return (
              <div
                key={item.reversalRequestId}
                className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 shadow-xs space-y-4 ${
                  isUnresolved
                    ? 'border-rose-300 ring-1 ring-rose-300/40 bg-rose-50/20'
                    : isPending
                    ? 'border-amber-200/90 hover:border-amber-300'
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500">Order ID:</span>
                      <Link
                        to={`/admin/orders/${item.orderId}`}
                        className="text-xs font-black text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1 font-mono"
                      >
                        #{item.orderId}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <button
                        onClick={() => handleCopy(item.orderId, `ord-${item.orderId}`)}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                        title="Copy Order ID"
                      >
                        {copiedId === `ord-${item.orderId}` ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {format(new Date(item.createdAt), 'MMM dd, yyyy • hh:mm a')}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {isUnresolved && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>REVERSAL_PENDING (অপর্যাপ্ত ব্যালেন্স)</span>
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <Clock className="w-3.5 h-3.5" />
                        <span>অ্যাডমিন পর্যালোচনার অপেক্ষায়</span>
                      </span>
                    )}
                    {isReversed && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>রিভার্সাল সম্পন্ন (REVERSED)</span>
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>রিভার্সাল বাতিল (REJECTED)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Unresolved Shortfall Banner */}
                {isUnresolved && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-950 flex items-start gap-2.5 shadow-2xs">
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-rose-950 text-xs">
                        সিস্টেম ব্যালেন্স সুরক্ষা কার্যকর: নেগেটিভ ব্যালেন্স প্রতিরোধ করা হয়েছে
                      </div>
                      <p className="text-rose-800 leading-relaxed font-medium">
                        রিসেলারের বর্তমান availableBalance (৳{Number(item.currentResellerAvailable || 0).toLocaleString('bn-BD')}) এই রিভার্সালের প্রয়োজনীয় ৳{Number(item.reversalAmount).toLocaleString('bn-BD')}-এর চেয়ে কম। 
                        ঘাটতি: <strong className="font-bold text-rose-950">৳{Number(item.shortfall || 0).toLocaleString('bn-BD')}</strong>। 
                        রিসেলারের অ্যাকাউন্টে ব্যালেন্স যোগ হলে পুনরায় অনুমোদন করে ব্যালেন্স রিভার্স সম্পন্ন করা যাবে।
                      </p>
                    </div>
                  </div>
                )}

                {/* Content grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Column 1: Product & Amount */}
                  <div className="space-y-2 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                    <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-slate-500" />
                      <span>পণ্য ও রিভার্সাল পরিমাণ</span>
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 line-clamp-1">{item.productName || 'Product'}</p>
                      <div className="flex items-center gap-2 text-slate-600">
                        <span>পরিমাণ: <strong>{item.quantity || 1}</strong> টি</span>
                        <span>•</span>
                        <span>ভেন্ডর রেট: ৳{item.vendorPrice || 0}</span>
                      </div>
                      <div className="pt-1.5 flex items-baseline gap-1.5 text-purple-900">
                        <span className="text-[11px] font-semibold">রিভার্সাল প্রফিট:</span>
                        <span className="text-base font-black text-purple-700">৳{Number(item.reversalAmount).toLocaleString('bn-BD')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Parties (Reseller & Vendor) */}
                  <div className="space-y-2 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                    <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>রিসেলার ও ভেন্ডর তথ্য</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">রিসেলার:</span>
                        <span className="font-bold text-slate-900 truncate max-w-[140px]">
                          {item.resellerName || item.resellerId || 'Reseller'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">ভেন্ডর শপ:</span>
                        <span className="font-bold text-slate-900 truncate max-w-[140px]">
                          {item.vendorShopName || item.vendorId || 'Vendor'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">আবেদনকারী:</span>
                        <span className="font-medium text-slate-700">{item.requestedBy || 'Vendor'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Reason & Resolution Info */}
                  <div className="space-y-2 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                    <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>রিভার্সালের কারণ</span>
                    </div>
                    <p className="text-slate-700 font-medium leading-relaxed italic bg-white p-2 rounded-lg border border-slate-200/60 line-clamp-3">
                      "{item.reason}"
                    </p>
                    {item.processedBy && (
                      <div className="text-[10px] text-slate-500">
                        প্রসেস করেছেন: <strong className="text-slate-700">{item.processedBy}</strong> • Tx: <span className="font-mono text-slate-600">{item.transactionId}</span>
                      </div>
                    )}
                    {item.rejectionReason && (
                      <div className="text-[10px] text-rose-700 bg-rose-50 p-1.5 rounded-lg border border-rose-200">
                        বাতিলের কারণ: {item.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="text-[11px] text-slate-500 font-mono">
                    ID: {item.reversalRequestId}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/admin/orders/${item.orderId}`}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>অর্ডার বিবরণ</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    {(isPending || isUnresolved) && (
                      <>
                        <button
                          type="button"
                          onClick={() => setRejectModalItem(item)}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer"
                        >
                          রিজেক্ট করুন
                        </button>
                        <button
                          type="button"
                          onClick={() => openApproveModal(item)}
                          className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>অনুমোদন ও রিফান্ড</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* APPROVAL MODAL */}
      {approveModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">প্রফিট রিভার্সাল অনুমোদন ও ব্যালেন্স রিফান্ড</h3>
                  <p className="text-xs text-purple-700 font-medium">অর্ডার #{approveModalItem.orderId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApproveModalItem(null)}
                disabled={actionLoading}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">রিভার্সাল প্রফিট পরিমাণ:</span>
                  <span className="text-sm font-black text-purple-700">
                    ৳{Number(approveModalItem.reversalAmount).toLocaleString('bn-BD')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">রিসেলার বর্তমান Available ব্যালেন্স:</span>
                  <span className="text-xs font-bold text-slate-800">
                    {balanceCheckLoading ? 'যাচাই হচ্ছে...' : `৳${Number(currentResellerBalance ?? 0).toLocaleString('bn-BD')}`}
                  </span>
                </div>

                {currentResellerBalance !== null && currentResellerBalance < approveModalItem.reversalAmount && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-950 font-medium space-y-1">
                    <div className="font-bold flex items-center gap-1 text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>সতর্কতা: রিসেলারের ব্যালেন্স অপর্যাপ্ত!</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      অনুমোদন চাপলে নেগেটিভ ব্যালেন্স তৈরি হবে না। সিস্টেম স্বয়ংক্রিয়ভাবে এটিকে <strong>REVERSAL_PENDING</strong> হিসেবে চিহ্নিত করে ঘাটতি <strong>৳{(approveModalItem.reversalAmount - currentResellerBalance).toLocaleString('bn-BD')}</strong> রেকর্ড করবে।
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  অ্যাডমিন নোট (ঐচ্ছিক)
                </label>
                <textarea
                  rows={2}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="অনুমোদনের সাপেক্ষে বিশেষ মন্তব্য..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl text-purple-900 font-medium text-[11px] leading-relaxed">
                পর্যাপ্ত ব্যালেন্স থাকলে রিসেলারের ওয়ালেট থেকে ৳{Number(approveModalItem.reversalAmount).toLocaleString('bn-BD')} কর্তন করে সাথে সাথে ভেন্ডরের <strong>Available Balance</strong>-এ যুক্ত হবে।
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setApproveModalItem(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleApproveConfirm}
                disabled={actionLoading || balanceCheckLoading}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>প্রসেসিং...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>নিশ্চিত অনুমোদন করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-50 to-orange-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">রিভার্সাল রিকুয়েস্ট রিজেক্ট করুন</h3>
                  <p className="text-xs text-rose-700 font-medium">অর্ডার #{rejectModalItem.orderId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                disabled={actionLoading}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 font-medium">
                রিজেক্ট করলে রিসেলার ও ভেন্ডরের কোনো ব্যালেন্স পরিবর্তন হবে না।
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  বাতিল করার কারণ <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="যেমন: কাস্টমার পণ্য গ্রহণ করেছে, ভেন্ডর কর্তৃক ক্লেইম অযৌক্তিক..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                ফিরে যান
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={actionLoading || !rejectionReason.trim()}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>প্রসেসিং...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>রিজেক্ট কনফার্ম করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
