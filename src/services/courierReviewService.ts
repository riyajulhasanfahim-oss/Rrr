import { rtdbGet, rtdbSet, rtdbUpdate, rtdbList, rtdbSubscribe, rtdbPush } from '../lib/rtdb';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { safeStorage } from '../utils/storage';
import { sendVendorNotification } from './vendorNotificationService';
import { getVendorWalletBalances } from './vendorResellerOrderService';

export interface CourierReviewProductItem {
  id?: string;
  name?: string;
  title?: string;
  image?: string;
  thumbnail?: string;
  quantity?: number;
  price?: number;
  color?: string;
  size?: string;
  variant?: string;
  sku?: string;
}

export interface CourierLinkReviewItem {
  id: string;
  orderId: string;
  orderNumber?: string;
  vendorId: string;
  vendorName?: string;
  vendorShopName?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorStatus?: string;
  vendorWarningCount?: number;
  courierName: string;
  trackingId: string;
  trackingUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  customerName?: string;
  customerPhone?: string;
  district?: string;
  thana?: string;
  area?: string;
  fullDeliveryAddress?: string;
  customerAddress?: string;
  totalAmount?: number;
  items?: CourierReviewProductItem[];
  itemsSummary?: string;
  itemsCount?: number;
  submittedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewNotes?: string;
  rejectedReason?: string;
  warningIssued?: boolean;
  warningReason?: string;
  vendorSuspended?: boolean;
}

/**
 * Standard list of popular couriers in Bangladesh.
 * Vendor can pick one of these OR select "অন্যান্য / Other" to type any courier name.
 */
export const POPULAR_COURIER_LIST = [
  'Steadfast Courier',
  'Pathao Courier',
  'RedX Delivery',
  'Paperfly',
  'eCourier',
  'Carrybee',
  'Delivery Tiger',
  'Sundarban Courier',
  'SA Paribahan',
  'Karatoa Courier',
  'Janani Express Parcel Service',
  'Rainbow Courier',
  'DHL Express',
  'FedEx',
  'অন্যান্য / Other Courier'
];

/**
 * Vendor submits courier tracking link for an order.
 * Strictly sets status to 'Pending — Admin Review' in RTDB.
 */
export async function submitVendorCourierLink(params: {
  orderId: string;
  order: any;
  vendorId: string;
  courierName: string;
  trackingId: string;
  trackingUrl: string;
  vendorNotes?: string;
}): Promise<{ success: boolean; message: string }> {
  const { orderId, order, vendorId, courierName, trackingId, trackingUrl, vendorNotes } = params;

  if (!orderId) {
    throw new Error('অর্ডার আইডি পাওয়া যায়নি');
  }
  if (!courierName || !courierName.trim()) {
    throw new Error('কুরিয়ার সার্ভিসের নাম প্রদান করুন');
  }
  if (!trackingId || !trackingId.trim()) {
    throw new Error('অর্ডার/ট্র্যাকিং আইডি প্রদান করুন');
  }
  if (!trackingUrl || !trackingUrl.trim()) {
    throw new Error('কুরিয়ারের সরাসরি ট্র্যাকিং লিংক প্রদান করুন');
  }

  // Validate URL format
  let cleanUrl = trackingUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  try {
    new URL(cleanUrl);
  } catch {
    throw new Error('অনুগ্রহ করে একটি বৈধ কুরিয়ার ট্র্যাকিং ওয়েব লিংক (URL) দিন');
  }

  const cleanOrderId = String(orderId).replace(/^#/, '').trim();
  const pureOrderId = cleanOrderId.includes('_') ? cleanOrderId.split('_')[0] : cleanOrderId;

  // 1. Check if order already has a pending or verified tracking link to strictly enforce lock
  const existingOrder = (await rtdbGet<any>(`orders/${cleanOrderId}`)) || (await rtdbGet<any>(`orders/${pureOrderId}`));
  const existingVendorOrder = (await rtdbGet<any>(`vendor_orders/${cleanOrderId}`)) || (await rtdbGet<any>(`vendor_orders/${pureOrderId}`));
  const existingResellerOrder = (await rtdbGet<any>(`reseller_orders/${cleanOrderId}`)) || (await rtdbGet<any>(`reseller_orders/${pureOrderId}`));

  const existingStatus = existingOrder?.courierVerificationStatus || existingVendorOrder?.courierVerificationStatus;
  const isApproved = existingOrder?.courierAdminApproved || existingVendorOrder?.courierAdminApproved;

  if (existingStatus === 'Pending — Admin Review') {
    throw new Error('এই অর্ডারের জন্য ট্র্যাকিং লিংক ইতিমধ্যে জমা দেওয়া হয়েছে এবং অ্যাডমিন পর্যালোচনায় রয়েছে (🟡 Pending — Admin Review)। অ্যাডমিন যাচাই শেষ না হওয়া পর্যন্ত দ্বিতীয়বার লিংক সাবমিট করা যাবে না।');
  }

  if (existingStatus === 'Verified' || isApproved) {
    throw new Error('এই অর্ডারের কুরিয়ার ট্র্যাকিং লিংকটি অ্যাডমিন কর্তৃক অনুমোদিত ও ভেরিফাইড (🟢 Accepted/Verified)। এতে নতুন কোনো ট্র্যাকিং লিংক যোগ করার সুযোগ নেই।');
  }

  // 1B. STRICT RESELLER ORDER GUARD:
  // For Reseller Orders, Vendor availableBalance MUST be >= resellerProfit,
  // AND the order must be confirmed ("অর্ডার কনফার্ম করুন" / profit locked)
  // before ANY Courier Tracking Link can be submitted or requested to Admin.
  const isResellerOrder = Boolean(
    existingResellerOrder ||
    order?.isResellerOrder ||
    existingOrder?.isResellerOrder ||
    existingVendorOrder?.isResellerOrder ||
    order?.resellerId ||
    existingOrder?.resellerId ||
    existingVendorOrder?.resellerId ||
    order?.profitStatus ||
    existingOrder?.profitStatus ||
    order?.priceSnapshot?.resellerProfit ||
    existingOrder?.priceSnapshot?.resellerProfit
  );

  if (isResellerOrder) {
    const isProfitLocked =
      existingResellerOrder?.profitStatus === 'LOCKED' ||
      existingOrder?.profitStatus === 'LOCKED' ||
      existingVendorOrder?.profitStatus === 'LOCKED' ||
      order?.profitStatus === 'LOCKED';

    const isConfirmed =
      existingResellerOrder?.vendorOrderStatus === 'CONFIRMED' ||
      existingOrder?.vendorOrderStatus === 'CONFIRMED' ||
      existingVendorOrder?.vendorOrderStatus === 'CONFIRMED' ||
      order?.vendorOrderStatus === 'CONFIRMED';

    // If order has NOT been confirmed with profit locked:
    if (!isProfitLocked || !isConfirmed) {
      const effectiveVendorId = vendorId || order?.vendorId || existingOrder?.vendorId || existingVendorOrder?.vendorId || '';
      const balances = await getVendorWalletBalances(effectiveVendorId);
      const requiredProfit = Number(
        existingResellerOrder?.resellerProfit ??
        order?.resellerProfit ??
        existingOrder?.resellerProfit ??
        existingVendorOrder?.resellerProfit ??
        order?.priceSnapshot?.resellerProfit ??
        existingOrder?.priceSnapshot?.resellerProfit ??
        0
      );

      if (balances.availableBalance < requiredProfit) {
        const shortfall = Math.round((requiredProfit - balances.availableBalance) * 100) / 100;
        throw new Error(
          `Reseller Order-এর ক্ষেত্রে Vendor-এর wallet-এর availableBalance অবশ্যই সেই order-এর required resellerProfit-এর সমান বা তার বেশি হতে হবে। আপনার বর্তমান ঘাটতি: ৳${shortfall} (প্রয়োজন: ৳${requiredProfit}, বর্তমান availableBalance: ৳${balances.availableBalance})। কুরিয়ার ট্র্যাকিং লিংক দেওয়ার পূর্বে অবশ্যই Deposit করে 'অর্ডার কনফার্ম করুন' সম্পন্ন করতে হবে।`
        );
      }

      // If available balance is sufficient, but order has not been confirmed yet:
      throw new Error(
        'রিসেলার অর্ডারের ক্ষেত্রে কুরিয়ার ট্র্যাকিং লিংক জমা দেওয়ার পূর্বে অবশ্যই ভেন্ডর অর্ডার ডিটেইলস থেকে "অর্ডার কনফার্ম করুন"-এ ক্লিক করে রিসেলার প্রফিট লক করতে হবে।'
      );
    }
  }

  const now = Date.now();
  const cleanCourier = courierName.trim();
  const cleanTrackingId = trackingId.trim();

  const orderNum = order?.orderNumber || order?.id || cleanOrderId;
  const customerName = order?.customerName || order?.shippingAddress?.name || order?.userName || order?.shippingAddress?.fullName || 'Customer';
  const customerPhone = order?.customerPhone || order?.shippingAddress?.phone || order?.userPhone || '';
  const district = order?.shippingAddress?.district || order?.district || order?.shippingAddress?.city || '';
  const thana = order?.shippingAddress?.thana || order?.shippingAddress?.upazila || order?.thana || order?.shippingAddress?.subDistrict || '';
  const area = order?.shippingAddress?.area || order?.area || order?.shippingAddress?.street || '';
  const fullDeliveryAddress = order?.shippingAddress?.fullAddress || order?.shippingAddress?.address || order?.deliveryAddress || [area, thana, district].filter(Boolean).join(', ') || '';
  const customerAddress = fullDeliveryAddress;
  const totalAmount = Number(order?.total || order?.grandTotal || order?.amount || 0);

  const rawItems = Array.isArray(order?.items) ? order.items : [];
  const items: CourierReviewProductItem[] = rawItems.map((i: any) => ({
    id: i.id || i.productId || '',
    name: i.name || i.title || 'Product',
    title: i.title || i.name || 'Product',
    image: i.image || i.thumbnail || i.images?.[0] || '',
    thumbnail: i.thumbnail || i.image || '',
    quantity: Number(i.quantity) || 1,
    price: Number(i.price) || 0,
    color: i.color || i.selectedColor || '',
    size: i.size || i.selectedSize || '',
    variant: i.variant || i.variation || '',
    sku: i.sku || ''
  }));

  const itemsSummary = items.map((i) => `${i.name || i.title || 'Product'} (x${i.quantity || 1})`).join(', ');
  const itemsCount = items.reduce((acc: number, curr) => acc + (Number(curr.quantity) || 1), 0) || 1;

  // 1. Save / Update to RTDB courier_link_reviews/${cleanOrderId}
  const reviewRecord: CourierLinkReviewItem = {
    id: cleanOrderId,
    orderId: cleanOrderId,
    orderNumber: orderNum,
    vendorId: vendorId || order?.vendorId || '',
    vendorName: order?.vendorName || order?.storeName || '',
    vendorShopName: order?.shopName || order?.vendorShopName || order?.storeName || '',
    vendorEmail: order?.vendorEmail || '',
    vendorPhone: order?.vendorPhone || '',
    courierName: cleanCourier,
    trackingId: cleanTrackingId,
    trackingUrl: cleanUrl,
    status: 'pending',
    customerName,
    customerPhone,
    district,
    thana,
    area,
    fullDeliveryAddress,
    customerAddress,
    totalAmount,
    items,
    itemsSummary,
    itemsCount,
    submittedAt: now
  };

  await rtdbSet(`courier_link_reviews/${cleanOrderId}`, reviewRecord);
  if (cleanOrderId !== pureOrderId) {
    await rtdbSet(`courier_link_reviews/${pureOrderId}`, {
      ...reviewRecord,
      id: pureOrderId,
      orderId: pureOrderId,
      orderNumber: pureOrderId
    });
  }

  // 2. Update Order in RTDB (Both orders and vendor_orders collections)
  // If order was Pending, mark Accepted and queue for Admin Review!
  const orderPendingPayload: any = {
    status: 'Accepted',
    vendorStatus: 'Accepted',
    courierName: cleanCourier,
    trackingNumber: cleanTrackingId,
    trackingId: cleanTrackingId,
    consignmentId: cleanTrackingId,
    trackingUrl: cleanUrl,
    courierVerificationStatus: 'Pending — Admin Review',
    courierAdminApproved: false,
    courierSubmittedAt: now,
    courierVendorNotes: vendorNotes || '',
    updatedAt: now
  };

  if (!order?.acceptedAt) {
    orderPendingPayload.acceptedAt = now;
  }

  const pendingUpdates: Promise<any>[] = [
    rtdbUpdate(`orders/${cleanOrderId}`, orderPendingPayload),
    rtdbUpdate(`vendor_orders/${cleanOrderId}`, orderPendingPayload),
    rtdbPush('order_status_logs', {
      orderId: cleanOrderId,
      mainOrderId: pureOrderId,
      vendorId: vendorId || order?.vendorId,
      oldStatus: order?.status || 'Accepted',
      newStatus: 'Accepted',
      note: `কুরিয়ার ট্র্যাকিং লিংক জমা দেওয়া হয়েছে (${cleanCourier} - ${cleanTrackingId})। অ্যাডমিন পর্যালোচনায় রয়েছে (Pending Admin Review)।`,
      timestamp: now
    })
  ];

  if (cleanOrderId !== pureOrderId) {
    pendingUpdates.push(rtdbUpdate(`orders/${pureOrderId}`, orderPendingPayload));
    pendingUpdates.push(rtdbUpdate(`vendor_orders/${pureOrderId}`, orderPendingPayload));
  }

  await Promise.allSettled(pendingUpdates);

  // 3. Notify Admin in RTDB
  try {
    await rtdbPush('admin_notifications', {
      title: 'নতুন কুরিয়ার ট্র্যাকিং লিংক রিভিউ (Pending)',
      message: `অর্ডার #${orderNum}-এর জন্য ${cleanCourier} কুরিয়ারের ট্র্যাকিং লিংক জমা দেওয়া হয়েছে। যাচাই করে অনুমোদন দিন।`,
      type: 'courier_review',
      link: `/admin/courier-review?openReview=${cleanOrderId}`,
      orderId: cleanOrderId,
      createdAt: now,
      read: false
    });
  } catch (e) {
    // Ignore notification failure
  }

  return {
    success: true,
    message: 'কুরিয়ার ট্র্যাকিং লিংক জমা হয়েছে। অ্যাডমিন যাচাই (Admin Review) করার পর ট্র্যাকিং চালু হবে।'
  };
}

/**
 * Fetch all courier link reviews with enriched vendor status and warning counts.
 */
export async function fetchCourierLinkReviews(
  filterStatus?: 'all' | 'pending' | 'approved' | 'rejected'
): Promise<CourierLinkReviewItem[]> {
  try {
    const list = await rtdbList<CourierLinkReviewItem>('courier_link_reviews');
    let items = list.map(item => ({
      ...item.data,
      id: item.id || item.data?.orderId
    }));

    if (filterStatus && filterStatus !== 'all') {
      items = items.filter(item => item.status === filterStatus);
    }

    // Enrich vendor info
    const vendorIds = Array.from(new Set(items.map(i => i.vendorId).filter(Boolean)));
    const vendorMap = new Map<string, any>();

    await Promise.allSettled(
      vendorIds.map(async vId => {
        const vendorData = await rtdbGet<any>(`vendors/${vId}`).catch(() => null);
        if (vendorData) {
          vendorMap.set(vId, vendorData);
        } else {
          const userData = await rtdbGet<any>(`users/${vId}`).catch(() => null);
          if (userData) vendorMap.set(vId, userData);
        }
      })
    );

    items = items.map(item => {
      const v = vendorMap.get(item.vendorId);
      return {
        ...item,
        vendorShopName: item.vendorShopName || v?.storeName || v?.shopName || v?.businessName || 'Unknown Shop',
        vendorName: item.vendorName || v?.ownerName || v?.name || v?.fullName || '',
        vendorEmail: item.vendorEmail || v?.email || '',
        vendorPhone: item.vendorPhone || v?.mobileNumber || v?.phone || '',
        vendorStatus: v?.status || 'active',
        vendorWarningCount: Number(v?.warningCount || 0)
      };
    });

    // Sort newest first
    items.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    return items;
  } catch (err) {
    console.error('Error fetching courier link reviews:', err);
    return [];
  }
}

/**
 * Fetches 100% complete review details for an order (merging courier_link_reviews, orders, and vendors).
 * This guarantees all 13 requested fields are present, even for older submissions.
 */
export async function fetchFullReviewDetails(orderId: string): Promise<CourierLinkReviewItem | null> {
  if (!orderId) return null;
  const cleanId = String(orderId).replace(/^#/, '');
  try {
    const review = await rtdbGet<CourierLinkReviewItem>(`courier_link_reviews/${cleanId}`);
    const order = await rtdbGet<any>(`orders/${cleanId}`);

    if (!review && !order) return null;

    const vendorId = review?.vendorId || order?.vendorId || '';
    let vendorData: any = null;
    if (vendorId) {
      vendorData = await rtdbGet<any>(`vendors/${vendorId}`).catch(() => null);
      if (!vendorData) {
        vendorData = await rtdbGet<any>(`users/${vendorId}`).catch(() => null);
      }
    }

    const rawItems = Array.isArray(review?.items) && review.items.length > 0
      ? review.items
      : (Array.isArray(order?.items) ? order.items : []);

    const items: CourierReviewProductItem[] = rawItems.map((i: any) => ({
      id: i.id || i.productId || '',
      name: i.name || i.title || 'Product',
      title: i.title || i.name || 'Product',
      image: i.image || i.thumbnail || i.images?.[0] || '',
      thumbnail: i.thumbnail || i.image || '',
      quantity: Number(i.quantity) || 1,
      price: Number(i.price) || 0,
      color: i.color || i.selectedColor || '',
      size: i.size || i.selectedSize || '',
      variant: i.variant || i.variation || '',
      sku: i.sku || ''
    }));

    const district = review?.district || order?.shippingAddress?.district || order?.district || order?.shippingAddress?.city || '';
    const thana = review?.thana || order?.shippingAddress?.thana || order?.shippingAddress?.upazila || order?.thana || order?.shippingAddress?.subDistrict || '';
    const area = review?.area || order?.shippingAddress?.area || order?.area || order?.shippingAddress?.street || '';
    const fullDeliveryAddress = review?.fullDeliveryAddress || order?.shippingAddress?.fullAddress || order?.shippingAddress?.address || order?.deliveryAddress || [area, thana, district].filter(Boolean).join(', ') || '';

    const enriched: CourierLinkReviewItem = {
      id: cleanId,
      orderId: cleanId,
      orderNumber: review?.orderNumber || order?.orderNumber || order?.id || cleanId,
      vendorId,
      vendorName: review?.vendorName || order?.vendorName || vendorData?.name || vendorData?.storeName || '',
      vendorShopName: review?.vendorShopName || order?.shopName || order?.storeName || vendorData?.storeName || vendorData?.shopName || '',
      vendorEmail: review?.vendorEmail || order?.vendorEmail || vendorData?.email || '',
      vendorPhone: review?.vendorPhone || order?.vendorPhone || vendorData?.phone || vendorData?.mobileNumber || '',
      vendorStatus: vendorData?.status || 'active',
      vendorWarningCount: Number(vendorData?.warningCount || 0),
      courierName: review?.courierName || order?.courierName || '',
      trackingId: review?.trackingId || order?.trackingNumber || order?.consignmentId || '',
      trackingUrl: review?.trackingUrl || order?.trackingUrl || '',
      status: review?.status || (order?.courierVerificationStatus === 'Verified' ? 'approved' : order?.courierVerificationStatus === 'Rejected' ? 'rejected' : 'pending'),
      customerName: review?.customerName || order?.customerName || order?.shippingAddress?.name || order?.userName || 'Customer',
      customerPhone: review?.customerPhone || order?.customerPhone || order?.shippingAddress?.phone || order?.userPhone || '',
      district,
      thana,
      area,
      fullDeliveryAddress,
      customerAddress: fullDeliveryAddress,
      totalAmount: Number(review?.totalAmount || order?.grandTotal || order?.total || order?.amount || 0),
      items,
      itemsSummary: review?.itemsSummary || items.map(i => `${i.name || i.title} (x${i.quantity})`).join(', '),
      itemsCount: review?.itemsCount || items.reduce((acc, curr) => acc + (curr.quantity || 1), 0),
      submittedAt: review?.submittedAt || order?.courierSubmittedAt || Date.now(),
      reviewedAt: review?.reviewedAt,
      reviewedBy: review?.reviewedBy,
      reviewNotes: review?.reviewNotes || order?.courierAdminNotes,
      rejectedReason: review?.rejectedReason || order?.courierRejectedReason,
      warningIssued: review?.warningIssued,
      warningReason: review?.warningReason,
      vendorSuspended: review?.vendorSuspended
    };

    return enriched;
  } catch (err) {
    console.error('Error fetching full review details:', err);
    return null;
  }
}

/**
 * Real-time subscription to pending reviews count and items
 */
export function subscribeToCourierReviews(
  callback: (items: CourierLinkReviewItem[], pendingCount: number) => void
): () => void {
  return rtdbSubscribe<Record<string, CourierLinkReviewItem>>('courier_link_reviews', (data) => {
    if (!data) {
      callback([], 0);
      return;
    }
    const items: CourierLinkReviewItem[] = Object.keys(data).map(key => ({
      ...data[key],
      id: key,
      orderId: data[key]?.orderId || key
    }));

    items.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    const pendingCount = items.filter(i => i.status === 'pending').length;
    callback(items, pendingCount);
  });
}

/**
 * Admin Action: Approve Tracking Link
 * - Marks Tracking Link as Verified
 * - Activates Courier Status Tracking
 * - Order status changes to 'Shipped'
 * - Customer's order status updates according to courier tracking
 * - Sends notification to Vendor & Customer
 */
export async function adminApproveCourierReview(params: {
  orderId: string;
  adminName?: string;
  notes?: string;
}): Promise<{ success: boolean; message: string }> {
  const { orderId, adminName = 'Admin', notes = '' } = params;
  const cleanId = String(orderId).replace(/^#/, '').trim();
  const pureOrderId = cleanId.includes('_') ? cleanId.split('_')[0] : cleanId;
  const now = Date.now();

  // 1. Get review item and existing order
  let review = (await rtdbGet<CourierLinkReviewItem>(`courier_link_reviews/${cleanId}`)) || 
               (cleanId !== pureOrderId ? await rtdbGet<CourierLinkReviewItem>(`courier_link_reviews/${pureOrderId}`) : null);
  if (!review) {
    const allReviews = await rtdbList<CourierLinkReviewItem>('courier_link_reviews');
    const matched = allReviews.find(r => 
      r.id === cleanId || 
      r.id === pureOrderId || 
      r.id.startsWith(`${pureOrderId}_`) ||
      r.data?.orderId === cleanId || 
      r.data?.orderId === pureOrderId ||
      r.data?.orderNumber === cleanId || 
      r.data?.orderNumber === pureOrderId
    );
    if (matched) review = { id: matched.id, ...matched.data };
  }

  let order = (await rtdbGet<any>(`orders/${cleanId}`)) || 
              (cleanId !== pureOrderId ? await rtdbGet<any>(`orders/${pureOrderId}`) : null) || 
              (await rtdbGet<any>(`vendor_orders/${cleanId}`)) ||
              (cleanId !== pureOrderId ? await rtdbGet<any>(`vendor_orders/${pureOrderId}`) : null);

  const approvedTrackingUrl = (
    review?.trackingUrl || 
    order?.approvedCourierTrackingUrl || 
    order?.trackingUrl || 
    order?.courierTrackingUrl || 
    ''
  ).trim();

  const approvedTrackingId = (
    review?.trackingId || 
    order?.trackingNumber || 
    order?.trackingId || 
    order?.consignmentId || 
    ''
  ).trim();

  const approvedCourierName = (
    review?.courierName || 
    order?.courierName || 
    'Standard Delivery Service'
  ).trim();

  // 2. Update courier_link_reviews with approved status and verified URL
  const reviewApprovePayload = {
    status: 'approved',
    reviewedAt: now,
    reviewedBy: adminName,
    reviewNotes: notes || 'অ্যাডমিন কর্তৃক অনুমোদিত',
    trackingUrl: approvedTrackingUrl,
    trackingId: approvedTrackingId,
    courierName: approvedCourierName,
    updatedAt: now
  };
  await rtdbUpdate(`courier_link_reviews/${cleanId}`, reviewApprovePayload);
  if (cleanId !== pureOrderId) {
    await rtdbUpdate(`courier_link_reviews/${pureOrderId}`, reviewApprovePayload);
  }

  // 3. Update Order to Shipped & Verified with approved courier tracking URL
  const approvePayload = {
    status: 'Shipped',
    vendorStatus: 'Shipped',
    courierVerificationStatus: 'Verified',
    courierAdminApproved: true,
    courierAdminApprovedBy: adminName,
    courierAdminApprovedAt: now,
    courierAdminNotes: notes || 'অ্যাডমিন কর্তৃক অনুমোদিত',
    shippedAt: new Date().toISOString(),
    trackingUrl: approvedTrackingUrl,
    courierTrackingUrl: approvedTrackingUrl,
    approvedCourierTrackingUrl: approvedTrackingUrl,
    trackingNumber: approvedTrackingId,
    trackingId: approvedTrackingId,
    consignmentId: approvedTrackingId,
    courierName: approvedCourierName,
    updatedAt: now
  };

  const updatePromises: Promise<any>[] = [
    rtdbUpdate(`orders/${cleanId}`, approvePayload),
    rtdbUpdate(`vendor_orders/${cleanId}`, approvePayload),
    rtdbUpdate(`reseller_orders/${cleanId}`, approvePayload),
    rtdbPush('order_status_logs', {
      orderId: cleanId,
      mainOrderId: pureOrderId,
      oldStatus: order?.status || 'Accepted',
      newStatus: 'Shipped',
      note: `কুরিয়ার ট্র্যাকিং লিংক অ্যাডমিন (${adminName}) কর্তৃক অনুমোদিত ও ভেরিফাইড হয়েছে। অর্ডার স্ট্যাটাস স্বয়ংক্রিয়ভাবে Shipped হয়েছে।`,
      timestamp: now
    })
  ];

  if (cleanId !== pureOrderId) {
    updatePromises.push(rtdbUpdate(`orders/${pureOrderId}`, approvePayload));
    updatePromises.push(rtdbUpdate(`vendor_orders/${pureOrderId}`, approvePayload));
    updatePromises.push(rtdbUpdate(`reseller_orders/${pureOrderId}`, approvePayload));
  }

  if (order?.orderId && order.orderId !== cleanId && order.orderId !== pureOrderId) {
    updatePromises.push(rtdbUpdate(`orders/${order.orderId}`, approvePayload));
    updatePromises.push(rtdbUpdate(`vendor_orders/${order.orderId}`, approvePayload));
  }
  if (review?.orderId && review.orderId !== cleanId && review.orderId !== pureOrderId) {
    updatePromises.push(rtdbUpdate(`orders/${review.orderId}`, approvePayload));
    updatePromises.push(rtdbUpdate(`vendor_orders/${review.orderId}`, approvePayload));
  }

  await Promise.allSettled(updatePromises);

  // 4. Update Firestore doc for complete persistence
  try {
    const orderDocRef = doc(db, 'orders', cleanId);
    await setDoc(orderDocRef, approvePayload, { merge: true });
    if (cleanId !== pureOrderId) {
      await setDoc(doc(db, 'orders', pureOrderId), approvePayload, { merge: true });
    }
    if (order?.orderId && order.orderId !== cleanId && order.orderId !== pureOrderId) {
      await setDoc(doc(db, 'orders', order.orderId), approvePayload, { merge: true });
    }
  } catch (fsErr) {
    console.warn('Firestore sync notice:', fsErr);
  }

  // 5. Update LocalStorage cache for immediate seamless rendering
  try {
    const pendingKey = `pending_order_${cleanId}`;
    const cached = safeStorage.getItem(pendingKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      safeStorage.setItem(pendingKey, JSON.stringify({ ...parsed, ...approvePayload }));
    }
    if (cleanId !== pureOrderId) {
      const pureKey = `pending_order_${pureOrderId}`;
      const pureCached = safeStorage.getItem(pureKey);
      if (pureCached) {
        const parsed = JSON.parse(pureCached);
        safeStorage.setItem(pureKey, JSON.stringify({ ...parsed, ...approvePayload }));
      }
    }
    const recentRaw = safeStorage.getItem('user_recent_orders');
    if (recentRaw) {
      const list: any[] = JSON.parse(recentRaw);
      const updatedList = list.map((o: any) => {
        if ((o.orderId || o.id) === cleanId || (order?.orderId && (o.orderId || o.id) === order.orderId)) {
          return { ...o, ...approvePayload };
        }
        return o;
      });
      safeStorage.setItem('user_recent_orders', JSON.stringify(updatedList));
    }
  } catch (stErr) {
    console.warn('LocalStorage sync notice:', stErr);
  }

  const orderNum = review?.orderNumber || order?.orderNumber || cleanId;
  const courierName = review?.courierName || order?.courierName || 'কুরিয়ার';
  const trackingId = review?.trackingId || order?.trackingNumber || '';

  // 4. Notify Vendor
  const vendorId = review?.vendorId || order?.vendorId;
  if (vendorId) {
    await sendVendorNotification({
      vendorId,
      title: `কুরিয়ার ট্র্যাকিং লিংক অনুমোদিত হয়েছে! (#${orderNum})`,
      message: `আপনার দেওয়া ${courierName} কুরিয়ার ট্র্যাকিং লিংকটি অ্যাডমিন যাচাই করে অনুমোদন করেছেন। অর্ডারটির স্ট্যাটাস Shipped হয়েছে এবং গ্রাহক এখন লাইভ ট্র্যাকিং ট্র্যাক করতে পারছেন।`,
      type: 'order',
      link: `/vendor/orders/${cleanId}`,
      metadata: { orderId: cleanId, courierName, trackingId }
    });
  }

  // 5. Notify Customer
  const customerId = order?.userId || order?.customerId;
  if (customerId) {
    try {
      await rtdbPush(`notifications/${customerId}`, {
        title: `আপনার অর্ডার #${orderNum} কুরিয়ারে শিপ করা হয়েছে!`,
        message: `${courierName}-এর মাধ্যমে আপনার পার্সেল পাঠানো হয়েছে। ট্র্যাকিং নম্বর: ${trackingId}। লাইভ ট্র্যাক করতে ক্লিক করুন।`,
        type: 'order',
        link: `/track-order/${cleanId}`,
        createdAt: now,
        read: false
      });
    } catch {
      // ignore
    }
  }

  return {
    success: true,
    message: 'কুরিয়ার ট্র্যাকিং লিংক অনুমোদিত হয়েছে এবং অর্ডারটি Shipped হিসেবে আপডেট করা হয়েছে।'
  };
}

/**
 * Admin Action: Reject Tracking Link
 * - Tracking Link is rejected
 * - Automatic notification to Vendor asking for real/valid tracking link
 * - Admin can optionally issue official Warning to Vendor
 * - Admin can optionally Suspend Vendor Account
 */
export async function adminRejectCourierReview(params: {
  orderId: string;
  adminName?: string;
  reason: string;
  issueWarning?: boolean;
  warningReason?: string;
  suspendVendor?: boolean;
  suspendReason?: string;
}): Promise<{ success: boolean; message: string; warningCount?: number; isSuspended?: boolean }> {
  const { 
    orderId, 
    adminName = 'Admin', 
    reason, 
    issueWarning = false, 
    warningReason = '', 
    suspendVendor = false, 
    suspendReason = '' 
  } = params;

  const cleanId = String(orderId).replace(/^#/, '').trim();
  const pureOrderId = cleanId.includes('_') ? cleanId.split('_')[0] : cleanId;
  const now = Date.now();

  const review = (await rtdbGet<CourierLinkReviewItem>(`courier_link_reviews/${cleanId}`)) ||
                 (cleanId !== pureOrderId ? await rtdbGet<CourierLinkReviewItem>(`courier_link_reviews/${pureOrderId}`) : null);
  const order = (await rtdbGet<any>(`orders/${cleanId}`)) ||
                (cleanId !== pureOrderId ? await rtdbGet<any>(`orders/${pureOrderId}`) : null);

  const vendorId = review?.vendorId || order?.vendorId;
  const orderNum = review?.orderNumber || order?.orderNumber || cleanId;

  // 1. Update courier_link_reviews
  const reviewRejectPayload = {
    status: 'rejected',
    reviewedAt: now,
    reviewedBy: adminName,
    rejectedReason: reason,
    warningIssued: !!issueWarning,
    warningReason: issueWarning ? (warningReason || reason) : '',
    vendorSuspended: !!suspendVendor,
    updatedAt: now
  };
  await rtdbUpdate(`courier_link_reviews/${cleanId}`, reviewRejectPayload);
  if (cleanId !== pureOrderId) {
    await rtdbUpdate(`courier_link_reviews/${pureOrderId}`, reviewRejectPayload);
  }

  // 2. Update Order in BOTH orders and vendor_orders: revert to Accepted state so vendor can submit a genuine link
  const rejectPayload = {
    status: 'Accepted',
    vendorStatus: 'Accepted',
    courierVerificationStatus: 'Rejected',
    courierAdminApproved: false,
    courierRejectedReason: reason,
    courierAdminRejectedAt: now,
    updatedAt: now
  };

  const rejectPromises: Promise<any>[] = [
    rtdbUpdate(`orders/${cleanId}`, rejectPayload),
    rtdbUpdate(`vendor_orders/${cleanId}`, rejectPayload),
    rtdbUpdate(`reseller_orders/${cleanId}`, rejectPayload),
    rtdbPush('order_status_logs', {
      orderId: cleanId,
      mainOrderId: pureOrderId,
      oldStatus: order?.status || 'Accepted',
      newStatus: 'Accepted',
      note: `কুরিয়ার ট্র্যাকিং লিংক অ্যাডমিন (${adminName}) কর্তৃক বাতিল হয়েছে। কারণ: ${reason}। ভেন্ডরকে পুনরায় সঠিক লিংক দেওয়ার সুযোগ দেওয়া হয়েছে।`,
      timestamp: now
    })
  ];

  if (cleanId !== pureOrderId) {
    rejectPromises.push(rtdbUpdate(`orders/${pureOrderId}`, rejectPayload));
    rejectPromises.push(rtdbUpdate(`vendor_orders/${pureOrderId}`, rejectPayload));
    rejectPromises.push(rtdbUpdate(`reseller_orders/${pureOrderId}`, rejectPayload));
  }

  await Promise.allSettled(rejectPromises);

  // 3. Send Automatic Notification to Vendor
  if (vendorId) {
    await sendVendorNotification({
      vendorId,
      title: `কুরিয়ার ট্র্যাকিং লিংক বাতিল করা হয়েছে (অর্ডার #${orderNum})`,
      message: `আপনার দেওয়া কুরিয়ার ট্র্যাকিং লিংকটি অ্যাডমিন যাচাই করে বাতিল করেছেন। কারণ: ${reason}। অনুগ্রহ করে আসল ও সঠিক কুরিয়ার ট্র্যাকিং লিংক দিন। ভুয়া ট্র্যাকিং লিংক দিলে অ্যাকাউন্ট সাসপেন্ড হতে পারে।`,
      type: 'order',
      link: `/vendor/orders/${cleanId}`,
      metadata: { orderId: cleanId, reason, action: 'courier_link_rejected' }
    });
  }

  let finalWarningCount = 0;
  let finalSuspended = false;

  // 4. Handle Warning
  if (issueWarning && vendorId) {
    const currentVendor = await rtdbGet<any>(`vendors/${vendorId}`);
    const prevWarnings = Number(currentVendor?.warningCount || 0);
    finalWarningCount = prevWarnings + 1;

    const warningText = warningReason || reason || 'ভুল বা ভুয়া কুরিয়ার ট্র্যাকিং লিংক প্রদান';

    await Promise.allSettled([
      rtdbUpdate(`vendors/${vendorId}`, {
        warningCount: finalWarningCount,
        lastWarningAt: now,
        lastWarningReason: warningText,
        updatedAt: now
      }),
      rtdbUpdate(`users/${vendorId}`, {
        warningCount: finalWarningCount,
        updatedAt: now
      }),
      rtdbPush(`vendor_warnings/${vendorId}`, {
        orderId: cleanId,
        orderNumber: orderNum,
        reason: warningText,
        issuedBy: adminName,
        issuedAt: now
      })
    ]);

    // Send High-Priority Warning Notification
    await sendVendorNotification({
      vendorId,
      title: `⚠️ ভেন্ডর সতর্কবার্তা (Warning #${finalWarningCount})`,
      message: `অর্ডার #${orderNum}-এ ভুল বা ভুয়া কুরিয়ার ট্র্যাকিং লিংক দেওয়ার জন্য আপনাকে সতর্কবার্তা দেওয়া হয়েছে। কারণ: ${warningText}। পরবর্তীতে অনুরূপ ঘটনা ঘটলে আপনার ভেন্ডর একাউন্ট সম্পূর্ণ স্থগিত (Suspend) করা হবে।`,
      type: 'system',
      link: `/vendor/orders/${cleanId}`,
      metadata: { warningCount: finalWarningCount, reason: warningText }
    });
  }

  // 5. Handle Suspension
  if (suspendVendor && vendorId) {
    finalSuspended = true;
    const sReason = suspendReason || reason || 'ভুয়া কুরিয়ার ট্র্যাকিং লিংক দিয়ে প্রতারণার চেষ্টা করায় ভেন্ডর অ্যাকাউন্ট স্থগিত করা হয়েছে।';

    await Promise.allSettled([
      rtdbUpdate(`vendors/${vendorId}`, {
        status: 'suspended',
        isSuspended: true,
        suspendedAt: now,
        suspendedReason: sReason,
        suspendedBy: adminName,
        updatedAt: now
      }),
      rtdbUpdate(`users/${vendorId}`, {
        status: 'suspended',
        isSuspended: true,
        suspendedAt: now,
        updatedAt: now
      }),
      rtdbUpdate(`vendor_profiles/${vendorId}`, {
        status: 'suspended',
        isSuspended: true,
        updatedAt: now
      })
    ]);

    await sendVendorNotification({
      vendorId,
      title: `⛔ আপনার ভেন্ডর একাউন্ট স্থগিত (Suspended) করা হয়েছে`,
      message: `ভুয়া বা বিভ্রান্তিকর কুরিয়ার ট্র্যাকিং লিংক প্রদান ও মার্কেটপ্লেসের নীতিমালা লঙ্ঘনের কারণে আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে। কারণ: ${sReason}। সাহায্যের জন্য অ্যাডমিন সাপোর্টে যোগাযোগ করুন।`,
      type: 'system',
      metadata: { suspended: true, reason: sReason }
    });
  }

  return {
    success: true,
    message: 'কুরিয়ার ট্র্যাকিং লিংক বাতিল করা হয়েছে এবং ভেন্ডরকে স্বয়ংক্রিয় নোটিফিকেশন পাঠানো হয়েছে।',
    warningCount: finalWarningCount,
    isSuspended: finalSuspended
  };
}
