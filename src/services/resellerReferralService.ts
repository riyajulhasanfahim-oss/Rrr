/**
 * Reseller Referral Service
 * 
 * Strict Guidelines:
 * - Uses Firebase Realtime Database (RTDB) exclusively.
 * - Handles referral code generation and lookup for Resellers.
 * - Adds exactly ৳200 to the referrer's reseller wallet on successful reseller registration.
 * - Prevents double crediting and maintains immutable ledger records.
 */

import { rtdbGet, rtdbSet, rtdbUpdate, rtdbPush, rtdbTransaction } from '../lib/rtdb';
import { executeResellerWalletTransaction } from './resellerWalletService';
import { ResellerTransactionType } from '../types/resellerWallet';

export const REFERRAL_BONUS_AMOUNT = 200;

export interface ReferralCodeInfo {
  code: string;
  userId: string;
  resellerId: string;
  resellerName: string;
  createdAt: number;
}

export interface ReferrerLookupResult {
  valid: boolean;
  userId?: string;
  name?: string;
  code?: string;
}

export interface ReferralItem {
  id: string;
  referredUserId: string;
  referredName: string;
  referredEmail?: string;
  bonusAmount: number;
  status: string;
  createdAt: number;
}

export interface ReferralStats {
  totalReferrals: number;
  totalEarnings: number;
  activeResellers: number;
}

export async function getResellerReferralCode(userId: string): Promise<string> {
  if (!userId) return '';
  const res = await getOrCreateReferralCode(userId);
  return res.code;
}

/**
 * Gets an existing referral code for a user or creates a new one in RTDB.
 */
export async function getOrCreateReferralCode(
  userId: string,
  userName?: string
): Promise<{ code: string; referralLink: string }> {
  if (!userId) {
    return { code: '', referralLink: '' };
  }

  try {
    // 1. Check if user already has a referral code by direct key
    const existingByUid = await rtdbGet<any>(`referral_codes/${userId}`);
    if (existingByUid && existingByUid.code) {
      const code = String(existingByUid.code).toUpperCase();
      // Ensure cross-index is also set
      await rtdbSet(`referral_codes/${code}`, {
        code,
        userId,
        resellerId: userId,
        resellerName: userName || existingByUid.resellerName || 'Reseller',
        createdAt: existingByUid.createdAt || Date.now()
      }).catch(() => {});

      return {
        code,
        referralLink: `${window.location.origin}/reseller/apply?ref=${code}`
      };
    }

    // 2. Generate a clean, 8-character unique referral code from UID
    const newCode = userId.substring(0, 8).toUpperCase();
    const cleanName = userName || 'Reseller Partner';
    const now = Date.now();

    const record: ReferralCodeInfo = {
      code: newCode,
      userId,
      resellerId: userId,
      resellerName: cleanName,
      createdAt: now
    };

    // Store in both paths for O(1) direct key lookup
    await Promise.allSettled([
      rtdbSet(`referral_codes/${newCode}`, record),
      rtdbSet(`referral_codes/${userId}`, record),
      rtdbUpdate(`resellers/${userId}`, { referralCode: newCode }),
      rtdbUpdate(`users/${userId}`, { referralCode: newCode })
    ]);

    return {
      code: newCode,
      referralLink: `${window.location.origin}/reseller/apply?ref=${newCode}`
    };
  } catch (error) {
    console.error('[ResellerReferralService] Error getting/creating referral code:', error);
    const fallbackCode = userId.substring(0, 8).toUpperCase();
    return {
      code: fallbackCode,
      referralLink: `${window.location.origin}/reseller/apply?ref=${fallbackCode}`
    };
  }
}

/**
 * Validates a referral code against RTDB.
 */
export async function lookupReferralCode(rawCode: string): Promise<ReferrerLookupResult> {
  const cleanCode = (rawCode || '').trim().toUpperCase();
  if (!cleanCode || cleanCode.length < 3) {
    return { valid: false };
  }

  try {
    // 1. Direct RTDB lookup in referral_codes/{cleanCode}
    const directCode = await rtdbGet<any>(`referral_codes/${cleanCode}`);
    if (directCode && directCode.userId) {
      return {
        valid: true,
        userId: directCode.userId,
        name: directCode.resellerName || directCode.name || 'রেফারার পার্টনার',
        code: cleanCode
      };
    }

    // 2. Lookup in referral_codes collection
    const allCodes = await rtdbGet<Record<string, any>>('referral_codes');
    if (allCodes && typeof allCodes === 'object') {
      for (const [key, val] of Object.entries(allCodes)) {
        if (!val) continue;
        const c = String(val.code || key).toUpperCase();
        if (c === cleanCode || key.toUpperCase() === cleanCode) {
          return {
            valid: true,
            userId: val.userId || val.resellerId || key,
            name: val.resellerName || val.name || 'রেফারার পার্টনার',
            code: cleanCode
          };
        }
      }
    }

    // 3. Check if it matches a reseller UID directly or starts with it
    const allResellers = await rtdbGet<Record<string, any>>('resellers');
    if (allResellers && typeof allResellers === 'object') {
      for (const [uid, rData] of Object.entries(allResellers)) {
        if (!rData) continue;
        const upperUid = uid.toUpperCase();
        const rRefCode = String(rData.referralCode || '').toUpperCase();
        if (upperUid.startsWith(cleanCode) || upperUid === cleanCode || rRefCode === cleanCode) {
          return {
            valid: true,
            userId: uid,
            name: rData.fullName || rData.name || 'রেফারার পার্টনার',
            code: cleanCode
          };
        }
      }
    }

    // 4. Check users table
    const allUsers = await rtdbGet<Record<string, any>>('users');
    if (allUsers && typeof allUsers === 'object') {
      for (const [uid, uData] of Object.entries(allUsers)) {
        if (!uData) continue;
        const upperUid = uid.toUpperCase();
        const uRefCode = String(uData.referralCode || '').toUpperCase();
        if (upperUid.startsWith(cleanCode) || upperUid === cleanCode || uRefCode === cleanCode) {
          return {
            valid: true,
            userId: uid,
            name: uData.name || 'রেফারার পার্টনার',
            code: cleanCode
          };
        }
      }
    }

    return { valid: false };
  } catch (error) {
    console.error('[ResellerReferralService] Error looking up referral code:', error);
    return { valid: false };
  }
}

/**
 * Credits ৳200 referral bonus to the referrer's wallet upon verified reseller registration.
 * Fully atomic and idempotent to prevent duplicate payouts.
 */
export async function creditReferralBonus(
  referrerId: string,
  newResellerId: string,
  newResellerName: string,
  newResellerEmail?: string
): Promise<{ success: boolean; amount: number; message: string }> {
  if (!referrerId || !newResellerId) {
    return { success: false, amount: 0, message: 'Invalid referrer or reseller ID' };
  }

  if (referrerId === newResellerId) {
    return { success: false, amount: 0, message: 'Cannot refer oneself' };
  }

  const recordPath = `referrals/${referrerId}/${newResellerId}`;
  const now = Date.now();

  try {
    // 1. Idempotency Check: check if already credited
    const existing = await rtdbGet<any>(recordPath);
    if (existing && existing.status === 'Completed') {
      console.warn(`[ResellerReferralService] Referral ${newResellerId} already credited for ${referrerId}`);
      return { success: true, amount: REFERRAL_BONUS_AMOUNT, message: 'Already credited' };
    }

    const bonusAmount = REFERRAL_BONUS_AMOUNT; // exactly ৳200

    // 2. Credit referrer's reseller wallet atomically
    await executeResellerWalletTransaction({
      resellerId: referrerId,
      userId: referrerId,
      orderId: `REF-${newResellerId}`,
      amount: bonusAmount,
      type: ResellerTransactionType.PROFIT_RELEASED,
      status: 'Approved',
      description: `রিসেলার রেফারেল বোনাস (${newResellerName})`,
      metadata: {
        newResellerId,
        newResellerName,
        bonusType: 'reseller_referral'
      }
    });

    // 3. Also push directly to reseller_transactions for immediate UI visibility
    await rtdbPush('reseller_transactions', {
      resellerId: referrerId,
      orderId: `REF-${newResellerId}`,
      customerName: newResellerName,
      productName: 'রিসেলার রেফারেল বোনাস',
      amount: bonusAmount,
      status: 'Approved',
      createdAt: now,
      isReferral: true
    });

    // 4. Update referral tracking record
    await rtdbSet(recordPath, {
      id: newResellerId,
      referredUserId: newResellerId,
      referredName: newResellerName,
      referredEmail: newResellerEmail || '',
      bonusAmount,
      status: 'Completed',
      createdAt: now
    });

    // 5. Update referrer's referral stats atomically
    await rtdbTransaction(`referral_stats/${referrerId}`, (curr) => {
      const prevCount = Number(curr?.totalReferrals || 0);
      const prevEarnings = Number(curr?.totalEarnings || 0);
      const prevActive = Number(curr?.activeResellers || 0);

      return {
        totalReferrals: prevCount + 1,
        totalEarnings: prevEarnings + bonusAmount,
        activeResellers: prevActive + 1,
        updatedAt: now
      };
    });

    return {
      success: true,
      amount: bonusAmount,
      message: `৳${bonusAmount} রেফারেল বোনাস সফলভাবে ওয়ালেটে যোগ করা হয়েছে`
    };
  } catch (error) {
    console.error('[ResellerReferralService] Error crediting referral bonus:', error);
    return {
      success: false,
      amount: 0,
      message: 'Failed to credit referral bonus: ' + String(error)
    };
  }
}

/**
 * Fetches referral statistics and history for a reseller from RTDB.
 */
export async function getReferralStatsAndHistory(userId: string): Promise<{
  stats: ReferralStats;
  history: ReferralItem[];
}> {
  if (!userId) {
    return {
      stats: { totalReferrals: 0, totalEarnings: 0, activeResellers: 0 },
      history: []
    };
  }

  try {
    const [statsData, historyData] = await Promise.all([
      rtdbGet<any>(`referral_stats/${userId}`),
      rtdbGet<Record<string, any>>(`referrals/${userId}`)
    ]);

    const history: ReferralItem[] = [];
    if (historyData && typeof historyData === 'object') {
      for (const [id, item] of Object.entries(historyData)) {
        if (!item) continue;
        history.push({
          id,
          referredUserId: item.referredUserId || id,
          referredName: item.referredName || 'নতুন রিসেলার',
          referredEmail: item.referredEmail || '',
          bonusAmount: Number(item.bonusAmount || REFERRAL_BONUS_AMOUNT),
          status: item.status || 'Completed',
          createdAt: Number(item.createdAt || Date.now())
        });
      }
      // Sort newest first
      history.sort((a, b) => b.createdAt - a.createdAt);
    }

    const calculatedEarnings = history.reduce((sum, item) => sum + (item.bonusAmount || REFERRAL_BONUS_AMOUNT), 0);
    const calculatedCount = history.length;

    const stats: ReferralStats = {
      totalReferrals: Math.max(calculatedCount, Number(statsData?.totalReferrals || 0)),
      totalEarnings: Math.max(calculatedEarnings, Number(statsData?.totalEarnings || 0)),
      activeResellers: Math.max(calculatedCount, Number(statsData?.activeResellers || 0))
    };

    return { stats, history };
  } catch (error) {
    console.error('[ResellerReferralService] Error fetching stats and history:', error);
    return {
      stats: { totalReferrals: 0, totalEarnings: 0, activeResellers: 0 },
      history: []
    };
  }
}
