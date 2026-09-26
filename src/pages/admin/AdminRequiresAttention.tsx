import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, ShieldAlert, Clock, Truck, RefreshCcw, Search, 
  Filter, CheckCircle, XCircle, ChevronRight, Eye, Phone, MapPin, 
  Store, User, CreditCard, DollarSign, Bell, ExternalLink, HelpCircle, 
  FileText, ArrowRight, ShieldCheck, AlertOctagon, Check, X, 
  Send, Package, Sparkles, Navigation, Info, Lock, Unlock, Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { 
  fetchAllAttentionOrders, 
  AttentionOrder, 
  ExceptionSummaryCounts, 
  ExceptionType,
  nudgeVendorForOrder,
  assignOrderTracking,
  freezePayoutAdmin
} from '../../services/adminExceptionService';
import { 
  releaseVendorPayout, 
  refundCustomerDispute, 
  rejectCustomerDisputeAndRelease,
  deleteCustomerDispute,
  deleteEntireOrder
} from '../../services/vendorPayoutService';

export default function AdminRequiresAttention() {
  const { userData, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attentionOrders, setAttentionOrders] = useState<AttentionOrder[]>([]);
  const [counts, setCounts] = useState<ExceptionSummaryCounts>({
    total: 0,
    unaccepted_order: 0,
    delayed_shipping: 0,
    missing_tracking: 0,
    delivery_failed: 0,
    customer_dispute: 0,
    refund_pending: 0,
    suspicious_order: 0,
    payout_stuck: 0,
  });

  // Filtering & Search
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Modal State
  const [selectedAttentionItem, setSelectedAttentionItem] = useState<AttentionOrder | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Quick Action Forms
  const [nudgeReason, setNudgeReason] = useState('');
  const [showNudgeInput, setShowNudgeInput] = useState(false);
  const [newCourier, setNewCourier] = useState('Steadfast');
  const [newTrackingId, setNewTrackingId] = useState('');
  const [showTrackingInput, setShowTrackingInput] = useState(false);
  const [disputeNote, setDisputeNote] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [showHoldInput, setShowHoldInput] = useState(false);

  // Delete State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<AttentionOrder | null>(null);
  const [deletingDispute, setDeletingDispute] = useState(false);
  const [deletingEntireOrder, setDeletingEntireOrder] = useState(false);

  const handleDeleteCustomerReport = async (item: AttentionOrder) => {
    setDeletingDispute(true);
    try {
      const res = await deleteCustomerDispute(item.order, userData);
      if (res.success) {
        toast.success(res.message);
        setDeleteConfirmItem(null);
        if (selectedAttentionItem?.order?.id === item.order?.id) {
          setSelectedAttentionItem(null);
        }
        await loadAttentionData(true);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'কাস্টমার রিপোর্ট ডিলিট করতে সমস্যা হয়েছে');
    } finally {
      setDeletingDispute(false);
    }
  };

  const handleDeleteEntireOrder = async (item: AttentionOrder) => {
    setDeletingEntireOrder(true);
    try {
      const res = await deleteEntireOrder(item.order, userData);
      if (res.success) {
        toast.success(res.message);
        setDeleteConfirmItem(null);
        if (selectedAttentionItem?.order?.id === item.order?.id) {
          setSelectedAttentionItem(null);
        }
        // Immediately remove from list in UI
        setAttentionOrders(prev => prev.filter(o => {
          const oId = o.order?.orderId || o.order?.id;
          const targetId = item.order?.orderId || item.order?.id;
          return oId !== targetId;
        }));
        await loadAttentionData(true);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'সম্পূর্ণ অর্ডার ডিলিট করতে সমস্যা হয়েছে');
    } finally {
      setDeletingEntireOrder(false);
    }
  };

  const loadAttentionData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await fetchAllAttentionOrders();
      setAttentionOrders(data.attentionOrders);
      setCounts(data.summaryCounts);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load attention exceptions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAttentionData();
  }, []);

  // Filtered list
  const filteredOrders = attentionOrders.filter(item => {
    const order = item.order;
    const matchesSearch = 
      (order.orderId || order.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.shippingAddress?.name || order.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.shippingAddress?.mobile || order.shippingAddress?.phone || order.customerPhone || '').includes(searchQuery) ||
      (item.vendorDetails?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.vendorDetails?.shopName || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (severityFilter !== 'all' && item.primaryException.severity !== severityFilter) {
      return false;
    }

    if (activeTab === 'all') return true;
    return item.exceptions.some(ex => ex.type === activeTab);
  });

  const getSeverityBadge = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200"><AlertOctagon className="w-3 h-3 text-rose-600" /> High Severity</span>;
      case 'medium':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200"><AlertTriangle className="w-3 h-3 text-amber-600" /> Medium Severity</span>;
      case 'low':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200"><Info className="w-3 h-3 text-blue-600" /> Advisory</span>;
    }
  };

  const getExceptionIcon = (type: ExceptionType) => {
    switch (type) {
      case 'customer_dispute':
        return <ShieldAlert className="w-5 h-5 text-rose-600" />;
      case 'refund_pending':
        return <CreditCard className="w-5 h-5 text-purple-600" />;
      case 'delivery_failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'missing_tracking':
        return <Truck className="w-5 h-5 text-amber-600" />;
      case 'unaccepted_order':
        return <Clock className="w-5 h-5 text-orange-600" />;
      case 'delayed_shipping':
        return <Clock className="w-5 h-5 text-indigo-600" />;
      case 'suspicious_order':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'payout_stuck':
        return <Lock className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-rose-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Intelligent Exception Radar</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Requires Attention <span className="text-rose-400 text-lg md:text-xl font-normal">({counts.total} problematic orders)</span>
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              System automatically flags orders requiring intervention. Normal orders process automatically without manual checking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadAttentionData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin text-rose-400' : ''}`} />
              <span>Refresh Radar</span>
            </button>
            <Link
              to="/admin/orders"
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-xl transition-colors shadow-sm"
            >
              All Orders List
            </Link>
          </div>
        </div>
      </div>

      {/* Summary KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {/* 1. Unaccepted */}
        <button
          onClick={() => setActiveTab('unaccepted_order')}
          className={`p-4 rounded-2xl text-left border transition-all ${
            activeTab === 'unaccepted_order' 
              ? 'bg-orange-50/80 border-orange-300 ring-2 ring-orange-400/30' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-700">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-xl font-black text-slate-900">{counts.unaccepted_order}</span>
          </div>
          <p className="text-xs font-bold text-slate-800 mt-2.5">Unaccepted Orders</p>
          <p className="text-[11px] text-slate-500 font-medium">ভেন্ডর গ্রহণ করেনি</p>
        </button>

        {/* 2. Delayed Shipping */}
        <button
          onClick={() => setActiveTab('delayed_shipping')}
          className={`p-4 rounded-2xl text-left border transition-all ${
            activeTab === 'delayed_shipping' 
              ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-400/30' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <Truck className="w-4 h-4" />
            </div>
            <span className="text-xl font-black text-slate-900">{counts.delayed_shipping}</span>
          </div>
          <p className="text-xs font-bold text-slate-800 mt-2.5">Delayed Shipping</p>
          <p className="text-[11px] text-slate-500 font-medium">সময়মতো শিপ হয়নি</p>
        </button>

        {/* 3. Missing Tracking */}
        <button
          onClick={() => setActiveTab('missing_tracking')}
          className={`p-4 rounded-2xl text-left border transition-all ${
            activeTab === 'missing_tracking' 
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-xl font-black text-slate-900">{counts.missing_tracking}</span>
          </div>
          <p className="text-xs font-bold text-slate-800 mt-2.5">Missing Tracking</p>
          <p className="text-[11px] text-slate-500 font-medium">ট্র্যাকিং নম্বরহীন</p>
        </button>

        {/* 4. Delivery Issues */}
        <button
          onClick={() => setActiveTab('delivery_failed')}
          className={`p-4 rounded-2xl text-left border transition-all ${
            activeTab === 'delivery_failed' 
              ? 'bg-red-50/80 border-red-300 ring-2 ring-red-400/30' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="p-2 rounded-xl bg-red-100 text-red-700">
              <XCircle className="w-4 h-4" />
            </div>
            <span className="text-xl font-black text-slate-900">{counts.delivery_failed}</span>
          </div>
          <p className="text-xs font-bold text-slate-800 mt-2.5">Delivery Failed / Return</p>
          <p className="text-[11px] text-slate-500 font-medium">ডেলিভারি ব্যর্থ বা রিটার্ন</p>
        </button>

        {/* 5. Customer Disputes */}
        <button
          onClick={() => setActiveTab('customer_dispute')}
          className={`p-4 rounded-2xl text-left border transition-all ${
            activeTab === 'customer_dispute' 
              ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-400/30' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <span className="text-xl font-black text-rose-600">{counts.customer_dispute}</span>
          </div>
          <p className="text-xs font-bold text-slate-800 mt-2.5">Active Disputes</p>
          <p className="text-[11px] text-slate-500 font-medium">কাস্টমার অভিযোগ</p>
        </button>

        {/* 6. Refund Requests */}
        <button
          onClick={() => setActiveTab('refund_pending')}
          className={`p-4 rounded-2xl text-left border transition-all ${
            activeTab === 'refund_pending' 
              ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-400/30' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-xl font-black text-purple-600">{counts.refund_pending}</span>
          </div>
          <p className="text-xs font-bold text-slate-800 mt-2.5">Refund Requests</p>
          <p className="text-[11px] text-slate-500 font-medium">রিফান্ড পেন্ডিং</p>
        </button>

        {/* 7. Suspicious Orders */}
        <button
          onClick={() => setActiveTab('suspicious_order')}
          className={`p-4 rounded-2xl text-left border transition-all ${
            activeTab === 'suspicious_order' 
              ? 'bg-yellow-50/80 border-yellow-300 ring-2 ring-yellow-400/30' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="p-2 rounded-xl bg-yellow-100 text-yellow-700">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <span className="text-xl font-black text-slate-900">{counts.suspicious_order}</span>
          </div>
          <p className="text-xs font-bold text-slate-800 mt-2.5">Suspicious / High COD</p>
          <p className="text-[11px] text-slate-500 font-medium">সন্দেহজনক / হাই-রিস্ক</p>
        </button>

        {/* 8. Payout Stuck */}
        <button
          onClick={() => setActiveTab('payout_stuck')}
          className={`p-4 rounded-2xl text-left border transition-all ${
            activeTab === 'payout_stuck' 
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-400/30' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Lock className="w-4 h-4" />
            </div>
            <span className="text-xl font-black text-slate-900">{counts.payout_stuck}</span>
          </div>
          <p className="text-xs font-bold text-slate-800 mt-2.5">Stuck Payouts</p>
          <p className="text-[11px] text-slate-500 font-medium">পেমেন্ট রিলিজ আটকে আছে</p>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID, Customer Name, Phone, Vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-main focus:bg-white transition-all"
            />
          </div>

          {/* Severity filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold whitespace-nowrap">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="high">🔴 High Severity Only</option>
              <option value="medium">🟠 Medium Severity Only</option>
              <option value="low">🔵 Advisory Only</option>
            </select>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Exceptions ({counts.total})
          </button>
          <button
            onClick={() => setActiveTab('customer_dispute')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'customer_dispute'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Disputes ({counts.customer_dispute})
          </button>
          <button
            onClick={() => setActiveTab('refund_pending')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'refund_pending'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Refunds ({counts.refund_pending})
          </button>
          <button
            onClick={() => setActiveTab('unaccepted_order')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'unaccepted_order'
                ? 'bg-orange-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Unaccepted ({counts.unaccepted_order})
          </button>
          <button
            onClick={() => setActiveTab('delayed_shipping')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'delayed_shipping'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Delayed Ship ({counts.delayed_shipping})
          </button>
          <button
            onClick={() => setActiveTab('missing_tracking')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'missing_tracking'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Missing Tracking ({counts.missing_tracking})
          </button>
          <button
            onClick={() => setActiveTab('delivery_failed')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'delivery_failed'
                ? 'bg-red-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Failed / Return ({counts.delivery_failed})
          </button>
          <button
            onClick={() => setActiveTab('suspicious_order')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'suspicious_order'
                ? 'bg-yellow-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Suspicious ({counts.suspicious_order})
          </button>
          <button
            onClick={() => setActiveTab('payout_stuck')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === 'payout_stuck'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Stuck Payouts ({counts.payout_stuck})
          </button>
        </div>
      </div>

      {/* Main List of Exception Orders */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 flex flex-col items-center justify-center min-h-[300px]">
          <RefreshCcw className="w-8 h-8 text-primary-main animate-spin mb-3" />
          <p className="text-slate-600 font-semibold text-sm">Analyzing order exception radar...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">No Problematic Orders Found!</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Everything is operating smoothly. All healthy orders are processing automatically through their standard lifecycles.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((item) => {
            const order = item.order;
            const primaryEx = item.primaryException;

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all overflow-hidden"
              >
                {/* Exception Alert Banner Header */}
                <div className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
                  primaryEx.severity === 'high' 
                    ? 'bg-rose-50/70 border-rose-100' 
                    : primaryEx.severity === 'medium'
                    ? 'bg-amber-50/70 border-amber-100'
                    : 'bg-blue-50/70 border-blue-100'
                }`}>
                  <div className="flex items-center gap-2.5">
                    {getExceptionIcon(primaryEx.type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                          {primaryEx.title}
                        </span>
                        <span className="text-xs text-slate-600 font-medium">
                          ({primaryEx.titleBn})
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 mt-0.5 font-medium">
                        {primaryEx.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getSeverityBadge(primaryEx.severity)}
                    {item.exceptions.length > 1 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                        +{item.exceptions.length - 1} more issue
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Body */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 items-center">
                  {/* Order & Date */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        #{order.orderId || order.id?.substring(0, 8)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Placed: {order.createdAt ? format(new Date(typeof order.createdAt === 'number' ? order.createdAt : order.createdAt?.toDate ? order.createdAt.toDate() : order.createdAt), 'MMM d, yyyy h:mm a') : 'N/A'}
                    </p>
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                      Status: {order.status}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{order.shippingAddress?.name || 'Customer'}</span>
                    </div>
                    <p className="text-xs text-slate-600 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {order.shippingAddress?.phone || 'No phone'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                      {order.shippingAddress?.city || order.shippingAddress?.address || 'Address provided'}
                    </p>
                  </div>

                  {/* Vendor Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Store className="w-3.5 h-3.5 text-primary-main" />
                      <span>{item.vendorDetails?.shopName || item.vendorDetails?.name || 'Assigned Vendor'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Vendor ID: {order.vendorId?.substring(0, 8) || order.items?.[0]?.vendorId?.substring(0, 8) || 'N/A'}
                    </p>
                    <p className="text-xs text-slate-600">
                      Payout: <strong className={order.vendorPayoutStatus === 'Released' ? 'text-emerald-600' : 'text-amber-600'}>{order.vendorPayoutStatus || 'Held'}</strong>
                    </p>
                  </div>

                  {/* Amount & Items */}
                  <div className="space-y-1">
                    <div className="text-sm font-black text-slate-900">
                      ৳{(order.total || order.totalAmount || 0).toLocaleString()}
                    </div>
                    <p className="text-xs text-slate-600">
                      Method: <strong className="uppercase">{order.paymentMethod || 'COD'}</strong>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {order.items?.length || 1} product(s) in parcel
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex md:flex-col lg:flex-row items-center gap-2 justify-end">
                    <button
                      onClick={() => setDeleteConfirmItem(item)}
                      className="p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-800 hover:border-rose-300 transition-colors shadow-2xs flex items-center justify-center shrink-0"
                      title={item.order?.dispute ? "রিপোর্ট বা সম্পূর্ণ অর্ডার ডিলিট করুন (Delete Report / Order)" : "সম্পূর্ণ অর্ডার ডিলিট করুন (Delete Entire Order)"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAttentionItem(item);
                        setShowNudgeInput(false);
                        setShowTrackingInput(false);
                        setShowHoldInput(false);
                      }}
                      className="flex-1 lg:flex-initial px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review / Resolve</span>
                    </button>
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      title="Open full Order Details page"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Suggested Action Bar */}
                <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary-main" />
                    <span><strong>Recommended Action:</strong> {primaryEx.suggestedAction}</span>
                  </div>
                  <button
                    onClick={() => setSelectedAttentionItem(item)}
                    className="text-primary-main hover:underline font-bold text-xs flex items-center gap-1"
                  >
                    <span>Execute Decision</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comprehensive Quick Inspection & Resolution Modal */}
      {selectedAttentionItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full my-8 shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Admin Exception Review
                  </span>
                  <span className="font-mono text-sm text-slate-300">
                    #{selectedAttentionItem.order.orderId || selectedAttentionItem.order.id}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {selectedAttentionItem.primaryException.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDeleteConfirmItem(selectedAttentionItem)}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/80 border border-rose-700/60 hover:bg-rose-700 text-rose-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  title="পুরো অর্ডার বা রিপোর্ট ডিলিট করুন"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  onClick={() => setSelectedAttentionItem(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Active Issues Warning Box */}
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-900 text-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Detected Operational Issues ({selectedAttentionItem.exceptions.length}):</span>
                </div>
                <ul className="space-y-1.5 text-xs text-rose-800">
                  {selectedAttentionItem.exceptions.map((ex, i) => (
                    <li key={i} className="flex items-start gap-2 bg-white/70 p-2 rounded-lg">
                      <span className="font-bold">• {ex.title}:</span>
                      <span>{ex.description}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 4 Quadrants: Vendor, Customer, Payment/Escrow, Courier */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Vendor Information */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-900 font-bold border-b border-slate-200 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-primary-main" />
                      Vendor Information
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      ID: {selectedAttentionItem.order.vendorId?.substring(0, 8) || 'N/A'}
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-700">
                    <p><strong>Store Name:</strong> {selectedAttentionItem.vendorDetails?.shopName || selectedAttentionItem.order.vendorShopName || 'Vendor Store'}</p>
                    <p><strong>Owner Name:</strong> {selectedAttentionItem.vendorDetails?.name || selectedAttentionItem.order.vendorName || 'Assigned Vendor'}</p>
                    {selectedAttentionItem.vendorDetails?.phone && (
                      <p><strong>Phone:</strong> {selectedAttentionItem.vendorDetails.phone}</p>
                    )}
                    {selectedAttentionItem.vendorDetails?.email && (
                      <p><strong>Email:</strong> {selectedAttentionItem.vendorDetails.email}</p>
                    )}
                    <p><strong>Current Payout Status:</strong> <span className="font-bold text-slate-900">{selectedAttentionItem.order.vendorPayoutStatus || 'Held'}</span></p>
                  </div>
                </div>

                {/* 2. Customer Information */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-900 font-bold border-b border-slate-200 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-primary-main" />
                      Customer Information
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {selectedAttentionItem.order.userId ? 'Registered User' : 'Guest'}
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-700">
                    <p><strong>Name:</strong> {selectedAttentionItem.order.shippingAddress?.name || 'Customer'}</p>
                    <p><strong>Phone:</strong> <span className="font-bold text-slate-900">{selectedAttentionItem.order.shippingAddress?.phone || 'N/A'}</span></p>
                    <p><strong>Address:</strong> {selectedAttentionItem.order.shippingAddress?.address || 'N/A'}, {selectedAttentionItem.order.shippingAddress?.city || ''}</p>
                    {selectedAttentionItem.order.shippingAddress?.email && (
                      <p><strong>Email:</strong> {selectedAttentionItem.order.shippingAddress?.email}</p>
                    )}
                  </div>
                </div>

                {/* 3. Payment & Escrow Status */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-900 font-bold border-b border-slate-200 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      Payment & Escrow Status
                    </span>
                    <span className="text-emerald-700 font-black text-sm">
                      ৳{(selectedAttentionItem.order.total || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-700">
                    <p><strong>Method:</strong> <span className="uppercase font-bold">{selectedAttentionItem.order.paymentMethod || 'COD'}</span></p>
                    <p><strong>Payment Status:</strong> <span className="font-bold text-slate-900">{selectedAttentionItem.order.paymentStatus || 'Pending'}</span></p>
                    <p><strong>Escrow Payout:</strong> ৳{selectedAttentionItem.order.vendorPayoutAmount || selectedAttentionItem.order.total || 0} ({selectedAttentionItem.order.vendorPayoutStatus || 'Held'})</p>
                    {selectedAttentionItem.order.transactionId && (
                      <p className="font-mono text-[11px]"><strong>Txn ID:</strong> {selectedAttentionItem.order.transactionId}</p>
                    )}
                  </div>
                </div>

                {/* 4. Courier & Tracking */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-900 font-bold border-b border-slate-200 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-indigo-600" />
                      Courier & Tracking
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                      {selectedAttentionItem.order.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-700">
                    <p><strong>Courier:</strong> {selectedAttentionItem.order.courierName || selectedAttentionItem.order.courier || 'Not Assigned'}</p>
                    <p><strong>Tracking Number:</strong> <span className="font-mono font-bold text-slate-900">{selectedAttentionItem.order.trackingNumber || selectedAttentionItem.order.consignmentId || 'None'}</span></p>
                    {selectedAttentionItem.order.trackingNote && (
                      <p><strong>Tracking Note:</strong> {selectedAttentionItem.order.trackingNote}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dispute & Refund Review Section (if applicable) */}
              {selectedAttentionItem.order.dispute && (
                <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-3 text-xs">
                  <div className="font-bold text-rose-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      Active Customer Dispute / Complaint Details
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-900 font-bold text-[10px]">
                        Payout Frozen
                      </span>
                      <button
                        onClick={() => setDeleteConfirmItem(selectedAttentionItem)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-600 hover:text-white font-bold text-xs flex items-center gap-1 transition-colors shadow-2xs"
                        title="রিপোর্ট ডিলিট করুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Report</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-rose-100 space-y-1.5">
                    <p><strong>Reason:</strong> <span className="font-bold text-rose-900">{selectedAttentionItem.order.dispute.reason}</span></p>
                    {selectedAttentionItem.order.dispute.details && (
                      <p><strong>Details:</strong> {selectedAttentionItem.order.dispute.details}</p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      Raised by: {selectedAttentionItem.order.dispute.raisedBy || 'Customer'} • {selectedAttentionItem.order.dispute.createdAt ? format(new Date(selectedAttentionItem.order.dispute.createdAt), 'MMM d, yyyy h:mm a') : ''}
                    </p>
                  </div>

                  {/* Customer Evidence Photos */}
                  {selectedAttentionItem.order.dispute.images?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="font-bold text-slate-700 text-[11px]">Customer Proof Photos ({selectedAttentionItem.order.dispute.images.length}):</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedAttentionItem.order.dispute.images.map((img: string, idx: number) => (
                          <a key={idx} href={img} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded-xl overflow-hidden border border-slate-300 hover:border-primary-main shadow-xs">
                            <img referrerPolicy="no-referrer" src={img} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vendor Statement */}
                  {selectedAttentionItem.order.dispute.vendorResponse ? (
                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-1 text-slate-800">
                      <div className="flex justify-between items-center text-teal-900 font-bold text-xs">
                        <span>🏪 Vendor Submitted Response ({selectedAttentionItem.order.dispute.vendorResponse.respondedBy || 'Vendor'}):</span>
                      </div>
                      <p className="text-xs bg-white p-2.5 rounded-lg border border-teal-100">
                        "{selectedAttentionItem.order.dispute.vendorResponse.text}"
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">No statement submitted by vendor yet.</p>
                  )}
                </div>
              )}

              {/* Administrative Resolution Actions */}
              <div className="p-5 bg-slate-900 rounded-2xl text-white space-y-4">
                <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-rose-400" />
                  Administrative Decision & Resolution Actions
                </h4>

                {/* Dispute actions */}
                {selectedAttentionItem.order.dispute && selectedAttentionItem.order.dispute.status !== 'Resolved - Released' && selectedAttentionItem.order.dispute.status !== 'Resolved - Refunded' ? (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <input
                      type="text"
                      value={disputeNote}
                      onChange={(e) => setDisputeNote(e.target.value)}
                      placeholder="Resolution note for customer & vendor (optional)..."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-rose-400"
                    />
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={async () => {
                          setActionLoading(true);
                          try {
                            const res = await refundCustomerDispute(selectedAttentionItem.order, userData, disputeNote);
                            if (res.success) {
                              toast.success(res.message);
                              setSelectedAttentionItem(null);
                              loadAttentionData(true);
                            } else {
                              toast.error(res.message);
                            }
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        disabled={actionLoading}
                        className="py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve Customer Refund
                      </button>
                      <button
                        onClick={async () => {
                          setActionLoading(true);
                          try {
                            const res = await rejectCustomerDisputeAndRelease(selectedAttentionItem.order, userData, disputeNote);
                            if (res.success) {
                              toast.success(res.message);
                              setSelectedAttentionItem(null);
                              loadAttentionData(true);
                            } else {
                              toast.error(res.message);
                            }
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        disabled={actionLoading}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Reject Dispute & Release Payout
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => setDeleteConfirmItem(selectedAttentionItem)}
                        disabled={actionLoading}
                        className="py-2 px-3 bg-rose-950/70 hover:bg-rose-900 border border-rose-800/60 text-rose-200 hover:text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>পুরো অর্ডার ডিলিট (Delete All)</span>
                      </button>
                      <button
                        onClick={() => setDeleteConfirmItem(selectedAttentionItem)}
                        disabled={actionLoading}
                        className="py-2 px-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>শুধু রিপোর্ট ডিলিট (Report Only)</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Permanent Delete Action for any attention item */}
                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => setDeleteConfirmItem(selectedAttentionItem)}
                    disabled={actionLoading}
                    className="py-2 px-3.5 bg-rose-950/40 hover:bg-rose-900/70 border border-rose-800/40 text-rose-300 hover:text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete Entire Order (পুরো অর্ডারটি সম্পূর্ণ ডিলিট করুন)</span>
                  </button>
                </div>

                {/* Primary Action Buttons Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* 1. Nudge Vendor Button */}
                  <button
                    onClick={() => {
                      setShowNudgeInput(!showNudgeInput);
                      setShowTrackingInput(false);
                      setShowHoldInput(false);
                    }}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    <span>Nudge / Alert Vendor</span>
                  </button>

                  {/* 2. Update Tracking Button */}
                  <button
                    onClick={() => {
                      setShowTrackingInput(!showTrackingInput);
                      setShowNudgeInput(false);
                      setShowHoldInput(false);
                    }}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Truck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Assign Tracking Info</span>
                  </button>

                  {/* 3. Release or Hold Payout Button */}
                  {selectedAttentionItem.order.vendorPayoutStatus === 'Released' ? (
                    <button
                      onClick={() => {
                        setShowHoldInput(!showHoldInput);
                        setShowNudgeInput(false);
                        setShowTrackingInput(false);
                      }}
                      className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Freeze / Hold Payout</span>
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        setActionLoading(true);
                        try {
                          const res = await releaseVendorPayout(selectedAttentionItem.order, userData);
                          if (res.success) {
                            toast.success(res.message);
                            setSelectedAttentionItem(null);
                            loadAttentionData(true);
                          } else {
                            toast.error(res.message);
                          }
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading}
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Release Payout Now</span>
                    </button>
                  )}
                </div>

                {/* Sub-form: Nudge Vendor */}
                {showNudgeInput && (
                  <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 space-y-2">
                    <label className="block text-xs font-bold text-slate-200">
                      Send Urgent Notification & Reminder to Vendor:
                    </label>
                    <input
                      type="text"
                      value={nudgeReason}
                      onChange={(e) => setNudgeReason(e.target.value)}
                      placeholder="e.g. Please accept order immediately or hand over parcel to Steadfast..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-primary-main"
                    />
                    <button
                      disabled={actionLoading || !nudgeReason.trim()}
                      onClick={async () => {
                        setActionLoading(true);
                        try {
                          const vendorId = selectedAttentionItem.order.vendorId || selectedAttentionItem.order.items?.[0]?.vendorId;
                          const res = await nudgeVendorForOrder(
                            selectedAttentionItem.order.id,
                            vendorId,
                            nudgeReason.trim(),
                            userData
                          );
                          if (res.success) {
                            toast.success(res.message);
                            setShowNudgeInput(false);
                            setNudgeReason('');
                          } else {
                            toast.error(res.message);
                          }
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      className="w-full py-1.5 bg-primary-main hover:bg-sky-600 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch Urgent Nudge to Vendor</span>
                    </button>
                  </div>
                )}

                {/* Sub-form: Assign Tracking */}
                {showTrackingInput && (
                  <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 space-y-2">
                    <label className="block text-xs font-bold text-slate-200">
                      Assign Courier & Tracking ID directly:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newCourier}
                        onChange={(e) => setNewCourier(e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                      >
                        <option value="Steadfast">Steadfast Courier</option>
                        <option value="Pathao">Pathao Courier</option>
                        <option value="RedX">RedX Delivery</option>
                        <option value="Paperfly">Paperfly</option>
                        <option value="Sundarban">Sundarban Courier</option>
                        <option value="In-house">In-House Delivery</option>
                      </select>
                      <input
                        type="text"
                        value={newTrackingId}
                        onChange={(e) => setNewTrackingId(e.target.value)}
                        placeholder="Tracking Number / Consignment ID..."
                        className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                    <button
                      disabled={actionLoading || !newTrackingId.trim()}
                      onClick={async () => {
                        setActionLoading(true);
                        try {
                          const res = await assignOrderTracking(
                            selectedAttentionItem.order.id,
                            newCourier,
                            newTrackingId.trim(),
                            userData
                          );
                          if (res.success) {
                            toast.success(res.message);
                            setShowTrackingInput(false);
                            setNewTrackingId('');
                            setSelectedAttentionItem(null);
                            loadAttentionData(true);
                          } else {
                            toast.error(res.message);
                          }
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Tracking & Mark Shipped</span>
                    </button>
                  </div>
                )}

                {/* Sub-form: Hold Payout */}
                {showHoldInput && (
                  <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 space-y-2">
                    <label className="block text-xs font-bold text-rose-300">
                      Administrative Payout Freeze Reason:
                    </label>
                    <input
                      type="text"
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                      placeholder="e.g. Under quality investigation or suspected counterfeit parcel..."
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-rose-400"
                    />
                    <button
                      disabled={actionLoading || !holdReason.trim()}
                      onClick={async () => {
                        setActionLoading(true);
                        try {
                          const res = await freezePayoutAdmin(
                            selectedAttentionItem.order.id,
                            holdReason.trim(),
                            userData
                          );
                          if (res.success) {
                            toast.success(res.message);
                            setShowHoldInput(false);
                            setHoldReason('');
                            setSelectedAttentionItem(null);
                            loadAttentionData(true);
                          } else {
                            toast.error(res.message);
                          }
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Execute Administrative Freeze</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <Link
                to={`/admin/orders/${selectedAttentionItem.order.id}`}
                className="text-xs font-bold text-primary-main hover:underline flex items-center gap-1"
              >
                <span>Open Full Order Details Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmItem(selectedAttentionItem)}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Delete Entire Order</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAttentionItem(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog (Delete Entire Order or Report Only) */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-slate-900">
                  অর্ডার বা রিপোর্ট ডিলিট করবেন? (Delete Options)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Order #{deleteConfirmItem.order.orderId || deleteConfirmItem.order.id?.substring(0, 8)} • ৳{(deleteConfirmItem.order.total || 0).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Context Info Box */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <div className="flex justify-between items-center text-[11px] text-slate-500 pb-1.5 border-b border-slate-200">
                <span>Customer: <strong className="text-slate-800">{deleteConfirmItem.order.shippingAddress?.name || 'Customer'}</strong></span>
                <span>Vendor: <strong className="text-slate-800">{deleteConfirmItem.order.vendorShopName || deleteConfirmItem.vendorDetails?.shopName || 'Vendor'}</strong></span>
              </div>
              <p>
                <strong>সমস্যা (Detected Issue):</strong>{' '}
                <span className="text-rose-700 font-semibold">
                  {deleteConfirmItem.primaryException?.title || deleteConfirmItem.order.dispute?.reason || 'Order Attention Issue'}
                </span>
              </p>
              {deleteConfirmItem.order.dispute?.details && (
                <p className="text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200">
                  "{deleteConfirmItem.order.dispute.details}"
                </p>
              )}
            </div>

            {/* Options */}
            <div className="space-y-3">
              {/* Option 1: Delete Entire Order (পুরোটাই ডিলিট করুন) */}
              <div className="p-3.5 rounded-2xl border-2 border-rose-200 bg-rose-50/60 space-y-2">
                <div className="flex items-center gap-2 text-rose-950 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>পুরো অর্ডারটি সম্পূর্ণ ডিলিট করুন (Delete Entire Order)</span>
                </div>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  ডাটাবেজ (RTDB ও Firestore), ডিসপিউট, ভেন্ডর অর্ডার রেকর্ড এবং ক্যাশ থেকে এই পুরো অর্ডারটি চিরতরে মুছে ফেলা হবে। এটি রিকোয়ার্ড অ্যাটেনশন থেকেও স্থায়ীভাবে মুছে যাবে।
                </p>
                <button
                  type="button"
                  onClick={() => handleDeleteEntireOrder(deleteConfirmItem)}
                  disabled={deletingEntireOrder || deletingDispute}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {deletingEntireOrder ? (
                    <RefreshCcw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>হ্যাঁ, সম্পূর্ণ অর্ডারটি চিরতরে ডিলিট করুন</span>
                </button>
              </div>

              {/* Option 2: Delete Customer Report Only (যদি কাস্টমার রিপোর্ট থাকে) */}
              {(deleteConfirmItem.order.dispute || 
                deleteConfirmItem.order.status?.toLowerCase() === 'dispute' || 
                deleteConfirmItem.order.status?.toLowerCase() === 'disputed' || 
                deleteConfirmItem.exceptions.some(ex => ex.type === 'customer_dispute')) && (
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>অথবা শুধু কাস্টমার রিপোর্ট ডিলিট করুন (Delete Report Only)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    অর্ডারটি বজায় থাকবে। শুধুমাত্র কাস্টমারের করা অভিযোগটি মুছে যাবে এবং আটকে থাকা পে-আউট আনলক হবে।
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomerReport(deleteConfirmItem)}
                    disabled={deletingEntireOrder || deletingDispute}
                    className="w-full py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {deletingDispute ? (
                      <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>শুধু কাস্টমার রিপোর্ট ডিলিট করুন</span>
                  </button>
                </div>
              )}
            </div>

            {/* Cancel Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                disabled={deletingEntireOrder || deletingDispute}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                বাতিল (Cancel)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
