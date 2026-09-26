import { rtdbGet, rtdbSet, rtdbUpdate, rtdbPush, rtdbList, rtdbTransaction } from '../lib/rtdb';
import { 
  verifyAndRecalculateResellerProfit, 
  validateOrderStateTransition, 
  checkFinancialIdempotency, 
  recordFinancialIdempotency, 
  ensureVendorBalanceConsistency 
} from './resellerSecurityService';

export interface VendorWalletBalances {
  availableBalance: number;
  lockedBalance: number;
  totalBalance: number;
  pendingBalance: number;
  raw?: any;
}

export interface ResellerOrderEligibilityResult {
  isResellerOrder: boolean;
  requiredResellerProfit: number;
  availableBalance: number;
  lockedBalance: number;
  totalBalance: number;
  isBalanceSufficient: boolean;
  shortfall: number;
  canConfirm: boolean;
  reason?: string;
}

export interface VendorDepositParams {
  vendorId: string;
  amount: number;
  transactionId: string;
  paymentMethod: string;
  senderNumber?: string | null;
  orderId?: string;
  invoiceId?: string;
}

/**
 * Safely parses any numeric amount, stripping currency symbols, commas, spaces,
 * and converting Bengali digits into pure floating point numbers.
 */
export function parseNumericAmount(val: any): number {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }
  if (!val && val !== 0) return 0;
  const bengaliNumerals: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  let str = String(val).replace(/[০-৯]/g, (d) => bengaliNumerals[d] || d);
  str = str.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Fetches vendor wallet balances from RTDB exclusively,
 * calculating Available, Locked, and Total balances distinctly
 * Formula: totalBalance = availableBalance + lockedBalance
 */
export async function getVendorWalletBalances(vendorId: string): Promise<VendorWalletBalances> {
  if (!vendorId) {
    return { availableBalance: 0, lockedBalance: 0, totalBalance: 0, pendingBalance: 0 };
  }

  try {
    const source = (await rtdbGet<any>(`vendor_wallet/${vendorId}`)) || {};
    
    // Available balance is the freely spendable balance
    const availableBalance = Math.round(parseNumericAmount(
      source.availableBalance ?? 
      source.balance ?? 
      source.currentBalance ?? 
      0
    ) * 100) / 100;

    // Locked balance represents funds reserved for pending/processing reseller orders or held disputes
    const lockedBalance = Math.round(parseNumericAmount(
      source.lockedBalance ?? 
      source.resellerProfitReserve ?? 
      0
    ) * 100) / 100;

    // Total balance is mathematically Available + Locked
    const totalBalance = Math.round((availableBalance + lockedBalance) * 100) / 100;

    const pendingBalance = Math.round(parseNumericAmount(
      source.pendingBalance ?? 
      source.pendingPayout ?? 
      0
    ) * 100) / 100;

    return {
      availableBalance: Math.max(0, availableBalance),
      lockedBalance: Math.max(0, lockedBalance),
      totalBalance: Math.max(0, totalBalance),
      pendingBalance: Math.max(0, pendingBalance),
      raw: source
    };
  } catch (error) {
    console.error('Error getting vendor wallet balances:', error);
    return { availableBalance: 0, lockedBalance: 0, totalBalance: 0, pendingBalance: 0 };
  }
}

/**
 * Computes eligibility for confirming a reseller order based on required profit reserve
 */
export function checkResellerOrderEligibility(
  order: any,
  balances: VendorWalletBalances
): ResellerOrderEligibilityResult {
  const isReseller = Boolean(
    order?.isResellerOrder || 
    order?.resellerId || 
    order?.profitStatus || 
    order?.priceSnapshot?.resellerProfit ||
    order?.resellerPriceSnapshot?.resellerProfit
  );

  const rawProfit = 
    order?.resellerProfit ?? 
    order?.priceSnapshot?.resellerProfit ?? 
    order?.resellerPriceSnapshot?.resellerProfit ??
    order?.lockedProfitAmount ??
    0;

  const requiredResellerProfit = Math.round(parseNumericAmount(rawProfit) * 100) / 100;
  const available = Math.round(parseNumericAmount(balances.availableBalance) * 100) / 100;
  const locked = Math.round(parseNumericAmount(balances.lockedBalance) * 100) / 100;
  const total = Math.round((available + locked) * 100) / 100;

  if (!isReseller) {
    return {
      isResellerOrder: false,
      requiredResellerProfit: 0,
      availableBalance: available,
      lockedBalance: locked,
      totalBalance: total,
      isBalanceSufficient: true,
      shortfall: 0,
      canConfirm: true
    };
  }

  // If no profit is required (e.g. 0 profit product)
  if (requiredResellerProfit <= 0) {
    return {
      isResellerOrder: true,
      requiredResellerProfit: 0,
      availableBalance: available,
      lockedBalance: locked,
      totalBalance: total,
      isBalanceSufficient: true,
      shortfall: 0,
      canConfirm: true
    };
  }

  // Strict validation per specification:
  // if availableBalance >= requiredResellerProfit: confirmation allowed
  // else: confirmation blocked
  const isBalanceSufficient = available >= requiredResellerProfit;
  const shortfall = isBalanceSufficient ? 0 : Math.max(0, Math.round((requiredResellerProfit - available) * 100) / 100);
  const currentStatus = order?.status || order?.orderStatus || 'Pending';
  const isAlreadyProcessed = 
    ['Accepted', 'Processing', 'Shipped', 'In Transit', 'Delivered', 'Completed', 'Cancelled', 'Returned'].includes(currentStatus) ||
    order?.vendorOrderStatus === 'CONFIRMED' ||
    order?.profitStatus === 'LOCKED';

  const canConfirm = isBalanceSufficient && !isAlreadyProcessed && currentStatus === 'Pending';

  let reason = undefined;
  if (order?.vendorOrderStatus === 'CONFIRMED' || order?.profitStatus === 'LOCKED') {
    reason = 'অর্ডারটি ইতিমধ্যে কনফার্ম করা হয়েছে এবং রিসেলার প্রফিট লক রয়েছে।';
  } else if (isAlreadyProcessed) {
    reason = `Order is already ${currentStatus}`;
  } else if (!isBalanceSufficient) {
    reason = `Reseller profit reserve করার জন্য Vendor-এর wallet balance যথেষ্ট নয়। (প্রয়োজন: ৳${requiredResellerProfit}, বর্তমান ঘাটতি: ৳${shortfall})। অনুগ্রহ করে Deposit অপশন ব্যবহার করুন।`;
  }

  return {
    isResellerOrder: true,
    requiredResellerProfit,
    availableBalance: available,
    lockedBalance: locked,
    totalBalance: total,
    isBalanceSufficient,
    shortfall,
    canConfirm,
    reason
  };
}

/**
 * Deposits funds into Vendor Wallet with atomic RTDB transactions and duplicate protection
 * Formula: totalBalance = availableBalance + lockedBalance
 */
export async function creditVendorWalletDeposit(params: VendorDepositParams): Promise<{
  success: boolean;
  newBalance: number;
  message: string;
}> {
  const { vendorId, amount, transactionId, paymentMethod, senderNumber, orderId, invoiceId } = params;

  if (!vendorId || !transactionId || !amount || amount <= 0) {
    throw new Error('Invalid deposit parameters: vendorId, transactionId, and positive amount are required');
  }

  const cleanTrx = transactionId.trim().toUpperCase();
  const numAmount = Math.round(Number(amount) * 100) / 100;
  const now = Date.now();

  // 1. Strict Duplicate Check in RTDB: ensure this transactionId has not been used
  try {
    const existingTxs = await rtdbList<any>('wallet_transactions', (tx) => {
      const txTrx = (tx.transactionId || tx.trxId || '').trim().toUpperCase();
      return txTrx === cleanTrx;
    });

    if (existingTxs.length > 0) {
      throw new Error(`Transaction ID "${cleanTrx}" ইতিপূর্বে ব্যবহার করা হয়েছে। ডুপ্লিকেট ডিপোজিট গ্রহণ করা সম্ভব নয়।`);
    }

    const existingDeposits = await rtdbList<any>('vendor_wallet_deposits', (dep) => {
      const depTrx = (dep.transactionId || '').trim().toUpperCase();
      return depTrx === cleanTrx;
    });

    if (existingDeposits.length > 0) {
      throw new Error(`Transaction ID "${cleanTrx}" ইতিপূর্বে সফলভাবে ডিপোজিট করা হয়েছে।`);
    }
  } catch (dupErr: any) {
    if (dupErr.message && dupErr.message.includes('ইতিপূর্বে')) {
      throw dupErr;
    }
    console.warn('Duplicate check warning:', dupErr);
  }

  // 2. Perform Atomic Balance Transition on RTDB vendor_wallet
  let finalAvailable = 0;
  await rtdbTransaction<any>(`vendor_wallet/${vendorId}`, (current) => {
    const avail = Number(current?.availableBalance ?? current?.balance ?? current?.currentBalance ?? 0);
    const locked = Number(current?.lockedBalance ?? current?.resellerProfitReserve ?? 0);
    const updatedAvail = avail + numAmount;
    const updatedTotal = updatedAvail + locked;

    finalAvailable = updatedAvail;

    return {
      vendorId,
      availableBalance: updatedAvail,
      lockedBalance: locked,
      totalBalance: updatedTotal,
      balance: updatedAvail,
      currentBalance: updatedAvail,
      resellerProfitReserve: locked,
      pendingBalance: Number(current?.pendingBalance || 0),
      pendingPayout: Number(current?.pendingPayout || 0),
      totalEarned: Number(current?.totalEarned || 0),
      currency: current?.currency || 'BDT',
      createdAt: current?.createdAt || now,
      updatedAt: now
    };
  });

  // 3. Add Transaction Log in RTDB wallet_transactions
  const txData = {
    vendorId,
    userId: vendorId,
    amount: numAmount,
    type: 'Income',
    category: 'Deposit',
    status: 'Completed',
    transactionId: cleanTrx,
    paymentMethod: paymentMethod.toLowerCase(),
    senderNumber: senderNumber || null,
    invoiceId: invoiceId || `DEP-${now}`,
    orderId: orderId || null,
    description: orderId 
      ? `Reseller Order #${orderId.substring(0, 8)} Reserve Deposit`
      : 'Wallet Deposit',
    createdAt: now,
    updatedAt: now
  };
  await rtdbPush('wallet_transactions', txData);

  // 4. Record in RTDB vendor_wallet_deposits for audit
  const depositRecord = {
    transactionId: cleanTrx,
    vendorId,
    amount: numAmount,
    paymentMethod: paymentMethod.toLowerCase(),
    senderNumber: senderNumber || null,
    orderId: orderId || null,
    invoiceId: invoiceId || `DEP-${now}`,
    status: 'verified',
    verifiedAt: now,
    createdAt: now,
    updatedAt: now
  };
  await rtdbPush('vendor_wallet_deposits', depositRecord);

  return {
    success: true,
    newBalance: finalAvailable,
    message: `৳${numAmount} ডিপোজিট সফলভাবে সম্পন্ন হয়েছে।`
  };
}

/**
 * Backend Validation + Order Confirmation for Reseller Orders
 * Enforces all 5 server-side security checks using RTDB exclusively:
 * 1. Order is really a Reseller Order
 * 2. Order is still eligible (Pending)
 * 3. Required Reseller Profit amount is exact
 * 4. Vendor's Available Wallet Balance is sufficient (>= required profit)
 * 5. Order hasn't already been confirmed
 */
export async function confirmVendorResellerOrder(
  orderId: string,
  vendorId: string
): Promise<{
  success: boolean;
  message: string;
  requiredResellerProfit?: number;
  availableBalance?: number;
  lockedBalance?: number;
  totalBalance?: number;
  transactionId?: string;
  shortfall?: number;
  error?: string;
}> {
  if (!orderId || !vendorId) {
    throw new Error('Missing orderId or vendorId');
  }

  const cleanOrderId = String(orderId).replace(/^#/, '');

  // 1. Strict Fetch from RTDB across vendor_orders, orders, and reseller_orders
  let order = await rtdbGet<any>(`vendor_orders/${orderId}`);
  let vendorOrderKey = `vendor_orders/${orderId}`;
  if (!order) {
    order = await rtdbGet<any>(`vendor_orders/${cleanOrderId}`);
    vendorOrderKey = `vendor_orders/${cleanOrderId}`;
  }
  if (!order && vendorId) {
    order = await rtdbGet<any>(`vendor_orders/${cleanOrderId}_${vendorId}`);
    if (order) {
      vendorOrderKey = `vendor_orders/${cleanOrderId}_${vendorId}`;
    }
  }
  if (!order) {
    order = await rtdbGet<any>(`orders/${cleanOrderId}`);
    if (order) {
      vendorOrderKey = `vendor_orders/${cleanOrderId}`;
    }
  }
  if (!order) {
    order = await rtdbGet<any>(`reseller_orders/${cleanOrderId}`);
    if (order) {
      vendorOrderKey = `vendor_orders/${cleanOrderId}`;
    }
  }

  if (!order) {
    return { success: false, error: 'ORDER_NOT_FOUND', message: 'Order not found in RTDB' };
  }

  // Enrich order from reseller_orders or orders if available
  const resellerOrderData = await rtdbGet<any>(`reseller_orders/${cleanOrderId}`);
  if (resellerOrderData) {
    order = { ...resellerOrderData, ...order };
  }
  const mainOrderData = await rtdbGet<any>(`orders/${cleanOrderId}`);
  if (mainOrderData) {
    order = { ...mainOrderData, ...order };
  }

  // 2. Reseller Order Verification
  const isReseller = Boolean(
    order.isResellerOrder || 
    order.resellerId || 
    order.profitStatus || 
    order.priceSnapshot?.resellerProfit ||
    order.resellerPriceSnapshot?.resellerProfit
  );
  if (!isReseller) {
    return { success: false, error: 'NOT_RESELLER_ORDER', message: 'This is not a reseller order' };
  }

  // 3. Duplicate Confirmation & Lock Prevention
  const transactionType = 'RESELLER_PROFIT_LOCK';
  const lockKey = `${cleanOrderId}_${transactionType}`;

  // Check 3A: Idempotency Check (orderId + transactionType)
  const idempCheck = await checkFinancialIdempotency(cleanOrderId, transactionType);
  if (idempCheck.isDuplicate) {
    return {
      success: false,
      error: 'DUPLICATE_LOCK_PREVENTED',
      message: idempCheck.message || 'এই অর্ডারের জন্য ইতিমধ্যে প্রফিট লক করা হয়েছে। দ্বিতীয়বার লক করা সম্ভব নয়।'
    };
  }

  // Check 3B: Order Status Flags & State Machine Validation
  const currentStatus = order.status || order.orderStatus || 'Pending';
  const stateCheck = validateOrderStateTransition(order.profitStatus || 'PENDING', 'LOCKED');
  if (!stateCheck.isValid) {
    return {
      success: false,
      error: 'INVALID_STATE_TRANSITION',
      message: stateCheck.error || 'এই অর্ডারের জন্য প্রফিট লক ট্রানজিশন অনুমোদিত নয়।'
    };
  }

  if (['Delivered', 'Cancelled', 'Returned'].includes(currentStatus)) {
    return {
      success: false,
      error: 'INVALID_ORDER_STATUS',
      message: `Order cannot be confirmed. Current status is ${currentStatus}`
    };
  }

  // Check 3C: Duplicate Lock Registry check in RTDB (orderId + transactionType)
  const existingLock = await rtdbGet<any>(`reseller_profit_locks/${lockKey}`);
  if (existingLock) {
    return {
      success: false,
      error: 'DUPLICATE_LOCK_PREVENTED',
      message: 'এই অর্ডারের জন্য ইতিমধ্যে প্রফিট লক করা হয়েছে। দ্বিতীয়বার লক করা সম্ভব নয়।'
    };
  }

  // 4. Stored Reseller Profit from RTDB (Source of Truth)
  const rawProfit = 
    order.resellerProfit ?? 
    order.priceSnapshot?.resellerProfit ?? 
    order.resellerPriceSnapshot?.resellerProfit ??
    order.lockedProfitAmount ??
    0;
  let requiredResellerProfit = Math.round(parseNumericAmount(rawProfit) * 100) / 100;
  
  if (requiredResellerProfit <= 0) {
    const profitVerification = verifyAndRecalculateResellerProfit(order);
    requiredResellerProfit = Math.round(parseNumericAmount(profitVerification.verifiedProfit) * 100) / 100;
  }

  // 5. Vendor Available Balance check in RTDB (Fresh Current Wallet Read)
  const freshWallet = (await rtdbGet<any>(`vendor_wallet/${vendorId}`)) || {};
  const currentAvail = Math.round(parseNumericAmount(
    freshWallet.availableBalance ?? 
    freshWallet.balance ?? 
    freshWallet.currentBalance ?? 
    0
  ) * 100) / 100;
  const currentLocked = Math.round(parseNumericAmount(
    freshWallet.lockedBalance ?? 
    freshWallet.resellerProfitReserve ?? 
    0
  ) * 100) / 100;
  const currentTotal = Math.round((currentAvail + currentLocked) * 100) / 100;

  // Strict Validation Rule:
  // if availableBalance >= requiredResellerProfit: confirmation allowed
  // else: confirmation blocked
  if (currentAvail < requiredResellerProfit) {
    const shortfall = Math.round((requiredResellerProfit - currentAvail) * 100) / 100;
    return {
      success: false,
      error: 'INSUFFICIENT_WALLET_BALANCE',
      message: `Reseller profit reserve করার জন্য Vendor-এর wallet balance যথেষ্ট নয়। (প্রয়োজন: ৳${requiredResellerProfit}, বর্তমান ঘাটতি: ৳${shortfall})। অনুগ্রহ করে Deposit করুন।`,
      requiredResellerProfit,
      availableBalance: currentAvail,
      shortfall
    };
  }

  const now = Date.now();
  // Unique transactionId for this lock operation
  const transactionId = `TXN_LOCK_${cleanOrderId}_${now}`;

  // 6. Atomic RTDB Transaction to lock funds from Available Balance to Locked Balance
  // "Vendor:
  // availableBalance → required resellerProfit পরিমাণ কমবে
  // lockedBalance → একই পরিমাণ বাড়বে
  // অর্থাৎ টাকা হারাবে না, শুধু:
  // Available Balance → Locked Balance হবে।
  // Vendor-এর totalBalance পরিবর্তন হবে না।
  // কারণ: totalBalance = availableBalance + lockedBalance"
  let finalAvailable = currentAvail;
  let finalLocked = currentLocked;
  let finalTotal = currentTotal;

  if (requiredResellerProfit > 0) {
    const txResult = await rtdbTransaction<any>(`vendor_wallet/${vendorId}`, (curr) => {
      // Safe fallback on initial local pass of runTransaction
      const data = curr || freshWallet;
      const avail = Math.round(parseNumericAmount(data?.availableBalance ?? data?.balance ?? data?.currentBalance ?? 0) * 100) / 100;
      const locked = Math.round(parseNumericAmount(data?.lockedBalance ?? data?.resellerProfitReserve ?? 0) * 100) / 100;

      // Strict atomic check inside transaction
      if (avail < requiredResellerProfit) {
        // Return undefined to abort transaction without committing
        return undefined;
      }

      const newAvailable = Math.round((avail - requiredResellerProfit) * 100) / 100;
      const newLocked = Math.round((locked + requiredResellerProfit) * 100) / 100;
      const total = Math.round((newAvailable + newLocked) * 100) / 100;

      finalAvailable = newAvailable;
      finalLocked = newLocked;
      finalTotal = total;

      return {
        ...(curr || freshWallet),
        vendorId,
        availableBalance: newAvailable,
        lockedBalance: newLocked,
        totalBalance: total,
        balance: newAvailable,
        currentBalance: newAvailable,
        resellerProfitReserve: newLocked,
        updatedAt: now
      };
    });

    if (!txResult.committed) {
      // If transaction failed or aborted, re-read fresh wallet from RTDB to check if insufficient or concurrency
      const recheck = (await rtdbGet<any>(`vendor_wallet/${vendorId}`)) || {};
      const recheckAvail = Math.round(parseNumericAmount(recheck.availableBalance ?? recheck.balance ?? 0) * 100) / 100;
      if (recheckAvail < requiredResellerProfit) {
        const shortfall = Math.round((requiredResellerProfit - recheckAvail) * 100) / 100;
        return {
          success: false,
          error: 'INSUFFICIENT_WALLET_BALANCE',
          message: `Reseller profit reserve করার জন্য Vendor-এর wallet balance যথেষ্ট নয়। (প্রয়োজন: ৳${requiredResellerProfit}, বর্তমান ঘাটতি: ৳${shortfall})। অনুগ্রহ করে Deposit করুন।`,
          requiredResellerProfit,
          availableBalance: recheckAvail,
          shortfall
        };
      }

      // Concurrency retry update
      const fallbackAvail = Math.round((recheckAvail - requiredResellerProfit) * 100) / 100;
      const fallbackLocked = Math.round((parseNumericAmount(recheck.lockedBalance ?? recheck.resellerProfitReserve ?? 0) + requiredResellerProfit) * 100) / 100;
      const fallbackTotal = Math.round((fallbackAvail + fallbackLocked) * 100) / 100;

      await rtdbUpdate(`vendor_wallet/${vendorId}`, {
        availableBalance: fallbackAvail,
        lockedBalance: fallbackLocked,
        totalBalance: fallbackTotal,
        balance: fallbackAvail,
        currentBalance: fallbackAvail,
        resellerProfitReserve: fallbackLocked,
        updatedAt: now
      });

      finalAvailable = fallbackAvail;
      finalLocked = fallbackLocked;
      finalTotal = fallbackTotal;
    }
  }

  // 7. Record the lock registry in RTDB to prevent any duplicate locks (orderId + transactionType)
  await rtdbSet(`reseller_profit_locks/${lockKey}`, {
    transactionId,
    transactionType,
    lockKey,
    orderId: cleanOrderId,
    mainOrderId: order.mainOrderId || order.orderId || cleanOrderId,
    vendorId,
    resellerId: order.resellerId || '',
    lockedProfitAmount: requiredResellerProfit,
    previousAvailableBalance: currentAvail,
    newAvailableBalance: finalAvailable,
    previousLockedBalance: currentLocked,
    newLockedBalance: finalLocked,
    totalBalance: finalTotal,
    status: 'LOCKED',
    createdAt: now
  });

  // 8. Record Vendor Wallet Transaction in RTDB
  if (requiredResellerProfit > 0) {
    try {
      await rtdbSet(`vendor_wallet_transactions/${vendorId}/${transactionId}`, {
        id: transactionId,
        transactionId,
        vendorId,
        type: 'RESELLER_PROFIT_LOCK',
        transactionType: 'RESELLER_PROFIT_LOCK',
        amount: requiredResellerProfit,
        title: 'রিসেলার প্রফিট রিজার্ভ লকড',
        description: `অর্ডার #${cleanOrderId}-এর জন্য রিসেলার প্রফিট সিকিউরিটি হিসেবে Available Balance থেকে Locked Balance-এ সংরক্ষিত হয়েছে।`,
        orderId: cleanOrderId,
        previousAvailable: currentAvail,
        newAvailable: finalAvailable,
        previousLocked: currentLocked,
        newLocked: finalLocked,
        totalBalance: finalTotal,
        createdAt: now
      });
    } catch (txnErr) {
      console.warn('Notice writing wallet transaction record:', txnErr);
    }
  }

  // 9. Update Order Status in RTDB:
  // vendorOrderStatus = "CONFIRMED"
  // profitStatus = "LOCKED"
  // settlementStatus = "LOCKED"
  // lockedProfitAmount = resellerProfit
  const orderUpdates: Record<string, any> = {
    status: 'Accepted',
    vendorStatus: 'Accepted',
    vendorOrderStatus: 'CONFIRMED',
    profitStatus: 'LOCKED',
    settlementStatus: 'LOCKED',
    lockedProfitAmount: requiredResellerProfit,
    resellerReserveEligible: true,
    acceptedAt: now,
    lockedAt: now,
    lockTransactionId: transactionId,
    lockTransactionType: transactionType,
    updatedAt: now
  };

  // Update vendor_orders
  await rtdbUpdate(vendorOrderKey, orderUpdates);
  if (vendorOrderKey !== `vendor_orders/${cleanOrderId}`) {
    try {
      await rtdbUpdate(`vendor_orders/${cleanOrderId}`, orderUpdates);
    } catch (_) {}
  }

  // Update main orders collection if present
  const mainOrderId = order.mainOrderId || order.orderId || cleanOrderId;
  if (mainOrderId) {
    try {
      await rtdbUpdate(`orders/${mainOrderId}`, orderUpdates);
    } catch (_) {}
  }

  // Sync reseller_orders record in RTDB
  try {
    await rtdbUpdate(`reseller_orders/${cleanOrderId}`, {
      orderStatus: 'CONFIRMED',
      vendorOrderStatus: 'CONFIRMED',
      profitStatus: 'LOCKED',
      settlementStatus: 'LOCKED',
      lockedProfitAmount: requiredResellerProfit,
      lockTransactionId: transactionId,
      updatedAt: now
    });
  } catch (_) {}

  // 10. Record status log in RTDB
  try {
    await rtdbPush('order_status_logs', {
      orderId: cleanOrderId,
      mainOrderId: mainOrderId || cleanOrderId,
      vendorId,
      oldStatus: currentStatus,
      newStatus: 'Accepted',
      vendorOrderStatus: 'CONFIRMED',
      profitStatus: 'LOCKED',
      settlementStatus: 'LOCKED',
      lockedProfitAmount: requiredResellerProfit,
      transactionId,
      transactionType,
      note: `Order confirmed by vendor. Reseller profit ৳${requiredResellerProfit} locked from Available to Locked balance.`,
      timestamp: now
    });
  } catch (_) {}

  // 11. Record financial idempotency
  await recordFinancialIdempotency(cleanOrderId, 'RESELLER_PROFIT_LOCK', {
    transactionId,
    vendorId,
    resellerId: order.resellerId || '',
    amount: requiredResellerProfit,
    executedBy: vendorId,
    details: `Order #${cleanOrderId} profit locked by vendor.`
  });

  // IMPORTANT:
  // Reseller-এর pendingProfit এই ধাপে অপরিবর্তিত থাকবে।
  // Reseller wallet-এ কোনো টাকা এই ধাপে transfer করা হয়নি।

  return {
    success: true,
    message: 'অর্ডারটি সফলভাবে কনফার্ম করা হয়েছে এবং রিসেলার প্রফিট লক করা হয়েছে!',
    requiredResellerProfit,
    availableBalance: finalAvailable,
    lockedBalance: finalLocked,
    totalBalance: finalTotal,
    transactionId
  };
}

/**
 * Calculates the total Reseller Locked Profit for a Vendor from a list of orders.
 * Strictly follows the business rules:
 * - Only counts Reseller Orders where profitStatus is currently 'LOCKED'
 * - Ignores RELEASED profit
 * - Ignores CANCELLED profit
 * - Ignores RETURNED profit
 * - Ignores PENDING profit
 * - Deduplicates by order ID so an order present in multiple RTDB paths isn't counted twice
 */
export function calculateResellerLockedProfitFromOrders(orders: any[]): number {
  if (!orders || !Array.isArray(orders)) return 0;

  const seenOrderIds = new Set<string>();
  let totalLocked = 0;

  for (const order of orders) {
    if (!order) continue;
    const cleanId = String(order.orderId || order.id || '').replace(/^#/, '').trim();
    const baseId = cleanId.includes('_') ? cleanId.split('_')[0] : cleanId;
    if (!baseId) continue;

    // Deduplicate so an order is counted only once even if present across multiple nodes
    if (seenOrderIds.has(baseId)) continue;

    const profitStatus = String(order.profitStatus || '').toUpperCase().trim();

    // STRICT: Only count if currently LOCKED
    if (profitStatus === 'LOCKED') {
      seenOrderIds.add(baseId);
      const profit = parseNumericAmount(
        order.lockedProfitAmount ??
        order.resellerProfit ??
        order.priceSnapshot?.resellerProfit ??
        order.resellerPriceSnapshot?.resellerProfit ??
        0
      );
      totalLocked += profit;
    }
  }

  return Math.round(totalLocked * 100) / 100;
}

/**
 * Fetches and calculates the current Reseller Locked Profit directly from RTDB for a given vendor.
 */
export async function getVendorResellerLockedProfit(vendorId: string): Promise<number> {
  if (!vendorId) return 0;
  try {
    const [vOrders, mOrders, rOrders] = await Promise.all([
      rtdbList<any>('vendor_orders', (o) => o?.vendorId === vendorId || o?.userId === vendorId),
      rtdbList<any>('orders', (o) => o?.vendorId === vendorId || o?.userId === vendorId),
      rtdbList<any>('reseller_orders', (o) => o?.vendorId === vendorId || o?.userId === vendorId)
    ]);

    const combined = [
      ...vOrders.map(item => ({ id: item.id, ...item.data })),
      ...mOrders.map(item => ({ id: item.id, ...item.data })),
      ...rOrders.map(item => ({ id: item.id, ...item.data }))
    ];

    return calculateResellerLockedProfitFromOrders(combined);
  } catch (err) {
    console.error('Error fetching vendor reseller locked profit:', err);
    return 0;
  }
}
