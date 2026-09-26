import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { rtdbGet, rtdbSet, rtdbUpdate, rtdbList } from '../../lib/rtdb';
import { Loader2, CheckCircle, XCircle, AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';

export default function EmonPayCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Support parameters from Emon Pay official documentation
  // Query parameters: transactionId, paymentMethod, paymentAmount, paymentFee, status
  const orderId = searchParams.get('orderId') || '';
  const transactionId = searchParams.get('transactionId') || searchParams.get('transaction_id') || searchParams.get('trxID') || '';
  const statusParam = (searchParams.get('status') || '').toUpperCase();
  const isCancelled = searchParams.get('cancel') === 'true' || statusParam === 'CANCELLED';
  const paymentMethodParam = searchParams.get('paymentMethod') || 'emonpay';
  const paymentAmountParam = searchParams.get('paymentAmount') || searchParams.get('amount') || '';

  const [state, setState] = useState<'verifying' | 'success' | 'failed' | 'cancelled'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [verifiedDetails, setVerifiedDetails] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    const processPaymentCallback = async () => {
      if (!orderId) {
        setState('failed');
        setErrorMessage('Invalid callback request: Missing order ID.');
        return;
      }

      try {
        const orderData = await rtdbGet<any>(`orders/${orderId}`);

        if (!orderData) {
          setState('failed');
          setErrorMessage(`Order #${orderId} was not found in the database.`);
          return;
        }

        // 1. User Cancelled Payment on Emon Pay checkout
        if (isCancelled) {
          await rtdbUpdate(`orders/${orderId}`, {
            paymentStatus: 'cancelled',
            status: 'Cancelled',
            cancelledAt: Date.now(),
            cancellationReason: 'Cancelled by customer on Emon Pay checkout'
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
          setErrorMessage('Payment failed or was declined on Emon Pay.');
          await rtdbUpdate(`orders/${orderId}`, {
            paymentStatus: 'failed',
            status: 'Failed',
            failedAt: Date.now(),
            failureReason: 'Payment declined on Emon Pay gateway'
          });
          return;
        }

        // 4. Server-Side Verification via Emon Pay API
        if (!transactionId) {
          setState('failed');
          setErrorMessage('No transaction reference was returned by Emon Pay.');
          await rtdbUpdate(`orders/${orderId}`, {
            paymentStatus: 'failed',
            status: 'Failed',
            failedAt: Date.now(),
            failureReason: 'Missing transaction ID from payment gateway'
          });
          return;
        }

        const verifyResponse = await fetch('/api/payment/emonpay/verify', {
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
          setErrorMessage(verifyData.error || 'Emon Pay server verification could not be confirmed.');
          await rtdbUpdate(`orders/${orderId}`, {
            paymentStatus: 'failed',
            status: 'Failed',
            failedAt: Date.now(),
            failureReason: verifyData.error || 'Server payment verification rejected'
          });
          return;
        }

        // 5. Update RTDB Order Status to 'paid' and 'Confirmed'
        // 5. Update RTDB Order Status to 'Paid' and 'Confirmed' ONLY after verified
        const verifiedTrx = verifyData.transactionId || transactionId;
        const paidAtTime = verifyData.timestamp || Date.now();
        const autoReleaseAt = paidAtTime + (96 * 60 * 60 * 1000); // 4 days (96 hours)
        const finalGrandTotal = Number(orderData.grandTotal ?? orderData.total ?? 0);

        await rtdbUpdate(`orders/${orderId}`, {
          paymentStatus: 'Paid',
          status: 'Confirmed',
          paymentGateway: 'Emon Pay',
          paymentMethod: verifyData.paymentMethod || paymentMethodParam || orderData.paymentMethod || 'emonpay',
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
          toast.success('Payment verified successfully with Emon Pay!');
          setTimeout(() => {
            navigate(`/order-confirmation/${orderId}`);
          }, 1500);
        }
      } catch (err: any) {
        console.error('Emon Pay callback verification error:', err);
        if (isMounted) {
          setState('failed');
          setErrorMessage(err.message || 'An unexpected error occurred during verification.');
        }
      }
    };

    processPaymentCallback();

    return () => {
      isMounted = false;
    };
  }, [orderId, transactionId, isCancelled, statusParam, navigate, paymentMethodParam, paymentAmountParam]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 text-center">
          
          {/* VERIFYING */}
          {state === 'verifying' && (
            <div className="space-y-4 py-6">
              <div className="w-16 h-16 bg-primary-main/10 text-primary-main rounded-2xl flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                Verifying Payment with Emon Pay
              </h1>
              <p className="text-sm text-gray-500 max-w-xs mx-auto">
                Please wait while our server authenticates your transaction with Emon Pay gateway...
              </p>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs text-gray-600 font-mono">
                Order: #{orderId}
              </div>
            </div>
          )}

          {/* SUCCESS */}
          {state === 'success' && (
            <div className="space-y-4 py-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                Payment Successful!
              </h1>
              <p className="text-sm text-gray-600">
                Your payment has been verified by Emon Pay. Redirecting to your order confirmation...
              </p>
              {verifiedDetails?.transactionId && (
                <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 text-xs text-left space-y-1">
                  <div className="flex justify-between">
                    <span className="text-emerald-700">Gateway:</span>
                    <span className="font-bold text-emerald-900">Emon Pay</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-700">Transaction ID:</span>
                    <span className="font-mono font-bold text-emerald-900">{verifiedDetails.transactionId}</span>
                  </div>
                  {verifiedDetails.amount && (
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Amount Paid:</span>
                      <span className="font-bold text-emerald-900">৳{verifiedDetails.amount}</span>
                    </div>
                  )}
                </div>
              )}
              <Link
                to={`/order-confirmation/${orderId}`}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-main text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-all shadow-xs"
              >
                <span>View Order Details</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* CANCELLED */}
          {state === 'cancelled' && (
            <div className="space-y-4 py-4">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                Payment Cancelled
              </h1>
              <p className="text-sm text-gray-600">
                You cancelled the payment on the Emon Pay checkout page. No amount was deducted.
              </p>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 text-xs text-amber-800">
                Order #{orderId} status set to <strong>Cancelled</strong>.
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <Link
                  to="/checkout"
                  className="flex-1 py-2.5 px-4 bg-primary-main text-white text-xs font-semibold rounded-xl hover:bg-primary-dark transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </Link>
                <Link
                  to="/orders"
                  className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-200 transition-all"
                >
                  My Orders
                </Link>
              </div>
            </div>
          )}

          {/* FAILED */}
          {state === 'failed' && (
            <div className="space-y-4 py-4">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                Payment Verification Failed
              </h1>
              <p className="text-sm text-gray-600">
                {errorMessage || 'The transaction could not be verified by the Emon Pay gateway.'}
              </p>
              <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 text-xs text-rose-800 font-mono">
                Order: #{orderId}
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <Link
                  to="/checkout"
                  className="flex-1 py-2.5 px-4 bg-primary-main text-white text-xs font-semibold rounded-xl hover:bg-primary-dark transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Payment</span>
                </Link>
                <Link
                  to="/orders"
                  className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-200 transition-all"
                >
                  My Orders
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
