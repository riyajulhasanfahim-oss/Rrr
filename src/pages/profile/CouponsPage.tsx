import React, { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { Gift, ArrowLeft, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getFirestoreCoupons } from '../../services/firestoreService';

export default function CouponsPage() {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const data = await getFirestoreCoupons();
      setCoupons(data);
    }
    load();
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code ${code} copied!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow pt-8 pb-16 px-4 md:px-8 max-w-4xl mx-auto w-full">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Available Coupons & Vouchers</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coupons.map((coupon, idx) => (
            <div 
              key={coupon.id || idx}
              className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white relative overflow-hidden flex items-center shadow-md"
            >
              <div className="absolute -left-4 w-8 h-8 bg-slate-50 rounded-full"></div>
              <div className="absolute -right-4 w-8 h-8 bg-slate-50 rounded-full"></div>
              <div className="flex-grow flex items-center justify-between pl-4 pr-2">
                <div>
                  <p className="text-3xl font-black mb-1">
                    {coupon.discountPercent ? `${coupon.discountPercent}% OFF` : `৳${coupon.discountFixed} OFF`}
                  </p>
                  <p className="text-white/90 text-sm font-medium">{coupon.title || 'Special Promotion'}</p>
                  {coupon.minSpend && (
                    <p className="text-white/80 text-xs mt-1">Min Spend: ৳{coupon.minSpend}</p>
                  )}
                </div>
                <div className="flex flex-col items-center border-l border-white/20 pl-6 border-dashed">
                  <span className="font-mono bg-white/20 px-3 py-1 rounded text-sm mb-2 font-bold tracking-widest">{coupon.code}</span>
                  <button 
                    onClick={() => copyCode(coupon.code)} 
                    className="text-xs bg-white text-orange-600 px-3 py-1.5 rounded-full font-bold hover:bg-orange-50 transition-colors flex items-center gap-1"
                  >
                    {copiedCode === coupon.code ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedCode === coupon.code ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
