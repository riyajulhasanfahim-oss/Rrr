import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Loader2, 
  ExternalLink, Truck, ArrowRight, ShieldAlert, Globe, Copy, Check, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { submitVendorCourierLink, POPULAR_COURIER_LIST } from '../../services/courierReviewService';

interface CourierVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  vendorId?: string;
  onVerificationSuccess?: (record?: any) => void;
  onSuccess?: (record?: any) => void;
}

export default function CourierVerificationModal({
  isOpen,
  onClose,
  order,
  vendorId,
  onVerificationSuccess,
  onSuccess
}: CourierVerificationModalProps) {
  const [selectedCourier, setSelectedCourier] = useState<string>('Steadfast Courier');
  const [customCourierName, setCustomCourierName] = useState<string>('');
  const [trackingId, setTrackingId] = useState<string>('');
  const [trackingUrl, setTrackingUrl] = useState<string>('');
  const [vendorNotes, setVendorNotes] = useState<string>('');
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && order) {
      if (order.courierName) {
        if (POPULAR_COURIER_LIST.includes(order.courierName)) {
          setSelectedCourier(order.courierName);
        } else {
          setSelectedCourier('অন্যান্য / Other Courier');
          setCustomCourierName(order.courierName);
        }
      } else {
        setSelectedCourier('Steadfast Courier');
        setCustomCourierName('');
      }

      setTrackingId(order.trackingNumber || order.consignmentId || '');
      setTrackingUrl(order.trackingUrl || '');
      setVendorNotes(order.courierVendorNotes || '');
      setAcknowledged(false);
      setIsSubmitting(false);
    }
  }, [isOpen, order]);

  if (!isOpen) return null;

  const resolvedCourierName = selectedCourier === 'অন্যান্য / Other Courier'
    ? customCourierName.trim()
    : selectedCourier;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reseller Order check: Cannot submit tracking link before order confirmation & profit lock
    const isReseller = Boolean(
      order?.isResellerOrder || 
      order?.resellerId || 
      order?.profitStatus || 
      order?.priceSnapshot?.resellerProfit
    );
    const isConfirmed = order?.vendorOrderStatus === 'CONFIRMED' || order?.profitStatus === 'LOCKED';
    if (isReseller && !isConfirmed) {
      toast.error('রিসেলার অর্ডারের ক্ষেত্রে ট্র্যাকিং লিংক জমা দেওয়ার পূর্বে অবশ্যই ভেন্ডর অর্ডার ডিটেইলস থেকে "অর্ডার কনফার্ম করুন" সম্পন্ন করতে হবে।');
      return;
    }

    if (!resolvedCourierName) {
      toast.error('অনুগ্রহ করে কুরিয়ারের নাম প্রদান করুন');
      return;
    }
    if (!trackingId.trim()) {
      toast.error('কুরিয়ারের ট্র্যাকিং আইডি বা কনসাইনমেন্ট আইডি দিন');
      return;
    }
    if (!trackingUrl.trim()) {
      toast.error('কুরিয়ারের সরাসরি ট্র্যাকিং লিংক (Direct Tracking Link) দিন');
      return;
    }

    if (!acknowledged) {
      toast.error('সংরক্ষণ করার আগে সতর্কবার্তা পড়ে টিক দিন');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderId = order.id || order.orderId;
      const res = await submitVendorCourierLink({
        orderId,
        order,
        vendorId: vendorId || order.vendorId || '',
        courierName: resolvedCourierName,
        trackingId: trackingId.trim(),
        trackingUrl: trackingUrl.trim(),
        vendorNotes: vendorNotes.trim()
      });

      toast.success(res.message, { duration: 5000 });
      if (onSuccess) onSuccess({ status: 'Pending — Admin Review' });
      if (onVerificationSuccess) onVerificationSuccess({ status: 'Pending — Admin Review' });
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'কুরিয়ার ট্র্যাকিং লিংক জমা দেওয়া ব্যর্থ হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPendingReview = order?.courierVerificationStatus === 'Pending — Admin Review';
  const isVerified = order?.courierVerificationStatus === 'Verified' || !!order?.courierAdminApproved;
  const isRejected = order?.courierVerificationStatus === 'Rejected';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isVerified ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' :
              isPendingReview ? 'bg-amber-500/20 border-amber-400/30 text-amber-300' :
              isRejected ? 'bg-rose-500/20 border-rose-400/30 text-rose-300' :
              'bg-primary-main/20 border-primary-400/30 text-primary-300'
            }`}>
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight flex items-center gap-2">
                <span>কুরিয়ার ট্র্যাকিং লিংক</span>
                {isVerified && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-black">
                    🟢 Accepted/Verified
                  </span>
                )}
                {isPendingReview && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-400/40 text-amber-200 font-bold">
                    🟡 Pending Review
                  </span>
                )}
                {isRejected && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold">
                    ❌ Rejected
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                অর্ডার: <span className="font-mono text-primary-300 font-bold">#{order?.orderNumber || order?.id}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 1. LOCKED VIEW: PENDING ADMIN REVIEW (Strict Rule 2) */}
        {isPendingReview ? (
          <div className="p-6 space-y-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-inner">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
                <Clock className="w-3.5 h-3.5" />
                🟡 Pending — Admin Review
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                ট্র্যাকিং লিংক জমা হয়েছে এবং অ্যাডমিন পর্যালোচনায় রয়েছে
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                অ্যাডমিন কাস্টমার ও অর্ডারের তথ্যের সাথে কুরিয়ার ট্র্যাকিং লিংক মিলিয়ে যাচাই করছেন। <strong>অ্যাডমিন যাচাই সম্পন্ন না হওয়া পর্যন্ত লিংক আর Edit/Add করার সুযোগ নেই এবং একই অর্ডারের জন্য দ্বিতীয়বার লিংক সাবমিট করা যাবে না।</strong>
              </p>
            </div>

            {/* Submitted Info Card (Read-Only) */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-left space-y-2.5 max-w-md mx-auto text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-amber-200/60">
                <span className="text-slate-600">কুরিয়ার সার্ভিস:</span>
                <span className="font-bold text-slate-900">{order.courierName || 'কুরিয়ার'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-amber-200/60">
                <span className="text-slate-600">ট্র্যাকিং / কনসাইনমেন্ট আইডি:</span>
                <code className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-amber-300 text-slate-800">
                  {order.trackingNumber || order.trackingId || '-'}
                </code>
              </div>
              {order.trackingUrl && (
                <div className="pt-1">
                  <span className="text-slate-600 block mb-1">জমা দেওয়া ট্র্যাকিং লিংক:</span>
                  <a
                    href={order.trackingUrl.startsWith('http') ? order.trackingUrl : `https://${order.trackingUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-main hover:underline font-mono text-[11px] break-all inline-flex items-center gap-1"
                  >
                    <span>{order.trackingUrl}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
              >
                বুঝেছি, বন্ধ করুন
              </button>
            </div>
          </div>
        ) : isVerified ? (
          /* 2. LOCKED VIEW: VERIFIED / ACCEPTED (Strict Rule 4) */
          <div className="p-6 space-y-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                🟢 Accepted / Verified
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                কুরিয়ার ট্র্যাকিং লিংক অনুমোদিত ও সফলভাবে সংযুক্ত
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                অ্যাডমিন এই কুরিয়ার ট্র্যাকিং লিংকটি যাচাই করে অনুমোদন দিয়েছেন। <strong>আর কোনো নতুন Tracking Link যোগ করার অপশন থাকবে না।</strong> সিস্টেম স্বয়ংক্রিয়ভাবে কুরিয়ারের অফিসিয়াল ডেটা পর্যবেক্ষণ করছে।
              </p>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-left space-y-2.5 max-w-md mx-auto text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-emerald-200/60">
                <span className="text-slate-600">অনুমোদিত কুরিয়ার:</span>
                <span className="font-bold text-emerald-950">{order.courierName}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-emerald-200/60">
                <span className="text-slate-600">ট্র্যাকিং আইডি:</span>
                <code className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-300 text-emerald-900">
                  {order.trackingNumber || order.trackingId}
                </code>
              </div>
              {order.trackingUrl && (
                <div className="pt-2 text-center">
                  <a
                    href={order.trackingUrl.startsWith('http') ? order.trackingUrl : `https://${order.trackingUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs text-xs"
                  >
                    <span>কুরিয়ারের ওয়েবসাইটে লাইভ দেখুন</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        ) : (
          /* 3. ACTIVE SUBMISSION FORM (Fresh or Re-submitting after Rejection - Strict Rule 5) */
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            {/* If previously rejected, show clear rejection reason banner */}
            {isRejected && (
              <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs sm:text-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>পূর্বের কুরিয়ার ট্র্যাকিং লিংক বাতিল করা হয়েছে (Rejected by Admin)</span>
                </div>
                <div className="text-xs text-rose-950 bg-white/80 p-2.5 rounded-xl border border-rose-200">
                  <strong>বাতিলের কারণ:</strong> {order.courierRejectedReason || 'ভুল বা অকার্যকর ট্র্যাকিং লিংক দেওয়া হয়েছিল।'}
                </div>
                <p className="text-[11px] text-rose-700">
                  অ্যাডমিন অনুরোধ করেছেন সঠিক ও আসল কুরিয়ার ট্র্যাকিং লিংক দিয়ে পুনরায় রিভিউ-এর জন্য সাবমিট করতে।
                </p>
              </div>
            )}

            {/* Order Customer Summary Snapshot */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-slate-500 block">গ্রাহকের নাম:</span>
                <span className="font-bold text-slate-800">{order?.customerName || order?.shippingAddress?.name || 'গ্রাহক'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">ঠিকানা / এলাকা:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[200px] block">
                  {order?.shippingAddress?.city || order?.shippingAddress?.address || 'বাংলাদেশ'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">মোট মূল্য:</span>
                <span className="font-bold text-emerald-700">৳{Number(order?.total || order?.grandTotal || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* 1. Courier Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 block">
                কুরিয়ার সার্ভিস নির্বাচন করুন <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedCourier}
                onChange={(e) => setSelectedCourier(e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-hidden font-medium"
              >
                {POPULAR_COURIER_LIST.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Custom courier input if "Other" is chosen */}
              {selectedCourier === 'অন্যান্য / Other Courier' && (
                <div className="mt-2 animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={customCourierName}
                    onChange={(e) => setCustomCourierName(e.target.value)}
                    placeholder="কুরিয়ার সার্ভিসের পূর্ণ নাম লিখুন (উদাঃ সুন্দরবন এক্সপ্রেস / জননী)"
                    className="w-full text-xs sm:text-sm px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 outline-hidden font-medium"
                    required
                  />
                </div>
              )}
            </div>

            {/* 2. Tracking ID / Consignment ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 block">
                কুরিয়ার ট্র্যাকিং / কনসাইনমেন্ট আইডি (Tracking ID) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="উদাঃ SF84920194 বা PT-100238"
                className="w-full text-xs sm:text-sm font-mono px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-hidden"
                required
              />
            </div>

            {/* 3. Direct Tracking Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>সরাসরি ট্র্যাকিং লিংক (Direct Tracking Link) <span className="text-rose-500">*</span></span>
                {trackingUrl && (
                  <a
                    href={trackingUrl.startsWith('http') ? trackingUrl : `https://${trackingUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-main hover:underline text-[11px] font-semibold inline-flex items-center gap-1"
                  >
                    লিংক পরীক্ষা করুন <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </label>
              <input
                type="text"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="উদাঃ https://steadfast.com.bd/t/SF84920194"
                className="w-full text-xs sm:text-sm px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-hidden font-mono"
                required
              />
              <p className="text-[11px] text-slate-500">
                কুরিয়ারে পার্সেল এন্ট্রি করার পর গ্রাহক যেন সরাসরি নিজের পার্সেল ট্র্যাক করতে পারে সেই আসল লিংকটি দিন।
              </p>
            </div>

            {/* 4. Optional Vendor Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                অ্যাডমিনের জন্য কোনো নোট (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={vendorNotes}
                onChange={(e) => setVendorNotes(e.target.value)}
                placeholder="পার্সেল সংক্রান্ত বিশেষ তথ্য থাকলে লিখুন"
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 outline-hidden"
              />
            </div>

            {/* ========================================================= */}
            {/* CRITICAL PROMINENT WARNING (Mandated by USER_REQUEST) */}
            {/* ========================================================= */}
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-2.5 shadow-2xs">
              <div className="flex items-start gap-2.5 text-rose-900">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-black text-rose-800 tracking-tight leading-snug">
                    ⚠️ ভুয়া, ভুল বা প্রতারণামূলক Courier Tracking Link দিলে Vendor Account Suspend করা হতে পারে। শুধুমাত্র আসল Courier Tracking Link দিন।
                  </p>
                  <p className="text-[11px] text-rose-700 leading-normal">
                    আপনার জমা দেওয়া প্রতিটি ট্র্যাকিং লিংক অ্যাডমিন নিজে খুলে যাচাই করবেন। সাবমিট করার সাথে সাথে এটি লক হয়ে যাবে এবং অ্যাডমিন অনুমোদন করলেই কেবল Shipped স্ট্যাটাস হবে।
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-2 pt-2 border-t border-rose-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="w-4 h-4 text-rose-600 border-rose-400 rounded focus:ring-rose-500 mt-0.5 cursor-pointer"
                  required
                />
                <span className="text-xs font-bold text-rose-950">
                  আমি নিশ্চিত করছি যে এটি আসল ও সক্রিয় কুরিয়ার ট্র্যাকিং লিংক। আমি নিয়মাবলী মেনে চলতে সম্মত।
                </span>
              </label>
            </div>

            {/* Verification Status Notice */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
              <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-bold text-[11px] shrink-0">
                🟡 Pending — Admin Review
              </span>
              <span className="text-[11px] text-amber-800">
                সেভ করার সাথে সাথে স্ট্যাটাস 'Pending — Admin Review' দেখাবে এবং লিংক আর এডিট বা দ্বিতীয়বার সাবমিট করা যাবে না।
              </span>
            </div>

            {/* Form Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !acknowledged}
                className="px-5 py-2.5 bg-primary-main hover:bg-sky-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>জমা দেওয়া হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>কুরিয়ার ট্র্যাকিং জমা দিন</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
