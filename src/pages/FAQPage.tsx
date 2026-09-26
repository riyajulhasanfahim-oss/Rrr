import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { 
  HelpCircle, ArrowLeft, Search, ChevronDown, ChevronUp, 
  ShoppingBag, Truck, CreditCard, RotateCcw, Users, Store, Phone 
} from 'lucide-react';

interface FAQItem {
  q: string;
  a: string;
}

interface FAQCategory {
  id: string;
  name: string;
  icon: any;
  items: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
  {
    id: 'ordering',
    name: 'Ordering & Account',
    icon: ShoppingBag,
    items: [
      {
        q: 'How do I place an order on RJ WORLD BD?',
        a: 'Simply browse our catalog, select your preferred product, choose variant/color/size if applicable, and click "Buy Now" or "Add to Cart". In the checkout page, provide your recipient name, phone number, and delivery address, then choose Cash on Delivery or Online Payment.'
      },
      {
        q: 'Do I need an account to make a purchase?',
        a: 'You can browse products freely. Having an account allows you to track past orders in real time, save delivery addresses, maintain a wishlist, and participate in our Reseller and Referral earning programs.'
      },
      {
        q: 'Can I cancel or modify my order after placing it?',
        a: 'You can request cancellation directly from your Orders page as long as the status is "Processing" or "Order Placed". Once the vendor dispatches the parcel to the courier, cancellation is subject to courier return terms.'
      }
    ]
  },
  {
    id: 'delivery',
    name: 'Delivery & Shipping',
    icon: Truck,
    items: [
      {
        q: 'What are the delivery timelines across Bangladesh?',
        a: 'Inside Dhaka city, delivery typically takes 24 to 48 hours. Outside Dhaka across all 64 districts and upazilas, parcels are delivered within 3 to 5 business days.'
      },
      {
        q: 'Which courier services do you partner with?',
        a: 'We work with Bangladesh’s leading logistics providers including Steadfast Courier, Pathao Courier, RedX Logistics, Paperfly, and Sundarban Courier.'
      },
      {
        q: 'How can I track my shipment?',
        a: 'Navigate to "Track Order" from our footer or header, or go to your Account Orders page. When your order is dispatched, you will see the active courier name and a live consignment tracking button.'
      }
    ]
  },
  {
    id: 'payment',
    name: 'Payments & Security',
    icon: CreditCard,
    items: [
      {
        q: 'Is Cash on Delivery (COD) available?',
        a: 'Yes! Cash on Delivery is supported nationwide across Bangladesh. You pay the authorized courier agent upon physical receipt of the package at your doorstep.'
      },
      {
        q: 'What online payment methods are accepted?',
        a: 'We support secure digital transactions via Mobile Financial Services (bKash, Nagad, Rocket) and major Visa/MasterCard debit and credit cards through authorized payment gateways.'
      },
      {
        q: 'Is my payment information safe?',
        a: 'Absolutely. We do NOT store card PINs, CVVs, or bank credentials on our servers. All digital payments are processed through PCI-DSS compliant secure third-party gateway connections.'
      }
    ]
  },
  {
    id: 'returns',
    name: 'Returns & Refunds',
    icon: RotateCcw,
    items: [
      {
        q: 'What is your return policy?',
        a: 'If you receive a defective, damaged, or incorrect item, you can raise a return or dispute request within 3 days of delivery from your order details page. Please retain original packaging and product tags.'
      },
      {
        q: 'How long does a refund take?',
        a: 'Once the returned item is verified at our logistics hub, refunds to your bKash, Nagad, or bank account are processed within 3 to 7 working days.'
      }
    ]
  },
  {
    id: 'reseller',
    name: 'Reseller & Affiliate Program',
    icon: Users,
    items: [
      {
        q: 'How does the RJ WORLD BD Reseller Program work?',
        a: 'Anyone in Bangladesh can register as a Reseller for free. You get access to wholesale vendor prices, set your own selling price, share products or your personalized web store, and earn the net profit margin directly into your wallet upon successful delivery.'
      },
      {
        q: 'How do I withdraw my reseller earnings?',
        a: 'Once orders are marked as "Delivered" and verified, your profit moves to your unlocked wallet balance. You can withdraw directly to your bKash, Nagad, Rocket, or Bank account from your Reseller Dashboard.'
      },
      {
        q: 'How does the affiliate referral link work?',
        a: 'Share your unique referral code or link. When someone registers or shops through your link, our system attributes the referral to your account and grants you eligible referral bonuses and team rewards.'
      }
    ]
  },
  {
    id: 'vendor',
    name: 'Vendor & Shop Partnership',
    icon: Store,
    items: [
      {
        q: 'How can I sell my products on RJ WORLD BD as a Vendor?',
        a: 'Click "Become a Vendor" or register with a Vendor account. Complete your shop profile and business verification. Once approved, you can upload products, set stock and wholesale reseller prices, and fulfill orders.'
      },
      {
        q: 'When do vendors receive their order payouts?',
        a: 'Vendor payouts for delivered orders are credited to the vendor wallet and disbursed according to regular settlement schedules via bank transfer or mobile banking.'
      }
    ]
  }
];

export default function FAQPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'ordering-0': true,
    'delivery-0': true
  });

  const toggleItem = (key: string) => {
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredCategories = FAQ_DATA.map(cat => {
    if (activeCategory !== 'all' && cat.id !== activeCategory) {
      return null;
    }
    const matchingItems = cat.items.filter(it => 
      !search || 
      it.q.toLowerCase().includes(search.toLowerCase()) || 
      it.a.toLowerCase().includes(search.toLowerCase())
    );
    if (matchingItems.length === 0) return null;
    return { ...cat, items: matchingItems };
  }).filter(Boolean) as FAQCategory[];

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
          <span className="text-slate-800 font-semibold">FAQ</span>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-800 inline-block mb-2">
            Help & Knowledgebase
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            Find quick, comprehensive answers to common questions about orders, payments, delivery, returns, and reseller earnings.
          </p>

          {/* Search Box */}
          <div className="relative mt-5 max-w-md mx-auto">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions (e.g., delivery, bKash, refund)..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm shadow-2xs focus:border-primary-main focus:ring-1 focus:ring-primary-main"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-primary-main text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            All Questions
          </button>
          {FAQ_DATA.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-primary-main text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* FAQ Accordions */}
        <div className="space-y-6">
          {filteredCategories.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
              <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No matching questions found.</p>
              <p className="text-xs text-slate-400 mt-1">Try a different search term or contact our official support team.</p>
              <Link to="/contact" className="inline-block mt-4 px-4 py-2 bg-primary-main text-white rounded-xl text-xs font-bold">
                Contact Support
              </Link>
            </div>
          ) : (
            filteredCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.id} className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-sky-50 text-primary-main flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">{cat.name}</h2>
                  </div>

                  <div className="space-y-3">
                    {cat.items.map((it, idx) => {
                      const key = `${cat.id}-${idx}`;
                      const isOpen = Boolean(openItems[key]);
                      return (
                        <div 
                          key={key} 
                          className="border border-slate-100 rounded-xl overflow-hidden transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => toggleItem(key)}
                            className="w-full p-3.5 sm:p-4 text-left flex items-center justify-between gap-3 bg-slate-50/60 hover:bg-slate-50 cursor-pointer font-bold text-xs sm:text-sm text-slate-800 transition-colors"
                          >
                            <span>{it.q}</span>
                            {isOpen ? (
                              <ChevronUp className="w-4 h-4 text-primary-main shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                          </button>
                          {isOpen && (
                            <div className="p-3.5 sm:p-4 text-xs sm:text-sm text-slate-600 bg-white leading-relaxed border-t border-slate-100">
                              {it.a}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Still Have Questions Box */}
        <div className="mt-8 bg-sky-50 border border-sky-100 rounded-2xl p-6 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-main text-white flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Still have questions?</h3>
              <p className="text-xs text-slate-500">Call our helpline at +8809638969026 or message our support team.</p>
            </div>
          </div>
          <Link
            to="/contact"
            className="px-4 py-2 bg-primary-main hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs whitespace-nowrap"
          >
            Contact Customer Care
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
