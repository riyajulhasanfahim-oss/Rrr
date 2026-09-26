import React, { useEffect, useState } from 'react';
import { rtdbList, rtdbSubscribe, rtdbGet } from '../../lib/rtdb';
import { useAuth } from '../../context/AuthContext';
import { 
  ShieldAlert, Search, Filter, RefreshCw, CheckCircle, XCircle, 
  ExternalLink, Eye, Check, X, Clock, MessageSquare, Image as ImageIcon,
  DollarSign, Store, User, ArrowRight, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { refundCustomerDispute, rejectCustomerDisputeAndRelease } from '../../services/vendorPayoutService';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../../utils/imageUrl';

export default function AdminDisputes() {
  const { userData } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All'); // All, Under Review, Resolved - Refunded, Rejected
  
  // Resolution Action Modal
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [actionType, setActionType] = useState<'refund' | 'reject' | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Expanded cards state for detailed view
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchDisputeOrders();

    // Subscribe to RTDB in real time so admin sees newly submitted disputes instantly
    const unsubOrders = rtdbSubscribe('orders', () => {
      fetchDisputeOrders(false);
    });

    const unsubDisputes = rtdbSubscribe('disputes', () => {
      fetchDisputeOrders(false);
    });

    return () => {
      unsubOrders();
      unsubDisputes();
    };
  }, []);

  const fetchDisputeOrders = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch all orders from Realtime Database
      const allOrdersSnap = await rtdbList<any>('orders');
      
      // 2. Fetch all dedicated disputes from Realtime Database
      const allDisputesSnap = await rtdbList<any>('disputes');
      
      const ordersMap = new Map<string, any>();

      // Populate with all orders that have dispute or dispute status
      allOrdersSnap.forEach(item => {
        const o = { id: item.id, ...item.data };
        if (
          o.dispute || 
          o.vendorPayoutStatus === 'Disputed' || 
          o.status === 'Dispute' ||
          o.vendorPayoutStatus === 'Refunded' ||
          (o.dispute && o.dispute.status)
        ) {
          const key = o.orderId || o.id;
          ordersMap.set(key, o);
        }
      });

      // Merge with dedicated disputes node to ensure any dispute record is included
      allDisputesSnap.forEach(dispItem => {
        const d = dispItem.data || {};
        const key = d.orderId || dispItem.id || d.id;
        if (ordersMap.has(key)) {
          const existing = ordersMap.get(key);
          ordersMap.set(key, {
            ...existing,
            ...d,
            dispute: {
              ...(existing.dispute || {}),
              ...(d.dispute || {})
            }
          });
        } else {
          ordersMap.set(key, {
            id: dispItem.id,
            orderId: d.orderId || dispItem.id,
            ...d
          });
        }
      });

      const disputeOrders = Array.from(ordersMap.values()).sort((a, b) => {
        const timeA = Number(a.dispute?.createdAt || a.updatedAt || a.createdAt || 0);
        const timeB = Number(b.dispute?.createdAt || b.updatedAt || b.createdAt || 0);
        return timeB - timeA;
      });
      
      setOrders(disputeOrders);
    } catch (err) {
      console.error('Error fetching dispute orders from RTDB:', err);
      toast.error('Failed to load dispute orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const handleOpenActionModal = (order: any, type: 'refund' | 'reject') => {
    setSelectedOrder(order);
    setActionType(type);
    setResolutionNote(type === 'refund' ? 'Customer dispute verified. Refund approved.' : 'Dispute investigated. Rejected and payment released to seller.');
  };

  const handleConfirmAction = async () => {
    if (!selectedOrder || !actionType) return;
    setSubmittingAction(true);

    try {
      if (actionType === 'refund') {
        const res = await refundCustomerDispute(selectedOrder, userData, resolutionNote);
        if (res.success) {
          toast.success(res.message);
          setSelectedOrder(null);
          setActionType(null);
          fetchDisputeOrders(true);
        } else {
          toast.error(res.message);
        }
      } else if (actionType === 'reject') {
        const res = await rejectCustomerDisputeAndRelease(selectedOrder, userData, resolutionNote);
        if (res.success) {
          toast.success(res.message);
          setSelectedOrder(null);
          setActionType(null);
          fetchDisputeOrders(true);
        } else {
          toast.error(res.message);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Metrics
  const activeCount = orders.filter(o => o.vendorPayoutStatus === 'Disputed' || o.status === 'Dispute' || o.dispute?.status === 'Under Review').length;
  const refundedCount = orders.filter(o => o.vendorPayoutStatus === 'Refunded' || o.status === 'Refunded' || o.dispute?.status === 'Resolved - Refunded').length;
  const rejectedCount = orders.filter(o => o.dispute?.status === 'Rejected' || o.dispute?.status === 'Resolved - Released').length;
  const totalDisputedAmount = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const filteredOrders = orders.filter(order => {
    const term = (searchTerm || '').trim().toLowerCase();
    const orderIdStr = String(order.orderId || order.id || '').toLowerCase();
    const customerName = String(order.shippingAddress?.name || order.customerName || '').toLowerCase();
    const phone = String(order.shippingAddress?.phone || order.shippingAddress?.mobile || order.customerPhone || '').toLowerCase();
    const reason = String(order.dispute?.reason || '').toLowerCase();
    const details = String(order.dispute?.details || '').toLowerCase();
    const userId = String(order.userId || order.customerId || '').toLowerCase();

    const matchesSearch = !term || 
      orderIdStr.includes(term) || 
      customerName.includes(term) ||
      phone.includes(term) ||
      reason.includes(term) ||
      details.includes(term) ||
      userId.includes(term);

    const disputeStatus = order.dispute?.status || (order.vendorPayoutStatus === 'Disputed' ? 'Under Review' : order.status);
    
    if (filterStatus === 'All') return matchesSearch;
    if (filterStatus === 'Under Review') {
      return matchesSearch && (order.vendorPayoutStatus === 'Disputed' || order.status === 'Dispute' || disputeStatus === 'Under Review' || disputeStatus === 'Open');
    }
    if (filterStatus === 'Resolved - Refunded') {
      return matchesSearch && (order.vendorPayoutStatus === 'Refunded' || order.status === 'Refunded' || disputeStatus === 'Resolved - Refunded');
    }
    if (filterStatus === 'Rejected') {
      return matchesSearch && (disputeStatus === 'Rejected' || disputeStatus === 'Resolved - Released');
    }

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dispute & Refund Management</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Review and resolve customer complaints, dispute claims, and refund requests
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchDisputeOrders(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-primary-main' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Disputes</p>
              <h3 className="text-2xl font-extrabold text-rose-600 mt-1">{activeCount}</h3>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-rose-700 mt-2 font-medium">Payouts currently on hold</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Refunds</p>
              <h3 className="text-2xl font-extrabold text-purple-600 mt-1">{refundedCount}</h3>
            </div>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Refunded to customers</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Disputes Rejected</p>
              <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">{rejectedCount}</h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Check className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Released to sellers</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Disputed Value</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">৳{totalDisputedAmount.toLocaleString()}</h3>
            </div>
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Across all recorded disputes</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Order ID, Customer, Phone, Reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main transition-all"
          />
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20 appearance-none font-medium"
            >
              <option value="All">All Dispute Statuses</option>
              <option value="Under Review">Active (Under Review)</option>
              <option value="Resolved - Refunded">Approved Refunds</option>
              <option value="Rejected">Rejected / Released</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dispute Orders List */}
      {loading ? (
        <div className="flex justify-center items-center h-64 bg-white rounded-2xl border border-slate-100">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-main" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Dispute Orders Found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            There are currently no orders matching your filter criteria. All payouts and customer orders are in normal status.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isDisputed = order.vendorPayoutStatus === 'Disputed' || order.status === 'Dispute' || order.dispute?.status === 'Under Review' || order.dispute?.status === 'Open';
            const isRefunded = order.vendorPayoutStatus === 'Refunded' || order.status === 'Refunded' || order.dispute?.status === 'Resolved - Refunded';
            const isRejected = order.dispute?.status === 'Rejected' || order.dispute?.status === 'Resolved - Released';
            const isExpanded = !!expandedOrders[order.id];

            const dispute = order.dispute || {};
            const proofImages = dispute.images || [];

            return (
              <div 
                key={order.id} 
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs overflow-hidden ${
                  isDisputed ? 'border-rose-300 ring-1 ring-rose-200' :
                  isRefunded ? 'border-purple-200' :
                  'border-slate-200'
                }`}
              >
                {/* Main Card Header */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 border-b border-slate-100">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isDisputed ? 'bg-rose-100 text-rose-700' :
                      isRefunded ? 'bg-purple-100 text-purple-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {isDisputed ? <ShieldAlert className="w-6 h-6" /> :
                       isRefunded ? <CheckCircle className="w-6 h-6" /> :
                       <Check className="w-6 h-6" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-base">Order #{order.orderId}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isDisputed ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                          isRefunded ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                          'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}>
                          {isDisputed ? '⚠️ Dispute Under Review' :
                           isRefunded ? '✓ Refund Approved' :
                           '✓ Dispute Rejected (Released)'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {order.createdAt ? format(new Date(order.createdAt), 'MMM dd, yyyy HH:mm') : ''}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <strong className="text-slate-800">{order.shippingAddress?.name || order.customerName || 'Customer'}</strong> ({order.shippingAddress?.mobile || order.shippingAddress?.phone || order.customerPhone || 'No phone'})
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 text-slate-400" />
                          <span>Vendor: <strong className="text-slate-800">{order.items?.[0]?.vendorName || order.vendorName || order.vendorId || 'Seller'}</strong></span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 justify-between lg:justify-end">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Order Total</span>
                      <span className="text-base font-extrabold text-slate-900">৳{Number(order.total || 0).toFixed(2)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpand(order.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        {isExpanded ? (
                          <><span>Hide Details</span><ChevronUp className="w-3.5 h-3.5" /></>
                        ) : (
                          <><span>View Dispute Details</span><ChevronDown className="w-3.5 h-3.5" /></>
                        )}
                      </button>

                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs transition-colors"
                        title="View Full Order"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Complaint Summary Always Visible */}
                <div className="p-4 sm:p-5 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    
                    {/* Left: Dispute Info */}
                    <div className="md:col-span-8 space-y-3">
                      <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            Dispute Reason: {dispute.reason || 'Problem reported by customer'}
                          </span>
                          {dispute.createdAt && (
                            <span className="text-[11px] text-rose-600">
                              Filed: {format(new Date(dispute.createdAt), 'MMM dd, yyyy HH:mm')}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-xs sm:text-sm text-slate-800 leading-relaxed bg-white p-3 rounded-lg border border-rose-100">
                          {dispute.details || 'No detailed description provided.'}
                        </p>
                      </div>

                      {/* Evidence / Proof Photos */}
                      {proofImages.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-primary-main" />
                            Customer Evidence Photos ({proofImages.length})
                          </p>
                          <div className="flex flex-wrap gap-2.5">
                            {proofImages.map((imgUrl: string, idx: number) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setPreviewImage(imgUrl)}
                                className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-200 hover:border-primary-main transition-all shadow-2xs"
                              >
                                <img
                                  referrerPolicy="no-referrer"
                                  src={imgUrl}
                                  alt={`Proof ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                  <Eye className="w-4 h-4" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Vendor Response section */}
                      {dispute.vendorResponse ? (
                        <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-teal-900">
                            <span className="flex items-center gap-1.5">
                              <Store className="w-3.5 h-3.5 text-teal-700" />
                              Vendor Response ({dispute.vendorResponse.respondedBy || 'Vendor'})
                            </span>
                            {dispute.vendorResponse.respondedAt && (
                              <span className="text-[10px] text-teal-600 font-normal">
                                {format(new Date(dispute.vendorResponse.respondedAt), 'MMM dd, yyyy HH:mm')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-800 bg-white p-2.5 rounded-lg border border-teal-100">
                            "{dispute.vendorResponse.text}"
                          </p>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Vendor has not submitted a response yet.</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Resolution Status & Admin Action Panel */}
                    <div className="md:col-span-4 flex flex-col justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Admin Resolution
                        </h4>

                        {isDisputed ? (
                          <div className="space-y-2">
                            <div className="p-2.5 bg-rose-100/80 rounded-lg text-xs text-rose-900 font-medium">
                              Vendor payout is currently frozen on HOLD pending your review.
                            </div>

                            <div className="space-y-2 pt-2">
                              <button
                                onClick={() => handleOpenActionModal(order, 'refund')}
                                className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4" />
                                <span>Approve Refund</span>
                              </button>

                              <button
                                onClick={() => handleOpenActionModal(order, 'reject')}
                                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-2"
                              >
                                <Check className="w-4 h-4" />
                                <span>Reject Dispute & Release</span>
                              </button>
                            </div>
                          </div>
                        ) : isRefunded ? (
                          <div className="p-3 bg-purple-100 rounded-xl text-xs text-purple-900 space-y-1">
                            <div className="font-bold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-purple-700" />
                              Refund Granted
                            </div>
                            <p className="text-[11px] text-purple-800">
                              Note: {dispute.resolutionNote || 'Refund approved by Admin'}
                            </p>
                            {dispute.resolvedBy && (
                              <p className="text-[10px] text-purple-600">
                                Handled by: {dispute.resolvedBy}
                              </p>
                            )}
                          </div>
                        ) : isRejected ? (
                          <div className="p-3 bg-emerald-100 rounded-xl text-xs text-emerald-900 space-y-1">
                            <div className="font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                              Dispute Rejected
                            </div>
                            <p className="text-[11px] text-emerald-800">
                              Note: {dispute.resolutionNote || 'Payout released to vendor'}
                            </p>
                            {dispute.resolvedBy && (
                              <p className="text-[10px] text-emerald-600">
                                Handled by: {dispute.resolvedBy}
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="pt-3 border-t border-slate-200 mt-3 flex justify-between items-center text-xs text-slate-500">
                        <span>Items: {order.items?.length || 0}</span>
                        <Link 
                          to={`/admin/orders/${order.id}`}
                          className="text-primary-main hover:text-sky-600 font-semibold flex items-center gap-1"
                        >
                          Order Details <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>

                  </div>

                  {/* Collapsible Expanded Order Items & Shipping details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                      <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ordered Products</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {order.items?.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200">
                            <img
                              referrerPolicy="no-referrer"
                              src={formatDirectImageUrl(item.image || item.thumbnail) || PLACEHOLDER_PRODUCT_IMAGE}
                              alt={item.name}
                              onError={(e) => handleProductImageError(e)}
                              className="w-12 h-12 rounded-lg object-cover bg-white shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                              <p className="text-[11px] text-slate-500">Qty: {item.quantity} × ৳{item.price}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-0.5">
                        <p><strong>Shipping Address:</strong> {order.shippingAddress?.fullAddress || order.shippingAddress?.street}</p>
                        <p>{[order.shippingAddress?.upazila, order.shippingAddress?.district, order.shippingAddress?.division].filter(Boolean).join(', ')}</p>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Action Confirmation Modal */}
      {selectedOrder && actionType && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100">
            <div className={`p-5 border-b flex justify-between items-center ${
              actionType === 'refund' ? 'bg-purple-50 text-purple-900 border-purple-100' : 'bg-emerald-50 text-emerald-900 border-emerald-100'
            }`}>
              <div className="flex items-center gap-2">
                {actionType === 'refund' ? <CheckCircle className="w-5 h-5 text-purple-700" /> : <Check className="w-5 h-5 text-emerald-700" />}
                <h3 className="font-bold text-base">
                  {actionType === 'refund' ? 'Approve Customer Refund' : 'Reject Dispute & Release Payout'}
                </h3>
              </div>
              <button 
                onClick={() => { setSelectedOrder(null); setActionType(null); }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 rounded-xl text-xs space-y-1 bg-slate-50 border border-slate-200">
                <p><strong>Order ID:</strong> #{selectedOrder.orderId}</p>
                <p><strong>Customer:</strong> {selectedOrder.shippingAddress?.name || 'Customer'}</p>
                <p><strong>Dispute Reason:</strong> {selectedOrder.dispute?.reason}</p>
                <p><strong>Total Amount:</strong> ৳{Number(selectedOrder.total || 0).toFixed(2)}</p>
              </div>

              {actionType === 'refund' ? (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900">
                  ⚠️ <strong>Refund Impact:</strong> Order status will be marked as Refunded. Vendor payout will be cancelled and will NOT be released to the vendor.
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                  ℹ️ <strong>Release Impact:</strong> Customer dispute will be closed. ৳{(selectedOrder.vendorPayoutAmount || selectedOrder.total || 0).toFixed(2)} will be released to the vendor's wallet balance.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Resolution Note
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={3}
                  required
                  placeholder="Enter reason or notes for this resolution..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-main/20 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setSelectedOrder(null); setActionType(null); }}
                  disabled={submittingAction}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  disabled={submittingAction}
                  className={`flex-1 py-2.5 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 ${
                    actionType === 'refund' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {submittingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{actionType === 'refund' ? 'Confirm Refund' : 'Confirm Release'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-white p-2 rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 bg-black/60 text-white hover:bg-black/80 p-2 rounded-full z-10 transition-colors"
            >
              ✕
            </button>
            <img
              referrerPolicy="no-referrer"
              src={previewImage}
              alt="Dispute Evidence Full Preview"
              className="max-h-[80vh] w-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
