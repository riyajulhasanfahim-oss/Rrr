import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Truck, 
  ExternalLink, 
  Copy, 
  Check, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Star, 
  XCircle, 
  Package,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  submitResellerProfitReview, 
  subscribeToResellerOrderAndReview,
  normalizeDeliveryStatus,
  type ResellerProfitReviewRecord,
  type ResellerOrderAndReviewState
} from '../../services/resellerProfitReviewService';
import { getCourierTrackingUrl } from '../../services/orderService';

interface ResellerProfitReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  resellerId: string;
  onSuccess?: () => void;
}

export default function ResellerProfitReviewModal({
  isOpen,
  onClose,
  order,
  resellerId,
  onSuccess
}: ResellerProfitReviewModalProps) {
  // Real-time state from RTDB Single Source of Truth
  const [rtdbState, setRtdbState] = useState<ResellerOrderAndReviewState | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form states
  const [rating, setRating] = useState<number>(5);
  const [reviewContent, setReviewContent] = useState('');
  const [resellerNote, setResellerNote] = useState('');
  const [verificationChecked, setVerificationChecked] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Copy tracking / order ID helpers
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(false);

  const orderId = String(order?.orderId || order?.id || '').replace(/^#/, '').trim();

  // Real-time subscription to RTDB as Single Source of Truth
  useEffect(() => {
    if (!isOpen || !orderId || !resellerId) return;

    setCheckingExisting(true);
    const unsubscribe = subscribeToResellerOrderAndReview(orderId, resellerId, (state) => {
      setRtdbState(state);
      setCheckingExisting(false);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, orderId, resellerId]);

  if (!isOpen || !order) return null;

  // Derive consolidated fields with RTDB state taking priority
  const currentOrder = rtdbState?.order || order;
  const rawStatus = rtdbState?.rawStatus || currentOrder.deliveryStatus || currentOrder.status || currentOrder.orderStatus || 'Pending';
  const isDelivered = rtdbState ? rtdbState.isDelivered : normalizeDeliveryStatus(rawStatus).isDelivered;
  const isCourierApproved = Boolean(
    rtdbState?.isCourierApproved ||
    currentOrder.courierVerificationStatus === 'Verified' ||
    currentOrder.courierAdminApproved === true ||
    currentOrder.courierAdminApproved === 'true' ||
    currentOrder.courierReviewStatus === 'approved'
  );
  const reviewStatus = rtdbState?.reviewStatus || (currentOrder.reviewStatus as any) || null;
  const profitStatus = rtdbState?.profitStatus || currentOrder.profitStatus || 'LOCKED';
  const existingReview = rtdbState?.review;

  const profitAmount = rtdbState?.lockedProfit ?? Number(
    currentOrder.lockedProfitAmount ?? 
    currentOrder.resellerProfit ?? 
    currentOrder.priceSnapshot?.resellerProfit ?? 
    0
  );

  const vendorId = currentOrder.vendorId || 'unknown_vendor';
  const courierName = rtdbState?.courierName || currentOrder.courierName || '';
  const trackingNumber = (rtdbState?.trackingNumber || currentOrder.trackingNumber || currentOrder.consignmentId || currentOrder.trackingId || '').trim();
  const rawUrl = (rtdbState?.trackingUrl || currentOrder.approvedCourierTrackingUrl || currentOrder.trackingUrl || currentOrder.courierTrackingUrl || '').trim();
  const liveTrackingUrl = getCourierTrackingUrl(courierName, trackingNumber, rawUrl);

  const items = Array.isArray(currentOrder.items) && currentOrder.items.length > 0 ? currentOrder.items : [];
  const firstItem = items[0] || {};
  const productName = firstItem.productName || firstItem.name || firstItem.title || currentOrder.productName || 'অর্ডারকৃত পণ্য';
  const productImage = firstItem.image || firstItem.thumbnail || currentOrder.productImage || '';
  const quantity = Number(currentOrder.quantity || items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0) || 1);

  const handleCopyTracking = () => {
    if (!trackingNumber) return;
    navigator.clipboard.writeText(trackingNumber);
    setCopiedTracking(true);
    toast.success('ট্র্যাকিং নম্বর কপি করা হয়েছে');
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(orderId);
    setCopiedOrderId(true);
    toast.success('অর্ডার আইডি কপি করা হয়েছে');
    setTimeout(() => setCopiedOrderId(false), 2000);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate Courier Verification by Admin
    if (!isCourierApproved) {
      const msg = 'কুরিয়ার ট্র্যাকিং লিংক এডমিন কর্তৃক এখনো ভেরিফাইড হয়নি। এডমিন অনুমোদনের পর আপনি ট্র্যাকিং লিংক চেক করে কমিশনের জন্য রিকোয়েস্ট পাঠাতে পারবেন।';
      setValidationError(msg);
      toast.error(msg);
      return;
    }

    // Validate Confirmation Checkbox
    if (!verificationChecked) {
      setValidationError('অনুগ্রহ করে কুরিয়ার ট্র্যাকিং যাচাইকরণ শর্তে টিক দিন।');
      toast.error('অনুগ্রহ করে ট্র্যাকিং যাচাই সংক্রান্ত শর্তে সম্মতি দিন।');
      return;
    }

    setLoading(true);
    try {
      const res = await submitResellerProfitReview({
        orderId,
        resellerId,
        vendorId,
        productId: firstItem.productId || firstItem.id || currentOrder.productId,
        productName,
        productImage,
        rating,
        reviewContent: reviewContent.trim() || 'কুরিয়ার ট্র্যাকিং লিংক যাচাই করে কমিশনের জন্য এডমিনকে রিকোয়েস্ট পাঠানো হয়েছে।',
        note: resellerNote.trim()
      });

      if (!res.success) {
        toast.error(res.message || 'রিকোয়েস্ট পাঠানো সম্ভব হয়নি।');
        setValidationError(res.message);
        return;
      }

      toast.success(res.message);
      setIsResubmitting(false);
      setValidationError(null);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Submit reseller review error:', err);
      toast.error(err.message || 'একটি ত্রুটি ঘটেছে। পুনরায় চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // Determine which state to render
  const isApprovedState = profitStatus === 'RELEASED' || reviewStatus === 'APPROVED';
  const isPendingState = reviewStatus === 'PENDING' || reviewStatus === 'PENDING_ADMIN_REVIEW';
  const isRejectedState = reviewStatus === 'REJECTED' && !isResubmitting;
  const isCourierPendingState = !isCourierApproved && !isApprovedState && !isPendingState;
  const isFormEligibleState = isCourierApproved && (!reviewStatus || isResubmitting || (reviewStatus !== 'PENDING' && reviewStatus !== 'PENDING_ADMIN_REVIEW' && reviewStatus !== 'APPROVED'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden my-6 transition-all">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                রিসেলার প্রফিট ভেরিফিকেশন রিভিউ
              </h2>
              <div className="flex items-center gap-2 text-xs text-purple-200 mt-0.5">
                <span>Order:</span>
                <span className="font-mono font-bold">#{orderId.substring(0, 10)}</span>
                <button
                  type="button"
                  onClick={handleCopyOrderId}
                  className="hover:text-white transition-colors cursor-pointer"
                  title="Copy Order ID"
                >
                  {copiedOrderId ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Product & Reserved Profit Summary */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {productImage ? (
                <img
                  src={productImage}
                  alt={productName}
                  className="w-12 h-12 object-cover rounded-lg border border-gray-200 bg-white shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                  <Package className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <h4 className="font-bold text-gray-900 text-xs sm:text-sm truncate">
                  {productName}
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  পরিমাণ: <strong>{quantity} টি</strong>
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[11px] text-gray-500 block">সংরক্ষিত প্রফিট</span>
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-base sm:text-lg font-extrabold text-purple-800">
                  ৳{profitAmount.toLocaleString('bn-BD')}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  profitStatus === 'RELEASED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-purple-100 text-purple-800 border border-purple-200'
                }`}>
                  <Lock className="w-2.5 h-2.5 inline mr-0.5" />
                  {profitStatus === 'RELEASED' ? 'RELEASED' : 'LOCKED'}
                </span>
              </div>
            </div>
          </div>

          {/* Courier & Live Tracking Status */}
          <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-700" />
                <span className="text-xs font-bold text-gray-800">ডেলিভারি ট্র্যাকিং</span>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isDelivered
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {isDelivered ? '✓ DELIVERED' : `IN TRANSIT: ${rawStatus}`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-gray-50 rounded-lg">
                <span className="text-[11px] text-gray-500 block">কুরিয়ার:</span>
                <span className="font-semibold text-gray-800 truncate block">
                  {courierName || 'Vendor Courier'}
                </span>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">ট্র্যাকিং নম্বর:</span>
                  {trackingNumber && (
                    <button
                      type="button"
                      onClick={handleCopyTracking}
                      className="text-purple-600 hover:text-purple-800 p-0.5 flex items-center gap-0.5 text-[10px] cursor-pointer"
                    >
                      {copiedTracking ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
                <span className="font-mono font-bold text-gray-900 truncate block text-[11px]">
                  {trackingNumber || 'আপডেট করা হচ্ছে...'}
                </span>
              </div>
            </div>

            {liveTrackingUrl && (
              <a
                href={liveTrackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-1.5 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg border border-purple-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>কুরিয়ার পোর্টালে সরাসরি ট্র্যাকিং দেখুন</span>
              </a>
            )}
          </div>

          {/* DYNAMIC REALTIME UI STATES */}

          {checkingExisting ? (
            <div className="py-8 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
              <span>রিয়েল-টাইম তথ্য যাচাই করা হচ্ছে...</span>
            </div>
          ) : isApprovedState ? (
            /* STATE D: ADMIN APPROVED */
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>প্রফিট ভেরিফিকেশন রিভিউ অনুমোদিত (APPROVED)</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                আপনার রিভিউটি অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে এবং রিসেলার প্রফিট <strong>৳{profitAmount.toLocaleString('bn-BD')}</strong> সফলভাবে আপনার ওয়ালেটে রিলিজ করা হয়েছে।
              </p>
              {existingReview?.approvedAt && (
                <div className="text-[11px] text-emerald-700 font-mono pt-1">
                  অনুমোদনের সময়: {new Date(existingReview.approvedAt).toLocaleString('bn-BD')}
                </div>
              )}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  ঠিক আছে (Close)
                </button>
              </div>
            </div>
          ) : isPendingState ? (
            /* STATE C: PROFIT REQUEST SUBMITTED / PENDING ADMIN REVIEW */
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <Clock className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>কমিশন রিকোয়েস্ট সফলভাবে জমা হয়েছে (PENDING_ADMIN_REVIEW)</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                আপনার কমিশনের রিকোয়েস্টটি জমা হয়েছে এবং তা বর্তমানে <strong>এডমিন পর্যালোচনার জন্য অপেক্ষমাণ রয়েছে</strong>। এডমিন কুরিয়ার ট্র্যাকিং ও ডেলিভারি তথ্য যাচাই করে অনুমোদন দেওয়ার পর প্রফিট আপনার ওয়ালেটে রিলিজ করা হবে।
              </p>
              <div className="pt-1 text-[11px] font-mono text-emerald-900/80 flex flex-wrap gap-x-4 gap-y-1">
                {existingReview?.reviewId && (
                  <span>Request ID: <strong>{existingReview.reviewId}</strong></span>
                )}
                {existingReview?.submittedAt && (
                  <span>Submitted: <strong>{new Date(existingReview.submittedAt).toLocaleString('bn-BD')}</strong></span>
                )}
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  ঠিক আছে (Close)
                </button>
              </div>
            </div>
          ) : isRejectedState ? (
            /* STATE E: ADMIN REJECTED */
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-2.5">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>রিকোয়েস্টটি এডমিন কর্তৃক বাতিল (REJECTED) করা হয়েছিল</span>
              </div>
              <p className="text-xs text-rose-800 leading-relaxed">
                বাতিলের কারণ: <strong>{existingReview?.rejectionReason || 'তথ্য যাচাইয়ে অসঙ্গতি পরিলক্ষিত হয়েছে।'}</strong>
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResubmitting(true);
                    setValidationError(null);
                  }}
                  className="w-full sm:flex-1 py-2 px-4 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>পুনরায় কমিশনের জন্য রিকোয়েস্ট করুন</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-xs rounded-xl transition-colors cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          ) : isCourierPendingState ? (
            /* STATE A: COURIER LINK PENDING ADMIN VERIFICATION */
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5 text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-amber-950">
                    কুরিয়ার ট্র্যাকিং লিংক এডমিন ভেরিফিকেশনের অপেক্ষায়
                  </h4>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    ভেন্ডরের দেওয়া কুরিয়ার ট্র্যাকিং লিংকটি বর্তমানে এডমিন পর্যালোচনার জন্য অপেক্ষমাণ রয়েছে। এডমিন কুরিয়ার ট্র্যাকিং লিংক যাচাই করে অনুমোদন করার পর আপনি কুরিয়ারের লিংকে ঢুকে প্রোডাক্ট ডেলিভারি যাচাই করতে পারবেন এবং কমিশনের জন্য রিকোয়েস্ট পাঠাতে পারবেন।
                  </p>
                  <div className="mt-2 text-[11px] text-amber-900/80 font-medium">
                    (এডমিন কুরিয়ার লিংক অনুমোদন করলে এই বাটন স্বয়ংক্রিয়ভাবে সক্রিয় হবে, পেজ রিফ্রেশ করার প্রয়োজন নেই।)
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gray-200 text-gray-500 text-xs font-bold cursor-not-allowed opacity-80 flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-4 h-4" />
                  <span>এডমিন ভেরিফিকেশনের অপেক্ষায়</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          ) : (
            /* STATE B: ADMIN APPROVED COURIER -> RESELLER PROFIT REQUEST FORM */
            <form onSubmit={handleSubmitReview} className="space-y-4">
              {/* Highlight Notice Box as requested in brief */}
              <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl text-indigo-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-950 text-xs sm:text-sm">
                  <Truck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>কুরিয়ার ট্র্যাকিং ও ডেলিভারি যাচাই</span>
                </div>
                <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                  কুরিয়ারের লিংকে ঢুকে আপনার প্রোডাক্টটি কোথায় আছে যাচাই করুন। প্রোডাক্ট পেয়ে থাকলে আপনার কমিশনের জন্য এডমিনকে রিকোয়েস্ট পাঠান।
                </p>
                {liveTrackingUrl && (
                  <div className="pt-1">
                    <a
                      href={liveTrackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>কুরিয়ার ট্র্যাকিং পোর্টাল খুলুন</span>
                    </a>
                  </div>
                )}
              </div>

              {validationError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* 1. Rating */}
              <div>
                <label className="text-xs font-bold text-gray-800 block mb-1">
                  প্রোডাক্ট ও ডেলিভারি সন্তুষ্টি রেটিং (Rating)
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= rating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-amber-700 ml-2">
                    {rating === 5 ? '৫ স্টার (অসাধারণ)' : `${rating} স্টার`}
                  </span>
                </div>
              </div>

              {/* 2. Review Content */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-800 block">
                  ডেলিভারি বিবরণ বা সন্তুষ্টি নোট (ঐচ্ছিক)
                </label>
                <textarea
                  rows={2}
                  value={reviewContent}
                  onChange={(e) => {
                    setReviewContent(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="কাস্টমার পণ্যটি সঠিক অবস্থায় গ্রহণ করেছে কিনা সে বিষয়ে আপনার মন্তব্য লিখুন..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                />
              </div>

              {/* 3. Reseller Note (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-800 block">
                  এডমিনের জন্য নোট বা মন্তব্য (ঐচ্ছিক)
                </label>
                <textarea
                  rows={2}
                  value={resellerNote}
                  onChange={(e) => setResellerNote(e.target.value)}
                  placeholder="এডমিন পর্যালোচনার জন্য বিশেষ কোনো বার্তা থাকলে লিখুন..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                />
              </div>

              {/* 4. Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={verificationChecked}
                  onChange={(e) => {
                    setVerificationChecked(e.target.checked);
                    if (validationError) setValidationError(null);
                  }}
                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 h-4 w-4 cursor-pointer"
                />
                <span className="text-xs text-gray-700 leading-snug">
                  আমি কুরিয়ার ট্র্যাকিং লিংক যাচাই করেছি এবং নিশ্চিত করছি যে কাস্টমার পণ্যটি হাতে পেয়েছে।
                </span>
              </label>

              {/* Actions */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={loading || !verificationChecked}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  {loading ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>রিকোয়েস্ট পাঠানো হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>কমিশনের জন্য এডমিনকে রিকোয়েস্ট করুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
