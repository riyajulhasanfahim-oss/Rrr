import React, { useState } from 'react';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { 
  Bell, 
  ArrowLeft, 
  CheckCircle, 
  Info, 
  Tag, 
  X, 
  Clock, 
  ArrowRight, 
  ShoppingBag, 
  MessageSquare, 
  Star, 
  Banknote, 
  Package, 
  ShieldCheck, 
  CheckCheck, 
  Check, 
  Volume2, 
  VolumeX, 
  Gift,
  Trash2,
  XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { 
  AppNotification, 
  formatBengaliTimeAgo, 
  formatBengaliDigit 
} from '../../services/notificationService';

export default function NotificationsPage() {
  const navigate = useNavigate();
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

  const [filterMode, setFilterMode] = useState<'unread' | 'all'>('unread');

  const displayedNotifications = filterMode === 'unread' ? unreadNotifications : notifications;

  const getCategoryIcon = (type?: string) => {
    switch (type) {
      case 'order_cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'order':
      case 'order_new':
        return <ShoppingBag className="w-5 h-5 text-blue-600" />;
      case 'message':
      case 'chat':
        return <MessageSquare className="w-5 h-5 text-rose-600" />;
      case 'review':
        return <Star className="w-5 h-5 text-amber-500 fill-amber-500" />;
      case 'withdraw':
      case 'wallet':
        return <Banknote className="w-5 h-5 text-emerald-600" />;
      case 'promo':
      case 'coupon':
        return <Gift className="w-5 h-5 text-purple-600" />;
      case 'badge':
      case 'security':
        return <ShieldCheck className="w-5 h-5 text-cyan-600" />;
      case 'vendor':
        return <Package className="w-5 h-5 text-indigo-600" />;
      default:
        return <Bell className="w-5 h-5 text-sky-600" />;
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

  const handleOpenDetail = (n: AppNotification) => {
    markNotificationAsRead(n.id);
    navigate(`/notification/${n.id}`);
  };

  const handleNavigateFromModal = (link: string) => {
    closeNotificationDetail();
    navigate(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow pt-6 sm:pt-8 pb-16 px-4 md:px-8 max-w-3xl mx-auto w-full">
        {/* Navigation back and sound toggle */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ফিরে যান</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSound}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-colors shadow-2xs"
            >
              {soundMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-red-500" />
                  <span>শব্দ বন্ধ</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  <span>শব্দ চালু</span>
                </>
              )}
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary-main hover:bg-sky-50 bg-white border border-sky-200 rounded-xl transition-colors shadow-2xs"
              >
                <CheckCheck className="w-4 h-4" />
                <span>সব পঠিত করুন</span>
              </button>
            )}
          </div>
        </div>

        {/* Page Title & Messenger Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <span>নোটিফিকেশন সেন্টার</span>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-bold bg-red-100 text-red-600 rounded-full animate-pulse">
                  {formatBengaliDigit(unreadCount)}টি না-দেখা
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              আপনার অর্ডার, ট্রানজেকশন, অফার ও অ্যাকাউন্ট সংক্রান্ত সকল আপডেট
            </p>
          </div>
          
          {/* Tabs: না-দেখা vs সকল */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
            <button
              onClick={() => setFilterMode('unread')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                filterMode === 'unread' 
                  ? 'bg-white text-primary-main shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              না-দেখা ({formatBengaliDigit(unreadCount)})
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                filterMode === 'all' 
                  ? 'bg-white text-primary-main shadow-xs font-bold' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              সকল ({formatBengaliDigit(notifications.length)})
            </button>
          </div>
        </div>

        {/* Notification List */}
        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center mb-8 shadow-xs">
            <div className="w-8 h-8 border-3 border-primary-main border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">নোটিফিকেশন লোড হচ্ছে...</p>
          </div>
        ) : displayedNotifications.length > 0 ? (
          <div className="space-y-3 mb-8">
            {displayedNotifications.map((n) => {
              const isUnread = !n.isRead;
              return (
                <div 
                  key={n.id} 
                  onClick={() => handleOpenDetail(n)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                    isUnread 
                      ? 'bg-sky-50/70 border-sky-200/80 hover:bg-sky-100/70 shadow-xs' 
                      : 'bg-white border-slate-100 hover:bg-slate-50 shadow-2xs'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl border shrink-0 ${getCategoryBg(n.type)}`}>
                    {getCategoryIcon(n.type)}
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className={`text-sm truncate ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {n.title || 'নোটিফিকেশন'}
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-slate-400">
                          {formatBengaliTimeAgo(n.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteNotification(n.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 rounded-md transition-colors"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${isUnread ? 'text-slate-700' : 'text-slate-500'}`}>
                      {n.message}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100/60">
                      <span className="text-[11px] text-primary-main font-semibold flex items-center gap-1 hover:underline">
                        বিস্তারিত দেখুন <ArrowRight className="w-3 h-3" />
                      </span>
                      {isUnread ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                          নতুন
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                          <Check className="w-3 h-3 text-emerald-500" /> দেখা হয়েছে
                        </span>
                      )}
                    </div>
                  </div>

                  {isUnread && (
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-main shrink-0 mt-2 shadow-xs" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-10 rounded-2xl border border-slate-100 text-center mb-8 shadow-xs">
            <div className="w-14 h-14 bg-sky-50 text-primary-main rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {filterMode === 'unread' ? 'সব নোটিফিকেশন দেখা হয়েছে' : 'কোনো নোটিফিকেশন নেই'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {filterMode === 'unread' 
                ? 'বর্তমানে আপনার কোনো না-দেখা নোটিফিকেশন নেই। পূর্বের সকল নোটিফিকেশন দেখতে নিচে বা "সকল"-এ ক্লিক করুন।' 
                : 'আপনার অ্যাকাউন্টে কোনো নোটিফিকেশন তথ্য পাওয়া যায়নি।'}
            </p>
            {filterMode === 'unread' && notifications.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-sky-50 text-primary-main text-xs font-bold rounded-xl hover:bg-sky-100 transition-colors"
              >
                পূর্বের সকল নোটিফিকেশন দেখুন ({formatBengaliDigit(notifications.length)})
              </button>
            )}
          </div>
        )}

        {/* Modal for Notification Details (Messenger Style) */}
        {selectedNotification && (
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
            onClick={closeNotificationDetail}
          >
            <div 
              className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 p-5 sm:p-6 flex flex-col space-y-4 animate-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${getCategoryBg(selectedNotification.type)}`}>
                    {getCategoryIcon(selectedNotification.type)}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {selectedNotification.title || 'নোটিফিকেশন'}
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

              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                {selectedNotification.message}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <Check className="w-3.5 h-3.5" /> নোটিফিকেশনটি পঠিত (Read/Seen)
                </span>
              </div>

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

        {/* Preferences */}
        <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3">নোটিফিকেশন পছন্দসমূহ</h2>
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-100 space-y-5">
          {[
            { title: 'অর্ডার আপডেট', desc: 'আপনার অর্ডার কনফার্মেশন, শিপিং ও ডেলিভারি সংক্রান্ত রিয়েল-টাইম তথ্য।' },
            { title: 'প্রমোশন ও অফার', desc: 'বিশেষ ভাউচার, ক্যাশব্যাক অফার এবং ফ্ল্যাশ সেল নোটিফিকেশন।' },
            { title: 'ওয়ালেট ও লেনদেন', desc: 'পেমেন্ট ভেরিফিকেশন, ক্যাশব্যালেন্স ও উইথড্র নোটিফিকেশন।' },
            { title: 'নিরাপত্তা সতর্কতা', desc: 'লগইন এবং পাসওয়ার্ড পরিবর্তন সংক্রান্ত জরুরি অ্যালার্ট।' }
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
              <div>
                <h3 className="text-sm font-bold text-slate-800">{item.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-main"></div>
              </label>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
