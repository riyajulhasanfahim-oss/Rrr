import React, { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { 
  RotateCcw, 
  ArrowLeft, 
  Package, 
  ShieldCheck, 
  HelpCircle, 
  Clock, 
  CheckCircle2, 
  HeadphonesIcon, 
  ChevronRight,
  Truck,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchCustomerOrders } from '../../services/orderService';

export default function ReturnsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'returns' | 'policy'>(() => user ? 'returns' : 'policy');
  const [returnOrders, setReturnOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(Boolean(user));

  useEffect(() => {
    const fetchReturnOrders = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // Query orders that have return / dispute / refunded / cancelled status using RTDB customer orders
        const docs = await fetchCustomerOrders(user.uid, user.phoneNumber, user.email);
        const returns = docs.filter((o: any) => 
          o.status === 'Returned' || 
          o.status === 'Dispute' || 
          o.status === 'Refunded' ||
          o.vendorPayoutStatus === 'Refunded' ||
          o.vendorPayoutStatus === 'Disputed' ||
          o.dispute
        );
        setReturnOrders(returns);
      } catch (e) {
        console.error('Error fetching returns:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchReturnOrders();
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-2.5 sm:pt-6 pb-24 md:pb-16 px-3 sm:px-6 max-w-4xl mx-auto w-full">
        {/* Top Mobile Bar */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-1.5 sm:p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">
                Returns & Refunds
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Track return requests and refund policy
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/customer-care')}
            className="flex items-center gap-1 text-xs font-semibold text-primary-main bg-sky-50 px-2.5 py-1.5 rounded-lg hover:bg-sky-100 transition-colors"
          >
            <HeadphonesIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Help</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-200/60 p-1 rounded-xl mb-4 max-w-sm">
          <button
            onClick={() => setActiveTab('returns')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center ${
              activeTab === 'returns'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active Returns ({returnOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('policy')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center ${
              activeTab === 'policy'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Return Policy & Guide
          </button>
        </div>

        {activeTab === 'returns' ? (
          <div>
            {loading ? (
              <div className="bg-white rounded-xl p-4 shadow-2xs border border-slate-200/80 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-3"></div>
                <div className="h-10 bg-slate-200 rounded w-full"></div>
              </div>
            ) : returnOrders.length > 0 ? (
              <div className="space-y-3">
                {returnOrders.map(order => (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-2xs border border-slate-200/80"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                      <span className="text-xs font-bold text-slate-800">
                        Order #{order.orderId || order.id.substring(0, 8)}
                      </span>
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        {order.status || 'Return Requested'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div>
                        <p className="text-xs text-slate-500">Refund Amount</p>
                        <p className="text-sm font-bold text-slate-900">
                          ৳{(order.total || 0).toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(`/orders/${order.orderId || order.id}`)}
                        className="text-xs font-bold text-primary-main hover:underline flex items-center gap-1"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : !user ? (
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xs border border-slate-200/80 text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-primary-main">
                  <RotateCcw className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                  Sign In to View Returns
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto mb-5 leading-relaxed">
                  Please log in to your account to view your past orders, active returns, or dispute statuses.
                </p>
                <div className="flex justify-center max-w-xs mx-auto">
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full bg-primary-main text-white py-2 px-4 rounded-xl font-bold text-xs sm:text-sm hover:bg-sky-600 active:scale-95 transition-all shadow-xs"
                  >
                    Sign In to Account
                  </button>
                </div>
              </div>
            ) : (
              /* Empty State (Compact & Mobile Friendly) */
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xs border border-slate-200/80 text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-primary-main">
                  <RotateCcw className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                  No Active Returns
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto mb-5 leading-relaxed">
                  You do not have any ongoing return or refund requests at this moment.
                </p>

                <div className="flex flex-col sm:flex-row gap-2.5 justify-center max-w-xs mx-auto">
                  <button
                    onClick={() => navigate('/orders?tab=Delivered')}
                    className="w-full bg-primary-main text-white py-2 px-4 rounded-xl font-bold text-xs sm:text-sm hover:bg-sky-600 active:scale-95 transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Package className="w-4 h-4" />
                    <span>Return from Delivered Orders</span>
                  </button>
                  <button
                    onClick={() => navigate('/orders')}
                    className="w-full bg-slate-100 text-slate-700 py-2 px-4 rounded-xl font-semibold text-xs sm:text-sm hover:bg-slate-200 transition-colors"
                  >
                    View All Orders
                  </button>
                </div>
              </div>
            )}

            {/* Quick Return Assistance Info Card */}
            <div className="mt-4 bg-white rounded-xl sm:rounded-2xl p-4 shadow-2xs border border-slate-200/80">
              <div className="flex items-center gap-2 mb-2 text-slate-900 font-bold text-xs sm:text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>How to request a return?</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                If you received a damaged, defective, or incorrect product, go to your <strong>Delivered Orders</strong>, open the order details, and tap <strong>"Dispute / Return"</strong> within 7 days of delivery.
              </p>
            </div>
          </div>
        ) : (
          /* Return Policy & Guidelines Tab */
          <div className="space-y-3">
            {/* 7 Days Policy Guarantee Banner */}
            <div className="bg-gradient-to-r from-sky-500 to-primary-main text-white rounded-xl sm:rounded-2xl p-4 shadow-xs">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-sky-200" />
                <h3 className="font-bold text-sm sm:text-base">7-Day Easy Return Guarantee</h3>
              </div>
              <p className="text-xs text-sky-100 leading-relaxed">
                Enjoy peace of mind with our 100% money-back guarantee if your product is damaged, incorrect, or missing parts.
              </p>
            </div>

            {/* 3 Step Return Process */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 shadow-2xs border border-slate-200/80">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-3">
                Simple 3-Step Return Process
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex sm:flex-col items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-7 h-7 rounded-full bg-sky-100 text-primary-main flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Submit Request</p>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Go to Delivered Orders and submit a return request with photos.
                    </p>
                  </div>
                </div>

                <div className="flex sm:flex-col items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-7 h-7 rounded-full bg-sky-100 text-primary-main flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Courier Pickup</p>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Our courier partner will pick up the package from your doorstep.
                    </p>
                  </div>
                </div>

                <div className="flex sm:flex-col items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Instant Refund</p>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Refund is disbursed to your Wallet, bKash, or original payment method.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Conditions Card */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 shadow-2xs border border-slate-200/80">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Return Conditions</span>
              </h4>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>Item must be unused, unwashed, and in original condition.</li>
                <li>Original brand tags, packaging, and accessories must be intact.</li>
                <li>Request must be initiated within 7 calendar days of delivery.</li>
              </ul>
            </div>

            {/* Contact Support */}
            <div className="bg-slate-100 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">Need help with a return?</p>
                <p className="text-[11px] text-slate-500">Our customer support team is available 24/7</p>
              </div>
              <button
                onClick={() => navigate('/customer-care')}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                Contact Us
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
