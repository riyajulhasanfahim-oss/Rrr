/**
 * Reseller Database & Wallet Types (Firebase Realtime Database)
 * Exclusively powered by Firebase Realtime Database (RTDB)
 */

export enum ResellerTransactionType {
  PROFIT_PENDING = 'PROFIT_PENDING',
  PROFIT_LOCKED = 'PROFIT_LOCKED',
  PROFIT_RELEASED = 'PROFIT_RELEASED',
  PROFIT_CANCELLED = 'PROFIT_CANCELLED',
  PROFIT_REVERSED = 'PROFIT_REVERSED',
  WITHDRAWAL = 'WITHDRAWAL',
  WITHDRAWAL_REFUND = 'WITHDRAWAL_REFUND',
  WITHDRAWAL_PAID = 'WITHDRAWAL_PAID',
  DEPOSIT = 'DEPOSIT',
  ADJUSTMENT = 'ADJUSTMENT'
}

export type ResellerTransactionStatus = 
  | 'PENDING' 
  | 'LOCKED' 
  | 'RELEASED' 
  | 'CANCELLED' 
  | 'REVERSED' 
  | 'COMPLETED' 
  | 'FAILED'
  | 'Approved'
  | 'Rejected';

export interface WalletBalanceSnapshot {
  availableBalance: number;
  lockedBalance: number;
  totalBalance: number;
}

/**
 * Reseller Wallet Structure (Firebase Realtime Database)
 * Path: reseller_wallet/${resellerId}
 * 
 * Formula: totalBalance = availableBalance + lockedBalance
 */
export interface ResellerWallet {
  resellerId: string;
  
  // Balances
  availableBalance: number; // Balance available for withdrawal or use
  lockedBalance: number;    // Balance locked (pending delivery/confirmation/settlement)
  totalBalance: number;     // availableBalance + lockedBalance
  
  // Profit Tracking
  pendingProfit: number;    // Orders placed but not yet delivered/cleared
  releasedProfit: number;   // Cleared and released profit lifetime total
  cancelledProfit: number;  // Profit cancelled due to returned/cancelled orders
  
  // Backward compatibility fields for existing UI components
  walletBalance?: number;
  heldBalance?: number;
  pendingCommission?: number;
  approvedCommission?: number;
  lifetimeCommission?: number;
  totalSales?: number;
  totalOrders?: number;
  teamMembers?: number;
  todaysEarnings?: number;
  weeklyEarnings?: number;
  monthlyEarnings?: number;
  currency?: string;
  
  createdAt: number;
  updatedAt: number;
}

/**
 * Reseller Wallet Transaction Ledger Entry (Firebase Realtime Database)
 * Path: reseller_wallet_transactions/${transactionId}
 * Unique transactionId for every wallet mutation
 */
export interface ResellerWalletTransaction {
  transactionId: string;
  userId: string;
  resellerId?: string;
  vendorId?: string;
  orderId: string;
  amount: number;
  type: ResellerTransactionType | string;
  status: ResellerTransactionStatus | string;
  balanceBefore: WalletBalanceSnapshot;
  balanceAfter: WalletBalanceSnapshot;
  description: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Vendor Wallet Foundation (Firebase Realtime Database)
 * Path: vendor_wallet/${vendorId}
 * 
 * Formula: totalBalance = availableBalance + lockedBalance
 */
export interface VendorWalletFoundation {
  vendorId: string;
  availableBalance: number;
  lockedBalance: number;
  totalBalance: number; // availableBalance + lockedBalance
  resellerProfitReserve?: number; // Specific tracker for reseller reserve
  
  // Existing fields preserved
  currentBalance?: number;
  balance?: number;
  pendingBalance?: number;
  pendingPayout?: number;
  totalEarned?: number;
  lifetimeEarnings?: number;
  currency?: string;
  createdAt?: number;
  updatedAt: number;
}
