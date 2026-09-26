import React, { useState, useEffect, useRef } from 'react';
import { useAuth, UserData } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import NotificationBox from '../components/notifications/NotificationBox';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../components/common/LanguageProvider';
import toast from 'react-hot-toast';
import {
  Settings,
  Wallet,
  Package,
  Truck,
  Star,
  RotateCcw,
  Users,
  Store,
  MapPin,
  HelpCircle,
  HeadphonesIcon,
  MessageSquare,
  CreditCard,
  Gift,
  Heart,
  Bell,
  Globe,
  UserPlus,
  FileText,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Flame,
  ShoppingBag,
  MoveHorizontal,
  Edit,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../utils/imageUrl';
import { Product } from '../components/ui/ProductCard';
import { DriveImageUpload } from '../components/common/DriveImageUpload';
import UserReferralModal from '../components/profile/UserReferralModal';
import { fetchCustomerOrders, getCachedCustomerOrders, subscribeToCustomerOrders } from '../services/orderService';
import { getDeliveredUnreviewedItems } from '../services/reviewService';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, query, limit, getDocs } from 'firebase/firestore';
import { fetchAllMarketplaceProducts, subscribeToMarketplaceProducts, getCachedMarketplaceProducts } from '../services/productService';
import { getProductPath } from '../utils/seo';

// Store favorite products (Demo products removed)
const STORE_FAVORITE_PRODUCTS: Product[] = [];

export default function Dashboard() {
  const { user, userData, logout, loading } = useAuth();
  const { unreadCount } = useNotifications();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>(() => getCachedMarketplaceProducts());
  const [customerOrders, setCustomerOrders] = useState<any[]>(() => getCachedCustomerOrders(user?.uid));
  const [loadingOrders, setLoadingOrders] = useState(() => getCachedCustomerOrders(user?.uid).length === 0);
  const [toReviewCount, setToReviewCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCustomerOrders([]);
      setLoadingOrders(false);
      return;
    }

    // Instant data from cache
    const cached = getCachedCustomerOrders(user.uid);
    if (cached.length > 0) {
      setCustomerOrders(cached);
      setLoadingOrders(false);
    }

    const phone = user.phoneNumber || userData?.phone;
    const email = user.email || userData?.email;

    // Realtime live subscription so orders never disappear upon navigation
    const unsub = subscribeToCustomerOrders(
      user.uid,
      phone,
      email,
      (orders) => {
        if (orders.length > 0) {
          setCustomerOrders(orders);
        } else {
          const curCached = getCachedCustomerOrders(user.uid);
          if (curCached.length > 0) {
            setCustomerOrders(curCached);
          } else {
            setCustomerOrders([]);
          }
        }
        setLoadingOrders(false);
      }
    );

    getDeliveredUnreviewedItems(user.uid, phone, email)
      .then(unreviewed => {
        setToReviewCount(Array.isArray(unreviewed) ? unreviewed.length : 0);
      })
      .catch(() => {});

    return () => unsub();
  }, [user?.uid, user?.phoneNumber, userData?.phone, user?.email, userData?.email]);

  const toPayCount = customerOrders.filter(o => o.status === 'Pending' || o.paymentStatus === 'Pending').length;
  const toShipCount = customerOrders.filter(o => ['Processing', 'Accepted', 'Confirmed'].includes(o.status)).length;
  const toReceiveCount = customerOrders.filter(o => ['Shipped', 'In Transit', 'Out for Delivery'].includes(o.status)).length;

  // Drag-to-scroll state for frictionless mouse & touch scrolling
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollStartLeft, setScrollStartLeft] = useState(0);
  const [draggedDistance, setDraggedDistance] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const processAndSetProducts = (all: Product[]) => {
      if (!isMounted || !all || all.length === 0) return;

      // Prioritize real vendor products
      const scored = all.map(p => {
        let score = 0;
        const vId = String(p.vendorId || p.vendor?.id || '').trim();
        if (vId && (p.vendor?.storeName || p.vendor?.name)) {
          score += 100;
        }
        if (p.featuredImage || p.image) {
          score += 10;
        }
        return { p, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const sorted = scored.map(s => s.p);

      setRelatedProducts(sorted);
    };

    fetchAllMarketplaceProducts()
      .then((all) => {
        processAndSetProducts(all);
      })
      .catch((err) => {
        console.warn('Could not fetch products for dashboard shelf:', err);
      });

    const unsubscribe = subscribeToMarketplaceProducts((liveList) => {
      processAndSetProducts(liveList);
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Mouse Drag-To-Scroll Handlers (for effortless desktop click-and-drag)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    setIsMouseDown(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollStartLeft(scrollRef.current.scrollLeft);
    setDraggedDistance(0);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Smooth 1.5x displacement
    scrollRef.current.scrollLeft = scrollStartLeft - walk;
    setDraggedDistance(prev => prev + Math.abs(walk));
  };

  const handleMouseUpOrLeave = () => {
    setIsMouseDown(false);
  };

  // Prevent accidental navigation when user dragged to scroll
  const handleProductCardClick = (e: React.MouseEvent, product: Product) => {
    if (draggedDistance > 8) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    navigate(getProductPath(product), { state: { product } });
  };

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -260, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 260, behavior: 'smooth' });
    }
  };

  const handleProfileImageUploaded = async (url: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        photo: url
      });
      setIsEditModalOpen(false);
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };
  const navigate = useNavigate();
  const { t, language, toggleLanguage } = useLanguage();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const activeUserData: UserData | null = userData || (user ? {
    uid: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'RJ WORLD BD User',
    email: user.email || '',
    phone: user.phoneNumber || null,
    photo: user.photoURL || null,
    role: 'user',
    status: 'active',
    balance: 0,
    wallet: 0,
    language: 'en',
    createdAt: Date.now(),
  } : null);

  if (loading && !activeUserData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="w-8 h-8 border-3 border-primary-main border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!activeUserData) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* 1. Modern Profile Header (Compact & Sleek) */}
        <div className="bg-white px-3.5 py-3.5 sm:px-5 sm:py-4 shadow-2xs rounded-b-2xl relative">
          <div className="absolute top-3 right-3 sm:right-6 flex items-center gap-1.5">
            <div className="relative">
              <button 
                type="button"
                onClick={() => setIsNotificationOpen(prev => !prev)}
                title="নোটিফিকেশন"
                className="relative p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors flex items-center justify-center"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center shadow-xs animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <NotificationBox
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
              />
            </div>
            <button 
              onClick={() => navigate('/settings')}
              title="Account Settings"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative shrink-0">
              {activeUserData.photo ? (
                <img referrerPolicy="no-referrer" src={activeUserData.photo} alt={activeUserData.name} className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover border-2 border-slate-100 shadow-xs" />
              ) : (
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gradient-to-br from-primary-main to-sky-400 flex items-center justify-center text-white text-lg sm:text-xl font-bold shadow-xs border-2 border-white">
                  {(activeUserData.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate leading-snug">{activeUserData.name}</h2>
              <p className="text-[11px] sm:text-xs text-slate-400 mb-1">ID: {(user?.uid || activeUserData.uid).substring(0, 8).toUpperCase()}</p>
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-1 text-xs font-semibold text-primary-main bg-sky-50 px-2.5 py-0.5 rounded-full hover:bg-sky-100 transition-colors w-fit"
              >
                <Edit className="w-3 h-3" /> Edit Profile
              </button>
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-5 py-3 sm:py-4 space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* 2. Compact Wallet / Total Balance Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                <Wallet className="w-20 h-20" />
              </div>
              <div className="relative z-10 flex justify-between items-start mb-2.5 sm:mb-3">
                <div>
                  <p className="text-white/70 text-xs font-medium mb-0.5">Total Balance</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">৳{(activeUserData.wallet ?? 100).toFixed(2)}</h3>
                  <p className="text-white/60 text-[11px] mt-0.5">Pending: ৳0.00</p>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  <span className="text-[11px] font-semibold">{activeUserData.role || 'Active User'}</span>
                </div>
              </div>
              <div className="relative z-10 flex gap-2.5 mt-2 sm:mt-auto">
                <button onClick={() => navigate('/withdraw')} className="flex-1 bg-white text-slate-900 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm hover:bg-slate-100 active:scale-95 transition-all shadow-xs">
                  Withdraw
                </button>
                <button onClick={() => navigate('/wallet')} className="flex-1 bg-white/10 text-white py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm hover:bg-white/20 active:scale-95 transition-all backdrop-blur-md">
                  Wallet
                </button>
              </div>
            </div>

            {/* 3. My Orders Section (Balanced 5-col grid with live badges) */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-xs border border-slate-100 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2.5 sm:mb-3">
                <Link to="/orders" className="group flex flex-col cursor-pointer">
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base group-hover:text-primary-main transition-colors">My Orders</h3>
                  {customerOrders.length > 0 && (
                    <p className="text-[10px] text-slate-400">
                      {customerOrders.length} {customerOrders.length === 1 ? 'order' : 'orders'} placed
                    </p>
                  )}
                </Link>
                <Link to="/orders" className="text-xs font-semibold text-slate-500 hover:text-primary-main flex items-center gap-0.5">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-5 gap-1 items-start px-0.5 sm:px-1 mt-auto pb-0.5">
                {[
                  { icon: Wallet, label: 'To Pay', path: '/orders?tab=Pending', count: toPayCount },
                  { icon: Package, label: 'To Ship', path: '/orders?tab=Processing', count: toShipCount },
                  { icon: Truck, label: 'To Receive', path: '/orders?tab=Shipped', count: toReceiveCount },
                  { icon: Star, label: 'Reviews', path: '/my-reviews', count: toReviewCount },
                  { icon: RotateCcw, label: 'Returns', path: '/returns', count: 0 },
                ].map((item, idx) => (
                  <Link to={item.path} key={idx} className="flex flex-col items-center gap-1.5 group cursor-pointer min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-50 group-hover:bg-sky-50 flex items-center justify-center text-slate-600 group-hover:text-primary-main transition-colors relative shadow-2xs">
                      <item.icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      {item.count > 0 && (
                        <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                          {item.count > 9 ? '9+' : item.count}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-medium text-slate-600 text-center leading-tight truncate w-full px-0.5">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Services Grid */}
          <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 text-base md:text-lg mb-4">My Services</h3>
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-y-4 gap-x-2">
              {[
                { icon: Users, label: 'Reseller', color: 'text-blue-500', bg: 'bg-blue-50', to: userData?.role === 'Reseller' ? '/reseller/dashboard' : '/reseller/apply' },
                { icon: Store, label: 'Vendor', color: 'text-purple-500', bg: 'bg-purple-50', to: (userData?.role === 'Vendor' && userData?.hasActiveVendor) ? '/vendor-dashboard' : '/become-vendor' },
                { icon: UserPlus, label: 'Refer & Earn', color: 'text-orange-500', bg: 'bg-orange-50', to: '/reseller/referrals' },
                { icon: HelpCircle, label: 'Help Center', color: 'text-pink-500', bg: 'bg-pink-50', to: '/help-center' },
                { icon: HeadphonesIcon, label: 'Customer Care', color: 'text-teal-500', bg: 'bg-teal-50', to: '/customer-care' },
                { icon: MessageSquare, label: 'My Reviews', color: 'text-indigo-500', bg: 'bg-indigo-50', to: '/my-reviews' },
                { icon: MessageSquare, label: 'My Chats', color: 'text-sky-500', bg: 'bg-sky-50', to: '/my-chats' },
                { icon: CreditCard, label: 'Payment Methods', color: 'text-rose-500', bg: 'bg-rose-50', to: '/payment-methods' },
                { icon: Gift, label: 'Coupons', color: 'text-amber-500', bg: 'bg-amber-50', to: '/coupons' },
                { icon: Heart, label: 'Wishlist', color: 'text-red-500', bg: 'bg-red-50', to: '/wishlist' },
                { icon: Bell, label: 'Notifications', color: 'text-cyan-500', bg: 'bg-cyan-50', to: '/notifications', badge: unreadCount > 0 ? unreadCount : undefined },
                { icon: Settings, label: 'Settings', color: 'text-slate-500', bg: 'bg-slate-100', to: '/settings' },
              ].map((item, idx) => (
                <Link to={item.to} key={idx} className="flex flex-col items-center gap-2 cursor-pointer group">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl ${item.bg} flex items-center justify-center ${item.color} group-hover:scale-105 transition-transform relative`}>
                    <item.icon className="w-5 h-5 md:w-6 md:h-6" />
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center shadow-xs animate-pulse">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] md:text-xs font-medium text-slate-600 text-center leading-tight truncate w-full px-1">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
          
          {/* 4. Related Products (Customer Favorites - Touch & Drag Scroll) */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 md:p-5 shadow-2xs border border-slate-100">
            <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-200/50 flex items-center justify-center text-amber-500 shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-tight truncate">Related Products</h3>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.2 rounded-full hidden sm:inline-flex items-center gap-1 shrink-0">
                      <Flame className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> দোকানে সেরা পছন্দ
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">দোকানে এসে গ্রাহকদের পছন্দের শীর্ষে থাকা পণ্যসমূহ</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">
                <span className="text-[10px] sm:text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {relatedProducts.length} items
                </span>
                {/* Visual drag/swipe hint badge */}
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                  <MoveHorizontal className="w-3 h-3 text-slate-400" /> টেনে বা সোয়াইপ করুন
                </span>
                {/* Desktop Arrow Scroll Controls */}
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={scrollLeft}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                    aria-label="Scroll left"
                    title="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={scrollRight}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                    aria-label="Scroll right"
                    title="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Drag & Touch Scrollable Product Shelf */}
            <div 
              ref={scrollRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className={`flex overflow-x-auto gap-2.5 sm:gap-3 pb-2 pt-1 hide-scrollbar select-none touch-pan-x overscroll-x-contain ${
                isMouseDown ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              style={{
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {relatedProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={(e) => handleProductCardClick(e, product)}
                  className="group relative w-28 sm:w-32 md:w-36 shrink-0 bg-slate-50/70 hover:bg-white rounded-xl border border-slate-200/70 hover:border-amber-400/60 p-1.5 sm:p-2 transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between cursor-pointer select-none"
                >
                  {/* Compact Image Container with controlled height */}
                  <div className="relative w-full h-20 sm:h-24 rounded-lg overflow-hidden bg-white mb-1.5 shrink-0 border border-slate-100/90 pointer-events-none">
                    <img 
                      referrerPolicy="no-referrer" 
                      loading="lazy" 
                      draggable={false}
                      src={formatDirectImageUrl(product.featuredImage || product.image || (product.images && product.images.length > 0 ? product.images[0] : '')) || PLACEHOLDER_PRODUCT_IMAGE} 
                      alt={product.name}
                      onError={(e) => handleProductImageError(e)}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300 pointer-events-none select-none"
                    />
                    {product.discount && (
                      <span className="absolute top-1 left-1 px-1 py-0.2 text-[9px] font-black bg-rose-500 text-white rounded shadow-2xs">
                        -{product.discount}%
                      </span>
                    )}
                    {product.category && (
                      <span className="absolute bottom-1 right-1 px-1 py-0.2 text-[8px] font-semibold bg-black/60 backdrop-blur-xs text-white rounded max-w-[85%] truncate">
                        {product.category}
                      </span>
                    )}
                  </div>

                  {/* Compact Product Details */}
                  <div className="flex flex-col flex-1 justify-between gap-1 pointer-events-none">
                    <h4 
                      className="text-[11px] sm:text-xs font-semibold text-slate-800 line-clamp-1 group-hover:text-amber-600 transition-colors leading-tight" 
                      title={product.name}
                    >
                      {product.name}
                    </h4>

                    {(product.vendor?.storeName || product.vendor?.name) && (
                      <div className="flex items-center gap-1 text-[9px] font-semibold text-sky-700 bg-sky-50/80 px-1.5 py-0.5 rounded border border-sky-100 max-w-full truncate">
                        <Store className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                        <span className="truncate">{product.vendor?.storeName || product.vendor?.name}</span>
                      </div>
                    )}
                    
                    <div className="flex items-baseline justify-between gap-1 mt-auto">
                      <div className="flex items-baseline gap-1 min-w-0">
                        <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                          ৳{Number(product.price).toFixed(0)}
                        </span>
                        {product.originalPrice && Number(product.originalPrice) > Number(product.price) && (
                          <span className="text-[10px] text-slate-400 line-through truncate hidden sm:inline">
                            ৳{Number(product.originalPrice).toFixed(0)}
                          </span>
                        )}
                      </div>
                      {product.rating && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-500 shrink-0">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          {product.rating}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Quick Menu */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex flex-col divide-y divide-slate-50">
              {[
                { icon: MapPin, label: 'Shipping Address', action: () => navigate('/shipping-address') },
                { icon: CreditCard, label: 'Saved Cards', action: () => navigate('/saved-cards') },
                { icon: Globe, label: 'Language', action: toggleLanguage, value: language === 'en' ? 'English' : 'বাংলা' },
                { icon: UserPlus, label: 'Invite Friends', badge: 'Earn ৳10', action: () => setIsReferralModalOpen(true) },
                { icon: HelpCircle, label: 'Support', action: () => navigate('/support') },
                { icon: FileText, label: 'Privacy Policy', action: () => navigate('/privacy-policy') },
              ].map((item, idx) => (
                <button key={idx} onClick={item.action} className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 md:p-4 transition-colors">
                  <div className="flex items-center gap-4">
                    <item.icon className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.value && <span className="text-sm text-slate-500">{item.value}</span>}
                    {item.badge && <span className="text-xs font-bold text-white bg-orange-500 px-2.5 py-1 rounded-full">{item.badge}</span>}
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </button>
              ))}
              
              <button onClick={handleLogout} className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 md:p-4 transition-colors text-red-500">
                <div className="flex items-center gap-4">
                  <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="text-sm font-medium">Logout</span>
                </div>
                <ChevronRight className="w-4 h-4 text-red-200" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-4 md:p-5 w-full max-w-md relative">
            <button 
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-bold mb-4">Edit Profile Picture</h3>
            <DriveImageUpload 
              onUploadSuccess={handleProfileImageUploaded} 
              folderName="Profile Photos"
            />
          </div>
        </div>
      )}

      {isReferralModalOpen && (
        <UserReferralModal onClose={() => setIsReferralModalOpen(false)} />
      )}
    </div>
  );
}
