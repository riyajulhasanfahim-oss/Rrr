import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { rtdbList } from '../../../lib/rtdb';
import VendorLayout from '../../../components/layout/VendorLayout';
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  ShoppingBag, 
  Calendar,
  MessageCircle,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: number;
  lastOrderId: string;
}

export default function VendorCustomers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCustomers();
  }, [user]);

  const loadCustomers = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // 1. Fetch vendor orders
      const vOrders = await rtdbList<any>('vendor_orders', (order) => order.vendorId === user.uid);
      
      // 2. Also fetch main orders for fallback
      const allOrders = await rtdbList<any>('orders', (order) => order.vendorId === user.uid);

      const combined = [...vOrders.map(v => v.data), ...allOrders.map(o => o.data)];
      
      const customerMap = new Map<string, CustomerRecord>();

      combined.forEach((order) => {
        const phone = order.customerPhone || order.shippingAddress?.phone || order.shippingAddress?.mobile || '';
        const email = order.customerEmail || order.shippingAddress?.email || '';
        const name = order.customerName || order.shippingAddress?.name || 'Customer';
        const address = order.shippingAddress 
          ? [order.shippingAddress.address, order.shippingAddress.city, order.shippingAddress.district].filter(Boolean).join(', ')
          : (order.customerAddress || '');

        const identifier = phone || email || order.customerId || order.userId || name;
        if (!identifier) return;

        const orderTotal = Number(order.subtotal || order.total || order.grandTotal || 0);
        const orderDate = Number(order.createdAt || order.orderDate || Date.now());

        if (customerMap.has(identifier)) {
          const existing = customerMap.get(identifier)!;
          existing.totalOrders += 1;
          existing.totalSpent += orderTotal;
          if (orderDate > existing.lastOrderDate) {
            existing.lastOrderDate = orderDate;
            existing.lastOrderId = order.orderId || order.id || '';
          }
          if (!existing.phone && phone) existing.phone = phone;
          if (!existing.email && email) existing.email = email;
          if (!existing.address && address) existing.address = address;
        } else {
          customerMap.set(identifier, {
            id: identifier,
            name,
            phone,
            email,
            address,
            totalOrders: 1,
            totalSpent: orderTotal,
            lastOrderDate: orderDate,
            lastOrderId: order.orderId || order.id || ''
          });
        }
      });

      const customerList = Array.from(customerMap.values()).sort((a, b) => b.lastOrderDate - a.lastOrderDate);
      setCustomers(customerList);
    } catch (err) {
      console.error('Failed to load customers from RTDB:', err);
      toast.error('Failed to load customers list');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <VendorLayout>
      <div className="max-w-6xl mx-auto pb-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-primary-main" />
              Store Customers
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Manage and view all customers who placed orders at your store
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-primary-main/10 text-primary-main text-xs font-bold px-3 py-1.5 rounded-full">
              Total Customers: {customers.length}
            </span>
          </div>
        </div>

        {/* Search Filter */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 mb-6 shadow-2xs">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by customer name, phone number, email or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:border-primary-main focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-primary-main border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">
              {searchTerm ? 'No matching customers found' : 'No customers yet'}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
              {searchTerm 
                ? 'Try adjusting your search criteria' 
                : 'When customers place orders from your store, they will automatically appear here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((cust) => (
              <div 
                key={cust.id} 
                className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-main to-sky-500 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        {cust.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm leading-tight">{cust.name}</h4>
                        <span className="text-[11px] text-gray-400">
                          ID: {cust.id.substring(0, 10)}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                      {cust.totalOrders} {cust.totalOrders === 1 ? 'Order' : 'Orders'}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1.5 text-xs text-gray-600 mb-4 border-t border-gray-100 pt-3">
                    {cust.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-800">{cust.phone}</span>
                      </div>
                    )}
                    {cust.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{cust.email}</span>
                      </div>
                    )}
                    {cust.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 text-gray-500">{cust.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer & Actions */}
                <div className="border-t border-gray-100 pt-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400 block">Total Spend</span>
                    <span className="text-xs font-bold text-gray-900">৳{cust.totalSpent.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {cust.phone && (
                      <>
                        <a
                          href={`tel:${cust.phone}`}
                          title="Call Customer"
                          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`https://wa.me/${cust.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp Customer"
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </VendorLayout>
  );
}
