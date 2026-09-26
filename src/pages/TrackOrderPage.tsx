import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { 
  Package, Truck, Search, CheckCircle2, Clock, 
  MapPin, Phone, ArrowLeft, ExternalLink, AlertCircle, 
  ChevronRight, RefreshCw, Copy, Check 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { rtdbGet, rtdbList } from '../lib/rtdb';
import { useAuth } from '../context/AuthContext';
import { getCourierTrackingUrl } from './OrderDetailsPage';

export default function TrackOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [orderQuery, setOrderQuery] = useState(searchParams.get('id') || '');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleTrack = async (idToSearch?: string) => {
    const rawId = (idToSearch || orderQuery).trim();
    if (!rawId) {
      toast.error('Please enter an Order ID or Consignment/Tracking Number');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      // 1. Direct RTDB fetch
      const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
      let found: any = await rtdbGet<any>(`orders/${cleanId}`);

      // 2. If not found by key, search in RTDB orders list
      if (!found) {
        const matches = await rtdbList<any>('orders', (o) => {
          const oId = String(o.orderId || o.id || '').toLowerCase();
          const trk = String(o.trackingNumber || o.consignmentId || o.trackingId || '').toLowerCase();
          const ph = String(o.customerPhone || o.phone || o.shippingAddress?.phone || '');
          const q = rawId.toLowerCase();
          return oId === q || trk === q || (rawId.length >= 11 && ph.includes(rawId));
        }).catch(() => []);

        if (matches && matches.length > 0) {
          found = matches[0].data;
          found.id = matches[0].id;
        }
      }

      if (found) {
        setOrderData(found);
      } else {
        setOrderData(null);
        toast.error('Order not found. Please double-check your Order ID or phone number.');
      }
    } catch (err) {
      console.error('Track error:', err);
      toast.error('Failed to lookup order status.');
      setOrderData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      setOrderQuery(idParam);
      handleTrack(idParam);
    }
  }, [searchParams]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const trackingUrl = orderData 
    ? getCourierTrackingUrl(
        orderData.courierName, 
        orderData.trackingNumber || orderData.consignmentId || orderData.trackingId, 
        orderData.trackingUrl || orderData.approvedCourierTrackingUrl
      )
    : '';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-4 sm:pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
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
          <span className="text-slate-800 font-semibold">Track Order</span>
        </div>

        {/* Hero Card with Search */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-2xs mb-8">
          <div className="text-center max-w-xl mx-auto mb-6">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-800 inline-block mb-2">
              Live Shipment Tracking
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Track Your Order Status
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Enter your Order ID (e.g. ORD-...) or Courier Consignment Number to check the live delivery status.
            </p>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleTrack();
            }}
            className="flex flex-col sm:flex-row gap-2.5 max-w-lg mx-auto"
          >
            <div className="relative flex-1">
              <Package className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                placeholder="Enter Order ID or Tracking Number"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:border-primary-main focus:ring-1 focus:ring-primary-main font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-primary-main hover:bg-sky-600 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-60"
            >
              <Search className="w-4 h-4" />
              <span>{loading ? 'Searching...' : 'Track'}</span>
            </button>
          </form>

          {user && (
            <div className="text-center mt-4">
              <Link to="/orders" className="text-xs font-semibold text-primary-main hover:underline">
                Or view all orders from your account dashboard &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Tracking Result Card */}
        {searched && (
          orderData ? (
            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xs space-y-6">
              {/* Order Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-bold uppercase">Order ID</span>
                    <button 
                      type="button"
                      onClick={() => handleCopy(orderData.orderId || orderData.id)}
                      className="p-1 text-slate-400 hover:text-slate-700"
                      title="Copy Order ID"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-lg font-black text-slate-900 font-mono">
                    #{orderData.orderId || orderData.id}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-100 text-sky-800">
                    {orderData.status || orderData.deliveryStatus || 'Processing'}
                  </span>
                </div>
              </div>

              {/* Courier Information (if assigned) */}
              {(orderData.courierName || orderData.trackingNumber) && (
                <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-sky-200 text-primary-main flex items-center justify-center shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase">Courier Partner</p>
                      <p className="text-sm font-bold text-slate-900">
                        {orderData.courierName || 'Assigned Courier'}
                      </p>
                      {orderData.trackingNumber && (
                        <p className="text-xs text-slate-600 font-mono">
                          Consignment: {orderData.trackingNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  {trackingUrl && (
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-primary-main hover:bg-sky-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
                    >
                      <span>Live Courier Tracking</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Order Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                  <p className="text-xs font-bold uppercase text-slate-400">Recipient & Delivery</p>
                  <p className="font-bold text-slate-800">{orderData.customerName || orderData.shippingAddress?.name || 'Customer'}</p>
                  <p className="text-slate-600">{orderData.customerPhone || orderData.shippingAddress?.phone}</p>
                  <p className="text-slate-500 leading-relaxed">{orderData.shippingAddress?.address || orderData.shippingAddress?.street || 'Bangladesh'}</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                  <p className="text-xs font-bold uppercase text-slate-400">Payment & Pricing</p>
                  <p className="text-slate-600">
                    Payment Method: <span className="font-bold text-slate-800">{orderData.paymentMethod || 'Cash on Delivery'}</span>
                  </p>
                  <p className="text-slate-600">
                    Payment Status: <span className="font-bold text-slate-800">{orderData.paymentStatus || 'Pending'}</span>
                  </p>
                  <p className="text-sm font-bold text-primary-main">
                    Total: ৳{orderData.totalAmount || orderData.grandTotal || orderData.total || 0}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              {orderData.items && orderData.items.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-400 mb-2.5">Items in Parcel</h3>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    {orderData.items.map((it: any, idx: number) => (
                      <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <Package className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800 truncate">
                            {it.name || it.productName || 'Marketplace Item'}
                          </span>
                        </div>
                        <span className="text-slate-500 shrink-0">
                          Qty: {it.quantity || 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-12 border border-slate-200/80 text-center shadow-2xs space-y-3">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Order Not Found</h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                We could not find an order matching &ldquo;{orderQuery}&rdquo;. Please verify your Order ID or contact our official helpline at +8809638969026.
              </p>
            </div>
          )
        )}
      </main>

      <Footer />
    </div>
  );
}
