/**
 * Reseller Wallet Service (Firebase Realtime Database)
 * 
 * Strict Guidelines:
 * 1. Uses Firebase Realtime Database (RTDB) exclusively. Zero Firestore dependencies.
 * 2. Dedicated to users with role/accountType === "reseller".
 * 3. Atomic balance transitions using RTDB runTransaction - never overwrites balances.
 * 4. Structure:
 *    - availableBalance
 *    - lockedBalance
 *    - totalBalance (totalBalance = availableBalance + lockedBalance)
 *    - pendingProfit
 *    - releasedProfit
 *    - cancelledProfit
 * 5. Unique transactionId with complete ledger record (balanceBefore, balanceAfter, etc.).
 */

import { 
  rtdbGet, 
  rtdbSet, 
  rtdbUpdate, 
  rtdbPush, 
  rtdbTransaction, 
  rtdbList 
} from '../lib/rtdb';

import { 
  ResellerWallet, 
  ResellerWalletTransaction, 
  ResellerTransactionType, 
  ResellerTransactionStatus,
  WalletBalanceSnapshot,
  VendorWalletFoundation
} from '../types/resellerWallet';

/**
 * Validates if the user account is a Reseller using existing RTDB structure
 */
export async function isResellerAccount(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const uRtdb = await rtdbGet<any>(`users/${userId}`);
    if (uRtdb) {
      const isReseller = (
        uRtdb.role === 'Reseller' || 
        uRtdb.role === 'reseller' || 
        uRtdb.accountType === 'reseller' || 
        uRtdb.hasActiveReseller === true
      );
      if (isReseller) return true;
    }

    const rData = await rtdbGet<any>(`resellers/${userId}`);
    if (rData && (rData.status === 'Approved' || rData.status === 'active' || rData.isActive !== false)) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('[ResellerWalletService] Error checking reseller role in RTDB:', error);
    return false;
  }
}

/**
 * Generates a guaranteed unique transaction ID
 */
export function generateWalletTransactionId(prefix: string = 'TXN-RES'): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${randomSuffix}`;
}

/**
 * Ensures a Reseller Wallet document exists in RTDB for the given reseller UID.
 * Does not overwrite existing balances.
 * 
 * Formula: totalBalance = availableBalance + lockedBalance
 */
export async function ensureResellerWallet(resellerId: string): Promise<ResellerWallet> {
  if (!resellerId) {
    throw new Error('Reseller ID is required');
  }

  const path = `reseller_wallet/${resellerId}`;
  const now = Date.now();

  let resultingWallet: ResellerWallet | null = null;

  await rtdbTransaction<any>(path, (currentData) => {
    if (currentData) {
      const availableBalance = Number(
        currentData.availableBalance ?? 
        currentData.walletBalance ?? 
        currentData.approvedCommission ?? 
        0
      );
      const lockedBalance = Number(
        currentData.lockedBalance ?? 
        currentData.heldBalance ?? 
        0
      );
      const totalBalance = availableBalance + lockedBalance;
      const pendingProfit = Number(
        currentData.pendingProfit ?? 
        currentData.pendingCommission ?? 
        0
      );
      const releasedProfit = Number(
        currentData.releasedProfit ?? 
        currentData.lifetimeCommission ?? 
        0
      );
      const cancelledProfit = Number(currentData.cancelledProfit ?? 0);

      resultingWallet = {
        resellerId,
        availableBalance,
        lockedBalance,
        totalBalance,
        pendingProfit,
        releasedProfit,
        cancelledProfit,
        // Backward compatibility fields
        walletBalance: availableBalance,
        heldBalance: lockedBalance,
        pendingCommission: pendingProfit,
        approvedCommission: availableBalance,
        lifetimeCommission: releasedProfit,
        totalSales: Number(currentData.totalSales || 0),
        totalOrders: Number(currentData.totalOrders || 0),
        teamMembers: Number(currentData.teamMembers || 0),
        todaysEarnings: Number(currentData.todaysEarnings || 0),
        weeklyEarnings: Number(currentData.weeklyEarnings || 0),
        monthlyEarnings: Number(currentData.monthlyEarnings || 0),
        currency: currentData.currency || 'BDT',
        createdAt: currentData.createdAt || now,
        updatedAt: now
      };

      return resultingWallet;
    } else {
      // Initialize fresh wallet
      resultingWallet = {
        resellerId,
        availableBalance: 0,
        lockedBalance: 0,
        totalBalance: 0,
        pendingProfit: 0,
        releasedProfit: 0,
        cancelledProfit: 0,
        walletBalance: 0,
        heldBalance: 0,
        pendingCommission: 0,
        approvedCommission: 0,
        lifetimeCommission: 0,
        totalSales: 0,
        totalOrders: 0,
        teamMembers: 0,
        todaysEarnings: 0,
        weeklyEarnings: 0,
        monthlyEarnings: 0,
        currency: 'BDT',
        createdAt: now,
        updatedAt: now
      };

      return resultingWallet;
    }
  });

  return resultingWallet!;
}

/**
 * Fetches the current reseller wallet from RTDB
 */
export async function getResellerWallet(resellerId: string): Promise<ResellerWallet | null> {
  if (!resellerId) return null;
  const path = `reseller_wallet/${resellerId}`;
  const data = await rtdbGet<any>(path);
  if (!data) return null;

  const available = Number(data.availableBalance ?? data.walletBalance ?? 0);
  const locked = Number(data.lockedBalance ?? data.heldBalance ?? 0);

  return {
    resellerId,
    availableBalance: available,
    lockedBalance: locked,
    totalBalance: available + locked,
    pendingProfit: Number(data.pendingProfit ?? data.pendingCommission ?? 0),
    releasedProfit: Number(data.releasedProfit ?? data.lifetimeCommission ?? 0),
    cancelledProfit: Number(data.cancelledProfit ?? 0),
    walletBalance: available,
    heldBalance: locked,
    pendingCommission: Number(data.pendingProfit ?? data.pendingCommission ?? 0),
    approvedCommission: available,
    lifetimeCommission: Number(data.releasedProfit ?? data.lifetimeCommission ?? 0),
    totalSales: Number(data.totalSales || 0),
    totalOrders: Number(data.totalOrders || 0),
    teamMembers: Number(data.teamMembers || 0),
    todaysEarnings: Number(data.todaysEarnings || 0),
    weeklyEarnings: Number(data.weeklyEarnings || 0),
    monthlyEarnings: Number(data.monthlyEarnings || 0),
    currency: data.currency || 'BDT',
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now()
  };
}

export interface ExecuteTransactionParams {
  transactionId?: string;
  userId?: string;
  resellerId: string;
  vendorId?: string;
  orderId?: string;
  amount: number;
  type: ResellerTransactionType | string;
  status?: ResellerTransactionStatus | string;
  description: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

/**
 * Executes an atomic wallet balance transition with idempotency protection in RTDB.
 * Never overwrites balances directly.
 * 
 * Formula: totalBalance = availableBalance + lockedBalance
 */
export async function executeResellerWalletTransaction(
  params: ExecuteTransactionParams
): Promise<{ success: boolean; transaction: ResellerWalletTransaction; wallet: ResellerWallet }> {
  const {
    resellerId,
    userId = params.resellerId,
    vendorId,
    orderId = '',
    amount,
    type,
    description,
    idempotencyKey,
    metadata = {}
  } = params;

  if (!resellerId) throw new Error('Reseller ID is required');
  if (amount < 0) throw new Error('Transaction amount must be positive');

  // Ensure unique transactionId
  const transactionId = params.transactionId?.trim() || generateWalletTransactionId();

  // 1. Idempotency Check in RTDB: if this transaction was already processed, return it without duplicate mutations
  const existingTx = await rtdbGet<ResellerWalletTransaction>(`reseller_wallet_transactions/${transactionId}`);
  if (existingTx) {
    const currentWallet = await getResellerWallet(resellerId) || await ensureResellerWallet(resellerId);
    return {
      success: true,
      transaction: existingTx,
      wallet: currentWallet
    };
  }

  const now = Date.now();
  let balanceBeforeSnapshot: WalletBalanceSnapshot = { availableBalance: 0, lockedBalance: 0, totalBalance: 0 };
  let balanceAfterSnapshot: WalletBalanceSnapshot = { availableBalance: 0, lockedBalance: 0, totalBalance: 0 };
  let updatedWalletState: ResellerWallet | null = null;
  let txStatus: ResellerTransactionStatus = (params.status as any) || 'COMPLETED';

  // 2. Perform atomic transaction on RTDB reseller_wallet
  const walletPath = `reseller_wallet/${resellerId}`;

  await rtdbTransaction<any>(walletPath, (current) => {
    const currentAvail = Number(current?.availableBalance ?? current?.walletBalance ?? 0);
    const currentLocked = Number(current?.lockedBalance ?? current?.heldBalance ?? 0);
    const currentTotal = currentAvail + currentLocked;
    const currentPending = Number(current?.pendingProfit ?? current?.pendingCommission ?? 0);
    const currentReleased = Number(current?.releasedProfit ?? current?.lifetimeCommission ?? 0);
    const currentCancelled = Number(current?.cancelledProfit ?? 0);

    balanceBeforeSnapshot = {
      availableBalance: currentAvail,
      lockedBalance: currentLocked,
      totalBalance: currentTotal
    };

    let newAvailable = currentAvail;
    let newLocked = currentLocked;
    let newPending = currentPending;
    let newReleased = currentReleased;
    let newCancelled = currentCancelled;

    // 3. State transitions based on transaction type
    switch (type) {
      case ResellerTransactionType.PROFIT_PENDING:
        // Order placed: profit tracked in pending, not unlocked yet
        newPending += amount;
        txStatus = 'PENDING';
        break;

      case ResellerTransactionType.PROFIT_LOCKED:
        // Order confirmed: profit reserved/locked for reseller
        newLocked += amount;
        if (newPending >= amount) {
          newPending -= amount;
        }
        txStatus = 'LOCKED';
        break;

      case ResellerTransactionType.PROFIT_RELEASED:
        // Order delivered/cleared: locked/pending amount transferred to available balance
        if (newLocked >= amount) {
          newLocked -= amount;
        } else {
          newLocked = 0;
        }
        if (newPending >= amount) {
          newPending -= amount;
        }
        newAvailable += amount;
        newReleased += amount;
        txStatus = 'COMPLETED';
        break;

      case ResellerTransactionType.PROFIT_CANCELLED:
        // Order cancelled or returned: profit removed from pending/locked
        if (newLocked >= amount) {
          newLocked -= amount;
        }
        if (newPending >= amount) {
          newPending -= amount;
        }
        newCancelled += amount;
        txStatus = 'CANCELLED';
        break;

      case ResellerTransactionType.PROFIT_REVERSED:
        // Previously released profit reversed
        newAvailable = Math.max(0, newAvailable - amount);
        newReleased = Math.max(0, newReleased - amount);
        txStatus = 'REVERSED';
        break;

      case ResellerTransactionType.WITHDRAWAL:
        // Withdrawing funds: transfer from available to locked/held
        newAvailable = Math.max(0, newAvailable - amount);
        newLocked += amount;
        txStatus = 'PENDING';
        break;

      case ResellerTransactionType.WITHDRAWAL_REFUND:
        // Rejected/refunded withdrawal: move back from locked/held to available
        if (newLocked >= amount) {
          newLocked -= amount;
        }
        newAvailable += amount;
        txStatus = 'REVERSED';
        break;

      case ResellerTransactionType.WITHDRAWAL_PAID:
        // Completed/paid withdrawal: deduct held amount permanently from locked balance
        if (newLocked >= amount) {
          newLocked -= amount;
        } else {
          newLocked = 0;
        }
        txStatus = 'COMPLETED';
        break;

      case ResellerTransactionType.DEPOSIT:
      case ResellerTransactionType.ADJUSTMENT:
        newAvailable += amount;
        txStatus = 'COMPLETED';
        break;

      default:
        // Generic balance adjustment
        newAvailable += amount;
        txStatus = 'COMPLETED';
        break;
    }

    const newTotal = newAvailable + newLocked;

    balanceAfterSnapshot = {
      availableBalance: newAvailable,
      lockedBalance: newLocked,
      totalBalance: newTotal
    };

    updatedWalletState = {
      resellerId,
      availableBalance: newAvailable,
      lockedBalance: newLocked,
      totalBalance: newTotal,
      pendingProfit: newPending,
      releasedProfit: newReleased,
      cancelledProfit: newCancelled,
      // Backward compatibility fields
      walletBalance: newAvailable,
      heldBalance: newLocked,
      pendingCommission: newPending,
      approvedCommission: newAvailable,
      lifetimeCommission: newReleased,
      totalSales: Number(current?.totalSales || 0),
      totalOrders: Number(current?.totalOrders || 0),
      teamMembers: Number(current?.teamMembers || 0),
      todaysEarnings: Number(current?.todaysEarnings || 0),
      weeklyEarnings: Number(current?.weeklyEarnings || 0),
      monthlyEarnings: Number(current?.monthlyEarnings || 0),
      currency: current?.currency || 'BDT',
      createdAt: current?.createdAt || now,
      updatedAt: now
    };

    return updatedWalletState;
  });

  // 4. Create Ledger Entry in RTDB
  const ledgerTx: ResellerWalletTransaction = {
    transactionId,
    userId,
    resellerId,
    vendorId,
    orderId,
    amount,
    type,
    status: txStatus,
    balanceBefore: balanceBeforeSnapshot,
    balanceAfter: balanceAfterSnapshot,
    description,
    idempotencyKey: idempotencyKey || `${resellerId}_${orderId}_${type}_${transactionId}`,
    metadata,
    createdAt: now,
    updatedAt: now
  };

  // Write transaction record to RTDB
  await rtdbSet(`reseller_wallet_transactions/${transactionId}`, ledgerTx);

  // Synchronize legacy users node fields for backwards UI compatibility
  if (updatedWalletState) {
    await rtdbUpdate(`users/${resellerId}`, {
      resellerBalance: (updatedWalletState as ResellerWallet).availableBalance,
      resellerHeldBalance: (updatedWalletState as ResellerWallet).lockedBalance,
      updatedAt: now
    }).catch(() => {});
  }

  return {
    success: true,
    transaction: ledgerTx,
    wallet: updatedWalletState!
  };
}

/**
 * Fetches recent transactions for a reseller ledger from RTDB
 */
export async function getResellerLedgerTransactions(
  resellerId: string, 
  limitCount = 50
): Promise<ResellerWalletTransaction[]> {
  if (!resellerId) return [];
  try {
    const list = await rtdbList<ResellerWalletTransaction>(
      'reseller_wallet_transactions',
      (item) => item.resellerId === resellerId || item.userId === resellerId
    );
    return list
      .map(entry => entry.data)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, limitCount);
  } catch (error) {
    console.error('[ResellerWalletService] Error fetching transactions from RTDB:', error);
    return [];
  }
}

/**
 * Vendor Wallet Foundation in RTDB
 * Path: vendor_wallet/${vendorId}
 * 
 * Formula: totalBalance = availableBalance + lockedBalance
 */
export async function ensureVendorWalletFoundation(vendorId: string): Promise<VendorWalletFoundation> {
  if (!vendorId) throw new Error('Vendor ID is required');

  const path = `vendor_wallet/${vendorId}`;
  const now = Date.now();
  let resultFoundation: VendorWalletFoundation | null = null;

  await rtdbTransaction<any>(path, (current) => {
    if (current) {
      const avail = Number(
        current.availableBalance ?? 
        current.balance ?? 
        current.currentBalance ?? 
        0
      );
      const locked = Number(
        current.lockedBalance ?? 
        current.pendingBalance ?? 
        current.resellerProfitReserve ?? 
        0
      );
      const total = avail + locked;

      resultFoundation = {
        vendorId,
        availableBalance: avail,
        lockedBalance: locked,
        totalBalance: total,
        resellerProfitReserve: locked,
        currentBalance: avail,
        balance: avail,
        pendingBalance: locked,
        pendingPayout: Number(current.pendingPayout || 0),
        totalEarned: Number(current.totalEarned || current.lifetimeEarnings || 0),
        lifetimeEarnings: Number(current.lifetimeEarnings || current.totalEarned || 0),
        currency: current.currency || 'BDT',
        createdAt: current.createdAt || now,
        updatedAt: now
      };
      return resultFoundation;
    } else {
      resultFoundation = {
        vendorId,
        availableBalance: 0,
        lockedBalance: 0,
        totalBalance: 0,
        resellerProfitReserve: 0,
        currentBalance: 0,
        balance: 0,
        pendingBalance: 0,
        pendingPayout: 0,
        totalEarned: 0,
        lifetimeEarnings: 0,
        currency: 'BDT',
        createdAt: now,
        updatedAt: now
      };
      return resultFoundation;
    }
  });

  return resultFoundation!;
}
