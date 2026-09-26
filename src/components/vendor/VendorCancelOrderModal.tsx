import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, AlertCircle, CheckCircle2, Wallet, Ban, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { checkRefundEligibility, executeVendorOrderCancellation, CancelOrderResult } from '../../services/vendorOrderCancellationService';

interface VendorCancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  vendorId: string;
  onSuccess: (result: CancelOrderResult) => void;
}

const QUICK_REASONS = [
  'স্টক শেষ হয়ে গেছে',
  'কাঙ্ক্ষিত সাইজ/কালার অনুপলব্ধ',
  'পণ্য ক্ষতিগ্রস্ত বা ত্রুটিপূর্ণ পাওয়া গেছে',
  'কুরিয়ার ডেলিভারি সার্ভিস এরিয়া বহির্ভূত',
  'গ্রাহকের সাথে যোগাযোগ করা সম্ভব হয়নি'
];

export default function VendorCancelOrderModal({
  isOpen,
  onClose,
  order,
  vendorId,
  onSuccess
}: VendorCancelOrderModalProps) {
  const [cancelReason, setCancelReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCancelReason('');
      setSubmitting(false);
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const orderId = String(order.orderId || order.id || '').replace(/^#/, '');
  const eligibility = checkRefundEligibility(order);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const reasonTrimmed = cancelReason.trim();
    if (!reasonTrimmed) {
      toast.error('দয়া করে অর্ডার বাতিলের কারণ বা নোটিশ লিখুন');
      return;
    }

    setSubmitting(true);
    try {
      const result = await executeVendorOrderCancellation({
        order,
        vendorId,
        cancelReason: reasonTrimmed
      });

      if (result.success) {
        toast.success(result.message);
        onSuccess(result);
        onClose();
      } else {
        toast.error(result.message || 'অর্ডার বাতিল করা সম্ভব হয়নি');
      }
    } catch (err: any) {
      console.error('Error in vendor order cancellation:', err);
      toast.error(err.message || 'অর্ডার বাতিল করতে সমস্যা হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                অর্ডার বাতিল করুন (Cancel Order)
              </h3>
              <p className="text-xs text-slate-500">
                অর্ডার আইডি: <span className="font-semibold text-slate-700">#{orderId.substring(0, 10)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Customer & Order Summary */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>গ্রাহক:</span>
              <span className="font-semibold text-slate-800">{order.customerName || order.shippingAddress?.name || 'Customer'}</span>
            </div>
            {order.customerPhone && (
              <div className="flex justify-between text-slate-600">
                <span>ফোন নম্বর:</span>
                <span className="font-medium text-slate-700">{order.customerPhone}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>অর্ডার মোট মূল্য:</span>
              <span className="font-bold text-slate-900">৳{Number(order.grandTotal ?? order.total ?? 0)}</span>
            </div>
          </div>

          {/* Refund Notice Banner */}
          {eligibility.isEligibleForRefund ? (
            <div className="p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <span>অনলাইন পেমেন্ট শনাক্ত: ৳{eligibility.actualPaidAmount}</span>
                  <span className="px-1.5 py-0.5 text-[10px] bg-emerald-200 text-emerald-900 rounded font-semibold">পেইড</span>
                </div>
                <p className="text-emerald-800 leading-relaxed">
                  গ্রাহক অনলাইনে <strong>৳{eligibility.actualPaidAmount}</strong> পরিশোধ করেছেন। অর্ডার বাতিল করার সাথে সাথে এই সম্পূর্ণ টাকা সরাসরি গ্রাহকের ওয়ালেটে রিফান্ড হিসেবে যোগ হবে এবং তিনি তা উইথড্র করতে পারবেন।
                </p>
              </div>
            </div>
          ) : eligibility.isCod ? (
            <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-slate-800">পেমেন্ট মেথড: ক্যাশ অন ডেলিভারি (COD)</div>
                <p className="text-slate-600 leading-relaxed">
                  ক্যাশ অন ডেলিভারি অর্ডার হওয়ায় গ্রাহকের ওয়ালেটে কোনো টাকা রিফান্ড বা ট্রানজ্যাকশন যোগ হবে না।
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">পেমেন্ট স্থিতি: </span>
                <span>{eligibility.reason}</span>
              </div>
            </div>
          )}

          {/* Cancel Reason / Notice Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              গ্রাহকের জন্য বাতিলের কারণ / নোটিশ (Cancel Notice) <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="অর্ডার বাতিলের সুনির্দিষ্ট কারণ লিখুন (এটি গ্রাহক তার অর্ডার পেজে দেখতে পারবেন)..."
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none shadow-2xs"
            />
          </div>

          {/* Quick Reason Pills */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">দ্রুত কারণ নির্বাচন করুন:</span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setCancelReason(r)}
                  disabled={submitting}
                  className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Security Alert */}
          <div className="p-2.5 bg-red-50/60 rounded-xl border border-red-100 flex items-start gap-2 text-[11px] text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
            <span>অর্ডার একবার বাতিল করা হলে এটি আর পরিবর্তন করা যাবে না। নিশ্চিত হয়ে 'Confirm Cancel' ক্লিক করুন।</span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              ফিরে যান
            </button>
            <button
              type="submit"
              disabled={submitting || !cancelReason.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>বাতিল করা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  <span>Confirm Cancel</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
