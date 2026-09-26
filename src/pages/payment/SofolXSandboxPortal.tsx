import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle, ArrowLeft, Copy, Check, Lock, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SofolXSandboxPortal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const orderId = searchParams.get('orderId') || 'ORD-TXN';
  const amount = searchParams.get('amount') || '0';
  const name = searchParams.get('name') || 'Customer';
  const rawMethod = (searchParams.get('paymentMethod') || 'bkash').toLowerCase();

  const initialMethod: 'bkash' | 'nagad' | 'rocket' | 'upay' = 
    rawMethod.includes('nagad') ? 'nagad' :
    rawMethod.includes('rocket') ? 'rocket' :
    rawMethod.includes('upay') ? 'upay' : 'bkash';

  const [selectedMFS, setSelectedMFS] = useState<'bkash' | 'nagad' | 'rocket' | 'upay'>(initialMethod);
  const [copied, setCopied] = useState(false);
  const [senderPhone, setSenderPhone] = useState('');
  const [customTrxId, setCustomTrxId] = useState(`SX${Math.random().toString(36).substring(2, 9).toUpperCase()}`);
  const [isProcessing, setIsProcessing] = useState(false);

  const officialNumber = '01864670673';

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(officialNumber);
    setCopied(true);
    toast.success('নাম্বার কপি করা হয়েছে!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleConfirmPayment = () => {
    if (!customTrxId.trim()) {
      toast.error('অনুগ্রহ করে Transaction ID (TrxID) লিখুন');
      return;
    }

    setIsProcessing(true);
    toast.loading('পেমেন্ট যাচাই করা হচ্ছে...', { id: 'sofolx-verify' });

    setTimeout(() => {
      toast.success('পেমেন্ট সফলভাবে ভেরিফাই হয়েছে!', { id: 'sofolx-verify' });
      const callbackUrl = `/payment/sofolx/callback?orderId=${encodeURIComponent(orderId)}&transactionId=${encodeURIComponent(customTrxId.trim())}&paymentMethod=${selectedMFS}&paymentAmount=${amount}&status=COMPLETED`;
      navigate(callbackUrl);
    }, 1000);
  };

  const handleCancel = () => {
    const cancelUrl = `/payment/sofolx/callback?orderId=${encodeURIComponent(orderId)}&cancel=true&status=CANCELLED`;
    navigate(cancelUrl);
  };

  const methodDetails = {
    bkash: {
      name: 'bKash',
      color: 'border-pink-500 text-pink-600 bg-pink-50',
      activeTab: 'bg-pink-600 text-white border-pink-600 shadow-sm',
      bannerBg: 'bg-pink-600',
      label: 'বিকাশ পেমেন্ট',
      guide: 'বিকাশ অ্যাপে যান বা *247# ডায়াল করে Send Money অথবা Payment করুন।'
    },
    nagad: {
      name: 'Nagad',
      color: 'border-orange-500 text-orange-600 bg-orange-50',
      activeTab: 'bg-orange-600 text-white border-orange-600 shadow-sm',
      bannerBg: 'bg-orange-600',
      label: 'নগদ পেমেন্ট',
      guide: 'নগদ অ্যাপে যান বা *167# ডায়াল করে Send Money অথবা Merchant Pay করুন।'
    },
    rocket: {
      name: 'Rocket',
      color: 'border-purple-500 text-purple-600 bg-purple-50',
      activeTab: 'bg-purple-600 text-white border-purple-600 shadow-sm',
      bannerBg: 'bg-purple-600',
      label: 'রকেট পেমেন্ট',
      guide: 'রকেট অ্যাপে গিয়ে Send Money করুন।'
    },
    upay: {
      name: 'Upay',
      color: 'border-blue-500 text-blue-600 bg-blue-50',
      activeTab: 'bg-blue-600 text-white border-blue-600 shadow-sm',
      bannerBg: 'bg-blue-600',
      label: 'উপায় পেমেন্ট',
      guide: 'উপায় অ্যাপে গিয়ে Send Money করুন।'
    }
  };

  const current = methodDetails[selectedMFS];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-3 sm:p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
        {/* SofolX Brand Header */}
        <div className="bg-emerald-700 text-white p-5 sm:p-6 text-center relative overflow-hidden">
          <div className="flex items-center justify-center gap-2 mb-1">
            <ShieldCheck className="w-6 h-6 text-emerald-300" />
            <span className="text-xl sm:text-2xl font-black tracking-tight">SofolX SecurePay</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-200">
            <Lock className="w-3 h-3" />
            <span>256-Bit SSL Encrypted Official Payment Portal</span>
          </div>

          <div className="mt-4 bg-emerald-800/70 backdrop-blur-xs rounded-2xl p-3 inline-block border border-emerald-600/50 min-w-[180px]">
            <span className="text-[11px] text-emerald-200 block uppercase tracking-wider font-semibold">Total Payable</span>
            <span className="text-2xl sm:text-3xl font-black">৳{amount}</span>
          </div>
        </div>

        {/* Order Details */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>অর্ডার নাম্বার:</span>
              <span className="font-bold text-slate-900 font-mono">#{orderId}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>গ্রাহক:</span>
              <span className="font-semibold text-slate-900">{name}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>মার্চেন্ট:</span>
              <span className="font-semibold text-slate-900">RJ WORLD BD</span>
            </div>
          </div>

          {/* MFS Selector */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">
              পেমেন্ট মাধ্যম বেছে নিন
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['bkash', 'nagad', 'rocket', 'upay'] as const).map((mfsKey) => {
                const info = methodDetails[mfsKey];
                const isActive = selectedMFS === mfsKey;
                return (
                  <button
                    key={mfsKey}
                    type="button"
                    onClick={() => setSelectedMFS(mfsKey)}
                    className={`py-2.5 px-3 rounded-xl border-2 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
                      isActive
                        ? info.activeTab
                        : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>{info.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step-by-Step Payment Instructions */}
          <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950">
                {current.label} নাম্বার:
              </span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Personal / Merchant
              </span>
            </div>

            {/* Official Number with 1-click Copy */}
            <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-emerald-300 shadow-xs">
              <div className="font-mono text-base sm:text-lg font-black text-slate-900 tracking-wider">
                {officialNumber}
              </div>
              <button
                type="button"
                onClick={handleCopyNumber}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'কপি হয়েছে' : 'কপি করুন'}</span>
              </button>
            </div>

            {/* Steps text */}
            <div className="text-[11px] text-slate-600 space-y-1 pl-1">
              <p>১. {current.guide}</p>
              <p>২. প্রাপক নাম্বারে <strong>{officialNumber}</strong> দিন এবং <strong>৳{amount}</strong> পাঠান।</p>
              <p>৩. পেমেন্ট সম্পন্ন হলে পাওয়া Transaction ID (TrxID) নিচে দিয়ে কনফার্ম করুন।</p>
            </div>
          </div>

          {/* Customer Inputs */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                আপনার {current.name} একাউন্ট নাম্বার (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Transaction ID (TrxID) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-500">
                  স্বয়ংক্রিয়ভাবে প্রস্তুতকৃত
                </span>
              </div>
              <input
                type="text"
                value={customTrxId}
                onChange={(e) => setCustomTrxId(e.target.value.toUpperCase())}
                placeholder="e.g. SX9F82KC4A"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono font-bold tracking-wider text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirmPayment}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle className="w-5 h-5" />
              <span>{isProcessing ? 'যাচাই করা হচ্ছে...' : `পেমেন্ট নিশ্চিত করুন (৳${amount})`}</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleCancel}
              className="w-full py-2 text-slate-500 hover:text-slate-700 font-medium text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>অর্ডার বাতিল করে ফিরে যান</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
