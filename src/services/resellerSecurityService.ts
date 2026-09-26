/**
 * Reseller Security, State Validation, Duplicate Protection & Consistency Service
 * STEP 10/10
 *
 * Exclusively uses Firebase Realtime Database (RTDB). Zero Firestore.
 */

import { rtdbGet, rtdbSet, rtdbPush } from '../lib/rtdb';

export type ResellerFinancialTransactionType =
  | 'RESELLER_PROFIT_LOCK'
  | 'RESELLER_PROFIT_RELEASE'
  | 'RESELLER_PROFIT_RETURN'
  | 'RESELLER_ORDER_CANCELLATION'
  | 'RESELLER_PROFIT_REVERSAL'
  | 'VENDOR_WALLET_DEPOSIT';

export interface ResellerProfitVerificationResult {
  verifiedProfit: number;
  calculatedFromSnapshot: number;
  storedProfit: number;
  isTampered: boolean;
  vendorPrice: number;
  resellerSellingPrice: number;
  quantity: number;
  lineItemsCount: number;
}

export interface StateTransitionResult {
  isValid: boolean;
  currentStatus: string;
  targetStatus: string;
  error?: string;
}

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  transactionId?: string;
  existingRecord?: any;
  message?: string;
}

/**
 * Valid state machine transitions for Reseller Order Profit Lifecycle
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  // PENDING can transition to LOCKED (vendor confirm) or CANCELLED (cancel before confirm)
  PENDING: ['LOCKED', 'CANCELLED'],
  // LOCKED can transition to RELEASED (admin review approve) or CANCELLED (admin return approve / cancel)
  LOCKED: ['RELEASED', 'CANCELLED'],
  // RELEASED can transition to REVERSED (admin profit reversal) or REVERSAL_PENDING (shortfall)
  RELEASED: ['REVERSED', 'REVERSAL_PENDING'],
  // REVERSAL_PENDING can transition to REVERSED once shortfall is settled
  REVERSAL_PENDING: ['REVERSED'],
  // Terminal states cannot transition to anything
  CANCELLED: [],
  REVERSED: []
};

/**
 * Validates state machine transition.
 * Prevents invalid state jumps and prevents re-executing settled transitions.
 */
export function validateOrderStateTransition(
  currentProfitStatus: string = 'PENDING',
  targetProfitStatus: string
): StateTransitionResult {
  const current = String(currentProfitStatus || 'PENDING').toUpperCase();
  const target = String(targetProfitStatus || '').toUpperCase();

  // If already at the target status, it's considered already processed/duplicate
  if (current === target) {
    return {
      isValid: false,
      currentStatus: current,
      targetStatus: target,
      error: `অর্ডারটি ইতিমধ্যে "${current}" অবস্থায় রয়েছে। একই স্ট্যাটাস ট্রানজিশন পুনরায় প্রযোজ্য নয়।`
    };
  }

  const allowedTargets = VALID_TRANSITIONS[current] || [];
  if (!allowedTargets.includes(target)) {
    return {
      isValid: false,
      currentStatus: current,
      targetStatus: target,
      error: `অবৈধ স্টেট ট্রানজিশন: "${current}" থেকে "${target}" অনুমোদিত নয়।`
    };
  }

  return {
    isValid: true,
    currentStatus: current,
    targetStatus: target
  };
}

/**
 * Never Trust Client-Side Profit Amount:
 * Recalculates and verifies reseller profit strictly from immutable stored price snapshot
 * Formula: Reseller Profit = (Reseller Selling Price - Vendor Price) * Quantity
 */
export function verifyAndRecalculateResellerProfit(order: any): ResellerProfitVerificationResult {
  if (!order) {
    return {
      verifiedProfit: 0,
      calculatedFromSnapshot: 0,
      storedProfit: 0,
      isTampered: false,
      vendorPrice: 0,
      resellerSellingPrice: 0,
      quantity: 0,
      lineItemsCount: 0
    };
  }

  const snapshot = order.priceSnapshot || order.resellerPriceSnapshot || {};
  const storedProfit = Number(
    order.lockedProfitAmount ??
    order.resellerProfit ??
    snapshot.resellerProfit ??
    0
  );

  let calculatedProfit = 0;
  let lineItemsCount = 0;
  let primaryVendorPrice = 0;
  let primarySellingPrice = 0;
  let primaryQuantity = 0;

  // 1. If line items snapshot exists, sum each item's profit
  const items = (snapshot.items && Array.isArray(snapshot.items) && snapshot.items.length > 0)
    ? snapshot.items
    : (order.items && Array.isArray(order.items) && order.items.length > 0)
    ? order.items
    : null;

  if (items && items.length > 0) {
    lineItemsCount = items.length;
    for (const it of items) {
      let lineProfit = 0;
      const qty = Math.max(1, Number(it.quantity ?? 1));
      if (it.resellerItemProfit !== undefined || it.resellerProfit !== undefined) {
        lineProfit = Math.max(0, Number(it.resellerItemProfit ?? it.resellerProfit ?? 0) * qty);
      } else {
        const vp = Math.max(0, Number(it.vendorPrice ?? it.wholesalePrice ?? it.adminPrice ?? it.costPrice ?? 0));
        const sp = Math.max(vp, Number(it.resellerSellingPrice ?? it.customerPrice ?? it.price ?? vp));
        lineProfit = Math.max(0, (sp - vp) * qty);
      }
      calculatedProfit += lineProfit;
    }
    const first = items[0];
    primaryVendorPrice = Number(first.vendorPrice ?? first.wholesalePrice ?? 0);
    primarySellingPrice = Number(first.resellerSellingPrice ?? first.customerPrice ?? first.price ?? 0);
    primaryQuantity = Number(first.quantity ?? 1);
  } else {
    // 2. Fall back to top-level immutable snapshot fields
    primaryVendorPrice = Math.max(0, Number(snapshot.vendorPrice ?? order.vendorPrice ?? 0));
    primarySellingPrice = Math.max(primaryVendorPrice, Number(snapshot.resellerSellingPrice ?? order.resellerSellingPrice ?? primaryVendorPrice));
    primaryQuantity = Math.max(1, Number(snapshot.quantity ?? order.quantity ?? 1));
    calculatedProfit = Math.max(0, (primarySellingPrice - primaryVendorPrice) * primaryQuantity);
    lineItemsCount = 1;
  }

  calculatedProfit = Math.round(calculatedProfit * 100) / 100;
  const safeStored = Math.round(storedProfit * 100) / 100;

  // If stored profit exists and matches calculated (or calculated is positive)
  const verifiedProfit = calculatedProfit > 0 ? calculatedProfit : safeStored;
  const isTampered = Math.abs(calculatedProfit - safeStored) > 0.05 && safeStored > 0 && calculatedProfit > 0;

  return {
    verifiedProfit,
    calculatedFromSnapshot: calculatedProfit,
    storedProfit: safeStored,
    isTampered,
    vendorPrice: primaryVendorPrice,
    resellerSellingPrice: primarySellingPrice,
    quantity: primaryQuantity,
    lineItemsCount
  };
}

/**
 * Checks idempotency for a financial operation based on orderId + transactionType.
 * Prevents double profit lock, double release, double return, double cancellation.
 */
export async function checkFinancialIdempotency(
  orderId: string,
  transactionType: ResellerFinancialTransactionType
): Promise<IdempotencyCheckResult> {
  if (!orderId || !transactionType) {
    return { isDuplicate: false };
  }

  const cleanOrderId = String(orderId).replace(/^#/, '').trim();
  const idempotencyKey = `${cleanOrderId}_${transactionType}`;

  try {
    const existing = await rtdbGet<any>(`reseller_financial_idempotency/${idempotencyKey}`);
    if (existing && existing.status === 'COMPLETED') {
      return {
        isDuplicate: true,
        transactionId: existing.transactionId,
        existingRecord: existing,
        message: `অর্ডার #${cleanOrderId}-এর জন্য "${transactionType}" ইতিমধ্যে সফলভাবে সম্পন্ন হয়েছে। ডুপ্লিকেট ব্যালেন্স পরিবর্তন প্রতিরোধ করা হয়েছে।`
      };
    }
  } catch (err) {
    console.warn('[ResellerSecurityService] Idempotency check warning:', err);
  }

  return { isDuplicate: false };
}

/**
 * Records an idempotency entry in RTDB to seal the operation.
 */
export async function recordFinancialIdempotency(
  orderId: string,
  transactionType: ResellerFinancialTransactionType,
  data: {
    transactionId: string;
    vendorId?: string;
    resellerId?: string;
    amount: number;
    executedBy?: string;
    details?: string;
  }
): Promise<void> {
  const cleanOrderId = String(orderId).replace(/^#/, '').trim();
  const idempotencyKey = `${cleanOrderId}_${transactionType}`;
  const now = Date.now();

  try {
    await rtdbSet(`reseller_financial_idempotency/${idempotencyKey}`, {
      idempotencyKey,
      orderId: cleanOrderId,
      transactionType,
      transactionId: data.transactionId,
      vendorId: data.vendorId || '',
      resellerId: data.resellerId || '',
      amount: data.amount,
      status: 'COMPLETED',
      executedBy: data.executedBy || 'system',
      details: data.details || '',
      createdAt: now,
      timestamp: now
    });
  } catch (err) {
    console.warn('[ResellerSecurityService] Error recording idempotency in RTDB:', err);
  }
}

/**
 * Ensures mathematical balance consistency and enforces non-negative bounds
 * Formula:
 * Vendor totalBalance = availableBalance + lockedBalance
 * Both availableBalance >= 0 and lockedBalance >= 0
 */
export function ensureVendorBalanceConsistency(current: {
  availableBalance?: number;
  lockedBalance?: number;
  totalBalance?: number;
}): {
  availableBalance: number;
  lockedBalance: number;
  totalBalance: number;
} {
  const available = Math.max(0, Math.round(Number(current.availableBalance || 0) * 100) / 100);
  const locked = Math.max(0, Math.round(Number(current.lockedBalance || 0) * 100) / 100);
  const total = Math.round((available + locked) * 100) / 100;

  return {
    availableBalance: available,
    lockedBalance: locked,
    totalBalance: total
  };
}

/**
 * Ensures Reseller Wallet Balance consistency and non-negative bounds
 */
export function ensureResellerBalanceConsistency(current: {
  availableBalance?: number;
  lockedBalance?: number;
  totalBalance?: number;
  pendingProfit?: number;
  releasedProfit?: number;
  cancelledProfit?: number;
}): {
  availableBalance: number;
  lockedBalance: number;
  totalBalance: number;
  pendingProfit: number;
  releasedProfit: number;
  cancelledProfit: number;
} {
  const available = Math.max(0, Math.round(Number(current.availableBalance || 0) * 100) / 100);
  const locked = Math.max(0, Math.round(Number(current.lockedBalance || 0) * 100) / 100);
  const total = Math.round((available + locked) * 100) / 100;
  const pending = Math.max(0, Math.round(Number(current.pendingProfit || 0) * 100) / 100);
  const released = Math.max(0, Math.round(Number(current.releasedProfit || 0) * 100) / 100);
  const cancelled = Math.max(0, Math.round(Number(current.cancelledProfit || 0) * 100) / 100);

  return {
    availableBalance: available,
    lockedBalance: locked,
    totalBalance: total,
    pendingProfit: pending,
    releasedProfit: released,
    cancelledProfit: cancelled
  };
}

/**
 * Validates user role and account identity before executing financial operations
 */
export function validateUserRoleAccess(
  user: any,
  requiredRole: 'reseller' | 'vendor' | 'admin',
  context?: { vendorId?: string; resellerId?: string }
): { allowed: boolean; reason?: string } {
  if (!user) {
    return { allowed: false, reason: 'ব্যবহারকারী লগইন অবস্থায় নেই।' };
  }

  const role = String(user.role || user.accountType || '').toLowerCase();
  const isAdmin = role === 'admin' || user.isAdmin === true;

  if (requiredRole === 'admin') {
    if (!isAdmin) {
      return { allowed: false, reason: 'শুধুমাত্র অ্যাডমিন এই আর্থিক সেটেলমেন্ট অপারেশন সম্পন্ন করতে পারেন।' };
    }
    return { allowed: true };
  }

  // Admins can perform vendor/reseller operations on their behalf if needed
  if (isAdmin) {
    return { allowed: true };
  }

  if (requiredRole === 'vendor') {
    const isVendor = role === 'vendor' || Boolean(user.vendorId) || user.isVendor === true;
    if (!isVendor) {
      return { allowed: false, reason: 'শুধুমাত্র অনুমোদিত ভেন্ডর এই অপারেশনটি সম্পন্ন করতে পারেন।' };
    }
    if (context?.vendorId && user.uid !== context.vendorId && user.vendorId !== context.vendorId) {
      return { allowed: false, reason: 'অন্য ভেন্ডরের ওয়ালেট বা অর্ডার পরিবর্তন করার অনুমতি নেই।' };
    }
    return { allowed: true };
  }

  if (requiredRole === 'reseller') {
    const isReseller = role === 'reseller' || user.accountType === 'reseller' || Boolean(user.resellerId);
    if (!isReseller) {
      return { allowed: false, reason: 'শুধুমাত্র অনুমোদিত রিসেলার এই অ্যাকশনটি সম্পন্ন করতে পারেন।' };
    }
    if (context?.resellerId && user.uid !== context.resellerId && user.resellerId !== context.resellerId) {
      return { allowed: false, reason: 'অন্য রিসেলারের ওয়ালেট বা অর্ডার পরিবর্তন করার অনুমতি নেই।' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'অননুমোদিত এক্সেস।' };
}
