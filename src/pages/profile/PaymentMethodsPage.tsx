import React from 'react';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { CreditCard, ArrowLeft, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PaymentMethodsPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow pt-8 pb-16 px-4 md:px-8 max-w-4xl mx-auto w-full">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Payment Methods</h1>
          <button onClick={() => navigate('/saved-cards')} className="flex items-center gap-2 bg-primary-main text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-sky-600 transition-colors">
            <Plus className="w-4 h-4" /> Add Card
          </button>
        </div>
        
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center text-pink-500 font-bold text-sm">bKash</div>
               <span className="font-bold text-slate-800">bKash Mobile Wallet</span>
             </div>
             <span className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">Available</span>
          </div>
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 font-bold text-sm">Nagad</div>
               <span className="font-bold text-slate-800">Nagad Mobile Wallet</span>
             </div>
             <span className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">Available</span>
          </div>
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600"><CreditCard className="w-6 h-6"/></div>
               <span className="font-bold text-slate-800">Credit / Debit Card</span>
             </div>
             <button onClick={() => navigate('/saved-cards')} className="text-sm font-bold text-primary-main">Manage</button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
