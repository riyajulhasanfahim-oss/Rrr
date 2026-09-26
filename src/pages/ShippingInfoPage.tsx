import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { 
  Truck, ArrowLeft, Clock, MapPin, Package, 
  ShieldCheck, CheckCircle2, AlertCircle, Phone 
} from 'lucide-react';

export default function ShippingInfoPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-4 sm:pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6">
          <button 
            type="button"
            onClick={() => navigate(-1)} 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <span>/</span>
          <Link to="/" className="hover:text-primary-main">Home</Link>
          <span>/</span>
          <span className="text-slate-800 font-semibold">Shipping Information</span>
        </div>

        {/* Hero Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-2xs mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-primary-main flex items-center justify-center shrink-0 border border-sky-100">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-800 inline-block mb-1.5">
                Nationwide Logistics
              </span>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Shipping & Delivery Information
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-2">
                Fast, reliable, and trackable doorstep delivery across all 64 districts in Bangladesh.
              </p>
            </div>
          </div>
        </div>

        {/* Delivery Zones & Timelines */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Inside Dhaka City</h2>
                <p className="text-xs text-slate-400">Express Delivery</p>
              </div>
            </div>

            <div className="space-y-2 text-xs sm:text-sm text-slate-600">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="font-medium text-slate-700">Estimated Delivery Time</span>
                <span className="font-bold text-slate-900">24 – 48 Hours</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="font-medium text-slate-700">Standard Delivery Charge</span>
                <span className="font-bold text-slate-900">৳60 – ৳80 (Weight-based)</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="font-medium text-slate-700">Cash on Delivery (COD)</span>
                <span className="font-bold text-emerald-600">Fully Supported</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Outside Dhaka (All 64 Districts)</h2>
                <p className="text-xs text-slate-400">Nationwide District & Upazila Coverage</p>
              </div>
            </div>

            <div className="space-y-2 text-xs sm:text-sm text-slate-600">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="font-medium text-slate-700">Estimated Delivery Time</span>
                <span className="font-bold text-slate-900">3 – 5 Business Days</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                <span className="font-medium text-slate-700">Standard Delivery Charge</span>
                <span className="font-bold text-slate-900">৳120 – ৳150 (Weight-based)</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="font-medium text-slate-700">Cash on Delivery (COD)</span>
                <span className="font-bold text-emerald-600">Fully Supported</span>
              </div>
            </div>
          </div>
        </div>

        {/* Courier Partners */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs mb-8 space-y-6">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Authorized Logistics & Courier Partners</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Your parcels are handled by verified, high-speed courier networks with full tracking capabilities.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <p className="font-bold text-slate-900 text-sm">Steadfast Courier</p>
              <p className="text-[11px] text-slate-500 mt-1">Direct consignment tracking</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <p className="font-bold text-slate-900 text-sm">Pathao Courier</p>
              <p className="text-[11px] text-slate-500 mt-1">Express city delivery</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <p className="font-bold text-slate-900 text-sm">RedX Logistics</p>
              <p className="text-[11px] text-slate-500 mt-1">Doorstep parcel service</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <p className="font-bold text-slate-900 text-sm">Paperfly & Sundarban</p>
              <p className="text-[11px] text-slate-500 mt-1">Remote upazila network</p>
            </div>
          </div>
        </div>

        {/* Packaging & Inspection Guidelines */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Doorstep Delivery Guidelines</h2>
          <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Parcel Inspection:</strong> Please check the external condition of the packaging before accepting delivery from the courier agent.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>COD Payment:</strong> Hand over the exact order amount to the delivery rider and receive your official delivery confirmation.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Disputes & Issues:</strong> If an item is incorrect or physically damaged, take clear unboxing photos/video and raise a dispute on your Orders page within 3 days.
              </span>
            </li>
          </ul>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Phone className="w-4 h-4 text-primary-main" />
              <span>Delivery Helpline: +8809638969026</span>
            </div>
            <Link
              to="/track-order"
              className="px-4 py-2 bg-primary-main hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              Track Your Existing Order
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
