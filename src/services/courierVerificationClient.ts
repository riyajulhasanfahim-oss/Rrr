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

export const FALLBACK_APPROVED_COURIERS: ApprovedCourier[] = [
  {
    code: 'steadfast',
    name: 'Steadfast Courier',
    bengaliName: 'স্টেডফাস্ট কুরিয়ার',
    officialDomains: ['steadfast.com.bd', 'www.steadfast.com.bd'],
    trackingUrlTemplate: 'https://steadfast.com.bd/t/{trackingId}',
    sampleTrackingId: 'SF84920194',
    enabled: true
  },
  {
    code: 'pathao',
    name: 'Pathao Courier',
    bengaliName: 'পাঠাও কুরিয়ার',
    officialDomains: ['pathao.com', 'merchant.pathao.com', 'delivery.pathao.com'],
    trackingUrlTemplate: 'https://merchant.pathao.com/tracking?consignment_id={trackingId}',
    sampleTrackingId: 'PT8892011',
    enabled: true
  },
  {
    code: 'redx',
    name: 'RedX Delivery',
    bengaliName: 'রেডএক্স ডেলিভারি',
    officialDomains: ['redx.com.bd', 'www.redx.com.bd'],
    trackingUrlTemplate: 'https://redx.com.bd/track-order/{trackingId}',
    sampleTrackingId: 'REDX-998822',
    enabled: true
  },
  {
    code: 'paperfly',
    name: 'Paperfly',
    bengaliName: 'পেপারফ্লাই',
    officialDomains: ['paperfly.com.bd', 'go.paperfly.com.bd'],
    trackingUrlTemplate: 'https://paperfly.com.bd/tracking?id={trackingId}',
    sampleTrackingId: 'PFLY-554433',
    enabled: true
  },
  {
    code: 'ecourier',
    name: 'eCourier',
    bengaliName: 'ই-কুরিয়ার',
    officialDomains: ['ecourier.com.bd', 'www.ecourier.com.bd'],
    trackingUrlTemplate: 'https://ecourier.com.bd/track?ref={trackingId}',
    sampleTrackingId: 'EC9028114',
    enabled: true
  },
  {
    code: 'carrybee',
    name: 'Carrybee',
    bengaliName: 'ক্যারিবি',
    officialDomains: ['carrybee.com.bd', 'carrybee.com'],
    trackingUrlTemplate: 'https://carrybee.com.bd/tracking/{trackingId}',
    sampleTrackingId: 'CB771822',
    enabled: true
  },
  {
    code: 'deliverytiger',
    name: 'Delivery Tiger',
    bengaliName: 'ডেলিভারি টাইগার',
    officialDomains: ['deliverytiger.com.bd', 'www.deliverytiger.com.bd'],
    trackingUrlTemplate: 'https://deliverytiger.com.bd/track/{trackingId}',
    sampleTrackingId: 'DT-449120',
    enabled: true
  },
  {
    code: 'sundarban',
    name: 'Sundarban Courier Service',
    bengaliName: 'সুন্দরবন কুরিয়ার সার্ভিস',
    officialDomains: ['sundarbancourierltd.com', 'www.sundarbancourierltd.com'],
    trackingUrlTemplate: 'https://sundarbancourierltd.com/track/{trackingId}',
    sampleTrackingId: 'SB839201',
    enabled: true
  },
  {
    code: 'saparibahan',
    name: 'SA Paribahan',
    bengaliName: 'এস এ পরিবহন',
    officialDomains: ['saparibahanltd.com', 'saparibahan.com'],
    trackingUrlTemplate: 'https://saparibahanltd.com/tracking/{trackingId}',
    sampleTrackingId: 'SA559910',
    enabled: true
  },
  {
    code: 'janani',
    name: 'Janani Express',
    bengaliName: 'জননী এক্সপ্রেস পার্সেল',
    officialDomains: ['jananiexpress.com', 'jananiexpressparcel.com'],
    trackingUrlTemplate: 'https://jananiexpress.com/tracking/{trackingId}',
    sampleTrackingId: 'JN667722',
    enabled: true
  }
];

export async function fetchApprovedCouriers(): Promise<ApprovedCourier[]> {
  try {
    const res = await fetch('/api/courier/approved-list');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.couriers?.length) {
        return data.couriers;
      }
    }
  } catch (err) {
    console.warn('Failed to load couriers from backend, using fallback:', err);
  }
  return FALLBACK_APPROVED_COURIERS;
}

export async function validateCourierDomain(
  courierName: string,
  trackingUrl?: string
): Promise<{
  success: boolean;
  isApprovedCourier: boolean;
  domainValid: boolean;
  domain?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/courier/validate-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courierName, trackingUrl })
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      isApprovedCourier: false,
      domainValid: false,
      error: err.message || 'Validation request failed'
    };
  }
}

export async function verifyTrackingWithAi(params: {
  courierName: string;
  trackingId: string;
  trackingUrl?: string;
  order: any;
  vendorId?: string;
}): Promise<{
  success: boolean;
  record: CourierVerificationRecord;
  error?: string;
}> {
  const res = await fetch('/api/courier/verify-tracking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Courier verification request failed');
  }

  return await res.json();
}

export async function syncCourierTrackingStatus(orderId: string): Promise<{
  success: boolean;
  orderId: string;
  previousStatus: string;
  newStatus: string;
  courier: string;
  trackingId: string;
  message: string;
  updated?: boolean;
}> {
  const res = await fetch('/api/courier/sync-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId })
  });
  return await res.json();
}

export const syncCourierStatus = syncCourierTrackingStatus;

export async function fetchVerificationLogs(orderId?: string): Promise<CourierVerificationRecord[]> {
  try {
    const url = orderId ? `/api/courier/verifications?orderId=${encodeURIComponent(orderId)}` : '/api/courier/verifications';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return data.records || [];
    }
  } catch (err) {
    console.error('Failed to fetch verification logs:', err);
  }
  return [];
}

export async function submitAdminReviewAction(params: {
  verificationId?: string;
  orderId: string;
  action: 'approve' | 'reject';
  notes?: string;
  adminName?: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/courier/admin-review-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return await res.json();
}
