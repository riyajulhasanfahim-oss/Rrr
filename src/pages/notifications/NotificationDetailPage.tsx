import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { 
  Bell, 
  ArrowLeft, 
  Clock, 
  ShoppingBag, 
  MessageSquare, 
  Star, 
  Banknote, 
  Package, 
  ShieldCheck, 
  Gift, 
  ExternalLink, 
  ArrowRight, 
  CheckCircle2, 
  Share2, 
  Tag, 
  Sparkles,
  Check,
  Store,
  Trash2,
  XCircle
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { 
  AppNotification, 
  getNotificationById, 
  formatBengaliTimeAgo, 
  formatBengaliDigit,
  trackNotificationEvent
} from '../../services/notificationService';
import toast from 'react-hot-toast';

export default function NotificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, markNotificationAsRead, deleteNotification } = useNotifications();

  const [notification, setNotification] = useState<AppNotification | null>(null);
  const [loading, setLoading] = useState(true);
  const lastMarkedIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!id) {
        setLoading(false);
        return;
      }

      // 1. Check if already in context
      const fromContext = notifications.find(n => n.id === id);
      if (fromContext) {
        if (isMounted) {
          setNotification(fromContext);
          setLoading(false);
        }
        if (lastMarkedIdRef.current !== id) {
          lastMarkedIdRef.current = id;
          markNotificationAsRead(id);
          trackNotificationEvent(id, 'details_view', user?.uid).catch(() => {});
        }
        return;
      }

      // 2. Fetch directly from Firebase Realtime Database
      try {
        setLoading(true);
        const data = await getNotificationById(id, user?.uid);
        if (isMounted) {
          setNotification(data);
          setLoading(false);
        }
        if (data && lastMarkedIdRef.current !== id) {
          lastMarkedIdRef.current = id;
          markNotificationAsRead(id);
          trackNotificationEvent(id, 'details_view', user?.uid).catch(() => {});
        }
      } catch (err) {
        console.warn('Error loading notification detail from RTDB:', err);
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [id, user?.uid]);

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
      case 'deal':
      case 'product':
        return <Sparkles className="w-5 h-5 text-amber-500" />;
      default:
        return <Bell className="w-5 h-5 text-sky-600" />;
    }
  };

  const getCategoryName = (type?: string) => {
    switch (type) {
      case 'order_cancelled': return 'অর্ডার বাতিল নোটিশ';
      case 'order': return 'অর্ডার আপডেট';
      case 'promo': return 'অফার ও ডিসকাউন্ট';
      case 'wallet': return 'ওয়ালেট ও লেনদেন';
      case 'deal': return 'হট ডিলস';
      case 'product': return 'নতুন প্রোডাক্ট';
      case 'vendor': return 'ভেন্ডর বিজ্ঞপ্তি';
      case 'reseller': return 'রিসেলার আপডেট';
      case 'review': return 'রিভিউ ও রেটিং';
      default: return 'সাধারণ বিজ্ঞপ্তি';
    }
  };

  // Resolve target action with smart labels & destination formatting
  const resolveActionTarget = () => {
    if (!notification) return null;
    
    let rawLink = notification.link || 
      ((notification as any)?.productId ? `/product/${(notification as any).productId}` : undefined) ||
      ((notification as any)?.storeId ? `/store/${(notification as any).storeId}` : undefined) ||
      ((notification as any)?.shopId ? `/store/${(notification as any).shopId}` : undefined) ||
      (notification.metadata?.productId ? `/product/${notification.metadata.productId}` : undefined) ||
      (notification.metadata?.storeId ? `/store/${notification.metadata.storeId}` : undefined) ||
      (notification.metadata?.link ? String(notification.metadata.link) : undefined);

    if (!rawLink) return null;
    let trimmed = rawLink.trim();
    if (!trimmed) return null;

    // Check if link is a full URL on our own domain (or origin) -> convert to internal path
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const parsed = new URL(trimmed);
        const currentOrigin = window.location.origin;
        if (parsed.origin === currentOrigin || parsed.hostname.includes('rjworld')) {
          trimmed = parsed.pathname + parsed.search + parsed.hash;
        }
      }
    } catch {
      // ignore url parsing error
    }

    // 1. External URLs (different domain)
    if (/^https?:\/\//i.test(trimmed)) {
      return {
        url: trimmed,
        isExternal: true,
        label: 'অফার / এক্সটারনাল লিংক দেখুন',
        icon: <ExternalLink className="w-4 h-4 shrink-0" />
      };
    }
    if (/^(www\.)|([a-z0-9-]+\.(com|org|net|bd|io|co|shop|store|app))/i.test(trimmed)) {
      return {
        url: `https://${trimmed}`,
        isExternal: true,
        label: 'অফার / এক্সটারনাল লিংক দেখুন',
        icon: <ExternalLink className="w-4 h-4 shrink-0" />
      };
    }

    // 2. Internal app routes
    const internalUrl = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

    // Product route
    if (internalUrl.startsWith('/product/') || internalUrl.startsWith('/p/')) {
      return {
        url: internalUrl,
        isExternal: false,
        label: 'পণ্য দেখুন ও অর্ডার করুন',
        icon: <ShoppingBag className="w-4 h-4 shrink-0" />
      };
    }

    // Store / Shop / Vendor route
    if (
      internalUrl.startsWith('/store/') || 
      internalUrl.startsWith('/shop/') || 
      internalUrl.startsWith('/vendor/') || 
      internalUrl.startsWith('/seller/')
    ) {
      return {
        url: internalUrl,
        isExternal: false,
        label: 'শপ / স্টোর ভিজিট করুন',
        icon: <Store className="w-4 h-4 shrink-0" />
      };
    }

    // Category / Collection route
    if (internalUrl.startsWith('/category/') || internalUrl.startsWith('/collection/')) {
      return {
        url: internalUrl,
        isExternal: false,
        label: 'ক্যাটাগরি / অফার দেখুন',
        icon: <Tag className="w-4 h-4 shrink-0" />
      };
    }

    // Orders route
    if (internalUrl.startsWith('/orders') || internalUrl.startsWith('/order/')) {
      const isCancelled = notification.type === 'order_cancelled';
      return {
        url: internalUrl,
        isExternal: false,
        label: isCancelled ? 'বাতিলকৃত অর্ডার বিস্তারিত দেখুন' : 'আপনার অর্ডার দেখুন',
        icon: <Package className="w-4 h-4 shrink-0" />
      };
    }

    // General internal link
    return {
      url: internalUrl,
      isExternal: false,
      label: 'নির্ধারিত পেজে যান',
      icon: <ArrowRight className="w-4 h-4 shrink-0" />
    };
  };

  const actionTarget = resolveActionTarget();

  const handleActionClick = (e: React.MouseEvent) => {
    if (!actionTarget || !notification) return;
    
    // Track link_click event for analytics
    trackNotificationEvent(notification.id, 'link_click', user?.uid).catch(() => {});

    if (actionTarget.isExternal) {
      window.open(actionTarget.url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(actionTarget.url);
    }
  };

  const handleShare = async () => {
    if (navigator.share && notification) {
      try {
        await navigator.share({
          title: notification.title,
          text: notification.message,
          url: window.location.href,
        });
      } catch {
        // Share cancelled or unavailable
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('নোটিফিকেশনের লিংক কপি করা হয়েছে!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-6 sm:pt-8 pb-16 px-4 md:px-8 max-w-2xl mx-auto w-full">
        {/* Back and Navigation Actions */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors text-sm font-semibold group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>ফিরে যান</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (notification) {
                  await deleteNotification(notification.id);
                  navigate(-1);
                }
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-colors shadow-2xs flex items-center gap-1"
              title="নোটিফিকেশন মুছে ফেলুন"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>মুছে ফেলুন</span>
            </button>
            <button
              onClick={handleShare}
              className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
              title="শেয়ার করুন"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <Link
              to="/notifications"
              className="px-3 py-1.5 text-xs font-semibold text-primary-main bg-white border border-sky-200 rounded-xl hover:bg-sky-50 transition-colors shadow-2xs"
            >
              সকল নোটিফিকেশন
            </Link>
          </div>
        </div>

        {/* Content Card */}
        {loading ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm text-center">
            <div className="w-8 h-8 border-3 border-primary-main border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">নোটিফিকেশনের বিস্তারিত লোড হচ্ছে...</p>
          </div>
        ) : notification ? (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in duration-200">
            {/* Header section with category and date */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-sky-50 border border-sky-100">
                  {getCategoryIcon(notification.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary-main bg-sky-50 border border-sky-200/80 px-2.5 py-0.5 rounded-full">
                      {getCategoryName(notification.type)}
                    </span>
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> পঠিত
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatBengaliTimeAgo(notification.createdAt)}</span>
                    <span>•</span>
                    <span>
                      {new Date(notification.createdAt).toLocaleString('bn-BD', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content Body */}
            <div className="p-5 sm:p-6 space-y-5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                {notification.title}
              </h1>

              {/* Image preview (e.g. product image, deal banner) */}
              {notification.imageUrl && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative group max-h-[380px] flex items-center justify-center">
                  <img
                    referrerPolicy="no-referrer"
                    src={notification.imageUrl}
                    alt={notification.title}
                    className="w-full h-auto max-h-[380px] object-cover object-center group-hover:scale-102 transition-transform duration-300"
                    onError={(e) => {
                      const container = (e.target as HTMLElement).parentElement;
                      if (container) container.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Notification Message Text */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-100 text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                {notification.message}
              </div>

              {/* Action Link Button if available */}
              {actionTarget && (
                <div className="pt-2">
                  {actionTarget.isExternal ? (
                    <a
                      href={actionTarget.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        trackNotificationEvent(notification.id, 'link_click', user?.uid).catch(() => {});
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 bg-primary-main hover:bg-sky-600 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all gap-2.5 cursor-pointer text-center"
                    >
                      <span>{actionTarget.label}</span>
                      {actionTarget.icon}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={handleActionClick}
                      className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 bg-primary-main hover:bg-sky-600 text-white rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all gap-2.5 cursor-pointer text-center"
                    >
                      <span>{actionTarget.label}</span>
                      {actionTarget.icon}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Card Footer */}
            <div className="px-5 py-4 sm:px-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>আরজে ওয়ার্ল্ড বিডি অফিসিয়াল নোটিফিকেশন</span>
              </span>

              <Link
                to="/notifications"
                className="text-primary-main font-semibold hover:underline"
              >
                অন্যান্য নোটিফিকেশন দেখুন
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white p-10 rounded-3xl border border-slate-100 text-center shadow-sm">
            <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Bell className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">নোটিফিকেশন পাওয়া যায়নি</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              এই নোটিফিকেশনটি হয়তো মুছে ফেলা হয়েছে বা আপনার অ্যাকাউন্টে বর্তমানে উপলব্ধ নয়।
            </p>
            <Link
              to="/notifications"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary-main text-white text-xs font-bold rounded-xl hover:bg-sky-600 transition-colors"
            >
              নোটিফিকেশন সেন্টারে যান
            </Link>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
