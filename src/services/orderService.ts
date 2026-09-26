import { rtdbGet, rtdbSet, rtdbList, rtdbSubscribe } from '../lib/rtdb';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { safeStorage } from '../utils/storage';
import { calculateMultiVendorShipping } from '../utils/deliveryCalculator';

// In-memory instant cache for customer orders to prevent disappearing on navigation
const customerOrdersMemoryCache: Record<string, any[]> = {};

/**
 * Returns locally/memory cached customer orders (0ms instant access)
 */
export function getCachedCustomerOrders(userId?: string): any[] {
  if (!userId) return [];
  if (customerOrdersMemoryCache[userId] && customerOrdersMemoryCache[userId].length > 0) {
    return customerOrdersMemoryCache[userId];
  }
  try {
    const raw = safeStorage.getItem(`cached_customer_orders_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        customerOrdersMemoryCache[userId] = parsed;
        return parsed;
      }
    }
  } catch (e) {}

  // Fallback to recent orders
  try {
    const recent = safeStorage.getItem('user_recent_orders');
    if (recent) {
      const parsed = JSON.parse(recent);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const userOrders = parsed.filter((o: any) => o && (o.userId === userId || o.customerId === userId));
        if (userOrders.length > 0) {
          customerOrdersMemoryCache[userId] = userOrders;
          return userOrders;
        }
      }
    }
  } catch (e) {}

  return [];
}

/**
 * Updates memory and persistent storage cache for customer orders
 */
export function setCachedCustomerOrders(userId: string, orders: any[]): void {
  if (!userId || !Array.isArray(orders)) return;
  customerOrdersMemoryCache[userId] = orders;
  try {
    safeStorage.setItem(`cached_customer_orders_${userId}`, JSON.stringify(orders));
    safeStorage.setItem('user_recent_orders', JSON.stringify(orders));
  } catch (e) {}
}

export interface TrackingStage {
  step: number;
  key: string;
  title: string;
  bengaliTitle: string;
  description: string;
}

export const TRACKING_STAGES: TrackingStage[] = [
  {
    step: 1,
    key: 'Order Placed',
    title: 'Order Placed',
    bengaliTitle: 'অর্ডার সাবমিট হয়েছে',
    description: 'Order successfully created & recorded in system.'
  },
  {
    step: 2,
    key: 'Confirmed',
    title: 'Order Confirmed',
    bengaliTitle: 'অর্ডার নিশ্চিত করা হয়েছে',
    description: 'Order confirmed and sent to vendor.'
  },
  {
    step: 3,
    key: 'Processing',
    title: 'Vendor Accepted',
    bengaliTitle: 'ভেন্ডর গ্রহণ করেছে',
    description: 'Vendor accepted your order and preparing goods.'
  },
  {
    step: 4,
    key: 'Shipped',
    title: 'Handed to Courier',
    bengaliTitle: 'কুরিয়ারে হস্তান্তর',
    description: 'Package handed over to courier partner.'
  }
];

export function getTrackingStepIndex(status?: string): number {
  if (!status) return 0;
  const s = status.toLowerCase().trim();

  if (s === 'shipped' || s === 'dispatched') return 3;
  if (s === 'processing' || s === 'accepted' || s === 'vendor accepted' || s === 'packaging') return 2;
  if (s === 'confirmed' || s === 'verified') return 1;
  if (s === 'pending' || s === 'placed' || s === 'order placed') return 0;

  return 1;
}

export function getCourierTrackingUrl(courierName?: string, trackingNumber?: string, customUrl?: string): string {
  if (customUrl && customUrl.trim()) {
    const trimmed = customUrl.trim();
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  }
  if (!trackingNumber) return '';

  const cName = (courierName || '').toLowerCase().trim();
  const trk = encodeURIComponent(trackingNumber.trim());

  if (cName.includes('steadfast')) {
    return `https://steadfast.com.bd/t/${trk}`;
  }
  if (cName.includes('pathao')) {
    return `https://merchant.pathao.com/tracking?consignment_id=${trk}`;
  }
  if (cName.includes('redx')) {
    return `https://redx.com.bd/track-order/${trk}`;
  }
  if (cName.includes('paperfly')) {
    return `https://paperfly.com.bd/tracking?id=${trk}`;
  }
  if (cName.includes('ecourier') || cName.includes('e-courier')) {
    return `https://ecourier.com.bd/track?ref=${trk}`;
  }
  if (cName.includes('sundarban')) {
    return `https://sundarbancourierltd.com/track`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${courierName || 'Courier'} tracking ${trackingNumber}`)}`;
}

/**
 * Persists an order simultaneously into Realtime Database, Cloud Firestore, and safeStorage
 * Includes secure server-side/service-level verification of shipping fees and snapshot creation
 */
export async function saveOrderToDatabases(orderId: string, orderData: any): Promise<void> {
  // Validate and recalculate shipping to prevent any client-side tampering
  let validatedShippingCharge = Number(orderData.shippingCharge ?? orderData.deliveryCharge ?? 0);
  let validatedShippingSnapshot = orderData.shippingSnapshot;

  if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
    try {
      const custLoc = {
        district: orderData.shippingAddress?.district || '',
        upazila: orderData.shippingAddress?.upazila || '',
        division: orderData.shippingAddress?.division || '',
        area: orderData.shippingAddress?.area || ''
      };

      const recalculated = calculateMultiVendorShipping(
        orderData.items,
        custLoc,
        {
          paymentMethod: orderData.paymentMethod || 'cod',
          fallbackZone: orderData.deliveryZone
        }
      );

      // If client sent a tampered lower shipping charge, enforce verified amount
      if (validatedShippingCharge < recalculated.totalShippingFee) {
        validatedShippingCharge = recalculated.totalShippingFee;
      }

      // Always ensure immutable snapshot of vendor locations, routes, weights, and rates is preserved
      if (!validatedShippingSnapshot || !validatedShippingSnapshot.vendorPackages) {
        validatedShippingSnapshot = {
          calculatedAt: Date.now(),
          shippingEngine: 'pathao_multi_vendor_dynamic',
          totalShippingFee: recalculated.totalShippingFee,
          totalWeightKg: recalculated.totalWeightKg,
          totalCodCharge: recalculated.totalCodCharge,
          platformFee: recalculated.platformFee,
          customerLocation: custLoc,
          vendorPackages: recalculated.vendorPackages
        };
      }
    } catch (e) {
      console.warn('Error during order shipping verification:', e);
    }
  }

  const payload = {
    ...orderData,
    orderId,
    id: orderId,
    deliveryCharge: validatedShippingCharge,
    shippingCharge: validatedShippingCharge,
    shippingSnapshot: validatedShippingSnapshot || null,
    updatedAt: Date.now()
  };

  // 1. Immediately save to safeStorage (for 0ms instant local rendering)
  try {
    safeStorage.setItem(`pending_order_${orderId}`, JSON.stringify(payload));
    const recentRaw = safeStorage.getItem('user_recent_orders');
    const recentList: any[] = recentRaw ? JSON.parse(recentRaw) : [];
    const filtered = recentList.filter((o: any) => (o.orderId || o.id) !== orderId);
    filtered.unshift(payload);
    safeStorage.setItem('user_recent_orders', JSON.stringify(filtered.slice(0, 30)));
  } catch (storageErr) {
    console.warn('LocalStorage save order notice:', storageErr);
  }

  // 2. Concurrently save to Realtime Database and Cloud Firestore with a timeout safeguard
  const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 5000));

  const rtdbPromise = rtdbSet(`orders/${orderId}`, payload).catch((err) => {
    console.warn('RTDB save order warning:', err);
  });

  const firestorePromise = (async () => {
    try {
      const orderDocRef = doc(db, 'orders', orderId);
      await setDoc(orderDocRef, payload, { merge: true });
    } catch (fsErr) {
      console.warn('Firestore save order warning:', fsErr);
    }
  })();

  // Await both or timeout to prevent any infinite UI freezing
  await Promise.race([
    Promise.allSettled([rtdbPromise, firestorePromise]),
    timeoutPromise
  ]);
}

/**
 * Fetches all orders belonging to a customer from RTDB, Firestore, and localStorage
 */
export async function fetchCustomerOrders(
  userId: string,
  phone?: string | null,
  email?: string | null
): Promise<any[]> {
  const ordersMap = new Map<string, any>();

  // Normalize phone for flexible matching (e.g., stripping +88 or spaces)
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const last10Phone = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
  const cleanEmail = email ? email.toLowerCase().trim() : '';

  const matchesCustomer = (o: any) => {
    if (!o) return false;
    if (o.userId === userId || o.customerId === userId) return true;
    
    // Check mobile in shippingAddress
    if (last10Phone) {
      const oPhone = (o.shippingAddress?.mobile || o.customerPhone || o.phone || '').replace(/[^0-9]/g, '');
      if (oPhone && oPhone.slice(-10) === last10Phone) return true;
    }

    // Check email
    if (cleanEmail) {
      const oEmail = (o.shippingAddress?.email || o.customerEmail || o.email || '').toLowerCase().trim();
      if (oEmail && oEmail === cleanEmail) return true;
    }

    return false;
  };

  // Pre-seed with cached orders so we don't start from scratch
  const cachedOrders = getCachedCustomerOrders(userId);
  for (const c of cachedOrders) {
    const key = c.orderId || c.id;
    if (key) ordersMap.set(key, c);
  }

  // 1. Fetch from Realtime Database (fast single source of truth)
  try {
    const rtdbOrders = await rtdbList<any>('orders');
    for (const item of rtdbOrders) {
      const order = { id: item.id, ...item.data };
      if (matchesCustomer(order)) {
        const key = order.orderId || order.id || item.id;
        ordersMap.set(key, order);
      }
    }
  } catch (rtdbErr) {
    console.warn('Error fetching orders from RTDB:', rtdbErr);
  }

  // 2. Fetch from Firestore with strict 2000ms timeout protection
  try {
    const fsTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const fsFetch = (async () => {
      try {
        const q = query(collection(db, 'orders'), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((docSnap) => {
          const order = { id: docSnap.id, ...docSnap.data() };
          const key = (order as any).orderId || docSnap.id;
          if (!ordersMap.has(key) || (order as any).updatedAt > (ordersMap.get(key)?.updatedAt || 0)) {
            ordersMap.set(key, order);
          }
        });

        // Also check customerId field if present
        const qCustomer = query(collection(db, 'orders'), where('customerId', '==', userId));
        const custSnapshot = await getDocs(qCustomer);
        custSnapshot.forEach((docSnap) => {
          const order = { id: docSnap.id, ...docSnap.data() };
          const key = (order as any).orderId || docSnap.id;
          if (!ordersMap.has(key)) {
            ordersMap.set(key, order);
          }
        });
      } catch (e) {}
      return true;
    })();

    await Promise.race([fsFetch, fsTimeout]);
  } catch (fsErr) {
    console.warn('Error fetching orders from Firestore:', fsErr);
  }

  // 3. Fallback / Merge from safeStorage
  try {
    const recentRaw = safeStorage.getItem('user_recent_orders');
    if (recentRaw) {
      const recentList: any[] = JSON.parse(recentRaw);
      for (const order of recentList) {
        if (matchesCustomer(order)) {
          const key = order.orderId || order.id;
          if (!ordersMap.has(key)) {
            ordersMap.set(key, order);
          }
        }
      }
    }

    // Check individual pending orders
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('pending_order_')) {
        const val = safeStorage.getItem(k);
        if (val) {
          try {
            const order = JSON.parse(val);
            if (matchesCustomer(order)) {
              const key = order.orderId || order.id;
              if (!ordersMap.has(key)) {
                ordersMap.set(key, order);
              }
            }
          } catch (e) {}
        }
      }
    }
  } catch (storageErr) {
    console.warn('Error reading orders from localStorage:', storageErr);
  }

  const result = Array.from(ordersMap.values());
  // Sort descending by creation date
  result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // Update persistent cache so subsequent renders/page transitions have 0ms load
  if (result.length > 0) {
    setCachedCustomerOrders(userId, result);
  }

  return result;
}

/**
 * Real-time subscription to customer orders with instant cached delivery
 */
export function subscribeToCustomerOrders(
  userId: string,
  phone: string | null | undefined,
  email: string | null | undefined,
  callback: (orders: any[]) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  // 1. Immediately emit cached orders (0ms instant UI!)
  const initialCached = getCachedCustomerOrders(userId);
  if (initialCached.length > 0) {
    callback(initialCached);
  }

  // Clean phone and email matchers
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const last10Phone = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
  const cleanEmail = email ? email.toLowerCase().trim() : '';

  const matchesCustomer = (o: any) => {
    if (!o) return false;
    if (o.userId === userId || o.customerId === userId) return true;
    if (last10Phone) {
      const oPhone = (o.shippingAddress?.mobile || o.customerPhone || o.phone || '').replace(/[^0-9]/g, '');
      if (oPhone && oPhone.slice(-10) === last10Phone) return true;
    }
    if (cleanEmail) {
      const oEmail = (o.shippingAddress?.email || o.customerEmail || o.email || '').toLowerCase().trim();
      if (oEmail && oEmail === cleanEmail) return true;
    }
    return false;
  };

  // 2. Realtime subscription to RTDB orders
  const unsubRtdb = rtdbSubscribe<Record<string, any>>('orders', (snap) => {
    const map = new Map<string, any>();
    
    // Seed with existing cache first
    const currentCached = getCachedCustomerOrders(userId);
    for (const c of currentCached) {
      const k = c.orderId || c.id;
      if (k) map.set(k, c);
    }

    if (snap && typeof snap === 'object') {
      Object.entries(snap).forEach(([key, val]) => {
        if (val && typeof val === 'object') {
          const order = { id: key, ...val };
          if (matchesCustomer(order)) {
            const ordKey = order.orderId || order.id || key;
            map.set(ordKey, order);
          }
        }
      });
    }

    const list = Array.from(map.values());
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (list.length > 0) {
      setCachedCustomerOrders(userId, list);
      callback(list);
    } else {
      const existing = getCachedCustomerOrders(userId);
      if (existing.length > 0) {
        callback(existing);
      } else {
        callback([]);
      }
    }
  });

  // Also do initial full fetch to merge Firestore / offline orders in background
  fetchCustomerOrders(userId, phone, email).then(fullList => {
    if (fullList.length > 0) {
      setCachedCustomerOrders(userId, fullList);
      callback(fullList);
    }
  }).catch(() => {});

  return () => {
    unsubRtdb();
  };
}

/**
 * Fetches a single order by orderId/id across RTDB, Firestore, and localStorage
 */
export async function fetchOrderById(orderId: string): Promise<any | null> {
  if (!orderId) return null;
  const rawId = orderId.trim();
  const cleanId = rawId.replace(/^#/, '').trim();
  const pureId = cleanId.includes('_') ? cleanId.split('_')[0] : cleanId;

  // 1. Direct fetch from RTDB
  try {
    const rtdbOrder = await rtdbGet<any>(`orders/${cleanId}`);
    if (rtdbOrder) {
      return { id: cleanId, ...rtdbOrder };
    }
    if (cleanId !== pureId) {
      const pureOrder = await rtdbGet<any>(`orders/${pureId}`);
      if (pureOrder) {
        return { id: pureId, ...pureOrder };
      }
    }
  } catch (e) {
    console.warn('Error fetching order directly from RTDB:', e);
  }

  // 2. Direct fetch from vendor_orders in RTDB
  try {
    const vOrder = await rtdbGet<any>(`vendor_orders/${cleanId}`);
    if (vOrder) {
      return { id: cleanId, ...vOrder };
    }
    if (cleanId !== pureId) {
      const pureVOrder = await rtdbGet<any>(`vendor_orders/${pureId}`);
      if (pureVOrder) {
        return { id: pureId, ...pureVOrder };
      }
    }
  } catch (e) {
    console.warn('Error fetching order from vendor_orders:', e);
  }

  // 3. Local storage fallback (0ms instant)
  try {
    const localPending = safeStorage.getItem(`pending_order_${cleanId}`) || safeStorage.getItem(`pending_order_${pureId}`);
    if (localPending) {
      return JSON.parse(localPending);
    }
    const recentRaw = safeStorage.getItem('user_recent_orders');
    if (recentRaw) {
      const list: any[] = JSON.parse(recentRaw);
      const found = list.find((o: any) => o.orderId === cleanId || o.id === cleanId || o.orderId === pureId || o.id === pureId);
      if (found) return found;
    }
  } catch (e) {}

  // 4. Scan RTDB list for match by orderId/mainOrderId
  try {
    const allRtdb = await rtdbList<any>('orders');
    const matched = allRtdb.find(
      (item) => item.id === cleanId || item.id === pureId || 
                item.data?.orderId === cleanId || item.data?.orderId === pureId ||
                item.data?.mainOrderId === cleanId || item.data?.mainOrderId === pureId ||
                item.data?.id === cleanId || item.data?.id === pureId
    );
    if (matched) {
      return { id: matched.id, ...matched.data };
    }
  } catch (e) {
    console.warn('Error scanning RTDB orders:', e);
  }

  // 5. Firestore fallback with strict 1500ms timeout safeguard
  try {
    const fsTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
    const fsFetch = (async () => {
      try {
        const docSnap = await getDoc(doc(db, 'orders', cleanId));
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() };
        }
        if (cleanId !== pureId) {
          const pureSnap = await getDoc(doc(db, 'orders', pureId));
          if (pureSnap.exists()) {
            return { id: pureSnap.id, ...pureSnap.data() };
          }
        }
        const q = query(collection(db, 'orders'), where('orderId', '==', cleanId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return { id: snap.docs[0].id, ...snap.docs[0].data() };
        }
      } catch (e) {}
      return null;
    })();

    const fsResult = await Promise.race([fsFetch, fsTimeout]);
    if (fsResult) return fsResult;
  } catch (e) {
    console.warn('Firestore fallback warning:', e);
  }

  return null;
}
