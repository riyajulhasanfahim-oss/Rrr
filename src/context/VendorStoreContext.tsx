import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { rtdbGet, rtdbUpdate, rtdbSet, rtdbSubscribe } from '../lib/rtdb';
import { RTDB_BASE_URL } from '../lib/firebase';
import { 
  getVendorSubdomain, 
  slugifyVendorName, 
  PRIMARY_DOMAIN 
} from '../utils/subdomain';

export interface VendorStoreData {
  storeId?: string;
  vendorId?: string;
  userId?: string;
  shopName?: string;
  storeName?: string;
  ownerName?: string;
  name?: string;
  phone?: string;
  contactNumber?: string;
  mobileNumber?: string;
  whatsappNumber?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    youtube?: string;
    tiktok?: string;
    [key: string]: any;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  } | string;
  category?: string;
  businessCategory?: string;
  openingHours?: string;
  businessHours?: string;
  status?: string;
  logo?: string;
  shopLogo?: string;
  profileImage?: string;
  banner?: string;
  shopBanner?: string;
  description?: string;
  rating?: number | string;
  reviews?: number;
  followers?: number;
  followersCount?: number;
  shopSlug?: string;
  storeSlug?: string;
  freeShopDomain?: string;
  customDomain?: string;
  customDomainStatus?: string;
  verificationStatus?: string;
  isVerifiedSeller?: boolean;
  verifiedSellerPlanActive?: boolean;
  verificationBadge?: boolean;
  isCodEnabled?: boolean;
  codEnabled?: boolean;
  planExpiresAt?: number;
  settings?: any;
  theme?: any;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  outOfStock: number;
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  todaySales: number;
  weeklySales: number;
  monthlySales: number;
  walletBalance: number;
  pendingWithdraw: number;
}

interface VendorStoreContextType {
  vendorInfo: VendorStoreData | null;
  loading: boolean;
  isLoaded: boolean;
  updateVendorInfo: (partial: Partial<VendorStoreData>) => Promise<void>;
  refreshVendorInfo: () => Promise<VendorStoreData | null>;
  dashboardStats: DashboardStats | null;
  setDashboardStats: React.Dispatch<React.SetStateAction<DashboardStats | null>>;
  salesChartData: any[] | null;
  setSalesChartData: React.Dispatch<React.SetStateAction<any[] | null>>;
  topProductsList: any[] | null;
  setTopProductsList: React.Dispatch<React.SetStateAction<any[] | null>>;
}

const VendorStoreContext = createContext<VendorStoreContextType | undefined>(undefined);

// Helper to remove any undefined fields before sending to Realtime Database
function cleanObject(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanObject).filter(v => v !== undefined);
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = cleanObject(value);
    }
  }
  return result;
}

// Safely reads stored vendor data from localStorage caches
function getCachedVendorData(uid: string): VendorStoreData | null {
  if (!uid) return null;
  try {
    let combined: any = {};
    let foundAny = false;

    // Check primary store cache
    const primary = localStorage.getItem('rj_vendor_store_' + uid);
    if (primary) {
      try {
        const parsed = JSON.parse(primary);
        if (parsed && typeof parsed === 'object') {
          combined = { ...combined, ...parsed };
          foundAny = true;
        }
      } catch (_) {}
    }

    // Check profile cache
    const profile = localStorage.getItem('rj_vendor_profile_' + uid);
    if (profile) {
      try {
        const parsed = JSON.parse(profile);
        if (parsed && typeof parsed === 'object') {
          combined = { ...combined, ...parsed };
          foundAny = true;
        }
      } catch (_) {}
    }

    // Check active vendor cache
    const active = localStorage.getItem('rj_active_vendor_' + uid);
    if (active) {
      try {
        const parsed = JSON.parse(active);
        if (parsed && typeof parsed === 'object') {
          combined = { ...combined, ...parsed };
          foundAny = true;
        }
      } catch (_) {}
    }

    if (foundAny && (combined.shopName || combined.storeName || combined.vendorId || combined.storeId)) {
      return combined;
    }
  } catch (_) {}
  return null;
}

// Safely saves vendor data to localStorage
function saveCachedVendorData(uid: string, data: VendorStoreData): void {
  if (!uid || !data) return;
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem('rj_vendor_store_' + uid, serialized);
    localStorage.setItem('rj_vendor_profile_' + uid, serialized);
    localStorage.setItem('rj_active_vendor_' + uid, serialized);
  } catch (_) {}
}

export const VendorStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userData } = useAuth();
  const currentUid = user?.uid;

  // Initialize with cached store data synchronously to prevent any blank/default state on initial mount
  const [vendorInfo, setVendorInfo] = useState<VendorStoreData | null>(() => {
    if (currentUid) {
      return getCachedVendorData(currentUid);
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(() => {
    return currentUid ? !!getCachedVendorData(currentUid) : false;
  });

  // Cached stats to prevent zeros/flickers on navigation
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(() => {
    if (currentUid) {
      try {
        const cached = localStorage.getItem('rj_vendor_stats_' + currentUid);
        if (cached) return JSON.parse(cached);
      } catch (_) {}
    }
    return null;
  });

  const [salesChartData, setSalesChartData] = useState<any[] | null>(null);
  const [topProductsList, setTopProductsList] = useState<any[] | null>(null);

  // Keep a ref of the latest vendorInfo to prevent stale closures or overwriting with empty data
  const latestVendorInfoRef = useRef<VendorStoreData | null>(vendorInfo);
  latestVendorInfoRef.current = vendorInfo;

  // Merge new data on top of existing valid data (never overwrite valid with empty/null)
  const mergeVendorData = useCallback((newData: any, fallbackPrev?: VendorStoreData | null): VendorStoreData => {
    const prev = fallbackPrev || latestVendorInfoRef.current || {};
    const merged: any = { ...prev };

    if (!newData || typeof newData !== 'object') {
      return merged;
    }

    for (const [key, value] of Object.entries(newData)) {
      // If value is null, undefined, or empty string, preserve existing valid value if exists
      if (value === undefined || value === null) {
        continue;
      }
      if (typeof value === 'string' && value.trim() === '' && prev[key]) {
        continue;
      }
      if (typeof value === 'object' && !Array.isArray(value) && typeof prev[key] === 'object' && !Array.isArray(prev[key])) {
        merged[key] = { ...(prev[key] || {}), ...value };
      } else {
        merged[key] = value;
      }
    }

    // Resolve unified aliases
    merged.storeId = merged.storeId || currentUid;
    merged.vendorId = merged.vendorId || currentUid;
    merged.userId = merged.userId || currentUid;
    merged.shopName = merged.shopName || merged.storeName || prev.shopName || prev.storeName;
    merged.storeName = merged.storeName || merged.shopName || prev.storeName || prev.shopName;
    merged.logo = merged.logo || merged.shopLogo || merged.profileImage || prev.logo || prev.shopLogo;
    merged.shopLogo = merged.shopLogo || merged.logo || prev.shopLogo;
    merged.banner = merged.banner || merged.shopBanner || prev.banner || prev.shopBanner;
    merged.shopBanner = merged.shopBanner || merged.banner || prev.shopBanner;
    merged.contactNumber = merged.contactNumber || merged.phone || merged.mobileNumber || prev.contactNumber;
    merged.phone = merged.phone || merged.contactNumber || prev.phone;
    merged.whatsappNumber = merged.whatsappNumber || merged.whatsapp || prev.whatsappNumber;
    merged.whatsapp = merged.whatsapp || merged.whatsappNumber || prev.whatsapp;
    merged.description = merged.description !== undefined && merged.description !== '' ? merged.description : prev.description;

    // Harmonize Cash on Delivery (COD) aliases to be identical boolean
    if (newData?.isCodEnabled !== undefined) {
      merged.isCodEnabled = Boolean(newData.isCodEnabled);
      merged.codEnabled = Boolean(newData.isCodEnabled);
    } else if (newData?.codEnabled !== undefined) {
      merged.isCodEnabled = Boolean(newData.codEnabled);
      merged.codEnabled = Boolean(newData.codEnabled);
    } else if (prev?.isCodEnabled !== undefined) {
      merged.isCodEnabled = Boolean(prev.isCodEnabled);
      merged.codEnabled = Boolean(prev.isCodEnabled);
    } else if (prev?.codEnabled !== undefined) {
      merged.isCodEnabled = Boolean(prev.codEnabled);
      merged.codEnabled = Boolean(prev.codEnabled);
    } else {
      merged.isCodEnabled = true;
      merged.codEnabled = true;
    }

    return merged;
  }, [currentUid]);

  // Fetch full store data from Firebase Realtime Database
  const fetchStoreData = useCallback(async (uid: string, showLoadingIndicator = false): Promise<VendorStoreData | null> => {
    if (!uid) return null;

    if (showLoadingIndicator) {
      setLoading(true);
    }

    try {
      // Fetch concurrently from RTDB nodes
      const [profileSnap, vendorSnap, storeSnap] = await Promise.all([
        rtdbGet<any>(`vendor_profiles/${uid}`),
        rtdbGet<any>(`vendors/${uid}`),
        rtdbGet<any>(`stores/${uid}`)
      ]);

      // Direct REST fallback if SDK returns null
      let restProfile = profileSnap;
      let restVendor = vendorSnap;
      if (!restProfile && !restVendor) {
        try {
          const [pRes, vRes] = await Promise.all([
            fetch(`${RTDB_BASE_URL}/vendor_profiles/${uid}.json`).catch(() => null),
            fetch(`${RTDB_BASE_URL}/vendors/${uid}.json`).catch(() => null)
          ]);
          if (pRes && pRes.ok) restProfile = await pRes.json();
          if (vRes && vRes.ok) restVendor = await vRes.json();
        } catch (_) {}
      }

      // Read any locally cached data as base
      const localCache = getCachedVendorData(uid);

      let combined: any = {
        ...(localCache || {}),
        ...(storeSnap || {}),
        ...(restVendor || {}),
        ...(restProfile || {})
      };

      // If no vendor record exists at all in RTDB and local cache is empty, do NOT auto-create!
      if (!restProfile && !restVendor && !storeSnap && !localCache) {
        setVendorInfo(null);
        latestVendorInfoRef.current = null;
        setIsLoaded(true);
        return null;
      }

      // Merge on top of previous state ensuring no valid fields disappear
      const finalData = mergeVendorData(combined, latestVendorInfoRef.current);

      // Ensure freeShopDomain is correctly formatted to rjworldbd.com
      if (finalData) {
        const currentDom = (finalData.freeShopDomain || '').toLowerCase().trim();
        if (!currentDom || !currentDom.endsWith(`.${PRIMARY_DOMAIN}`) || currentDom.endsWith('.rjworld.com')) {
          const rawName = finalData.shopSlug || finalData.storeSlug || finalData.shopName || finalData.storeName || '';
          if (rawName) {
            const derivedSlug = slugifyVendorName(rawName);
            finalData.freeShopDomain = getVendorSubdomain(derivedSlug);
            finalData.shopSlug = finalData.shopSlug || derivedSlug;
            finalData.storeSlug = finalData.storeSlug || derivedSlug;
          }
        }
      }
      
      // Update state and save to cache
      setVendorInfo(finalData);
      latestVendorInfoRef.current = finalData;
      setIsLoaded(true);
      saveCachedVendorData(uid, finalData);

      return finalData;
    } catch (err) {
      console.warn('[VendorStoreContext] Error fetching store data from RTDB:', err);
      // On error, NEVER clear existing vendorInfo! Keep existing valid state.
      return latestVendorInfoRef.current;
    } finally {
      setLoading(false);
    }
  }, [user, userData, mergeVendorData]);

  // Update store data in context, localStorage, and RTDB
  const updateVendorInfo = useCallback(async (partial: Partial<VendorStoreData>): Promise<void> => {
    if (!currentUid) return;

    // 1. Optimistically merge into state immediately
    const updated = mergeVendorData(partial, latestVendorInfoRef.current);
    setVendorInfo(updated);
    latestVendorInfoRef.current = updated;
    saveCachedVendorData(currentUid, updated);

    // 2. Dispatch custom event so listeners know data updated
    try {
      window.dispatchEvent(new Event('vendor_profile_updated'));
    } catch (_) {}

    // 3. Write to RTDB across vendor_profiles, vendors, and stores
    try {
      const cleaned = cleanObject({
        ...partial,
        updatedAt: Date.now()
      });

      await Promise.allSettled([
        rtdbUpdate(`vendor_profiles/${currentUid}`, cleaned),
        rtdbUpdate(`vendors/${currentUid}`, cleaned),
        rtdbUpdate(`stores/${currentUid}`, cleaned),
        rtdbUpdate(`users/${currentUid}`, cleaned)
      ]);
    } catch (err) {
      console.error('[VendorStoreContext] Error persisting store updates to RTDB:', err);
    }
  }, [currentUid, mergeVendorData]);

  // Manual refresh helper
  const refreshVendorInfo = useCallback(async (): Promise<VendorStoreData | null> => {
    if (!currentUid) return null;
    return await fetchStoreData(currentUid, false);
  }, [currentUid, fetchStoreData]);

  // Sync with user authentication lifecycle
  useEffect(() => {
    if (!currentUid) {
      setVendorInfo(null);
      setIsLoaded(false);
      return;
    }

    // Check if we have cached data for this uid
    const cached = getCachedVendorData(currentUid);
    if (cached) {
      setVendorInfo(prev => prev || cached);
      setIsLoaded(true);
    }

    // Fetch fresh data from RTDB in background without wiping current state
    fetchStoreData(currentUid, !cached);

    // Realtime subscription to RTDB vendor_profiles
    const unsubProfile = rtdbSubscribe<any>(`vendor_profiles/${currentUid}`, (snap) => {
      if (snap && typeof snap === 'object') {
        const merged = mergeVendorData(snap, latestVendorInfoRef.current);
        setVendorInfo(merged);
        latestVendorInfoRef.current = merged;
        saveCachedVendorData(currentUid, merged);
      }
    });

    // Realtime subscription to RTDB vendors
    const unsubVendor = rtdbSubscribe<any>(`vendors/${currentUid}`, (snap) => {
      if (snap && typeof snap === 'object') {
        const merged = mergeVendorData(snap, latestVendorInfoRef.current);
        setVendorInfo(merged);
        latestVendorInfoRef.current = merged;
        saveCachedVendorData(currentUid, merged);
      }
    });

    // Listen for manual profile update events or storage events from other tabs
    const handleProfileUpdate = () => {
      const freshCached = getCachedVendorData(currentUid);
      if (freshCached) {
        setVendorInfo(freshCached);
        latestVendorInfoRef.current = freshCached;
      }
    };

    window.addEventListener('vendor_profile_updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);

    return () => {
      unsubProfile();
      unsubVendor();
      window.removeEventListener('vendor_profile_updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, [currentUid, fetchStoreData, mergeVendorData]);

  // Persist dashboardStats to localStorage whenever it changes
  useEffect(() => {
    if (currentUid && dashboardStats) {
      try {
        localStorage.setItem('rj_vendor_stats_' + currentUid, JSON.stringify(dashboardStats));
      } catch (_) {}
    }
  }, [currentUid, dashboardStats]);

  const value = {
    vendorInfo,
    loading,
    isLoaded,
    updateVendorInfo,
    refreshVendorInfo,
    dashboardStats,
    setDashboardStats,
    salesChartData,
    setSalesChartData,
    topProductsList,
    setTopProductsList
  };

  return (
    <VendorStoreContext.Provider value={value}>
      {children}
    </VendorStoreContext.Provider>
  );
};

export const useVendorStore = (): VendorStoreContextType => {
  const context = useContext(VendorStoreContext);
  if (!context) {
    throw new Error('useVendorStore must be used within a VendorStoreProvider');
  }
  return context;
};
export default VendorStoreContext;
