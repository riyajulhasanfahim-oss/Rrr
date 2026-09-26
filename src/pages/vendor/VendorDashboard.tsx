import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useVendorStore } from '../../context/VendorStoreContext';
import { rtdbGet, rtdbSet, rtdbUpdate, rtdbList, rtdbPush, rtdbSubscribe } from '../../lib/rtdb';
import VendorLayout from '../../components/layout/VendorLayout';
import VerifiedBadge from '../../components/ui/VerifiedBadge';
import { 
  Package, 
  ShoppingCart, 
  Banknote, 
  TrendingUp, 
  Store,
  BadgeCheck,
  AlertCircle,
  Plus,
  ArrowRight,
  X,
  CheckCircle,
  Clock,
  Edit,
  Star,
  MapPin,
  Users,
  Facebook,
  Instagram,
  Youtube,
  LayoutDashboard,
  ArchiveRestore,
  MessageSquare,
  Wallet,
  Bell,
  Settings,
  Copy,
  Check,
  Headset,
  Rocket,
  Megaphone,
  Truck,
  Phone,
  Mail,
  Globe,
  MessageCircle,
  Smartphone,
  Coins,
  Receipt,
  Lock,
  Share2
} from 'lucide-react';
import StoreShareModal from '../../components/vendor-store/StoreShareModal';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useVendorNotifications } from '../../context/VendorNotificationContext';
import PaymentMethodSelectionModal from '../../components/checkout/PaymentMethodSelectionModal';
import BkashPaymentModal from '../../components/checkout/BkashPaymentModal';
import NagadPaymentModal from '../../components/checkout/NagadPaymentModal';
import RocketPaymentModal from '../../components/checkout/RocketPaymentModal';
import UpayPaymentModal from '../../components/checkout/UpayPaymentModal';
import PaymentSuccessModal from '../../components/payment/PaymentSuccessModal';
import { verifyPaymentAutomatic, type VerificationResult } from '../../services/automaticPaymentVerificationService';
import { isStorePlanVerified, saveStoreToCache } from '../../services/storeCache';
import { clearVendorLocationCache } from '../../services/vendorLocationService';
import { 
  getVerifiedBadgeSettings, 
  calculateBadgeExpiry, 
  getBadgeExpiryDetails 
} from '../../services/verifiedBadgeService';
import { getVendorPlatformFee } from '../../services/platformFeeService';
import { format } from 'date-fns';
import { fetchVendorReviews, replyToCustomerReview, ProductReview } from '../../services/reviewService';
import { calculateResellerLockedProfitFromOrders } from '../../services/vendorResellerOrderService';
import { 
  getVendorOpenUrl, 
  slugifyVendorName, 
  PRIMARY_DOMAIN 
} from '../../utils/subdomain';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

export default function VendorDashboard() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const {
    unreadOrdersCount,
    unreadMessagesCount,
    unreadReviewsCount,
    unreadWithdrawCount,
    unreadNotificationsCount,
    totalUnreadCount,
    bengaliCounts,
    devicePermission,
    requestDevicePermission
  } = useVendorNotifications();
  const { 
    vendorInfo, 
    updateVendorInfo, 
    dashboardStats, 
    setDashboardStats,
    salesChartData,
    setSalesChartData,
    topProductsList,
    setTopProductsList 
  } = useVendorStore();

  const [loading, setLoading] = useState(() => !vendorInfo);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isStoreShareModalOpen, setIsStoreShareModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCodEnabled, setIsCodEnabled] = useState<boolean>(() => {
    if (vendorInfo?.isCodEnabled !== undefined) return Boolean(vendorInfo.isCodEnabled);
    if (vendorInfo?.codEnabled !== undefined) return Boolean(vendorInfo.codEnabled);
    return true;
  });
  const [isTogglingCod, setIsTogglingCod] = useState<boolean>(false);
  const isTogglingCodRef = useRef<boolean>(false);
  const isFetchingVendorDataRef = useRef<boolean>(false);

  // Dynamic live stats loaded from RTDB, seeded from persistent context
  const [stats, setStats] = useState(() => dashboardStats || {
    totalProducts: 0,
    activeProducts: 0,
    outOfStock: 0,
    totalOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    todaySales: 0,
    weeklySales: 0,
    monthlySales: 0,
    walletBalance: 0,
    pendingWithdraw: 0,
    resellerLockedProfit: 0,
  });

  const [resellerLockedProfit, setResellerLockedProfit] = useState<number>(0);

  const [salesData, setSalesData] = useState<any[]>(() => salesChartData || [
    { name: 'Sun', sales: 0, revenue: 0 },
    { name: 'Mon', sales: 0, revenue: 0 },
    { name: 'Tue', sales: 0, revenue: 0 },
    { name: 'Wed', sales: 0, revenue: 0 },
    { name: 'Thu', sales: 0, revenue: 0 },
    { name: 'Fri', sales: 0, revenue: 0 },
    { name: 'Sat', sales: 0, revenue: 0 },
  ]);

  const [topProducts, setTopProducts] = useState<any[]>(() => topProductsList || []);
  const [duePlatformFee, setDuePlatformFee] = useState<number>(0);

  // Synchronize isCodEnabled when vendorInfo updates, but NEVER overwrite while user is actively toggling
  useEffect(() => {
    if (vendorInfo && !isTogglingCodRef.current) {
      const activeCod = vendorInfo.isCodEnabled !== undefined 
        ? Boolean(vendorInfo.isCodEnabled) 
        : vendorInfo.codEnabled !== undefined 
        ? Boolean(vendorInfo.codEnabled) 
        : true;
      setIsCodEnabled(activeCod);
    }
  }, [vendorInfo]);

  // Verified Seller Plan Payment States (identical to working Checkout / Vendor Registration flow)
  const [showPaymentSelectionModal, setShowPaymentSelectionModal] = useState<boolean>(false);
  const [selectedPaymentChannel, setSelectedPaymentChannel] = useState<'bkash' | 'nagad' | 'rocket' | 'upay' | null>(null);
  const [showBkashModal, setShowBkashModal] = useState<boolean>(false);
  const [showNagadModal, setShowNagadModal] = useState<boolean>(false);
  const [showRocketModal, setShowRocketModal] = useState<boolean>(false);
  const [showUpayModal, setShowUpayModal] = useState<boolean>(false);
  const [showPaymentSuccessModal, setShowPaymentSuccessModal] = useState<boolean>(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string>('');
  const [verifiedPlanPrice, setVerifiedPlanPrice] = useState<number>(100);
  const [verifiedPlanMonths, setVerifiedPlanMonths] = useState<number>(2);
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string>(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let inv = 'S2N';
    for (let i = 0; i < 9; i++) {
      inv += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return inv;
  });

  const [vendorReviews, setVendorReviews] = useState<ProductReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false);

  useEffect(() => {
    if (user?.uid) {
      setLoadingReviews(true);
      fetchVendorReviews(user.uid)
        .then(revs => setVendorReviews(revs))
        .catch(err => console.warn('Failed to load vendor reviews in dashboard:', err))
        .finally(() => setLoadingReviews(false));
    }
  }, [user?.uid]);

  useEffect(() => {
    const fetchVendorData = async () => {
      if (!user || isFetchingVendorDataRef.current) return;
      isFetchingVendorDataRef.current = true;
      try {
        // Fetch from RTDB across vendor_profiles, vendors, and stores
        const [profileSnap, vendorSnap, storeSnap] = await Promise.all([
          rtdbGet<any>(`vendor_profiles/${user.uid}`),
          rtdbGet<any>(`vendors/${user.uid}`),
          rtdbGet<any>(`stores/${user.uid}`)
        ]);

        // Fallback to local storage cache if available
        let cachedProf: any = null;
        let cachedVen: any = null;
        try {
          const p = localStorage.getItem('rj_vendor_profile_' + user.uid);
          if (p) cachedProf = JSON.parse(p);
          const v = localStorage.getItem('rj_active_vendor_' + user.uid);
          if (v) cachedVen = JSON.parse(v);
        } catch (_) {}

        const vInfo = vendorSnap || profileSnap || storeSnap;

        // STRICT ACCESS CONTROL: Do NOT auto-create a vendor store if one doesn't exist or is not paid
        if (!vInfo) {
          try {
            localStorage.removeItem('rj_has_active_vendor_' + user.uid);
            localStorage.removeItem('rj_active_vendor_' + user.uid);
          } catch (_) {}
          toast.error('ভেন্ডর ড্যাশবোর্ড ব্যবহারের জন্য প্রথমে রেজিস্ট্রেশন এবং প্যাকেজ ফি পেমেন্ট সম্পন্ন করতে হবে।');
          navigate('/become-vendor', { replace: true });
          return;
        }

        const rawStatus = (vInfo.status || '').toLowerCase();
        const isApproved = rawStatus === 'active' || rawStatus === 'approved';
        const isPaid = Boolean(
          vInfo.registrationPayment === 'completed' || 
          vInfo.transactionId || 
          vInfo.verifiedAt ||
          vInfo.paymentMethod ||
          vInfo.registrationFee === 0
        );

        if (rawStatus === 'pending' || !isApproved || !isPaid) {
          try {
            localStorage.removeItem('rj_has_active_vendor_' + user.uid);
            localStorage.removeItem('rj_active_vendor_' + user.uid);
          } catch (_) {}
          if (rawStatus === 'pending') {
            toast('আপনার ভেন্ডর রেজিস্ট্রেশন ও পেমেন্ট ভেরিফিকেশন অপেক্ষমান রয়েছে। অনুমোদন সম্পন্ন হলে ড্যাশবোর্ড সক্রিয় হবে।', { icon: '⏳' });
          } else {
            toast.error('ভেন্ডর প্যাকেজ পেমেন্ট ও রেজিস্ট্রেশন ধাপ সম্পন্ন না করা পর্যন্ত ড্যাশবোর্ড খোলা সম্ভব নয়।');
          }
          navigate('/become-vendor', { replace: true });
          return;
        }

        let combinedData: any = {
          ...(storeSnap || {}),
          ...(vendorSnap || {}),
          ...(cachedVen || {}),
          ...(cachedProf || {}),
          ...(profileSnap || {})
        };

        if (!combinedData.logo && (vendorSnap?.logo || storeSnap?.logo || vendorSnap?.profileImage)) {
          combinedData.logo = vendorSnap?.logo || storeSnap?.logo || vendorSnap?.profileImage;
        }
        if (!combinedData.banner && (vendorSnap?.banner || storeSnap?.banner)) {
          combinedData.banner = vendorSnap?.banner || storeSnap?.banner;
        }
        
        // Synchronize isCodEnabled from fetched data ONLY if the user is not actively toggling it
        if (!isTogglingCodRef.current) {
          const codSetting = (combinedData as any).isCodEnabled !== undefined 
            ? Boolean((combinedData as any).isCodEnabled) 
            : (combinedData as any).codEnabled !== undefined 
            ? Boolean((combinedData as any).codEnabled) 
            : true;
          setIsCodEnabled(codSetting);
        }

          // 1. Fetch real Products from RTDB for this vendor
          let vendorProducts: any[] = [];
          try {
            const prodList = await rtdbList('products', (p: any) => p?.vendorId === user.uid || p?.userId === user.uid);
            vendorProducts = prodList.map(item => ({ id: item.id, ...item.data }));
          } catch (pErr) {
            console.warn('Could not query vendor products from RTDB:', pErr);
          }

          const totalProducts = vendorProducts.length;
          const activeProducts = vendorProducts.filter(p => p.status === 'Published').length;
          const outOfStock = vendorProducts.filter(p => !p.stock || Number(p.stock) <= 0).length;

          // 2. Fetch real Orders from RTDB for this vendor
          let vendorOrders: any[] = [];
          let currentResellerLockedProfit = 0;
          try {
            const vOrders = await rtdbList('vendor_orders', (o: any) => o?.vendorId === user.uid || o?.userId === user.uid);
            const mOrders = await rtdbList('orders', (o: any) => o?.vendorId === user.uid || o?.userId === user.uid);
            const rOrders = await rtdbList('reseller_orders', (o: any) => o?.vendorId === user.uid || o?.userId === user.uid);
            const orderMap = new Map();
            vOrders.forEach(item => {
              const orderData = { id: item.id, ...item.data };
              orderMap.set(item.id || (item.data as any)?.orderId, orderData);
            });
            mOrders.forEach(item => {
              const k = item.id || (item.data as any)?.orderId;
              if (!orderMap.has(k)) {
                orderMap.set(k, { id: item.id, ...item.data });
              }
            });
            vendorOrders = Array.from(orderMap.values());

            // Reseller Locked Profit Calculation:
            // Sum all Reseller Orders where profitStatus is currently 'LOCKED'
            // Exclude RELEASED, CANCELLED, RETURNED, PENDING
            const allRawOrders = [
              ...vOrders.map(item => ({ id: item.id, ...item.data })),
              ...mOrders.map(item => ({ id: item.id, ...item.data })),
              ...rOrders.map(item => ({ id: item.id, ...item.data }))
            ];
            currentResellerLockedProfit = calculateResellerLockedProfitFromOrders(allRawOrders);
            setResellerLockedProfit(currentResellerLockedProfit);
          } catch (oErr) {
            console.warn('Could not query vendor orders from RTDB:', oErr);
          }

          const now = new Date();
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

          const totalOrders = vendorOrders.length;
          const pendingOrders = vendorOrders.filter(o => o.status === 'Pending').length;
          const processingOrders = vendorOrders.filter(o => ['Accepted', 'Processing', 'In Transit', 'Out for Delivery'].includes(o.status)).length;
          const completedOrders = vendorOrders.filter(o => o.status === 'Delivered').length;
          const cancelledOrders = vendorOrders.filter(o => ['Cancelled', 'Rejected', 'Refunded'].includes(o.status)).length;

          const todaySales = vendorOrders
            .filter(o => (o.createdAt || 0) >= startOfToday && o.status !== 'Cancelled')
            .reduce((sum, o) => sum + Number(o.grandTotal || o.total || o.subtotal || 0), 0);

          const weeklySales = vendorOrders
            .filter(o => (o.createdAt || 0) >= startOfWeek && o.status !== 'Cancelled')
            .reduce((sum, o) => sum + Number(o.grandTotal || o.total || o.subtotal || 0), 0);

          const monthlySales = vendorOrders
            .filter(o => (o.createdAt || 0) >= startOfMonth && o.status !== 'Cancelled')
            .reduce((sum, o) => sum + Number(o.grandTotal || o.total || o.subtotal || 0), 0);

          // 3. Fetch real Wallet balance from RTDB
          let walletBalance = 0;
          let pendingWithdraw = 0;
          try {
            const w = (await rtdbGet<any>(`vendor_wallet/${user.uid}`)) || (await rtdbGet<any>(`wallets/${user.uid}`));
            if (w) {
              walletBalance = w.balance ?? w.availableBalance ?? 0;
              pendingWithdraw = w.pendingBalance ?? w.pendingWithdraw ?? 0;
            }
          } catch (wErr) {
            console.warn('Could not query vendor wallet from RTDB:', wErr);
          }

          const calculatedStats = {
            totalProducts,
            activeProducts,
            outOfStock,
            totalOrders,
            pendingOrders,
            processingOrders,
            completedOrders,
            cancelledOrders,
            todaySales,
            weeklySales,
            monthlySales,
            walletBalance,
            pendingWithdraw,
            resellerLockedProfit: currentResellerLockedProfit,
          };
          setStats(calculatedStats);
          setDashboardStats(calculatedStats);

          // 4. Calculate 7-day revenue overview for Chart
          const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const last7Days: any[] = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const dayStart = d.getTime();
            const dayEnd = dayStart + 24 * 60 * 60 * 1000;
            const dayName = daysOfWeek[d.getDay()];
            const dayOrders = vendorOrders.filter(o => {
              const ct = o.createdAt || 0;
              return ct >= dayStart && ct < dayEnd && o.status !== 'Cancelled';
            });
            const dayRev = dayOrders.reduce((sum, o) => sum + Number(o.grandTotal || o.total || 0), 0);
            last7Days.push({ name: dayName, sales: dayOrders.length, revenue: dayRev });
          }
          setSalesData(last7Days);
          setSalesChartData(last7Days);

          // 5. Populate Top Products from real products
          if (vendorProducts.length > 0) {
            const calculatedTopProducts = vendorProducts.slice(0, 4).map(p => ({
              id: p.id,
              name: p.name || p.productName || 'Unnamed Product',
              sales: p.salesCount || p.orderCount || 0,
              revenue: (p.salePrice || p.price || 0) * (p.salesCount || p.orderCount || 0)
            }));
            setTopProducts(calculatedTopProducts);
            setTopProductsList(calculatedTopProducts);
          } else {
            setTopProducts([]);
            setTopProductsList([]);
          }

          // 6. Fetch Vendor Platform Fee summary
          try {
            const feeSummary = await getVendorPlatformFee(user.uid);
            setDuePlatformFee(feeSummary?.duePlatformFee || 0);
          } catch (feeErr) {
            console.warn("Could not load vendor platform fee:", feeErr);
          }

        } catch (error) {
          console.error("Error fetching vendor data from RTDB", error);
        } finally {
          setLoading(false);
          isFetchingVendorDataRef.current = false;
        }
    };

    const fetchPlanPrice = async () => {
      try {
        const settings = await getVerifiedBadgeSettings();
        if (typeof settings.price === 'number' && settings.price >= 0) {
          setVerifiedPlanPrice(settings.price);
        }
        if (typeof settings.validityMonths === 'number' && settings.validityMonths > 0) {
          setVerifiedPlanMonths(settings.validityMonths);
        }
      } catch (err) {
        console.warn('Could not load plan price settings from RTDB:', err);
      }
    };

    fetchVendorData();
    fetchPlanPrice();

    // Listen for real-time updates from ShopProfile save or storage events with debounce
    let debounceTimer: any = null;
    const handleProfileUpdate = () => {
      if (isTogglingCodRef.current) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchVendorData();
      }, 300);
    };

    window.addEventListener('vendor_profile_updated', handleProfileUpdate);
    window.addEventListener('vendor_order_updated', handleProfileUpdate);
    window.addEventListener('reseller_profit_updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);

    // RTDB Realtime Subscriptions for immediate updates upon profit lock / release / cancel
    let unsubWallet: any = null;
    let unsubVendorOrders: any = null;
    let unsubResellerOrders: any = null;
    let unsubOrders: any = null;
    if (user?.uid) {
      unsubWallet = rtdbSubscribe(`vendor_wallet/${user.uid}`, () => {
        handleProfileUpdate();
      });
      unsubVendorOrders = rtdbSubscribe('vendor_orders', () => {
        handleProfileUpdate();
      });
      unsubResellerOrders = rtdbSubscribe('reseller_orders', () => {
        handleProfileUpdate();
      });
      unsubOrders = rtdbSubscribe('orders', () => {
        handleProfileUpdate();
      });
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('vendor_profile_updated', handleProfileUpdate);
      window.removeEventListener('vendor_order_updated', handleProfileUpdate);
      window.removeEventListener('reseller_profit_updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
      if (unsubWallet && typeof unsubWallet === 'function') unsubWallet();
      if (unsubVendorOrders && typeof unsubVendorOrders === 'function') unsubVendorOrders();
      if (unsubResellerOrders && typeof unsubResellerOrders === 'function') unsubResellerOrders();
      if (unsubOrders && typeof unsubOrders === 'function') unsubOrders();
    };
  }, [user]);

  const handleToggleCod = async () => {
    if (!user || isTogglingCodRef.current) return;
    const nextVal = !isCodEnabled;
    
    // Lock immediately to prevent double-clicks and race conditions
    isTogglingCodRef.current = true;
    setIsTogglingCod(true);

    // 1. Optimistically update local UI immediately so switch doesn't flicker or lag
    setIsCodEnabled(nextVal);

    try {
      // 2. Synchronously write to local storage caches so any immediate reads return the new value
      const uid = user.uid;
      ['rj_vendor_store_', 'rj_vendor_profile_', 'rj_active_vendor_'].forEach(prefix => {
        try {
          const key = prefix + uid;
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            parsed.isCodEnabled = nextVal;
            parsed.codEnabled = nextVal;
            localStorage.setItem(key, JSON.stringify(parsed));
          }
        } catch (_) {}
      });

      // 3. Persist to RTDB across all relevant paths with both aliases
      const updatePayload = {
        isCodEnabled: nextVal,
        codEnabled: nextVal,
        updatedAt: Date.now()
      };

      await Promise.allSettled([
        rtdbUpdate(`vendors/${uid}`, updatePayload),
        rtdbUpdate(`vendor_profiles/${uid}`, updatePayload),
        rtdbUpdate(`stores/${uid}`, updatePayload),
        rtdbUpdate(`users/${uid}`, updatePayload)
      ]);

      // Invalidate memory cache so immediate checkout gets authoritative status
      clearVendorLocationCache(uid);

      // Background update of vendor's products in RTDB so product-level queries also reflect COD setting
      rtdbList('products', (p: any) => p?.vendorId === uid || p?.userId === uid || p?.vendor?.id === uid || p?.storeId === uid)
        .then(prods => {
          if (prods && prods.length > 0) {
            return Promise.allSettled(
              prods.map(p => rtdbUpdate(`products/${p.id}`, { isCodEnabled: nextVal, codEnabled: nextVal }))
            );
          }
        })
        .catch(err => console.warn('Product COD sync warning:', err));

      // 4. Update vendor context state
      await updateVendorInfo({ isCodEnabled: nextVal, codEnabled: nextVal });
      toast.success(nextVal ? 'Cash on Delivery (COD) turned ON' : 'Cash on Delivery (COD) turned OFF');
    } catch (error) {
      console.error("Error updating Cash on Delivery setting in RTDB:", error);
      setIsCodEnabled(!nextVal); // Revert on failure
      toast.error('Failed to update Cash on Delivery setting');
    } finally {
      // Keep lock active for 500ms to allow all background events & RTDB subscriptions to settle smoothly
      setTimeout(() => {
        isTogglingCodRef.current = false;
        setIsTogglingCod(false);
      }, 500);
    }
  };

  const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <div className="bg-white  rounded-2xl p-4 sm:p-5 border border-gray-100  shadow-sm flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500  mb-1">{title}</p>
        <h3 className="text-lg sm:text-xl font-bold text-gray-900  mb-2">{value}</h3>
        {subtitle && <p className="text-xs text-gray-400 ">{subtitle}</p>}
      </div>
      <div className={`p-2 rounded-xl ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );

  
  const openVerifyModal = () => {
    setIsVerifyModalOpen(true);
  };

  const closeVerifyModal = () => {
    setIsVerifyModalOpen(false);
  };

  const handleStartPayAndVerify = () => {
    // Generate new unique invoice ID for Verified Seller Plan payment
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let inv = 'S2N';
    for (let i = 0; i < 9; i++) {
      inv += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCurrentInvoiceId(inv);

    // Close the info presentation and open the identical 4-method payment selection modal
    setIsVerifyModalOpen(false);
    setShowPaymentSelectionModal(true);
  };

  const handleCompleteVerifiedSellerPayment = async (
    channel: 'bkash' | 'nagad' | 'rocket' | 'upay',
    trxId: string
  ) => {
    if (!trxId.trim()) {
      toast.error('Transaction ID (TrxID) লিখুন');
      return;
    }

    if (!user) {
      toast.error('User session expired. Please log in.');
      return;
    }

    setIsVerifying(true);
    try {
      const formattedChannel = channel.toLowerCase() as 'bkash' | 'nagad' | 'rocket' | 'upay';
      const cleanTrxId = trxId.trim().toUpperCase();

      // Call Automatic Payment Verification with strict 8-second safety timeout
      const timeoutPromise = new Promise<VerificationResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Payment verification timed out. Please try again.'));
        }, 8000);
      });

      const result = await Promise.race([
        verifyPaymentAutomatic({
          transactionId: cleanTrxId,
          paymentMethod: formattedChannel,
          expectedAmount: verifiedPlanPrice,
          invoiceId: currentInvoiceId,
          userId: user.uid,
          userType: 'vendor',
          contextData: {
            storeName: vendorInfo?.shopName || vendorInfo?.storeName || 'Vendor Shop',
            ownerName: userData?.name || vendorInfo?.ownerName || 'Vendor',
            plan: 'verified_seller',
            planPrice: verifiedPlanPrice
          }
        }),
        timeoutPromise
      ]);

      if (result.status === 'verified') {
        setPaymentErrorMessage('');
        const purchaseDate = result.verifiedAt || Date.now();
        const expiresAt = calculateBadgeExpiry(purchaseDate, verifiedPlanMonths);
        const verifiedPayload = {
          verificationStatus: 'verified',
          verified: true,
          isVerified: true,
          isVerifiedSeller: true,
          blueBadge: true,
          verificationBadge: true,
          verifiedSellerPlanActive: true,
          planExpiresAt: expiresAt,
          verifiedDurationMonths: verifiedPlanMonths,
          verifiedPlanPrice: verifiedPlanPrice,
          verifiedPaymentMethod: channel,
          verifiedTrxId: cleanTrxId,
          verifiedInvoiceId: currentInvoiceId,
          verifiedAt: purchaseDate,
          updatedAt: purchaseDate
        };

        // 1. Record approved request in verified_seller_requests in RTDB
        try {
          await rtdbPush('verified_seller_requests', {
            vendorId: user.uid,
            sellerName: userData?.name || vendorInfo?.ownerName || vendorInfo?.shopName || 'Vendor',
            storeName: vendorInfo?.shopName || vendorInfo?.storeName || 'Store',
            paymentAmount: verifiedPlanPrice,
            paymentStatus: 'completed',
            paymentMethod: channel,
            trxId: cleanTrxId,
            invoiceId: currentInvoiceId,
            status: 'approved',
            approvedDate: purchaseDate,
            requestDate: purchaseDate,
            verifiedAt: purchaseDate,
            durationMonths: verifiedPlanMonths,
            planExpiresAt: expiresAt
          });
        } catch (e) {
          console.warn('Could not add to verified_seller_requests in RTDB:', e);
        }

        // 2. Update vendors and vendor_profiles in RTDB to instantly activate Verified Seller Plan
        await Promise.all([
          rtdbUpdate(`vendors/${user.uid}`, verifiedPayload),
          rtdbUpdate(`vendor_profiles/${user.uid}`, verifiedPayload),
          rtdbUpdate(`stores/${user.uid}`, verifiedPayload),
          rtdbUpdate(`users/${user.uid}`, verifiedPayload)
        ]);

        // 3. Update persistent context so badge and verified benefits show immediately
        await updateVendorInfo({
          ...verifiedPayload,
          verificationStatus: 'verified',
          planExpiresAt: expiresAt
        });

        saveStoreToCache(user.uid, {
          ...vendorInfo,
          ...verifiedPayload,
          id: user.uid,
          vendorId: user.uid,
          verificationStatus: 'verified',
          verified: true,
          isVerified: true,
          planExpiresAt: expiresAt
        });

        // 4. Close payment modals
        setShowBkashModal(false);
        setShowNagadModal(false);
        setShowRocketModal(false);
        setShowUpayModal(false);
        setShowPaymentSelectionModal(false);
        setIsVerifyModalOpen(false);

        // 5. Open Success Popup (auto-redirecting or closing after 1.5s)
        setShowPaymentSuccessModal(true);
        return;
      } else {
        let errorMsg = 'আপনার ট্রানজেকশন আইডি ভুল সঠিক ট্রানজাকশন আইডি দিয়ে আবার চেষ্টা করুন';
        if (result.rejectionReason === 'amount_mismatch') {
          errorMsg = result.message || `পেমেন্ট এমাউন্ট সঠিক নয়! প্রত্যাশিত: ৳${verifiedPlanPrice.toFixed(2)}।`;
        } else if (result.rejectionReason === 'method_mismatch') {
          errorMsg = result.message || 'পেমেন্ট মেথড সঠিক নয়! সঠিক পেমেন্ট মেথড ব্যবহার করুন।';
        } else if (result.rejectionReason === 'duplicate_transaction') {
          errorMsg = result.message || 'এই ট্রানজেকশন আইডি ইতিমধ্যে ব্যবহৃত হয়েছে!';
        } else if (result.message) {
          errorMsg = result.message;
        }
        setPaymentErrorMessage(errorMsg);
        toast.error(errorMsg, { duration: 6000 });
      }
    } catch (error: any) {
      console.error('Verified Seller Payment Error:', error);
      const errNotice = 'আপনার ট্রানজেকশন আইডি ভুল সঠিক ট্রানজাকশন আইডি দিয়ে আবার চেষ্টা করুন';
      setPaymentErrorMessage(errNotice);
      toast.error(errNotice, { duration: 5000 });
    } finally {
      setIsVerifying(false);
    }
  };

  const isVerifiedPlanActive = isStorePlanVerified(vendorInfo);
  const badgeDetails = getBadgeExpiryDetails(vendorInfo);

  const displayAddress = typeof vendorInfo?.address === 'string'
    ? vendorInfo.address
    : [
        vendorInfo?.address?.street,
        vendorInfo?.address?.city,
        vendorInfo?.address?.state,
        vendorInfo?.address?.zip,
        vendorInfo?.address?.country
      ].filter(Boolean).join(', ');

  const displayPhone = vendorInfo?.contactNumber || vendorInfo?.phone || vendorInfo?.mobileNumber || '';
  const displayWhatsApp = vendorInfo?.whatsappNumber || vendorInfo?.whatsapp || '';
  const displayEmail = vendorInfo?.email || '';
  const displayWebsite = vendorInfo?.website || '';
  const displayHours = vendorInfo?.openingHours || vendorInfo?.businessHours || '';
  const displayCategory = vendorInfo?.category || vendorInfo?.businessCategory || '';
  const displayFacebook = vendorInfo?.facebook || vendorInfo?.socialLinks?.facebook || '';
  const displayInstagram = vendorInfo?.instagram || vendorInfo?.socialLinks?.instagram || '';
  const displayYoutube = vendorInfo?.youtube || vendorInfo?.socialLinks?.youtube || '';
  const displayTiktok = vendorInfo?.tiktok || vendorInfo?.socialLinks?.tiktok || '';

  return (
    <VendorLayout>
      {/* Store Header Card (No empty cover photo space, clean profile photo and store info at the top) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left w-full md:w-auto flex-1">
            {/* Store Profile Image */}
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl p-1 bg-white border border-gray-200 shadow-sm shrink-0 flex items-center justify-center overflow-hidden">
              {vendorInfo?.logo || vendorInfo?.shopLogo || vendorInfo?.profileImage ? (
                <img 
                  referrerPolicy="no-referrer" 
                  src={vendorInfo.logo || vendorInfo.shopLogo || vendorInfo.profileImage} 
                  alt="Shop Logo" 
                  className="w-full h-full object-cover rounded-xl" 
                />
              ) : (
                <div className="w-full h-full bg-primary-main/10 rounded-xl flex items-center justify-center text-primary-main">
                  <Store className="w-10 h-10" />
                </div>
              )}
            </div>

            {/* Store Details, Domains & Badges */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-1.5">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
                  {vendorInfo?.shopName || vendorInfo?.storeName || 'My Awesome Shop'}
                </h2>

                {displayCategory && (
                  <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-medium">
                    {displayCategory}
                  </span>
                )}

                {/* Verified Badge */}
                <div 
                  title={isVerifiedPlanActive ? "Verified Store" : "Not Verified Store"} 
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs rounded-full border shadow-xs ${
                    isVerifiedPlanActive 
                      ? 'bg-blue-50 text-blue-700 border-blue-200 font-bold' 
                      : 'bg-red-50 text-red-600 border-red-200 font-medium'
                  }`}
                >
                  {isVerifiedPlanActive ? (
                    <VerifiedBadge size="xs" />
                  ) : (
                    <BadgeCheck className="w-4 h-4 fill-red-500 text-white" />
                  )}
                  <span className="uppercase text-[11px] tracking-wide">
                    {isVerifiedPlanActive ? "Verified Shop" : "Not Verified"}
                  </span>
                </div>
              </div>

              {/* Free Shop Domain & Custom Domain */}
              {(() => {
                const activeShopDomain = vendorInfo?.freeShopDomain && vendorInfo.freeShopDomain.endsWith(`.${PRIMARY_DOMAIN}`)
                  ? vendorInfo.freeShopDomain
                  : (vendorInfo?.shopSlug ? `${vendorInfo.shopSlug}.${PRIMARY_DOMAIN}` : (vendorInfo?.shopName || vendorInfo?.storeName ? `${slugifyVendorName(vendorInfo.shopName || vendorInfo.storeName)}.${PRIMARY_DOMAIN}` : ''));
                
                return (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs mb-2">
                    {activeShopDomain && (
                      <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                        <span className="text-gray-500 font-normal">Domain:</span>
                        <span className="font-semibold text-primary-main">https://{activeShopDomain}/</span>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(`https://${activeShopDomain}/`);
                            toast.success('Shop link copied!');
                          }}
                          className="text-gray-500 hover:text-gray-800 ml-1 p-0.5 cursor-pointer"
                          title="Copy link"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <a 
                          href={getVendorOpenUrl(activeShopDomain, user?.uid)} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-primary-main hover:underline font-semibold text-[11px] cursor-pointer"
                        >
                          Open
                        </a>
                      </div>
                    )}

                    {vendorInfo?.customDomain && (
                      <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                        <span className="text-gray-500">Custom:</span>
                        <span className="font-semibold text-gray-800">{vendorInfo.customDomain}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${vendorInfo.verificationStatus === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {vendorInfo.verificationStatus || 'Pending'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Description */}
              {vendorInfo?.description ? (
                <p className="text-gray-600 text-xs sm:text-sm max-w-3xl leading-relaxed">
                  {vendorInfo.description}
                </p>
              ) : (
                <p className="text-gray-400 text-xs italic">
                  No description provided for this store yet.
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full sm:w-auto flex flex-wrap items-center justify-center sm:justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsStoreShareModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-sky-50 border border-sky-200 text-primary-main text-sm font-semibold rounded-xl hover:bg-sky-100 transition-colors shadow-2xs cursor-pointer"
            >
              <Share2 className="w-4 h-4" /> Share Store
            </button>
            <Link 
              to="/vendor/profile" 
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-2xs w-full sm:w-auto"
            >
              <Edit className="w-4 h-4 text-gray-500" /> Edit Profile
            </Link>
          </div>
        </div>

        {/* Primary & Contact Info Row */}
        <div className="pt-3.5 space-y-2.5">
          {/* Rating, Address, Hours, Status, Followers, Socials */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-gray-600">
            {/* Rating */}
            <div className="flex items-center gap-1.5 text-gray-800">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="font-bold">{vendorInfo?.rating || 'New'}</span>
              <span className="text-gray-400 text-xs">({vendorInfo?.reviews || 0} Reviews)</span>
            </div>

            {/* Location */}
            {displayAddress && (
              <div className="flex items-center gap-1.5 text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{displayAddress}</span>
              </div>
            )}

            {/* Opening Hours */}
            {displayHours && (
              <div className="flex items-center gap-1.5 text-gray-600">
                <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{displayHours}</span>
              </div>
            )}

            {/* Online Status */}
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${vendorInfo?.status === 'Active' || vendorInfo?.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="font-medium text-gray-700">{vendorInfo?.status === 'Active' || vendorInfo?.status === 'active' ? 'Online' : 'Offline'}</span>
            </div>

            {/* Followers & Follow Button */}
            <div className="flex items-center gap-2 sm:border-l sm:border-gray-200 sm:pl-3">
              <div className="flex items-center gap-1 text-gray-700">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="font-semibold">{vendorInfo?.followers || 0}</span>
                <span className="text-gray-500 text-xs">Followers</span>
              </div>
              <button className="px-2.5 py-0.5 bg-primary-main/10 text-primary-main text-xs font-semibold rounded-full hover:bg-primary-main/20 transition-colors">
                Follow
              </button>
            </div>

            {/* Social Media */}
            {(displayFacebook || displayInstagram || displayYoutube || displayTiktok) && (
              <div className="flex items-center gap-2.5 sm:border-l sm:border-gray-200 sm:pl-3">
                {displayFacebook && (
                  <a href={displayFacebook.startsWith('http') ? displayFacebook : `https://${displayFacebook}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors" title="Facebook">
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {displayInstagram && (
                  <a href={displayInstagram.startsWith('http') ? displayInstagram : `https://${displayInstagram}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-600 transition-colors" title="Instagram">
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {displayYoutube && (
                  <a href={displayYoutube.startsWith('http') ? displayYoutube : `https://${displayYoutube}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-red-600 transition-colors" title="YouTube">
                    <Youtube className="w-4 h-4" />
                  </a>
                )}
                {displayTiktok && (
                  <a href={displayTiktok.startsWith('http') ? displayTiktok : `https://${displayTiktok}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors font-bold text-xs" title="TikTok">
                    TikTok
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Contact Details */}
          {(displayPhone || displayWhatsApp || displayEmail || displayWebsite) && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
              {displayPhone && (
                <a 
                  href={`tel:${displayPhone}`} 
                  className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
                  title="Call Vendor"
                >
                  <Phone className="w-3.5 h-3.5 text-primary-main" />
                  <span className="font-medium">{displayPhone}</span>
                </a>
              )}
              {displayWhatsApp && (
                <a 
                  href={`https://wa.me/${displayWhatsApp.replace(/[^0-9]/g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors"
                  title="WhatsApp Vendor"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-medium">WhatsApp: {displayWhatsApp}</span>
                </a>
              )}
              {displayEmail && (
                <a 
                  href={`mailto:${displayEmail}`} 
                  className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
                  title="Email Vendor"
                >
                  <Mail className="w-3.5 h-3.5 text-gray-500" />
                  <span className="truncate max-w-[240px]">{displayEmail}</span>
                </a>
              )}
              {displayWebsite && (
                <a 
                  href={displayWebsite.startsWith('http') ? displayWebsite : `https://${displayWebsite}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 px-3 py-1.5 rounded-lg border border-sky-200 transition-colors"
                  title="Visit Website"
                >
                  <Globe className="w-3.5 h-3.5 text-sky-600" />
                  <span className="truncate max-w-[200px] font-medium">{displayWebsite.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Notification Alert Banner */}
      {devicePermission !== 'granted' && (
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-primary-main text-white rounded-2xl p-3.5 sm:p-4 mb-4 sm:mb-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="p-2 sm:p-2.5 bg-white/20 backdrop-blur-xs rounded-xl shrink-0">
              <Smartphone className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm leading-tight flex items-center gap-1.5">
                মোবাইলে লাইভ নোটিফিকেশন পান!
                <span className="px-1.5 py-0.5 bg-amber-400 text-slate-900 text-[10px] font-extrabold rounded-md uppercase tracking-wider">নতুন</span>
              </h4>
              <p className="text-[11px] sm:text-xs text-blue-100 mt-0.5">
                নতুন অর্ডার, কাস্টমার মেসেজ ও রিভিউ আসার সাথে সাথে আপনার মোবাইলে সরাসরি নোটিফিকেশন আসবে।
              </p>
            </div>
          </div>
          <button
            onClick={requestDevicePermission}
            className="w-full sm:w-auto px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-all active:scale-95 shrink-0 flex items-center justify-center gap-1.5"
          >
            <Bell className="w-4 h-4 text-blue-600" />
            অন করুন (Enable)
          </button>
        </div>
      )}

      {/* Services Section */}
      <div className="bg-white rounded-2xl p-3 sm:p-5 border border-gray-100 shadow-sm mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
            Our Services
            {totalUnreadCount > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                {bengaliCounts.total} টা নতুন আপডেট
              </span>
            )}
          </h3>
        </div>
        
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-1.5 sm:gap-3">
          {[
            { name: 'Dashboard', path: '/vendor-dashboard', icon: LayoutDashboard, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { name: 'Products', path: '/vendor/products', icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { name: 'Orders', path: '/vendor/orders', icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
            { name: 'Reviews', path: '/vendor/reviews', icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
            { name: 'Inventory', path: '/vendor/inventory', icon: ArchiveRestore, color: 'text-amber-600', bg: 'bg-amber-50' },
            { name: 'Customers', path: '/vendor/customers', icon: Users, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
            { name: 'Messages', path: '/vendor/messages', icon: MessageSquare, color: 'text-rose-600', bg: 'bg-rose-50' },
            { name: 'Wallet', path: '/vendor/wallet', icon: Wallet, color: 'text-violet-600', bg: 'bg-violet-50' },
            { name: 'Withdraw', path: '/vendor/withdraw', icon: Banknote, color: 'text-teal-600', bg: 'bg-teal-50' },
            { name: 'Shop Profile', path: '/vendor/profile', icon: Store, color: 'text-orange-600', bg: 'bg-orange-50' },
            { name: 'Notifications', path: '/vendor/notifications', icon: Bell, color: 'text-cyan-600', bg: 'bg-cyan-50' },
            { name: 'Settings', path: '/vendor/settings', icon: Settings, color: 'text-slate-600', bg: 'bg-slate-50' },
            { name: 'Store Helpline', path: '/vendor/support', icon: Headset, color: 'text-sky-600', bg: 'bg-sky-50' },
            { name: 'Product Boost', path: '/vendor/boost', icon: Rocket, color: 'text-pink-600', bg: 'bg-pink-50' },
            { name: 'Product Ads', path: '/vendor/ads', icon: Megaphone, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map((service, index) => {
            const Icon = service.icon;

            let badgeText = '';
            let badgeBg = 'bg-red-500';

            if (service.name === 'Orders' && unreadOrdersCount > 0) {
              badgeText = `${bengaliCounts.orders} টা`;
              badgeBg = 'bg-blue-600';
            } else if (service.name === 'Messages' && unreadMessagesCount > 0) {
              badgeText = `${bengaliCounts.messages} টা`;
              badgeBg = 'bg-rose-600';
            } else if (service.name === 'Reviews' && unreadReviewsCount > 0) {
              badgeText = `${bengaliCounts.reviews} টা`;
              badgeBg = 'bg-amber-500';
            } else if (service.name === 'Notifications' && (unreadNotificationsCount > 0 || totalUnreadCount > 0)) {
              badgeText = `${bengaliCounts.total} টা`;
              badgeBg = 'bg-red-600';
            } else if (service.name === 'Withdraw' && unreadWithdrawCount > 0) {
              badgeText = `${bengaliCounts.withdraw} টা`;
              badgeBg = 'bg-emerald-600';
            }

            return (
              <div 
                key={index} 
                onClick={() => navigate(service.path)}
                className="flex flex-col items-center p-1.5 sm:p-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer group active:scale-95 relative"
              >
                <div className="relative">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 ${service.bg} ${service.color} rounded-xl flex items-center justify-center mb-1 sm:mb-1.5 group-hover:scale-105 transition-transform`}>
                    <Icon className="w-5 h-5 sm:w-5 sm:h-5" />
                  </div>
                  {badgeText && (
                    <span className={`absolute -top-1.5 -right-2 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold text-white ${badgeBg} rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-pulse whitespace-nowrap`}>
                      {badgeText}
                    </span>
                  )}
                </div>
                <span className="text-[11px] sm:text-xs font-medium text-gray-700 text-center leading-tight line-clamp-1">{service.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Verification / Offer Section */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-sm mb-4 sm:mb-6 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center gap-3 sm:gap-5 relative z-10">
          <div className="flex-shrink-0 relative group">
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full scale-110 group-hover:scale-125 transition-transform duration-500"></div>
            <div className="relative flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-50 to-white rounded-full border-2 border-blue-100 shadow-md">
              <VerifiedBadge size="lg" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-0.5">Store Verification</h3>
              {isVerifiedPlanActive && (
                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded-full">
                  সক্রিয় ({badgeDetails.daysRemaining} দিন বাকি)
                </span>
              )}
              {badgeDetails.isExpired && (
                <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded-full">
                  মেয়াদ শেষ
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500">
              {isVerifiedPlanActive 
                ? `আপনার স্টোর ভেরিফাইড আছে। অবশিষ্ট মেয়াদ: ${badgeDetails.daysRemaining} দিন (${badgeDetails.expiresAt ? format(new Date(badgeDetails.expiresAt), 'dd MMM yyyy') : 'N/A'} পর্যন্ত)।`
                : badgeDetails.isExpired
                ? `আপনার ভেরিফাইড ব্যাজের মেয়াদ শেষ হয়ে গেছে। পুনরায় ভেরিফাইড ব্যাজ সক্রিয় করতে এখনই কিনুন (${verifiedPlanMonths} মাস মেয়াদে)।`
                : vendorInfo?.verificationStatus === 'pending'
                ? 'Your verification request is currently under review.'
                : `Verify your store to build trust and get priority visibility (${verifiedPlanMonths} Months).`}
            </p>
          </div>
        </div>
        
        <div className="w-full md:w-auto min-w-[180px] flex items-center gap-2">
          {(!isVerifiedPlanActive && vendorInfo?.verificationStatus !== 'pending') && (
            <button 
              onClick={openVerifyModal}
              className="w-full py-2 sm:py-2.5 px-4 bg-blue-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <BadgeCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              {badgeDetails.isExpired ? `আবার কিনুন — ৳${verifiedPlanPrice}` : `Get Verified — ৳${verifiedPlanPrice}`}
            </button>
          )}
          {(!isVerifiedPlanActive && vendorInfo?.verificationStatus === 'pending') && (
            <div className="w-full py-2 sm:py-2.5 px-4 bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs sm:text-sm font-medium rounded-xl flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              Verification Pending
            </div>
          )}
          {isVerifiedPlanActive && (
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 py-2 sm:py-2.5 px-3 bg-green-50 text-green-700 border border-green-200 text-xs sm:text-sm font-medium rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap">
                <BadgeCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                Verified Seller
              </div>
              <button
                onClick={openVerifyModal}
                className="py-2 sm:py-2.5 px-3 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl hover:bg-blue-100 transition-colors whitespace-nowrap"
                title="মেয়াদ বৃদ্ধি বা নবায়ন করুন"
              >
                মেয়াদ বৃদ্ধি
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cash on Delivery (COD) Toggle Section */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all ${
              isCodEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
            }`}>
              <Truck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-gray-900">Cash on Delivery (COD)</h3>
                <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider transition-colors ${
                  isCodEnabled 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {isCodEnabled ? 'ON / Active' : 'OFF / Disabled'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {isCodEnabled 
                  ? 'Customers can order your products with Cash on Delivery (COD).' 
                  : 'Cash on Delivery is OFF for your products. Customers must pay online.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <span className={`text-xs sm:text-sm font-bold ${isCodEnabled ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isCodEnabled ? 'COD ON' : 'COD OFF'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isCodEnabled}
              disabled={isTogglingCod}
              onClick={handleToggleCod}
              className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${
                isCodEnabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              title={isCodEnabled ? 'Click to turn OFF Cash on Delivery' : 'Click to turn ON Cash on Delivery'}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isCodEnabled ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Due Platform Fee Alert Banner */}
      {duePlatformFee > 0 && (
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 border-2 border-rose-200 rounded-2xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-rose-700">
                বকেয়া প্ল্যাটফর্ম ফি নোটিশ
              </div>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                আপনার সফল COD ডেলিভারির বকেয়া প্ল্যাটফর্ম ফি: <span className="text-rose-600 font-black">৳{duePlatformFee}</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                bKash, Nagad বা Rocket-এর মাধ্যমে পরিশোধ করে ট্রানজেকশন আইডি দিয়ে তাৎক্ষণিক ক্লিয়ার করুন।
              </p>
            </div>
          </div>
          <Link
            to="/vendor/platform-fee"
            className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Receipt className="w-4 h-4" />
            <span>ফি পরিশোধ ও বিবরণ দেখুন</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Primary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <StatCard 
          title="Today's Sales" 
          value={`৳${stats.todaySales}`} 
          icon={TrendingUp} 
          colorClass="bg-green-50 text-green-600" 
          subtitle="Updated in real time"
        />
        <StatCard 
          title="Reseller Locked Profit" 
          value={`৳${resellerLockedProfit.toLocaleString()}`} 
          icon={Lock} 
          colorClass="bg-amber-50 text-amber-600" 
          subtitle="Currently locked profit for active reseller orders"
        />
        <StatCard 
          title="Total Orders" 
          value={stats.totalOrders} 
          icon={ShoppingCart} 
          colorClass="bg-blue-50 text-blue-600" 
          subtitle={`${stats.pendingOrders} pending`}
        />
        <StatCard 
          title="Active Products" 
          value={stats.activeProducts} 
          icon={Package} 
          colorClass="bg-purple-50 text-purple-600" 
          subtitle={`${stats.outOfStock} out of stock`}
        />
        <StatCard 
          title="Wallet Balance" 
          value={`৳${stats.walletBalance}`} 
          icon={Banknote} 
          colorClass="bg-orange-50 text-orange-600" 
          subtitle="Available for withdrawal"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {/* Sales Chart */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Revenue Overview</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(value) => `৳${value}`} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  formatter={(val: any) => [`৳${val}`, 'Revenue']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Top Products</h3>
            <Link to="/vendor/products" className="text-sm font-medium text-primary-main hover:underline">View All</Link>
          </div>
          <div className="flex-1 flex flex-col gap-4">
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Package className="w-10 h-10 mb-2 stroke-[1.5] text-gray-300" />
                <p className="text-sm">No products uploaded yet</p>
                <Link to="/vendor/products/new" className="mt-2 text-xs font-semibold text-blue-600 hover:underline">
                  + Add your first product
                </Link>
              </div>
            ) : (
              topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-gray-100 text-gray-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 line-clamp-1">{product.name}</h4>
                      <p className="text-xs text-gray-500">{product.sales} sales</p>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    ৳{product.revenue}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Order Status Section (Desktop-friendly full grid, Action Items removed) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h3 className="text-base sm:text-lg font-bold text-gray-900">Order Status</h3>
          <Link to="/vendor/orders" className="text-xs sm:text-sm font-medium text-primary-main hover:underline">
            View All Orders
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Pending</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl sm:text-3xl font-bold text-amber-900">{stats.pendingOrders}</span>
              <span className="text-xs font-medium text-amber-700">Orders</span>
            </div>
          </div>
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Processing</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl sm:text-3xl font-bold text-blue-900">{stats.processingOrders}</span>
              <span className="text-xs font-medium text-blue-700">Orders</span>
            </div>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Completed</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl sm:text-3xl font-bold text-emerald-900">{stats.completedOrders}</span>
              <span className="text-xs font-medium text-emerald-700">Orders</span>
            </div>
          </div>
          <div className="bg-red-50/70 border border-red-200/80 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs font-semibold text-red-800 uppercase tracking-wider">Cancelled</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl sm:text-3xl font-bold text-red-900">{stats.cancelledOrders}</span>
              <span className="text-xs font-medium text-red-700">Orders</span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reviews Section */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Star className="w-5 h-5 fill-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  Customer Reviews (গ্রাহকের রিভিউ)
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {vendorReviews.length} Reviews
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                গ্রাহকদের দেওয়া রেটিং ও রিভিউ দেখুন এবং সরাসরি রিপ্লাই প্রদান করুন
              </p>
            </div>
          </div>

          <Link
            to="/vendor/reviews"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-main hover:text-sky-700 transition-colors self-start sm:self-auto"
          >
            <span>View All & Reply (সব রিভিউ ও রিপ্লাই)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Reviews preview */}
        {loadingReviews ? (
          <div className="py-8 text-center text-xs text-gray-400">Loading reviews...</div>
        ) : vendorReviews.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-2">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-gray-700">এখনো কোনো রিভিউ জমা হয়নি</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              পণ্য সফলভাবে ডেলিভারি হওয়ার পর গ্রাহকরা রিভিউ দিলে এখানে প্রদর্শিত হবে।
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {vendorReviews.slice(0, 3).map((rev) => (
              <div
                key={rev.id || rev.reviewId}
                className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-gray-900 truncate">
                      {rev.reviewerName || rev.customerName || 'Verified Buyer'}
                    </span>
                    <div className="flex items-center text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${s <= (Number(rev.rating) || 5) ? 'fill-amber-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                  </div>

                  {rev.productName && (
                    <p className="text-[11px] text-gray-500 font-medium truncate mb-1">
                      পণ্য: {rev.productName}
                    </p>
                  )}

                  <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">
                    "{rev.text || (rev as any).comment || 'No written text'}"
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px]">
                  {rev.vendorReply?.text ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>Replied</span>
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Needs reply</span>
                    </span>
                  )}

                  <Link
                    to="/vendor/reviews"
                    className="text-primary-main font-bold hover:underline"
                  >
                    Reply / View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    
      {/* Verified Seller Plan Modal */}
      {isVerifyModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative">
            <button 
              onClick={closeVerifyModal}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center mb-6 mt-4">
              <div className="relative inline-block mx-auto mb-6">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full scale-125"></div>
                <div className="relative flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-50 to-white rounded-full border-4 border-blue-100 shadow-lg">
                  <VerifiedBadge size="xl" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verified Seller Plan</h2>
              <p className="text-gray-500">Upgrade your store to build trust and increase sales.</p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-gray-700">Plan Price</span>
                <span className="text-xl font-bold text-blue-600">৳{verifiedPlanPrice}</span>
              </div>
              <div className="text-right text-xs font-semibold text-blue-600 mb-4">
                Valid for {verifiedPlanMonths} Month{verifiedPlanMonths > 1 ? 's' : ''} ({verifiedPlanMonths} মাস মেয়াদী)
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Verified Seller badge on your store & products</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Display as a trusted seller to customers</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>ক্রয়ের দিন থেকে শুরু হয়ে পুরো {verifiedPlanMonths} মাস কার্যকর থাকবে</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>মেয়াদ শেষ হলে স্বয়ংক্রিয়ভাবে মুছে যাবে এবং আবার কিনলে আবার দিন গণনা শুরু হবে</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={closeVerifyModal}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleStartPayAndVerify}
                className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-semibold shadow-md shadow-blue-500/20"
              >
                Pay & Verify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Payment Method Selection Modal (bKash Personal, Nagad Personal, Rocket Personal, Upay Personal) */}
      <PaymentMethodSelectionModal
        isOpen={showPaymentSelectionModal}
        onClose={() => {
          setShowPaymentSelectionModal(false);
          setPaymentErrorMessage('');
        }}
        onConfirmPayment={(channel) => {
          setSelectedPaymentChannel(channel);
          setPaymentErrorMessage('');
          setShowPaymentSelectionModal(false);
          if (channel === 'bkash') setShowBkashModal(true);
          else if (channel === 'nagad') setShowNagadModal(true);
          else if (channel === 'rocket') setShowRocketModal(true);
          else if (channel === 'upay') setShowUpayModal(true);
        }}
        amount={verifiedPlanPrice}
        paymentType="verified_seller_fee"
        invoiceId={currentInvoiceId}
        isSubmitting={isVerifying}
        selectedChannel={selectedPaymentChannel}
        onSelectChannel={(ch) => setSelectedPaymentChannel(ch)}
      />

      {/* 2. bKash Personal Payment Instruction Modal */}
      <BkashPaymentModal
        isOpen={showBkashModal}
        onClose={() => {
          setShowBkashModal(false);
          setPaymentErrorMessage('');
        }}
        onBack={() => {
          setShowBkashModal(false);
          setPaymentErrorMessage('');
          setShowPaymentSelectionModal(true);
        }}
        amount={verifiedPlanPrice}
        invoiceId={currentInvoiceId}
        bkashNumber="01864670673"
        isSubmitting={isVerifying}
        errorMessage={paymentErrorMessage}
        onVerify={(trx) => handleCompleteVerifiedSellerPayment('bkash', trx)}
      />

      {/* 3. Nagad Personal Payment Instruction Modal */}
      <NagadPaymentModal
        isOpen={showNagadModal}
        onClose={() => {
          setShowNagadModal(false);
          setPaymentErrorMessage('');
        }}
        onBack={() => {
          setShowNagadModal(false);
          setPaymentErrorMessage('');
          setShowPaymentSelectionModal(true);
        }}
        amount={verifiedPlanPrice}
        invoiceId={currentInvoiceId}
        nagadNumber="01864670673"
        isSubmitting={isVerifying}
        errorMessage={paymentErrorMessage}
        onVerify={(trx) => handleCompleteVerifiedSellerPayment('nagad', trx)}
      />

      {/* 4. Rocket Personal Payment Instruction Modal */}
      <RocketPaymentModal
        isOpen={showRocketModal}
        onClose={() => {
          setShowRocketModal(false);
          setPaymentErrorMessage('');
        }}
        onBack={() => {
          setShowRocketModal(false);
          setPaymentErrorMessage('');
          setShowPaymentSelectionModal(true);
        }}
        amount={verifiedPlanPrice}
        invoiceId={currentInvoiceId}
        rocketNumber="01864670673"
        isSubmitting={isVerifying}
        errorMessage={paymentErrorMessage}
        onVerify={(trx) => handleCompleteVerifiedSellerPayment('rocket', trx)}
      />

      {/* 5. Upay Personal Payment Instruction Modal */}
      <UpayPaymentModal
        isOpen={showUpayModal}
        onClose={() => {
          setShowUpayModal(false);
          setPaymentErrorMessage('');
        }}
        onBack={() => {
          setShowUpayModal(false);
          setPaymentErrorMessage('');
          setShowPaymentSelectionModal(true);
        }}
        amount={verifiedPlanPrice}
        invoiceId={currentInvoiceId}
        upayNumber="01864670673"
        isSubmitting={isVerifying}
        errorMessage={paymentErrorMessage}
        onVerify={(trx) => handleCompleteVerifiedSellerPayment('upay', trx)}
      />

      {/* 6. Instant Payment Success Modal with 1.5s Auto-Redirect */}
      <PaymentSuccessModal
        isOpen={showPaymentSuccessModal}
        title="আপনার পেমেন্ট সফল হয়েছে! 🎉"
        subtitle="Verified Seller Plan Activated"
        targetName="Vendor Dashboard"
        autoRedirectDelayMs={1500}
        onComplete={() => {
          setShowPaymentSuccessModal(false);
          toast.success('Verified Seller Plan is now active!');
        }}
      />

      {/* 7. Pending Review Modal (fallback for async approvals) */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-xl relative text-center">
            <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Request Submitted</h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 mb-4">
              <Clock className="w-4 h-4" /> Pending
            </div>
            <p className="text-gray-600 mb-8">Please wait up to 12 hours for Admin approval.</p>
            <button 
              onClick={() => setIsSuccessModalOpen(false)}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {user && (
        <StoreShareModal
          isOpen={isStoreShareModalOpen}
          onClose={() => setIsStoreShareModalOpen(false)}
          storeName={vendorInfo?.shopName || vendorInfo?.storeName || 'My Store'}
          storeUrl={`${window.location.origin}/store/${user.uid}`}
          storeLogo={vendorInfo?.logo || vendorInfo?.profileImage}
        />
      )}
    </VendorLayout>
  );
}
