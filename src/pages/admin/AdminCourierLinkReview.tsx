import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Truck, CheckCircle2, XCircle, Clock, ExternalLink, ShieldAlert, 
  Search, Filter, RefreshCw, Copy, Check, Eye, AlertTriangle, 
  ArrowRight, ShieldCheck, Store, User, Phone, MapPin, DollarSign,
  AlertOctagon, Ban, Bell
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  fetchCourierLinkReviews, 
  subscribeToCourierReviews, 
  adminApproveCourierReview, 
  adminRejectCourierReview, 
  type CourierLinkReviewItem 
} from '../../services/courierReviewService';
import { useAuth } from '../../context/AuthContext';
import CourierPendingReviewModal from '../../components/admin/CourierPendingReviewModal';

export default function AdminCourierLinkReview() {
  const { userData, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reviews, setReviews] = useState<CourierLinkReviewItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterTab, setFilterTab] = useState<'pending' | 'all' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dedicated Full Pending Review Popup modal state
  const [pendingPopupItem, setPendingPopupItem] = useState<CourierLinkReviewItem | null>(null);

  // Modals state
  const [selectedItem, setSelectedItem] = useState<CourierLinkReviewItem | null>(null);
  const [approveModalItem, setApproveModalItem] = useState<CourierLinkReviewItem | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<CourierLinkReviewItem | null>(null);

  // Form states for approval & rejection
  const [approveNotes, setApproveNotes] = useState<string>('অফিশিয়াল কুরিয়ার ট্র্যাকিং লিংক যাচাই করে অনুমোদিত হয়েছে।');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [issueWarning, setIssueWarning] = useState<boolean>(false);
  const [warningReason, setWarningReason] = useState<string>('');
  const [suspendVendor, setSuspendVendor] = useState<boolean>(false);
  const [suspendReason, setSuspendReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Auto-open review popup if ?openReview=orderId is passed in URL
  useEffect(() => {
    const openOrderId = searchParams.get('openReview');
    if (openOrderId && reviews.length > 0) {
      const cleanId = String(openOrderId).replace(/^#/, '').toLowerCase();
      const found = reviews.find(
        (r) => 
          String(r.orderId || '').toLowerCase() === cleanId || 
          String(r.id || '').toLowerCase() === cleanId ||
          String(r.orderNumber || '').replace(/^#/, '').toLowerCase() === cleanId
      );
      if (found) {
        setPendingPopupItem(found);
      }
    }
  }, [searchParams, reviews]);

  useEffect(() => {
    loadData();

    // Subscribe to real-time updates in RTDB
    const unsubscribe = subscribeToCourierReviews((items) => {
      setReviews(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCourierLinkReviews();
      setReviews(data);
    } catch (err) {
      console.error('Failed to load courier reviews:', err);
      toast.error('কুরিয়ার ট্র্যাকিং রিভিউ লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('কপি করা হয়েছে!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const adminDisplayName = userData?.name || user?.email || 'Admin';

  const handleApprove = async () => {
    if (!approveModalItem) return;
    setActionLoading(true);
    try {
      const res = await adminApproveCourierReview({
        orderId: approveModalItem.orderId,
        adminName: adminDisplayName,
        notes: approveNotes
      });
      toast.success(res.message);
      setApproveModalItem(null);
      if (selectedItem?.id === approveModalItem.id) {
        setSelectedItem(null);
      }
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'অনুমোদন ব্যর্থ হয়েছে');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModalItem) return;
    if (!rejectReason.trim()) {
      toast.error('বাতিল করার কারণ উল্লেখ করুন');
      return;
    }
    setActionLoading(true);
    try {
      const res = await adminRejectCourierReview({
        orderId: rejectModalItem.orderId,
        adminName: adminDisplayName,
        reason: rejectReason.trim(),
        issueWarning,
        warningReason: warningReason.trim() || rejectReason.trim(),
        suspendVendor,
        suspendReason: suspendReason.trim() || rejectReason.trim()
      });

      toast.success(res.message);
      if (res.isSuspended) {
        toast.error('ভেন্ডর অ্যাকাউন্ট স্থগিত (Suspend) করা হয়েছে!', { icon: '⛔' });
      } else if (res.warningCount) {
        toast('ভেন্ডরকে সতর্কবার্তা দেওয়া হয়েছে (Warning #' + res.warningCount + ')', { icon: '⚠️' });
      }

      setRejectModalItem(null);
      if (selectedItem?.id === rejectModalItem.id) {
        setSelectedItem(null);
      }
      setRejectReason('');
      setIssueWarning(false);
      setWarningReason('');
      setSuspendVendor(false);
      setSuspendReason('');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'বাতিলকরণ ব্যর্থ হয়েছে');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered reviews
  const filteredReviews = reviews.filter((item) => {
    if (filterTab !== 'all' && item.status !== filterTab) return false;
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    const orderNum = (item.orderNumber || item.orderId || '').toLowerCase();
    const vendorShop = (item.vendorShopName || '').toLowerCase();
    const vendorName = (item.vendorName || '').toLowerCase();
    const courier = (item.courierName || '').toLowerCase();
    const trackingId = (item.trackingId || '').toLowerCase();
    const customer = (item.customerName || '').toLowerCase();

    return (
      orderNum.includes(term) ||
      vendorShop.includes(term) ||
      vendorName.includes(term) ||
      courier.includes(term) ||
      trackingId.includes(term) ||
      customer.includes(term)
    );
  });

  const pendingCount = reviews.filter((r) => r.status === 'pending').length;
  const approvedCount = reviews.filter((r) => r.status === 'approved').length;
  const rejectedCount = reviews.filter((r) => r.status === 'rejected').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Courier Link Review
              </h1>
              {pendingCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  {pendingCount} Pending
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              ভেন্ডরদের দেওয়া কুরিয়ার ট্র্যাকিং লিংক যাচাই, অনুমোদন (Approve), বাতিল ও স্ক্যাম প্রতিরোধ প্যানেল
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>রিফ্রেশ করুন</span>
        </button>
      </div>

      {/* Persistent Pending Alert Banner */}
      {pendingCount > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 border border-amber-400/40 animate-in fade-in duration-200">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0 animate-pulse border border-white/20">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base tracking-tight">
                  {pendingCount}টি কুরিয়ার ট্র্যাকিং লিংক অপেক্ষমাণ (🟡 Pending — Admin Review)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-white text-amber-900 text-[11px] font-black">
                  Action Needed
                </span>
              </div>
              <p className="text-xs text-amber-100 mt-0.5">
                ভেন্ডরদের জমা দেওয়া কুরিয়ার ট্র্যাকিং লিংক যাচাই করে একই জায়গা থেকে অর্ডার তথ্য দেখে অনুমোদন বা বাতিল করুন।
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const firstPending = reviews.find(r => r.status === 'pending');
              if (firstPending) setPendingPopupItem(firstPending);
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-amber-50 text-amber-950 font-black text-xs sm:text-sm rounded-xl shadow-xs transition-all shrink-0 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            <span>পপআপে রিভিউ করুন (Open Popup)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => setFilterTab('pending')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'pending'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/40 shadow-xs'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">পেন্ডিং রিভিউ</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-900">{pendingCount}</span>
            <span className="text-xs text-amber-700">টি লিংক যাচাই বাকি</span>
          </div>
        </div>

        <div 
          onClick={() => setFilterTab('approved')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'approved'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/40 shadow-xs'
              : 'bg-white border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">অনুমোদিত (Verified)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-900">{approvedCount}</span>
            <span className="text-xs text-emerald-700">টি সফলভাবে Shipped</span>
          </div>
        </div>

        <div 
          onClick={() => setFilterTab('rejected')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'rejected'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/40 shadow-xs'
              : 'bg-white border-slate-200 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">বাতিলকৃত (Rejected)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-900">{rejectedCount}</span>
            <span className="text-xs text-rose-700">টি ভুল/ভুয়া লিংক</span>
          </div>
        </div>

        <div 
          onClick={() => setFilterTab('all')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'all'
              ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-400/40 shadow-xs'
              : 'bg-white border-slate-200 hover:border-sky-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">মোট আবেদন</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{reviews.length}</span>
            <span className="text-xs text-slate-500">টি কুরিয়ার ট্র্যাকিং</span>
          </div>
        </div>
      </div>

      {/* Filters Bar & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterTab('pending')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending Review ({pendingCount})
          </button>
          <button
            onClick={() => setFilterTab('approved')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === 'approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setFilterTab('rejected')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === 'rejected'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterTab === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({reviews.length})
          </button>
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="অর্ডার, ভেন্ডর, কুরিয়ার বা ট্র্যাকিং আইডি..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 outline-hidden"
          />
        </div>
      </div>

      {/* Main Review List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">কুরিয়ার ট্র্যাকিং লিংক লোড হচ্ছে...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-3">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-base font-bold text-slate-800">কোনো কুরিয়ার লিংক পাওয়া যায়নি</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {filterTab === 'pending'
                ? 'বর্তমানে কোনো পেন্ডিং কুরিয়ার লিংক রিভিউ করার বাকি নেই। সব লিংক যাচাইকৃত!'
                : 'আপনার ফিল্টারের সাথে মিলে এমন কোনো কুরিয়ার রেকর্ড নেই।'}
            </p>
          </div>
        ) : (
          filteredReviews.map((item) => {
            const isSuspended = item.vendorStatus === 'suspended' || item.vendorSuspended;
            const warnings = Number(item.vendorWarningCount || 0);

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 shadow-xs ${
                  item.status === 'pending'
                    ? 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-400/20'
                    : item.status === 'approved'
                    ? 'border-slate-200'
                    : 'border-rose-200 bg-rose-50/10'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Order & Vendor Snapshot */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm sm:text-base text-slate-900">
                        #{item.orderNumber || item.orderId}
                      </span>

                      {/* Status Badge */}
                      {item.status === 'pending' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 animate-pulse" />
                          🟠 Pending — Admin Review
                        </span>
                      )}
                      {item.status === 'approved' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified & Approved
                        </span>
                      )}
                      {item.status === 'rejected' && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Rejected
                        </span>
                      )}

                      {/* Vendor Suspension Flag */}
                      {isSuspended && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          ভেন্ডর সাসপেন্ডেড
                        </span>
                      )}

                      {/* Warning Flag */}
                      {warnings > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {warnings}টি Warning
                        </span>
                      )}
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-slate-600 pt-1">
                      {/* Vendor Info */}
                      <div className="flex items-center gap-1.5 truncate">
                        <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-500">ভেন্ডর:</span>
                        <strong className="text-slate-900 truncate">
                          {item.vendorShopName || item.vendorName || 'ভেন্ডর'}
                        </strong>
                      </div>

                      {/* Customer Info */}
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-500">গ্রাহক:</span>
                        <strong className="text-slate-900 truncate">
                          {item.customerName || 'Customer'}
                        </strong>
                        {item.customerPhone && (
                          <span className="text-slate-400 font-mono text-[11px]">({item.customerPhone})</span>
                        )}
                      </div>

                      {/* Order Value */}
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-500">মোট মূল্য:</span>
                        <strong className="text-emerald-700 font-bold">
                          ৳{Number(item.totalAmount || 0).toLocaleString()}
                        </strong>
                        <span className="text-slate-400 text-[11px]">({item.itemsCount || 1}টি পণ্য)</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Courier, Tracking ID & DIRECT LINK TESTER */}
                  <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Courier Name & Tracking ID Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 px-3 flex flex-col justify-center min-w-[210px]">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold text-slate-500">কুরিয়ার:</span>
                        <span className="text-xs font-black text-slate-900 px-1.5 py-0.2 bg-white rounded border border-slate-200">
                          {item.courierName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-[11px] text-slate-500 font-mono truncate">
                          ID: <strong className="text-slate-900 font-bold">{item.trackingId}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.trackingId, `track-${item.id}`)}
                          className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                          title="কপি ট্র্যাকিং আইডি"
                        >
                          {copiedId === `track-${item.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* MANDATORY: Clickable Direct Tracking Link */}
                    <a
                      href={item.trackingUrl.startsWith('http') ? item.trackingUrl : `https://${item.trackingUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 text-primary-main border border-sky-200 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 shrink-0"
                      title="সরাসরি কুরিয়ার ওয়েবসাইটে গিয়ে লিংক যাচাই করুন"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>লিংক খুলে যাচাই করুন</span>
                    </a>

                    {/* Actions if Pending */}
                    {item.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        {/* Reject button */}
                        <button
                          type="button"
                          onClick={() => {
                            setRejectModalItem(item);
                            setRejectReason('কুরিয়ারের ট্র্যাকিং ওয়েবসাইটে পার্সেলের তথ্য খুঁজে পাওয়া যায়নি অথবা ভুল লিংক প্রদান করা হয়েছে।');
                          }}
                          className="px-3 py-2.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>

                        {/* Approve button */}
                        <button
                          type="button"
                          onClick={() => setApproveModalItem(item)}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      </div>
                    )}

                    {/* Details modal / Pending Review Popup trigger */}
                    <button
                      type="button"
                      onClick={() => setPendingPopupItem(item)}
                      className={`px-3.5 py-2.5 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                        item.status === 'pending'
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs ring-2 ring-amber-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      title="অর্ডারের সম্পূর্ণ বিবরণ ও কুরিয়ার ট্র্যাকিং রিভিউ পপআপ"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{item.status === 'pending' ? 'রিভিউ পপআপ খুলুন' : 'অর্ডার বিবরণ'}</span>
                    </button>
                  </div>
                </div>

                {/* Additional Note or Rejection Reason if any */}
                {item.status === 'rejected' && item.rejectedReason && (
                  <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-rose-950 font-bold">বাতিলের কারণ:</strong>
                      <span>{item.rejectedReason}</span>
                      {item.warningIssued && (
                        <span className="ml-2 font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                          ⚠️ ভেন্ডরকে অফিসিয়াল সতর্কবার্তা পাঠানো হয়েছে
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {item.status === 'approved' && item.reviewedBy && (
                  <div className="mt-2 text-[11px] text-emerald-800 flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>অনুমোদনকারী: <strong>{item.reviewedBy}</strong> ({new Date(item.reviewedAt || item.submittedAt).toLocaleString()})</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================= */}
      {/* 1. APPROVE CONFIRMATION MODAL */}
      {/* ========================================================= */}
      {approveModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-emerald-600 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-100" />
                <h3 className="font-bold text-base text-white">কুরিয়ার ট্র্যাকিং অনুমোদন (Approve)</h3>
              </div>
              <button
                onClick={() => setApproveModalItem(null)}
                className="text-white/80 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 space-y-1">
                <p className="font-bold">
                  আপনি অর্ডার #{approveModalItem.orderNumber || approveModalItem.orderId}-এর ট্র্যাকিং লিংক অনুমোদন করতে যাচ্ছেন:
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-emerald-200">
                  <div>
                    <span className="text-emerald-700 block">কুরিয়ার:</span>
                    <strong className="text-emerald-950">{approveModalItem.courierName}</strong>
                  </div>
                  <div>
                    <span className="text-emerald-700 block">ট্র্যাকিং আইডি:</span>
                    <strong className="text-emerald-950 font-mono">{approveModalItem.trackingId}</strong>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1.5">
                <p className="font-bold text-slate-800">অনুমোদন করলে যা যা ঘটবে:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>ট্র্যাকিং লিংকটি <strong className="text-emerald-700">Verified</strong> হিসেবে চিহ্নিত হবে।</li>
                  <li>অর্ডারের স্ট্যাটাস স্বয়ংক্রিয়ভাবে <strong className="text-emerald-700">Shipped</strong> হিসেবে আপডেট হবে।</li>
                  <li>গ্রাহক ও ভেন্ডর লাইভ কুরিয়ার ট্র্যাকিং দেখতে পাবেন।</li>
                </ul>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  অনুমোদন নোট (ঐচ্ছিক):
                </label>
                <input
                  type="text"
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setApproveModalItem(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'অনুমোদন হচ্ছে...' : 'হ্যাঁ, অনুমোদন করুন (Approve)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. REJECT & FRAUD PREVENTION (WARNING / SUSPEND) MODAL */}
      {/* ========================================================= */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-rose-600 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-base text-white">কুরিয়ার ট্র্যাকিং বাতিল ও অ্যাকশন</h3>
              </div>
              <button
                onClick={() => setRejectModalItem(null)}
                className="text-white/80 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-950">
                <p className="font-bold">
                  অর্ডার #{rejectModalItem.orderNumber || rejectModalItem.orderId}-এর দেওয়া ট্র্যাকিং বাতিল করা হবে।
                </p>
                <p className="text-[11px] text-rose-700 mt-1">
                  ভেন্ডরকে স্বয়ংক্রিয় নোটিফিকেশন দেওয়া হবে আসল ও সঠিক ট্র্যাকিং লিংক জমা দেওয়ার জন্য।
                </p>
              </div>

              {/* Rejection Reason */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 block">
                  বাতিল করার কারণ (ভেন্ডর দেখতে পাবে) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="উদাঃ কুরিয়ারের ওয়েবসাইটে এই ট্র্যাকিং আইডির কোনো পার্সেল বুকিং নেই অথবা ভুল লিংক দেওয়া হয়েছে।"
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 outline-hidden"
                  required
                />
              </div>

              {/* OPTIONAL WARNING SECTION */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={issueWarning}
                    onChange={(e) => setIssueWarning(e.target.checked)}
                    className="w-4 h-4 text-amber-600 border-amber-400 rounded focus:ring-amber-500 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-amber-950 block">
                      ⚠️ ভেন্ডরকে অফিসিয়াল সতর্কবার্তা (Warning) দিন
                    </span>
                    <span className="text-[11px] text-amber-800 block">
                      ভেন্ডরের প্রোফাইলে Warning কাউন্ট বৃদ্ধি পাবে এবং তাকে উচ্চ অগ্রাধিকারযুক্ত সতর্কবার্তা পাঠানো হবে।
                    </span>
                  </div>
                </label>

                {issueWarning && (
                  <div className="pt-2">
                    <input
                      type="text"
                      value={warningReason}
                      onChange={(e) => setWarningReason(e.target.value)}
                      placeholder="সতর্কবার্তা দেওয়ার সুনির্দিষ্ট কারণ (ঐচ্ছিক)"
                      className="w-full text-xs px-3 py-2 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* OPTIONAL SUSPEND VENDOR SECTION */}
              <div className="p-3.5 bg-rose-50/80 border border-rose-300 rounded-xl space-y-2">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={suspendVendor}
                    onChange={(e) => setSuspendVendor(e.target.checked)}
                    className="w-4 h-4 text-rose-600 border-rose-400 rounded focus:ring-rose-500 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-rose-950 block">
                      ⛔ ভেন্ডর একাউন্ট তাৎক্ষণিক স্থগিত (Suspend Account) করুন
                    </span>
                    <span className="text-[11px] text-rose-800 block">
                      ভুয়া ট্র্যাকিং লিংক বা প্রতারণার চেষ্টার কারণে ভেন্ডরের একাউন্ট সরাসরি Suspend করা হবে।
                    </span>
                  </div>
                </label>

                {suspendVendor && (
                  <div className="pt-2">
                    <input
                      type="text"
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      placeholder="অ্যাকাউন্ট স্থগিত করার কারণ লিখুন"
                      className="w-full text-xs px-3 py-2 bg-white border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectModalItem(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  ফিরে যান
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={actionLoading || !rejectReason.trim()}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'বাতিল করা হচ্ছে...' : 'বাতিল নিশ্চিত করুন (Confirm Reject)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. DETAILED VIEW MODAL */}
      {/* ========================================================= */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 p-4 sm:p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base text-white">কুরিয়ার ট্র্যাকিং লিংক বিস্তারিত</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    অর্ডার #{selectedItem.orderNumber || selectedItem.orderId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-white/80 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 sm:space-y-5">
              {/* Status Header */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">বর্তমান স্ট্যাটাস:</span>
                  <span className="font-black text-sm text-slate-800">
                    {selectedItem.status === 'pending'
                      ? '🟠 Pending — Admin Review'
                      : selectedItem.status === 'approved'
                      ? '✅ Approved (Verified)'
                      : '❌ Rejected'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">জমার সময়:</span>
                  <span className="text-xs font-semibold text-slate-700">
                    {new Date(selectedItem.submittedAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Vendor Card */}
              <div className="p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-primary-main" /> ভেন্ডর তথ্য
                  </h4>
                  {selectedItem.vendorStatus === 'suspended' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white">
                      Suspended
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">দোকানের নাম:</span>
                    <strong className="text-slate-800">{selectedItem.vendorShopName || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ভেন্ডরের নাম:</span>
                    <span className="text-slate-700">{selectedItem.vendorName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ইমেইল / ফোন:</span>
                    <span className="text-slate-700">{selectedItem.vendorEmail || selectedItem.vendorPhone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">সতর্কবার্তা সংখ্যা:</span>
                    <span className="font-bold text-amber-700">{selectedItem.vendorWarningCount || 0} টি</span>
                  </div>
                </div>
              </div>

              {/* Customer & Order Card */}
              <div className="p-3.5 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-emerald-600" /> গ্রাহক ও ডেলিভারি তথ্য
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">গ্রাহক:</span>
                    <strong className="text-slate-800">{selectedItem.customerName || 'Customer'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ফোন:</span>
                    <span className="font-mono text-slate-700">{selectedItem.customerPhone || 'N/A'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">ঠিকানা:</span>
                    <span className="text-slate-700">{selectedItem.customerAddress || 'N/A'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">অর্ডারকৃত পণ্য:</span>
                    <span className="text-slate-700">{selectedItem.itemsSummary || 'পণ্যসমূহ'}</span>
                  </div>
                </div>
              </div>

              {/* Courier Tracking Link Card */}
              <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-sky-700" /> কুরিয়ার ও ট্র্যাকিং তথ্য
                  </h4>
                  <span className="font-bold text-xs bg-white px-2 py-0.5 rounded border border-sky-200 text-sky-900">
                    {selectedItem.courierName}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-sky-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 block">ট্র্যাকিং আইডি:</span>
                    <span className="font-mono font-black text-sm text-slate-900">{selectedItem.trackingId}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(selectedItem.trackingId, 'modal-track')}
                    className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors"
                    title="কপি করুন"
                  >
                    {copiedId === 'modal-track' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-sky-900 block">সরাসরি ট্র্যাকিং লিংক:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={selectedItem.trackingUrl}
                      className="w-full text-xs font-mono px-3 py-2 bg-white border border-sky-200 rounded-lg text-slate-700"
                    />
                    <a
                      href={selectedItem.trackingUrl.startsWith('http') ? selectedItem.trackingUrl : `https://${selectedItem.trackingUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-primary-main hover:bg-sky-600 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0"
                    >
                      <span>খুলুন</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Action buttons inside details */}
              {selectedItem.status === 'pending' && (
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectModalItem(selectedItem);
                      setRejectReason('কুরিয়ারের ট্র্যাকিং ওয়েবসাইটে তথ্য খুঁজে পাওয়া যায়নি অথবা ভুল লিংক প্রদান করা হয়েছে।');
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-colors cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setApproveModalItem(selectedItem)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Approve & Ship
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. DEDICATED PENDING REVIEW POPUP (ALL 13 FIELDS + ACTIONS) */}
      {/* ========================================================= */}
      <CourierPendingReviewModal
        isOpen={!!pendingPopupItem}
        onClose={() => {
          setPendingPopupItem(null);
          if (searchParams.get('openReview')) {
            searchParams.delete('openReview');
            setSearchParams(searchParams);
          }
        }}
        reviewItem={pendingPopupItem}
        onApprove={async (orderId, notes) => {
          setActionLoading(true);
          try {
            const res = await adminApproveCourierReview({
              orderId,
              adminName: adminDisplayName,
              notes
            });
            toast.success(res.message);
            setPendingPopupItem(null);
            await loadData();
          } catch (err: any) {
            toast.error(err.message || 'অনুমোদন ব্যর্থ হয়েছে');
            throw err;
          } finally {
            setActionLoading(false);
          }
        }}
        onReject={async (orderId, reason, issueWarning, warningReason, suspendVendor, suspendReason) => {
          setActionLoading(true);
          try {
            const res = await adminRejectCourierReview({
              orderId,
              adminName: adminDisplayName,
              reason,
              issueWarning,
              warningReason: warningReason || reason,
              suspendVendor,
              suspendReason: suspendReason || reason
            });
            toast.success(res.message);
            if (res.isSuspended) {
              toast.error('ভেন্ডর অ্যাকাউন্ট স্থগিত (Suspend) করা হয়েছে!', { icon: '⛔' });
            } else if (res.warningCount) {
              toast('ভেন্ডরকে সতর্কবার্তা দেওয়া হয়েছে (Warning #' + res.warningCount + ')', { icon: '⚠️' });
            }
            setPendingPopupItem(null);
            await loadData();
          } catch (err: any) {
            toast.error(err.message || 'বাতিলকরণ ব্যর্থ হয়েছে');
            throw err;
          } finally {
            setActionLoading(false);
          }
        }}
        actionLoading={actionLoading}
      />
    </div>
  );
}
