import { GoogleGenAI } from '@google/genai';

export interface ApprovedCourier {
  code: string;
  name: string;
  bengaliName: string;
  officialDomains: string[];
  trackingUrlTemplate: string;
  sampleTrackingId: string;
  trackingRegex?: string;
  enabled: boolean;
  notes?: string;
}

export interface OrderVerificationDetails {
  orderId: string;
  vendorId?: string;
  customerName?: string;
  customerPhone?: string;
  district?: string;
  upazila?: string;
  area?: string;
  fullAddress?: string;
  codAmount?: number;
  itemsPrice?: number;
  deliveryCharge?: number;
  grandTotal?: number;
  paymentMethod?: string;
}

export type CourierVerificationStatus =
  | 'Verification Pending'
  | 'Verifying'
  | 'Verified'
  | 'Verification Failed'
  | 'Manual Review Required'
  | 'Invalid Tracking ID';

export interface CourierVerificationRecord {
  id: string;
  orderId: string;
  vendorId: string;
  courier: string;
  courierCode: string;
  trackingId: string;
  officialTrackingUrl: string;
  vendorSubmittedUrl?: string;
  verificationResult: CourierVerificationStatus;
  currentStatus: string;
  verificationTime: number;
  failureReason?: string;
  domainCheckPassed: boolean;
  trackingFound: boolean;
  orderMatchConfidence: number;
  matchDetails: {
    nameMatch: 'Matched' | 'Partial' | 'Mismatch' | 'Not Visible';
    districtMatch: 'Matched' | 'Mismatch' | 'Not Visible';
    addressMatch: 'Matched' | 'Partial' | 'Mismatch' | 'Not Visible';
    phoneMatch: 'Matched' | 'Partial' | 'Mismatch' | 'Not Visible';
    codMatch: 'Matched' | 'Mismatch' | 'Not Visible';
  };
  extractedCourierData?: {
    recipientName?: string;
    recipientPhone?: string;
    recipientDistrict?: string;
    recipientAddress?: string;
    codAmount?: number;
    consignmentStatus?: string;
    hubLocation?: string;
    lastEventTime?: string;
  };
  orderSnapshot: {
    customerName?: string;
    district?: string;
    maskedPhone?: string;
    codAmount?: number;
  };
  adminApproved?: boolean;
  adminReviewedBy?: string;
  adminReviewNotes?: string;
  lastSyncedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// 1. Approved Courier List with Official Domains and URL templates
export const DEFAULT_APPROVED_COURIERS: ApprovedCourier[] = [
  {
    code: 'steadfast',
    name: 'Steadfast Courier',
    bengaliName: 'স্টেডফাস্ট কুরিয়ার',
    officialDomains: ['steadfast.com.bd', 'www.steadfast.com.bd'],
    trackingUrlTemplate: 'https://steadfast.com.bd/t/{trackingId}',
    sampleTrackingId: 'SF84920194',
    trackingRegex: '^[0-9a-zA-Z_-]{5,25}$',
    enabled: true,
    notes: 'Official nationwide parcel courier with instant web tracking.'
  },
  {
    code: 'pathao',
    name: 'Pathao Courier',
    bengaliName: 'পাঠাও কুরিয়ার',
    officialDomains: ['pathao.com', 'merchant.pathao.com', 'delivery.pathao.com', 'www.pathao.com'],
    trackingUrlTemplate: 'https://merchant.pathao.com/tracking?consignment_id={trackingId}',
    sampleTrackingId: 'PT8892011',
    trackingRegex: '^[0-9a-zA-Z_-]{5,30}$',
    enabled: true,
    notes: 'Pathao merchant and customer parcel tracking.'
  },
  {
    code: 'redx',
    name: 'RedX Delivery',
    bengaliName: 'রেডএক্স ডেলিভারি',
    officialDomains: ['redx.com.bd', 'www.redx.com.bd'],
    trackingUrlTemplate: 'https://redx.com.bd/track-order/{trackingId}',
    sampleTrackingId: 'REDX-998822',
    trackingRegex: '^[0-9a-zA-Z_-]{5,25}$',
    enabled: true,
    notes: 'RedX logistics & e-commerce parcel delivery.'
  },
  {
    code: 'paperfly',
    name: 'Paperfly',
    bengaliName: 'পেপারফ্লাই',
    officialDomains: ['paperfly.com.bd', 'go.paperfly.com.bd', 'www.paperfly.com.bd'],
    trackingUrlTemplate: 'https://paperfly.com.bd/tracking?id={trackingId}',
    sampleTrackingId: 'PFLY-554433',
    trackingRegex: '^[0-9a-zA-Z_-]{5,25}$',
    enabled: true,
    notes: 'Paperfly door-to-door nationwide delivery service.'
  },
  {
    code: 'ecourier',
    name: 'eCourier',
    bengaliName: 'ই-কুরিয়ার',
    officialDomains: ['ecourier.com.bd', 'www.ecourier.com.bd'],
    trackingUrlTemplate: 'https://ecourier.com.bd/track?ref={trackingId}',
    sampleTrackingId: 'EC9028114',
    trackingRegex: '^[0-9a-zA-Z_-]{5,25}$',
    enabled: true,
    notes: 'eCourier Bangladesh tracking portal.'
  },
  {
    code: 'carrybee',
    name: 'Carrybee',
    bengaliName: 'ক্যারিবি',
    officialDomains: ['carrybee.com.bd', 'carrybee.com', 'www.carrybee.com.bd'],
    trackingUrlTemplate: 'https://carrybee.com.bd/tracking/{trackingId}',
    sampleTrackingId: 'CB771822',
    trackingRegex: '^[0-9a-zA-Z_-]{5,25}$',
    enabled: true,
    notes: 'Carrybee express courier.'
  },
  {
    code: 'deliverytiger',
    name: 'Delivery Tiger',
    bengaliName: 'ডেলিভারি টাইগার',
    officialDomains: ['deliverytiger.com.bd', 'www.deliverytiger.com.bd'],
    trackingUrlTemplate: 'https://deliverytiger.com.bd/track/{trackingId}',
    sampleTrackingId: 'DT-449120',
    trackingRegex: '^[0-9a-zA-Z_-]{5,25}$',
    enabled: true,
    notes: 'Delivery Tiger parcel tracking.'
  },
  {
    code: 'sundarban',
    name: 'Sundarban Courier Service',
    bengaliName: 'সুন্দরবন কুরিয়ার সার্ভিস',
    officialDomains: ['sundarbancourierltd.com', 'www.sundarbancourierltd.com', 'sundarban-courier.com'],
    trackingUrlTemplate: 'https://sundarbancourierltd.com/track/{trackingId}',
    sampleTrackingId: 'SB839201',
    trackingRegex: '^[0-9a-zA-Z_-]{4,25}$',
    enabled: true,
    notes: 'Sundarban Courier Ltd consignment tracking.'
  },
  {
    code: 'saparibahan',
    name: 'SA Paribahan',
    bengaliName: 'এস এ পরিবহন',
    officialDomains: ['saparibahanltd.com', 'saparibahan.com', 'www.saparibahanltd.com'],
    trackingUrlTemplate: 'https://saparibahanltd.com/tracking/{trackingId}',
    sampleTrackingId: 'SA559910',
    trackingRegex: '^[0-9a-zA-Z_-]{4,25}$',
    enabled: true,
    notes: 'SA Paribahan parcel & courier service.'
  },
  {
    code: 'janani',
    name: 'Janani Express',
    bengaliName: 'জননী এক্সপ্রেস পার্সেল সার্ভিস',
    officialDomains: ['jananiexpress.com', 'jananiexpressparcel.com', 'www.jananiexpress.com'],
    trackingUrlTemplate: 'https://jananiexpress.com/tracking/{trackingId}',
    sampleTrackingId: 'JN667722',
    trackingRegex: '^[0-9a-zA-Z_-]{4,25}$',
    enabled: true,
    notes: 'Janani Express courier tracking.'
  }
];

const RTDB_BASE_URL = 'https://rjworldbdcom-default-rtdb.firebaseio.com';

/**
 * Fetch approved couriers (combines default with any customized couriers in RTDB)
 */
export async function getApprovedCouriersList(): Promise<ApprovedCourier[]> {
  try {
    const res = await fetch(`${RTDB_BASE_URL}/settings/couriers.json`, {
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const customCouriers = await res.json();
      if (customCouriers && Array.isArray(customCouriers) && customCouriers.length > 0) {
        return customCouriers;
      }
      if (customCouriers && typeof customCouriers === 'object') {
        const list = Object.values(customCouriers) as ApprovedCourier[];
        if (list.length > 0) return list;
      }
    }
  } catch {
    // fallback to defaults
  }
  return DEFAULT_APPROVED_COURIERS;
}

/**
 * Match vendor input to an approved courier
 */
export function findApprovedCourier(courierQuery: string, couriers: ApprovedCourier[]): ApprovedCourier | null {
  if (!courierQuery) return null;
  const q = courierQuery.toLowerCase().trim().replace(/[\s\-_]/g, '');

  return (
    couriers.find((c) => {
      const cCode = c.code.toLowerCase().replace(/[\s\-_]/g, '');
      const cName = c.name.toLowerCase().replace(/[\s\-_]/g, '');
      const cBn = c.bengaliName.replace(/[\s\-_]/g, '');
      return q === cCode || q === cName || q === cBn || cName.includes(q) || q.includes(cCode);
    }) || null
  );
}

/**
 * Anti-scam verification of vendor-submitted tracking URL domain
 * Rejects phishing, typosquatting, URL shorteners, or deceptive subdomains
 */
export function verifyTrackingLinkDomain(
  submittedUrl: string,
  approvedCourier: ApprovedCourier
): {
  isValid: boolean;
  domain: string;
  error?: string;
} {
  if (!submittedUrl || !submittedUrl.trim()) {
    return { isValid: true, domain: '' };
  }

  let raw = submittedUrl.trim();
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    raw = 'https://' + raw;
  }

  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase();

    // Check against courier's approved official domains
    const isOfficial = approvedCourier.officialDomains.some((official) => {
      const off = official.toLowerCase();
      return hostname === off || hostname.endsWith('.' + off);
    });

    if (!isOfficial) {
      return {
        isValid: false,
        domain: hostname,
        error: `সন্দেহজনক বা অনুমোদনহীন ডোমেইন (${hostname}) সনাক্ত হয়েছে। '${approvedCourier.name}' এর অফিশিয়াল ডোমেইন: ${approvedCourier.officialDomains.join(', ')}। প্রতারণা রোধে ভুয়া ট্র্যাকিং লিংক সংরক্ষণ সম্পূর্ণ নিষিদ্ধ।`
      };
    }

    return {
      isValid: true,
      domain: hostname
    };
  } catch {
    return {
      isValid: false,
      domain: submittedUrl,
      error: `অবৈধ ট্র্যাকিং ইউআরএল ফরম্যাট। অনুগ্রহ করে সঠিক অফিশিয়াল লিংক বা ট্র্যাকিং আইডি প্রদান করুন।`
    };
  }
}

/**
 * Builds canonical official tracking URL
 */
export function buildOfficialTrackingUrl(courier: ApprovedCourier, trackingId: string): string {
  const cleanId = encodeURIComponent(trackingId.trim());
  return courier.trackingUrlTemplate.replace('{trackingId}', cleanId);
}

/**
 * Safely fetches public web content from official courier tracking website
 */
export async function fetchOfficialCourierTrackingPage(trackingUrl: string): Promise<{
  success: boolean;
  statusCode: number;
  content: string;
  error?: string;
}> {
  try {
    const res = await fetch(trackingUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8'
      },
      signal: AbortSignal.timeout(7000)
    });

    const text = await res.text();

    // Strip scripts, styles, and extra whitespace to keep context clean for Gemini
    const cleaned = text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000); // keep first 8000 chars

    return {
      success: res.ok,
      statusCode: res.status,
      content: cleaned
    };
  } catch (err: any) {
    return {
      success: false,
      statusCode: 0,
      content: '',
      error: err?.message || 'Network timeout fetching tracking page'
    };
  }
}

/**
 * Mask phone number for privacy display
 */
export function maskPhoneNumber(phone?: string): string {
  if (!phone) return 'N/A';
  const clean = phone.replace(/[^0-9]/g, '');
  if (clean.length >= 10) {
    return `${clean.slice(0, 3)}****${clean.slice(-3)}`;
  }
  return clean;
}

/**
 * Core AI Courier Verification & Anti-Scam Engine
 * Strictly adheres to rule: AI NEVER guesses.
 * Official Courier Website -> Real Tracking ID -> Available Tracking Information -> Order Information
 */
export async function verifyCourierTrackingWithAi(params: {
  courierName: string;
  trackingId: string;
  submittedUrl?: string;
  order: OrderVerificationDetails;
  vendorId: string;
}): Promise<CourierVerificationRecord> {
  const { courierName, trackingId, submittedUrl, order, vendorId } = params;
  const now = Date.now();
  const cleanTrackingId = (trackingId || '').trim();

  // 1. Get Approved Couriers List
  const approvedCouriers = await getApprovedCouriersList();
  const matchedCourier = findApprovedCourier(courierName, approvedCouriers);

  // If courier not in approved list:
  if (!matchedCourier) {
    const failureRecord: CourierVerificationRecord = {
      id: `verif_${order.orderId}_${now}`,
      orderId: order.orderId,
      vendorId: vendorId || order.vendorId || 'unknown',
      courier: courierName || 'Unknown',
      courierCode: 'unknown',
      trackingId: cleanTrackingId,
      officialTrackingUrl: '',
      vendorSubmittedUrl: submittedUrl,
      verificationResult: 'Verification Failed',
      currentStatus: 'Unapproved Courier',
      verificationTime: now,
      failureReason: `কুরিয়ার '${courierName || 'N/A'}' আমাদের অনুমোদিত কুরিয়ার তালিকায় নেই। শুধুমাত্র বিশ্বস্ত পার্টনার কুরিয়ার (যেমন Steadfast, Pathao, RedX, Paperfly ইত্যাদি) ব্যবহার করা বাধ্যতামূলক।`,
      domainCheckPassed: false,
      trackingFound: false,
      orderMatchConfidence: 0,
      matchDetails: {
        nameMatch: 'Mismatch',
        districtMatch: 'Mismatch',
        addressMatch: 'Mismatch',
        phoneMatch: 'Mismatch',
        codMatch: 'Mismatch'
      },
      orderSnapshot: {
        customerName: order.customerName,
        district: order.district,
        maskedPhone: maskPhoneNumber(order.customerPhone),
        codAmount: order.codAmount
      },
      createdAt: now,
      updatedAt: now
    };
    await saveVerificationToRtdb(failureRecord);
    return failureRecord;
  }

  // 2. Validate vendor submitted URL against official domain (Anti-Scam Check)
  const domainCheck = verifyTrackingLinkDomain(submittedUrl || '', matchedCourier);
  if (!domainCheck.isValid) {
    const scamRecord: CourierVerificationRecord = {
      id: `verif_${order.orderId}_${now}`,
      orderId: order.orderId,
      vendorId: vendorId || order.vendorId || 'unknown',
      courier: matchedCourier.name,
      courierCode: matchedCourier.code,
      trackingId: cleanTrackingId,
      officialTrackingUrl: buildOfficialTrackingUrl(matchedCourier, cleanTrackingId),
      vendorSubmittedUrl: submittedUrl,
      verificationResult: 'Verification Failed',
      currentStatus: 'Suspicious Domain Detected',
      verificationTime: now,
      failureReason: domainCheck.error || 'ভুয়া বা সন্দেহজনক ট্র্যাকিং ডোমেইন সনাক্ত হয়েছে।',
      domainCheckPassed: false,
      trackingFound: false,
      orderMatchConfidence: 0,
      matchDetails: {
        nameMatch: 'Mismatch',
        districtMatch: 'Mismatch',
        addressMatch: 'Mismatch',
        phoneMatch: 'Mismatch',
        codMatch: 'Mismatch'
      },
      orderSnapshot: {
        customerName: order.customerName,
        district: order.district,
        maskedPhone: maskPhoneNumber(order.customerPhone),
        codAmount: order.codAmount
      },
      createdAt: now,
      updatedAt: now
    };
    await saveVerificationToRtdb(scamRecord);
    return scamRecord;
  }

  // 3. Generate canonical official tracking URL
  const canonicalTrackingUrl = buildOfficialTrackingUrl(matchedCourier, cleanTrackingId);

  // Validate format if empty or obvious nonsense
  if (!cleanTrackingId || cleanTrackingId.length < 4) {
    const invalidIdRecord: CourierVerificationRecord = {
      id: `verif_${order.orderId}_${now}`,
      orderId: order.orderId,
      vendorId: vendorId || order.vendorId || 'unknown',
      courier: matchedCourier.name,
      courierCode: matchedCourier.code,
      trackingId: cleanTrackingId,
      officialTrackingUrl: canonicalTrackingUrl,
      vendorSubmittedUrl: submittedUrl,
      verificationResult: 'Invalid Tracking ID',
      currentStatus: 'Invalid Tracking ID',
      verificationTime: now,
      failureReason: `ট্র্যাকিং আইডি অত্যন্ত সংক্ষিপ্ত বা অকার্যকর (${cleanTrackingId})। সঠিক ট্র্যাকিং নম্বর প্রদান করুন।`,
      domainCheckPassed: true,
      trackingFound: false,
      orderMatchConfidence: 0,
      matchDetails: {
        nameMatch: 'Not Visible',
        districtMatch: 'Not Visible',
        addressMatch: 'Not Visible',
        phoneMatch: 'Not Visible',
        codMatch: 'Not Visible'
      },
      orderSnapshot: {
        customerName: order.customerName,
        district: order.district,
        maskedPhone: maskPhoneNumber(order.customerPhone),
        codAmount: order.codAmount
      },
      createdAt: now,
      updatedAt: now
    };
    await saveVerificationToRtdb(invalidIdRecord);
    return invalidIdRecord;
  }

  // 4. Fetch the real official tracking web page
  const pageResult = await fetchOfficialCourierTrackingPage(canonicalTrackingUrl);

  // 5. Run Gemini AI Verification & Order Matching Analysis
  let verificationRecord: CourierVerificationRecord;

  try {
    const aiVerification = await analyzeCourierTrackingWithGemini({
      courier: matchedCourier,
      trackingId: cleanTrackingId,
      officialTrackingUrl: canonicalTrackingUrl,
      pageContent: pageResult.content,
      pageFetched: pageResult.success,
      pageStatus: pageResult.statusCode,
      order
    });

    verificationRecord = {
      id: `verif_${order.orderId}_${now}`,
      orderId: order.orderId,
      vendorId: vendorId || order.vendorId || 'unknown',
      courier: matchedCourier.name,
      courierCode: matchedCourier.code,
      trackingId: cleanTrackingId,
      officialTrackingUrl: canonicalTrackingUrl,
      vendorSubmittedUrl: submittedUrl,
      verificationResult: aiVerification.result,
      currentStatus: aiVerification.courierStatus,
      verificationTime: now,
      failureReason: aiVerification.reason,
      domainCheckPassed: true,
      trackingFound: aiVerification.trackingFound,
      orderMatchConfidence: aiVerification.orderMatchConfidence,
      matchDetails: aiVerification.matchDetails,
      extractedCourierData: aiVerification.extractedData,
      orderSnapshot: {
        customerName: order.customerName,
        district: order.district,
        maskedPhone: maskPhoneNumber(order.customerPhone),
        codAmount: order.codAmount
      },
      adminApproved: aiVerification.result === 'Verified',
      createdAt: now,
      updatedAt: now
    };
  } catch (aiErr: any) {
    console.error('Error calling Gemini in Courier Verification:', aiErr);
    // If AI fails or network breaks, Rule 6 strictly mandates: "AI কখনো অনুমান করে Verified করবে না।"
    // In uncertainty, status must be 'Manual Review Required'
    verificationRecord = {
      id: `verif_${order.orderId}_${now}`,
      orderId: order.orderId,
      vendorId: vendorId || order.vendorId || 'unknown',
      courier: matchedCourier.name,
      courierCode: matchedCourier.code,
      trackingId: cleanTrackingId,
      officialTrackingUrl: canonicalTrackingUrl,
      vendorSubmittedUrl: submittedUrl,
      verificationResult: 'Manual Review Required',
      currentStatus: 'Verification Incomplete',
      verificationTime: now,
      failureReason: 'কুরিয়ার সার্ভার রেসপন্স বিশ্লেষণে অতিরিক্ত যাচাই প্রয়োজন। অ্যাডমিন টিম ম্যানুয়ালি রিভিউ করবে।',
      domainCheckPassed: true,
      trackingFound: pageResult.success,
      orderMatchConfidence: 50,
      matchDetails: {
        nameMatch: 'Not Visible',
        districtMatch: 'Not Visible',
        addressMatch: 'Not Visible',
        phoneMatch: 'Not Visible',
        codMatch: 'Not Visible'
      },
      orderSnapshot: {
        customerName: order.customerName,
        district: order.district,
        maskedPhone: maskPhoneNumber(order.customerPhone),
        codAmount: order.codAmount
      },
      adminApproved: false,
      createdAt: now,
      updatedAt: now
    };
  }

  // 6. Save verification audit log in Firebase Realtime Database
  await saveVerificationToRtdb(verificationRecord);

  // 7. If Verified, update order state in RTDB
  if (verificationRecord.verificationResult === 'Verified') {
    await updateOrderCourierStatusInRtdb(order.orderId, {
      status: 'Shipped',
      courierName: matchedCourier.name,
      courierCode: matchedCourier.code,
      trackingNumber: cleanTrackingId,
      trackingUrl: canonicalTrackingUrl,
      courierVerificationStatus: 'Verified',
      courierVerificationId: verificationRecord.id,
      shippedAt: now,
      courierVerifiedAt: now
    });
  } else if (verificationRecord.verificationResult === 'Manual Review Required') {
    await updateOrderCourierStatusInRtdb(order.orderId, {
      courierName: matchedCourier.name,
      courierCode: matchedCourier.code,
      trackingNumber: cleanTrackingId,
      trackingUrl: canonicalTrackingUrl,
      courierVerificationStatus: 'Manual Review Required',
      courierVerificationId: verificationRecord.id,
      courierReviewPendingAt: now
    });
  } else {
    await updateOrderCourierStatusInRtdb(order.orderId, {
      courierVerificationStatus: verificationRecord.verificationResult,
      courierVerificationId: verificationRecord.id,
      courierVerificationFailureReason: verificationRecord.failureReason
    });
  }

  return verificationRecord;
}

/**
 * Gemini Prompt & Structured Anti-Scam Evaluation
 */
async function analyzeCourierTrackingWithGemini(params: {
  courier: ApprovedCourier;
  trackingId: string;
  officialTrackingUrl: string;
  pageContent: string;
  pageFetched: boolean;
  pageStatus: number;
  order: OrderVerificationDetails;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
You are RJ WORLD BD's elite AI Courier Tracking Verification & Anti-Scam Security Officer.
Your highest duty is to protect customers and the marketplace against fake couriers, fake tracking IDs, and wrong/reused consignment numbers.

SECURITY RULES (NEVER COMPROMISE):
1. Never assume or guess. If tracking information is missing, unconfirmed, or does not clearly match the order, DO NOT verify.
2. Status MUST be one of:
   - "Verified": Tracking ID exists on official courier site AND consignment information legitimately matches customer/order details (district/area, name, or COD).
   - "Invalid Tracking ID": The tracking ID does not exist on official courier site, or shows "Not Found", "Invalid consignment", "Record not found", 404.
   - "Verification Failed": Suspicious domain, mismatched courier, or blatant fraud attempt.
   - "Manual Review Required": Tracking ID exists or appears active, but critical fields (recipient name, city, address, or COD amount) are masked, ambiguous, or cannot be fully confirmed without admin inspection.
3. Map current courier status to one of:
   - "Courier Assigned"
   - "Picked Up"
   - "In Transit"
   - "Out for Delivery"
   - "Delivered"
   - "Returned"
   - "Failed Delivery"
   - "Processing"

Output MUST be strictly valid JSON matching this schema:
{
  "result": "Verified" | "Verification Failed" | "Manual Review Required" | "Invalid Tracking ID",
  "courierStatus": "Courier Assigned" | "Picked Up" | "In Transit" | "Out for Delivery" | "Delivered" | "Returned" | "Failed Delivery" | "Processing",
  "trackingFound": boolean,
  "orderMatchConfidence": number (0 to 100),
  "matchDetails": {
    "nameMatch": "Matched" | "Partial" | "Mismatch" | "Not Visible",
    "districtMatch": "Matched" | "Mismatch" | "Not Visible",
    "addressMatch": "Matched" | "Partial" | "Mismatch" | "Not Visible",
    "phoneMatch": "Matched" | "Partial" | "Mismatch" | "Not Visible",
    "codMatch": "Matched" | "Mismatch" | "Not Visible"
  },
  "extractedData": {
    "recipientName": string,
    "recipientPhone": string,
    "recipientDistrict": string,
    "recipientAddress": string,
    "codAmount": number or null,
    "consignmentStatus": string,
    "hubLocation": string,
    "lastEventTime": string
  },
  "reason": string (clear concise explanation in Bengali)
}
`;

  const prompt = `
Please evaluate this consignment tracking and order details:

[COURIER DETAILS]
Courier: ${params.courier.name} (${params.courier.code})
Official Tracking URL: ${params.officialTrackingUrl}
Tracking ID: ${params.trackingId}
Page Fetch Status: HTTP ${params.pageStatus} (Success: ${params.pageFetched})

[MARKETPLACE ORDER DETAILS]
Order ID: #${params.order.orderId}
Customer Name: ${params.order.customerName || 'N/A'}
District: ${params.order.district || 'N/A'}
Thana / Upazila: ${params.order.upazila || 'N/A'}
Area: ${params.order.area || 'N/A'}
Full Address: ${params.order.fullAddress || 'N/A'}
Customer Phone: ${params.order.customerPhone || 'N/A'}
COD Collection Amount: ৳${params.order.codAmount ?? 0}
Grand Total: ৳${params.order.grandTotal ?? 0}

[OFFICIAL TRACKING PAGE CONTENT EXTRACT]
${params.pageContent ? params.pageContent : '(No text extracted from webpage or blocked by courier firewall)'}

Carefully analyze if the consignment exists, whether it matches this customer's destination and amount, and return your strict anti-scam verdict in JSON format.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  });

  const rawText = response.text?.trim() || '{}';
  const parsed = JSON.parse(rawText);

  return {
    result: (parsed.result || 'Manual Review Required') as CourierVerificationStatus,
    courierStatus: parsed.courierStatus || 'Courier Assigned',
    trackingFound: Boolean(parsed.trackingFound),
    orderMatchConfidence: Number(parsed.orderMatchConfidence || 0),
    matchDetails: {
      nameMatch: parsed.matchDetails?.nameMatch || 'Not Visible',
      districtMatch: parsed.matchDetails?.districtMatch || 'Not Visible',
      addressMatch: parsed.matchDetails?.addressMatch || 'Not Visible',
      phoneMatch: parsed.matchDetails?.phoneMatch || 'Not Visible',
      codMatch: parsed.matchDetails?.codMatch || 'Not Visible'
    },
    extractedData: parsed.extractedData || {},
    reason: parsed.reason || 'যাচাই প্রক্রিয়া সম্পন্ন হয়েছে।'
  };
}

/**
 * Saves verification record directly into Firebase Realtime Database
 * Firestore is strictly NOT used.
 */
export async function saveVerificationToRtdb(record: CourierVerificationRecord): Promise<void> {
  try {
    await fetch(`${RTDB_BASE_URL}/courier_verifications/${record.id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });

    // Also store under order's specific verification log
    await fetch(`${RTDB_BASE_URL}/order_courier_logs/${record.orderId}/${record.id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
  } catch (err) {
    console.error('Failed to save courier verification to RTDB:', err);
  }
}

/**
 * Updates order's courier details in Realtime Database
 */
export async function updateOrderCourierStatusInRtdb(orderId: string, patch: any): Promise<void> {
  try {
    const { courierCurrentStatus, courierStatus, ...cleanedPatch } = patch || {};
    const patchData = {
      ...cleanedPatch,
      updatedAt: Date.now()
    };

    // Update main order
    await fetch(`${RTDB_BASE_URL}/orders/${orderId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchData)
    });

    // Update vendor_orders if matched
    await fetch(`${RTDB_BASE_URL}/vendor_orders/${orderId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchData)
    });
  } catch (err) {
    console.warn('Failed to update order courier status in RTDB:', err);
  }
}

/**
 * AI Parser: Strictly analyzes official courier tracking web page content.
 * CRITICAL POLICIES MANDATED BY USER:
 * 1. NO API is ever called. Only the public official courier webpage content is parsed.
 * 2. NO GUESSING. If status is missing, not found, or unclear, statusFound MUST be false.
 * 3. Never advance or guess order status.
 * 4. Only recognizes real physical courier statuses:
 *    - 'Picked Up' (courier received/collected consignment from seller)
 *    - 'In Transit' (consignment moving between hubs/sorting facilities)
 *    - 'Out for Delivery' (rider out for delivery today)
 *    - 'Delivered' (successfully handed over to customer)
 *    - 'Returned' (returned or return in progress to merchant)
 */
export async function extractOfficialCourierTrackingStatusWithAi(params: {
  courierName: string;
  trackingId: string;
  officialTrackingUrl: string;
  pageContent: string;
  pageFetched: boolean;
  pageStatus: number;
}): Promise<{
  statusFound: boolean;
  courierStatus: 'Picked Up' | 'In Transit' | 'Out for Delivery' | 'Delivered' | 'Returned' | null;
  officialStatusText?: string;
  hubLocation?: string;
  eventTime?: string;
  reason: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  // If page fetch completely failed or was 404/empty, strictly DO NOT guess
  if (!params.pageFetched || !params.pageContent || params.pageContent.trim().length < 20) {
    return {
      statusFound: false,
      courierStatus: null,
      reason: 'অফিশিয়াল কুরিয়ার ট্র্যাকিং পেজ লোড করা যায়নি বা কোনো তথ্য পাওয়া যায়নি। অনুমান নিষিদ্ধ হওয়ায় স্ট্যাটাস পরিবর্তন করা হয়নি।'
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
You are the Official Web Tracking Inspector for RJ WORLD BD.
Your task is to inspect plain text extracted from an OFFICIAL COURIER WEBSITE (e.g., Steadfast, Pathao, RedX, Paperfly, eCourier).

CRITICAL DIRECTIVE (ZERO GUESSING):
1. You must ONLY extract what is ACTUALLY and EXPLICITLY printed on the official tracking webpage.
2. If the page shows "Tracking not found", "No data found", "Invalid consignment", "404", or if the status is absent/ambiguous:
   Set "statusFound": false, "courierStatus": null. DO NOT GUESS OR ESTIMATE.
3. If an explicit real status is visible, map it strictly to one of:
   - "Picked Up" : Courier collected package from seller, picked up, parcel received by hub, shipment collected.
   - "In Transit" : Moving between sorting hubs, in transit, on vehicle, dispatched to district hub.
   - "Out for Delivery" : Out for delivery, rider assigned for delivery, arriving today.
   - "Delivered" : Delivered, delivery successful, received by customer, cash collected.
   - "Returned" : Return to merchant, returned, customer rejected/cancelled, failed return.
4. If the page only shows that a consignment was generated or placed online but NOT yet physically collected/picked up by courier, set "statusFound": false, "courierStatus": null (do not guess).

Respond strictly in JSON format:
{
  "statusFound": boolean,
  "courierStatus": "Picked Up" | "In Transit" | "Out for Delivery" | "Delivered" | "Returned" | null,
  "officialStatusText": string (the exact status phrase from the page),
  "hubLocation": string (optional, if mentioned),
  "eventTime": string (optional, if mentioned),
  "reason": string (brief explanation in Bengali)
}
`;

  const prompt = `
Please read this official tracking webpage extract for:
Courier: ${params.courierName}
Tracking ID: ${params.trackingId}
Official URL: ${params.officialTrackingUrl}
HTTP Response: ${params.pageStatus}

[WEBPAGE CONTENT EXTRACT]
${params.pageContent}

What is the exact official status displayed on the webpage? Remember: Zero guessing. If not found or ambiguous, set statusFound to false.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.0,
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    if (!parsed.statusFound || !parsed.courierStatus) {
      return {
        statusFound: false,
        courierStatus: null,
        officialStatusText: parsed.officialStatusText,
        reason: parsed.reason || 'কুরিয়ার পেজে সুনির্দিষ্ট কোনো স্ট্যাটাস পাওয়া যায়নি (অনুমান নিষিদ্ধ)।'
      };
    }

    return {
      statusFound: true,
      courierStatus: parsed.courierStatus,
      officialStatusText: parsed.officialStatusText || parsed.courierStatus,
      hubLocation: parsed.hubLocation,
      eventTime: parsed.eventTime,
      reason: parsed.reason || `অফিশিয়াল কুরিয়ার পেজে স্ট্যাটাস: ${parsed.courierStatus}`
    };
  } catch (err: any) {
    console.error('Error analyzing official courier page with AI:', err);
    return {
      statusFound: false,
      courierStatus: null,
      reason: 'এআই বিশ্লেষণ সম্পন্ন করা যায়নি। অনুমান নিষিদ্ধ থাকায় স্ট্যাটাস অপরিবর্তিত রাখা হয়েছে।'
    };
  }
}

/**
 * Live Sync: Checks official courier tracking website for an order and updates customer timeline.
 * STRICTURES ENFORCED:
 * 1. Checks ONLY if Courier Tracking Link is Approved by Admin (or Verified).
 * 2. NO API: Only reads the official courier tracking webpage.
 * 3. NO THIRD PARTY / FAKE DOMAIN: Domain must strictly match official courier whitelist.
 * 4. NO GUESSING: If status is not found on page, order status is NOT changed.
 * 5. Vendor CANNOT change order status; it is automated from official courier page.
 */
export async function syncOrderCourierTracking(orderId: string): Promise<{
  success: boolean;
  orderId: string;
  previousStatus: string;
  newStatus: string;
  orderStatusUnchanged: boolean;
  courier: string;
  trackingId: string;
  lastChecked: number;
  message: string;
}> {
  // 1. Fetch current order from RTDB
  let orderData: any = null;
  try {
    const res = await fetch(`${RTDB_BASE_URL}/orders/${orderId}.json`);
    if (res.ok) orderData = await res.json();
  } catch {}

  if (!orderData) {
    try {
      const resV = await fetch(`${RTDB_BASE_URL}/vendor_orders/${orderId}.json`);
      if (resV.ok) orderData = await resV.json();
    } catch {}
  }

  if (!orderData) {
    return {
      success: false,
      orderId,
      previousStatus: 'Unknown',
      newStatus: 'Unknown',
      orderStatusUnchanged: true,
      courier: '',
      trackingId: '',
      lastChecked: Date.now(),
      message: 'অর্ডার পাওয়া যায়নি।'
    };
  }

  const courierName = orderData.courierName || '';
  const trackingId = (orderData.trackingNumber || orderData.trackingId || '').trim();
  const previousStatus = orderData.status || 'Processing';
  const now = Date.now();

  // Strict Rule 1: Admin must have approved the courier tracking link
  const isApproved =
    orderData.courierAdminApproved === true ||
    orderData.courierVerificationStatus === 'Verified';

  if (!isApproved) {
    return {
      success: false,
      orderId,
      previousStatus,
      newStatus: previousStatus,
      orderStatusUnchanged: true,
      courier: courierName,
      trackingId,
      lastChecked: now,
      message:
        'কুরিয়ার ট্র্যাকিং লিঙ্কটি অ্যাডমিন কর্তৃক অনুমোদিত হয়নি (Pending Admin Review)। নিয়ম অনুযায়ী শুধুমাত্র অ্যাডমিন অনুমোদিত ট্র্যাকিং লিংক অফিশিয়াল পেজ থেকে চেক করা হয়।'
    };
  }

  if (!trackingId) {
    return {
      success: false,
      orderId,
      previousStatus,
      newStatus: previousStatus,
      orderStatusUnchanged: true,
      courier: courierName,
      trackingId: '',
      lastChecked: now,
      message: 'এই অর্ডারে কোনো ট্র্যাকিং আইডি সংযুক্ত নেই।'
    };
  }

  // Strict Rule 2: Anti-Scam / Third-party domain check
  const approvedCouriers = await getApprovedCouriersList();
  const courier = findApprovedCourier(courierName, approvedCouriers);
  if (!courier) {
    return {
      success: false,
      orderId,
      previousStatus,
      newStatus: previousStatus,
      orderStatusUnchanged: true,
      courier: courierName,
      trackingId,
      lastChecked: now,
      message: `কুরিয়ার '${courierName}' অনুমোদিত তালিকায় নেই। কোনো স্ট্যাটাস গ্রহণ করা হয়নি।`
    };
  }

  // Validate submitted URL domain against official courier domains
  const targetUrl = orderData.courierTrackingUrl || orderData.trackingUrl || buildOfficialTrackingUrl(courier, trackingId);
  const domainCheck = verifyTrackingLinkDomain(targetUrl, courier);
  if (!domainCheck.isValid) {
    return {
      success: false,
      orderId,
      previousStatus,
      newStatus: previousStatus,
      orderStatusUnchanged: true,
      courier: courier.name,
      trackingId,
      lastChecked: now,
      message: domainCheck.error || 'ভুয়া বা তৃতীয় পক্ষের ওয়েবসাইট সনাক্ত হয়েছে। কোনো স্ট্যাটাস গ্রহণ করা হয়নি।'
    };
  }

  // Build canonical official tracking page URL
  const officialTrackingUrl = buildOfficialTrackingUrl(courier, trackingId);

  // Strict Rule 3: NO API! Fetch the public webpage HTML from official website
  const pageResult = await fetchOfficialCourierTrackingPage(officialTrackingUrl);

  // Strict Rule 4: Zero guessing AI parsing of the official tracking webpage
  const aiStatus = await extractOfficialCourierTrackingStatusWithAi({
    courierName: courier.name,
    trackingId,
    officialTrackingUrl,
    pageContent: pageResult.content,
    pageFetched: pageResult.success,
    pageStatus: pageResult.statusCode
  });

  // Courier status auto-updating system is completely removed per policy.
  // Our website does not display or automatically update courier statuses (In Transit, Out for Delivery, Delivered, Returned).
  // Customers track their orders directly on the official courier website.
  return {
    success: true,
    orderId,
    previousStatus,
    newStatus: previousStatus,
    orderStatusUnchanged: true,
    courier: courier.name,
    trackingId,
    lastChecked: now,
    message: 'আমাদের ওয়েবসাইটে কোনো কুরিয়ার স্ট্যাটাস সরাসরি আপডেট হয় না। গ্রাহক অনুমোদিত কুরিয়ার ওয়েবসাইট থেকে সরাসরি ট্র্যাক করবেন।'
  };
}

/**
 * In-memory state and statistics for Periodic Courier Checking Job
 */
export interface PeriodicJobStats {
  running: boolean;
  intervalMinutes: number;
  lastRunAt: number | null;
  nextRunAt: number | null;
  totalOrdersChecked: number;
  ordersUpdated: number;
  lastLogs: Array<{
    orderId: string;
    courier: string;
    previousStatus: string;
    newStatus: string;
    message: string;
    time: number;
  }>;
}

const periodicJobState: PeriodicJobStats = {
  running: false,
  intervalMinutes: 15,
  lastRunAt: null,
  nextRunAt: null,
  totalOrdersChecked: 0,
  ordersUpdated: 0,
  lastLogs: []
};

/**
 * Returns the current status of the periodic AI Courier Checking Job
 */
export function getPeriodicCourierCheckStatus(): PeriodicJobStats {
  return { ...periodicJobState };
}

/**
 * Periodic Job: Completely disabled per policy
 */
export async function runPeriodicApprovedCourierTrackingCheck(): Promise<{
  success: boolean;
  checkedCount: number;
  updatedCount: number;
  logs: any[];
  timestamp: number;
}> {
  return {
    success: true,
    checkedCount: 0,
    updatedCount: 0,
    logs: [],
    timestamp: Date.now()
  };
}

/**
 * Background scheduler for periodic AI Courier Tracking checks - Disabled per policy
 */
export function startPeriodicCourierTrackingJob(_intervalMinutes: number = 15): void {
  console.log('[AI Courier Tracking Sync] Background automatic courier status updates completely disabled per policy.');
}

