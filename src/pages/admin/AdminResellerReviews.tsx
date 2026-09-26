import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  RefreshCw, 
  Copy, 
  Check, 
  Eye, 
  AlertTriangle, 
  Truck, 
  ExternalLink, 
  Store, 
  User, 
  Phone, 
  MapPin, 
  DollarSign, 
  Package, 
  AlertOctagon, 
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Info,
  Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import {
  fetchAllResellerProfitReviews,
  subscribeToResellerProfitReviews,
  adminApproveResellerProfitReview,
  adminRejectResellerProfitReview,
  type ResellerProfitReviewDetailedItem
} from '../../services/resellerProfitReviewService';

export default function AdminResellerReviews() {
  const { userData, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [reviews, setReviews] = useState<ResellerProfitReviewDetailedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Filter states
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'delivered' | 'undelivered'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selected item modal
  const [selectedReview, setSelectedReview] = useState<ResellerProfitReviewDetailedItem | null>(null);

  // Action Modals
  const [approveModalItem, setApproveModalItem] = useState<ResellerProfitReviewDetailedItem | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<ResellerProfitReviewDetailedItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Auto-open specific review if ?openReview=orderId or ?reviewId=... passed in URL
  useEffect(() => {
    const targetOrderId = searchParams.get('openReview') || searchParams.get('orderId');
    const targetReviewId = searchParams.get('reviewId');

    if ((targetOrderId || targetReviewId) && reviews.length > 0) {
      const cleanTargetOrder = String(targetOrderId || '').replace(/^#/, '').toLowerCase();
      const cleanTargetRev = String(targetReviewId || '').toLowerCase();

      const found = reviews.find(
        r => 
          (targetOrderId && String(r.orderId).toLowerCase() === cleanTargetOrder) ||
          (targetReviewId && String(r.reviewId).toLowerCase() === cleanTargetRev)
      );

      if (found) {
        setSelectedReview(found);
      }
    }
  }, [searchParams, reviews]);

  // Load reviews on mount and subscribe to real-time updates
  useEffect(() => {
    loadData();

    const unsub = subscribeToResellerProfitReviews((items) => {
      setReviews(items);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchAllResellerProfitReviews();
      setReviews(data);
    } catch (err) {
      console.error('Failed to load reviews:', err);
      toast.error('রিভিউ তালিকা লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  // KPI Summary Counts
  const stats = useMemo(() => {
    const isPending = (status: string) => status === 'PENDING' || status === 'PENDING_ADMIN_REVIEW';
    const total = reviews.length;
    const pending = reviews.filter(r => isPending(r.reviewStatus)).length;
    const approved = reviews.filter(r => r.reviewStatus === 'APPROVED').length;
    const rejected = reviews.filter(r => r.reviewStatus === 'REJECTED').length;
    const delivered = reviews.filter(r => r.isDelivered).length;
    const totalPendingProfit = reviews
      .filter(r => isPending(r.reviewStatus))
      .reduce((sum, r) => sum + (r.resellerProfit || 0), 0);
    const totalApprovedProfit = reviews
      .filter(r => r.reviewStatus === 'APPROVED')
      .reduce((sum, r) => sum + (r.resellerProfit || 0), 0);

    return { total, pending, approved, rejected, delivered, totalPendingProfit, totalApprovedProfit };
  }, [reviews]);

  // Filtered List
  const filteredReviews = useMemo(() => {
    const isPending = (status: string) => status === 'PENDING' || status === 'PENDING_ADMIN_REVIEW';
    return reviews.filter(rev => {
      // 1. Tab Status
      if (filterTab === 'pending' && !isPending(rev.reviewStatus)) return false;
      if (filterTab === 'approved' && rev.reviewStatus !== 'APPROVED') return false;
      if (filterTab === 'rejected' && rev.reviewStatus !== 'REJECTED') return false;

      // 2. Delivery Filter
      if (deliveryFilter === 'delivered' && !rev.isDelivered) return false;
      if (deliveryFilter === 'undelivered' && rev.isDelivered) return false;

      // 3. Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchOrder = String(rev.orderId).toLowerCase().includes(q);
        const matchReview = String(rev.reviewId).toLowerCase().includes(q);
        const matchReseller = rev.resellerName?.toLowerCase().includes(q) || rev.resellerEmail?.toLowerCase().includes(q) || rev.resellerPhone?.includes(q);
        const matchVendor = rev.vendorShopName?.toLowerCase().includes(q) || rev.vendorName?.toLowerCase().includes(q);
        const matchProduct = rev.product?.toLowerCase().includes(q);
        const matchCourier = rev.courierName?.toLowerCase().includes(q) || rev.trackingNumber?.toLowerCase().includes(q);

        if (!matchOrder && !matchReview && !matchReseller && !matchVendor && !matchProduct && !matchCourier) {
          return false;
        }
      }

      return true;
    });
  }, [reviews, filterTab, deliveryFilter, searchTerm]);

  // Handle Approve Action
  const handleApproveConfirm = async () => {
    if (!approveModalItem) return;
    try {
      setActionLoading(true);
      const res = await adminApproveResellerProfitReview({
        orderId: approveModalItem.orderId,
        resellerId: approveModalItem.resellerId,
        vendorId: approveModalItem.vendorId,
        reviewId: approveModalItem.reviewId,
        adminId: user?.uid || 'admin',
        adminEmail: user?.email || userData?.email || 'admin@rjworldbd.com',
        adminName: userData?.name || 'Admin'
      });

      if (res.success) {
        toast.success(res.message);
        setApproveModalItem(null);
        if (selectedReview?.id === approveModalItem.id) {
          setSelectedReview(prev => prev ? { ...prev, reviewStatus: 'APPROVED', profitStatus: 'RELEASED', isDelivered: true } : null);
        }
        loadData();
      } else {
        toast.error(res.message || 'অনুমোদন ব্যর্থ হয়েছে।');
      }
    } catch (err: any) {
      console.error('Error approving review:', err);
      toast.error(err.message || 'অনুমোদনের সময় অপ্রত্যাশিত সমস্যা হয়েছে।');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reject Action
  const handleRejectConfirm = async () => {
    if (!rejectModalItem) return;
    if (!rejectionReason.trim()) {
      toast.error('রিজেক্ট করার সুনির্দিষ্ট কারণ উল্লেখ করুন।');
      return;
    }

    try {
      setActionLoading(true);
      const res = await adminRejectResellerProfitReview({
        orderId: rejectModalItem.orderId,
        resellerId: rejectModalItem.resellerId,
        reviewId: rejectModalItem.reviewId,
        rejectionReason: rejectionReason.trim(),
        adminId: user?.uid || 'admin',
        adminEmail: user?.email || userData?.email || 'admin@rjworldbd.com',
        adminName: userData?.name || 'Admin'
      });

      if (res.success) {
        toast.success(res.message);
        setRejectModalItem(null);
        setRejectionReason('');
        if (selectedReview?.id === rejectModalItem.id) {
          setSelectedReview(prev => prev ? { ...prev, reviewStatus: 'REJECTED', rejectionReason: rejectionReason.trim() } : null);
        }
        loadData();
      } else {
        toast.error(res.message || 'রিজেক্ট ব্যর্থ হয়েছে।');
      }
    } catch (err: any) {
      console.error('Error rejecting review:', err);
      toast.error(err.message || 'রিজেক্ট করার সময় অপ্রত্যাশিত সমস্যা হয়েছে।');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div id="admin-reseller-reviews-page" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Reseller Reviews
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-200">
                  প্রফিট ভেরিফিকেশন
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                রিসেলারদের জমা দেওয়া প্রফিট ভেরিফিকেশন ও ডেলিভারি স্ট্যাটাস যাচাই করে অনুমোদন দিন।
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            id="btn-refresh-reviews"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            রিফ্রেশ করুন
          </button>
        </div>
      </div>

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
            <span className="text-xs font-bold text-amber-900">পেন্ডিং রিভিউ</span>
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-950">{stats.pending}</span>
            <span className="text-[11px] font-bold text-amber-700">টি অর্ডার</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-800 font-semibold truncate">
            মোট প্রফিট: ৳{stats.totalPendingProfit.toLocaleString('bn-BD')}
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
            <span className="text-xs font-bold text-emerald-900">অনুমোদিত ও রিলিজড</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-950">{stats.approved}</span>
            <span className="text-[11px] font-bold text-emerald-700">টি অর্ডার</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-800 font-semibold truncate">
            রিলিজড: ৳{stats.totalApprovedProfit.toLocaleString('bn-BD')}
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
            <span className="text-xs font-bold text-rose-900">বাতিল / রিজেক্টেড</span>
            <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <XCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-950">{stats.rejected}</span>
            <span className="text-[11px] font-bold text-rose-700">টি অর্ডার</span>
          </div>
          <p className="mt-1 text-[11px] text-rose-800 font-semibold truncate">
            প্রফিট লক অবস্থায় বহাল রয়েছে
          </p>
        </div>

        {/* Total Reviews Card */}
        <div 
          onClick={() => setFilterTab('all')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterTab === 'all'
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">সর্বমোট রিভিউ</span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
            <span className="text-[11px] font-bold text-slate-600">টি রিভিউ</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-600 font-semibold truncate">
            ডেলিভারি সম্পন্ন: {stats.delivered} টি
          </p>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
            <button
              id="tab-pending"
              onClick={() => setFilterTab('pending')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>পেন্ডিং অনুমোদন</span>
              {stats.pending > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  filterTab === 'pending' ? 'bg-amber-600 text-white' : 'bg-amber-200 text-amber-900'
                }`}>
                  {stats.pending}
                </span>
              )}
            </button>

            <button
              id="tab-approved"
              onClick={() => setFilterTab('approved')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'approved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>অনুমোদিত ({stats.approved})</span>
            </button>

            <button
              id="tab-rejected"
              onClick={() => setFilterTab('rejected')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'rejected'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>রিজেক্টেড ({stats.rejected})</span>
            </button>

            <button
              id="tab-all"
              onClick={() => setFilterTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>সব রিভিউ ({stats.total})</span>
            </button>
          </div>

          {/* Delivery Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" />
              ডেলিভারি:
            </span>
            <select
              id="select-delivery-filter"
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-hidden focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">সব স্ট্যাটাস</option>
              <option value="delivered">✅ Delivered Only</option>
              <option value="undelivered">⏳ In Transit / Undelivered</option>
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-reviews"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="অর্ডার আইডি, রিভিউ আইডি, রিসেলার নাম/ফোন, ভেন্ডর শপ বা প্রডাক্টের নাম দিয়ে খুঁজুন..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all outline-hidden"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              মুছে ফেলুন
            </button>
          )}
        </div>
      </div>

      {/* Main Reviews Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-600">রিভিউ তালিকা লোড হচ্ছে...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">কোনো রিভিউ খুঁজে পাওয়া যায়নি</p>
            <p className="text-xs text-slate-500">
              {filterTab === 'pending'
                ? 'বর্তমানে কোনো পেন্ডিং প্রফিট ভেরিফিকেশন রিভিউ নেই।'
                : 'ফিল্টার অথবা সার্চ টার্ম পরিবর্তন করে পুনরায় চেষ্টা করুন।'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Review & Order</th>
                  <th className="py-3.5 px-4">Reseller</th>
                  <th className="py-3.5 px-4">Vendor</th>
                  <th className="py-3.5 px-4">Product & Qty</th>
                  <th className="py-3.5 px-4">Pricing Breakdown</th>
                  <th className="py-3.5 px-4">Reseller Profit</th>
                  <th className="py-3.5 px-4">Delivery Status</th>
                  <th className="py-3.5 px-4">Review Status</th>
                  <th className="py-3.5 px-4">Submitted At</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredReviews.map((item) => {
                  const isDelivered = item.isDelivered;
                  return (
                    <tr 
                      key={item.id} 
                      className="hover:bg-purple-50/30 transition-colors group cursor-pointer"
                      onClick={() => setSelectedReview(item)}
                    >
                      {/* Review & Order ID */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                              #{item.orderId}
                            </span>
                            <button
                              onClick={() => handleCopy(item.orderId, `order-${item.id}`)}
                              className="text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Copy Order ID"
                            >
                              {copiedId === `order-${item.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]" title={item.reviewId}>
                            ID: {item.reviewId}
                          </div>
                        </div>
                      </td>

                      {/* Reseller Info */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            <User className="w-3 h-3 text-purple-600 shrink-0" />
                            <span className="truncate max-w-[130px]">{item.resellerName}</span>
                          </div>
                          {item.resellerPhone && (
                            <div className="text-[11px] text-slate-500 font-mono">
                              {item.resellerPhone}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Vendor Info */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            <Store className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span className="truncate max-w-[130px]">{item.vendorShopName}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[130px]">
                            {item.vendorName}
                          </div>
                        </div>
                      </td>

                      {/* Product & Qty */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {item.productImage ? (
                            <img 
                              src={item.productImage} 
                              alt="" 
                              className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" 
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-semibold text-slate-800 truncate max-w-[140px]" title={item.product}>
                              {item.product}
                            </p>
                            <span className="inline-block px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                              Qty: {item.quantity}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Pricing: Vendor Price & Reseller Price */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 text-[11px]">
                          <div className="text-slate-500">
                            ভেন্ডর রেট: <span className="font-bold text-slate-800 font-mono">৳{item.vendorPrice.toLocaleString()}</span>
                          </div>
                          <div className="text-slate-500">
                            বিক্রয় মূল্য: <span className="font-bold text-slate-800 font-mono">৳{item.resellerSellingPrice.toLocaleString()}</span>
                          </div>
                        </div>
                      </td>

                      {/* Reseller Profit */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 font-black font-mono text-xs">
                          ৳{item.resellerProfit.toLocaleString()}
                        </div>
                      </td>

                      {/* Delivery Status */}
                      <td className="py-3.5 px-4">
                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Delivered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-200" title="Delivery pending">
                            <Clock className="w-3 h-3 text-amber-600" />
                            {item.deliveryStatus || 'In Transit'}
                          </span>
                        )}
                      </td>

                      {/* Review Status */}
                      <td className="py-3.5 px-4">
                        {(item.reviewStatus === 'PENDING' || (item.reviewStatus as any) === 'PENDING_ADMIN_REVIEW') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200 animate-pulse">
                            🟡 Pending Admin Review
                          </span>
                        )}
                        {item.reviewStatus === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                            🟢 Approved
                          </span>
                        )}
                        {item.reviewStatus === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200">
                            🔴 Rejected
                          </span>
                        )}
                      </td>

                      {/* Submitted Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-slate-500 font-mono">
                        {item.submittedAt ? format(new Date(item.submittedAt), 'dd MMM yyyy, hh:mm a') : 'N/A'}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn-view-${item.id}`}
                            onClick={() => setSelectedReview(item)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-800 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>ডিটেইলস</span>
                          </button>

                          {(item.reviewStatus === 'PENDING' || (item.reviewStatus as any) === 'PENDING_ADMIN_REVIEW') && (
                            <>
                              <button
                                id={`btn-approve-direct-${item.id}`}
                                onClick={() => setApproveModalItem(item)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                                title="Approve & Release Profit"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>

                              <button
                                id={`btn-reject-direct-${item.id}`}
                                onClick={() => {
                                  setRejectModalItem(item);
                                  setRejectionReason('');
                                }}
                                className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer"
                                title="Reject Review"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🛡️ Detailed Review & Order Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-black text-amber-400">
                    অর্ডার #{selectedReview.orderId}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-bold">
                    Review ID: {selectedReview.reviewId}
                  </span>
                </div>
                <p className="text-xs text-purple-200">
                  জমা দেওয়ার তারিখ: {format(new Date(selectedReview.submittedAt), 'PPPP, hh:mm a')}
                </p>
              </div>
              <button
                onClick={() => setSelectedReview(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-all"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Delivery Status Alert Banner */}
              {selectedReview.isDelivered ? (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-950">
                      অর্ডারটি সফলভাবে ডেলিভারি সম্পন্ন হয়েছে (DELIVERED)
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      কুরিয়ার ও ডেলিভারি স্ট্যাটাস যাচাই হয়েছে। আপনি রিসেলারের প্রফিট অনুমোদন ও রিলিজ করতে পারেন।
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-amber-950">
                      সতর্কতা: পণ্যটি এখনো ডেলিভারি সম্পন্ন হিসেবে চিহ্নিত হয়নি!
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      বর্তমান ডেলিভারি অবস্থা: <strong>{selectedReview.deliveryStatus}</strong>। ডেলিভারি নিশ্চিত না হওয়া পর্যন্ত প্রফিট রিলিজ করা উচিত নয়।
                    </p>
                  </div>
                </div>
              )}

              {/* Courier Tracking Details */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-purple-600" />
                  কুরিয়ার ও ট্র্যাকিং তথ্য
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">কুরিয়ারের নাম</span>
                    <span className="font-bold text-slate-800">
                      {selectedReview.courierName || 'কুরিয়ার উল্লেখ নেই'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ট্র্যাকিং / কনসাইনমেন্ট নম্বর</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="font-mono font-bold text-slate-900">
                        {selectedReview.trackingNumber || 'N/A'}
                      </span>
                      {selectedReview.trackingNumber && (
                        <button
                          onClick={() => handleCopy(selectedReview.trackingNumber!, 'tracking-modal')}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ট্র্যাকিং লিংক</span>
                    {selectedReview.trackingUrl ? (
                      <a
                        href={selectedReview.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-900 font-bold underline mt-0.5"
                      >
                        কুরিয়ার ট্র্যাকিং দেখুন
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-400 font-bold">লিংক নেই</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Profit & Transaction Flow Card */}
              <div className="p-5 bg-gradient-to-br from-purple-50 via-indigo-50/40 to-white rounded-2xl border-2 border-purple-200 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-900 uppercase tracking-wider">
                    প্রফিট সেটেলমেন্ট ও ট্রানজেকশন ফ্লো
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-200 text-purple-900 font-black text-xs font-mono">
                    Profit Status: {selectedReview.profitStatus}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center bg-white p-3 rounded-xl border border-purple-100">
                  <div>
                    <span className="text-[11px] text-slate-500 block">ভেন্ডর রেট</span>
                    <span className="text-sm font-black text-slate-800 font-mono">
                      ৳{selectedReview.vendorPrice.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">রিসেলার বিক্রয়মূল্য</span>
                    <span className="text-sm font-black text-slate-800 font-mono">
                      ৳{selectedReview.resellerSellingPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-purple-100/60 rounded-lg p-1">
                    <span className="text-[11px] font-bold text-purple-900 block">রিসেলার প্রফিট</span>
                    <span className="text-base font-black text-purple-900 font-mono">
                      ৳{selectedReview.resellerProfit.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 bg-white/70 p-3 rounded-xl border border-purple-100/60 space-y-1">
                  <p className="font-bold text-slate-800">অ্যাডমিন Approve করলে যা ঘটবে:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    <li>ভেন্ডরের <strong>lockedBalance</strong> থেকে ৳{selectedReview.resellerProfit} কমবে।</li>
                    <li>ভেন্ডরের <strong>totalBalance</strong> অপরিবর্তিত থাকবে।</li>
                    <li>রিসেলারের <strong>availableBalance</strong>-এ ৳{selectedReview.resellerProfit} যোগ হবে (উত্তোলনযোগ্য)।</li>
                    <li>রিসেলারের <strong>pendingProfit</strong> থেকে সেই পরিমাণ বাদ যাবে এবং <strong>releasedProfit</strong>-এ যোগ হবে।</li>
                    <li>অর্ডারের <strong>profitStatus = "RELEASED"</strong> হবে।</li>
                  </ul>
                </div>
              </div>

              {/* Linked Reseller & Vendor Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Reseller Info */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <User className="w-4 h-4 text-purple-600" />
                    রিসেলার পরিচিতি
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-slate-900">{selectedReview.resellerName}</p>
                    {selectedReview.resellerEmail && (
                      <p className="text-slate-500">{selectedReview.resellerEmail}</p>
                    )}
                    {selectedReview.resellerPhone && (
                      <p className="text-slate-700 font-mono font-bold">{selectedReview.resellerPhone}</p>
                    )}
                    <p className="text-[10px] text-slate-400 font-mono">UID: {selectedReview.resellerId}</p>
                  </div>
                </div>

                {/* Vendor Info */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Store className="w-4 h-4 text-indigo-600" />
                    ভেন্ডর পরিচিতি
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-slate-900">{selectedReview.vendorShopName}</p>
                    <p className="text-slate-500">{selectedReview.vendorName}</p>
                    {selectedReview.vendorPhone && (
                      <p className="text-slate-700 font-mono font-bold">{selectedReview.vendorPhone}</p>
                    )}
                    <p className="text-[10px] text-slate-400 font-mono">UID: {selectedReview.vendorId}</p>
                  </div>
                </div>
              </div>

              {/* Reseller Submitted Product Review & Rating */}
              <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-100 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-950 flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    রিসেলার প্রোডাক্ট ও সার্ভিস রিভিউ
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= (selectedReview.rating || 5)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                    <span className="font-black text-amber-800 ml-1 text-[11px]">
                      {selectedReview.rating || 5}/5
                    </span>
                  </div>
                </div>

                {selectedReview.reviewContent ? (
                  <div className="bg-white p-3 rounded-xl border border-purple-100 text-slate-800 leading-relaxed text-xs">
                    <p className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider mb-1">
                      পাবলিশযোগ্য কাস্টমার ফিডব্যাক (Public Review Content)
                    </p>
                    <p>{selectedReview.reviewContent}</p>
                  </div>
                ) : null}

                {selectedReview.note && (
                  <div className="bg-purple-100/50 p-2.5 rounded-xl text-purple-900 text-xs">
                    <span className="font-bold block text-[11px]">অভ্যন্তরীণ নোট (Internal Reseller Note):</span>
                    <p className="mt-0.5">{selectedReview.note}</p>
                  </div>
                )}
              </div>

              {/* Previous Rejection or Approval Details */}
              {selectedReview.reviewStatus === 'REJECTED' && (
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs space-y-1 text-rose-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    রিভিউটি রিজেক্ট করা হয়েছে
                  </div>
                  <p><strong>কারণ:</strong> {selectedReview.rejectionReason || 'N/A'}</p>
                  <p className="text-[11px] text-rose-700">
                    রিজেক্ট করেছেন: {selectedReview.rejectedBy || 'Admin'} •{' '}
                    {selectedReview.rejectedAt ? format(new Date(selectedReview.rejectedAt), 'dd MMM yyyy, hh:mm a') : ''}
                  </p>
                </div>
              )}

              {selectedReview.reviewStatus === 'APPROVED' && (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs space-y-1 text-emerald-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    প্রফিট ইতিমধ্যে রিলিজ সম্পন্ন হয়েছে
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    অনুমোদন করেছেন: {selectedReview.approvedBy || 'Admin'} •{' '}
                    {selectedReview.approvedAt ? format(new Date(selectedReview.approvedAt), 'dd MMM yyyy, hh:mm a') : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                onClick={() => setSelectedReview(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                বন্ধ করুন
              </button>

              {(selectedReview.reviewStatus === 'PENDING' || (selectedReview.reviewStatus as any) === 'PENDING_ADMIN_REVIEW') && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setRejectModalItem(selectedReview);
                      setRejectionReason('');
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold transition-all cursor-pointer"
                  >
                    রিজেক্ট করুন
                  </button>

                  <button
                    onClick={() => setApproveModalItem(selectedReview)}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    অনুমোদন ও প্রফিট রিলিজ করুন
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🟢 Admin Approve Confirmation Modal */}
      {approveModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900">
                প্রফিট রিলিজ নিশ্চিতকরণ
              </h3>
              <p className="text-xs text-slate-500">
                অর্ডার #{approveModalItem.orderId}-এর জন্য রিসেলার প্রফিট <strong>৳{approveModalItem.resellerProfit}</strong> রিলিজ করতে চান?
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">রিসেলার:</span>
                <span className="font-bold text-slate-900">{approveModalItem.resellerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ভেন্ডর শপ:</span>
                <span className="font-bold text-slate-900">{approveModalItem.vendorShopName}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-700 font-bold">রিলিজযোগ্য প্রফিট:</span>
                <span className="font-black text-emerald-700 font-mono text-sm">
                  ৳{approveModalItem.resellerProfit.toLocaleString()}
                </span>
              </div>
            </div>

            {approveModalItem.trackingUrl && (
              <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100 flex items-center justify-between gap-2">
                <div className="text-xs text-indigo-950">
                  <span className="font-semibold block text-[11px] text-indigo-600">কুরিয়ার ট্র্যাকিং:</span>
                  <span className="font-bold">{approveModalItem.courierName || 'কুরিয়ার'}</span>
                  {approveModalItem.trackingNumber && <span className="ml-1 text-slate-500 font-mono">({approveModalItem.trackingNumber})</span>}
                </div>
                <a
                  href={approveModalItem.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>ট্র্যাকিং লিংক দেখুন</span>
                </a>
              </div>
            )}

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                অনুমোদন নিশ্চিত করার মাধ্যমে রিসেলারের ওয়ালেটে <strong>৳{approveModalItem.resellerProfit}</strong> প্রফিট রিলিজ হবে এবং অর্ডারটি ডেলিভার্ড হিসেবে সম্পন্ন হবে।
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setApproveModalItem(null)}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                বাতিল
              </button>
              <button
                id="btn-confirm-approve-modal"
                onClick={handleApproveConfirm}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    হ্যাঁ, প্রফিট রিলিজ করুন
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 Admin Reject Review Modal */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900">
                রিভিউ রিজেক্ট করুন
              </h3>
              <p className="text-xs text-slate-500">
                অর্ডার #{rejectModalItem.orderId}-এর ভেরিফিকেশন রিভিউ রিজেক্ট করা হবে। ভেন্ডরের টাকা ফেরত যাবে না এবং প্রফিট LOCKED থাকবে।
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-700">
                রিজেক্ট করার কারণ (বাধ্যতামূলক):
              </label>
              <textarea
                id="textarea-rejection-reason"
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="উদাঃ পার্সেল এখনো কুরিয়ারে ডেলিভারি সম্পন্ন হয়নি, কাস্টমার রিটার্ন দাবি করেছে, ইত্যাদি..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-hidden resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setRejectModalItem(null);
                  setRejectionReason('');
                }}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                বাতিল
              </button>
              <button
                id="btn-confirm-reject-modal"
                onClick={handleRejectConfirm}
                disabled={actionLoading || !rejectionReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {actionLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    রিজেক্ট নিশ্চিত করুন
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
