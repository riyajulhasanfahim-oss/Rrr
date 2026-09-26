import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { 
  ShieldCheck, ArrowLeft, Mail, Phone, MapPin, 
  Lock, UserCheck, Package, Store, Users, Share2, 
  CreditCard, Truck, MessageSquare, Cookie, RefreshCw 
} from 'lucide-react';

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-4 sm:pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        {/* Breadcrumb & Back */}
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
          <span className="text-slate-800 font-semibold">Privacy Policy</span>
        </div>

        {/* Header Hero Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/80 mb-6 sm:mb-8">
          <div className="flex items-start gap-4 sm:gap-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-sky-50 text-primary-main flex items-center justify-center shrink-0 border border-sky-100">
              <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-800 inline-block mb-2">
                Official Legal Policy
              </span>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                Privacy Policy
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-2">
                Last Updated: September 2026 • RJ WORLD BD Marketplace & Reseller Platform
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-12 shadow-sm border border-slate-200/80 space-y-10 text-slate-700 leading-relaxed text-sm sm:text-base">

          {/* 1. Introduction */}
          <section id="section-1" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">1</span>
              Introduction
            </h2>
            <p className="text-slate-600">
              Welcome to <strong>RJ WORLD BD</strong> (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). We are an integrated multi-vendor e-commerce marketplace and reseller platform operating in Bangladesh. We respect your privacy and are committed to protecting the personal data of our customers, vendors, resellers, and affiliate partners. This Privacy Policy explains transparently what information we collect, how it is used, how it is safeguarded, and how you can exercise your rights regarding your personal information.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section id="section-2" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">2</span>
              Information We Collect
            </h2>
            <p className="text-slate-600 mb-2">
              We collect information directly from you when you register an account, place orders, apply as a vendor or reseller, share referral links, submit reviews, or contact customer support.
            </p>
            <p className="text-slate-600">
              We only collect information that is strictly necessary to provide, manage, and facilitate our marketplace services, order delivery, account security, and payment settlements.
            </p>
          </section>

          {/* 3. Account Information */}
          <section id="section-3" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">3</span>
              Account Information
            </h2>
            <p className="text-slate-600 mb-3">
              When creating an account on RJ WORLD BD, you provide basic credentials such as:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600 text-sm">
              <li>Full Name and Display Name</li>
              <li>Valid Email Address and Mobile Phone Number</li>
              <li>Authentication credentials (securely handled via Firebase Authentication)</li>
              <li>Account role (Customer, Vendor, Reseller, or Admin) and profile status</li>
            </ul>
          </section>

          {/* 4. Customer Order Information */}
          <section id="section-4" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">4</span>
              Customer Order Information
            </h2>
            <p className="text-slate-600 mb-3">
              When placing an order for products on our marketplace, we collect:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600 text-sm">
              <li>Recipient Full Name and Contact Phone Number</li>
              <li>Detailed Shipping Address (Division, District, Upazila/Thana, Area, and Street/House details)</li>
              <li>Selected products, quantities, color/size specifications, and product variants</li>
              <li>Selected delivery option and payment method (Cash on Delivery or Online Payment)</li>
              <li>Order notes or special delivery instructions provided by the customer</li>
            </ul>
          </section>

          {/* 5. Vendor/Seller Information */}
          <section id="section-5" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">5</span>
              Vendor/Seller Information
            </h2>
            <p className="text-slate-600 mb-3">
              When individuals or businesses apply to become a Vendor on RJ WORLD BD, we collect business details to maintain marketplace integrity:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600 text-sm">
              <li>Shop/Store Name, Store Logo, Cover Banner, and Business Description</li>
              <li>Business/Contact Phone Number, Business Email, and Physical Store/Warehouse Address</li>
              <li>Product catalog details (SKUs, pricing, stock count, specifications, product images)</li>
              <li>Vendor payout account details (bKash/Nagad/Rocket merchant/personal numbers or Bank Account details) for weekly/bi-weekly earnings disbursement</li>
              <li>Business verification documents when required for verified seller badges</li>
            </ul>
          </section>

          {/* 6. Reseller Information */}
          <section id="section-6" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">6</span>
              Reseller Information
            </h2>
            <p className="text-slate-600 mb-3">
              For participants in the RJ WORLD BD Reseller Network:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600 text-sm">
              <li>Reseller Store Name, custom shop URL slug, contact number, and branding assets</li>
              <li>Reseller pricing margins, customer order placements, and delivery tracking records</li>
              <li>Reseller Wallet balance, commission ledger transactions, and profit lock/unlock records</li>
              <li>Withdrawal disbursement details (Mobile Financial Service number or Bank details provided by the reseller)</li>
            </ul>
          </section>

          {/* 7. Affiliate/Referral Information */}
          <section id="section-7" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">7</span>
              Affiliate/Referral Information
            </h2>
            <p className="text-slate-600">
              When customers or partners share affiliate links or referral codes, our platform stores unique referral identifiers (such as referral codes or user IDs) to properly calculate referral bonuses and commissions. We record referral clicks and order attributions strictly to credit the rightful referrer.
            </p>
          </section>

          {/* 8. Payment Information */}
          <section id="section-8" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">8</span>
              Payment Information
            </h2>
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 mb-3 text-amber-900 text-xs sm:text-sm">
              <strong>Important Security Clarification:</strong> We do NOT store complete credit/debit card numbers, CVV/CVC codes, or banking passwords on our servers.
            </div>
            <p className="text-slate-600 mb-2">
              All digital online transactions (via bKash, Nagad, Rocket, or Debit/Credit Cards) are securely routed and processed through authorized third-party payment gateways and Mobile Financial Services.
            </p>
            <p className="text-slate-600">
              Our servers only store non-sensitive transactional records (such as Gateway Transaction ID, Payment Method name, paid amount, timestamp, and payment status) to confirm order fulfillment and process refunds when applicable. For Cash on Delivery (COD), payment is collected by the authorized courier agent upon delivery.
            </p>
          </section>

          {/* 9. Delivery and Courier Information */}
          <section id="section-9" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">9</span>
              Delivery and Courier Information
            </h2>
            <p className="text-slate-600 mb-3">
              To fulfill physical orders across Bangladesh, your delivery details (Recipient Name, Shipping Address, Phone Number, and COD Amount) are shared with trusted third-party courier and logistics partners, including:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600 text-sm">
              <li>Steadfast Courier Ltd.</li>
              <li>Pathao Courier</li>
              <li>RedX Logistics</li>
              <li>Paperfly / eCourier / Sundarban Courier (as assigned by vendors/platform)</li>
            </ul>
            <p className="text-slate-600 mt-2">
              We generate and display courier tracking numbers and consignment links so customers and resellers can follow their shipment status in real time.
            </p>
          </section>

          {/* 10. Product Reviews and User-Generated Content */}
          <section id="section-10" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">10</span>
              Product Reviews and User-Generated Content
            </h2>
            <p className="text-slate-600">
              When you post product reviews, ratings, comments, or customer photos on our platform, this content is publicly visible to other shoppers to help make informed purchasing decisions. Your registered name and review text will appear publicly, while private contact details (such as your phone number and full address) remain protected and are never published in public reviews.
            </p>
          </section>

          {/* 11. How We Use Information */}
          <section id="section-11" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">11</span>
              How We Use Information
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-slate-600 text-sm">
              <li>To process, confirm, dispatch, and track your marketplace orders.</li>
              <li>To enable vendor-customer and vendor-reseller order dispatch communications.</li>
              <li>To calculate and settle reseller commissions, profit margins, and vendor payouts accurately.</li>
              <li>To detect and prevent fraudulent transactions, unauthorized account access, and abusive activities.</li>
              <li>To provide customer service, resolve disputes, and process returns or refunds.</li>
              <li>To maintain platform performance, fix technical bugs, and improve user experience.</li>
            </ul>
          </section>

          {/* 12. How We Share Information */}
          <section id="section-12" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">12</span>
              How We Share Information
            </h2>
            <p className="text-slate-600 mb-2">
              We do <strong>not</strong> sell or rent your personal information to third-party advertisers or data brokers. Information is shared only in the following specific operational contexts:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600 text-sm">
              <li><strong>With Vendors:</strong> Necessary customer name, shipping address, and phone number for packaging and fulfillment.</li>
              <li><strong>With Courier Partners:</strong> Delivery contact and destination information to physically deliver the parcels.</li>
              <li><strong>With Payment Providers:</strong> Transaction identifiers and payment amounts to process electronic charges and refunds.</li>
              <li><strong>Legal Compliance:</strong> When required by Bangladesh law or authorized law enforcement authorities.</li>
            </ul>
          </section>

          {/* 13. Vendor/Reseller/Affiliate Data Handling */}
          <section id="section-13" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">13</span>
              Vendor/Reseller/Affiliate Data Handling
            </h2>
            <p className="text-slate-600">
              Vendors and Resellers agree to treat any customer information received solely for the purpose of order preparation, shipment coordination, and warranty support. Unauthorized sharing, downloading, or harvesting of customer data for external promotional campaigns is strictly prohibited under our platform terms.
            </p>
          </section>

          {/* 14. Cookies and Similar Technologies */}
          <section id="section-14" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">14</span>
              Cookies and Similar Technologies
            </h2>
            <p className="text-slate-600 mb-2">
              Our website uses browser Cookies, LocalStorage, and SessionStorage to maintain essential website operations:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600 text-sm">
              <li>Maintaining your active login session across page refreshes.</li>
              <li>Persisting items in your shopping cart and wishlist.</li>
              <li>Remembering referral attribution identifiers for active shopping sessions.</li>
              <li>Storing user preferences such as language or currency selection.</li>
            </ul>
          </section>

          {/* 15. Website Security */}
          <section id="section-15" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">15</span>
              Website Security
            </h2>
            <p className="text-slate-600">
              We employ industry-standard security safeguards including HTTPS/TLS encryption for all data transmitted between your browser and our servers, secure Firebase Realtime Database and Cloud Firestore access rules, token-based authentication, and role-based permissions to protect against unauthorized access, loss, or alteration of personal data.
            </p>
          </section>

          {/* 16. Data Retention */}
          <section id="section-16" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">16</span>
              Data Retention
            </h2>
            <p className="text-slate-600">
              We retain account information as long as your account remains active. Transaction and order records are preserved for accounting, dispute resolution, tax compliance, and warranty support purposes in accordance with applicable commercial standards.
            </p>
          </section>

          {/* 17. User Rights and Account Information */}
          <section id="section-17" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">17</span>
              User Rights and Account Information
            </h2>
            <p className="text-slate-600 mb-2">
              You maintain the right to:
            </p>
            <ul className="list-disc pl-6 space-y-1.5 text-slate-600 text-sm">
              <li>View and update your personal profile, delivery addresses, and contact numbers via your Account Dashboard.</li>
              <li>Change your account password securely at any time.</li>
              <li>Request correction of inaccurate personal data.</li>
              <li>Request deactivation or closure of your account by contacting our official support desk.</li>
            </ul>
          </section>

          {/* 18. Children's Privacy */}
          <section id="section-18" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">18</span>
              Children&apos;s Privacy
            </h2>
            <p className="text-slate-600">
              Our marketplace is intended for general audiences who are of legal age to enter into binding purchase contracts under Bangladesh law. We do not knowingly collect personal information directly from children under 13 without parental or guardian consent.
            </p>
          </section>

          {/* 19. Third-Party Services/Links */}
          <section id="section-19" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">19</span>
              Third-Party Services and Links
            </h2>
            <p className="text-slate-600">
              Our website may contain links to external websites, such as courier parcel tracking pages (e.g., Steadfast, Pathao) or payment gateways. We are not responsible for the privacy practices or content of third-party websites and advise users to review the privacy notices of external providers.
            </p>
          </section>

          {/* 20. Changes to Privacy Policy */}
          <section id="section-20" className="scroll-mt-20">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">20</span>
              Changes to Privacy Policy
            </h2>
            <p className="text-slate-600">
              We may update this Privacy Policy from time to time to reflect modifications in our features, operational practices, or regulatory requirements. Any updates will be published directly on this page with an updated &ldquo;Last Updated&rdquo; date. Continued use of RJ WORLD BD following posted changes constitutes acceptance of the revised policy.
            </p>
          </section>

          {/* 21. Contact Information */}
          <section id="section-21" className="scroll-mt-20 pt-4 border-t border-slate-100">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2.5 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-100 text-sky-800 text-xs font-bold">21</span>
              Contact Information
            </h2>
            <p className="text-slate-600 mb-4">
              If you have any questions, inquiries, or requests regarding this Privacy Policy or your personal data, please contact our official team using our verified contact credentials:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-primary-main shrink-0 shadow-2xs">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Location</p>
                  <p className="text-sm font-semibold text-slate-800">Bangladesh</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-primary-main shrink-0 shadow-2xs">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Official Phone</p>
                  <a href="tel:+8809638969026" className="text-sm font-semibold text-slate-800 hover:text-primary-main">
                    +8809638969026
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-primary-main shrink-0 shadow-2xs">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-bold uppercase">Email Support</p>
                  <a href="mailto:support.rjworld@gmail.com" className="text-sm font-semibold text-slate-800 hover:text-primary-main truncate block">
                    support.rjworld@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
}
