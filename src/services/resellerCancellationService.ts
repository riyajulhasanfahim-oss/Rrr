/**
 * Reseller Order Cancellation, Refund & Profit Balance Correction Service
 * STEP 9/10
 * 
 * Strict Guidelines:
 * 1. Uses Firebase Realtime Database (RTDB) exclusively. Zero Firestore.
 * 2. Dedicated to Reseller Orders Cancel, Refund & Profit Balance Correction.
 * 3. Case 1: Cancel BEFORE Vendor Confirm
 *    - Vendor wallet: 0 balance change, lockedBalance untouched.
 *    - Reseller wallet: No profit release, pendingProfit adjusted to cancelledProfit.
 *    - Order: orderStatus = "Cancelled", profitStatus = "CANCELLED".
 * 4. Case 2: Cancel AFTER Vendor Confirm BUT BEFORE DELIVERY
 *    - Atomic transaction/multi-update:
 *      - Vendor: lockedBalance decreases, availableBalance increases by same amount (Locked -> Available).
 *        Vendor totalBalance remains UNCHANGED (totalBalance = availableBalance + lockedBalance).
 *      - Reseller: pendingProfit decreases, cancelledProfit increases. Available balance untouched.
 *      - Order: profitStatus = "CANCELLED", orderStatus = "Cancelled".
 *    - Duplicate protection: Cannot correct balance twice for the same cancellation.
 * 5. Case 3: Order Return / Refund AFTER DELIVERY (Profit Reversal)
 *    - Profit already RELEASED in Reseller wallet -> Do NOT directly overwrite balance!
 *    - Step A: Create "PROFIT_REVERSAL_REQUEST" (status = "PENDING_ADMIN_REVIEW").
 *    - Step B: Admin verification and Approval:
 *      - If Reseller availableBalance >= reversalAmount:
 *        - Reseller: availableBalance decreases, releasedProfit decreases, totalBalance decreases.
 *        - Vendor: availableBalance increases, totalBalance increases.
 *        - Status becomes "REVERSED".
 *      - If Reseller availableBalance < reversalAmount:
 *        - Strictly DO NOT create a negative balance!
 *        - Status becomes "REVERSAL_PENDING" (Unresolved balance correction for Admin attention).
 * 6. Protection & Safety:
 *    - Double processing prevention on all operations.
 *    - Unique transaction IDs (TXN_CAN_*, TXN_REV_*).
 *    - Atomic RTDB updates across all wallet and order paths.
 */

import { 
  rtdbGet, 
  rtdbSet, 
  rtdbUpdate, 
  rtdbPush, 
  rtdbMultiUpdate, 
  rtdbList, 
  rtdbSubscribe 
} from '../lib/rtdb';
import {
  verifyAndRecalculateResellerProfit,
  validateOrderStateTransition,
  checkFinancialIdempotency,
  recordFinancialIdempotency,
  ensureVendorBalanceConsistency,
  ensureResellerBalanceConsistency
} from './resellerSecurityService';

export type ResellerProfitReversalStatus = 
  | 'PENDING_ADMIN_REVIEW' 
  | 'REVERSED' 
  | 'REVERSAL_PENDING' 
  | 'REJECTED';

export interface ResellerProfitReversalRecord {
  reversalRequestId: string;
  orderId: string;
  resellerId: string;
  vendorId: string;
  reversalAmount: number;
  reason: string;
  requestedBy: string;
  status: ResellerProfitReversalStatus;
  createdAt: number;
  updatedAt: number;
  // Metadata & snapshot details
  productName?: string;
  productImage?: string;
  quantity?: number;
  vendorPrice?: number;
  resellerSellingPrice?: number;
  vendorShopName?: string;
  resellerName?: string;
  resellerPhone?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryStatus?: string;
  courierName?: string;
  trackingNumber?: string;
  // Admin action & resolution fields
  adminNote?: string;
  processedBy?: string;
  processedAt?: number;
  transactionId?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: number;
  // Unresolved shortfall handling
  isUnresolved?: boolean;
  unresolvedReason?: string;
  currentResellerAvailable?: number;
  shortfall?: number;
  lastAttemptedAt?: number;
  lastAttemptedBy?: string;
}

export interface CancelResellerOrderParams {
  orderId: string;
  reason?: string;
  cancelledBy?: string;
  adminNote?: string;
}

export interface CancelResellerOrderResult {
  success: boolean;
  message: string;
  caseType?: 'CANCEL_BEFORE_CONFIRM' | 'CANCEL_AFTER_CONFIRM' | 'ALREADY_CANCELLED';
  isResellerOrder: boolean;
  profitStatus: string;
  resellerProfit: number;
  transactionId?: string;
  requiresReversal?: boolean;
  error?: string;
}

export interface CreateProfitReversalParams {
  orderId: string;
  reason: string;
  requestedBy?: string;
  vendorId?: string;
  resellerId?: string;
  adminNote?: string;
}

export interface CreateProfitReversalResult {
  success: boolean;
  message: string;
  reversalRequestId?: string;
  reversalRequest?: ResellerProfitReversalRecord;
  error?: string;
}

export interface AdminApproveReversalParams {
  orderId: string;
  reversalRequestId?: string;
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
  adminNote?: string;
}

export interface AdminApproveReversalResult {
  success: boolean;
  status: 'REVERSED' | 'REVERSAL_PENDING';
  message: string;
  transactionId?: string;
  shortfall?: number;
  currentResellerAvailable?: number;
  error?: string;
}

export interface AdminRejectReversalParams {
  orderId: string;
  reversalRequestId?: string;
  rejectionReason: string;
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
}

/**
 * Normalizes Order ID helper
 */
export function cleanOrderId(orderId: string): string {
  return String(orderId || '').replace(/^#/, '').trim();
}

/**
 * Checks if an order is already cancelled in RTDB
 */
export async function isOrderAlreadyCancelled(orderId: string): Promise<boolean> {
  const cleanId = cleanOrderId(orderId);
  const cancelRecord = await rtdbGet<any>(`reseller_cancellation_records/${cleanId}`);
  if (cancelRecord) return true;

  const order = await rtdbGet<any>(`reseller_orders/${cleanId}`);
  if (order && order.profitStatus === 'CANCELLED') return true;

  return false;
}

/**
 * Fetches Profit Reversal Record by orderId from RTDB
 */
export async function getProfitReversalRequestByOrder(
  orderId: string
): Promise<ResellerProfitReversalRecord | null> {
  if (!orderId) return null;
  const cleanId = cleanOrderId(orderId);

  try {
    const record = await rtdbGet<ResellerProfitReversalRecord>(`reseller_profit_reversals_by_order/${cleanId}`);
    if (record) return record;

    const all = await rtdbGet<Record<string, ResellerProfitReversalRecord>>('reseller_profit_reversals');
    if (all && typeof all === 'object') {
      const match = Object.values(all).find(r => r && cleanOrderId(r.orderId) === cleanId);
      if (match) return match;
    }
    return null;
  } catch (err) {
    console.warn('[ResellerCancellationService] getProfitReversalRequestByOrder error:', err);
    return null;
  }
}

/**
 * CORE METHOD: CANCEL RESELLER ORDER & AUTOMATIC BALANCE CORRECTION
 * 
 * Handles:
 * 1. Cancel BEFORE Vendor Confirm:
 *    - Vendor wallet: Zero change, lockedBalance untouched.
 *    - Reseller wallet: Zero profit released. Adjusts pendingProfit -> cancelledProfit.
 *    - Order: profitStatus = "CANCELLED", orderStatus = "Cancelled".
 * 
 * 2. Cancel AFTER Vendor Confirm BUT BEFORE Delivery:
 *    - Vendor lockedBalance decreases by resellerProfit.
 *    - Vendor availableBalance increases by resellerProfit (Vendor Locked -> Available).
 *    - Vendor totalBalance remains strictly UNCHANGED.
 *    - Reseller pendingProfit decreases, cancelledProfit increases. Available balance untouched.
 *    - Order: profitStatus = "CANCELLED", orderStatus = "Cancelled".
 *    - Duplicate protection: Only executes balance correction once per order.
 */
export async function cancelResellerOrder(
  params: CancelResellerOrderParams
): Promise<CancelResellerOrderResult> {
  const { orderId, reason, cancelledBy, adminNote } = params;

  if (!orderId) {
    return {
      success: false,
      isResellerOrder: false,
      profitStatus: 'UNKNOWN',
      resellerProfit: 0,
      error: 'MISSING_ORDER_ID',
      message: 'Order ID প্রদান করা আবশ্যক।'
    };
  }

  const cleanId = cleanOrderId(orderId);
  const now = Date.now();
  const cleanReason = (reason || 'Order Cancelled').trim();
  const actor = cancelledBy || 'system';

  // 1. Fetch Order from RTDB across known paths
  let order = await rtdbGet<any>(`reseller_orders/${cleanId}`);
  if (!order) order = await rtdbGet<any>(`orders/${cleanId}`);
  if (!order) order = await rtdbGet<any>(`vendor_orders/${cleanId}`);

  if (!order) {
    return {
      success: false,
      isResellerOrder: false,
      profitStatus: 'UNKNOWN',
      resellerProfit: 0,
      error: 'ORDER_NOT_FOUND',
      message: `অর্ডার #${cleanId} Realtime Database-এ খুঁজে পাওয়া যায়নি।`
    };
  }

  // 2. Determine if Reseller Order
  const isResellerOrder = Boolean(
    order.isResellerOrder || 
    order.resellerId || 
    order.profitStatus || 
    order.priceSnapshot?.resellerProfit ||
    order.resellerPriceSnapshot?.resellerProfit
  );

  if (!isResellerOrder) {
    // Normal order: no reseller profit balance correction required
    return {
      success: true,
      isResellerOrder: false,
      profitStatus: 'NONE',
      resellerProfit: 0,
      message: 'এটি রিসেলার অর্ডার নয়, সাধারণ অর্ডার হিসেবে প্রসেস সম্পন্ন।'
    };
  }

  const resellerId = order.resellerId;
  const vendorId = order.vendorId;

  // 3. Never Trust Client-Side: Recalculate profit strictly from immutable snapshot
  const profitVerification = verifyAndRecalculateResellerProfit(order);
  const resellerProfit = profitVerification.verifiedProfit;

  // 4. Check Final States (Duplicate Protection & Idempotency)
  const idempCheck = await checkFinancialIdempotency(cleanId, 'RESELLER_ORDER_CANCELLATION');
  if (idempCheck.isDuplicate) {
    return {
      success: true,
      caseType: 'ALREADY_CANCELLED',
      isResellerOrder: true,
      profitStatus: 'CANCELLED',
      resellerProfit,
      transactionId: idempCheck.transactionId,
      message: idempCheck.message || `অর্ডার #${cleanId}-এর প্রফিট ইতিমধ্যে বাতিল (CANCELLED) করা হয়েছে। ডুপ্লিকেট ব্যালেন্স পরিবর্তন রোধ করা হয়েছে।`
    };
  }

  // A. Already Cancelled
  const existingCancellation = await rtdbGet<any>(`reseller_cancellation_records/${cleanId}`);
  if (existingCancellation || order.profitStatus === 'CANCELLED') {
    return {
      success: true,
      caseType: 'ALREADY_CANCELLED',
      isResellerOrder: true,
      profitStatus: 'CANCELLED',
      resellerProfit,
      transactionId: existingCancellation?.transactionId,
      message: `অর্ডার #${cleanId}-এর প্রফিট ইতিমধ্যে বাতিল (CANCELLED) করা হয়েছে। ডুপ্লিকেট ব্যালেন্স পরিবর্তন রোধ করা হয়েছে।`
    };
  }

  // B. Already Released (Post-Delivery)
  if (order.profitStatus === 'RELEASED') {
    return {
      success: false,
      isResellerOrder: true,
      profitStatus: 'RELEASED',
      resellerProfit,
      requiresReversal: true,
      error: 'PROFIT_ALREADY_RELEASED',
      message: 'এই অর্ডারের প্রফিট ইতিমধ্যে রিসেলারের অ্যাকাউন্টে রিলিজ (RELEASED) করা হয়েছে। সরাসরি বাতিল করা সম্ভব নয়; এর জন্য "PROFIT_REVERSAL_REQUEST" প্রয়োজন।'
    };
  }

  // 5. Determine whether Vendor had Confirmed & Locked the Profit
  const isVendorConfirmed = 
    order.vendorOrderStatus === 'CONFIRMED' || 
    order.profitStatus === 'LOCKED' || 
    order.settlementStatus === 'LOCKED' ||
    Boolean(order.lockTransactionId);

  // ---------------------------------------------------------
  // CASE 1: CANCEL BEFORE VENDOR CONFIRM
  // ---------------------------------------------------------
  if (!isVendorConfirmed) {
    const cancelTxId = `TXN_CAN_PRE_${cleanId}_${now}`;

    const updates: Record<string, any> = {};

    // Record Cancellation in Registry to guarantee no duplicate
    const cancelRecord = {
      orderId: cleanId,
      transactionId: cancelTxId,
      caseType: 'CANCEL_BEFORE_CONFIRM',
      resellerId,
      vendorId,
      resellerProfit,
      reason: cleanReason,
      cancelledBy: actor,
      adminNote: adminNote || '',
      vendorWalletImpact: 'NONE',
      resellerWalletImpact: 'PENDING_TO_CANCELLED',
      createdAt: now
    };
    updates[`reseller_cancellation_records/${cleanId}`] = cancelRecord;

    // Order status flags
    const orderPayload = {
      orderStatus: 'Cancelled',
      status: 'Cancelled',
      vendorStatus: 'Cancelled',
      profitStatus: 'CANCELLED',
      cancelledAt: now,
      cancelledBy: actor,
      cancellationReason: cleanReason,
      cancellationTransactionId: cancelTxId,
      updatedAt: now
    };

    updates[`reseller_orders/${cleanId}`] = { ...(await rtdbGet<any>(`reseller_orders/${cleanId}`) || {}), ...orderPayload };
    updates[`orders/${cleanId}/profitStatus`] = 'CANCELLED';
    updates[`orders/${cleanId}/orderStatus`] = 'Cancelled';
    updates[`orders/${cleanId}/status`] = 'Cancelled';
    updates[`orders/${cleanId}/cancellationTransactionId`] = cancelTxId;
    updates[`orders/${cleanId}/updatedAt`] = now;

    updates[`vendor_orders/${cleanId}/profitStatus`] = 'CANCELLED';
    updates[`vendor_orders/${cleanId}/vendorStatus`] = 'Cancelled';
    updates[`vendor_orders/${cleanId}/status`] = 'Cancelled';
    updates[`vendor_orders/${cleanId}/cancellationTransactionId`] = cancelTxId;
    updates[`vendor_orders/${cleanId}/updatedAt`] = now;

    if (resellerId) {
      updates[`resellers/${resellerId}/orders/${cleanId}/profitStatus`] = 'CANCELLED';
      updates[`resellers/${resellerId}/orders/${cleanId}/orderStatus`] = 'Cancelled';
      updates[`resellers/${resellerId}/orders/${cleanId}/status`] = 'Cancelled';
      updates[`resellers/${resellerId}/orders/${cleanId}/updatedAt`] = now;

      // Adjust Reseller Wallet pendingProfit -> cancelledProfit if recorded
      const resWallet = (await rtdbGet<any>(`reseller_wallet/${resellerId}`)) || {};
      const curPending = Number(resWallet.pendingProfit ?? resWallet.pendingCommission ?? 0);
      const curCancelled = Number(resWallet.cancelledProfit ?? 0);
      const newPending = Math.max(0, Math.round((curPending - resellerProfit) * 100) / 100);
      const newCancelled = Math.round((curCancelled + resellerProfit) * 100) / 100;

      updates[`reseller_wallet/${resellerId}/pendingProfit`] = newPending;
      updates[`reseller_wallet/${resellerId}/pendingCommission`] = newPending;
      updates[`reseller_wallet/${resellerId}/cancelledProfit`] = newCancelled;
      updates[`reseller_wallet/${resellerId}/updatedAt`] = now;
    }

    await rtdbMultiUpdate(updates);

    // Record financial idempotency
    await recordFinancialIdempotency(cleanId, 'RESELLER_ORDER_CANCELLATION', {
      transactionId: cancelTxId,
      vendorId,
      resellerId,
      amount: resellerProfit,
      executedBy: actor,
      details: 'Cancelled before vendor confirm'
    });

    // Audit Log
    try {
      await rtdbPush('order_status_logs', {
        orderId: cleanId,
        resellerId,
        vendorId,
        event: 'RESELLER_ORDER_CANCELLED_BEFORE_CONFIRM',
        oldStatus: order.status || 'Pending',
        newStatus: 'Cancelled',
        profitStatus: 'CANCELLED',
        resellerProfit,
        transactionId: cancelTxId,
        note: `Reseller Order #${cleanId} cancelled before vendor confirmation. Zero vendor balance deduction. Reseller profit marked CANCELLED.`,
        cancelledBy: actor,
        timestamp: now
      });
    } catch (_) {}

    return {
      success: true,
      caseType: 'CANCEL_BEFORE_CONFIRM',
      isResellerOrder: true,
      profitStatus: 'CANCELLED',
      resellerProfit,
      transactionId: cancelTxId,
      message: `অর্ডার #${cleanId} ভেন্ডর কনফার্মেশনের পূর্বেই বাতিল হয়েছে। ভেন্ডরের ওয়ালেট থেকে কোনো টাকা কাটা হয়নি এবং রিসেলার প্রফিট বাতিল করা হয়েছে।`
    };
  }

  // ---------------------------------------------------------
  // CASE 2: CANCEL AFTER VENDOR CONFIRM BUT BEFORE DELIVERY
  // ---------------------------------------------------------
  const transactionId = `TXN_CAN_POST_${cleanId}_${now}`;

  // Read Vendor Wallet from RTDB
  const vendorWallet = (await rtdbGet<any>(`vendor_wallet/${vendorId}`)) || {};
  const currentVendorAvail = Number(vendorWallet.availableBalance ?? vendorWallet.balance ?? 0);
  const currentVendorLocked = Number(vendorWallet.lockedBalance ?? vendorWallet.resellerProfitReserve ?? 0);
  const currentVendorTotal = Number(vendorWallet.totalBalance ?? (currentVendorAvail + currentVendorLocked));

  // Vendor Balance Transitions:
  // 1. lockedBalance decreases by resellerProfit
  const newVendorLocked = Math.max(0, Math.round((currentVendorLocked - resellerProfit) * 100) / 100);
  // 2. availableBalance increases by resellerProfit (Vendor Locked -> Available)
  const newVendorAvail = Math.round((currentVendorAvail + resellerProfit) * 100) / 100;
  // 3. totalBalance remains completely unchanged!
  const newVendorTotal = currentVendorTotal;

  // Read Reseller Wallet from RTDB
  const resellerWallet = (await rtdbGet<any>(`reseller_wallet/${resellerId}`)) || {};
  const currentResellerAvail = Number(resellerWallet.availableBalance ?? resellerWallet.walletBalance ?? 0);
  const currentResellerLocked = Number(resellerWallet.lockedBalance ?? 0);
  const currentResellerPending = Number(resellerWallet.pendingProfit ?? resellerWallet.pendingCommission ?? 0);
  const currentResellerCancelled = Number(resellerWallet.cancelledProfit ?? 0);

  // Reseller Balance Transitions:
  // 1. pendingProfit decreases by resellerProfit
  const newResellerPending = Math.max(0, Math.round((currentResellerPending - resellerProfit) * 100) / 100);
  // 2. cancelledProfit increases by resellerProfit
  const newResellerCancelled = Math.round((currentResellerCancelled + resellerProfit) * 100) / 100;
  // 3. availableBalance is untouched (was never released)
  const newResellerAvail = currentResellerAvail;
  const newResellerTotal = Math.round((newResellerAvail + currentResellerLocked) * 100) / 100;

  // Build Atomic Multi-Path RTDB Updates
  const updates: Record<string, any> = {};

  // A. Vendor Wallet Updates (Locked -> Available, Total unchanged)
  updates[`vendor_wallet/${vendorId}/lockedBalance`] = newVendorLocked;
  updates[`vendor_wallet/${vendorId}/resellerProfitReserve`] = newVendorLocked;
  updates[`vendor_wallet/${vendorId}/availableBalance`] = newVendorAvail;
  updates[`vendor_wallet/${vendorId}/balance`] = newVendorAvail;
  updates[`vendor_wallet/${vendorId}/totalBalance`] = newVendorTotal;
  updates[`vendor_wallet/${vendorId}/updatedAt`] = now;

  // B. Reseller Wallet Updates
  if (resellerId) {
    updates[`reseller_wallet/${resellerId}/pendingProfit`] = newResellerPending;
    updates[`reseller_wallet/${resellerId}/pendingCommission`] = newResellerPending;
    updates[`reseller_wallet/${resellerId}/cancelledProfit`] = newResellerCancelled;
    updates[`reseller_wallet/${resellerId}/totalBalance`] = newResellerTotal;
    updates[`reseller_wallet/${resellerId}/updatedAt`] = now;
  }

  // C. Order Status across nodes
  const orderFlags = {
    orderStatus: 'Cancelled',
    status: 'Cancelled',
    vendorStatus: 'Cancelled',
    profitStatus: 'CANCELLED',
    settlementStatus: 'CANCELLED',
    cancelledAt: now,
    cancelledBy: actor,
    cancellationReason: cleanReason,
    cancellationTransactionId: transactionId,
    updatedAt: now
  };

  updates[`reseller_orders/${cleanId}`] = { ...(await rtdbGet<any>(`reseller_orders/${cleanId}`) || {}), ...orderFlags };
  updates[`orders/${cleanId}/orderStatus`] = 'Cancelled';
  updates[`orders/${cleanId}/status`] = 'Cancelled';
  updates[`orders/${cleanId}/profitStatus`] = 'CANCELLED';
  updates[`orders/${cleanId}/cancellationTransactionId`] = transactionId;
  updates[`orders/${cleanId}/updatedAt`] = now;

  updates[`vendor_orders/${cleanId}/status`] = 'Cancelled';
  updates[`vendor_orders/${cleanId}/vendorStatus`] = 'Cancelled';
  updates[`vendor_orders/${cleanId}/profitStatus`] = 'CANCELLED';
  updates[`vendor_orders/${cleanId}/cancellationTransactionId`] = transactionId;
  updates[`vendor_orders/${cleanId}/updatedAt`] = now;

  if (resellerId) {
    updates[`resellers/${resellerId}/orders/${cleanId}/status`] = 'Cancelled';
    updates[`resellers/${resellerId}/orders/${cleanId}/orderStatus`] = 'Cancelled';
    updates[`resellers/${resellerId}/orders/${cleanId}/profitStatus`] = 'CANCELLED';
    updates[`resellers/${resellerId}/orders/${cleanId}/updatedAt`] = now;
  }

  // D. Cancellation Registry for Duplicate Protection
  updates[`reseller_cancellation_records/${cleanId}`] = {
    orderId: cleanId,
    transactionId,
    caseType: 'CANCEL_AFTER_CONFIRM',
    resellerId,
    vendorId,
    resellerProfit,
    reason: cleanReason,
    cancelledBy: actor,
    adminNote: adminNote || '',
    vendorBalanceBefore: {
      availableBalance: currentVendorAvail,
      lockedBalance: currentVendorLocked,
      totalBalance: currentVendorTotal
    },
    vendorBalanceAfter: {
      availableBalance: newVendorAvail,
      lockedBalance: newVendorLocked,
      totalBalance: newVendorTotal
    },
    createdAt: now
  };

  // E. Vendor Wallet Transaction for Audit
  updates[`vendor_wallet_transactions/${vendorId}/${transactionId}`] = {
    id: transactionId,
    transactionId,
    vendorId,
    orderId: cleanId,
    resellerId,
    amount: resellerProfit,
    type: 'RESELLER_LOCKED_REFUND',
    transactionType: 'RESELLER_LOCKED_REFUND',
    title: 'লকড ব্যালেন্স রিফান্ড (অর্ডার বাতিল)',
    description: `অর্ডার #${cleanId} বাতিল হওয়ায় রিজার্ভকৃত প্রফিট ৳${resellerProfit} Locked Balance থেকে Available Balance-এ ফেরত এসেছে।`,
    previousAvailable: currentVendorAvail,
    newAvailable: newVendorAvail,
    previousLocked: currentVendorLocked,
    newLocked: newVendorLocked,
    totalBalance: newVendorTotal,
    createdAt: now
  };

  // F. Reseller Wallet Transaction for Audit
  if (resellerId) {
    updates[`reseller_wallet_transactions/${transactionId}`] = {
      transactionId,
      userId: resellerId,
      resellerId,
      vendorId,
      orderId: cleanId,
      amount: resellerProfit,
      type: 'RESELLER_PROFIT_CANCELLED',
      status: 'CANCELLED',
      description: `অর্ডার #${cleanId} বাতিল হওয়ায় পেন্ডিং প্রফিট ৳${resellerProfit} বাতিল করা হয়েছে।`,
      balanceBefore: {
        availableBalance: currentResellerAvail,
        lockedBalance: currentResellerLocked,
        totalBalance: currentResellerAvail + currentResellerLocked
      },
      balanceAfter: {
        availableBalance: newResellerAvail,
        lockedBalance: currentResellerLocked,
        totalBalance: newResellerTotal
      },
      createdAt: now,
      updatedAt: now
    };
  }

  // Execute Atomic Multi-Path Update in RTDB
  await rtdbMultiUpdate(updates);

  // Record financial idempotency
  await recordFinancialIdempotency(cleanId, 'RESELLER_ORDER_CANCELLATION', {
    transactionId,
    vendorId,
    resellerId,
    amount: resellerProfit,
    executedBy: actor,
    details: 'Cancelled after vendor confirm (locked refunded to available)'
  });

  // Push Order Status Log
  try {
    await rtdbPush('order_status_logs', {
      orderId: cleanId,
      resellerId,
      vendorId,
      event: 'RESELLER_ORDER_CANCELLED_AFTER_CONFIRM',
      oldStatus: order.status || 'Accepted',
      newStatus: 'Cancelled',
      profitStatus: 'CANCELLED',
      resellerProfit,
      transactionId,
      note: `Order cancelled after vendor confirmation. Vendor locked balance ৳${resellerProfit} returned to available balance. Reseller pending profit cancelled.`,
      cancelledBy: actor,
      timestamp: now
    });
  } catch (_) {}

  return {
    success: true,
    caseType: 'CANCEL_AFTER_CONFIRM',
    isResellerOrder: true,
    profitStatus: 'CANCELLED',
    resellerProfit,
    transactionId,
    message: `অর্ডার #${cleanId} সফলভাবে বাতিল করা হয়েছে। ভেন্ডরের Locked Balance থেকে ৳${resellerProfit} Available Balance-এ ফেরত দেওয়া হয়েছে এবং রিসেলারের প্রফিট বাতিল করা হয়েছে।`
  };
}

/**
 * STEP 9.3: CREATE PROFIT REVERSAL REQUEST (Post-Delivery Return/Refund)
 * 
 * Rules:
 * 1. Validates that order exists and profitStatus is RELEASED.
 * 2. Strictly DOES NOT deduct from Reseller availableBalance or credit Vendor immediately!
 * 3. Creates record in reseller_profit_reversals/${reversalRequestId} with status = "PENDING_ADMIN_REVIEW".
 * 4. Prevents duplicate reversal requests for the same order.
 */
export async function createProfitReversalRequest(
  params: CreateProfitReversalParams
): Promise<CreateProfitReversalResult> {
  const { orderId, reason, requestedBy, vendorId, resellerId, adminNote } = params;

  if (!orderId) {
    return { success: false, error: 'MISSING_ORDER_ID', message: 'Order ID প্রদান করা আবশ্যক।' };
  }
  if (!reason || !reason.trim()) {
    return { success: false, error: 'MISSING_REASON', message: 'রিভার্সালের কারণ উল্লেখ করা আবশ্যক।' };
  }

  const cleanId = cleanOrderId(orderId);

  // 1. Fetch Order from RTDB
  let order = await rtdbGet<any>(`reseller_orders/${cleanId}`);
  if (!order) order = await rtdbGet<any>(`orders/${cleanId}`);
  if (!order) order = await rtdbGet<any>(`vendor_orders/${cleanId}`);

  if (!order) {
    return { success: false, error: 'ORDER_NOT_FOUND', message: `অর্ডার #${cleanId} খুঁজে পাওয়া যায়নি।` };
  }

  // 2. Validate Released Profit State
  if (order.profitStatus !== 'RELEASED') {
    return {
      success: false,
      error: 'PROFIT_NOT_RELEASED',
      message: `এই অর্ডারের প্রফিট স্ট্যাটাস "${order.profitStatus || 'NOT_RELEASED'}"। শুধুমাত্র RELEASED প্রফিটের ক্ষেত্রেই রিভার্সাল রিকুয়েস্ট প্রযোজ্য। সাধারণ বাতিলের জন্য স্ট্যান্ডার্ড ক্যানসেল ব্যবহার করুন।`
    };
  }

  // 3. Prevent Duplicate Pending Reversal Request
  const existingReq = await getProfitReversalRequestByOrder(cleanId);
  if (existingReq) {
    if (existingReq.status === 'PENDING_ADMIN_REVIEW') {
      return {
        success: false,
        error: 'DUPLICATE_REVERSAL_REQUEST',
        message: 'এই অর্ডারের জন্য ইতিমধ্যে একটি প্রফিট রিভার্সাল রিকুয়েস্ট অ্যাডমিন পর্যালোচনায় জমা রয়েছে (PENDING_ADMIN_REVIEW)।',
        reversalRequest: existingReq
      };
    }
    if (existingReq.status === 'REVERSED') {
      return {
        success: false,
        error: 'ALREADY_REVERSED',
        message: 'এই অর্ডারের প্রফিট ইতিমধ্যে রিভার্স সম্পন্ন হয়েছে (REVERSED)।',
        reversalRequest: existingReq
      };
    }
  }

  const now = Date.now();
  const reversalRequestId = `RET_REV_${cleanId}_${now}`;
  const finalResellerId = resellerId || order.resellerId;
  const finalVendorId = vendorId || order.vendorId;

  const reversalAmount = Number(
    order.lockedProfitAmount ?? 
    order.resellerProfit ?? 
    order.priceSnapshot?.resellerProfit ?? 
    0
  );

  const productItem = order.items?.[0] || {};
  const productName = productItem.name || productItem.productName || order.productName || 'Product';
  const productImage = productItem.image || productItem.thumbnail || '';
  const quantity = Number(productItem.quantity || order.quantity || 1);
  const vendorPrice = Number(productItem.vendorPrice || order.vendorPrice || 0);
  const resellerSellingPrice = Number(productItem.resellerSellingPrice || productItem.resellerPrice || order.resellerSellingPrice || 0);

  const record: ResellerProfitReversalRecord = {
    reversalRequestId,
    orderId: cleanId,
    resellerId: finalResellerId,
    vendorId: finalVendorId,
    reversalAmount,
    reason: reason.trim(),
    requestedBy: requestedBy || 'Vendor',
    status: 'PENDING_ADMIN_REVIEW',
    createdAt: now,
    updatedAt: now,
    productName,
    productImage,
    quantity,
    vendorPrice,
    resellerSellingPrice,
    vendorShopName: order.shopName || order.vendorShopName || '',
    resellerName: order.resellerName || '',
    resellerPhone: order.resellerPhone || '',
    customerName: order.customerName || '',
    customerPhone: order.customerPhone || '',
    deliveryStatus: order.deliveryStatus || order.status || 'Delivered',
    courierName: order.courierName || '',
    trackingNumber: order.trackingNumber || order.consignmentId || '',
    adminNote: adminNote || ''
  };

  const updates: Record<string, any> = {};
  updates[`reseller_profit_reversals/${reversalRequestId}`] = record;
  updates[`reseller_profit_reversals_by_order/${cleanId}`] = record;

  // Flag order
  updates[`reseller_orders/${cleanId}/reversalRequestId`] = reversalRequestId;
  updates[`reseller_orders/${cleanId}/reversalStatus`] = 'PENDING_ADMIN_REVIEW';
  updates[`reseller_orders/${cleanId}/reversalRequestedAt`] = now;
  updates[`reseller_orders/${cleanId}/updatedAt`] = now;

  updates[`orders/${cleanId}/reversalRequestId`] = reversalRequestId;
  updates[`orders/${cleanId}/reversalStatus`] = 'PENDING_ADMIN_REVIEW';
  updates[`orders/${cleanId}/updatedAt`] = now;

  updates[`vendor_orders/${cleanId}/reversalRequestId`] = reversalRequestId;
  updates[`vendor_orders/${cleanId}/reversalStatus`] = 'PENDING_ADMIN_REVIEW';
  updates[`vendor_orders/${cleanId}/updatedAt`] = now;

  if (finalResellerId) {
    updates[`resellers/${finalResellerId}/orders/${cleanId}/reversalRequestId`] = reversalRequestId;
    updates[`resellers/${finalResellerId}/orders/${cleanId}/reversalStatus`] = 'PENDING_ADMIN_REVIEW';
    updates[`resellers/${finalResellerId}/orders/${cleanId}/updatedAt`] = now;
  }

  await rtdbMultiUpdate(updates);

  // Push Audit Log
  try {
    await rtdbPush('order_status_logs', {
      orderId: cleanId,
      resellerId: finalResellerId,
      vendorId: finalVendorId,
      event: 'PROFIT_REVERSAL_REQUESTED',
      reversalRequestId,
      reversalAmount,
      reason: reason.trim(),
      status: 'PENDING_ADMIN_REVIEW',
      note: `Profit Reversal Request submitted for delivered order #${cleanId}. Amount: ৳${reversalAmount}. Awaiting Admin verification.`,
      timestamp: now
    });
  } catch (_) {}

  return {
    success: true,
    message: 'প্রফিট রিভার্সাল রিকুয়েস্ট সফলভাবে তৈরি হয়েছে। অ্যাডমিন ভেরিফিকেশনের পর ব্যালেন্স সমন্বয় করা হবে।',
    reversalRequestId,
    reversalRequest: record
  };
}

/**
 * STEP 9.3: ADMIN APPROVE PROFIT REVERSAL
 * 
 * Rules:
 * 1. Admin verification is MANDATORY.
 * 2. If Reseller availableBalance >= reversalAmount:
 *    - Reseller availableBalance decreases by reversalAmount.
 *    - Reseller releasedProfit decreases by reversalAmount.
 *    - Reseller cancelledProfit increases by reversalAmount.
 *    - Reseller totalBalance decreases by reversalAmount.
 *    - Vendor availableBalance increases by reversalAmount.
 *    - Vendor totalBalance increases by reversalAmount.
 *    - Reversal status = "REVERSED", Order profitStatus = "REVERSED".
 * 3. If Reseller availableBalance < reversalAmount:
 *    - STRICTLY DO NOT create negative balance!
 *    - Status = "REVERSAL_PENDING".
 *    - Marked as unresolved balance correction for Admin attention.
 */
export async function adminApproveProfitReversal(
  params: AdminApproveReversalParams
): Promise<AdminApproveReversalResult> {
  const { orderId, reversalRequestId, adminId, adminEmail, adminName, adminNote } = params;

  if (!orderId) {
    return {
      success: false,
      status: 'REVERSAL_PENDING',
      error: 'MISSING_ORDER_ID',
      message: 'Order ID প্রদান করা আবশ্যক।'
    };
  }

  const cleanId = cleanOrderId(orderId);

  // 1. Double Processing & Idempotency Check
  const idempCheck = await checkFinancialIdempotency(cleanId, 'RESELLER_PROFIT_REVERSAL');
  if (idempCheck.isDuplicate) {
    return {
      success: false,
      status: 'REVERSED',
      error: 'ALREADY_REVERSED',
      message: idempCheck.message || `অর্ডার #${cleanId}-এর রিভার্সাল ইতিমধ্যে সম্পন্ন হয়েছে। দ্বিতীয়বার ব্যালেন্স কর্তন করা যাবে না।`
    };
  }

  // 1. Fetch Reversal Request from RTDB
  const reversalReq = await getProfitReversalRequestByOrder(cleanId);
  if (!reversalReq) {
    return {
      success: false,
      status: 'REVERSAL_PENDING',
      error: 'REVERSAL_NOT_FOUND',
      message: `অর্ডার #${cleanId}-এর জন্য কোনো প্রফিট রিভার্সাল রিকুয়েস্ট পাওয়া যায়নি।`
    };
  }

  // Duplicate Approval Check
  if (reversalReq.status === 'REVERSED') {
    return {
      success: false,
      status: 'REVERSED',
      error: 'ALREADY_REVERSED',
      message: `অর্ডার #${cleanId}-এর রিভার্সাল ইতিমধ্যে সম্পন্ন হয়েছে (Transaction: ${reversalReq.transactionId})। দ্বিতীয়বার ব্যালেন্স কর্তন করা যাবে না।`
    };
  }

  // 2. Fetch Order from RTDB
  let order = await rtdbGet<any>(`reseller_orders/${cleanId}`);
  if (!order) order = await rtdbGet<any>(`orders/${cleanId}`);
  if (!order) order = await rtdbGet<any>(`vendor_orders/${cleanId}`);

  if (!order) {
    return {
      success: false,
      status: 'REVERSAL_PENDING',
      error: 'ORDER_NOT_FOUND',
      message: `অর্ডার #${cleanId} খুঁজে পাওয়া যায়নি।`
    };
  }

  const resellerId = reversalReq.resellerId || order.resellerId;
  const vendorId = reversalReq.vendorId || order.vendorId;

  if (!resellerId || !vendorId) {
    return {
      success: false,
      status: 'REVERSAL_PENDING',
      error: 'MISSING_PARTIES',
      message: 'রিসেলার অথবা ভেন্ডরের আইডি পাওয়া যায়নি।'
    };
  }

  // Never Trust Client-Side: Recalculate profit strictly from immutable snapshot
  const profitVerification = verifyAndRecalculateResellerProfit(order);
  const reversalAmount = profitVerification.verifiedProfit;

  const now = Date.now();
  const adminIdentifier = adminEmail || adminName || adminId || 'Admin';
  const reqId = reversalReq.reversalRequestId || reversalRequestId || `RET_REV_${cleanId}_${now}`;

  // 3. Read Authoritative Reseller Wallet from RTDB
  const resellerWallet = (await rtdbGet<any>(`reseller_wallet/${resellerId}`)) || {};
  const currentResellerAvail = Number(resellerWallet.availableBalance ?? resellerWallet.walletBalance ?? 0);
  const currentResellerLocked = Number(resellerWallet.lockedBalance ?? 0);
  const currentResellerReleased = Number(resellerWallet.releasedProfit ?? 0);
  const currentResellerCancelled = Number(resellerWallet.cancelledProfit ?? 0);

  // 4. CHECK INSUFFICIENT BALANCE FOR SAFEGUARDING AGAINST NEGATIVE BALANCES
  if (currentResellerAvail < reversalAmount) {
    const shortfall = Math.round((reversalAmount - currentResellerAvail) * 100) / 100;

    // RULE: "যদি Reseller-এর availableBalance যথেষ্ট না থাকে, তাহলে negative balance তৈরি করবে না।
    // সেক্ষেত্রে status: 'REVERSAL_PENDING' রাখবে এবং Admin-এর জন্য unresolved balance correction হিসেবে দেখাবে।"
    const unresolvedUpdates: Record<string, any> = {};

    unresolvedUpdates[`reseller_profit_reversals/${reqId}/status`] = 'REVERSAL_PENDING';
    unresolvedUpdates[`reseller_profit_reversals/${reqId}/isUnresolved`] = true;
    unresolvedUpdates[`reseller_profit_reversals/${reqId}/unresolvedReason`] = 'INSUFFICIENT_RESELLER_BALANCE';
    unresolvedUpdates[`reseller_profit_reversals/${reqId}/currentResellerAvailable`] = currentResellerAvail;
    unresolvedUpdates[`reseller_profit_reversals/${reqId}/shortfall`] = shortfall;
    unresolvedUpdates[`reseller_profit_reversals/${reqId}/lastAttemptedAt`] = now;
    unresolvedUpdates[`reseller_profit_reversals/${reqId}/lastAttemptedBy`] = adminIdentifier;
    unresolvedUpdates[`reseller_profit_reversals/${reqId}/adminNote`] = adminNote || '';
    unresolvedUpdates[`reseller_profit_reversals/${reqId}/updatedAt`] = now;

    unresolvedUpdates[`reseller_profit_reversals_by_order/${cleanId}/status`] = 'REVERSAL_PENDING';
    unresolvedUpdates[`reseller_profit_reversals_by_order/${cleanId}/isUnresolved`] = true;
    unresolvedUpdates[`reseller_profit_reversals_by_order/${cleanId}/unresolvedReason`] = 'INSUFFICIENT_RESELLER_BALANCE';
    unresolvedUpdates[`reseller_profit_reversals_by_order/${cleanId}/currentResellerAvailable`] = currentResellerAvail;
    unresolvedUpdates[`reseller_profit_reversals_by_order/${cleanId}/shortfall`] = shortfall;
    unresolvedUpdates[`reseller_profit_reversals_by_order/${cleanId}/lastAttemptedAt`] = now;
    unresolvedUpdates[`reseller_profit_reversals_by_order/${cleanId}/lastAttemptedBy`] = adminIdentifier;
    unresolvedUpdates[`reseller_profit_reversals_by_order/${cleanId}/updatedAt`] = now;

    // Order flags
    unresolvedUpdates[`reseller_orders/${cleanId}/reversalStatus`] = 'REVERSAL_PENDING';
    unresolvedUpdates[`reseller_orders/${cleanId}/unresolvedBalanceCorrection`] = true;
    unresolvedUpdates[`reseller_orders/${cleanId}/shortfall`] = shortfall;
    unresolvedUpdates[`reseller_orders/${cleanId}/updatedAt`] = now;

    unresolvedUpdates[`orders/${cleanId}/reversalStatus`] = 'REVERSAL_PENDING';
    unresolvedUpdates[`orders/${cleanId}/unresolvedBalanceCorrection`] = true;
    unresolvedUpdates[`orders/${cleanId}/updatedAt`] = now;

    await rtdbMultiUpdate(unresolvedUpdates);

    // Audit log
    try {
      await rtdbPush('order_status_logs', {
        orderId: cleanId,
        resellerId,
        vendorId,
        event: 'PROFIT_REVERSAL_INSUFFICIENT_BALANCE',
        status: 'REVERSAL_PENDING',
        reversalAmount,
        currentResellerAvailable: currentResellerAvail,
        shortfall,
        adminIdentifier,
        note: `Reversal halted to prevent negative balance. Current available: ৳${currentResellerAvail}, Required: ৳${reversalAmount}, Shortfall: ৳${shortfall}. Marked REVERSAL_PENDING.`,
        timestamp: now
      });
    } catch (_) {}

    return {
      success: false,
      status: 'REVERSAL_PENDING',
      shortfall,
      currentResellerAvailable: currentResellerAvail,
      error: 'INSUFFICIENT_RESELLER_BALANCE',
      message: `রিসেলারের ওয়ালেটে পর্যাপ্ত availableBalance নেই (বর্তমান ব্যালেন্স: ৳${currentResellerAvail}, প্রয়োজন: ৳${reversalAmount})। নেগেটিভ ব্যালেন্স এড়াতে ব্যালেন্স কর্তন স্থগিত রাখা হয়েছে এবং স্ট্যাটাস REVERSAL_PENDING হিসেবে সংরক্ষিত হয়েছে।`
    };
  }

  // ---------------------------------------------------------
  // SUFFICIENT BALANCE: EXECUTE ATOMIC REVERSAL
  // ---------------------------------------------------------
  const transactionId = `TXN_REV_${cleanId}_${now}`;

  // Reseller Transitions:
  const newResellerAvail = Math.round((currentResellerAvail - reversalAmount) * 100) / 100;
  const newResellerReleased = Math.max(0, Math.round((currentResellerReleased - reversalAmount) * 100) / 100);
  const newResellerCancelled = Math.round((currentResellerCancelled + reversalAmount) * 100) / 100;
  const newResellerTotal = Math.round((newResellerAvail + currentResellerLocked) * 100) / 100;

  // Read Vendor Wallet from RTDB
  const vendorWallet = (await rtdbGet<any>(`vendor_wallet/${vendorId}`)) || {};
  const currentVendorAvail = Number(vendorWallet.availableBalance ?? vendorWallet.balance ?? 0);
  const currentVendorLocked = Number(vendorWallet.lockedBalance ?? 0);
  const currentVendorTotal = Number(vendorWallet.totalBalance ?? (currentVendorAvail + currentVendorLocked));

  // Vendor Transitions:
  // availableBalance increases by reversalAmount
  const newVendorAvail = Math.round((currentVendorAvail + reversalAmount) * 100) / 100;
  // totalBalance increases by reversalAmount
  const newVendorTotal = Math.round((currentVendorTotal + reversalAmount) * 100) / 100;

  // Build Atomic Multi-Path RTDB Updates
  const updates: Record<string, any> = {};

  // A. Reseller Wallet Updates
  updates[`reseller_wallet/${resellerId}/availableBalance`] = newResellerAvail;
  updates[`reseller_wallet/${resellerId}/walletBalance`] = newResellerAvail;
  updates[`reseller_wallet/${resellerId}/releasedProfit`] = newResellerReleased;
  updates[`reseller_wallet/${resellerId}/cancelledProfit`] = newResellerCancelled;
  updates[`reseller_wallet/${resellerId}/totalBalance`] = newResellerTotal;
  updates[`reseller_wallet/${resellerId}/updatedAt`] = now;

  // B. Vendor Wallet Updates
  updates[`vendor_wallet/${vendorId}/availableBalance`] = newVendorAvail;
  updates[`vendor_wallet/${vendorId}/balance`] = newVendorAvail;
  updates[`vendor_wallet/${vendorId}/totalBalance`] = newVendorTotal;
  updates[`vendor_wallet/${vendorId}/updatedAt`] = now;

  // C. Profit Reversal Record Updates
  const updatedReversalFields = {
    status: 'REVERSED',
    isUnresolved: false,
    unresolvedReason: null,
    shortfall: 0,
    processedBy: adminIdentifier,
    processedAt: now,
    transactionId,
    adminNote: adminNote || '',
    updatedAt: now
  };

  updates[`reseller_profit_reversals/${reqId}`] = { ...reversalReq, ...updatedReversalFields };
  updates[`reseller_profit_reversals_by_order/${cleanId}`] = { ...reversalReq, ...updatedReversalFields };

  // D. Order Status across nodes
  updates[`reseller_orders/${cleanId}/profitStatus`] = 'REVERSED';
  updates[`reseller_orders/${cleanId}/reversalStatus`] = 'REVERSED';
  updates[`reseller_orders/${cleanId}/reversalProcessedAt`] = now;
  updates[`reseller_orders/${cleanId}/reversalProcessedBy`] = adminIdentifier;
  updates[`reseller_orders/${cleanId}/reversalTransactionId`] = transactionId;
  updates[`reseller_orders/${cleanId}/unresolvedBalanceCorrection`] = false;
  updates[`reseller_orders/${cleanId}/updatedAt`] = now;

  updates[`orders/${cleanId}/profitStatus`] = 'REVERSED';
  updates[`orders/${cleanId}/reversalStatus`] = 'REVERSED';
  updates[`orders/${cleanId}/reversalTransactionId`] = transactionId;
  updates[`orders/${cleanId}/unresolvedBalanceCorrection`] = false;
  updates[`orders/${cleanId}/updatedAt`] = now;

  updates[`vendor_orders/${cleanId}/profitStatus`] = 'REVERSED';
  updates[`vendor_orders/${cleanId}/reversalStatus`] = 'REVERSED';
  updates[`vendor_orders/${cleanId}/reversalTransactionId`] = transactionId;
  updates[`vendor_orders/${cleanId}/updatedAt`] = now;

  if (resellerId) {
    updates[`resellers/${resellerId}/orders/${cleanId}/profitStatus`] = 'REVERSED';
    updates[`resellers/${resellerId}/orders/${cleanId}/reversalStatus`] = 'REVERSED';
    updates[`resellers/${resellerId}/orders/${cleanId}/reversalTransactionId`] = transactionId;
    updates[`resellers/${resellerId}/orders/${cleanId}/updatedAt`] = now;
  }

  // E. Reseller Wallet Transaction Record
  updates[`reseller_wallet_transactions/${transactionId}`] = {
    transactionId,
    userId: resellerId,
    resellerId,
    vendorId,
    orderId: cleanId,
    amount: reversalAmount,
    type: 'RESELLER_PROFIT_REVERSAL',
    status: 'COMPLETED',
    description: `অর্ডার #${cleanId} পোস্ট-ডেলিভারি রিটার্ন/রিফান্ড বাবদ রিলিজড প্রফিট ৳${reversalAmount} সফলভাবে রিভার্স করা হয়েছে।`,
    balanceBefore: {
      availableBalance: currentResellerAvail,
      lockedBalance: currentResellerLocked,
      totalBalance: currentResellerAvail + currentResellerLocked
    },
    balanceAfter: {
      availableBalance: newResellerAvail,
      lockedBalance: currentResellerLocked,
      totalBalance: newResellerTotal
    },
    createdAt: now,
    updatedAt: now
  };

  // F. Vendor Wallet Transaction Record
  updates[`vendor_wallet_transactions/${vendorId}/${transactionId}`] = {
    id: transactionId,
    transactionId,
    vendorId,
    orderId: cleanId,
    resellerId,
    amount: reversalAmount,
    type: 'RESELLER_PROFIT_REVERSAL_REFUND',
    transactionType: 'RESELLER_PROFIT_REVERSAL_REFUND',
    title: 'প্রফিট রিভার্সাল রিফান্ড',
    description: `অর্ডার #${cleanId}-এর পোস্ট-ডেলিভারি রিটার্ন বাবদ রিসেলার প্রফিট ৳${reversalAmount} আপনার Available Balance-এ রিফান্ড করা হয়েছে।`,
    previousAvailable: currentVendorAvail,
    newAvailable: newVendorAvail,
    totalBalance: newVendorTotal,
    createdAt: now
  };

  // Perform Atomic Update in RTDB
  await rtdbMultiUpdate(updates);

  // Record financial idempotency
  await recordFinancialIdempotency(cleanId, 'RESELLER_PROFIT_REVERSAL', {
    transactionId,
    vendorId,
    resellerId,
    amount: reversalAmount,
    executedBy: adminIdentifier,
    details: `Profit reversal approved by ${adminIdentifier}`
  });

  // Push Audit Log
  try {
    await rtdbPush('order_status_logs', {
      orderId: cleanId,
      resellerId,
      vendorId,
      event: 'PROFIT_REVERSAL_APPROVED',
      status: 'REVERSED',
      reversalAmount,
      transactionId,
      processedBy: adminIdentifier,
      note: `Profit reversal approved by Admin. Reseller deducted ৳${reversalAmount}, Vendor credited ৳${reversalAmount}.`,
      timestamp: now
    });
  } catch (_) {}

  return {
    success: true,
    status: 'REVERSED',
    transactionId,
    message: `অর্ডার #${cleanId}-এর প্রফিট রিভার্সাল সফল হয়েছে। রিসেলারের ব্যালেন্স থেকে ৳${reversalAmount} কর্তন করে ভেন্ডরের Available Balance-এ রিফান্ড সম্পন্ন হয়েছে।`
  };
}

/**
 * STEP 9.3: ADMIN REJECT PROFIT REVERSAL
 */
export async function adminRejectProfitReversal(
  params: AdminRejectReversalParams
): Promise<{ success: boolean; message: string; error?: string }> {
  const { orderId, reversalRequestId, rejectionReason, adminId, adminEmail, adminName } = params;

  if (!orderId) {
    return { success: false, error: 'MISSING_ORDER_ID', message: 'Order ID প্রদান করা আবশ্যক।' };
  }
  if (!rejectionReason || !rejectionReason.trim()) {
    return { success: false, error: 'MISSING_REASON', message: 'বাতিল করার কারণ উল্লেখ করা আবশ্যক।' };
  }

  const cleanId = cleanOrderId(orderId);
  const reversalReq = await getProfitReversalRequestByOrder(cleanId);
  if (!reversalReq) {
    return { success: false, error: 'NOT_FOUND', message: 'প্রফিট রিভার্সাল রিকুয়েস্ট খুঁজে পাওয়া যায়নি।' };
  }

  if (reversalReq.status === 'REVERSED') {
    return { success: false, error: 'ALREADY_REVERSED', message: 'ইতিমধ্যে সম্পন্ন হওয়া রিভার্সাল বাতিল করা সম্ভব নয়।' };
  }

  const now = Date.now();
  const adminIdentifier = adminEmail || adminName || adminId || 'Admin';
  const reqId = reversalReq.reversalRequestId || reversalRequestId;

  const updates: Record<string, any> = {};
  updates[`reseller_profit_reversals/${reqId}/status`] = 'REJECTED';
  updates[`reseller_profit_reversals/${reqId}/rejectionReason`] = rejectionReason.trim();
  updates[`reseller_profit_reversals/${reqId}/rejectedBy`] = adminIdentifier;
  updates[`reseller_profit_reversals/${reqId}/rejectedAt`] = now;
  updates[`reseller_profit_reversals/${reqId}/updatedAt`] = now;

  updates[`reseller_profit_reversals_by_order/${cleanId}/status`] = 'REJECTED';
  updates[`reseller_profit_reversals_by_order/${cleanId}/rejectionReason`] = rejectionReason.trim();
  updates[`reseller_profit_reversals_by_order/${cleanId}/rejectedBy`] = adminIdentifier;
  updates[`reseller_profit_reversals_by_order/${cleanId}/rejectedAt`] = now;
  updates[`reseller_profit_reversals_by_order/${cleanId}/updatedAt`] = now;

  updates[`reseller_orders/${cleanId}/reversalStatus`] = 'REJECTED';
  updates[`reseller_orders/${cleanId}/updatedAt`] = now;

  updates[`orders/${cleanId}/reversalStatus`] = 'REJECTED';
  updates[`orders/${cleanId}/updatedAt`] = now;

  await rtdbMultiUpdate(updates);

  try {
    await rtdbPush('order_status_logs', {
      orderId: cleanId,
      event: 'PROFIT_REVERSAL_REJECTED',
      rejectionReason: rejectionReason.trim(),
      rejectedBy: adminIdentifier,
      timestamp: now
    });
  } catch (_) {}

  return {
    success: true,
    message: 'প্রফিট রিভার্সাল রিকুয়েস্টটি বাতিল (REJECTED) করা হয়েছে।'
  };
}

/**
 * Fetches all Reseller Profit Reversal records from RTDB
 */
export async function fetchAllProfitReversals(): Promise<ResellerProfitReversalRecord[]> {
  try {
    const rawMap = await rtdbGet<Record<string, ResellerProfitReversalRecord>>('reseller_profit_reversals');
    if (!rawMap || typeof rawMap !== 'object') return [];

    const list: ResellerProfitReversalRecord[] = [];
    for (const [key, val] of Object.entries(rawMap)) {
      if (val && typeof val === 'object') {
        list.push({
          ...val,
          reversalRequestId: val.reversalRequestId || key
        });
      }
    }

    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) {
    console.error('[ResellerCancellationService] fetchAllProfitReversals error:', err);
    return [];
  }
}

/**
 * Real-time subscription to Reseller Profit Reversal requests
 */
export function subscribeToProfitReversals(
  callback: (reversals: ResellerProfitReversalRecord[], unresolvedCount: number, pendingCount: number) => void
): () => void {
  const unsub = rtdbSubscribe('reseller_profit_reversals', async () => {
    try {
      const items = await fetchAllProfitReversals();
      const unresolvedCount = items.filter(r => r.status === 'REVERSAL_PENDING').length;
      const pendingCount = items.filter(r => r.status === 'PENDING_ADMIN_REVIEW').length;
      callback(items, unresolvedCount, pendingCount);
    } catch (e) {
      console.warn('subscribeToProfitReversals error:', e);
    }
  });

  // Initial invoke
  fetchAllProfitReversals().then(items => {
    const unresolvedCount = items.filter(r => r.status === 'REVERSAL_PENDING').length;
    const pendingCount = items.filter(r => r.status === 'PENDING_ADMIN_REVIEW').length;
    callback(items, unresolvedCount, pendingCount);
  }).catch(() => {});

  return unsub;
}
