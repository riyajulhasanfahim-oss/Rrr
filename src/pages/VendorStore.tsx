import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { rtdbGet, rtdbSet, rtdbUpdate, rtdbRemove, rtdbList } from '../lib/rtdb';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import ProductCard from '../components/ui/ProductCard';
import VerifiedBadge from '../components/ui/VerifiedBadge';
import BrandList from '../components/home/BrandList';
import StoreShareModal from '../components/vendor-store/StoreShareModal';
import StoreReviewModal from '../components/vendor-store/StoreReviewModal';
import { getProductPath } from '../utils/seo';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../utils/imageUrl';
import { 
  getStoreFromCache, 
  saveStoreToCache, 
  fetchStoreDetailFromRTDB, 
  mergeStoreObjects,
  getStoreProductsFromCache,
  saveStoreProductsToCache,
  fetchStoreProductsFromRTDB,
  getStoreThemeFromCache,
  saveStoreThemeToCache,
  getStoreFollowStatusFromCache,
  saveStoreFollowStatusToCache,
  isStorePlanVerified,
  isStoreDeletedFromCache
} from '../services/storeCache';
import { 
  Star, 
  Heart, 
  Share2, 
  MessageCircle, 
  BadgeCheck, 
  Search, 
  X, 
  Grid, 
  List, 
  Check, 
  CheckCircle2,
  ShieldCheck, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  Truck, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft,
  Store as StoreIcon,
  SlidersHorizontal,
  PackageSearch,
  ExternalLink,
  ZoomIn
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchVendorReviews, getVendorStoreReviewStatus, VendorStoreReviewStatus } from '../services/reviewService';
import ImageLightboxModal from '../components/common/ImageLightboxModal';

// Standard high-quality category images map
const CATEGORY_IMAGE_MAP: Record<string, string> = {
  'electronics': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=240&h=240&fit=crop&q=80',
  'fashion': 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=240&h=240&fit=crop&q=80',
  'home & kitchen': 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=240&h=240&fit=crop&q=80',
  'home-kitchen': 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=240&h=240&fit=crop&q=80',
  'health & beauty': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=240&h=240&fit=crop&q=80',
  'health-beauty': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=240&h=240&fit=crop&q=80',
  'beauty': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=240&h=240&fit=crop&q=80',
  'grocery': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=240&h=240&fit=crop&q=80',
  'mobile accessories': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=240&h=240&fit=crop&q=80',
  'mobile-accessories': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=240&h=240&fit=crop&q=80',
  'accessories': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=240&h=240&fit=crop&q=80',
  'computer': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=240&h=240&fit=crop&q=80',
  'digital products': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=240&h=240&fit=crop&q=80',
  'digital-products': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=240&h=240&fit=crop&q=80',
  'sports': 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=240&h=240&fit=crop&q=80',
  'books': 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=240&h=240&fit=crop&q=80',
  'baby care': 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=240&h=240&fit=crop&q=80',
  'baby-care': 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=240&h=240&fit=crop&q=80',
  'lifestyle': PLACEHOLDER_PRODUCT_IMAGE,
  'watches': PLACEHOLDER_PRODUCT_IMAGE,
  'shoes': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=240&h=240&fit=crop&q=80'
};

// Helper: Format Follower Count (e.g. 1.2K Followers)
const formatFollowers = (count: number): string => {
  if (!count || count <= 0) return '0 Followers';
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M Followers`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K Followers`;
  }
  return `${count} ${count === 1 ? 'Follower' : 'Followers'}`;
};

export default function VendorStore({ propVendorId }: { propVendorId?: string }) {
  const params = useParams<{ vendorId: string }>();
  const vendorId = propVendorId || params.vendorId || '';
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Instant store resolution from navigation state, in-memory cache, localStorage, or seed catalog
  const initialCached = useMemo(() => {
    if (!vendorId) return null;
    const navState = (location.state as any)?.initialStore;
    if (navState && (navState.id === vendorId || navState.vendorId === vendorId || navState.storeId === vendorId)) {
      return navState;
    }
    return getStoreFromCache(vendorId);
  }, [vendorId, location.state]);

  // Instant products resolution from navigation state, cache, or seed catalog
  const initialProducts = useMemo(() => {
    if (!vendorId) return [];
    const navProducts = (location.state as any)?.initialProducts;
    if (Array.isArray(navProducts) && navProducts.length > 0) {
      return navProducts;
    }
    return getStoreProductsFromCache(vendorId);
  }, [vendorId, location.state]);

  // Instant theme resolution from navigation state or cache
  const initialTheme = useMemo(() => {
    if (!vendorId) return null;
    const navTheme = (location.state as any)?.initialTheme;
    if (navTheme && (navTheme.primaryColor || navTheme.layout)) {
      return navTheme;
    }
    return getStoreThemeFromCache(vendorId) || initialCached?.theme || null;
  }, [vendorId, location.state, initialCached]);

  // Instant follower state resolution from navigation state, user session or cache
  const initialFollowing = useMemo(() => {
    if (!vendorId) return false;
    const navFollowing = (location.state as any)?.initialFollowing;
    if (typeof navFollowing === 'boolean') {
      return navFollowing;
    }
    const currentUid = user?.uid || auth.currentUser?.uid || null;
    return getStoreFollowStatusFromCache(vendorId, currentUid);
  }, [vendorId, user?.uid, location.state]);

  // Core Store Data initialized with cached data to guarantee ZERO-BLANK and instant render
  const [vendor, setVendor] = useState<any>(() => initialCached);
  const [profile, setProfile] = useState<any>(() => initialCached);
  const [theme, setTheme] = useState<any>(() => initialTheme);
  const [products, setProducts] = useState<any[]>(() => initialProducts);
  const [reviews, setReviews] = useState<any[]>([]);
  const [selectedReviewImage, setSelectedReviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !initialCached && initialProducts.length === 0);
  const [isDeletedStore, setIsDeletedStore] = useState<boolean>(() => {
    return !!vendorId && isStoreDeletedFromCache(vendorId);
  });

  useEffect(() => {
    const handleStoreDeleted = (e: any) => {
      if (e.detail?.storeId === vendorId) {
        setIsDeletedStore(true);
      }
    };
    window.addEventListener('rj_store_deleted', handleStoreDeleted);
    return () => window.removeEventListener('rj_store_deleted', handleStoreDeleted);
  }, [vendorId]);

  // Follower State initialized synchronously
  const [isFollowing, setIsFollowing] = useState<boolean>(() => initialFollowing);
  const [followersCount, setFollowersCount] = useState<number>(() => {
    return Number(initialCached?.followersCount ?? initialCached?.followers ?? 0);
  });

  // UI Modals
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // User Review Eligibility for this Vendor Store (Enforces strictly 1 review per delivered purchase)
  const [userReviewStatus, setUserReviewStatus] = useState<VendorStoreReviewStatus | null>(null);

  const refreshUserReviewStatus = useCallback(async () => {
    if (!vendorId || !user) {
      setUserReviewStatus(null);
      return;
    }
    try {
      const productIds = products.map(p => String(p.id || p._id || '')).filter(Boolean);
      const status = await getVendorStoreReviewStatus(
        vendorId,
        user.uid,
        user.phoneNumber || (userData as any)?.phone,
        user.email || (userData as any)?.email,
        productIds
      );
      setUserReviewStatus(status);
    } catch (e) {
      console.warn('Error fetching user review status for vendor store:', e);
    }
  }, [vendorId, user, userData, products]);

  useEffect(() => {
    refreshUserReviewStatus();
  }, [refreshUserReviewStatus]);

  // Active Tab: 'products' | 'reviews' | 'about'
  const [activeTab, setActiveTab] = useState<'products' | 'reviews' | 'about'>('products');

  // Filtering & Sorting
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'price-asc' | 'price-desc' | 'discount'>('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [inStockOnly, setInStockOnly] = useState(false);

  // Scroll Container Ref for Category Bar
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // Synchronously update store and product info if route changes to different store
  useEffect(() => {
    if (vendorId) {
      const currentUid = user?.uid || auth.currentUser?.uid || null;
      const store = (location.state as any)?.initialStore || getStoreFromCache(vendorId);
      if (store) {
        setVendor((prev: any) => mergeStoreObjects(prev, store));
        setProfile((prev: any) => mergeStoreObjects(prev, store));
        setFollowersCount(Number(store.followersCount ?? store.followers ?? 0));
      }
      const prods = (location.state as any)?.initialProducts || getStoreProductsFromCache(vendorId);
      if (prods && prods.length > 0) {
        setProducts(prods);
      }
      const th = (location.state as any)?.initialTheme || getStoreThemeFromCache(vendorId);
      if (th && (th.primaryColor || th.layout)) {
        setTheme(th);
      }
      const fol = (location.state as any)?.initialFollowing ?? getStoreFollowStatusFromCache(vendorId, currentUid);
      setIsFollowing(fol);
    }
  }, [vendorId, user?.uid]);

  // Fetch Vendor Profile, Subscription Status, Products & Reviews strictly from RTDB
  useEffect(() => {
    if (!vendorId) return;

    let isMounted = true;
    const fetchStoreData = async () => {
      // Only set loading if there is absolutely no store and product data in cache
      if (!initialCached && products.length === 0) {
        setLoading(true);
      }

      try {
        // 1. Fetch Vendor & Store Data strictly from RTDB via storeCache service
        const freshStore = await fetchStoreDetailFromRTDB(vendorId);

        if (freshStore?.isDeleted || freshStore?.status === 'deleted') {
          if (isMounted) {
            setIsDeletedStore(true);
            setLoading(false);
          }
          return;
        }

        if (isMounted && freshStore) {
          setVendor((prev: any) => {
            const merged = mergeStoreObjects(prev || initialCached, freshStore);
            saveStoreToCache(vendorId, merged);
            return merged;
          });
          setProfile((prev: any) => mergeStoreObjects(prev || initialCached, freshStore));

          const baseFollowers = Number(freshStore?.followersCount ?? freshStore?.followers ?? 0);
          setFollowersCount(baseFollowers);
        }

        // Fetch theme from RTDB - never overwrite with null or default
        try {
          const [themeSnap, storeData, profileData] = await Promise.all([
            rtdbGet<any>(`vendor_themes/${vendorId}`),
            rtdbGet<any>(`stores/${vendorId}/theme`),
            rtdbGet<any>(`vendor_profiles/${vendorId}/theme`)
          ]);
          const validTheme = (themeSnap && (themeSnap.primaryColor || themeSnap.layout)) 
            ? themeSnap 
            : (storeData && (storeData.primaryColor || storeData.layout)) 
              ? storeData 
              : (profileData && (profileData.primaryColor || profileData.layout))
                ? profileData
                : null;

          if (isMounted && validTheme) {
            setTheme((prev: any) => ({ ...(prev || {}), ...validTheme }));
            saveStoreThemeToCache(vendorId, validTheme);
          }
        } catch (themeErr) {
          console.warn('Error fetching theme from RTDB:', themeErr);
        }

        // 2. Determine Follower Count & User Following Status strictly from RTDB
        try {
          const effectiveUid = user?.uid || auth.currentUser?.uid;
          const [followersList, followRecord, userFollowRecord] = await Promise.all([
            rtdbList<any>('store_followers', (f: any) =>
              f?.vendorId === vendorId ||
              f?.storeId === vendorId ||
              String(f?.id || '').startsWith(`${vendorId}_`)
            ),
            effectiveUid ? rtdbGet<any>(`store_followers/${vendorId}_${effectiveUid}`).catch(() => null) : Promise.resolve(null),
            effectiveUid ? rtdbGet<any>(`users/${effectiveUid}/followed_stores/${vendorId}`).catch(() => null) : Promise.resolve(null)
          ]);

          const realFollowersCount = followersList ? followersList.length : 0;
          if (isMounted) {
            setFollowersCount(realFollowersCount);
          }
          saveStoreToCache(vendorId, { followersCount: realFollowersCount });

          if (effectiveUid && isMounted) {
            const isFollowedInRTDB = !!followRecord || !!userFollowRecord;
            setIsFollowing(isFollowedInRTDB);
            saveStoreFollowStatusToCache(vendorId, effectiveUid, isFollowedInRTDB);
          } else if (isMounted) {
            const cachedFollow = getStoreFollowStatusFromCache(vendorId, null);
            setIsFollowing(cachedFollow);
          }
        } catch (fErr) {
          console.warn('Error fetching store followers from RTDB:', fErr);
        }

        // 3. Fetch Products for this Vendor strictly from RTDB
        try {
          const freshProducts = await fetchStoreProductsFromRTDB(vendorId);
          if (isMounted && Array.isArray(freshProducts)) {
            setProducts(freshProducts);
          }
        } catch (e) {
          console.warn('Error fetching products from RTDB, preserving cached products:', e);
        }

        // 4. Fetch Store Reviews from RTDB & Firestore via fetchVendorReviews
        try {
          const freshVendorReviews = await fetchVendorReviews(vendorId);
          if (isMounted && freshVendorReviews.length > 0) {
            setReviews(freshVendorReviews);
          } else {
            const revItems = await rtdbList<any>('vendor_reviews', (r: any) => r.vendorId === vendorId);
            const loadedReviews = revItems.map(d => ({ id: d.id, ...d.data }));
            if (isMounted && loadedReviews.length > 0) {
              setReviews(loadedReviews);
            }
          }
        } catch (e) {
          console.warn('Error fetching store reviews:', e);
        }
      } catch (err) {
        console.error('Error loading vendor store data from RTDB:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStoreData();
    return () => { isMounted = false; };
  }, [vendorId, user]);

  // Blue Verified Badge Logic (ONLY for stores with an active verified plan purchased in Firebase RTDB)
  const isVerifiedSeller = useMemo(() => {
    const combinedData = {
      id: vendorId,
      ...(initialCached || {}),
      ...(profile || {}),
      ...(vendor || {})
    };
    return isStorePlanVerified(combinedData);
  }, [vendor, profile, initialCached, vendorId]);

  // Store Brand Name & Logo Resolution - NEVER overwrites with default or empty
  const storeName = useMemo(() => {
    return (
      profile?.storeName || 
      profile?.shopName || 
      vendor?.storeName || 
      vendor?.shopName || 
      vendor?.name || 
      initialCached?.shopName || 
      initialCached?.storeName || 
      'Official Store'
    );
  }, [profile, vendor, initialCached]);

  const storeLogo = useMemo(() => {
    return (
      profile?.logo || 
      profile?.shopLogo || 
      vendor?.logo || 
      vendor?.shopLogo || 
      vendor?.profileImage || 
      vendor?.photoURL || 
      profile?.avatar || 
      initialCached?.logo || 
      initialCached?.shopLogo || 
      ''
    );
  }, [profile, vendor, initialCached]);

  const storeCategory = useMemo(() => {
    return (
      profile?.category || 
      profile?.businessCategory || 
      vendor?.category || 
      vendor?.businessCategory || 
      initialCached?.category || 
      'Retail & E-commerce'
    );
  }, [profile, vendor, initialCached]);

  const storeDescription = useMemo(() => {
    return (
      profile?.description || 
      profile?.slogan || 
      vendor?.description || 
      vendor?.bio || 
      initialCached?.description || 
      `${storeName} আরজে ওয়ার্ল্ড বিডি-র একটি বিশ্বস্ত ও অনুমোদিত সেলার শপ। আমরা গ্রাহকদের কাছে সর্বোচ্চ মানের আসল পণ্য সঠিক সময়ে পৌঁছে দিতে প্রতিশ্রুতিবদ্ধ।`
    );
  }, [profile, vendor, initialCached, storeName]);

  const resolvedAddress = useMemo(() => {
    const addr = profile?.address || vendor?.address || initialCached?.address;
    if (!addr) return profile?.location || vendor?.location || '';
    if (typeof addr === 'object') {
      const parts = [addr.street, addr.city, addr.state, addr.country].filter(Boolean);
      return parts.join(', ') || profile?.location || '';
    }
    return String(addr);
  }, [profile, vendor, initialCached]);

  const resolvedPhone = useMemo(() => {
    return profile?.contactNumber || profile?.mobileNumber || profile?.phone || 
           vendor?.contactNumber || vendor?.mobileNumber || vendor?.phone || 
           initialCached?.contactNumber || initialCached?.phone || '';
  }, [profile, vendor, initialCached]);

  const resolvedEmail = useMemo(() => {
    return profile?.email || profile?.contactEmail || 
           vendor?.email || initialCached?.email || '';
  }, [profile, vendor, initialCached]);

  const primaryColor = useMemo(() => {
    return (
      theme?.primaryColor || 
      initialTheme?.primaryColor || 
      initialCached?.primaryColor || 
      initialCached?.theme?.primaryColor || 
      '#0284c7'
    );
  }, [theme, initialTheme, initialCached]);

  // Social Media Links (Only connected ones will be displayed)
  const socialPlatforms = useMemo(() => {
    const raw = {
      facebook: profile?.facebook || vendor?.facebook || profile?.facebookPage || '',
      youtube: profile?.youtube || vendor?.youtube || '',
      instagram: profile?.instagram || vendor?.instagram || '',
      whatsapp: profile?.whatsappNumber || vendor?.whatsappNumber || profile?.whatsapp || vendor?.whatsapp || '',
      tiktok: profile?.tiktok || vendor?.tiktok || ''
    };

    const list: { id: string; name: string; url: string; color: string; icon: React.ReactNode }[] = [];

    // Facebook
    if (raw.facebook && raw.facebook.trim()) {
      const val = raw.facebook.trim();
      const url = val.startsWith('http') ? val : `https://facebook.com/${val.replace(/^@/, '')}`;
      list.push({
        id: 'facebook',
        name: 'Facebook',
        url,
        color: 'hover:bg-blue-600 hover:text-white text-blue-600 bg-blue-50 border-blue-200',
        icon: (
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )
      });
    }

    // YouTube
    if (raw.youtube && raw.youtube.trim()) {
      const val = raw.youtube.trim();
      const url = val.startsWith('http') ? val : `https://youtube.com/${val.replace(/^@/, '')}`;
      list.push({
        id: 'youtube',
        name: 'YouTube',
        url,
        color: 'hover:bg-red-600 hover:text-white text-red-600 bg-red-50 border-red-200',
        icon: (
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        )
      });
    }

    // Instagram
    if (raw.instagram && raw.instagram.trim()) {
      const val = raw.instagram.trim();
      const url = val.startsWith('http') ? val : `https://instagram.com/${val.replace(/^@/, '')}`;
      list.push({
        id: 'instagram',
        name: 'Instagram',
        url,
        color: 'hover:bg-pink-600 hover:text-white text-pink-600 bg-pink-50 border-pink-200',
        icon: (
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        )
      });
    }

    // WhatsApp
    if (raw.whatsapp && raw.whatsapp.trim()) {
      const cleanNum = raw.whatsapp.replace(/[^0-9]/g, '');
      if (cleanNum) {
        list.push({
          id: 'whatsapp',
          name: 'WhatsApp',
          url: `https://wa.me/${cleanNum}`,
          color: 'hover:bg-emerald-600 hover:text-white text-emerald-600 bg-emerald-50 border-emerald-200',
          icon: (
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
          )
        });
      }
    }

    // TikTok
    if (raw.tiktok && raw.tiktok.trim()) {
      const val = raw.tiktok.trim();
      const url = val.startsWith('http') ? val : `https://tiktok.com/@${val.replace(/^@/, '')}`;
      list.push({
        id: 'tiktok',
        name: 'TikTok',
        url,
        color: 'hover:bg-slate-900 hover:text-white text-slate-900 bg-slate-100 border-slate-300',
        icon: (
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
          </svg>
        )
      });
    }

    return list;
  }, [profile, vendor]);

  // Ratings & Verified Reviews Summary strictly from authentic RTDB customer reviews
  const { averageRating, totalReviewsCount } = useMemo(() => {
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, curr) => acc + (Number(curr.rating) || 5), 0);
      return {
        averageRating: (sum / reviews.length).toFixed(1),
        totalReviewsCount: reviews.length
      };
    }
    // Only use vendor/profile rating if there are real reviews in RTDB, never invent fake numbers
    const rawCount = Number(profile?.reviewsCount ?? vendor?.reviewsCount ?? 0);
    const rawRating = Number(profile?.rating ?? vendor?.rating ?? 0);
    if (rawCount > 0 && rawRating > 0) {
      return {
        averageRating: rawRating.toFixed(1),
        totalReviewsCount: rawCount
      };
    }
    return {
      averageRating: '0',
      totalReviewsCount: 0
    };
  }, [reviews, profile, vendor]);

  // Extract Categories with Visual Images & Counts
  const storeCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; image: string }>();

    products.forEach((p) => {
      const rawCat = p.category || p.categorySlug;
      if (!rawCat) return;
      const cleanName = String(rawCat).trim();
      const normKey = cleanName.toLowerCase();

      if (!map.has(normKey)) {
        // Resolve best image: mapped, product image, or placeholder
        const mappedImg = 
          CATEGORY_IMAGE_MAP[normKey] || 
          CATEGORY_IMAGE_MAP[normKey.replace(/\s*&\s*/g, '-')] || 
          CATEGORY_IMAGE_MAP[normKey.replace(/\s+/g, '-')];

        const prodImg = p.image || p.featuredImage || (p.images && p.images[0]);

        map.set(normKey, {
          id: normKey,
          name: cleanName,
          count: 1,
          image: mappedImg || prodImg || PLACEHOLDER_PRODUCT_IMAGE
        });
      } else {
        const item = map.get(normKey)!;
        item.count += 1;
      }
    });

    return Array.from(map.values());
  }, [products]);

  // Filter & Sort Products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Category Filter
    if (selectedCategory !== 'all') {
      result = result.filter(p => {
        const cat = (p.category || p.categorySlug || '').toLowerCase().trim();
        return cat === selectedCategory.toLowerCase().trim();
      });
    }

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // In Stock Filter
    if (inStockOnly) {
      result = result.filter(p => p.inStock !== false && (p.stockCount === undefined || p.stockCount > 0));
    }

    // Sorting
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        break;
      case 'price-asc':
        result.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        break;
      case 'price-desc':
        result.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
        break;
      case 'discount':
        result.sort((a, b) => (b.discount || 0) - (a.discount || 0));
        break;
      case 'popular':
      default:
        result.sort((a, b) => (b.rating || 5) * (b.reviews || 10) - (a.rating || 5) * (a.reviews || 10));
        break;
    }

    return result;
  }, [products, selectedCategory, searchQuery, inStockOnly, sortBy]);

  // Handle Follow / Unfollow Store
  const handleToggleFollow = async () => {
    const effectiveUser = user || auth.currentUser;
    if (!effectiveUser) {
      toast.error('স্টোর ফলো করতে অনুগ্রহ করে লগইন করুন');
      navigate('/login');
      return;
    }

    const nextState = !isFollowing;
    setIsFollowing(nextState);
    const nextCount = nextState ? followersCount + 1 : Math.max(0, followersCount - 1);
    setFollowersCount(nextCount);
    saveStoreFollowStatusToCache(vendorId, effectiveUser.uid, nextState);

    // Sync follower count in cached store object
    const cachedStore = getStoreFromCache(vendorId);
    if (cachedStore) {
      saveStoreToCache(vendorId, {
        ...cachedStore,
        followersCount: nextCount,
        followers: nextCount
      });
    }

    try {
      if (nextState) {
        await Promise.allSettled([
          rtdbSet(`store_followers/${vendorId}_${effectiveUser.uid}`, {
            vendorId,
            userId: effectiveUser.uid,
            customerName: userData?.name || effectiveUser.displayName || 'সম্মানিত ক্রেতা',
            customerEmail: effectiveUser.email || '',
            followedAt: Date.now()
          }),
          rtdbSet(`users/${effectiveUser.uid}/followed_stores/${vendorId}`, {
            storeId: vendorId,
            storeName: storeName || 'Store',
            storeLogo: storeLogo || '',
            followedAt: Date.now()
          }),
          rtdbUpdate(`vendors/${vendorId}`, { followersCount: nextCount }),
          rtdbUpdate(`vendor_profiles/${vendorId}`, { followersCount: nextCount }),
          rtdbUpdate(`stores/${vendorId}`, { followersCount: nextCount })
        ]);
        toast.success(`আপনি এখন "${storeName}" এর ফলোয়ার!`);
      } else {
        await Promise.allSettled([
          rtdbRemove(`store_followers/${vendorId}_${effectiveUser.uid}`),
          rtdbRemove(`users/${effectiveUser.uid}/followed_stores/${vendorId}`),
          rtdbUpdate(`vendors/${vendorId}`, { followersCount: nextCount }),
          rtdbUpdate(`vendor_profiles/${vendorId}`, { followersCount: nextCount }),
          rtdbUpdate(`stores/${vendorId}`, { followersCount: nextCount })
        ]);
        toast.success('স্টোর আনফলো করা হয়েছে');
      }
    } catch (err) {
      console.error('Error updating follow state in RTDB:', err);
    }
  };

  // Open Internal Vendor Chat System directly (no WhatsApp)
  const handleStartVendorChat = async () => {
    if (!user) {
      toast.error('ভেন্ডরের সাথে চ্যাট করতে অনুগ্রহ করে লগইন করুন');
      navigate('/login');
      return;
    }

    const targetVendorId = profile?.userId || vendor?.userId || profile?.vendorId || vendor?.vendorId || vendor?.id || profile?.id || vendorId;

    if (user.uid === targetVendorId) {
      toast('এটি আপনার নিজের শপ');
      return;
    }

    const chatId = `${user.uid}_${targetVendorId}`;

    try {
      const existingChat = await rtdbGet<any>(`chats/${chatId}`);
      if (!existingChat) {
        await rtdbSet(`chats/${chatId}`, {
          id: chatId,
          customerId: user.uid,
          customerName: userData?.name || user.displayName || 'Customer',
          customerEmail: user.email || '',
          vendorId: targetVendorId,
          vendorName: storeName || 'Vendor',
          vendorLogo: storeLogo || '',
          storeId: vendorId,
          lastMessage: 'Conversation started',
          lastMessageTime: Date.now(),
          unreadCountVendor: 0,
          unreadCountCustomer: 0,
          createdAt: Date.now()
        });
      }
    } catch (e) {
      console.warn('Error setting up chat in RTDB:', e);
    }

    navigate(`/chat/${targetVendorId}`);
  };

  // Scroll Category Container left/right on desktop
  const scrollCategories = (direction: 'left' | 'right') => {
    if (!categoryScrollRef.current) return;
    const scrollAmount = direction === 'left' ? -260 : 260;
    categoryScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const isStoreOwnerOrAdmin = user?.uid === vendorId || userData?.role === 'Admin';
  const storeUrl = typeof window !== 'undefined' ? window.location.href : `https://rjworldbd.com/store/${vendorId}`;

  if (isDeletedStore) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
        <Header />
        <main className="flex-1 flex items-center justify-center p-6 my-auto">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-sm border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <StoreIcon className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">স্টোরটি পাওয়া যায়নি</h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              এই ভেন্ডর বা স্টোরটি আর সক্রিয় নেই অথবা মুছে ফেলা হয়েছে।
            </p>
            <div className="flex flex-col gap-2.5">
              <Link
                to="/brands"
                className="w-full py-3 px-4 bg-emerald-600 text-white font-semibold rounded-xl text-sm hover:bg-emerald-700 transition-colors shadow-sm"
              >
                সব ব্র্যান্ড ও স্টোর দেখুন
              </Link>
              <Link
                to="/"
                className="w-full py-3 px-4 border border-slate-200 text-slate-700 font-semibold rounded-xl text-sm hover:bg-slate-50 transition-colors"
              >
                হোমপেজে ফিরে যান
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <Header />

      <main className="flex-1 pb-16">
        
        {/* ========================================================= */}
        {/* 1. STORE HEADER (Clean, Compact, Mobile-Friendly, Premium) */}
        {/* ========================================================= */}
        <div className="bg-white border-b border-slate-200 shadow-xs">
          
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
              
              {/* Store Identity (Logo + Name + Badge + Followers + Rating) */}
              <div className="flex items-center gap-3">
                
                {/* Store Logo - App Icon Style Rounded Square */}
                <div className="relative shrink-0">
                  <div className="w-13 h-13 sm:w-16 sm:h-16 aspect-square rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden bg-white p-1 flex items-center justify-center">
                    {storeLogo ? (
                      <img 
                        src={storeLogo} 
                        alt={storeName} 
                        className="w-full h-full object-contain rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div 
                        className="w-full h-full rounded-xl flex items-center justify-center text-white font-black text-xl shadow-inner"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {storeName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Blue Verified Badge on bottom-right of logo */}
                  {isVerifiedSeller && (
                    <VerifiedBadge 
                      className="absolute -bottom-1 -right-1 z-10"
                      title="অনুমোদিত ভেরিফাইড স্টোর"
                    />
                  )}
                </div>

                {/* Name, Badges & Quick Stats */}
                <div className="min-w-0 flex-1">
                  
                  {/* Store Name, Verified Badge & Category */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight leading-snug truncate">
                        {storeName}
                      </h1>
                      {isVerifiedSeller && (
                        <VerifiedBadge 
                          title="অনুমোদিত ভেরিফাইড স্টোর"
                        />
                      )}
                      {/* Review count badge directly near verified badge */}
                      <button
                        type="button"
                        onClick={() => setActiveTab('reviews')}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/90 px-2 py-0.5 rounded-full transition-colors cursor-pointer shrink-0"
                        title="গ্রাহক রিভিউ দেখুন"
                      >
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>{totalReviewsCount > 0 ? `${totalReviewsCount} রিভিউ` : '০ রিভিউ'}</span>
                      </button>
                    </div>

                    {/* Category Badge */}
                    {storeCategory && (
                      <span className="inline-flex items-center text-[10px] font-semibold text-slate-600 bg-slate-100/90 border border-slate-200/80 px-2 py-0.5 rounded-full shrink-0">
                        {storeCategory}
                      </span>
                    )}
                  </div>

                  {/* Stats Line: Followers Count & Star Rating Summary */}
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-slate-600">
                    
                    {/* Follower Count */}
                    <div className="flex items-center gap-1 font-semibold text-slate-800 bg-slate-100/90 px-1.5 py-0.5 rounded text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{formatFollowers(followersCount)}</span>
                    </div>

                    {/* Store Rating & Review Count */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('reviews')}
                      className="flex items-center gap-1 hover:text-sky-600 transition-colors cursor-pointer text-[11px]"
                    >
                      <Star className={`w-3.5 h-3.5 ${totalReviewsCount > 0 ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                      {totalReviewsCount > 0 ? (
                        <>
                          <span className="font-bold text-slate-800">{averageRating}</span>
                          <span className="text-slate-600 font-semibold">({totalReviewsCount} রিভিউ)</span>
                        </>
                      ) : (
                        <span className="text-slate-500 font-medium">০ রিভিউ</span>
                      )}
                    </button>

                    {/* Products Count */}
                    <span className="hidden sm:inline text-slate-300">•</span>
                    <span className="hidden sm:inline text-slate-500 text-[11px]">
                      {products.length} Products
                    </span>
                  </div>

                  {/* Connected Social Media Platforms (Only connected ones shown!) */}
                  {socialPlatforms.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] font-medium text-slate-400 mr-0.5 hidden sm:inline">Connect:</span>
                      {socialPlatforms.map((platform) => (
                        <a
                          key={platform.id}
                          href={platform.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${platform.name} - ${storeName}`}
                          className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all cursor-pointer ${platform.color}`}
                        >
                          {platform.icon}
                        </a>
                      ))}
                    </div>
                  )}

                </div>
              </div>

              {/* Store Header Actions (Follow, Chat, Share, Customize) */}
              <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-end pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                
                {/* Follow / Unfollow Button */}
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  className={`flex-1 sm:flex-none px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    isFollowing
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                      : 'text-white hover:opacity-95'
                  }`}
                  style={!isFollowing ? { backgroundColor: primaryColor } : undefined}
                >
                  {isFollowing ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <Heart className="w-3.5 h-3.5 fill-current" />
                      <span>Follow Store</span>
                    </>
                  )}
                </button>

                {/* Chat / Message Button (Internal Chat System) */}
                <button
                  type="button"
                  onClick={handleStartVendorChat}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="ভেন্ডরের সাথে চ্যাট করুন"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Chat</span>
                </button>

                {/* Share Button */}
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                  title="স্টোর শেয়ার করুন"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>

              </div>

            </div>

            {/* Navigation Tabs (Products, Reviews, About) */}
            <div className="flex items-center gap-5 mt-3 border-t border-slate-100 pt-2 text-xs sm:text-sm font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`pb-1.5 transition-colors relative cursor-pointer ${
                  activeTab === 'products' 
                    ? 'text-slate-900 font-bold' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Products ({products.length})</span>
                {activeTab === 'products' && (
                  <span 
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reviews')}
                className={`pb-1.5 transition-colors relative cursor-pointer ${
                  activeTab === 'reviews' 
                    ? 'text-slate-900 font-bold' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Customer Reviews ({totalReviewsCount > 0 ? `${totalReviewsCount} রিভিউ` : reviews.length})</span>
                {activeTab === 'reviews' && (
                  <span 
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('about')}
                className={`pb-1.5 transition-colors relative cursor-pointer ${
                  activeTab === 'about' 
                    ? 'text-slate-900 font-bold' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>About Store</span>
                {activeTab === 'about' && (
                  <span 
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}
              </button>
            </div>

          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. TAB: PRODUCTS TAB */}
        {/* ========================================================= */}
        {activeTab === 'products' && (
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-3 sm:mt-4 space-y-3 sm:space-y-4">

            {/* ------------------------------------------------------- */}
            {/* CATEGORIES WITH VISUAL IMAGES (Compact & Mobile-Friendly) */}
            {/* ------------------------------------------------------- */}
            {storeCategories.length > 0 && (
              <div className="bg-white rounded-xl p-2.5 sm:p-3.5 border border-slate-200/90 shadow-2xs">
                
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                      Categories
                    </h2>
                    <span className="text-[11px] text-slate-400">
                      ({storeCategories.length})
                    </span>
                  </div>

                  {/* Desktop scroll arrows */}
                  <div className="hidden sm:flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => scrollCategories('left')}
                      className="w-6 h-6 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Previous categories"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollCategories('right')}
                      className="w-6 h-6 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Next categories"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Horizontal Scrollable Category Rail (Compact & Mobile-Optimized) */}
                <div 
                  ref={categoryScrollRef}
                  className="flex items-start gap-2 sm:gap-3 overflow-x-auto pb-1 scrollbar-none scroll-smooth"
                >
                  
                  {/* "All Products" Tile */}
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all cursor-pointer shrink-0 w-16 sm:w-20 text-center group ${
                      selectedCategory === 'all'
                        ? 'bg-slate-100 font-bold text-slate-900 ring-1.5 ring-sky-500'
                        : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform overflow-hidden">
                      <StoreIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <span className="text-[11px] font-semibold leading-tight line-clamp-1">
                      All Items
                    </span>
                    <span className="text-[9px] text-slate-400 font-normal">
                      {products.length}
                    </span>
                  </button>

                  {/* Individual Categories With Images */}
                  {storeCategories.map((cat) => {
                    const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all cursor-pointer shrink-0 w-16 sm:w-20 text-center group ${
                          isSelected
                            ? 'bg-slate-100 font-bold text-slate-900 ring-1.5 ring-sky-500'
                            : 'hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border border-slate-200 overflow-hidden shadow-2xs group-hover:scale-105 transition-transform bg-white">
                          <img 
                            src={cat.image} 
                            alt={cat.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <span className="text-[11px] font-semibold leading-tight line-clamp-1">
                          {cat.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-normal">
                          {cat.count}
                        </span>
                      </button>
                    );
                  })}

                </div>

              </div>
            )}

            {/* ------------------------------------------------------- */}
            {/* SEARCH & SORT TOOLBAR (Slim & Space-Saving)              */}
            {/* ------------------------------------------------------- */}
            <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input 
                  type="text"
                  placeholder="Search in this store..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-slate-800"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sorting & Filter Controls */}
              <div className="flex items-center gap-2 justify-between sm:justify-end">
                
                {/* Sort Dropdown */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
                  >
                    <option value="popular">Most Popular</option>
                    <option value="newest">Newest First</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="discount">Highest Discount</option>
                  </select>
                </div>

                {/* In-Stock Toggle */}
                <button
                  type="button"
                  onClick={() => setInStockOnly(!inStockOnly)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    inStockOnly
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  In Stock Only
                </button>

                {/* View Mode Toggle (Grid vs List) */}
                <div className="hidden sm:flex items-center gap-1 border border-slate-200 rounded-xl p-0.5 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'grid' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="Grid view"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'list' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

              </div>

            </div>

            {/* Active Category Indicator Banner if filtered */}
            {selectedCategory !== 'all' && (
              <div className="flex items-center justify-between px-3 py-2 bg-sky-50 border border-sky-100 rounded-xl text-xs text-sky-800">
                <span>
                  Showing products in <strong>{selectedCategory}</strong> ({filteredProducts.length})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="font-bold text-sky-600 hover:underline cursor-pointer"
                >
                  Clear Category
                </button>
              </div>
            )}

            {/* ------------------------------------------------------- */}
            {/* PRODUCT GRID (Clean, Modern, Mobile-First 2-Column)     */}
            {/* ------------------------------------------------------- */}
            {loading && products.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-3 animate-pulse space-y-3">
                    <div className="aspect-square bg-slate-100 rounded-xl w-full" />
                    <div className="h-3.5 bg-slate-100 rounded w-3/4" />
                    <div className="h-3.5 bg-slate-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <PackageSearch className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800">কোনো পণ্য পাওয়া যায়নি</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  আপনার অনুসন্ধানের সাথে মিলে এমন কোনো পণ্য এই মুহূর্তে খুঁজে পাওয়া যায়নি।
                </p>
                {(selectedCategory !== 'all' || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('all');
                      setSearchQuery('');
                      setInStockOnly(false);
                    }}
                    className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    সব পণ্য প্রদর্শন করুন
                  </button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    showAddToCart={true}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProducts.map((product) => (
                  <div 
                    key={product.id}
                    className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs flex items-center gap-4 hover:border-slate-300 transition-all"
                  >
                    <Link to={getProductPath(product)} className="shrink-0">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                        <img 
                          src={product.image || product.featuredImage || (product.images && product.images[0])} 
                          alt={`${product.name} - ${product.brand || 'RJ WORLD BD'}`} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </Link>

                    <div className="flex-1 min-w-0">
                      <Link to={getProductPath(product)}>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 hover:text-sky-600 line-clamp-2 leading-snug">
                          {product.name}
                        </h4>
                      </Link>

                      <div className="flex items-center gap-2 mt-1.5 text-xs">
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>{product.rating || 5.0}</span>
                        </div>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500">{product.category || 'General'}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm sm:text-base font-extrabold text-slate-900">
                          ৳{Number(product.price).toLocaleString()}
                        </span>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <span className="text-xs text-slate-400 line-through">
                            ৳{Number(product.originalPrice).toLocaleString()}
                          </span>
                        )}
                        {product.discount && (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                            -{product.discount}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col gap-2">
                      <Link
                        to={getProductPath(product)}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors text-center"
                      >
                        বিস্তারিত
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* ========================================================= */}
        {/* 3. TAB: VERIFIED CUSTOMER REVIEWS (Authentic Orders Only) */}
        {/* ========================================================= */}
        {activeTab === 'reviews' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
            
            {/* Reviews Summary Card */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                
                {/* Rating Overview */}
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl ${totalReviewsCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-slate-50 border-slate-200 text-slate-400'} border flex flex-col items-center justify-center shrink-0`}>
                    <span className="text-2xl font-black leading-none">{totalReviewsCount > 0 ? averageRating : '0.0'}</span>
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star 
                          key={s} 
                          className={`w-2.5 h-2.5 ${totalReviewsCount > 0 && s <= Math.round(Number(averageRating)) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} 
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">ভেরিফাইড ক্রেতাদের রেটিং ও রিভিউ</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {totalReviewsCount > 0 
                        ? `মোট ${totalReviewsCount} টি সফল ক্রয় ও ডেলিভারিকৃত অর্ডারের সরাসরি রিভিউ`
                        : 'এখনো কোনো রিভিউ যোগ করা হয়নি'}
                    </p>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold mt-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>১০০% আসল ক্রেতাদের রিভিউ নিশ্চিত</span>
                    </div>
                  </div>
                </div>

                {/* Write Review Action (Enforces strictly 1 review per delivered purchase) */}
                <div>
                  {userReviewStatus?.alreadyReviewedItemsCount && userReviewStatus.alreadyReviewedItemsCount > 0 && !userReviewStatus.canReview ? (
                    <button
                      type="button"
                      onClick={() => setReviewModalOpen(true)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="আপনি ইতিমধ্যে এই স্টোরের ক্রয়কৃত পণ্যের রিভিউ প্রদান করেছেন"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>রিভিউ দেওয়া সম্পন্ন (Reviewed)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReviewModalOpen(true)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs transition-opacity hover:opacity-95 flex items-center justify-center gap-2 cursor-pointer"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {userReviewStatus?.canReview 
                          ? `রিভিউ দিন (${userReviewStatus.unreviewedItems.length}টি পণ্য বাকি)` 
                          : 'রিভিউ দিন (ভেরিফাইড ক্রেতা)'}
                      </span>
                    </button>
                  )}
                </div>

              </div>

              {/* Verified Purchase Policy Banner */}
              <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p>
                  আরজে ওয়ার্ল্ড বিডি-তে ভুয়া বা একাধিকবার রিভিউ সম্পূর্ণ নিষিদ্ধ। একটি সফল অর্ডারের জন্য সর্বোচ্চ <strong>১টি রিভিউ</strong> দেওয়া যাবে (স্টোর বা প্রোফাইল যেকোনো এক স্থান থেকে রিভিউ দিলে আর দেওয়া যাবে না)।
                </p>
              </div>
            </div>

            {/* Customer Reviews List */}
            <div className="space-y-3">
              {reviews.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Star className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">এখনো কোনো রিভিউ দেওয়া হয়নি</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    আপনি কি এই স্টোর থেকে পণ্য ক্রয় করেছেন? সফল ডেলিভারির পর আপনার মূল্যবান মতামত দিন।
                  </p>
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(true)}
                    className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    প্রথম রিভিউ দিন
                  </button>
                </div>
              ) : (
                reviews.map((rev) => (
                  <div 
                    key={rev.id}
                    className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                          {(rev.customerName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{rev.customerName || 'ভেরিফাইড ক্রেতা'}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                              <Check className="w-2.5 h-2.5" />
                              <span>Verified Purchase</span>
                            </span>
                          </div>
                          {rev.productName && (
                            <span className="text-[11px] text-slate-500 truncate block max-w-xs">
                              পণ্য: {rev.productName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star 
                            key={s} 
                            className={`w-3.5 h-3.5 ${s <= (rev.rating || 5) ? 'fill-amber-400' : 'text-slate-200'}`} 
                          />
                        ))}
                      </div>
                    </div>

                    {/* Review Text */}
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed pt-1">
                      {rev.comment || rev.text}
                    </p>

                    {/* Review Photos attached by customer */}
                    {rev.images && rev.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1.5">
                        {rev.images.map((img: string, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSelectedReviewImage(img)}
                            className="group relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:ring-2 hover:ring-primary-main/50 transition-all cursor-pointer text-left shrink-0"
                            title="ছবিটি বড় করে দেখতে ক্লিক করুন"
                          >
                            <img
                              src={img}
                              referrerPolicy="no-referrer"
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center transition-colors">
                              <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-xs" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Vendor Reply if present - clean, readable, prominent */}
                    {rev.vendorReply && rev.vendorReply.text && (
                      <div className="mt-2.5 p-3 bg-gradient-to-r from-sky-50 to-indigo-50/40 border border-sky-200/90 rounded-xl text-xs space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-sky-950">
                            <StoreIcon className="w-3.5 h-3.5 text-primary-main shrink-0" />
                            <span>স্টোরের উত্তর ({rev.vendorReply.vendorName || storeName}):</span>
                          </div>
                          {rev.vendorReply.repliedAt && (
                            <span className="text-[10px] text-sky-700/80 font-medium">
                              {new Date(rev.vendorReply.repliedAt).toLocaleDateString('bn-BD', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-800 text-xs sm:text-[13px] leading-relaxed pl-5 whitespace-pre-wrap font-medium">
                          {rev.vendorReply.text}
                        </p>
                      </div>
                    )}

                    {/* Date */}
                    {rev.createdAt && (
                      <p className="text-[10px] text-slate-400 pt-1">
                        {new Date(rev.createdAt).toLocaleDateString('bn-BD', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* 4. TAB: ABOUT STORE (Clean, Simple, Professional)         */}
        {/* ========================================================= */}
        {activeTab === 'about' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-5">
            
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
              
              {/* Store Description */}
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-2">স্টোর পরিচিতি</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {storeDescription}
                </p>
              </div>

              {/* Service Commitments (Clean & High Quality) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">১০০% আসল পণ্য</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">সবগুলো পণ্য যাচাইকৃত ও প্রিমিয়াম কোয়ালিটি</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">নিরাপদ ডেলিভারি</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">সারাদেশে দ্রুততম সময়ে কুরিয়ার ডেলিভারি</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">গ্রাহক সেবা সাপোর্ট</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">যেকোনো তথ্যে বিক্রেতার সাথে সরাসরি চ্যাট</p>
                  </div>
                </div>

              </div>

              {/* Contact Information */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-800">যোগাযোগের তথ্য</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                  
                  {resolvedAddress && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{resolvedAddress}</span>
                    </div>
                  )}

                  {resolvedPhone && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{resolvedPhone}</span>
                    </div>
                  )}

                  {resolvedEmail && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{resolvedEmail}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{profile?.openingHours || vendor?.openingHours || 'সপ্তাহের ৭ দিন খোলা'}</span>
                  </div>

                </div>
              </div>

            </div>

          </div>
        )}

        {/* Other Official Stores / Vendors Section at Bottom */}
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 mt-8 mb-4">
          <BrandList />
        </div>

      </main>

      <Footer />

      {/* ========================================================= */}
      {/* MODALS */}
      {/* ========================================================= */}

      {/* Share Modal (No QR code!) */}
      <StoreShareModal 
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        storeName={storeName}
        storeUrl={storeUrl}
        storeLogo={storeLogo}
        primaryColor={primaryColor}
      />

      {/* Store Review Modal (Verified customer purchase check) */}
      <StoreReviewModal 
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        vendorId={vendorId}
        storeName={storeName}
        products={products}
        primaryColor={primaryColor}
        onReviewAdded={(newReview) => {
          setReviews((prev) => [newReview, ...prev]);
          refreshUserReviewStatus();
        }}
      />

      {/* Lightbox for review images */}
      <ImageLightboxModal
        isOpen={!!selectedReviewImage}
        imageUrl={selectedReviewImage}
        onClose={() => setSelectedReviewImage(null)}
        title="রিভিউ ফটো (Review Photo)"
      />

    </div>
  );
}
