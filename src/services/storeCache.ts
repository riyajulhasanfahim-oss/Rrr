import { rtdbGet, rtdbList, rtdbSubscribe } from '../lib/rtdb';
import { INITIAL_VENDORS, INITIAL_VENDOR_PROFILES, INITIAL_VENDOR_THEMES } from '../lib/firebaseSeed';
import { enrichProductsWithRealMetrics } from './productMetricsService';

export interface CachedStore {
  id: string;
  vendorId?: string;
  storeId?: string;
  shopName: string;
  storeName?: string;
  name?: string;
  logo?: string | null;
  shopLogo?: string | null;
  profileImage?: string | null;
  banner?: string;
  shopBanner?: string;
  description?: string;
  category?: string;
  contactNumber?: string;
  mobileNumber?: string;
  phone?: string;
  whatsappNumber?: string;
  whatsapp?: string;
  email?: string;
  address?: any;
  rating?: number | string;
  followersCount?: number;
  verificationStatus?: string;
  verified?: boolean;
  isVerified?: boolean;
  status?: string;
  isDeleted?: boolean;
  openingHours?: string;
  [key: string]: any;
}

// Built-in official stores fallback catalog (Demo stores removed)
const SEED_OFFICIAL_STORES: CachedStore[] = [];

// Clean legacy demo stores and verified badges from localStorage on init
if (typeof window !== "undefined") {
  try {
    const demoStoreIds = new Set([
      "vendor-tech-pro",
      "vendor-apple-zone",
      "vendor-nike-hub",
      "vendor-leather-lux",
      "vendor-home-comfort",
      "vendor-grocery-fresh"
    ]);
    const storedList = localStorage.getItem("rj_official_stores_list");
    if (storedList) {
      const parsed = JSON.parse(storedList);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((s: any) => !demoStoreIds.has(s?.id) && !demoStoreIds.has(s?.vendorId));
        localStorage.setItem("rj_official_stores_list", JSON.stringify(cleaned));
      }
    }
    demoStoreIds.forEach(id => {
      localStorage.removeItem("rj_store_cache_" + id);
      localStorage.removeItem("rj_store_prods_" + id);
    });
  } catch (_) {}
}

/**
 * Checks whether a store/vendor has an active, legitimate verified plan in Firebase Realtime Database.
 * Returns true ONLY if:
 * 1. The store is NOT a demo store (unless real plan was purchased in RTDB with active planExpiresAt).
 * 2. verificationStatus is 'verified' (or verified === true).
 * 3. The verified plan has not expired (planExpiresAt > Date.now() if specified).
 * 4. Verification has not been rejected, expired, or cancelled.
 */
export function isStorePlanVerified(store: any): boolean {
  if (!store || typeof store !== 'object') return false;

  const storeId = String(store.id || store.vendorId || store.storeId || store.userId || '').trim();

  // Known demo stores
  const demoStoreIds = [
    'vendor-tech-pro',
    'vendor-apple-zone',
    'vendor-nike-hub',
    'vendor-leather-lux',
    'vendor-home-comfort',
    'vendor-grocery-fresh'
  ];
  const isDemo = demoStoreIds.includes(storeId);

  // Check verification status across multiple field variations
  const vStatus = String(store.verificationStatus || store.vendorData?.verificationStatus || store.status || '').toLowerCase().trim();
  const isStatusVerified = 
    vStatus === 'verified' || 
    store.verified === true || 
    store.isVerified === true || 
    store.verificationBadge === true ||
    store.isVerifiedSeller === true ||
    store.verifiedSellerPlanActive === true ||
    store.blueBadge === true ||
    store.isBlueBadge === true ||
    store.vendorData?.verified === true ||
    store.vendorData?.isVerified === true ||
    store.vendorData?.verificationBadge === true;

  if (!isStatusVerified) {
    return false;
  }

  // Check plan expiration timestamp
  const expiresAt = store.planExpiresAt || store.verifiedPlanExpiresAt || store.subscriptionExpiresAt || store.vendorData?.planExpiresAt;
  if (typeof expiresAt === 'number' && expiresAt > 0 && expiresAt <= Date.now()) {
    return false; // Plan expired
  }

  // Check subscription / verification status
  if (vStatus === 'expired' || vStatus === 'unverified' || vStatus === 'rejected') {
    return false;
  }
  const subStatus = String(store.subscriptionStatus || store.vendorData?.subscriptionStatus || '').toLowerCase().trim();
  if (['cancelled', 'expired', 'suspended', 'rejected', 'inactive'].includes(subStatus)) {
    return false;
  }

  // If it's a seed demo store, only verify if there is an active future planExpiresAt or real purchase transaction in RTDB
  if (isDemo) {
    const hasActiveRealPlan = typeof expiresAt === 'number' && expiresAt > Date.now();
    const hasTrx = Boolean(store.verifiedTrxId || store.verifiedInvoiceId || store.verifiedAt || store.vendorData?.verifiedTrxId);
    if (!hasActiveRealPlan && !hasTrx) {
      return false;
    }
  }

  return true;
}

/**
 * Sorts any list of stores so that stores with active verified badges
 * ALWAYS appear at the very front everywhere (ahead of all unverified/normal stores).
 * Normal stores remain strictly behind them.
 */
export function sortStoresByVerifiedFirst<T extends any>(stores: T[]): T[] {
  if (!Array.isArray(stores) || stores.length <= 1) return Array.isArray(stores) ? [...stores] : [];

  return [...stores].sort((a, b) => {
    const aVerified = isStorePlanVerified(a);
    const bVerified = isStorePlanVerified(b);

    if (aVerified && !bVerified) return -1;
    if (!aVerified && bVerified) return 1;

    // Secondary priority: follower count
    const aFollowers = Number((a as any)?.followersCount || (a as any)?.followers || 0);
    const bFollowers = Number((b as any)?.followersCount || (b as any)?.followers || 0);
    if (aFollowers !== bFollowers) {
      return bFollowers - aFollowers;
    }

    // Tertiary priority: rating
    const aRating = Number((a as any)?.rating || 0);
    const bRating = Number((b as any)?.rating || 0);
    if (aRating !== bRating) {
      return bRating - aRating;
    }

    return 0;
  });
}

// In-memory persistent map to avoid state resetting between component unmounts
const inMemoryStoreCache = new Map<string, CachedStore>();

// Seed cache on module load
SEED_OFFICIAL_STORES.forEach(store => {
  inMemoryStoreCache.set(store.id, store);
});

/**
 * Normalizes and merges store objects so non-empty valid fields are never overwritten with null/empty
 */
export function mergeStoreObjects(existing: any, incoming: any): CachedStore {
  if (!existing && !incoming) {
    return { id: '', shopName: 'Official Store' };
  }
  if (!existing) return incoming;
  if (!incoming) return existing;

  const result: any = { ...existing };

  for (const [key, val] of Object.entries(incoming)) {
    if (val !== undefined && val !== null && val !== '') {
      result[key] = val;
    }
  }

  // Consistent name resolution
  result.shopName = incoming.shopName || incoming.storeName || existing.shopName || existing.storeName || incoming.name || existing.name || 'Official Store';
  result.storeName = result.shopName;

  // Consistent logo resolution
  result.logo = incoming.logo || incoming.shopLogo || incoming.profileImage || existing.logo || existing.shopLogo || existing.profileImage || '';
  result.shopLogo = result.logo;

  // Consistent banner resolution
  result.banner = incoming.banner || incoming.shopBanner || existing.banner || existing.shopBanner || '';

  // Consistent description & category
  result.description = incoming.description || incoming.slogan || incoming.bio || existing.description || existing.slogan || existing.bio || '';
  result.category = incoming.category || incoming.businessCategory || existing.category || existing.businessCategory || 'Retail';

  // Consistent contact resolution
  result.contactNumber = incoming.contactNumber || incoming.mobileNumber || incoming.phone || existing.contactNumber || existing.mobileNumber || existing.phone || '';
  result.email = incoming.email || existing.email || '';
  result.address = incoming.address || existing.address || '';

  // Verification status - strictly derived from real RTDB data
  const isVerifiedActive = isStorePlanVerified({ ...existing, ...incoming });
  result.verified = isVerifiedActive;
  result.isVerified = isVerifiedActive;
  result.verificationStatus = isVerifiedActive ? 'verified' : (incoming.verificationStatus || existing?.verificationStatus || 'unverified');

  return result as CachedStore;
}

/**
 * Returns a known seed store by ID if available
 */
export function getKnownSeedStore(id: string): CachedStore | null {
  if (!id) return null;
  const found = SEED_OFFICIAL_STORES.find(s => s.id === id || s.vendorId === id);
  if (found) return found;

  const seedVendor = INITIAL_VENDORS.find(v => v.id === id);
  const seedProfile = INITIAL_VENDOR_PROFILES.find(p => p.id === id || p.vendorId === id);

  if (seedVendor || seedProfile) {
    return mergeStoreObjects(seedVendor, seedProfile);
  }

  return null;
}

// In-memory products cache per store to ensure zero-blank rendering
const inMemoryStoreProductsCache = new Map<string, any[]>();

// In-memory blacklist of deleted vendors/stores for immediate client-side pruning
const deletedStoreIdsSet = new Set<string>();

// Preload deleted stores from localStorage and subscribe in real-time to RTDB deleted_vendors
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('rj_deleted_vendors_cache');
    if (stored) {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr)) {
        arr.forEach((id: string) => {
          if (id) {
            deletedStoreIdsSet.add(String(id).trim());
            deletedStoreIdsSet.add(String(id).trim().toLowerCase());
          }
        });
      }
    }
  } catch (_) {}

  // Auto-subscribe to RTDB deleted_vendors node to immediately prune deleted stores across all tabs & sessions
  try {
    rtdbSubscribe('deleted_vendors', (snap: any) => {
      if (snap && typeof snap === 'object') {
        Object.keys(snap).forEach(deletedId => {
          if (deletedId && !deletedStoreIdsSet.has(deletedId)) {
            removeStoreFromCache(deletedId);
          }
        });
      }
    });
  } catch (subErr) {
    console.warn('Realtime subscription to deleted_vendors error:', subErr);
  }
}

/**
 * Checks if a store/vendor has been deleted
 */
export function isStoreDeletedFromCache(storeId: string): boolean {
  if (!storeId) return false;
  const cleanId = String(storeId).trim();
  const lowerId = cleanId.toLowerCase();

  if (deletedStoreIdsSet.has(cleanId) || deletedStoreIdsSet.has(lowerId)) {
    return true;
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('rj_deleted_vendors_cache');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr) && (arr.includes(cleanId) || arr.includes(lowerId))) {
          deletedStoreIdsSet.add(cleanId);
          deletedStoreIdsSet.add(lowerId);
          return true;
        }
      }
    } catch (_) {}
  }

  return false;
}

/**
 * Purges a deleted store from in-memory cache and localStorage immediately,
 * and notifies all active components across the application.
 */
export function removeStoreFromCache(storeId: string): void {
  if (!storeId) return;
  const cleanId = String(storeId).trim();
  const lowerId = cleanId.toLowerCase();

  deletedStoreIdsSet.add(cleanId);
  deletedStoreIdsSet.add(lowerId);

  // 1. Purge from in-memory caches
  inMemoryStoreCache.delete(cleanId);
  inMemoryStoreCache.delete(lowerId);
  inMemoryStoreProductsCache.delete(cleanId);
  inMemoryStoreProductsCache.delete(lowerId);
  inMemoryStoreThemeCache.delete(cleanId);
  inMemoryStoreThemeCache.delete(lowerId);
  inMemoryFollowCache.delete(cleanId);
  inMemoryFollowCache.delete(lowerId);

  // Clear any entries in inMemoryStoreCache with matching ID, slug, or vendorId
  for (const [k, s] of inMemoryStoreCache.entries()) {
    if (
      s.id === cleanId ||
      s.vendorId === cleanId ||
      s.storeId === cleanId ||
      s.userId === cleanId ||
      s.id === lowerId ||
      s.vendorId === lowerId ||
      s.storeId === lowerId ||
      s.userId === lowerId ||
      String(s.storeSlug || '').toLowerCase() === lowerId ||
      String(s.shopSlug || '').toLowerCase() === lowerId
    ) {
      inMemoryStoreCache.delete(k);
    }
  }

  // 2. Purge from localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`rj_store_cache_${cleanId}`);
      localStorage.removeItem(`rj_store_cache_${lowerId}`);
      localStorage.removeItem(`rj_store_products_${cleanId}`);
      localStorage.removeItem(`rj_store_products_${lowerId}`);
      localStorage.removeItem(`rj_store_theme_${cleanId}`);
      localStorage.removeItem(`rj_store_theme_${lowerId}`);
      localStorage.removeItem(`rj_vendor_store_${cleanId}`);
      localStorage.removeItem(`rj_vendor_store_${lowerId}`);
      localStorage.removeItem(`rj_vendor_profile_${cleanId}`);
      localStorage.removeItem(`rj_vendor_profile_${lowerId}`);
      localStorage.removeItem(`store_follow_${cleanId}`);
      localStorage.removeItem(`store_follow_${lowerId}`);
      localStorage.removeItem(`rj_has_active_vendor_${cleanId}`);
      localStorage.removeItem(`rj_has_active_vendor_${lowerId}`);
      localStorage.removeItem(`rj_active_vendor_${cleanId}`);
      localStorage.removeItem(`rj_active_vendor_${lowerId}`);
      localStorage.removeItem(`rj_user_role_${cleanId}`);
      localStorage.removeItem(`rj_user_role_${lowerId}`);

      // Filter out from official stores list
      const storedList = localStorage.getItem('rj_official_stores_list');
      if (storedList) {
        const parsed = JSON.parse(storedList);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((s: any) =>
            s &&
            s.id !== cleanId &&
            s.vendorId !== cleanId &&
            s.storeId !== cleanId &&
            s.userId !== cleanId &&
            s.id !== lowerId &&
            s.vendorId !== lowerId &&
            s.storeId !== lowerId &&
            s.userId !== lowerId &&
            String(s.storeSlug || '').toLowerCase() !== lowerId &&
            String(s.shopSlug || '').toLowerCase() !== lowerId
          );
          localStorage.setItem('rj_official_stores_list', JSON.stringify(filtered));
        }
      }

      // Record in persistent deleted list cache
      const storedDeleted = localStorage.getItem('rj_deleted_vendors_cache');
      let deletedList: string[] = [];
      if (storedDeleted) {
        try {
          const parsed = JSON.parse(storedDeleted);
          if (Array.isArray(parsed)) deletedList = parsed;
        } catch (_) {}
      }
      if (!deletedList.includes(cleanId)) deletedList.push(cleanId);
      if (!deletedList.includes(lowerId)) deletedList.push(lowerId);
      localStorage.setItem('rj_deleted_vendors_cache', JSON.stringify(deletedList));

      // Dispatch global events so user-facing UI updates instantly without refresh
      window.dispatchEvent(new CustomEvent('rj_store_deleted', { detail: { storeId: cleanId } }));
      window.dispatchEvent(new Event('storage'));
    } catch (_) {}
  }
}

/**
 * Synchronously retrieves a store from memory or localStorage cache
 * Guarantees zero-blank, zero-flicker on first render of Store Page
 */
export function getStoreFromCache(storeId: string): CachedStore | null {
  if (!storeId) return null;
  const cleanId = String(storeId).trim();
  const lowerId = cleanId.toLowerCase();

  // If store was deleted, refuse to return cached data
  if (isStoreDeletedFromCache(cleanId)) {
    return null;
  }

  // 1. Direct in-memory map check
  if (inMemoryStoreCache.has(cleanId)) {
    return inMemoryStoreCache.get(cleanId)!;
  }
  if (inMemoryStoreCache.has(lowerId)) {
    return inMemoryStoreCache.get(lowerId)!;
  }

  // 2. Scan in-memory cache for matching alias/slug/id
  for (const s of inMemoryStoreCache.values()) {
    if (
      s.id === cleanId ||
      s.vendorId === cleanId ||
      s.storeId === cleanId ||
      s.userId === cleanId ||
      String(s.storeSlug || '').toLowerCase() === lowerId ||
      String(s.shopSlug || '').toLowerCase() === lowerId ||
      String(s.shopName || '').toLowerCase() === lowerId
    ) {
      return s;
    }
  }

  // 3. Check individual localStorage store cache
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`rj_store_cache_${cleanId}`) || localStorage.getItem(`rj_store_cache_${lowerId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.shopName || parsed.storeName || parsed.id)) {
          inMemoryStoreCache.set(cleanId, parsed);
          return parsed;
        }
      }
    } catch (_) {}

    // 4. Check official stores list in localStorage
    try {
      const storedList = localStorage.getItem('rj_official_stores_list');
      if (storedList) {
        const list = JSON.parse(storedList);
        if (Array.isArray(list)) {
          const match = list.find((s: any) =>
            s.id === cleanId ||
            s.vendorId === cleanId ||
            s.storeId === cleanId ||
            s.userId === cleanId ||
            String(s.storeSlug || '').toLowerCase() === lowerId ||
            String(s.shopSlug || '').toLowerCase() === lowerId ||
            String(s.shopName || '').toLowerCase() === lowerId
          );
          if (match) {
            inMemoryStoreCache.set(cleanId, match);
            return match;
          }
        }
      }
    } catch (_) {}

    // 5. Check vendor dashboard local cache keys
    try {
      const vStore = localStorage.getItem(`rj_vendor_store_${cleanId}`);
      const vProfile = localStorage.getItem(`rj_vendor_profile_${cleanId}`);
      if (vStore || vProfile) {
        const parsedStore = vStore ? JSON.parse(vStore) : {};
        const parsedProfile = vProfile ? JSON.parse(vProfile) : {};
        const merged = mergeStoreObjects(parsedStore, { id: cleanId, ...parsedProfile });
        if (merged.shopName || merged.storeName) {
          inMemoryStoreCache.set(cleanId, merged);
          return merged;
        }
      }
    } catch (_) {}
  }

  // 6. Check seed catalog
  const seed = getKnownSeedStore(cleanId);
  if (seed) {
    inMemoryStoreCache.set(cleanId, seed);
    return seed;
  }

  return null;
}

/**
 * Saves a store into memory and localStorage cache under all known IDs and aliases
 */
export function saveStoreToCache(storeId: string, data: any): CachedStore {
  if (!storeId || !data) return data;

  if (isStoreDeletedFromCache(storeId) || data.isDeleted === true || data.status === 'deleted') {
    removeStoreFromCache(storeId);
    return data;
  }

  const existing = getStoreFromCache(storeId);
  const merged = mergeStoreObjects(existing, { id: storeId, ...data });

  inMemoryStoreCache.set(storeId, merged);
  if (merged.id) inMemoryStoreCache.set(merged.id, merged);
  if (merged.vendorId) inMemoryStoreCache.set(merged.vendorId, merged);
  if (merged.storeId) inMemoryStoreCache.set(merged.storeId, merged);
  if (merged.storeSlug) inMemoryStoreCache.set(merged.storeSlug.toLowerCase(), merged);
  if (merged.shopSlug) inMemoryStoreCache.set(merged.shopSlug.toLowerCase(), merged);

  if (typeof window !== 'undefined') {
    try {
      const serialized = JSON.stringify(merged);
      localStorage.setItem(`rj_store_cache_${storeId}`, serialized);
      if (merged.id && merged.id !== storeId) {
        localStorage.setItem(`rj_store_cache_${merged.id}`, serialized);
      }

      // Automatically sync and prioritize into official stores list if store is active (no mutual recursion)
      const storedList = localStorage.getItem('rj_official_stores_list');
      if (storedList) {
        const parsed = JSON.parse(storedList);
        if (Array.isArray(parsed)) {
          const idx = parsed.findIndex((s: any) => s.id === storeId || s.id === merged.id);
          let updatedList = [...parsed];
          if (idx >= 0) {
            updatedList[idx] = mergeStoreObjects(updatedList[idx], merged);
          } else if (isStorePlanVerified(merged) || merged.shopName || merged.storeName) {
            updatedList.unshift(merged);
          }
          const sortedList = sortStoresByVerifiedFirst(updatedList);
          localStorage.setItem('rj_official_stores_list', JSON.stringify(sortedList));
        }
      }
    } catch (_) {}
  }

  return merged;
}

/**
 * Returns seed catalog products tailored to a store or vendor ID
 */
export function getSeedProductsForStore(storeId: string): any[] {
  return [];
}

/**
 * Synchronously retrieves store products from cache (in-memory, localStorage, or seed catalog)
 * Guarantees zero blank screen and zero flicker on store page mount
 */
export function getStoreProductsFromCache(storeId: string): any[] {
  if (!storeId) return [];
  const cleanId = String(storeId).trim();

  // 1. Check in-memory products map
  if (inMemoryStoreProductsCache.has(cleanId)) {
    const mem = inMemoryStoreProductsCache.get(cleanId);
    if (Array.isArray(mem) && mem.length > 0) return mem;
  }

  // 2. Check localStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`rj_store_products_${cleanId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryStoreProductsCache.set(cleanId, parsed);
          return parsed;
        }
      }
    } catch (_) {}
  }

  // 3. Fallback to seed catalog matching this store
  const seedProds = getSeedProductsForStore(cleanId);
  if (seedProds.length > 0) {
    inMemoryStoreProductsCache.set(cleanId, seedProds);
    return seedProds;
  }

  return [];
}

/**
 * Saves store products to in-memory and localStorage cache
 */
export function saveStoreProductsToCache(storeId: string, products: any[]): void {
  if (!storeId || !Array.isArray(products) || products.length === 0) return;
  const cleanId = String(storeId).trim();

  inMemoryStoreProductsCache.set(cleanId, products);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`rj_store_products_${cleanId}`, JSON.stringify(products));
    } catch (_) {}
  }
}

/**
 * Fetches products for a store from RTDB and updates the cache without flicker
 */
export async function fetchStoreProductsFromRTDB(storeId: string): Promise<any[]> {
  const cached = getStoreProductsFromCache(storeId);
  const cleanId = String(storeId).trim().toLowerCase();
  if (!cleanId) return [];

  try {
    const [productsSnap, vendorsSnap, storesSnap] = await Promise.all([
      rtdbGet<Record<string, any>>('products'),
      rtdbGet<Record<string, any>>('vendors'),
      rtdbGet<Record<string, any>>('stores')
    ]);

    // Build comprehensive set of all possible aliases for this store/vendor
    const storeAliases = new Set<string>();
    storeAliases.add(cleanId);

    // Look for matching vendor in vendors node
    if (vendorsSnap && typeof vendorsSnap === 'object') {
      for (const [vKey, vVal] of Object.entries(vendorsSnap)) {
        if (vVal && typeof vVal === 'object') {
          const vk = vKey.toLowerCase().trim();
          const vStoreId = String(vVal.storeId || '').toLowerCase().trim();
          const vUserId = String(vVal.userId || vVal.id || '').toLowerCase().trim();
          const vShopSlug = String(vVal.shopSlug || '').toLowerCase().trim();
          const vStoreSlug = String(vVal.storeSlug || '').toLowerCase().trim();
          const vShopName = String(vVal.shopName || '').toLowerCase().trim();
          const vStoreName = String(vVal.storeName || '').toLowerCase().trim();

          if (
            vk === cleanId ||
            vStoreId === cleanId ||
            vUserId === cleanId ||
            vShopSlug === cleanId ||
            vStoreSlug === cleanId ||
            vShopName === cleanId ||
            vStoreName === cleanId
          ) {
            if (vk) storeAliases.add(vk);
            if (vStoreId) storeAliases.add(vStoreId);
            if (vUserId) storeAliases.add(vUserId);
            if (vShopSlug) storeAliases.add(vShopSlug);
            if (vStoreSlug) storeAliases.add(vStoreSlug);
            if (vShopName) storeAliases.add(vShopName);
            if (vStoreName) storeAliases.add(vStoreName);
          }
        }
      }
    }

    // Also look in stores node
    if (storesSnap && typeof storesSnap === 'object') {
      for (const [sKey, sVal] of Object.entries(storesSnap)) {
        if (sVal && typeof sVal === 'object') {
          const sk = sKey.toLowerCase().trim();
          const sStoreSlug = String(sVal.storeSlug || sVal.shopSlug || '').toLowerCase().trim();
          const sStoreName = String(sVal.storeName || sVal.shopName || sVal.name || '').toLowerCase().trim();
          const sVendorId = String(sVal.vendorId || sVal.userId || sVal.id || '').toLowerCase().trim();

          if (
            sk === cleanId ||
            sStoreSlug === cleanId ||
            sStoreName === cleanId ||
            sVendorId === cleanId
          ) {
            if (sk) storeAliases.add(sk);
            if (sStoreSlug) storeAliases.add(sStoreSlug);
            if (sStoreName) storeAliases.add(sStoreName);
            if (sVendorId) storeAliases.add(sVendorId);
          }
        }
      }
    }

    let loadedProducts: any[] = [];

    if (productsSnap && typeof productsSnap === 'object') {
      for (const [pKey, pVal] of Object.entries(productsSnap)) {
        if (pVal && typeof pVal === 'object') {
          const statusLower = String(pVal.status || '').toLowerCase();
          if (statusLower === 'archived' || statusLower === 'inactive' || statusLower === 'deleted') {
            continue;
          }

          const vId = String(pVal.vendorId || pVal.storeId || pVal.userId || pVal.vendor?.id || pVal.vendor?.storeId || '').toLowerCase().trim();
          const sSlug = String(pVal.vendor?.storeSlug || pVal.vendor?.shopSlug || pVal.storeSlug || pVal.shopSlug || '').toLowerCase().trim();
          const sName = String(pVal.vendor?.storeName || pVal.vendor?.name || pVal.storeName || '').toLowerCase().trim();

          if (
            (vId && storeAliases.has(vId)) ||
            (sSlug && storeAliases.has(sSlug)) ||
            (sName && storeAliases.has(sName))
          ) {
            loadedProducts.push({ id: pKey, ...pVal });
          }
        }
      }
    }

    // Also check vendor_products/${storeId} node
    if (loadedProducts.length === 0) {
      try {
        const vpSnap = await rtdbGet<Record<string, any>>(`vendor_products/${storeId}`);
        if (vpSnap && typeof vpSnap === 'object') {
          for (const [vpKey, vpVal] of Object.entries(vpSnap)) {
            if (vpVal && typeof vpVal === 'object') {
              const statusLower = String(vpVal.status || '').toLowerCase();
              if (statusLower !== 'archived' && statusLower !== 'inactive' && statusLower !== 'deleted') {
                loadedProducts.push({ id: vpKey, ...vpVal });
              }
            }
          }
        }
      } catch (_) {}
    }

    if (loadedProducts.length > 0) {
      const enriched = await enrichProductsWithRealMetrics(loadedProducts);
      saveStoreProductsToCache(storeId, enriched);
      return enriched;
    }

    // Store legitimately has no products
    saveStoreProductsToCache(storeId, []);
    return [];
  } catch (err) {
    console.warn(`[fetchStoreProductsFromRTDB error for ${storeId}]:`, err);
    return cached && cached.length > 0 ? cached : [];
  }
}

/**
 * In-memory Store Themes & Follow States cache for instant, zero-flicker rendering
 */
const inMemoryStoreThemeCache = new Map<string, any>();
const inMemoryFollowCache = new Map<string, boolean>();

// Pre-populate with initial vendor themes
if (Array.isArray(INITIAL_VENDOR_THEMES)) {
  INITIAL_VENDOR_THEMES.forEach(th => {
    if (th.id) inMemoryStoreThemeCache.set(String(th.id).trim().toLowerCase(), th);
    if (th.vendorId) inMemoryStoreThemeCache.set(String(th.vendorId).trim().toLowerCase(), th);
  });
}

/**
 * Synchronously retrieves store theme from cache (in-memory, localStorage, or seed)
 */
export function getStoreThemeFromCache(storeId: string): any {
  if (!storeId) return null;
  const cleanId = String(storeId).trim().toLowerCase();

  if (inMemoryStoreThemeCache.has(cleanId)) {
    return inMemoryStoreThemeCache.get(cleanId);
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`rj_store_theme_${cleanId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          inMemoryStoreThemeCache.set(cleanId, parsed);
          return parsed;
        }
      }
    } catch (_) {}
  }

  // Check store cache
  const cachedStore = getStoreFromCache(storeId);
  if (cachedStore?.theme && typeof cachedStore.theme === 'object') {
    inMemoryStoreThemeCache.set(cleanId, cachedStore.theme);
    return cachedStore.theme;
  }
  if (cachedStore?.primaryColor) {
    const themeObj = { primaryColor: cachedStore.primaryColor };
    inMemoryStoreThemeCache.set(cleanId, themeObj);
    return themeObj;
  }

  // Check seed themes
  if (Array.isArray(INITIAL_VENDOR_THEMES)) {
    const seed = INITIAL_VENDOR_THEMES.find(t => 
      String(t.id).toLowerCase() === cleanId || 
      String(t.vendorId).toLowerCase() === cleanId
    );
    if (seed) {
      inMemoryStoreThemeCache.set(cleanId, seed);
      return seed;
    }
  }

  return null;
}

/**
 * Saves store theme to in-memory and localStorage cache
 * Never overwrites valid theme colors with null or undefined
 */
export function saveStoreThemeToCache(storeId: string, theme: any): void {
  if (!storeId || !theme || typeof theme !== 'object') return;
  const cleanId = String(storeId).trim().toLowerCase();

  const existing = getStoreThemeFromCache(storeId) || {};
  const merged = { ...existing, ...theme };

  inMemoryStoreThemeCache.set(cleanId, merged);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`rj_store_theme_${cleanId}`, JSON.stringify(merged));
    } catch (_) {}
  }

  // Also update store cache if store exists
  const store = getStoreFromCache(storeId);
  if (store) {
    store.theme = merged;
    if (merged.primaryColor) {
      store.primaryColor = merged.primaryColor;
    }
    saveStoreToCache(storeId, store);
  }
}

/**
 * Synchronously retrieves user's store follow status from cache
 */
export function getStoreFollowStatusFromCache(storeId: string, userId?: string | null): boolean {
  if (!storeId) return false;
  const cleanStoreId = String(storeId).trim().toLowerCase();
  const cacheKey = userId ? `${String(userId).trim()}_${cleanStoreId}` : cleanStoreId;

  if (inMemoryFollowCache.has(cacheKey)) {
    return inMemoryFollowCache.get(cacheKey)!;
  }
  if (inMemoryFollowCache.has(cleanStoreId)) {
    return inMemoryFollowCache.get(cleanStoreId)!;
  }

  if (typeof window !== 'undefined') {
    try {
      if (userId) {
        const uFollow = localStorage.getItem(`store_follow_${String(userId).trim()}_${cleanStoreId}`);
        if (uFollow === 'true') {
          inMemoryFollowCache.set(cacheKey, true);
          return true;
        }
        if (uFollow === 'false') {
          inMemoryFollowCache.set(cacheKey, false);
          return false;
        }
      }
      const genericFollow = localStorage.getItem(`store_follow_${cleanStoreId}`);
      if (genericFollow === 'true') {
        inMemoryFollowCache.set(cacheKey, true);
        return true;
      }
    } catch (_) {}
  }

  return false;
}

/**
 * Saves store follow status to in-memory and localStorage cache
 */
export function saveStoreFollowStatusToCache(storeId: string, userId: string | undefined | null, isFollowing: boolean): void {
  if (!storeId) return;
  const cleanStoreId = String(storeId).trim().toLowerCase();
  const cacheKey = userId ? `${String(userId).trim()}_${cleanStoreId}` : cleanStoreId;

  inMemoryFollowCache.set(cacheKey, isFollowing);
  inMemoryFollowCache.set(cleanStoreId, isFollowing);

  if (typeof window !== 'undefined') {
    try {
      if (userId) {
        localStorage.setItem(`store_follow_${String(userId).trim()}_${cleanStoreId}`, String(isFollowing));
      }
      localStorage.setItem(`store_follow_${cleanStoreId}`, String(isFollowing));
    } catch (_) {}
  }
}

/**
 * Synchronously gets the official stores list for Home Page
 * Returns either cached official stores or initial seed stores with complete logos & names
 */
export function getOfficialStoresFromCache(): CachedStore[] {
  // Check in-memory cache
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('rj_official_stores_list');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validStores = parsed.filter((s: any) =>
            s &&
            !isStoreDeletedFromCache(s.id) &&
            !isStoreDeletedFromCache(s.vendorId) &&
            !isStoreDeletedFromCache(s.storeId) &&
            !isStoreDeletedFromCache(s.userId) &&
            s.status !== 'deleted' &&
            s.status !== 'rejected'
          );
          validStores.forEach((s: any) => {
            if (s.id) inMemoryStoreCache.set(s.id, s);
          });
          return sortStoresByVerifiedFirst(validStores);
        }
      }
    } catch (_) {}
  }

  return sortStoresByVerifiedFirst(SEED_OFFICIAL_STORES.filter(s => !isStoreDeletedFromCache(s.id)));
}

/**
 * Saves the official stores list to cache with verified stores sorted to the front
 */
export function saveOfficialStoresToCache(stores: CachedStore[]): void {
  if (!Array.isArray(stores) || stores.length === 0) return;

  const sorted = sortStoresByVerifiedFirst(stores);

  // Directly update in-memory cache and individual items without triggering recursion
  sorted.forEach(s => {
    if (s.id) {
      inMemoryStoreCache.set(s.id, s);
      if (s.vendorId) inMemoryStoreCache.set(s.vendorId, s);
      if (s.storeId) inMemoryStoreCache.set(s.storeId, s);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`rj_store_cache_${s.id}`, JSON.stringify(s));
        } catch (_) {}
      }
    }
  });

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('rj_official_stores_list', JSON.stringify(sorted));
    } catch (_) {}
  }
}

// In-flight fetch promise and timestamp to throttle RTDB calls
let lastFetchOfficialStoresTime = 0;
let inflightOfficialStoresFetch: Promise<CachedStore[]> | null = null;

/**
 * Fetches all official & registered stores directly from Firebase Realtime Database (RTDB)
 * Only uses RTDB (zero Firestore). Merges 'stores', 'vendors', and 'vendor_profiles'.
 * Stores with active verified badges are sorted to the very front.
 */
export async function fetchOfficialStoresFromRTDB(forceRefresh = false): Promise<CachedStore[]> {
  const now = Date.now();
  // Return cached stores if fetched recently (within 15s) to avoid unnecessary re-queries
  if (!forceRefresh && inMemoryStoreCache.size > 0 && (now - lastFetchOfficialStoresTime < 15000)) {
    return getOfficialStoresFromCache();
  }

  // Deduplicate concurrent requests
  if (inflightOfficialStoresFetch) {
    return inflightOfficialStoresFetch;
  }

  inflightOfficialStoresFetch = (async () => {
    try {
      const [vendorsSnap, storesSnap, profilesSnap, deletedSnap] = await Promise.all([
        rtdbGet<Record<string, any>>('vendors', 2500),
        rtdbGet<Record<string, any>>('stores', 2500),
        rtdbGet<Record<string, any>>('vendor_profiles', 2500),
        rtdbGet<Record<string, any>>('deleted_vendors', 2500)
      ]);

      const deletedIds = new Set<string>(
        deletedSnap && typeof deletedSnap === 'object' ? Object.keys(deletedSnap) : []
      );

      // Purge deleted vendors from local cache immediately
      deletedIds.forEach(delId => {
        removeStoreFromCache(delId);
      });

      const storeMap = new Map<string, CachedStore>();

      // 1. Seed official stores as baseline, but strictly skip any that were deleted
      SEED_OFFICIAL_STORES.forEach(store => {
        if (!deletedIds.has(store.id) && !isStoreDeletedFromCache(store.id)) {
          storeMap.set(store.id, { ...store });
        }
      });

      // 2. Merge registered RTDB vendors & stores
      const allIds = new Set<string>([
        ...Object.keys(vendorsSnap || {}),
        ...Object.keys(storesSnap || {}),
        ...Object.keys(profilesSnap || {})
      ]);

      for (const id of allIds) {
        const vendorData = vendorsSnap?.[id] || {};
        const storeData = storesSnap?.[id] || {};
        const profileData = profilesSnap?.[id] || {};

        const linkedIds = [
          id,
          vendorData.userId,
          storeData.userId,
          profileData.userId,
          vendorData.vendorId,
          storeData.vendorId,
          profileData.vendorId,
          vendorData.storeId,
          storeData.storeId,
          profileData.storeId
        ].filter(Boolean);

        const isAnyLinkedDeleted = linkedIds.some(lid => deletedIds.has(lid) || isStoreDeletedFromCache(lid));
        if (isAnyLinkedDeleted) {
          linkedIds.forEach(lid => removeStoreFromCache(lid));
          continue;
        }

        const status = String(vendorData.status || storeData.status || profileData.status || '').toLowerCase();
        // If marked deleted, inactive, or rejected, purge from cache and skip
        if (status === 'deleted' || status === 'rejected' || status === 'inactive') {
          removeStoreFromCache(id);
          continue;
        }

        const isActive = !status || status === 'active' || status === 'approved';
        const hasName = vendorData.shopName || vendorData.storeName || storeData.shopName || storeData.storeName || profileData.shopName || profileData.storeName;

        if (isActive && hasName) {
          const existing = storeMap.get(id);
          const combined = mergeStoreObjects(existing, {
            id,
            vendorId: id,
            ...vendorData,
            ...storeData,
            ...profileData
          });
          storeMap.set(id, combined);
        }
      }

      const finalList = sortStoresByVerifiedFirst(
        Array.from(storeMap.values()).filter(s => 
          s &&
          !deletedIds.has(s.id) && 
          !deletedIds.has(s.vendorId || '') &&
          !deletedIds.has(s.storeId || '') &&
          !deletedIds.has(s.userId || '') &&
          !isStoreDeletedFromCache(s.id) && 
          !isStoreDeletedFromCache(s.vendorId || '') && 
          !isStoreDeletedFromCache(s.storeId || '') && 
          !isStoreDeletedFromCache(s.userId || '') && 
          s.status !== 'deleted' && 
          s.status !== 'rejected'
        )
      );
      saveOfficialStoresToCache(finalList);
      lastFetchOfficialStoresTime = Date.now();
      return finalList;
    } catch (err) {
      console.warn('[fetchOfficialStoresFromRTDB error, using cached stores]:', err);
      return getOfficialStoresFromCache();
    } finally {
      inflightOfficialStoresFetch = null;
    }
  })();

  return inflightOfficialStoresFetch;
}

/**
 * Fetches a single store's full details from RTDB
 * Merges stores/${storeId}, vendors/${storeId}, vendor_profiles/${storeId}, vendor_themes/${storeId}
 * Returns isDeleted: true if vendor has been deleted from RTDB
 */
export async function fetchStoreDetailFromRTDB(storeId: string): Promise<CachedStore> {
  const cleanTarget = String(storeId).trim().toLowerCase();

  // If already flagged deleted in cache, return deleted immediately
  if (isStoreDeletedFromCache(storeId)) {
    return { id: storeId, isDeleted: true, status: 'deleted', shopName: 'Deleted Store' };
  }

  try {
    const [vendorSnap, profileSnap, storeSnap, themeSnap, deletedSnap] = await Promise.all([
      rtdbGet<any>(`vendors/${storeId}`),
      rtdbGet<any>(`vendor_profiles/${storeId}`),
      rtdbGet<any>(`stores/${storeId}`),
      rtdbGet<any>(`vendor_themes/${storeId}`),
      rtdbGet<any>(`deleted_vendors/${storeId}`)
    ]);

    if (deletedSnap) {
      removeStoreFromCache(storeId);
      return { id: storeId, isDeleted: true, status: 'deleted', shopName: 'Deleted Store' };
    }

    let resolvedVendor = vendorSnap;
    let resolvedProfile = profileSnap;
    let resolvedStore = storeSnap;
    let resolvedTheme = themeSnap;

    if (resolvedVendor?.status === 'deleted' || resolvedStore?.status === 'deleted' || resolvedProfile?.status === 'deleted') {
      removeStoreFromCache(storeId);
      return { id: storeId, isDeleted: true, status: 'deleted', shopName: 'Deleted Store' };
    }

    if (resolvedTheme && (resolvedTheme.primaryColor || resolvedTheme.layout)) {
      saveStoreThemeToCache(storeId, resolvedTheme);
    }

    // If direct lookup by ID didn't find anything, search stores & vendors lists by slug, id, or storeId
    if (!resolvedVendor && !resolvedProfile && !resolvedStore) {
      try {
        const [allVendors, allStores] = await Promise.all([
          rtdbGet<Record<string, any>>('vendors'),
          rtdbGet<Record<string, any>>('stores')
        ]);

        if (allVendors && typeof allVendors === 'object') {
          for (const [vKey, vVal] of Object.entries(allVendors)) {
            if (vVal && typeof vVal === 'object') {
              if (
                vKey.toLowerCase() === cleanTarget ||
                String(vVal.storeSlug || '').toLowerCase() === cleanTarget ||
                String(vVal.shopSlug || '').toLowerCase() === cleanTarget ||
                String(vVal.storeId || '').toLowerCase() === cleanTarget ||
                String(vVal.id || '').toLowerCase() === cleanTarget ||
                String(vVal.shopName || '').toLowerCase() === cleanTarget ||
                String(vVal.storeName || '').toLowerCase() === cleanTarget
              ) {
                resolvedVendor = vVal;
                try {
                  resolvedProfile = await rtdbGet<any>(`vendor_profiles/${vKey}`);
                } catch (_) {}
                break;
              }
            }
          }
        }

        if (!resolvedStore && allStores && typeof allStores === 'object') {
          for (const [sKey, sVal] of Object.entries(allStores)) {
            if (sVal && typeof sVal === 'object') {
              if (
                sKey.toLowerCase() === cleanTarget ||
                String(sVal.storeSlug || '').toLowerCase() === cleanTarget ||
                String(sVal.shopSlug || '').toLowerCase() === cleanTarget ||
                String(sVal.storeId || '').toLowerCase() === cleanTarget ||
                String(sVal.id || '').toLowerCase() === cleanTarget
              ) {
                resolvedStore = sVal;
                break;
              }
            }
          }
        }
      } catch (searchErr) {
        console.warn(`[RTDB search error for ${storeId}]:`, searchErr);
      }
    }

    const hasAnyRealData = !!resolvedVendor || !!resolvedProfile || !!resolvedStore;

    if (hasAnyRealData) {
      const cached = getStoreFromCache(storeId);
      const merged = mergeStoreObjects(cached, {
        id: storeId,
        ...(resolvedStore || {}),
        ...(resolvedVendor || {}),
        ...(resolvedProfile || {})
      });

      // Synchronize exact real followers count from RTDB store_followers
      try {
        const followersSnap = await rtdbList<any>('store_followers', (f: any) =>
          f?.vendorId === storeId || f?.storeId === storeId || String(f?.id || '').startsWith(`${storeId}_`)
        );
        merged.followersCount = followersSnap ? followersSnap.length : 0;
      } catch (_) {}

      // Synchronize authentic store rating & reviews count from RTDB vendor_reviews
      try {
        const revList = await rtdbList<any>('vendor_reviews', (r: any) =>
          r?.vendorId === storeId || r?.storeId === storeId || r?.data?.vendorId === storeId
        );
        if (revList && revList.length > 0) {
          const total = revList.reduce((acc, curr: any) => acc + (Number(curr?.data?.rating || curr?.rating) || 5), 0);
          merged.rating = Number((total / revList.length).toFixed(1));
          merged.reviewsCount = revList.length;
        } else {
          merged.rating = 0;
          merged.reviewsCount = 0;
        }
      } catch (_) {
        merged.rating = 0;
        merged.reviewsCount = 0;
      }

      // Compute authentic joined year from createdAt
      if (merged.createdAt) {
        const dt = new Date(merged.createdAt);
        if (!isNaN(dt.getTime())) {
          merged.joined = String(dt.getFullYear());
        }
      }

      if (resolvedTheme && (resolvedTheme.primaryColor || resolvedTheme.layout)) {
        merged.theme = { ...(merged.theme || {}), ...resolvedTheme };
        if (resolvedTheme.primaryColor) {
          merged.primaryColor = resolvedTheme.primaryColor;
        }
      }
      saveStoreToCache(storeId, merged);
      return merged;
    }

    // Check seed catalog
    const seed = getKnownSeedStore(cleanTarget);
    if (seed && !isStoreDeletedFromCache(seed.id)) {
      return seed;
    }

    // If no real data found in RTDB and not a seed store, this store was deleted or does not exist!
    removeStoreFromCache(storeId);
    return { id: storeId, isDeleted: true, status: 'deleted', shopName: 'Store Not Found' };
  } catch (err) {
    console.warn(`[fetchStoreDetailFromRTDB error for ${storeId}]:`, err);
    if (isStoreDeletedFromCache(storeId)) {
      return { id: storeId, isDeleted: true, status: 'deleted', shopName: 'Deleted Store' };
    }
    const cached = getStoreFromCache(storeId);
    return cached || { id: storeId, shopName: 'Official Store' };
  }
}
