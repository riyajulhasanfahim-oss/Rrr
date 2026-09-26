import { rtdbGet } from '../lib/rtdb';
import { BANGLADESH_DISTRICTS, type District, type Upazila } from '../data/bangladeshDistricts';
import { getStoreFromCache } from './storeCache';

export interface AuthoritativeVendorLocation {
  vendorId: string;
  storeName: string;
  district: string;
  upazila: string;
  division: string;
  area: string;
  addressString: string;
  latitude?: number;
  longitude?: number;
  isResolved: boolean;
  isMissing: boolean;
  source: 'vendor_profile' | 'store_data' | 'vendors_node' | 'product_data' | 'admin_hub' | 'missing';
  rawAddress?: any;
  isCodEnabled?: boolean;
}

// Bangladesh 64 District Centroids for instant, highly accurate fallback coordinates
export const DISTRICT_CENTROIDS: Record<string, { lat: number; lng: number; division: string }> = {
  'Dhaka': { lat: 23.8103, lng: 90.4125, division: 'Dhaka' },
  'Gazipur': { lat: 24.0023, lng: 90.4264, division: 'Dhaka' },
  'Narayanganj': { lat: 23.6238, lng: 90.5000, division: 'Dhaka' },
  'Tangail': { lat: 24.2513, lng: 89.9167, division: 'Dhaka' },
  'Kishoreganj': { lat: 24.4449, lng: 90.7766, division: 'Dhaka' },
  'Manikganj': { lat: 23.8617, lng: 90.0003, division: 'Dhaka' },
  'Munshiganj': { lat: 23.5422, lng: 90.5305, division: 'Dhaka' },
  'Narsingdi': { lat: 23.9322, lng: 90.7154, division: 'Dhaka' },
  'Faridpur': { lat: 23.6071, lng: 89.8429, division: 'Dhaka' },
  'Gopalganj': { lat: 23.0051, lng: 89.8266, division: 'Dhaka' },
  'Madaripur': { lat: 23.1641, lng: 90.1897, division: 'Dhaka' },
  'Rajbari': { lat: 23.7574, lng: 89.6445, division: 'Dhaka' },
  'Shariatpur': { lat: 23.2423, lng: 90.4348, division: 'Dhaka' },
  'Chattogram': { lat: 22.3569, lng: 91.7832, division: 'Chattogram' },
  "Cox's Bazar": { lat: 21.4272, lng: 92.0058, division: 'Chattogram' },
  'Coxs Bazar': { lat: 21.4272, lng: 92.0058, division: 'Chattogram' },
  'Cumilla': { lat: 23.4682, lng: 91.1788, division: 'Chattogram' },
  'Feni': { lat: 23.0159, lng: 91.3976, division: 'Chattogram' },
  'Brahmanbaria': { lat: 23.9571, lng: 91.1119, division: 'Chattogram' },
  'Chandpur': { lat: 23.2333, lng: 90.6667, division: 'Chattogram' },
  'Lakshmipur': { lat: 22.9425, lng: 90.8412, division: 'Chattogram' },
  'Noakhali': { lat: 22.8696, lng: 91.0998, division: 'Chattogram' },
  'Khagrachhari': { lat: 23.1193, lng: 91.9847, division: 'Chattogram' },
  'Rangamati': { lat: 22.7324, lng: 92.2985, division: 'Chattogram' },
  'Bandarban': { lat: 22.1953, lng: 92.2184, division: 'Chattogram' },
  'Sylhet': { lat: 24.8949, lng: 91.8687, division: 'Sylhet' },
  'Moulvibazar': { lat: 24.4829, lng: 91.7774, division: 'Sylhet' },
  'Habiganj': { lat: 24.3749, lng: 91.4155, division: 'Sylhet' },
  'Sunamganj': { lat: 25.0658, lng: 91.3950, division: 'Sylhet' },
  'Rajshahi': { lat: 24.3745, lng: 88.6042, division: 'Rajshahi' },
  'Bogura': { lat: 24.8465, lng: 89.3770, division: 'Rajshahi' },
  'Pabna': { lat: 24.0064, lng: 89.2372, division: 'Rajshahi' },
  'Sirajganj': { lat: 24.4534, lng: 89.7008, division: 'Rajshahi' },
  'Naogaon': { lat: 24.8138, lng: 88.9405, division: 'Rajshahi' },
  'Natore': { lat: 24.4206, lng: 88.9324, division: 'Rajshahi' },
  'Chapai Nawabganj': { lat: 24.5965, lng: 88.2775, division: 'Rajshahi' },
  'Joypurhat': { lat: 25.1015, lng: 89.0270, division: 'Rajshahi' },
  'Khulna': { lat: 22.8456, lng: 89.5403, division: 'Khulna' },
  'Jashore': { lat: 23.1664, lng: 89.2137, division: 'Khulna' },
  'Satkhira': { lat: 22.7185, lng: 89.0705, division: 'Khulna' },
  'Bagerhat': { lat: 22.6516, lng: 89.7859, division: 'Khulna' },
  'Kushtia': { lat: 23.9013, lng: 89.1205, division: 'Khulna' },
  'Jhenaidah': { lat: 23.5450, lng: 89.1726, division: 'Khulna' },
  'Chuadanga': { lat: 23.6402, lng: 88.8418, division: 'Khulna' },
  'Meherpur': { lat: 23.7622, lng: 88.6318, division: 'Khulna' },
  'Magura': { lat: 23.4873, lng: 89.4199, division: 'Khulna' },
  'Narail': { lat: 23.1725, lng: 89.5127, division: 'Khulna' },
  'Barishal': { lat: 22.7010, lng: 90.3535, division: 'Barishal' },
  'Bhola': { lat: 22.6859, lng: 90.6481, division: 'Barishal' },
  'Patuakhali': { lat: 22.3596, lng: 90.3299, division: 'Barishal' },
  'Pirojpur': { lat: 22.5841, lng: 89.9720, division: 'Barishal' },
  'Barguna': { lat: 22.1587, lng: 90.1256, division: 'Barishal' },
  'Jhalokati': { lat: 22.6406, lng: 90.1987, division: 'Barishal' },
  'Rangpur': { lat: 25.7439, lng: 89.2752, division: 'Rangpur' },
  'Dinajpur': { lat: 25.6217, lng: 88.6354, division: 'Rangpur' },
  'Gaibandha': { lat: 25.3288, lng: 89.5430, division: 'Rangpur' },
  'Kurigram': { lat: 25.8054, lng: 89.6362, division: 'Rangpur' },
  'Lalmonirhat': { lat: 25.9923, lng: 89.2847, division: 'Rangpur' },
  'Nilphamari': { lat: 25.9318, lng: 88.8560, division: 'Rangpur' },
  'Panchagarh': { lat: 26.3411, lng: 88.5542, division: 'Rangpur' },
  'Thakurgaon': { lat: 26.0337, lng: 88.4617, division: 'Rangpur' },
  'Mymensingh': { lat: 24.7471, lng: 90.4203, division: 'Mymensingh' },
  'Jamalpur': { lat: 24.9375, lng: 89.9378, division: 'Mymensingh' },
  'Netrokona': { lat: 24.8709, lng: 90.7279, division: 'Mymensingh' },
  'Sherpur': { lat: 25.0205, lng: 90.0153, division: 'Mymensingh' },
};

// In-memory cache for ultra-fast repeated delivery charge calculations
const vendorLocationCache = new Map<string, AuthoritativeVendorLocation>();

/**
 * Standardizes district name to ensure exact comparison and centroid lookup
 */
export function normalizeDistrictName(rawName: string = ''): string {
  if (!rawName) return '';
  const clean = rawName.trim().toLowerCase();

  if (clean.includes('cox') || clean.includes('কক্সবাজার')) return "Cox's Bazar";
  if (clean.includes('chattogram') || clean.includes('chittagong') || clean.includes('চট্টগ্রাম')) return 'Chattogram';
  if (clean.includes('dhaka') || clean.includes('ঢাকা')) return 'Dhaka';
  if (clean.includes('gazipur') || clean.includes('গাজীপুর')) return 'Gazipur';
  if (clean.includes('narayanganj') || clean.includes('নারায়ণগঞ্জ')) return 'Narayanganj';
  if (clean.includes('sylhet') || clean.includes('সিলেট')) return 'Sylhet';
  if (clean.includes('rajshahi') || clean.includes('রাজশাহী')) return 'Rajshahi';
  if (clean.includes('khulna') || clean.includes('খুলনা')) return 'Khulna';
  if (clean.includes('barishal') || clean.includes('barisal') || clean.includes('বরিশাল')) return 'Barishal';
  if (clean.includes('cumilla') || clean.includes('comilla') || clean.includes('কুমিল্লা')) return 'Cumilla';
  if (clean.includes('bogura') || clean.includes('bogra') || clean.includes('বগুড়া')) return 'Bogura';
  if (clean.includes('jashore') || clean.includes('jessore') || clean.includes('যশোর')) return 'Jashore';

  // Compare against BANGLADESH_DISTRICTS
  for (const d of BANGLADESH_DISTRICTS) {
    const cleanId = d.id.toLowerCase().replace(/['\s-]/g, '');
    const cleanRaw = clean.replace(/['\s-]/g, '');
    if (cleanId === cleanRaw || d.name.toLowerCase().includes(clean)) {
      return d.id === 'Coxs Bazar' ? "Cox's Bazar" : d.id;
    }
  }

  return rawName.trim();
}

/**
 * Resolves division for a district name
 */
export function getDivisionForDistrict(districtName: string): string {
  if (!districtName) return '';
  const norm = normalizeDistrictName(districtName);
  if (DISTRICT_CENTROIDS[norm]) {
    return DISTRICT_CENTROIDS[norm].division;
  }
  const clean = districtName.toLowerCase().trim();
  const found = BANGLADESH_DISTRICTS.find(d => 
    d.id.toLowerCase() === clean || 
    d.name.toLowerCase().includes(clean)
  );
  return found ? found.division : 'Dhaka';
}

/**
 * Calculates straight-line distance in kilometers using the Haversine formula
 */
export function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Resolves coordinates for any location (Store Origin or Customer Destination)
 */
export function resolveLocationCoordinates(loc?: {
  district?: string;
  upazila?: string;
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
}): { latitude: number; longitude: number } | null {
  if (!loc) return null;

  // 1. Direct GPS / explicit coordinates
  const latNum = Number(loc.latitude ?? loc.lat);
  const lngNum = Number(loc.longitude ?? loc.lng);
  if (!isNaN(latNum) && !isNaN(lngNum) && latNum > 15 && latNum < 35 && lngNum > 80 && lngNum < 100) {
    return { latitude: latNum, longitude: lngNum };
  }

  // 2. Centroid lookup by district name
  const normDist = normalizeDistrictName(loc.district);
  if (normDist && DISTRICT_CENTROIDS[normDist]) {
    return {
      latitude: DISTRICT_CENTROIDS[normDist].lat,
      longitude: DISTRICT_CENTROIDS[normDist].lng
    };
  }

  return null;
}

/**
 * Extracts and standardizes authoritative vendor location from raw data objects
 */
export function parseRawVendorLocation(
  data: any,
  fallbackVendorId: string = ''
): AuthoritativeVendorLocation {
  const d = data || {};

  const vId = String(
    d.vendorId || d.storeId || d.userId || d.id || fallbackVendorId || ''
  ).trim();

  const storeName = String(
    d.storeName || d.shopName || d.businessName || d.name || (vId === 'admin' || vId === 'admin_hub' ? 'RJ Official Store' : 'Vendor Store')
  ).trim();

  // 1. Check explicit structured vendorLocation object (saved by ShopProfile and VendorRegistration)
  const vLoc = d.vendorLocation || {};
  let district = String(vLoc.district || d.district || d.vendorDistrict || d.storeDistrict || '').trim();
  let upazila = String(vLoc.upazila || vLoc.thana || d.upazila || d.vendorUpazila || d.storeUpazila || d.thana || '').trim();
  let division = String(vLoc.division || d.division || d.vendorDivision || d.storeDivision || '').trim();
  let area = String(vLoc.area || d.area || d.vendorArea || '').trim();

  // 2. Check structured address object (saved in vendor profile / store profile)
  const addrObj = d.address && typeof d.address === 'object' ? d.address : null;
  if (addrObj) {
    if (!district) district = String(addrObj.district || addrObj.state || addrObj.city || '').trim();
    if (!upazila) upazila = String(addrObj.upazila || addrObj.thana || addrObj.city || '').trim();
    if (!division) division = String(addrObj.division || '').trim();
    if (!area) area = String(addrObj.street || addrObj.area || '').trim();
  }

  // 3. Collect address text from any strings / location fields for deep scanning
  const textParts: string[] = [];
  if (typeof d.address === 'string') textParts.push(d.address);
  if (typeof d.location === 'string') textParts.push(d.location);
  if (typeof d.fullAddress === 'string') textParts.push(d.fullAddress);
  if (typeof d.aboutStore === 'string') textParts.push(d.aboutStore);
  if (typeof d.description === 'string') textParts.push(d.description);
  if (d.city) textParts.push(String(d.city));
  if (d.state) textParts.push(String(d.state));

  const searchableText = textParts.filter(Boolean).join(' ').toLowerCase();

  // If district is not yet resolved, deep search in BANGLADESH_DISTRICTS
  if (!district && searchableText) {
    for (const dist of BANGLADESH_DISTRICTS) {
      const distId = dist.id.toLowerCase();
      const distName = dist.name.toLowerCase();
      if (
        searchableText.includes(distId) ||
        searchableText.includes(distName) ||
        (dist.id === 'Coxs Bazar' && (searchableText.includes('cox') || searchableText.includes('কক্সবাজার'))) ||
        (dist.id === 'Chattogram' && (searchableText.includes('chittagong') || searchableText.includes('চট্টগ্রাম')))
      ) {
        district = dist.id;
        if (!division) division = dist.division;
        break;
      }
    }
  }

  // If still not matched, check if any upazila was mentioned in text
  if (!district && searchableText) {
    for (const dist of BANGLADESH_DISTRICTS) {
      for (const up of dist.upazilas) {
        const upId = (typeof up === 'string' ? up : (up as Upazila).id || (up as Upazila).name).toLowerCase();
        const upName = (typeof up === 'string' ? up : (up as Upazila).name || (up as Upazila).id).toLowerCase();
        if (searchableText.includes(upId) || searchableText.includes(upName)) {
          district = dist.id;
          if (!upazila) upazila = typeof up === 'string' ? up : (up as Upazila).id;
          if (!division) division = dist.division;
          break;
        }
      }
      if (district) break;
    }
  }

  // Normalization
  let normalizedDistrict = '';
  let isResolved = false;

  if (district) {
    normalizedDistrict = normalizeDistrictName(district);
    isResolved = Boolean(DISTRICT_CENTROIDS[normalizedDistrict] || BANGLADESH_DISTRICTS.some(b => b.id.toLowerCase() === normalizedDistrict.toLowerCase()));
  }

  if (!upazila && isResolved) {
    upazila = `${normalizedDistrict} Sadar`;
  }

  if (!division && isResolved) {
    division = getDivisionForDistrict(normalizedDistrict);
  }

  // Coordinates
  const explicitCoords = resolveLocationCoordinates({
    latitude: vLoc.latitude ?? d.latitude ?? addrObj?.latitude,
    longitude: vLoc.longitude ?? d.longitude ?? addrObj?.longitude
  });

  const finalCoords = explicitCoords || (isResolved ? resolveLocationCoordinates({ district: normalizedDistrict }) : null);

  const fullAddressString = [
    area,
    upazila,
    normalizedDistrict,
    division,
    'Bangladesh'
  ].filter(Boolean).join(', ');

  const isCod = d.isCodEnabled !== false && 
                d.codEnabled !== false && 
                d.settings?.codEnabled !== false && 
                d.settings?.isCodEnabled !== false;

  return {
    vendorId: vId,
    storeName,
    district: isResolved ? normalizedDistrict : '',
    upazila: isResolved ? upazila : '',
    division: isResolved ? division : '',
    area,
    addressString: fullAddressString,
    latitude: finalCoords?.latitude,
    longitude: finalCoords?.longitude,
    isResolved,
    isMissing: !isResolved,
    source: isResolved ? (d.vendorLocation ? 'vendor_profile' : 'store_data') : 'missing',
    rawAddress: d.vendorLocation || d.address || null,
    isCodEnabled: isCod
  };
}

export function clearVendorLocationCache(vendorId?: string) {
  if (vendorId) {
    vendorLocationCache.delete(vendorId);
  } else {
    vendorLocationCache.clear();
  }
}

/**
 * Fetches authoritative vendor location strictly from Firebase Realtime Database.
 * Resolves across vendors/, stores/, and vendor_profiles/ nodes in RTDB.
 */
export async function fetchAuthoritativeVendorLocation(
  vendorOrStoreId: string,
  preloadedItem?: any
): Promise<AuthoritativeVendorLocation> {
  const cleanId = String(vendorOrStoreId || '').trim();

  // 1. Admin Official Hub Check
  if (!cleanId || cleanId === 'admin' || cleanId === 'admin_hub' || cleanId.toLowerCase() === 'official') {
    return {
      vendorId: 'admin_hub',
      storeName: 'RJ Official Store (Central Hub)',
      district: 'Dhaka',
      upazila: 'Dhaka Sadar / Kotwali',
      division: 'Dhaka',
      area: 'Motijheel / Sadar',
      addressString: 'RJ Official Central Warehouse, Motijheel, Dhaka, Bangladesh',
      latitude: 23.8103,
      longitude: 90.4125,
      isResolved: true,
      isMissing: false,
      source: 'admin_hub',
      isCodEnabled: true
    };
  }

  // 2. Query Firebase Realtime Database across all authoritative nodes concurrently
  try {
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2500));
    const [vendorsSnap, profilesSnap, storesSnap, usersSnap] = await Promise.race([
      Promise.all([
        rtdbGet<any>(`vendors/${cleanId}`).catch(() => null),
        rtdbGet<any>(`vendor_profiles/${cleanId}`).catch(() => null),
        rtdbGet<any>(`stores/${cleanId}`).catch(() => null),
        rtdbGet<any>(`users/${cleanId}`).catch(() => null),
      ]),
      timeoutPromise.then(() => [null, null, null, null])
    ]) as [any, any, any, any];

    // Priority for COD: If ANY authoritative vendor node has COD set to false, COD is false!
    const testDisabled = (obj: any) => {
      if (!obj) return false;
      if (obj.isCodEnabled === false || obj.codEnabled === false) return true;
      if (obj.settings && (obj.settings.isCodEnabled === false || obj.settings.codEnabled === false)) return true;
      return false;
    };

    const isCodExplicitlyDisabled = 
      testDisabled(vendorsSnap) || 
      testDisabled(profilesSnap) || 
      testDisabled(storesSnap) || 
      testDisabled(usersSnap) || 
      testDisabled(preloadedItem);

    // Merge in priority order: vendor_profiles > stores > vendors > users > preloadedItem
    const mergedData = {
      ...(preloadedItem || {}),
      ...(usersSnap || {}),
      ...(vendorsSnap || {}),
      ...(storesSnap || {}),
      ...(profilesSnap || {})
    };

    const resolved = parseRawVendorLocation(mergedData, cleanId);
    if (isCodExplicitlyDisabled) {
      resolved.isCodEnabled = false;
    }

    if (resolved.isResolved) {
      vendorLocationCache.set(cleanId, resolved);
      return resolved;
    }
  } catch (err) {
    console.warn(`[VendorLocationService] RTDB fetch warning for ${cleanId}:`, err);
  }

  // 3. Fallback to in-memory cache or preloaded item if RTDB unreachable
  if (vendorLocationCache.has(cleanId)) {
    const cached = vendorLocationCache.get(cleanId)!;
    if (cached.isResolved) {
      return cached;
    }
  }

  if (preloadedItem) {
    const fromPreloaded = parseRawVendorLocation(preloadedItem, cleanId);
    if (fromPreloaded.isResolved) {
      vendorLocationCache.set(cleanId, fromPreloaded);
      return fromPreloaded;
    }
  }

  // 4. Check storeCache / localStorage cache
  const cachedStore = getStoreFromCache(cleanId);
  if (cachedStore) {
    const fromStoreCache = parseRawVendorLocation(cachedStore, cleanId);
    if (fromStoreCache.isResolved) {
      vendorLocationCache.set(cleanId, fromStoreCache);
      return fromStoreCache;
    }
  }

  // 6. If completely unresolvable, return clean missing state (DO NOT DEFAULT TO DHAKA!)
  const missingResult: AuthoritativeVendorLocation = {
    vendorId: cleanId,
    storeName: preloadedItem?.storeName || preloadedItem?.vendorName || `Store ${cleanId.slice(-4)}`,
    district: '',
    upazila: '',
    division: '',
    area: '',
    addressString: '',
    isResolved: false,
    isMissing: true,
    source: 'missing',
    isCodEnabled: true
  };

  return missingResult;
}

/**
 * Synchronous resolver for instant renders when data is already partially in memory
 */
export function resolveVendorLocationSync(
  vendorOrStoreId: string,
  itemOrVendorData?: any
): AuthoritativeVendorLocation {
  const cleanId = String(vendorOrStoreId || '').trim();

  if (!cleanId || cleanId === 'admin' || cleanId === 'admin_hub') {
    return {
      vendorId: 'admin_hub',
      storeName: 'RJ Official Store (Central Hub)',
      district: 'Dhaka',
      upazila: 'Dhaka Sadar / Kotwali',
      division: 'Dhaka',
      area: 'Central Hub',
      addressString: 'RJ Official Central Warehouse, Motijheel, Dhaka, Bangladesh',
      latitude: 23.8103,
      longitude: 90.4125,
      isResolved: true,
      isMissing: false,
      source: 'admin_hub',
      isCodEnabled: true
    };
  }

  if (vendorLocationCache.has(cleanId)) {
    return vendorLocationCache.get(cleanId)!;
  }

  const parsed = parseRawVendorLocation(itemOrVendorData, cleanId);
  if (parsed.isResolved) {
    vendorLocationCache.set(cleanId, parsed);
    return parsed;
  }

  const cachedStore = getStoreFromCache(cleanId);
  if (cachedStore) {
    const fromStore = parseRawVendorLocation(cachedStore, cleanId);
    if (fromStore.isResolved) {
      vendorLocationCache.set(cleanId, fromStore);
      return fromStore;
    }
  }

  return parsed;
}

export const resolveAuthoritativeVendorLocation = fetchAuthoritativeVendorLocation;
