import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, ArrowRight, XCircle, Smartphone, AlertCircle } from 'lucide-react';

export default function EmonPaySandboxPortal() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || 'UNKNOWN-ORDER';
  const amount = searchParams.get('amount') || '0';
  const initialMethod = searchParams.get('paymentMethod') || 'bkash';
  const customerName = searchParams.get('name') || 'Customer';

  const [selectedGateway, setSelectedGateway] = useState<string>(
    initialMethod.includes('nagad') ? 'nagad' : initialMethod.includes('rocket') ? 'rocket' : 'bkash'
  );
  const [phoneNumber, setPhoneNumber] = useState('01700000000');
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaySuccess = () => {
    setIsProcessing(true);
    const mockTrxId = `EP-SANDBOX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    setTimeout(() => {
      // Emon Pay official redirect format
      const returnUrl = `/payment/emonpay/callback?orderId=${encodeURIComponent(orderId)}&transactionId=${encodeURIComponent(mockTrxId)}&status=success&paymentAmount=${encodeURIComponent(amount)}&paymentMethod=${encodeURIComponent(selectedGateway)}`;
      window.location.href = returnUrl;
    }, 800);
  };

  const handlePayCancel = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const cancelUrl = `/payment/emonpay/callback?orderId=${encodeURIComponent(orderId)}&cancel=true&status=CANCELLED`;
      window.location.href = cancelUrl;
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-white" />
              <span className="font-extrabold text-lg tracking-tight">Emon Pay</span>
            </div>
            <p className="text-xs text-emerald-100 mt-0.5">Secure Hosted Payment Gateway (emonpay.xyz)</p>
          </div>
          <span className="text-[11px] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-black/25 text-emerald-200 border border-emerald-400/30">
            Sandbox Test
          </span>
        </div>

        {/* Order Info */}
        <div className="p-5 border-b border-slate-700 bg-slate-850/60">
          <div className="flex justify-between items-center text-sm mb-1.5">
            <span className="text-slate-400">Merchant</span>
            <span className="font-bold text-white">RJ World BD</span>
          </div>
          <div className="flex justify-between items-center text-sm mb-1.5">
            <span className="text-slate-400">Order ID</span>
            <span className="font-mono font-medium text-slate-200">{orderId}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Customer</span>
            <span className="font-medium text-slate-200">{customerName}</span>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700 flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Payable Amount</span>
            <span className="text-2xl font-black text-emerald-400">৳{amount}</span>
          </div>
        </div>

        {/* Gateway Selection */}
        <div className="p-5 space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            Select Payment Method
          </label>

          <div className="grid grid-cols-3 gap-2.5">
            {/* bKash */}
            <button
              type="button"
              onClick={() => setSelectedGateway('bkash')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                selectedGateway === 'bkash'
                  ? 'border-pink-500 bg-pink-950/40 text-pink-300 ring-2 ring-pink-500/30'
                  : 'border-slate-700 bg-slate-750 text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className="text-xs font-black tracking-tight mb-1 px-1.5 py-0.5 rounded bg-pink-600 text-white">bK</span>
              <span className="text-xs font-bold">bKash</span>
            </button>

            {/* Nagad */}
            <button
              type="button"
              onClick={() => setSelectedGateway('nagad')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                selectedGateway === 'nagad'
                  ? 'border-orange-500 bg-orange-950/40 text-orange-300 ring-2 ring-orange-500/30'
                  : 'border-slate-700 bg-slate-750 text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className="text-xs font-black tracking-tight mb-1 px-1.5 py-0.5 rounded bg-orange-600 text-white">NG</span>
              <span className="text-xs font-bold">Nagad</span>
            </button>

            {/* Rocket */}
            <button
              type="button"
              onClick={() => setSelectedGateway('rocket')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                selectedGateway === 'rocket'
                  ? 'border-purple-500 bg-purple-950/40 text-purple-300 ring-2 ring-purple-500/30'
                  : 'border-slate-700 bg-slate-750 text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className="text-xs font-black tracking-tight mb-1 px-1.5 py-0.5 rounded bg-purple-600 text-white">RK</span>
              <span className="text-xs font-bold">Rocket</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Account Mobile Number (Sandbox Demo)
            </label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="bg-slate-750 p-3 rounded-xl border border-slate-700/60 flex items-start gap-2.5 text-xs text-slate-400">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              This is the Emon Pay Sandbox Test Environment. Clicking &quot;Pay via ...&quot; will generate a test transaction and redirect back to RJ World BD.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handlePaySuccess}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isProcessing ? 'Processing Transaction...' : `Pay ৳${amount} via ${selectedGateway.toUpperCase()}`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handlePayCancel}
              disabled={isProcessing}
              className="w-full py-2.5 px-4 bg-slate-750 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-sm rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4 text-rose-400" />
              <span>Cancel Payment</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-900 px-5 py-3 border-t border-slate-700/80 text-center text-xs text-slate-500">
          Powered by Emon Pay (https://emonpay.xyz)
        </div>
      </div>
    </div>
  );
}
