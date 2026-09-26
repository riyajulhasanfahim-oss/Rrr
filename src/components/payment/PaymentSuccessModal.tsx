import React, { useEffect, useState } from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';

interface PaymentSuccessModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  targetName?: string;
  onComplete: () => void;
  autoRedirectDelayMs?: number;
}

export default function PaymentSuccessModal({
  isOpen,
  title = 'আপনার পেমেন্ট সফল হয়েছে! 🎉',
  subtitle = 'Payment Successful',
  targetName = 'Dashboard',
  onComplete,
  autoRedirectDelayMs = 1500
}: PaymentSuccessModalProps) {
  const [countdown, setCountdown] = useState(autoRedirectDelayMs);

  useEffect(() => {
    if (!isOpen) return;

    setCountdown(autoRedirectDelayMs);
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, autoRedirectDelayMs - elapsed);
      setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onComplete();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, autoRedirectDelayMs, onComplete]);

  if (!isOpen) return null;

  return (
    <div 
      id="payment-success-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div 
        id="payment-success-modal-card"
        className="w-full max-w-sm bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl border border-gray-100 text-center relative animate-in zoom-in-95 duration-200"
      >
        {/* Animated Green Check Circle */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50/60 transition-transform animate-bounce duration-700">
          <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600" />
        </div>

        {/* Bengali and English Success Message as per requirement */}
        <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-1 leading-snug tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm font-bold text-emerald-600 tracking-wider uppercase mb-3">
          {subtitle}
        </p>

        <p className="text-xs sm:text-sm text-gray-500 mb-5 leading-relaxed">
          আপনাকে স্বয়ংক্রিয়ভাবে <span className="font-semibold text-gray-800">{targetName}</span>-এ নিয়ে যাওয়া হচ্ছে...
        </p>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-gray-100 rounded-full h-1.5 sm:h-2 overflow-hidden mb-4">
          <div 
            className="bg-emerald-500 h-full rounded-full transition-all duration-100 ease-linear"
            style={{ width: `${Math.max(0, 100 - (countdown / autoRedirectDelayMs) * 100)}%` }}
          />
        </div>

        {/* Quick redirect button if user doesn't want to wait */}
        <button
          type="button"
          onClick={onComplete}
          className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
        >
          <span>এখনই যান</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
