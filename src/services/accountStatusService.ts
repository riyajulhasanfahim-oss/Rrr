import { rtdbGet, rtdbUpdate } from '../lib/rtdb';
import { isStoreDeletedFromCache } from './storeCache';

export interface AccountStatusResult {
  hasActiveVendor: boolean;
  hasActiveReseller: boolean;
  vendorDoc?: any;
  vendorData?: any;
  resellerDoc?: any;
  resellerData?: any;
  vendorId?: string;
  resellerId?: string;
  isPendingVendor?: boolean;
  isPendingReseller?: boolean;
}

const statusCache = new Map<string, { result: AccountStatusResult; time: number }>();
const inflightStatusChecks = new Map<string, Promise<AccountStatusResult>>();

export function clearAccountStatusCache(key?: string) {
  if (key) {
    statusCache.delete(key.toLowerCase());
  } else {
    statusCache.clear();
  }
}

/**
 * Checks whether an exact Gmail/email or UID has an active Vendor or active Reseller
 * in Firebase Realtime Database.
 * Cloud Firestore is NEVER queried.
 */
export async function checkAccountStatus(
  email: string | null | undefined,
  uid?: string | null
): Promise<AccountStatusResult> {
  const cacheKey = `${(uid || '').trim()}::${(email || '').toLowerCase().trim()}`;
  if (!cacheKey.replace('::', '')) {
    return {
      hasActiveVendor: false,
      hasActiveReseller: false,
      isPendingVendor: false,
      isPendingReseller: false,
    };
  }

  const cached = statusCache.get(cacheKey);
  if (cached && (Date.now() - cached.time) < 4000) {
    return cached.result;
  }

  const existingInflight = inflightStatusChecks.get(cacheKey);
  if (existingInflight) {
    return await existingInflight;
  }

  const checkPromise = (async (): Promise<AccountStatusResult> => {
    try {
      const res = await executeAccountStatusCheck(email, uid);
      statusCache.set(cacheKey, { result: res, time: Date.now() });
      return res;
    } finally {
      inflightStatusChecks.delete(cacheKey);
    }
  })();

  inflightStatusChecks.set(cacheKey, checkPromise);
  return await checkPromise;
}

async function executeAccountStatusCheck(
  email: string | null | undefined,
  uid?: string | null
): Promise<AccountStatusResult> {
  const result: AccountStatusResult = {
    hasActiveVendor: false,
    hasActiveReseller: false,
    isPendingVendor: false,
    isPendingReseller: false,
  };

  // Initialize strictly false until authoritative RTDB verifies it
  result.hasActiveVendor = false;
  result.hasActiveReseller = false;

  if (!email && !uid) return result;

  const rawEmail = email ? email.trim() : '';
  const lowerEmail = rawEmail.toLowerCase();

  const isStatusActive = (data: any) => {
    if (!data) return false;
    const status = (data.status || '').toLowerCase();
    if (status === 'active' || status === 'approved' || status === 'vacation') {
      if (data.planExpiresAt && typeof data.planExpiresAt === 'number') {
        if (data.planExpiresAt <= Date.now()) {
          return false;
        }
      }
      // Registration fee or payment must be completed
      const isPaid = Boolean(
        data.registrationPayment === 'completed' ||
        data.transactionId ||
        data.verifiedAt ||
        data.paymentMethod ||
        data.registrationFee === 0
      );
      return isPaid;
    }
    return false;
  };

  // 1. CHECK VENDOR
  try {
    // Check if explicitly marked deleted in RTDB deleted_vendors or client blacklist
    let isExplicitlyDeleted = false;
    if (uid) {
      if (isStoreDeletedFromCache(uid)) {
        isExplicitlyDeleted = true;
      } else {
        const deletedRecord = await rtdbGet<any>(`deleted_vendors/${uid}`).catch(() => null);
        if (deletedRecord) isExplicitlyDeleted = true;
      }
    }

    if (isExplicitlyDeleted) {
      result.hasActiveVendor = false;
      result.isPendingVendor = false;
      result.vendorDoc = null;
      result.vendorData = null;
      result.vendorId = undefined;
      if (uid) {
        try {
          localStorage.removeItem('rj_has_active_vendor_' + uid);
          localStorage.removeItem('rj_active_vendor_' + uid);
          localStorage.removeItem('rj_vendor_profile_' + uid);
          if (localStorage.getItem('rj_user_role_' + uid) === 'Vendor') {
            localStorage.setItem('rj_user_role_' + uid, 'Customer');
          }
        } catch (_) {}
      }
    } else {
      // 1a. Check vendors doc by UID
      if (uid) {
        const vData = await rtdbGet<any>(`vendors/${uid}`).catch(() => null);
        if (vData) {
          if (isStatusActive(vData)) {
            result.hasActiveVendor = true;
            result.vendorDoc = vData;
            result.vendorData = vData;
            result.vendorId = uid;
          } else if (vData.status === 'pending') {
            result.isPendingVendor = true;
            result.hasActiveVendor = false;
            result.vendorDoc = vData;
            result.vendorData = vData;
          } else {
            result.hasActiveVendor = false;
          }
        } else {
          result.hasActiveVendor = false;
        }
      }

      // 1b. Check vendors list by email if not active yet and UID check didn't find active vendor
      if (lowerEmail && !result.hasActiveVendor && !result.isPendingVendor) {
        const allVendors = await rtdbGet<Record<string, any>>('vendors', 1500).catch(() => null);
        if (allVendors && typeof allVendors === 'object') {
          for (const [vKey, val] of Object.entries(allVendors)) {
            const vVal = val as any;
            if (!vVal || typeof vVal !== 'object') continue;
            if (isStoreDeletedFromCache(vKey)) continue;
            const vEmail = (vVal.email || '').toLowerCase().trim();
            if (vEmail === lowerEmail) {
              if (isStatusActive(vVal)) {
                result.hasActiveVendor = true;
                result.vendorDoc = vVal;
                result.vendorData = vVal;
                result.vendorId = vKey;
                break;
              } else if (vVal.status === 'pending') {
                result.isPendingVendor = true;
                result.hasActiveVendor = false;
                result.vendorDoc = vVal;
                result.vendorData = vVal;
              }
            }
          }
        }
      }

      // 1c. Do NOT grant active vendor if vendors node does not have active paid profile
      if (!result.hasActiveVendor && uid) {
        try {
          localStorage.removeItem('rj_has_active_vendor_' + uid);
          localStorage.removeItem('rj_active_vendor_' + uid);
          localStorage.removeItem('rj_vendor_profile_' + uid);
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('Vendor account status check error:', err);
  }

  // 2. CHECK RESELLER
  try {
    // 2a. Check resellers doc by UID
    if (uid) {
      const rData = await rtdbGet<any>(`resellers/${uid}`).catch(() => null);
      if (rData) {
        if (isStatusActive(rData)) {
          result.hasActiveReseller = true;
          result.resellerDoc = rData;
          result.resellerData = rData;
          result.resellerId = uid;
        } else if (rData.status === 'pending') {
          result.isPendingReseller = true;
          result.resellerDoc = rData;
          result.resellerData = rData;
        }
      }
    }

    // 2b. Check resellers list by email
    if (lowerEmail && !result.hasActiveReseller) {
      const allResellers = await rtdbGet<Record<string, any>>('resellers', 1500).catch(() => null);
      if (allResellers && typeof allResellers === 'object') {
        for (const [rKey, val] of Object.entries(allResellers)) {
          const rVal = val as any;
          if (!rVal || typeof rVal !== 'object') continue;
          const rEmail = (rVal.email || '').toLowerCase().trim();
          if (rEmail === lowerEmail) {
            if (isStatusActive(rVal)) {
              result.hasActiveReseller = true;
              result.resellerDoc = rVal;
              result.resellerData = rVal;
              result.resellerId = rKey;
              break;
            } else if (rVal.status === 'pending') {
              result.isPendingReseller = true;
              result.resellerDoc = rVal;
              result.resellerData = rVal;
            }
          }
        }
      }
    }

    // 2c. Check users node
    if (!result.hasActiveReseller && uid) {
      const uData = await rtdbGet(`users/${uid}`).catch(() => null);
      if (uData && (uData.role === 'Reseller' || uData.role === 'reseller')) {
        if (uData.status !== 'suspended' && uData.status !== 'inactive' && uData.status !== 'rejected') {
          result.hasActiveReseller = true;
          if (!result.resellerData) result.resellerData = uData;
          result.resellerId = uid;
        }
      }
    }
  } catch (err) {
    console.warn('Reseller account status check error:', err);
  }

  // Update localStorage cache
  if (uid) {
    try {
      localStorage.setItem('rj_has_active_vendor_' + uid, result.hasActiveVendor ? 'true' : 'false');
      localStorage.setItem('rj_has_active_reseller_' + uid, result.hasActiveReseller ? 'true' : 'false');
      if (!result.hasActiveVendor) {
        localStorage.removeItem('rj_active_vendor_' + uid);
      }
      if (!result.hasActiveReseller) {
        localStorage.removeItem('rj_active_reseller_' + uid);
      }
    } catch (_) {}
  }

  return result;
}

/**
 * Calculates appropriate post-login destination based on detected active account status.
 */
export function getPostLoginRedirect(
  status: AccountStatusResult,
  options?: {
    isUserAdmin?: boolean;
    defaultPath?: string;
    loginPortal?: 'vendor' | 'reseller' | 'general';
  }
): string {
  if (options?.isUserAdmin) {
    return '/admin/dashboard';
  }

  const portal = options?.loginPortal || 'general';

  // If user specifically logged into Vendor portal
  if (portal === 'vendor') {
    if (status.hasActiveVendor) return '/vendor-dashboard';
    if (status.hasActiveReseller) return '/reseller/dashboard';
  }

  // If user specifically logged into Reseller portal
  if (portal === 'reseller') {
    if (status.hasActiveReseller) return '/reseller/dashboard';
    if (status.hasActiveVendor) return '/vendor-dashboard';
  }

  // Case 3: SAME Gmail has BOTH active Vendor and active Reseller
  if (status.hasActiveVendor && status.hasActiveReseller) {
    return '/vendor-dashboard';
  }

  // Case 1: Active Vendor
  if (status.hasActiveVendor) {
    return '/vendor-dashboard';
  }

  // Case 2: Active Reseller
  if (status.hasActiveReseller) {
    return '/reseller/dashboard';
  }

  // Case 4: No active Vendor or Reseller account
  return options?.defaultPath || '/';
}
