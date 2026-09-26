import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, Truck, Clock, Copy, Check, ExternalLink, 
  Navigation, ShieldCheck, MapPin, ArrowRight, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getCourierTrackingUrl } from '../../services/orderService';
import { rtdbUpdate } from '../../lib/rtdb';
import { isCodOrder, calculateOrderPaymentBreakdown } from '../../services/vendorPayoutService';
import { markCodOrderDelivered } from '../../services/platformFeeService';
import ReviewModal from '../reviews/ReviewModal';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../../utils/imageUrl';

interface OrderTrackingCardProps {
  order: any;
  compact?: boolean;
  onRefresh?: () => void;
  showFullDetailsLink?: boolean;
}

export default function OrderTrackingCard({ 
  order, 
  compact = false, 
  onRefresh,
  showFullDetailsLink = true 
}: OrderTrackingCardProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [reviewModalProduct, setReviewModalProduct] = useState<{
    productId: string;
    productName: string;
    productImage?: string;
  } | null>(null);

  if (!order) return null;

  const orderId = order.orderId || order.id;
  const status = order.status || 'Pending';
  const courierName = order.courierName || '';
  const trackingNumber = (order.trackingNumber || order.consignmentId || order.trackingId || '').trim();
  const rawUrl = (order.approvedCourierTrackingUrl || order.trackingUrl || order.courierTrackingUrl || '').trim();
  let trackingUrl = '';
  if (rawUrl) {
    trackingUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  }
  const isVerified = (order.courierVerificationStatus === 'Verified' || order.courierAdminApproved === true || order.courierAdminApproved === 'true' || order.courierReviewStatus === 'approved') && Boolean(trackingUrl);

  const [isReviewedLocal, setIsReviewedLocal] = useState(false);
  const hasActualReviewedItems = Boolean(
    order.reviewedItems && 
    typeof order.reviewedItems === 'object' && 
    Object.keys(order.reviewedItems).length > 0 && 
    Object.values(order.reviewedItems).some((v: any) => v && (v.reviewId || v.rating || v.reviewedAt))
  );
  const isOrderReviewed = Boolean(isReviewedLocal || hasActualReviewedItems);

  const handleCopyOrderId = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(orderId);
    setCopiedId(true);
    toast.success('Order ID copied');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyTrackingNumber = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(trackingNumber);
    setCopiedTracking(true);
    toast.success('Tracking ID copied');
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const getStatusBadge = (st: string) => {
    const s = (st || '').toLowerCase();
    if (s === 'cancelled' || s === 'rejected' || s === 'failed') {
      return {
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
        label: st,
        bn: 'বাতিলকৃত'
      };
    }
    if (s === 'delivered' || s === 'completed') {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
        label: 'Delivered',
        bn: 'ডেলিভারি সম্পন্ন'
      };
    }
    if (s === 'confirmed' || s === 'verified') {
      return {
        bg: 'bg-sky-50 text-sky-700 border-sky-200',
        dot: 'bg-sky-500',
        label: 'Confirmed',
        bn: 'নিশ্চিতকৃত'
      };
    }
    if (s === 'shipped' || s === 'dispatched' || s === 'in transit' || s === 'out for delivery' || s === 'returned') {
      return {
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        dot: 'bg-indigo-500',
        label: 'Shipped',
        bn: 'কুরিয়ারে প্রেরিত'
      };
    }
    return {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
      label: st || 'Processing',
      bn: 'প্রক্রিয়াধীন'
    };
  };

  const isCod = isCodOrder(order);
  const hasReviewedItems = Boolean(
    order.reviewedItems && 
    typeof order.reviewedItems === 'object' && 
    Object.keys(order.reviewedItems).length > 0
  );
  const isEffectivelyDelivered = 
    order.status === 'Delivered' || 
    (isCod && (order.reviewSubmitted || order.reviewCompleted || hasReviewedItems || isReviewedLocal));

  const effectiveStatus = isEffectivelyDelivered ? 'Delivered' : (order.status || 'Pending');
  const badge = getStatusBadge(effectiveStatus);
  const items = Array.isArray(order.items) ? order.items : [];
  
  const breakdown = calculateOrderPaymentBreakdown(order);
  const itemsPrice = breakdown.itemsPrice;
  const deliveryCharge = breakdown.deliveryCharge;
  const grandTotal = breakdown.grandTotal;
  const isFullPayment = breakdown.isFullPayment;
  const advancePaymentAmount = breakdown.advanceAmount;
  const codAmount = breakdown.codAmount;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-50 via-sky-50/40 to-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary-main/10 text-primary-main flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 tracking-tight">#{orderId}</span>
              <button
                type="button"
                onClick={handleCopyOrderId}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                title="Copy Order ID"
              >
                {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently placed'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.bg}`}>
            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
            <span>{badge.label}</span>
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-3.5 sm:p-4 space-y-3.5">
        
        {/* Courier Partner & Live Tracking Link - ONLY if Admin Approved */}
        {isVerified && trackingUrl ? (
          <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center shrink-0">
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-sky-950 flex items-center gap-1.5 flex-wrap">
                    <span>Courier: <strong className="text-primary-main">{courierName || 'Courier Partner'}</strong></span>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Approved
                    </span>
                  </div>
                  {trackingNumber && (
                    <div className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                      <span>Tracking ID: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200 text-slate-800 font-semibold">{trackingNumber}</code></span>
                      <button
                        type="button"
                        onClick={handleCopyTrackingNumber}
                        className="text-slate-400 hover:text-slate-700"
                        title="Copy Tracking ID"
                      >
                        {copiedTracking ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary-main hover:bg-sky-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                title="অফিশিয়াল অনুমোদিত কুরিয়ার ট্র্যাকিং পেজ দেখুন"
              >
                <Truck className="w-4 h-4" />
                <span>অর্ডার ট্র্যাক করুন</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Instruction & “পণ্য পেয়েছি” / “✅ রিভিউ দেওয়া হয়েছে” */}
            <div className={`pt-2.5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              isOrderReviewed ? 'border-emerald-100 bg-emerald-50/60 -mx-3.5 -mb-3.5 p-3 rounded-b-xl' : 'border-sky-100/80'
            }`}>
              {isOrderReviewed ? (
                <>
                  <p className="text-xs text-emerald-900 leading-relaxed font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>পণ্যটি প্রাপ্তি নিশ্চিত হয়েছে ও রিভিউ সফলভাবে জমা হয়েছে।</span>
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs shrink-0">
                    <span>✅ রিভিউ দেওয়া হয়েছে</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    “লিংকে ঢুকে যাচাই করুন আপনার প্রোডাক্টটি কোথায় আছে। প্রোডাক্টটি পেয়ে থাকলে ‘পণ্য পেয়েছি’ বাটনে ক্লিক করে একটি রিভিউ দিন।”
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const orderItems = Array.isArray(order.items) ? order.items : [];
                      const reviewedItemsObj = order.reviewedItems || {};
                      const unreviewedItem = orderItems.find(
                        (it: any) => !reviewedItemsObj[String(it.productId || it.id || '')]
                      ) || orderItems[0];
                      if (unreviewedItem) {
                        setReviewModalProduct({
                          productId: String(unreviewedItem.productId || unreviewedItem.id || ''),
                          productName: unreviewedItem.name || unreviewedItem.title || 'Product',
                          productImage: unreviewedItem.image || unreviewedItem.thumbnail || ''
                        });
                      } else {
                        if (isCod && !isEffectivelyDelivered) {
                          markCodOrderDelivered(orderId, order, order.vendorId);
                          toast.success('COD অর্ডার ডেলিভার্ড করা হয়েছে!');
                          if (onRefresh) onRefresh();
                        } else {
                          toast('আপনার এই অর্ডারের সব পণ্যের রিভিউ সম্পন্ন হয়েছে।', { icon: '✅' });
                        }
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    <span>✅ পণ্য পেয়েছি</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* Items Preview */}
        {items.length > 0 && (
          <div className="border border-slate-100 rounded-xl p-2.5 bg-slate-50/50">
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 mb-2 px-1 gap-1.5">
              <span>{items.length} {items.length === 1 ? 'item' : 'items'} in order</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-900">মোট: ৳{grandTotal.toLocaleString()}</span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                  অগ্রিম: ৳{advancePaymentAmount.toLocaleString()} {isFullPayment ? '(Full)' : ''}
                </span>
                {codAmount > 0 && (
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    বাকি: ৳{codAmount.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              {items.slice(0, 2).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2.5 bg-white p-2 rounded-lg border border-slate-100/80">
                  <img 
                    src={formatDirectImageUrl(item.image || item.thumbnail) || PLACEHOLDER_PRODUCT_IMAGE} 
                    alt={item.name} 
                    className="w-10 h-10 object-cover rounded-md bg-slate-100 shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => handleProductImageError(e)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Qty: {item.quantity || 1} {item.variant ? `• ${item.variant}` : ''} {item.color ? `• ${item.color}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-800 shrink-0">
                    ৳{((item.price || 0) * (item.quantity || 1)).toLocaleString()}
                  </span>
                </div>
              ))}
              {items.length > 2 && (
                <p className="text-[11px] text-center text-slate-500 italic">
                  +{items.length - 2} more item(s) in this order
                </p>
              )}
            </div>
          </div>
        )}

        {/* Shipping Address Preview */}
        {order.shippingAddress && (
          <div className="flex items-start gap-2 text-[11px] text-slate-500 px-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p className="line-clamp-1">
              Deliver to: <strong className="text-slate-700">{order.shippingAddress.name}</strong>, {order.shippingAddress.fullAddress || `${order.shippingAddress.upazila || ''}, ${order.shippingAddress.district || ''}`}
            </p>
          </div>
        )}

        {/* Authoritative Route & Parcel Info */}
        {(order.shippingSnapshot || order.vendorLocation || order.packageBreakdown) && (
          <div className="flex flex-wrap items-center justify-between text-[11px] bg-sky-50/70 border border-sky-100 rounded-lg p-2 gap-1 text-slate-600">
            <div className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-primary-main shrink-0" />
              <span>
                {order.shippingSnapshot?.vendorPackages?.[0]?.routeLabelBn || 
                 order.packageBreakdown?.routeLabelBn || 
                 'কুরিয়ার ডেলিভারি'}
                {order.vendorLocation?.district ? ` (${order.vendorLocation.district} হতে)` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>ডেলিভারি চার্জ: <strong className="text-slate-900">৳{deliveryCharge}</strong></span>
              {(order.shippingSnapshot?.totalWeightKg || order.totalWeightKg) && (
                <span className="text-slate-500">| ওজন: {Number(order.shippingSnapshot?.totalWeightKg || order.totalWeightKg).toFixed(2)} কেজি</span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-1 flex flex-wrap items-center gap-2">
          {showFullDetailsLink && (
            <Link
              to={`/orders/${orderId}`}
              className="flex-1 min-w-[170px] inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-primary-main hover:bg-sky-600 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Track Order & View Details</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

      </div>

      {/* Review Modal */}
      {reviewModalProduct && (
        <ReviewModal
          isOpen={true}
          onClose={() => setReviewModalProduct(null)}
          orderId={orderId}
          productId={reviewModalProduct.productId}
          productName={reviewModalProduct.productName}
          productImage={reviewModalProduct.productImage}
          vendorId={order.vendorId}
          vendorName={order.vendorName}
          onSuccess={async () => {
            setIsReviewedLocal(true);
            const oId = String(orderId || '');
            const pureId = oId.replace(/^#/, '');
            const isCod = isCodOrder(order);
            const now = Date.now();
            const updates: any = {
              reviewSubmitted: true,
              reviewCompleted: true,
              reviewedAt: now,
              reviewStatus: 'completed'
            };
            if (isCod) {
              await markCodOrderDelivered(pureId, {
                ...order,
                ...updates
              }, order.vendorId);
            } else {
              rtdbUpdate(`orders/${pureId}`, updates).catch(() => null);
              if (pureId !== oId) {
                rtdbUpdate(`orders/${oId}`, updates).catch(() => null);
              }
              rtdbUpdate(`vendor_orders/${pureId}`, updates).catch(() => null);
            }
            setReviewModalProduct(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
