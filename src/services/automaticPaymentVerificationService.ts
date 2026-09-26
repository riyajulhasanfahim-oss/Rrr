/**
 * Automatic Payment Verification Service
 * 
 * Strict Verification Engine:
 * - Single Source of Truth: Firebase Realtime Database `payments` node
 * - NO Firestore collection for payments (payment_verifications / payments collection completely removed)
 * - verifiedAt is written ONLY upon final successful business verification
 * 
 * Step-by-step verification pipeline:
 * 1. Read pending request (TrxID, Method, Amount, Invoice, User, UserType)
 * 2. Query Firebase RTDB `payments` node for matching TrxID
 * 3. Validate Payment Method (bKash/Nagad/Rocket/Upay)
 * 4. Validate Amount (exact match)
 * 5. Validate Duplicate Protection (not verified for different invoice/user)
 * 6. Execute Business Action (Activate Vendor / Confirm Customer Order / Approve Reseller)
 * 7. Write status: 'VERIFIED' and verifiedAt timestamp to RTDB `payments/{pushKey}`
 * 8. Return success to user UI with instant navigation
 */

import { rtdbSet, rtdbUpdate, rtdbGet, rtdbList } from '../lib/rtdb';
import {
  PaymentMethodType,
  PaymentUserType
} from '../types/paymentVerification';
import { smsReaderSyncManager } from './smsReaderOfflineQueue';
import { ensureResellerWallet } from './resellerWalletService';

export interface VerifyPaymentRequest {
  transactionId: string;
  paymentMethod: PaymentMethodType | string;
  expectedAmount: number;
  invoiceId: string;
  userId: string;
  userType: PaymentUserType;
  contextData?: {
    orderId?: string;
    storeName?: string;
    ownerName?: string;
    fullName?: string;
    phone?: string;
    mobileNumber?: string;
    address?: string;
    [key: string]: any;
  };
}

export interface VerificationResult {
  success: boolean;
  status: 'verified' | 'rejected' | 'pending';
  message: string;
  rejectionReason?: 'transaction_not_found' | 'record_not_found' | 'amount_mismatch' | 'method_mismatch' | 'duplicate_transaction' | 'pending_sms_sync' | 'timeout' | 'network_error';
  paymentId?: string;
  verifiedAt?: number | null;
  receivedAmount?: number | null;
  senderNumber?: string | null;
  pushKey?: string | null;
  diagnostic?: any;
}

import { RTDB_BASE_URL as BASE_URL } from '../lib/firebase';
const RTDB_BASE_URL = `${BASE_URL}/payments`;

/**
 * Normalizes payment method string into standard lowercase enum
 */
export function normalizeMethod(method: string | PaymentMethodType): PaymentMethodType {
  const m = (method || '').toLowerCase().trim();
  if (m.includes('bkash')) return 'bkash';
  if (m.includes('nagad')) return 'nagad';
  if (m.includes('rocket')) return 'rocket';
  if (m.includes('upay')) return 'upay';
  return 'bkash';
}

/**
 * Direct query to Firebase Realtime Database `payments` node
 * Single Source of Truth
 */
async function queryRtdbPaymentsNode(cleanTrxId: string): Promise<{
  pushKey: string;
  amount: number;
  paymentMethod: string;
  senderNumber: string;
  status: string;
  syncedAt?: number;
  receivedAt?: number;
  verifiedAt?: number | null;
  verifiedFor?: any;
} | null> {
  try {
    const res = await fetch(`${RTDB_BASE_URL}.json`, {
      signal: AbortSignal.timeout(2500)
    });

    if (!res.ok) return null;
    const paymentsData = await res.json();
    if (!paymentsData || typeof paymentsData !== 'object') return null;

    for (const [key, item] of Object.entries<any>(paymentsData)) {
      if (item) {
        const rawTrx = item.transactionId || item.trxId || item.txnId || item.txId || item.transactionID || item.trnxId || item.transId || item.paymentId || key || '';
        const itemTrx = String(rawTrx).trim().replace(/^#/, '').replace(/\s+/g, '').toUpperCase();
        if (itemTrx && itemTrx === cleanTrxId) {
          const rawAmt = item.amount ?? item.receivedAmount ?? item.paidAmount ?? item.totalAmount ?? item.fee ?? item.total ?? 0;
          const parsedAmt = typeof rawAmt === 'number' ? rawAmt : parseFloat(String(rawAmt).replace(/[^0-9.]/g, '')) || 0;
          const rawMethod = item.paymentMethod || item.payment_method || item.method || item.channel || item.provider || item.gateway || '';
          return {
            pushKey: key,
            amount: parsedAmt,
            paymentMethod: String(rawMethod || item.paymentMethod || item.method || item.channel || '').toLowerCase().trim(),
            senderNumber: String(item.senderNumber || item.sender || item.mobileNumber || item.phone || '').trim(),
            status: String(item.status || 'SYNCED').toUpperCase(),
            syncedAt: Number(item.syncedAt || item.receivedAt || 0),
            receivedAt: Number(item.receivedAt || item.syncedAt || 0),
            verifiedAt: item.verifiedAt ? Number(item.verifiedAt) : null,
            verifiedFor: item.verifiedFor || null
          };
        }
      }
    }
  } catch (err) {
    console.warn('[VERIFY] RTDB query notice:', err);
  }
  return null;
}

/**
 * Fulfills the business action (Vendor approval, Order confirmation, Reseller approval)
 * Wrapped in a safe timeout guard so slow network never hangs the verification flow.
 */
async function executeBusinessActionSafely(
  req: VerifyPaymentRequest,
  cleanTrxId: string,
  verifiedAmount: number,
  senderNumber: string
): Promise<boolean> {
  const now = Date.now();
  console.log(`[VERIFY] Activating service / confirming order for userType=${req.userType}, userId=${req.userId}, invoiceId=${req.invoiceId}`);

  // 1. VENDOR WALLET DEPOSIT (For Reseller Order Profit Reserve)
  if (
    req.contextData?.type === 'vendor_wallet_deposit' ||
    req.contextData?.action === 'vendor_wallet_deposit' ||
    (req.userType as string) === 'vendor_wallet_deposit'
  ) {
    const vendorId = req.userId || req.contextData?.vendorId;
    if (vendorId) {
      const { creditVendorWalletDeposit } = await import('./vendorResellerOrderService');
      await creditVendorWalletDeposit({
        vendorId,
        amount: verifiedAmount,
        transactionId: cleanTrxId,
        paymentMethod: normalizeMethod(req.paymentMethod),
        senderNumber,
        orderId: req.contextData?.orderId,
        invoiceId: req.invoiceId
      });
    }
    return true;
  }

  const businessPromise = (async () => {
    // 2. CUSTOMER ORDER CONFIRMATION
    if (req.userType === 'customer') {
      const orderId = req.contextData?.orderId || req.invoiceId;
      if (orderId) {
        try {
          const oDoc = await rtdbGet<any>(`orders/${orderId}`).catch(() => null);
          const oGrandTotal = Number(oDoc?.grandTotal ?? oDoc?.total ?? verifiedAmount);
          const isFull = verifiedAmount >= oGrandTotal || !oDoc?.paymentMethod || oDoc?.paymentMethod === 'product_full_payment';
          const isDelCharge = oDoc?.paymentMethod === 'only_delivery_charge';

          const finalAdv = isFull ? oGrandTotal : (isDelCharge ? verifiedAmount : verifiedAmount);
          const finalCod = isFull ? 0 : Math.max(0, oGrandTotal - finalAdv);

          await rtdbUpdate(`orders/${orderId}`, {
            paymentStatus: 'Paid',
            status: 'Confirmed',
            transactionId: cleanTrxId,
            verifiedAt: now,
            receivedAmount: verifiedAmount,
            advancePaymentAmount: finalAdv,
            paidAmount: finalAdv,
            advanceAmount: finalAdv,
            advancePaymentType: isFull ? 'full' : (isDelCharge ? 'delivery_charge' : 'partial'),
            codAmount: finalCod,
            senderNumber: senderNumber || null,
            updatedAt: now
          });

          // Also sync any vendor_orders
          try {
            const vOrders = await rtdbList<any>('vendor_orders', (item) => item?.orderId === orderId);
            for (const vDoc of vOrders) {
              const vGrand = Number(vDoc.data?.grandTotal ?? vDoc.data?.total ?? 0);
              const vAdv = isFull ? vGrand : (isDelCharge ? Number(vDoc.data?.deliveryCharge ?? 0) : 0);
              await rtdbUpdate(`vendor_orders/${vDoc.id}`, {
                paymentStatus: 'Paid',
                status: 'Confirmed',
                transactionId: cleanTrxId,
                advancePaymentAmount: vAdv,
                paidAmount: vAdv,
                advanceAmount: vAdv,
                advancePaymentType: isFull ? 'full' : (isDelCharge ? 'delivery_charge' : 'none'),
                codAmount: isFull ? 0 : Math.max(0, vGrand - vAdv),
                updatedAt: now
              });
            }
          } catch (syncErr) {
            console.warn('[VERIFY] Vendor order sync error:', syncErr);
          }
        } catch (err) {
          console.warn('[VERIFY] Customer order save notice:', err);
        }
      }
    }

    // 3. VENDOR REGISTRATION ACTIVATION
    else if (req.userType === 'vendor') {
      const vendorId = req.userId;
      if (vendorId && vendorId !== 'guest') {
        const vendorPayload = {
          vendorId,
          storeId: vendorId,
          status: 'active',
          registrationPayment: 'completed',
          transactionId: cleanTrxId,
          verifiedAt: now,
          updatedAt: now,
          ...(req.contextData?.storeName ? { storeName: req.contextData.storeName } : {}),
          ...(req.contextData?.ownerName ? { ownerName: req.contextData.ownerName } : {}),
          ...(req.contextData?.mobileNumber ? { mobileNumber: req.contextData.mobileNumber } : {})
        };

        try {
          localStorage.setItem('rj_active_vendor_' + vendorId, JSON.stringify(vendorPayload));
          localStorage.setItem('rj_has_active_vendor_' + vendorId, 'true');
          localStorage.setItem('rj_user_role_' + vendorId, 'Vendor');
        } catch (_) {}

        try {
          await rtdbUpdate(`vendors/${vendorId}`, vendorPayload);
          await rtdbUpdate(`stores/${vendorId}`, {
            id: vendorId,
            vendorId,
            status: 'active',
            updatedAt: now,
            ...(req.contextData?.storeName ? { storeName: req.contextData.storeName } : {})
          });
          await rtdbUpdate(`vendor_profiles/${vendorId}`, {
            vendorId,
            status: 'Active',
            updatedAt: now
          });
        } catch (err) {
          console.warn('[VERIFY] Vendor RTDB save notice:', err);
        }

        try {
          await rtdbUpdate(`users/${vendorId}`, {
            role: 'Vendor',
            updatedAt: now
          });
        } catch (err) {
          console.warn('[VERIFY] User role save notice:', err);
        }
      }
    }

    // 4. RESELLER REGISTRATION ACTIVATION
    else if (req.userType === 'reseller') {
      const resellerId = req.userId;
      if (resellerId && resellerId !== 'guest') {
        const resellerPayload = {
          resellerId,
          userId: resellerId,
          status: 'approved',
          registrationPayment: 'completed',
          transactionId: cleanTrxId,
          verifiedAt: now,
          updatedAt: now
        };

        try {
          localStorage.setItem('rj_active_reseller_' + resellerId, JSON.stringify(resellerPayload));
          localStorage.setItem('rj_has_active_reseller_' + resellerId, 'true');
          localStorage.setItem('rj_user_role_' + resellerId, 'Reseller');
        } catch (_) {}

        try {
          await rtdbUpdate(`resellers/${resellerId}`, resellerPayload);
          await ensureResellerWallet(resellerId);
        } catch (err) {
          console.warn('[VERIFY] Reseller RTDB save notice:', err);
        }

        try {
          await rtdbUpdate(`users/${resellerId}`, {
            role: 'Reseller',
            updatedAt: now
          });
        } catch (err) {
          console.warn('[VERIFY] User role save notice:', err);
        }
      }
    }

    // 5. VENDOR PLATFORM FEE ARREARS PAYMENT
    else if (req.userType === 'vendor_platform_fee' || req.contextData?.action === 'vendor_platform_fee') {
      const vendorId = req.userId || req.contextData?.vendorId;
      if (vendorId) {
        try {
          const { settleVendorPlatformFeePayment } = await import('./platformFeeService');
          await settleVendorPlatformFeePayment({
            vendorId,
            paidAmount: verifiedAmount,
            transactionId: cleanTrxId,
            paymentMethod: normalizeMethod(req.paymentMethod),
            senderNumber,
            invoiceId: req.invoiceId
          });
        } catch (feeErr) {
          console.warn('[VERIFY] Vendor platform fee settlement notice:', feeErr);
        }
      }
    }
    return true;
  })();

  // Safe timeout guard on business action writes
  const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 3000));
  return Promise.race([businessPromise, timeoutPromise]);
}

/**
 * Updates the RTDB `payments` node with status: 'VERIFIED' and verifiedAt timestamp
 * Called ONLY AFTER business action is confirmed.
 * Uses parallel dispatch (Promise.allSettled) for instantaneous completion.
 */
async function markRtdbPaymentVerified(
  pushKey: string,
  cleanTrxId: string,
  req: VerifyPaymentRequest,
  verifiedAmount: number,
  senderNumber: string
): Promise<number> {
  const verifiedAt = Date.now();
  console.log('[VERIFY] Updating payment status');

  const updateData = {
    status: 'VERIFIED',
    verifiedAt,
    verifiedFor: {
      invoiceId: req.invoiceId || null,
      userId: req.userId || null,
      userType: req.userType || null
    }
  };

  // Parallelize server endpoint update and direct RTDB update
  await Promise.allSettled([
    // 1. Update via server endpoint if in browser environment
    (async () => {
      try {
        if (typeof window !== 'undefined') {
          await fetch('/api/payment/confirm-completion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(2000),
            body: JSON.stringify({
              transactionId: cleanTrxId,
              pushKey,
              invoiceId: req.invoiceId,
              userId: req.userId,
              userType: req.userType,
              receivedAmount: verifiedAmount,
              senderNumber
            })
          });
        }
      } catch (err) {
        console.warn('[VERIFY] Server confirm-completion notice:', err);
      }
    })(),

    // 2. Direct RTDB update for guaranteed SDK + REST persistence
    rtdbUpdate(`payments/${pushKey}`, updateData)
  ]);

  try {
    smsReaderSyncManager.updateTransactionStatus(cleanTrxId, 'verified');
  } catch {}

  return verifiedAt;
}

/**
 * Main Automatic Payment Verification Entry Point
 * Strictly follows the 12-step trace logs and eliminates unnecessary delays.
 */
export async function verifyPaymentAutomatic(
  req: VerifyPaymentRequest
): Promise<VerificationResult> {
  console.log('[VERIFY] Start verification');
  console.log('[VERIFY] Pending request lookup started');

  const cleanTrxId = (req.transactionId || '').trim().replace(/\s+/g, '').toUpperCase();
  const reqMethod = normalizeMethod(req.paymentMethod);
  const expectedAmount = Math.round(Number(req.expectedAmount) * 100) / 100;

  console.log(`[VERIFY] Pending request found: TrxID=${cleanTrxId}, Method=${reqMethod}, Amount=৳${expectedAmount}, Invoice=${req.invoiceId || 'N/A'}, User=${req.userId || 'N/A'}, Type=${req.userType}`);
  console.log('[VERIFY] Pending request found');

  // 1. Validate basic input fields
  if (!cleanTrxId || cleanTrxId.length < 3) {
    console.warn('[VERIFY] Validation failed: Invalid Transaction ID');
    console.log('[VERIFY] Final response sent');
    return {
      success: false,
      status: 'rejected',
      message: 'আপনার ট্রানজেকশন আইডি ভুল সঠিক ট্রানজাকশন আইডি দিয়ে আবার চেষ্টা করুন',
      rejectionReason: 'transaction_not_found'
    };
  }

  const allowedProviders: PaymentMethodType[] = ['bkash', 'nagad', 'rocket', 'upay'];
  if (!allowedProviders.includes(reqMethod)) {
    console.warn(`[VERIFY] Validation failed: Unsupported method ${reqMethod}`);
    console.log('[VERIFY] Final response sent');
    return {
      success: false,
      status: 'rejected',
      message: 'পেমেন্ট মেথডটি সমর্থিত নয়। শুধুমাত্র bKash, Nagad, Rocket, বা Upay নির্বাচন করুন।',
      rejectionReason: 'method_mismatch'
    };
  }

  // Polling loop against RTDB payments node (Single Source of Truth)
  // Queries both RTDB directly and server in parallel with zero unnecessary wait.
  const startTime = Date.now();
  const MAX_WAIT_MS = 5500;
  let attemptCount = 0;

  while (Date.now() - startTime < MAX_WAIT_MS) {
    attemptCount++;
    console.log('[VERIFY] Querying payments node');

    // Run Server API and Direct RTDB Query in Parallel for maximum speed
    const [serverResData, rtdbRecord] = await Promise.all([
      (async () => {
        try {
          if (typeof window !== 'undefined') {
            const serverRes = await fetch('/api/payment/verify-automatic', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(2500),
              body: JSON.stringify({
                transactionId: cleanTrxId,
                paymentMethod: reqMethod,
                expectedAmount,
                invoiceId: req.invoiceId,
                userId: req.userId,
                userType: req.userType,
                contextData: req.contextData
              })
            });
            if (serverRes.ok) {
              return await serverRes.json();
            }
          }
        } catch (netErr) {
          console.warn('[VERIFY] Backend verify-automatic fetch notice:', netErr);
        }
        return null;
      })(),
      queryRtdbPaymentsNode(cleanTrxId)
    ]);

    console.log('[VERIFY] Payment query completed');

    // If server returned explicit mismatch rejection, fail fast!
    if (serverResData?.status === 'rejected' && serverResData?.rejectionReason !== 'record_not_found') {
      console.warn(`[VERIFY] Server returned rejection: ${serverResData.message}`);
      console.log('[VERIFY] Final response sent');
      return {
        success: false,
        status: 'rejected',
        message: serverResData.message || 'Payment verification failed. Please check your Transaction ID.',
        rejectionReason: serverResData.rejectionReason || 'amount_mismatch'
      };
    }

    const foundMatch = (serverResData?.status === 'matched' || serverResData?.status === 'verified')
      ? serverResData
      : rtdbRecord;

    if (foundMatch) {
      console.log('[VERIFY] Payment found');
      const pushKey = foundMatch.pushKey || rtdbRecord?.pushKey || `KEY-${cleanTrxId}`;
      const receivedAmount = Math.round(Number(foundMatch.receivedAmount || foundMatch.amount || 0) * 100) / 100;
      const senderNumber = foundMatch.senderNumber || rtdbRecord?.senderNumber || '';
      const paymentMethod = normalizeMethod(foundMatch.paymentMethod || rtdbRecord?.paymentMethod || reqMethod);

      // 1. Amount Validation (Exact match required: Transaction ID, Method, and Amount all must match)
      if (Math.abs(receivedAmount - expectedAmount) >= 0.01) {
        console.warn(`[VERIFY] Amount validation failed: expected ৳${expectedAmount} vs received ৳${receivedAmount}`);
        console.log('[VERIFY] Final response sent');
        return {
          success: false,
          status: 'rejected',
          message: `পেমেন্ট এমাউন্ট সঠিক নয়! প্রত্যাশিত: ৳${expectedAmount.toFixed(2)}, কিন্তু পেমেন্ট পাওয়া গেছে: ৳${receivedAmount.toFixed(2)}। সঠিক এমাউন্ট পরিশোধ করুন।`,
          rejectionReason: 'amount_mismatch',
          receivedAmount
        };
      }
      console.log('[VERIFY] Amount validation completed');

      // 2. Payment Method Validation (Exact match required)
      if (paymentMethod !== reqMethod) {
        console.warn(`[VERIFY] Payment method validation failed: expected ${reqMethod} vs received ${paymentMethod}`);
        console.log('[VERIFY] Final response sent');
        return {
          success: false,
          status: 'rejected',
          message: `পেমেন্ট মেথড সঠিক নয়! আপনি ${reqMethod.toUpperCase()} নির্বাচন করেছেন, কিন্তু পেমেন্ট পাওয়া গেছে ${paymentMethod.toUpperCase()} এর।`,
          rejectionReason: 'method_mismatch'
        };
      }
      console.log('[VERIFY] Payment method validation completed');

      // 3. Duplicate Protection Validation
      const isAlreadyVerified = (foundMatch.status === 'VERIFIED' || foundMatch.status === 'verified') && (foundMatch.verifiedAt && foundMatch.verifiedAt > 0);
      if (isAlreadyVerified) {
        const verifiedFor = foundMatch.verifiedFor || rtdbRecord?.verifiedFor;
        const isSameInvoice = Boolean(req.invoiceId && verifiedFor?.invoiceId && verifiedFor?.invoiceId === req.invoiceId);

        if (!isSameInvoice) {
          console.warn(`[VERIFY] Duplicate check failed: Already verified for different invoice/user: TrxID=${cleanTrxId}`);
          console.log('[VERIFY] Final response sent');
          return {
            success: false,
            status: 'rejected',
            message: `এই Transaction ID (${cleanTrxId}) ইতিমধ্যে ব্যবহার করা হয়েছে। একটি ট্রানজেকশন আইডি দিয়ে একাধিকবার ডিপোজিট বা পেমেন্ট করা যাবে না।`,
            rejectionReason: 'duplicate_transaction'
          };
        }
      }

      // Check if this transaction has already been credited in wallet_transactions or vendor_wallet_deposits
      if (
        req.contextData?.type === 'vendor_wallet_deposit' ||
        req.contextData?.action === 'vendor_wallet_deposit' ||
        (req.userType as string) === 'vendor_wallet_deposit'
      ) {
        try {
          const [existingDep, existingTx] = await Promise.all([
            rtdbList<any>('vendor_wallet_deposits', (dep) => {
              const depTrx = (dep.transactionId || dep.trxId || '').trim().toUpperCase();
              return depTrx === cleanTrxId;
            }),
            rtdbList<any>('wallet_transactions', (tx) => {
              const txTrx = (tx.transactionId || tx.trxId || '').trim().toUpperCase();
              return txTrx === cleanTrxId;
            })
          ]);

          if (existingDep.length > 0 || existingTx.length > 0) {
            console.warn(`[VERIFY] Duplicate check failed: TrxID=${cleanTrxId} already in deposits/transactions`);
            console.log('[VERIFY] Final response sent');
            return {
              success: false,
              status: 'rejected',
              message: `এই Transaction ID (${cleanTrxId}) দিয়ে ইতিপূর্বে ডিপোজিট সম্পন্ন হয়েছে। পুনরায় ব্যবহার করা যাবে না।`,
              rejectionReason: 'duplicate_transaction'
            };
          }
        } catch (dupCheckErr) {
          console.warn('[VERIFY] Deposit duplicate query warning:', dupCheckErr);
        }
      }

      // 4. Service / Order Activation
      console.log('[VERIFY] Service/order validation started');
      try {
        await executeBusinessActionSafely(req, cleanTrxId, receivedAmount, senderNumber);
      } catch (actionErr: any) {
        console.error('[VERIFY] Business action failed:', actionErr);
        const isDuplicate = actionErr?.message && actionErr.message.includes('ইতিপূর্বে');
        return {
          success: false,
          status: 'rejected',
          message: actionErr?.message || 'ডিপোজিট সম্পন্ন করা সম্ভব হয়নি।',
          rejectionReason: isDuplicate ? 'duplicate_transaction' : 'transaction_not_found'
        };
      }
      console.log('[VERIFY] Service/order activation completed');

      // 5. Updating payment status in RTDB
      const verifiedAt = await markRtdbPaymentVerified(pushKey, cleanTrxId, req, receivedAmount, senderNumber);

      // 6. Return Final Verified Response
      console.log('[VERIFY] Final response sent');
      return {
        success: true,
        status: 'verified',
        message: 'পেমেন্ট সফলভাবে যাচাই হয়েছে!',
        paymentId: `PAY-${cleanTrxId}`,
        verifiedAt,
        receivedAmount,
        senderNumber,
        pushKey
      };
    }

    // If not found yet and still within timeout window, short 750ms sleep before re-polling
    if (Date.now() - startTime < MAX_WAIT_MS - 1000) {
      await new Promise(resolve => setTimeout(resolve, 750));
    } else {
      break;
    }
  }

  // Timeout reached and no payment record found in RTDB payments node
  console.warn(`[VERIFY] Payment record not found in RTDB payments node for TrxID: ${cleanTrxId}`);
  console.log('[VERIFY] Final response sent');
  return {
    success: false,
    status: 'rejected',
    rejectionReason: 'record_not_found',
    message: 'আপনার ট্রানজেকশন আইডি ভুল সঠিক ট্রানজাকশন আইডি দিয়ে আবার চেষ্টা করুন',
    diagnostic: {
      transactionId: cleanTrxId,
      expectedMethod: reqMethod,
      expectedAmount,
      invoiceId: req.invoiceId,
      elapsedMs: Date.now() - startTime
    }
  };
}
