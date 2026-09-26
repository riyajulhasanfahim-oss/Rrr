import { rtdbGet, rtdbSet, rtdbUpdate, rtdbPush, rtdbSubscribe, rtdbRemove } from '../lib/rtdb';

export type SupportRole = 'customer' | 'vendor' | 'reseller' | 'physical';

export interface PhysicalSupportRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  subject: string;
  description: string;
  imageUrl?: string | null;
  status: 'open' | 'scheduled' | 'resolved';
  adminNotes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SupportThreadInfo {
  threadId: string;
  role: SupportRole;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  userAvatar?: string;
  subject?: string;
  status: 'open' | 'resolved';
  lastMessage: string;
  lastMessageTime: number;
  lastSenderType: 'user' | 'admin';
  unreadAdmin: number;
  unreadUser: number;
  createdAt: number;
  updatedAt: number;
}

export interface SupportMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderType: 'user' | 'admin';
  senderName: string;
  text: string;
  imageUrl?: string | null;
  createdAt: number;
  read: boolean;
}

export function getThreadId(role: SupportRole, userId: string): string {
  return `${role}_${userId}`;
}

/**
 * Send a message from a user (Customer, Vendor, or Reseller) to Admin
 */
export async function sendUserSupportMessage(params: {
  role: SupportRole;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  userAvatar?: string;
  subject?: string;
  text: string;
  imageUrl?: string | null;
}): Promise<string> {
  const { role, userId, userName, userEmail, userPhone, userAvatar, subject, text, imageUrl } = params;
  const threadId = getThreadId(role, userId);
  const now = Date.now();

  // 1. Get current thread info to preserve or increment counters
  const currentThread = await rtdbGet<SupportThreadInfo>(`support_threads/${role}/${userId}`);
  const currentUnreadAdmin = Number(currentThread?.unreadAdmin) || 0;

  const displayMessage = imageUrl && !text.trim() ? '📷 [ছবি সংযুক্ত করা হয়েছে]' : text.trim();

  // 2. Push message to messages node
  const messageData = {
    threadId,
    senderId: userId,
    senderType: 'user',
    senderName: userName || 'ব্যবহারকারী',
    text: text.trim(),
    imageUrl: imageUrl || null,
    createdAt: now,
    read: false
  };
  const msgKey = await rtdbPush(`support_messages/${threadId}`, messageData);

  // 3. Update or create thread info
  const threadInfo: SupportThreadInfo = {
    threadId,
    role,
    userId,
    userName: userName || currentThread?.userName || 'ব্যবহারকারী',
    userEmail: userEmail || currentThread?.userEmail || '',
    userPhone: userPhone || currentThread?.userPhone || '',
    userAvatar: userAvatar || currentThread?.userAvatar || '',
    subject: subject || currentThread?.subject || 'সহায়তা প্রয়োজন',
    status: 'open', // New user message always re-opens or keeps thread open
    lastMessage: displayMessage,
    lastMessageTime: now,
    lastSenderType: 'user',
    unreadAdmin: currentUnreadAdmin + 1,
    unreadUser: 0,
    createdAt: currentThread?.createdAt || now,
    updatedAt: now
  };

  await rtdbSet(`support_threads/${role}/${userId}`, threadInfo);
  return msgKey;
}

/**
 * Send a message from Admin to User
 */
export async function sendAdminSupportMessage(params: {
  role: SupportRole;
  userId: string;
  adminId: string;
  adminName?: string;
  text: string;
  imageUrl?: string | null;
}): Promise<string> {
  const { role, userId, adminId, adminName = 'RJ Support Admin', text, imageUrl } = params;
  const threadId = getThreadId(role, userId);
  const now = Date.now();

  const currentThread = await rtdbGet<SupportThreadInfo>(`support_threads/${role}/${userId}`);
  const currentUnreadUser = Number(currentThread?.unreadUser) || 0;
  const displayMessage = imageUrl && !text.trim() ? '📷 [ছবি সংযুক্ত করা হয়েছে]' : text.trim();

  const messageData = {
    threadId,
    senderId: adminId,
    senderType: 'admin',
    senderName: adminName,
    text: text.trim(),
    imageUrl: imageUrl || null,
    createdAt: now,
    read: false
  };
  const msgKey = await rtdbPush(`support_messages/${threadId}`, messageData);

  if (currentThread) {
    await rtdbUpdate(`support_threads/${role}/${userId}`, {
      lastMessage: displayMessage,
      lastMessageTime: now,
      lastSenderType: 'admin',
      unreadAdmin: 0,
      unreadUser: currentUnreadUser + 1,
      updatedAt: now
    });
  } else {
    await rtdbSet(`support_threads/${role}/${userId}`, {
      threadId,
      role,
      userId,
      userName: 'ব্যবহারকারী',
      status: 'open',
      lastMessage: displayMessage,
      lastMessageTime: now,
      lastSenderType: 'admin',
      unreadAdmin: 0,
      unreadUser: currentUnreadUser + 1,
      createdAt: now,
      updatedAt: now
    });
  }

  // If this is a physical support reply, also sync with physical_support_requests node
  if (role === 'physical') {
    try {
      const physicalRequests = await rtdbGet<Record<string, any>>('physical_support_requests', 2500);
      if (physicalRequests && typeof physicalRequests === 'object') {
        const matchEntries = Object.entries(physicalRequests).filter(([_, val]) => val?.userId === userId);
        const replySummary = text.trim() || (imageUrl ? '📷 এডমিন থেকে ছবি পাঠানো হয়েছে' : 'এডমিন সাপোর্ট রেসপন্স প্রদান করা হয়েছে');
        for (const [key, val] of matchEntries) {
          await rtdbUpdate(`physical_support_requests/${key}`, {
            adminNotes: replySummary,
            status: val?.status === 'open' ? 'scheduled' : (val?.status || 'scheduled'),
            updatedAt: now
          });
        }
      }
    } catch (err) {
      console.warn('[sendAdminSupportMessage sync physical error]:', err);
    }
  }

  return msgKey;
}

/**
 * Mark thread as read for Admin
 */
export async function markThreadReadByAdmin(role: SupportRole, userId: string): Promise<void> {
  await rtdbUpdate(`support_threads/${role}/${userId}`, {
    unreadAdmin: 0
  });
}

/**
 * Mark thread as read for User
 */
export async function markThreadReadByUser(role: SupportRole, userId: string): Promise<void> {
  await rtdbUpdate(`support_threads/${role}/${userId}`, {
    unreadUser: 0
  });
}

/**
 * Update thread status (Open / Resolved)
 */
export async function updateThreadStatus(
  role: SupportRole,
  userId: string,
  status: 'open' | 'resolved'
): Promise<void> {
  await rtdbUpdate(`support_threads/${role}/${userId}`, {
    status,
    updatedAt: Date.now()
  });
}

/**
 * Delete a specific message
 */
export async function deleteSupportMessage(threadId: string, messageId: string): Promise<void> {
  await rtdbRemove(`support_messages/${threadId}/${messageId}`);
}

/**
 * Subscribe to messages in a thread
 */
export function subscribeToThreadMessages(
  threadId: string,
  callback: (messages: SupportMessage[]) => void
): () => void {
  return rtdbSubscribe<Record<string, any>>(`support_messages/${threadId}`, (data) => {
    if (!data || typeof data !== 'object') {
      callback([]);
      return;
    }
    const list: SupportMessage[] = Object.entries(data).map(([id, val]) => ({
      id,
      threadId: val.threadId || threadId,
      senderId: val.senderId || '',
      senderType: val.senderType || 'user',
      senderName: val.senderName || '',
      text: val.text || '',
      imageUrl: val.imageUrl || null,
      createdAt: Number(val.createdAt) || 0,
      read: !!val.read
    }));
    list.sort((a, b) => a.createdAt - b.createdAt);
    callback(list);
  });
}

/**
 * Subscribe to threads for a specific role
 */
export function subscribeToRoleThreads(
  role: SupportRole,
  callback: (threads: SupportThreadInfo[]) => void
): () => void {
  return rtdbSubscribe<Record<string, any>>(`support_threads/${role}`, (data) => {
    if (!data || typeof data !== 'object') {
      callback([]);
      return;
    }
    const list: SupportThreadInfo[] = Object.entries(data).map(([userId, val]) => ({
      threadId: val.threadId || getThreadId(role, userId),
      role: val.role || role,
      userId: val.userId || userId,
      userName: val.userName || 'ব্যবহারকারী',
      userEmail: val.userEmail || '',
      userPhone: val.userPhone || '',
      userAvatar: val.userAvatar || '',
      subject: val.subject || 'সহায়তা প্রয়োজন',
      status: val.status || 'open',
      lastMessage: val.lastMessage || '',
      lastMessageTime: Number(val.lastMessageTime) || 0,
      lastSenderType: val.lastSenderType || 'user',
      unreadAdmin: Number(val.unreadAdmin) || 0,
      unreadUser: Number(val.unreadUser) || 0,
      createdAt: Number(val.createdAt) || 0,
      updatedAt: Number(val.updatedAt) || 0
    }));
    list.sort((a, b) => (b.lastMessageTime || b.updatedAt) - (a.lastMessageTime || a.updatedAt));
    callback(list);
  });
}

/**
 * Subscribe to total unread support message counts across all roles for Admin
 */
export function subscribeToAdminSupportUnreadCounts(
  callback: (counts: { total: number; customer: number; vendor: number; reseller: number; physical: number }) => void
): () => void {
  return rtdbSubscribe<Record<string, Record<string, any>>>('support_threads', (data) => {
    let customerUnread = 0;
    let vendorUnread = 0;
    let resellerUnread = 0;
    let physicalUnread = 0;

    if (data && typeof data === 'object') {
      if (data.customer && typeof data.customer === 'object') {
        Object.values(data.customer).forEach((t: any) => {
          customerUnread += Number(t.unreadAdmin) || 0;
        });
      }
      if (data.vendor && typeof data.vendor === 'object') {
        Object.values(data.vendor).forEach((t: any) => {
          vendorUnread += Number(t.unreadAdmin) || 0;
        });
      }
      if (data.reseller && typeof data.reseller === 'object') {
        Object.values(data.reseller).forEach((t: any) => {
          resellerUnread += Number(t.unreadAdmin) || 0;
        });
      }
      if (data.physical && typeof data.physical === 'object') {
        Object.values(data.physical).forEach((t: any) => {
          physicalUnread += Number(t.unreadAdmin) || 0;
        });
      }
    }

    callback({
      total: customerUnread + vendorUnread + resellerUnread + physicalUnread,
      customer: customerUnread,
      vendor: vendorUnread,
      reseller: resellerUnread,
      physical: physicalUnread
    });
  });
}

/**
 * Submit a Physical Support request from Customer Care / Profile page
 */
export async function submitPhysicalSupportRequest(params: {
  userId: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  subject: string;
  description: string;
  imageUrl?: string | null;
}): Promise<{ requestId: string; threadId: string }> {
  const { userId, userName, userPhone, userEmail, subject, description, imageUrl } = params;
  const now = Date.now();
  const threadId = getThreadId('physical', userId);

  // 1. Also store in a dedicated physical_support_requests collection for administrative audit
  const requestKey = await rtdbPush('physical_support_requests', {
    userId,
    userName: userName.trim(),
    userPhone: userPhone.trim(),
    userEmail: userEmail || '',
    subject: subject.trim(),
    description: description.trim(),
    imageUrl: imageUrl || null,
    status: 'open',
    createdAt: now,
    updatedAt: now
  });

  // 2. Send through the unified support messaging pipeline under role 'physical'
  await sendUserSupportMessage({
    role: 'physical',
    userId,
    userName: userName.trim(),
    userPhone: userPhone.trim(),
    userEmail: userEmail || '',
    subject: subject.trim(),
    text: description.trim(),
    imageUrl: imageUrl || null
  });

  return { requestId: requestKey, threadId };
}

/**
 * Subscribe to unread messages count for a specific user across all support roles
 */
export function subscribeUserRoleUnreads(
  userId: string,
  callback: (unreads: Record<SupportRole, number>) => void
): () => void {
  const roles: SupportRole[] = ['customer', 'physical', 'vendor', 'reseller'];
  const unreads: Record<SupportRole, number> = {
    customer: 0,
    physical: 0,
    vendor: 0,
    reseller: 0
  };
  const unsubs: (() => void)[] = [];

  roles.forEach(role => {
    const unsub = rtdbSubscribe<SupportThreadInfo>(`support_threads/${role}/${userId}`, (thread) => {
      unreads[role] = Number(thread?.unreadUser) || 0;
      callback({ ...unreads });
    });
    unsubs.push(unsub);
  });

  return () => {
    unsubs.forEach(u => u());
  };
}

/**
 * Subscribe to physical support requests by a specific user
 */
export function subscribeUserPhysicalRequests(
  userId: string,
  callback: (requests: PhysicalSupportRequest[]) => void
): () => void {
  return rtdbSubscribe<Record<string, any>>('physical_support_requests', (data) => {
    if (!data || typeof data !== 'object') {
      callback([]);
      return;
    }
    const list: PhysicalSupportRequest[] = Object.entries(data)
      .map(([id, val]) => ({
        id,
        userId: val.userId || '',
        userName: val.userName || '',
        userPhone: val.userPhone || '',
        userEmail: val.userEmail || '',
        subject: val.subject || 'ফিজিক্যাল সাপোর্ট',
        description: val.description || '',
        imageUrl: val.imageUrl || null,
        status: val.status || 'open',
        adminNotes: val.adminNotes || '',
        createdAt: Number(val.createdAt) || 0,
        updatedAt: Number(val.updatedAt) || 0
      }))
      .filter(item => item.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);

    callback(list);
  });
}

/**
 * Request and trigger AI Assistant reply for live chat
 * Note: STRICTLY skips 'physical' role because physical support is handled manually by admin!
 */
export async function triggerAiSupportReply(params: {
  role: SupportRole;
  userId: string;
  userName?: string;
  message: string;
  history?: Array<{ senderType: 'user' | 'admin'; text: string }>;
}): Promise<string | null> {
  const { role, userId, userName, message, history = [] } = params;

  // STRICT REQUIREMENT: AI must never reply to physical support
  if (role === 'physical') {
    return null;
  }

  try {
    const res = await fetch('/api/support/ai-reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role,
        userId,
        userName,
        message,
        history
      })
    });

    if (!res.ok) {
      console.warn('AI reply API returned status:', res.status);
      return null;
    }

    const data = await res.json();
    if (!data?.reply || data?.skipped) {
      return null;
    }

    const replyText = data.reply;

    // Send AI reply into the thread using the existing message pipeline
    await sendAdminSupportMessage({
      role,
      userId,
      adminId: 'rj_ai_assistant',
      adminName: 'RJ World AI অ্যাসিস্ট্যান্ট',
      text: replyText
    });

    return replyText;
  } catch (err) {
    console.warn('Failed to trigger AI support reply:', err);
    return null;
  }
}
