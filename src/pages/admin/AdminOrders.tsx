import React, { useEffect, useState } from 'react';
import { rtdbList, rtdbSubscribe } from '../../lib/rtdb';
import { Search, Filter, Eye, Clock, Truck, CheckCircle, XCircle, AlertTriangle, Archive, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPayment, setFilterPayment] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

  const statusOptions = ['All', 'Pending', 'Accepted', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered', 'Dispute', 'Cancelled', 'Returned', 'Refunded', 'Failed'];
  const paymentOptions = ['All', 'Pending', 'Paid', 'Failed', 'Refunded', 'Partially Refunded'];

  useEffect(() => {
    fetchOrders();

    const unsub = rtdbSubscribe('orders', (data) => {
      if (data && typeof data === 'object') {
        const fetchedOrders = Object.entries(data).map(([key, val]: [string, any]) => ({
          id: key,
          ...val
        }));
        setOrders(fetchedOrders);
      }
    });

    return () => unsub();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const allOrdersSnap = await rtdbList<any>('orders');
      const fetchedOrders = allOrdersSnap.map(item => ({ id: item.id, ...item.data }));
      setOrders(fetchedOrders);
    } catch (err) {
      console.error('Error fetching orders from RTDB:', err);
      toast.error('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getOrderType = (order: any) => {
    // Check if it's a reseller order based on reseller profit in items or related field
    if (order.items?.some((i: any) => i.resellerProfit > 0)) {
      return 'Reseller';
    }
    return 'User';
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      order.shippingAddress?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shippingAddress?.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.userId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'All' || order.status === filterStatus;
    const matchesPayment = filterPayment === 'All' || order.paymentStatus === filterPayment;
    
    const type = getOrderType(order);
    const matchesType = filterType === 'All' || type === filterType;

    return matchesSearch && matchesStatus && matchesPayment && matchesType;
  }).sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    if (sortConfig.key === 'total') {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-700';
      case 'Confirmed': return 'bg-blue-100 text-blue-700';
      case 'Processing': return 'bg-indigo-100 text-indigo-700';
      case 'Packed': return 'bg-purple-100 text-purple-700';
      case 'Shipped': return 'bg-teal-100 text-teal-700';
      case 'Out for Delivery': return 'bg-orange-100 text-orange-700';
      case 'Delivered': return 'bg-emerald-100 text-emerald-700';
      case 'Dispute': case 'Disputed': return 'bg-rose-100 text-rose-700 font-bold border border-rose-200';
      case 'Cancelled': return 'bg-red-100 text-red-700';
      case 'Returned': return 'bg-slate-100 text-slate-700';
      case 'Refunded': return 'bg-cyan-100 text-cyan-700';
      case 'Failed': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-emerald-100 text-emerald-700';
      case 'Pending': case 'Unpaid': return 'bg-amber-100 text-amber-700';
      case 'Failed': return 'bg-red-100 text-red-700';
      case 'Refunded': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-main" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
          <p className="text-slate-500 mt-1">Manage all user, reseller, and vendor orders</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Order ID, Name, Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 appearance-none text-sm"
            >
              <option value="All">All Types</option>
              <option value="User">User Orders</option>
              <option value="Reseller">Reseller Orders</option>
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 appearance-none text-sm"
            >
              {statusOptions.map(opt => <option key={opt} value={opt}>{opt === 'All' ? 'All Status' : opt}</option>)}
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 appearance-none text-sm"
            >
              {paymentOptions.map(opt => <option key={opt} value={opt}>{opt === 'All' ? 'All Payments' : opt}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 text-sm font-semibold text-slate-600 cursor-pointer hover:text-primary-main" onClick={() => handleSort('orderId')}>
                  <div className="flex items-center gap-1">
                    Order ID {sortConfig.key === 'orderId' && <span className="text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th className="p-4 text-sm font-semibold text-slate-600">Customer</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Type</th>
                <th className="p-4 text-sm font-semibold text-slate-600 cursor-pointer hover:text-primary-main" onClick={() => handleSort('createdAt')}>
                  <div className="flex items-center gap-1">
                    Date {sortConfig.key === 'createdAt' && <span className="text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th className="p-4 text-sm font-semibold text-slate-600 cursor-pointer hover:text-primary-main" onClick={() => handleSort('total')}>
                  <div className="flex items-center gap-1">
                    Amount {sortConfig.key === 'total' && <span className="text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                  </div>
                </th>
                <th className="p-4 text-sm font-semibold text-slate-600">Payment</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Status</th>
                <th className="p-4 text-sm font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-slate-900">{order.orderId}</div>
                    <div className="text-xs text-slate-500 mt-1">{order.items?.length || 0} items</div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-medium text-slate-900">{order.shippingAddress?.name || 'Unknown'}</div>
                    <div className="text-xs text-slate-500">{order.shippingAddress?.phone}</div>
                  </td>
                  <td className="p-4">
                    {getOrderType(order) === 'Reseller' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">Reseller</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">User</span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    {order.createdAt ? format(new Date(order.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                  </td>
                  <td className="p-4 font-medium text-slate-900">
                    ৳{order.total?.toLocaleString() || 0}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                        {order.paymentStatus || 'Pending'}
                      </span>
                      <span className="text-xs text-slate-500 uppercase">{order.paymentMethod || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status || 'Pending'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-primary-main hover:bg-primary-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5" />
                    </Link>
                  </td>
                </tr>
              ))}
              
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No orders found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
