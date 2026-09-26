import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Smartphone, 
  Clock, 
  ChevronRight,
  ExternalLink,
  Sparkles,
  X,
  CheckCircle2,
  Eye,
  ArrowRight,
  Trash2
} from 'lucide-react';
import { useVendorNotifications } from '../../context/VendorNotificationContext';

export default function VendorNotificationDropdown() {
  const navigate = useNavigate();
  const {
    notifications,
    totalUnreadCount,
    unreadOrdersCount,
    unreadMessagesCount,
    unreadReviewsCount,
    bengaliCounts,
    soundMuted,
    toggleSound,
    testSound,
    devicePermission,
    requestDevicePermission,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useVendorNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'order' | 'message' | 'review'>('all');
  const [viewFilter, setViewFilter] = useState<'unread' | 'all'>('all');
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Do not close if modal is open
        if (!selectedNotification) {
          setIsOpen(false);
        }
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, selectedNotification]);

  // Filter notifications: show all with unread prioritized first so notifications never disappear
  const filteredNotifications = notifications
    .filter(item => {
      if (viewFilter === 'unread' && item.read) {
        return false;
      }
      if (activeTab === 'all') return true;
      return item.type === activeTab;
    })
    .sort((a, b) => {
      // Unread notifications prioritized first
      if (a.read !== b.read) {
        return a.read ? 1 : -1;
      }
      const timeA = Number(a.timestamp || a.createdAt || 0);
      const timeB = Number(b.timestamp || b.createdAt || 0);
      return timeB - timeA;
    });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <ShoppingBag className="w-4 h-4 text-blue-600" />;
      case 'message':
        return <MessageSquare className="w-4 h-4 text-rose-600" />;
      case 'review':
        return <Star className="w-4 h-4 text-amber-500 fill-amber-500" />;
      case 'withdraw':
        return <Banknote className="w-4 h-4 text-emerald-600" />;
      case 'inventory':
        return <Package className="w-4 h-4 text-purple-600" />;
      case 'badge':
        return <ShieldCheck className="w-4 h-4 text-cyan-600" />;
      default:
        return <Bell className="w-4 h-4 text-indigo-600" />;
    }
  };

  const getNotificationBg = (type: string) => {
    switch (type) {
      case 'order':
        return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'message':
        return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'review':
        return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'withdraw':
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'inventory':
        return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'badge':
        return 'bg-cyan-50 text-cyan-600 border-cyan-100';
      default:
        return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'order':
        return 'অর্ডার নোটিফিকেশন';
      case 'message':
        return 'মেসেজ / চ্যাট';
      case 'review':
        return 'কাস্টমার রিভিউ';
      case 'withdraw':
        return 'উইথড্র / পেমেন্ট';
      case 'inventory':
        return 'স্টক / ইনভেন্টরি';
      case 'badge':
        return 'ব্যাজ / স্বীকৃতি';
      default:
        return 'সাধারণ নোটিফিকেশন';
    }
  };

  // When clicking on a notification:
  // Open the detail modal to view full message details, and mark as read so upon exiting it will no longer show in the unread box
  const handleNotificationClick = (item: any) => {
    setSelectedNotification(item);
    if (!item.read) {
      markAsRead(item.id);
    }
  };

  const handleCloseDetailModal = () => {
    setSelectedNotification(null);
  };

  const handleNavigateToLink = (link: string) => {
    setSelectedNotification(null);
    setIsOpen(false);
    navigate(link);
  };

  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return 'এইমাত্র';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'এইমাত্র';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} মিনিট আগে`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ঘণ্টা আগে`;
    const days = Math.floor(hours / 24);
    return `${days} দিন আগে`;
  };

  const formatDateTime = (timestamp?: number) => {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleString('bn-BD', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all active:scale-95 focus:outline-none"
        title="নোটিফিকেশন সেন্টার"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-700" />
        
        {totalUnreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-pulse">
            {totalUnreadCount > 99 ? '99+' : bengaliCounts.total}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto right-0 top-14 sm:top-full mt-2 w-auto sm:w-96 max-w-[calc(100vw-16px)] sm:max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-gray-100 bg-slate-50/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  নোটিফিকেশন
                  {totalUnreadCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded-full">
                      {bengaliCounts.total} টা না-দেখা
                    </span>
                  )}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Sound Toggle */}
              <button
                type="button"
                onClick={toggleSound}
                className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                title={soundMuted ? 'শব্দ চালু করুন (Unmute)' : 'শব্দ বন্ধ করুন (Mute)'}
              >
                {soundMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-emerald-600" />}
              </button>

              {/* Mark All Read */}
              {totalUnreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="সকল পঠিত করুন"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  সব পঠিত
                </button>
              )}
            </div>
          </div>

          {/* Unread vs All Toggle Subheader */}
          <div className="px-3 py-1.5 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between text-[11px]">
            <span className="text-gray-500 font-medium">
              {viewFilter === 'unread' ? 'নতুন ও না-দেখা বার্তা:' : 'সকল নোটিফিকেশন:'}
            </span>
            <div className="flex items-center gap-1 bg-gray-200/70 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setViewFilter('unread')}
                className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                  viewFilter === 'unread'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                না-দেখা ({totalUnreadCount})
              </button>
              <button
                type="button"
                onClick={() => setViewFilter('all')}
                className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                  viewFilter === 'all'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                সকল ({notifications.length})
              </button>
            </div>
          </div>

          {/* Mobile Push Notification Banner */}
          {devicePermission !== 'granted' && (
            <div className="p-3 bg-amber-50/90 border-b border-amber-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Smartphone className="w-4 h-4 text-amber-700 shrink-0" />
                <p className="text-[11px] text-amber-900 leading-tight">
                  <strong>মোবাইলে নোটিফিকেশন পেতে চান?</strong> নতুন অর্ডারে অ্যালার্ট পান।
                </p>
              </div>
              <button
                type="button"
                onClick={requestDevicePermission}
                className="px-2.5 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shrink-0 shadow-2xs transition-colors"
              >
                অন করুন
              </button>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="px-3 pt-2 pb-1 border-b border-gray-100 flex items-center gap-1 overflow-x-auto scrollbar-none text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white font-bold shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              সব {viewFilter === 'unread' ? `(${totalUnreadCount})` : `(${notifications.length})`}
            </button>
            <button
              onClick={() => setActiveTab('order')}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                activeTab === 'order'
                  ? 'bg-blue-600 text-white font-bold shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              অর্ডার {unreadOrdersCount > 0 && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
            </button>
            <button
              onClick={() => setActiveTab('message')}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                activeTab === 'message'
                  ? 'bg-blue-600 text-white font-bold shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              মেসেজ {unreadMessagesCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500"></span>}
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                activeTab === 'review'
                  ? 'bg-blue-600 text-white font-bold shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              রিভিউ {unreadReviewsCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 max-h-80 sm:max-h-96">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-xs font-semibold text-gray-800">
                  {viewFilter === 'unread' 
                    ? 'সব নোটিফিকেশন দেখা হয়েছে!' 
                    : 'কোনো নোটিফিকেশন নেই'}
                </p>
                <p className="text-[11px] text-gray-500 mt-1 max-w-[240px] mx-auto">
                  {viewFilter === 'unread' 
                    ? 'যেগুলো দেখা হয়েছে সেগুলো বক্স থেকে রিমুভ করা হয়েছে। ওপর থেকে শুধু না-দেখাগুলোই আসবে।' 
                    : 'নতুন কোনো কার্যক্রম ঘটলে এখানে দেখতে পাবেন।'}
                </p>
                {viewFilter === 'unread' && notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setViewFilter('all')}
                    className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <Eye className="w-3 h-3" />
                    পূর্বের সকল নোটিফিকেশন দেখুন ({notifications.length})
                  </button>
                )}
              </div>
            ) : (
              filteredNotifications.slice(0, 20).map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 sm:p-3.5 flex items-start gap-3 transition-colors cursor-pointer text-left ${
                    item.read 
                      ? 'bg-white hover:bg-gray-50 opacity-80' 
                      : 'bg-blue-50/60 hover:bg-blue-50/90 font-medium'
                  }`}
                >
                  <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${getNotificationBg(item.type)}`}>
                    {getNotificationIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className={`text-xs truncate ${item.read ? 'font-semibold text-gray-800' : 'font-bold text-gray-950'}`}>
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {!item.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 animate-pulse"></span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteNotification(item.id);
                          }}
                          className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 active:bg-red-100 rounded-md transition-colors"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-600 leading-snug line-clamp-2">
                      {item.message}
                    </p>
                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(item.timestamp || item.createdAt)}
                      </span>
                      <span className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5 font-bold">
                        বিস্তারিত দেখুন <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 sm:p-3 border-t border-gray-100 bg-gray-50/90 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={testSound}
              className="text-gray-500 hover:text-gray-800 text-[11px] font-medium flex items-center gap-1"
              title="শব্দ টেস্ট করুন"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              সাউন্ড টেস্ট
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/vendor/notifications');
              }}
              className="font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
            >
              সকল নোটিফিকেশন পেজ
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Detailed Notification Modal (বিস্তারিত মেসেজ পপআপ) */}
      {selectedNotification && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={handleCloseDetailModal}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-slate-50/80 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl border shrink-0 ${getNotificationBg(selectedNotification.type)}`}>
                  {getNotificationIcon(selectedNotification.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-800">
                      {getTypeLabel(selectedNotification.type)}
                    </span>
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {formatTimeAgo(selectedNotification.timestamp || selectedNotification.createdAt)}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                    {selectedNotification.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseDetailModal}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Full Message Details */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-gray-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {selectedNotification.message}
              </div>

              {/* Meta details if available */}
              <div className="text-xs text-gray-500 space-y-1 pt-1">
                {(selectedNotification.timestamp || selectedNotification.createdAt) && (
                  <p className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-700">তারিখ ও সময়:</span>
                    <span>{formatDateTime(selectedNotification.timestamp || selectedNotification.createdAt)}</span>
                  </p>
                )}
                {selectedNotification.orderId && (
                  <p className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-700">অর্ডার আইডি:</span>
                    <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">#{selectedNotification.orderId}</span>
                  </p>
                )}
                {selectedNotification.customerName && (
                  <p className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-700">কাস্টমার:</span>
                    <span>{selectedNotification.customerName}</span>
                  </p>
                )}
                <p className="flex items-center gap-1.5 text-emerald-600 font-medium pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>এই মেসেজটি পঠিত (Read) হিসেবে চিহ্নিত হয়েছে এবং বক্স থেকে সরিয়ে নেওয়া হয়েছে।</span>
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const id = selectedNotification.id;
                  handleCloseDetailModal();
                  deleteNotification(id);
                }}
                className="px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> মুছে ফেলুন
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseDetailModal}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  বন্ধ করুন (Close)
                </button>

                {selectedNotification.link ? (
                  <button
                    type="button"
                    onClick={() => handleNavigateToLink(selectedNotification.link)}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    বিস্তারিত পেজে যান
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCloseDetailModal}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
                  >
                    ঠিক আছে
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
