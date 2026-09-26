import { rtdbGet, rtdbSet, rtdbUpdate, rtdbPush, rtdbList } from '../lib/rtdb';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { isCodOrder } from './vendorPayoutService';
import { cancelResellerOrderPendingProfit } from './resellerOrderService';

export interface RefundEligibility {
  isCod: boolean;
  isPaid: boolean;
  actualPaidAmount: number;
  orderTotal: number;
  isEligibleForRefund: boolean;
  alreadyRefunded: boolean;
  reason: string;
}

/**
 * Accurately determines if an order was paid via online/advance payment
 * and calculates the exact amount actually paid by the customer.
 * 
 * Rules:
 * - COD orders: ZERO refund.
 * - Online payment not successful / unpaid: ZERO refund.
 * - Already refunded: ZERO refund (duplicate prevention).
 * - Refund capped at orderTotal and actual paid amount.
 */
export function checkRefundEligibility(order: any): RefundEligibility {
  if (!order) {
    return {
      isCod: false,
      isPaid: false,
      actualPaidAmount: 0,
      orderTotal: 0,
      isEligibleForRefund: false,
      alreadyRefunded: false,
      reason: 'অর্ডারের তথ্য পাওয়া যায়নি'
    };
  }

  // 1. Check if already refunded
  if (order.walletRefundProcessed === true || order.refundStatus === 'refunded') {
    return {
      isCod: false,
      isPaid: true,
      actualPaidAmount: 0,
      orderTotal: Number(order.grandTotal ?? order.total ?? 0),
      isEligibleForRefund: false,
      alreadyRefunded: true,
      reason: 'এই অর্ডারের রিফান্ড ইতিমধ্যে সম্পন্ন হয়েছে (Duplicate Prevention)'
    };
  }

  const pMethod = String(order.paymentMethod || '').toLowerCase().trim();
  const pGateway = String(order.paymentGateway || '').toLowerCase().trim();
  const pStatus = String(order.paymentStatus || '').toLowerCase().trim();

  // 2. Check if COD
  const isCod = 
    isCodOrder(order) || 
    pMethod === 'cod' || 
    pMethod === 'cash on delivery (cod)' || 
    pMethod.includes('cash on delivery') ||
    pGateway === 'cod' ||
    pGateway.includes('cash on delivery');

  const orderTotal = Number(order.grandTotal ?? order.total ?? order.subtotal ?? 0);

  // If COD order: strictly NO refund to customer wallet
  if (isCod && order.advancePaymentType !== 'delivery_charge' && order.advancePaymentType !== 'full') {
    return {
      isCod: true,
      isPaid: false,
      actualPaidAmount: 0,
      orderTotal,
      isEligibleForRefund: false,
      alreadyRefunded: false,
      reason: 'ক্যাশ অন ডেলিভারি (COD) অর্ডার হওয়ায় কোনো ওয়ালেট রিফান্ড প্রয়োজন নেই।'
    };
  }

  // 3. Check Payment Status
  const isPaid = pStatus === 'paid' || Boolean(order.paidAt) || Boolean(order.paymentVerifiedAt);
  if (!isPaid) {
    return {
      isCod,
      isPaid: false,
      actualPaidAmount: 0,
      orderTotal,
      isEligibleForRefund: false,
      alreadyRefunded: false,
      reason: 'অনলাইন পেমেন্ট সম্পন্ন বা সফল হয়নি, তাই রিফান্ড প্রযোজ্য নয়।'
    };
  }

  // 4. Calculate actual paid amount from payment fields (never guessed from total)
  let rawPaid = Number(
    order.paidAmount ?? 
    order.advancePaymentAmount ?? 
    order.advanceAmount ?? 
    order.receivedAmount ?? 
    0
  );

  // If full payment online was recorded without explicit paidAmount, check grandTotal
  if (
    rawPaid <= 0 && 
    (pMethod === 'product_full_payment' || pMethod === 'wallet' || pMethod === 'online' || pGateway.includes('online')) &&
    isPaid
  ) {
    rawPaid = orderTotal;
  }

  // Ensure refund cannot exceed order total and cannot be negative
  let actualPaidAmount = Math.max(0, rawPaid);
  if (orderTotal > 0 && actualPaidAmount > orderTotal) {
    actualPaidAmount = orderTotal;
  }
  actualPaidAmount = Math.round(actualPaidAmount * 100) / 100;

  if (actualPaidAmount <= 0) {
    return {
      isCod,
      isPaid: true,
      actualPaidAmount: 0,
      orderTotal,
      isEligibleForRefund: false,
      alreadyRefunded: false,
      reason: 'কোনো পেইড বা অগ্রিম পেমেন্ট পাওয়া যায়নি।'
    };
  }

  return {
    isCod: false,
    isPaid: true,
    actualPaidAmount,
    orderTotal,
    isEligibleForRefund: true,
    alreadyRefunded: false,
    reason: `সফল অনলাইন পেমেন্ট শনাক্ত হয়েছে: ৳${actualPaidAmount}`
  };
}

export interface CancelOrderResult {
  success: boolean;
  message: string;
  refundProcessed: boolean;
  refundAmount: number;
  transactionId?: string;
}

/**
 * Executes Vendor Cancel Flow:
 * 1. Cancels the order in vendor_orders and orders.
 * 2. Saves the vendor's Cancel Notice/Reason to the order.
 * 3. If online payment was successful, credits the customer's wallet with the exact actual paid amount.
 * 4. Creates a clear wallet transaction record for the refund.
 * 5. Prevents duplicate refunds.
 * 6. Logs status history and sends in-app notification to the customer.
 */
export async function executeVendorOrderCancellation({
  order,
  vendorId,
  cancelReason
}: {
  order: any;
  vendorId: string;
  cancelReason: string;
}): Promise<CancelOrderResult> {
  if (!order) {
    throw new Error('অর্ডার পাওয়া যায়নি');
  }

  const cleanNotice = (cancelReason || '').trim();
  if (!cleanNotice) {
    throw new Error('দয়া করে অর্ডার বাতিলের কারণ বা নোটিশ উল্লেখ করুন');
  }

  const now = Date.now();
  const vendorOrderDocId = String(order.id || '').replace(/^#/, '');
  const mainOrderId = String(order.mainOrderId || order.orderId || order.id || '').replace(/^#/, '');

  // 1. Fetch latest authoritative data from RTDB to prevent stale race conditions
  let freshMainOrder: any = null;
  let freshVendorOrder: any = null;

  try {
    freshMainOrder = await rtdbGet<any>(`orders/${mainOrderId}`);
  } catch (e) {
    console.warn('Error reading fresh main order from RTDB:', e);
  }

  try {
    if (vendorOrderDocId) {
      freshVendorOrder = await rtdbGet<any>(`vendor_orders/${vendorOrderDocId}`);
    }
  } catch (e) {
    console.warn('Error reading fresh vendor order from RTDB:', e);
  }

  const authoritativeOrder = {
    ...order,
    ...(freshMainOrder || {}),
    ...(freshVendorOrder || {})
  };

  // 2. Check Refund Eligibility
  const eligibility = checkRefundEligibility(authoritativeOrder);

  // Prevent duplicate refunds
  if (eligibility.alreadyRefunded) {
    return {
      success: false,
      message: 'এই অর্ডারে ইতিমধ্যে রিফান্ড সম্পন্ন হয়েছে। ডুপ্লিকেট রিফান্ড অনুমোদিত নয়।',
      refundProcessed: false,
      refundAmount: 0
    };
  }

  const customerId = authoritativeOrder.customerId || authoritativeOrder.userId;
  let refundProcessed = false;
  let transactionId = '';
  const refundAmount = eligibility.isEligibleForRefund ? eligibility.actualPaidAmount : 0;

  // 3. Process Wallet Refund if eligible
  if (refundAmount > 0 && customerId && customerId !== 'guest') {
    // Check if an existing refund transaction already exists for this order in RTDB
    try {
      const existingTx = await rtdbList<any>('wallet_transactions', (tx) => 
        tx.orderId === mainOrderId && tx.category === 'refund' && tx.status === 'Success'
      );
      if (existingTx && existingTx.length > 0) {
        console.warn(`Refund transaction already exists for order #${mainOrderId}`);
        eligibility.isEligibleForRefund = false;
      }
    } catch (txChkErr) {
      console.warn('Error checking existing refund transactions:', txChkErr);
    }

    if (eligibility.isEligibleForRefund) {
      transactionId = `TXN-REF-${mainOrderId.substring(0, 10)}-${now}`;

      // A. Fetch current user balance
      let currentBalance = 0;
      try {
        const userDoc = await rtdbGet<any>(`users/${customerId}`);
        if (userDoc) {
          currentBalance = typeof userDoc.wallet === 'number' 
            ? userDoc.wallet 
            : (typeof userDoc.balance === 'number' ? userDoc.balance : 0);
        }
      } catch (uErr) {
        console.warn('Error getting user balance from RTDB:', uErr);
      }

      const newBalance = Number((currentBalance + refundAmount).toFixed(2));

      // B. Save wallet transaction record in RTDB
      const txData = {
        id: transactionId,
        transactionId,
        userId: customerId,
        orderId: mainOrderId,
        vendorId: vendorId || authoritativeOrder.vendorId || '',
        amount: refundAmount,
        previousBalance: currentBalance,
        newBalance: newBalance,
        type: 'credit',
        category: 'refund',
        paymentMethod: 'Wallet Refund',
        description: `অর্ডার #${mainOrderId.substring(0, 8)} বাতিল বাবদ রিফান্ড। কারণ: ${cleanNotice}`,
        status: 'Success',
        timestamp: now,
        createdAt: now,
        updatedAt: now
      };

      await rtdbSet(`wallet_transactions/${transactionId}`, txData);

      // C. Update users document in RTDB
      await rtdbUpdate(`users/${customerId}`, {
        wallet: newBalance,
        balance: newBalance,
        updatedAt: now
      });

      // D. Update user_wallet document in RTDB
      try {
        const uwData = await rtdbGet<any>(`user_wallet/${customerId}`);
        if (uwData) {
          await rtdbUpdate(`user_wallet/${customerId}`, {
            walletBalance: newBalance,
            updatedAt: now
          });
        } else {
          await rtdbSet(`user_wallet/${customerId}`, {
            userId: customerId,
            walletBalance: newBalance,
            createdAt: now,
            updatedAt: now
          });
        }
      } catch (uwErr) {
        console.warn('user_wallet RTDB update note:', uwErr);
      }

      // E. Sync Firestore users document
      try {
        await setDoc(doc(db, 'users', customerId), {
          wallet: newBalance,
          balance: newBalance,
          updatedAt: now
        }, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore user wallet sync note:', fsErr);
      }

      refundProcessed = true;
    }
  }

  // 4. Update vendor_orders doc in RTDB
  const orderUpdatePayload: any = {
    status: 'Cancelled',
    vendorStatus: 'Cancelled',
    cancelledAt: now,
    cancelledBy: 'vendor',
    cancelReason: cleanNotice,
    cancellationNotice: cleanNotice,
    vendorCancelReason: cleanNotice,
    refundStatus: refundProcessed ? 'refunded' : (eligibility.isCod ? 'no_refund_needed' : 'none'),
    refundAmount: refundProcessed ? refundAmount : 0,
    walletRefundProcessed: refundProcessed,
    walletRefundTxId: refundProcessed ? transactionId : null,
    vendorPayoutStatus: 'Cancelled',
    updatedAt: now
  };

  const updatePromises: Promise<any>[] = [];

  const isResellerOrder = Boolean(authoritativeOrder.isResellerOrder || authoritativeOrder.resellerId || authoritativeOrder.profitStatus);
  if (isResellerOrder) {
    orderUpdatePayload.profitStatus = 'CANCELLED';
    updatePromises.push(
      cancelResellerOrderPendingProfit(mainOrderId, cleanNotice).catch(e => console.warn('Reseller profit cancel warning:', e))
    );
  }

  if (vendorOrderDocId) {
    updatePromises.push(rtdbUpdate(`vendor_orders/${vendorOrderDocId}`, orderUpdatePayload));
  }

  // 5. Update main orders doc in RTDB
  if (mainOrderId) {
    updatePromises.push(rtdbUpdate(`orders/${mainOrderId}`, orderUpdatePayload));
  }

  // 6. Push order status log
  updatePromises.push(
    rtdbPush('order_status_logs', {
      orderId: vendorOrderDocId || mainOrderId,
      mainOrderId: mainOrderId,
      vendorId: vendorId,
      oldStatus: authoritativeOrder.status || 'Pending',
      newStatus: 'Cancelled',
      note: `অর্ডারটি ভেন্ডর কর্তৃক বাতিল করা হয়েছে। নোটিশ: ${cleanNotice}${refundProcessed ? ` (কাস্টমারের ওয়ালেটে ৳${refundAmount} রিফান্ড করা হয়েছে)` : ''}`,
      timestamp: now
    })
  );

  // 7. Push in-app notification directly to specific Customer account in RTDB
  if (customerId && customerId !== 'guest') {
    const notifyId = `notif_order_cancelled_${mainOrderId}`;
    
    // Check if a cancellation notification already exists for this customer and order to prevent duplicates
    let alreadyNotified = false;
    try {
      const existingNotif = await rtdbGet<any>(`notifications/${customerId}/${notifyId}`);
      if (existingNotif) {
        alreadyNotified = true;
      }
    } catch {
      alreadyNotified = false;
    }

    if (!alreadyNotified) {
      const fullMessage = refundProcessed
        ? `Vendor আপনার #${mainOrderId.substring(0, 8)} অর্ডারটি বাতিল করেছে।\n\nVendor-এর নোটিশ:\n"${cleanNotice}"\n\nআপনার পরিশোধিত ৳${refundAmount} আপনার ওয়ালেটে রিফান্ড করা হয়েছে। আপনি চাইলে My Profile → My Wallet থেকে উইথড্র করতে পারবেন।`
        : `Vendor আপনার #${mainOrderId.substring(0, 8)} অর্ডারটি বাতিল করেছে।\n\nVendor-এর নোটিশ:\n"${cleanNotice}"`;

      const customerNotifPayload = {
        id: notifyId,
        userId: customerId,
        title: '🔴 অর্ডার বাতিল করা হয়েছে',
        message: fullMessage,
        type: 'order_cancelled',
        orderId: mainOrderId,
        vendorNotice: cleanNotice,
        vendorCancelReason: cleanNotice,
        createdAt: now,
        timestamp: now,
        read: false,
        link: `/orders/${mainOrderId}`,
        metadata: {
          orderId: mainOrderId,
          link: `/orders/${mainOrderId}`,
          vendorNotice: cleanNotice,
          refundProcessed,
          refundAmount
        }
      };

      // Set directly to private customer notification bucket notifications/${customerId}/${notifyId}
      updatePromises.push(rtdbSet(`notifications/${customerId}/${notifyId}`, customerNotifPayload));
    }
  }

  await Promise.allSettled(updatePromises);

  return {
    success: true,
    message: refundProcessed
      ? `অর্ডার #${mainOrderId.substring(0, 8)} সফলভাবে বাতিল করা হয়েছে এবং কাস্টমারের ওয়ালেটে ৳${refundAmount} রিফান্ড করা হয়েছে!`
      : `অর্ডার #${mainOrderId.substring(0, 8)} সফলভাবে বাতিল করা হয়েছে।`,
    refundProcessed,
    refundAmount,
    transactionId
  };
}
