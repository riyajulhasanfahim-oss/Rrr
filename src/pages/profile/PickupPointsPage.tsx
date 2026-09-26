import React from 'react';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { MapPin, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PickupPointsPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow pt-8 pb-16 px-4 md:px-8 max-w-4xl mx-auto w-full">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Pickup Points</h1>
        <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-100 text-center">
          <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Coming Soon</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-8">We are setting up convenient pickup points across the city. Check back later.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
