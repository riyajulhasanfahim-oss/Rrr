import {
  PaymentVerificationRecord,
  CreatePaymentVerificationInput,
  UpdateVerificationStatusInput,
  PaymentVerificationStatus,
  PaymentUserType,
  PaymentMethodType
} from '../types/paymentVerification';
import { RTDB_BASE_URL as BASE_URL } from '../lib/firebase';

const RTDB_BASE_URL = `${BASE_URL}/payments`;

/**
 * Normalizes payment method string into standard lowercase enum
 */
export function normalizePaymentMethod(method: string): PaymentMethodType {
  const m = (method || '').toLowerCase().trim();
  if (m.includes('bkash')) return 'bkash';
  if (m.includes('nagad')) return 'nagad';
  if (m.includes('rocket')) return 'rocket';
  if (m.includes('upay')) return 'upay';
  return 'bkash';
}

/**
 * Generates a unique, standardized payment ID
 */
export function generatePaymentId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `PAY-${timestamp}-${randomStr}`;
}

/**
 * Fetches a single payment record from Firebase Realtime Database by Transaction ID
 * Single Source of Truth: Realtime Database 'payments' node
 */
export async function getPaymentVerificationByTransactionId(
  transactionId: string
): Promise<{ pushKey: string; data: any } | null> {
  const cleanTrxId = (transactionId || '').trim().replace(/\s+/g, '').toUpperCase();
  if (!cleanTrxId) return null;

  try {
    const res = await fetch(`${RTDB_BASE_URL}.json`);
    if (!res.ok) return null;
    const payments = await res.json();
    if (!payments || typeof payments !== 'object') return null;

    for (const [key, item] of Object.entries<any>(payments)) {
      if (item && item.transactionId) {
        const itemTrx = String(item.transactionId).trim().replace(/\s+/g, '').toUpperCase();
        if (itemTrx === cleanTrxId) {
          return { pushKey: key, data: item };
        }
      }
    }
  } catch (err) {
    console.warn('[PAYMENT-SERVICE] Error fetching payment by TrxID from RTDB:', err);
  }
  return null;
}

/**
 * Creates a payment verification record in Firebase Realtime Database (payments node)
 * Default status is strictly 'SYNCED'.
 * NEVER sets verifiedAt upon creation.
 */
export async function createPaymentVerificationRecord(
  input: CreatePaymentVerificationInput
): Promise<PaymentVerificationRecord> {
  const paymentId = input.paymentId || generatePaymentId();
  const cleanTrxId = (input.transactionId || '').trim().replace(/\s+/g, '').toUpperCase();
  const normalizedMethod = normalizePaymentMethod(input.paymentMethod);
  const now = Date.now();

  const record: PaymentVerificationRecord = {
    paymentId,
    invoiceId: input.invoiceId,
    userId: input.userId,
    userType: input.userType,
    paymentMethod: normalizedMethod,
    expectedAmount: Number(input.expectedAmount) || 0,
    transactionId: cleanTrxId,
    status: 'pending',
    senderNumber: input.senderNumber || null,
    receivedAmount: null,
    verifiedAt: null,
    createdAt: now,
    rejectionReason: null,
    ...(input.metadata ? { metadata: input.metadata } : {})
  };

  try {
    // Save to RTDB payments node
    await fetch(`${RTDB_BASE_URL}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: record.expectedAmount,
        paymentMethod: normalizedMethod,
        receivedAt: now,
        senderNumber: record.senderNumber || '',
        status: 'SYNCED',
        syncedAt: now,
        transactionId: cleanTrxId
      })
    });
  } catch (err) {
    console.warn('[PAYMENT-SERVICE] Error writing payment record to RTDB:', err);
  }

  return record;
}

/**
 * Updates payment verification status in Firebase Realtime Database (payments/{pushKey})
 * Only writes verifiedAt during final successful verification.
 */
export async function updatePaymentVerificationStatus(
  pushKeyOrTrxId: string,
  update: UpdateVerificationStatusInput & { pushKey?: string }
): Promise<boolean> {
  let targetPushKey = update.pushKey;

  if (!targetPushKey) {
    const existing = await getPaymentVerificationByTransactionId(pushKeyOrTrxId);
    if (existing) {
      targetPushKey = existing.pushKey;
    }
  }

  if (!targetPushKey) return false;

  const patchBody: any = {
    status: update.status === 'verified' ? 'VERIFIED' : 'SYNCED'
  };

  if (update.status === 'verified') {
    patchBody.verifiedAt = Date.now();
  }

  try {
    const res = await fetch(`${RTDB_BASE_URL}/${targetPushKey}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody)
    });
    return res.ok;
  } catch (err) {
    console.warn('[PAYMENT-SERVICE] Error updating payment status in RTDB:', err);
    return false;
  }
}

/**
 * Lists payment verification records directly from Firebase Realtime Database (payments node)
 */
export async function listPaymentVerifications(options?: { limitCount?: number }): Promise<PaymentVerificationRecord[]> {
  try {
    const res = await fetch(`${RTDB_BASE_URL}.json`);
    if (!res.ok) return [];
    const payments = await res.json();
    if (!payments || typeof payments !== 'object') return [];

    const list: PaymentVerificationRecord[] = [];
    for (const [key, item] of Object.entries<any>(payments)) {
      if (item && item.transactionId) {
        list.push({
          paymentId: key,
          invoiceId: item.verifiedFor?.invoiceId || `INV-${item.transactionId}`,
          userId: item.verifiedFor?.userId || 'system',
          userType: item.verifiedFor?.userType || 'customer',
          paymentMethod: normalizePaymentMethod(item.paymentMethod || 'bkash'),
          expectedAmount: Number(item.amount || 0),
          receivedAmount: Number(item.amount || 0),
          transactionId: String(item.transactionId).trim().toUpperCase(),
          status: item.status === 'VERIFIED' ? 'verified' : 'pending',
          senderNumber: item.senderNumber || null,
          verifiedAt: item.verifiedAt || null,
          createdAt: item.receivedAt || item.syncedAt || Date.now(),
          rejectionReason: null
        });
      }
    }
    return list.slice(0, options?.limitCount || 50);
  } catch (err) {
    console.warn('[PAYMENT-SERVICE] Error listing payments from RTDB:', err);
    return [];
  }
}
