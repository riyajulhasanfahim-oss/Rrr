import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  ArrowLeft, Package, User, MapPin, CreditCard, 
  Clock, CheckCircle, XCircle, FileText, Truck, 
  DollarSign, Activity, AlertTriangle, MessageSquare, RefreshCw, ShieldCheck, ShieldAlert, Check, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { releaseVendorPayout, refundCustomerDispute, checkAndAutoReleaseVendorPayout, rejectCustomerDisputeAndRelease, calculateOrderPaymentBreakdown } from '../../services/vendorPayoutService';
import { fetchOrderById } from '../../services/orderService';
import { rtdbGet, rtdbList, rtdbUpdate, rtdbPush } from '../../lib/rtdb';
import { executeResellerWalletTransaction } from '../../services/resellerWalletService';
import { ResellerTransactionType } from '../../types/resellerWallet';
import { recordPlatformFeeOnDelivery, reversePlatformFeeOnOrderCancellation } from '../../services/platformFeeService';
import { notifyVendorOrderStatus } from '../../services/vendorNotificationService';
import { cancelResellerOrder } from '../../services/resellerCancellationService';

const safeFormatDate = (val: any, formatStr: string = 'MMM dd, yyyy HH:mm a') => {
  if (!val) return 'N/A';
  try {
    const d = typeof val === 'number' 
      ? new Date(val) 
      : typeof val === 'string' 
      ? new Date(val) 
      : val.toDate 
      ? val.toDate() 
      : val.seconds 
      ? new Date(val.seconds * 1000) 
      : (val instanceof Date ? val : new Date(val));
    return isNaN(d.getTime()) ? 'N/A' : format(d, formatStr);
  } catch {
    return 'N/A';
  }
};

export default function AdminOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  
  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  
  // History and notes
  const [history, setHistory] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [adminNote, setAdminNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Escrow / Dispute action state
  const [resolvingDispute, setResolvingDispute] = useState(false);
  const [disputeResolutionNote, setDisputeResolutionNote] = useState('');

  // Commission data
  const [commissions, setCommissions] = useState<any[]>([]);

  const statusOptions = ['Pending', 'Accepted', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded', 'Failed'];

  useEffect(() => {
    if (id) {
      fetchOrderData();
    }
  }, [id]);

  const fetchOrderData = async () => {
    setLoading(true);
    try {
      if (!id) return;
      // Fetch order from RTDB
      const orderData: any = await fetchOrderById(id);
      
      if (orderData) {
        setOrder(orderData);
        setNewStatus(orderData.status || 'Pending');

        // Fetch customer from RTDB if available
        if (orderData.userId && orderData.userId !== 'guest') {
          try {
            const userSnap = await rtdbGet<any>(`users/${orderData.userId}`);
            if (userSnap) {
              setCustomer({ id: orderData.userId, ...userSnap });
            }
          } catch (_) {}
        }

        const targetKeys = new Set<string>([id, orderData.id]);
        if (orderData.orderId) targetKeys.add(orderData.orderId);

        // Fetch history from RTDB order_status_logs
        try {
          const rtdbLogs = await rtdbList<any>('order_status_logs').catch(() => []);
          const matchedLogs = rtdbLogs
            .filter(l => targetKeys.has(l.data?.orderId))
            .map(l => ({
              id: l.id,
              ...(l.data || {})
            }));

          setHistory(matchedLogs.sort((a, b) => {
            const timeA = typeof a.timestamp === 'number' ? a.timestamp : a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = typeof b.timestamp === 'number' ? b.timestamp : b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          }));
        } catch (_) {}

        // Fetch notes from RTDB orderNotes
        try {
          const rtdbNotes = await rtdbList<any>('orderNotes').catch(() => []);
          const matchedNotes = rtdbNotes
            .filter(n => targetKeys.has(n.data?.orderId))
            .map(n => ({
              id: n.id,
              ...(n.data || {})
            }));

          setNotes(matchedNotes.sort((a, b) => {
            const timeA = typeof a.createdAt === 'number' ? a.createdAt : a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = typeof b.createdAt === 'number' ? b.createdAt : b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          }));
        } catch (_) {}

        // Fetch commissions (reseller_transactions) from RTDB
        try {
          const allTrans = await rtdbList<any>('reseller_transactions').catch(() => []);
          const matchedTrans = allTrans
            .map(t => ({ id: t.id, ...(t.data || {}) }))
            .filter(t => targetKeys.has(t.orderId));
          setCommissions(matchedTrans);
        } catch (_) {}
      } else {
        toast.error('Order not found');
        navigate('/admin/orders');
      }
    } catch (error) {
      console.error('Error fetching order from RTDB:', error);
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!order || newStatus === order.status) return;
    
    setUpdatingStatus(true);
    try {
      const targetKeys = new Set<string>([id || '', order.id]);
      if (order.orderId) targetKeys.add(order.orderId);

      // Update in RTDB
      for (const k of targetKeys) {
        if (!k) continue;
        try {
          await rtdbUpdate(`orders/${k}`, {
            status: newStatus,
            updatedAt: Date.now()
          });
        } catch (_) {}
        try {
          await rtdbUpdate(`vendor_orders/${k}`, {
            status: newStatus,
            updatedAt: Date.now()
          });
        } catch (_) {}
      }
      
      // Handle Reseller Commissions in RTDB if status changed to Delivered or Cancelled/Returned
      if (newStatus === 'Delivered' || newStatus === 'Cancelled' || newStatus === 'Returned') {
        try {
          const allTrans = await rtdbList<any>('reseller_transactions').catch(() => []);
          const pendingForOrder = allTrans
            .map(t => ({ id: t.id, ...(t.data || {}) }))
            .filter(t => targetKeys.has(t.orderId) && (t.status === 'Pending' || !t.status));
          
          for (const commData of pendingForOrder) {
            const resellerId = commData.resellerId;
            if (!resellerId) continue;
            const amount = Number(commData.amount) || 0;
            const ordId = commData.orderId || order.id;
            
            if (newStatus === 'Delivered') {
              await rtdbUpdate(`reseller_transactions/${commData.id}`, { status: 'Approved', updatedAt: Date.now() });
              await executeResellerWalletTransaction({
                resellerId,
                userId: resellerId,
                orderId: ordId,
                amount,
                type: ResellerTransactionType.PROFIT_RELEASED,
                status: 'Approved',
                description: `Profit released for Delivered order #${ordId}`
              });
            } else {
              await rtdbUpdate(`reseller_transactions/${commData.id}`, { status: 'Rejected', updatedAt: Date.now() });
              await executeResellerWalletTransaction({
                resellerId,
                userId: resellerId,
                orderId: ordId,
                amount,
                type: ResellerTransactionType.PROFIT_CANCELLED,
                status: 'Rejected',
                description: `Profit cancelled for order #${ordId} (${newStatus})`
              });
            }
          }
        } catch (e) {
          console.error("Error updating commissions in RTDB:", e);
        }
      }

      // Handle Vendor Platform Fee for COD Orders (Delivered/Completed vs Cancelled/Returned)
      try {
        if (newStatus === 'Delivered' || newStatus === 'Completed') {
          // Record for main order or vendor order
          await recordPlatformFeeOnDelivery(order.orderId || order.id, { ...order, status: newStatus });
          // If there are multi-vendor sub-orders, record for each vendor
          const allVOrders = await rtdbList<any>('vendor_orders').catch(() => []);
          const subOrders = allVOrders.filter(vo => vo.data && (vo.data.mainOrderId === (order.orderId || order.id) || vo.data.orderId === (order.orderId || order.id)));
          for (const sOrd of subOrders) {
            if (sOrd.data && sOrd.data.vendorId) {
              await recordPlatformFeeOnDelivery(sOrd.id, { ...sOrd.data, status: newStatus }, sOrd.data.vendorId);
            }
          }
        } else if (newStatus === 'Cancelled' || newStatus === 'Returned' || newStatus === 'Failed') {
          await reversePlatformFeeOnOrderCancellation(order.orderId || order.id);
          // Step 9: Automatic balance correction for Reseller Orders
          if (order.isResellerOrder || order.resellerId || order.profitStatus) {
            await cancelResellerOrder({
              orderId: order.orderId || order.id,
              reason: statusNote || 'Cancelled by Admin',
              cancelledBy: userData?.name || 'Admin',
              adminNote: statusNote
            });
          }
        }
      } catch (err) {
        console.warn("Notice: Error processing platform fee on status update:", err);
      }

      // Add to RTDB order_status_logs
      await rtdbPush('order_status_logs', {
        orderId: order.orderId || order.id,
        oldStatus: order.status,
        newStatus: newStatus,
        note: statusNote,
        changedBy: userData?.name || 'Admin',
        changedById: userData?.uid,
        timestamp: Date.now(),
        createdAt: Date.now()
      });

      // Send real-time notification to Vendor(s)
      try {
        const vendorIds = new Set<string>();
        if (order.vendorId && order.vendorId !== 'admin') vendorIds.add(order.vendorId);
        if (Array.isArray(order.items)) {
          order.items.forEach((it: any) => {
            if (it?.vendorId && it.vendorId !== 'admin') vendorIds.add(it.vendorId);
          });
        }
        for (const vId of vendorIds) {
          notifyVendorOrderStatus(
            vId,
            order.orderId || order.id,
            newStatus,
            statusNote || `অর্ডারের স্ট্যাটাস পরিবর্তন করে "${newStatus}" করা হয়েছে।`
          ).catch(e => console.warn('Vendor status notif error:', e));
        }
      } catch (notifErr) {
        console.warn('Vendor notif error on admin status update:', notifErr);
      }

      // Send real-time notification to Customer
      const customerId = order.userId || order.customerId;
      if (customerId) {
        try {
          await rtdbPush(`notifications/${customerId}`, {
            title: `অর্ডারের স্ট্যাটাস আপডেট: ${newStatus}`,
            message: `আপনার অর্ডার #${(order.orderId || order.id).substring(0, 10)} এখন "${newStatus}" হয়েছে।`,
            type: 'order',
            link: `/orders/${order.id || order.orderId}`,
            createdAt: Date.now(),
            timestamp: Date.now(),
            read: false
          });
        } catch (_) {}
      }
      
      toast.success(`Order status updated to ${newStatus}`);
      setOrder({ ...order, status: newStatus });
      setStatusNote('');
      fetchOrderData(); // Refresh history
    } catch (error) {
      console.error('Error updating status in RTDB:', error);
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async () => {
    if (!adminNote.trim() || !order) return;
    
    setSavingNote(true);
    try {
      // Add note to RTDB
      await rtdbPush('orderNotes', {
        orderId: order.orderId || order.id,
        note: adminNote,
        addedBy: userData?.name || 'Admin',
        addedById: userData?.uid,
        createdAt: Date.now()
      });
      
      toast.success('Note added successfully');
      setAdminNote('');
      fetchOrderData(); // Refresh notes
    } catch (error) {
      console.error('Error adding note to RTDB:', error);
      toast.error('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-main" />
      </div>
    );
  }

  if (!order) return null;

  const isResellerOrder = order.items?.some((i: any) => i.resellerProfit > 0);
  const breakdown = calculateOrderPaymentBreakdown(order);
  const adminItemsPrice = breakdown.itemsPrice;
  const adminDelCharge = breakdown.deliveryCharge;
  const adminGrandTotal = breakdown.grandTotal;
  const isAdminFullPayment = breakdown.isFullPayment;
  const adminAdvanceAmount = breakdown.advanceAmount;
  const adminCodAmount = breakdown.codAmount;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/admin/orders')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">Order #{order.orderId}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              isResellerOrder ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {isResellerOrder ? 'Reseller Order' : 'User Order'}
            </span>
            {isResellerOrder && (
              <button
                onClick={() => navigate(`/admin/reseller-reviews?openReview=${order.orderId || order.id}`)}
                className="px-3 py-1 rounded-full text-xs font-black bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Reseller Profit Review
              </button>
            )}
          </div>
          <p className="text-slate-500 mt-1">
            Placed on {safeFormatDate(order.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Items */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
              <Package className="w-5 h-5 text-primary-main" />
              <h2 className="text-lg font-bold text-slate-900">Order Items</h2>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                {order.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                    <div className="w-20 h-20 rounded-lg bg-white overflow-hidden border border-slate-100 flex-shrink-0">
                      {item.image || item.images?.[0] ? (
                        <img src={item.image || item.images?.[0]} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                          <Package className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h4 className="font-semibold text-slate-900 text-lg truncate">{item.name}</h4>
                          <p className="text-sm text-slate-500 font-mono mt-1">ID: {item.id}</p>
                          {item.vendorId && <p className="text-xs text-slate-400 mt-1">Vendor: {item.vendorId}</p>}
                          {item.selectedSize && <p className="text-xs text-slate-600 mt-1">Size: {item.selectedSize}</p>}
                          {item.selectedColor && <p className="text-xs text-slate-600 mt-1">Color: {item.selectedColor}</p>}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-900">৳{(item.price || 0).toLocaleString()}</div>
                          <div className="text-sm text-slate-500">Qty: {item.quantity || 1}</div>
                          <div className="font-bold text-primary-main mt-1">
                            ৳{((item.price || 0) * (item.quantity || 1)).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      {item.resellerProfit > 0 && (
                        <div className="mt-3 p-2 bg-purple-50 rounded-lg border border-purple-100 flex justify-between items-center text-sm">
                          <span className="text-purple-700 font-medium">Reseller Profit (per item):</span>
                          <span className="text-purple-700 font-bold">৳{item.resellerProfit}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="mt-6 border-t border-slate-100 pt-6">
                <div className="max-w-xs ml-auto space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>৳{adminItemsPrice}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Charge</span>
                    <span>৳{adminDelCharge}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-slate-900 pt-3 border-t border-slate-100">
                    <span>Total</span>
                    <span className="text-primary-main">৳{adminGrandTotal}</span>
                  </div>
                  <div className="pt-2 border-t border-dashed border-slate-200 space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-sky-800 bg-sky-50 px-2.5 py-1.5 rounded-lg border border-sky-100">
                      <span>Customer Advance / Paid:</span>
                      <span className="font-bold">৳{adminAdvanceAmount} {isAdminFullPayment ? '(Full)' : ''}</span>
                    </div>
                    <div className={`flex justify-between text-xs font-bold px-2.5 py-1.5 rounded-lg border ${
                      adminCodAmount === 0 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}>
                      <span>COD Due:</span>
                      <span>{adminCodAmount === 0 ? '০ টাকা (পরিশোধিত)' : `৳${adminCodAmount}`}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Management */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
              <Activity className="w-5 h-5 text-primary-main" />
              <h2 className="text-lg font-bold text-slate-900">Update Status</h2>
            </div>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="flex-1 w-full">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Order Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20"
                  >
                    {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Note (Optional)</label>
                  <input
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Reason or tracking info..."
                    className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20"
                  />
                </div>
                <button
                  onClick={handleUpdateStatus}
                  disabled={updatingStatus || newStatus === order.status}
                  className="px-6 py-2 bg-primary-main text-white font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 h-10 w-full sm:w-auto"
                >
                  {updatingStatus ? 'Updating...' : 'Update Status'}
                </button>
              </div>

              {/* Status Timeline */}
              {history.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Status History</h3>
                  <div className="space-y-4">
                    {history.map((h, i) => (
                      <div key={h.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-3 h-3 bg-primary-main rounded-full mt-1.5" />
                          {i !== history.length - 1 && <div className="w-px h-full bg-slate-200 mt-1 mb-1" />}
                        </div>
                        <div className="pb-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{h.newStatus}</span>
                            <span className="text-xs text-slate-500">
                              {safeFormatDate(h.createdAt || h.timestamp, 'MMM dd, hh:mm a')}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">by {h.changedBy}</p>
                          {h.note && <p className="text-sm text-slate-500 mt-1 bg-slate-50 p-2 rounded border border-slate-100">{h.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Commissions/Earnings (If any) */}
          {commissions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-purple-50">
                <DollarSign className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-bold text-slate-900">Commission Information</h2>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {commissions.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl bg-slate-50">
                      <div>
                        <div className="font-semibold text-slate-900">Reseller Profit</div>
                        <div className="text-xs text-slate-500">Reseller ID: {c.resellerId}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-purple-600">৳{c.amount}</div>
                        <div className="text-xs text-slate-500">Status: {c.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
              <User className="w-5 h-5 text-primary-main" />
              <h2 className="text-lg font-bold text-slate-900">Customer</h2>
            </div>
            <div className="p-4 space-y-4">
              {customer ? (
                <>
                  <div>
                    <div className="font-bold text-slate-900">{customer.name}</div>
                    <div className="text-sm text-slate-500">{customer.email}</div>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Account Info</div>
                    <div className="text-sm text-slate-700">Type: {customer.role || 'User'}</div>
                    <div className="text-sm text-slate-700 font-mono mt-1">ID: {customer.id}</div>
                  </div>
                  <Link to={`/admin/users/${customer.id}`} className="block text-center w-full py-2 bg-slate-50 text-primary-main text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors">
                    View Profile
                  </Link>
                </>
              ) : (
                <div className="text-slate-500 text-sm">
                  {order.userId === 'guest' ? 'Guest Checkout' : 'Customer data not found'}
                </div>
              )}
            </div>
          </div>

          {/* Shipping Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
              <MapPin className="w-5 h-5 text-primary-main" />
              <h2 className="text-lg font-bold text-slate-900">Shipping</h2>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div>
                <span className="text-slate-500 block text-xs">Name</span>
                <span className="font-medium text-slate-900">{order.shippingAddress?.name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Phone</span>
                <span className="font-medium text-slate-900">{order.shippingAddress?.phone}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Address</span>
                <span className="text-slate-900">{order.shippingAddress?.address}</span>
                {order.shippingAddress?.area && <span className="block text-slate-900">{order.shippingAddress.area}</span>}
                <span className="block text-slate-900">
                  {order.shippingAddress?.city} {order.shippingAddress?.postalCode ? `- ${order.shippingAddress.postalCode}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Payment & Vendor Escrow Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
              <CreditCard className="w-5 h-5 text-primary-main" />
              <h2 className="text-lg font-bold text-slate-900">Payment & Escrow</h2>
            </div>
            <div className="p-4 space-y-3.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Method</span>
                <span className="font-medium text-slate-900 uppercase">{order.paymentMethod}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Advance Paid</span>
                <span className="font-bold text-sky-700">৳{adminAdvanceAmount} {isAdminFullPayment ? '(Full)' : ''}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">COD Collection</span>
                <span className={`font-bold ${adminCodAmount === 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                  {adminCodAmount === 0 ? '০ টাকা (Paid)' : `৳${adminCodAmount}`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Payment Status</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  order.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {order.paymentStatus || 'Pending'}
                </span>
              </div>
              {order.transactionId && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 block text-xs">Transaction ID</span>
                  <span className="font-mono text-slate-900 text-xs">{order.transactionId}</span>
                </div>
              )}

              {/* Vendor Escrow Payout Status */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Vendor Payout:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    order.vendorPayoutStatus === 'Released' ? 'bg-emerald-100 text-emerald-800' :
                    order.vendorPayoutStatus === 'Disputed' ? 'bg-rose-100 text-rose-800' :
                    order.vendorPayoutStatus === 'Release Pending' ? 'bg-blue-100 text-blue-800' :
                    order.vendorPayoutStatus === 'Refunded' ? 'bg-purple-100 text-purple-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {order.vendorPayoutStatus === 'Released' ? 'Released to Vendor' :
                     order.vendorPayoutStatus === 'Disputed' ? 'Payment Held (Disputed)' :
                     order.vendorPayoutStatus === 'Release Pending' ? 'Release Pending' :
                     order.vendorPayoutStatus === 'Refunded' ? 'Refunded' :
                     'Payment Held'}
                  </span>
                </div>

                {/* Dispute details & Admin Actions */}
                {order.vendorPayoutStatus === 'Disputed' || order.status === 'Dispute' ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2.5 text-xs">
                    <div className="font-bold text-rose-900 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                        Active Customer Dispute / Complaint
                      </span>
                      <span className="px-2 py-0.5 bg-rose-200 text-rose-800 rounded text-[10px] font-bold">
                        Payout Frozen
                      </span>
                    </div>
                    <div className="text-rose-800 space-y-1 bg-white p-2.5 rounded-lg border border-rose-100">
                      <p><strong>Reason:</strong> {order.dispute?.reason || 'Issue reported'}</p>
                      {order.dispute?.details && <p><strong>Details:</strong> {order.dispute?.details}</p>}
                      <p className="text-[11px] text-rose-600">
                        Submitted by: {order.dispute?.raisedBy || 'Customer'}
                      </p>
                    </div>

                    {/* Customer Evidence Images */}
                    {order.dispute?.images?.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-700">Customer Proof Photos ({order.dispute.images.length}):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {order.dispute.images.map((img: string, idx: number) => (
                            <a key={idx} href={img} target="_blank" rel="noreferrer" className="block w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:border-primary-main">
                              <img referrerPolicy="no-referrer" src={img} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Vendor Response */}
                    {order.dispute?.vendorResponse ? (
                      <div className="p-2 bg-teal-50 border border-teal-200 rounded-lg text-slate-800 space-y-0.5">
                        <div className="flex justify-between items-center text-[11px] font-bold text-teal-900">
                          <span>🏪 Vendor Response ({order.dispute.vendorResponse.respondedBy || 'Vendor'}):</span>
                        </div>
                        <p className="text-xs bg-white p-2 rounded border border-teal-100">
                          "{order.dispute.vendorResponse.text}"
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">No response submitted by vendor yet.</p>
                    )}

                    <div className="pt-2 border-t border-rose-200 space-y-2">
                      <input
                        type="text"
                        value={disputeResolutionNote}
                        onChange={(e) => setDisputeResolutionNote(e.target.value)}
                        placeholder="Admin resolution note..."
                        className="w-full px-2.5 py-1.5 bg-white border border-rose-300 rounded-lg text-xs text-slate-800 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setResolvingDispute(true);
                            try {
                              const res = await refundCustomerDispute(order, userData, disputeResolutionNote);
                              if (res.success) {
                                toast.success(res.message);
                                fetchOrderData();
                              } else {
                                toast.error(res.message);
                              }
                            } finally {
                              setResolvingDispute(false);
                            }
                          }}
                          disabled={resolvingDispute}
                          className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve Refund
                        </button>
                        <button
                          onClick={async () => {
                            setResolvingDispute(true);
                            try {
                              const res = await rejectCustomerDisputeAndRelease(order, userData, disputeResolutionNote);
                              if (res.success) {
                                toast.success(res.message);
                                fetchOrderData();
                              } else {
                                toast.error(res.message);
                              }
                            } finally {
                              setResolvingDispute(false);
                            }
                          }}
                          disabled={resolvingDispute}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Reject & Release
                        </button>
                      </div>
                    </div>
                  </div>
                ) : order.vendorPayoutStatus !== 'Released' && order.vendorPayoutStatus !== 'Refunded' ? (
                  <div className="pt-2">
                    <button
                      onClick={async () => {
                        setResolvingDispute(true);
                        try {
                          const res = await releaseVendorPayout(order, userData);
                          if (res.success) {
                            toast.success(res.message);
                            fetchOrderData();
                          } else {
                            toast.error(res.message);
                          }
                        } finally {
                          setResolvingDispute(false);
                        }
                      }}
                      disabled={resolvingDispute}
                      className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Force Release Payout to Vendor
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Admin Notes */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
              <MessageSquare className="w-5 h-5 text-primary-main" />
              <h2 className="text-lg font-bold text-slate-900">Internal Notes</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {notes.map(note => (
                  <div key={note.id} className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-sm">
                    <p className="text-slate-800">{note.note}</p>
                    <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                      <span>{note.addedBy}</span>
                      <span>{safeFormatDate(note.createdAt, 'MMM dd, HH:mm')}</span>
                    </div>
                  </div>
                ))}
                {notes.length === 0 && <p className="text-sm text-slate-500 text-center py-2">No notes added yet.</p>}
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Add a private note..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-main/20 text-sm resize-none mb-2"
                />
                <button
                  onClick={handleAddNote}
                  disabled={savingNote || !adminNote.trim()}
                  className="w-full py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
                >
                  {savingNote ? 'Adding...' : 'Add Note'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
