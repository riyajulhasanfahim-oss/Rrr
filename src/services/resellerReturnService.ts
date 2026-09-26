/**
 * Reseller Return & Failed Delivery Service (Firebase Realtime Database)
 * Step 8/10
 * 
 * Strict Guidelines:
 * 1. Uses Firebase Realtime Database (RTDB) exclusively. Zero Firestore.
 * 2. Dedicated to Reseller Orders Return / Failed Delivery logic.
 * 3. Vendor reports return -> Creates return request with returnStatus = "PENDING_ADMIN_REVIEW".
 *    Does NOT debit vendor lockedBalance or cancel profit immediately.
 * 4. Admin reviews linked order, delivery/tracking info.
 * 5. Admin Approve Return -> Atomic Multi-Path RTDB update:
 *    - Vendor lockedBalance decreases by resellerProfitAmount
 *    - Vendor availableBalance increases by resellerProfitAmount (Vendor Locked -> Available)
 *    - Vendor totalBalance remains unchanged
 *    - Reseller pendingProfit decreases by resellerProfitAmount
 *    - Reseller cancelledProfit increases by resellerProfitAmount
 *    - Order profitStatus = "CANCELLED"
 *    - Return status = "APPROVED"
 *    - Unique transaction created: transactionType = "RESELLER_PROFIT_RETURN"
 * 6. Admin Reject Return:
 *    - returnStatus = "REJECTED"
 *    - Vendor lockedBalance unchanged
 *    - Reseller pendingProfit unchanged
 *    - Profit remains in original LOCKED state
 * 7. Duplicate & State Protection:
 *    - An order with returnStatus === "APPROVED" cannot be processed again.
 *    - If an order's profit is already "RELEASED", ordinary return report cannot directly pull back funds.
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
import { createProfitReversalRequest } from './resellerCancellationService';
import {
  verifyAndRecalculateResellerProfit,
  validateOrderStateTransition,
  checkFinancialIdempotency,
  recordFinancialIdempotency,
  ensureVendorBalanceConsistency,
  ensureResellerBalanceConsistency
} from './resellerSecurityService';

export type ResellerReturnStatus = 'PENDING_ADMIN_REVIEW' | 'APPROVED' | 'REJECTED';

export interface ResellerReturnRequestRecord {
  returnRequestId: string;
  orderId: string;
  resellerId: string;
  vendorId: string;
  resellerProfit: number;
  orderStatus: string;
  returnStatus: ResellerReturnStatus;
  reason: string;
  reportedBy: string;
  createdAt: number;
  updatedAt: number;
  // Metadata & Tracking info
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  deliveryStatus?: string;
  productName?: string;
  quantity?: number;
  vendorShopName?: string;
  resellerName?: string;
  adminNote?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: number;
  processedBy?: string;
  processedAt?: number;
  transactionId?: string;
}

export interface ReportReturnParams {
  orderId: string;
  vendorId: string;
  reason: string;
  reportedBy?: string;
}

export interface ReportReturnResult {
  success: boolean;
  message: string;
  returnRequestId?: string;
  returnRequest?: ResellerReturnRequestRecord;
  error?: string;
}

export interface AdminApproveReturnParams {
  orderId: string;
  returnRequestId?: string;
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
  adminNote?: string;
}

export interface AdminRejectReturnParams {
  orderId: string;
  returnRequestId?: string;
  rejectionReason: string;
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
}

/**
 * Normalizes Order ID helper
 */
export function cleanOrderIdString(orderId: string): string {
  return String(orderId || '').replace(/^#/, '').trim();
}

/**
 * Checks if a Return Request already exists for an order in RTDB
 */
export async function getResellerReturnRequestByOrder(
  orderId: string
): Promise<ResellerReturnRequestRecord | null> {
  if (!orderId) return null;
  const cleanId = cleanOrderIdString(orderId);

  try {
    const record = await rtdbGet<ResellerReturnRequestRecord>(`reseller_return_requests_by_order/${cleanId}`);
    if (record) return record;

    // Check list
    const all = await rtdbGet<Record<string, ResellerReturnRequestRecord>>('reseller_return_requests');
    if (all && typeof all === 'object') {
      const match = Object.values(all).find(r => r && cleanOrderIdString(r.orderId) === cleanId);
      if (match) return match;
    }
    return null;
  } catch (err) {
    console.warn('[ResellerReturnService] getResellerReturnRequestByOrder error:', err);
    return null;
  }
}

/**
 * VENDOR — REPORT RETURN / FAILED DELIVERY
 * 
 * Rules:
 * 1. Does NOT debit vendor lockedBalance or cancel profit immediately.
 * 2. Creates a Return Request with returnStatus = "PENDING_ADMIN_REVIEW".
 * 3. Saves returnRequestId, orderId, resellerId, vendorId, resellerProfit, orderStatus,
 *    returnStatus, reason, reportedBy, createdAt, updatedAt to RTDB.
 * 4. Duplicate protection: Prevents duplicate pending return requests.
 * 5. Protection: If profitStatus === "RELEASED", returns clear error that standard return report cannot pull back released profit.
 */
export async function vendorReportResellerOrderReturn(
  params: ReportReturnParams
): Promise<ReportReturnResult> {
  const { orderId, vendorId, reason, reportedBy } = params;

  if (!orderId) {
    return { success: false, error: 'MISSING_ORDER_ID', message: 'Order ID প্রদান করা আবশ্যক।' };
  }
  if (!vendorId) {
    return { success: false, error: 'MISSING_VENDOR_ID', message: 'Vendor ID প্রদান করা আবশ্যক।' };
  }
  if (!reason || !reason.trim()) {
    return { success: false, error: 'MISSING_REASON', message: 'রিটার্ন বা ডেলিভারি ফেইলিউরের কারণ উল্লেখ করা আবশ্যক।' };
  }

  const cleanOrderId = cleanOrderIdString(orderId);

  // 1. Fetch Order from RTDB
  let order = await rtdbGet<any>(`reseller_orders/${cleanOrderId}`);
  if (!order) order = await rtdbGet<any>(`orders/${cleanOrderId}`);
  if (!order) order = await rtdbGet<any>(`vendor_orders/${cleanOrderId}`);

  if (!order) {
    return {
      success: false,
      error: 'ORDER_NOT_FOUND',
      message: `অর্ডার #${cleanOrderId} খুঁজে পাওয়া যায়নি।`
    };
  }

  // Verify Vendor Ownership
  if (order.vendorId && order.vendorId !== vendorId) {
    return {
      success: false,
      error: 'UNAUTHORIZED_VENDOR',
      message: 'আপনি এই অর্ডারের অনুমোদিত ভেন্ডর নন।'
    };
  }

  // Released Profit Handling (Step 9: Post-Delivery Return / Reversal Request)
  if (order.profitStatus === 'RELEASED') {
    const revResult = await createProfitReversalRequest({
      orderId: cleanOrderId,
      reason: reason.trim(),
      requestedBy: reportedBy || 'Vendor',
      vendorId: order.vendorId || vendorId,
      resellerId: order.resellerId
    });

    if (!revResult.success) {
      return {
        success: false,
        error: revResult.error || 'PROFIT_REVERSAL_FAILED',
        message: revResult.message
      };
    }

    return {
      success: true,
      message: 'এই অর্ডারের প্রফিট ইতিমধ্যে রিলিজ থাকায় সরাসরি ব্যালেন্স না কেটে একটি "PROFIT_REVERSAL_REQUEST" তৈরি হয়েছে। অ্যাডমিন ভেরিফিকেশন সাপেক্ষে ব্যালেন্স সমন্বয় করা হবে।',
      returnRequest: revResult.reversalRequest as any
    };
  }

  // Already Cancelled Protection
  if (order.profitStatus === 'CANCELLED' || order.returnStatus === 'APPROVED') {
    return {
      success: false,
      error: 'ALREADY_CANCELLED',
      message: 'এই অর্ডারের প্রফিট ইতিমধ্যে বাতিল (CANCELLED) এবং ভেন্ডরের ব্যালেন্সে ফেরত দেওয়া হয়েছে।'
    };
  }

  // Check for existing pending return request
  const existingReq = await getResellerReturnRequestByOrder(cleanOrderId);
  if (existingReq) {
    if (existingReq.returnStatus === 'PENDING_ADMIN_REVIEW') {
      return {
        success: false,
        error: 'DUPLICATE_REQUEST_PREVENTED',
        message: 'এই অর্ডারের জন্য ইতিমধ্যে একটি রিটার্ন রিকুয়েস্ট অ্যাডমিন পর্যালোচনার জন্য জমা রয়েছে (PENDING_ADMIN_REVIEW)।',
        returnRequest: existingReq
      };
    }
    if (existingReq.returnStatus === 'APPROVED') {
      return {
        success: false,
        error: 'ALREADY_APPROVED',
        message: 'এই অর্ডারের রিটার্ন ইতিমধ্যে অনুমোদিত হয়েছে।',
        returnRequest: existingReq
      };
    }
  }

  const now = Date.now();
  const returnRequestId = `RET_REQ_${cleanOrderId}_${now}`;
  const resellerId = order.resellerId || 'unknown_reseller';
  const resellerProfit = Number(
    order.lockedProfitAmount ?? 
    order.resellerProfit ?? 
    order.priceSnapshot?.resellerProfit ?? 
    0
  );
  const currentOrderStatus = order.deliveryStatus || order.status || order.orderStatus || 'Failed Delivery';

  // Build the Return Request Record
  const returnRecord: ResellerReturnRequestRecord = {
    returnRequestId,
    orderId: cleanOrderId,
    resellerId,
    vendorId,
    resellerProfit,
    orderStatus: currentOrderStatus,
    returnStatus: 'PENDING_ADMIN_REVIEW',
    reason: reason.trim(),
    reportedBy: reportedBy || vendorId,
    createdAt: now,
    updatedAt: now,
    // Supplemental info for Admin verification
    courierName: order.courierName || '',
    trackingNumber: order.trackingNumber || order.consignmentId || order.trackingId || '',
    trackingUrl: order.approvedCourierTrackingUrl || order.trackingUrl || order.courierTrackingUrl || '',
    deliveryStatus: currentOrderStatus,
    productName: order.items?.[0]?.name || order.items?.[0]?.productName || order.productName || 'Product',
    quantity: order.items?.[0]?.quantity || 1,
    vendorShopName: order.shopName || order.vendorShopName || '',
    resellerName: order.resellerName || ''
  };

  // Safe Multi-Path Update: strictly preserves lockedBalance
  const updates: Record<string, any> = {};

  // 1. Primary return request records
  updates[`reseller_return_requests/${returnRequestId}`] = returnRecord;
  updates[`reseller_return_requests_by_order/${cleanOrderId}`] = returnRecord;

  // 2. Order flags: returnStatus becomes PENDING_ADMIN_REVIEW, profitStatus remains LOCKED!
  const orderFlags = {
    returnRequestId,
    returnStatus: 'PENDING_ADMIN_REVIEW',
    returnReportedAt: now,
    returnReportedBy: reportedBy || vendorId,
    returnReason: reason.trim(),
    // profitStatus strictly remains LOCKED until Admin approves
    updatedAt: now
  };

  updates[`reseller_orders/${cleanOrderId}/returnRequestId`] = returnRequestId;
  updates[`reseller_orders/${cleanOrderId}/returnStatus`] = 'PENDING_ADMIN_REVIEW';
  updates[`reseller_orders/${cleanOrderId}/returnReportedAt`] = now;
  updates[`reseller_orders/${cleanOrderId}/returnReason`] = reason.trim();
  updates[`reseller_orders/${cleanOrderId}/updatedAt`] = now;

  updates[`orders/${cleanOrderId}/returnRequestId`] = returnRequestId;
  updates[`orders/${cleanOrderId}/returnStatus`] = 'PENDING_ADMIN_REVIEW';
  updates[`orders/${cleanOrderId}/returnReportedAt`] = now;
  updates[`orders/${cleanOrderId}/returnReason`] = reason.trim();
  updates[`orders/${cleanOrderId}/updatedAt`] = now;

  updates[`vendor_orders/${cleanOrderId}/returnRequestId`] = returnRequestId;
  updates[`vendor_orders/${cleanOrderId}/returnStatus`] = 'PENDING_ADMIN_REVIEW';
  updates[`vendor_orders/${cleanOrderId}/returnReportedAt`] = now;
  updates[`vendor_orders/${cleanOrderId}/returnReason`] = reason.trim();
  updates[`vendor_orders/${cleanOrderId}/updatedAt`] = now;

  if (resellerId && resellerId !== 'unknown_reseller') {
    updates[`resellers/${resellerId}/orders/${cleanOrderId}/returnRequestId`] = returnRequestId;
    updates[`resellers/${resellerId}/orders/${cleanOrderId}/returnStatus`] = 'PENDING_ADMIN_REVIEW';
    updates[`resellers/${resellerId}/orders/${cleanOrderId}/returnReportedAt`] = now;
    updates[`resellers/${resellerId}/orders/${cleanOrderId}/returnReason`] = reason.trim();
    updates[`resellers/${resellerId}/orders/${cleanOrderId}/updatedAt`] = now;
  }

  await rtdbMultiUpdate(updates);

  // Push audit log
  try {
    await rtdbPush('order_status_logs', {
      orderId: cleanOrderId,
      vendorId,
      resellerId,
      event: 'RETURN_REPORTED_BY_VENDOR',
      returnRequestId,
      returnStatus: 'PENDING_ADMIN_REVIEW',
      reason: reason.trim(),
      timestamp: now,
      note: `Vendor reported return / failed delivery for Order #${cleanOrderId}. Pending Admin verification.`
    });
  } catch (logErr) {
    console.warn('[ResellerReturnService] audit log error:', logErr);
  }

  return {
    success: true,
    message: 'পণ্য রিটার্ন বা ডেলিভারি ফেইলিউরের রিপোর্ট সফলভাবে জমা দেওয়া হয়েছে। অ্যাডমিন ভেরিফিকেশনের পর তা অনুমোদিত হবে।',
    returnRequestId,
    returnRequest: returnRecord
  };
}

/**
 * ADMIN APPROVE RETURN / FAILED DELIVERY
 * 
 * Rules:
 * 1. Double Processing Prevention: If returnStatus === "APPROVED", do not change balances again.
 * 2. Released profit protection: If profitStatus === "RELEASED", cannot use this flow.
 * 3. In a single atomic multi-path update across RTDB:
 *    a. Vendor lockedBalance decreases by resellerProfitAmount.
 *    b. Vendor availableBalance increases by resellerProfitAmount. (Locked -> Available)
 *    c. Vendor totalBalance remains unchanged.
 *    d. Reseller pendingProfit decreases by resellerProfitAmount.
 *    e. Reseller cancelledProfit increases by resellerProfitAmount.
 *    f. Order profitStatus: "CANCELLED".
 *    g. Return status: "APPROVED".
 *    h. Unique transaction record created: transactionType = "RESELLER_PROFIT_RETURN".
 */
export async function adminApproveResellerReturn(
  params: AdminApproveReturnParams
): Promise<{ success: boolean; message: string; transactionId?: string; error?: string }> {
  const { orderId, adminId, adminEmail, adminName, adminNote } = params;

  if (!orderId) {
    return { success: false, error: 'MISSING_ORDER_ID', message: 'Order ID প্রদান করা আবশ্যক।' };
  }

  const cleanOrderId = cleanOrderIdString(orderId);

  // 1. Double Processing & Idempotency Protection
  const idempCheck = await checkFinancialIdempotency(cleanOrderId, 'RESELLER_PROFIT_RETURN');
  if (idempCheck.isDuplicate) {
    return {
      success: false,
      error: 'ALREADY_RETURNED',
      message: idempCheck.message || `অর্ডার #${cleanOrderId}-এর রিটার্ন ইতিমধ্যে সম্পন্ন হয়েছে। ব্যালেন্স পুনরায় পরিবর্তন করা যাবে না।`
    };
  }

  const returnReq = await getResellerReturnRequestByOrder(cleanOrderId);
  if (!returnReq) {
    return {
      success: false,
      error: 'RETURN_REQUEST_NOT_FOUND',
      message: `অর্ডার #${cleanOrderId}-এর জন্য কোনো রিটার্ন রিকুয়েস্ট পাওয়া যায়নি।`
    };
  }

  // Duplicate Approval Protection
  if (returnReq.returnStatus === 'APPROVED') {
    return {
      success: false,
      error: 'ALREADY_APPROVED',
      message: `অর্ডার #${cleanOrderId}-এর রিটার্ন রিকুয়েস্ট ইতিমধ্যে অনুমোদিত হয়েছে। ব্যালেন্স পুনরায় পরিবর্তন করা যাবে না।`
    };
  }

  // 2. Fetch Order from RTDB
  let order = await rtdbGet<any>(`reseller_orders/${cleanOrderId}`);
  if (!order) order = await rtdbGet<any>(`orders/${cleanOrderId}`);
  if (!order) order = await rtdbGet<any>(`vendor_orders/${cleanOrderId}`);

  if (!order) {
    return {
      success: false,
      error: 'ORDER_NOT_FOUND',
      message: `অর্ডার #${cleanOrderId} Realtime Database-এ পাওয়া যায়নি।`
    };
  }

  // Released Profit Protection
  if (order.profitStatus === 'RELEASED') {
    return {
      success: false,
      error: 'PROFIT_ALREADY_RELEASED',
      message: 'এই অর্ডারের প্রফিট ইতিমধ্যে রিলিজড (RELEASED) হয়ে গেছে। এটি রিটার্ন হিসেবে প্রসেস করা সম্ভব নয়; এর জন্য রিভার্সাল ভেরিফিকেশন প্রযোজ্য।'
    };
  }

  // State Transition Validation: LOCKED -> CANCELLED
  const stateCheck = validateOrderStateTransition(order.profitStatus || 'LOCKED', 'CANCELLED');
  if (!stateCheck.isValid) {
    return {
      success: false,
      error: 'INVALID_STATE_TRANSITION',
      message: stateCheck.error || `এই অর্ডারের প্রফিট স্ট্যাটাস ইতিমধ্যে বাতিল (CANCELLED) বা পরিবর্তিত।`
    };
  }

  const resellerId = returnReq.resellerId || order.resellerId;
  const vendorId = returnReq.vendorId || order.vendorId;

  if (!resellerId || !vendorId) {
    return {
      success: false,
      error: 'MISSING_PARTIES',
      message: 'রিসেলার অথবা ভেন্ডরের আইডি পাওয়া যায়নি।'
    };
  }

  // 3. Never Trust Client-Side Amount: Immutable recalculation
  const profitVerification = verifyAndRecalculateResellerProfit(order);
  const resellerProfitAmount = profitVerification.verifiedProfit;

  const now = Date.now();
  const adminIdentifier = adminEmail || adminName || adminId || 'Admin';
  const transactionId = `TXN_RET_${cleanOrderId}_${now}`;

  // 3. Read Vendor Wallet from RTDB
  const vendorWallet = (await rtdbGet<any>(`vendor_wallet/${vendorId}`)) || {};
  const currentVendorAvail = Number(vendorWallet.availableBalance ?? vendorWallet.balance ?? 0);
  const currentVendorLocked = Number(vendorWallet.lockedBalance ?? vendorWallet.resellerProfitReserve ?? 0);
  const currentVendorTotal = Number(vendorWallet.totalBalance ?? (currentVendorAvail + currentVendorLocked));

  // Vendor Balance Transitions:
  // 1. lockedBalance decreases by resellerProfitAmount
  const newVendorLocked = Math.max(0, Math.round((currentVendorLocked - resellerProfitAmount) * 100) / 100);
  // 2. availableBalance increases by resellerProfitAmount (Locked -> Available)
  const newVendorAvail = Math.round((currentVendorAvail + resellerProfitAmount) * 100) / 100;
  // 3. totalBalance remains completely unchanged!
  const newVendorTotal = currentVendorTotal;

  // 4. Read Reseller Wallet from RTDB
  const resellerWallet = (await rtdbGet<any>(`reseller_wallet/${resellerId}`)) || {};
  const currentResellerAvail = Number(resellerWallet.availableBalance ?? resellerWallet.walletBalance ?? 0);
  const currentResellerLocked = Number(resellerWallet.lockedBalance ?? resellerWallet.heldBalance ?? 0);
  const currentResellerPending = Number(resellerWallet.pendingProfit ?? resellerWallet.pendingCommission ?? 0);
  const currentResellerCancelled = Number(resellerWallet.cancelledProfit ?? 0);

  // Reseller Balance Transitions:
  // 4. pendingProfit decreases by resellerProfitAmount
  const newResellerPending = Math.max(0, Math.round((currentResellerPending - resellerProfitAmount) * 100) / 100);
  // 5. cancelledProfit increases by resellerProfitAmount
  const newResellerCancelled = Math.round((currentResellerCancelled + resellerProfitAmount) * 100) / 100;
  // Available balance is untouched (it was never released yet)
  const newResellerAvail = currentResellerAvail;
  const newResellerTotal = Math.round((newResellerAvail + currentResellerLocked) * 100) / 100;

  // 5. Unique Transaction Record
  // transactionType = "RESELLER_PROFIT_RETURN"
  const returnTxRecord = {
    transactionId,
    transactionType: 'RESELLER_PROFIT_RETURN',
    orderId: cleanOrderId,
    resellerId,
    vendorId,
    amount: resellerProfitAmount,
    type: 'RESELLER_PROFIT_RETURN',
    status: 'APPROVED',
    reason: returnReq.reason || 'Product Return / Delivery Failed',
    adminNote: adminNote || '',
    approvedBy: adminIdentifier,
    createdAt: now,
    updatedAt: now
  };

  // 6. Build Atomic Multi-Path RTDB Updates
  const updates: Record<string, any> = {};

  // a. Vendor Wallet updates
  updates[`vendor_wallet/${vendorId}/lockedBalance`] = newVendorLocked;
  updates[`vendor_wallet/${vendorId}/resellerProfitReserve`] = newVendorLocked;
  updates[`vendor_wallet/${vendorId}/availableBalance`] = newVendorAvail;
  updates[`vendor_wallet/${vendorId}/balance`] = newVendorAvail;
  updates[`vendor_wallet/${vendorId}/totalBalance`] = newVendorTotal;
  updates[`vendor_wallet/${vendorId}/updatedAt`] = now;

  // b. Reseller Wallet updates
  updates[`reseller_wallet/${resellerId}/pendingProfit`] = newResellerPending;
  updates[`reseller_wallet/${resellerId}/pendingCommission`] = newResellerPending;
  updates[`reseller_wallet/${resellerId}/cancelledProfit`] = newResellerCancelled;
  updates[`reseller_wallet/${resellerId}/totalBalance`] = newResellerTotal;
  updates[`reseller_wallet/${resellerId}/updatedAt`] = now;

  // c. Return Request updates
  const reqId = returnReq.returnRequestId;
  updates[`reseller_return_requests/${reqId}/returnStatus`] = 'APPROVED';
  updates[`reseller_return_requests/${reqId}/processedBy`] = adminIdentifier;
  updates[`reseller_return_requests/${reqId}/processedAt`] = now;
  updates[`reseller_return_requests/${reqId}/transactionId`] = transactionId;
  updates[`reseller_return_requests/${reqId}/adminNote`] = adminNote || '';
  updates[`reseller_return_requests/${reqId}/updatedAt`] = now;

  updates[`reseller_return_requests_by_order/${cleanOrderId}/returnStatus`] = 'APPROVED';
  updates[`reseller_return_requests_by_order/${cleanOrderId}/processedBy`] = adminIdentifier;
  updates[`reseller_return_requests_by_order/${cleanOrderId}/processedAt`] = now;
  updates[`reseller_return_requests_by_order/${cleanOrderId}/transactionId`] = transactionId;
  updates[`reseller_return_requests_by_order/${cleanOrderId}/adminNote`] = adminNote || '';
  updates[`reseller_return_requests_by_order/${cleanOrderId}/updatedAt`] = now;

  // d. Order profitStatus: "CANCELLED" & returnStatus: "APPROVED"
  updates[`reseller_orders/${cleanOrderId}/profitStatus`] = 'CANCELLED';
  updates[`reseller_orders/${cleanOrderId}/returnStatus`] = 'APPROVED';
  updates[`reseller_orders/${cleanOrderId}/returnApprovedAt`] = now;
  updates[`reseller_orders/${cleanOrderId}/returnProcessedBy`] = adminIdentifier;
  updates[`reseller_orders/${cleanOrderId}/returnTransactionId`] = transactionId;
  updates[`reseller_orders/${cleanOrderId}/updatedAt`] = now;

  updates[`orders/${cleanOrderId}/profitStatus`] = 'CANCELLED';
  updates[`orders/${cleanOrderId}/returnStatus`] = 'APPROVED';
  updates[`orders/${cleanOrderId}/returnApprovedAt`] = now;
  updates[`orders/${cleanOrderId}/returnProcessedBy`] = adminIdentifier;
  updates[`orders/${cleanOrderId}/returnTransactionId`] = transactionId;
  updates[`orders/${cleanOrderId}/updatedAt`] = now;

  updates[`vendor_orders/${cleanOrderId}/profitStatus`] = 'CANCELLED';
  updates[`vendor_orders/${cleanOrderId}/returnStatus`] = 'APPROVED';
  updates[`vendor_orders/${cleanOrderId}/returnApprovedAt`] = now;
  updates[`vendor_orders/${cleanOrderId}/returnProcessedBy`] = adminIdentifier;
  updates[`vendor_orders/${cleanOrderId}/returnTransactionId`] = transactionId;
  updates[`vendor_orders/${cleanOrderId}/updatedAt`] = now;

  updates[`resellers/${resellerId}/orders/${cleanOrderId}/profitStatus`] = 'CANCELLED';
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/returnStatus`] = 'APPROVED';
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/returnApprovedAt`] = now;
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/returnTransactionId`] = transactionId;
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/updatedAt`] = now;

  // e. Return Transaction Record in Ledger
  updates[`reseller_return_transactions/${transactionId}`] = returnTxRecord;
  updates[`reseller_wallet_transactions/${transactionId}`] = {
    transactionId,
    userId: resellerId,
    resellerId,
    vendorId,
    orderId: cleanOrderId,
    amount: resellerProfitAmount,
    type: 'RESELLER_PROFIT_RETURN',
    status: 'COMPLETED',
    description: `Order #${cleanOrderId} Returned/Delivery Failed. Profit cancelled and vendor lockedBalance refunded to availableBalance.`,
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

  // Vendor Wallet Transaction Record for audit
  updates[`vendor_wallet_transactions/${transactionId}`] = {
    transactionId,
    vendorId,
    orderId: cleanOrderId,
    resellerId,
    amount: resellerProfitAmount,
    type: 'RESELLER_LOCKED_REFUND',
    description: `Locked profit refunded to availableBalance due to return of Order #${cleanOrderId}`,
    balanceBefore: {
      availableBalance: currentVendorAvail,
      lockedBalance: currentVendorLocked,
      totalBalance: currentVendorTotal
    },
    balanceAfter: {
      availableBalance: newVendorAvail,
      lockedBalance: newVendorLocked,
      totalBalance: newVendorTotal
    },
    createdAt: now
  };

  // Perform Atomic Update
  await rtdbMultiUpdate(updates);

  // Record financial idempotency
  await recordFinancialIdempotency(cleanOrderId, 'RESELLER_PROFIT_RETURN', {
    transactionId,
    vendorId,
    resellerId,
    amount: resellerProfitAmount,
    executedBy: adminIdentifier,
    details: `Return approved by admin ${adminIdentifier}`
  });

  // Push Audit Log
  try {
    await rtdbPush('order_status_logs', {
      orderId: cleanOrderId,
      resellerId,
      vendorId,
      event: 'RESELLER_RETURN_APPROVED',
      transactionId,
      resellerProfitAmount,
      approvedBy: adminIdentifier,
      timestamp: now,
      note: `Admin approved Return for Order #${cleanOrderId}. Vendor lockedBalance (৳${resellerProfitAmount}) refunded to availableBalance. Reseller pending profit cancelled.`
    });
  } catch (logErr) {
    console.warn('[ResellerReturnService] audit log error:', logErr);
  }

  return {
    success: true,
    message: `অর্ডার #${cleanOrderId}-এর রিটার্ন সফলভাবে অনুমোদিত হয়েছে। ভেন্ডরের লকড ব্যালেন্স (৳${resellerProfitAmount}) অ্যাভেইলেবল ব্যালেন্সে ফেরত গেছে এবং রিসেলারের পেন্ডিং প্রফিট বাতিল করা হয়েছে।`,
    transactionId
  };
}

/**
 * ADMIN REJECT RETURN / FAILED DELIVERY CLAIM
 * 
 * Rules:
 * 1. returnStatus = "REJECTED".
 * 2. Vendor lockedBalance is UNCHANGED.
 * 3. Reseller pendingProfit is UNCHANGED.
 * 4. Profit remains in normal LOCKED status.
 */
export async function adminRejectResellerReturn(
  params: AdminRejectReturnParams
): Promise<{ success: boolean; message: string; error?: string }> {
  const { orderId, rejectionReason, adminId, adminEmail, adminName } = params;

  if (!orderId) {
    return { success: false, error: 'MISSING_ORDER_ID', message: 'Order ID প্রদান করা আবশ্যক।' };
  }
  if (!rejectionReason || !rejectionReason.trim()) {
    return { success: false, error: 'MISSING_REASON', message: 'রিজেক্ট করার কারণ উল্লেখ করা আবশ্যক।' };
  }

  const cleanOrderId = cleanOrderIdString(orderId);

  // 1. Fetch Return Request
  const returnReq = await getResellerReturnRequestByOrder(cleanOrderId);
  if (!returnReq) {
    return {
      success: false,
      error: 'RETURN_REQUEST_NOT_FOUND',
      message: `অর্ডার #${cleanOrderId}-এর জন্য কোনো রিটার্ন রিকুয়েস্ট পাওয়া যায়নি।`
    };
  }

  if (returnReq.returnStatus === 'APPROVED') {
    return {
      success: false,
      error: 'ALREADY_APPROVED',
      message: 'ইতিমধ্যে অনুমোদিত রিটার্ন রিজেক্ট করা যাবে না।'
    };
  }

  const now = Date.now();
  const adminIdentifier = adminEmail || adminName || adminId || 'Admin';
  const reqId = returnReq.returnRequestId;
  const resellerId = returnReq.resellerId;

  // 2. Build Safe RTDB Updates
  const updates: Record<string, any> = {};

  // Update Return Request status
  updates[`reseller_return_requests/${reqId}/returnStatus`] = 'REJECTED';
  updates[`reseller_return_requests/${reqId}/rejectionReason`] = rejectionReason.trim();
  updates[`reseller_return_requests/${reqId}/rejectedBy`] = adminIdentifier;
  updates[`reseller_return_requests/${reqId}/rejectedAt`] = now;
  updates[`reseller_return_requests/${reqId}/updatedAt`] = now;

  updates[`reseller_return_requests_by_order/${cleanOrderId}/returnStatus`] = 'REJECTED';
  updates[`reseller_return_requests_by_order/${cleanOrderId}/rejectionReason`] = rejectionReason.trim();
  updates[`reseller_return_requests_by_order/${cleanOrderId}/rejectedBy`] = adminIdentifier;
  updates[`reseller_return_requests_by_order/${cleanOrderId}/rejectedAt`] = now;
  updates[`reseller_return_requests_by_order/${cleanOrderId}/updatedAt`] = now;

  // Order flags: returnStatus = "REJECTED", profitStatus strictly remains "LOCKED"!
  updates[`reseller_orders/${cleanOrderId}/returnStatus`] = 'REJECTED';
  updates[`reseller_orders/${cleanOrderId}/returnRejectionReason`] = rejectionReason.trim();
  updates[`reseller_orders/${cleanOrderId}/returnRejectedAt`] = now;
  updates[`reseller_orders/${cleanOrderId}/returnRejectedBy`] = adminIdentifier;
  updates[`reseller_orders/${cleanOrderId}/profitStatus`] = 'LOCKED';
  updates[`reseller_orders/${cleanOrderId}/updatedAt`] = now;

  updates[`orders/${cleanOrderId}/returnStatus`] = 'REJECTED';
  updates[`orders/${cleanOrderId}/returnRejectionReason`] = rejectionReason.trim();
  updates[`orders/${cleanOrderId}/returnRejectedAt`] = now;
  updates[`orders/${cleanOrderId}/returnRejectedBy`] = adminIdentifier;
  updates[`orders/${cleanOrderId}/profitStatus`] = 'LOCKED';
  updates[`orders/${cleanOrderId}/updatedAt`] = now;

  updates[`vendor_orders/${cleanOrderId}/returnStatus`] = 'REJECTED';
  updates[`vendor_orders/${cleanOrderId}/returnRejectionReason`] = rejectionReason.trim();
  updates[`vendor_orders/${cleanOrderId}/returnRejectedAt`] = now;
  updates[`vendor_orders/${cleanOrderId}/returnRejectedBy`] = adminIdentifier;
  updates[`vendor_orders/${cleanOrderId}/profitStatus`] = 'LOCKED';
  updates[`vendor_orders/${cleanOrderId}/updatedAt`] = now;

  if (resellerId && resellerId !== 'unknown_reseller') {
    updates[`resellers/${resellerId}/orders/${cleanOrderId}/returnStatus`] = 'REJECTED';
    updates[`resellers/${resellerId}/orders/${cleanOrderId}/returnRejectionReason`] = rejectionReason.trim();
    updates[`resellers/${resellerId}/orders/${cleanOrderId}/returnRejectedAt`] = now;
    updates[`resellers/${resellerId}/orders/${cleanOrderId}/returnRejectedBy`] = adminIdentifier;
    updates[`resellers/${resellerId}/orders/${cleanOrderId}/profitStatus`] = 'LOCKED';
    updates[`resellers/${resellerId}/orders/${cleanOrderId}/updatedAt`] = now;
  }

  await rtdbMultiUpdate(updates);

  // Push audit log
  try {
    await rtdbPush('order_status_logs', {
      orderId: cleanOrderId,
      event: 'RESELLER_RETURN_REJECTED',
      rejectionReason: rejectionReason.trim(),
      rejectedBy: adminIdentifier,
      profitStatus: 'LOCKED',
      timestamp: now,
      note: `Admin rejected Return claim for Order #${cleanOrderId}. Profit remains LOCKED. Reason: ${rejectionReason}`
    });
  } catch (logErr) {
    console.warn('[ResellerReturnService] audit log error:', logErr);
  }

  return {
    success: true,
    message: `অর্ডার #${cleanOrderId}-এর রিটার্ন ক্লেইম রিজেক্ট করা হয়েছে। প্রফিট স্বাভাবিক LOCKED অবস্থায় রয়েছে।`
  };
}

/**
 * Fetches all Reseller Return Requests from RTDB
 */
export async function fetchAllResellerReturnRequests(): Promise<ResellerReturnRequestRecord[]> {
  try {
    const raw = await rtdbGet<Record<string, ResellerReturnRequestRecord>>('reseller_return_requests');
    if (!raw || typeof raw !== 'object') return [];

    const items: ResellerReturnRequestRecord[] = Object.values(raw).filter(Boolean);
    return items.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.warn('[ResellerReturnService] fetchAllResellerReturnRequests error:', err);
    return [];
  }
}

/**
 * Subscribes to Reseller Return Requests in real-time
 */
export function subscribeToResellerReturnRequests(
  callback: (requests: ResellerReturnRequestRecord[], pendingCount: number) => void
): () => void {
  const unsub = rtdbSubscribe('reseller_return_requests', async () => {
    try {
      const items = await fetchAllResellerReturnRequests();
      const pendingCount = items.filter(r => r.returnStatus === 'PENDING_ADMIN_REVIEW').length;
      callback(items, pendingCount);
    } catch (e) {
      console.warn('subscribeToResellerReturnRequests error:', e);
    }
  });

  // Fetch immediately
  fetchAllResellerReturnRequests().then(items => {
    const pendingCount = items.filter(r => r.returnStatus === 'PENDING_ADMIN_REVIEW').length;
    callback(items, pendingCount);
  }).catch(() => {});

  return unsub;
}
