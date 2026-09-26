import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { ShieldCheck, ArrowLeft, Mail, Phone, MapPin } from 'lucide-react';

export default function TermsOfServicePage() {
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
          <span className="text-slate-800 font-semibold">Terms of Service</span>
        </div>

        {/* Hero Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-2xs mb-8">
          <div className="flex items-start gap-4 sm:gap-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-sky-50 text-primary-main flex items-center justify-center shrink-0 border border-sky-100">
              <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-800 inline-block mb-1.5">
                Platform Rules
              </span>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Terms of Service
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-2">
                Last Updated: September 2026 • RJ WORLD BD Marketplace & Reseller Ecosystem
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-2xs space-y-8 text-slate-700 leading-relaxed text-sm sm:text-base">
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">1. Acceptance of Terms</h2>
            <p className="text-slate-600">
              By accessing, browsing, registering, or making purchases on <strong>RJ WORLD BD</strong>, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">2. Marketplace Roles & Accounts</h2>
            <p className="text-slate-600 mb-2">
              Our platform accommodates three primary user categories:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-slate-600 text-sm">
              <li><strong>Shoppers:</strong> Browse products, place orders, make COD or digital payments, and receive deliveries.</li>
              <li><strong>Vendors:</strong> List genuine products, manage stock, package orders, and fulfill shipments reliably.</li>
              <li><strong>Resellers & Affiliates:</strong> Market products at customized retail prices, refer prospective buyers, and earn legitimate profit commissions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">3. Orders, Pricing & Payments</h2>
            <p className="text-slate-600">
              All prices are listed in Bangladeshi Taka (BDT). We support Cash on Delivery (COD) and approved online payment services. RJ WORLD BD reserves the right to cancel orders in case of stock unavailability, pricing glitches, or suspected fraudulent activity.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">4. Reseller Commission & Wallet Withdrawals</h2>
            <p className="text-slate-600">
              Reseller profit margins are credited upon successful parcel delivery and verification. Withdrawable balances can be requested to authorized bKash, Nagad, Rocket, or Bank accounts adhering to standard settlement schedules.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">5. Returns, Disputes & Cancellations</h2>
            <p className="text-slate-600">
              Customers may submit return or dispute requests within 3 days of delivery for damaged, incorrect, or defective products. Unboxing proof is required for speedy resolution.
            </p>
          </section>

          <section className="pt-4 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-2">6. Official Contact</h2>
            <p className="text-slate-600 text-sm">
              For any legal or contractual inquiries, reach us at:
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-slate-800">
              <span>Phone: +8809638969026</span>
              <span>•</span>
              <span>Email: support.rjworld@gmail.com</span>
              <span>•</span>
              <span>Location: Bangladesh</span>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
