import { rtdbGet } from '../lib/rtdb';

export const PRIMARY_DOMAIN = 'rjworldbd.com';

// Reserved subdomains that cannot be assigned to vendors
export const RESERVED_SUBDOMAINS = new Set([
  'www',
  'admin',
  'api',
  'mail',
  'email',
  'cpanel',
  'webmail',
  'ftp',
  'autodiscover',
  'autoconfig',
  'app',
  'auth',
  'support',
  'help',
  'billing',
  'status',
  'ns1',
  'ns2',
  'mx',
  'smtp',
  'pop',
  'imap',
  'root',
  'store',
  'shop',
  'marketplace',
  'dashboard',
  'static',
  'assets',
  'cdn'
]);

/**
 * Converts Bengali text and words to clean Latin phonetics
 */
export function banglaToSlug(text: string): string {
  if (!text) return '';
  let s = text.trim().toLowerCase();

  // Common Bengali e-commerce and retail terms dictionary
  const dict: [RegExp, string][] = [
    [/স্টোর|ষ্টোর/g, 'store'],
    [/শপ/g, 'shop'],
    [/মার্ট/g, 'mart'],
    [/ফ্যাশন/g, 'fashion'],
    [/ইলেকট্রনিক্স|ইলেক্ট্রনিক্স/g, 'electronics'],
    [/কালেকশন/g, 'collection'],
    [/এন্টারপ্রাইজ/g, 'enterprise'],
    [/ট্রেডার্স|ট্রেডারস/g, 'traders'],
    [/বাজার/g, 'bazar'],
    [/মেলা/g, 'mela'],
    [/বিডি/g, 'bd'],
    [/ওয়ার্ল্ড|ওয়ার্ল্ড/g, 'world'],
    [/আরজে/g, 'rj'],
    [/পয়েন্ট|পয়েন্ট/g, 'point'],
    [/হাব/g, 'hub'],
    [/জোন/g, 'zone'],
    [/গ্যাজেট/g, 'gadget'],
    [/কম্পিউটার/g, 'computer'],
    [/মোবাইল/g, 'mobile'],
    [/জুয়েলার্স|জুয়েলার্স/g, 'jewellers'],
    [/বুটিক/g, 'boutique'],
    [/টেলিকম/g, 'telecom'],
    [/অফিসিয়াল|অফিসিয়াল/g, 'official'],
    [/অনলাইন/g, 'online'],
    [/মায়ের দোয়া|মায়ের দোয়া/g, 'mayer-doya']
  ];

  for (const [pattern, repl] of dict) {
    s = s.replace(pattern, ' ' + repl + ' ');
  }

  // Bengali character transliteration table
  const charMap: Record<string, string> = {
    // Vowels
    'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
    // Vowel marks (Kar)
    'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
    // Consonants
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
    'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
    'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
    'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't',
    // Signs
    'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n', '্': '',
    // Numbers
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };

  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (charMap[ch] !== undefined) {
      out += charMap[ch];
    } else {
      out += ch;
    }
  }

  return out;
}

/**
 * Generates a valid DNS-compliant subdomain slug from any vendor name.
 * - Converts Bengali characters to clean English phonetics
 * - Replaces spaces & special characters with hyphens
 * - Removes invalid characters
 * - Avoids double hyphens and trims leading/trailing hyphens
 */
export function slugifyVendorName(text: string): string {
  if (!text) return 'store';

  const transliterated = banglaToSlug(text);

  let clean = transliterated
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!clean || clean.length < 2) {
    clean = 'store';
  }

  // Maximum DNS label length is 63 characters
  if (clean.length > 50) {
    clean = clean.substring(0, 50).replace(/-+$/, '');
  }

  // If slug matches reserved names, append '-shop'
  if (RESERVED_SUBDOMAINS.has(clean)) {
    clean = `${clean}-shop`;
  }

  return clean;
}

/**
 * Returns the full subdomain string, e.g. "fahim-store.rjworldbd.com"
 */
export function getVendorSubdomain(slug: string): string {
  const cleanSlug = slugifyVendorName(slug);
  return `${cleanSlug}.${PRIMARY_DOMAIN}`;
}

/**
 * Returns the full store URL, e.g. "https://fahim-store.rjworldbd.com/"
 */
export function getVendorStoreUrl(slug: string): string {
  return `https://${getVendorSubdomain(slug)}/`;
}

export interface DomainExtractionResult {
  type: 'subdomain' | 'custom' | 'main';
  slugOrDomain: string | null;
}

/**
 * Extracts vendor subdomain slug or custom domain from current hostname and search params
 */
export function extractVendorSubdomain(
  hostname: string,
  search?: URLSearchParams | string
): DomainExtractionResult {
  const host = (hostname || '').toLowerCase().trim().split(':')[0]; // strip port

  // 1. Check test / preview parameters (allows testing in development/preview environments)
  const searchParams = typeof search === 'string' 
    ? new URLSearchParams(search) 
    : search instanceof URLSearchParams 
      ? search 
      : typeof window !== 'undefined' 
        ? new URLSearchParams(window.location.search) 
        : null;

  if (searchParams) {
    const testSubdomain = searchParams.get('test_shop_domain') || 
                          searchParams.get('subdomain') || 
                          searchParams.get('vendor_subdomain') ||
                          searchParams.get('store_domain');
    if (testSubdomain) {
      let slug = testSubdomain.toLowerCase().trim().replace('https://', '').replace('http://', '').split('/')[0];
      if (slug.endsWith(`.${PRIMARY_DOMAIN}`)) {
        slug = slug.replace(`.${PRIMARY_DOMAIN}`, '');
      } else if (slug.endsWith('.rjworld.com')) {
        slug = slug.replace('.rjworld.com', '');
      }
      slug = slugifyVendorName(slug);
      if (slug && !RESERVED_SUBDOMAINS.has(slug)) {
        return { type: 'subdomain', slugOrDomain: slug };
      }
    }
  }

  // 2. Check window.__RJ_VENDOR_SUBDOMAIN__ if injected by server
  if (typeof window !== 'undefined' && (window as any).__RJ_VENDOR_SUBDOMAIN__) {
    const s = String((window as any).__RJ_VENDOR_SUBDOMAIN__).toLowerCase().trim();
    if (s && !RESERVED_SUBDOMAINS.has(s)) {
      return { type: 'subdomain', slugOrDomain: s };
    }
  }

  if (!host) {
    return { type: 'main', slugOrDomain: null };
  }

  // 3. Check for exact main domains
  if (
    host === PRIMARY_DOMAIN ||
    host === `www.${PRIMARY_DOMAIN}` ||
    host === 'rjworld.com' ||
    host === 'www.rjworld.com'
  ) {
    return { type: 'main', slugOrDomain: null };
  }

  // 4. Check for wildcard subdomains on rjworldbd.com
  // Example: rj-world.rjworldbd.com or abc-fashion.rjworldbd.com
  const bdSuffix = `.${PRIMARY_DOMAIN}`;
  if (host.endsWith(bdSuffix)) {
    const sub = host.substring(0, host.length - bdSuffix.length).trim();
    if (sub && !RESERVED_SUBDOMAINS.has(sub)) {
      // Subdomain might have multiple levels (e.g. store.abc.rjworldbd.com -> take first label)
      const firstLabel = sub.split('.')[0];
      if (firstLabel && !RESERVED_SUBDOMAINS.has(firstLabel)) {
        return { type: 'subdomain', slugOrDomain: firstLabel };
      }
    }
    return { type: 'main', slugOrDomain: null };
  }

  // Also check legacy rjworld.com suffix
  const legacySuffix = '.rjworld.com';
  if (host.endsWith(legacySuffix)) {
    const sub = host.substring(0, host.length - legacySuffix.length).trim();
    if (sub && !RESERVED_SUBDOMAINS.has(sub)) {
      const firstLabel = sub.split('.')[0];
      if (firstLabel && !RESERVED_SUBDOMAINS.has(firstLabel)) {
        return { type: 'subdomain', slugOrDomain: firstLabel };
      }
    }
    return { type: 'main', slugOrDomain: null };
  }

  // 5. Check local development subdomains, e.g. "fahim.localhost"
  if (host.endsWith('.localhost')) {
    const sub = host.replace('.localhost', '').trim();
    if (sub && !RESERVED_SUBDOMAINS.has(sub)) {
      return { type: 'subdomain', slugOrDomain: sub };
    }
    return { type: 'main', slugOrDomain: null };
  }

  // 6. Preview / dev hosting environments (without subdomain parameters)
  const isDevHost = 
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.includes('run.app') ||
    host.includes('pages.dev') ||
    host.includes('workers.dev') ||
    host.includes('webcontainer.io') ||
    host.includes('cloudworkstations.dev') ||
    host.includes('googleusercontent.com') ||
    host.includes('ai.studio') ||
    host.includes('ais-');

  if (isDevHost) {
    return { type: 'main', slugOrDomain: null };
  }

  // 7. Otherwise, treat as an external custom domain pointing to a vendor store
  return { type: 'custom', slugOrDomain: host };
}

/**
 * Generates an assured unique subdomain slug for a vendor by querying RTDB
 */
export async function generateUniqueVendorSlug(
  shopName: string,
  currentVendorId?: string,
  existingProfiles?: Record<string, any>
): Promise<string> {
  const baseSlug = slugifyVendorName(shopName);
  let uniqueSlug = baseSlug;
  let counter = 1;
  let isUnique = false;

  let allProfiles = existingProfiles;
  if (!allProfiles) {
    try {
      const [profilesSnap, vendorsSnap, storesSnap] = await Promise.all([
        rtdbGet<Record<string, any>>('vendor_profiles', 2000),
        rtdbGet<Record<string, any>>('vendors', 2000),
        rtdbGet<Record<string, any>>('stores', 2000)
      ]);
      allProfiles = {
        ...(storesSnap || {}),
        ...(vendorsSnap || {}),
        ...(profilesSnap || {})
      };
    } catch {
      allProfiles = {};
    }
  }

  while (!isUnique) {
    const hasConflict = Object.entries(allProfiles || {}).some(([uid, p]: [string, any]) => {
      if (currentVendorId && (uid === currentVendorId || p?.userId === currentVendorId || p?.vendorId === currentVendorId)) {
        return false;
      }
      if (!p || typeof p !== 'object') return false;

      const pSlug = (p.shopSlug || p.storeSlug || '').toLowerCase().trim();
      const pDom = (p.freeShopDomain || '').toLowerCase().trim();
      const targetDom = `${uniqueSlug}.${PRIMARY_DOMAIN}`;
      const legacyDom = `${uniqueSlug}.rjworld.com`;

      return (
        pSlug === uniqueSlug ||
        pDom === targetDom ||
        pDom === legacyDom
      );
    });

    if (!hasConflict) {
      isUnique = true;
    } else {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  return uniqueSlug;
}

/**
 * Returns the proper URL to open a vendor's store.
 * - In production: opens `https://${freeShopDomain}/`
 * - In dev/preview environments: opens using `test_shop_domain` parameter so it resolves instantly in the current environment
 */
export function getVendorOpenUrl(freeShopDomain: string, vendorId?: string): string {
  if (!freeShopDomain && vendorId) {
    return `/store/${vendorId}`;
  }
  if (!freeShopDomain) return '/';

  const cleanDomain = freeShopDomain.replace('https://', '').replace('http://', '').replace(/\/$/, '');
  
  // In development / preview environments (not rjworldbd.com), use query param to guarantee local preview works
  if (typeof window !== 'undefined') {
    const currentHost = (window.location.hostname || '').toLowerCase();
    const isProd = currentHost === PRIMARY_DOMAIN || currentHost.endsWith(`.${PRIMARY_DOMAIN}`);
    if (!isProd) {
      return `${window.location.origin}/?test_shop_domain=${encodeURIComponent(cleanDomain)}`;
    }
  }

  return `https://${cleanDomain}/`;
}
