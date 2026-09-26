import { rtdbPush, rtdbUpdate, rtdbGet } from '../lib/rtdb';

export type VendorNotificationType = 
  | 'order' 
  | 'message' 
  | 'review' 
  | 'withdraw' 
  | 'inventory' 
  | 'badge' 
  | 'system';

export interface VendorNotification {
  id: string;
  vendorId: string;
  userId?: string;
  title: string;
  message: string;
  type: VendorNotificationType;
  link?: string;
  read: boolean;
  createdAt: number;
  timestamp?: number;
  metadata?: Record<string, any>;
}

/**
 * Bengali Number Formatter
 */
export function formatBengaliNumber(num: number): string {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num
    .toString()
    .split('')
    .map(d => bengaliDigits[parseInt(d, 10)] ?? d)
    .join('');
}

/**
 * Audio Chime Synthesizer via Web Audio API.
 * Produces a clear, pleasant double-tone notification bell without external audio files.
 */
export function playNotificationSound(): void {
  try {
    if (typeof window === 'undefined') return;
    const isMuted = localStorage.getItem('vendor_notification_sound_muted') === 'true';
    if (isMuted) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2: A5 (880 Hz) - slightly delayed for a pleasant chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.1);
    gain2.gain.setValueAtTime(0.3, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.55);
  } catch (err) {
    console.debug('Could not play notification sound:', err);
  }
}

/**
 * Checks if sound alert is currently muted.
 */
export function isNotificationSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('vendor_notification_sound_muted') === 'true';
}

/**
 * Toggles the sound alert mute setting.
 */
export function toggleNotificationSound(muted?: boolean): boolean {
  if (typeof window === 'undefined') return false;
  const current = isNotificationSoundMuted();
  const next = muted !== undefined ? muted : !current;
  localStorage.setItem('vendor_notification_sound_muted', next ? 'true' : 'false');
  if (!next) {
    playNotificationSound();
  }
  return next;
}

/**
 * Returns current browser/device notification permission status.
 */
export function getDeviceNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Requests device/mobile notification permission from the user.
 */
export async function requestMobileNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      showDeviceNotification({
        title: 'RJ World BD — নোটিফিকেশন চালু হয়েছে',
        body: 'আপনার মোবাইলে এখন থেকে নতুন অর্ডার, মেসেজ ও রিভিউ এর লাইভ নোটিফিকেশন আসবে!',
        tag: 'welcome'
      });
      playNotificationSound();
    }
    return permission;
  } catch (err) {
    console.warn('Error requesting mobile notification permission:', err);
    return 'denied';
  }
}

/**
 * Triggers a native device / mobile notification.
 */
export function showDeviceNotification({
  title,
  body,
  link,
  tag,
  icon
}: {
  title: string;
  body: string;
  link?: string;
  tag?: string;
  icon?: string;
}): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notif = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: tag || `vendor-notif-${Date.now()}`,
      silent: false
    });

    notif.onclick = () => {
      window.focus();
      if (link) {
        window.location.href = link;
      }
      notif.close();
    };
  } catch (err) {
    console.debug('Failed to show native device notification:', err);
  }
}

/**
 * Core function to send a notification to a vendor in Firebase RTDB.
 */
export async function sendVendorNotification(params: {
  vendorId: string;
  title: string;
  message: string;
  type: VendorNotificationType;
  link?: string;
  metadata?: Record<string, any>;
}): Promise<string | null> {
  const { vendorId, title, message, type, link, metadata } = params;
  if (!vendorId || vendorId === 'admin') return null;

  try {
    const now = Date.now();
    const payload = {
      vendorId,
      userId: vendorId,
      title,
      message,
      type,
      link: link || '',
      read: false,
      createdAt: now,
      timestamp: now,
      metadata: metadata || null
    };

    const notifId = await rtdbPush('vendor_notifications', payload);

    // Also dual-write to general notifications path so user never misses alerts
    try {
      await rtdbPush(`notifications/${vendorId}`, {
        title,
        message,
        type: 'order',
        link: link || '',
        createdAt: now,
        timestamp: now,
        read: false
      });
    } catch (_) {}

    return notifId;
  } catch (err) {
    console.warn('Error sending vendor notification to RTDB:', err);
    return null;
  }
}

/**
 * 1. New Order Notification for Vendor
 */
export async function notifyVendorNewOrder(
  vendorId: string,
  orderId: string,
  customerName: string,
  totalAmount: number,
  itemsCount: number = 1
): Promise<string | null> {
  const cleanId = String(orderId).replace(/^#/, '');
  const title = `নতুন অর্ডার গ্রহণ করা হয়েছে! (#${cleanId})`;
  const message = `${customerName || 'একজন গ্রাহক'} ৳${totalAmount.toLocaleString()} মূল্যের ${itemsCount}টি পণ্যের অর্ডার দিয়েছেন। বিস্তারিত দেখতে ক্লিক করুন।`;

  return sendVendorNotification({
    vendorId,
    title,
    message,
    type: 'order',
    link: `/vendor/orders/${cleanId}`,
    metadata: { orderId: cleanId, totalAmount, itemsCount, customerName }
  });
}

/**
 * 2. Order Status Update for Vendor
 */
export async function notifyVendorOrderStatus(
  vendorId: string,
  orderId: string,
  status: string,
  note?: string
): Promise<string | null> {
  const cleanId = String(orderId).replace(/^#/, '');
  const title = `অর্ডার স্ট্যাটাস আপডেট (#${cleanId})`;
  const message = note || `অর্ডার #${cleanId} এর বর্তমান অবস্থা: "${status}"।`;

  return sendVendorNotification({
    vendorId,
    title,
    message,
    type: 'order',
    link: `/vendor/orders/${cleanId}`,
    metadata: { orderId: cleanId, status }
  });
}

/**
 * 3. New Chat Message Notification for Vendor
 */
export async function notifyVendorNewMessage(
  vendorId: string,
  customerName: string,
  messagePreview: string,
  customerId: string
): Promise<string | null> {
  const title = `${customerName || 'কাস্টমার'} থেকে নতুন মেসেজ`;
  const message = messagePreview ? (messagePreview.length > 80 ? `${messagePreview.slice(0, 80)}...` : messagePreview) : 'একটি নতুন মেসেজ পাঠিয়েছেন।';

  return sendVendorNotification({
    vendorId,
    title,
    message,
    type: 'message',
    link: `/vendor/chat/${customerId}`,
    metadata: { customerId, customerName }
  });
}

/**
 * 4. New Product Review Notification for Vendor
 */
export async function notifyVendorNewReview(
  vendorId: string,
  productName: string,
  rating: number,
  customerName: string,
  reviewText: string,
  reviewId?: string
): Promise<string | null> {
  const stars = '★'.repeat(Math.max(1, Math.min(5, Math.round(rating))));
  const title = `নতুন রিভিউ (${stars}): ${productName}`;
  const message = `${customerName || 'গ্রাহক'} লিখেছেন: "${reviewText.length > 70 ? `${reviewText.slice(0, 70)}...` : reviewText}"`;

  return sendVendorNotification({
    vendorId,
    title,
    message,
    type: 'review',
    link: `/vendor/reviews`,
    metadata: { reviewId, rating, productName, customerName }
  });
}

/**
 * 5. Withdrawal Status Notification for Vendor
 */
export async function notifyVendorWithdrawalUpdate(
  vendorId: string,
  amount: number,
  status: string,
  adminNote?: string
): Promise<string | null> {
  const title = `উইথড্র রিকোয়েস্ট আপডেট: ৳${amount.toLocaleString()} (${status})`;
  const message = adminNote 
    ? `উইথড্র স্ট্যাটাস: ${status}। অ্যাডমিন নোট: ${adminNote}` 
    : `আপনার ৳${amount.toLocaleString()} উইথড্র রিকোয়েস্ট "${status}" হিসেবে আপডেট হয়েছে।`;

  return sendVendorNotification({
    vendorId,
    title,
    message,
    type: 'withdraw',
    link: `/vendor/withdraw`,
    metadata: { amount, status, adminNote }
  });
}

/**
 * 6. Inventory Low Stock Alert for Vendor
 */
export async function notifyVendorLowStock(
  vendorId: string,
  productName: string,
  remainingStock: number,
  productId: string
): Promise<string | null> {
  const title = `স্টক সতর্কতা: ${productName}`;
  const message = `আপনার "${productName}" পণ্যের মাত্র ${remainingStock}টি স্টক অবশিষ্ট আছে। অনুগ্রহ করে স্টক বৃদ্ধি করুন।`;

  return sendVendorNotification({
    vendorId,
    title,
    message,
    type: 'inventory',
    link: `/vendor/inventory`,
    metadata: { productId, remainingStock }
  });
}

/**
 * 7. Verified Badge Expiry / Status Notification for Vendor
 */
export async function notifyVendorBadgeStatus(
  vendorId: string,
  title: string,
  message: string
): Promise<string | null> {
  return sendVendorNotification({
    vendorId,
    title,
    message,
    type: 'badge',
    link: `/vendor-dashboard`,
    metadata: {}
  });
}
