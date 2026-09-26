import React, { useEffect, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import OrderTrackingCard from '../components/orders/OrderTrackingCard';
import { 
  fetchCustomerOrders, 
  getCachedCustomerOrders, 
  subscribeToCustomerOrders 
} from '../services/orderService';
import { 
  Search, 
  Package, 
  Clock, 
  Truck, 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  ArrowLeft, 
  Copy, 
  Check, 
  ChevronRight,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface StatusTab {
  id: string;
  label: string;
  matchStatuses?: string[];
}

export default function OrdersPage() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [orders, setOrders] = useState<any[]>(() => getCachedCustomerOrders(user?.uid));
  const [loading, setLoading] = useState(() => getCachedCustomerOrders(user?.uid).length === 0);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const statusTabs: StatusTab[] = [
    { id: 'All', label: 'All' },
    { id: 'Processing', label: 'To Ship', matchStatuses: ['Processing', 'Accepted', 'Confirmed', 'Packaging', 'Vendor Accepted', 'Order Placed', 'Placed'] },
    { id: 'Shipped', label: 'To Receive', matchStatuses: ['Shipped', 'In Transit', 'Out for Delivery', 'Dispatched'] },
    { id: 'Delivered', label: 'Delivered', matchStatuses: ['Delivered', 'Completed'] },
    { id: 'Cancelled', label: 'Cancelled', matchStatuses: ['Cancelled', 'Rejected'] }
  ];

  // Sync tab from URL query param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      const tabLower = tab.toLowerCase();
      const matchedTab = statusTabs.find(t => 
        t.id.toLowerCase() === tabLower || 
        t.label.toLowerCase() === tabLower ||
        (t.matchStatuses && t.matchStatuses.some(m => m.toLowerCase() === tabLower))
      );
      if (matchedTab) {
        setStatusFilter(matchedTab.id);
      } else {
        setStatusFilter('All');
      }
    } else {
      setStatusFilter('All');
    }
  }, [location.search]);

  // Real-time synchronization & persistent caching - zero flickering on navigation
  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    // Ensure immediate instant population from cache
    const cached = getCachedCustomerOrders(user.uid);
    if (cached.length > 0) {
      setOrders(cached);
      setLoading(false);
    }

    const phone = user.phoneNumber || userData?.phone;
    const email = user.email || userData?.email;

    const unsubscribe = subscribeToCustomerOrders(
      user.uid,
      phone,
      email,
      (liveOrders) => {
        if (liveOrders.length > 0) {
          setOrders(liveOrders);
        } else {
          const curCached = getCachedCustomerOrders(user.uid);
          if (curCached.length > 0) {
            setOrders(curCached);
          } else {
            setOrders([]);
          }
        }
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid, user?.phoneNumber, userData?.phone, user?.email, userData?.email]);

  const handleManualRefresh = async () => {
    if (!user) return;
    try {
      const phone = user.phoneNumber || userData?.phone;
      const email = user.email || userData?.email;
      const fresh = await fetchCustomerOrders(user.uid, phone, email);
      setOrders(fresh);
    } catch {
      // ignore
    }
  };

  const filteredOrders = useMemo(() => {
    return orders
      .filter(order => {
        if (statusFilter !== 'All') {
          const tab = statusTabs.find(t => t.id === statusFilter);
          const ordStatus = (order.status || '').toLowerCase().trim();
          if (tab?.matchStatuses) {
            const matches = tab.matchStatuses.some(m => m.toLowerCase().trim() === ordStatus);
            if (!matches) return false;
          } else if (ordStatus !== statusFilter.toLowerCase().trim()) {
            return false;
          }
        }
        if (searchQuery) {
          const qLower = searchQuery.toLowerCase().trim();
          const matchesId = order.orderId?.toLowerCase().includes(qLower);
          const matchesItem = order.items?.some((it: any) => it.name?.toLowerCase().includes(qLower));
          if (!matchesId && !matchesItem) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'desc') return (b.createdAt || 0) - (a.createdAt || 0);
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
  }, [orders, statusFilter, searchQuery, sortOrder]);

  const copyOrderId = (orderId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(orderId);
    setCopiedId(orderId);
    toast.success('Order ID copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Accepted':
      case 'Processing':
        return <Package className="h-3.5 w-3.5 text-blue-600" />;
      case 'Shipped':
      case 'Dispatched':
        return <Truck className="h-3.5 w-3.5 text-sky-600" />;
      case 'Delivered':
      case 'Completed':
        return <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />;
      case 'Rejected':
      case 'Cancelled':
        return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Accepted':
      case 'Processing':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Shipped':
      case 'Dispatched':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Delivered':
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Rejected':
      case 'Cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  // Count orders per status tab
  const getTabCount = (tab: StatusTab) => {
    if (tab.id === 'All') return orders.length;
    return orders.filter(o => {
      if (tab.matchStatuses) return tab.matchStatuses.includes(o.status);
      return o.status === tab.id;
    }).length;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-2.5 sm:pt-6 pb-24 md:pb-16">
        <div className="max-w-4xl mx-auto px-3 sm:px-6">
          
          {/* Top Bar Navigation */}
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
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
                  My Orders
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  {orders.length} total {orders.length === 1 ? 'order' : 'orders'} placed
                </p>
              </div>
            </div>

            {/* Sort Toggle */}
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-2xs hover:bg-slate-50 transition-colors"
              title="Sort by date"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
            </button>
          </div>

          {/* Compact Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Order ID or product name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main shadow-2xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Horizontal Scrollable Status Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 sm:mb-4 -mx-3 px-3 sm:mx-0 sm:px-0 no-scrollbar">
            {statusTabs.map(tab => {
              const isActive = statusFilter === tab.id;
              const count = getTabCount(tab);
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                    isActive
                      ? 'bg-primary-main text-white shadow-sm scale-[1.02]'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        isActive
                          ? 'bg-white/25 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Loading Skeletons */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-2xs border border-slate-200/80 animate-pulse">
                  <div className="flex justify-between items-center mb-3">
                    <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-14 h-14 bg-slate-200 rounded-lg shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            /* Empty Orders State */
            <div className="bg-white rounded-2xl p-8 sm:p-12 text-center shadow-2xs border border-slate-200/80 my-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-primary-main">
                <Package className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                No orders found
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mb-5 max-w-xs mx-auto">
                {searchQuery || statusFilter !== 'All'
                  ? 'We could not find any orders matching your criteria.'
                  : 'You have not placed any orders yet.'}
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-main text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-sky-600 active:scale-95 transition-all shadow-xs"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Start Shopping</span>
              </Link>
            </div>
          ) : (
            /* Orders List */
            <div className="space-y-3.5">
              {filteredOrders.map(order => (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={order.orderId || order.id}
                >
                  <OrderTrackingCard 
                    order={order} 
                    onRefresh={handleManualRefresh}
                  />
                </motion.div>
              ))}
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
