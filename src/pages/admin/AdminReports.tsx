import React, { useState, useEffect } from 'react';
import { rtdbList } from '../../lib/rtdb';
import { 
  BarChart2, DollarSign, ShoppingCart, Users, Package, 
  TrendingUp, Download, Filter, Calendar, ShieldAlert 
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval } from 'date-fns';

const parseDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (val.seconds) return new Date(val.seconds * 1000);
  if (typeof val.toDate === 'function') return val.toDate();
  return null;
};

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7days'); // 7days, 30days, thisMonth, thisYear, all
  const [activeTab, setActiveTab] = useState('sales'); // sales, orders, products, users
  
  // Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch Orders, Products, Users, Withdrawals, Commissions 100% from RTDB
      const [rtdbOrders, rtdbProducts, rtdbUsers, rtdbWithdrawals, rtdbCommissions] = await Promise.all([
        rtdbList<any>('orders').catch(() => []),
        rtdbList<any>('products').catch(() => []),
        rtdbList<any>('users').catch(() => []),
        rtdbList<any>('withdrawals').catch(() => []),
        rtdbList<any>('commissions').catch(() => [])
      ]);

      const ordersData = rtdbOrders.map(item => ({ id: item.id, ...(item.data || {}) }));
      const productsData = rtdbProducts.map(p => ({ id: p.id, ...(p.data || {}) }));
      const usersData = rtdbUsers.map(u => ({ id: u.id, ...(u.data || {}) }));
      const withdrawalsData = rtdbWithdrawals.map(w => ({ id: w.id, ...(w.data || {}) }));
      const commissionsData = rtdbCommissions.map(c => ({ id: c.id, ...(c.data || {}) }));

      // Filter by date if needed
      let filteredOrders = ordersData;
      let filteredWithdrawals = withdrawalsData;
      
      if (dateRange !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (dateRange) {
          case '7days': startDate = subDays(now, 7); break;
          case '30days': startDate = subDays(now, 30); break;
          case 'thisMonth': startDate = startOfMonth(now); break;
          case 'thisYear': startDate = startOfYear(now); break;
        }

        filteredOrders = ordersData.filter((o: any) => {
          const date = parseDate(o.createdAt);
          if (!date) return true; // keep if date missing so counts aren't completely wiped
          return date >= startDate;
        });
        
        filteredWithdrawals = withdrawalsData.filter((w: any) => {
           const date = parseDate(w.createdAt);
           if (!date) return true;
           return date >= startDate;
        });
      }

      setOrders(filteredOrders);
      setProducts(productsData);
      setUsers(usersData);
      setWithdrawals(filteredWithdrawals);
      setCommissions(commissionsData);

    } catch (error) {
      console.error("Error fetching report data from RTDB:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const normalizeStatus = (status: string) => String(status || '').toLowerCase().trim();

  const totalSales = orders.filter((o: any) => {
    const s = normalizeStatus(o.status);
    return s === 'delivered' || s === 'completed';
  }).reduce((sum: number, order: any) => sum + (Number(order.total) || 0), 0);

  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
  
  const pendingOrders = orders.filter((o: any) => normalizeStatus(o.status) === 'pending').length;
  const deliveredOrders = orders.filter((o: any) => {
    const s = normalizeStatus(o.status);
    return s === 'delivered' || s === 'completed';
  }).length;
  const cancelledOrders = orders.filter((o: any) => normalizeStatus(o.status) === 'cancelled').length;
  const disputedOrders = orders.filter((o: any) => {
    const s = normalizeStatus(o.status);
    const p = normalizeStatus(o.vendorPayoutStatus);
    const d = normalizeStatus(o.dispute?.status);
    return s === 'dispute' || p === 'disputed' || d === 'under review' || d === 'open';
  }).length;
  const refundedOrders = orders.filter((o: any) => {
    const s = normalizeStatus(o.status);
    const p = normalizeStatus(o.vendorPayoutStatus);
    return s === 'refunded' || p === 'refunded';
  }).length;

  // Chart Data preparation (Last 7 Days Sales Trend)
  const getSalesChartData = () => {
    const days = 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'MMM dd');
      
      const dayOrders = orders.filter((o: any) => {
        const orderDate = parseDate(o.createdAt);
        if (!orderDate) return false;
        const s = normalizeStatus(o.status);
        return format(orderDate, 'MMM dd') === dateStr && (s === 'delivered' || s === 'completed');
      });
      
      const daySales = dayOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
      data.push({ date: dateStr, sales: daySales, orders: dayOrders.length });
    }
    return data;
  };

  const handleExportCSV = () => {
    // Generate CSV for orders as an example
    const headers = ['Order ID', 'Date', 'Customer', 'Total', 'Status'];
    const csvData = orders.map((o: any) => {
      const d = parseDate(o.createdAt);
      return [
        o.orderId || o.id,
        d ? format(d, 'yyyy-MM-dd HH:mm') : '',
        o.shippingAddress?.name || o.customerName || '',
        o.total || 0,
        o.status || ''
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_report_${dateRange}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Comprehensive overview of platform performance.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main text-sm"
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="thisYear">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
          
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-700">Total Sales</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">৳{totalSales.toLocaleString()}</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-700">Total Orders</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">{totalOrders}</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="font-semibold text-slate-700">Avg. Order Value</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">৳{Math.round(avgOrderValue).toLocaleString()}</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="font-semibold text-slate-700">Total Users</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">{users.length}</p>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Sales Trend (Last 7 Days)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getSalesChartData()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `৳${value}`} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`৳${value}`, 'Sales']}
                    />
                    <Line type="monotone" dataKey="sales" stroke="#0ea5e9" strokeWidth={3} dot={{r: 4, fill: '#0ea5e9'}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Order Status Distribution</h3>
              <div className="h-72 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Pending', count: pendingOrders, fill: '#eab308' },
                    { name: 'Delivered', count: deliveredOrders, fill: '#22c55e' },
                    { name: 'Cancelled', count: cancelledOrders, fill: '#ef4444' },
                    { name: 'Disputed', count: disputedOrders, fill: '#f43f5e' },
                    { name: 'Refunded', count: refundedOrders, fill: '#a855f7' }
                  ]} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <RechartsTooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={45} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detailed Reports Navigation */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-100 overflow-x-auto hide-scrollbar">
              <button 
                onClick={() => setActiveTab('sales')}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'sales' ? 'border-primary-main text-primary-main' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Sales & Orders
              </button>
              <button 
                onClick={() => setActiveTab('products')}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'products' ? 'border-primary-main text-primary-main' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Products & Inventory
              </button>
              <button 
                onClick={() => setActiveTab('users')}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'users' ? 'border-primary-main text-primary-main' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Users & Vendors
              </button>
            </div>
            
            <div className="p-6">
              {activeTab === 'sales' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Delivered Orders</p>
                    <p className="text-xl font-bold text-slate-900">{deliveredOrders}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Pending Orders</p>
                    <p className="text-xl font-bold text-slate-900">{pendingOrders}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Cancelled Orders</p>
                    <p className="text-xl font-bold text-slate-900">{cancelledOrders}</p>
                  </div>
                  <div className="p-4 bg-rose-50 rounded-lg border border-rose-100">
                    <p className="text-sm text-rose-600 mb-1 font-medium">Active Disputes</p>
                    <p className="text-xl font-bold text-rose-900">{disputedOrders}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <p className="text-sm text-purple-600 mb-1 font-medium">Refunded Orders</p>
                    <p className="text-xl font-bold text-purple-900">{refundedOrders}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 sm:col-span-2 md:col-span-3 lg:col-span-5">
                    <p className="text-sm text-slate-500 mb-1">Total Withdrawals Requested</p>
                    <p className="text-xl font-bold text-slate-900">৳{withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0).toLocaleString()}</p>
                  </div>
                </div>
              )}
              
              {activeTab === 'products' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Total Products</p>
                    <p className="text-xl font-bold text-slate-900">{products.length}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Active Products</p>
                    <p className="text-xl font-bold text-slate-900">{products.filter(p => p.status !== 'inactive').length}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Out of Stock</p>
                    <p className="text-xl font-bold text-slate-900">{products.filter(p => p.stock === 0).length}</p>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Total Users</p>
                    <p className="text-xl font-bold text-slate-900">{users.length}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Vendors</p>
                    <p className="text-xl font-bold text-slate-900">{users.filter(u => u.role === 'vendor').length}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Resellers</p>
                    <p className="text-xl font-bold text-slate-900">{users.filter(u => u.role === 'reseller').length}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Admins</p>
                    <p className="text-xl font-bold text-slate-900">{users.filter(u => u.role === 'admin').length}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
