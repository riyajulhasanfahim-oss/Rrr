import { rtdbGet, rtdbSet, rtdbList, rtdbUpdate, rtdbRemove, rtdbSubscribe } from '../lib/rtdb';
import { db } from '../lib/firebase';
import { notifyVendorNewReview } from './vendorNotificationService';
import { getCachedMarketplaceProducts } from './productService';
import { generateProductSlug } from '../utils/seo';
import { isCodOrder } from './vendorPayoutService';
import { isCodPayment, recordPlatformFeeOnDelivery, markCodOrderDelivered } from './platformFeeService';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  deleteDoc, 
  updateDoc, 
  getDoc,
  setDoc
} from 'firebase/firestore';
import { submitResellerProfitReview } from './resellerProfitReviewService';

export interface ProductReview {
  id?: string;
  reviewId?: string;
  orderId: string;
  productId: string;
  productName?: string;
  productImage?: string;
  userId: string;
  reviewerName: string;
  reviewerPhoto?: string;
  customerName?: string;
  customerPhoto?: string;
  rating: number;
  text: string;
  images?: string[];
  createdAt: number;
  helpfulCount?: number;
  verifiedPurchase: boolean;
  status?: string;
  vendorId?: string;
  vendorName?: string;
  vendorReply?: {
    text: string;
    repliedAt: number;
    vendorId?: string;
    vendorName?: string;
  };
}

export interface ReviewEligibility {
  canReview: boolean;
  isDelivered: boolean;
  orderId?: string;
  orderItem?: any;
  alreadyReviewed?: boolean;
  reason?: 'not_purchased' | 'not_delivered' | 'already_reviewed';
}

export interface UnreviewedDeliveredItem {
  orderId: string;
  productId: string;
  productName: string;
  productImage: string;
  price?: number;
  quantity?: number;
  orderDate?: number;
  deliveredDate?: number;
  vendorId?: string;
}

/**
 * Normalizes phone numbers to standard 10 or 11 digits for matching
 */
function cleanPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '').slice(-10);
}

/**
 * Checks if status indicates an order is successfully delivered
 */
export function isDeliveredStatus(status?: string | null): boolean {
  if (!status) return false;
  const s = String(status).toLowerCase().trim();
  return s === 'delivered' || s === 'completed';
}

/**
 * Verifies if a product was delivered to the user strictly using Realtime Database
 * (with Firestore as supplementary fallback).
 * - Only DELIVERED orders qualify for customer reviews.
 * - Checks each delivered order: if there is an unreviewed delivered order, canReview is true.
 * - If all delivered orders containing this product have already been reviewed, alreadyReviewed is true.
 * - If the user orders the product again in a new order and it gets delivered, canReview becomes true again.
 */
export async function isProductDeliveredToUser(
  productId: string,
  userId: string,
  userPhone?: string,
  userEmail?: string
): Promise<ReviewEligibility> {
  if (!productId || !userId) {
    return { canReview: false, isDelivered: false, reason: 'not_purchased' };
  }

  const cleanUserPhone = cleanPhoneNumber(userPhone);

  try {
    // 1. Fetch user orders from Realtime Database
    let rtdbOrders: any[] = [];
    try {
      const snap = await rtdbGet<Record<string, any>>('orders', 2500);
      if (snap && typeof snap === 'object') {
        rtdbOrders = Object.entries(snap).map(([key, val]) => ({
          orderId: key,
          id: key,
          ...val
        }));
      }
    } catch (err) {
      console.warn('Notice fetching RTDB orders for review check:', err);
    }

    // Filter orders matching user
    const userOrders = rtdbOrders.filter(order => {
      if (!order) return false;
      const uidMatch = order.userId === userId || order.customerId === userId || order.resellerId === userId;
      if (uidMatch) return true;

      const orderPhone = cleanPhoneNumber(order.shippingAddress?.mobile || order.customerPhone || order.phone);
      if (cleanUserPhone && orderPhone && cleanUserPhone === orderPhone) return true;

      const orderEmail = (order.shippingAddress?.email || order.customerEmail || order.email || '').toLowerCase().trim();
      if (userEmail && orderEmail && userEmail.toLowerCase().trim() === orderEmail) return true;

      return false;
    });

    // Supplementary check: Firestore orders
    try {
      const qOrders = query(collection(db, 'orders'), where('userId', '==', userId));
      const fSnap = await getDocs(qOrders);
      fSnap.docs.forEach(d => {
        if (!userOrders.some(o => o.id === d.id || o.orderId === d.id)) {
          userOrders.push({ id: d.id, orderId: d.id, ...d.data() });
        }
      });
    } catch (fErr) {
      console.warn('Notice checking Firestore orders for review check:', fErr);
    }

    // Find all user orders that contain this productId
    const matchingOrders: { order: any; item: any }[] = [];
    for (const order of userOrders) {
      const items = Array.isArray(order.items) ? order.items : [];
      const item = items.find(
        (it: any) => String(it.productId || it.id || '') === String(productId)
      );
      if (item) {
        matchingOrders.push({ order, item });
      }
    }

    // If user never ordered this product
    if (matchingOrders.length === 0) {
      return { canReview: false, isDelivered: false, reason: 'not_purchased' };
    }

    // Filter matching orders that are DELIVERED or Admin Courier Verified (Courier Verification Approved)
    const deliveredMatching = matchingOrders.filter(m => {
      const isDeliv = isDeliveredStatus(m.order.status);
      const isCourierVerified = Boolean(
        m.order.courierVerificationStatus === 'Verified' ||
        m.order.courierAdminApproved === true ||
        m.order.courierAdminApproved === 'true' ||
        m.order.courierReviewStatus === 'approved'
      );
      return isDeliv || isCourierVerified;
    });

    // If purchased but not yet delivered in any order
    if (deliveredMatching.length === 0) {
      const latest = matchingOrders[0];
      return { 
        canReview: false, 
        isDelivered: false, 
        orderId: latest.order.orderId || latest.order.id,
        orderItem: latest.item,
        reason: 'not_delivered' 
      };
    }

    // Sort delivered orders newest first
    deliveredMatching.sort((a, b) => {
      const dateA = a.order.deliveredAt || a.order.updatedAt || a.order.createdAt || 0;
      const dateB = b.order.deliveredAt || b.order.updatedAt || b.order.createdAt || 0;
      return dateB - dateA;
    });

    // Check each delivered order: is there any unreviewed delivered order?
    for (const entry of deliveredMatching) {
      const oId = String(entry.order.orderId || entry.order.id || '');
      const alreadyReviewed = await hasUserReviewedProduct(userId, productId, oId);
      if (!alreadyReviewed) {
        // Found an unreviewed delivered order! Customer can review for this order!
        return {
          canReview: true,
          isDelivered: true,
          orderId: oId,
          orderItem: entry.item,
          alreadyReviewed: false
        };
      }
    }

    // If all delivered orders containing this product have already been reviewed
    const latestDelivered = deliveredMatching[0];
    return {
      canReview: false,
      isDelivered: true,
      orderId: String(latestDelivered.order.orderId || latestDelivered.order.id || ''),
      orderItem: latestDelivered.item,
      alreadyReviewed: true,
      reason: 'already_reviewed'
    };
  } catch (err) {
    console.error('Error verifying review eligibility:', err);
    return { canReview: false, isDelivered: false };
  }
}

/**
 * Checks if user has already reviewed this product.
 * - When orderId is provided: strictly checks if the user has reviewed this product for THAT specific delivered order.
 * - When orderId is not provided: checks if the user has reviewed this product in any order.
 */
export async function hasUserReviewedProduct(
  userId: string,
  productId: string,
  orderId?: string
): Promise<boolean> {
  if (!userId || !productId) return false;

  try {
    const prodIdStr = String(productId).trim();
    const orderIdStr = orderId ? String(orderId).trim() : '';
    const cleanOrderId = orderIdStr.replace(/^#/, '');

    // 1. Check RTDB reviews
    const rtdbReviews = await rtdbGet<Record<string, any>>('reviews', 2500).catch(() => null);
    if (rtdbReviews && typeof rtdbReviews === 'object') {
      const hasRtdb = Object.values(rtdbReviews).some((r: any) => {
        if (!r || r.userId !== userId || String(r.productId || '').trim() !== prodIdStr) return false;
        if (orderIdStr) {
          const rOrd = String(r.orderId || '').trim().replace(/^#/, '');
          if (!rOrd) return false;
          return rOrd === cleanOrderId || rOrd === orderIdStr;
        }
        return true;
      });
      if (hasRtdb) return true;
    }

    // 2. Check vendor_reviews in RTDB
    const vendorReviews = await rtdbGet<Record<string, any>>('vendor_reviews', 2500).catch(() => null);
    if (vendorReviews && typeof vendorReviews === 'object') {
      const hasVRev = Object.values(vendorReviews).some((r: any) => {
        if (!r || r.userId !== userId || String(r.productId || '').trim() !== prodIdStr) return false;
        if (orderIdStr) {
          const rOrd = String(r.orderId || '').trim().replace(/^#/, '');
          if (!rOrd) return false;
          return rOrd === cleanOrderId || rOrd === orderIdStr;
        }
        return true;
      });
      if (hasVRev) return true;
    }

    // 3. Check RTDB order's reviewedItems map if orderId provided
    if (orderIdStr) {
      try {
        const orderSnap = await rtdbGet<any>(`orders/${orderIdStr}`);
        if (orderSnap?.reviewedItems && typeof orderSnap.reviewedItems === 'object') {
          if (orderSnap.reviewedItems[prodIdStr] || orderSnap.reviewedItems[productId]) {
            return true;
          }
        }
      } catch {}
      if (cleanOrderId !== orderIdStr) {
        try {
          const cleanOrderSnap = await rtdbGet<any>(`orders/${cleanOrderId}`);
          if (cleanOrderSnap?.reviewedItems && typeof cleanOrderSnap.reviewedItems === 'object') {
            if (cleanOrderSnap.reviewedItems[prodIdStr] || cleanOrderSnap.reviewedItems[productId]) {
              return true;
            }
          }
        } catch {}
      }
    }

    // 4. Check Firestore reviews
    try {
      const q = query(
        collection(db, 'reviews'),
        where('userId', '==', userId),
        where('productId', '==', prodIdStr)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        if (orderIdStr) {
          const found = snap.docs.some(docSnap => {
            const d = docSnap.data();
            const docOrd = String(d.orderId || '').trim().replace(/^#/, '');
            if (!docOrd) return false;
            return docOrd === cleanOrderId || docOrd === orderIdStr;
          });
          if (found) return true;
        } else {
          return true;
        }
      }
    } catch {}

    // 5. Check Firestore order's reviewedItems if orderId provided
    if (orderIdStr) {
      try {
        const fDoc = await getDoc(doc(db, 'orders', cleanOrderId));
        if (fDoc.exists()) {
          const fData = fDoc.data();
          if (fData?.reviewedItems && (fData.reviewedItems[prodIdStr] || fData.reviewedItems[productId])) {
            return true;
          }
        }
      } catch {}
      if (cleanOrderId !== orderIdStr) {
        try {
          const fDoc = await getDoc(doc(db, 'orders', orderIdStr));
          if (fDoc.exists()) {
            const fData = fDoc.data();
            if (fData?.reviewedItems && (fData.reviewedItems[prodIdStr] || fData.reviewedItems[productId])) {
              return true;
            }
          }
        } catch {}
      }
    }

    return false;
  } catch (err) {
    console.warn('Error checking existing reviews:', err);
    return false;
  }
}

/**
 * Fetches all delivered items from Realtime Database and Firestore that the user has not yet reviewed.
 * Powers the "To Review (রিভিউ দিন)" tab in My Reviews page and profile badge counters.
 * - If a product in an order has been reviewed, it disappears from this list.
 * - If the user orders the product again in a new order and it is delivered, that new order appears with the review option!
 */
export async function getDeliveredUnreviewedItems(
  userId: string,
  userPhone?: string,
  userEmail?: string
): Promise<UnreviewedDeliveredItem[]> {
  if (!userId) return [];

  const cleanUserPhone = cleanPhoneNumber(userPhone);

  try {
    // 1. Fetch user reviews to know which (orderId, productId) pairs are already reviewed
    const reviewedOrderProductKeys = new Set<string>();
    const reviewedProductOnlyKeys = new Set<string>();
    try {
      const [rtdbRevs, vRevs, fRevsSnap] = await Promise.all([
        rtdbGet<Record<string, any>>('reviews', 2500).catch(() => null),
        rtdbGet<Record<string, any>>('vendor_reviews', 2500).catch(() => null),
        getDocs(query(collection(db, 'reviews'), where('userId', '==', userId))).catch(() => null)
      ]);

      const recordReviewKey = (r: any) => {
        if (!r || r.userId !== userId || !r.productId) return;
        const pId = String(r.productId).trim();
        const ord = String(r.orderId || '').trim();
        const cleanOrd = ord.replace(/^#/, '');
        if (ord) {
          reviewedOrderProductKeys.add(`${ord}_${pId}`);
          reviewedOrderProductKeys.add(`${cleanOrd}_${pId}`);
        } else {
          reviewedProductOnlyKeys.add(pId);
        }
      };

      if (rtdbRevs && typeof rtdbRevs === 'object') {
        Object.values(rtdbRevs).forEach(recordReviewKey);
      }
      if (vRevs && typeof vRevs === 'object') {
        Object.values(vRevs).forEach(recordReviewKey);
      }
      if (fRevsSnap && !fRevsSnap.empty) {
        fRevsSnap.docs.forEach(docSnap => {
          recordReviewKey(docSnap.data());
        });
      }
    } catch (err) {
      console.warn('Error checking existing reviews for unreviewed list:', err);
    }

    // 2. Fetch all orders from RTDB
    let allOrders: any[] = [];
    try {
      const snap = await rtdbGet<Record<string, any>>('orders', 2500);
      if (snap && typeof snap === 'object') {
        allOrders = Object.entries(snap).map(([id, data]) => ({ id, orderId: id, ...data }));
      }
    } catch (err) {
      console.warn('Error fetching orders from RTDB:', err);
    }

    // Supplement with Firestore orders
    try {
      const fSnap = await getDocs(query(collection(db, 'orders'), where('userId', '==', userId)));
      fSnap.docs.forEach(d => {
        const data = d.data();
        if (!allOrders.some(o => o.id === d.id || o.orderId === d.id)) {
          allOrders.push({ id: d.id, orderId: d.id, ...data });
        }
      });
    } catch (err) {
      console.warn('Error fetching orders from Firestore:', err);
    }

    // Filter only user's orders that are DELIVERED
    const deliveredOrders = allOrders.filter(order => {
      if (!order) return false;
      const isDelivered = isDeliveredStatus(order.status);
      if (!isDelivered) return false;

      const uidMatch = order.userId === userId || order.customerId === userId;
      if (uidMatch) return true;

      const orderPhone = cleanPhoneNumber(order.shippingAddress?.mobile || order.customerPhone || order.phone);
      if (cleanUserPhone && orderPhone && cleanUserPhone === orderPhone) return true;

      const orderEmail = (order.shippingAddress?.email || order.customerEmail || order.email || '').toLowerCase().trim();
      if (userEmail && orderEmail && userEmail.toLowerCase().trim() === orderEmail) return true;

      return false;
    });

    // Also register reviewed items from order.reviewedItems
    deliveredOrders.forEach(order => {
      const oId = String(order.orderId || order.id || '');
      const cleanOId = oId.replace(/^#/, '');
      if (order.reviewedItems && typeof order.reviewedItems === 'object') {
        Object.keys(order.reviewedItems).forEach(pid => {
          reviewedOrderProductKeys.add(`${oId}_${pid}`);
          reviewedOrderProductKeys.add(`${cleanOId}_${pid}`);
        });
      }
    });

    const unreviewed: UnreviewedDeliveredItem[] = [];
    const addedKeys = new Set<string>();

    for (const order of deliveredOrders) {
      const orderId = String(order.orderId || order.id || '');
      if (!orderId) continue;
      const cleanOrderId = orderId.replace(/^#/, '');
      const items = Array.isArray(order.items) ? order.items : [];

      for (const item of items) {
        const productId = String(item.productId || item.id || '');
        if (!productId) continue;

        const uniqueOrderProductKey = `${orderId}_${productId}`;
        const cleanOrderProductKey = `${cleanOrderId}_${productId}`;

        // Check if this product was already reviewed for THIS delivered order or generally by this user
        if (
          reviewedOrderProductKeys.has(uniqueOrderProductKey) || 
          reviewedOrderProductKeys.has(cleanOrderProductKey) ||
          reviewedProductOnlyKeys.has(productId)
        ) {
          continue; // Already reviewed for this delivered order!
        }

        if (addedKeys.has(uniqueOrderProductKey)) {
          continue;
        }
        addedKeys.add(uniqueOrderProductKey);

        unreviewed.push({
          orderId,
          productId,
          productName: item.name || item.title || 'Delivered Product',
          productImage: item.image || item.thumbnail || (Array.isArray(item.images) ? item.images[0] : ''),
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1,
          orderDate: order.createdAt || Date.now(),
          deliveredDate: order.deliveredAt || order.updatedAt || order.createdAt || Date.now(),
          vendorId: item.vendorId || order.vendorId
        });
      }
    }

    // Sort by newest delivery first
    return unreviewed.sort((a, b) => (b.deliveredDate || 0) - (a.deliveredDate || 0));
  } catch (err) {
    console.error('Error fetching unreviewed items:', err);
    return [];
  }
}

export interface VendorStoreReviewStatus {
  canReview: boolean;
  unreviewedItems: UnreviewedDeliveredItem[];
  alreadyReviewedItemsCount: number;
  hasPurchasedFromStore: boolean;
  hasDeliveredPurchases: boolean;
}

/**
 * Checks a customer's review eligibility for a specific vendor store.
 * - Respects the global rule: exactly ONE review per delivered purchase/order.
 * - If reviewed from Profile or Product page, it cannot be reviewed from the Store page.
 * - If reviewed from Store page, it cannot be reviewed from the Profile page.
 */
export async function getVendorStoreReviewStatus(
  vendorId: string,
  userId: string,
  userPhone?: string,
  userEmail?: string,
  vendorProductIdsList?: string[]
): Promise<VendorStoreReviewStatus> {
  if (!vendorId || !userId) {
    return {
      canReview: false,
      unreviewedItems: [],
      alreadyReviewedItemsCount: 0,
      hasPurchasedFromStore: false,
      hasDeliveredPurchases: false
    };
  }

  try {
    const vendorProductSet = new Set<string>((vendorProductIdsList || []).map(id => String(id).trim()));

    // 1. Get ALL delivered unreviewed items for this user across the entire system
    const allUnreviewed = await getDeliveredUnreviewedItems(userId, userPhone, userEmail);

    // 2. Filter unreviewed items for this specific vendor
    const storeUnreviewed = allUnreviewed.filter(item => {
      const pId = String(item.productId || '').trim();
      const vId = String(item.vendorId || '').trim();
      return vId === vendorId || vendorProductSet.has(pId);
    });

    // 3. Count already reviewed delivered items for this vendor from RTDB and Firestore
    let alreadyReviewedItemsCount = 0;
    try {
      const [vRevs, allRevs, fRevsSnap] = await Promise.all([
        rtdbGet<Record<string, any>>('vendor_reviews', 2500).catch(() => null),
        rtdbGet<Record<string, any>>('reviews', 2500).catch(() => null),
        getDocs(query(collection(db, 'reviews'), where('userId', '==', userId))).catch(() => null)
      ]);

      const reviewedSet = new Set<string>();

      const checkReview = (r: any) => {
        if (!r || r.userId !== userId) return;
        const pId = String(r.productId || '').trim();
        const rVendorId = String(r.vendorId || '').trim();
        const matchesVendor = rVendorId === vendorId || (pId && vendorProductSet.has(pId));
        if (!matchesVendor) return;

        const key = r.orderId ? `${String(r.orderId).trim().replace(/^#/, '')}_${pId}` : (r.id || r.reviewId || pId);
        reviewedSet.add(key);
      };

      if (vRevs && typeof vRevs === 'object') {
        Object.values(vRevs).forEach(checkReview);
      }
      if (allRevs && typeof allRevs === 'object') {
        Object.values(allRevs).forEach(checkReview);
      }
      if (fRevsSnap && !fRevsSnap.empty) {
        fRevsSnap.docs.forEach(docSnap => checkReview(docSnap.data()));
      }

      alreadyReviewedItemsCount = reviewedSet.size;
    } catch (e) {
      console.warn('Error counting vendor reviewed items:', e);
    }

    const hasDeliveredPurchases = storeUnreviewed.length > 0 || alreadyReviewedItemsCount > 0;

    return {
      canReview: storeUnreviewed.length > 0,
      unreviewedItems: storeUnreviewed,
      alreadyReviewedItemsCount,
      hasPurchasedFromStore: hasDeliveredPurchases,
      hasDeliveredPurchases
    };
  } catch (err) {
    console.error('Error fetching vendor store review status:', err);
    return {
      canReview: false,
      unreviewedItems: [],
      alreadyReviewedItemsCount: 0,
      hasPurchasedFromStore: false,
      hasDeliveredPurchases: false
    };
  }
}

/**
 * Submits a customer review for a delivered product.
 * Enforces strictly that:
 * 1. Product was delivered to user before saving.
 * 2. Customer can only give ONE review per delivered order for this product.
 * 3. Once reviewed, that order cannot be reviewed again. A new order must be placed and delivered for another review.
 */
export async function submitProductReview(reviewData: {
  orderId: string;
  productId: string;
  productName?: string;
  productImage?: string;
  userId: string;
  reviewerName: string;
  reviewerPhoto?: string;
  rating: number;
  text: string;
  images?: string[];
  vendorId?: string;
  vendorName?: string;
  accountType?: string;
}): Promise<{ success: boolean; reviewId?: string; error?: string; message?: string }> {
  try {
    const { orderId, productId, userId, rating, text } = reviewData;

    if (!orderId) {
      return { success: false, error: 'Order ID is required to submit a review.' };
    }
    if (!productId) {
      return { success: false, error: 'Product ID is required to submit a review.' };
    }
    if (!rating || rating < 1 || rating > 5) {
      return { success: false, error: 'Please select a star rating between 1 and 5.' };
    }
    if (!text || !text.trim()) {
      return { success: false, error: 'Please write a review comment.' };
    }

    const cleanOrderId = String(orderId).trim().replace(/^#/, '');

    // 1. Strict Duplicate Check: A customer can only give ONE review per delivered order!
    const alreadyReviewed = await hasUserReviewedProduct(userId, productId, orderId);
    if (alreadyReviewed) {
      return {
        success: false,
        error: 'আপনি ইতিমধ্যে এই অর্ডারের পণ্যের রিভিউ প্রদান করেছেন। একটি অর্ডারে সর্বোচ্চ ১টি রিভিউ দেওয়া যাবে (Only 1 review per delivered order is allowed).'
      };
    }

    // 2. Strict Delivery Check from Realtime Database
    let isDelivered = false;
    let orderInRtdb: any = null;
    try {
      orderInRtdb = await rtdbGet<any>(`orders/${orderId}`);
      if (!orderInRtdb && cleanOrderId !== orderId) {
        orderInRtdb = await rtdbGet<any>(`orders/${cleanOrderId}`);
      }
      if (!orderInRtdb) {
        orderInRtdb = await rtdbGet<any>(`vendor_orders/${orderId}`);
      }
      if (!orderInRtdb && cleanOrderId !== orderId) {
        orderInRtdb = await rtdbGet<any>(`vendor_orders/${cleanOrderId}`);
      }
      if (orderInRtdb) {
        const isCod = isCodOrder(orderInRtdb) || isCodPayment(orderInRtdb.paymentMethod);
        if (
          isDeliveredStatus(orderInRtdb.status) || 
          orderInRtdb.courierAdminApproved || 
          orderInRtdb.courierReviewStatus === 'approved' || 
          orderInRtdb.courierVerificationStatus === 'Verified' ||
          orderInRtdb.status === 'Shipped' ||
          orderInRtdb.status === 'In Transit' ||
          orderInRtdb.status === 'Out for Delivery' ||
          isCod
        ) {
          isDelivered = true;
        }
      }
    } catch (e) {
      console.warn('Could not verify order status in RTDB:', e);
    }

    if (!isDelivered) {
      // Fallback check Firestore
      try {
        let orderDoc = await getDoc(doc(db, 'orders', orderId));
        if (!orderDoc.exists() && cleanOrderId !== orderId) {
          orderDoc = await getDoc(doc(db, 'orders', cleanOrderId));
        }
        if (orderDoc.exists()) {
          const docData = orderDoc.data();
          const isCod = isCodOrder(docData) || isCodPayment(docData?.paymentMethod);
          if (
            isDeliveredStatus(docData?.status) || 
            docData?.courierAdminApproved || 
            docData?.courierReviewStatus === 'approved' || 
            docData?.courierVerificationStatus === 'Verified' ||
            docData?.status === 'Shipped' ||
            docData?.status === 'In Transit' ||
            docData?.status === 'Out for Delivery' ||
            isCod
          ) {
            isDelivered = true;
            if (!orderInRtdb) orderInRtdb = docData;
          }
        }
      } catch (e) {
        console.warn('Could not verify order status in Firestore:', e);
      }
    }

    if (!isDelivered) {
      return {
        success: false,
        error: 'রিভিউ শুধুমাত্র প্রোডাক্ট সফলভাবে ডেলিভারি হওয়ার পর দেওয়া যাবে। (Reviews are only allowed after successful delivery).'
      };
    }

    // 3. Resolve Vendor ID & Name
    let vendorId = reviewData.vendorId;
    let vendorName = reviewData.vendorName;

    if (!vendorId && orderInRtdb) {
      if (orderInRtdb.vendorId) {
        vendorId = orderInRtdb.vendorId;
        vendorName = orderInRtdb.vendorName || vendorName;
      } else if (Array.isArray(orderInRtdb.items)) {
        const matchItem = orderInRtdb.items.find(
          (it: any) => String(it.productId || it.id || '') === String(productId)
        );
        if (matchItem?.vendorId) {
          vendorId = matchItem.vendorId;
          vendorName = matchItem.vendorName || vendorName;
        }
      }
    }

    if (!vendorId) {
      try {
        const prodData = await rtdbGet<any>(`products/${productId}`);
        if (prodData?.vendorId) {
          vendorId = prodData.vendorId;
          vendorName = prodData.vendorName || prodData.shopName || vendorName;
        }
      } catch {}
    }

    // Resolve user account type
    let accountType = reviewData.accountType;
    if (!accountType) {
      try {
        const u = await rtdbGet<any>(`users/${userId}`);
        accountType = u?.accountType || u?.role;
      } catch (_) {}
    }

    const isResellerOrder = Boolean(
      orderInRtdb?.isResellerOrder || 
      orderInRtdb?.resellerId ||
      orderInRtdb?.lockedProfitAmount > 0 ||
      (orderInRtdb?.profitStatus && orderInRtdb.profitStatus !== 'NONE')
    );

    // If Reseller role or reseller order: Route exclusively to Reseller Profit Verification Review (Admin Panel)
    if ((accountType === 'reseller' || orderInRtdb?.resellerId === userId) && isResellerOrder) {
      const resellerRes = await submitResellerProfitReview({
        orderId: cleanOrderId,
        resellerId: userId,
        vendorId: vendorId || orderInRtdb?.vendorId,
        productId: String(productId),
        productName: reviewData.productName,
        productImage: reviewData.productImage,
        rating: Number(rating),
        reviewContent: text.trim(),
        note: text.trim()
      });

      if (!resellerRes.success) {
        return {
          success: false,
          error: resellerRes.message || 'রিসেলার রিভিউ সাবমিট করতে ব্যর্থ হয়েছে।'
        };
      }

      return {
        success: true,
        reviewId: resellerRes.reviewId,
        message: 'রিসেলার ভেরিফিকেশন রিভিউ সফলভাবে জমা হয়েছে। অ্যাডমিন পর্যালোচনার পর প্রফিট রিলিজ হবে।'
      };
    }

    const reviewId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const fullReview: ProductReview = {
      id: reviewId,
      reviewId,
      orderId,
      productId: String(productId),
      productName: reviewData.productName || 'Product',
      productImage: reviewData.productImage || '',
      userId,
      reviewerName: reviewData.reviewerName || 'Customer',
      reviewerPhoto: reviewData.reviewerPhoto || '',
      rating: Number(rating),
      text: text.trim(),
      images: Array.isArray(reviewData.images) ? reviewData.images : [],
      createdAt: Date.now(),
      helpfulCount: 0,
      verifiedPurchase: true,
      status: 'approved',
      vendorId: vendorId || '',
      vendorName: vendorName || ''
    };

    // 1. Save to Realtime Database `reviews/${reviewId}`
    try {
      await rtdbSet(`reviews/${reviewId}`, fullReview);
      globalReviewsCache.set(reviewId, fullReview);
      broadcastReviewsUpdate();
    } catch (rtdbErr) {
      console.warn('Notice saving review to RTDB:', rtdbErr);
    }

    // 2. Also save to `vendor_reviews/${reviewId}` in RTDB if vendorId is identified
    if (vendorId) {
      try {
        await rtdbSet(`vendor_reviews/${reviewId}`, {
          ...fullReview,
          vendorId,
          vendorName: vendorName || '',
          id: reviewId
        });

        // Send real-time notification to the vendor
        notifyVendorNewReview(
          vendorId,
          reviewData.productName || 'পণ্য',
          rating,
          reviewData.reviewerName || 'সম্মানিত ক্রেতা',
          text,
          reviewId
        ).catch(e => console.warn('Vendor review notif failed:', e));
      } catch (vErr) {
        console.warn('Notice saving review to vendor_reviews:', vErr);
      }
    }

    // 3. Save to Cloud Firestore `reviews/${reviewId}`
    try {
      await setDoc(doc(db, 'reviews', reviewId), fullReview);
    } catch (fErr) {
      console.warn('Notice saving review to Firestore:', fErr);
    }

    // 4. Mark as reviewed on the order in RTDB and Firestore
    const reviewedItemPayload = {
      reviewId,
      rating,
      reviewedAt: Date.now()
    };

    const isCod = isCodOrder(orderInRtdb) || isCodPayment(orderInRtdb?.paymentMethod);
    const now = Date.now();

    const orderReviewedUpdate: any = {
      reviewSubmitted: true,
      reviewCompleted: true,
      reviewedAt: now,
      reviewStatus: 'completed'
    };

    // COD Order Rule: Customer submitting review automatically marks order as 'Delivered'
    if (isCod) {
      orderReviewedUpdate.status = 'Delivered';
      orderReviewedUpdate.orderStatus = 'Delivered';
      orderReviewedUpdate.vendorStatus = 'Delivered';
      if (!orderInRtdb?.deliveredAt) {
        orderReviewedUpdate.deliveredAt = now;
      }
      orderReviewedUpdate.paymentStatus = 'Paid';
      orderReviewedUpdate.vendorPayoutStatus = 'None'; // COD Wallet Rule: COD amount NEVER goes to vendor wallet
      orderReviewedUpdate.platformFeeStatus = 'due';
      orderReviewedUpdate.platformFeeRecorded = true;
      orderReviewedUpdate.platformFee = Number(orderInRtdb?.platformFee || 5);
    }

    try {
      await rtdbUpdate(`orders/${orderId}`, {
        ...orderReviewedUpdate,
        [`reviewedItems/${productId}`]: reviewedItemPayload
      });
      if (cleanOrderId !== orderId) {
        await rtdbUpdate(`orders/${cleanOrderId}`, {
          ...orderReviewedUpdate,
          [`reviewedItems/${productId}`]: reviewedItemPayload
        });
      }
      await rtdbUpdate(`vendor_orders/${orderId}`, orderReviewedUpdate).catch(() => null);
      if (cleanOrderId !== orderId) {
        await rtdbUpdate(`vendor_orders/${cleanOrderId}`, orderReviewedUpdate).catch(() => null);
      }

      // COD Order: Invoke markCodOrderDelivered to atomically synchronize all vendor_orders, status logs and fee records
      if (isCod) {
        await markCodOrderDelivered(cleanOrderId, {
          ...(orderInRtdb || {}),
          ...orderReviewedUpdate,
          [`reviewedItems/${productId}`]: reviewedItemPayload
        }, vendorId);
      }
    } catch (updErr) {
      console.warn('Notice updating order reviewed status in RTDB:', updErr);
    }

    try {
      await updateDoc(doc(db, 'orders', orderId), {
        ...orderReviewedUpdate,
        [`reviewedItems/${productId}`]: reviewedItemPayload
      });
    } catch {}
    if (cleanOrderId !== orderId) {
      try {
        await updateDoc(doc(db, 'orders', cleanOrderId), {
          ...orderReviewedUpdate,
          [`reviewedItems/${productId}`]: reviewedItemPayload
        });
      } catch {}
    }

    // 5. Recalculate and update product aggregate rating in RTDB and Firestore
    try {
      await updateProductAggregateRating(String(productId));
    } catch (aggErr) {
      console.warn('Notice updating aggregate rating:', aggErr);
    }

    // 6. Recalculate and update vendor store rating and review count
    if (vendorId) {
      try {
        await updateVendorStoreRating(vendorId);
      } catch (vAggErr) {
        console.warn('Notice updating vendor store rating:', vAggErr);
      }
    }

    return { success: true, reviewId };
  } catch (err: any) {
    console.error('Error submitting review:', err);
    return { success: false, error: err?.message || 'Failed to submit review' };
  }
}

/**
 * Updates aggregate rating & review count for a vendor store across RTDB and Firestore
 */
export async function updateVendorStoreRating(vendorId: string) {
  if (!vendorId) return;
  try {
    const [rtdbRevs, vRevs] = await Promise.all([
      rtdbGet<Record<string, any>>('reviews', 2000).catch(() => null),
      rtdbGet<Record<string, any>>('vendor_reviews', 2000).catch(() => null)
    ]);

    const reviewMap = new Map<string, any>();
    if (rtdbRevs && typeof rtdbRevs === 'object') {
      Object.entries(rtdbRevs).forEach(([k, v]: [string, any]) => {
        if (v && typeof v === 'object' && v.vendorId === vendorId) {
          reviewMap.set(k, v);
        }
      });
    }
    if (vRevs && typeof vRevs === 'object') {
      Object.entries(vRevs).forEach(([k, v]: [string, any]) => {
        if (v && typeof v === 'object' && v.vendorId === vendorId) {
          reviewMap.set(k, v);
        }
      });
    }

    const count = reviewMap.size;
    let totalStars = 0;
    reviewMap.forEach((r) => {
      totalStars += Number(r.rating) || 5;
    });

    const avgRating = count > 0 ? Number((totalStars / count).toFixed(1)) : 0;

    // Update in RTDB
    await Promise.all([
      rtdbUpdate(`vendors/${vendorId}`, {
        rating: avgRating,
        reviews: count,
        reviewsCount: count
      }).catch(() => null),
      rtdbUpdate(`vendor_profiles/${vendorId}`, {
        rating: avgRating,
        reviews: count,
        reviewsCount: count
      }).catch(() => null)
    ]);

    // Update in Firestore
    try {
      await updateDoc(doc(db, 'vendors', vendorId), {
        rating: avgRating,
        reviews: count,
        reviewsCount: count
      }).catch(() => null);
    } catch {}

    try {
      await updateDoc(doc(db, 'users', vendorId), {
        rating: avgRating,
        reviews: count,
        reviewsCount: count
      }).catch(() => null);
    } catch {}
  } catch (err) {
    console.warn('Error updating vendor store rating:', err);
  }
}

/**
 * Fetches all reviews belonging to a vendor store (by vendorId or vendor products).
 */
export async function fetchVendorReviews(vendorId: string): Promise<ProductReview[]> {
  if (!vendorId) return [];
  const reviewsMap = new Map<string, ProductReview>();

  try {
    // 1. Fetch vendor_reviews in RTDB
    const vRevs = await rtdbGet<Record<string, any>>('vendor_reviews', 2000).catch(() => null);
    if (vRevs && typeof vRevs === 'object') {
      Object.entries(vRevs).forEach(([key, val]: [string, any]) => {
        if (val && typeof val === 'object' && val.vendorId === vendorId) {
          reviewsMap.set(key, { id: key, reviewId: key, ...val });
        }
      });
    }

    // 2. Fetch reviews in RTDB where vendorId matches
    const allRevs = await rtdbGet<Record<string, any>>('reviews', 2000).catch(() => null);
    if (allRevs && typeof allRevs === 'object') {
      Object.entries(allRevs).forEach(([key, val]: [string, any]) => {
        if (val && typeof val === 'object' && val.vendorId === vendorId) {
          reviewsMap.set(key, { id: key, reviewId: key, ...val });
        }
      });
    }

    // 3. Also check Firestore reviews
    try {
      const q = query(collection(db, 'reviews'), where('vendorId', '==', vendorId));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        if (!reviewsMap.has(d.id)) {
          reviewsMap.set(d.id, { id: d.id, reviewId: d.id, ...data });
        }
      });
    } catch {}

    // If still 0, also check if any reviews match vendor's products
    if (reviewsMap.size === 0 && allRevs && typeof allRevs === 'object') {
      try {
        const prodSnap = await rtdbGet<Record<string, any>>('products', 2000).catch(() => null);
        const vendorProdIds = new Set<string>();
        if (prodSnap && typeof prodSnap === 'object') {
          Object.entries(prodSnap).forEach(([pId, pVal]: [string, any]) => {
            if (pVal && typeof pVal === 'object' && pVal.vendorId === vendorId) {
              vendorProdIds.add(pId);
            }
          });
        }
        if (vendorProdIds.size > 0) {
          Object.entries(allRevs).forEach(([k, v]: [string, any]) => {
            if (v && typeof v === 'object' && vendorProdIds.has(String(v.productId))) {
              reviewsMap.set(k, { id: k, reviewId: k, vendorId, ...v });
            }
          });
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Error fetching vendor reviews:', err);
  }

  return Array.from(reviewsMap.values()).sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
}

/**
 * Saves a vendor reply to a customer review in RTDB and Firestore
 */
export async function replyToCustomerReview(params: {
  reviewId: string;
  replyText: string;
  vendorId: string;
  vendorName: string;
}): Promise<{ success: boolean; error?: string }> {
  const { reviewId, replyText, vendorId, vendorName } = params;
  if (!reviewId || !replyText.trim()) {
    return { success: false, error: 'Reply text cannot be empty' };
  }

  const replyData = {
    text: replyText.trim(),
    repliedAt: Date.now(),
    vendorId: vendorId || '',
    vendorName: vendorName || 'Store Owner'
  };

  try {
    // 1. Update in RTDB `reviews/${reviewId}/vendorReply`
    await rtdbUpdate(`reviews/${reviewId}`, {
      vendorReply: replyData
    }).catch(() => null);

    // 2. Update in RTDB `vendor_reviews/${reviewId}/vendorReply`
    await rtdbUpdate(`vendor_reviews/${reviewId}`, {
      vendorReply: replyData
    }).catch(() => null);

    // 3. Update in Firestore `reviews/${reviewId}`
    try {
      await updateDoc(doc(db, 'reviews', reviewId), {
        vendorReply: replyData
      });
    } catch (fErr) {
      console.warn('Notice updating vendor reply in Firestore:', fErr);
    }

    // Update in-memory cache immediately
    const existing = globalReviewsCache.get(reviewId);
    if (existing) {
      existing.vendorReply = replyData;
      broadcastReviewsUpdate();
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to reply to customer review:', err);
    return { success: false, error: err?.message || 'Failed to submit reply' };
  }
}

/**
 * Updates aggregate rating & review count for a product across RTDB and Firestore
 */
export async function updateProductAggregateRating(productId: string) {
  try {
    // Read all reviews for this product from RTDB
    const reviewsSnap = await rtdbGet<Record<string, any>>('reviews', 1500).catch(() => null);
    let totalStars = 0;
    let count = 0;

    if (reviewsSnap && typeof reviewsSnap === 'object') {
      Object.values(reviewsSnap).forEach((r: any) => {
        if (r && String(r.productId) === String(productId)) {
          totalStars += Number(r.rating) || 5;
          count += 1;
        }
      });
    }

    if (count > 0) {
      const avgRating = Number((totalStars / count).toFixed(1));

      // Update RTDB product metrics
      await rtdbUpdate(`product_metrics/${productId}`, {
        rating: avgRating,
        reviewsCount: count,
        updatedAt: Date.now()
      }).catch(() => null);

      // Update Firestore product
      try {
        const prodRef = doc(db, 'products', productId);
        await updateDoc(prodRef, {
          rating: avgRating,
          reviews: count,
          reviewsCount: count
        });
      } catch (fErr) {
        // Document might not exist in Firestore
      }
    }
  } catch (err) {
    console.warn('Could not recalculate product rating:', err);
  }
}

// ============================================================================
// Centralized In-Memory Reviews State & Multiplexed RTDB Subscription
// Eliminates review vanishing, flickering, and infinite "loading" states
// ============================================================================
const globalReviewsCache = new Map<string, ProductReview>();
const productReviewSubscribers = new Map<string, Set<(reviews: ProductReview[]) => void>>();
let globalReviewsUnsubscribe: (() => void) | null = null;
let isReviewsListenerStarted = false;

function broadcastReviewsUpdate() {
  productReviewSubscribers.forEach((subs, prodId) => {
    if (subs.size > 0) {
      const reviews = getCachedProductReviews(prodId);
      subs.forEach(cb => {
        try {
          cb(reviews);
        } catch (e) {
          console.warn('Error in review subscriber callback:', e);
        }
      });
    }
  });
}

function ensureGlobalReviewsListener() {
  if (isReviewsListenerStarted) return;
  isReviewsListenerStarted = true;

  try {
    globalReviewsUnsubscribe = rtdbSubscribe<Record<string, any>>('reviews', (data) => {
      if (data && typeof data === 'object') {
        Object.entries(data).forEach(([key, val]) => {
          if (val && typeof val === 'object') {
            const rev: ProductReview = { id: key, reviewId: key, ...val };
            globalReviewsCache.set(key, rev);
          }
        });
        broadcastReviewsUpdate();
      }
    });
  } catch (err) {
    console.warn('Could not start RTDB reviews listener:', err);
  }
}

/**
 * Resolves all valid IDs/aliases for a product identifier (id, slug, originalProductId)
 */
function resolveProductKeys(productId: string): Set<string> {
  const keys = new Set<string>();
  if (!productId) return keys;

  const raw = String(productId).trim();
  const lower = raw.toLowerCase();
  keys.add(raw);
  keys.add(lower);

  const allProds = getCachedMarketplaceProducts();
  const matchedProd = allProds.find(p => {
    const pId = String(p.id).toLowerCase();
    const pSlug = String(p.slug || '').toLowerCase();
    const genSlug = generateProductSlug(p.name, p.id).toLowerCase();
    return pId === lower || pSlug === lower || genSlug === lower;
  });

  if (matchedProd) {
    keys.add(String(matchedProd.id));
    keys.add(String(matchedProd.id).toLowerCase());
    if (matchedProd.slug) {
      keys.add(String(matchedProd.slug));
      keys.add(String(matchedProd.slug).toLowerCase());
    }
    const origId = (matchedProd as any).originalProductId;
    if (origId) {
      keys.add(String(origId));
      keys.add(String(origId).toLowerCase());
    }
  }

  return keys;
}

/**
 * Returns cached reviews for a product immediately from memory without network delay
 */
export function getCachedProductReviews(productId: string): ProductReview[] {
  if (!productId) return [];
  ensureGlobalReviewsListener();

  const validKeys = resolveProductKeys(productId);
  const matched: ProductReview[] = [];

  globalReviewsCache.forEach((rev) => {
    const revProdId = String(rev.productId || '').trim();
    if (validKeys.has(revProdId) || validKeys.has(revProdId.toLowerCase())) {
      matched.push(rev);
    }
  });

  return matched.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Subscribes to live review updates for a specific product.
 * Returns an unsubscribe callback.
 */
export function subscribeToProductReviews(
  productId: string,
  onUpdate: (reviews: ProductReview[]) => void
): () => void {
  if (!productId) {
    onUpdate([]);
    return () => {};
  }

  ensureGlobalReviewsListener();

  // 1. Immediately provide cached reviews if available
  const cached = getCachedProductReviews(productId);
  if (cached.length > 0) {
    try {
      onUpdate(cached);
    } catch (_) {}
  }

  // 2. Register subscriber
  const cleanId = String(productId).trim();
  if (!productReviewSubscribers.has(cleanId)) {
    productReviewSubscribers.set(cleanId, new Set());
  }
  productReviewSubscribers.get(cleanId)!.add(onUpdate);

  // 3. Trigger a background sync from RTDB/Firestore to ensure complete fresh data
  fetchProductReviews(productId).then(fresh => {
    try {
      onUpdate(fresh);
    } catch (_) {}
  }).catch(() => {});

  // 4. Return cleanup
  return () => {
    const subs = productReviewSubscribers.get(cleanId);
    if (subs) {
      subs.delete(onUpdate);
      if (subs.size === 0) {
        productReviewSubscribers.delete(cleanId);
      }
    }
  };
}

/**
 * Fetches all reviews for a specific product from both RTDB and Firestore
 */
export async function fetchProductReviews(productId: string): Promise<ProductReview[]> {
  if (!productId) return [];
  ensureGlobalReviewsListener();

  const validKeys = resolveProductKeys(productId);

  // 1. Fetch from RTDB
  try {
    const rtdbRevs = await rtdbGet<Record<string, any>>('reviews', 3000);
    if (rtdbRevs && typeof rtdbRevs === 'object') {
      Object.entries(rtdbRevs).forEach(([key, val]) => {
        if (val && typeof val === 'object') {
          const rev: ProductReview = { id: key, reviewId: key, ...val };
          globalReviewsCache.set(key, rev);
        }
      });
    }
  } catch (err) {
    console.warn('Notice fetching RTDB reviews for product:', err);
  }

  // 2. Supplementary check from Firestore
  try {
    for (const key of Array.from(validKeys)) {
      const q = query(collection(db, 'reviews'), where('productId', '==', key));
      const fSnap = await getDocs(q);
      fSnap.docs.forEach(docSnap => {
        const data = docSnap.data() as any;
        const revId = docSnap.id;
        if (!globalReviewsCache.has(revId)) {
          globalReviewsCache.set(revId, { id: revId, reviewId: revId, ...data });
        }
      });
    }
  } catch (err) {
    // Supplementary Firestore fetch is non-blocking
  }

  // Notify any active listeners with updated data
  broadcastReviewsUpdate();

  return getCachedProductReviews(productId);
}

/**
 * Fetches all reviews written by a user from RTDB and Firestore
 */
export async function fetchUserReviews(userId: string): Promise<ProductReview[]> {
  const reviewsMap = new Map<string, ProductReview>();

  // 1. Fetch from RTDB
  try {
    const rtdbRevs = await rtdbGet<Record<string, any>>('reviews', 1500);
    if (rtdbRevs && typeof rtdbRevs === 'object') {
      Object.entries(rtdbRevs).forEach(([key, val]) => {
        if (val && val.userId === userId) {
          const rev: ProductReview = { id: key, reviewId: key, ...val };
          reviewsMap.set(key, rev);
        }
      });
    }
  } catch (err) {
    console.warn('Notice fetching user RTDB reviews:', err);
  }

  // 2. Fetch from Firestore
  try {
    const q = query(collection(db, 'reviews'), where('userId', '==', userId));
    const fSnap = await getDocs(q);
    fSnap.docs.forEach(docSnap => {
      const data = docSnap.data() as any;
      const revId = docSnap.id;
      if (!reviewsMap.has(revId)) {
        reviewsMap.set(revId, { id: revId, reviewId: revId, ...data });
      }
    });
  } catch (err) {
    console.warn('Notice fetching user Firestore reviews:', err);
  }

  return Array.from(reviewsMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Deletes a review from both RTDB and Firestore
 */
export async function deleteUserReview(reviewId: string, userId: string): Promise<boolean> {
  try {
    await Promise.all([
      rtdbRemove(`reviews/${reviewId}`).catch(() => null),
      deleteDoc(doc(db, 'reviews', reviewId)).catch(() => null)
    ]);
    globalReviewsCache.delete(reviewId);
    broadcastReviewsUpdate();
    return true;
  } catch (err) {
    console.error('Failed to delete review:', err);
    return false;
  }
}
