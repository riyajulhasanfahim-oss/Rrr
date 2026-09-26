import React, { useState, useEffect, createContext, useContext } from 'react';
import { rtdbGet } from '../lib/rtdb';
import ShopNotFound from './ShopNotFound';
import { 
  extractVendorSubdomain, 
  slugifyVendorName, 
  PRIMARY_DOMAIN 
} from '../utils/subdomain';

interface ShopDomainContextType {
  vendorId: string | null;
  loading: boolean;
  isShopDomain: boolean;
  isNotFound: boolean;
  subdomainSlug: string | null;
}

const ShopDomainContext = createContext<ShopDomainContextType>({ 
  vendorId: null, 
  loading: false,
  isShopDomain: false,
  isNotFound: false,
  subdomainSlug: null
});

export const useShopDomain = () => useContext(ShopDomainContext);

export default function ShopDomainWrapper({ children }: { children: React.ReactNode }) {
  // Synchronously detect subdomain on first render to eliminate layout flicker
  const [initialDomain] = useState(() => {
    if (typeof window === 'undefined') return { type: 'main' as const, slugOrDomain: null };
    return extractVendorSubdomain(window.location.hostname, window.location.search);
  });

  const isInitiallyShopDomain = initialDomain.type !== 'main' && Boolean(initialDomain.slugOrDomain);

  const [loading, setLoading] = useState(isInitiallyShopDomain);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [isShopDomain, setIsShopDomain] = useState(isInitiallyShopDomain);
  const [isNotFound, setIsNotFound] = useState(false);
  const [subdomainSlug, setSubdomainSlug] = useState<string | null>(initialDomain.slugOrDomain);

  useEffect(() => {
    let isMounted = true;

    const resolveDomain = async () => {
      try {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const search = typeof window !== 'undefined' ? window.location.search : '';

        // Extract subdomain or custom domain
        const result = extractVendorSubdomain(hostname, search);

        // 1. Main marketplace website (rjworldbd.com, www.rjworldbd.com, dev hosts without params)
        if (result.type === 'main' || !result.slugOrDomain) {
          if (isMounted) {
            setIsShopDomain(false);
            setVendorId(null);
            setIsNotFound(false);
            setSubdomainSlug(null);
            setLoading(false);
          }
          return;
        }

        // 2. Vendor Subdomain (e.g. "rj-world" from "https://rj-world.rjworldbd.com/")
        if (result.type === 'subdomain') {
          const targetSlug = result.slugOrDomain.toLowerCase().trim();
          if (isMounted) {
            setIsShopDomain(true);
            setSubdomainSlug(targetSlug);
          }

          // A. Quick check in local caches for instant zero-latency rendering
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && (k.startsWith('rj_vendor_profile_') || k.startsWith('rj_active_vendor_') || k.startsWith('rj_store_cache_'))) {
                const raw = localStorage.getItem(k);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  const pSlug = (parsed.shopSlug || parsed.storeSlug || '').toLowerCase().trim();
                  const pDom = (parsed.freeShopDomain || '').toLowerCase().trim();
                  const expectedDom = `${targetSlug}.${PRIMARY_DOMAIN}`;
                  const expectedLegacyDom = `${targetSlug}.rjworld.com`;
                  const vId = parsed.vendorId || parsed.userId || parsed.storeId || parsed.id;

                  if (
                    vId &&
                    (pSlug === targetSlug ||
                     pDom === expectedDom ||
                     pDom === expectedLegacyDom ||
                     vId === targetSlug)
                  ) {
                    if (isMounted) {
                      setVendorId(vId);
                      setIsShopDomain(true);
                      setIsNotFound(false);
                      setLoading(false);
                    }
                    // Continue to verify in background from RTDB
                  }
                }
              }
            }
          } catch (_) {}

          // B. Query Firebase Realtime Database across vendor_profiles, vendors, and stores
          const [profilesSnap, vendorsSnap, storesSnap] = await Promise.all([
            rtdbGet<Record<string, any>>('vendor_profiles', 2500).catch(() => null),
            rtdbGet<Record<string, any>>('vendors', 2500).catch(() => null),
            rtdbGet<Record<string, any>>('stores', 2500).catch(() => null)
          ]);

          const allRecords: Record<string, any> = {
            ...(storesSnap || {}),
            ...(vendorsSnap || {}),
            ...(profilesSnap || {})
          };

          let matchedVendorId: string | null = null;
          const expectedDomain = `${targetSlug}.${PRIMARY_DOMAIN}`;
          const expectedLegacyDomain = `${targetSlug}.rjworld.com`;

          // Match vendor by slug, domain, ID, or generated name slug
          for (const [key, record] of Object.entries(allRecords)) {
            if (!record || typeof record !== 'object') continue;

            const recSlug = (record.shopSlug || record.storeSlug || '').toLowerCase().trim();
            const recDomain = (record.freeShopDomain || '').toLowerCase().trim();
            const recId = String(record.vendorId || record.userId || record.storeId || record.id || key).trim();

            if (
              recSlug === targetSlug ||
              recDomain === expectedDomain ||
              recDomain === expectedLegacyDomain ||
              recId.toLowerCase() === targetSlug ||
              key.toLowerCase() === targetSlug
            ) {
              matchedVendorId = recId || key;
              break;
            }

            // Fallback: match by transliterated slug of shopName or storeName
            const rawName = (record.shopName || record.storeName || record.name || '').trim();
            if (rawName && slugifyVendorName(rawName) === targetSlug) {
              matchedVendorId = recId || key;
              break;
            }
          }

          if (isMounted) {
            if (matchedVendorId) {
              setVendorId(matchedVendorId);
              setIsShopDomain(true);
              setIsNotFound(false);
            } else {
              setIsShopDomain(true);
              setIsNotFound(true);
            }
            setLoading(false);
          }
          return;
        }

        // 3. Custom Domain (e.g. "mystore.com")
        if (result.type === 'custom') {
          const targetDomain = result.slugOrDomain.toLowerCase().trim();
          if (isMounted) {
            setIsShopDomain(true);
            setSubdomainSlug(targetDomain);
          }

          const [profilesSnap, vendorsSnap, storesSnap] = await Promise.all([
            rtdbGet<Record<string, any>>('vendor_profiles', 2500).catch(() => null),
            rtdbGet<Record<string, any>>('vendors', 2500).catch(() => null),
            rtdbGet<Record<string, any>>('stores', 2500).catch(() => null)
          ]);

          const allRecords: Record<string, any> = {
            ...(storesSnap || {}),
            ...(vendorsSnap || {}),
            ...(profilesSnap || {})
          };

          let matchedVendorId: string | null = null;

          for (const [key, record] of Object.entries(allRecords)) {
            if (!record || typeof record !== 'object') continue;

            const customDom = (record.customDomain || '').toLowerCase().trim().replace('https://', '').replace('http://', '').split('/')[0];
            const isVerified = record.customDomainStatus === 'Verified' || record.verificationStatus === 'Verified' || record.verified === true;

            if (customDom === targetDomain && isVerified) {
              matchedVendorId = record.vendorId || record.userId || record.storeId || record.id || key;
              break;
            }
          }

          if (isMounted) {
            if (matchedVendorId) {
              setVendorId(matchedVendorId);
              setIsShopDomain(true);
              setIsNotFound(false);
            } else {
              setIsShopDomain(true);
              setIsNotFound(true);
            }
            setLoading(false);
          }
        }
      } catch (err) {
        console.warn('Domain resolution warning:', err);
        if (isMounted) {
          setIsShopDomain(isInitiallyShopDomain);
          setIsNotFound(isInitiallyShopDomain);
          setLoading(false);
        }
      }
    };

    resolveDomain();

    return () => {
      isMounted = false;
    };
  }, [isInitiallyShopDomain]);

  // If loading a vendor subdomain, show brief clean spinner
  if (loading && isShopDomain) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-3 border-primary-main border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-semibold text-gray-600">Loading Store...</p>
      </div>
    );
  }

  // If this subdomain does not match any registered vendor
  if (isShopDomain && isNotFound) {
    return <ShopNotFound />;
  }

  return (
    <ShopDomainContext.Provider value={{ vendorId, loading, isShopDomain, isNotFound, subdomainSlug }}>
      {children}
    </ShopDomainContext.Provider>
  );
}
