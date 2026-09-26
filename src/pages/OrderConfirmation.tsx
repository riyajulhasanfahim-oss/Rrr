import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { rtdbGet } from '../lib/rtdb';
import { useAuth } from '../context/AuthContext';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { CheckCircle, Package, Truck, Calendar, MapPin, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

import { safeStorage } from '../utils/storage';

export default function OrderConfirmation() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(() => {
    if (orderId) {
      try {
        const localCached = safeStorage.getItem(`pending_order_${orderId}`);
        if (localCached) return JSON.parse(localCached);
      } catch (e) {
        // ignore
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(!order);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;
      try {
        const orderData = await rtdbGet<any>(`orders/${orderId}`);
        if (orderData) {
          setOrder(orderData);
        } else if (!order) {
          try {
            const localCached = safeStorage.getItem(`pending_order_${orderId}`);
            if (localCached) {
              setOrder(JSON.parse(localCached));
            } else {
              toast.error('Order not found');
            }
          } catch (e) {
            toast.error('Order not found');
          }
        }
      } catch (err) {
        console.error('Error fetching order:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 ">
        <Loader2 className="h-10 w-10 text-primary-main animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow pt-6 sm:pt-10 pb-8 sm:pb-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white  rounded-3xl p-8 sm shadow-sm border border-gray-100  text-center"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="w-24 h-24 bg-green-100  text-green-500 rounded-full flex items-center justify-center mx-auto mb-8"
            >
              <CheckCircle className="h-12 w-12" />
            </motion.div>
            <h1 className="text-3xl sm font-bold text-gray-900  mb-4">
              Thank you for your order!
            </h1>
            <p className="text-lg text-gray-600  mb-8 max-w-lg mx-auto">
              Your order has been placed successfully. We will send you an email confirmation with your order details.
            </p>

            <div className="bg-gray-50  rounded-2xl p-6 mb-8 text-left border border-gray-100 ">
              <h2 className="text-sm font-semibold text-gray-500  uppercase tracking-wider mb-4">Order Details</h2>
              <div className="grid grid-cols-1 sm gap-6">
                <div className="flex gap-3">
                  <Package className="h-5 w-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-500 ">Order ID</p>
                    <p className="font-semibold text-gray-900 ">{order?.orderId}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Calendar className="h-5 w-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-500 ">Date</p>
                    <p className="font-semibold text-gray-900 ">
                      {order?.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Truck className="h-5 w-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-500 ">Status</p>
                    <p className="font-semibold text-primary-main">{order?.status || 'Processing'}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-500 ">Shipping To</p>
                    <p className="font-semibold text-gray-900  line-clamp-1">
                      {order?.shippingAddress?.fullAddress || 'N/A'}
                    </p>
                  </div>
                </div>
                {order?.paymentGateway && (
                  <div className="flex gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-sm text-gray-500">Payment Gateway</p>
                      <p className="font-semibold text-gray-900">
                        {order.paymentGateway} {order.paymentMethod ? `(${order.paymentMethod.toUpperCase()})` : ''}
                      </p>
                      {order.transactionId && (
                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                          Trx ID: {order.transactionId}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link 
                to={`/orders/${orderId}`} 
                className="px-6 py-3 bg-primary-main text-white font-semibold rounded-xl hover:bg-sky-600 transition-colors shadow-md flex items-center justify-center gap-2"
              >
                <Truck className="h-4 w-4" />
                Track Order
              </Link>
              <Link 
                to="/orders" 
                className="px-6 py-3 bg-gray-100 text-gray-800 font-semibold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center"
              >
                My Orders
              </Link>
              <Link 
                to="/" 
                className="px-6 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                Continue Shopping
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
