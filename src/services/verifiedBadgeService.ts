import { rtdbGet, rtdbSet, rtdbUpdate, rtdbPush } from '../lib/rtdb';
import { saveStoreToCache } from './storeCache';

export interface VerifiedBadgeSettings {
  price: number;
  validityMonths: number;
  updatedAt?: number;
  updatedBy?: string;
  description?: string;
}

export const DEFAULT_BADGE_SETTINGS: VerifiedBadgeSettings = {
  price: 100,
  validityMonths: 2,
  description: 'Verified store badge configuration'
};

/**
 * Calculates the exact expiry timestamp by adding N calendar months to the start date.
 */
export function calculateBadgeExpiry(startDateMs: number, months: number): number {
  const d = new Date(startDateMs);
  d.setMonth(d.getMonth() + Math.max(1, months));
  return d.getTime();
}

/**
 * Fetches the verified badge pricing & duration settings from RTDB with intelligent fallbacks.
 */
export async function getVerifiedBadgeSettings(): Promise<VerifiedBadgeSettings> {
  try {
    const [badgeSettings, appConfig, vendorSettings] = await Promise.all([
      rtdbGet<any>('settings/verifiedBadge').catch(() => null),
      rtdbGet<any>('settings/appConfig').catch(() => null),
      rtdbGet<any>('settings/vendor').catch(() => null)
    ]);

    const price = 
      badgeSettings?.price ?? 
      appConfig?.verifiedSellerPrice ?? 
      vendorSettings?.verifiedSellerPrice ?? 
      vendorSettings?.verifiedPlanPrice ?? 
      DEFAULT_BADGE_SETTINGS.price;

    const validityMonths = 
      badgeSettings?.validityMonths ?? 
      badgeSettings?.months ?? 
      appConfig?.verifiedPlanMonths ?? 
      vendorSettings?.verifiedPlanMonths ?? 
      DEFAULT_BADGE_SETTINGS.validityMonths;

    return {
      price: Number(price) > 0 ? Number(price) : DEFAULT_BADGE_SETTINGS.price,
      validityMonths: Number(validityMonths) > 0 ? Number(validityMonths) : DEFAULT_BADGE_SETTINGS.validityMonths,
      updatedAt: badgeSettings?.updatedAt || Date.now(),
      updatedBy: badgeSettings?.updatedBy || 'admin',
      description: badgeSettings?.description || DEFAULT_BADGE_SETTINGS.description
    };
  } catch (err) {
    console.warn('Error reading verified badge settings from RTDB, using defaults:', err);
    return DEFAULT_BADGE_SETTINGS;
  }
}

/**
 * Saves the verified badge pricing & duration settings to RTDB across config nodes.
 */
export async function saveVerifiedBadgeSettings(
  settings: Partial<VerifiedBadgeSettings>
): Promise<VerifiedBadgeSettings> {
  const current = await getVerifiedBadgeSettings();
  const updated: VerifiedBadgeSettings = {
    price: settings.price !== undefined && settings.price >= 0 ? Number(settings.price) : current.price,
    validityMonths: settings.validityMonths !== undefined && settings.validityMonths > 0 ? Number(settings.validityMonths) : current.validityMonths,
    updatedAt: Date.now(),
    updatedBy: settings.updatedBy || 'admin',
    description: settings.description || current.description
  };

  await Promise.allSettled([
    rtdbSet('settings/verifiedBadge', updated),
    rtdbUpdate('settings/vendor', {
      verifiedSellerPrice: updated.price,
      verifiedPlanPrice: updated.price,
      verifiedPlanMonths: updated.validityMonths,
      updatedAt: Date.now()
    }),
    rtdbUpdate('settings/appConfig', {
      verifiedSellerPrice: updated.price,
      verifiedPlanPrice: updated.price,
      verifiedPlanMonths: updated.validityMonths,
      updatedAt: Date.now()
    })
  ]);

  return updated;
}

export interface BadgeExpiryDetails {
  isVerified: boolean;
  isExpired: boolean;
  daysRemaining: number;
  expiredDaysAgo: number;
  verifiedAt: number | null;
  expiresAt: number | null;
  durationMonths: number;
  statusTextBn: string;
  statusColor: 'green' | 'red' | 'amber' | 'gray';
}

/**
 * Computes live verification and expiration status for a vendor/store.
 */
export function getBadgeExpiryDetails(vendorOrStore: any): BadgeExpiryDetails {
  if (!vendorOrStore || typeof vendorOrStore !== 'object') {
    return {
      isVerified: false,
      isExpired: false,
      daysRemaining: 0,
      expiredDaysAgo: 0,
      verifiedAt: null,
      expiresAt: null,
      durationMonths: 0,
      statusTextBn: 'আনভেরিফাইড',
      statusColor: 'gray'
    };
  }

  const vStatus = String(
    vendorOrStore.verificationStatus || 
    vendorOrStore.vendorData?.verificationStatus || 
    vendorOrStore.status || ''
  ).toLowerCase().trim();

  const hasVerifiedFlag = 
    vStatus === 'verified' || 
    vendorOrStore.verified === true || 
    vendorOrStore.isVerified === true || 
    vendorOrStore.verificationBadge === true ||
    vendorOrStore.isVerifiedSeller === true ||
    vendorOrStore.blueBadge === true ||
    vendorOrStore.vendorData?.verified === true ||
    vendorOrStore.vendorData?.isVerified === true;

  const rawExpiresAt = 
    vendorOrStore.planExpiresAt || 
    vendorOrStore.verifiedPlanExpiresAt || 
    vendorOrStore.subscriptionExpiresAt || 
    vendorOrStore.vendorData?.planExpiresAt || 
    0;

  const expiresAt = typeof rawExpiresAt === 'number' && rawExpiresAt > 0 ? rawExpiresAt : null;
  
  const rawVerifiedAt = 
    vendorOrStore.verifiedAt || 
    vendorOrStore.vendorData?.verifiedAt || 
    null;
  const verifiedAt = typeof rawVerifiedAt === 'number' && rawVerifiedAt > 0 ? rawVerifiedAt : null;

  const durationMonths = Number(
    vendorOrStore.verifiedDurationMonths || 
    vendorOrStore.durationMonths || 
    2
  );

  const now = Date.now();

  // If flagged as verified
  if (hasVerifiedFlag) {
    if (expiresAt) {
      if (now <= expiresAt) {
        const diffMs = expiresAt - now;
        const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        return {
          isVerified: true,
          isExpired: false,
          daysRemaining: days,
          expiredDaysAgo: 0,
          verifiedAt,
          expiresAt,
          durationMonths,
          statusTextBn: `সক্রিয় (${days} দিন বাকি)`,
          statusColor: days <= 5 ? 'amber' : 'green'
        };
      } else {
        // Expired!
        const diffMs = now - expiresAt;
        const daysAgo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        return {
          isVerified: false,
          isExpired: true,
          daysRemaining: 0,
          expiredDaysAgo: daysAgo,
          verifiedAt,
          expiresAt,
          durationMonths,
          statusTextBn: daysAgo === 0 ? 'আজ মেয়াদ শেষ' : `${daysAgo} দিন আগে মেয়াদ শেষ`,
          statusColor: 'red'
        };
      }
    }

    // Has verified flag without expiration recorded (legacy)
    return {
      isVerified: true,
      isExpired: false,
      daysRemaining: 999,
      expiredDaysAgo: 0,
      verifiedAt,
      expiresAt: null,
      durationMonths,
      statusTextBn: 'সক্রিয়',
      statusColor: 'green'
    };
  }

  // Not verified
  if (vStatus === 'pending' || vendorOrStore.verificationRequested === true) {
    return {
      isVerified: false,
      isExpired: false,
      daysRemaining: 0,
      expiredDaysAgo: 0,
      verifiedAt: null,
      expiresAt: null,
      durationMonths,
      statusTextBn: 'অপেক্ষমান (Pending)',
      statusColor: 'amber'
    };
  }

  return {
    isVerified: false,
    isExpired: false,
    daysRemaining: 0,
    expiredDaysAgo: 0,
    verifiedAt: null,
    expiresAt: null,
    durationMonths,
    statusTextBn: 'আনভেরিফাইড',
    statusColor: 'gray'
  };
}

/**
 * Grants or Renews a verified badge for a vendor.
 * Days are strictly counted from today (or extended from current expiry if valid).
 */
export async function grantOrRenewVendorBadge(
  vendorId: string,
  options?: {
    months?: number;
    price?: number;
    paymentMethod?: string;
    trxId?: string;
    invoiceId?: string;
    sellerName?: string;
    storeName?: string;
    extendExisting?: boolean;
  }
) {
  if (!vendorId) throw new Error('Vendor ID is required');

  const settings = await getVerifiedBadgeSettings();
  const months = options?.months || settings.validityMonths;
  const price = options?.price !== undefined ? options.price : settings.price;

  const now = Date.now();
  let startTime = now;

  // If vendor is currently still active and extendExisting is true, extend from existing expiry
  if (options?.extendExisting) {
    const existing = await rtdbGet<any>(`vendors/${vendorId}`).catch(() => null);
    if (existing?.planExpiresAt && typeof existing.planExpiresAt === 'number' && existing.planExpiresAt > now) {
      startTime = existing.planExpiresAt;
    }
  }

  const expiresAt = calculateBadgeExpiry(startTime, months);

  const payload = {
    verificationStatus: 'verified',
    verified: true,
    isVerified: true,
    isVerifiedSeller: true,
    blueBadge: true,
    verificationBadge: true,
    verifiedSellerPlanActive: true,
    planExpiresAt: expiresAt,
    verifiedAt: now,
    verifiedDurationMonths: months,
    verifiedPlanPrice: price,
    verifiedPaymentMethod: options?.paymentMethod || 'admin_granted',
    verifiedTrxId: options?.trxId || 'ADMIN_GRANT',
    verifiedInvoiceId: options?.invoiceId || '',
    updatedAt: now
  };

  // 1. Update RTDB nodes
  await Promise.allSettled([
    rtdbUpdate(`vendors/${vendorId}`, payload),
    rtdbUpdate(`vendor_profiles/${vendorId}`, payload),
    rtdbUpdate(`stores/${vendorId}`, payload),
    rtdbUpdate(`users/${vendorId}`, payload)
  ]);

  // 2. Record request/history in RTDB
  try {
    await rtdbPush('verified_seller_requests', {
      vendorId,
      sellerName: options?.sellerName || 'Vendor',
      storeName: options?.storeName || 'Store',
      paymentAmount: price,
      paymentStatus: 'completed',
      paymentMethod: options?.paymentMethod || 'manual_grant',
      trxId: options?.trxId || 'ADMIN_GRANT',
      invoiceId: options?.invoiceId || '',
      status: 'approved',
      approvedDate: now,
      requestDate: now,
      verifiedAt: now,
      planExpiresAt: expiresAt,
      durationMonths: months
    });
  } catch (err) {
    console.warn('Could not record verified seller request in RTDB:', err);
  }

  // 3. Update local store cache
  saveStoreToCache(vendorId, {
    id: vendorId,
    vendorId,
    ...payload
  });

  return { success: true, payload, expiresAt, months, price };
}

/**
 * Revokes / removes a verified badge from a vendor.
 */
export async function revokeVendorBadge(vendorId: string) {
  if (!vendorId) throw new Error('Vendor ID is required');

  const now = Date.now();
  const payload = {
    verificationStatus: 'unverified',
    verified: false,
    isVerified: false,
    isVerifiedSeller: false,
    blueBadge: false,
    verificationBadge: false,
    verifiedSellerPlanActive: false,
    planExpiresAt: 0,
    revokedAt: now,
    updatedAt: now
  };

  await Promise.allSettled([
    rtdbUpdate(`vendors/${vendorId}`, payload),
    rtdbUpdate(`vendor_profiles/${vendorId}`, payload),
    rtdbUpdate(`stores/${vendorId}`, payload),
    rtdbUpdate(`users/${vendorId}`, payload)
  ]);

  saveStoreToCache(vendorId, {
    id: vendorId,
    vendorId,
    ...payload
  });

  return { success: true, payload };
}
