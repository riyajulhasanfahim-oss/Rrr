import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import VendorLayout from '../../components/layout/VendorLayout';
import { useVendorNotifications } from '../../context/VendorNotificationContext';
import { 
  Bell, 
  ShoppingBag, 
  MessageSquare, 
  Star, 
  Banknote, 
  Package, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Trash2, 
  ArrowRight, 
  Volume2, 
  VolumeX, 
  Smartphone, 
  Sparkles, 
  CheckCheck,
  X,
  CheckCircle2,
  Eye
} from 'lucide-react';

export default function VendorNotifications() {
  const navigate = useNavigate();
  const {
    notifications,
    loading,
    totalUnreadCount,
    unreadNotificationsCount,
    unreadOrdersCount,
    unreadMessagesCount,
    unreadReviewsCount,
    unreadWithdrawCount,
    bengaliCounts,
    soundMuted,
    toggleSound,
    testSound,
    devicePermission,
    requestDevicePermission,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  } = useVendorNotifications();

  const [activeTab, setActiveTab] = useState<'unread' | 'all' | 'order' | 'message' | 'review' | 'withdraw'>('all');
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);

  const filteredNotifications = notifications
    .filter(item => {
      if (activeTab === 'unread') return !item.read;
      if (activeTab === 'all') return true;
      return item.type === activeTab;
    })
    .sort((a, b) => {
      if (a.read !== b.read) {
        return a.read ? 1 : -1;
      }
      const timeA = Number(a.timestamp || a.createdAt || 0);
      const timeB = Number(b.timestamp || b.createdAt || 0);
      return timeB - timeA;
    });

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case 'order':
      case 'order_new':
      case 'new_order':
        return <ShoppingBag className="w-5 h-5 text-blue-600" />;
      case 'message':
        return <MessageSquare className="w-5 h-5 text-rose-600" />;
      case 'review':
        return <Star className="w-5 h-5 text-amber-500 fill-amber-500" />;
      case 'withdraw':
        return <Banknote className="w-5 h-5 text-emerald-600" />;
      case 'inventory':
        return <Package className="w-5 h-5 text-purple-600" />;
      case 'badge':
        return <ShieldCheck className="w-5 h-5 text-cyan-600" />;
      default:
        return <Bell className="w-5 h-5 text-indigo-600" />;
    }
  };

  const getNotificationBadgeClass = (type?: string) => {
    switch (type) {
      case 'order':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'message':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'review':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'withdraw':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'inventory':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'badge':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getTypeLabel = (type?: string) => {
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

  const handleOpenDetail = (item: any) => {
    setSelectedNotification(item);
    if (!item.read) {
      markAsRead(item.id);
    }
  };

  const handleCloseDetail = () => {
    setSelectedNotification(null);
  };

  const handleNavigateToLink = (link: string) => {
    setSelectedNotification(null);
    navigate(link);
  };

  return (
    <VendorLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">নোটিফিকেশন সেন্টার</h1>
              {unreadNotificationsCount > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-bold bg-red-100 text-red-600 rounded-full animate-pulse">
                  {bengaliCounts.total} টা নতুন
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              অর্ডার, মেসেজ, রিভিউ এবং স্টোরের সকল রিয়েল-টাইম নোটিফিকেশন
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                soundMuted 
                  ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' 
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
              title={soundMuted ? 'সাউন্ড বন্ধ আছে (Unmute)' : 'সাউন্ড চালু আছে (Mute)'}
            >
              {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundMuted ? 'শব্দ বন্ধ' : 'শব্দ চালু'}</span>
            </button>

            {/* Test Sound */}
            <button
              onClick={testSound}
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="সাউন্ড টেস্ট করুন"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">সাউন্ড টেস্ট</span>
            </button>

            {/* Mark All Read */}
            {unreadNotificationsCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                সব পঠিত
              </button>
            )}

            {/* Clear All */}
            {notifications.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('আপনি কি নিশ্চিত যে সকল নোটিফিকেশন মুছে ফেলতে চান?')) {
                    clearAll();
                  }
                }}
                className="p-2 rounded-xl border border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-400 hover:text-red-600 text-xs transition-colors"
                title="সকল মুছে ফেলুন"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Push Notification Setup Card */}
        <div className={`p-4 rounded-2xl border transition-all ${
          devicePermission === 'granted' 
            ? 'bg-emerald-50/70 border-emerald-200' 
            : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${
                devicePermission === 'granted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  মোবাইল ও ব্রাউজার নোটিফিকেশন
                  {devicePermission === 'granted' ? (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                      সক্রিয় (Active)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-bold rounded-full">
                      অনুমতি প্রয়োজন
                    </span>
                  )}
                </h4>
                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                  {devicePermission === 'granted'
                    ? 'আপনার ডিভাইসে পুশ নোটিফিকেশন চালু রয়েছে। অর্ডার বা মেসেজ আসলে সাথে সাথে রিংটোন বাজবে।'
                    : 'ফোন বা কম্পিউটারে অর্ডার ও মেসেজের ইনস্ট্যান্ট অ্যালার্ট পেতে নোটিফিকেশন অনুমতি প্রদান করুন।'}
                </p>
              </div>
            </div>

            {devicePermission !== 'granted' && (
              <button
                onClick={requestDevicePermission}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-2xs shrink-0 transition-colors flex items-center justify-center gap-1.5"
              >
                <Bell className="w-4 h-4" />
                নোটিফিকেশন চালু করুন
              </button>
            )}
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('unread')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'unread'
                ? 'bg-blue-600 text-white shadow-2xs font-bold'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            না-দেখা {totalUnreadCount > 0 && <span className="px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[10px] font-bold">{bengaliCounts.total}</span>}
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-2xs font-bold'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            সকল {notifications.length > 0 && `(${notifications.length})`}
          </button>
          <button
            onClick={() => setActiveTab('order')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'order'
                ? 'bg-blue-600 text-white shadow-2xs font-bold'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            অর্ডার {unreadOrdersCount > 0 && <span className="px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[10px]">{bengaliCounts.orders}</span>}
          </button>
          <button
            onClick={() => setActiveTab('message')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'message'
                ? 'bg-blue-600 text-white shadow-2xs font-bold'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            মেসেজ {unreadMessagesCount > 0 && <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px]">{bengaliCounts.messages}</span>}
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'review'
                ? 'bg-blue-600 text-white shadow-2xs font-bold'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            রিভিউ {unreadReviewsCount > 0 && <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px]">{bengaliCounts.reviews}</span>}
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'withdraw'
                ? 'bg-blue-600 text-white shadow-2xs font-bold'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            উইথড্র {unreadWithdrawCount > 0 && <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded-full text-[10px]">{bengaliCounts.withdraw}</span>}
          </button>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-gray-500">নোটিফিকেশন লোড হচ্ছে...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {activeTab === 'unread' ? 'সব নোটিফিকেশন দেখা হয়েছে!' : 'কোনো নোটিফিকেশন নেই'}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {activeTab === 'unread' 
                ? 'যে নোটিফিকেশনগুলো দেখেছেন সেগুলো এই লিস্ট থেকে সরিয়ে নেওয়া হয়েছে। নতুন কিছু আসলে ওপরে শো করবে।'
                : 'নতুন কোনো কাস্টমার অর্ডার, চ্যাট মেসেজ বা রিভিউ আসলে এখানে রিয়েল-টাইমে দেখতে পাবেন।'}
            </p>
            {activeTab === 'unread' && notifications.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors"
              >
                <Eye className="w-4 h-4" />
                পূর্বের সকল নোটিফিকেশন দেখুন ({notifications.length})
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden shadow-xs">
            {filteredNotifications.map(item => {
              const timeFormatted = item.timestamp || item.createdAt
                ? new Date(item.timestamp || item.createdAt || 0).toLocaleString('bn-BD', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })
                : 'এইমাত্র';

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenDetail(item)}
                  className={`p-4 sm:p-5 flex items-start gap-3.5 sm:gap-4 transition-colors cursor-pointer ${
                    item.read ? 'bg-white hover:bg-gray-50/60' : 'bg-blue-50/40 hover:bg-blue-50/70'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl border shrink-0 ${getNotificationBadgeClass(item.type)}`}>
                    {getNotificationIcon(item.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className={`text-xs sm:text-sm font-semibold truncate ${item.read ? 'text-gray-900' : 'text-blue-900 font-bold'}`}>
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeFormatted}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(item.id);
                          }}
                          className="text-gray-300 hover:text-red-500 p-1 rounded-lg transition-colors"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-600 leading-relaxed mb-2.5 line-clamp-2">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(item);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        বিস্তারিত দেখুন <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {!item.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(item.id);
                          }}
                          className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
                        >
                          পঠিত চিহ্নিত করুন
                        </button>
                      )}
                    </div>
                  </div>

                  {!item.read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0 mt-1.5 animate-pulse"></span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Detailed Notification Modal (বিস্তারিত নোটিফিকেশন ভিউ) */}
        {selectedNotification && (
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={handleCloseDetail}
          >
            <div 
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-gray-100 bg-slate-50/80 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${getNotificationBadgeClass(selectedNotification.type)}`}>
                    {getNotificationIcon(selectedNotification.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-800">
                        {getTypeLabel(selectedNotification.type)}
                      </span>
                      <span className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {selectedNotification.timestamp || selectedNotification.createdAt 
                          ? new Date(selectedNotification.timestamp || selectedNotification.createdAt).toLocaleString('bn-BD', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })
                          : 'এইমাত্র'}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                      {selectedNotification.title}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                  title="বন্ধ করুন"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-gray-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {selectedNotification.message}
                </div>

                {/* Additional Info */}
                <div className="text-xs text-gray-500 space-y-1.5 pt-1">
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
                    <span>মেসেজটি পঠিত (Read) হয়েছে। আপনি না-দেখা লিস্টে থাকলে এটি সেখান থেকে সরিয়ে দেওয়া হবে।</span>
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCloseDetail}
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
                    onClick={handleCloseDetail}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
                  >
                    ঠিক আছে
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </VendorLayout>
  );
}
