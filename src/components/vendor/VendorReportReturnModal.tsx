import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface VendorReportReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  orderId: string;
  resellerProfit: number;
  loading: boolean;
}

const COMMON_REASONS = [
  'কাস্টমার পার্সেল গ্রহণ করতে অস্বীকৃতি জানিয়েছে (Customer Refused)',
  'ডেলিভারি ঠিকানা অসম্পূর্ণ বা ভুল ছিল (Address Incomplete / Wrong)',
  'কাস্টমারের ফোন বন্ধ বা রিসিভ হয়নি (Customer Unreachable)',
  'কুরিয়ার ডেলিভারি ফেইল্ড রিপোর্ট করেছে (Courier Delivery Failed)',
  'পণ্য নষ্ট বা ক্ষতিগ্রস্ত অবস্থায় ফেরত এসেছে (Product Damaged in Return)',
  'কাস্টমার পণ্য ফেরত (Return) পাঠিয়েছে (Customer Returned Product)'
];

export default function VendorReportReturnModal({
  isOpen,
  onClose,
  onSubmit,
  orderId,
  resellerProfit,
  loading
}: VendorReportReturnModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customNote, setCustomNote] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = selectedReason === 'অন্যান্য (Custom Reason)' || !selectedReason 
      ? customNote.trim() 
      : `${selectedReason}${customNote.trim() ? ` — ${customNote.trim()}` : ''}`;
    
    if (!finalReason) return;
    onSubmit(finalReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-50 to-orange-50 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                রিটার্ন / ডেলিভারি ফেইলিউর রিপোর্ট
              </h3>
              <p className="text-xs text-rose-800 font-medium">
                অর্ডার #{orderId} • Reseller Order Return Claim
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/80 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Guidance */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-950 text-sm">
                গুরুত্বপূর্ণ ভেন্ডর নির্দেশিকা:
              </div>
              <p className="text-amber-800 leading-relaxed font-medium">
                রিপোর্ট সাবমিট করলে সরাসরি আপনার Locked Balance থেকে টাকা সরানো হবে না। এটি একটি <strong>Return Request</strong> তৈরি করবে (Status: <span className="font-mono font-bold text-amber-950">PENDING_ADMIN_REVIEW</span>)।
              </p>
              <p className="text-amber-800 leading-relaxed">
                অ্যাডমিন কুরিয়ার ট্র্যাকিং ও ডেলিভারি স্ট্যাটাস ভেরিফাই করে অনুমোদন করলে, লকড থাকা রিসেলার প্রফিট (<strong>৳{resellerProfit.toLocaleString('bn-BD')}</strong>) স্বয়ংক্রিয়ভাবে আপনার <strong>Available Balance</strong>-এ যোগ হবে।
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                রিটার্ন বা ডেলিভারি ফেইলিউরের কারণ নির্বাচন করুন <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {COMMON_REASONS.map((r, idx) => (
                  <label
                    key={idx}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      selectedReason === r
                        ? 'border-rose-500 bg-rose-50/50 text-rose-950 font-semibold'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="returnReason"
                      value={r}
                      checked={selectedReason === r}
                      onChange={() => setSelectedReason(r)}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <span>{r}</span>
                  </label>
                ))}
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    selectedReason === 'অন্যান্য (Custom Reason)'
                      ? 'border-rose-500 bg-rose-50/50 text-rose-950 font-semibold'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="returnReason"
                    value="অন্যান্য (Custom Reason)"
                    checked={selectedReason === 'অন্যান্য (Custom Reason)'}
                    onChange={() => setSelectedReason('অন্যান্য (Custom Reason)')}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <span>অন্যান্য বিস্তারিত বিবরণ লিখুন</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                অতিরিক্ত বিবরণ / কুরিয়ার রিটার্ন নোট (ঐচ্ছিক)
              </label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="উদাহরণ: পার্সেল ফেরত আসার কুরিয়ার ট্র্যাকিং নোট বা তারিখ..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={loading || (!selectedReason && !customNote.trim())}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    রিপোর্ট জমা হচ্ছে...
                  </span>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>রিপোর্ট জমা দিন</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
