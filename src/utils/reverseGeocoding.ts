import { BANGLADESH_DISTRICTS, District, Upazila } from '../data/bangladeshDistricts';

export interface GeocodedLocationResult {
  division: string;
  district: string;
  upazila: string;
  area: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  source: 'gps_nominatim' | 'gps_bigdatacloud' | 'gps_nearest_centroid' | 'manual';
}

/**
 * Normalizes Bengali characters to handle Unicode decomposition (e.g. য় vs য়, ড় vs ড়, ঢ়, ৎ)
 */
export function normalizeBengali(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFC')
    .replace(/\u09af\u09bc/g, '\u09df') // য + ় -> য়
    .replace(/\u09a1\u09bc/g, '\u09dc') // ড + ় -> ড়
    .replace(/\u09a2\u09bc/g, '\u09dd'); // ঢ + ় -> ঢ়
}

// Approximate centroids for all Bangladesh 64 districts for instant accurate fallback
const BANGLADESH_DISTRICT_CENTROIDS: Record<string, { lat: number; lng: number; division: string }> = {
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

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestDistrictCentroid(lat: number, lng: number): { district: string; division: string } {
  let nearestDist = 'Dhaka';
  let nearestDivision = 'Dhaka';
  let minKm = Infinity;

  for (const [dName, coord] of Object.entries(BANGLADESH_DISTRICT_CENTROIDS)) {
    const km = getDistanceKm(lat, lng, coord.lat, coord.lng);
    if (km < minKm) {
      minKm = km;
      nearestDist = dName;
      nearestDivision = coord.division;
    }
  }

  // Canonicalize to BANGLADESH_DISTRICTS match
  const canonical = BANGLADESH_DISTRICTS.find(d => 
    d.id.toLowerCase() === nearestDist.toLowerCase() ||
    d.name.toLowerCase().includes(nearestDist.toLowerCase())
  );

  return {
    district: canonical ? canonical.id : nearestDist,
    division: canonical ? canonical.division : nearestDivision
  };
}

/**
 * Matches reverse-geocoded tokens to our official BANGLADESH_DISTRICTS dataset
 */
export function matchDistrictAndUpazila(
  tokens: string[]
): { district: string; upazila: string; division: string } {
  const cleanTokens = tokens
    .filter(Boolean)
    .map(t => normalizeBengali(t.toLowerCase().trim()))
    .filter(t => t.length > 1);

  let matchedDistrictObj: District | undefined;
  let matchedUpazilaObj: Upazila | undefined;

  // 1. Try to match district
  for (const token of cleanTokens) {
    const found = BANGLADESH_DISTRICTS.find(d => {
      const normId = normalizeBengali(d.id.toLowerCase());
      const normName = normalizeBengali(d.name.toLowerCase());
      return normId === token || normName.includes(token) || token.includes(normId);
    });
    if (found) {
      matchedDistrictObj = found;
      break;
    }
  }

  // Common aliases
  if (!matchedDistrictObj) {
    for (const token of cleanTokens) {
      if (token.includes('cox') || token.includes('কক্সবাজার')) {
        matchedDistrictObj = BANGLADESH_DISTRICTS.find(d => d.id === "Coxs Bazar" || d.id === "Cox's Bazar");
      } else if (token.includes('chittagong') || token.includes('chattogram') || token.includes('চট্টগ্রাম')) {
        matchedDistrictObj = BANGLADESH_DISTRICTS.find(d => d.id === 'Chattogram');
      } else if (token.includes('dhaka') || token.includes('ঢাকা')) {
        matchedDistrictObj = BANGLADESH_DISTRICTS.find(d => d.id === 'Dhaka');
      } else if (token.includes('sylhet') || token.includes('সিলেট')) {
        matchedDistrictObj = BANGLADESH_DISTRICTS.find(d => d.id === 'Sylhet');
      } else if (token.includes('khulna') || token.includes('খুলনা')) {
        matchedDistrictObj = BANGLADESH_DISTRICTS.find(d => d.id === 'Khulna');
      } else if (token.includes('rajshahi') || token.includes('রাজশাহী')) {
        matchedDistrictObj = BANGLADESH_DISTRICTS.find(d => d.id === 'Rajshahi');
      } else if (token.includes('barishal') || token.includes('বরিশাল')) {
        matchedDistrictObj = BANGLADESH_DISTRICTS.find(d => d.id === 'Barishal');
      } else if (token.includes('rangpur') || token.includes('রংপুর')) {
        matchedDistrictObj = BANGLADESH_DISTRICTS.find(d => d.id === 'Rangpur');
      } else if (token.includes('mymensingh') || token.includes('ময়মনসিংহ')) {
        matchedDistrictObj = BANGLADESH_DISTRICTS.find(d => d.id === 'Mymensingh');
      } else if (token.includes('comilla') || token.includes('cumilla') || token.includes('কুমিল্লা')) {
        matchedDistrictObj = BANGLADESH_DISTRICTS.find(d => d.id === 'Cumilla');
      } else if (token.includes('bogura') || token.includes('bogra') || token.includes('বগুড়া') || token.includes('বগুড়া')) {
        matchedDistrictObj = BANGLADESH_DISTRICTS.find(d => d.id === 'Bogura');
      }
      if (matchedDistrictObj) break;
    }
  }

  // 2. Try to match upazila with high specificity (avoid generic city/district names matching "Sadar" prematurely)
  const isGenericCityToken = (tok: string) => {
    const t = tok.toLowerCase();
    return t === 'dhaka' || t === 'ঢাকা' ||
           t === 'chattogram' || t === 'chittagong' || t === 'চট্টগ্রাম' ||
           t === 'cox' || t === "cox's bazar" || t === 'coxs bazar' || t === 'কক্সবাজার' ||
           t === 'sylhet' || t === 'সিলেট' ||
           t === 'rajshahi' || t === 'রাজশাহী' ||
           t === 'khulna' || t === 'খুলনা' ||
           t === 'barishal' || t === 'বরিশাল' ||
           t === 'rangpur' || t === 'রংপুর' ||
           t === 'mymensingh' || t === 'ময়মনসিংহ';
  };

  if (matchedDistrictObj) {
    // Step 2A: Exact or strong specific upazila match within matched district (skip pure generic city tokens)
    for (const token of cleanTokens) {
      if (isGenericCityToken(token)) continue;
      const strippedToken = token.replace(/(উপজেলা|থানা|সিটি|সদর|পৌরসভা|sadar|thana|upazila|city)/g, '').trim();
      
      const up = matchedDistrictObj.upazilas.find(u => {
        const uId = normalizeBengali(u.id.toLowerCase());
        const uName = normalizeBengali(u.name.toLowerCase());
        return (
          uId === token ||
          uName.includes(token) ||
          token.includes(uId) ||
          (strippedToken.length >= 3 && (uName.includes(strippedToken) || uId.includes(strippedToken)))
        );
      });
      if (up) {
        matchedUpazilaObj = up;
        break;
      }
    }

    // Step 2B: If no specific upazila was found and a token specifically mentions "sadar" / "সদর"
    if (!matchedUpazilaObj) {
      for (const token of cleanTokens) {
        if (token.includes('sadar') || token.includes('সদর')) {
          const sadarUp = matchedDistrictObj.upazilas.find(u => {
            const uId = normalizeBengali(u.id.toLowerCase());
            const uName = normalizeBengali(u.name.toLowerCase());
            return uId.includes('sadar') || uName.includes('সদর');
          });
          if (sadarUp) {
            matchedUpazilaObj = sadarUp;
            break;
          }
        }
      }
    }
  } else {
    // Search across all districts for unique specific upazila name (e.g. "Ukhiya" -> Cox's Bazar, "Mirpur" -> Dhaka)
    for (const token of cleanTokens) {
      if (isGenericCityToken(token)) continue;
      for (const dist of BANGLADESH_DISTRICTS) {
        const up = dist.upazilas.find(u => {
          const uId = normalizeBengali(u.id.toLowerCase());
          const uName = normalizeBengali(u.name.toLowerCase());
          return uId === token || uName.includes(token) || token.includes(uId);
        });
        if (up) {
          matchedDistrictObj = dist;
          matchedUpazilaObj = up;
          break;
        }
      }
      if (matchedUpazilaObj) break;
    }
  }

  const district = matchedDistrictObj ? matchedDistrictObj.id : '';
  const division = matchedDistrictObj ? matchedDistrictObj.division : '';
  const upazila = matchedUpazilaObj
    ? matchedUpazilaObj.id
    : matchedDistrictObj && matchedDistrictObj.upazilas.length > 0
    ? matchedDistrictObj.upazilas[0].id
    : '';

  return { district, upazila, division };
}

/**
 * Reverse geocodes GPS coordinates to Bangladesh Division, District, Upazila and Area
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<GeocodedLocationResult> {
  const centroidFallback = findNearestDistrictCentroid(lat, lng);
  const matchedDistObj = BANGLADESH_DISTRICTS.find(d => d.id === centroidFallback.district);
  const defaultUpazila = matchedDistObj?.upazilas?.[0]?.id || 'Sadar';

  let rawAddress: any = null;
  let cleanAddressString = '';
  let source: GeocodedLocationResult['source'] = 'gps_nearest_centroid';

  // Attempt 1: OpenStreetMap Nominatim with 5s timeout and standard headers
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=bn,en`,
      {
        headers: { 
          'Accept-Language': 'bn,en',
          'User-Agent': 'RJWorldBD/1.0 (contact: info@rjworldbd.com)'
        },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      if (data && data.address) {
        rawAddress = data.address;
        
        // Build clean, professional Bengali delivery address line:
        // [বিল্ডিং / হোল্ডিং], [রোড / রাস্তা], [মহল্লা / এলাকা / গ্রাম], [থানা / শহর], [জেলা], [পোস্টকোড]
        const addrParts: string[] = [];
        if (rawAddress.building) addrParts.push(rawAddress.building);
        if (rawAddress.house_number) addrParts.push(`বাসা/হোল্ডিং: ${rawAddress.house_number}`);
        const road = rawAddress.road || rawAddress.pedestrian || rawAddress.street || rawAddress.residential;
        if (road) addrParts.push(road);
        const neighbourhood = rawAddress.suburb || rawAddress.neighbourhood || rawAddress.quarter || rawAddress.village || rawAddress.commercial;
        if (neighbourhood) addrParts.push(neighbourhood);
        const cityPart = rawAddress.city_district || rawAddress.town || rawAddress.city || rawAddress.municipality;
        if (cityPart && !addrParts.includes(cityPart)) addrParts.push(cityPart);
        if (rawAddress.postcode) addrParts.push(`পোস্টকোড: ${rawAddress.postcode}`);

        cleanAddressString = addrParts.filter(Boolean).join(', ');
        source = 'gps_nominatim';
      }
    }
  } catch {
    // Nominatim failed or timed out, try BigDataCloud
  }

  // Attempt 2: BigDataCloud free client API with 4s timeout
  if (!rawAddress) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=bn`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        const adminList = (data.localityInfo?.administrative || []).map((a: any) => a.name);
        rawAddress = {
          city: data.city,
          state: data.principalSubdivision,
          suburb: data.locality,
          road: data.locality,
          adminList
        };
        cleanAddressString = [data.locality, data.city, data.principalSubdivision].filter(Boolean).join(', ');
        source = 'gps_bigdatacloud';
      }
    } catch {
      // BigDataCloud failed, proceed to local centroid fallback
    }
  }

  if (rawAddress) {
    const tokens = [
      rawAddress.suburb,
      rawAddress.neighbourhood,
      rawAddress.village,
      rawAddress.quarter,
      rawAddress.city_district,
      rawAddress.town,
      rawAddress.city,
      rawAddress.county,
      rawAddress.state_district,
      rawAddress.state,
      rawAddress.municipality,
      rawAddress.road,
      ...(Array.isArray(rawAddress.adminList) ? rawAddress.adminList : [])
    ].filter(Boolean);

    const match = matchDistrictAndUpazila(tokens);
    const district = match.district || centroidFallback.district;
    const division = match.division || centroidFallback.division;
    const upazila = match.upazila || defaultUpazila;
    const area = rawAddress.suburb || rawAddress.neighbourhood || rawAddress.village || rawAddress.road || rawAddress.town || '';

    // If cleanAddressString is still empty or too short, generate a comprehensive address
    const finalFullAddress = cleanAddressString && cleanAddressString.length > 5
      ? cleanAddressString
      : `${area ? area + ', ' : ''}${upazila}, ${district}`;

    return {
      division,
      district,
      upazila,
      area,
      fullAddress: finalFullAddress,
      latitude: lat,
      longitude: lng,
      source
    };
  }

  // Offline / Centroid match
  return {
    division: centroidFallback.division,
    district: centroidFallback.district,
    upazila: defaultUpazila,
    area: '',
    fullAddress: `${defaultUpazila}, ${centroidFallback.district}`,
    latitude: lat,
    longitude: lng,
    source: 'gps_nearest_centroid'
  };
}

/**
 * Authentic device GPS location detection:
 * - Uses real hardware GPS / mobile browser sensor coordinates
 * - Supports quick cached position (up to 60s) for instant response on mobile
 * - Tries network/cell-tower triangulation if satellite GPS lock takes longer
 * - Strictly NEVER uses IP geolocation (which routes through ISP gateways in Faridpur/Dhaka and generates wrong addresses)
 * - Throws informative errors on permission denied or disabled GPS so user is guided to manually select district
 */
export async function detectSmartUserLocation(): Promise<GeocodedLocationResult> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('GEOLOCATION_UNSUPPORTED');
  }

  // Check Permissions API if supported in modern browsers
  if (typeof navigator.permissions !== 'undefined' && navigator.permissions.query) {
    try {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      if (perm.state === 'denied') {
        throw new Error('PERMISSION_DENIED');
      }
    } catch (e: any) {
      if (e?.message === 'PERMISSION_DENIED') throw e;
    }
  }

  const getPositionPromise = (
    enableHighAccuracy: boolean,
    timeoutMs: number,
    maximumAge: number
  ): Promise<GeolocationCoordinates> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        (err) => reject(err),
        {
          enableHighAccuracy,
          timeout: timeoutMs,
          maximumAge
        }
      );
    });
  };

  let coords: GeolocationCoordinates | null = null;
  let lastErr: any = null;

  // Attempt 1: High Accuracy GPS (10s timeout, allows 60s cache for instant mobile return)
  try {
    coords = await getPositionPromise(true, 10000, 60000);
  } catch (err: any) {
    lastErr = err;
    console.warn('GPS highAccuracy error:', err?.code, err?.message);
    if (err && err.code === 1) { // 1 = PERMISSION_DENIED
      throw new Error('PERMISSION_DENIED');
    }
  }

  // Attempt 2: If highAccuracy timed out or failed (e.g. indoors), try cell tower/wifi location
  if (!coords) {
    try {
      coords = await getPositionPromise(false, 6000, 180000);
    } catch (err: any) {
      lastErr = err;
      console.warn('GPS lowAccuracy error:', err?.code, err?.message);
      if (err && err.code === 1) {
        throw new Error('PERMISSION_DENIED');
      }
    }
  }

  // If no GPS coordinates from device, DO NOT fake or guess with IP geolocation!
  // In Bangladesh, IP addresses map to ISP server rooms (often Faridpur, Dhaka, Tongi)
  // which causes incorrect shipping. Throwing an error ensures user manually selects Cox's Bazar.
  if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
    if (lastErr?.code === 1) {
      throw new Error('PERMISSION_DENIED');
    } else if (lastErr?.code === 2) {
      throw new Error('POSITION_UNAVAILABLE');
    } else if (lastErr?.code === 3) {
      throw new Error('TIMEOUT');
    }
    throw new Error('POSITION_UNAVAILABLE');
  }

  return await reverseGeocodeCoordinates(coords.latitude, coords.longitude);
}
