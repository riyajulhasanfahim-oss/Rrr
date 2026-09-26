import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  RotateCcw, ShieldAlert, CheckCircle2, XCircle, Clock, AlertTriangle, 
  Search, Filter, ExternalLink, RefreshCw, Eye, Check, X, Copy, 
  ArrowUpDown, Package, Truck, Store, User, DollarSign, FileText, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import {
  fetchAllResellerReturnRequests,
  subscribeToResellerReturnRequests,
  adminApproveResellerReturn,
  adminRejectResellerReturn,
  type ResellerReturnRequestRecord
} from '../../services/resellerReturnService';
import { subscribeToProfitReversals } from '../../services/resellerCancellationService';
import AdminResellerReversalsTab from '../../components/admin/AdminResellerReversalsTab';

export default function AdminResellerReturns() {
  const { userData, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Section Switcher: Step 8 (returns) vs Step 9 (reversals)
  const [activeSection, setActiveSection] = useState<'returns' | 'reversals'>(
    searchParams.get('tab') === 'reversals' ? 'reversals' : 'returns'
  );
  const [reversalPendingCount, setReversalPendingCount] = useState<number>(0);
  const [reversalUnresolvedCount, setReversalUnresolvedCount] = useState<number>(0);

  const [returnRequests, setReturnRequests] = useState<ResellerReturnRequestRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [selectedRequest, setSelectedRequest] = useState<ResellerReturnRequestRecord | null>(null);
  const [approveModalItem, setApproveModalItem] = useState<ResellerReturnRequestRecord | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<ResellerReturnRequestRecord | null>(null);
  const [adminApprovalNote, setAdminApprovalNote] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Auto-open specific request if ?openRequest=orderId or ?orderId= passed
  useEffect(() => {
    const targetOrderId = searchParams.get('openRequest') || searchParams.get('orderId') || searchParams.get('returnRequestId');
    if (targetOrderId && returnRequests.length > 0) {
      const cleanTarget = String(targetOrderId).replace(/^#/, '').toLowerCase();
      const found = returnRequests.find(
        r => String(r.orderId).toLowerCase() === cleanTarget || String(r.returnRequestId).toLowerCase() === cleanTarget
      );
      if (found) {
        setSelectedRequest(found);
      }
    }
  }, [searchParams, returnRequests]);

  const loadData = async () => {
    try {
      const data = await fetchAllResellerReturnRequests();
      setReturnRequests(data);
    } catch (err) {
      console.error('Failed to load return requests:', err);
      toast.error('রিটার্ন রিকুয়েস্ট লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubReturns = subscribeToResellerReturnRequests((items) => {
      setReturnRequests(items);
      setLoading(false);
    });

    const unsubReversals = subscribeToProfitReversals((_, unresolved, pending) => {
      setReversalUnresolvedCount(unresolved);
      setReversalPendingCount(pending);
    });

    return () => {
      unsubReturns();
      unsubReversals();
    };
  }, []);

  const handleSectionChange = (section: 'returns' | 'reversals') => {
    setActiveSection(section);
    const newParams = new URLSearchParams(searchParams);
    if (section === 'reversals') {
      newParams.set('tab', 'reversals');
    } else {
      newParams.delete('tab');
    }
    setSearchParams(newParams);
  };

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

  // KPIs
  const stats = useMemo(() => {
    const total = returnRequests.length;
    const pending = returnRequests.filter(r => r.returnStatus === 'PENDING_ADMIN_REVIEW').length;
    const approved = returnRequests.filter(r => r.returnStatus === 'APPROVED').length;
    const rejected = returnRequests.filter(r => r.returnStatus === 'REJECTED').length;
    const totalPendingProfitRefund = returnRequests
      .filter(r => r.returnStatus === 'PENDING_ADMIN_REVIEW')
      .reduce((sum, r) => sum + (r.resellerProfit || 0), 0);
    const totalApprovedRefund = returnRequests
      .filter(r => r.returnStatus === 'APPROVED')
      .reduce((sum, r) => sum + (r.resellerProfit || 0), 0);

    return { total, pending, approved, rejected, totalPendingProfitRefund, totalApprovedRefund };
  }, [returnRequests]);

  // Filtered List
  const filteredRequests = useMemo(() => {
    return returnRequests.filter(req => {
      if (filterTab === 'pending' && req.returnStatus !== 'PENDING_ADMIN_REVIEW') return false;
      if (filterTab === 'approved' && req.returnStatus !== 'APPROVED') return false;
      if (filterTab === 'rejected' && req.returnStatus !== 'REJECTED') return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchOrder = String(req.orderId).toLowerCase().includes(q);
        const matchReqId = String(req.returnRequestId).toLowerCase().includes(q);
        const matchVendor = req.vendorShopName?.toLowerCase().includes(q) || req.vendorId?.toLowerCase().includes(q);
        const matchReseller = req.resellerName?.toLowerCase().includes(q) || req.resellerId?.toLowerCase().includes(q);
        const matchCourier = req.courierName?.toLowerCase().includes(q) || req.trackingNumber?.toLowerCase().includes(q);
        const matchReason = req.reason?.toLowerCase().includes(q);
        return matchOrder || matchReqId || matchVendor || matchReseller || matchCourier || matchReason;
      }

      return true;
    });
  }, [returnRequests, filterTab, searchTerm]);

  // Approve Handler
  const handleApproveConfirm = async () => {
    if (!approveModalItem) return;

    try {
      setActionLoading(true);
      const res = await adminApproveResellerReturn({
        orderId: approveModalItem.orderId,
        returnRequestId: approveModalItem.returnRequestId,
        adminId: user?.uid || 'admin',
        adminEmail: user?.email || userData?.email || 'admin@rjworldbd.com',
        adminName: userData?.name || 'Admin',
        adminNote: adminApprovalNote.trim()
      });

      if (res.success) {
        toast.success(res.message);
        setApproveModalItem(null);
        setAdminApprovalNote('');
        if (selectedRequest?.returnRequestId === approveModalItem.returnRequestId) {
          setSelectedRequest(prev => prev ? { ...prev, returnStatus: 'APPROVED', transactionId: res.transactionId } : null);
        }
        loadData();
      } else {
        toast.error(res.message || 'অনুমোদন ব্যর্থ হয়েছে।');
      }
    } catch (err: any) {
      console.error('Error approving return:', err);
      toast.error(err.message || 'অনুমোদনের সময় অপ্রত্যাশিত ত্রুটি হয়েছে।');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Handler
  const handleRejectConfirm = async () => {
    if (!rejectModalItem) return;
    if (!rejectionReason.trim()) {
      toast.error('রিজেক্ট করার কারণ উল্লেখ করুন।');
      return;
    }

    try {
      setActionLoading(true);
      const res = await adminRejectResellerReturn({
        orderId: rejectModalItem.orderId,
        returnRequestId: rejectModalItem.returnRequestId,
        rejectionReason: rejectionReason.trim(),
        adminId: user?.uid || 'admin',
        adminEmail: user?.email || userData?.email || 'admin@rjworldbd.com',
        adminName: userData?.name || 'Admin'
      });

      if (res.success) {
        toast.success(res.message);
        setRejectModalItem(null);
        setRejectionReason('');
        if (selectedRequest?.returnRequestId === rejectModalItem.returnRequestId) {
          setSelectedRequest(prev => prev ? { ...prev, returnStatus: 'REJECTED' } : null);
        }
        loadData();
      } else {
        toast.error(res.message || 'রিজেক্ট ব্যর্থ হয়েছে।');
      }
    } catch (err: any) {
      console.error('Error rejecting return:', err);
      toast.error(err.message || 'রিজেক্ট করার সময় অপ্রত্যাশিত ত্রুটি হয়েছে।');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div id="admin-reseller-returns-page" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Reseller Return Requests
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200">
                  Step 8: রিটার্ন ও ফেইল্ড ডেলিভারি
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                ভেন্ডর কর্তৃক রিপোর্টকৃত রিটার্ন ও ফেইল্ড ডেলিভারি যাচাই করে ভেন্ডরের Locked Balance রিফান্ড ও রিসেলার প্রফিট বাতিল করুন।
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            to="/admin/reseller-reviews"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-all border border-purple-200 cursor-pointer"
          >
            <span>প্রফিট রিলিজ রিভিউ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            id="btn-refresh-returns"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            রিফ্রেশ
          </button>
        </div>
      </div>

      {/* Section Switcher: Step 8 vs Step 9 */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl w-fit border border-slate-200/60 shadow-2xs">
        <button
          type="button"
          onClick={() => handleSectionChange('returns')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSection === 'returns'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-rose-600" />
          <span>রিটার্ন ও ডেলিভারি ফেইল্ড (Step 8)</span>
          {stats.pending > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300">
              {stats.pending}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSectionChange('reversals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSection === 'reversals'
              ? 'bg-white text-purple-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4 text-purple-600" />
          <span>পোস্ট-ডেলিভারি প্রফিট রিভার্সাল (Step 9)</span>
          {reversalUnresolvedCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-900 border border-rose-300 animate-pulse">
              {reversalUnresolvedCount} Unresolved
            </span>
          ) : reversalPendingCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-900 border border-purple-300">
              {reversalPendingCount}
            </span>
          ) : null}
        </button>
      </div>

      {activeSection === 'reversals' ? (
        <AdminResellerReversalsTab />
      ) : (
        <>
          {/* KPI Cards */}
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
            <span className="text-xs font-bold text-amber-900">পেন্ডিং রিটার্ন রিকুয়েস্ট</span>
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-950">{stats.pending}</span>
            <span className="text-[11px] font-bold text-amber-700">টি রিকুয়েস্ট</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-800 font-semibold truncate">
            রিফান্ডযোগ্য প্রফিট: ৳{stats.totalPendingProfitRefund.toLocaleString('bn-BD')}
          </p>
        </div>

        {/* Approved Card */}
        <div 
          onClick={() => setFilterTab('approved')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'approved'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">অনুমোদিত রিটার্ন</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-950">{stats.approved}</span>
            <span className="text-[11px] font-bold text-emerald-700">টি অর্ডার</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-800 font-semibold truncate">
            ভেন্ডর ওয়ালেটে ফেরত: ৳{stats.totalApprovedRefund.toLocaleString('bn-BD')}
          </p>
        </div>

        {/* Rejected Card */}
        <div 
          onClick={() => setFilterTab('rejected')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'rejected'
              ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-400/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900">রিজেক্টেড রিটার্ন ক্লেইম</span>
            <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <XCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-950">{stats.rejected}</span>
            <span className="text-[11px] font-bold text-rose-700">টি অর্ডার</span>
          </div>
          <p className="mt-1 text-[11px] text-rose-800 font-semibold truncate">
            প্রফিট লকড বহাল রয়েছে
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
              মোট রিটার্ন রিপোর্ট
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
              সর্বমোট
            </span>
          </div>
          <p className={`mt-1 text-[11px] font-semibold truncate ${filterTab === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
            সব রেকর্ড সংরক্ষিত
          </p>
        </div>
      </div>

      {/* Control Bar: Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          <button
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === 'pending'
                ? 'bg-white text-amber-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            পেন্ডিং রিকুয়েস্ট ({stats.pending})
          </button>
          <button
            onClick={() => setFilterTab('approved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === 'approved'
                ? 'bg-white text-emerald-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            অনুমোদিত ({stats.approved})
          </button>
          <button
            onClick={() => setFilterTab('rejected')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === 'rejected'
                ? 'bg-white text-rose-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            রিজেক্টেড ({stats.rejected})
          </button>
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            সব ({stats.total})
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="অর্ডার আইডি, ভেন্ডর, রিসেলার বা কারণ দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-rose-600" />
            <p className="text-sm font-medium">রিটার্ন রিকুয়েস্ট ডাটা লোড হচ্ছে...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <RotateCcw className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">কোনো রিটার্ন রিকুয়েস্ট পাওয়া যায়নি।</p>
            <p className="text-xs text-slate-400">
              {searchTerm ? 'অনুসন্ধানের সাথে কোনো রেকর্ড মিলছে না।' : 'এই ফিল্টারে বর্তমানে কোনো রিকুয়েস্ট পেন্ডিং নেই।'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-3.5">অর্ডার ও রিকুয়েস্ট আইডি</th>
                  <th className="p-3.5">ভেন্ডর (রিপোর্টার)</th>
                  <th className="p-3.5">রিসেলার</th>
                  <th className="p-3.5">পণ্য ও পরিমাণ</th>
                  <th className="p-3.5 text-right">রিসেলার প্রফিট (লকড)</th>
                  <th className="p-3.5">রিটার্নের কারণ</th>
                  <th className="p-3.5">স্ট্যাটাস</th>
                  <th className="p-3.5 text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => (
                  <tr key={req.returnRequestId} className="hover:bg-slate-50/60 transition-colors">
                    {/* Order & Request ID */}
                    <td className="p-3.5 align-top">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            #{req.orderId}
                          </span>
                          <button
                            onClick={() => handleCopy(req.orderId, req.orderId)}
                            className="text-slate-400 hover:text-slate-600"
                            title="Copy Order ID"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {req.returnRequestId}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {format(new Date(req.createdAt), 'dd MMM yyyy, hh:mm a')}
                        </div>
                      </div>
                    </td>

                    {/* Vendor */}
                    <td className="p-3.5 align-top">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900 flex items-center gap-1">
                          <Store className="w-3 h-3 text-slate-400" />
                          <span>{req.vendorShopName || req.vendorId}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          ID: {req.vendorId}
                        </div>
                      </div>
                    </td>

                    {/* Reseller */}
                    <td className="p-3.5 align-top">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900 flex items-center gap-1">
                          <User className="w-3 h-3 text-purple-600" />
                          <span>{req.resellerName || req.resellerId}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          ID: {req.resellerId}
                        </div>
                      </div>
                    </td>

                    {/* Product & Qty */}
                    <td className="p-3.5 align-top">
                      <div className="space-y-0.5 max-w-[180px]">
                        <div className="font-semibold text-slate-900 truncate" title={req.productName}>
                          {req.productName || 'Product'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          Qty: x{req.quantity || 1}
                        </div>
                      </div>
                    </td>

                    {/* Reseller Profit (Locked) */}
                    <td className="p-3.5 align-top text-right">
                      <span className="font-mono font-black text-rose-600 text-sm block">
                        ৳{Number(req.resellerProfit || 0).toLocaleString('bn-BD')}
                      </span>
                      <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 inline-block mt-0.5">
                        Vendor Locked
                      </span>
                    </td>

                    {/* Return Reason */}
                    <td className="p-3.5 align-top">
                      <div className="max-w-[200px] space-y-1">
                        <p className="text-slate-800 line-clamp-2 font-medium" title={req.reason}>
                          {req.reason}
                        </p>
                        {req.trackingNumber && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                            <Truck className="w-3 h-3 text-slate-400" />
                            <span>{req.courierName || 'Courier'}: {req.trackingNumber}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-3.5 align-top">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        req.returnStatus === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : req.returnStatus === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-900 border border-amber-200 animate-pulse'
                      }`}>
                        {req.returnStatus === 'APPROVED' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {req.returnStatus === 'REJECTED' && <XCircle className="w-3 h-3 text-rose-600" />}
                        {req.returnStatus === 'PENDING_ADMIN_REVIEW' && <Clock className="w-3 h-3 text-amber-600" />}
                        <span>
                          {req.returnStatus === 'APPROVED' ? 'অনুমোদিত' :
                           req.returnStatus === 'REJECTED' ? 'রিজেক্টেড' : 'পেন্ডিং ভেরিফিকেশন'}
                        </span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 align-top text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="বিস্তারিত দেখুন"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {req.returnStatus === 'PENDING_ADMIN_REVIEW' && (
                          <>
                            <button
                              onClick={() => {
                                setApproveModalItem(req);
                                setAdminApprovalNote('');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                              title="অনুমোদন করুন (ভেন্ডরকে রিফান্ড)"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>অনুমোদন</span>
                            </button>
                            <button
                              onClick={() => {
                                setRejectModalItem(req);
                                setRejectionReason('');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                              title="রিজেক্ট করুন"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>রিজেক্ট</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-50 to-orange-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    রিটার্ন রিকুয়েস্ট বিস্তারিত • #{selectedRequest.orderId}
                  </h3>
                  <p className="text-xs text-rose-800 font-mono">
                    Request ID: {selectedRequest.returnRequestId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/80 transition-colors flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs">
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                selectedRequest.returnStatus === 'APPROVED'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : selectedRequest.returnStatus === 'REJECTED'
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}>
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-current" />
                <div className="space-y-1">
                  <div className="font-bold text-sm">
                    রিটার্ন স্ট্যাটাস: {
                      selectedRequest.returnStatus === 'APPROVED' ? 'অনুমোদিত (APPROVED)' :
                      selectedRequest.returnStatus === 'REJECTED' ? 'প্রত্যাখ্যাত (REJECTED)' :
                      'অ্যাডমিন পর্যালোচনার জন্য পেন্ডিং (PENDING_ADMIN_REVIEW)'
                    }
                  </div>
                  <p className="leading-relaxed">
                    {selectedRequest.returnStatus === 'APPROVED'
                      ? 'এই রিটার্ন অনুমোদিত হয়েছে। ভেন্ডরের Locked Balance থেকে টাকা সরাসরি Available Balance-এ স্থানান্তরিত হয়েছে এবং রিসেলারের পেন্ডিং প্রফিট বাতিল করা হয়েছে।'
                      : selectedRequest.returnStatus === 'REJECTED'
                      ? 'অ্যাডমিন এই রিটার্ন দাবি রিজেক্ট করেছেন। ভেন্ডর ও রিসেলারের ব্যালেন্স অপরিবর্তিত রাখা হয়েছে।'
                      : 'ভেন্ডর পণ্য রিটার্ন বা ফেইল্ড ডেলিভারির রিপোর্ট জমা দিয়েছেন। কুরিয়ার তথ্য যাচাই করে সিদ্ধান্ত নিন।'}
                  </p>
                  {selectedRequest.transactionId && (
                    <p className="font-mono text-[11px] font-bold mt-1">
                      Transaction ID: {selectedRequest.transactionId}
                    </p>
                  )}
                </div>
              </div>

              {/* Key Details Grid */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-500 font-medium block">অর্ডার আইডি:</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-bold text-slate-900 font-mono text-sm">#{selectedRequest.orderId}</span>
                    <Link
                      to={`/admin/orders/${selectedRequest.orderId}`}
                      target="_blank"
                      className="text-primary-main hover:underline flex items-center gap-0.5 text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>অর্ডার পেজ</span>
                    </Link>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">রিসেলার প্রফিট (লকড ব্যালেন্স):</span>
                  <span className="font-black text-rose-600 font-mono text-base block mt-0.5">
                    ৳{Number(selectedRequest.resellerProfit || 0).toLocaleString('bn-BD')}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">ভেন্ডর আইডি / শপ:</span>
                  <span className="font-bold text-slate-900 block mt-0.5">
                    {selectedRequest.vendorShopName || selectedRequest.vendorId}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">রিসেলার আইডি:</span>
                  <span className="font-bold text-slate-900 block mt-0.5">
                    {selectedRequest.resellerName || selectedRequest.resellerId}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">রিপোর্ট জমার সময়:</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    {format(new Date(selectedRequest.createdAt), 'dd MMMM yyyy, hh:mm:ss a')}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">কুরিয়ার ট্র্যাকিং:</span>
                  <span className="font-semibold text-slate-800 block mt-0.5">
                    {selectedRequest.courierName || 'N/A'}: {selectedRequest.trackingNumber || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1 bg-white p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  ভেন্ডর কর্তৃক বর্ণিত রিটার্ন কারণ:
                </span>
                <p className="text-slate-900 font-medium leading-relaxed">
                  {selectedRequest.reason}
                </p>
              </div>

              {/* Admin Note if already processed */}
              {selectedRequest.adminNote && (
                <div className="space-y-1 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-emerald-900 font-bold uppercase tracking-wider text-[10px]">
                    অ্যাডমিন নোট:
                  </span>
                  <p className="text-emerald-950 font-medium leading-relaxed">
                    {selectedRequest.adminNote}
                  </p>
                </div>
              )}

              {/* Rejection Reason if rejected */}
              {selectedRequest.rejectionReason && (
                <div className="space-y-1 bg-rose-50/50 p-3.5 rounded-xl border border-rose-200">
                  <span className="text-rose-900 font-bold uppercase tracking-wider text-[10px]">
                    রিজেক্টের কারণ:
                  </span>
                  <p className="text-rose-950 font-medium leading-relaxed">
                    {selectedRequest.rejectionReason}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                বন্ধ করুন
              </button>

              {selectedRequest.returnStatus === 'PENDING_ADMIN_REVIEW' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setRejectModalItem(selectedRequest);
                      setRejectionReason('');
                    }}
                    className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl hover:bg-rose-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>রিজেক্ট করুন</span>
                  </button>
                  <button
                    onClick={() => {
                      setApproveModalItem(selectedRequest);
                      setAdminApprovalNote('');
                    }}
                    className="px-5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>রিটার্ন অনুমোদন ও ব্যালেন্স রিফান্ড</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Approval Confirmation Modal */}
      {approveModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    রিটার্ন অনুমোদন ও ব্যালেন্স রিফান্ড
                  </h3>
                  <p className="text-xs text-emerald-800 font-medium">
                    অর্ডার #{approveModalItem.orderId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApproveModalItem(null)}
                disabled={actionLoading}
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  স্বয়ংক্রিয় ব্যালেন্স পরিবর্তন ঘোষণা:
                </div>
                <ul className="list-disc pl-5 space-y-1 text-amber-900 font-medium">
                  <li>ভেন্ডরের <strong>Locked Balance</strong> থেকে ৳{approveModalItem.resellerProfit} হ্রাস পাবে।</li>
                  <li>ভেন্ডরের <strong>Available Balance</strong>-এ ৳{approveModalItem.resellerProfit} বৃদ্ধি পাবে (Locked → Available)।</li>
                  <li>ভেন্ডরের <strong>Total Balance</strong> অপরিবর্তিত থাকবে।</li>
                  <li>রিসেলারের <strong>Pending Profit</strong> থেকে ৳{approveModalItem.resellerProfit} বাদ হয়ে <strong>Cancelled Profit</strong>-এ যুক্ত হবে।</li>
                  <li>অর্ডারের প্রফিট স্ট্যাটাস <span className="font-mono font-bold text-red-600">CANCELLED</span> হয়ে যাবে।</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  অ্যাডমিন নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={adminApprovalNote}
                  onChange={(e) => setAdminApprovalNote(e.target.value)}
                  placeholder="উদাহরণ: কুরিয়ার রিটার্ন রিপোর্ট যাচাইপূর্বক অনুমোদিত..."
                  className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setApproveModalItem(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleApproveConfirm}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <span>প্রসেসিং হচ্ছে...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>অনুমোদন ও রিফান্ড নিশ্চিত করুন</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    রিটার্ন রিকুয়েস্ট রিজেক্ট করুন
                  </h3>
                  <p className="text-xs text-rose-800 font-medium">
                    অর্ডার #{rejectModalItem.orderId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                disabled={actionLoading}
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                রিজেক্ট করলে ভেন্ডরের Locked Balance এবং রিসেলারের Pending Profit কোনোভাবেই পরিবর্তন হবে না। প্রফিট স্বাভাবিক LOCKED অবস্থায় বজায় থাকবে।
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  রিজেক্ট করার কারণ <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="রিজেক্ট করার সঠিক কারণ লিখুন (যেমন: কুরিয়ার ট্র্যাকিং অনুযায়ী পণ্য ডেলিভার হয়েছে)..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRejectModalItem(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleRejectConfirm}
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <span>রিজেক্ট হচ্ছে...</span>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      <span>রিজেক্ট নিশ্চিত করুন</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
