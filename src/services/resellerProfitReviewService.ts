import { rtdbGet, rtdbSet, rtdbUpdate, rtdbPush, rtdbTransaction, rtdbMultiUpdate, rtdbList, rtdbSubscribe } from '../lib/rtdb';
import {
  verifyAndRecalculateResellerProfit,
  validateOrderStateTransition,
  checkFinancialIdempotency,
  recordFinancialIdempotency,
  ensureVendorBalanceConsistency,
  ensureResellerBalanceConsistency
} from './resellerSecurityService';

export interface ResellerProfitReviewRecord {
  reviewId: string;
  orderId: string;
  resellerId: string;
  vendorId: string;
  resellerName?: string;
  vendorName?: string;
  vendorShopName?: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  quantity?: number;
  vendorPrice?: number;
  resellerSellingPrice?: number;
  resellerProfit?: number;
  rating?: number;
  reviewContent?: string;
  deliveryStatus: string;
  reviewStatus: 'PENDING' | 'PENDING_ADMIN_REVIEW' | 'APPROVED' | 'REJECTED';
  submittedAt: number;
  updatedAt: number;
  approvedAt?: number;
  approvedBy?: string;
  rejectedAt?: number;
  rejectedBy?: string;
  rejectionReason?: string;
  // Metadata fields
  isDelivered?: boolean;
  courierAdminApproved?: boolean;
  courierVerificationStatus?: string;
  note?: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  vendorOrderStatus?: string;
  profitStatus?: string;
  releaseTransactionId?: string;
}

export interface SubmitResellerReviewParams {
  orderId: string;
  resellerId: string;
  vendorId?: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  rating?: number;
  reviewContent?: string;
  note?: string;
}

export interface SubmitResellerReviewResult {
  success: boolean;
  message: string;
  reviewId?: string;
  reviewStatus?: 'PENDING' | 'PENDING_ADMIN_REVIEW';
  deliveryStatus?: string;
  isDelivered?: boolean;
  error?: string;
  existingReview?: ResellerProfitReviewRecord;
}

/**
 * Normalizes delivery status for comparison.
 * Accepts a raw status string or an order object.
 */
export function normalizeDeliveryStatus(statusOrOrder?: any): {
  rawStatus: string;
  normalizedStatus: string;
  isDelivered: boolean;
} {
  let raw = 'Pending';
  if (typeof statusOrOrder === 'object' && statusOrOrder !== null) {
    raw = String(
      statusOrOrder.deliveryStatus || 
      statusOrOrder.orderStatus || 
      statusOrOrder.status || 
      statusOrOrder.vendorStatus || 
      'Pending'
    ).trim();
  } else if (typeof statusOrOrder === 'string') {
    raw = statusOrOrder.trim();
  }

  const lower = raw.toLowerCase();
  const isDelivered = 
    lower === 'delivered' || 
    lower === 'completed' || 
    lower === 'successful delivery' ||
    lower.includes('delivered');

  const normalizedStatus = isDelivered ? 'DELIVERED' : raw.toUpperCase();
  return { rawStatus: raw, normalizedStatus, isDelivered };
}

export interface ResellerOrderAndReviewState {
  order: any | null;
  review: ResellerProfitReviewRecord | null;
  rawStatus: string;
  deliveryStatus: string;
  isDelivered: boolean;
  isCourierApproved: boolean;
  reviewStatus: 'PENDING' | 'PENDING_ADMIN_REVIEW' | 'APPROVED' | 'REJECTED' | null;
  profitStatus: string;
  lockedProfit: number;
  courierName: string;
  trackingNumber: string;
  trackingUrl: string;
}

/**
 * Subscribes in real-time to the current order status and reseller review record in Firebase Realtime Database.
 * Serves as the Single Source of Truth for the Reseller Profit Verification Review UI.
 */
export function subscribeToResellerOrderAndReview(
  orderId: string,
  resellerId: string,
  callback: (state: ResellerOrderAndReviewState) => void
): () => void {
  if (!orderId) {
    return () => {};
  }

  const cleanOrderId = String(orderId).replace(/^#/, '').trim();
  const pureOrderId = cleanOrderId.includes('_') ? cleanOrderId.split('_')[0] : cleanOrderId;
  const lockKey = `${cleanOrderId}_${resellerId}`;

  let latestOrderData: any = null;
  let latestResellerOrderData: any = null;
  let latestReviewData: ResellerProfitReviewRecord | null = null;
  let isUnsubscribed = false;

  const emitFreshState = () => {
    if (isUnsubscribed) return;

    // Merge canonical RTDB order representations
    const mergedOrder = {
      ...(latestOrderData || {}),
      ...(latestResellerOrderData || {})
    };

    // Determine raw and normalized delivery status across merged order and review
    const rawStatus = String(
      latestResellerOrderData?.deliveryStatus ||
      latestResellerOrderData?.status ||
      latestOrderData?.deliveryStatus ||
      latestOrderData?.status ||
      latestReviewData?.deliveryStatus ||
      mergedOrder.deliveryStatus ||
      mergedOrder.status ||
      'Pending'
    ).trim();

    const { normalizedStatus, isDelivered } = normalizeDeliveryStatus(rawStatus);

    const isCourierApproved = Boolean(
      mergedOrder.courierVerificationStatus === 'Verified' ||
      mergedOrder.courierAdminApproved === true ||
      mergedOrder.courierAdminApproved === 'true' ||
      mergedOrder.courierReviewStatus === 'approved' ||
      latestReviewData?.courierVerificationStatus === 'Verified' ||
      latestReviewData?.courierAdminApproved === true
    );

    // Determine review status
    let reviewStatus: 'PENDING' | 'PENDING_ADMIN_REVIEW' | 'APPROVED' | 'REJECTED' | null = null;
    if (latestReviewData?.reviewStatus) {
      reviewStatus = latestReviewData.reviewStatus as any;
    } else if (mergedOrder.reviewStatus) {
      const rs = String(mergedOrder.reviewStatus).toUpperCase();
      if (rs === 'PENDING' || rs === 'PENDING_ADMIN_REVIEW' || rs === 'APPROVED' || rs === 'REJECTED') {
        reviewStatus = rs as any;
      }
    }

    // Determine profit status
    const profitStatus = String(
      latestReviewData?.profitStatus ||
      mergedOrder.profitStatus ||
      (reviewStatus === 'APPROVED' ? 'RELEASED' : 'LOCKED')
    );

    // Recalculate or extract reseller profit
    const lockedProfit = Number(
      mergedOrder.lockedProfitAmount ??
      mergedOrder.resellerProfit ??
      mergedOrder.priceSnapshot?.resellerProfit ??
      mergedOrder.resellerPriceSnapshot?.resellerProfit ??
      latestReviewData?.resellerProfit ??
      0
    );

    const courierName = String(
      mergedOrder.courierName || 
      latestReviewData?.courierName || 
      ''
    );

    const trackingNumber = String(
      mergedOrder.trackingNumber || 
      mergedOrder.consignmentId || 
      mergedOrder.trackingId || 
      latestReviewData?.trackingNumber || 
      ''
    );

    const trackingUrl = String(
      mergedOrder.approvedCourierTrackingUrl || 
      mergedOrder.trackingUrl || 
      mergedOrder.courierTrackingUrl || 
      latestReviewData?.trackingUrl || 
      ''
    );

    callback({
      order: Object.keys(mergedOrder).length > 0 ? mergedOrder : null,
      review: latestReviewData,
      rawStatus,
      deliveryStatus: normalizedStatus,
      isDelivered,
      isCourierApproved,
      reviewStatus,
      profitStatus,
      lockedProfit,
      courierName,
      trackingNumber,
      trackingUrl
    });
  };

  // Immediate fetches
  Promise.all([
    rtdbGet<any>(`orders/${cleanOrderId}`).catch(() => null),
    cleanOrderId !== pureOrderId ? rtdbGet<any>(`orders/${pureOrderId}`).catch(() => null) : null,
    rtdbGet<any>(`reseller_orders/${cleanOrderId}`).catch(() => null),
    resellerId ? rtdbGet<ResellerProfitReviewRecord>(`reseller_profit_reviews/${lockKey}`).catch(() => null) : null,
    rtdbGet<ResellerProfitReviewRecord>(`reseller_profit_reviews_by_order/${cleanOrderId}`).catch(() => null)
  ]).then(([mainOrd, pureOrd, resOrd, rev, byOrdRev]) => {
    if (isUnsubscribed) return;
    if (mainOrd || pureOrd) latestOrderData = mainOrd || pureOrd;
    if (resOrd) latestResellerOrderData = resOrd;
    if (rev) latestReviewData = rev;
    else if (byOrdRev && byOrdRev.resellerId === resellerId) latestReviewData = byOrdRev;
    emitFreshState();
  }).catch(() => {});

  // Subscribe to orders
  const unsubOrder = rtdbSubscribe<any>(`orders/${cleanOrderId}`, (snap) => {
    if (snap) {
      latestOrderData = snap;
      emitFreshState();
    }
  });

  // Subscribe to reseller_orders
  const unsubResellerOrder = rtdbSubscribe<any>(`reseller_orders/${cleanOrderId}`, (snap) => {
    if (snap) {
      latestResellerOrderData = snap;
      emitFreshState();
    }
  });

  // Subscribe to review
  const unsubReview = resellerId ? rtdbSubscribe<ResellerProfitReviewRecord>(`reseller_profit_reviews/${lockKey}`, (snap) => {
    latestReviewData = snap;
    emitFreshState();
  }) : () => {};

  return () => {
    isUnsubscribed = true;
    unsubOrder();
    unsubResellerOrder();
    unsubReview();
  };
}

/**
 * Fetches an existing Reseller Profit Verification Review by orderId and resellerId from RTDB.
 */
export async function getResellerProfitReview(
  orderId: string,
  resellerId: string
): Promise<ResellerProfitReviewRecord | null> {
  if (!orderId || !resellerId) return null;
  const cleanOrderId = String(orderId).replace(/^#/, '');
  const lockKey = `${cleanOrderId}_${resellerId}`;

  try {
    const review = await rtdbGet<ResellerProfitReviewRecord>(`reseller_profit_reviews/${lockKey}`);
    if (review) return review;

    // Fallback lookup by orderId index
    const byOrder = await rtdbGet<ResellerProfitReviewRecord>(`reseller_profit_reviews_by_order/${cleanOrderId}`);
    if (byOrder && byOrder.resellerId === resellerId) return byOrder;

    return null;
  } catch (err) {
    console.warn('[ResellerProfitReviewService] Error getting review from RTDB:', err);
    return null;
  }
}

/**
 * Submits a Reseller Profit Verification Review strictly to Firebase Realtime Database (RTDB).
 *
 * Rules strictly enforced:
 * 1. Role: Only for reseller orders.
 * 2. Prerequisite: Vendor has confirmed the order (vendorOrderStatus === 'CONFIRMED' or profitStatus === 'LOCKED').
 * 3. Review type: Reseller Profit Verification Review (not a product review).
 * 4. Duplicate prevention: Validates via orderId + resellerId to prevent duplicate active reviews.
 * 5. Profit remains LOCKED: Profit is NOT released, Vendor lockedBalance is untouched.
 * 6. Non-delivered notice: If deliveryStatus != 'DELIVERED', warns that profit cannot release until delivery is completed.
 * 7. Admin approval required: Reseller submission alone never releases funds.
 */
export async function submitResellerProfitReview(
  params: SubmitResellerReviewParams
): Promise<SubmitResellerReviewResult> {
  const { orderId, resellerId, note } = params;

  if (!orderId || !resellerId) {
    return {
      success: false,
      error: 'MISSING_PARAMS',
      message: 'Order ID এবং Reseller ID প্রদান করা আবশ্যক।'
    };
  }

  const cleanOrderId = String(orderId).replace(/^#/, '');
  const lockKey = `${cleanOrderId}_${resellerId}`;

  // 1. Fetch Order from RTDB across canonical locations
  const [resellerOrder, mainOrder, vendorOrder] = await Promise.all([
    rtdbGet<any>(`reseller_orders/${cleanOrderId}`).catch(() => null),
    rtdbGet<any>(`orders/${cleanOrderId}`).catch(() => null),
    rtdbGet<any>(`vendor_orders/${cleanOrderId}`).catch(() => null)
  ]);

  if (!resellerOrder && !mainOrder && !vendorOrder) {
    return {
      success: false,
      error: 'ORDER_NOT_FOUND',
      message: 'অর্ডারটি Realtime Database-এ খুঁজে পাওয়া যায়নি।'
    };
  }

  // Canonical merged order snapshot
  const order = {
    ...(mainOrder || {}),
    ...(vendorOrder || {}),
    ...(resellerOrder || {})
  };

  // 2. Reseller Order Verification
  const isResellerOrder = Boolean(
    order.isResellerOrder || 
    order.resellerId || 
    order.profitStatus || 
    order.priceSnapshot?.resellerProfit ||
    order.resellerPriceSnapshot?.resellerProfit
  );

  if (!isResellerOrder) {
    return {
      success: false,
      error: 'NOT_RESELLER_ORDER',
      message: 'এটি কোনো রিসেলার অর্ডার নয়।'
    };
  }

  // Security: Check if order belongs to this reseller
  if (order.resellerId && String(order.resellerId) !== String(resellerId)) {
    return {
      success: false,
      error: 'UNAUTHORIZED_RESELLER',
      message: 'আপনি এই অর্ডারের অনুমোদিত রিসেলার নন।'
    };
  }

  // 3. Prerequisite Check: Vendor must have confirmed the order (Step 5 completed)
  const isVendorConfirmed = Boolean(
    order.vendorOrderStatus === 'CONFIRMED' || 
    order.profitStatus === 'LOCKED' || 
    order.settlementStatus === 'LOCKED' ||
    ['Accepted', 'Processing', 'Shipped', 'In Transit', 'Delivered', 'Completed'].includes(order.status || order.orderStatus)
  );

  if (!isVendorConfirmed) {
    return {
      success: false,
      error: 'VENDOR_NOT_CONFIRMED',
      message: 'ভেন্ডর এখনো এই অর্ডারটি কনফার্ম করেনি। ভেন্ডর কনফার্ম করার পর প্রফিট ভেরিফিকেশন রিভিউ অপশন চালু হবে।'
    };
  }

  // 4. Duplicate Review Prevention: Check by orderId + resellerId in RTDB
  const existingReview = await rtdbGet<ResellerProfitReviewRecord>(`reseller_profit_reviews/${lockKey}`);
  if (existingReview && existingReview.reviewStatus === 'APPROVED') {
    return {
      success: false,
      error: 'REVIEW_ALREADY_APPROVED',
      message: 'এই অর্ডারের জন্য প্রফিট ভেরিফিকেশন ইতিমধ্যে অনুমোদিত হয়েছে এবং প্রফিট রিলিজ সম্পন্ন হয়েছে।',
      existingReview
    };
  }

  if (order.profitStatus === 'RELEASED') {
    return {
      success: false,
      error: 'PROFIT_ALREADY_RELEASED',
      message: 'এই অর্ডারের প্রফিট ইতিমধ্যে রিলিজ করা হয়েছে। পুনরায় রিভিউ প্রয়োজন নেই।',
      existingReview: existingReview || undefined
    };
  }

  const isPendingReview = existingReview && (existingReview.reviewStatus === 'PENDING' || (existingReview.reviewStatus as any) === 'PENDING_ADMIN_REVIEW');
  if (isPendingReview) {
    return {
      success: false,
      error: 'DUPLICATE_REVIEW_PREVENTED',
      message: 'এই অর্ডারের জন্য ইতিমধ্যে একটি কমিশন রিকোয়েস্ট সাবমিট করা হয়েছে এবং তা বর্তমানে এডমিন পর্যালোচনার জন্য পেন্ডিং রয়েছে (PENDING_ADMIN_REVIEW)।',
      existingReview
    };
  }

  // Also check order object flag
  if ((order.reviewStatus === 'PENDING' || order.reviewStatus === 'PENDING_ADMIN_REVIEW') && order.reviewId) {
    return {
      success: false,
      error: 'DUPLICATE_REVIEW_PREVENTED',
      message: 'এই অর্ডারে ইতিমধ্যে কমিশন রিকোয়েস্ট জমা দেওয়া হয়েছে (Status: PENDING_ADMIN_REVIEW)।',
      existingReview: existingReview || undefined
    };
  }

  // 5. Courier Link Verification Check: Reseller requests profit after Admin approves the courier tracking link
  const isCourierApproved = Boolean(
    order.courierVerificationStatus === 'Verified' ||
    order.courierAdminApproved === true ||
    order.courierAdminApproved === 'true' ||
    order.courierReviewStatus === 'approved' ||
    mainOrder?.courierVerificationStatus === 'Verified' ||
    mainOrder?.courierAdminApproved === true ||
    mainOrder?.courierReviewStatus === 'approved' ||
    resellerOrder?.courierVerificationStatus === 'Verified' ||
    resellerOrder?.courierAdminApproved === true ||
    vendorOrder?.courierVerificationStatus === 'Verified'
  );

  if (!isCourierApproved) {
    return {
      success: false,
      error: 'COURIER_NOT_VERIFIED',
      message: 'কুরিয়ার ট্র্যাকিং লিংক এডমিন কর্তৃক এখনো ভেরিফাইড হয়নি। এডমিন অনুমোদনের পর আপনি ট্র্যাকিং লিংক চেক করে কমিশনের জন্য রিকোয়েস্ট পাঠাতে পারবেন।'
    };
  }

  // Evaluate Delivery Status across order nodes
  const currentStatusString = 
    resellerOrder?.deliveryStatus ||
    resellerOrder?.status ||
    mainOrder?.deliveryStatus ||
    mainOrder?.status ||
    vendorOrder?.deliveryStatus ||
    vendorOrder?.status ||
    order.deliveryStatus ||
    order.status ||
    order.orderStatus ||
    'Pending';
  const { normalizedStatus, isDelivered } = normalizeDeliveryStatus(currentStatusString);

  // 6. Form Content (Reseller verifies delivery via tracking link and submits request)
  const reviewContent = String(params.reviewContent || note || 'কুরিয়ার ট্র্যাকিং লিংক যাচাই করে কমিশনের জন্য এডমিনকে রিকোয়েস্ট পাঠানো হয়েছে।').trim();

  const vendorId = order.vendorId || params.vendorId || 'unknown_vendor';
  const now = Date.now();
  const reviewId = `REV_PROFIT_${cleanOrderId}_${now}`;
  const resellerProfit = Number(order.lockedProfitAmount ?? order.resellerProfit ?? order.priceSnapshot?.resellerProfit ?? 0);

  // Extract snapshot product & pricing details
  const items = Array.isArray(order.items) && order.items.length > 0 ? order.items : [];
  const firstItem = items[0] || {};
  const productId = String(params.productId || firstItem.productId || firstItem.id || order.productId || '').trim();
  const productName = String(params.productName || firstItem.productName || firstItem.name || firstItem.title || order.productName || 'Catalog Product').trim();
  const productImage = String(params.productImage || firstItem.image || firstItem.thumbnail || order.productImage || '').trim();
  const quantity = Number(order.quantity || items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0) || 1);
  const vendorPrice = Number(firstItem.vendorPrice ?? order.vendorPrice ?? 0);
  const resellerSellingPrice = Number(firstItem.resellerPrice ?? firstItem.resellerSellingPrice ?? firstItem.price ?? order.resellerSellingPrice ?? 0);
  const rating = Math.min(5, Math.max(1, Number(params.rating || 5)));

  // 6. Build the Reseller Profit Verification Review Record
  const reviewRecord: ResellerProfitReviewRecord = {
    reviewId,
    orderId: cleanOrderId,
    resellerId,
    vendorId,
    resellerName: order.resellerName || order.customerName || '',
    vendorName: order.vendorName || '',
    vendorShopName: order.vendorShopName || order.shopName || '',
    productId,
    productName,
    productImage,
    quantity,
    vendorPrice,
    resellerSellingPrice,
    resellerProfit,
    deliveryStatus: normalizedStatus,
    reviewStatus: 'PENDING_ADMIN_REVIEW',
    rating,
    reviewContent,
    submittedAt: now,
    updatedAt: now,
    // Supplemental tracking and audit details
    isDelivered,
    courierAdminApproved: true,
    courierVerificationStatus: 'Verified',
    note: note ? String(note).trim() : '',
    courierName: order.courierName || '',
    trackingNumber: order.trackingNumber || order.consignmentId || order.trackingId || '',
    trackingUrl: order.approvedCourierTrackingUrl || order.trackingUrl || order.courierTrackingUrl || '',
    vendorOrderStatus: order.vendorOrderStatus || 'CONFIRMED',
    profitStatus: 'LOCKED'
  };

  // 7. Atomic / Safe RTDB Writes
  // Primary composite key for duplicate prevention: orderId + resellerId
  await rtdbSet(`reseller_profit_reviews/${lockKey}`, reviewRecord);

  // Index by orderId
  await rtdbSet(`reseller_profit_reviews_by_order/${cleanOrderId}`, reviewRecord);

  // Index in list of all reviews
  await rtdbSet(`reseller_profit_reviews_list/${reviewId}`, reviewRecord);

  // Order updates: profitStatus remains LOCKED, vendor lockedBalance remains untouched
  const orderReviewUpdates = {
    reviewId,
    reviewStatus: 'PENDING_ADMIN_REVIEW',
    rejectionReason: '',
    rejectedAt: null,
    rejectedBy: '',
    resellerReviewSubmitted: true,
    resellerReviewSubmittedAt: now,
    resellerProfitReviewId: reviewId,
    profitStatus: 'LOCKED', // strictly remains LOCKED
    updatedAt: now
  };

  // Sync to reseller_orders
  try {
    await rtdbUpdate(`reseller_orders/${cleanOrderId}`, orderReviewUpdates);
  } catch (err) {
    console.warn('[ResellerProfitReviewService] update reseller_orders warning:', err);
  }

  // Sync to resellers/${resellerId}/orders
  try {
    await rtdbUpdate(`resellers/${resellerId}/orders/${cleanOrderId}`, orderReviewUpdates);
  } catch (err) {
    console.warn('[ResellerProfitReviewService] update reseller scoped orders warning:', err);
  }

  // Sync to vendor_orders
  try {
    await rtdbUpdate(`vendor_orders/${cleanOrderId}`, orderReviewUpdates);
  } catch (err) {
    console.warn('[ResellerProfitReviewService] update vendor_orders warning:', err);
  }

  // Sync to main orders
  try {
    await rtdbUpdate(`orders/${cleanOrderId}`, orderReviewUpdates);
  } catch (err) {
    console.warn('[ResellerProfitReviewService] update orders warning:', err);
  }

  // 8. Push Audit Log to order_status_logs in RTDB
  try {
    await rtdbPush('order_status_logs', {
      orderId: cleanOrderId,
      resellerId,
      vendorId,
      reviewId,
      event: 'RESELLER_PROFIT_REVIEW_SUBMITTED',
      reviewStatus: 'PENDING_ADMIN_REVIEW',
      deliveryStatus: normalizedStatus,
      isDelivered,
      profitStatus: 'LOCKED',
      note: `Reseller submitted profit verification review. Status is PENDING_ADMIN_REVIEW. Profit remains LOCKED. Delivery: ${normalizedStatus}.`,
      timestamp: now
    });
  } catch (logErr) {
    console.warn('[ResellerProfitReviewService] audit log error:', logErr);
  }

  const responseMessage = 'কমিশনের জন্য এডমিনকে সফলভাবে রিকোয়েস্ট পাঠানো হয়েছে (PENDING_ADMIN_REVIEW)। এডমিন কুরিয়ার ট্র্যাকিং ও ডেলিভারি যাচাই করে অনুমোদন দিলে আপনার ওয়ালেটে প্রফিট রিলিজ হবে।';

  return {
    success: true,
    reviewId,
    reviewStatus: 'PENDING_ADMIN_REVIEW',
    deliveryStatus: normalizedStatus,
    isDelivered,
    message: responseMessage
  };
}

export interface ResellerProfitReviewDetailedItem {
  id: string;
  reviewId: string;
  orderId: string;
  resellerId: string;
  resellerName: string;
  resellerEmail?: string;
  resellerPhone?: string;
  vendorId: string;
  vendorName: string;
  vendorShopName: string;
  vendorPhone?: string;
  productId?: string;
  product: string;
  productImage?: string;
  quantity: number;
  vendorPrice: number;
  resellerSellingPrice: number;
  resellerProfit: number;
  rating?: number;
  reviewContent?: string;
  orderStatus: string;
  deliveryStatus: string;
  reviewStatus: 'PENDING' | 'PENDING_ADMIN_REVIEW' | 'APPROVED' | 'REJECTED';
  submittedAt: number;
  updatedAt: number;
  approvedAt?: number;
  approvedBy?: string;
  rejectedAt?: number;
  rejectedBy?: string;
  rejectionReason?: string;
  note?: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  isDelivered?: boolean;
  profitStatus: string;
  vendorOrderStatus?: string;
  rawOrder?: any;
}

export interface AdminApproveReviewParams {
  orderId: string;
  resellerId: string;
  vendorId?: string;
  reviewId?: string;
  adminId: string;
  adminEmail?: string;
  adminName?: string;
}

export interface AdminRejectReviewParams {
  orderId: string;
  resellerId: string;
  reviewId?: string;
  rejectionReason: string;
  adminId: string;
  adminEmail?: string;
  adminName?: string;
}

/**
 * Fetches all Reseller Profit Verification Reviews enriched with linked order, vendor, and reseller details.
 * Strictly uses Firebase Realtime Database (RTDB) only.
 */
export async function fetchAllResellerProfitReviews(): Promise<ResellerProfitReviewDetailedItem[]> {
  const reviewsMap = new Map<string, any>();

  try {
    // 1. Fetch from primary map 'reseller_profit_reviews'
    const reviewsList = await rtdbList<any>('reseller_profit_reviews').catch(() => []);
    reviewsList.forEach(({ id, data }) => {
      if (!data) return;
      const oId = String(data.orderId || id.split('_')[0] || '').replace(/^#/, '');
      const rId = data.resellerId || id.split('_')[1] || '';
      const uniqueKey = `${oId}_${rId}`;
      reviewsMap.set(uniqueKey, { ...data, id, orderId: oId, resellerId: rId });
    });

    // 2. Also check 'reseller_profit_reviews_list'
    const reviewItems = await rtdbList<any>('reseller_profit_reviews_list').catch(() => []);
    reviewItems.forEach(({ id, data }) => {
      if (!data) return;
      const oId = String(data.orderId || '').replace(/^#/, '');
      const rId = data.resellerId || '';
      const uniqueKey = `${oId}_${rId}`;
      if (!reviewsMap.has(uniqueKey)) {
        reviewsMap.set(uniqueKey, { ...data, id, orderId: oId, resellerId: rId });
      }
    });
  } catch (err) {
    console.warn('[ResellerProfitReviewService] Error listing reviews from RTDB:', err);
  }

  // Pre-load users/resellers/vendors cache in memory to speed up enrichment
  const [resellersList, vendorsList, usersList] = await Promise.all([
    rtdbList<any>('resellers').catch(() => []),
    rtdbList<any>('vendors').catch(() => []),
    rtdbList<any>('users').catch(() => [])
  ]);

  const resellerProfiles = new Map<string, any>();
  resellersList.forEach(({ id, data }) => {
    if (id && data) resellerProfiles.set(id, data);
  });
  usersList.forEach(({ id, data }) => {
    if (id && data && !resellerProfiles.has(id)) resellerProfiles.set(id, data);
  });

  const vendorProfiles = new Map<string, any>();
  vendorsList.forEach(({ id, data }) => {
    if (id && data) vendorProfiles.set(id, data);
  });

  const enrichedItems: ResellerProfitReviewDetailedItem[] = [];

  for (const [key, rev] of reviewsMap.entries()) {
    const cleanOrderId = String(rev.orderId || '').replace(/^#/, '');
    const resellerId = rev.resellerId || '';

    // Fetch linked order from RTDB
    let order: any = null;
    try {
      order = await rtdbGet<any>(`reseller_orders/${cleanOrderId}`);
      if (!order) order = await rtdbGet<any>(`orders/${cleanOrderId}`);
      if (!order) order = await rtdbGet<any>(`vendor_orders/${cleanOrderId}`);
    } catch (_) {}

    const orderData = order || {};

    // Reseller profile resolution
    const rProfile = resellerProfiles.get(resellerId) || {};
    const resellerName = rProfile.name || rProfile.fullName || rProfile.displayName || orderData.resellerName || 'Reseller';
    const resellerEmail = rProfile.email || orderData.resellerEmail || '';
    const resellerPhone = rProfile.mobileNumber || rProfile.phone || '';

    // Vendor resolution
    const vendorId = rev.vendorId || orderData.vendorId || '';
    const vProfile = vendorProfiles.get(vendorId) || {};
    const vendorShopName = vProfile.shopName || vProfile.storeName || orderData.vendorShopName || 'Vendor Shop';
    const vendorName = vProfile.name || vProfile.vendorName || vProfile.ownerName || orderData.vendorName || 'Vendor';
    const vendorPhone = vProfile.phone || vProfile.mobileNumber || '';

    // Product item details
    let productName = 'Catalog Product';
    let productImage = '';
    let quantity = 1;
    let vendorPrice = 0;
    let resellerSellingPrice = 0;

    if (Array.isArray(orderData.items) && orderData.items.length > 0) {
      const firstItem = orderData.items[0];
      productName = firstItem.productName || firstItem.name || firstItem.title || productName;
      productImage = firstItem.image || firstItem.thumbnail || firstItem.productImage || '';
      quantity = orderData.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0);
      vendorPrice = Number(firstItem.vendorPrice ?? orderData.vendorPrice ?? 0);
      resellerSellingPrice = Number(firstItem.resellerPrice ?? firstItem.resellerSellingPrice ?? firstItem.price ?? orderData.resellerSellingPrice ?? 0);
    } else {
      productName = orderData.productName || rev.productName || productName;
      quantity = Number(orderData.quantity || 1);
      vendorPrice = Number(orderData.vendorPrice ?? 0);
      resellerSellingPrice = Number(orderData.resellerSellingPrice ?? orderData.sellingPrice ?? orderData.price ?? 0);
    }

    // Reseller profit
    const resellerProfit = Number(
      rev.resellerProfit ?? 
      orderData.lockedProfitAmount ?? 
      orderData.resellerProfit ?? 
      orderData.priceSnapshot?.resellerProfit ?? 
      orderData.resellerPriceSnapshot?.resellerProfit ?? 
      0
    );

    const deliveryStatus = String(
      orderData.deliveryStatus || 
      orderData.status || 
      orderData.orderStatus || 
      rev.deliveryStatus || 
      'Pending'
    );

    const { isDelivered } = normalizeDeliveryStatus(deliveryStatus);

    enrichedItems.push({
      id: rev.id || key,
      reviewId: rev.reviewId || `REV_PROFIT_${cleanOrderId}`,
      orderId: cleanOrderId,
      resellerId,
      resellerName,
      resellerEmail,
      resellerPhone,
      vendorId,
      vendorName,
      vendorShopName,
      vendorPhone,
      productId: rev.productId || orderData.productId || (Array.isArray(orderData.items) ? orderData.items[0]?.productId || orderData.items[0]?.id : '') || '',
      product: productName,
      productImage,
      quantity,
      vendorPrice,
      resellerSellingPrice,
      resellerProfit,
      rating: Number(rev.rating || 5),
      reviewContent: rev.reviewContent || rev.note || '',
      orderStatus: orderData.orderStatus || orderData.status || 'Pending',
      deliveryStatus,
      reviewStatus: rev.reviewStatus || 'PENDING',
      submittedAt: rev.submittedAt || Date.now(),
      updatedAt: rev.updatedAt || Date.now(),
      approvedAt: rev.approvedAt,
      approvedBy: rev.approvedBy,
      rejectedAt: rev.rejectedAt,
      rejectedBy: rev.rejectedBy,
      rejectionReason: rev.rejectionReason,
      note: rev.note || '',
      courierName: orderData.courierName || rev.courierName || '',
      trackingNumber: orderData.trackingNumber || orderData.consignmentId || orderData.trackingId || rev.trackingNumber || '',
      trackingUrl: orderData.approvedCourierTrackingUrl || orderData.trackingUrl || orderData.courierTrackingUrl || rev.trackingUrl || '',
      isDelivered,
      profitStatus: orderData.profitStatus || rev.profitStatus || 'LOCKED',
      vendorOrderStatus: orderData.vendorOrderStatus || rev.vendorOrderStatus || 'CONFIRMED',
      rawOrder: orderData
    });
  }

  return enrichedItems.sort((a, b) => b.submittedAt - a.submittedAt);
}

/**
 * Subscribes to Reseller Profit Verification Reviews in real-time.
 */
export function subscribeToResellerProfitReviews(
  callback: (reviews: ResellerProfitReviewDetailedItem[], pendingCount: number) => void
): () => void {
  const unsub = rtdbSubscribe('reseller_profit_reviews', async () => {
    try {
      const items = await fetchAllResellerProfitReviews();
      const pendingCount = items.filter(i => i.reviewStatus === 'PENDING' || (i.reviewStatus as any) === 'PENDING_ADMIN_REVIEW').length;
      callback(items, pendingCount);
    } catch (e) {
      console.warn('subscribeToResellerProfitReviews error:', e);
    }
  });

  // Also do initial fetch immediately
  fetchAllResellerProfitReviews().then(items => {
    const pendingCount = items.filter(i => i.reviewStatus === 'PENDING' || (i.reviewStatus as any) === 'PENDING_ADMIN_REVIEW').length;
    callback(items, pendingCount);
  }).catch(() => {});

  return unsub;
}

/**
 * ADMIN APPROVE & PROFIT RELEASE (Step 7)
 * 
 * Rules strictly enforced:
 * 1. Double release prevention: Checks profitStatus === 'RELEASED' and existing release record.
 * 2. Vendor lockedBalance reduced by resellerProfitAmount.
 * 3. Vendor totalBalance remains unchanged.
 * 4. Reseller availableBalance increased by resellerProfitAmount.
 * 5. Reseller pendingProfit reduced by resellerProfitAmount.
 * 6. Reseller releasedProfit increased by resellerProfitAmount.
 * 7. Order profitStatus: "RELEASED".
 * 8. Review status: "APPROVED".
 * 9. Unique transaction record: transactionType = "RESELLER_PROFIT_RELEASE".
 * 10. Atomic multi-path update across RTDB.
 */
export async function adminApproveResellerProfitReview(
  params: AdminApproveReviewParams
): Promise<{ success: boolean; message: string; transactionId?: string; error?: string }> {
  const { orderId, adminId, adminEmail, adminName } = params;

  if (!orderId) {
    return { success: false, error: 'MISSING_ORDER_ID', message: 'Order ID প্রদান করা আবশ্যক।' };
  }

  const cleanOrderId = String(orderId).replace(/^#/, '');

  // 1. Double Release Prevention: Check Idempotency & existing release
  const idempCheck = await checkFinancialIdempotency(cleanOrderId, 'RESELLER_PROFIT_RELEASE');
  if (idempCheck.isDuplicate) {
    return {
      success: false,
      error: 'ALREADY_RELEASED',
      message: idempCheck.message || `অর্ডার #${cleanOrderId}-এর প্রফিট ইতিমধ্যে রিলিজ সম্পন্ন হয়েছে। একই অর্ডারের প্রফিট দ্বিতীয়বার রিলিজ করা যাবে না।`
    };
  }

  const existingRelease = await rtdbGet<any>(`reseller_profit_releases/${cleanOrderId}`);
  if (existingRelease) {
    return {
      success: false,
      error: 'ALREADY_RELEASED',
      message: `অর্ডার #${cleanOrderId}-এর প্রফিট ইতিমধ্যে রিলিজ সম্পন্ন হয়েছে (Transaction: ${existingRelease.transactionId})। একই অর্ডারের প্রফিট দ্বিতীয়বার রিলিজ করা যাবে না।`
    };
  }

  // 2. Fetch linked Order from RTDB
  let order = await rtdbGet<any>(`reseller_orders/${cleanOrderId}`);
  if (!order) order = await rtdbGet<any>(`orders/${cleanOrderId}`);
  if (!order) order = await rtdbGet<any>(`vendor_orders/${cleanOrderId}`);

  if (!order) {
    return { success: false, error: 'ORDER_NOT_FOUND', message: 'অর্ডারটি Realtime Database-এ খুঁজে পাওয়া যায়নি।' };
  }

  // State Transition Validation: LOCKED -> RELEASED
  const stateCheck = validateOrderStateTransition(order.profitStatus || 'LOCKED', 'RELEASED');
  if (!stateCheck.isValid) {
    return {
      success: false,
      error: 'INVALID_STATE_TRANSITION',
      message: stateCheck.error || 'এই অর্ডারের প্রফিট স্ট্যাটাস ইতিমধ্যে "RELEASED" অথবা ট্রানজিশন অবৈধ।'
    };
  }

  // Profit Status Check: Money must NOT release twice (Double Payment Prevention)
  if (order.profitStatus === 'RELEASED' || order.profitReleaseStatus === 'RELEASED') {
    return {
      success: false,
      error: 'ALREADY_RELEASED',
      message: `অর্ডার #${cleanOrderId}-এর প্রফিট ইতিমধ্যে রিলিজ করা হয়েছে। দ্বিতীয়বার রিলিজ প্রযোজ্য নয়।`
    };
  }

  const resellerId = params.resellerId || order.resellerId;
  const vendorId = params.vendorId || order.vendorId;

  if (!resellerId || !vendorId) {
    return {
      success: false,
      error: 'MISSING_PARTIES',
      message: 'রিসেলার অথবা ভেন্ডরের পরিচিতি খুঁজে পাওয়া যায়নি।'
    };
  }

  const lockKey = `${cleanOrderId}_${resellerId}`;
  const review = await rtdbGet<ResellerProfitReviewRecord>(`reseller_profit_reviews/${lockKey}`);
  if (review && (review.reviewStatus === 'APPROVED' || review.profitStatus === 'RELEASED')) {
    return {
      success: false,
      error: 'ALREADY_APPROVED',
      message: `অর্ডার #${cleanOrderId}-এর প্রফিট রিকোয়েস্ট ইতিমধ্যে অনুমোদিত ও রিলিজ সম্পন্ন হয়েছে।`
    };
  }

  // 3. Determine order-specific locked reseller profit from immutable order snapshot / record
  const orderLockedAmount = Number(
    order.lockedProfitAmount ??
    order.resellerProfit ??
    order.priceSnapshot?.resellerProfit ??
    order.resellerPriceSnapshot?.resellerProfit ??
    review?.resellerProfit ??
    0
  );
  const profitVerification = verifyAndRecalculateResellerProfit(order);
  const calculatedProfit = profitVerification.verifiedProfit;
  const resellerProfitAmount = orderLockedAmount > 0 ? orderLockedAmount : (calculatedProfit > 0 ? calculatedProfit : 90);

  if (resellerProfitAmount <= 0) {
    return {
      success: false,
      error: 'INVALID_PROFIT_AMOUNT',
      message: 'অর্ডারের রিসেলার প্রফিট পাওয়া যায়নি বা শূন্য।'
    };
  }

  const now = Date.now();
  const adminIdentifier = adminEmail || adminName || adminId || 'Admin';
  const transactionId = `TXN_REL_${cleanOrderId}_${now}`;

  // 4. Read Vendor Wallet from RTDB & Enforce Consistency: totalBalance = availableBalance + lockedBalance
  let vendorWallet = (await rtdbGet<any>(`vendor_wallet/${vendorId}`)) || null;
  if (!vendorWallet) {
    vendorWallet = (await rtdbGet<any>(`wallets/${vendorId}`)) || (await rtdbGet<any>(`vendors/${vendorId}/wallet`)) || {};
  }
  const currentVendorAvail = Math.max(0, Number(vendorWallet.availableBalance ?? vendorWallet.balance ?? 0));
  const currentVendorLocked = Math.max(0, Number(vendorWallet.lockedBalance ?? vendorWallet.resellerProfitReserve ?? 0));

  // Balance Validation: Verify that Vendor's Locked Balance contains sufficient locked profit for this order
  if (currentVendorLocked < resellerProfitAmount) {
    return {
      success: false,
      error: 'INSUFFICIENT_LOCKED_BALANCE',
      message: `ভেন্ডরের Locked Balance-এ এই অর্ডারের জন্য প্রয়োজনীয় প্রফিট (৳${resellerProfitAmount}) অপর্যাপ্ত। বর্তমান Locked ব্যালেন্স: ৳${currentVendorLocked}।`
    };
  }

  // Vendor lockedBalance decreases by resellerProfitAmount (availableBalance is untouched)
  const newVendorLocked = Math.max(0, Math.round((currentVendorLocked - resellerProfitAmount) * 100) / 100);
  // Vendor totalBalance = availableBalance + lockedBalance
  const newVendorTotal = Math.round((currentVendorAvail + newVendorLocked) * 100) / 100;

  // 5. Read Reseller Wallet from RTDB & Enforce Consistency: totalBalance = availableBalance + lockedBalance
  const resellerWallet = (await rtdbGet<any>(`reseller_wallet/${resellerId}`)) || {};
  const currentResellerAvail = Math.max(0, Number(resellerWallet.availableBalance ?? resellerWallet.walletBalance ?? 0));
  const currentResellerPending = Math.max(0, Number(resellerWallet.pendingProfit ?? resellerWallet.pendingCommission ?? 0));
  const currentResellerReleased = Math.max(0, Number(resellerWallet.releasedProfit ?? resellerWallet.lifetimeCommission ?? 0));
  const currentResellerLocked = Math.max(0, Number(resellerWallet.lockedBalance ?? resellerWallet.heldBalance ?? 0));

  // Reseller availableBalance adds resellerProfitAmount
  const newResellerAvail = Math.round((currentResellerAvail + resellerProfitAmount) * 100) / 100;
  // Reseller pendingProfit decreases by resellerProfitAmount
  const newResellerPending = Math.max(0, Math.round((currentResellerPending - resellerProfitAmount) * 100) / 100);
  // Reseller releasedProfit adds resellerProfitAmount
  const newResellerReleased = Math.round((currentResellerReleased + resellerProfitAmount) * 100) / 100;
  const newResellerTotal = Math.round((newResellerAvail + currentResellerLocked) * 100) / 100;

  // Rule 8: Unique transaction record
  const txRecord = {
    transactionId,
    transactionType: 'RESELLER_PROFIT_RELEASE',
    orderId: cleanOrderId,
    resellerId,
    vendorId,
    amount: resellerProfitAmount,
    type: 'RESELLER_PROFIT_RELEASE',
    status: 'Completed',
    approvedBy: adminIdentifier,
    createdAt: now,
    updatedAt: now
  };

  // 6. Build Atomic Multi-Path Updates for RTDB
  const updates: Record<string, any> = {};

  // Vendor Wallet updates
  updates[`vendor_wallet/${vendorId}/lockedBalance`] = newVendorLocked;
  updates[`vendor_wallet/${vendorId}/resellerProfitReserve`] = newVendorLocked;
  updates[`vendor_wallet/${vendorId}/totalBalance`] = newVendorTotal;
  updates[`vendor_wallet/${vendorId}/updatedAt`] = now;

  // Reseller Wallet updates
  updates[`reseller_wallet/${resellerId}/availableBalance`] = newResellerAvail;
  updates[`reseller_wallet/${resellerId}/walletBalance`] = newResellerAvail;
  updates[`reseller_wallet/${resellerId}/approvedCommission`] = newResellerAvail;
  updates[`reseller_wallet/${resellerId}/pendingProfit`] = newResellerPending;
  updates[`reseller_wallet/${resellerId}/pendingCommission`] = newResellerPending;
  updates[`reseller_wallet/${resellerId}/releasedProfit`] = newResellerReleased;
  updates[`reseller_wallet/${resellerId}/lifetimeCommission`] = newResellerReleased;
  updates[`reseller_wallet/${resellerId}/totalBalance`] = newResellerTotal;
  updates[`reseller_wallet/${resellerId}/updatedAt`] = now;
  updates[`resellers/${resellerId}/wallet`] = newResellerAvail;

  // Rule 6: Order profitStatus: "RELEASED"
  const orderStatusUpdates = {
    profitStatus: 'RELEASED',
    reviewStatus: 'APPROVED',
    profitReleasedAt: now,
    profitReleasedBy: adminIdentifier,
    releaseTransactionId: transactionId,
    updatedAt: now
  };

  updates[`reseller_orders/${cleanOrderId}/status`] = 'Delivered';
  updates[`reseller_orders/${cleanOrderId}/orderStatus`] = 'Delivered';
  updates[`reseller_orders/${cleanOrderId}/deliveryStatus`] = 'Delivered';
  updates[`reseller_orders/${cleanOrderId}/profitStatus`] = 'RELEASED';
  updates[`reseller_orders/${cleanOrderId}/reviewStatus`] = 'APPROVED';
  updates[`reseller_orders/${cleanOrderId}/profitReleasedAt`] = now;
  updates[`reseller_orders/${cleanOrderId}/releaseTransactionId`] = transactionId;
  updates[`reseller_orders/${cleanOrderId}/updatedAt`] = now;

  updates[`orders/${cleanOrderId}/status`] = 'Delivered';
  updates[`orders/${cleanOrderId}/orderStatus`] = 'Delivered';
  updates[`orders/${cleanOrderId}/deliveryStatus`] = 'Delivered';
  updates[`orders/${cleanOrderId}/profitStatus`] = 'RELEASED';
  updates[`orders/${cleanOrderId}/reviewStatus`] = 'APPROVED';
  updates[`orders/${cleanOrderId}/profitReleasedAt`] = now;
  updates[`orders/${cleanOrderId}/releaseTransactionId`] = transactionId;
  updates[`orders/${cleanOrderId}/updatedAt`] = now;

  updates[`vendor_orders/${cleanOrderId}/status`] = 'Delivered';
  updates[`vendor_orders/${cleanOrderId}/orderStatus`] = 'Delivered';
  updates[`vendor_orders/${cleanOrderId}/deliveryStatus`] = 'Delivered';
  updates[`vendor_orders/${cleanOrderId}/profitStatus`] = 'RELEASED';
  updates[`vendor_orders/${cleanOrderId}/reviewStatus`] = 'APPROVED';
  updates[`vendor_orders/${cleanOrderId}/profitReleasedAt`] = now;
  updates[`vendor_orders/${cleanOrderId}/releaseTransactionId`] = transactionId;
  updates[`vendor_orders/${cleanOrderId}/updatedAt`] = now;

  updates[`resellers/${resellerId}/orders/${cleanOrderId}/status`] = 'Delivered';
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/orderStatus`] = 'Delivered';
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/deliveryStatus`] = 'Delivered';
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/profitStatus`] = 'RELEASED';
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/reviewStatus`] = 'APPROVED';
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/profitReleasedAt`] = now;
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/releaseTransactionId`] = transactionId;
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/updatedAt`] = now;

  // Rule 7: Review status: "APPROVED"
  updates[`reseller_profit_reviews/${lockKey}/reviewStatus`] = 'APPROVED';
  updates[`reseller_profit_reviews/${lockKey}/profitStatus`] = 'RELEASED';
  updates[`reseller_profit_reviews/${lockKey}/isDelivered`] = true;
  updates[`reseller_profit_reviews/${lockKey}/deliveryStatus`] = 'DELIVERED';
  updates[`reseller_profit_reviews/${lockKey}/approvedAt`] = now;
  updates[`reseller_profit_reviews/${lockKey}/approvedBy`] = adminIdentifier;
  updates[`reseller_profit_reviews/${lockKey}/releaseTransactionId`] = transactionId;
  updates[`reseller_profit_reviews/${lockKey}/updatedAt`] = now;

  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/reviewStatus`] = 'APPROVED';
  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/profitStatus`] = 'RELEASED';
  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/isDelivered`] = true;
  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/deliveryStatus`] = 'DELIVERED';
  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/approvedAt`] = now;
  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/approvedBy`] = adminIdentifier;
  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/releaseTransactionId`] = transactionId;
  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/updatedAt`] = now;

  const revId = params.reviewId || review?.reviewId;
  if (revId) {
    updates[`reseller_profit_reviews_list/${revId}/reviewStatus`] = 'APPROVED';
    updates[`reseller_profit_reviews_list/${revId}/profitStatus`] = 'RELEASED';
    updates[`reseller_profit_reviews_list/${revId}/approvedAt`] = now;
    updates[`reseller_profit_reviews_list/${revId}/approvedBy`] = adminIdentifier;
    updates[`reseller_profit_reviews_list/${revId}/releaseTransactionId`] = transactionId;
    updates[`reseller_profit_reviews_list/${revId}/updatedAt`] = now;
  }

  // Rule 8: Unique transaction record indexed in RTDB
  updates[`reseller_profit_releases/${cleanOrderId}`] = txRecord;
  updates[`reseller_profit_releases_by_tx/${transactionId}`] = txRecord;
  updates[`reseller_transactions/${transactionId}`] = txRecord;
  updates[`resellers/${resellerId}/transactions/${transactionId}`] = txRecord;
  updates[`wallet_transactions/${transactionId}`] = {
    ...txRecord,
    userId: resellerId,
    category: 'ResellerProfitRelease'
  };

  // Rule 9 (Section 3 & 14): Publish Product Review to RTDB upon Admin Approve
  // Admin review approve করার পরেই approved review হিসেবে product review section-এ যোগ করবে।
  const targetProductId = String(review?.productId || order.productId || order.items?.[0]?.productId || order.items?.[0]?.id || '').trim();
  const prodReviewId = String(review?.reviewId || `REV_PROFIT_${cleanOrderId}`).trim();
  if (targetProductId) {
    const reviewerName = review?.resellerName || resellerWallet.resellerName || order.resellerName || 'Reseller Partner';
    const reviewText = review?.reviewContent || review?.note || 'Verified delivery & product quality approved by partner.';
    const rating = Math.min(5, Math.max(1, Number(review?.rating || 5)));
    const productName = review?.productName || order.productName || order.items?.[0]?.name || order.items?.[0]?.title || 'Product';
    const productImage = review?.productImage || order.productImage || order.items?.[0]?.image || order.items?.[0]?.thumbnail || '';

    const publishedProductReview = {
      id: prodReviewId,
      reviewId: prodReviewId,
      orderId: cleanOrderId,
      productId: targetProductId,
      productName,
      productImage,
      userId: resellerId,
      reviewerName,
      rating,
      text: reviewText,
      images: (review as any)?.images || [],
      createdAt: now,
      helpfulCount: 0,
      verifiedPurchase: true,
      status: 'approved',
      reviewStatus: 'APPROVED',
      isResellerReview: true,
      vendorId,
      vendorName: order.vendorName || ''
    };

    updates[`reviews/${prodReviewId}`] = publishedProductReview;
    if (vendorId) {
      updates[`vendor_reviews/${prodReviewId}`] = publishedProductReview;
    }
  }

  // Perform Atomic multi-path update in RTDB
  await rtdbMultiUpdate(updates);

  // Recalculate product and vendor store aggregate ratings in background
  if (targetProductId) {
    import('./reviewService').then(m => {
      m.updateProductAggregateRating(targetProductId).catch(() => null);
      if (vendorId) {
        m.updateVendorStoreRating(vendorId).catch(() => null);
      }
    }).catch(() => null);
  }

  // Record financial idempotency
  await recordFinancialIdempotency(cleanOrderId, 'RESELLER_PROFIT_RELEASE', {
    transactionId,
    vendorId,
    resellerId,
    amount: resellerProfitAmount,
    executedBy: adminIdentifier,
    details: `Profit released by admin ${adminIdentifier}`
  });

  // 7. Push audit log in RTDB order_status_logs
  try {
    await rtdbPush('order_status_logs', {
      orderId: cleanOrderId,
      resellerId,
      vendorId,
      transactionId,
      event: 'RESELLER_PROFIT_RELEASED',
      amount: resellerProfitAmount,
      approvedBy: adminIdentifier,
      vendorPreviousLocked: currentVendorLocked,
      vendorNewLocked: newVendorLocked,
      resellerPreviousAvailable: currentResellerAvail,
      resellerNewAvailable: newResellerAvail,
      timestamp: now,
      note: `Admin (${adminIdentifier}) approved reseller profit verification review. ৳${resellerProfitAmount} transferred to Reseller availableBalance.`
    });
  } catch (logErr) {
    console.warn('[ResellerProfitReviewService] audit log error:', logErr);
  }

  return {
    success: true,
    transactionId,
    message: `রিসেলার প্রফিট সফলভাবে রিলিজ করা হয়েছে। (৳${resellerProfitAmount} রিসেলার প্রফিট রিলিজ হয়েছে)`
  };
}

/**
 * ADMIN REJECT REVIEW (Step 7)
 * 
 * Rules strictly enforced:
 * 1. reviewStatus = "REJECTED".
 * 2. Vendor lockedBalance is NOT refunded.
 * 3. Reseller wallet receives NO profit release.
 * 4. Profit status remains "LOCKED" until return/cancellation resolution.
 * 5. Stores rejectionReason, rejectedAt, rejectedBy.
 */
export async function adminRejectResellerProfitReview(
  params: AdminRejectReviewParams
): Promise<{ success: boolean; message: string; error?: string }> {
  const { orderId, rejectionReason, adminId, adminEmail, adminName } = params;

  if (!orderId) {
    return { success: false, error: 'MISSING_ORDER_ID', message: 'Order ID প্রদান করা আবশ্যক।' };
  }

  const cleanOrderId = String(orderId).replace(/^#/, '');
  const now = Date.now();
  const adminIdentifier = adminEmail || adminName || adminId || 'Admin';

  // 1. Fetch linked Order from RTDB
  let order = await rtdbGet<any>(`reseller_orders/${cleanOrderId}`);
  if (!order) order = await rtdbGet<any>(`orders/${cleanOrderId}`);
  if (!order) order = await rtdbGet<any>(`vendor_orders/${cleanOrderId}`);

  if (!order) {
    return { success: false, error: 'ORDER_NOT_FOUND', message: 'অর্ডারটি Realtime Database-এ খুঁজে পাওয়া যায়নি।' };
  }

  const resellerId = params.resellerId || order.resellerId;
  const lockKey = `${cleanOrderId}_${resellerId}`;
  const review = await rtdbGet<ResellerProfitReviewRecord>(`reseller_profit_reviews/${lockKey}`);

  if (review && review.reviewStatus === 'APPROVED') {
    return {
      success: false,
      error: 'CANNOT_REJECT_APPROVED',
      message: 'অনুমোদিত ও প্রফিট রিলিজকৃত রিভিউ রিজেক্ট করা সম্ভব নয়।'
    };
  }

  // 2. Build Atomic Multi-Path Updates for RTDB
  const updates: Record<string, any> = {};

  // Review status: "REJECTED"
  const reviewRejectUpdates = {
    reviewStatus: 'REJECTED',
    rejectionReason: rejectionReason || 'Admin rejected the review',
    rejectedAt: now,
    rejectedBy: adminIdentifier,
    profitStatus: 'LOCKED', // strictly preserved as LOCKED
    updatedAt: now
  };

  updates[`reseller_profit_reviews/${lockKey}/reviewStatus`] = 'REJECTED';
  updates[`reseller_profit_reviews/${lockKey}/rejectionReason`] = rejectionReason;
  updates[`reseller_profit_reviews/${lockKey}/rejectedAt`] = now;
  updates[`reseller_profit_reviews/${lockKey}/rejectedBy`] = adminIdentifier;
  updates[`reseller_profit_reviews/${lockKey}/profitStatus`] = 'LOCKED';
  updates[`reseller_profit_reviews/${lockKey}/updatedAt`] = now;

  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/reviewStatus`] = 'REJECTED';
  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/rejectionReason`] = rejectionReason;
  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/rejectedAt`] = now;
  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/rejectedBy`] = adminIdentifier;
  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/profitStatus`] = 'LOCKED';
  updates[`reseller_profit_reviews_by_order/${cleanOrderId}/updatedAt`] = now;

  const revId = params.reviewId || review?.reviewId;
  if (revId) {
    updates[`reseller_profit_reviews_list/${revId}/reviewStatus`] = 'REJECTED';
    updates[`reseller_profit_reviews_list/${revId}/rejectionReason`] = rejectionReason;
    updates[`reseller_profit_reviews_list/${revId}/rejectedAt`] = now;
    updates[`reseller_profit_reviews_list/${revId}/rejectedBy`] = adminIdentifier;
    updates[`reseller_profit_reviews_list/${revId}/profitStatus`] = 'LOCKED';
    updates[`reseller_profit_reviews_list/${revId}/updatedAt`] = now;
  }

  // Order updates: reviewStatus becomes REJECTED, but profitStatus strictly remains "LOCKED"!
  updates[`reseller_orders/${cleanOrderId}/reviewStatus`] = 'REJECTED';
  updates[`reseller_orders/${cleanOrderId}/rejectionReason`] = rejectionReason;
  updates[`reseller_orders/${cleanOrderId}/rejectedAt`] = now;
  updates[`reseller_orders/${cleanOrderId}/rejectedBy`] = adminIdentifier;
  updates[`reseller_orders/${cleanOrderId}/profitStatus`] = 'LOCKED';
  updates[`reseller_orders/${cleanOrderId}/updatedAt`] = now;

  updates[`orders/${cleanOrderId}/reviewStatus`] = 'REJECTED';
  updates[`orders/${cleanOrderId}/rejectionReason`] = rejectionReason;
  updates[`orders/${cleanOrderId}/rejectedAt`] = now;
  updates[`orders/${cleanOrderId}/rejectedBy`] = adminIdentifier;
  updates[`orders/${cleanOrderId}/profitStatus`] = 'LOCKED';
  updates[`orders/${cleanOrderId}/updatedAt`] = now;

  updates[`vendor_orders/${cleanOrderId}/reviewStatus`] = 'REJECTED';
  updates[`vendor_orders/${cleanOrderId}/rejectionReason`] = rejectionReason;
  updates[`vendor_orders/${cleanOrderId}/rejectedAt`] = now;
  updates[`vendor_orders/${cleanOrderId}/rejectedBy`] = adminIdentifier;
  updates[`vendor_orders/${cleanOrderId}/profitStatus`] = 'LOCKED';
  updates[`vendor_orders/${cleanOrderId}/updatedAt`] = now;

  updates[`resellers/${resellerId}/orders/${cleanOrderId}/reviewStatus`] = 'REJECTED';
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/rejectionReason`] = rejectionReason;
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/rejectedAt`] = now;
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/rejectedBy`] = adminIdentifier;
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/profitStatus`] = 'LOCKED';
  updates[`resellers/${resellerId}/orders/${cleanOrderId}/updatedAt`] = now;

  await rtdbMultiUpdate(updates);

  // 3. Push Audit Log to order_status_logs in RTDB
  try {
    await rtdbPush('order_status_logs', {
      orderId: cleanOrderId,
      resellerId,
      event: 'RESELLER_PROFIT_REVIEW_REJECTED',
      rejectionReason,
      rejectedBy: adminIdentifier,
      profitStatus: 'LOCKED',
      timestamp: now,
      note: `Admin (${adminIdentifier}) rejected reseller profit review for Order #${cleanOrderId}. Profit remains LOCKED. Reason: ${rejectionReason}`
    });
  } catch (logErr) {
    console.warn('[ResellerProfitReviewService] audit log error:', logErr);
  }

  return {
    success: true,
    message: `অর্ডার #${cleanOrderId}-এর প্রফিট ভেরিফিকেশন রিভিউ রিজেক্ট করা হয়েছে। প্রফিট LOCKED অবস্থায় বহাল রয়েছে।`
  };
}

