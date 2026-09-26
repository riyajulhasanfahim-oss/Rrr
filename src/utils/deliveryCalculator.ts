import { BANGLADESH_DISTRICTS, Upazila } from '../data/bangladeshDistricts';
import {
  calculateHaversineDistanceKm,
  resolveLocationCoordinates,
  DISTRICT_CENTROIDS,
  AuthoritativeVendorLocation
} from '../services/vendorLocationService';

export type PathaoRouteType = 
  | 'inside_dhaka'         // ঢাকা সিটি → ঢাকা সিটি
  | 'dhaka_suburb'         // ঢাকা সিটি ⇄ ঢাকা উপশহর (সাভার, গাজীপুর, নারায়ণগঞ্জ, ইত্যাদি)
  | 'same_city'            // একই জেলার ভেতরে / ইন্ট্রা-সিটি (e.g. উখিয়া → কক্সবাজার সদর)
  | 'dhaka_to_outside'     // ঢাকা সিটি → ঢাকার বাইরে / সারাদেশে
  | 'outside_to_dhaka'     // ঢাকার বাইরে → ঢাকা সিটি
  | 'outside_to_outside';   // ঢাকার বাইরে → ঢাকার বাইরে (আন্তঃজেলা)

export type DeliveryZone = 'inside_dhaka' | 'dhaka_suburb' | 'outside_dhaka';

export interface PathaoRouteRateConfig {
  slab0to500g: number;
  slab500gTo1kg: number;
  slab1to2kg: number;
  extraRatePerKg: number;
  codPercent: number; // 0% inside Dhaka, 1% outside/inter-city
  routeLabelEn: string;
  routeLabelBn: string;
  estimatedDays: string;
}

/**
 * Pathao Courier standard matrix for merchant delivery
 */
export const PATHAO_ROUTE_RATES: Record<PathaoRouteType, PathaoRouteRateConfig> = {
  inside_dhaka: {
    slab0to500g: 60,
    slab500gTo1kg: 70,
    slab1to2kg: 90,
    extraRatePerKg: 15,
    codPercent: 0,
    routeLabelEn: 'Inside Dhaka City',
    routeLabelBn: 'ঢাকা সিটির ভিতরে',
    estimatedDays: '24-48 Hours'
  },
  dhaka_suburb: {
    slab0to500g: 100,
    slab500gTo1kg: 100,
    slab1to2kg: 120,
    extraRatePerKg: 20,
    codPercent: 1,
    routeLabelEn: 'Dhaka Suburbs (Savar, Gazipur, Narayanganj, Keraniganj)',
    routeLabelBn: 'ঢাকা উপশহর (সাভার, গাজীপুর, নারায়ণগঞ্জ, কেরানীগঞ্জ)',
    estimatedDays: '24-48 Hours'
  },
  same_city: {
    slab0to500g: 100,
    slab500gTo1kg: 100,
    slab1to2kg: 120,
    extraRatePerKg: 15,
    codPercent: 1,
    routeLabelEn: 'Same City / Intra-District',
    routeLabelBn: 'একই জেলার ভেতরে (ইন্ট্রা-সিটি)',
    estimatedDays: '24-48 Hours'
  },
  dhaka_to_outside: {
    slab0to500g: 130,
    slab500gTo1kg: 130,
    slab1to2kg: 150,
    extraRatePerKg: 25,
    codPercent: 1,
    routeLabelEn: 'Dhaka → Outside Dhaka (Nationwide)',
    routeLabelBn: 'ঢাকা সিটি → সারাদেশে / ঢাকার বাইরে',
    estimatedDays: '2-4 Business Days'
  },
  outside_to_dhaka: {
    slab0to500g: 130,
    slab500gTo1kg: 130,
    slab1to2kg: 150,
    extraRatePerKg: 25,
    codPercent: 1,
    routeLabelEn: 'Outside Dhaka → Dhaka City',
    routeLabelBn: 'ঢাকার বাইরে → ঢাকা সিটি',
    estimatedDays: '2-4 Business Days'
  },
  outside_to_outside: {
    slab0to500g: 130,
    slab500gTo1kg: 130,
    slab1to2kg: 150,
    extraRatePerKg: 25,
    codPercent: 1,
    routeLabelEn: 'Outside Dhaka → Outside Dhaka (Inter-District)',
    routeLabelBn: 'আন্তঃজেলা (ঢাকার বাইরে → ঢাকার বাইরে)',
    estimatedDays: '3-5 Business Days'
  }
};

// Legacy compatibility mapping
export const PATHAO_RATES_BY_ZONE: Record<DeliveryZone, { slab0to500g: number; slab500gTo1kg: number; slab1to2kg: number; extraRatePerKg: number }> = {
  inside_dhaka: PATHAO_ROUTE_RATES.inside_dhaka,
  dhaka_suburb: PATHAO_ROUTE_RATES.dhaka_suburb,
  outside_dhaka: PATHAO_ROUTE_RATES.dhaka_to_outside
};

export interface VendorLocationInfo {
  division?: string;
  district: string;
  upazila: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  isMissing?: boolean;
}

export interface CustomerLocationInfo {
  division?: string;
  district: string;
  upazila: string;
  area?: string;
  latitude?: number;
  longitude?: number;
}

export interface VendorPackageBreakdown {
  vendorId: string;
  storeName: string;
  vendorLocation: VendorLocationInfo;
  customerLocation: CustomerLocationInfo;
  routeType: PathaoRouteType;
  routeLabelEn: string;
  routeLabelBn: string;
  estimatedDays: string;
  distanceKm?: number;
  originCoordinates?: { latitude: number; longitude: number } | null;
  destCoordinates?: { latitude: number; longitude: number } | null;
  isVendorLocationMissing?: boolean;
  items: Array<{
    id?: string;
    name?: string;
    quantity: number;
    unitWeightKg: number;
    totalWeightKg: number;
    unitPrice: number;
    itemSubtotal: number;
  }>;
  packageWeightKg: number;
  weightSlab: '0_500g' | '500g_1kg' | '1kg_2kg' | 'above_2kg';
  weightSlabLabelBn: string;
  weightSlabLabelEn: string;
  baseCharge: number;
  extraKgCount: number;
  extraKgRate: number;
  extraWeightCharge: number;
  shippingFee: number;
  packageSubtotal: number;
  codCharge: number;
}

export interface MultiVendorShippingResult {
  totalShippingFee: number;
  totalWeightKg: number;
  totalItemsCount: number;
  vendorPackages: VendorPackageBreakdown[];
  totalCodCharge: number;
  platformFee: number;
  grandTotalShippingAndFees: number;
  hasFallbackWeight: boolean;
  missingWeightCount: number;
  isLocationPending?: boolean;
  isVendorLocationMissing?: boolean;
  distanceKm?: number;
  // Legacy / convenience fields
  deliveryCharge: number;
  shippingCharge: number;
  codCharge: number;
  zone: DeliveryZone;
  weightSlab: '0_500g' | '500g_1kg' | '1kg_2kg' | 'above_2kg';
  weightSlabLabelBn: string;
  extraWeightKg: number;
  extraWeightCharge: number;
}

export interface DeliveryCalculationResult {
  deliveryCharge: number;
  courierCharge: number;
  packagingCost: number;
  baseCharge: number;
  extraWeightCharge: number;
  totalWeightKg: number;
  weightSlab: '0_500g' | '500g_1kg' | '1kg_2kg' | 'above_2kg';
  weightSlabLabelBn: string;
  weightSlabLabelEn: string;
  extraKgCount: number;
  extraWeightKg: number;
  extraKgRate: number;
  zone: DeliveryZone;
  zoneLabel: string;
  zoneLabelBn: string;
  estimatedDays: string;
  distanceKm?: number;
  originCoordinates?: { latitude: number; longitude: number } | null;
  destCoordinates?: { latitude: number; longitude: number } | null;
  vendorLocation: {
    district: string;
    upazila: string;
    isMissing?: boolean;
  };
  customerLocation: {
    district: string;
    upazila: string;
  };
  platformFee: number;
  codCharge: number;
  hasFallbackWeight?: boolean;
  missingWeightCount?: number;
  isLocationPending?: boolean;
  isVendorLocationMissing?: boolean;
  // Multi-vendor additions
  vendorPackages?: VendorPackageBreakdown[];
  routeType?: PathaoRouteType;
}

export interface CourierRateConfig {
  intraCityBase: number;
  sameDistrictBase: number;
  sameDivisionBase: number;
  interDivisionBase: number;
  extraKgRateSameDistrict: number;
  extraKgRateInterDistrict: number;
  packagingCost: number;
  platformFee: number;
}

export const DEFAULT_COURIER_RATES: CourierRateConfig = {
  intraCityBase: 60,
  sameDistrictBase: 70,
  sameDivisionBase: 100,
  interDivisionBase: 140,
  extraKgRateSameDistrict: 15,
  extraKgRateInterDistrict: 25,
  packagingCost: 0,
  platformFee: 5,
};

/**
 * Normalizes district names by checking aliases and standardizing
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
  
  const found = BANGLADESH_DISTRICTS.find(d => {
    const cleanId = d.id.toLowerCase().replace(/['\s-]/g, '');
    const cleanTarget = clean.replace(/['\s-]/g, '');
    return cleanId === cleanTarget || d.name.toLowerCase().includes(clean);
  });
  return found ? (found.id === 'Coxs Bazar' ? "Cox's Bazar" : found.id) : rawName.trim();
}

/**
 * Find the division for a given district name
 */
export function getDivisionByDistrict(districtName: string): string {
  if (!districtName) return '';
  const norm = normalizeDistrictName(districtName);
  if (DISTRICT_CENTROIDS[norm]) {
    return DISTRICT_CENTROIDS[norm].division;
  }
  const cleanName = districtName.toLowerCase().trim();
  const found = BANGLADESH_DISTRICTS.find(d => 
    d.id.toLowerCase() === cleanName || 
    d.name.toLowerCase().includes(cleanName)
  );
  return found ? found.division : '';
}

/**
 * Extracts and normalizes vendor/store location from any vendor data, profile data, or product data.
 * Checks structured fields first, then deep-inspects address strings/objects against BANGLADESH_DISTRICTS.
 */
export function extractVendorLocation(
  data: any,
  additionalSource?: any
): {
  district: string;
  upazila: string;
  division: string;
  area: string;
  storeName: string;
  isCodEnabled: boolean;
  rawAddress: string;
  isResolved: boolean;
  isMissing: boolean;
  latitude?: number;
  longitude?: number;
} {
  const d = data || {};
  const s = additionalSource || {};

  // 1. Check explicit structured district
  let rawDistrict = (
    d.district || d.vendorDistrict || d.storeDistrict || d.address?.district || d.address?.state ||
    s.district || s.vendorDistrict || s.storeDistrict || s.address?.district || s.address?.state ||
    d.vendorLocation?.district || s.vendorLocation?.district || ''
  ).toString().trim();

  // 2. Check explicit structured upazila
  let rawUpazila = (
    d.upazila || d.vendorUpazila || d.storeUpazila || d.thana || d.address?.upazila || d.address?.thana || d.address?.city ||
    s.upazila || s.vendorUpazila || s.storeUpazila || s.thana || s.address?.upazila || s.address?.thana || s.address?.city ||
    d.vendorLocation?.upazila || s.vendorLocation?.upazila || ''
  ).toString().trim();

  // 3. Check explicit division
  let rawDivision = (
    d.division || d.vendorDivision || d.storeDivision || d.address?.division ||
    s.division || s.vendorDivision || s.address?.division ||
    d.vendorLocation?.division || s.vendorLocation?.division || ''
  ).toString().trim();

  // 4. Check explicit area / street
  let rawArea = (
    d.area || d.vendorArea || d.address?.area || d.address?.street ||
    s.area || s.address?.area || s.address?.street ||
    d.vendorLocation?.area || s.vendorLocation?.area || ''
  ).toString().trim();

  // 5. Store name
  const storeName = (
    d.storeName || d.shopName || d.businessName || d.name ||
    s.storeName || s.shopName || s.businessName || s.name ||
    'Store'
  ).toString().trim();

  const isCodEnabled = d.isCodEnabled !== false && d.codEnabled !== false && s.isCodEnabled !== false && s.codEnabled !== false;

  // Build searchable text from addresses/cities/states
  const textParts: string[] = [];
  if (typeof d.address === 'string') textParts.push(d.address);
  if (typeof s.address === 'string') textParts.push(s.address);
  if (d.address && typeof d.address === 'object') {
    textParts.push(d.address.street || '', d.address.city || '', d.address.state || '', d.address.district || '');
  }
  if (s.address && typeof s.address === 'object') {
    textParts.push(s.address.street || '', s.address.city || '', s.address.state || '', s.address.district || '');
  }
  if (d.city) textParts.push(d.city);
  if (d.state) textParts.push(d.state);
  if (s.city) textParts.push(s.city);
  if (s.state) textParts.push(s.state);
  if (d.fullAddress) textParts.push(d.fullAddress);
  if (s.fullAddress) textParts.push(s.fullAddress);

  const fullSearchableText = textParts.filter(Boolean).join(' ').toLowerCase();

  // If district is not explicitly found, search through BANGLADESH_DISTRICTS
  let matchedDistrictObj = rawDistrict ? BANGLADESH_DISTRICTS.find(dist => {
    const cleanId = dist.id.toLowerCase().replace(/['\s-]/g, '');
    const cleanRaw = rawDistrict.toLowerCase().replace(/['\s-]/g, '');
    return cleanId === cleanRaw || dist.name.toLowerCase().includes(rawDistrict.toLowerCase());
  }) : null;

  // If not matched yet, search for district name inside fullSearchableText
  if (!matchedDistrictObj && fullSearchableText) {
    for (const dist of BANGLADESH_DISTRICTS) {
      const cleanId = dist.id.toLowerCase().replace(/['\s-]/g, '');
      if (
        fullSearchableText.includes(dist.id.toLowerCase()) ||
        fullSearchableText.includes(dist.name.toLowerCase()) ||
        cleanId === 'coxsbazar' && (fullSearchableText.includes("cox") || fullSearchableText.includes("কক্সবাজার")) ||
        (dist.id === "Chattogram" && (fullSearchableText.includes("chittagong") || fullSearchableText.includes("চট্টগ্রাম")))
      ) {
        matchedDistrictObj = dist;
        break;
      }
    }
  }

  // If still not matched, check if any upazila is mentioned in the text!
  if (!matchedDistrictObj && fullSearchableText) {
    for (const dist of BANGLADESH_DISTRICTS) {
      for (const up of dist.upazilas) {
        const upId = (typeof up === 'string' ? up : (up as Upazila).id || (up as Upazila).name).toLowerCase();
        const upName = (typeof up === 'string' ? up : (up as Upazila).name || (up as Upazila).id).toLowerCase();
        if (
          fullSearchableText.includes(upId) ||
          fullSearchableText.includes(upName) ||
          (upId.includes('/') && upId.split('/').some(part => fullSearchableText.includes(part.trim())))
        ) {
          matchedDistrictObj = dist;
          if (!rawUpazila) {
            rawUpazila = typeof up === 'string' ? up : (up as Upazila).id;
          }
          break;
        }
      }
      if (matchedDistrictObj) break;
    }
  }

  // If district was identified, find matching upazila if not yet set
  if (matchedDistrictObj && !rawUpazila && fullSearchableText) {
    for (const up of matchedDistrictObj.upazilas) {
      const upId = (typeof up === 'string' ? up : (up as Upazila).id || (up as Upazila).name).toLowerCase();
      const upName = (typeof up === 'string' ? up : (up as Upazila).name || (up as Upazila).id).toLowerCase();
      if (
        fullSearchableText.includes(upId) ||
        fullSearchableText.includes(upName) ||
        (upId.includes('/') && upId.split('/').some(part => fullSearchableText.includes(part.trim())))
      ) {
        rawUpazila = typeof up === 'string' ? up : (up as Upazila).id;
        break;
      }
    }
  }

  let finalDistrict = '';
  let finalUpazila = '';
  let isResolved = false;

  if (matchedDistrictObj) {
    finalDistrict = normalizeDistrictName(matchedDistrictObj.id);
    rawDivision = rawDivision || matchedDistrictObj.division;
    const firstUp = matchedDistrictObj.upazilas[0];
    const defaultFirstUp = firstUp ? (typeof firstUp === 'string' ? firstUp : (firstUp as Upazila).id) : `${finalDistrict} Sadar`;
    finalUpazila = rawUpazila || defaultFirstUp;
    isResolved = true;
  } else if (rawDistrict && rawDistrict.toLowerCase() !== 'unknown') {
    finalDistrict = normalizeDistrictName(rawDistrict);
    finalUpazila = rawUpazila || `${finalDistrict} Sadar`;
    rawDivision = rawDivision || getDivisionByDistrict(finalDistrict);
    isResolved = true;
  } else {
    // DO NOT default to Dhaka! Mark as unconfigured / missing
    finalDistrict = '';
    finalUpazila = '';
    rawDivision = '';
    isResolved = false;
  }

  // Extract or resolve coordinates
  const coords = resolveLocationCoordinates({
    district: finalDistrict,
    upazila: finalUpazila,
    latitude: d.vendorLocation?.latitude ?? d.latitude ?? s.latitude,
    longitude: d.vendorLocation?.longitude ?? d.longitude ?? s.longitude
  });

  return {
    district: finalDistrict,
    upazila: finalUpazila,
    division: rawDivision || getDivisionByDistrict(finalDistrict),
    area: rawArea,
    storeName,
    isCodEnabled,
    rawAddress: fullSearchableText,
    isResolved,
    isMissing: !isResolved,
    latitude: coords?.latitude,
    longitude: coords?.longitude
  };
}

/**
 * Checks if a location is inside Dhaka City (excluding suburbs)
 */
export function isDhakaCity(district: string = '', upazila: string = ''): boolean {
  const normDist = normalizeDistrictName(district);
  if (normDist !== 'Dhaka') return false;

  const up = (upazila || '').toLowerCase().trim();
  const suburbUpazilas = ['savar', 'সাভার', 'dhamrai', 'ধামরাই', 'keraniganj', 'কেরানীগঞ্জ', 'dohar', 'দোহার', 'nawabganj', 'নবাবগঞ্জ'];
  const isSuburb = suburbUpazilas.some(s => up.includes(s));
  return !isSuburb;
}

/**
 * Checks if a location is in the Dhaka Suburb region (Savar, Keraniganj, Gazipur, Narayanganj)
 */
export function isDhakaSuburb(district: string = '', upazila: string = ''): boolean {
  const normDist = normalizeDistrictName(district);
  if (normDist === 'Gazipur' || normDist === 'Narayanganj') return true;

  if (normDist === 'Dhaka') {
    const up = (upazila || '').toLowerCase().trim();
    const suburbUpazilas = ['savar', 'সাভার', 'dhamrai', 'ধামরাই', 'keraniganj', 'কেরানীগঞ্জ', 'dohar', 'দোহার', 'nawabganj', 'নবাবগঞ্জ'];
    return suburbUpazilas.some(s => up.includes(s));
  }

  return false;
}

/**
 * Resolves the specific Pathao Route between a Vendor and a Customer
 */
export function resolvePathaoRoute(
  vendorLocation?: { district?: string; upazila?: string; latitude?: number; longitude?: number },
  customerLocation?: { district?: string; upazila?: string; latitude?: number; longitude?: number },
  fallbackZone?: DeliveryZone
): {
  routeType: PathaoRouteType;
  routeLabelEn: string;
  routeLabelBn: string;
  estimatedDays: string;
  zone: DeliveryZone;
  isLocationPending?: boolean;
  isVendorLocationMissing?: boolean;
  distanceKm?: number;
  originCoordinates?: { latitude: number; longitude: number } | null;
  destCoordinates?: { latitude: number; longitude: number } | null;
} {
  const rawVDist = (vendorLocation?.district || '').trim();
  const rawVUp = (vendorLocation?.upazila || '').trim();
  const isVendorMissing = !rawVDist || rawVDist.toLowerCase() === 'unknown';

  const vDist = isVendorMissing ? '' : normalizeDistrictName(rawVDist);
  const vUp = rawVUp;
  const cDist = normalizeDistrictName(customerLocation?.district || '');
  const cUp = (customerLocation?.upazila || '').trim();

  // Resolve coordinates
  const originCoords = isVendorMissing ? null : resolveLocationCoordinates({
    district: vDist,
    upazila: vUp,
    latitude: vendorLocation?.latitude,
    longitude: vendorLocation?.longitude
  });

  const destCoords = cDist ? resolveLocationCoordinates({
    district: cDist,
    upazila: cUp,
    latitude: customerLocation?.latitude,
    longitude: customerLocation?.longitude
  }) : null;

  const distanceKm = (originCoords && destCoords)
    ? calculateHaversineDistanceKm(originCoords.latitude, originCoords.longitude, destCoords.latitude, destCoords.longitude)
    : 0;

  // If vendor location is missing, flag it clearly (DO NOT default to Dhaka or ৳60!)
  if (isVendorMissing) {
    return {
      routeType: 'outside_to_dhaka',
      routeLabelEn: 'Vendor Store Location Missing',
      routeLabelBn: 'ভেন্ডর স্টোর লোকেশন অনুপস্থিত',
      estimatedDays: 'N/A',
      zone: 'outside_dhaka',
      isLocationPending: true,
      isVendorLocationMissing: true,
      distanceKm: 0,
      originCoordinates: null,
      destCoordinates: destCoords
    };
  }

  // If customer has not entered address yet
  if (!cDist) {
    if (fallbackZone === 'inside_dhaka') {
      const info = PATHAO_ROUTE_RATES.inside_dhaka;
      return {
        routeType: 'inside_dhaka',
        routeLabelEn: info.routeLabelEn,
        routeLabelBn: info.routeLabelBn,
        estimatedDays: info.estimatedDays,
        zone: 'inside_dhaka',
        isLocationPending: true,
        isVendorLocationMissing: false,
        distanceKm: 0,
        originCoordinates: originCoords,
        destCoordinates: null
      };
    }
    if (fallbackZone === 'dhaka_suburb') {
      const info = PATHAO_ROUTE_RATES.dhaka_suburb;
      return {
        routeType: 'dhaka_suburb',
        routeLabelEn: info.routeLabelEn,
        routeLabelBn: info.routeLabelBn,
        estimatedDays: info.estimatedDays,
        zone: 'dhaka_suburb',
        isLocationPending: true,
        isVendorLocationMissing: false,
        distanceKm: 0,
        originCoordinates: originCoords,
        destCoordinates: null
      };
    }
    const info = PATHAO_ROUTE_RATES.outside_to_outside;
    return {
      routeType: 'outside_to_outside',
      routeLabelEn: info.routeLabelEn,
      routeLabelBn: info.routeLabelBn,
      estimatedDays: info.estimatedDays,
      zone: 'outside_dhaka',
      isLocationPending: true,
      isVendorLocationMissing: false,
      distanceKm: 0,
      originCoordinates: originCoords,
      destCoordinates: null
    };
  }

  const vIsCity = isDhakaCity(vDist, vUp);
  const vIsSuburb = isDhakaSuburb(vDist, vUp);
  const cIsCity = isDhakaCity(cDist, cUp);
  const cIsSuburb = isDhakaSuburb(cDist, cUp);

  // 1. Inside Dhaka City (Dhaka City -> Dhaka City)
  if (vIsCity && cIsCity) {
    const info = PATHAO_ROUTE_RATES.inside_dhaka;
    return {
      routeType: 'inside_dhaka',
      routeLabelEn: info.routeLabelEn,
      routeLabelBn: info.routeLabelBn,
      estimatedDays: info.estimatedDays,
      zone: 'inside_dhaka',
      isLocationPending: false,
      isVendorLocationMissing: false,
      distanceKm,
      originCoordinates: originCoords,
      destCoordinates: destCoords
    };
  }

  // 2. Dhaka Suburb (Dhaka City <-> Suburb, or Suburb <-> Suburb)
  if ((vIsCity && cIsSuburb) || (vIsSuburb && cIsCity) || (vIsSuburb && cIsSuburb)) {
    const info = PATHAO_ROUTE_RATES.dhaka_suburb;
    return {
      routeType: 'dhaka_suburb',
      routeLabelEn: info.routeLabelEn,
      routeLabelBn: info.routeLabelBn,
      estimatedDays: info.estimatedDays,
      zone: 'dhaka_suburb',
      isLocationPending: false,
      isVendorLocationMissing: false,
      distanceKm,
      originCoordinates: originCoords,
      destCoordinates: destCoords
    };
  }

  // 3. Same City / Intra-District outside Dhaka (e.g. Ukhia, Cox's Bazar -> Cox's Bazar Sadar)
  if (!vIsCity && !vIsSuburb && !cIsCity && !cIsSuburb && vDist.toLowerCase() === cDist.toLowerCase()) {
    const info = PATHAO_ROUTE_RATES.same_city;
    return {
      routeType: 'same_city',
      routeLabelEn: info.routeLabelEn,
      routeLabelBn: info.routeLabelBn,
      estimatedDays: info.estimatedDays,
      zone: 'outside_dhaka',
      isLocationPending: false,
      isVendorLocationMissing: false,
      distanceKm,
      originCoordinates: originCoords,
      destCoordinates: destCoords
    };
  }

  // 4. Dhaka -> Outside Dhaka
  if ((vIsCity || vIsSuburb) && !cIsCity && !cIsSuburb) {
    const info = PATHAO_ROUTE_RATES.dhaka_to_outside;
    return {
      routeType: 'dhaka_to_outside',
      routeLabelEn: info.routeLabelEn,
      routeLabelBn: info.routeLabelBn,
      estimatedDays: info.estimatedDays,
      zone: 'outside_dhaka',
      isLocationPending: false,
      isVendorLocationMissing: false,
      distanceKm,
      originCoordinates: originCoords,
      destCoordinates: destCoords
    };
  }

  // 5. Outside Dhaka -> Dhaka (e.g. Cox's Bazar Store -> Dhaka Customer)
  if (!vIsCity && !vIsSuburb && (cIsCity || cIsSuburb)) {
    const info = PATHAO_ROUTE_RATES.outside_to_dhaka;
    return {
      routeType: 'outside_to_dhaka',
      routeLabelEn: info.routeLabelEn,
      routeLabelBn: info.routeLabelBn,
      estimatedDays: info.estimatedDays,
      zone: 'outside_dhaka',
      isLocationPending: false,
      isVendorLocationMissing: false,
      distanceKm,
      originCoordinates: originCoords,
      destCoordinates: destCoords
    };
  }

  // 6. Outside Dhaka -> Outside Dhaka (Inter-District)
  const info = PATHAO_ROUTE_RATES.outside_to_outside;
  return {
    routeType: 'outside_to_outside',
    routeLabelEn: info.routeLabelEn,
    routeLabelBn: info.routeLabelBn,
    estimatedDays: info.estimatedDays,
    zone: 'outside_dhaka',
    isLocationPending: false,
    isVendorLocationMissing: false,
    distanceKm,
    originCoordinates: originCoords,
    destCoordinates: destCoords
  };
}

/**
 * Backward-compatible resolveDeliveryZone
 */
export function resolveDeliveryZone(
  customerDistrict: string = '',
  customerUpazila: string = '',
  fallbackZone?: DeliveryZone
): {
  zone: DeliveryZone;
  zoneLabel: string;
  zoneLabelBn: string;
  estimatedDays: string;
} {
  const route = resolvePathaoRoute({ district: 'Dhaka', upazila: 'Dhaka Sadar / Kotwali' }, { district: customerDistrict, upazila: customerUpazila }, fallbackZone);
  return {
    zone: route.zone,
    zoneLabel: route.routeLabelEn,
    zoneLabelBn: route.routeLabelBn,
    estimatedDays: route.estimatedDays
  };
}

/**
 * Parses product weight safely into KG
 */
export interface WeightParseResult {
  weightKg: number;
  isFallback: boolean;
  displayText: string;
}

export function parseProductWeight(weightValue: any): WeightParseResult {
  if (weightValue === undefined || weightValue === null || weightValue === '') {
    return { weightKg: 0.5, isFallback: true, displayText: '500 গ্রাম' };
  }
  const str = String(weightValue).trim();
  if (!str) {
    return { weightKg: 0.5, isFallback: true, displayText: '500 গ্রাম' };
  }

  // Support Bengali numerals (০-৯) by normalizing to English (0-9)
  const normalizedStr = str.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());

  if (/kg|কেজি/i.test(normalizedStr)) {
    const num = parseFloat(normalizedStr);
    if (!isNaN(num) && num > 0) {
      const inKg = Math.round(num * 100) / 100;
      return { 
        weightKg: inKg, 
        isFallback: false, 
        displayText: inKg < 1 ? `${Math.round(inKg * 1000)} গ্রাম` : `${inKg} কেজি` 
      };
    }
  }

  if (/g|gm|gram|গ্রাম/i.test(normalizedStr)) {
    const num = parseFloat(normalizedStr);
    if (!isNaN(num) && num > 0) {
      const inKg = num / 1000;
      return { 
        weightKg: Math.round(inKg * 100) / 100, 
        isFallback: false, 
        displayText: inKg >= 1 ? `${Math.round(inKg * 100) / 100} কেজি` : `${Math.round(num)} গ্রাম` 
      };
    }
  }

  const num = parseFloat(normalizedStr);
  if (isNaN(num) || num <= 0) {
    return { weightKg: 0.5, isFallback: true, displayText: '500 গ্রাম' };
  }

  if (num >= 50) {
    const inKg = num / 1000;
    return { 
      weightKg: Math.round(inKg * 100) / 100, 
      isFallback: false, 
      displayText: inKg >= 1 ? `${Math.round(inKg * 100) / 100} কেজি` : `${Math.round(num)} গ্রাম` 
    };
  }

  const inKg = Math.round(num * 100) / 100;
  return { 
    weightKg: inKg, 
    isFallback: false, 
    displayText: inKg < 1 ? `${Math.round(inKg * 1000)} গ্রাম` : `${inKg} কেজি` 
  };
}

export function formatWeight(weightKg: number): string {
  if (isNaN(weightKg) || weightKg <= 0) return '500 গ্রাম';
  if (weightKg < 1) {
    const gm = Math.round(weightKg * 1000);
    return `${gm} গ্রাম`;
  }
  const kg = Math.round(weightKg * 100) / 100;
  return `${kg} কেজি`;
}

export function normalizeWeightToKg(weightValue: any): number {
  return parseProductWeight(weightValue).weightKg;
}

export interface CartWeightSummary {
  totalWeightKg: number;
  totalItemsCount: number;
  hasFallbackWeight: boolean;
  missingWeightCount: number;
  itemBreakdowns: Array<{
    id?: string;
    name?: string;
    quantity: number;
    unitWeightKg: number;
    totalWeightKg: number;
    totalItemWeightKg?: number;
    isFallback: boolean;
    displayUnitWeight: string;
    unitWeightText?: string;
  }>;
}

export type CartWeightDetailedSummary = CartWeightSummary;

export function calculateCartTotalWeightDetailed(
  items: Array<{ id?: string; name?: string; quantity?: number; weight?: any; specifications?: any }>
): CartWeightSummary {
  if (!items || items.length === 0) {
    return {
      totalWeightKg: 0.5,
      totalItemsCount: 0,
      hasFallbackWeight: false,
      missingWeightCount: 0,
      itemBreakdowns: []
    };
  }

  let totalKg = 0;
  let totalQty = 0;
  let missingCount = 0;

  const breakdowns = items.map(item => {
    const rawW = item.weight !== undefined && item.weight !== null && item.weight !== ''
      ? item.weight
      : (item.specifications?.Weight || item.specifications?.weight);

    const parsed = parseProductWeight(rawW);
    const qty = Math.max(1, Number(item.quantity) || 1);
    const itemTotalKg = parsed.weightKg * qty;

    totalKg += itemTotalKg;
    totalQty += qty;
    if (parsed.isFallback) missingCount += 1;

    return {
      id: item.id,
      name: item.name,
      quantity: qty,
      unitWeightKg: parsed.weightKg,
      totalWeightKg: Math.round(itemTotalKg * 100) / 100,
      totalItemWeightKg: Math.round(itemTotalKg * 100) / 100,
      isFallback: parsed.isFallback,
      displayUnitWeight: parsed.displayText,
      unitWeightText: parsed.displayText
    };
  });

  const finalTotalKg = Math.max(0.1, Math.round(totalKg * 100) / 100);

  return {
    totalWeightKg: finalTotalKg,
    totalItemsCount: totalQty,
    hasFallbackWeight: missingCount > 0,
    missingWeightCount: missingCount,
    itemBreakdowns: breakdowns
  };
}

export function calculateCartTotalWeight(items: Array<{ quantity?: number; weight?: any }>): number {
  return calculateCartTotalWeightDetailed(items).totalWeightKg;
}

/**
 * Calculates shipping fee for a single package based on route and weight
 */
export function calculatePackageShippingRate(
  routeType: PathaoRouteType,
  weightKg: number,
  subtotal: number = 0,
  paymentMethod: string = 'cod'
): {
  baseCharge: number;
  extraWeightCharge: number;
  shippingFee: number;
  weightSlab: '0_500g' | '500g_1kg' | '1kg_2kg' | 'above_2kg';
  weightSlabLabelBn: string;
  weightSlabLabelEn: string;
  extraKgCount: number;
  extraKgRate: number;
  codCharge: number;
} {
  const safeWeight = Math.max(0.1, Math.round(weightKg * 100) / 100);
  const routeRates = PATHAO_ROUTE_RATES[routeType] || PATHAO_ROUTE_RATES.outside_to_outside;

  let weightSlab: '0_500g' | '500g_1kg' | '1kg_2kg' | 'above_2kg';
  let weightSlabLabelBn = '';
  let weightSlabLabelEn = '';
  let baseCharge = 0;
  let extraKgCount = 0;
  let extraKgRate = routeRates.extraRatePerKg;
  let extraWeightCharge = 0;

  if (safeWeight <= 0.5) {
    weightSlab = '0_500g';
    baseCharge = routeRates.slab0to500g;
    weightSlabLabelBn = '০–৫০০ গ্রাম স্ল্যাব';
    weightSlabLabelEn = '0–500g Weight Slab';
    extraKgCount = 0;
    extraWeightCharge = 0;
  } else if (safeWeight <= 1.0) {
    weightSlab = '500g_1kg';
    baseCharge = routeRates.slab500gTo1kg;
    weightSlabLabelBn = '৫০০ গ্রাম–১ কেজি স্ল্যাব';
    weightSlabLabelEn = '500g–1kg Weight Slab';
    extraKgCount = 0;
    extraWeightCharge = 0;
  } else if (safeWeight <= 2.0) {
    weightSlab = '1kg_2kg';
    baseCharge = routeRates.slab1to2kg;
    weightSlabLabelBn = '১–২ কেজি স্ল্যাব';
    weightSlabLabelEn = '1–2kg Weight Slab';
    extraKgCount = 0;
    extraWeightCharge = 0;
  } else {
    weightSlab = 'above_2kg';
    baseCharge = routeRates.slab1to2kg;
    extraKgCount = Math.ceil(safeWeight - 2.0);
    extraWeightCharge = extraKgCount * extraKgRate;
    weightSlabLabelBn = `২ কেজি (৳${baseCharge}) + অতিরিক্ত ${extraKgCount} কেজি (× ৳${extraKgRate})`;
    weightSlabLabelEn = `2kg (৳${baseCharge}) + Extra ${extraKgCount}kg (× ৳${extraKgRate})`;
  }

  const shippingFee = baseCharge + extraWeightCharge;
  const codCharge = paymentMethod === 'cod' && routeRates.codPercent > 0
    ? Math.round(Math.max(0, subtotal) * (routeRates.codPercent / 100))
    : 0;

  return {
    baseCharge,
    extraWeightCharge,
    shippingFee,
    weightSlab,
    weightSlabLabelBn,
    weightSlabLabelEn,
    extraKgCount,
    extraKgRate,
    codCharge
  };
}

/**
 * Calculates multi-vendor split package shipping fee
 */
export function calculateMultiVendorShipping(
  items: any[],
  customerLocation?: { district?: string; upazila?: string; division?: string; area?: string },
  options?: {
    paymentMethod?: string;
    fallbackZone?: DeliveryZone;
    defaultVendorDistrict?: string;
    defaultVendorUpazila?: string;
  }
): MultiVendorShippingResult {
  if (!items || items.length === 0) {
    return {
      totalShippingFee: 0,
      totalWeightKg: 0,
      totalItemsCount: 0,
      vendorPackages: [],
      totalCodCharge: 0,
      platformFee: 0,
      grandTotalShippingAndFees: 0,
      hasFallbackWeight: false,
      missingWeightCount: 0,
      isLocationPending: false,
      deliveryCharge: 0,
      shippingCharge: 0,
      codCharge: 0,
      zone: 'outside_dhaka',
      weightSlab: '0_500g',
      weightSlabLabelBn: '০–৫০০ গ্রাম',
      extraWeightKg: 0,
      extraWeightCharge: 0
    };
  }

  const defaultVDis = options?.defaultVendorDistrict || '';
  const defaultVUp = options?.defaultVendorUpazila || '';

  // Group items by Vendor and Authoritative Vendor Location
  const vendorGroups: Record<string, {
    vendorId: string;
    storeName: string;
    vendorLocation: VendorLocationInfo;
    isVendorMissing: boolean;
    items: any[];
  }> = {};

  let totalOrderWeight = 0;
  let totalOrderItems = 0;
  let missingWeightCounter = 0;

  for (const it of items) {
    const qty = Math.max(1, Number(it.quantity) || 1);
    const rawW = it.weight !== undefined && it.weight !== null && it.weight !== ''
      ? it.weight
      : (it.specifications?.Weight || it.specifications?.weight);
    const parsedWeight = parseProductWeight(rawW);
    if (parsedWeight.isFallback) missingWeightCounter++;

    totalOrderWeight += parsedWeight.weightKg * qty;
    totalOrderItems += qty;

    // Resolve authoritative vendor location from item and vendor object
    const vendorLoc = extractVendorLocation(it, it.vendor);
    const vId = (it.vendorId || it.storeId || it.vendor?.id || 'admin_hub').toString();
    const isOfficialAdminHub = vId === 'admin' || vId === 'admin_hub';
    const vStoreName = it.storeName || it.vendorName || it.vendor?.storeName || vendorLoc.storeName || (isOfficialAdminHub ? 'RJ Official Hub' : `Store ${vId.slice(-4)}`);

    let rawVDist = (it.vendorDistrict || vendorLoc.district || defaultVDis || '').trim();
    let rawVUpazila = (it.vendorUpazila || vendorLoc.upazila || defaultVUp || '').trim();
    let rawVDivision = (it.vendorDivision || vendorLoc.division || '').trim();

    // Fallback only for system official admin hub
    if (isOfficialAdminHub && !rawVDist) {
      rawVDist = 'Dhaka';
      rawVUpazila = 'Dhaka Sadar / Kotwali';
      rawVDivision = 'Dhaka';
    }

    const isVendorMissing = !isOfficialAdminHub && (!rawVDist || rawVDist.toLowerCase() === 'unknown');
    const vDistrict = isVendorMissing ? '' : normalizeDistrictName(rawVDist);
    const vUpazila = isVendorMissing ? '' : (rawVUpazila || `${vDistrict} Sadar`);
    const vDivision = isVendorMissing ? '' : (rawVDivision || getDivisionByDistrict(vDistrict));

    const groupKey = isVendorMissing ? `missing_${vId}` : `${vId}_${vDistrict}_${vUpazila}`;

    if (!vendorGroups[groupKey]) {
      vendorGroups[groupKey] = {
        vendorId: vId,
        storeName: vStoreName,
        vendorLocation: {
          district: vDistrict,
          upazila: vUpazila,
          division: vDivision,
          latitude: vendorLoc.latitude,
          longitude: vendorLoc.longitude,
          isMissing: isVendorMissing
        },
        isVendorMissing,
        items: []
      };
    }

    const price = Number(it.resellerPrice ?? it.salePrice ?? it.price ?? 0);

    vendorGroups[groupKey].items.push({
      id: it.id,
      name: it.name,
      quantity: qty,
      unitWeightKg: parsedWeight.weightKg,
      totalWeightKg: Math.round(parsedWeight.weightKg * qty * 100) / 100,
      unitPrice: price,
      itemSubtotal: price * qty
    });
  }

  const packages: VendorPackageBreakdown[] = [];
  let totalShippingFee = 0;
  let totalCodCharge = 0;
  let hasAnyMissingVendorLocation = false;
  let totalDistanceKm = 0;
  const isCustLocProvided = Boolean(customerLocation?.district && customerLocation.district.trim());

  for (const group of Object.values(vendorGroups)) {
    const packageWeightKg = Math.max(0.1, Math.round(group.items.reduce((sum, item) => sum + item.totalWeightKg, 0) * 100) / 100);
    const packageSubtotal = group.items.reduce((sum, item) => sum + item.itemSubtotal, 0);

    const routeInfo = resolvePathaoRoute(group.vendorLocation, customerLocation, options?.fallbackZone);
    const rateCalc = calculatePackageShippingRate(routeInfo.routeType, packageWeightKg, packageSubtotal, options?.paymentMethod || 'cod');

    const isPackageMissingVendor = Boolean(group.isVendorMissing || routeInfo.isVendorLocationMissing);
    if (isPackageMissingVendor) {
      hasAnyMissingVendorLocation = true;
    }

    const finalPackageShippingFee = isPackageMissingVendor ? 0 : rateCalc.shippingFee;
    const finalPackageCodCharge = isPackageMissingVendor ? 0 : rateCalc.codCharge;

    if (routeInfo.distanceKm) {
      totalDistanceKm = Math.max(totalDistanceKm, routeInfo.distanceKm);
    }

    // Debug output verifying authoritative route calculation
    if (process.env.NODE_ENV !== 'production' || typeof window !== 'undefined') {
      console.log(`[Authoritative Shipping] Origin: ${isPackageMissingVendor ? 'MISSING' : `${group.vendorLocation.district} (${group.vendorLocation.upazila})`}, Destination: ${customerLocation?.district || 'Pending'} (${customerLocation?.upazila || ''}), Weight: ${packageWeightKg}kg, Dist: ${routeInfo.distanceKm || 0}km, Route: ${routeInfo.routeType}, Fee: ৳${finalPackageShippingFee}`);
    }

    packages.push({
      vendorId: group.vendorId,
      storeName: group.storeName,
      vendorLocation: group.vendorLocation,
      customerLocation: {
        district: normalizeDistrictName(customerLocation?.district || ''),
        upazila: customerLocation?.upazila || '',
        division: customerLocation?.division || getDivisionByDistrict(customerLocation?.district || ''),
        area: customerLocation?.area || ''
      },
      routeType: routeInfo.routeType,
      routeLabelEn: isPackageMissingVendor ? 'Vendor Store Location Missing' : routeInfo.routeLabelEn,
      routeLabelBn: isPackageMissingVendor ? 'ভেন্ডর স্টোর লোকেশন অনুপস্থিত' : routeInfo.routeLabelBn,
      estimatedDays: isPackageMissingVendor ? 'N/A' : routeInfo.estimatedDays,
      distanceKm: routeInfo.distanceKm,
      originCoordinates: routeInfo.originCoordinates,
      destCoordinates: routeInfo.destCoordinates,
      isVendorLocationMissing: isPackageMissingVendor,
      items: group.items,
      packageWeightKg,
      weightSlab: rateCalc.weightSlab,
      weightSlabLabelBn: rateCalc.weightSlabLabelBn,
      weightSlabLabelEn: rateCalc.weightSlabLabelEn,
      baseCharge: isPackageMissingVendor ? 0 : rateCalc.baseCharge,
      extraKgCount: rateCalc.extraKgCount,
      extraKgRate: rateCalc.extraKgRate,
      extraWeightCharge: isPackageMissingVendor ? 0 : rateCalc.extraWeightCharge,
      shippingFee: finalPackageShippingFee,
      packageSubtotal,
      codCharge: finalPackageCodCharge
    });

    totalShippingFee += finalPackageShippingFee;
    totalCodCharge += finalPackageCodCharge;
  }

  const platformFee = 5;
  const primaryPackage = packages[0];

  return {
    totalShippingFee,
    totalWeightKg: Math.round(totalOrderWeight * 100) / 100,
    totalItemsCount: totalOrderItems,
    vendorPackages: packages,
    totalCodCharge,
    platformFee,
    grandTotalShippingAndFees: totalShippingFee + totalCodCharge + platformFee,
    hasFallbackWeight: missingWeightCounter > 0,
    missingWeightCount: missingWeightCounter,
    isLocationPending: !isCustLocProvided,
    isVendorLocationMissing: hasAnyMissingVendorLocation,
    distanceKm: totalDistanceKm,
    deliveryCharge: totalShippingFee,
    shippingCharge: totalShippingFee,
    codCharge: totalCodCharge,
    zone: primaryPackage ? primaryPackage.routeType === 'inside_dhaka' ? 'inside_dhaka' : primaryPackage.routeType === 'dhaka_suburb' ? 'dhaka_suburb' : 'outside_dhaka' : 'outside_dhaka',
    weightSlab: primaryPackage?.weightSlab || '0_500g',
    weightSlabLabelBn: primaryPackage?.weightSlabLabelBn || '০–৫০০ গ্রাম',
    extraWeightKg: primaryPackage?.extraKgCount || 0,
    extraWeightCharge: primaryPackage?.extraWeightCharge || 0
  };
}

/**
 * Main Pathao delivery charge calculation function (backward-compatible)
 */
export function calculateCourierCharge(
  vendorDistrict: string = 'Dhaka',
  vendorUpazila: string = 'Dhaka Sadar / Kotwali',
  customerDistrict: string = '',
  customerUpazila: string = '',
  totalWeightKg: number = 0.5,
  options?: {
    customRates?: Partial<CourierRateConfig>;
    orderSubtotal?: number;
    paymentMethod?: string;
    hasFallbackWeight?: boolean;
    missingWeightCount?: number;
    fallbackZone?: DeliveryZone;
    vendorDivision?: string;
    items?: any[];
  }
): DeliveryCalculationResult {
  // If items list provided, use full multi-vendor calculation
  if (options?.items && options.items.length > 0) {
    const multi = calculateMultiVendorShipping(options.items, { district: customerDistrict, upazila: customerUpazila }, {
      paymentMethod: options?.paymentMethod,
      fallbackZone: options?.fallbackZone,
      defaultVendorDistrict: vendorDistrict,
      defaultVendorUpazila: vendorUpazila
    });

    const primaryPkg = multi.vendorPackages[0];
    const isVendorMissing = Boolean(multi.isVendorLocationMissing || primaryPkg?.isVendorLocationMissing);
    const cleanVendorDist = isVendorMissing ? '' : normalizeDistrictName(vendorDistrict);
    const cleanVendorUpazila = isVendorMissing ? '' : (vendorUpazila || '').trim();
    const cleanCustDist = normalizeDistrictName(customerDistrict || '');
    const cleanCustUpazila = (customerUpazila || '').trim();

    return {
      deliveryCharge: multi.totalShippingFee,
      courierCharge: multi.totalShippingFee,
      packagingCost: 0,
      baseCharge: primaryPkg ? primaryPkg.baseCharge : multi.totalShippingFee,
      extraWeightCharge: primaryPkg ? primaryPkg.extraWeightCharge : 0,
      totalWeightKg: multi.totalWeightKg,
      weightSlab: multi.weightSlab,
      weightSlabLabelBn: multi.weightSlabLabelBn,
      weightSlabLabelEn: primaryPkg?.weightSlabLabelEn || 'Weight Slab',
      extraKgCount: multi.extraWeightKg,
      extraWeightKg: multi.extraWeightKg,
      extraKgRate: primaryPkg?.extraKgRate || 25,
      zone: multi.zone,
      zoneLabel: isVendorMissing ? 'Vendor Location Missing' : (primaryPkg?.routeLabelEn || 'Courier Route'),
      zoneLabelBn: isVendorMissing ? 'ভেন্ডর লোকেশন অনুপস্থিত' : (primaryPkg?.routeLabelBn || 'কুরিয়ার রুট'),
      estimatedDays: isVendorMissing ? 'N/A' : (primaryPkg?.estimatedDays || '2-4 Business Days'),
      distanceKm: multi.distanceKm || primaryPkg?.distanceKm,
      originCoordinates: primaryPkg?.originCoordinates,
      destCoordinates: primaryPkg?.destCoordinates,
      vendorLocation: {
        district: cleanVendorDist,
        upazila: cleanVendorUpazila,
        isMissing: isVendorMissing
      },
      customerLocation: {
        district: cleanCustDist,
        upazila: cleanCustUpazila
      },
      platformFee: 5,
      codCharge: multi.totalCodCharge,
      hasFallbackWeight: multi.hasFallbackWeight,
      missingWeightCount: multi.missingWeightCount,
      isLocationPending: multi.isLocationPending,
      isVendorLocationMissing: isVendorMissing,
      vendorPackages: multi.vendorPackages,
      routeType: primaryPkg?.routeType
    };
  }

  // Single package route calculation
  const safeWeight = Math.max(0.1, Math.round(totalWeightKg * 100) / 100);
  const rawVDist = (vendorDistrict || '').trim();
  const isVendorMissing = !rawVDist || rawVDist.toLowerCase() === 'unknown';
  const cleanVendorDist = isVendorMissing ? '' : normalizeDistrictName(rawVDist);
  const cleanVendorUpazila = isVendorMissing ? '' : (vendorUpazila || '').trim();
  const cleanCustDist = normalizeDistrictName(customerDistrict || '');
  const cleanCustUpazila = (customerUpazila || '').trim();

  const routeInfo = resolvePathaoRoute(
    { district: cleanVendorDist, upazila: cleanVendorUpazila },
    { district: cleanCustDist, upazila: cleanCustUpazila },
    options?.fallbackZone
  );

  const subtotal = options?.orderSubtotal || 0;
  const paymentMethod = options?.paymentMethod || 'cod';
  const rateCalc = calculatePackageShippingRate(routeInfo.routeType, safeWeight, subtotal, paymentMethod);
  const finalFee = isVendorMissing ? 0 : rateCalc.shippingFee;

  return {
    deliveryCharge: finalFee,
    courierCharge: finalFee,
    packagingCost: 0,
    baseCharge: isVendorMissing ? 0 : rateCalc.baseCharge,
    extraWeightCharge: isVendorMissing ? 0 : rateCalc.extraWeightCharge,
    totalWeightKg: safeWeight,
    weightSlab: rateCalc.weightSlab,
    weightSlabLabelBn: rateCalc.weightSlabLabelBn,
    weightSlabLabelEn: rateCalc.weightSlabLabelEn,
    extraKgCount: rateCalc.extraKgCount,
    extraWeightKg: rateCalc.extraKgCount,
    extraKgRate: rateCalc.extraKgRate,
    zone: routeInfo.zone,
    zoneLabel: isVendorMissing ? 'Vendor Location Missing' : routeInfo.routeLabelEn,
    zoneLabelBn: isVendorMissing ? 'ভেন্ডর লোকেশন অনুপস্থিত' : routeInfo.routeLabelBn,
    estimatedDays: isVendorMissing ? 'N/A' : routeInfo.estimatedDays,
    distanceKm: routeInfo.distanceKm,
    originCoordinates: routeInfo.originCoordinates,
    destCoordinates: routeInfo.destCoordinates,
    vendorLocation: {
      district: cleanVendorDist,
      upazila: cleanVendorUpazila,
      isMissing: isVendorMissing
    },
    customerLocation: {
      district: cleanCustDist,
      upazila: cleanCustUpazila
    },
    platformFee: 5,
    codCharge: isVendorMissing ? 0 : rateCalc.codCharge,
    hasFallbackWeight: options?.hasFallbackWeight,
    missingWeightCount: options?.missingWeightCount,
    isLocationPending: routeInfo.isLocationPending,
    isVendorLocationMissing: isVendorMissing,
    routeType: routeInfo.routeType
  };
}
