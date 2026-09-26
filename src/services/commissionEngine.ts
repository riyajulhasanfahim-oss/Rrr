import { db } from '../lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, updateDoc, increment, runTransaction, setDoc } from 'firebase/firestore';
import { executeResellerWalletTransaction } from './resellerWalletService';
import { ResellerTransactionType } from '../types/resellerWallet';

export interface CommissionRule {
  id: string;
  type: string; // 'direct', 'level', 'vendor', 'reseller', 'matching', 'leadership', 'team_performance', 'monthly', 'cashback', 'promotional', 'festival', 'welcome', 'achievement'
  name: string;
  isActive: boolean;
  percentage?: number;
  fixedAmount?: number;
  level?: number;
  maxDaily?: number;
  maxMonthly?: number;
  maxLifetime?: number;
  qualificationRules?: any;
}

export interface BonusRule {
  id: string;
  type: string; // 'daily', 'weekly', 'monthly', 'rank_achievement', 'team_growth', 'leadership', 'campaign'
  name: string;
  isActive: boolean;
  amount: number;
  qualificationRules?: any;
}

// Ensure default rules exist for the engine to work
export async function initializeDefaultRules() {
  const rulesRef = collection(db, 'commission_rules');
  const snap = await getDocs(rulesRef);
  if (snap.empty) {
    const defaultRules: Partial<CommissionRule>[] = [
      { id: 'direct_1', type: 'direct', name: 'Direct Referral Commission', isActive: true, percentage: 10 },
      { id: 'level_1', type: 'level', name: 'Level 1 Commission', isActive: true, level: 1, percentage: 10 },
      { id: 'level_2', type: 'level', name: 'Level 2 Commission', isActive: true, level: 2, percentage: 5 },
      { id: 'level_3', type: 'level', name: 'Level 3 Commission', isActive: true, level: 3, percentage: 3 },
      { id: 'level_4', type: 'level', name: 'Level 4 Commission', isActive: true, level: 4, percentage: 2 },
      { id: 'level_5', type: 'level', name: 'Level 5 Commission', isActive: true, level: 5, percentage: 1 },
      { id: 'vendor_1', type: 'vendor', name: 'Vendor Commission', isActive: true, percentage: 80 },
      { id: 'reseller_1', type: 'reseller', name: 'Reseller Commission', isActive: true, percentage: 15 },
    ];
    for (const rule of defaultRules) {
      await setDoc(doc(db, 'commission_rules', rule.id!), rule);
    }
  }
}

// Engine to calculate commissions
export async function processSaleCommissions(orderId: string, totalAmount: number, vendorId?: string, resellerId?: string) {
  try {
    // 1. Fetch active commission rules
    const rulesSnap = await getDocs(query(collection(db, 'commission_rules'), where('isActive', '==', true)));
    const activeRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CommissionRule));

    // 2. Process Vendor Commission
    if (vendorId) {
      const vendorRule = activeRules.find(r => r.type === 'vendor');
      if (vendorRule) {
        const amount = vendorRule.percentage ? (totalAmount * vendorRule.percentage) / 100 : (vendorRule.fixedAmount || 0);
        await distributeCommission(vendorId, amount, 'Vendor Commission', orderId, vendorRule.id);
      }
    }

    // 3. Process Reseller Commission
    if (resellerId) {
      const resellerRule = activeRules.find(r => r.type === 'reseller');
      if (resellerRule) {
        const amount = resellerRule.percentage ? (totalAmount * resellerRule.percentage) / 100 : (resellerRule.fixedAmount || 0);
        await distributeCommission(resellerId, amount, 'Reseller Commission', orderId, resellerRule.id);
        
        // 4. Process Multi-Level Network Commissions (Upline)
        await processLevelCommissions(resellerId, totalAmount, activeRules, orderId);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error processing commissions:', error);
    return false;
  }
}

async function processLevelCommissions(userId: string, totalAmount: number, activeRules: CommissionRule[], orderId: string) {
  // Fetch user to get upline
  const userDoc = await getDoc(doc(db, 'mlm_members', userId));
  if (!userDoc.exists()) return;
  
  let currentUserId = userDoc.data()?.parentId;
  let currentLevel = 1;
  
  // Fetch level rules
  const levelRules = activeRules.filter(r => r.type === 'level').sort((a, b) => (a.level || 0) - (b.level || 0));
  
  while (currentUserId && currentLevel <= levelRules.length) {
    const rule = levelRules.find(r => r.level === currentLevel);
    if (rule) {
      // Check qualification rules (mocked for simplicity)
      // e.g. activeDirects >= required
      const amount = rule.percentage ? (totalAmount * rule.percentage) / 100 : (rule.fixedAmount || 0);
      if (amount > 0) {
        await distributeCommission(currentUserId, amount, `Level ${currentLevel} Commission`, orderId, rule.id);
      }
    }
    
    // Move up
    const nextUserDoc = await getDoc(doc(db, 'mlm_members', currentUserId));
    if (!nextUserDoc.exists()) break;
    currentUserId = nextUserDoc.data()?.parentId;
    currentLevel++;
  }
}

async function distributeCommission(userId: string, amount: number, description: string, referenceId: string, ruleId: string) {
  if (amount <= 0) return;
  
  // 1. Update reseller wallet atomically in RTDB
  try {
    await executeResellerWalletTransaction({
      resellerId: userId,
      userId,
      orderId: referenceId,
      amount,
      type: ResellerTransactionType.PROFIT_RELEASED,
      status: 'Approved',
      description,
      metadata: { ruleId, referenceId }
    });
  } catch (err) {
    console.warn('Error updating reseller wallet in RTDB:', err);
  }

  // 2. Log legacy transaction record if needed
  try {
    const txRef = doc(collection(db, 'commission_transactions'));
    await setDoc(txRef, {
      userId,
      amount,
      description,
      referenceId,
      ruleId,
      status: 'Paid',
      createdAt: Date.now()
    });
  } catch (_) {}
}

// Engine to process bonuses
export async function processBonuses(userId: string) {
  try {
    const rulesSnap = await getDocs(query(collection(db, 'bonus_rules'), where('isActive', '==', true)));
    const activeRules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as BonusRule));
    
    for (const rule of activeRules) {
      // Evaluate rule conditions
      const qualified = evaluateBonusRule(rule, userId);
      if (qualified) {
         await awardBonus(userId, rule.amount, rule.name, rule.id);
      }
    }
  } catch (error) {
    console.error('Error processing bonuses:', error);
  }
}

function evaluateBonusRule(rule: BonusRule, userId: string) {
  // Complex rule evaluation goes here
  return false;
}

async function awardBonus(userId: string, amount: number, description: string, ruleId: string) {
  if (amount <= 0) return;
  
  // 1. Update reseller wallet atomically in RTDB
  try {
    await executeResellerWalletTransaction({
      resellerId: userId,
      userId,
      amount,
      type: ResellerTransactionType.PROFIT_RELEASED,
      status: 'Approved',
      description,
      metadata: { ruleId }
    });
  } catch (err) {
    console.warn('Error updating reseller wallet in RTDB:', err);
  }

  // 2. Log bonus transaction record if needed
  try {
    const txRef = doc(collection(db, 'bonus_transactions'));
    await setDoc(txRef, {
      userId,
      amount,
      description,
      ruleId,
      status: 'Paid',
      createdAt: Date.now()
    });
  } catch (_) {}
}
