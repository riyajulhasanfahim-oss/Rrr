import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { 
  Building2, Users, ShoppingBag, ShieldCheck, 
  Truck, ArrowLeft, ArrowRight, Award, CheckCircle2,
  Phone, Mail, MapPin, Store, HeartHandshake
} from 'lucide-react';

export default function AboutUsPage() {
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
          <span className="text-slate-800 font-semibold">About Us</span>
        </div>

        {/* Hero Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 text-white rounded-2xl sm:rounded-3xl p-6 sm:p-12 shadow-md relative overflow-hidden mb-8">
          <div className="relative z-10 max-w-2xl">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary-main/20 text-sky-300 border border-sky-400/30 inline-block mb-3">
              About RJ WORLD BD
            </span>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-4">
              Building Bangladesh&apos;s Leading Multi-Vendor & Reseller Marketplace
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              RJ WORLD BD connects verified vendors, aspiring digital entrepreneurs, and nationwide shoppers into a single, high-trust commerce ecosystem.
            </p>
          </div>
          <div className="absolute right-0 top-0 w-96 h-96 bg-primary-main/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 text-center shadow-2xs">
            <p className="text-2xl sm:text-3xl font-black text-primary-main">64</p>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">Districts Delivery</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 text-center shadow-2xs">
            <p className="text-2xl sm:text-3xl font-black text-primary-main">100%</p>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">Genuine Quality</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 text-center shadow-2xs">
            <p className="text-2xl sm:text-3xl font-black text-primary-main">COD</p>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">Cash on Delivery</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 text-center shadow-2xs">
            <p className="text-2xl sm:text-3xl font-black text-primary-main">24/7</p>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">Customer Support</p>
          </div>
        </div>

        {/* Mission & Vision */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-2xs mb-8 space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Our Mission</h2>
          <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
            At RJ WORLD BD, our mission is to democratize digital commerce in Bangladesh. We provide authentic, quality-checked products at honest prices while empowering local manufacturers, vendors, and micro-entrepreneurs (resellers) to start and scale their business with zero upfront inventory risks.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center mb-3">
                <Store className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">For Customers</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Enjoy transparent pricing, cash on delivery, fast nationwide delivery, and hassle-free returns on genuine items.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">For Resellers</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Build your own online brand and earn verified profit margins on every product sold through your personalized shop or links.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">For Vendors</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Expand your sales across Bangladesh via thousands of active resellers and direct marketplace shoppers with reliable payouts.
              </p>
            </div>
          </div>
        </div>

        {/* Contact Strip */}
        <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg sm:text-xl font-bold mb-1">Have questions or want to partner with us?</h3>
            <p className="text-xs sm:text-sm text-slate-400">Our official support team is always ready to assist you.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link 
              to="/contact" 
              className="px-5 py-2.5 rounded-xl bg-primary-main hover:bg-sky-500 text-white text-xs sm:text-sm font-bold transition-colors shadow-xs"
            >
              Contact Us
            </Link>
            <Link 
              to="/products" 
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition-colors border border-slate-700"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
