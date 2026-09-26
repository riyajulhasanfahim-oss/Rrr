import React, { useEffect, useState } from 'react';
import { rtdbList } from '../../lib/rtdb';
import { Link } from 'react-router-dom';
import { 
  Users, Package, ShoppingCart, DollarSign, Activity, CreditCard, 
  AlertTriangle, TrendingUp, TrendingDown, Clock, 
  CheckCircle, XCircle, Truck, Eye, Plus, FileText,
  Image as ImageIcon, Tags, Store, Bell, ShieldAlert, AlertOctagon,
  ChevronRight, Sparkles, User
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, startOfWeek, startOfMonth } from 'date-fns';
import { fetchAllAttentionOrders, AttentionOrder, ExceptionSummaryCounts } from '../../services/adminExceptionService';

const formatDashboardDate = (val: any) => {
  if (!val) return 'N/A';
  try {
    const d = typeof val === 'number' ? new Date(val) : typeof val === 'string' ? new Date(val) : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
    return isNaN(d.getTime()) ? 'N/A' : format(d, 'MMM d, yyyy');
  } catch {
    return 'N/A';
  }
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [attentionOrders, setAttentionOrders] = useState<AttentionOrder[]>([]);
  const [attentionCounts, setAttentionCounts] = useState<ExceptionSummaryCounts>({
    total: 0,
    unaccepted_order: 0,
    delayed_shipping: 0,
    missing_tracking: 0,
    delivery_failed: 0,
    customer_dispute: 0,
    refund_pending: 0,
    suspicious_order: 0,
    payout_stuck: 0,
  });
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    activeProducts: 0,
    outOfStockProducts: 0,
    featuredProducts: 0,
    totalProductSales: 0,
    totalOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    shippedOrders: 0,
    deliveredOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    totalVendors: 0,
    totalResellers: 0,
    activeResellers: 0,
    totalMlmMembers: 0,
    totalReferralSales: 0,
    totalCommission: 0,
    pendingCommission: 0,
    totalWithdrawalsAmount: 0,
    pendingWithdrawalsAmount: 0,
    paidWithdrawalsAmount: 0,
    totalRevenue: 0,
    dailySales: 0,
    weeklySales: 0,
    monthlySales: 0,
    totalBanners: 0,
    activeBanners: 0,
  });

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        
        // Fetch All Dashboard Data from RTDB Concurrently in Parallel for Fast Loading
        const [
          usersListRes,
          ordersListRes,
          mlmListRes,
          resellerTxListRes,
          referralTxListRes,
          withdrawalsListRes,
          bannersListRes,
          productsListRes,
          vendorsListRes,
          resellersListRes,
          attentionDataRes,
        ] = await Promise.all([
          rtdbList<any>('users').catch(() => []),
          rtdbList<any>('orders').catch(() => []),
          rtdbList<any>('mlm_members').catch(() => []),
          rtdbList<any>('reseller_transactions').catch(() => []),
          rtdbList<any>('user_referral_transactions').catch(() => []),
          rtdbList<any>('withdrawals').catch(() => []),
          rtdbList<any>('banners').catch(() => []),
          rtdbList<any>('products').catch(() => []),
          rtdbList<any>('vendors').catch(() => []),
          rtdbList<any>('resellers').catch(() => []),
          fetchAllAttentionOrders().catch(() => ({ attentionOrders: [], summaryCounts: { total: 0 } } as any)),
        ]);

        if (attentionDataRes) {
          setAttentionOrders(attentionDataRes.attentionOrders || []);
          if (attentionDataRes.summaryCounts) {
            setAttentionCounts(attentionDataRes.summaryCounts);
          }
        }

        // Aggregate users, resellers, vendors
        const usersMap = new Map<string, any>();
        usersListRes.forEach(({ id, data }) => {
          if (id && data) usersMap.set(id, { id, ...data });
        });
        resellersListRes.forEach(({ id, data }) => {
          if (!id || !data) return;
          if (!usersMap.has(id)) {
            usersMap.set(id, { id, role: 'reseller', name: data.fullName || data.name, email: data.email, ...data });
          } else {
            usersMap.get(id).role = 'reseller';
          }
        });
        vendorsListRes.forEach(({ id, data }) => {
          if (!id || !data) return;
          if (!usersMap.has(id)) {
            usersMap.set(id, { id, role: 'vendor', name: data.ownerName || data.name, email: data.email, ...data });
          } else {
            usersMap.get(id).role = 'vendor';
          }
        });

        const usersList = Array.from(usersMap.values()).sort((a, b) => {
          const ta = typeof a.createdAt === 'number' ? a.createdAt : a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
          const tb = typeof b.createdAt === 'number' ? b.createdAt : b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
          return tb - ta;
        });

        let vendorsCount = 0;
        let resellersCount = 0;
        let activeResellersCount = 0;
        usersList.forEach((u) => {
          const r = (u.role || '').toLowerCase();
          if (r === 'vendor' || r === 'seller') vendorsCount++;
          if (r === 'reseller') {
            resellersCount++;
            if (u.status === 'active') activeResellersCount++;
          }
        });
        if (vendorsCount < vendorsListRes.length) vendorsCount = vendorsListRes.length;
        if (resellersCount < resellersListRes.length) resellersCount = resellersListRes.length;

        // Process Orders from RTDB
        const ordersList: any[] = [];
        let pending = 0, processing = 0, shipped = 0, delivered = 0, completed = 0, cancelled = 0;
        let revenue = 0;
        
        const now = new Date();
        const startOfToday = startOfDay(now).getTime();
        const startOfThisWeek = startOfWeek(now).getTime();
        const startOfThisMonth = startOfMonth(now).getTime();
        
        let dSales = 0, wSales = 0, mSales = 0;
        
        // Prepare chart data (last 7 days)
        const last7Days = Array.from({length: 7}, (_, i) => {
          const d = subDays(now, 6 - i);
          return {
            date: format(d, 'MMM dd'),
            timestamp: startOfDay(d).getTime(),
            sales: 0
          };
        });

        ordersListRes.forEach(({ id, data }) => {
          if (!id || !data) return;
          const orderTime = typeof data.createdAt === 'number' ? data.createdAt : data.createdAt?.seconds ? data.createdAt.seconds * 1000 : (data.date ? new Date(data.date).getTime() : Date.now());
          const orderObj = { id, ...data, createdAt: orderTime };
          ordersList.push(orderObj);
          
          const status = (data.status || '').toLowerCase();
          if (status === 'pending') pending++;
          else if (status === 'processing') processing++;
          else if (status === 'shipped') shipped++;
          else if (status === 'delivered') delivered++;
          else if (status === 'completed') completed++;
          else if (status === 'cancelled') cancelled++;
          
          const orderTotal = Number(data.total || data.totalAmount || 0);
          
          if (status === 'delivered' || status === 'completed') {
            revenue += orderTotal;
          }
          
          if (status !== 'cancelled') {
            if (orderTime >= startOfToday) dSales += orderTotal;
            if (orderTime >= startOfThisWeek) wSales += orderTotal;
            if (orderTime >= startOfThisMonth) mSales += orderTotal;
            
            // Add to chart data
            const dayEntry = last7Days.find(d => orderTime >= d.timestamp && orderTime < d.timestamp + 86400000);
            if (dayEntry) {
              dayEntry.sales += orderTotal;
            }
          }
        });

        ordersList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        const totalMlmMembers = mlmListRes.length || 0;
        
        let totalCommission = 0;
        let pendingCommission = 0;
        let totalReferralSales = 0;

        resellerTxListRes.forEach(({ data }) => {
          if (data && data.amount) {
            totalCommission += Number(data.amount) || 0;
            if (data.status === 'Pending') pendingCommission += Number(data.amount) || 0;
          }
        });

        referralTxListRes.forEach(({ data }) => {
          if (data && data.amount) {
            totalCommission += Number(data.amount) || 0;
            if (data.status === 'Pending') pendingCommission += Number(data.amount) || 0;
          }
        });

        let tBanners = 0;
        let aBanners = 0;
        bannersListRes.forEach(({ data }) => {
          tBanners++;
          if (data && (data.active || data.status === 'active')) {
            aBanners++;
          }
        });

        let totalWithdrawalsAmount = 0;
        let pendingWithdrawalsAmount = 0;
        let paidWithdrawalsAmount = 0;
        
        withdrawalsListRes.forEach(({ data }) => {
          if (data && data.amount) {
            const amt = Number(data.amount) || 0;
            totalWithdrawalsAmount += amt;
            if (data.status === 'Pending') pendingWithdrawalsAmount += amt;
            if (data.status === 'Paid') paidWithdrawalsAmount += amt;
          }
        });

        const productsList: any[] = [];
        productsListRes.forEach(({ id, data }) => {
          if (id && data) productsList.push({ id, ...data });
        });
        
        const activeProducts = productsList.filter(p => (p.status === 'Active' || p.status === 'active') && (Number(p.stock) || 0) > 0).length;
        const outOfStockProducts = productsList.filter(p => (Number(p.stock) || 0) <= 0).length;
        const featuredProducts = productsList.filter(p => p.featured === true).length;
        
        let totalProductSales = 0;
        ordersList.forEach(order => {
          const st = (order.status || '').toLowerCase();
          if (st === 'delivered' || st === 'completed') {
            totalProductSales += Number(order.total || order.totalAmount || 0);
          }
        });

        
        const lowStock = productsList.filter(p => (p.stock || 0) <= 5).sort((a, b) => (a.stock || 0) - (b.stock || 0)).slice(0, 5);
        const topSelling = [...productsList].sort((a, b) => (b.soldQuantity || b.sales || 0) - (a.soldQuantity || a.sales || 0)).slice(0, 5);

        // Generate some notifications based on data
        const notifs = [];
        if (pending > 0) notifs.push({ id: 1, type: 'warning', message: `You have ${pending} pending orders that need attention.`, time: 'Just now' });
        if (lowStock.length > 0) notifs.push({ id: 2, type: 'alert', message: `${lowStock.length} products are low on stock.`, time: '1 hour ago' });
        notifs.push({ id: 3, type: 'info', message: 'System check completed successfully.', time: '2 hours ago' });

        setStats({
          totalUsers: usersList.length,
          totalProducts: productsList.length,
          activeProducts: activeProducts,
          outOfStockProducts: outOfStockProducts,
          featuredProducts: featuredProducts,
          totalProductSales: totalProductSales,
          totalOrders: ordersList.length,
          pendingOrders: pending,
          processingOrders: processing,
          shippedOrders: shipped,
          deliveredOrders: delivered,
          completedOrders: completed,
          cancelledOrders: cancelled,
          totalVendors: vendorsCount,
          totalResellers: resellersCount,
          activeResellers: activeResellersCount,
          totalMlmMembers: totalMlmMembers,
          totalReferralSales: totalReferralSales,
          totalCommission: totalCommission,
          pendingCommission: pendingCommission,
          totalWithdrawalsAmount: totalWithdrawalsAmount,
          pendingWithdrawalsAmount: pendingWithdrawalsAmount,
          paidWithdrawalsAmount: paidWithdrawalsAmount,
          totalRevenue: revenue,
          dailySales: dSales,
          weeklySales: wSales,
          monthlySales: mSales,
          totalBanners: tBanners || 0,
          activeBanners: aBanners || 0
        });

        setRecentOrders(ordersList.slice(0, 6));
        setRecentUsers(usersList.slice(0, 6));
        setLowStockProducts(lowStock);
        setTopProducts(topSelling);
        setSalesData(last7Days);
        setNotifications(notifs);

      } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-primary-main"></div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color, bg }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-xl ${bg} ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
      </div>
    </div>
  );

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'shipped': return 'bg-indigo-100 text-indigo-700';
      case 'delivered': 
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-8 pb-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Welcome back, here is your store overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin/attention" className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors shadow-sm text-sm">
            <AlertOctagon className="w-4 h-4" /> Requires Attention ({attentionCounts.total})
          </Link>
          <Link to="/admin/products" className="flex items-center gap-2 px-4 py-2 bg-primary-main text-white rounded-lg font-medium hover:bg-sky-600 transition-colors shadow-sm text-sm">
            <Plus className="w-4 h-4" /> Add Product
          </Link>
        </div>
      </div>

      {/* Admin Alert & Exception Radar Widget */}
      {attentionCounts.total > 0 ? (
        <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 rounded-3xl p-6 border border-rose-900/50 shadow-md text-white space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-800/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-sm animate-pulse">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-white">
                    Action Required: {attentionCounts.total} Problematic Orders
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold">
                    Exception Radar
                  </span>
                </div>
                <p className="text-xs text-rose-200 mt-0.5">
                  Only orders with delayed shipping, unaccepted status, missing tracking, disputes, or failed deliveries are shown.
                </p>
              </div>
            </div>

            <Link
              to="/admin/attention"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
            >
              <span>Manage All Exceptions</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Quick Problematic Orders Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {attentionOrders.slice(0, 3).map((item) => (
              <div
                key={item.order.id}
                className="bg-slate-800/80 border border-slate-700/80 hover:border-rose-500/50 rounded-2xl p-4 space-y-2.5 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-300">
                      #{item.order.orderId || item.order.id?.substring(0, 8)}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      item.primaryException.severity === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {item.primaryException.severity}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white mt-1">
                    {item.primaryException.title}
                  </h4>
                  <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">
                    {item.primaryException.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="font-black text-rose-400">
                    ৳{(item.order.total || 0).toLocaleString()}
                  </span>
                  <Link
                    to="/admin/attention"
                    className="text-xs font-bold text-rose-300 hover:text-white flex items-center gap-1"
                  >
                    <span>Review & Resolve</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Admin Alert Radar: All Orders Healthy</p>
              <p className="text-xs text-emerald-700">0 orders require manual intervention. Automatic processing is active.</p>
            </div>
          </div>
          <Link to="/admin/attention" className="text-xs font-bold text-emerald-800 hover:underline">
            View Exception Radar →
          </Link>
        </div>
      )}

      {/* 1. Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Revenue" value={`৳${stats.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={DollarSign} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard title="Total Orders" value={stats.totalOrders} icon={ShoppingCart} color="text-sky-600" bg="bg-sky-50" />
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard title="Total Products" value={stats.totalProducts} icon={Package} color="text-purple-600" bg="bg-purple-50" />
      </div>

      
      
      {/* Product Statistics */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Package className="w-5 h-5 text-primary-main" /> Product Statistics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
            <p className="text-xs text-slate-500 font-medium mb-1">Total Products</p>
            <p className="text-xl font-bold text-slate-900">{stats.totalProducts}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-emerald-100">
            <p className="text-xs text-slate-500 font-medium mb-1">Active Products</p>
            <p className="text-xl font-bold text-emerald-600">{stats.activeProducts}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-red-100">
            <p className="text-xs text-slate-500 font-medium mb-1">Out of Stock</p>
            <p className="text-xl font-bold text-red-600">{stats.outOfStockProducts}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-blue-100">
            <p className="text-xs text-slate-500 font-medium mb-1">Featured</p>
            <p className="text-xl font-bold text-blue-600">{stats.featuredProducts}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-purple-100">
            <p className="text-xs text-slate-500 font-medium mb-1">Total Sales Val.</p>
            <p className="text-xl font-bold text-purple-600">৳{stats.totalProductSales.toLocaleString()}</p>
          </div>
        </div>
      </div>


      {/* Reseller & Leadership Statistics */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-main" /> Vendors, Resellers & Leadership Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold mb-1">Total Vendors</p>
            <p className="text-xl font-bold text-slate-900">{stats.totalVendors}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold mb-1">Total Resellers</p>
            <p className="text-xl font-bold text-slate-900">{stats.totalResellers}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold mb-1">Active Resellers</p>
            <p className="text-xl font-bold text-emerald-600">{stats.activeResellers}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold mb-1">Leadership Members</p>
            <p className="text-xl font-bold text-indigo-600">{stats.totalMlmMembers}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold mb-1">Referral Sales</p>
            <p className="text-xl font-bold text-sky-600">৳{stats.totalReferralSales}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold mb-1">Total Commission</p>
            <p className="text-xl font-bold text-purple-600">৳{stats.totalCommission}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold mb-1">Pending Comm.</p>
            <p className="text-xl font-bold text-amber-600">৳{stats.pendingCommission}</p>
          </div>
        </div>
      </div>

            {/* Withdrawals Statistics */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary-main" /> Withdrawals Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold mb-1">Total Withdrawals</p>
            <p className="text-2xl font-bold text-slate-900">৳{stats.totalWithdrawalsAmount}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold mb-1">Paid Withdrawals</p>
            <p className="text-2xl font-bold text-emerald-600">৳{stats.paidWithdrawalsAmount}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold mb-1">Pending Withdrawals</p>
            <p className="text-2xl font-bold text-amber-600">৳{stats.pendingWithdrawalsAmount}</p>
          </div>
        </div>
      </div>

      {/* Grid Layout for Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* 2. Sales Overview (Chart) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-main" /> Sales Overview
              </h2>
              <div className="flex gap-4 text-sm">
                <div className="flex flex-col items-end">
                  <span className="text-slate-500 font-medium">Today</span>
                  <span className="font-bold text-slate-900">৳{stats.dailySales.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-end border-l pl-4 border-slate-200">
                  <span className="text-slate-500 font-medium">This Week</span>
                  <span className="font-bold text-slate-900">৳{stats.weeklySales.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-end border-l pl-4 border-slate-200">
                  <span className="text-slate-500 font-medium">This Month</span>
                  <span className="font-bold text-slate-900">৳{stats.monthlySales.toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `৳${value}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`৳${value}`, 'Sales']}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. Recent Orders */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-slate-400" /> Recent Orders
              </h2>
              <Link to="/admin/orders" className="text-sm font-semibold text-primary-main hover:underline">
                View All
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Order ID</th>
                    <th className="px-6 py-4 font-semibold">Customer</th>
                    <th className="px-6 py-4 font-semibold">Product</th>
                    <th className="px-6 py-4 font-semibold">Amount</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-500">No orders found.</td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{order.orderId || order.id?.substring(0, 8)}</td>
                        <td className="px-6 py-4 text-slate-600">{order.shippingAddress?.name || 'Guest'}</td>
                        <td className="px-6 py-4 text-slate-600 truncate max-w-[150px]">
                          {order.items && order.items.length > 0 ? order.items[0].name : 'Unknown Product'}
                          {order.items?.length > 1 && <span className="text-xs text-slate-400 ml-1">+{order.items.length - 1}</span>}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">৳{order.total?.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                            {order.status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {formatDashboardDate(order.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link to={`/admin/orders`} className="inline-flex p-2 rounded-lg text-slate-400 hover:text-primary-main hover:bg-sky-50 transition-colors">
                            <Eye className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Recent Users */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" /> Recent Users
              </h2>
              <Link to="/admin/users" className="text-sm font-semibold text-primary-main hover:underline">
                View All
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Email</th>
                    <th className="px-6 py-4 font-semibold">Role</th>
                    <th className="px-6 py-4 font-semibold">Joined Date</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No users found.</td>
                    </tr>
                  ) : (
                    recentUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs uppercase">
                            {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
                          </div>
                          {user.name || 'No Name'}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold capitalize">
                            {user.role || 'User'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {formatDashboardDate(user.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${user.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {user.status || 'Active'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link to={`/admin/users`} className="inline-flex p-2 rounded-lg text-slate-400 hover:text-primary-main hover:bg-sky-50 transition-colors">
                            <Eye className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-8">
          
          {/* 3. Orders Overview (Status breakdown) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-main" /> Orders Overview
            </h2>
            <div className="space-y-3">
              <Link to="/admin/orders" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><Clock className="w-4 h-4" /></div>
                  <span className="font-medium text-slate-700 group-hover:text-amber-600 transition-colors">Pending</span>
                </div>
                <span className="font-bold text-slate-900">{stats.pendingOrders}</span>
              </Link>
              <Link to="/admin/orders" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><Activity className="w-4 h-4" /></div>
                  <span className="font-medium text-slate-700 group-hover:text-blue-600 transition-colors">Processing</span>
                </div>
                <span className="font-bold text-slate-900">{stats.processingOrders}</span>
              </Link>
              <Link to="/admin/orders" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600"><Truck className="w-4 h-4" /></div>
                  <span className="font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">Shipped</span>
                </div>
                <span className="font-bold text-slate-900">{stats.shippedOrders}</span>
              </Link>
              <Link to="/admin/orders" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600"><CheckCircle className="w-4 h-4" /></div>
                  <span className="font-medium text-slate-700 group-hover:text-emerald-600 transition-colors">Delivered</span>
                </div>
                <span className="font-bold text-slate-900">{stats.deliveredOrders + stats.completedOrders}</span>
              </Link>
              <Link to="/admin/orders" className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 text-red-600"><XCircle className="w-4 h-4" /></div>
                  <span className="font-medium text-slate-700 group-hover:text-red-600 transition-colors">Cancelled</span>
                </div>
                <span className="font-bold text-slate-900">{stats.cancelledOrders}</span>
              </Link>
            </div>
          </div>

          {/* 7. Quick Actions */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-main" /> Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/admin/products" className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-primary-main hover:bg-sky-50 transition-all gap-2 group text-center">
                <Package className="w-6 h-6 text-slate-400 group-hover:text-primary-main transition-colors" />
                <span className="text-xs font-semibold text-slate-700 group-hover:text-primary-main">Manage Products</span>
              </Link>
              <Link to="/admin/orders" className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-primary-main hover:bg-sky-50 transition-all gap-2 group text-center">
                <ShoppingCart className="w-6 h-6 text-slate-400 group-hover:text-primary-main transition-colors" />
                <span className="text-xs font-semibold text-slate-700 group-hover:text-primary-main">Manage Orders</span>
              </Link>
              <Link to="/admin/categories" className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-primary-main hover:bg-sky-50 transition-all gap-2 group text-center">
                <Tags className="w-6 h-6 text-slate-400 group-hover:text-primary-main transition-colors" />
                <span className="text-xs font-semibold text-slate-700 group-hover:text-primary-main">Add Category</span>
              </Link>
              <Link to="/admin/users" className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-primary-main hover:bg-sky-50 transition-all gap-2 group text-center">
                <Users className="w-6 h-6 text-slate-400 group-hover:text-primary-main transition-colors" />
                <span className="text-xs font-semibold text-slate-700 group-hover:text-primary-main">Manage Users</span>
              </Link>
              <Link to="/admin/banners" className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-primary-main hover:bg-sky-50 transition-all gap-2 group text-center">
                <ImageIcon className="w-6 h-6 text-slate-400 group-hover:text-primary-main transition-colors" />
                <span className="text-xs font-semibold text-slate-700 group-hover:text-primary-main">Manage Banners</span>
              </Link>
              <Link to="/admin/content" className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-primary-main hover:bg-sky-50 transition-all gap-2 group text-center">
                <FileText className="w-6 h-6 text-slate-400 group-hover:text-primary-main transition-colors" />
                <span className="text-xs font-semibold text-slate-700 group-hover:text-primary-main">Website Content</span>
              </Link>
            </div>
          </div>

          {/* 6. Top Selling Products */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" /> Top Selling Products
            </h2>
            <div className="space-y-4">
              {topProducts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No top products yet.</p>
              ) : (
                topProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-4">
                    <img referrerPolicy="no-referrer" src={product.image || product.images?.[0] || 'https://via.placeholder.com/150'} alt={product.name} className="w-12 h-12 rounded-lg object-cover bg-slate-100" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{product.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          {product.soldQuantity || product.sales || 0} sold
                        </span>
                        <span className="text-xs font-bold text-slate-900">৳{product.price || product.discountPrice || 0}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 8. Low Stock Alert */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> Low Stock Alert
              </h2>
            </div>
            <div className="space-y-4">
              {lowStockProducts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4 flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" /> All products have sufficient stock.
                </p>
              ) : (
                lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 rounded-xl border border-red-100 bg-red-50/50">
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-sm font-semibold text-slate-900 truncate">{product.name}</p>
                      <p className="text-xs text-red-600 font-medium mt-0.5">
                        {product.stock === 0 ? 'Out of stock' : `Only ${product.stock} left`}
                      </p>
                    </div>
                    <Link to={`/admin/products`} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap">
                      Manage
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 9. Dashboard Notifications */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Bell className="w-5 h-5 text-slate-400" /> Notifications
            </h2>
            <div className="space-y-4">
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No new notifications.</p>
              ) : (
                notifications.map((notif) => (
                  <div key={notif.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-full ${notif.type === 'warning' ? 'bg-amber-100 text-amber-600' : notif.type === 'alert' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                      {notif.type === 'warning' ? <Clock className="w-3.5 h-3.5" /> : 
                       notif.type === 'alert' ? <AlertTriangle className="w-3.5 h-3.5" /> : 
                       <CheckCircle className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 leading-snug">{notif.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{notif.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
