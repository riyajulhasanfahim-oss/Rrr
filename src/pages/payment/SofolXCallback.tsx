import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { rtdbGet, rtdbSet, rtdbUpdate, rtdbList } from '../../lib/rtdb';
import { Loader2, CheckCircle, XCircle, AlertTriangle, ArrowRight, RotateCcw, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';

export default function SofolXCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Support parameters from SofolX / SecurePay official documentation
  // Query parameters added upon redirect: transactionId, paymentMethod, paymentAmount, paymentFee, status
  const orderId = searchParams.get('orderId') || '';
  const transactionId = searchParams.get('transactionId') || searchParams.get('transaction_id') || searchParams.get('trxID') || '';
  const statusParam = (searchParams.get('status') || '').toUpperCase();
  const isCancelled = searchParams.get('cancel') === 'true' || statusParam === 'CANCELLED' || statusParam === 'CANCELED';
  const paymentMethodParam = searchParams.get('paymentMethod') || 'sofolx';
  const paymentAmountParam = searchParams.get('paymentAmount') || searchParams.get('amount') || '';

  const [state, setState] = useState<'verifying' | 'success' | 'failed' | 'cancelled'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [verifiedDetails, setVerifiedDetails] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    const processSofolXPayment = async () => {
      if (!orderId) {
        setState('failed');
        setErrorMessage('ভুল রিকোয়েস্ট: অর্ডার আইডি পাওয়া যায়নি।');
        return;
      }

      try {
        const orderData = await rtdbGet<any>(`orders/${orderId}`);

        if (!orderData) {
          setState('failed');
          setErrorMessage(`অর্ডার #${orderId} ডাটাবেজে পাওয়া যায়নি।`);
          return;
        }

        // 1. Customer Cancelled Payment on SofolX hosted checkout
        if (isCancelled) {
          await rtdbUpdate(`orders/${orderId}`, {
            paymentStatus: 'cancelled',
            status: 'Cancelled',
            cancelledAt: Date.now(),
            cancellationReason: 'SofolX চেকআউটে গ্রাহক পেমেন্ট বাতিল করেছেন'
          });

          // Sync vendor orders to Cancelled
          try {
            const vOrders = await rtdbList<any>('vendor_orders', (item) => item?.orderId === orderId);
            for (const vDoc of vOrders) {
              await rtdbUpdate(`vendor_orders/${vDoc.id}`, {
                paymentStatus: 'cancelled',
                status: 'Cancelled',
                updatedAt: Date.now()
              });
            }
          } catch (vErr) {
            console.warn('Vendor order sync on cancel error:', vErr);
          }

          if (isMounted) {
            setState('cancelled');
          }
          return;
        }

        // 2. Already Paid (Idempotency Protection)
        if (orderData.paymentStatus === 'paid' || orderData.paymentStatus === 'Paid') {
          if (isMounted) {
            setState('success');
            setVerifiedDetails({
              transactionId: orderData.transactionId || transactionId,
              amount: orderData.total || orderData.grandTotal
            });
            setTimeout(() => {
              navigate(`/order-confirmation/${orderId}`);
            }, 1200);
          }
          return;
        }

        // 3. Check for explicit failed status from gateway redirect
        if (statusParam === 'FAILED' || statusParam === 'ERROR') {
          setState('failed');
          setErrorMessage('SofolX পেমেন্ট ব্যর্থ হয়েছে অথবা প্রত্যাখ্যান করা হয়েছে।');
          await rtdbUpdate(`orders/${orderId}`, {
            paymentStatus: 'failed',
            status: 'Failed',
            failedAt: Date.now(),
            failureReason: 'SofolX গেটওয়েতে পেমেন্ট ব্যর্থ হয়েছে'
          });
          return;
        }

        // 4. Server-Side Verification via SofolX Official API
        // CRITICAL: শুধু success URL hit হলেই Paid হবে না; সার্ভার-সাইড ভেরিফাই হতেই হবে
        if (!transactionId) {
          setState('failed');
          setErrorMessage('SofolX কোনো ট্রানজ্যাকশন আইডি পাঠায়নি।');
          await rtdbUpdate(`orders/${orderId}`, {
            paymentStatus: 'failed',
            status: 'Failed',
            failedAt: Date.now(),
            failureReason: 'Missing transaction ID from SofolX gateway'
          });
          return;
        }

        const verifyResponse = await fetch('/api/payment/sofolx/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            transactionId,
            expectedAmount: orderData.total || orderData.grandTotal
          })
        });

        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok || !verifyData.success || verifyData.status !== 'paid') {
          setState('failed');
          setErrorMessage(verifyData.error || 'SofolX সার্ভার পেমেন্ট ভেরিফিকেশন সফল হয়নি।');
          await rtdbUpdate(`orders/${orderId}`, {
            paymentStatus: 'failed',
            status: 'Failed',
            failedAt: Date.now(),
            failureReason: verifyData.error || 'Server payment verification rejected by SofolX'
          });
          return;
        }

        // 5. Update RTDB Order Status to 'Paid' and 'Confirmed' ONLY after verified
        const verifiedTrx = verifyData.transactionId || transactionId;
        const paidAtTime = verifyData.timestamp || Date.now();
        const autoReleaseAt = paidAtTime + (96 * 60 * 60 * 1000); // 4 days (96 hours)
        const finalGrandTotal = Number(orderData.grandTotal ?? orderData.total ?? 0);

        await rtdbUpdate(`orders/${orderId}`, {
          paymentStatus: 'Paid',
          status: 'Confirmed',
          paymentGateway: 'SofolX',
          paymentMethod: verifyData.paymentMethod || paymentMethodParam || orderData.paymentMethod || 'sofolx',
          transactionId: verifiedTrx,
          paidAt: paidAtTime,
          vendorPayoutStatus: 'Held',
          autoReleaseAt: autoReleaseAt,
          advancePaymentAmount: finalGrandTotal,
          paidAmount: finalGrandTotal,
          advanceAmount: finalGrandTotal,
          advancePaymentType: 'full',
          codAmount: 0
        });

        // Sync vendor orders
        try {
          const vOrders = await rtdbList<any>('vendor_orders', (item) => item?.orderId === orderId);
          for (const vDoc of vOrders) {
            const vGrand = Number(vDoc.data?.grandTotal ?? vDoc.data?.total ?? 0);
            await rtdbUpdate(`vendor_orders/${vDoc.id}`, {
              paymentStatus: 'Paid',
              status: 'Confirmed',
              transactionId: verifiedTrx,
              vendorPayoutStatus: 'Held',
              vendorPayoutAmount: vGrand,
              autoReleaseAt: autoReleaseAt,
              advancePaymentAmount: vGrand,
              paidAmount: vGrand,
              advanceAmount: vGrand,
              advancePaymentType: 'full',
              codAmount: 0,
              updatedAt: Date.now()
            });

            // Update vendor wallet pendingBalance (Payment Held) if not already held
            const vVendorId = vDoc.data?.vendorId;
            if (vVendorId && vDoc.data?.vendorPayoutStatus !== 'Held' && vGrand > 0) {
              const curW = await rtdbGet<any>(`vendor_wallet/${vVendorId}`);
              if (curW) {
                await rtdbUpdate(`vendor_wallet/${vVendorId}`, {
                  pendingBalance: (curW.pendingBalance || 0) + vGrand,
                  updatedAt: Date.now()
                });
              } else {
                await rtdbSet(`vendor_wallet/${vVendorId}`, {
                  vendorId: vVendorId,
                  balance: 0,
                  pendingBalance: vGrand,
                  lifetimeEarnings: 0,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                });
              }
            }
          }
        } catch (vErr) {
          console.warn('Vendor order sync on paid error:', vErr);
        }

        if (isMounted) {
          setState('success');
          setVerifiedDetails({
            transactionId: verifiedTrx,
            amount: verifyData.verifiedAmount || paymentAmountParam || orderData.total || orderData.grandTotal
          });
          toast.success('SofolX পেমেন্ট সফলভাবে ভেরিফাই হয়েছে!');
          setTimeout(() => {
            navigate(`/order-confirmation/${orderId}`);
          }, 1500);
        }
      } catch (err: any) {
        console.error('SofolX callback error:', err);
        if (isMounted) {
          setState('failed');
          setErrorMessage(err.message || 'পেমেন্ট প্রসেসিং-এ সমস্যা হয়েছে। অনুগ্রহ করে সাপোর্টে যোগাযোগ করুন।');
        }
      }
    };

    processSofolXPayment();

    return () => {
      isMounted = false;
    };
  }, [orderId, transactionId, isCancelled, statusParam, paymentMethodParam, paymentAmountParam, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Header />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-16 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 md:p-10 shadow-xl border border-slate-100 w-full text-center">
          {state === 'verifying' && (
            <div className="py-6 space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-100 animate-ping opacity-25"></div>
                <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                </div>
              </div>

              <div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">পেমেন্ট ভেরিফাই করা হচ্ছে...</h1>
                <p className="text-slate-600 text-sm">
                  SofolX অফিসিয়াল API-র মাধ্যমে আপনার পেমেন্ট যাচাই করা হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন...
                </p>
              </div>

              {orderId && (
                <div className="bg-slate-50 rounded-2xl p-4 text-xs font-mono text-slate-600 space-y-1 inline-block border border-slate-200/60 max-w-xs w-full">
                  <div>অর্ডার আইডি: <span className="font-bold text-slate-900">#{orderId}</span></div>
                  {transactionId && (
                    <div>ট্রানজ্যাকশন আইডি: <span className="font-bold text-slate-900">{transactionId}</span></div>
                  )}
                  <div className="text-emerald-600 font-bold mt-1 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> সার্ভার-সাইড সিকিউর ভেরিফিকেশন
                  </div>
                </div>
              )}
            </div>
          )}

          {state === 'success' && (
            <div className="py-6 space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-10 h-10" />
              </div>

              <div>
                <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full mb-2 uppercase tracking-wide">
                  SofolX Verified
                </span>
                <h1 className="text-2xl font-black text-slate-900 mb-2">পেমেন্ট সফলভাবে নিশ্চিত হয়েছে!</h1>
                <p className="text-slate-600 text-sm">
                  আপনার পেমেন্ট SofolX সার্ভারে সফলভাবে অনুমোদিত হয়েছে। কিছুক্ষণের মধ্যে আপনাকে অর্ডার কনফার্মেশন পেজে নেওয়া হচ্ছে...
                </p>
              </div>

              {verifiedDetails && (
                <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 text-sm text-slate-700 space-y-2 text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-500">অর্ডার নম্বর:</span>
                    <span className="font-bold text-slate-900 font-mono">#{orderId}</span>
                  </div>
                  {verifiedDetails.transactionId && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">SofolX Trx ID:</span>
                      <span className="font-bold text-slate-900 font-mono">{verifiedDetails.transactionId}</span>
                    </div>
                  )}
                  {verifiedDetails.amount && (
                    <div className="flex justify-between border-t border-emerald-100 pt-2">
                      <span className="text-slate-500">পরিশোধিত টাকা:</span>
                      <span className="font-black text-emerald-700">৳{verifiedDetails.amount}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2">
                <Link
                  to={`/order-confirmation/${orderId}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 text-white rounded-xl font-bold shadow-md hover:bg-emerald-700 transition-colors"
                >
                  অর্ডার বিস্তারিত দেখুন
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {state === 'cancelled' && (
            <div className="py-6 space-y-6">
              <div className="w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-300 text-amber-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-10 h-10" />
              </div>

              <div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">পেমেন্ট বাতিল করা হয়েছে</h1>
                <p className="text-slate-600 text-sm">
                  SofolX চেকআউট পেজে আপনি পেমেন্ট প্রক্রিয়াটি বাতিল করেছেন। কোনো টাকা কাটা হয়নি।
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Link
                  to="/checkout"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  পুনরায় চেষ্টা করুন
                </Link>
                <Link
                  to="/"
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  হোমে ফিরে যান
                </Link>
              </div>
            </div>
          )}

          {state === 'failed' && (
            <div className="py-6 space-y-6">
              <div className="w-20 h-20 rounded-full bg-rose-50 border-2 border-rose-300 text-rose-600 flex items-center justify-center mx-auto">
                <XCircle className="w-10 h-10" />
              </div>

              <div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">পেমেন্ট ব্যর্থ হয়েছে</h1>
                <p className="text-rose-600 font-medium text-sm mb-1">{errorMessage}</p>
                <p className="text-slate-500 text-xs">
                  আপনার অ্যাকাউন্ট থেকে কোনো অর্থ কর্তন করা হয়ে থাকলে এবং অর্ডার পেইড না হলে সাপোর্ট সেন্টারে যোগাযোগ করুন।
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Link
                  to="/checkout"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  আবার চেষ্টা করুন
                </Link>
                <Link
                  to="/"
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  হোম পেজ
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
