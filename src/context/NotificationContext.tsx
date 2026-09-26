import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
  AppNotification,
  UserReadRecord,
  subscribeToAllUserNotifications,
  subscribeToUserReads,
  markNotificationAsReadInRTDB,
  markAllNotificationsAsReadInRTDB,
  playNotificationChime,
  isNotificationSoundMuted,
  toggleNotificationSound,
  trackNotificationEvent
} from '../services/notificationService';
import { rtdbSet, rtdbRemove, rtdbSubscribe } from '../lib/rtdb';
import toast from 'react-hot-toast';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadNotifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  selectedNotification: AppNotification | null;
  openNotificationDetail: (notif: AppNotification) => void;
  closeNotificationDetail: () => void;
  markAsRead: (id: string) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  soundMuted: boolean;
  toggleSound: () => void;
  testSound: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Helper to get cached reads from localStorage
function getLocalReads(userId?: string): Record<string, UserReadRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const key = `rj_notif_reads_${userId || 'guest'}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Helper to save reads to localStorage
function saveLocalReads(reads: Record<string, UserReadRecord>, userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `rj_notif_reads_${userId || 'guest'}`;
    localStorage.setItem(key, JSON.stringify(reads));
  } catch {
    // ignore
  }
}

// Helper to get cached dismissed notification IDs from localStorage
function getLocalDismissed(userId?: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const key = `rj_notif_dismissed_${userId || 'guest'}`;
    const stored = localStorage.getItem(key);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

// Helper to save dismissed notification IDs to localStorage
function saveLocalDismissed(dismissed: Set<string>, userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `rj_notif_dismissed_${userId || 'guest'}`;
    localStorage.setItem(key, JSON.stringify(Array.from(dismissed)));
  } catch {
    // ignore
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userData } = useAuth();
  
  const [rawNotifications, setRawNotifications] = useState<AppNotification[]>([]);
  const [userReads, setUserReads] = useState<Record<string, UserReadRecord>>(() => getLocalReads(user?.uid));
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => getLocalDismissed(user?.uid));
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [soundMuted, setSoundMuted] = useState<boolean>(() => isNotificationSoundMuted());

  const isFirstLoadRef = useRef(true);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const userReadsRef = useRef<Record<string, UserReadRecord>>(userReads);

  // Keep userReadsRef in sync with userReads state
  useEffect(() => {
    userReadsRef.current = userReads;
  }, [userReads]);

  // Load local cache when user changes
  useEffect(() => {
    const cachedReads = getLocalReads(user?.uid);
    if (Object.keys(cachedReads).length > 0) {
      setUserReads(prev => {
        const next = { ...cachedReads, ...prev };
        userReadsRef.current = next;
        return next;
      });
    }

    const cachedDismissed = getLocalDismissed(user?.uid);
    if (cachedDismissed.size > 0) {
      setDismissedIds(prev => new Set([...prev, ...cachedDismissed]));
    }
  }, [user?.uid]);

  // Subscribe to dismissed notifications in RTDB
  useEffect(() => {
    if (!user) return;
    const unsubDismissed = rtdbSubscribe<Record<string, any>>(
      `user_notification_dismissed/${user.uid}`,
      (snap) => {
        if (snap && typeof snap === 'object') {
          const ids = Object.keys(snap);
          setDismissedIds(prev => {
            const next = new Set([...prev, ...ids]);
            saveLocalDismissed(next, user.uid);
            return next;
          });
        }
      }
    );
    return () => unsubDismissed();
  }, [user?.uid]);

  // 1. Subscribe to User Read Statuses in RTDB
  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubReads = subscribeToUserReads(user.uid, (rtdbReads) => {
      setUserReads(prev => {
        const merged = { ...prev, ...rtdbReads };
        userReadsRef.current = merged;
        saveLocalReads(merged, user.uid);
        return merged;
      });
    });

    return () => {
      unsubReads();
    };
  }, [user?.uid]);

  // 2. Subscribe to All User Notifications in RTDB
  useEffect(() => {
    if (!user) {
      setRawNotifications([]);
      setLoading(false);
      isFirstLoadRef.current = true;
      knownNotificationIdsRef.current.clear();
      return;
    }

    isFirstLoadRef.current = true;
    setLoading(true);

    const unsubNotifs = subscribeToAllUserNotifications(
      user.uid,
      userData?.role,
      (incoming) => {
        setLoading(false);

        // Sound alert for new incoming notifications (after initial load)
        if (!isFirstLoadRef.current) {
          const currentReads = { ...getLocalReads(user.uid), ...userReadsRef.current };
          const freshItems = incoming.filter(
            n => !knownNotificationIdsRef.current.has(n.id) &&
                 !currentReads[n.id]?.read &&
                 !n.read &&
                 !n.isRead
          );

          if (freshItems.length > 0) {
            playNotificationChime();
            const newest = freshItems[0];
            toast((t) => (
              <div 
                onClick={() => {
                  toast.dismiss(t.id);
                  openNotificationDetail(newest);
                }}
                className="flex items-start gap-2.5 cursor-pointer max-w-sm"
              >
                <span className="text-xl shrink-0">🔔</span>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 truncate">{newest.title}</p>
                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{newest.message}</p>
                </div>
              </div>
            ), {
              duration: 5000,
              position: 'top-right'
            });
          }
        }

        // Update known IDs
        incoming.forEach(n => knownNotificationIdsRef.current.add(n.id));
        isFirstLoadRef.current = false;
        setRawNotifications(incoming);
      }
    );

    return () => {
      unsubNotifs();
    };
  }, [user?.uid, userData?.role]);

  // Derive notifications with isRead computed per current user - MEMOIZED to prevent infinite loops
  const notifications: AppNotification[] = useMemo(() => {
    return rawNotifications
      .filter(n => !dismissedIds.has(n.id))
      .map((n) => {
        const isRead = Boolean(
          userReads[n.id]?.read ||
          (n.userId === user?.uid && n.read) ||
          n.read ||
          n.isRead
        );
        const seenAt = userReads[n.id]?.seenAt || (isRead ? n.createdAt : undefined);
        return {
          ...n,
          isRead,
          seenAt
        };
      });
  }, [rawNotifications, userReads, user?.uid, dismissedIds]);

  // Filter strictly unread notifications (Messenger-style) - MEMOIZED
  const unreadNotifications = useMemo(() => {
    return notifications.filter(n => !n.isRead);
  }, [notifications]);

  const unreadCount = unreadNotifications.length;

  /**
   * Opens detail modal and marks notification as Seen/Read immediately in RTDB
   */
  const openNotificationDetail = useCallback((notif: AppNotification) => {
    setSelectedNotification(notif);

    if (!notif.isRead) {
      const now = Date.now();
      setUserReads(prev => {
        const next = { ...prev, [notif.id]: { read: true, seenAt: now } };
        saveLocalReads(next, user?.uid);
        return next;
      });

      if (user) {
        markNotificationAsReadInRTDB(user.uid, notif.id).catch(err => {
          console.warn('Could not save read status to RTDB:', err);
        });
        trackNotificationEvent(notif.id, 'read', user.uid).catch(() => {});
      }
    }
  }, [user]);

  /**
   * Closes detail modal
   */
  const closeNotificationDetail = useCallback(() => {
    setSelectedNotification(null);
  }, []);

  /**
   * Marks a single notification as read manually in RTDB and local state
   */
  const markAsRead = useCallback(async (id: string) => {
    if (!id) return;
    const now = Date.now();

    // 1. Instant local update (instant UI reaction)
    setUserReads(prev => {
      if (prev[id]?.read) return prev; // already read
      const next = { ...prev, [id]: { read: true, seenAt: now } };
      userReadsRef.current = next;
      saveLocalReads(next, user?.uid);
      return next;
    });

    // 2. Persist to RTDB
    if (user) {
      await markNotificationAsReadInRTDB(user.uid, id).catch(err => {
        console.warn('Failed to mark read in RTDB:', err);
      });
      trackNotificationEvent(id, 'read', user.uid).catch(() => {});
    }
  }, [user]);

  /**
   * Deletes / dismisses a notification permanently for the user
   */
  const deleteNotification = useCallback(async (id: string) => {
    if (!id) return;

    // 1. Instant local optimistic update
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveLocalDismissed(next, user?.uid);
      return next;
    });
    setRawNotifications(prev => prev.filter(n => n.id !== id));

    // 2. Persist to RTDB
    if (user) {
      try {
        await rtdbSet(`user_notification_dismissed/${user.uid}/${id}`, true);
        await rtdbRemove(`notifications/${user.uid}/${id}`).catch(() => {});
      } catch (err) {
        console.warn('Could not persist notification dismissal:', err);
      }
    }

    // Also remove from vendor notifications if applicable
    if (userData?.role === 'Vendor' || userData?.role === 'admin') {
      await rtdbRemove(`vendor_notifications/${id}`).catch(() => {});
    }

    toast.success('নোটিফিকেশন মুছে ফেলা হয়েছে');
  }, [user, userData?.role]);

  /**
   * Marks all current unread notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    if (unreadNotifications.length === 0) return;

    const unreadIds = unreadNotifications.map(n => n.id);
    const now = Date.now();

    // Optimistic update
    setUserReads(prev => {
      const next = { ...prev };
      unreadIds.forEach(id => {
        next[id] = { read: true, seenAt: now };
      });
      userReadsRef.current = next;
      saveLocalReads(next, user?.uid);
      return next;
    });

    if (user) {
      try {
        await markAllNotificationsAsReadInRTDB(user.uid, unreadIds);
        unreadIds.forEach(id => {
          trackNotificationEvent(id, 'read', user.uid).catch(() => {});
        });
        toast.success('সকল নোটিফিকেশন পঠিত হিসেবে চিহ্নিত করা হয়েছে');
      } catch (err) {
        console.warn('Failed to mark all as read:', err);
        toast.error('সব পঠিত করা সম্ভব হয়নি');
      }
    } else {
      toast.success('সকল নোটিফিকেশন পঠিত হিসেবে চিহ্নিত করা হয়েছে');
    }
  }, [user, unreadNotifications]);

  const handleToggleSound = useCallback(() => {
    const next = toggleNotificationSound();
    setSoundMuted(next);
    toast.success(next ? 'নোটিফিকেশন শব্দ বন্ধ করা হয়েছে' : 'নোটিফিকেশন শব্দ চালু করা হয়েছে');
  }, []);

  const handleTestSound = useCallback(() => {
    playNotificationChime();
    toast.success('শব্দ টেস্ট সফল (Chime played)');
  }, []);

  const contextValue = useMemo(() => ({
    notifications,
    unreadNotifications,
    unreadCount,
    loading,
    selectedNotification,
    openNotificationDetail,
    closeNotificationDetail,
    markAsRead,
    markNotificationAsRead: markAsRead,
    markAllAsRead,
    deleteNotification,
    soundMuted,
    toggleSound: handleToggleSound,
    testSound: handleTestSound
  }), [
    notifications,
    unreadNotifications,
    unreadCount,
    loading,
    selectedNotification,
    openNotificationDetail,
    closeNotificationDetail,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    soundMuted,
    handleToggleSound,
    handleTestSound
  ]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
