import { rtdbGet, rtdbSet, rtdbUpdate, rtdbSubscribe, rtdbList } from '../lib/rtdb';

export type NotificationCategory = 
  | 'order' 
  | 'message' 
  | 'promo' 
  | 'wallet' 
  | 'review' 
  | 'withdraw' 
  | 'system' 
  | 'badge' 
  | 'mlm' 
  | 'vendor' 
  | 'reseller';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type?: NotificationCategory | string;
  link?: string;
  createdAt: number;
  read?: boolean;
  isRead?: boolean; // Evaluated dynamically per user
  seenAt?: number;
  userId?: string;
  vendorId?: string;
  targetType?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
}

export interface UserReadRecord {
  read: boolean;
  seenAt: number;
}

export interface NotificationAnalyticsData {
  notificationId: string;
  sentCount: number;
  openedCount: number;
  readCount: number;
  detailsViewCount: number;
  linkClickCount: number;
  targetVisitedCount: number;
  ctr?: number;
  openedUsers?: Record<string, number>;
  readUsers?: Record<string, number>;
  detailsViewedUsers?: Record<string, number>;
  linkClickedUsers?: Record<string, number>;
  targetVisitedUsers?: Record<string, number>;
  lastUpdated: number;
}

/**
 * Format relative time in friendly Bengali
 */
export function formatBengaliTimeAgo(timestamp?: number): string {
  if (!timestamp) return 'এইমাত্র';
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  
  if (diffSec < 60) return 'এইমাত্র';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${formatBengaliDigit(diffMin)} মিনিট আগে`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${formatBengaliDigit(diffHours)} ঘণ্টা আগে`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${formatBengaliDigit(diffDays)} দিন আগে`;
  
  try {
    return new Date(timestamp).toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return `${formatBengaliDigit(diffDays)} দিন আগে`;
  }
}

export function formatBengaliDigit(num: number | string): string {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num)
    .split('')
    .map(c => {
      const idx = parseInt(c, 10);
      return isNaN(idx) ? c : (bengaliDigits[idx] || c);
    })
    .join('');
}

/**
 * Synthesize a clean, subtle chime sound using Web Audio API
 */
export function playNotificationChime(): void {
  try {
    if (typeof window === 'undefined') return;
    const isMuted = localStorage.getItem('rj_notification_sound_muted') === 'true';
    if (isMuted) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Harmonic bell chime tone 1: G5 (784Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: C6 (1046.5Hz) - bright ascending chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.5, now + 0.08);
    gain2.gain.setValueAtTime(0.22, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.6);
  } catch {
    // Audio context may be restricted before user interaction
  }
}

/**
 * Checks if notification sound is muted in local preferences
 */
export function isNotificationSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('rj_notification_sound_muted') === 'true';
}

/**
 * Toggles notification sound mute state
 */
export function toggleNotificationSound(muted?: boolean): boolean {
  if (typeof window === 'undefined') return false;
  const current = isNotificationSoundMuted();
  const next = muted !== undefined ? muted : !current;
  localStorage.setItem('rj_notification_sound_muted', String(next));
  return next;
}

/**
 * Marks a specific notification as Read/Seen for a user in RTDB.
 * Path: user_notification_reads/${userId}/${notificationId} = { read: true, seenAt: Date.now() }
 * This guarantees strict per-user isolation and durable cloud persistence!
 */
export async function markNotificationAsReadInRTDB(
  userId: string,
  notificationId: string
): Promise<void> {
  if (!userId || !notificationId) return;

  const readRecord: UserReadRecord = {
    read: true,
    seenAt: Date.now()
  };

  try {
    await rtdbSet(`user_notification_reads/${userId}/${notificationId}`, readRecord);
  } catch (err) {
    console.warn(`[NotificationService] Failed to set user_notification_reads:`, err);
  }

  // Also update direct user node if the notification is private to this user
  try {
    await rtdbUpdate(`notifications/${userId}/${notificationId}`, {
      read: true,
      seenAt: Date.now()
    }).catch(() => {});
  } catch {
    // optional node
  }

  // Also update vendor_notifications if applicable
  try {
    await rtdbUpdate(`vendor_notifications/${notificationId}`, {
      read: true,
      seenAt: Date.now()
    }).catch(() => {});
  } catch {
    // optional node
  }
}

/**
 * Marks all given notifications as Read for a user in RTDB in batch
 */
export async function markAllNotificationsAsReadInRTDB(
  userId: string,
  notificationIds: string[]
): Promise<void> {
  if (!userId || !notificationIds || notificationIds.length === 0) return;

  const now = Date.now();
  const updates: Record<string, UserReadRecord> = {};

  notificationIds.forEach(id => {
    if (id) {
      updates[id] = {
        read: true,
        seenAt: now
      };
    }
  });

  try {
    await rtdbUpdate(`user_notification_reads/${userId}`, updates);
  } catch (err) {
    console.warn(`[NotificationService] Failed to mark all notifications as read in RTDB:`, err);
  }

  // Also batch update private notifications and vendor notifications
  Promise.allSettled(
    notificationIds.map(id => 
      Promise.allSettled([
        rtdbUpdate(`notifications/${userId}/${id}`, { read: true, seenAt: now }),
        rtdbUpdate(`vendor_notifications/${id}`, { read: true, seenAt: now })
      ])
    )
  ).catch(() => {});
}

/**
 * Subscribes to per-user read/seen statuses in Realtime Database.
 * Returns an unsubscribe function.
 */
export function subscribeToUserReads(
  userId: string,
  callback: (reads: Record<string, UserReadRecord>) => void
): () => void {
  if (!userId) {
    callback({});
    return () => {};
  }

  return rtdbSubscribe<Record<string, any>>(
    `user_notification_reads/${userId}`,
    (snap) => {
      const records: Record<string, UserReadRecord> = {};
      if (snap && typeof snap === 'object') {
        Object.entries(snap).forEach(([key, val]) => {
          if (val && typeof val === 'object' && (val as any).read) {
            records[key] = val as UserReadRecord;
          } else if (val === true) {
            records[key] = { read: true, seenAt: Date.now() };
          }
        });
      }
      callback(records);
    }
  );
}

/**
 * Unified listener that aggregates:
 * 1) User's private notifications (`notifications/${userId}`)
 * 2) Global / broadcast notifications (`notifications`)
 * 3) Vendor notifications if role is Vendor (`vendor_notifications`)
 * 
 * Includes deep deduplication by unique ID and fingerprint, and filters out
 * internal chat messages from general notifications.
 */
export function subscribeToAllUserNotifications(
  userId: string,
  userRole: string | undefined,
  callback: (notifications: AppNotification[]) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const role = (userRole || 'user').toLowerCase();
  const rawMap = new Map<string, AppNotification>();

  const emit = () => {
    const rawList = Array.from(rawMap.values());
    
    // Strict deduplication by ID and fingerprint (title + message within 15s window)
    const seenIds = new Set<string>();
    const seenFingerprints = new Set<string>();
    const deduplicated: AppNotification[] = [];

    for (const item of rawList) {
      if (!item || !item.id) continue;
      // Do not mix raw chat messages with general marketing/system notifications
      if (item.type === 'message' || item.type === 'chat') continue;

      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);

      const timeBucket = Math.floor((item.createdAt || 0) / 15000);
      const fingerprint = `${(item.title || '').trim()}::${(item.message || '').trim()}::${timeBucket}`;
      if (seenFingerprints.has(fingerprint)) continue;
      seenFingerprints.add(fingerprint);

      deduplicated.push(item);
    }

    deduplicated.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(deduplicated);
  };

  // 1. Listen to private user notifications in RTDB: notifications/${userId}
  const unsubUserPrivate = rtdbSubscribe<Record<string, any>>(
    `notifications/${userId}`,
    (snap) => {
      if (snap && typeof snap === 'object') {
        Object.entries(snap).forEach(([id, item]) => {
          if (item && typeof item === 'object' && (item.title || item.message || item.body)) {
            rawMap.set(id, {
              id,
              title: item.title || 'বিজ্ঞপ্তি',
              message: item.message || item.body || '',
              type: item.type || 'order',
              link: item.link || (item.productId ? `/product/${item.productId}` : (item.route ? `/${item.route}` : (item.metadata?.link || (item.metadata?.productId ? `/product/${item.metadata.productId}` : undefined)))),
              createdAt: Number(item.createdAt || item.timestamp || Date.now()),
              userId,
              imageUrl: item.imageUrl || item.image || item.banner || item.metadata?.imageUrl || item.metadata?.image,
              metadata: item.metadata || (item.productId ? { productId: item.productId } : undefined)
            });
          }
        });
      }
      emit();
    }
  );

  // 2. Listen to global / broadcast notifications in RTDB: notifications
  const unsubGlobal = rtdbSubscribe<Record<string, any>>(
    'notifications',
    (snap) => {
      if (snap && typeof snap === 'object') {
        Object.entries(snap).forEach(([id, item]) => {
          if (!item || typeof item !== 'object') return;

          // Guard against nested user buckets: if item has no direct notification fields, skip
          const hasDirectFields = Boolean(item.title || item.message || item.body || item.type || item.createdAt);
          if (!hasDirectFields) return;

          const target = String(item.targetType || 'all').toLowerCase();
          const isSingle = target === 'single' || Boolean(item.targetUserId) || (Boolean(item.userId) && target !== 'all');
          
          let matchesRole = false;
          if (isSingle) {
            matchesRole = item.userId === userId || item.targetUserId === userId;
          } else if (target === 'all') {
            matchesRole = true;
          } else if (target === 'users' || target === 'user' || target === 'customer' || target === 'general') {
            matchesRole = role === 'user' || role === 'customer' || !role;
          } else if (target === 'vendors' || target === 'vendor') {
            matchesRole = role === 'vendor' || role === 'admin';
          } else if (target === 'resellers' || target === 'reseller' || target === 'mlm') {
            matchesRole = role === 'reseller' || role === 'admin';
          }

          if (matchesRole) {
            rawMap.set(id, {
              id,
              title: item.title || 'নোটিফিকেশন',
              message: item.message || item.body || '',
              type: item.type || (target === 'vendors' ? 'vendor' : target === 'resellers' ? 'reseller' : 'system'),
              link: item.link || (item.productId ? `/product/${item.productId}` : (item.route ? `/${item.route}` : (item.metadata?.link || (item.metadata?.productId ? `/product/${item.metadata.productId}` : undefined)))),
              createdAt: Number(item.createdAt || item.timestamp || Date.now()),
              targetType: item.targetType,
              imageUrl: item.imageUrl || item.image || item.banner || item.metadata?.imageUrl || item.metadata?.image,
              metadata: item.metadata || (item.productId ? { productId: item.productId } : undefined)
            });
          }
        });
      }
      emit();
    }
  );

  // 3. If user is vendor, also subscribe to vendor_notifications
  let unsubVendor: (() => void) | null = null;
  if (role === 'vendor' || role === 'admin') {
    unsubVendor = rtdbSubscribe<Record<string, any>>(
      'vendor_notifications',
      (snap) => {
        if (snap && typeof snap === 'object') {
          Object.entries(snap).forEach(([id, item]) => {
            if (item && typeof item === 'object') {
              if (item.vendorId === userId || item.userId === userId || role === 'admin') {
                rawMap.set(id, {
                  id,
                  title: item.title || 'ভেন্ডর আপডেট',
                  message: item.message || item.body || '',
                  type: item.type || 'vendor',
                  link: item.link || '/vendor/notifications',
                  createdAt: Number(item.createdAt || item.timestamp || Date.now()),
                  vendorId: item.vendorId,
                  metadata: item.metadata
                });
              }
            }
          });
        }
        emit();
      }
    );
  }

  return () => {
    unsubUserPrivate();
    unsubGlobal();
    if (unsubVendor) unsubVendor();
  };
}

export interface AdminNotificationPayload {
  title: string;
  message: string;
  targetType: 'all' | 'users' | 'vendors' | 'resellers' | 'single';
  targetUserId?: string;
  targetUserName?: string;
  type?: string;
  imageUrl?: string;
  link?: string;
  productId?: string;
  adminId?: string;
  adminName?: string;
  sentCountEstimate?: number;
}

/**
 * Dispatches an admin notification to RTDB in real time and initializes analytics.
 * Avoids duplicate writes to root notifications when targeting a single user.
 */
export async function sendAdminNotification(
  payload: AdminNotificationPayload
): Promise<{ success: boolean; id?: string }> {
  const now = Date.now();
  const id = `notif_${now}_${Math.random().toString(36).substring(2, 8)}`;

  let finalLink = payload.link;
  if (payload.productId && !finalLink) {
    finalLink = `/product/${payload.productId}`;
  }

  const notifData: Record<string, any> = {
    id,
    title: payload.title,
    message: payload.message,
    body: payload.message,
    type: payload.type || 'system',
    targetType: payload.targetType,
    imageUrl: payload.imageUrl || null,
    link: finalLink || null,
    productId: payload.productId || null,
    createdAt: now,
    timestamp: now,
    adminId: payload.adminId || null,
    adminName: payload.adminName || 'Admin',
    status: 'sent'
  };

  if (payload.targetType === 'single' && payload.targetUserId) {
    notifData.userId = payload.targetUserId;
    notifData.targetUserId = payload.targetUserId;
    if (payload.targetUserName) {
      notifData.targetUserName = payload.targetUserName;
    }
  }

  const tasks: Promise<any>[] = [];

  // 1. History log for Admin Panel
  tasks.push(rtdbSet(`notificationHistory/${id}`, notifData));

  // 2. Real-time distribution (Strictly no duplicate paths!)
  if (payload.targetType === 'single' && payload.targetUserId) {
    // Write ONLY to user's private inbox
    tasks.push(rtdbSet(`notifications/${payload.targetUserId}/${id}`, notifData));
  } else if (payload.targetType === 'vendors') {
    // Write to vendor notifications
    tasks.push(rtdbSet(`vendor_notifications/${id}`, {
      ...notifData,
      vendorId: 'all',
      isGlobal: true
    }));
  } else {
    // Broadcast for 'all', 'users', 'resellers'
    tasks.push(rtdbSet(`notifications/${id}`, notifData));
  }

  // 3. Initialize Analytics in RTDB
  const initialSentCount = payload.targetType === 'single' ? 1 : Math.max(1, payload.sentCountEstimate || 1);
  const analyticsRecord: NotificationAnalyticsData = {
    notificationId: id,
    sentCount: initialSentCount,
    openedCount: 0,
    readCount: 0,
    detailsViewCount: 0,
    linkClickCount: 0,
    targetVisitedCount: 0,
    lastUpdated: now
  };
  tasks.push(rtdbSet(`notification_analytics/${id}`, analyticsRecord));

  await Promise.allSettled(tasks);
  return { success: true, id };
}

/**
 * Tracks granular notification events in RTDB:
 * - opened: Notification was displayed in the notification box/list
 * - read: Notification was marked as read by the user
 * - details_view: User opened and viewed the notification details page
 * - link_click: User clicked on the Product/Shop/Action link
 * - target_visited: User reached the destination product/shop page
 */
export async function trackNotificationEvent(
  notificationId: string,
  eventType: 'opened' | 'read' | 'details_view' | 'link_click' | 'target_visited',
  userId?: string
): Promise<void> {
  if (!notificationId) return;

  try {
    // Identify unique client per session or authenticated user
    let clientKey = userId;
    if (!clientKey) {
      if (typeof window !== 'undefined') {
        clientKey = sessionStorage.getItem('rj_notif_client_id') || '';
        if (!clientKey) {
          clientKey = 'c_' + Math.random().toString(36).substring(2, 9);
          sessionStorage.setItem('rj_notif_client_id', clientKey);
        }
      } else {
        clientKey = 'anon_system';
      }
    }

    const safeUserKey = String(clientKey).replace(/[.#$[\]/]/g, '_');
    const path = `notification_analytics/${notificationId}`;
    const now = Date.now();

    // Fetch existing or initialize
    const current = await rtdbGet<NotificationAnalyticsData>(path).catch(() => null);
    const data: NotificationAnalyticsData = current || {
      notificationId,
      sentCount: 1,
      openedCount: 0,
      readCount: 0,
      detailsViewCount: 0,
      linkClickCount: 0,
      targetVisitedCount: 0,
      lastUpdated: now
    };

    let changed = false;

    if (eventType === 'opened') {
      const map = data.openedUsers || {};
      if (!map[safeUserKey]) {
        map[safeUserKey] = now;
        data.openedUsers = map;
        data.openedCount = Object.keys(map).length;
        changed = true;
      }
    } else if (eventType === 'read') {
      const map = data.readUsers || {};
      if (!map[safeUserKey]) {
        map[safeUserKey] = now;
        data.readUsers = map;
        data.readCount = Object.keys(map).length;
        changed = true;
      }
    } else if (eventType === 'details_view') {
      const map = data.detailsViewedUsers || {};
      if (!map[safeUserKey]) {
        map[safeUserKey] = now;
        data.detailsViewedUsers = map;
        data.detailsViewCount = Object.keys(map).length;
        changed = true;
      }
    } else if (eventType === 'link_click') {
      const map = data.linkClickedUsers || {};
      if (!map[safeUserKey]) {
        map[safeUserKey] = now;
        data.linkClickedUsers = map;
        data.linkClickCount = Object.keys(map).length;
        changed = true;
      }
    } else if (eventType === 'target_visited') {
      const map = data.targetVisitedUsers || {};
      if (!map[safeUserKey]) {
        map[safeUserKey] = now;
        data.targetVisitedUsers = map;
        data.targetVisitedCount = Object.keys(map).length;
        changed = true;
      }
    }

    if (changed) {
      data.lastUpdated = now;
      await rtdbSet(path, data);
    }
  } catch (err) {
    console.warn('Could not track notification event:', err);
  }
}

/**
 * Fetch analytics data for a specific notification from RTDB
 */
export async function getNotificationAnalytics(
  notificationId: string
): Promise<NotificationAnalyticsData | null> {
  if (!notificationId) return null;
  return rtdbGet<NotificationAnalyticsData>(`notification_analytics/${notificationId}`).catch(() => null);
}

/**
 * Real-time subscription to analytics of a specific notification
 */
export function subscribeToNotificationAnalytics(
  notificationId: string,
  callback: (data: NotificationAnalyticsData | null) => void
): () => void {
  if (!notificationId) {
    callback(null);
    return () => {};
  }
  return rtdbSubscribe<NotificationAnalyticsData>(`notification_analytics/${notificationId}`, (snap) => {
    callback(snap || null);
  });
}

/**
 * Fetch all notification analytics records from RTDB
 */
export async function fetchAllNotificationAnalytics(): Promise<Record<string, NotificationAnalyticsData>> {
  try {
    const list = await rtdbList<NotificationAnalyticsData>('notification_analytics').catch(() => []);
    const map: Record<string, NotificationAnalyticsData> = {};
    list.forEach(({ id, data }) => {
      if (id && data) {
        map[id] = { ...data, notificationId: id };
      }
    });
    return map;
  } catch (err) {
    console.warn('Error loading all notification analytics:', err);
    return {};
  }
}

/**
 * Fetch a single notification by ID from RTDB
 */
export async function getNotificationById(
  id: string,
  userId?: string
): Promise<AppNotification | null> {
  if (!id) return null;

  let data: any = null;

  // 1. Global notifications
  data = await rtdbGet<any>(`notifications/${id}`).catch(() => null);

  // 2. Private notifications
  if (!data && userId) {
    data = await rtdbGet<any>(`notifications/${userId}/${id}`).catch(() => null);
  }

  // 3. Notification history
  if (!data) {
    data = await rtdbGet<any>(`notificationHistory/${id}`).catch(() => null);
  }

  // 4. Vendor notifications
  if (!data) {
    data = await rtdbGet<any>(`vendor_notifications/${id}`).catch(() => null);
  }

  if (data) {
    return {
      id,
      title: data.title || 'বিজ্ঞপ্তি',
      message: data.message || data.body || '',
      type: data.type || 'system',
      link: data.link || (data.productId ? `/product/${data.productId}` : (data.route ? `/${data.route}` : (data.metadata?.link || (data.metadata?.productId ? `/product/${data.metadata.productId}` : undefined)))),
      createdAt: Number(data.createdAt || data.timestamp || Date.now()),
      userId: data.userId || data.targetUserId,
      targetType: data.targetType,
      imageUrl: data.imageUrl || data.image || data.banner || data.metadata?.imageUrl || data.metadata?.image,
      metadata: data.metadata || (data.productId ? { productId: data.productId } : undefined)
    };
  }

  return null;
}
