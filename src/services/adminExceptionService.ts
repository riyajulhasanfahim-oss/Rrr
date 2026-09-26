import { rtdbGet, rtdbList, rtdbUpdate, rtdbPush } from '../lib/rtdb';
import { releaseVendorPayout, refundCustomerDispute, rejectCustomerDisputeAndRelease } from './vendorPayoutService';

export type ExceptionType = 
  | 'unaccepted_order'
  | 'delayed_shipping'
  | 'missing_tracking'
  | 'delivery_failed'
  | 'customer_dispute'
  | 'refund_pending'
  | 'suspicious_order'
  | 'payout_stuck';

export interface OrderException {
  id: string;
  type: ExceptionType;
  severity: 'high' | 'medium' | 'low';
  title: string;
  titleBn: string;
  description: string;
  descriptionBn: string;
  suggestedAction: string;
  detectedAt: number;
}

export interface AttentionOrder {
  order: any;
  exceptions: OrderException[];
  primaryException: OrderException;
  vendorDetails?: {
    id?: string;
    name?: string;
    shopName?: string;
    phone?: string;
    email?: string;
    walletBalance?: number;
  };
}

export interface ExceptionSummaryCounts {
  total: number;
  unaccepted_order: number;
  delayed_shipping: number;
  missing_tracking: number;
  delivery_failed: number;
  customer_dispute: number;
  refund_pending: number;
  suspicious_order: number;
  payout_stuck: number;
}

// Configurable threshold constants
const UNACCEPTED_THRESHOLD_HOURS = 12; // Flag if pending for > 12h
const DELAYED_SHIPPING_THRESHOLD_HOURS = 36; // Flag if accepted but not shipped for > 36h
const HIGH_VALUE_COD_THRESHOLD = 8000; // Flag COD orders > ৳8,000 as high risk

/**
 * Analyzes a single order and detects any operational issues or exceptions
 */
export function analyzeOrderExceptions(order: any, now = Date.now()): OrderException[] {
  if (!order) return [];

  const exceptions: OrderException[] = [];
  const status = (order.status || 'Pending').toLowerCase();
  const paymentStatus = (order.paymentStatus || '').toLowerCase();
  const payoutStatus = (order.vendorPayoutStatus || '').toLowerCase();
  
  // Parse order timestamps
  let createdAtMs = now;
  if (typeof order.createdAt === 'number') {
    createdAtMs = order.createdAt;
  } else if (order.createdAt?.toDate) {
    createdAtMs = order.createdAt.toDate().getTime();
  } else if (typeof order.createdAt === 'string') {
    createdAtMs = new Date(order.createdAt).getTime() || now;
  }
  
  const ageHours = (now - createdAtMs) / (1000 * 60 * 60);

  // 1. Customer Dispute Raised
  const isDisputed = 
    status === 'dispute' || 
    status === 'disputed' || 
    payoutStatus === 'disputed' || 
    (order.dispute && (order.dispute.status === 'Open' || order.dispute.status === 'Under Review'));

  if (isDisputed) {
    exceptions.push({
      id: `${order.id}-dispute`,
      type: 'customer_dispute',
      severity: 'high',
      title: 'Customer Dispute / Complaint',
      titleBn: 'কাস্টমার অভিযোগ / ডিসপুট করেছেন',
      description: `Customer submitted a formal dispute: "${order.dispute?.reason || 'Issue reported'}". Vendor payout is frozen.`,
      descriptionBn: `গ্রাহক অভিযোগ জানিয়েছেন: "${order.dispute?.reason || 'সমস্যা হয়েছে'}"। ভেন্ডর পেআউট হোল্ডে রয়েছে।`,
      suggestedAction: 'Review customer proof & vendor statement, then approve refund or release payout',
      detectedAt: order.dispute?.createdAt || now
    });
  }

  // 2. Refund Pending / Requested
  const isRefundPending = 
    paymentStatus === 'refund requested' || 
    paymentStatus === 'refund pending' || 
    order.refundRequested === true || 
    order.refundStatus === 'Pending';

  if (isRefundPending && !isDisputed) {
    exceptions.push({
      id: `${order.id}-refund`,
      type: 'refund_pending',
      severity: 'high',
      title: 'Refund Request Pending',
      titleBn: 'রিফান্ড রিকোয়েস্ট পেন্ডিং',
      description: `Customer requested a refund of ৳${order.total || 0}. Administrative review required.`,
      descriptionBn: `কাস্টমার ৳${order.total || 0} টাকা রিফান্ড চেয়েছেন। অ্যাডমিন রিভিউ প্রয়োজন।`,
      suggestedAction: 'Review payment gateway records and process customer refund',
      detectedAt: now
    });
  }

  // 3. Delivery Failed or Returned / Courier Issues
  const isDeliveryFailed = 
    status === 'failed' || 
    status === 'returned' || 
    status === 'return in transit' || 
    status === 'delivery failed' ||
    (order.trackingNote && order.trackingNote.toLowerCase().includes('fail'));

  if (isDeliveryFailed) {
    exceptions.push({
      id: `${order.id}-delivery-fail`,
      type: 'delivery_failed',
      severity: 'high',
      title: 'Delivery Failed / Parcel Returned',
      titleBn: 'ডেলিভারি ফেইল্ড বা পার্সেল রিটার্ন হয়েছে',
      description: `Courier reported delivery failure or customer return. Status is "${order.status}".`,
      descriptionBn: `কুরিয়ার ডেলিভারি ব্যর্থ বা রিটার্ন রিপোর্ট করেছে। বর্তমান স্ট্যাটাস "${order.status}"।`,
      suggestedAction: 'Check courier return tracking, communicate with customer & update stock',
      detectedAt: now
    });
  }

  // 4. Missing Tracking Information for Shipped Orders
  const isShipped = status === 'shipped' || status === 'in transit' || status === 'out for delivery';
  const hasNoTracking = !order.trackingNumber && !order.consignmentId && !order.trackingId && !order.courierTrackingId;
  const hasNoCourier = !order.courierName && !order.courier && !order.deliveryService;

  if (isShipped && (hasNoTracking || hasNoCourier)) {
    exceptions.push({
      id: `${order.id}-missing-tracking`,
      type: 'missing_tracking',
      severity: 'medium',
      title: 'Missing Courier / Tracking Info',
      titleBn: 'ট্র্যাকিং নম্বর বা কুরিয়ার তথ্য দেওয়া হয়নি',
      description: `Order marked as "${order.status}", but no tracking number or courier provider is attached.`,
      descriptionBn: `অর্ডারটি "${order.status}" করা হয়েছে কিন্তু কোনো ট্র্যাকিং নম্বর বা কুরিয়ার নাম যুক্ত নেই।`,
      suggestedAction: 'Nudge vendor to provide consignment tracking or manually assign courier',
      detectedAt: now
    });
  }

  // 5. Vendor Unaccepted Order (Pending acceptance beyond threshold)
  const isUnaccepted = status === 'pending' || status === 'awaiting acceptance' || status === 'vendor review';
  if (isUnaccepted && ageHours >= UNACCEPTED_THRESHOLD_HOURS) {
    exceptions.push({
      id: `${order.id}-unaccepted`,
      type: 'unaccepted_order',
      severity: ageHours >= 24 ? 'high' : 'medium',
      title: `Unaccepted by Vendor (${Math.round(ageHours)}h delayed)`,
      titleBn: `ভেন্ডর অর্ডার গ্রহণ করেনি (${Math.round(ageHours)} ঘণ্টা অতিবাহিত)`,
      description: `Order placed ${Math.round(ageHours)} hours ago has not been accepted by the assigned vendor.`,
      descriptionBn: `অর্ডারটি দেওয়ার ${Math.round(ageHours)} ঘণ্টা পেরিয়ে গেলেও ভেন্ডর এটি এক্সেপ্ট করেনি।`,
      suggestedAction: 'Send urgent vendor reminder or reassign to another verified seller',
      detectedAt: createdAtMs
    });
  }

  // 6. Delayed Shipping / SLA Breach (Accepted but not shipped)
  const isProcessing = status === 'accepted' || status === 'processing' || status === 'ready to ship' || status === 'confirmed';
  if (isProcessing && ageHours >= DELAYED_SHIPPING_THRESHOLD_HOURS) {
    exceptions.push({
      id: `${order.id}-delayed-ship`,
      type: 'delayed_shipping',
      severity: ageHours >= 48 ? 'high' : 'medium',
      title: `Delayed Shipping (${Math.round(ageHours)}h elapsed)`,
      titleBn: `সময়মতো পার্সেল শিপ করা হয়নি (${Math.round(ageHours)} ঘণ্টা অতিবাহিত)`,
      description: `Order was accepted ${Math.round(ageHours)}h ago, but vendor has not handed over the parcel to courier.`,
      descriptionBn: `অর্ডারটি ${Math.round(ageHours)} ঘণ্টা আগে এক্সেপ্ট হলেও ভেন্ডর এখনো পার্সেল কুরিয়ারে হস্তান্তর করেনি।`,
      suggestedAction: 'Contact vendor for immediate dispatch or generate courier pickup request',
      detectedAt: createdAtMs
    });
  }

  // 7. Suspicious or High-Risk Unusual Orders
  const isCOD = (order.paymentMethod || '').toLowerCase().includes('cash') || (order.paymentMethod || '').toLowerCase() === 'cod';
  const totalAmount = order.total || order.totalAmount || 0;
  const isHighValueCOD = isCOD && totalAmount >= HIGH_VALUE_COD_THRESHOLD;
  const isFlaggedSuspicious = order.isSuspicious === true || order.flaggedAsSuspicious === true || (order.failedAttempts && order.failedAttempts >= 2);
  const isMissingAddress = !order.shippingAddress?.phone || !order.shippingAddress?.address || order.shippingAddress?.phone?.length < 10;

  if ((isHighValueCOD || isFlaggedSuspicious || isMissingAddress) && status !== 'cancelled' && status !== 'delivered' && status !== 'completed') {
    let reasonText = '';
    let reasonBn = '';
    if (isHighValueCOD) {
      reasonText = `High-value Cash on Delivery (৳${totalAmount.toLocaleString()}). Verification recommended.`;
      reasonBn = `উচ্চ মূল্যের ক্যাশ অন ডেলিভারি (৳${totalAmount.toLocaleString()})। ফোন ভেরিফিকেশন প্রয়োজন।`;
    } else if (isMissingAddress) {
      reasonText = 'Incomplete customer phone or address details.';
      reasonBn = 'গ্রাহকের ফোন নম্বর বা ঠিকানা অসম্পূর্ণ।';
    } else {
      reasonText = 'Flagged as unusual order pattern / multiple payment failures.';
      reasonBn = 'সন্দেহজনক অর্ডার প্যাটার্ন বা পেমেন্ট ফেইল্ড সতর্কতা।';
    }

    exceptions.push({
      id: `${order.id}-suspicious`,
      type: 'suspicious_order',
      severity: isHighValueCOD && totalAmount > 15000 ? 'high' : 'medium',
      title: 'Suspicious / High-Risk Order',
      titleBn: 'সন্দেহজনক বা হাই-রিস্ক অর্ডার',
      description: reasonText,
      descriptionBn: reasonBn,
      suggestedAction: 'Verify customer via phone call before vendor confirms dispatch',
      detectedAt: now
    });
  }

  // 8. Payout Stuck / Frozen past 72h protection window
  const isDelivered = status === 'delivered' || status === 'completed';
  if (isDelivered) {
    let deliveredAtMs = order.deliveredAt;
    if (!deliveredAtMs && order.updatedAt) deliveredAtMs = order.updatedAt;
    if (!deliveredAtMs && createdAtMs) deliveredAtMs = createdAtMs + 86400000;

    const timeSinceDeliveryHours = (now - (deliveredAtMs || now)) / (1000 * 60 * 60);
    const payoutNotReleased = payoutStatus !== 'released' && payoutStatus !== 'refunded';

    // If delivered for over 72 hours and not disputed, but payout is stuck in 'Held', 'Pending', or error
    if (timeSinceDeliveryHours > 72 && payoutNotReleased && !isDisputed) {
      exceptions.push({
        id: `${order.id}-payout-stuck`,
        type: 'payout_stuck',
        severity: 'medium',
        title: 'Payout Release Stuck / Pending',
        titleBn: 'পেমেন্ট রিলিজ আটকে আছে',
        description: `Delivered ${Math.round(timeSinceDeliveryHours)}h ago (past 72h protection window), but vendor payout of ৳${order.vendorPayoutAmount || order.total || 0} is still "${order.vendorPayoutStatus || 'Held'}".`,
        descriptionBn: `পার্সেল ডেলিভারির ${Math.round(timeSinceDeliveryHours)} ঘণ্টা পেরিয়ে গেলেও ভেন্ডর পেআউট ৳${order.vendorPayoutAmount || order.total || 0} এখনও আটকে আছে।`,
        suggestedAction: 'Trigger automatic release or manually disburse funds to vendor wallet',
        detectedAt: deliveredAtMs || now
      });
    }
  }

  return exceptions;
}

/**
 * Fetches all orders from Realtime Database and aggregates only orders requiring Admin Attention
 */
export async function fetchAllAttentionOrders(): Promise<{
  attentionOrders: AttentionOrder[];
  summaryCounts: ExceptionSummaryCounts;
}> {
  try {
    // 1. Fetch from Realtime Database orders
    const rtdbOrdersSnap = await rtdbList<any>('orders');
    // 2. Fetch from Realtime Database disputes
    const rtdbDisputesSnap = await rtdbList<any>('disputes');

    const ordersMap = new Map<string, any>();
    rtdbOrdersSnap.forEach(item => {
      const o = { id: item.id, ...item.data };
      ordersMap.set(o.orderId || o.id, o);
    });

    rtdbDisputesSnap.forEach(dispItem => {
      const d = dispItem.data || {};
      const key = d.orderId || dispItem.id || d.id;
      if (ordersMap.has(key)) {
        const existing = ordersMap.get(key);
        ordersMap.set(key, {
          ...existing,
          ...d,
          dispute: {
            ...(existing.dispute || {}),
            ...(d.dispute || {})
          }
        });
      } else {
        ordersMap.set(key, {
          id: dispItem.id,
          orderId: d.orderId || dispItem.id,
          ...d
        });
      }
    });

    const allOrders = Array.from(ordersMap.values());
    const now = Date.now();

    const attentionList: AttentionOrder[] = [];
    const counts: ExceptionSummaryCounts = {
      total: 0,
      unaccepted_order: 0,
      delayed_shipping: 0,
      missing_tracking: 0,
      delivery_failed: 0,
      customer_dispute: 0,
      refund_pending: 0,
      suspicious_order: 0,
      payout_stuck: 0,
    };

    // Cache of vendor user docs
    const vendorCache: Record<string, any> = {};

    for (const order of allOrders) {
      // Ignored completed clean orders
      const exceptions = analyzeOrderExceptions(order, now);

      if (exceptions.length > 0) {
        // Determine primary highest-severity exception
        const primary = exceptions.sort((a, b) => {
          const rank = { high: 3, medium: 2, low: 1 };
          return rank[b.severity] - rank[a.severity];
        })[0];

        // Increment counts
        exceptions.forEach(ex => {
          if (counts[ex.type] !== undefined) {
            counts[ex.type]++;
          }
        });
        counts.total++;

        // Try extracting vendor info
        const vendorId = order.vendorId || order.items?.[0]?.vendorId;
        let vendorInfo: any = null;

        if (vendorId) {
          if (vendorCache[vendorId]) {
            vendorInfo = vendorCache[vendorId];
          } else {
            try {
              const uData = await rtdbGet<any>(`users/${vendorId}`) || await rtdbGet<any>(`vendors/${vendorId}`);
              if (uData) {
                vendorInfo = {
                  id: vendorId,
                  name: uData.name || uData.displayName || 'Vendor',
                  shopName: uData.shopName || uData.storeName || uData.businessName || 'Store',
                  phone: uData.phone || uData.phoneNumber,
                  email: uData.email,
                };
                vendorCache[vendorId] = vendorInfo;
              }
            } catch (err) {
              // ignore
            }
          }
        }

        attentionList.push({
          order,
          exceptions,
          primaryException: primary,
          vendorDetails: vendorInfo || {
            id: vendorId,
            name: order.vendorName || order.items?.[0]?.vendorName || 'Assigned Vendor',
            shopName: order.vendorShopName || 'Vendor Store',
          }
        });
      }
    }

    // Sort by highest severity first
    attentionList.sort((a, b) => {
      const rank = { high: 3, medium: 2, low: 1 };
      const diff = rank[b.primaryException.severity] - rank[a.primaryException.severity];
      if (diff !== 0) return diff;
      return (b.order.createdAt || 0) - (a.order.createdAt || 0);
    });

    return {
      attentionOrders: attentionList,
      summaryCounts: counts
    };
  } catch (error) {
    console.error('Error fetching attention orders from RTDB:', error);
    return {
      attentionOrders: [],
      summaryCounts: {
        total: 0,
        unaccepted_order: 0,
        delayed_shipping: 0,
        missing_tracking: 0,
        delivery_failed: 0,
        customer_dispute: 0,
        refund_pending: 0,
        suspicious_order: 0,
        payout_stuck: 0,
      }
    };
  }
}

/**
 * Sends an urgent vendor reminder / nudge for a problematic order
 */
export async function nudgeVendorForOrder(
  orderId: string, 
  vendorId: string, 
  reason: string, 
  adminUser?: any
): Promise<{ success: boolean; message: string }> {
  try {
    const mainOrderId = orderId;
    
    // Add note to order in RTDB
    await rtdbPush('orderNotes', {
      orderId: mainOrderId,
      note: `🔔 Admin Nudge to Vendor: "${reason}"`,
      addedBy: adminUser?.name || 'Admin Support',
      addedById: adminUser?.uid,
      createdAt: Date.now()
    });

    // Create a notification for the vendor in RTDB
    if (vendorId) {
      await rtdbPush(`notifications/${vendorId}`, {
        userId: vendorId,
        title: '⚠️ Urgent Order Attention Required',
        message: `Admin sent a priority reminder regarding Order #${orderId.substring(0, 8)}: ${reason}`,
        type: 'warning',
        orderId: mainOrderId,
        read: false,
        createdAt: Date.now()
      });
    }

    return { success: true, message: 'Urgent reminder notification sent to vendor.' };
  } catch (error: any) {
    console.error('Error sending vendor nudge in RTDB:', error);
    return { success: false, message: error?.message || 'Failed to send vendor reminder' };
  }
}

/**
 * Assigns or updates courier tracking for an order
 */
export async function assignOrderTracking(
  orderId: string,
  courierName: string,
  trackingNumber: string,
  adminUser?: any
): Promise<{ success: boolean; message: string }> {
  try {
    const payload = {
      courierName: courierName.trim(),
      courier: courierName.trim(),
      trackingNumber: trackingNumber.trim(),
      consignmentId: trackingNumber.trim(),
      status: 'Shipped',
      shippedAt: Date.now(),
      updatedAt: Date.now()
    };

    await rtdbUpdate(`orders/${orderId}`, payload);

    try {
      await rtdbUpdate(`vendor_orders/${orderId}`, payload);
    } catch (e) {
      // ignore
    }

    await rtdbPush('orderNotes', {
      orderId,
      note: `📦 Courier Tracking Assigned by Admin: Courier: ${courierName}, Tracking ID: ${trackingNumber}`,
      addedBy: adminUser?.name || 'Admin',
      addedById: adminUser?.uid,
      createdAt: Date.now()
    });

    return { success: true, message: 'Courier and tracking number updated successfully!' };
  } catch (error: any) {
    console.error('Error assigning tracking in RTDB:', error);
    return { success: false, message: error?.message || 'Failed to update tracking' };
  }
}

/**
 * Puts vendor payout on administrative hold
 */
export async function freezePayoutAdmin(
  orderId: string,
  reason: string,
  adminUser?: any
): Promise<{ success: boolean; message: string }> {
  try {
    const payload = {
      vendorPayoutStatus: 'Disputed',
      payoutFrozen: true,
      payoutFrozenReason: reason,
      updatedAt: Date.now()
    };

    await rtdbUpdate(`orders/${orderId}`, payload);

    try {
      await rtdbUpdate(`vendor_orders/${orderId}`, payload);
    } catch (_) {}

    await rtdbPush('orderNotes', {
      orderId,
      note: `🛑 Vendor Payout Placed on Administrative HOLD: ${reason}`,
      addedBy: adminUser?.name || 'Admin',
      addedById: adminUser?.uid,
      createdAt: Date.now()
    });

    return { success: true, message: 'Vendor payout placed on administrative hold.' };
  } catch (error: any) {
    console.error('Error freezing payout in RTDB:', error);
    return { success: false, message: error?.message || 'Failed to freeze payout' };
  }
}
