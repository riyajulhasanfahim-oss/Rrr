import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { rtdbGet, rtdbUpdate } from '../lib/rtdb';
import { useAuth } from '../context/AuthContext';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { 
  ArrowLeft, Package, Clock, CheckCircle, CheckCircle2, XCircle, Truck, 
  MapPin, Printer, AlertTriangle, Loader2, ShieldCheck, ShieldAlert, 
  ExternalLink, Copy, Check, Navigation, Bike, Store, PackageCheck, 
  CheckCheck, Info, RefreshCw, Calendar, Phone, CreditCard, ChevronRight,
  Image as ImageIcon, Eye, Star, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { checkAndAutoReleaseVendorPayout, raiseCustomerDispute, calculateOrderPaymentBreakdown } from '../services/vendorPayoutService';
import { StorageManager } from '../services/storage/StorageManager';
import { fetchOrderById } from '../services/orderService';
import { isDeliveredStatus, hasUserReviewedProduct } from '../services/reviewService';
import { markCodOrderDelivered } from '../services/platformFeeService';
import ReviewModal from '../components/reviews/ReviewModal';
import ResellerProfitReviewModal from '../components/reseller/ResellerProfitReviewModal';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../utils/imageUrl';

export function getCourierTrackingUrl(courierName?: string, trackingNumber?: string, customUrl?: string): string {
  if (customUrl && customUrl.trim()) {
    const trimmed = customUrl.trim();
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  }
  if (!trackingNumber) return '';
  
  const cName = (courierName || '').toLowerCase().trim();
  const trk = encodeURIComponent(trackingNumber.trim());
  
  if (cName.includes('steadfast')) {
    return `https://steadfast.com.bd/t/${trk}`;
  }
  if (cName.includes('pathao')) {
    return `https://merchant.pathao.com/tracking?consignment_id=${trk}`;
  }
  if (cName.includes('redx')) {
    return `https://redx.com.bd/track-order/${trk}`;
  }
  if (cName.includes('paperfly')) {
    return `https://paperfly.com.bd/tracking?id=${trk}`;
  }
  if (cName.includes('ecourier') || cName.includes('e-courier')) {
    return `https://ecourier.com.bd/track?ref=${trk}`;
  }
  if (cName.includes('sundarban')) {
    return `https://sundarbancourierltd.com/track`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${courierName || 'Courier'} tracking ${trackingNumber}`)}`;
}

export default function OrderDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user, userData, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Review state
  const [reviewProduct, setReviewProduct] = useState<{
    productId: string;
    productName: string;
    productImage?: string;
  } | null>(null);
  const [reviewedProductMap, setReviewedProductMap] = useState<Record<string, boolean>>({});

  // Dispute / Complaint modal state
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showResellerReviewModal, setShowResellerReviewModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('Damaged or Defective Item');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [disputeImages, setDisputeImages] = useState<string[]>([]);
  const [uploadingDisputeImages, setUploadingDisputeImages] = useState(false);
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const handleProofImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingDisputeImages(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 8 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large (max 8MB)`);
          continue;
        }

        try {
          const storedRecord = await StorageManager.uploadProductImage(file);
          if (storedRecord?.fileUrl) {
            newUrls.push(storedRecord.fileUrl);
          } else {
            throw new Error("No URL returned");
          }
        } catch (uploadErr) {
          // Fallback to base64 data URI
          const base64: string = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          newUrls.push(base64);
        }
      }
      setDisputeImages(prev => [...prev, ...newUrls].slice(0, 5));
      toast.success('Photos attached successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to attach proof photos');
    } finally {
      setUploadingDisputeImages(false);
      e.target.value = '';
    }
  };

  const handleRemoveProofImage = (indexToRemove: number) => {
    setDisputeImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  useEffect(() => {
    if (authLoading) return;

    // Initial fetch
    fetchOrder(false);

    // Silent background polling: keep tracking status up-to-date without blocking UI or showing full-page loader
    const interval = setInterval(() => {
      fetchOrder(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [orderId, user?.uid, authLoading]);

  const fetchOrder = async (isSilent = false) => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      if (!isSilent && !order) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const cleanOrderId = String(orderId).replace(/^#/, '').trim();
      const pureOrderId = cleanOrderId.includes('_') ? cleanOrderId.split('_')[0] : cleanOrderId;
      let data = await fetchOrderById(cleanOrderId);
      if (!data && cleanOrderId !== pureOrderId) {
        data = await fetchOrderById(pureOrderId);
      }
      if (data) {
        // Direct data binding with Admin Approval in courier_link_reviews and vendor_orders
        try {
          let rev = await rtdbGet<any>(`courier_link_reviews/${cleanOrderId}`);
          if ((!rev || rev.status !== 'approved') && cleanOrderId !== pureOrderId) {
            rev = await rtdbGet<any>(`courier_link_reviews/${pureOrderId}`);
          }
          if (!rev || rev.status !== 'approved') {
            // Check vendor-specific sub-orders or vendor reviews
            if (Array.isArray(data.items)) {
              for (const it of data.items) {
                const vId = it.vendorId || it.vendor?.id;
                if (vId) {
                  const vRev = await rtdbGet<any>(`courier_link_reviews/${pureOrderId}_${vId}`);
                  if (vRev && vRev.status === 'approved' && vRev.trackingUrl) {
                    rev = vRev;
                    break;
                  }
                  const vOrder = await rtdbGet<any>(`vendor_orders/${pureOrderId}_${vId}`);
                  if (vOrder && (vOrder.courierAdminApproved || vOrder.courierVerificationStatus === 'Verified') && (vOrder.trackingUrl || vOrder.approvedCourierTrackingUrl)) {
                    rev = {
                      status: 'approved',
                      trackingUrl: vOrder.approvedCourierTrackingUrl || vOrder.trackingUrl || vOrder.courierTrackingUrl,
                      trackingId: vOrder.trackingNumber || vOrder.trackingId,
                      courierName: vOrder.courierName
                    };
                    break;
                  }
                }
              }
            }
          }
          if (rev && rev.status === 'approved') {
            data.courierAdminApproved = true;
            data.courierVerificationStatus = 'Verified';
            data.courierReviewStatus = 'approved';
            const foundUrl = (rev.trackingUrl || rev.approvedCourierTrackingUrl || '').trim();
            if (foundUrl) {
              data.trackingUrl = foundUrl;
              data.courierTrackingUrl = foundUrl;
              data.approvedCourierTrackingUrl = foundUrl;
            }
            if (rev.trackingId && !data.trackingNumber) {
              data.trackingNumber = rev.trackingId;
              data.trackingId = rev.trackingId;
            }
            if (rev.courierName && !data.courierName) {
              data.courierName = rev.courierName;
            }

            // Sync to RTDB for permanent instant loading
            if (foundUrl) {
              const alreadyDelivered = isDeliveredStatus(data.status) || data.reviewSubmitted || data.reviewCompleted;
              rtdbUpdate(`orders/${pureOrderId}`, {
                courierAdminApproved: true,
                courierVerificationStatus: 'Verified',
                courierReviewStatus: 'approved',
                trackingUrl: foundUrl,
                approvedCourierTrackingUrl: foundUrl,
                courierTrackingUrl: foundUrl,
                trackingNumber: data.trackingNumber || rev.trackingId || '',
                trackingId: data.trackingNumber || rev.trackingId || '',
                courierName: data.courierName || rev.courierName || '',
                ...(alreadyDelivered ? {} : { status: 'Shipped' }),
                updatedAt: Date.now()
              }).catch(() => null);
            }
          }
        } catch (revErr) {
          console.warn('courier review check error:', revErr);
        }

        // COD Order Reconcile Rule: If COD order has reviews submitted/completed, ensure it is Delivered
        const isCod = 
          String(data.paymentMethod || '').toLowerCase() === 'cod' ||
          String(data.paymentMethod || '').toLowerCase().includes('cash on delivery') ||
          String(data.paymentGateway || '').toLowerCase().includes('cash on delivery') ||
          String(data.paymentGateway || '').toLowerCase() === 'cod';

        const hasSubmittedReview = Boolean(
          data.reviewSubmitted || 
          data.reviewCompleted || 
          (data.reviewedItems && typeof data.reviewedItems === 'object' && Object.keys(data.reviewedItems).length > 0)
        );

        if (isCod && hasSubmittedReview && !isDeliveredStatus(data.status)) {
          data.status = 'Delivered';
          data.orderStatus = 'Delivered';
          data.vendorStatus = 'Delivered';
          markCodOrderDelivered(pureOrderId, data);
        }

        const phoneToCheck = user.phoneNumber || userData?.phone || '';
        const cleanUserPhone = phoneToCheck ? phoneToCheck.replace(/[^0-9]/g, '').slice(-10) : '';
        const orderPhone = (data.shippingAddress?.mobile || data.customerPhone || data.phone || '').replace(/[^0-9]/g, '').slice(-10);
        const userEmailToCheck = (user.email || userData?.email || '').toLowerCase().trim();
        const orderEmail = (data.shippingAddress?.email || data.customerEmail || data.email || '').toLowerCase().trim();

        const isAuthorized = 
          !data.userId || 
          data.userId === 'guest' || 
          data.userId === user.uid || 
          data.customerId === user.uid || 
          data.resellerId === user.uid ||
          (cleanUserPhone && orderPhone && cleanUserPhone === orderPhone) ||
          (userEmailToCheck && orderEmail && userEmailToCheck === orderEmail) ||
          userData?.role === 'Admin' ||
          (user as any).role === 'Admin';

        if (isAuthorized) {
          // Sync Reseller Profit Review status from RTDB directly if available
          try {
            const cleanOId = String(data.orderId || data.id || pureOrderId).replace(/^#/, '');
            const rReview = await rtdbGet<any>(`reseller_profit_reviews/${cleanOId}_${user.uid}`);
            if (rReview) {
              if (rReview.reviewStatus) data.reviewStatus = rReview.reviewStatus;
              if (rReview.profitStatus) data.profitStatus = rReview.profitStatus;
              if (rReview.rejectionReason) data.rejectionReason = rReview.rejectionReason;
            }
          } catch {
            // non-fatal
          }

          // If in Release Pending, check if auto-release threshold reached
          if (data.vendorPayoutStatus === 'Release Pending' && !data.dispute) {
            const releaseResult = await checkAndAutoReleaseVendorPayout(data);
            if (releaseResult.released) {
              data.vendorPayoutStatus = 'Released';
            }
          }
          setOrder(data);

          // Check which products in this order have been reviewed
          if (data && user) {
            const revMap: Record<string, boolean> = {};
            if (data.reviewedItems && typeof data.reviewedItems === 'object') {
              Object.keys(data.reviewedItems).forEach(pid => {
                const rVal = data.reviewedItems[pid];
                if (rVal && (rVal.reviewId || rVal.rating || rVal.reviewedAt || rVal === true)) {
                  revMap[pid] = true;
                }
              });
            }
            const orderIdStr = data.orderId || data.id || '';
            const itemsArr = Array.isArray(data.items) ? data.items : [];
            Promise.all(
              itemsArr.map(async (it: any) => {
                const pid = String(it.productId || it.id || '');
                if (pid && !revMap[pid]) {
                  const reviewed = await hasUserReviewedProduct(user.uid, pid, orderIdStr);
                  if (reviewed) revMap[pid] = true;
                }
              })
            ).then(() => {
              setReviewedProductMap({ ...revMap });
            }).catch(() => null);
          }
        } else {
          if (!isSilent) toast.error('Unauthorized access to this order');
        }
      } else {
        if (!isSilent && !order) toast.error('Order not found');
      }
    } catch (err) {
      console.error('Error fetching order:', err);
      if (!isSilent && !order) {
        toast.error('Failed to load order tracking details.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCopyOrderId = () => {
    if (!order?.orderId) return;
    navigator.clipboard.writeText(order.orderId);
    setCopiedId(true);
    toast.success('Order ID copied to clipboard');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyTrackingNumber = () => {
    if (!order?.trackingNumber) return;
    navigator.clipboard.writeText(order.trackingNumber);
    setCopiedTracking(true);
    toast.success('Tracking ID copied to clipboard');
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const handleCancelOrder = async () => {
    if (!orderId || !order) return;
    const confirmCancel = window.confirm("Are you sure you want to cancel this order?");
    if (!confirmCancel) return;

    setCancelling(true);
    try {
      await rtdbUpdate(`orders/${orderId}`, { status: 'Cancelled', vendorPayoutStatus: 'Cancelled', updatedAt: Date.now() });
      setOrder({ ...order, status: 'Cancelled', vendorPayoutStatus: 'Cancelled' });
      toast.success('Order cancelled successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !user || !disputeDetails.trim()) {
      toast.error('Please describe the issue in detail');
      return;
    }

    setSubmittingDispute(true);
    try {
      const res = await raiseCustomerDispute(
        orderId,
        user.uid,
        user.displayName || order.shippingAddress?.name || 'Customer',
        disputeReason,
        disputeDetails.trim(),
        disputeImages
      );
      if (res.success) {
        toast.success(res.message);
        setShowDisputeModal(false);
        setDisputeDetails('');
        setDisputeImages([]);
        fetchOrder(true);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit dispute');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 text-primary-main animate-spin mb-3" />
        <p className="text-sm font-semibold text-gray-600">Loading Order Tracking Details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <Header />
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Order Not Found</h2>
            <p className="text-sm text-gray-500 mb-6">The order you are trying to track does not exist or has been removed.</p>
            <Link 
              to="/orders" 
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-main text-white text-sm font-semibold rounded-xl hover:bg-sky-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to My Orders
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const rawStatus = order.status || 'Pending';
  const isCancelled = rawStatus === 'Cancelled';
  const isRejected = rawStatus === 'Rejected';

  // Financial calculations
  const items = order.items || [];
  const subtotal = items.reduce((acc: number, item: any) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
  const deliveryCharge = order.deliveryCharge !== undefined 
    ? Number(order.deliveryCharge) 
    : (order.shippingCharge !== undefined 
        ? Number(order.shippingCharge) 
        : (order.shippingMethod === 'express' ? 30 : (subtotal > 100 ? 0 : 15)));
  const discount = Number(order.discount || 0);
  const tax = Number(order.tax || 0);
  const grandTotal = Number(order.grandTotal ?? order.total ?? (subtotal + deliveryCharge + tax - discount));

  // Advance Payment & COD calculations
  const breakdown = calculateOrderPaymentBreakdown(order);
  const isCodOrder = breakdown.isCod;
  const isFullPayment = breakdown.isFullPayment;
  const advancePaymentAmount = breakdown.advanceAmount;
  const codAmount = breakdown.codAmount;
  const isOnlinePaymentSuccess = !isCodOrder && isFullPayment;

  // Courier details
  const courierName = order.courierName || '';
  const trackingNumber = (order.trackingNumber || order.trackingId || '').trim();
  const rawTrackingUrl = (
    order.approvedCourierTrackingUrl || 
    order.trackingUrl || 
    order.courierTrackingUrl || 
    ''
  ).trim();

  let finalCourierUrl = '';
  if (rawTrackingUrl) {
    finalCourierUrl = rawTrackingUrl.startsWith('http://') || rawTrackingUrl.startsWith('https://')
      ? rawTrackingUrl
      : `https://${rawTrackingUrl}`;
  }

  const isCourierApproved = Boolean(
    (order.courierVerificationStatus === 'Verified' || 
     order.courierAdminApproved === true || 
     order.courierAdminApproved === 'true' ||
     order.courierReviewStatus === 'approved') && 
    finalCourierUrl
  );

  const hasDbReviewedItems = Boolean(
    order.reviewedItems && 
    typeof order.reviewedItems === 'object' && 
    Object.keys(order.reviewedItems).length > 0 && 
    Object.values(order.reviewedItems).some((v: any) => v && (v.reviewId || v.rating || v.reviewedAt))
  );

  const hasVerifiedProductReview = Boolean(
    reviewedProductMap && Object.values(reviewedProductMap).some(Boolean)
  );

  const isOrderReviewed = Boolean(hasVerifiedProductReview || hasDbReviewedItems);

  const formatDateTime = (ts: number | string) => {
    if (!ts) return 'N/A';
    try {
      const date = new Date(ts);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return String(ts);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans print:bg-white">
      <div className="print:hidden">
        <Header />
      </div>
      
      <main className="flex-grow pt-4 sm:pt-6 pb-14 print:pt-0 print:pb-0">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
          
          {/* Top navigation & action header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <Link 
                to="/orders" 
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-xs"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>My Orders</span>
              </Link>
              <button 
                onClick={() => fetchOrder(true)}
                disabled={refreshing}
                title="Refresh Live Status"
                className="p-1.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors shadow-xs"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-primary-main' : ''}`} />
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <button 
                onClick={handlePrintInvoice}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-1.5 sm:py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-xs"
              >
                <Printer className="h-4 w-4 text-gray-500" />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>

          {/* Main Tracking Card Container */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden">
            
            {/* Header / Order Identifiers Banner */}
            <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-wider bg-white/10 text-sky-200 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                      Live Order Tracking
                    </span>
                    <span className="text-xs text-slate-300">
                      Placed on {formatDateTime(order.createdAt)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                      <span>Order #{order.orderId}</span>
                    </h1>
                    <button 
                      onClick={handleCopyOrderId}
                      className="p-1.5 bg-white/10 hover:bg-white/20 text-sky-200 rounded-lg transition-colors flex items-center gap-1 text-xs"
                      title="Copy Order ID"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto pt-3 md:pt-0 border-t border-white/10 md:border-t-0">
                  <span className="text-xs text-slate-300">Total Order Amount</span>
                  <span className="text-xl sm:text-2xl font-extrabold text-emerald-400">
                    ৳{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Status Highlight Bar */}
            <div className="p-4 sm:p-5 bg-sky-50/70 border-b border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                  isCancelled || isRejected ? 'bg-red-100 text-red-600' :
                  rawStatus === 'Delivered' || rawStatus === 'Completed' ? 'bg-emerald-600 text-white' :
                  'bg-primary-main text-white'
                }`}>
                  {isCancelled || isRejected ? <XCircle className="w-5 h-5" /> :
                   rawStatus === 'Delivered' || rawStatus === 'Completed' ? <CheckCircle className="w-5 h-5" /> :
                   <PackageCheck className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Order Status</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isCancelled || isRejected ? 'bg-red-100 text-red-800 border border-red-300' :
                      rawStatus === 'Delivered' || rawStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                      rawStatus === 'Confirmed' || rawStatus === 'Accepted' || rawStatus === 'Vendor Accepted' ? 'bg-teal-100 text-teal-800 border border-teal-300' :
                      rawStatus === 'Shipped' || rawStatus === 'Dispatched' ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' :
                      'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {isCancelled ? 'Cancelled' : isRejected ? 'Rejected' : rawStatus === 'Delivered' || rawStatus === 'Completed' ? 'Delivered' : rawStatus === 'Accepted' || rawStatus === 'Vendor Accepted' ? 'Vendor Accepted' : rawStatus === 'Confirmed' ? 'Confirmed' : rawStatus === 'Shipped' || rawStatus === 'Dispatched' ? 'Shipped' : 'Processing'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-gray-800 mt-0.5">
                    {isCancelled ? 'This order has been cancelled.' :
                     isRejected ? 'This order was rejected by the vendor.' :
                     rawStatus === 'Delivered' || rawStatus === 'Completed' ? 'পণ্যটি সফলভাবে গ্রাহকের নিকট ডেলিভারি সম্পন্ন হয়েছে।' :
                     (rawStatus === 'Shipped' || rawStatus === 'Dispatched' ? 'Package handed over to courier partner.' :
                      rawStatus === 'Accepted' || rawStatus === 'Vendor Accepted' ? 'Vendor accepted your order and is preparing package.' :
                      rawStatus === 'Confirmed' ? 'Order details verified & order confirmed.' :
                      'Your order was successfully submitted & received.')}
                  </p>
                </div>
              </div>
            </div>

            {/* Cancelled / Rejected Warning Banner */}
            {isCancelled && (
              <div className="m-4 sm:m-6 p-4 sm:p-5 bg-red-50/90 rounded-2xl border border-red-200 flex items-start gap-3.5">
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1 text-xs">
                  <div>
                    <h3 className="text-sm font-bold text-red-950">অর্ডার বাতিল নোটিশ (Order Cancelled)</h3>
                    <p className="text-red-700 mt-0.5">
                      অর্ডারটি বিক্রেতা (Vendor) কর্তৃক বাতিল করা হয়েছে এবং এটি পাঠানো হবে না।
                    </p>
                  </div>

                  {(order.cancelReason || order.cancellationNotice || order.vendorCancelReason) && (
                    <div className="p-3 bg-white/80 rounded-xl border border-red-200/80">
                      <span className="font-bold text-slate-800 block mb-0.5">বাতিলের কারণ / ভেন্ডর নোটিশ:</span>
                      <p className="text-slate-700 italic">
                        "{order.cancelReason || order.cancellationNotice || order.vendorCancelReason}"
                      </p>
                    </div>
                  )}

                  {Boolean(order.walletRefundProcessed || order.refundStatus === 'refunded' || (order.refundAmount && order.refundAmount > 0)) ? (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-2 text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">ওয়ালেট রিফান্ড সম্পন্ন: </span>
                        <span>আপনার পরিশোধিত <strong>৳{order.refundAmount}</strong> সরাসরি আপনার ওয়ালেটে যুক্ত করা হয়েছে। আপনি চাইলে My Profile → My Wallet থেকে এখনই উইথড্র করতে পারবেন।</span>
                      </div>
                    </div>
                  ) : order.paymentMethod?.toLowerCase().includes('cod') || order.paymentMethod?.toLowerCase().includes('cash on delivery') ? (
                    <div className="text-slate-600">
                      • ক্যাশ অন ডেলিভারি (COD) অর্ডার হওয়ায় কোনো অগ্রিম টাকা কাটা হয়নি।
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {isRejected && !isCancelled && (
              <div className="m-4 sm:m-6 p-4 bg-red-50 rounded-2xl border border-red-200 flex items-start gap-3.5">
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-red-900">Order Rejected by Seller</h3>
                  <p className="text-xs text-red-700 mt-0.5">
                    The seller was unable to fulfill this order.
                  </p>
                </div>
              </div>
            )}

            {/* 🛡️ Reseller Profit Verification Review Banner */}
            {Boolean(
              (userData?.accountType === 'reseller' || userData?.role === 'reseller' || (user as any)?.role === 'reseller' || order.resellerId === user?.uid) &&
              (order.isResellerOrder || order.resellerId || order.profitStatus || order.priceSnapshot?.resellerProfit || order.resellerPriceSnapshot?.resellerProfit)
            ) && (
              <div className="m-4 sm:m-6 p-5 sm:p-6 bg-gradient-to-br from-purple-50 via-indigo-50/50 to-white rounded-2xl border-2 border-purple-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-purple-950">
                        Reseller Profit Verification Review (রিসেলার প্রফিট ভেরিফিকেশন)
                      </h3>
                      <p className="text-xs text-purple-700">
                        রিসেলার প্রফিট রিলিজ ও ডেলিভারি স্ট্যাটাস নিশ্চিতকরণ
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">সংরক্ষিত প্রফিট</p>
                      <p className="text-lg font-extrabold text-purple-700">
                        ৳{Number(order.lockedProfitAmount ?? order.priceSnapshot?.resellerProfit ?? order.resellerPriceSnapshot?.resellerProfit ?? order.resellerProfit ?? 0)}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {order.profitStatus || 'LOCKED'}
                    </span>
                  </div>
                </div>

                {/* Mandatory Prompt Notice */}
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs sm:text-sm font-medium leading-relaxed flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p>
                    "Please check the product tracking/delivery status before submitting your review. Profit will only be released after the order is successfully delivered and the review is approved by Admin."
                  </p>
                </div>

                {/* Status & Review Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="text-xs text-gray-600 flex items-center gap-2 flex-wrap">
                    <span>ডেলিভারি স্ট্যাটাস:</span>
                    <span className="font-bold text-gray-900 px-2 py-0.5 bg-gray-100 rounded">
                      {order.deliveryStatus || order.orderStatus || order.status || 'Pending'}
                    </span>
                    <span>• ভেন্ডর স্ট্যাটাস:</span>
                    <span className="font-bold text-emerald-700 px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                      {order.vendorOrderStatus || (order.profitStatus === 'LOCKED' ? 'CONFIRMED' : 'Pending')}
                    </span>
                  </div>

                  <div>
                    {order.profitStatus === 'RELEASED' || order.reviewStatus === 'APPROVED' ? (
                      <button
                        type="button"
                        onClick={() => setShowResellerReviewModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-2xs cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4 text-emerald-100" />
                        <span>প্রফিট রিলিজ সম্পন্ন (Profit Released)</span>
                      </button>
                    ) : order.reviewStatus === 'PENDING' ? (
                      <button
                        type="button"
                        onClick={() => setShowResellerReviewModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-900 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-2xs cursor-pointer"
                      >
                        <Clock className="w-4 h-4 text-emerald-700" />
                        <span>Review Submitted (Pending Approval)</span>
                      </button>
                    ) : order.reviewStatus === 'REJECTED' ? (
                      <button
                        type="button"
                        onClick={() => setShowResellerReviewModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-900 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-2xs cursor-pointer"
                      >
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>রিভিউ বাতিল — পুনরায় রিভিউ দিন (Resubmit)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowResellerReviewModal(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs hover:shadow transition-all cursor-pointer active:scale-98"
                      >
                        <ShieldCheck className="w-4 h-4 text-purple-200" />
                        <span>Review (Profit Verification) দিন</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 📦 Delivery Tracking Section (Visible ONLY after Admin Approval) */}
            {isCourierApproved && finalCourierUrl && (
              <div className="p-4 sm:p-6 bg-slate-50/70 border-b border-gray-100">
                <div className="bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 shadow-xs">
                  {/* Section Title */}
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📦</span>
                      <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                        Delivery Tracking
                      </h2>
                    </div>
                    {isOrderReviewed && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold shadow-2xs">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>✅ রিভিউ দেওয়া হয়েছে</span>
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <p className="text-xs sm:text-sm text-gray-700 font-medium leading-relaxed mb-4">
                    আপনার অর্ডারের বর্তমান অবস্থান জানতে Courier-এর Tracking Link-এ প্রবেশ করুন।
                  </p>

                  {/* Button: অর্ডার ট্র্যাক করুন */}
                  <div className="mb-5">
                    <a 
                      href={finalCourierUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary-main hover:bg-sky-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all hover:shadow hover:scale-[1.01] active:scale-[0.99]"
                      title="অনুমোদিত অফিশিয়াল কুরিয়ার ট্র্যাকিং পেজ দেখুন"
                    >
                      <span>🔗</span>
                      <span>অর্ডার ট্র্যাক করুন</span>
                      <ExternalLink className="w-4 h-4 ml-0.5" />
                    </a>
                  </div>

                  {/* “পণ্য পেয়েছি” / Review Completed অংশ */}
                  <div className={`pt-4 border-t border-gray-100 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 sm:p-5 rounded-b-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isOrderReviewed ? 'bg-emerald-50/70 border-t-emerald-100' : 'bg-amber-50/60'
                  }`}>
                    {isOrderReviewed ? (
                      <>
                        <div className="flex items-center gap-2.5 flex-1">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <CheckCircle className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-emerald-950">
                              পণ্য প্রাপ্তি নিশ্চিত হয়েছে ও রিভিউ সফলভাবে জমা হয়েছে
                            </p>
                            <p className="text-[11px] sm:text-xs text-emerald-800 font-medium">
                              আমাদের সাথে থাকার জন্য আপনাকে ধন্যবাদ!
                            </p>
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs shrink-0">
                          <span>✅ রিভিউ দেওয়া হয়েছে</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs sm:text-sm text-amber-950 font-medium leading-relaxed flex-1">
                          লিংকে ঢুকে যাচাই করুন আপনার প্রোডাক্টটি কোথায় আছে। প্রোডাক্টটি পেয়ে থাকলে ‘পণ্য পেয়েছি’ বাটনে ক্লিক করে একটি রিভিউ দিন।
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            const unreviewedItem = items.find((it: any) => !reviewedProductMap[String(it.productId || it.id || '')]) || items[0];
                            if (unreviewedItem && !order.reviewCompleted && !order.reviewSubmitted) {
                              setReviewProduct({
                                productId: String(unreviewedItem.productId || unreviewedItem.id || ''),
                                productName: unreviewedItem.name || unreviewedItem.title || 'Product',
                                productImage: unreviewedItem.image || unreviewedItem.thumbnail || ''
                              });
                            } else {
                              if (isCodOrder && !isDeliveredStatus(order.status)) {
                                await markCodOrderDelivered(order.orderId || order.id || orderId, order, order.vendorId);
                                toast.success('COD অর্ডার সফলভাবে Delivered করা হয়েছে!');
                                fetchOrder(true);
                              } else {
                                toast.success('এই অর্ডারের সব পণ্যের রিভিউ সম্পন্ন হয়েছে!');
                              }
                            }
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                        >
                          <span>✅</span>
                          <span>পণ্য পেয়েছি</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ORDER ITEMS & ADDRESS / PAYMENT SECTION */}
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* LEFT: Order Items List (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <Package className="w-5 h-5 text-primary-main" />
                      <span>Ordered Products ({items.length})</span>
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {items.map((item: any, idx: number) => {
                      const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
                      const productId = String(item.productId || item.id || '');
                      const isReviewed = reviewedProductMap[productId];

                      return (
                        <div 
                          key={item.id || idx} 
                          className="p-3 sm:p-4 bg-gray-50/80 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors space-y-3"
                        >
                          <div className="flex items-start gap-3 sm:gap-4">
                            <img 
                              referrerPolicy="no-referrer"
                              src={formatDirectImageUrl(item.image || item.thumbnail) || PLACEHOLDER_PRODUCT_IMAGE} 
                              alt={item.name || item.title || 'Product'} 
                              onError={(e) => handleProductImageError(e)}
                              className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover bg-white border border-gray-200 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug">
                                {item.name || item.title || 'Product Item'}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs text-gray-500">
                                <span>Quantity: <strong className="text-gray-800">{item.quantity || 1}</strong></span>
                                <span>•</span>
                                <span>Price: <strong className="text-gray-800">৳{Number(item.price || 0).toFixed(2)}</strong></span>
                              </div>
                              {item.vendorName && (
                                <p className="text-[11px] text-gray-400 mt-0.5">Sold by: {item.vendorName}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs sm:text-sm font-extrabold text-gray-900">
                                ৳{itemTotal.toFixed(2)}
                              </p>
                            </div>
                          </div>

                          {/* Review Action Row: Visible ONLY if Admin has approved Courier Tracking Link */}
                          <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between gap-2">
                            {isCourierApproved ? (
                              isReviewed ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200">
                                  <Star className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                                  <span>Reviewed (রিভিউ দেওয়া হয়েছে)</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setReviewProduct({
                                    productId,
                                    productName: item.name || item.title || 'Product',
                                    productImage: item.image || item.thumbnail || ''
                                  })}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 shadow-xs transition-all cursor-pointer"
                                >
                                  <Star className="w-3.5 h-3.5 fill-white" />
                                  <span>Write Review (রিভিউ দিন)</span>
                                </button>
                              )
                            ) : (
                              <div />
                            )}

                            <Link
                              to={`/product/${productId}`}
                              className="text-xs font-bold text-primary-main hover:text-sky-700 flex items-center gap-1 transition-colors ml-auto"
                            >
                              <span>View Product</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT: Financial Summary & Shipping Details (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* Financial Breakdown Card */}
                  <div className="bg-gray-50/90 rounded-2xl p-4 sm:p-5 border border-gray-200/80 space-y-3">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider pb-2 border-b border-gray-200 flex items-center justify-between">
                      <span>Order Summary</span>
                      <CreditCard className="w-4 h-4 text-gray-500" />
                    </h3>

                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>Items Subtotal</span>
                        <span className="font-semibold text-gray-900">৳{subtotal.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-gray-600">
                        <span>Delivery Charge</span>
                        <span className="font-semibold text-gray-900">
                          {deliveryCharge === 0 ? (
                            <span className="text-emerald-600 font-bold">FREE</span>
                          ) : (
                            `৳${deliveryCharge.toFixed(2)}`
                          )}
                        </span>
                      </div>

                      {discount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-medium">
                          <span>Discount Applied</span>
                          <span>-৳{discount.toFixed(2)}</span>
                        </div>
                      )}

                      {tax > 0 && (
                        <div className="flex justify-between text-gray-600">
                          <span>Tax / VAT</span>
                          <span className="font-semibold text-gray-900">৳{tax.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                        <div>
                          <span className="text-sm font-extrabold text-gray-900 block">Total Amount</span>
                          <span className="text-[10px] text-gray-500">Includes items & delivery</span>
                        </div>
                        <span className="text-lg sm:text-xl font-extrabold text-emerald-600">
                          ৳{grandTotal.toFixed(2)}
                        </span>
                      </div>

                      {/* Advance & COD Highlights */}
                      <div className="pt-2.5 border-t border-dashed border-gray-200 space-y-1.5">
                        <div className="flex justify-between items-center bg-sky-50 px-2.5 py-1.5 rounded-lg border border-sky-100 text-xs">
                          <span className="font-bold text-sky-900">অগ্রিম পরিশোধ (Advance / Paid):</span>
                          <span className="font-extrabold text-sky-800">
                            ৳{advancePaymentAmount.toFixed(2)} {isFullPayment ? '(Full Paid)' : ''}
                          </span>
                        </div>
                        <div className={`flex justify-between items-center px-2.5 py-1.5 rounded-lg border text-xs ${
                          codAmount === 0 
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}>
                          <span className="font-bold">ক্যাশ অন ডেলিভারি (Due / COD):</span>
                          <span className="font-extrabold">
                            {codAmount === 0 ? '০ টাকা (সম্পূর্ণ পরিশোধিত)' : `৳${codAmount.toFixed(2)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Address Card */}
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200/80 shadow-xs space-y-2.5">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-gray-100">
                      <MapPin className="w-4 h-4 text-primary-main" />
                      <span>Shipping Address</span>
                    </h3>
                    <div className="text-xs sm:text-sm text-gray-700 space-y-1">
                      <p className="font-bold text-gray-900 text-sm">{order.shippingAddress?.name || 'Customer'}</p>
                      {order.shippingAddress?.mobile && (
                        <p className="flex items-center gap-1.5 text-gray-600">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <span>{order.shippingAddress?.mobile}</span>
                        </p>
                      )}
                      <p className="text-gray-600 pt-1 leading-relaxed">
                        {order.shippingAddress?.fullAddress || 'No street address provided'}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {[order.shippingAddress?.upazila, order.shippingAddress?.district, order.shippingAddress?.division, order.shippingAddress?.postalCode].filter(Boolean).join(', ')}
                      </p>
                    </div>

                    {/* Payment Info */}
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-gray-500 block">Payment Method</span>
                        <span className="font-bold text-gray-900 uppercase">
                          {isCodOrder ? 'COD' : (order.paymentMethod || 'COD')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-right">Payment Status</span>
                        {isCodOrder ? (
                          <span className="font-bold text-emerald-700 flex items-center justify-end gap-1">
                            <span>💵 ক্যাশ অন ডেলিভারি</span>
                          </span>
                        ) : isOnlinePaymentSuccess ? (
                          <span className="font-bold text-emerald-600 flex items-center justify-end gap-1">
                            <span>✅ পেমেন্ট করা হয়েছে</span>
                          </span>
                        ) : (
                          <span className={`font-bold ${order.paymentStatus === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {order.paymentStatus || 'Pending'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 72-Hour Buyer Protection & Dispute Card */}
                  {order.vendorPayoutStatus === 'Disputed' || order.status === 'Dispute' ? (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-rose-900 flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-rose-600" />
                          <span>Dispute Under Admin Review</span>
                        </div>
                        <span className="px-2 py-0.5 bg-rose-200 text-rose-800 rounded font-bold text-[10px]">
                          Payout Frozen
                        </span>
                      </div>
                      
                      <div className="p-2.5 bg-white rounded-xl border border-rose-100 space-y-1">
                        <p className="text-rose-900 font-semibold">Reason: {order.dispute?.reason || 'Issue reported'}</p>
                        {order.dispute?.details && (
                          <p className="text-slate-700 text-xs">{order.dispute.details}</p>
                        )}
                      </div>

                      {/* Evidence Photos */}
                      {order.dispute?.images?.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-slate-700">Attached Proof Photos:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {order.dispute.images.map((img: string, idx: number) => (
                              <a key={idx} href={img} target="_blank" rel="noreferrer" className="block w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:border-primary-main">
                                <img referrerPolicy="no-referrer" src={img} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Vendor Response */}
                      {order.dispute?.vendorResponse && (
                        <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-xl space-y-1">
                          <p className="font-bold text-teal-900 text-[11px]">🏪 Vendor Response:</p>
                          <p className="text-slate-800 text-xs bg-white p-2 rounded border border-teal-100">
                            "{order.dispute.vendorResponse.text}"
                          </p>
                        </div>
                      )}

                      <p className="text-[11px] text-rose-700">
                        Vendor payout is currently on hold while the admin team investigates this case.
                      </p>
                    </div>
                  ) : order.vendorPayoutStatus === 'Refunded' || order.status === 'Refunded' ? (
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-2 text-xs">
                      <div className="font-bold text-purple-900 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-purple-600" />
                        <span>Refund Processed</span>
                      </div>
                      <p className="text-purple-800 text-[11px]">
                        Admin has reviewed the dispute and approved your refund. The vendor payout was cancelled.
                      </p>
                      {order.dispute?.resolutionNote && (
                        <p className="p-2 bg-white rounded-lg border border-purple-100 text-slate-700 text-xs">
                          <strong>Note:</strong> {order.dispute.resolutionNote}
                        </p>
                      )}
                    </div>
                  ) : rawStatus === 'Delivered' ? (
                    <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl space-y-2 text-xs">
                      <div className="font-bold text-blue-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                        72-Hour Buyer Protection Active
                      </div>
                      <p className="text-blue-800 text-[11px]">
                        Your payment is held in protection. If there is any defect or problem with your parcel, report it within 72 hours.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowDisputeModal(true)}
                        className="w-full py-2 bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 text-xs"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        Report Problem / Dispute
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col gap-2 text-xs text-emerald-800">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>RJ World Escrow Protection guarantees safe delivery of all orders.</span>
                      </div>
                      {(rawStatus === 'Shipped' || rawStatus === 'Dispatched') && !isCancelled && !isRejected && (
                        <button
                          type="button"
                          onClick={() => setShowDisputeModal(true)}
                          className="w-full py-1.5 bg-white hover:bg-rose-50 border border-slate-200 text-slate-700 hover:text-rose-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 text-[11px]"
                        >
                          <ShieldAlert className="w-3 h-3 text-rose-500" />
                          Report Problem / Dispute
                        </button>
                      )}
                    </div>
                  )}

                </div>

              </div>
            </div>

            {/* Bottom Footer Actions */}
            {!isCancelled && !isRejected && (rawStatus === 'Pending' || rawStatus === 'Confirmed' || rawStatus === 'Order Placed') && (
              <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3 print:hidden">
                <p className="text-xs text-gray-500 text-center sm:text-left">
                  Need to change address or cancel? You can cancel this order before the vendor accepts it.
                </p>
                <button 
                  onClick={handleCancelOrder}
                  disabled={cancelling}
                  className="w-full sm:w-auto px-5 py-2 border border-red-300 text-red-600 hover:bg-red-50 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Cancel Order
                </button>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Customer Dispute / Complaint Modal */}
      {showDisputeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 print:hidden animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-rose-50/60">
              <div className="flex items-center gap-2 text-rose-700">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-base font-bold text-gray-900">Report Issue / Raise Dispute</h3>
              </div>
              <button 
                onClick={() => setShowDisputeModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitDispute} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <strong>Escrow Protection Notice:</strong> Raising a dispute immediately freezes vendor payout for this order. Our admin investigation team will step in to verify your complaint.
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Reason for Dispute
                </label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Damaged or Defective Item">Damaged or Defective Item</option>
                  <option value="Wrong Item Received">Wrong Item Received</option>
                  <option value="Missing Items in Package">Missing Items in Package</option>
                  <option value="Item Not as Described">Item Not as Described</option>
                  <option value="Severe Quality Issue">Severe Quality Issue</option>
                  <option value="Other Issue">Other Issue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Detailed Explanation
                </label>
                <textarea
                  value={disputeDetails}
                  onChange={(e) => setDisputeDetails(e.target.value)}
                  rows={3}
                  required
                  placeholder="Please describe what is wrong with the product or delivery in detail..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>

              {/* Proof / Evidence Photo Upload */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Upload Photos / Proof (ছবি / প্রমাণ)
                  </label>
                  <span className="text-[11px] text-gray-400">Up to 5 images</span>
                </div>

                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-gray-200 hover:border-rose-400 bg-gray-50/50 hover:bg-rose-50/30 rounded-xl cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleProofImageUpload}
                      disabled={uploadingDisputeImages || disputeImages.length >= 5}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      {uploadingDisputeImages ? (
                        <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-rose-500" />
                      )}
                      <span className="font-semibold text-rose-600">Click to upload photos</span>
                      <span>(damaged item, packaging, bill)</span>
                    </div>
                  </label>

                  {/* Uploaded image previews */}
                  {disputeImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {disputeImages.map((url, idx) => (
                        <div key={idx} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
                          <img referrerPolicy="no-referrer" src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveProofImage(idx)}
                            className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] opacity-90 hover:opacity-100 shadow-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  disabled={submittingDispute}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute || !disputeDetails.trim()}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submittingDispute ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                  Submit Dispute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Product Review Modal */}
      {reviewProduct && order && (
        <ReviewModal
          isOpen={true}
          onClose={() => setReviewProduct(null)}
          orderId={order.orderId || order.id || orderId || ''}
          productId={reviewProduct.productId}
          productName={reviewProduct.productName}
          productImage={reviewProduct.productImage}
          onSuccess={async (revId) => {
            const pId = reviewProduct.productId;
            setReviewedProductMap(prev => ({
              ...prev,
              [pId]: true
            }));
            const oId = order.orderId || order.id || orderId || '';
            const pureId = oId.replace(/^#/, '');
            const now = Date.now();
            const updates: any = {
              reviewSubmitted: true,
              reviewCompleted: true,
              reviewedAt: now,
              reviewStatus: 'completed'
            };
            if (isCodOrder) {
              await markCodOrderDelivered(pureId, {
                ...order,
                ...updates,
                [`reviewedItems.${pId}`]: { reviewId: revId, reviewedAt: now }
              }, order.vendorId);
            } else {
              rtdbUpdate(`orders/${pureId}`, updates).catch(() => null);
              if (pureId !== oId) {
                rtdbUpdate(`orders/${oId}`, updates).catch(() => null);
              }
              rtdbUpdate(`vendor_orders/${pureId}`, updates).catch(() => null);
            }
            setOrder((prev: any) => prev ? {
              ...prev,
              ...updates,
              status: isCodOrder ? 'Delivered' : prev.status,
              orderStatus: isCodOrder ? 'Delivered' : prev.orderStatus,
              vendorStatus: isCodOrder ? 'Delivered' : prev.vendorStatus,
              reviewedItems: {
                ...(prev.reviewedItems || {}),
                [pId]: { reviewId: revId, reviewedAt: now }
              }
            } : prev);
            setReviewProduct(null);
            fetchOrder(true);
          }}
        />
      )}

      {/* Reseller Profit Verification Review Modal */}
      {showResellerReviewModal && order && user && (
        <ResellerProfitReviewModal
          isOpen={true}
          onClose={() => setShowResellerReviewModal(false)}
          order={order}
          resellerId={user.uid}
          onSuccess={() => {
            fetchOrder(true);
          }}
        />
      )}

      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}
