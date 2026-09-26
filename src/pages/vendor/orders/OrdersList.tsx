import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { rtdbGet, rtdbSet, rtdbUpdate, rtdbPush, rtdbList } from '../../../lib/rtdb';
import VendorLayout from '../../../components/layout/VendorLayout';
import { 
  Search, Filter, Eye, Clock, CheckCircle, Package, Truck, 
  CheckCircle2, XCircle, RefreshCcw, Download, Calendar, Check, X,
  ExternalLink, Link as LinkIcon, Copy, AlertTriangle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getCourierTrackingUrl, calculateOrderPaymentBreakdown } from '../../../services/vendorPayoutService';
import { getVendorWalletBalances, confirmVendorResellerOrder } from '../../../services/vendorResellerOrderService';
import CourierVerificationModal from '../../../components/vendor/CourierVerificationModal';
import VendorCancelOrderModal from '../../../components/vendor/VendorCancelOrderModal';

export default function OrdersList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Courier & Tracking Modal State
  const [courierModalOpen, setCourierModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<any | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const handleCopyCustomer = async (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const name = order.shippingAddress?.name || order.customerName || 'Customer';
    const mobile = order.shippingAddress?.mobile || order.shippingAddress?.phone || order.customerPhone || '';
    const altMobile = order.shippingAddress?.alternativeMobile || order.shippingAddress?.altPhone || '';
    const district = order.shippingAddress?.district || '';
    const upazila = order.shippingAddress?.upazila || order.shippingAddress?.thana || '';
    const area = order.shippingAddress?.area || '';
    const fullAddress = order.shippingAddress?.fullAddress || order.shippingAddress?.address || '';
    const notes = order.shippingAddress?.notes || order.shippingAddress?.additionalNotes || '';
    
    const breakdown = calculateOrderPaymentBreakdown(order);
    const grandTotal = breakdown.grandTotal;
    const advanceAmount = breakdown.advanceAmount;
    const codAmount = breakdown.codAmount;
    const isFullPayment = breakdown.isFullPayment;

    const lines: string[] = [
      `নাম: ${name}`,
      `মোবাইল: ${mobile}`
    ];
    if (altMobile) lines.push(`বিকল্প মোবাইল: ${altMobile}`);
    if (district) lines.push(`জেলা: ${district}`);
    if (upazila) lines.push(`থানা/উপজেলা: ${upazila}`);
    if (area) lines.push(`এলাকা: ${area}`);
    if (fullAddress) lines.push(`সম্পূর্ণ ঠিকানা: ${fullAddress}`);
    if (notes) lines.push(`নোট: ${notes}`);
    lines.push(`মোট অর্ডার মূল্য (পণ্য + ডেলিভারি): ৳${grandTotal}`);
    lines.push(`অগ্রিম পরিশোধ (Advance Paid): ৳${advanceAmount}${order.isFullPayment || advanceAmount >= grandTotal ? ' (সম্পূর্ণ পরিশোধিত)' : ''}`);
    lines.push(`ক্যাশ অন ডেলিভারি (বাকি টাকা): ${codAmount === 0 ? '০ টাকা' : `৳${codAmount}`}`);
    const orderNum = order.orderId || order.id;
    if (orderNum) lines.push(`অর্ডার নম্বর: #${orderNum}`);

    const text = lines.join('\n');
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        success = true;
      }
    } catch (err) {
      console.warn('Clipboard write failed', err);
    }

    if (!success) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (e) {
        console.error('Fallback copy failed', e);
      }
    }

    if (success) {
      setCopiedOrderId(order.id);
      toast.success('কাস্টমারের সকল তথ্য কপি হয়েছে!');
      setTimeout(() => setCopiedOrderId(null), 2000);
    } else {
      toast.error('কপি করা সম্ভব হয়নি।');
    }
  };
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [sortBy, setSortBy] = useState('Newest');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    accepted: 0,
    shipped: 0,
    inTransit: 0,
    outForDelivery: 0,
    delivered: 0,
    rejected: 0,
    cancelled: 0,
  });

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    try {
      const [vOrdersList, mainOrdersList] = await Promise.all([
        rtdbList<any>('vendor_orders', (item) => item.vendorId === user.uid),
        rtdbList<any>('orders', (item) => item.vendorId === user.uid || (item.items && item.items.some((i: any) => i.vendorId === user.uid)))
      ]);

      const items: any[] = vOrdersList.map(v => {
        const vData = { id: v.id, ...v.data };
        const breakdown = calculateOrderPaymentBreakdown(vData);

        const mainOrder = mainOrdersList.find(m => m.id === vData.orderId || m.id === vData.mainOrderId || m.data?.orderId === vData.orderId);
        const isDelivered = 
          vData.status === 'Delivered' || 
          vData.vendorStatus === 'Delivered' ||
          mainOrder?.data?.status === 'Delivered' || 
          mainOrder?.data?.vendorStatus === 'Delivered' ||
          ((vData.reviewSubmitted || vData.reviewCompleted || mainOrder?.data?.reviewSubmitted || mainOrder?.data?.reviewCompleted) && (breakdown.isCod || mainOrder?.data?.paymentMethod === 'cod'));

        return {
          ...vData,
          status: isDelivered ? 'Delivered' : (vData.status || mainOrder?.data?.status || 'Pending'),
          vendorStatus: isDelivered ? 'Delivered' : (vData.vendorStatus || mainOrder?.data?.vendorStatus || vData.status || 'Pending'),
          itemsPrice: breakdown.itemsPrice,
          deliveryCharge: breakdown.deliveryCharge,
          grandTotal: breakdown.grandTotal,
          advancePaymentAmount: breakdown.advanceAmount,
          paidAmount: breakdown.advanceAmount,
          codAmount: breakdown.codAmount,
          isFullPayment: breakdown.isFullPayment
        };
      });

      mainOrdersList.forEach(({ id: docId, data: oData }) => {
        if (!items.some(it => it.orderId === docId || it.id === docId || it.mainOrderId === docId)) {
          const vItems = (oData.items || []).filter((it: any) => !it.vendorId || it.vendorId === user.uid);
          const breakdown = calculateOrderPaymentBreakdown(oData);

          items.push({
            id: docId,
            orderId: oData.orderId || docId,
            mainOrderId: docId,
            vendorId: user.uid,
            customerId: oData.userId,
            customerName: oData.shippingAddress?.name || 'Customer',
            customerEmail: oData.shippingAddress?.email || '',
            customerPhone: oData.shippingAddress?.mobile || '',
            itemsCount: vItems.length || (oData.items || []).length,
            itemsPrice: breakdown.itemsPrice,
            subtotal: breakdown.itemsPrice || oData.total,
            deliveryCharge: breakdown.deliveryCharge,
            grandTotal: breakdown.grandTotal,
            advancePaymentAmount: breakdown.advanceAmount,
            paidAmount: breakdown.advanceAmount,
            codAmount: breakdown.codAmount,
            isFullPayment: breakdown.isFullPayment,
            paymentMethod: oData.paymentMethod,
            paymentStatus: oData.paymentStatus,
            status: (oData.status === 'Delivered' || ((oData.reviewSubmitted || oData.reviewCompleted) && (breakdown.isCod || oData.paymentGateway === 'Cash on Delivery'))) ? 'Delivered' : (oData.status || 'Pending'),
            vendorStatus: (oData.status === 'Delivered' || oData.vendorStatus === 'Delivered' || ((oData.reviewSubmitted || oData.reviewCompleted) && (breakdown.isCod || oData.paymentGateway === 'Cash on Delivery'))) ? 'Delivered' : (oData.vendorStatus || oData.status || 'Pending'),
            courierName: oData.courierName || '',
            trackingNumber: oData.trackingNumber || oData.trackingId || '',
            trackingId: oData.trackingNumber || oData.trackingId || '',
            trackingUrl: oData.trackingUrl || '',
            createdAt: oData.createdAt || Date.now(),
            shippingAddress: oData.shippingAddress,
            isFromMainOrders: true
          });
        }
      });

      setOrders(items);
      
      // Calculate stats
      const s = {
        total: items.length,
        pending: items.filter(i => i.status === 'Pending' || i.status === 'Confirmed' || (!['Accepted', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered', 'Cancelled', 'Refunded', 'Rejected', 'Returned'].includes(i.status) && !i.acceptedAt)).length,
        accepted: items.filter(i => i.status === 'Accepted').length,
        shipped: items.filter(i => i.status === 'Shipped').length,
        inTransit: items.filter(i => i.status === 'In Transit').length,
        outForDelivery: items.filter(i => i.status === 'Out for Delivery').length,
        delivered: items.filter(i => i.status === 'Delivered').length,
        rejected: items.filter(i => i.status === 'Rejected').length,
        cancelled: items.filter(i => ['Cancelled', 'Refunded'].includes(i.status)).length,
      };
      setStats(s);
    } catch (error) {
      console.error("Error fetching orders from RTDB", error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const openCourierModal = (order: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isReseller = Boolean(order.isResellerOrder || order.resellerId || order.profitStatus || order.priceSnapshot?.resellerProfit);
    const isConfirmed = order.vendorOrderStatus === 'CONFIRMED' || order.profitStatus === 'LOCKED';
    if (isReseller && !isConfirmed) {
      toast.error('রিসেলার অর্ডারের ক্ষেত্রে ট্র্যাকিং লিংক দেওয়ার পূর্বে অবশ্যই অর্ডার কনফার্ম করতে হবে।');
      navigate(`/vendor/orders/${order.id}`);
      return;
    }
    setSelectedOrder(order);
    setCourierModalOpen(true);
  };

  const handleAcceptOrder = async (order: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!order || !user) return;

    // Reseller Order Eligibility Check & Atomic Confirmation with Profit Lock
    const isReseller = Boolean(order.isResellerOrder || order.resellerId || order.profitStatus || order.priceSnapshot?.resellerProfit);
    if (isReseller) {
      setProcessingId(order.id);
      try {
        const res = await confirmVendorResellerOrder(order.id, user.uid);
        if (!res.success) {
          toast.error(res.message || 'অর্ডার কনফার্ম করা সম্ভব হয়নি।');
          if (res.error === 'INSUFFICIENT_WALLET_BALANCE') {
            navigate(`/vendor/orders/${order.id}`);
          }
          return;
        }

        toast.success(`অর্ডার #${order.orderId?.substring(0, 8)} সফলভাবে কনফার্ম করা হয়েছে এবং রিসেলার প্রফিট লক করা হয়েছে!`);
        await fetchOrders();
        try {
          window.dispatchEvent(new CustomEvent('vendor_order_updated'));
          window.dispatchEvent(new CustomEvent('reseller_profit_updated'));
        } catch (_) {}
        setSelectedOrder({ ...order, status: 'Accepted', vendorOrderStatus: 'CONFIRMED', profitStatus: 'LOCKED' });
        setCourierModalOpen(true);
        return;
      } catch (error: any) {
        console.error("Failed to accept reseller order:", error);
        toast.error(error.message || "অর্ডার গ্রহণ করতে ব্যর্থ হয়েছে");
        return;
      } finally {
        setProcessingId(null);
      }
    }

    setProcessingId(order.id);
    try {
      const mainOrderId = order.mainOrderId || order.orderId || order.id;
      const now = Date.now();

      await Promise.allSettled([
        rtdbUpdate(`vendor_orders/${order.id}`, {
          status: 'Accepted',
          acceptedAt: now,
          updatedAt: now
        }),
        rtdbUpdate(`orders/${mainOrderId}`, {
          status: 'Accepted',
          vendorStatus: 'Accepted',
          acceptedAt: now,
          updatedAt: now
        }),
        rtdbPush('order_status_logs', {
          orderId: order.id,
          mainOrderId: mainOrderId,
          vendorId: user.uid,
          oldStatus: order.status || 'Pending',
          newStatus: 'Accepted',
          note: 'Order accepted by vendor. Awaiting courier tracking link.',
          timestamp: now
        })
      ]);

      toast.success(`অর্ডার #${order.orderId?.substring(0, 8)} গ্রহণ করা হয়েছে! এখন কুরিয়ার ট্র্যাকিং লিংক যুক্ত করুন।`);
      await fetchOrders();
      // Prompt vendor to add courier link immediately
      setSelectedOrder({ ...order, status: 'Accepted' });
      setCourierModalOpen(true);
    } catch (error) {
      console.error("Failed to accept order:", error);
      toast.error("অর্ডার গ্রহণ করতে ব্যর্থ হয়েছে");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectOrder = async (order: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) return;
    
    const confirmReject = window.confirm(`Are you sure you want to reject Order #${order.orderId?.substring(0, 8)}?`);
    if (!confirmReject) return;

    setProcessingId(order.id);
    try {
      const mainOrderId = order.mainOrderId || order.orderId || order.id;
      
      // 1. Update vendor_orders and main orders in RTDB
      await Promise.allSettled([
        rtdbUpdate(`vendor_orders/${order.id}`, {
          status: 'Rejected',
          rejectedAt: Date.now(),
          updatedAt: Date.now()
        }),
        rtdbUpdate(`orders/${mainOrderId}`, {
          status: 'Rejected',
          vendorStatus: 'Rejected',
          rejectedAt: Date.now(),
          updatedAt: Date.now()
        }),
        rtdbPush('order_status_logs', {
          orderId: order.id,
          mainOrderId: mainOrderId,
          vendorId: user.uid,
          oldStatus: order.status || 'Pending',
          newStatus: 'Rejected',
          note: 'Order rejected by vendor.',
          timestamp: Date.now()
        })
      ]);

      // Update local state
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Rejected' } : o));
      setStats(prev => ({
        ...prev,
        pending: Math.max(0, prev.pending - 1),
        rejected: prev.rejected + 1
      }));

      toast.error(`Order #${order.orderId?.substring(0, 8)} Rejected`);
    } catch (error) {
      console.error("Failed to reject order:", error);
      toast.error("Failed to reject order");
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Pending': return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'Accepted': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'Shipped': return 'bg-sky-100 text-sky-800 border border-sky-200';
      case 'In Transit': return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      case 'Out for Delivery': return 'bg-cyan-100 text-cyan-800 border border-cyan-200';
      case 'Delivered': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'Rejected': return 'bg-red-100 text-red-800 border border-red-200';
      case 'Cancelled': return 'bg-red-100 text-red-800 border border-red-200';
      case 'Refunded': return 'bg-gray-100 text-gray-800 border border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'Pending': return <Clock className="w-3.5 h-3.5" />;
      case 'Accepted': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case 'Shipped': return <Truck className="w-3.5 h-3.5 text-sky-600" />;
      case 'In Transit': return <Truck className="w-3.5 h-3.5 text-indigo-600" />;
      case 'Out for Delivery': return <Truck className="w-3.5 h-3.5 text-cyan-600" />;
      case 'Delivered': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case 'Rejected': return <XCircle className="w-3.5 h-3.5 text-red-600" />;
      case 'Cancelled': return <XCircle className="w-3.5 h-3.5 text-red-600" />;
      default: return null;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      (order.orderId?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customerName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.courierName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.trackingId?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'All' 
      || (statusFilter === 'Pending' 
        ? (order.status === 'Pending' || order.status === 'Confirmed' || (!['Accepted', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered', 'Cancelled', 'Refunded', 'Rejected', 'Returned'].includes(order.status) && !order.acceptedAt)) 
        : order.status === statusFilter);
    
    let matchesDate = true;
    if (dateFilter !== 'All Time' && order.createdAt) {
      const orderDate = new Date(order.createdAt);
      const now = new Date();
      if (dateFilter === 'Today') {
        matchesDate = orderDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'This Week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = orderDate >= weekAgo;
      } else if (dateFilter === 'This Month') {
        matchesDate = orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  }).sort((a, b) => {
    const tA = a.createdAt || 0;
    const tB = b.createdAt || 0;
    return sortBy === 'Newest' ? tB - tA : tA - tB;
  });

  const allStatuses = ['All', 'Pending', 'Accepted', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered', 'Rejected', 'Cancelled'];
  const dateFilters = ['All Time', 'Today', 'This Week', 'This Month'];
  const sortOptions = ['Newest', 'Oldest'];

  const popularCouriers = ['Steadfast', 'RedX', 'Pathao', 'Sundarban', 'eCourier', 'Paperfly', 'SA Paribahan', 'DHL', 'FedEx'];

  return (
    <VendorLayout>
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Accept, reject, and process customer orders with Courier & Tracking.</p>
        </div>
      </div>

      {/* Compact Stats Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 sm:gap-2.5 mb-3 sm:mb-5">
        <div className="bg-white rounded-xl p-2 sm:p-3 border border-gray-100 shadow-sm text-center sm:text-left">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 mb-0.5">Total</p>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">{stats.total}</h3>
        </div>
        <div className="bg-white rounded-xl p-2 sm:p-3 border border-yellow-100 bg-yellow-50/30 shadow-sm text-center sm:text-left">
          <p className="text-[10px] sm:text-xs font-medium text-yellow-700 mb-0.5">Pending</p>
          <h3 className="text-base sm:text-lg font-bold text-yellow-700 leading-tight">{stats.pending}</h3>
        </div>
        <div className="bg-white rounded-xl p-2 sm:p-3 border border-emerald-100 bg-emerald-50/30 shadow-sm text-center sm:text-left">
          <p className="text-[10px] sm:text-xs font-medium text-emerald-700 mb-0.5">Accepted</p>
          <h3 className="text-base sm:text-lg font-bold text-emerald-700 leading-tight">{stats.accepted}</h3>
        </div>
        <div className="bg-white rounded-xl p-2 sm:p-3 border border-sky-100 bg-sky-50/30 shadow-sm text-center sm:text-left">
          <p className="text-[10px] sm:text-xs font-medium text-sky-700 mb-0.5">Shipped</p>
          <h3 className="text-base sm:text-lg font-bold text-sky-700 leading-tight">{stats.shipped}</h3>
        </div>
        <div className="bg-white rounded-xl p-2 sm:p-3 border border-indigo-100 bg-indigo-50/30 shadow-sm text-center sm:text-left">
          <p className="text-[10px] sm:text-xs font-medium text-indigo-700 mb-0.5">In Transit</p>
          <h3 className="text-base sm:text-lg font-bold text-indigo-700 leading-tight">{stats.inTransit}</h3>
        </div>
        <div className="bg-white rounded-xl p-2 sm:p-3 border border-cyan-100 bg-cyan-50/30 shadow-sm text-center sm:text-left">
          <p className="text-[10px] sm:text-xs font-medium text-cyan-700 mb-0.5">Out for Delivery</p>
          <h3 className="text-base sm:text-lg font-bold text-cyan-700 leading-tight">{stats.outForDelivery}</h3>
        </div>
        <div className="bg-white rounded-xl p-2 sm:p-3 border border-emerald-100 bg-emerald-50/30 shadow-sm text-center sm:text-left">
          <p className="text-[10px] sm:text-xs font-medium text-emerald-700 mb-0.5">Delivered</p>
          <h3 className="text-base sm:text-lg font-bold text-emerald-700 leading-tight">{stats.delivered}</h3>
        </div>
        <div className="bg-white rounded-xl p-2 sm:p-3 border border-red-100 bg-red-50/30 shadow-sm text-center sm:text-left">
          <p className="text-[10px] sm:text-xs font-medium text-red-600 mb-0.5">Rejected</p>
          <h3 className="text-base sm:text-lg font-bold text-red-600 leading-tight">{stats.rejected}</h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        {/* Filters */}
        <div className="p-2.5 sm:p-4 border-b border-gray-200 flex flex-col lg:flex-row gap-2 sm:gap-3 justify-between items-center bg-gray-50/70">
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search Order ID or Customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 sm:py-2 border border-gray-300 rounded-xl bg-white text-gray-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto justify-end">
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-xl bg-white text-gray-900 px-2 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20 w-full font-medium"
              >
                {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-gray-300 rounded-xl bg-white text-gray-900 px-2 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20 w-full"
              >
                {dateFilters.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-xl bg-white text-gray-900 px-2 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20 flex-1 sm:flex-initial"
            >
              {sortOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* Mobile Order Cards (Visible on mobile) */}
        <div className="block md:hidden divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 animate-pulse space-y-2">
                <div className="h-3.5 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-100 rounded w-2/3"></div>
              </div>
            ))
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-900 mb-0.5">No orders found</p>
              <p className="text-xs">Try adjusting your search or filters.</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isPending = order.status === 'Pending' || order.status === 'Confirmed' || (!['Accepted', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered', 'Cancelled', 'Refunded', 'Rejected', 'Returned'].includes(order.status) && !order.acceptedAt);
              const isProcessing = processingId === order.id;

              return (
                <div key={order.id} className="p-3 hover:bg-gray-50/80 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-900">#{order.orderId?.substring(0, 8)}</span>
                      {Boolean(order.isResellerOrder || order.resellerId || order.profitStatus) && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                          Reseller
                        </span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 inline-flex items-center gap-1 text-[10px] font-bold rounded-full ${getStatusColor(order.status || 'Pending')}`}>
                      {getStatusIcon(order.status || 'Pending')}
                      {order.status || 'Pending'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate max-w-[150px] font-medium text-gray-800">{order.customerName || 'Guest'}</span>
                      <button
                        type="button"
                        onClick={(e) => handleCopyCustomer(order, e)}
                        title="কাস্টমার তথ্য কপি করুন"
                        className="p-1 hover:bg-sky-50 text-slate-400 hover:text-sky-600 rounded transition-colors shrink-0 cursor-pointer"
                      >
                        {copiedOrderId === order.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}</span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-black text-slate-900">৳{order.grandTotal?.toFixed(2) || '0.00'}</span>
                        <span className="text-[10px] text-gray-400">({order.itemsCount || 1} items)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                        <span className="text-emerald-700 font-semibold">অগ্রিম: ৳{(order.advancePaymentAmount ?? 0).toFixed(0)}</span>
                        {order.codAmount !== undefined && order.codAmount > 0 ? (
                          <span className="text-amber-700 font-semibold">• বাকি: ৳{order.codAmount.toFixed(0)}</span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">• পেইড</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isPending ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancelModalOrder(order);
                            }}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Cancel Order"
                          >
                            <X className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                          <button
                            onClick={(e) => handleAcceptOrder(order, e)}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                            title="Accept Order"
                          >
                            <Check className="w-3 h-3" />
                            <span>Accept</span>
                          </button>
                        </>
                      ) : order.courierVerificationStatus === 'Pending — Admin Review' ? (
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold cursor-default"
                          title="কুরিয়ার ট্র্যাকিং লিংক জমা দেওয়া হয়েছে (রিভিউ পেন্ডিং)"
                        >
                          <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                          <span>🟡 Review</span>
                        </span>
                      ) : (order.courierVerificationStatus === 'Verified' || order.courierAdminApproved) ? (
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-black cursor-default"
                          title="কুরিয়ার ট্র্যাকিং লিংক অনুমোদিত ও ভেরিফাইড"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>🟢 Verified</span>
                        </span>
                      ) : order.courierVerificationStatus === 'Rejected' ? (
                        <button
                          onClick={(e) => openCourierModal(order, e)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg border border-rose-200 transition-colors cursor-pointer"
                          title="অ্যাডমিন পূর্বের লিংক বাতিল করেছেন, নতুন লিংক দিন"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>🔄 নতুন লিংক</span>
                        </button>
                      ) : !['Cancelled', 'Refunded', 'Delivered'].includes(order.status) ? (
                        Boolean(order.isResellerOrder || order.resellerId || order.profitStatus || order.priceSnapshot?.resellerProfit) && order.vendorOrderStatus !== 'CONFIRMED' && order.profitStatus !== 'LOCKED' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptOrder(order, e);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                            title="রিসেলার অর্ডার কনফার্ম করুন"
                          >
                            <Check className="w-3 h-3" />
                            <span>কনফার্ম করুন</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => openCourierModal(order, e)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary-main hover:bg-sky-600 text-white text-[11px] font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                            title="কুরিয়ার ট্র্যাকিং লিংক যুক্ত করুন"
                          >
                            <Truck className="w-3 h-3" />
                            <span>কুরিয়ার লিংক</span>
                          </button>
                        )
                      ) : (
                        order.courierName ? (
                          <span className="text-[11px] font-semibold text-slate-500">
                            🚚 {order.courierName}
                          </span>
                        ) : null
                      )}

                      <Link 
                        to={`/vendor/orders/${order.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 hover:bg-primary-main hover:text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </Link>
                    </div>
                  </div>
                  {order.courierName && (
                    <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Truck className="w-3 h-3 text-primary-main" /> {order.courierName}
                        {order.trackingNumber && <span className="text-gray-400">({order.trackingNumber})</span>}
                      </span>
                      {order.trackingUrl && (
                        <a 
                          href={order.trackingUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary-main hover:underline flex items-center gap-0.5 font-bold"
                        >
                          Track Link <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table (Visible on md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-200">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order ID & Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Courier & Tracking</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                // Skeleton loading
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-3.5 bg-gray-200 rounded w-20 mb-1"></div><div className="h-2.5 bg-gray-100 rounded w-24"></div></td>
                    <td className="px-4 py-3"><div className="h-3.5 bg-gray-200 rounded w-28 mb-1"></div><div className="h-2.5 bg-gray-100 rounded w-32"></div></td>
                    <td className="px-4 py-3"><div className="h-3.5 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-4 py-3"><div className="h-3.5 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-16"></div></td>
                    <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded-full w-20"></div></td>
                    <td className="px-4 py-3 text-right"><div className="h-6 bg-gray-200 rounded w-16 ml-auto"></div></td>
                  </tr>
                ))
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <Package className="w-10 h-10 mb-2 opacity-40" />
                      <p className="text-base font-medium">No orders found</p>
                      <p className="text-xs mt-0.5">Try adjusting your filters or search term.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isPending = order.status === 'Pending' || order.status === 'Confirmed' || (!['Accepted', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered', 'Cancelled', 'Refunded', 'Rejected', 'Returned'].includes(order.status) && !order.acceptedAt);
                  const isProcessing = processingId === order.id;

                  return (
                    <tr key={order.id} className="bg-white hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900">#{order.orderId?.substring(0, 8)}</span>
                          {Boolean(order.isResellerOrder || order.resellerId || order.profitStatus) && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                              Reseller
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="text-xs font-medium text-gray-900">{order.customerName || 'Guest'}</div>
                          <button
                            type="button"
                            onClick={(e) => handleCopyCustomer(order, e)}
                            title="কাস্টমারের তথ্য কপি করুন"
                            className="p-1 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded transition-colors cursor-pointer"
                          >
                            {copiedOrderId === order.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="text-[11px] text-gray-500">{order.customerPhone || order.customerEmail || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {order.courierName ? (
                          <div className="text-xs space-y-0.5">
                            <div className="font-semibold text-slate-800 flex items-center gap-1">
                              <Truck className="w-3 h-3 text-primary-main" /> {order.courierName}
                            </div>
                            {order.trackingNumber && (
                              <div className="text-[11px] font-mono text-gray-500">ID: {order.trackingNumber}</div>
                            )}
                            {order.trackingUrl && (
                              <a 
                                href={order.trackingUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[11px] text-primary-main hover:underline inline-flex items-center gap-0.5 font-medium"
                              >
                                Tracking Link <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs font-bold text-gray-900">৳{order.grandTotal?.toFixed(2) || '0.00'}</div>
                        <div className="text-[10px] text-emerald-700 font-semibold">
                          অগ্রিম: ৳{(order.advancePaymentAmount ?? 0).toFixed(0)}
                        </div>
                        {order.codAmount !== undefined && order.codAmount > 0 ? (
                          <div className="text-[10px] text-amber-700 font-semibold">বাকি (COD): ৳{order.codAmount.toFixed(0)}</div>
                        ) : (
                          <div className="text-[10px] text-emerald-600 font-medium">সম্পূর্ণ পরিশোধিত</div>
                        )}
                        <div className="text-[9px] text-gray-400">{order.itemsCount || 1} items</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 inline-flex text-[11px] leading-4 font-semibold rounded-full ${
                          order.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' : 
                          order.paymentStatus === 'Failed' ? 'bg-red-100 text-red-800' : 
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.paymentStatus || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 inline-flex items-center gap-1 text-[11px] font-bold rounded-full ${getStatusColor(order.status || 'Pending')}`}>
                          {getStatusIcon(order.status || 'Pending')}
                          {order.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-medium">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCancelModalOrder(order);
                                }}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                                title="Cancel Order"
                              >
                                <X className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                              <button
                                onClick={(e) => handleAcceptOrder(order, e)}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                                title="Accept Order"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Accept
                              </button>
                            </>
                          ) : order.courierVerificationStatus === 'Pending — Admin Review' ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold shadow-2xs cursor-default"
                              title="কুরিয়ার ট্র্যাকিং লিংক জমা দেওয়া হয়েছে (অ্যাডমিন রিভিউ পেন্ডিং - লক করা)"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                              <span>🟡 Review</span>
                            </span>
                          ) : (order.courierVerificationStatus === 'Verified' || order.courierAdminApproved) ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-black shadow-2xs cursor-default"
                              title="কুরিয়ার ট্র্যাকিং ভেরিফাইড (লক করা)"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>🟢 Verified</span>
                            </span>
                          ) : order.courierVerificationStatus === 'Rejected' ? (
                            <button
                              onClick={(e) => openCourierModal(order, e)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition-colors cursor-pointer"
                              title="অ্যাডমিন পূর্বের লিংক বাতিল করেছেন, নতুন সঠিক লিংক দিন"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>🔄 নতুন লিংক</span>
                            </button>
                          ) : !['Cancelled', 'Refunded', 'Delivered'].includes(order.status) ? (
                            Boolean(order.isResellerOrder || order.resellerId || order.profitStatus || order.priceSnapshot?.resellerProfit) && order.vendorOrderStatus !== 'CONFIRMED' && order.profitStatus !== 'LOCKED' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAcceptOrder(order, e);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                                title="রিসেলার অর্ডার কনফার্ম করুন"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>কনফার্ম করুন</span>
                              </button>
                            ) : (
                              <button
                                onClick={(e) => openCourierModal(order, e)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-main hover:bg-sky-600 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                                title="কুরিয়ার ট্র্যাকিং লিংক যুক্ত করুন"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>কুরিয়ার লিংক</span>
                              </button>
                            )
                          ) : (
                            order.courierName ? (
                              <span className="text-[11px] font-semibold text-slate-500">
                                🚚 {order.courierName}
                              </span>
                            ) : null
                          )}
                          <Link 
                            to={`/vendor/orders/${order.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-primary-main hover:text-white text-gray-700 rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Courier Verification Modal (Submits to Admin Review Queue) */}
      <CourierVerificationModal
        isOpen={courierModalOpen && !!selectedOrder}
        onClose={() => {
          setCourierModalOpen(false);
          setSelectedOrder(null);
          fetchOrders();
        }}
        order={selectedOrder}
        onSuccess={() => {
          setCourierModalOpen(false);
          setSelectedOrder(null);
          fetchOrders();
        }}
      />

      {/* Vendor Cancel Order Modal (with Notice & Refund Flow) */}
      <VendorCancelOrderModal
        isOpen={Boolean(cancelModalOrder)}
        onClose={() => setCancelModalOrder(null)}
        order={cancelModalOrder}
        vendorId={user?.uid || ''}
        onSuccess={() => {
          setCancelModalOrder(null);
          fetchOrders();
        }}
      />
    </VendorLayout>
  );
}

