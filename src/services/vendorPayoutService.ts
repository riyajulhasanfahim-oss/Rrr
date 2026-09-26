import { rtdbGet, rtdbSet, rtdbUpdate, rtdbPush, rtdbList, rtdbRemove } from '../lib/rtdb';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { safeStorage } from '../utils/storage';

export interface VendorPayoutDispute {
  status: 'Open' | 'Under Review' | 'Resolved - Released' | 'Resolved - Refunded' | 'Rejected';
  reason: string;
  details?: string;
  images?: string[];
  createdAt: number;
  raisedBy: string;
  raisedById?: string;
  vendorResponse?: {
    text: string;
    respondedAt: number;
    respondedBy: string;
    vendorId?: string;
  };
  resolvedAt?: number;
  resolvedBy?: string;
  resolutionNote?: string;
}

export const AUTO_RELEASE_HOURS = 96; // 4 Days (96 Hours) Automatic Release Window
export const AUTO_RELEASE_MS = AUTO_RELEASE_HOURS * 60 * 60 * 1000;

/**
 * Checks if an order is Cash on Delivery (COD)
 */
export function isCodOrder(order: any): boolean {
  if (!order) return false;
  const method = String(order.paymentMethod || '').toLowerCase().trim();
  const gateway = String(order.paymentGateway || '').toLowerCase().trim();
  
  if (
    method === 'cod' ||
    method === 'cash on delivery' ||
    method === 'cash on delivery (cod)' ||
    method === 'cash_on_delivery' ||
    method === 'cash-on-delivery' ||
    method.includes('cash on delivery') ||
    method.includes('cash_on_delivery') ||
    gateway === 'cod' ||
    gateway === 'cash on delivery' ||
    gateway === 'cash on delivery (cod)' ||
    gateway === 'cash_on_delivery' ||
    gateway === 'cash-on-delivery' ||
    gateway.includes('cash on delivery') ||
    gateway.includes('cash_on_delivery')
  ) {
    return true;
  }

  const codAmt = Number(order.codAmount || 0);
  const paidAmt = Number(order.paidAmount || order.advancePaymentAmount || order.advanceAmount || order.receivedAmount || 0);
  
  if (codAmt > 0 && paidAmt === 0 && !method.includes('online') && !method.includes('wallet') && !gateway.includes('online')) {
    return true;
  }

  return false;
}

export interface OrderPaymentBreakdown {
  itemsPrice: number;
  deliveryCharge: number;
  grandTotal: number;
  advanceAmount: number;
  codAmount: number;
  isFullPayment: boolean;
  isOnlyDeliveryChargeAdvance: boolean;
  isCod: boolean;
  advanceLabel: string;
}

/**
 * Strictly calculates order payment and COD amounts based on real payment records.
 * Rules:
 * 1. For Cash on Delivery (COD):
 *    - If no verified online payment: Paid = ৳0, COD = grandTotal.
 *    - Order Accepted/Confirmed status does NOT mean payment is paid.
 *    - Reseller profit or wallet lock amount is NEVER treated as customer payment.
 * 2. For Partial Online Payment + COD:
 *    - COD = grandTotal - actualPaidAmount.
 * 3. For Full Online Payment:
 *    - Paid = grandTotal, COD = ৳0.
 */
export function calculateOrderPaymentBreakdown(order: any): OrderPaymentBreakdown {
  if (!order) {
    return {
      itemsPrice: 0,
      deliveryCharge: 0,
      grandTotal: 0,
      advanceAmount: 0,
      codAmount: 0,
      isFullPayment: false,
      isOnlyDeliveryChargeAdvance: false,
      isCod: false,
      advanceLabel: '০ টাকা'
    };
  }

  const itemsPrice = Number(
    order.itemsPrice ?? 
    order.subtotal ?? 
    (Array.isArray(order.items)
      ? order.items.reduce((sum: number, it: any) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0)
      : 0)
  );

  const deliveryCharge = Number(
    order.deliveryCharge ?? 
    order.shippingCharge ?? 
    (order.packageBreakdown?.shippingFee || 0)
  );

  const grandTotal = Math.max(0, Number(
    order.grandTotal ?? 
    order.total ?? 
    (itemsPrice + deliveryCharge)
  ));

  const pMethod = String(order.paymentMethod || '').toLowerCase().trim();
  const pGateway = String(order.paymentGateway || '').toLowerCase().trim();
  const pStatus = String(order.paymentStatus || '').toLowerCase().trim();
  const advType = String(order.advancePaymentType || '').toLowerCase().trim();

  const isCod = isCodOrder(order);

  const isDeliveryOnlyMethod = 
    pMethod === 'only_delivery_charge' || 
    pMethod.includes('only delivery charge') || 
    pMethod.includes('delivery charge advance') || 
    advType === 'delivery_charge';

  const isFullOnlineMethod = 
    pMethod === 'product_full_payment' || 
    pMethod === 'wallet' || 
    pMethod === 'full' || 
    pMethod === 'online' || 
    pMethod === 'bkash' || 
    pMethod === 'nagad' || 
    pMethod === 'rocket' || 
    pMethod === 'upay' || 
    pMethod === 'sofolx' || 
    pMethod === 'emonpay' || 
    pMethod.includes('full payment') ||
    advType === 'full' || 
    order.isFullPayment === true;

  // Real verified online transaction ID (exclude profit lock transaction IDs like TXN_LOCK_...)
  const rawTxnId = String(order.transactionId || '').trim();
  const hasRealTxn = Boolean(rawTxnId && rawTxnId !== 'N/A' && rawTxnId !== 'cod' && !rawTxnId.startsWith('TXN_LOCK_'));

  // Online advance amounts explicitly recorded from payment gateway/transaction
  // Strict rule: NEVER treat resellerProfit, lockedProfitAmount, vendorPayoutAmount, or customerPaidAmount (items price) as payment!
  const rawAdvance = Math.max(0, Number(
    order.advancePaymentAmount ?? 
    order.paidAmount ?? 
    order.advanceAmount ?? 
    order.receivedAmount ?? 
    0
  ));

  let advanceAmount = 0;
  let codAmount = 0;
  let isFullPayment = false;
  let isOnlyDeliveryChargeAdvance = false;
  let advanceLabel = '০ টাকা';

  // 1. CASH ON DELIVERY (COD)
  if (isCod) {
    if (isDeliveryOnlyMethod) {
      isOnlyDeliveryChargeAdvance = true;
      advanceAmount = rawAdvance > 0 ? Math.min(grandTotal, rawAdvance) : deliveryCharge;
      codAmount = Math.max(0, grandTotal - advanceAmount);
      advanceLabel = `৳${advanceAmount.toLocaleString('bn-BD')} (ডেলিভারি চার্জ)`;
    } else if (hasRealTxn && rawAdvance > 0 && rawAdvance < grandTotal) {
      // Real partial online payment confirmed with transaction ID
      advanceAmount = Math.min(grandTotal, rawAdvance);
      codAmount = Math.max(0, grandTotal - advanceAmount);
      advanceLabel = `৳${advanceAmount.toLocaleString('bn-BD')}`;
    } else if (hasRealTxn && rawAdvance >= grandTotal && (pStatus === 'paid' || pStatus === 'completed')) {
      // Real full payment with online transaction
      isFullPayment = true;
      advanceAmount = grandTotal;
      codAmount = 0;
      advanceLabel = `৳${advanceAmount.toLocaleString('bn-BD')} (সম্পূর্ণ পরিশোধিত)`;
    } else {
      // Pure COD (Default for Cash on Delivery)
      // Even if order is Accepted/Confirmed by vendor or marked Delivered,
      // the customer payable at delivery is 100% COD and online advance paid is 0!
      advanceAmount = 0;
      codAmount = grandTotal;
      isFullPayment = false;
      advanceLabel = '০ টাকা';
    }
  }
  // 2. FULL ONLINE PAYMENT
  else if (isFullOnlineMethod) {
    if (pStatus !== 'failed' && pStatus !== 'cancelled') {
      isFullPayment = true;
      advanceAmount = grandTotal;
      codAmount = 0;
      advanceLabel = `৳${advanceAmount.toLocaleString('bn-BD')} (সম্পূর্ণ পরিশোধিত)`;
    } else {
      advanceAmount = 0;
      codAmount = grandTotal;
      advanceLabel = '০ টাকা';
    }
  }
  // 3. DELIVERY CHARGE ONLY ADVANCE
  else if (isDeliveryOnlyMethod) {
    isOnlyDeliveryChargeAdvance = true;
    advanceAmount = rawAdvance > 0 ? Math.min(grandTotal, rawAdvance) : deliveryCharge;
    codAmount = Math.max(0, grandTotal - advanceAmount);
    advanceLabel = `৳${advanceAmount.toLocaleString('bn-BD')} (ডেলিভারি চার্জ)`;
  }
  // 4. OTHER / MANUAL PAYMENT
  else {
    if (hasRealTxn && rawAdvance >= grandTotal && grandTotal > 0) {
      isFullPayment = true;
      advanceAmount = grandTotal;
      codAmount = 0;
      advanceLabel = `৳${advanceAmount.toLocaleString('bn-BD')} (সম্পূর্ণ পরিশোধিত)`;
    } else if (hasRealTxn && rawAdvance > 0) {
      advanceAmount = Math.min(grandTotal, rawAdvance);
      codAmount = Math.max(0, grandTotal - advanceAmount);
      advanceLabel = `৳${advanceAmount.toLocaleString('bn-BD')}`;
    } else if (order.codAmount !== undefined && !isNaN(Number(order.codAmount)) && Number(order.codAmount) > 0) {
      codAmount = Math.min(grandTotal, Number(order.codAmount));
      advanceAmount = Math.max(0, grandTotal - codAmount);
      advanceLabel = advanceAmount > 0 ? `৳${advanceAmount.toLocaleString('bn-BD')}` : '০ টাকা';
    } else {
      advanceAmount = 0;
      codAmount = grandTotal;
      advanceLabel = '০ টাকা';
    }
  }

  return {
    itemsPrice,
    deliveryCharge,
    grandTotal,
    advanceAmount,
    codAmount,
    isFullPayment,
    isOnlyDeliveryChargeAdvance,
    isCod,
    advanceLabel
  };
}

/**
 * Ensures vendor wallet document exists in RTDB
 */
export async function getOrCreateVendorWallet(vendorId: string) {
  const current = await rtdbGet<any>(`vendor_wallet/${vendorId}`);
  if (current) {
    return current;
  }
  const initialWallet = {
    vendorId,
    balance: 0,
    pendingBalance: 0,
    lifetimeEarnings: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await rtdbSet(`vendor_wallet/${vendorId}`, initialWallet);
  return initialWallet;
}

/**
 * Calculates net vendor payout for order items belonging to a vendor
 */
export function calculateVendorPayoutAmount(items: any[], vendorId?: string): number {
  if (!items || !Array.isArray(items)) return 0;
  const filtered = vendorId ? items.filter((it: any) => it.vendorId === vendorId) : items;
  return filtered.reduce((sum: number, it: any) => sum + ((it.price || 0) * (it.quantity || 1)), 0);
}

/**
 * Check and execute automatic release after 4 days for successful online payments with duplicate protection
 */
export async function checkAndAutoReleaseVendorPayout(orderData: any): Promise<{ released: boolean; message?: string }> {
  if (!orderData) return { released: false, message: 'Invalid order data' };

  // 1. COD RULE: Cash on Delivery orders never credit wallet and never show payment held
  if (isCodOrder(orderData)) {
    return { released: false, message: 'COD orders do not generate wallet payouts' };
  }

  // 2. CHECK IF ALREADY RELEASED (Prevent Duplicate Credit)
  const currentPayoutStatus = orderData.vendorPayoutStatus;
  if (currentPayoutStatus === 'Released' || orderData.vendorPayoutReleasedAt) {
    return { released: false, message: 'Payout already released' };
  }

  // Payout must be in 'Held' or 'Release Pending' to be eligible
  if (currentPayoutStatus !== 'Held' && currentPayoutStatus !== 'Release Pending') {
    return { released: false, message: `Payout status is ${currentPayoutStatus || 'None'}` };
  }

  // If there is an active dispute, do not release
  if (orderData.dispute && (orderData.dispute.status === 'Open' || orderData.dispute.status === 'Under Review')) {
    return { released: false, message: 'Payout is held under dispute review' };
  }

  // 3. 4 DAYS (96 HOURS) FROM SUCCESSFUL PAYMENT
  const now = Date.now();
  const paymentTime = Number(orderData.paidAt || orderData.paymentVerifiedAt || orderData.createdAt || now);
  const autoReleaseAt = Number(orderData.autoReleaseAt || (paymentTime + AUTO_RELEASE_MS));

  if (now < autoReleaseAt) {
    const hoursRemaining = Math.max(0, Math.ceil((autoReleaseAt - now) / (1000 * 60 * 60)));
    return { released: false, message: `${hoursRemaining} hours remaining in 4-day hold period` };
  }

  const vendorId = orderData.vendorId || (orderData.items?.[0]?.vendorId);
  if (!vendorId) {
    return { released: false, message: 'No vendor ID found on order' };
  }

  // Customer's actual verified online payment amount for this payout
  const payoutAmount = Number(
    orderData.vendorPayoutAmount || 
    orderData.paidAmount || 
    orderData.advancePaymentAmount || 
    calculateVendorPayoutAmount(orderData.items, vendorId) || 
    orderData.total || 
    0
  );

  if (payoutAmount <= 0) {
    return { released: false, message: 'No payout amount found' };
  }

  const mainOrderId = String(orderData.mainOrderId || orderData.orderId || orderData.id);

  try {
    // 4. DUPLICATE CREDIT CHECK IN DATABASE
    const existingTx = await rtdbList<any>('wallet_transactions', (tx) => 
      tx.vendorId === vendorId && tx.orderId === mainOrderId && tx.type === 'Income' && tx.status === 'Completed'
    );
    if (existingTx && existingTx.length > 0) {
      // Already credited in wallet! Mark order as released and do not credit again
      const updatePayload = {
        vendorPayoutStatus: 'Released',
        vendorPayoutReleasedAt: Date.now(),
        updatedAt: Date.now()
      };
      await rtdbUpdate(`orders/${mainOrderId}`, updatePayload).catch(() => {});
      if (orderData.id) {
        await rtdbUpdate(`vendor_orders/${orderData.id}`, updatePayload).catch(() => {});
      }
      return { released: false, message: 'Wallet transaction already completed for this order' };
    }

    // 1. Update vendor wallet in RTDB (Release from Held/Pending to Available Balance)
    const currentWallet = await getOrCreateVendorWallet(vendorId);

    await rtdbUpdate(`vendor_wallet/${vendorId}`, {
      balance: (currentWallet.balance || 0) + payoutAmount,
      pendingBalance: Math.max(0, (currentWallet.pendingBalance || 0) - payoutAmount),
      lifetimeEarnings: (currentWallet.lifetimeEarnings || 0) + payoutAmount,
      updatedAt: Date.now()
    });

    // 2. Add wallet transaction record
    await rtdbPush('wallet_transactions', {
      vendorId,
      orderId: mainOrderId,
      type: 'Income',
      amount: payoutAmount,
      status: 'Completed',
      description: `Auto-Released 4-day Payout for Online Payment Order #${orderData.orderId || mainOrderId}`,
      createdAt: Date.now()
    });

    // 3. Update orders collection
    const payoutUpdate = {
      vendorPayoutStatus: 'Released',
      vendorPayoutReleasedAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      await rtdbUpdate(`orders/${mainOrderId}`, payoutUpdate);
    } catch (e) {
      console.warn('Could not update main orders in RTDB', e);
    }

    if (orderData.id) {
      try {
        await rtdbUpdate(`vendor_orders/${orderData.id}`, payoutUpdate);
      } catch (e) {
        console.warn('Could not update vendor_orders in RTDB', e);
      }
    }

    // 4. Log status
    await rtdbPush('order_status_logs', {
      orderId: mainOrderId,
      vendorId,
      oldStatus: currentPayoutStatus,
      newStatus: 'Released',
      note: `Online payment held amount of ৳${payoutAmount} released to vendor wallet after 4-day window.`,
      timestamp: Date.now()
    });

    return { released: true, message: `৳${payoutAmount} released to Vendor Wallet` };
  } catch (error: any) {
    console.error('Error auto-releasing vendor payout:', error);
    return { released: false, message: error?.message || 'Failed to auto-release payout' };
  }
}

/**
 * Manually release payout by Admin
 */
export async function releaseVendorPayout(orderData: any, adminUser?: any): Promise<{ success: boolean; message: string }> {
  if (!orderData) return { success: false, message: 'Invalid order' };

  if (isCodOrder(orderData)) {
    return { success: false, message: 'COD orders do not credit vendor wallet' };
  }

  if (orderData.vendorPayoutStatus === 'Released' || orderData.vendorPayoutReleasedAt) {
    return { success: false, message: 'Payout already released' };
  }

  const vendorId = orderData.vendorId || (orderData.items?.[0]?.vendorId);
  if (!vendorId) return { success: false, message: 'No vendor found' };

  const payoutAmount = Number(
    orderData.vendorPayoutAmount || 
    orderData.paidAmount || 
    orderData.advancePaymentAmount || 
    calculateVendorPayoutAmount(orderData.items, vendorId) || 
    orderData.total || 
    0
  );
  const mainOrderId = String(orderData.mainOrderId || orderData.orderId || orderData.id);

  try {
    // Prevent duplicate wallet credit
    const existingTx = await rtdbList<any>('wallet_transactions', (tx) => 
      tx.vendorId === vendorId && tx.orderId === mainOrderId && tx.type === 'Income' && tx.status === 'Completed'
    );
    if (existingTx && existingTx.length > 0) {
      const updatePayload = {
        vendorPayoutStatus: 'Released',
        vendorPayoutReleasedAt: Date.now(),
        updatedAt: Date.now()
      };
      await rtdbUpdate(`orders/${mainOrderId}`, updatePayload).catch(() => {});
      if (orderData.id) {
        await rtdbUpdate(`vendor_orders/${orderData.id}`, updatePayload).catch(() => {});
      }
      return { success: false, message: 'Wallet credit already completed for this order' };
    }

    // Update vendor wallet
    const currentWallet = await getOrCreateVendorWallet(vendorId);

    await rtdbUpdate(`vendor_wallet/${vendorId}`, {
      balance: (currentWallet.balance || 0) + payoutAmount,
      pendingBalance: Math.max(0, (currentWallet.pendingBalance || 0) - payoutAmount),
      lifetimeEarnings: (currentWallet.lifetimeEarnings || 0) + payoutAmount,
      updatedAt: Date.now()
    });

    // Wallet transaction record
    await rtdbPush('wallet_transactions', {
      vendorId,
      orderId: mainOrderId,
      type: 'Income',
      amount: payoutAmount,
      status: 'Completed',
      description: `Payout released for Online Order #${orderData.orderId || mainOrderId}${adminUser ? ` (by ${adminUser.name || 'Admin'})` : ''}`,
      createdAt: Date.now()
    });

    const updatePayload: any = {
      vendorPayoutStatus: 'Released',
      vendorPayoutReleasedAt: Date.now(),
      updatedAt: Date.now()
    };

    if (orderData.dispute) {
      updatePayload.dispute = {
        ...orderData.dispute,
        status: 'Resolved - Released',
        resolvedAt: Date.now(),
        resolvedBy: adminUser?.name || 'Admin',
        resolutionNote: 'Admin approved release to vendor'
      };
    }

    try {
      await rtdbUpdate(`orders/${mainOrderId}`, updatePayload);
    } catch (e) {
      console.warn('Could not update main order payout in RTDB', e);
    }

    if (orderData.id) {
      try {
        await rtdbUpdate(`vendor_orders/${orderData.id}`, updatePayload);
      } catch (e) {
        console.warn('Could not update vendor_orders payout in RTDB', e);
      }
    }

    return { success: true, message: `৳${payoutAmount} released to Vendor Wallet successfully!` };
  } catch (error: any) {
    console.error('Error in releaseVendorPayout:', error);
    return { success: false, message: error?.message || 'Failed to release payout' };
  }
}

/**
 * Customer raises a dispute/complaint during protection window or on problematic orders
 */
export async function raiseCustomerDispute(
  orderId: string, 
  userId: string, 
  userName: string,
  reason: string, 
  details: string,
  images: string[] = []
): Promise<{ success: boolean; message: string }> {
  try {
    let targetKey = String(orderId || '').trim();
    let orderData = await rtdbGet<any>(`orders/${targetKey}`);
    
    if (!orderData) {
      // Find matching order in RTDB by orderId or id
      const allOrders = await rtdbList<any>('orders');
      const found = allOrders.find(
        o => o.id === targetKey || o.data?.orderId === targetKey || o.data?.id === targetKey
      );
      if (found) {
        targetKey = found.id;
        orderData = found.data;
      }
    }

    const disputeData: VendorPayoutDispute = {
      status: 'Under Review',
      reason,
      details,
      images,
      createdAt: Date.now(),
      raisedBy: userName || userId,
      raisedById: userId
    };

    const updatePayload = {
      status: 'Dispute',
      vendorPayoutStatus: 'Disputed',
      dispute: disputeData,
      updatedAt: Date.now()
    };

    await rtdbUpdate(`orders/${targetKey}`, updatePayload);

    // Also update vendor_orders if present
    try {
      const vOrder = await rtdbGet(`vendor_orders/${targetKey}`);
      if (vOrder) {
        await rtdbUpdate(`vendor_orders/${targetKey}`, updatePayload);
      }
    } catch (e) {
      console.warn('Could not update vendor_order dispute in RTDB', e);
    }

    // Write dedicated dispute record in Realtime Database
    try {
      const disputeRecord = {
        id: targetKey,
        orderId: orderData?.orderId || targetKey,
        dispute: disputeData,
        status: 'Dispute',
        vendorPayoutStatus: 'Disputed',
        customerName: userName || orderData?.shippingAddress?.name || 'Customer',
        customerId: userId,
        customerPhone: orderData?.shippingAddress?.mobile || orderData?.shippingAddress?.phone || orderData?.customerPhone || '',
        shippingAddress: orderData?.shippingAddress || null,
        vendorId: orderData?.vendorId || orderData?.items?.[0]?.vendorId || '',
        vendorName: orderData?.vendorName || orderData?.items?.[0]?.vendorName || '',
        items: orderData?.items || [],
        total: orderData?.total || 0,
        vendorPayoutAmount: orderData?.vendorPayoutAmount || 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await rtdbSet(`disputes/${targetKey}`, disputeRecord);
    } catch (dispErr) {
      console.warn('Could not save dispute to disputes/ node in RTDB', dispErr);
    }

    // Push notification for Admin in RTDB
    try {
      await rtdbPush('admin_notifications', {
        type: 'customer_dispute',
        title: 'Customer Dispute / Report Raised',
        message: `Customer ${userName || 'Customer'} reported an issue on Order #${orderData?.orderId || targetKey}: ${reason}`,
        orderId: orderData?.orderId || targetKey,
        targetKey,
        createdAt: Date.now(),
        read: false
      });
    } catch (notifErr) {
      console.warn('Could not push admin_notification in RTDB', notifErr);
    }

    // Add note and status log
    await rtdbPush('orderNotes', {
      orderId: targetKey,
      note: `⚠️ Customer Dispute Raised: "${reason}" - ${details}${images?.length ? ` [${images.length} proof image(s) attached]` : ''}`,
      addedBy: userName || 'Customer',
      addedById: userId,
      createdAt: Date.now()
    });

    await rtdbPush('order_status_logs', {
      orderId: targetKey,
      oldStatus: 'Delivered',
      newStatus: 'Dispute',
      note: `Customer filed a dispute: ${reason}. Order status changed to Dispute and Vendor payout put on HOLD under Admin review.`,
      timestamp: Date.now()
    });

    return { success: true, message: 'Dispute submitted. Order status is now Dispute and Vendor payout is placed on HOLD under Admin Review.' };
  } catch (error: any) {
    console.error('Error raising dispute in RTDB:', error);
    return { success: false, message: error?.message || 'Failed to submit dispute' };
  }
}

/**
 * Vendor replies to a customer dispute
 */
export async function vendorReplyDispute(
  orderId: string,
  vendorId: string,
  vendorName: string,
  replyText: string
): Promise<{ success: boolean; message: string }> {
  try {
    const currentOrder = await rtdbGet<any>(`orders/${orderId}`) || await rtdbGet<any>(`vendor_orders/${orderId}`);
    if (!currentOrder) {
      return { success: false, message: 'Order not found' };
    }

    const currentDispute = currentOrder.dispute || {};

    const vendorResponse = {
      text: replyText.trim(),
      respondedAt: Date.now(),
      respondedBy: vendorName || 'Vendor',
      vendorId
    };

    const updatePayload: any = {
      dispute: {
        ...currentDispute,
        vendorResponse
      },
      updatedAt: Date.now()
    };

    try {
      await rtdbUpdate(`orders/${orderId}`, updatePayload);
    } catch (_) {}

    try {
      await rtdbUpdate(`vendor_orders/${orderId}`, updatePayload);
    } catch (_) {}

    try {
      await rtdbUpdate(`disputes/${orderId}`, {
        'dispute/vendorResponse': vendorResponse,
        updatedAt: Date.now()
      });
    } catch (_) {}

    await rtdbPush('orderNotes', {
      orderId,
      note: `🏪 Vendor Response to Dispute: "${replyText.trim()}"`,
      addedBy: vendorName || 'Vendor',
      addedById: vendorId,
      createdAt: Date.now()
    });

    return { success: true, message: 'Vendor response submitted successfully' };
  } catch (error: any) {
    console.error('Error submitting vendor reply in RTDB:', error);
    return { success: false, message: error?.message || 'Failed to submit vendor response' };
  }
}

/**
 * Admin resolves dispute by refunding customer
 */
export async function refundCustomerDispute(orderData: any, adminUser: any, note: string): Promise<{ success: boolean; message: string }> {
  if (!orderData) return { success: false, message: 'Invalid order' };
  const mainOrderId = orderData.mainOrderId || orderData.orderId || orderData.id;
  const vendorId = orderData.vendorId || (orderData.items?.[0]?.vendorId);
  const payoutAmount = orderData.vendorPayoutAmount || calculateVendorPayoutAmount(orderData.items, vendorId) || orderData.total || 0;

  try {
    // If vendor wallet had pending balance, remove it
    if (vendorId) {
      const currentWallet = await rtdbGet<any>(`vendor_wallet/${vendorId}`);
      if (currentWallet) {
        await rtdbUpdate(`vendor_wallet/${vendorId}`, {
          pendingBalance: Math.max(0, (currentWallet.pendingBalance || 0) - payoutAmount),
          updatedAt: Date.now()
        });
      }
    }

    const updatePayload: any = {
      vendorPayoutStatus: 'Refunded',
      status: 'Refunded',
      paymentStatus: 'Refunded',
      dispute: {
        ...(orderData.dispute || {}),
        status: 'Resolved - Refunded',
        resolvedAt: Date.now(),
        resolvedBy: adminUser?.name || 'Admin',
        resolutionNote: note || 'Refund approved by Admin'
      },
      updatedAt: Date.now()
    };

    const keysToUpdate = new Set<string>();
    if (orderData.id) keysToUpdate.add(orderData.id);
    if (orderData.orderId) keysToUpdate.add(orderData.orderId);
    if (orderData.mainOrderId) keysToUpdate.add(orderData.mainOrderId);

    for (const key of keysToUpdate) {
      try {
        await rtdbUpdate(`orders/${key}`, updatePayload);
      } catch (_) {}
      try {
        await rtdbUpdate(`disputes/${key}`, updatePayload);
      } catch (_) {}
      try {
        await rtdbUpdate(`vendor_orders/${key}`, updatePayload);
      } catch (_) {}
    }

    const customerId = orderData.customerId || orderData.userId;
    if (customerId && customerId !== 'guest') {
      try {
        await rtdbPush(`notifications/${customerId}`, {
          type: 'dispute_resolved',
          title: 'রিপোর্ট সমাধান: রিফান্ড অনুমোদিত',
          message: `আপনার #${orderData.orderId || mainOrderId} অর্ডারের রিপোর্ট পর্যালোচনা শেষে রিফান্ড অনুমোদন করা হয়েছে।`,
          orderId: orderData.orderId || mainOrderId,
          createdAt: Date.now(),
          read: false
        });
      } catch (_) {}
    }

    if (vendorId) {
      try {
        await rtdbPush(`notifications/${vendorId}`, {
          type: 'dispute_resolved',
          title: 'রিপোর্ট সমাধান: রিফান্ড',
          message: `অর্ডার #${orderData.orderId || mainOrderId}-এর কাস্টমার রিপোর্ট পর্যালোচনা শেষে রিফান্ড অনুমোদিত হয়েছে।`,
          orderId: orderData.orderId || mainOrderId,
          createdAt: Date.now(),
          read: false
        });
      } catch (_) {}
    }

    await rtdbPush('orderNotes', {
      orderId: mainOrderId,
      note: `Dispute Resolved by Admin: Order Refunded. Customer refund processed and Vendor payout cancelled. (${note || 'No note'})`,
      addedBy: adminUser?.name || 'Admin',
      addedById: adminUser?.uid,
      createdAt: Date.now()
    });

    await rtdbPush('order_status_logs', {
      orderId: mainOrderId,
      oldStatus: orderData.status || 'Dispute',
      newStatus: 'Refunded',
      note: `Admin approved refund for customer dispute. Vendor payout cancelled.`,
      timestamp: Date.now()
    });

    return { success: true, message: 'Refund Approved: Customer payment refund processed and Vendor payout cancelled.' };
  } catch (error: any) {
    console.error('Error refunding dispute in RTDB:', error);
    return { success: false, message: error?.message || 'Failed to refund dispute' };
  }
}

/**
 * Admin rejects dispute and releases payout to vendor
 */
export async function rejectCustomerDisputeAndRelease(orderData: any, adminUser: any, note: string): Promise<{ success: boolean; message: string }> {
  if (!orderData) return { success: false, message: 'Invalid order' };
  const mainOrderId = orderData.mainOrderId || orderData.orderId || orderData.id;
  const vendorId = orderData.vendorId || (orderData.items?.[0]?.vendorId);
  const payoutAmount = orderData.vendorPayoutAmount || calculateVendorPayoutAmount(orderData.items, vendorId) || orderData.total || 0;

  try {
    // 1. Release payout to vendor wallet
    if (vendorId) {
      const currentWallet = await getOrCreateVendorWallet(vendorId);

      await rtdbUpdate(`vendor_wallet/${vendorId}`, {
        balance: (currentWallet.balance || 0) + payoutAmount,
        pendingBalance: Math.max(0, (currentWallet.pendingBalance || 0) - payoutAmount),
        lifetimeEarnings: (currentWallet.lifetimeEarnings || 0) + payoutAmount,
        updatedAt: Date.now()
      });

      // Add transaction record
      await rtdbPush('wallet_transactions', {
        vendorId,
        orderId: mainOrderId,
        type: 'Income',
        amount: payoutAmount,
        status: 'Completed',
        description: `Dispute Rejected: Payout released for Order #${orderData.orderId || mainOrderId} (by ${adminUser?.name || 'Admin'})`,
        createdAt: Date.now()
      });
    }

    const updatePayload: any = {
      status: 'Delivered',
      vendorPayoutStatus: 'Released',
      vendorPayoutReleasedAt: Date.now(),
      dispute: {
        ...(orderData.dispute || {}),
        status: 'Rejected',
        resolvedAt: Date.now(),
        resolvedBy: adminUser?.name || 'Admin',
        resolutionNote: note || 'Dispute rejected by Admin. Payout released to Vendor.'
      },
      updatedAt: Date.now()
    };

    const keysToUpdate = new Set<string>();
    if (orderData.id) keysToUpdate.add(orderData.id);
    if (orderData.orderId) keysToUpdate.add(orderData.orderId);
    if (orderData.mainOrderId) keysToUpdate.add(orderData.mainOrderId);

    for (const key of keysToUpdate) {
      try {
        await rtdbUpdate(`orders/${key}`, updatePayload);
      } catch (_) {}
      try {
        await rtdbUpdate(`disputes/${key}`, updatePayload);
      } catch (_) {}
      try {
        await rtdbUpdate(`vendor_orders/${key}`, updatePayload);
      } catch (_) {}
    }

    const customerId = orderData.customerId || orderData.userId;
    if (customerId && customerId !== 'guest') {
      try {
        await rtdbPush(`notifications/${customerId}`, {
          type: 'dispute_rejected',
          title: 'রিপোর্ট সমাধান: পর্যালোচনা সম্পন্ন',
          message: `আপনার #${orderData.orderId || mainOrderId} অর্ডারের রিপোর্ট পর্যালোচনা শেষে সিদ্ধান্ত হয়েছে: ${note || 'পেমেন্ট রিলিজ করা হয়েছে'}।`,
          orderId: orderData.orderId || mainOrderId,
          createdAt: Date.now(),
          read: false
        });
      } catch (_) {}
    }

    if (vendorId) {
      try {
        await rtdbPush(`notifications/${vendorId}`, {
          type: 'dispute_resolved',
          title: 'পেমেন্ট রিলিজ সম্পন্ন',
          message: `অর্ডার #${orderData.orderId || mainOrderId}-এর কাস্টমার রিপোর্ট পর্যালোচনা শেষে ৳${payoutAmount} আপনার ওয়ালেটে জমা হয়েছে।`,
          orderId: orderData.orderId || mainOrderId,
          createdAt: Date.now(),
          read: false
        });
      } catch (_) {}
    }

    await rtdbPush('orderNotes', {
      orderId: mainOrderId,
      note: `Dispute Rejected by Admin: Payout of ৳${payoutAmount} released to Vendor Wallet. (${note || 'No note'})`,
      addedBy: adminUser?.name || 'Admin',
      addedById: adminUser?.uid,
      createdAt: Date.now()
    });

    await rtdbPush('order_status_logs', {
      orderId: mainOrderId,
      oldStatus: orderData.status || 'Dispute',
      newStatus: 'Delivered',
      note: `Dispute rejected by Admin. Payout of ৳${payoutAmount} released to Vendor.`,
      timestamp: Date.now()
    });

    return { success: true, message: `Dispute Rejected: ৳${payoutAmount} released to Vendor Wallet.` };
  } catch (error: any) {
    console.error('Error rejecting dispute in RTDB:', error);
    return { success: false, message: error?.message || 'Failed to reject dispute' };
  }
}

/**
 * Permanently deletes a customer report / dispute from an order and the system
 */
export async function deleteCustomerDispute(
  orderData: any,
  adminUser: any
): Promise<{ success: boolean; message: string }> {
  if (!orderData) return { success: false, message: 'অর্ডার পাওয়া যায়নি (Order not found)' };
  const mainOrderId = orderData.mainOrderId || orderData.orderId || orderData.id;

  try {
    const keysToUpdate = new Set<string>();
    if (orderData.id) keysToUpdate.add(orderData.id);
    if (orderData.orderId) keysToUpdate.add(orderData.orderId);
    if (orderData.mainOrderId) keysToUpdate.add(orderData.mainOrderId);

    // Determine safe revert status
    let revertStatus = orderData.status;
    if (
      !revertStatus ||
      revertStatus.toLowerCase() === 'dispute' ||
      revertStatus.toLowerCase() === 'disputed'
    ) {
      if (orderData.deliveredAt || orderData.status === 'Delivered') {
        revertStatus = 'Delivered';
      } else if (orderData.shippedAt || orderData.trackingNumber) {
        revertStatus = 'Shipped';
      } else {
        revertStatus = 'Processing';
      }
    }

    let revertPayout = orderData.vendorPayoutStatus;
    if (revertPayout === 'Disputed') {
      revertPayout = 'Held';
    }

    const updatePayload: any = {
      status: revertStatus,
      vendorPayoutStatus: revertPayout,
      payoutFrozen: false,
      payoutFrozenReason: null,
      updatedAt: Date.now()
    };

    // Remove dispute object from orders and vendor_orders
    for (const key of keysToUpdate) {
      try {
        await rtdbRemove(`orders/${key}/dispute`);
        await rtdbRemove(`orders/${key}/payoutFrozenReason`);
        await rtdbUpdate(`orders/${key}`, updatePayload);
      } catch (_) {}

      try {
        await rtdbRemove(`vendor_orders/${key}/dispute`);
        await rtdbRemove(`vendor_orders/${key}/payoutFrozenReason`);
        await rtdbUpdate(`vendor_orders/${key}`, updatePayload);
      } catch (_) {}

      try {
        await rtdbRemove(`disputes/${key}`);
      } catch (_) {}
    }

    // Also remove from dedicated disputes list if stored under different key
    try {
      const allDisputes = await rtdbList<any>('disputes');
      for (const disp of allDisputes) {
        const d = disp.data || {};
        if (
          keysToUpdate.has(disp.id) ||
          (d.orderId && keysToUpdate.has(d.orderId)) ||
          (d.id && keysToUpdate.has(d.id))
        ) {
          await rtdbRemove(`disputes/${disp.id}`);
        }
      }
    } catch (_) {}

    // Add note to order history
    await rtdbPush('orderNotes', {
      orderId: mainOrderId,
      note: `🗑️ Customer report / dispute deleted by Admin (${adminUser?.name || adminUser?.displayName || 'Admin'}). Order returned to ${revertStatus}.`,
      addedBy: adminUser?.name || adminUser?.displayName || 'Admin',
      addedById: adminUser?.uid,
      createdAt: Date.now()
    });

    return {
      success: true,
      message: 'কাস্টমার রিপোর্ট সফলভাবে ডিলিট করা হয়েছে (Customer report deleted successfully)'
    };
  } catch (error: any) {
    console.error('Error deleting customer dispute in RTDB:', error);
    return {
      success: false,
      message: error?.message || 'কাস্টমার রিপোর্ট ডিলিট করতে সমস্যা হয়েছে'
    };
  }
}

/**
 * Permanently deletes the entire order/record completely from all databases (RTDB, Firestore, disputes, local cache).
 * Used when an admin decides to purge/delete the entire problematic item/order from Requires Attention.
 */
export async function deleteEntireOrder(
  orderData: any,
  adminUser?: any
): Promise<{ success: boolean; message: string }> {
  if (!orderData) return { success: false, message: 'অর্ডার পাওয়া যায়নি (Order not found)' };

  const idCandidates = new Set<string>();
  if (orderData.id) idCandidates.add(String(orderData.id));
  if (orderData.orderId) idCandidates.add(String(orderData.orderId));
  if (orderData.mainOrderId) idCandidates.add(String(orderData.mainOrderId));

  try {
    // 1. Delete direct keys from RTDB: orders, vendor_orders, disputes
    for (const key of idCandidates) {
      try { await rtdbRemove(`orders/${key}`); } catch (_) {}
      try { await rtdbRemove(`vendor_orders/${key}`); } catch (_) {}
      try { await rtdbRemove(`disputes/${key}`); } catch (_) {}
    }

    // 2. Scan RTDB to ensure child nodes matching orderId or mainOrderId are deleted
    try {
      const allOrders = await rtdbList<any>('orders');
      for (const item of allOrders) {
        if (
          idCandidates.has(item.id) ||
          (item.data?.orderId && idCandidates.has(String(item.data.orderId))) ||
          (item.data?.id && idCandidates.has(String(item.data.id))) ||
          (item.data?.mainOrderId && idCandidates.has(String(item.data.mainOrderId)))
        ) {
          await rtdbRemove(`orders/${item.id}`);
        }
      }
    } catch (_) {}

    try {
      const allVendorOrders = await rtdbList<any>('vendor_orders');
      for (const item of allVendorOrders) {
        if (
          idCandidates.has(item.id) ||
          (item.data?.orderId && idCandidates.has(String(item.data.orderId))) ||
          (item.data?.id && idCandidates.has(String(item.data.id))) ||
          (item.data?.mainOrderId && idCandidates.has(String(item.data.mainOrderId)))
        ) {
          await rtdbRemove(`vendor_orders/${item.id}`);
        }
      }
    } catch (_) {}

    try {
      const allDisputes = await rtdbList<any>('disputes');
      for (const item of allDisputes) {
        if (
          idCandidates.has(item.id) ||
          (item.data?.orderId && idCandidates.has(String(item.data.orderId))) ||
          (item.data?.id && idCandidates.has(String(item.data.id)))
        ) {
          await rtdbRemove(`disputes/${item.id}`);
        }
      }
    } catch (_) {}

    // 3. Delete from Firestore orders collection
    for (const key of idCandidates) {
      try {
        await deleteDoc(doc(db, 'orders', key));
      } catch (_) {}
    }
    for (const key of idCandidates) {
      try {
        const q = query(collection(db, 'orders'), where('orderId', '==', key));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      } catch (_) {}
    }

    // 4. Clean local storage
    for (const key of idCandidates) {
      try { safeStorage.removeItem(`pending_order_${key}`); } catch (_) {}
    }
    try {
      const recentRaw = safeStorage.getItem('user_recent_orders');
      if (recentRaw) {
        const list: any[] = JSON.parse(recentRaw);
        const filtered = list.filter((o: any) => !idCandidates.has(String(o.orderId || o.id)));
        safeStorage.setItem('user_recent_orders', JSON.stringify(filtered));
      }
    } catch (_) {}

    return {
      success: true,
      message: 'সম্পূর্ণ অর্ডার এবং ডাটাবেজ রেকর্ড চিরতরে ডিলিট করা হয়েছে (Entire order and records permanently deleted)'
    };
  } catch (error: any) {
    console.error('Error deleting entire order:', error);
    return {
      success: false,
      message: error?.message || 'অর্ডার ডিলিট করতে সমস্যা হয়েছে'
    };
  }
}

/**
 * Standard courier tracking URL resolver for Bangladesh couriers
 */
export function getCourierTrackingUrl(courierName?: string, trackingNumber?: string, customUrl?: string): string {
  if (customUrl && customUrl.trim()) {
    const trimmed = customUrl.trim();
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  }
  if (!trackingNumber) return '';
  
  const cName = (courierName || '').toLowerCase().trim();
  const trk = encodeURIComponent(trackingNumber.trim());
  
  if (cName.includes('steadfast')) {
    return `https://steadfast.com.bd/t/${trk}`;
  }
  if (cName.includes('pathao')) {
    return `https://merchant.pathao.com/tracking?consignment_id=${trk}`;
  }
  if (cName.includes('redx')) {
    return `https://redx.com.bd/track-order/${trk}`;
  }
  if (cName.includes('paperfly')) {
    return `https://paperfly.com.bd/tracking?id=${trk}`;
  }
  if (cName.includes('ecourier') || cName.includes('e-courier')) {
    return `https://ecourier.com.bd/track?ref=${trk}`;
  }
  if (cName.includes('sundarban')) {
    return `https://sundarbancourierltd.com/track`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${courierName || 'Courier'} tracking ${trackingNumber}`)}`;
}

/**
 * Background auto-release scanner: iterates through all orders currently in 'Held' or 'Release Pending'
 * and automatically releases funds to vendor wallet if 4-day window passed, excluding COD, and no dispute exists.
 */
export async function autoReleaseAllEligiblePayouts(): Promise<number> {
  let releasedCount = 0;
  try {
    const pendingOrders = await rtdbList<any>('orders', o => 
      (o.vendorPayoutStatus === 'Held' || o.vendorPayoutStatus === 'Release Pending') &&
      !isCodOrder(o)
    );
    const now = Date.now();

    for (const docSnap of pendingOrders) {
      const oData = { id: docSnap.id, ...docSnap.data } as any;
      if (isCodOrder(oData)) continue;

      const paymentTime = Number(oData.paidAt || oData.paymentVerifiedAt || oData.createdAt || now);
      const autoReleaseAt = Number(oData.autoReleaseAt || (paymentTime + AUTO_RELEASE_MS));
      
      const hasActiveDispute = oData.dispute && (oData.dispute.status === 'Open' || oData.dispute.status === 'Under Review');
      if (!hasActiveDispute && now >= autoReleaseAt) {
        const res = await checkAndAutoReleaseVendorPayout(oData);
        if (res.released) {
          releasedCount++;
        }
      }
    }
  } catch (error) {
    console.warn('Error during auto-release sweep in RTDB:', error);
  }
  return releasedCount;
}
