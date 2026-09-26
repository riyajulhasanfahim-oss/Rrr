import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { rtdbList, rtdbGet } from '../../../lib/rtdb';
import Header from '../../../components/layout/Header';
import Footer from '../../../components/layout/Footer';
import { Package, Truck, Loader2, Link2, Eye, DollarSign, ListOrdered, Calendar, ShieldCheck, Clock, CheckCircle2, XCircle, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import ResellerProfitReviewModal from '../../../components/reseller/ResellerProfitReviewModal';

export default function ResellerTracking() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  
  const [sharedProducts, setSharedProducts] = useState<any[]>([]);
  const [referredOrders, setReferredOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewModalOrder, setReviewModalOrder] = useState<any | null>(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      // 1. Fetch Shared Products Tracking
      const trackingQ = query(collection(db, 'resellerTracking'), where('resellerId', '==', user.uid));
      const trackingSnap = await getDocs(trackingQ);
      const trackingList = [];
      for (const d of trackingSnap.docs) {
        const data = d.data();
        let productName = 'Loading...';
        try {
          const pDoc = await getDoc(doc(db, 'products', data.productId));
          if (pDoc.exists()) productName = pDoc.data().name;
        } catch(e) {}
        trackingList.push({ id: d.id, ...data, productName });
      }
      setSharedProducts(trackingList.sort((a, b) => b.createdAt - a.createdAt));

      // 2. Fetch Referred Orders via RTDB reseller_orders, reseller_transactions, and legacy
      const ordersMap = new Map();

      // Check RTDB reseller_orders and user orders
      try {
        const rtdbOrders = await rtdbList<any>(`resellers/${user.uid}/orders`).catch(() => []);
        rtdbOrders.forEach(item => {
          const data = item.data;
          const oId = data.orderId || item.id;
          const isConfirmed = Boolean(
            data.vendorOrderStatus === 'CONFIRMED' || 
            data.profitStatus === 'LOCKED' ||
            ['Accepted', 'Processing', 'Shipped', 'In Transit', 'Delivered', 'Completed'].includes(data.status || data.orderStatus)
          );
          ordersMap.set(oId, {
            ...data,
            orderId: oId,
            customerName: data.customerName || data.shippingAddress?.name || 'Customer',
            date: data.createdAt || Date.now(),
            status: data.orderStatus || data.status || 'Pending',
            profitStatus: data.profitStatus || 'PENDING',
            vendorOrderStatus: isConfirmed ? 'CONFIRMED' : (data.vendorOrderStatus || 'PENDING'),
            lockedProfitAmount: data.lockedProfitAmount,
            reviewStatus: data.reviewStatus || (data.resellerReviewSubmitted ? 'PENDING' : undefined),
            reviewId: data.reviewId,
            vendorId: data.vendorId,
            courierName: data.courierName,
            trackingNumber: data.trackingNumber || data.consignmentId || data.trackingId,
            approvedCourierTrackingUrl: data.approvedCourierTrackingUrl || data.trackingUrl || data.courierTrackingUrl,
            commission: Number(data.lockedProfitAmount ?? data.resellerProfit ?? data.commissionAmount ?? data.resellerCommission ?? 0),
            items: data.items ? data.items.map((i: any) => i.productName || i.name) : (data.productName ? [data.productName] : ['Catalog Product']),
            deliveryStatus: data.deliveryStatus || data.orderStatus || data.status || 'Pending',
            saleAmount: Number(data.customerPaidAmount || data.grandTotal || data.total || data.subtotal || 0),
            vendorPrice: data.vendorPrice,
            resellerSellingPrice: data.resellerSellingPrice
          });
        });

        const allRtdbOrders = await rtdbList<any>('reseller_orders', (o) => o.resellerId === user.uid).catch(() => []);
        allRtdbOrders.forEach(item => {
          const data = item.data;
          const oId = data.orderId || item.id;
          if (!ordersMap.has(oId)) {
            const isConfirmed = Boolean(
              data.vendorOrderStatus === 'CONFIRMED' || 
              data.profitStatus === 'LOCKED' ||
              ['Accepted', 'Processing', 'Shipped', 'In Transit', 'Delivered', 'Completed'].includes(data.status || data.orderStatus)
            );
            ordersMap.set(oId, {
              ...data,
              orderId: oId,
              customerName: data.customerName || data.shippingAddress?.name || 'Customer',
              date: data.createdAt || Date.now(),
              status: data.orderStatus || data.status || 'Pending',
              profitStatus: data.profitStatus || 'PENDING',
              vendorOrderStatus: isConfirmed ? 'CONFIRMED' : (data.vendorOrderStatus || 'PENDING'),
              lockedProfitAmount: data.lockedProfitAmount,
              reviewStatus: data.reviewStatus || (data.resellerReviewSubmitted ? 'PENDING' : undefined),
              reviewId: data.reviewId,
              vendorId: data.vendorId,
              courierName: data.courierName,
              trackingNumber: data.trackingNumber || data.consignmentId || data.trackingId,
              approvedCourierTrackingUrl: data.approvedCourierTrackingUrl || data.trackingUrl || data.courierTrackingUrl,
              commission: Number(data.lockedProfitAmount ?? data.resellerProfit ?? data.commissionAmount ?? data.resellerCommission ?? 0),
              items: data.items ? data.items.map((i: any) => i.productName || i.name) : (data.productName ? [data.productName] : ['Catalog Product']),
              deliveryStatus: data.deliveryStatus || data.orderStatus || data.status || 'Pending',
              saleAmount: Number(data.customerPaidAmount || data.grandTotal || data.total || data.subtotal || 0),
              vendorPrice: data.vendorPrice,
              resellerSellingPrice: data.resellerSellingPrice
            });
          }
        });
      } catch (_) {}

      // Check reseller_orders from Firestore with timeout protection
      try {
        const roSnap = await Promise.race([
          getDocs(query(collection(db, 'reseller_orders'), where('resellerId', '==', user.uid))),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
        ]);
        if (roSnap) {
          roSnap.forEach(d => {
            const data = d.data();
            const oId = data.orderId || d.id;
            if (!ordersMap.has(oId)) {
              const isConfirmed = Boolean(
                data.vendorOrderStatus === 'CONFIRMED' || 
                data.profitStatus === 'LOCKED' ||
                ['Accepted', 'Processing', 'Shipped', 'In Transit', 'Delivered', 'Completed'].includes(data.status || data.orderStatus)
              );
              ordersMap.set(oId, {
                ...data,
                orderId: oId,
                customerName: data.customerName || data.shippingAddress?.name || 'Customer',
                date: data.createdAt || Date.now(),
                status: data.orderStatus || data.status || 'Pending',
                profitStatus: data.profitStatus || 'PENDING',
                vendorOrderStatus: isConfirmed ? 'CONFIRMED' : (data.vendorOrderStatus || 'PENDING'),
                lockedProfitAmount: data.lockedProfitAmount,
                reviewStatus: data.reviewStatus || (data.resellerReviewSubmitted ? 'PENDING' : undefined),
                reviewId: data.reviewId,
                vendorId: data.vendorId,
                courierName: data.courierName,
                trackingNumber: data.trackingNumber || data.consignmentId || data.trackingId,
                approvedCourierTrackingUrl: data.approvedCourierTrackingUrl || data.trackingUrl || data.courierTrackingUrl,
                commission: Number(data.lockedProfitAmount ?? data.resellerProfit ?? data.commissionAmount ?? data.resellerCommission ?? 0),
                items: data.items ? data.items.map((i: any) => i.productName || i.name) : (data.productName ? [data.productName] : ['Catalog Product']),
                deliveryStatus: data.deliveryStatus || data.orderStatus || data.status || 'Pending',
                saleAmount: Number(data.customerPaidAmount || data.grandTotal || data.total || data.subtotal || 0),
                vendorPrice: data.vendorPrice,
                resellerSellingPrice: data.resellerSellingPrice
              });
            }
          });
        }
      } catch (_) {}

      // Check reseller_transactions from RTDB first, then Firestore with timeout
      try {
        const rtdbTxs = await rtdbList<any>('reseller_transactions', (t) => t.resellerId === user.uid).catch(() => []);
        for (const item of rtdbTxs) {
          const tData = item.data;
          const oId = tData.orderId || item.id;
          if (!ordersMap.has(oId)) {
            ordersMap.set(oId, {
              orderId: oId,
              customerName: tData.customerName || 'Customer',
              date: tData.createdAt || Date.now(),
              status: tData.status || 'Approved',
              commission: Number(tData.amount || 0),
              items: [tData.productName || 'Product'],
              deliveryStatus: tData.status || 'Approved',
              saleAmount: 0
            });
          }
        }

        const transSnap = await Promise.race([
          getDocs(query(collection(db, 'reseller_transactions'), where('resellerId', '==', user.uid))),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
        ]);
        if (transSnap) {
          for (const tDoc of transSnap.docs) {
            const tData = tDoc.data();
            const oId = tData.orderId || tDoc.id;
            if (!ordersMap.has(oId)) {
              ordersMap.set(oId, {
                orderId: oId,
                customerName: tData.customerName || 'Customer',
                date: tData.createdAt || Date.now(),
                status: tData.status || 'Approved',
                commission: Number(tData.amount || 0),
                items: [tData.productName || 'Product'],
                deliveryStatus: tData.status || 'Approved',
                saleAmount: 0
              });
            }
          }
        }
      } catch (_) {}
      
      // Enrich with main order status and RTDB reviews if not already loaded
      const finalOrders = [];
      for (const [oId, oData] of ordersMap.entries()) {
        const cleanId = String(oId).replace(/^#/, '');
        // Check RTDB review status for freshest state
        try {
          const existingRev = await rtdbGet<any>(`reseller_profit_reviews/${cleanId}_${user.uid}`);
          if (existingRev) {
            oData.reviewStatus = existingRev.reviewStatus || 'PENDING';
            oData.reviewId = existingRev.reviewId;
          }
        } catch (_) {}

        if (oData.saleAmount > 0) {
          finalOrders.push(oData);
          continue;
        }
        try {
          const od = await rtdbGet<any>(`orders/${cleanId}`);
          let deliveryStatus = oData.deliveryStatus || 'Pending';
          let saleAmount = oData.saleAmount || 0;
          if (od) {
            deliveryStatus = od.status || deliveryStatus;
            saleAmount = od.totalAmount || od.subtotal || od.grandTotal || saleAmount;
          }
          finalOrders.push({ ...oData, deliveryStatus, saleAmount });
        } catch(e) {
          finalOrders.push(oData);
        }
      }
      setReferredOrders(finalOrders.sort((a, b) => b.date - a.date));
      
    } catch (error) {
      console.error('Error fetching tracking data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Reseller Tracking</h1>
            <p className="text-gray-500">Track your shared products and referral orders</p>
          </div>

          <div className="flex gap-4 mb-6 border-b border-gray-200">
            <button 
              onClick={() => setActiveTab('products')}
              className={`pb-3 px-4 font-medium transition-colors ${activeTab === 'products' ? 'text-primary-main border-b-2 border-primary-main' : 'text-gray-500 hover:text-gray-700'}`}
            >
              My Shared Products
            </button>
            <button 
              onClick={() => setActiveTab('orders')}
              className={`pb-3 px-4 font-medium transition-colors ${activeTab === 'orders' ? 'text-primary-main border-b-2 border-primary-main' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Referred Orders
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-main" /></div>
          ) : (
            <>
              {activeTab === 'products' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-200">
                          <th className="p-4 font-medium">Product</th>
                          <th className="p-4 font-medium">Referral ID</th>
                          <th className="p-4 font-medium">Date Shared</th>
                          <th className="p-4 font-medium">Clicks</th>
                          <th className="p-4 font-medium">Orders</th>
                          <th className="p-4 font-medium">Total Comm.</th>
                          <th className="p-4 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sharedProducts.map((t, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="p-4"><div className="font-medium text-gray-900 line-clamp-2">{t.productName}</div></td>
                            <td className="p-4"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-mono">{t.referralId}</span></td>
                            <td className="p-4 text-sm text-gray-500">{format(t.createdAt, 'MMM d, yyyy')}</td>
                            <td className="p-4 font-medium">{t.clicks || 0}</td>
                            <td className="p-4 font-medium">{t.orders || 0}</td>
                            <td className="p-4 font-bold text-green-600">৳{t.totalCommission || 0}</td>
                            <td className="p-4">
                              <Link to={`/product/${t.productId}`} className="text-primary-main hover:underline text-sm font-medium">View</Link>
                            </td>
                          </tr>
                        ))}
                        {sharedProducts.length === 0 && (
                          <tr><td colSpan={7} className="p-8 text-center text-gray-500">No shared products tracked yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-4">
                  {referredOrders.map((o, i) => {
                    const isVendorConfirmed = Boolean(
                      o.vendorOrderStatus === 'CONFIRMED' || 
                      o.profitStatus === 'LOCKED' ||
                      ['Accepted', 'Processing', 'Shipped', 'In Transit', 'Delivered', 'Completed'].includes(o.deliveryStatus || o.status)
                    );
                    const isReviewPending = o.reviewStatus === 'PENDING';

                    return (
                      <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between gap-4 hover:border-purple-200 transition-all">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-gray-900 font-mono">Order #{o.orderId}</span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              o.deliveryStatus === 'Delivered' 
                                ? 'bg-green-100 text-green-700 border border-green-200' 
                                : o.deliveryStatus === 'Cancelled' 
                                ? 'bg-red-100 text-red-700 border border-red-200' 
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                              Delivery: {o.deliveryStatus}
                            </span>
                            {isVendorConfirmed ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Vendor Confirmed
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                Awaiting Vendor
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-gray-600">Customer: <span className="font-medium text-gray-900">{o.customerName}</span></p>
                          <p className="text-sm text-gray-600">Products: <span className="font-medium text-gray-800">{o.items.join(', ')}</span></p>
                          
                          {/* Courier Tracking snippet if assigned */}
                          {(o.courierName || o.trackingNumber) && (
                            <div className="flex items-center gap-2 text-xs text-purple-900 bg-purple-50/80 px-2.5 py-1.5 rounded-lg border border-purple-100 max-w-fit">
                              <Truck className="w-3.5 h-3.5 text-purple-700" />
                              <span>{o.courierName || 'Courier'}: <strong className="font-mono text-purple-950">{o.trackingNumber || 'Tracking Assigned'}</strong></span>
                            </div>
                          )}

                          <p className="text-xs text-gray-400">{format(o.date, 'MMM d, yyyy h:mm a')}</p>
                        </div>

                        <div className="flex flex-col items-start md:items-end justify-between bg-gray-50/90 p-4 rounded-xl border border-gray-100 min-w-[260px] gap-3">
                          <div className="w-full text-left md:text-right">
                            <p className="text-xs text-gray-500 mb-0.5">Sale Amount: ৳{o.saleAmount}</p>
                            <p className="text-xs font-bold text-gray-700 mb-0.5">
                              Reseller Profit: <span className="text-purple-700 font-extrabold text-base">৳{o.commission}</span>
                            </p>
                            <p className="text-xs font-medium text-gray-500 flex items-center md:justify-end gap-1">
                              Profit Status: 
                              <span className={`font-bold flex items-center gap-0.5 ${
                                o.profitStatus === 'LOCKED' 
                                  ? 'text-purple-700' 
                                  : o.profitStatus === 'CANCELLED' 
                                  ? 'text-red-600' 
                                  : o.profitStatus === 'REVERSED' 
                                  ? 'text-rose-600' 
                                  : o.profitStatus === 'REVERSAL_PENDING' 
                                  ? 'text-amber-700' 
                                  : o.profitStatus === 'RELEASED' || o.profitStatus === 'PROFIT_TRANSFERRED' 
                                  ? 'text-green-600' 
                                  : 'text-amber-600'
                              }`}>
                                {o.profitStatus === 'LOCKED' && <Lock className="w-3 h-3" />}
                                {o.profitStatus === 'CANCELLED'
                                  ? 'CANCELLED (বাতিল)'
                                  : o.profitStatus === 'REVERSED'
                                  ? 'REVERSED (রিভার্সাল)'
                                  : o.profitStatus === 'REVERSAL_PENDING'
                                  ? 'REVERSAL_PENDING (অপর্যাপ্ত ব্যালেন্স)'
                                  : (o.profitStatus || 'PENDING')}
                              </span>
                            </p>
                          </div>

                          {/* RESELLER PROFIT VERIFICATION REVIEW ACTION */}
                          <div className="w-full pt-2 border-t border-gray-200/70 flex flex-col items-stretch md:items-end">
                            {o.profitStatus === 'CANCELLED' || o.status === 'Cancelled' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-medium bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                                অর্ডার ও প্রফিট বাতিলকৃত
                              </span>
                            ) : o.profitStatus === 'REVERSED' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-medium bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                                প্রফিট রিভার্সাল সম্পন্ন
                              </span>
                            ) : o.profitStatus === 'REVERSAL_PENDING' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 font-medium bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                প্রফিট রিভার্সাল পেন্ডিং (ঘাটতি বিদ্যমান)
                              </span>
                            ) : isVendorConfirmed ? (
                              o.profitStatus === 'RELEASED' || o.reviewStatus === 'APPROVED' ? (
                                <button
                                  onClick={() => setReviewModalOrder(o)}
                                  className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-100" />
                                  <span>প্রফিট রিলিজ সম্পন্ন (Profit Released)</span>
                                </button>
                              ) : isReviewPending ? (
                                <button
                                  onClick={() => setReviewModalOrder(o)}
                                  className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
                                >
                                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Review Submitted (Pending Approval)</span>
                                </button>
                              ) : o.reviewStatus === 'REJECTED' ? (
                                <button
                                  onClick={() => setReviewModalOrder(o)}
                                  className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-900 bg-rose-100 hover:bg-rose-200 border border-rose-300 active:scale-98 shadow-2xs transition-all cursor-pointer"
                                >
                                  <XCircle className="w-4 h-4 text-rose-600" />
                                  <span>রিভিউ বাতিল — পুনরায় রিভিউ দিন (Resubmit)</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => setReviewModalOrder(o)}
                                  className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 active:scale-98 shadow-sm transition-all cursor-pointer"
                                >
                                  <ShieldCheck className="w-4 h-4 text-purple-200" />
                                  <span>Review (Profit Verification)</span>
                                </button>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                ভেন্ডর কনফার্মেশনের অপেক্ষায় (Step 5)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {referredOrders.length === 0 && (
                    <div className="bg-white rounded-2xl p-8 text-center text-gray-500 border border-gray-100">
                      No referral orders yet. Share products to start earning!
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Reseller Profit Verification Review Modal */}
      {reviewModalOrder && user && (
        <ResellerProfitReviewModal
          isOpen={true}
          onClose={() => setReviewModalOrder(null)}
          order={reviewModalOrder}
          resellerId={user.uid}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}

      <Footer />
    </div>
  );
}
