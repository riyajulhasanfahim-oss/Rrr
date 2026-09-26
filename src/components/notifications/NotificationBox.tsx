import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Bell, 
  ShoppingBag, 
  MessageSquare, 
  Star, 
  Banknote, 
  Package, 
  ShieldCheck, 
  CheckCheck, 
  Volume2, 
  VolumeX, 
  Clock, 
  ExternalLink, 
  Sparkles, 
  X, 
  CheckCircle2, 
  ArrowRight,
  Tag,
  Gift,
  Check,
  Trash2,
  XCircle
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { 
  AppNotification, 
  formatBengaliTimeAgo, 
  formatBengaliDigit,
  trackNotificationEvent
} from '../../services/notificationService';

interface NotificationBoxProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export default function NotificationBox({ isOpen, onClose }: NotificationBoxProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    notifications,
    unreadNotifications,
    unreadCount,
    loading,
    selectedNotification,
    openNotificationDetail,
    closeNotificationDetail,
    markNotificationAsRead,
    markAllAsRead,
    deleteNotification,
    soundMuted,
    toggleSound
  } = useNotifications();

  // Messenger-style view filter: default to 'unread' so viewed ones disappear upon returning!
  const [activeFilter, setActiveFilter] = useState<'unread' | 'all'>('unread');
  const boxRef = useRef<HTMLDivElement>(null);

  // Close on outside click (unless detail modal is open)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (selectedNotification) return; // detail modal is open
      const target = e.target as HTMLElement;
      if (!target) return;

      // If clicked inside the notification box or on notification trigger (bell button), do not close
      if (boxRef.current?.contains(target)) return;
      if (target.closest?.('[data-notification-box]')) return;
      if (target.closest?.('[data-notification-trigger]')) return;

      onClose();
    }

    if (isOpen) {
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside, true);
        document.addEventListener('touchend', handleClickOutside, true);
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside, true);
        document.removeEventListener('touchend', handleClickOutside, true);
      };
    }
  }, [isOpen, selectedNotification, onClose]);

  // Track 'opened' event on visible items when dropdown opens
  useEffect(() => {
    if (isOpen && notifications.length > 0) {
      const targetItems = activeFilter === 'unread' ? unreadNotifications : notifications;
      targetItems.slice(0, 10).forEach(item => {
        trackNotificationEvent(item.id, 'opened', user?.uid).catch(() => {});
      });
    }
  }, [isOpen, activeFilter, notifications.length, unreadNotifications.length, user?.uid]);

  if (!isOpen) return null;

  // Choose list according to filter
  const displayedList = activeFilter === 'unread' ? unreadNotifications : notifications;

  const getCategoryIcon = (type?: string) => {
    switch (type) {
      case 'order_cancelled':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'order':
      case 'order_new':
        return <ShoppingBag className="w-4 h-4 text-blue-600" />;
      case 'message':
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-rose-600" />;
      case 'review':
        return <Star className="w-4 h-4 text-amber-500 fill-amber-500" />;
      case 'withdraw':
      case 'wallet':
        return <Banknote className="w-4 h-4 text-emerald-600" />;
      case 'promo':
      case 'coupon':
        return <Gift className="w-4 h-4 text-purple-600" />;
      case 'badge':
      case 'security':
        return <ShieldCheck className="w-4 h-4 text-cyan-600" />;
      case 'vendor':
        return <Package className="w-4 h-4 text-indigo-600" />;
      default:
        return <Bell className="w-4 h-4 text-sky-600" />;
    }
  };

  const getCategoryBg = (type?: string) => {
    switch (type) {
      case 'order_cancelled':
        return 'bg-red-50 text-red-600 border-red-200';
      case 'order':
        return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'message':
        return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'review':
        return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'withdraw':
      case 'wallet':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'promo':
        return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'badge':
        return 'bg-cyan-50 text-cyan-600 border-cyan-100';
      default:
        return 'bg-sky-50 text-sky-600 border-sky-100';
    }
  };

  const handleItemClick = (e: React.MouseEvent, item: AppNotification) => {
    // 1. Mark as read in RTDB & local state immediately
    markNotificationAsRead(item.id);
    trackNotificationEvent(item.id, 'read', user?.uid).catch(() => {});
    trackNotificationEvent(item.id, 'opened', user?.uid).catch(() => {});
    // 2. Close notification dropdown
    onClose();
  };

  const handleNavigateFromModal = (link: string) => {
    closeNotificationDetail();
    onClose();
    navigate(link);
  };

  return (
    <>
      {/* Dropdown / Popover Box (Messenger Style) */}
      <div 
        ref={boxRef}
        data-notification-box="true"
        className="fixed sm:absolute inset-x-3 sm:inset-x-auto right-0 sm:right-0 top-14 sm:top-full mt-2 w-auto sm:w-96 max-w-[calc(100vw-24px)] sm:max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/90 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-sky-100 text-primary-main rounded-lg">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                নোটিফিকেশন
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-red-100 text-red-700 rounded-full">
                    {formatBengaliDigit(unreadCount)}টি না-দেখা
                  </span>
                )}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={toggleSound}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 rounded-lg transition-colors"
              title={soundMuted ? 'শব্দ চালু করুন' : 'শব্দ বন্ধ করুন'}
            >
              {soundMuted ? (
                <VolumeX className="w-4 h-4 text-red-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-600" />
              )}
            </button>

            {/* Mark All Read */}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-primary-main hover:bg-sky-50 rounded-lg transition-colors"
                title="সকল পঠিত করুন"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                সব পঠিত
              </button>
            )}

            {/* Close Button for mobile */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg sm:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messenger-style Filter Tabs: 'না-দেখা' vs 'সকল' */}
        <div className="flex items-center gap-1 p-2 bg-slate-100/70 border-b border-slate-100 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveFilter('unread')}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeFilter === 'unread'
                ? 'bg-white text-primary-main shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            না-দেখা
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-red-500 text-white rounded-full">
                {formatBengaliDigit(unreadCount)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
              activeFilter === 'all'
                ? 'bg-white text-primary-main shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            সকল ({formatBengaliDigit(notifications.length)})
          </button>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100 min-h-[160px] max-h-[420px]">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <div className="w-6 h-6 border-2 border-primary-main border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs">নোটিফিকেশন লোড হচ্ছে...</p>
            </div>
          ) : displayedList.length > 0 ? (
            displayedList.map((item) => {
              const isUnread = !item.isRead;
              return (
                <Link
                  key={item.id}
                  to={`/notification/${item.id}`}
                  onClick={(e) => handleItemClick(e, item)}
                  className={`p-3.5 flex items-start gap-3 transition-all cursor-pointer ${
                    isUnread
                      ? 'bg-sky-50/50 hover:bg-sky-100/60'
                      : 'bg-white hover:bg-slate-50/80'
                  }`}
                >
                  {/* Category Badge Icon */}
                  <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${getCategoryBg(item.type)}`}>
                    {getCategoryIcon(item.type)}
                  </div>

                  {/* Content Preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <h4 className={`text-xs leading-snug line-clamp-1 ${
                        isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                      }`}>
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {formatBengaliTimeAgo(item.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteNotification(item.id);
                          }}
                          className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 active:bg-red-100 rounded-md transition-colors"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className={`text-xs leading-relaxed line-clamp-2 ${
                      isUnread ? 'text-slate-700' : 'text-slate-500'
                    }`}>
                      {item.message}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1">
                      <span className="text-[11px] text-primary-main font-semibold flex items-center gap-1 hover:underline">
                        বিস্তারিত দেখুন <ArrowRight className="w-3 h-3" />
                      </span>
                      {isUnread ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-100/80 px-1.5 py-0.5 rounded-full">
                          নতুন
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                          <Check className="w-3 h-3 text-emerald-500" /> দেখা হয়েছে
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Notification Image Thumbnail (Product image / Deal banner) */}
                  {item.imageUrl && (
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 self-start shadow-2xs">
                      <img
                        referrerPolicy="no-referrer"
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const parent = (e.target as HTMLElement).parentElement;
                          if (parent) parent.style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Unread indicator dot */}
                  {isUnread && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-main shrink-0 mt-1.5 shadow-xs" />
                  )}
                </Link>
              );
            })
          ) : (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 bg-sky-50 text-primary-main rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                {activeFilter === 'unread' ? 'সব নোটিফিকেশন দেখা হয়েছে' : 'কোনো নোটিফিকেশন নেই'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto">
                {activeFilter === 'unread' 
                  ? 'আপনার কোনো না-দেখা নোটিফিকেশন নেই। পূর্বের নোটিফিকেশন দেখতে নিচে বা "সকল"-এ ক্লিক করুন।' 
                  : 'আপনার অ্যাকাউন্টে বর্তমানে কোনো নোটিফিকেশন পাওয়া যায়নি।'}
              </p>
              {activeFilter === 'unread' && notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-bold text-primary-main hover:underline bg-sky-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  পূর্বের সকল নোটিফিকেশন দেখুন ({formatBengaliDigit(notifications.length)})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-slate-100 bg-slate-50/80 text-center">
          <Link
            to="/notifications"
            onClick={onClose}
            className="text-xs font-bold text-primary-main hover:text-sky-700 inline-flex items-center gap-1 py-1 px-3 rounded-lg hover:bg-sky-50 transition-colors"
          >
            সকল নোটিফিকেশন পেজ খুলুন <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Messenger Notification Detail Modal */}
      {selectedNotification && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={closeNotificationDetail}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 p-5 sm:p-6 flex flex-col space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${getCategoryBg(selectedNotification.type)}`}>
                  {getCategoryIcon(selectedNotification.type)}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    {selectedNotification.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(selectedNotification.createdAt).toLocaleString('bn-BD', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={closeNotificationDetail}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Image (if available) */}
            {selectedNotification.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 max-h-48">
                <img 
                  referrerPolicy="no-referrer"
                  src={selectedNotification.imageUrl} 
                  alt={selectedNotification.title}
                  className="w-full h-full object-cover" 
                />
              </div>
            )}

            {/* Notification Full Message Body */}
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
              {selectedNotification.message}
            </div>

            {/* Read / Seen Status Badge */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <Check className="w-3.5 h-3.5" /> নোটিফিকেশনটি পঠিত (Read/Seen)
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const id = selectedNotification.id;
                  closeNotificationDetail();
                  deleteNotification(id);
                }}
                className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> মুছে ফেলুন
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeNotificationDetail}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
                >
                  বন্ধ করুন
                </button>

                {selectedNotification.link && (
                  <button
                    type="button"
                    onClick={() => handleNavigateFromModal(selectedNotification.link!)}
                    className="px-4 py-2 bg-primary-main hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    লিংকে যান <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
