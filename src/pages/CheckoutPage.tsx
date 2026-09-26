import { safeStorage } from "../utils/storage";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../context/AuthContext';
import { rtdbGet, rtdbSet, rtdbUpdate, rtdbList, rtdbPush, rtdbTransaction } from '../lib/rtdb';
import { executeResellerWalletTransaction, isResellerAccount as checkIsResellerAccount } from '../services/resellerWalletService';
import { ResellerTransactionType } from '../types/resellerWallet';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import ProductCard from '../components/ui/ProductCard';
import type { Product } from '../components/ui/ProductCard';
import toast from 'react-hot-toast';
import { Loader2, CreditCard, ShieldCheck, MapPin, Truck, CheckCircle2, Ticket, Smartphone, Wallet, Sparkles, Search } from 'lucide-react';
import { BANGLADESH_DISTRICTS, getDistrictById } from '../data/bangladeshDistricts';
import { AddressSelectorModal, type SelectedAddressLocation } from '../components/checkout/AddressSelectorModal';
import PaymentMethodSelectionModal from '../components/checkout/PaymentMethodSelectionModal';
import BkashPaymentModal from '../components/checkout/BkashPaymentModal';
import NagadPaymentModal from '../components/checkout/NagadPaymentModal';
import RocketPaymentModal from '../components/checkout/RocketPaymentModal';
import UpayPaymentModal from '../components/checkout/UpayPaymentModal';
import PaymentSuccessModal from '../components/payment/PaymentSuccessModal';
import { 
  calculateCourierCharge, 
  calculateCartTotalWeight, 
  calculateCartTotalWeightDetailed, 
  calculateMultiVendorShipping,
  parseProductWeight,
  formatWeight,
  type DeliveryCalculationResult,
  type CartWeightDetailedSummary,
  type MultiVendorShippingResult,
  type VendorPackageBreakdown,
  type DeliveryZone
} from '../utils/deliveryCalculator';
import { resolveAuthoritativeVendorLocation } from '../services/vendorLocationService';
import { verifyPaymentAutomatic } from '../services/automaticPaymentVerificationService';
import { saveOrderToDatabases } from '../services/orderService';
import { fetchAllMarketplaceProducts, subscribeToMarketplaceProducts } from '../services/productService';
import { notifyVendorNewOrder } from '../services/vendorNotificationService';
import { 
  buildResellerPriceSnapshot, 
  saveResellerOrderRecord, 
  type ResellerOrderRecord 
} from '../services/resellerOrderService';

interface Address {
  name: string;
  mobile: string;
  altPhone?: string;
  email: string;
  division: string;
  district: string;
  upazila: string;
  area?: string;
  fullAddress: string;
  additionalNotes?: string;
  postalCode: string;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items: cartItems, cartTotal: cartContextTotal, clearCart } = useCart();
  const { user, userData, refreshUserData } = useAuth();
  
  // Real-time wallet balance for RJ WORLD BD Wallet
  const [userWalletBalance, setUserWalletBalance] = useState<number | null>(null);
  const [showPaymentSuccessModal, setShowPaymentSuccessModal] = useState<boolean>(false);
  const [successTargetOrderId, setSuccessTargetOrderId] = useState<string>('');

  useEffect(() => {
    if (!user) {
      setUserWalletBalance(null);
      return;
    }
    let isMounted = true;
    const fetchBalance = async () => {
      try {
        const d = await rtdbGet<any>(`users/${user.uid}`);
        if (!isMounted) return;
        if (d) {
          const bal = typeof d.wallet === 'number' ? d.wallet : (typeof d.balance === 'number' ? d.balance : 0);
          setUserWalletBalance(prev => (prev === bal ? prev : bal));
        } else if (userData) {
          const bal = userData.wallet ?? userData.balance ?? 0;
          setUserWalletBalance(prev => (prev === bal ? prev : bal));
        }
      } catch (e) {
        if (isMounted && userData) {
          const bal = userData.wallet ?? userData.balance ?? 0;
          setUserWalletBalance(prev => (prev === bal ? prev : bal));
        }
      }
    };
    fetchBalance();
    return () => { isMounted = false; };
  }, [user?.uid]);

  // Handle Buy Now vs Cart Checkout
  const isReseller = userData?.role === 'Reseller';
  const isPremium = userData?.role === 'Premium Customer' || (userData as any)?.isPremium || userData?.role === 'Premium';
  
  const rawBuyNow = location.state?.buyNowItem;
  const buyNowItem = useMemo(() => {
    if (!rawBuyNow) return null;
    return {
      ...rawBuyNow,
      price: Number(rawBuyNow.price) || 0,
      quantity: Number(rawBuyNow.quantity) || 1,
      weight: rawBuyNow.weight ?? rawBuyNow.specifications?.Weight ?? rawBuyNow.specifications?.weight ?? (rawBuyNow as any).productWeight
    };
  }, [
    rawBuyNow?.id,
    rawBuyNow?.productId,
    rawBuyNow?.price,
    rawBuyNow?.quantity,
    rawBuyNow?.selectedColor,
    rawBuyNow?.selectedSize,
    rawBuyNow?.variantId,
    rawBuyNow?.weight,
    rawBuyNow?.specifications
  ]);

  const items = useMemo(() => {
    return buyNowItem ? [buyNowItem] : (cartItems || []);
  }, [buyNowItem, cartItems]);

  const initialTotal = useMemo(() => {
    if (buyNowItem) {
      return (Number(buyNowItem.price) || 0) * (Number(buyNowItem.quantity) || 1);
    }
    return cartContextTotal;
  }, [buyNowItem, cartContextTotal]);

  const [loading, setLoading] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(true);
  const [visibleRelatedCount, setVisibleRelatedCount] = useState<number>(8);

  // Vendor & Weight Enriched Item State
  const [itemsWithDetails, setItemsWithDetails] = useState<any[]>([]);
  const [vendorLocation, setVendorLocation] = useState<{ district: string; upazila: string }>({
    district: '',
    upazila: ''
  });

  // Unique stable key for items to avoid unnecessary network fetches and infinite re-render loops
  const itemsKey = useMemo(() => {
    if (!items || items.length === 0) return '';
    return items
      .map(i => `${i.id || (i as any).productId || ''}:${i.quantity || 1}:${i.price || 0}:${(i as any).vendorId || ''}:${(i as any).storeId || ''}:${(i as any).weight || ''}`)
      .join('|');
  }, [items]);

  // Quick, lightweight fetch of related products once without live subscription (deferred to prevent UI lag)
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));
        const prods: any = await Promise.race([
          rtdbGet<any>('products'),
          timeoutPromise
        ]);
        if (!isMounted || !prods) {
          setLoadingRelated(false);
          return;
        }
        const list: Product[] = Array.isArray(prods) 
          ? prods.filter(Boolean) 
          : Object.entries(prods).map(([k, v]: [string, any]) => ({ ...v, id: v.id || k }));
        
        const checkoutIds = new Set(
          (items || []).map((i: any) => String(i.id || i.productId || '').trim()).filter(Boolean)
        );
        const filtered = list.filter(p => p && p.id && !checkoutIds.has(String(p.id).trim()));
        if (isMounted) {
          setRelatedProducts(filtered.slice(0, 8));
        }
      } catch (err) {
        console.warn('Quick related products load notice:', err);
      } finally {
        if (isMounted) setLoadingRelated(false);
      }
    }, 150);

    return () => { 
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // Fetch product weights, vendor origin location, and COD availability in a single efficient pass
  useEffect(() => {
    let isMounted = true;
    const loadProductAndVendorDetails = async () => {
      if (!items || items.length === 0) {
        setItemsWithDetails([]);
        setIsCodAllowedByVendor(true);
        return;
      }

      let detectedVendorDistrict = '';
      let detectedVendorUpazila = '';
      const timeoutPromise = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      try {
        let allCodAllowed = true;
        let disabledVendor = '';

        const enriched = await Promise.all(items.map(async (item) => {
          let itemWeight = (item as any).rawWeight ?? (item as any).weight ?? ((item as any).specifications?.Weight || (item as any).specifications?.weight || (item as any).specifications?.['ওজন'] || (item as any).productWeight);
          let vId = (item as any).vendorId || (item as any).storeId || (item as any).vendor?.id || '';
          let pData: any = null;

          const prodId = (item as any).productId || (item.id && item.id.includes('_') ? item.id.split('_')[0] : item.id);
          if (prodId) {
            try {
              pData = await Promise.race([
                rtdbGet<any>(`products/${prodId}`),
                timeoutPromise(1800)
              ]);
              if (pData) {
                if (itemWeight === undefined || itemWeight === null || itemWeight === '') {
                  itemWeight = pData.weight ?? (pData.specifications?.Weight || pData.specifications?.weight || pData.specifications?.['ওজন'] || pData.specifications?.['ওজন (গ্রাম)'] || pData.productWeight);
                }
                if (!vId) {
                  vId = pData.vendorId || pData.storeId || pData.vendor?.id || pData.vendor?.vendorId || pData.vendor?.storeId || pData.userId || '';
                }
              }
            } catch (e) {
              // ignore
            }
          }

          // Authoritative vendor location resolution from vendors/, vendor_profiles/, stores/, and product data
          const authLoc = await resolveAuthoritativeVendorLocation(vId, pData || item);
          const isOfficialAdminHub = !vId || vId === 'admin' || vId === 'admin_hub' || (!vId && authLoc.source === 'admin_hub') || vId.toLowerCase() === 'official';
          const isMissing = !isOfficialAdminHub && authLoc.isMissing;

          // Comprehensive COD check across RTDB vendor nodes, product data, and authoritative location
          let itemCodAllowed = true;
          let itemVendorName = authLoc.storeName || (item as any).storeName || (item as any).vendorName || (item as any).vendor?.storeName || 'Vendor';

          // 1. Check authoritative location result
          if (authLoc.isCodEnabled === false) {
            itemCodAllowed = false;
          }

          // 2. Check product or cart item
          if ((pData && (pData.isCodEnabled === false || pData.codEnabled === false)) ||
              ((item as any).isCodEnabled === false || (item as any).codEnabled === false)) {
            itemCodAllowed = false;
          }

          // 3. For third-party vendors, directly query RTDB nodes to guarantee fresh real-time accuracy
          if (!isOfficialAdminHub && vId) {
            try {
              const [vSnap, pSnap, sSnap, uSnap] = await Promise.all([
                rtdbGet<any>(`vendors/${vId}`).catch(() => null),
                rtdbGet<any>(`vendor_profiles/${vId}`).catch(() => null),
                rtdbGet<any>(`stores/${vId}`).catch(() => null),
                rtdbGet<any>(`users/${vId}`).catch(() => null)
              ]);

              const testDisabled = (obj: any) => {
                if (!obj) return false;
                if (obj.isCodEnabled === false || obj.codEnabled === false) return true;
                if (obj.settings && (obj.settings.isCodEnabled === false || obj.settings.codEnabled === false)) return true;
                return false;
              };

              if (testDisabled(vSnap) || testDisabled(pSnap) || testDisabled(sSnap) || testDisabled(uSnap)) {
                itemCodAllowed = false;
              }

              const fetchedName = 
                vSnap?.storeName || vSnap?.shopName || vSnap?.name ||
                pSnap?.storeName || pSnap?.shopName ||
                sSnap?.storeName || sSnap?.name ||
                uSnap?.storeName || uSnap?.shopName || uSnap?.businessName || uSnap?.displayName;
              if (fetchedName) {
                itemVendorName = fetchedName;
              }
            } catch (err) {
              console.warn('Direct vendor COD check error:', err);
            }
          }

          if (!itemCodAllowed) {
            allCodAllowed = false;
            disabledVendor = itemVendorName;
          }

          if (!detectedVendorDistrict && !isMissing && authLoc.district) {
            detectedVendorDistrict = authLoc.district;
            detectedVendorUpazila = authLoc.upazila;
          }

          const resolvedStoreName = authLoc.storeName || (item as any).storeName || (item as any).vendorName || (item as any).vendor?.storeName || (isOfficialAdminHub ? 'RJ Official Hub' : `Vendor (${authLoc.district || 'Store'})`);

          const parsedW = parseProductWeight(itemWeight);

          return {
            ...item,
            rawWeight: itemWeight,
            weight: parsedW.weightKg,
            vendorId: vId || 'admin_hub',
            storeName: resolvedStoreName,
            vendorDistrict: isMissing ? '' : authLoc.district,
            vendorUpazila: isMissing ? '' : authLoc.upazila,
            vendorDivision: isMissing ? '' : authLoc.division,
            vendorLatitude: authLoc.latitude,
            vendorLongitude: authLoc.longitude,
            vendorLocationMissing: isMissing
          };
        }));

        if (!isMounted) return;

        setItemsWithDetails(prev => {
          if (prev && prev.length === enriched.length) {
            const isSame = prev.every((p, idx) => {
              const e = enriched[idx];
              return (
                p?.id === e?.id &&
                p?.quantity === e?.quantity &&
                p?.weight === e?.weight &&
                (p as any)?.rawWeight === (e as any)?.rawWeight &&
                p?.vendorId === e?.vendorId &&
                p?.storeName === e?.storeName &&
                p?.vendorDistrict === e?.vendorDistrict &&
                p?.vendorUpazila === e?.vendorUpazila &&
                p?.vendorLocationMissing === e?.vendorLocationMissing
              );
            });
            if (isSame) return prev;
          }
          return enriched;
        });

        setIsCodAllowedByVendor(prev => (prev === allCodAllowed ? prev : allCodAllowed));
        setDisabledCodVendorName(prev => (prev === disabledVendor ? prev : disabledVendor));
        if (!allCodAllowed) {
          setPaymentMethod(prev => (prev === 'cod' ? 'product_full_payment' : prev));
        }

        if (detectedVendorDistrict) {
          setVendorLocation(prev => {
            const targetUpazila = detectedVendorUpazila || `${detectedVendorDistrict} Sadar`;
            if (prev.district === detectedVendorDistrict && prev.upazila === targetUpazila) {
              return prev;
            }
            return {
              district: detectedVendorDistrict,
              upazila: targetUpazila
            };
          });
        }
      } catch (err) {
        console.warn('Item details load notice:', err);
      }
    };

    loadProductAndVendorDetails();
    return () => { isMounted = false; };
  }, [itemsKey]);

  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'product_full_payment' | 'only_delivery_charge' | 'wallet'>('cod');
  const [showOnlinePaymentModal, setShowOnlinePaymentModal] = useState<boolean>(false);
  const [showBkashModal, setShowBkashModal] = useState<boolean>(false);
  const [showNagadModal, setShowNagadModal] = useState<boolean>(false);
  const [showRocketModal, setShowRocketModal] = useState<boolean>(false);
  const [showUpayModal, setShowUpayModal] = useState<boolean>(false);
  const [selectedOnlineChannel, setSelectedOnlineChannel] = useState<'bkash' | 'nagad' | 'rocket' | 'upay' | null>(null);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string>('');
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string>(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let inv = 'S2N';
    for (let i = 0; i < 9; i++) {
      inv += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return inv;
  });
  const [isCodAllowedByVendor, setIsCodAllowedByVendor] = useState<boolean>(true);
  const [disabledCodVendorName, setDisabledCodVendorName] = useState<string>('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCouponInfo, setAppliedCouponInfo] = useState<{ code: string; percent?: number; discountAmount: number } | null>(null);
  const [discount, setDiscount] = useState(0);
  const [redirectingPaymentUrl, setRedirectingPaymentUrl] = useState<string | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  const preferredZoneFromState: DeliveryZone | undefined = 
    (location.state as any)?.preferredZone || 
    (safeStorage.getItem('preferred_shipping_zone') as DeliveryZone | null) || 
    undefined;

  const emptyAddress: Address = { 
    name: '', 
    mobile: '', 
    altPhone: '',
    email: '', 
    division: 'Dhaka', 
    district: 'Dhaka', 
    upazila: 'Dhaka Sadar / Kotwali', 
    area: '', 
    fullAddress: '', 
    additionalNotes: '',
    postalCode: '' 
  };
  
  const [shippingAddress, setShippingAddress] = useState<Address>(() => {
    try {
      const saved = safeStorage.getItem('last_shipping_address');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.name || parsed.mobile || parsed.district)) {
          return { ...emptyAddress, ...parsed };
        }
      }
    } catch (e) {
      // ignore
    }

    if (preferredZoneFromState === 'inside_dhaka') {
      return { ...emptyAddress, division: 'Dhaka', district: 'Dhaka', upazila: 'Dhaka Sadar / Kotwali' };
    } else if (preferredZoneFromState === 'dhaka_suburb') {
      return { ...emptyAddress, division: 'Dhaka', district: 'Dhaka', upazila: 'Savar' };
    }
    return { ...emptyAddress };
  });

  // Automatically prefill name and mobile from user profile if available
  useEffect(() => {
    if (userData) {
      const u = userData as any;
      setShippingAddress(prev => {
        const nextName = prev.name || u.name || u.displayName || '';
        const nextMobile = prev.mobile || u.phone || u.mobile || '';
        const nextDist = prev.district || u.district || 'Dhaka';
        const nextUpazila = prev.upazila || u.upazila || 'Dhaka Sadar / Kotwali';
        const nextDiv = prev.division || u.division || 'Dhaka';
        const nextFull = prev.fullAddress || u.address || '';

        if (
          prev.name === nextName &&
          prev.mobile === nextMobile &&
          prev.district === nextDist &&
          prev.upazila === nextUpazila &&
          prev.division === nextDiv &&
          prev.fullAddress === nextFull
        ) {
          return prev;
        }

        return {
          ...prev,
          name: nextName,
          mobile: nextMobile,
          district: nextDist,
          upazila: nextUpazila,
          division: nextDiv,
          fullAddress: nextFull
        };
      });
    }
  }, [userData?.name, userData?.phone, (userData as any)?.district, (userData as any)?.upazila, (userData as any)?.address]);

  const [showAddressModal, setShowAddressModal] = useState(false);

  const handleLocationSelected = (loc: SelectedAddressLocation) => {
    const distObj = getDistrictById(loc.district);
    setShippingAddress(prev => ({
      ...prev,
      district: loc.district,
      upazila: loc.upazila,
      division: distObj?.division || prev.division
    }));
    setShowAddressModal(false);
  };

  const selectedLocationProp = useMemo(() => ({
    district: shippingAddress.district,
    upazila: shippingAddress.upazila
  }), [shippingAddress.district, shippingAddress.upazila]);

  const selectedDistrictId = useMemo(() => {
    if (!shippingAddress.district) return '';
    const d = getDistrictById(shippingAddress.district);
    return d ? d.id : shippingAddress.district;
  }, [shippingAddress.district]);

  const availableUpazilas = useMemo(() => {
    if (!selectedDistrictId) return [];
    const districtObj = getDistrictById(selectedDistrictId);
    return districtObj ? districtObj.upazilas : [];
  }, [selectedDistrictId]);

  const selectedUpazilaId = useMemo(() => {
    if (!shippingAddress.upazila) return '';
    const clean = shippingAddress.upazila.replace(/\s*\(.*?\)/g, '').trim().toLowerCase();
    const match = availableUpazilas.find(
      u => u.id === shippingAddress.upazila || 
           u.name === shippingAddress.upazila || 
           u.id.toLowerCase() === clean ||
           u.name.toLowerCase().includes(clean)
    );
    return match ? match.id : shippingAddress.upazila;
  }, [shippingAddress.upazila, availableUpazilas]);

  const weightSummary: CartWeightDetailedSummary = useMemo(() => {
    const list = itemsWithDetails.length > 0 ? itemsWithDetails : items;
    return calculateCartTotalWeightDetailed(list);
  }, [itemsWithDetails, items]);

  // Dynamic Multi-Vendor and Weight-Based Shipping Calculation (Pathao Courier rules)
  const multiVendorShipping: MultiVendorShippingResult = useMemo(() => {
    const list = itemsWithDetails.length > 0 ? itemsWithDetails : items;
    return calculateMultiVendorShipping(
      list,
      {
        district: shippingAddress.district,
        upazila: shippingAddress.upazila,
        division: shippingAddress.division,
        area: shippingAddress.area
      },
      {
        paymentMethod: paymentMethod,
        fallbackZone: preferredZoneFromState,
        defaultVendorDistrict: vendorLocation.district,
        defaultVendorUpazila: vendorLocation.upazila
      }
    );
  }, [
    itemsWithDetails, 
    items, 
    shippingAddress.district, 
    shippingAddress.upazila, 
    shippingAddress.division, 
    shippingAddress.area, 
    paymentMethod, 
    preferredZoneFromState, 
    vendorLocation.district, 
    vendorLocation.upazila
  ]);

  const totalWeightKg = multiVendorShipping.totalWeightKg;
  const shippingCharge = multiVendorShipping.totalShippingFee;
  const codCharge = paymentMethod === 'cod' ? multiVendorShipping.totalCodCharge : 0;
  const platformFee = 5; // Fixed ৳5 platform fee on all orders
  const grandTotal = initialTotal + shippingCharge + codCharge + platformFee - discount;

  // Compatibility object for existing single-package handlers
  const deliveryCalc = useMemo(() => {
    const primaryPkg = multiVendorShipping.vendorPackages[0];
    return {
      deliveryCharge: shippingCharge,
      codCharge: codCharge,
      totalAmount: grandTotal,
      zone: primaryPkg ? (primaryPkg.routeType === 'inside_dhaka' ? 'inside_dhaka' : primaryPkg.routeType === 'dhaka_suburb' ? 'dhaka_suburb' : 'outside_dhaka') : 'outside_dhaka',
      weightKg: totalWeightKg,
      weightSlab: multiVendorShipping.weightSlab,
      weightSlabLabelBn: multiVendorShipping.weightSlabLabelBn,
      extraWeightKg: multiVendorShipping.extraWeightKg,
      extraWeightCharge: multiVendorShipping.extraWeightCharge,
      vendorLocation: primaryPkg ? primaryPkg.vendorLocation : vendorLocation,
      customerLocation: {
        district: shippingAddress.district,
        upazila: shippingAddress.upazila,
        division: shippingAddress.division,
        area: shippingAddress.area
      }
    };
  }, [
    multiVendorShipping, 
    shippingCharge, 
    codCharge, 
    grandTotal, 
    totalWeightKg, 
    vendorLocation.district, 
    vendorLocation.upazila, 
    shippingAddress.district, 
    shippingAddress.upazila, 
    shippingAddress.division, 
    shippingAddress.area
  ]);

  const handlePaymentSelect = (methodId: 'cod' | 'product_full_payment' | 'only_delivery_charge' | 'wallet') => {
    if (methodId === 'cod') {
      if (!isCodAllowedByVendor) {
        toast.error(disabledCodVendorName 
          ? `Cash on Delivery is turned OFF by seller (${disabledCodVendorName}). Please choose Online Payment.` 
          : 'Cash on Delivery is turned OFF by the vendor for these products. Please choose Online Payment.');
        return;
      }
      setPaymentMethod('cod');
    } else {
      setPaymentMethod(methodId);
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    try {
      // 1. Check if this code belongs to any product in the current cart/order (Vendor Product Discount Coupon)
      let productCouponFound = false;
      let totalCalculatedDiscount = 0;
      let matchedPercentage = 0;

      for (const item of items) {
        let pDiscountCode = (item as any).discountCode || (item as any).couponCode;
        let pDiscountPercent = (item as any).discountPercentage !== undefined && (item as any).discountPercentage !== null 
          ? Number((item as any).discountPercentage) 
          : ((item as any).discountPercent !== undefined ? Number((item as any).discountPercent) : null);

        // If not in item snapshot, fetch from product in RTDB
        if (!pDiscountCode && item.id) {
          try {
            const pData = await rtdbGet<any>(`products/${item.id}`);
            if (pData) {
              pDiscountCode = pData.discountCode || pData.couponCode;
              if (pData.discountPercentage !== undefined && pData.discountPercentage !== null) {
                pDiscountPercent = Number(pData.discountPercentage);
              } else if (pData.discountPercent !== undefined && pData.discountPercent !== null) {
                pDiscountPercent = Number(pData.discountPercent);
              }
            }
          } catch (pErr) {
            console.warn('Error checking product discount code:', pErr);
          }
        }

        if (pDiscountCode && String(pDiscountCode).trim().toUpperCase() === code && pDiscountPercent && pDiscountPercent > 0) {
          productCouponFound = true;
          matchedPercentage = pDiscountPercent;
          const itemTotal = Number(item.price) * Number(item.quantity);
          const itemDiscount = itemTotal * (pDiscountPercent / 100);
          totalCalculatedDiscount += itemDiscount;
        }
      }

      if (productCouponFound && totalCalculatedDiscount > 0) {
        const roundedDiscount = Math.round(totalCalculatedDiscount * 100) / 100;
        setDiscount(roundedDiscount);
        setAppliedCouponInfo({
          code,
          percent: matchedPercentage,
          discountAmount: roundedDiscount
        });
        toast.success(`Coupon ${code} applied! ${matchedPercentage}% discount applied (-৳${roundedDiscount.toFixed(2)})`);
        return;
      }

      // 2. Check general coupons collection in RTDB
      const coupons = await rtdbList<any>('coupons', (c) => c?.code?.toUpperCase() === code);
      if (coupons.length > 0) {
        const couponData = coupons[0].data;
        let calculated = 0;
        let pct: number | undefined = undefined;

        if (couponData.discountPercent || couponData.discountPercentage) {
          pct = Number(couponData.discountPercent || couponData.discountPercentage);
          calculated = initialTotal * (pct / 100);
        } else if (couponData.discountFixed) {
          calculated = Math.min(Number(couponData.discountFixed), initialTotal);
        } else {
          pct = 10;
          calculated = initialTotal * 0.1;
        }

        const roundedDiscount = Math.round(calculated * 100) / 100;
        setDiscount(roundedDiscount);
        setAppliedCouponInfo({
          code,
          percent: pct,
          discountAmount: roundedDiscount
        });
        toast.success(`Coupon ${code} applied successfully! (-৳${roundedDiscount.toFixed(2)})`);
      } else if (code === 'DARAZ10' || code === 'WELCOME10' || code === 'RJWORLD10') {
        const roundedDiscount = Math.round((initialTotal * 0.1) * 100) / 100;
        setDiscount(roundedDiscount);
        setAppliedCouponInfo({
          code,
          percent: 10,
          discountAmount: roundedDiscount
        });
        toast.success('Coupon applied successfully! 10% discount');
      } else {
        toast.error('Invalid or expired coupon code');
        setDiscount(0);
        setAppliedCouponInfo(null);
      }
    } catch (err) {
      if (code === 'DARAZ10' || code === 'WELCOME10' || code === 'RJWORLD10') {
        const roundedDiscount = Math.round((initialTotal * 0.1) * 100) / 100;
        setDiscount(roundedDiscount);
        setAppliedCouponInfo({
          code,
          percent: 10,
          discountAmount: roundedDiscount
        });
        toast.success('Coupon applied successfully! 10% discount');
      } else {
        toast.error('Invalid coupon code');
        setDiscount(0);
        setAppliedCouponInfo(null);
      }
    }
  };

  const handlePlaceOrder = async (
    e?: React.FormEvent, 
    chosenChannel?: 'bkash' | 'nagad' | 'rocket' | 'upay', 
    transactionIdInput?: string,
    verifiedDetails?: { isVerified?: boolean; isPending?: boolean; receivedAmount?: number; senderNumber?: string | null; verifiedAt?: number }
  ) => {
    if (e) e.preventDefault();
    if (!verifiedDetails && (loading || isSubmittingRef.current)) return;

    if (items.length === 0) {
      toast.error('আপনার কার্ট খালি রয়েছে');
      return;
    }

    if (!shippingAddress.name?.trim()) {
      toast.error('দয়া করে আপনার পুরো নাম লিখুন');
      return;
    }

    if (!shippingAddress.mobile?.trim() || shippingAddress.mobile.replace(/\D/g, '').length < 10) {
      toast.error('দয়া করে সঠিক মোবাইল নম্বর দিন (কমপক্ষে ১১ ডিজিট)');
      return;
    }

    if (!shippingAddress.district?.trim()) {
      toast.error('দয়া করে জেলা নির্বাচন করুন');
      return;
    }

    if (!shippingAddress.upazila?.trim()) {
      toast.error('দয়া করে থানা / উপজেলা নির্বাচন করুন');
      return;
    }

    const effectiveAddress = (shippingAddress.area || shippingAddress.fullAddress || '').trim();
    if (!effectiveAddress) {
      toast.error('দয়া করে এলাকা, গ্রাম বা বাড়ির নং লিখুন');
      return;
    }

    if (multiVendorShipping.isVendorLocationMissing) {
      toast.error('ভেন্ডর স্টোর লোকেশন অনুপস্থিত। সঠিক ডেলিভারি চার্জ নির্ধারণ করতে ভেন্ডরের আসল লোকেশন প্রয়োজন।');
      return;
    }

    if (paymentMethod === 'cod' && !isCodAllowedByVendor) {
      toast.error(disabledCodVendorName 
        ? `${disabledCodVendorName}-এর পণ্যের জন্য ক্যাশ অন ডেলিভারি বন্ধ। অনুগ্রহ করে অনলাইন পেমেন্ট বেছে নিন।` 
        : 'এই পণ্যের জন্য ক্যাশ অন ডেলিভারি প্রযোজ্য নয়। অনুগ্রহ করে অনলাইন পেমেন্ট বেছে নিন।');
      return;
    }

    // Generate Invoice ID if not already created
    if (!currentInvoiceId) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let inv = 'S2N';
      for (let i = 0; i < 9; i++) {
        inv += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setCurrentInvoiceId(inv);
    }

    // If online payment and no channel chosen yet from the selection modal, open the modal
    if ((paymentMethod === 'product_full_payment' || paymentMethod === 'only_delivery_charge') && !chosenChannel) {
      setShowOnlinePaymentModal(true);
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const referralId = safeStorage.getItem('referralId');
      
      const cleanItems = items.map(item => {
        const pId = item.id || item.productId;
        const chosenColor = item.selectedColor || item.color || null;
        const chosenSize = item.selectedSize || item.size || null;
        const chosenSku = item.variantSku || item.sku || null;
        const chosenVariantId = item.variantId || null;
        const chosenStoreId = item.vendorId || item.storeId || 'admin';
        const rawVendorPrice = item.vendorPrice !== undefined 
          ? Number(item.vendorPrice) 
          : (item.adminPrice !== undefined ? Number(item.adminPrice) : (item.price !== undefined ? Number(item.price) : undefined));
        const rawSellingPrice = item.resellerSellingPrice !== undefined 
          ? Number(item.resellerSellingPrice) 
          : (item.price !== undefined ? Number(item.price) : undefined);
        const itemQty = Math.max(1, Number(item.quantity) || 1);
        const calcUnitProfit = (rawVendorPrice !== undefined && rawSellingPrice !== undefined)
          ? Math.max(0, Number((rawSellingPrice - rawVendorPrice).toFixed(2)))
          : (item.unitProfit !== undefined ? Number(item.unitProfit) : undefined);
        const calcResellerProfit = (rawVendorPrice !== undefined && rawSellingPrice !== undefined)
          ? Math.max(0, Number(((rawSellingPrice - rawVendorPrice) * itemQty).toFixed(2)))
          : (item.resellerProfit !== undefined ? Number(item.resellerProfit) : undefined);

        const cleanItem: any = {
          ...item,
          productId: pId,
          productName: item.name || item.productName,
          name: item.name || item.productName,
          quantity: itemQty,
          selectedColor: chosenColor,
          color: chosenColor,
          selectedSize: chosenSize,
          size: chosenSize,
          variantId: chosenVariantId,
          variantSku: chosenSku,
          sku: chosenSku,
          vendorId: chosenStoreId,
          storeId: chosenStoreId,
          image: item.image || item.featuredImage || '',
          vendorPrice: rawVendorPrice,
          resellerSellingPrice: rawSellingPrice,
          unitProfit: calcUnitProfit,
          resellerProfit: calcResellerProfit,
          customerPaidAmount: rawSellingPrice !== undefined ? Number((rawSellingPrice * itemQty).toFixed(2)) : undefined,
          priceSnapshot: item.priceSnapshot || (rawVendorPrice !== undefined && rawSellingPrice !== undefined ? {
            vendorPrice: rawVendorPrice,
            resellerSellingPrice: rawSellingPrice,
            unitProfit: calcUnitProfit || 0,
            resellerProfit: calcResellerProfit || 0,
            quantity: itemQty,
            capturedAt: Date.now()
          } : undefined),
          isResellerItem: item.isResellerItem || Boolean(item.resellerSellingPrice && item.vendorPrice && item.resellerSellingPrice > item.vendorPrice)
        };
        Object.keys(cleanItem).forEach(key => {
          if (cleanItem[key] === undefined) {
            delete cleanItem[key];
          }
        });
        return cleanItem;
      });

      // Detect if this is a Reseller Order (strictly isolated to reseller account or reseller products)
      const isResellerAccount = Boolean(
        userData?.accountType?.toLowerCase() === 'reseller' ||
        userData?.role?.toLowerCase() === 'reseller' ||
        userData?.hasActiveReseller === true
      );
      const containsResellerPricing = cleanItems.some(it => 
        Boolean(it.priceSnapshot || (it.resellerSellingPrice && it.vendorPrice && it.resellerSellingPrice > it.vendorPrice) || (it.resellerProfit && it.resellerProfit > 0) || it.isResellerItem)
      );
      const isResellerOrder = isResellerAccount || containsResellerPricing;
      const effectiveResellerId = isResellerAccount 
        ? user?.uid 
        : (cleanItems.find(it => it.referralId || it.resellerId)?.referralId || referralId || user?.uid || null);

      let resellerOrderRecord: ResellerOrderRecord | null = null;
      if (isResellerOrder && effectiveResellerId) {
        resellerOrderRecord = buildResellerPriceSnapshot(
          orderId,
          effectiveResellerId,
          cleanItems,
          {
            status: 'Confirmed',
            paymentMethod: paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : paymentMethod,
            customerId: user?.uid || 'guest',
            shippingAddress
          }
        );
      }
      
      // Calculate vendor items mapping for held payout
      const vendorItemsMap: Record<string, { items: any[]; total: number }> = {};
      cleanItems.forEach(it => {
        const vId = it.vendorId || 'admin';
        if (!vendorItemsMap[vId]) {
          vendorItemsMap[vId] = { items: [], total: 0 };
        }
        vendorItemsMap[vId].items.push(it);
        vendorItemsMap[vId].total += (it.price || 0) * (it.quantity || 1);
      });

      let finalPaymentStatus = 'Pending';
      let finalOrderStatus = 'Confirmed';
      let verifiedTransactionId: string | null = transactionIdInput || null;
      let verifiedPaymentId: string | null = null;
      let paidAtTimestamp: number | null = null;
      let walletPaymentData: any = null;
      let redirectGatewayUrl: string | null = null;

      // 1. RJ WORLD BD WALLET PAYMENT
      if (paymentMethod === 'wallet') {
        if (!user || user.uid === 'guest') {
          toast.error('Please log in to your account to pay with RJ WORLD BD Wallet');
          setLoading(false);
          return;
        }

        // Fetch fresh wallet balance directly from Realtime Database
        const uData = await rtdbGet<any>(`users/${user.uid}`) || {};
        const currentBalance = typeof uData.wallet === 'number' 
          ? uData.wallet 
          : (typeof uData.balance === 'number' ? uData.balance : (userData?.wallet ?? userData?.balance ?? 0));

        if (currentBalance < grandTotal) {
          toast.error('Insufficient RJ WORLD BD Wallet Balance');
          setLoading(false);
          return;
        }

        const previousBalance = currentBalance;
        const newBalance = Number((previousBalance - grandTotal).toFixed(2));
        const transactionId = `TXN-WLT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const timestamp = Date.now();

        // 1. Record in wallet_transactions
        await rtdbSet(`wallet_transactions/${transactionId}`, {
          id: transactionId,
          transactionId,
          userId: user.uid,
          orderId,
          amount: grandTotal,
          previousBalance,
          newBalance,
          type: 'debit',
          category: 'order_payment',
          paymentMethod: 'RJ WORLD BD',
          description: `Payment for Order #${orderId}`,
          status: 'Success',
          timestamp,
          createdAt: timestamp,
          updatedAt: timestamp
        });

        // 2. Update users document
        await rtdbUpdate(`users/${user.uid}`, {
          wallet: newBalance,
          balance: newBalance,
          updatedAt: timestamp
        });

        // 3. Update user_wallet document
        try {
          const uwData = await rtdbGet<any>(`user_wallet/${user.uid}`);
          if (uwData) {
            await rtdbUpdate(`user_wallet/${user.uid}`, {
              walletBalance: newBalance,
              updatedAt: timestamp
            });
          } else {
            await rtdbSet(`user_wallet/${user.uid}`, {
              userId: user.uid,
              walletBalance: newBalance,
              lockedBonus: 0,
              createdAt: timestamp,
              updatedAt: timestamp
            });
          }
        } catch (wErr) {
          console.warn('Failed to sync user_wallet doc:', wErr);
        }

        // 4. Update local state & refresh Auth context
        setUserWalletBalance(newBalance);
        if (refreshUserData) {
          refreshUserData().catch(() => {});
        }

        finalPaymentStatus = 'Paid';
        finalOrderStatus = 'Confirmed';
        verifiedTransactionId = transactionId;
        paidAtTimestamp = timestamp;
        walletPaymentData = {
          userId: user.uid,
          orderId,
          amount: grandTotal,
          previousBalance,
          newBalance,
          transactionId,
          timestamp
        };
      }

      // 2. CASH ON DELIVERY
      else if (paymentMethod === 'cod') {
        finalPaymentStatus = 'Pending';
        finalOrderStatus = 'Confirmed';
      }

      // 3. ONLINE PAYMENT (Product Full Payment or Only Delivery Charge)
      else if (paymentMethod === 'product_full_payment' || paymentMethod === 'only_delivery_charge') {
        if (verifiedDetails?.isVerified) {
          finalPaymentStatus = 'Paid';
          finalOrderStatus = 'Confirmed';
          verifiedTransactionId = transactionIdInput || null;
          paidAtTimestamp = verifiedDetails.verifiedAt || Date.now();
        } else {
          finalPaymentStatus = 'Pending';
          finalOrderStatus = 'Confirmed';
        }
      }

      const orderData: any = {
        orderId,
        userId: user?.uid || 'guest',
        customerId: user?.uid || 'guest',
        items: cleanItems,
        itemsTotal: initialTotal,
        subtotal: initialTotal,
        deliveryCharge: shippingCharge,
        shippingCharge: shippingCharge,
        codCharge: codCharge,
        platformFee: 5,
        totalWeightKg: totalWeightKg,
        weightSlab: deliveryCalc.weightSlab,
        weightSlabLabelBn: deliveryCalc.weightSlabLabelBn,
        extraWeightKg: deliveryCalc.extraWeightKg,
        extraWeightCharge: deliveryCalc.extraWeightCharge,
        deliveryZone: deliveryCalc.zone,
        vendorLocation: deliveryCalc.vendorLocation,
        shippingMethod: 'pathao_multi_vendor_dynamic',
        shippingSnapshot: {
          calculatedAt: Date.now(),
          shippingEngine: 'pathao_multi_vendor_dynamic',
          totalShippingFee: multiVendorShipping.totalShippingFee,
          totalWeightKg: multiVendorShipping.totalWeightKg,
          totalCodCharge: multiVendorShipping.totalCodCharge,
          platformFee: 5,
          customerDeliveryLocation: {
            district: shippingAddress.district,
            upazila: shippingAddress.upazila,
            division: shippingAddress.division,
            area: shippingAddress.area || '',
            address: shippingAddress.fullAddress
          },
          vendorPackages: multiVendorShipping.vendorPackages.map(pkg => ({
            vendorId: pkg.vendorId,
            storeName: pkg.storeName,
            vendorLocation: pkg.vendorLocation,
            customerLocation: pkg.customerLocation,
            routeType: pkg.routeType,
            routeLabelEn: pkg.routeLabelEn,
            routeLabelBn: pkg.routeLabelBn,
            estimatedDays: pkg.estimatedDays,
            packageWeightKg: pkg.packageWeightKg,
            weightSlab: pkg.weightSlab,
            weightSlabLabelBn: pkg.weightSlabLabelBn,
            baseCharge: pkg.baseCharge,
            extraKgCount: pkg.extraKgCount,
            extraKgRate: pkg.extraKgRate,
            extraWeightCharge: pkg.extraWeightCharge,
            shippingFee: pkg.shippingFee,
            codCharge: pkg.codCharge,
            items: pkg.items
          }))
        },
        total: grandTotal,
        grandTotal: grandTotal,
        discount: discount,
        appliedCoupon: appliedCouponInfo ? appliedCouponInfo.code : (couponCode.trim() ? couponCode.trim().toUpperCase() : null),
        appliedCouponPercent: appliedCouponInfo?.percent || null,
        status: finalOrderStatus,
        createdAt: Date.now(),
        customerName: shippingAddress.name,
        customerPhone: shippingAddress.mobile,
        customerAltPhone: shippingAddress.altPhone || '',
        customerEmail: shippingAddress.email || '',
        district: shippingAddress.district,
        upazila: shippingAddress.upazila,
        area: shippingAddress.area || '',
        fullAddress: shippingAddress.fullAddress,
        additionalNotes: shippingAddress.additionalNotes || '',
        advancePaymentAmount:
          paymentMethod === 'product_full_payment' || paymentMethod === 'wallet'
            ? grandTotal
            : paymentMethod === 'only_delivery_charge'
            ? shippingCharge
            : (verifiedDetails?.receivedAmount ? verifiedDetails.receivedAmount : 0),
        paidAmount:
          paymentMethod === 'product_full_payment' || paymentMethod === 'wallet'
            ? grandTotal
            : paymentMethod === 'only_delivery_charge'
            ? shippingCharge
            : (verifiedDetails?.receivedAmount ? verifiedDetails.receivedAmount : 0),
        advanceAmount:
          paymentMethod === 'product_full_payment' || paymentMethod === 'wallet'
            ? grandTotal
            : paymentMethod === 'only_delivery_charge'
            ? shippingCharge
            : (verifiedDetails?.receivedAmount ? verifiedDetails.receivedAmount : 0),
        advancePaymentType:
          paymentMethod === 'product_full_payment' || paymentMethod === 'wallet'
            ? 'full'
            : paymentMethod === 'only_delivery_charge'
            ? 'delivery_charge'
            : (verifiedDetails?.receivedAmount && verifiedDetails.receivedAmount >= grandTotal ? 'full' : 'none'),
        codAmount:
          paymentMethod === 'product_full_payment' || paymentMethod === 'wallet'
            ? 0
            : paymentMethod === 'only_delivery_charge'
            ? Math.max(0, grandTotal - shippingCharge)
            : (verifiedDetails?.receivedAmount ? Math.max(0, grandTotal - verifiedDetails.receivedAmount) : grandTotal),
        shippingAddress,
        paymentMethod: paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : paymentMethod,
        paymentStatus: finalPaymentStatus,
        paymentGateway: paymentMethod === 'product_full_payment' 
          ? `Online Payment - Product Full Payment${chosenChannel ? ` (${chosenChannel.toUpperCase()} Personal)` : ''}` 
          : paymentMethod === 'only_delivery_charge' 
          ? `Online Payment - Only Delivery Charge${chosenChannel ? ` (${chosenChannel.toUpperCase()} Personal)` : ''}` 
          : paymentMethod === 'wallet' 
          ? 'RJ Wallet' 
          : 'Cash on Delivery (COD)',
        vendorPayoutStatus: paymentMethod === 'cod' ? 'None' : (finalPaymentStatus === 'Paid' ? 'Held' : 'Pending Payment'),
        autoReleaseAt: paymentMethod !== 'cod' && finalPaymentStatus === 'Paid' 
          ? (paidAtTimestamp || Date.now()) + (96 * 60 * 60 * 1000) 
          : null,
        vendorIds: Object.keys(vendorItemsMap).filter(v => v && v !== 'admin'),
        referralId: referralId || null,
        invoiceId: currentInvoiceId || null,
        isResellerOrder: Boolean(resellerOrderRecord),
        resellerId: resellerOrderRecord ? resellerOrderRecord.resellerId : null,
        vendorId: resellerOrderRecord ? resellerOrderRecord.vendorId : (cleanItems[0]?.vendorId || 'admin'),
        productId: resellerOrderRecord ? resellerOrderRecord.productId : (cleanItems[0]?.productId || ''),
        quantity: resellerOrderRecord ? resellerOrderRecord.quantity : (cleanItems.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0)),
        vendorPrice: resellerOrderRecord ? resellerOrderRecord.vendorPrice : null,
        resellerSellingPrice: resellerOrderRecord ? resellerOrderRecord.resellerSellingPrice : null,
        customerPaidAmount: resellerOrderRecord ? resellerOrderRecord.customerPaidAmount : grandTotal,
        resellerProfit: resellerOrderRecord ? resellerOrderRecord.resellerProfit : null,
        profitStatus: resellerOrderRecord ? 'PENDING' : null,
        orderStatus: finalOrderStatus,
        resellerPriceSnapshot: resellerOrderRecord || null
      };

      if (verifiedTransactionId) {
        orderData.transactionId = verifiedTransactionId;
      }
      if (verifiedPaymentId) {
        orderData.paymentId = verifiedPaymentId;
      }
      if (paidAtTimestamp) {
        orderData.paidAt = paidAtTimestamp;
      }
      if (walletPaymentData) {
        orderData.walletPaymentDetails = walletPaymentData;
      }

      // Save order to Realtime Database, Cloud Firestore, and localStorage
      try {
        await saveOrderToDatabases(orderId, orderData);
      } catch (fErr) {
        console.warn('Orders write notice:', fErr);
      }

      // Always save pending order and address locally for instant recovery
      try {
        safeStorage.setItem('pending_order_' + orderId, JSON.stringify(orderData));
        safeStorage.setItem('last_shipping_address', JSON.stringify(shippingAddress));
      } catch (stErr) {
        console.warn('Storage save notice:', stErr);
      }

      // Clear cart immediately
      if (!buyNowItem) {
        clearCart();
      }

      // Record payments in RTDB
      try {
        await rtdbSet(`payments/${orderId}`, {
          paymentId: `PAY-${orderId}`,
          orderId,
          invoiceId: orderId,
          userId: user?.uid || 'guest',
          userType: userData?.role?.toLowerCase() || 'customer',
          paymentMethod: paymentMethod.toLowerCase(),
          expectedAmount: grandTotal,
          receivedAmount: finalPaymentStatus === 'Paid' ? grandTotal : 0,
          transactionId: verifiedTransactionId || '',
          status: finalPaymentStatus === 'Paid' ? 'verified' : (finalPaymentStatus === 'Failed' ? 'rejected' : 'pending'),
          senderNumber: shippingAddress.mobile || '',
          verifiedAt: finalPaymentStatus === 'Paid' ? Date.now() : null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      } catch (payErr) {
        console.warn('Payments record write notice:', payErr);
      }

      // Record orderItems in RTDB with full variant details
      try {
        for (const item of cleanItems) {
          const varSuffix = item.variantId 
            ? `_${item.variantId}` 
            : (item.color || item.size ? `_${encodeURIComponent(item.color || '')}_${encodeURIComponent(item.size || '')}` : '');
          const itemId = `${orderId}_${item.id || item.productId}${varSuffix}`;
          await rtdbSet(`orderItems/${itemId}`, {
            id: itemId,
            orderId,
            productId: item.id || item.productId,
            name: item.name,
            productName: item.name,
            price: item.price,
            quantity: item.quantity,
            vendorId: item.vendorId || item.storeId || 'admin',
            storeId: item.storeId || item.vendorId || 'admin',
            image: item.image || item.featuredImage || '',
            selectedColor: item.selectedColor || item.color || null,
            selectedSize: item.selectedSize || item.size || null,
            color: item.selectedColor || item.color || null,
            size: item.selectedSize || item.size || null,
            variantId: item.variantId || null,
            variantSku: item.variantSku || item.sku || null,
            sku: item.variantSku || item.sku || null,
            total: (item.price || 0) * (item.quantity || 1),
            vendorPrice: item.vendorPrice ?? null,
            resellerSellingPrice: item.resellerSellingPrice ?? null,
            unitProfit: item.unitProfit ?? null,
            resellerProfit: item.resellerProfit ?? null,
            priceSnapshot: item.priceSnapshot ?? null,
            createdAt: Date.now()
          });
        }
      } catch (oiErr) {
        console.warn('orderItems record write notice:', oiErr);
      }

      // Deduct stock in RTDB targeting the specific variant
      try {
        for (const item of cleanItems) {
          const pId = item.id || item.productId;
          if (!pId) continue;
          const qty = Number(item.quantity) || 1;
          const currentProd = await rtdbGet<any>(`products/${pId}`);
          if (!currentProd) continue;

          let updatedVariants = currentProd.variants;
          let variantFound = false;

          if (item.variantId && updatedVariants) {
            if (Array.isArray(updatedVariants)) {
              updatedVariants = updatedVariants.map((v: any) => {
                if (v.id === item.variantId) {
                  variantFound = true;
                  const curStock = Number(v.stock) || 0;
                  return { ...v, stock: Math.max(0, curStock - qty) };
                }
                return v;
              });
            } else if (typeof updatedVariants === 'object') {
              for (const [vKey, vVal] of Object.entries(updatedVariants as Record<string, any>)) {
                if (vVal.id === item.variantId || vKey === item.variantId) {
                  variantFound = true;
                  const curStock = Number(vVal.stock) || 0;
                  updatedVariants[vKey] = { ...vVal, stock: Math.max(0, curStock - qty) };
                }
              }
            }
          } else if ((item.selectedColor || item.selectedSize || item.color || item.size) && updatedVariants) {
            const itmColor = (item.selectedColor || item.color || '').toLowerCase();
            const itmSize = (item.selectedSize || item.size || '').toLowerCase();
            if (Array.isArray(updatedVariants)) {
              updatedVariants = updatedVariants.map((v: any) => {
                const cMatch = !itmColor || (v.colorName && v.colorName.toLowerCase() === itmColor);
                const sMatch = !itmSize || (v.sizeName && v.sizeName.toLowerCase() === itmSize);
                if (cMatch && sMatch && !variantFound) {
                  variantFound = true;
                  const curStock = Number(v.stock) || 0;
                  return { ...v, stock: Math.max(0, curStock - qty) };
                }
                return v;
              });
            }
          }

          // Calculate new overall product stock
          let newProductStock: number | undefined = undefined;
          if (variantFound && updatedVariants) {
            const varList = Array.isArray(updatedVariants) ? updatedVariants : Object.values(updatedVariants);
            newProductStock = varList.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
          } else if (currentProd.stockCount !== undefined || currentProd.stock !== undefined) {
            const curStock = Number(currentProd.stockCount ?? currentProd.stock ?? 0);
            newProductStock = Math.max(0, curStock - qty);
          }

          const prodUpdates: any = {};
          if (variantFound && updatedVariants) {
            prodUpdates.variants = updatedVariants;
          }
          if (newProductStock !== undefined) {
            prodUpdates.stock = newProductStock;
            prodUpdates.stockCount = newProductStock;
            prodUpdates.inStock = newProductStock > 0;
          }

          if (Object.keys(prodUpdates).length > 0) {
            await rtdbUpdate(`products/${pId}`, prodUpdates);
          }
        }
      } catch (stockErr) {
        console.warn('Stock deduction notice:', stockErr);
      }

      // Always save pending order to local storage backup
      safeStorage.setItem(`pending_order_${orderId}`, JSON.stringify(orderData));

      // Create vendor_orders and track held balance in vendor_wallet (for COD / Wallet / Online confirmed orders)
      try {
        for (const [vId, vData] of Object.entries(vendorItemsMap)) {
          if (vId && vId !== 'admin') {
            const vOrderDocId = `${orderId}_${vId}`;
            const vPkg = multiVendorShipping.vendorPackages.find(p => p.vendorId === vId);
            const vPkgShippingFee = vPkg ? vPkg.shippingFee : shippingCharge;
            const vPkgWeightKg = vPkg ? vPkg.packageWeightKg : totalWeightKg;
            const vPkgCodCharge = vPkg ? vPkg.codCharge : codCharge;

            const vDeliveryCharge = vPkgShippingFee || 0;
            const vGrandTotal = vData.total + vDeliveryCharge;
            const isFullAdvance = paymentMethod === 'product_full_payment' || paymentMethod === 'wallet' || (verifiedDetails?.receivedAmount && verifiedDetails.receivedAmount >= grandTotal);
            const isDeliveryOnly = paymentMethod === 'only_delivery_charge';
            const vAdvanceAmount = isFullAdvance ? vGrandTotal : (isDeliveryOnly ? vDeliveryCharge : 0);
            const vCodAmount = isFullAdvance ? 0 : Math.max(0, vGrandTotal - vAdvanceAmount);

            // Compute reseller metadata and line profit for this specific vendor's order package
            const vItems = vData.items;
            let vResellerProfit = 0;
            let vPriceSnapshot: any = null;

            if (isResellerOrder && effectiveResellerId) {
              const vSnapshots = vItems.map((it: any) => {
                const vp = Number(it.vendorPrice ?? it.adminPrice ?? it.price ?? 0);
                const sp = Number(it.resellerSellingPrice ?? it.price ?? vp);
                const qty = Math.max(1, Number(it.quantity) || 1);
                const prof = Math.max(0, (sp - vp) * qty);
                vResellerProfit += prof;
                return {
                  productId: it.productId || it.id || '',
                  productName: it.name || it.productName || 'Product',
                  quantity: qty,
                  vendorPrice: vp,
                  resellerSellingPrice: sp,
                  customerPaidAmount: sp * qty,
                  resellerProfit: prof
                };
              });

              vPriceSnapshot = {
                orderId,
                resellerId: effectiveResellerId,
                vendorId: vId,
                productId: vItems[0]?.productId || '',
                productName: vItems[0]?.name || vItems[0]?.productName || 'Product',
                quantity: vItems.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0),
                vendorPrice: Number(vItems[0]?.vendorPrice ?? vItems[0]?.adminPrice ?? vItems[0]?.price ?? 0),
                resellerSellingPrice: Number(vItems[0]?.resellerSellingPrice ?? vItems[0]?.price ?? 0),
                customerPaidAmount: vItems.reduce((acc: number, it: any) => acc + ((Number(it.resellerSellingPrice ?? it.price ?? 0)) * (Number(it.quantity) || 1)), 0),
                resellerProfit: vResellerProfit,
                profitStatus: 'PENDING',
                orderStatus: finalOrderStatus,
                paymentMethod: paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : paymentMethod,
                items: vSnapshots,
                createdAt: Date.now(),
                updatedAt: Date.now()
              };
            }

            await rtdbSet(`vendor_orders/${vOrderDocId}`, {
              id: vOrderDocId,
              orderId,
              mainOrderId: orderId,
              vendorId: vId,
              customerId: user?.uid || 'guest',
              customerName: shippingAddress.name,
              customerPhone: shippingAddress.mobile,
              customerAltPhone: shippingAddress.altPhone || '',
              customerEmail: shippingAddress.email || '',
              district: shippingAddress.district,
              upazila: shippingAddress.upazila,
              area: shippingAddress.area || '',
              fullAddress: shippingAddress.fullAddress,
              additionalNotes: shippingAddress.additionalNotes || '',
              items: vData.items,
              itemsCount: vData.items.length,
              itemsPrice: vData.total,
              subtotal: vData.total,
              deliveryCharge: vDeliveryCharge,
              shippingCharge: vDeliveryCharge,
              grandTotal: vGrandTotal,
              advancePaymentAmount: paymentMethod === 'cod' ? 0 : vAdvanceAmount,
              paidAmount: paymentMethod === 'cod' ? 0 : vAdvanceAmount,
              advanceAmount: paymentMethod === 'cod' ? 0 : vAdvanceAmount,
              advancePaymentType:
                paymentMethod === 'cod'
                  ? 'none'
                  : isFullAdvance
                  ? 'full'
                  : isDeliveryOnly
                  ? 'delivery_charge'
                  : 'none',
              codAmount: paymentMethod === 'cod' ? vGrandTotal : vCodAmount,
              vendorPayoutAmount: paymentMethod === 'cod' ? 0 : (finalPaymentStatus === 'Paid' ? vAdvanceAmount : 0),
              vendorPayoutStatus: paymentMethod === 'cod' ? 'None' : (finalPaymentStatus === 'Paid' ? 'Held' : 'Pending Payment'),
              autoReleaseAt: paymentMethod !== 'cod' && finalPaymentStatus === 'Paid' 
                ? (paidAtTimestamp || Date.now()) + (96 * 60 * 60 * 1000) 
                : null,
              status: finalOrderStatus,
              orderStatus: finalOrderStatus,
              paymentMethod: paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : paymentMethod,
              paymentStatus: finalPaymentStatus,
              transactionId: verifiedTransactionId || null,
              isResellerOrder: Boolean(isResellerOrder && effectiveResellerId),
              resellerId: (isResellerOrder && effectiveResellerId) ? effectiveResellerId : null,
              productId: vItems[0]?.productId || vItems[0]?.id || '',
              quantity: vItems.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0),
              vendorPrice: Number(vItems[0]?.vendorPrice ?? vItems[0]?.adminPrice ?? vItems[0]?.price ?? 0),
              resellerSellingPrice: Number(vItems[0]?.resellerSellingPrice ?? vItems[0]?.price ?? 0),
              customerPaidAmount: vItems.reduce((acc: number, it: any) => acc + ((Number(it.resellerSellingPrice ?? it.price ?? 0)) * (Number(it.quantity) || 1)), 0),
              resellerProfit: (isResellerOrder && effectiveResellerId) ? vResellerProfit : 0,
              profitStatus: (isResellerOrder && effectiveResellerId) ? 'PENDING' : null,
              priceSnapshot: vPriceSnapshot,
              shippingAddress: {
                ...shippingAddress,
                district: shippingAddress.district,
                upazila: shippingAddress.upazila,
                area: shippingAddress.area || '',
                fullAddress: shippingAddress.fullAddress,
                altPhone: shippingAddress.altPhone || '',
                additionalNotes: shippingAddress.additionalNotes || ''
              },
              codCharge: vPkgCodCharge,
              platformFee: 5,
              totalWeightKg: vPkgWeightKg,
              weightSlab: vPkg ? vPkg.weightSlab : deliveryCalc.weightSlab,
              weightSlabLabelBn: vPkg ? vPkg.weightSlabLabelBn : deliveryCalc.weightSlabLabelBn,
              extraWeightKg: vPkg ? vPkg.extraKgCount : deliveryCalc.extraWeightKg,
              extraWeightCharge: vPkg ? vPkg.extraWeightCharge : deliveryCalc.extraWeightCharge,
              deliveryZone: vPkg ? vPkg.routeType : deliveryCalc.zone,
              vendorLocation: vPkg ? vPkg.vendorLocation : deliveryCalc.vendorLocation,
              packageBreakdown: vPkg || null,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });

            // Update vendor wallet pendingBalance (Held) ONLY for verified successful online payments!
            if (paymentMethod !== 'cod' && finalPaymentStatus === 'Paid' && vAdvanceAmount > 0) {
              const curW = await rtdbGet<any>(`vendor_wallet/${vId}`);
              if (curW) {
                await rtdbUpdate(`vendor_wallet/${vId}`, {
                  pendingBalance: (curW.pendingBalance || 0) + vAdvanceAmount,
                  updatedAt: Date.now()
                });
              } else {
                await rtdbSet(`vendor_wallet/${vId}`, {
                  vendorId: vId,
                  balance: 0,
                  pendingBalance: vAdvanceAmount,
                  lifetimeEarnings: 0,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                });
              }
            }

            // Send real-time notification to the vendor
            notifyVendorNewOrder(
              vId,
              orderId,
              shippingAddress.name || 'সম্মানিত গ্রাহক',
              vData.total,
              vData.items.length
            ).catch(e => console.warn('Vendor notif failed:', e));
          }
        }

        // Persist Reseller Order Pending Profit record (zero wallet balance deduction/locking)
        if (resellerOrderRecord) {
          try {
            await saveResellerOrderRecord(resellerOrderRecord);
          } catch (rErr) {
            console.warn('[CheckoutPage] Reseller pending profit persistence warning:', rErr);
          }
        }
      } catch (err) {
        console.warn('Error recording vendor order hold', err);
      }

      // If SofolX online payment redirect
      if (redirectGatewayUrl) {
        if (!buyNowItem) {
          clearCart();
        }
        toast.success('Redirecting to SofolX Payment Gateway...');
        setRedirectingPaymentUrl(redirectGatewayUrl);
        setLoading(false);
        isSubmittingRef.current = false;

        try {
          if (window.top && window.top !== window) {
            window.top.location.href = redirectGatewayUrl;
            return;
          }
        } catch (frameErr) {
          console.warn('Top navigation fallback:', frameErr);
        }

        window.location.assign(redirectGatewayUrl);
        return;
      }

      // Track eligible sales for bonus unlocking
      if (user && user.uid !== 'guest') {
        try {
          const wData = await rtdbGet<any>(`user_wallet/${user.uid}`);
          if (wData) {
            if (wData.lockedBonus === 50 && !wData.bonusClaimed) {
              const currentSales = (wData.bonusEligibleSales || 0) + 1;
              if (currentSales >= 10) {
                await rtdbUpdate(`user_wallet/${user.uid}`, {
                  bonusEligibleSales: currentSales,
                  lockedBonus: 0,
                  bonusClaimed: true,
                  walletBalance: (wData.walletBalance || 0) + 50,
                  approvedCommission: (wData.approvedCommission || 0) + 50
                });
              } else {
                await rtdbUpdate(`user_wallet/${user.uid}`, {
                  bonusEligibleSales: currentSales
                });
              }
            }
          }
        } catch(e) {
          console.error("Failed to update eligible sales tracking", e);
        }
      }
      
      // MLM Product Sales Commission Logic (Calculated per 1000 BDT)
      let directSellerId = null;
      if (isReseller && user) {
        directSellerId = user.uid;
      } else if (referralId) {
        directSellerId = referralId;
      }

      if (directSellerId) {
        try {
          const distributeSaleCommission = async (beneficiaryId: string, amount: number, levelDesc: string) => {
             if (amount <= 0) return;
             
             // Check if beneficiary is a reseller
             const isResellerUser = await checkIsResellerAccount(beneficiaryId);
             if (!isResellerUser) return;

             await rtdbPush('reseller_transactions', {
               resellerId: beneficiaryId,
               orderId: orderId,
               customerName: shippingAddress.name,
               productName: items.length > 0 ? items[0].name : 'Unknown Product',
               amount: amount,
               status: 'Pending',
               createdAt: Date.now(),
               isReferral: levelDesc !== 'Direct'
             });
             
             // Atomic wallet balance update using RTDB transaction
             await executeResellerWalletTransaction({
               resellerId: beneficiaryId,
               userId: beneficiaryId,
               orderId: orderId,
               amount: amount,
               type: ResellerTransactionType.PROFIT_PENDING,
               status: 'PENDING',
               description: `${levelDesc} commission for Order #${orderId}`,
               metadata: {
                 customerName: shippingAddress.name,
                 productName: items.length > 0 ? items[0].name : 'Unknown Product',
                 grandTotal,
                 levelDesc
               }
             });

             await rtdbTransaction(`reseller_wallet/${beneficiaryId}`, (curr) => {
               if (!curr) return curr;
               return {
                 ...curr,
                 totalSales: Number(curr.totalSales || 0) + grandTotal,
                 totalOrders: Number(curr.totalOrders || 0) + 1,
                 updatedAt: Date.now()
               };
             });
          };

          const directAmount = (grandTotal / 1000) * 15;
          await distributeSaleCommission(directSellerId, directAmount, 'Direct');
          
          if (!isReseller && referralId) {
             await rtdbPush('referral_tracking', {
                referrerId: referralId,
                orderId: orderId,
                type: 'order',
                amount: grandTotal,
                timestamp: Date.now()
             });
          }

          const dData = await rtdbGet<any>(`mlm_members/${directSellerId}`);
          if (dData) {
             if (dData.sponsorId) {
                const l2Amount = (grandTotal / 1000) * 20;
                await distributeSaleCommission(dData.sponsorId, l2Amount, 'Level 2 Upline');
                
                const l2Data = await rtdbGet<any>(`mlm_members/${dData.sponsorId}`);
                if (l2Data) {
                   if (l2Data.sponsorId) {
                      const l3Amount = (grandTotal / 1000) * 10;
                      await distributeSaleCommission(l2Data.sponsorId, l3Amount, 'Level 1 Upline');
                   }
                }
             }
          }
        } catch (error) {
           console.error('Failed to distribute commissions', error);
        }
      }
            
      if (verifiedDetails?.isVerified) {
        setSuccessTargetOrderId(orderId);
        setShowPaymentSuccessModal(true);
      } else {
        toast.success('অর্ডার সফলভাবে সম্পন্ন হয়েছে!');
        navigate(`/order-confirmation/${orderId}`);
      }
    } catch (error: any) {
      console.error('Error placing order:', error);
      toast.error(error.message || 'অর্ডার সম্পন্ন করতে সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleOnlineOrderPaymentVerify = async (channel: 'bkash' | 'nagad' | 'rocket' | 'upay', trxId: string) => {
    const expectedAmount = paymentMethod === 'only_delivery_charge' ? shippingCharge : grandTotal;
    const invoiceId = currentInvoiceId || 'S2N4HE603308';
    setLoading(true);
    try {
      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Payment verification timed out. Please try again.'));
        }, 8000);
      });

      const result = await Promise.race([
        verifyPaymentAutomatic({
          transactionId: trxId,
          paymentMethod: channel,
          expectedAmount,
          invoiceId,
          userId: user?.uid || 'guest',
          userType: 'customer',
          contextData: {
            customerName: shippingAddress.name,
            phone: shippingAddress.mobile
          }
        }),
        timeoutPromise
      ]);

      if (result.status === 'verified') {
        setPaymentErrorMessage('');
        if (channel === 'bkash') setShowBkashModal(false);
        else if (channel === 'nagad') setShowNagadModal(false);
        else if (channel === 'rocket') setShowRocketModal(false);
        else if (channel === 'upay') setShowUpayModal(false);
        setShowOnlinePaymentModal(false);
        setLoading(false);
        isSubmittingRef.current = false;
        await handlePlaceOrder(undefined, channel, trxId, {
          isVerified: true,
          receivedAmount: result.receivedAmount || expectedAmount,
          senderNumber: result.senderNumber,
          verifiedAt: result.verifiedAt || Date.now()
        });
      } else {
        let errorMsg = 'আপনার ট্রানজেকশন আইডি ভুল সঠিক ট্রানজাকশন আইডি দিয়ে আবার চেষ্টা করুন';
        if (result.rejectionReason === 'amount_mismatch') {
          errorMsg = result.message || `পেমেন্ট এমাউন্ট সঠিক নয়! প্রত্যাশিত: ৳${expectedAmount.toFixed(2)}।`;
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
    } catch (err: any) {
      console.error('Payment verification error:', err);
      const errNotice = 'আপনার ট্রানজেকশন আইডি ভুল সঠিক ট্রানজাকশন আইডি দিয়ে আবার চেষ্টা করুন';
      setPaymentErrorMessage(errNotice);
      toast.error(errNotice, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const handleAddressChange = (type: 'shipping', field: keyof Address, value: string) => {
    setShippingAddress(prev => {
      if (field === 'district') {
        const distObj = getDistrictById(value);
        return {
          ...prev,
          district: value,
          upazila: '',
          division: distObj?.division || prev.division
        };
      }
      if (field === 'area') {
        return {
          ...prev,
          area: value,
          fullAddress: value
        };
      }
      return { ...prev, [field]: value };
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow py-3 sm:py-5">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">চেকআউট</h1>
          <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-5">
            <div className="lg:col-span-2 space-y-3 sm:space-y-3.5">
              
              {/* Shipping Address & Receiver */}
              <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-xs border border-gray-100">
                <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-2.5 sm:mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary-main" /> ডেলিভারি ঠিকানা
                </h2>
                
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">আপনার নাম *</label>
                      <input 
                        id="checkout-name"
                        name="name"
                        required 
                        type="text" 
                        autoComplete="name"
                        placeholder="নাম লিখুন"
                        value={shippingAddress.name} 
                        onChange={(e) => handleAddressChange('shipping', 'name', e.target.value)} 
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none transition-all" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">মোবাইল নম্বর *</label>
                      <input 
                        id="checkout-mobile"
                        name="mobile"
                        required 
                        type="tel" 
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="১১ ডিজিটের মোবাইল নম্বর"
                        value={shippingAddress.mobile} 
                        onChange={(e) => handleAddressChange('shipping', 'mobile', e.target.value)} 
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none transition-all" 
                      />
                    </div>
                  </div>

                  {/* District & Upazila Selection (Clean selector bar) */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary-main" />
                      <span>জেলা ও থানা / উপজেলা *</span>
                    </label>

                    {/* Clickable selector bar like Daraz */}
                    <div 
                      id="checkout-district-search-bar"
                      onClick={() => setShowAddressModal(true)}
                      className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 hover:border-primary-main rounded-lg flex items-center justify-between cursor-pointer transition-all shadow-2xs group"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <Search className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-main transition-colors shrink-0" />
                        {shippingAddress.district && shippingAddress.upazila ? (
                          <span className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                            {shippingAddress.district}, {shippingAddress.upazila}
                          </span>
                        ) : (
                          <span className="text-xs sm:text-sm text-gray-500 truncate">
                            জেলা ও থানা নির্বাচন করুন (ক্লিক করে খুঁজুন)...
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-primary-main bg-white px-2 py-0.5 rounded border border-gray-200 group-hover:border-primary-main shrink-0 shadow-2xs">
                        {shippingAddress.district && shippingAddress.upazila ? 'পরিবর্তন' : 'নির্বাচন করুন'}
                      </span>
                    </div>
                  </div>

                  {/* Area input */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      এলাকা, গ্রাম বা বাড়ির নং *
                    </label>
                    <input 
                      id="checkout-area"
                      name="area"
                      required
                      type="text" 
                      placeholder="এলাকা, গ্রাম বা বাড়ির নম্বর লিখুন"
                      value={shippingAddress.area || ''} 
                      onChange={(e) => handleAddressChange('shipping', 'area', e.target.value)} 
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none transition-all font-medium text-gray-900" 
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-xs border border-gray-100">
                <div className="mb-2.5 pb-2 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-primary-main" /> পেমেন্ট মাধ্যম
                  </h2>
                </div>

                <div className="space-y-2.5">
                  {/* Option 1: Online Payment */}
                  <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-xs">
                    <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-primary-main" />
                        অনলাইন পেমেন্ট (bKash / Nagad / Rocket)
                      </span>
                    </div>

                    {/* Compact payment options matching Wallet sizing */}
                    <div className="divide-y divide-gray-100">
                      {/* Option A: Product Full Payment */}
                      <div
                        onClick={() => handlePaymentSelect('product_full_payment')}
                        className={`py-2 px-3 transition-all cursor-pointer flex items-center justify-between select-none ${
                          paymentMethod === 'product_full_payment'
                            ? 'bg-primary-main/5'
                            : 'hover:bg-gray-50/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          {/* Radio circle */}
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            paymentMethod === 'product_full_payment' ? 'border-primary-main bg-white' : 'border-gray-300 bg-white'
                          }`}>
                            {paymentMethod === 'product_full_payment' && (
                              <div className="w-2 h-2 rounded-full bg-primary-main" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <h4 className={`font-bold text-xs leading-none ${
                              paymentMethod === 'product_full_payment' ? 'text-primary-main' : 'text-gray-900'
                            }`}>
                              সম্পূর্ণ মূল্য পেমেন্ট
                            </h4>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-tight">
                              ক্যাশলেস পেমেন্ট (বাকি থাকবে না)
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs sm:text-sm font-bold text-gray-900">৳{grandTotal.toFixed(0)}</span>
                        </div>
                      </div>

                      {/* Option B: Only Delivery Charge */}
                      <div
                        onClick={() => handlePaymentSelect('only_delivery_charge')}
                        className={`py-2 px-3 transition-all cursor-pointer flex items-center justify-between select-none ${
                          paymentMethod === 'only_delivery_charge'
                            ? 'bg-primary-main/5'
                            : 'hover:bg-gray-50/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          {/* Radio circle */}
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            paymentMethod === 'only_delivery_charge' ? 'border-primary-main bg-white' : 'border-gray-300 bg-white'
                          }`}>
                            {paymentMethod === 'only_delivery_charge' && (
                              <div className="w-2 h-2 rounded-full bg-primary-main" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <h4 className={`font-bold text-xs leading-none ${
                              paymentMethod === 'only_delivery_charge' ? 'text-primary-main' : 'text-gray-900'
                            }`}>
                              শুধু ডেলিভারি চার্জ অগ্রিম
                            </h4>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-tight">
                              বাকি টাকা পণ্য ডেলিভারির সময় পরিশোধ করবেন
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs sm:text-sm font-bold text-primary-main">৳{shippingCharge.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: RJ WORLD BD Wallet (If logged in) */}
                  {user && (
                    <div 
                      onClick={() => {
                        handlePaymentSelect('wallet');
                      }}
                      className={`flex items-center justify-between py-2 px-3 rounded-lg border transition-all cursor-pointer ${
                        paymentMethod === 'wallet' 
                          ? 'border-primary-main bg-primary-main/5 shadow-xs' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${
                          paymentMethod === 'wallet' ? 'bg-white border-primary-main/30' : 'bg-gray-50 border-gray-200'
                        }`}>
                          <Wallet className="w-3.5 h-3.5 text-primary-main" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 leading-none">
                            <span className={`font-bold text-xs ${
                              paymentMethod === 'wallet' ? 'text-primary-main' : 'text-gray-900'
                            }`}>
                              RJ WORLD BD ওয়ালেট
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary-main/10 text-primary-main">
                              ব্যালেন্স: ৳{(userWalletBalance ?? 0).toFixed(2)}
                            </span>
                          </div>
                          <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-tight">
                            আপনার ওয়ালেট অ্যাকাউন্ট থেকে স্বয়ংক্রিয়ভাবে পরিশোধ হবে
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center pl-1">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                          paymentMethod === 'wallet' ? 'border-primary-main bg-white' : 'border-gray-300 bg-white'
                        }`}>
                          {paymentMethod === 'wallet' && (
                            <div className="w-2 h-2 rounded-full bg-primary-main" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Option 3: Cash on Delivery (COD) - Bottom */}
                  <div 
                    onClick={() => {
                      if (isCodAllowedByVendor) {
                        handlePaymentSelect('cod');
                      } else {
                        toast.error(disabledCodVendorName 
                          ? `${disabledCodVendorName}-এর পণ্যের জন্য ক্যাশ অন ডেলিভারি বন্ধ। অনুগ্রহ করে অনলাইন পেমেন্ট বেছে নিন।` 
                          : 'এই পণ্যের জন্য ক্যাশ অন ডেলিভারি প্রযোজ্য নয়। অনুগ্রহ করে অনলাইন পেমেন্ট বেছে নিন।');
                      }
                    }}
                    className={`flex items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer ${
                      paymentMethod === 'cod' 
                        ? 'border-primary-main bg-primary-main/5 shadow-xs' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/70'
                    } ${!isCodAllowedByVendor ? 'opacity-50 grayscale cursor-not-allowed bg-gray-50' : ''}`}
                  >
                    {/* Left: Icon + Info */}
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 pr-2">
                      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                        paymentMethod === 'cod' ? 'bg-white border-primary-main/30' : 'bg-gray-50 border-gray-200'
                      }`}>
                        <Truck className="w-4 h-4 text-emerald-600" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`font-semibold text-xs sm:text-sm ${
                            paymentMethod === 'cod' ? 'text-primary-main font-bold' : 'text-gray-900'
                          }`}>
                            ক্যাশ অন ডেলিভারি (COD)
                          </span>
                          {!isCodAllowedByVendor && (
                            <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              অনুপলব্ধ
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-gray-500">পণ্য হাতে পেয়ে মূল্য পরিশোধ</p>
                      </div>
                    </div>

                    {/* Right: Radio Selection Button */}
                    <div className="shrink-0 flex items-center pl-1">
                      <div className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center transition-all ${
                        paymentMethod === 'cod' ? 'border-primary-main bg-white' : 'border-gray-300 bg-white'
                      }`}>
                        {paymentMethod === 'cod' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary-main" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Summary */}
            <div className="lg:col-span-1 space-y-3 sm:space-y-3.5">
              
              {/* Coupon / Voucher */}
              <div className="bg-white rounded-lg p-2.5 sm:p-3 shadow-xs border border-gray-100">
                <h3 className="text-xs font-bold text-gray-900 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Ticket className="h-3 w-3 text-primary-main" /> কুপন কোড
                  </span>
                  {appliedCouponInfo && (
                    <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.2 rounded-full border border-green-200">
                      যুক্ত হয়েছে ({appliedCouponInfo.code})
                    </span>
                  )}
                </h3>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="কুপন কোড লিখুন"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-1 px-2 py-1 bg-gray-50 border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-main outline-none text-xs uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="px-2.5 py-1 bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800 transition-colors shrink-0"
                  >
                    প্রয়োগ করুন
                  </button>
                </div>
                {appliedCouponInfo && (
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-green-700 bg-green-50/70 px-2 py-1 rounded border border-green-100">
                    <span>
                      {appliedCouponInfo.percent ? `${appliedCouponInfo.percent}% ছাড়` : 'ডিসকাউন্ট'}: -৳{appliedCouponInfo.discountAmount.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDiscount(0);
                        setAppliedCouponInfo(null);
                        setCouponCode('');
                        toast.success('কুপন সরানো হয়েছে');
                      }}
                      className="text-red-500 hover:text-red-700 font-bold ml-2 underline"
                    >
                      মুছুন
                    </button>
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-xs border border-gray-100 sticky top-16">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-3">অর্ডারের বিবরণ</h3>
                
                <div className="space-y-2.5 mb-3 max-h-48 overflow-y-auto pr-1">
                  {items.map(item => {
                    const detailedItem = itemsWithDetails.find(d => 
                      d.id === item.id || 
                      (d as any).productId === item.id || 
                      ((item as any).productId && d.id === (item as any).productId) ||
                      (d.cartItemId && d.cartItemId === item.cartItemId)
                    ) || item;

                    const rawWeight = (detailedItem as any).rawWeight ?? 
                      detailedItem.weight ?? 
                      detailedItem.specifications?.Weight ?? 
                      detailedItem.specifications?.weight ?? 
                      detailedItem.specifications?.['ওজন'] ??
                      (detailedItem as any).productWeight ??
                      (item as any).rawWeight ?? 
                      item.weight ?? 
                      item.specifications?.Weight ?? 
                      item.specifications?.weight;

                    const parsedWeight = parseProductWeight(rawWeight);
                    const qty = Math.max(1, Number(item.quantity) || 1);
                    const totalWeightKg = Math.round(parsedWeight.weightKg * qty * 100) / 100;
                    const weightLabel = formatWeight(totalWeightKg);

                    return (
                      <div key={item.cartItemId || (item.variantId ? `${item.id}_${item.variantId}` : `${item.id}_${item.color || ''}_${item.size || ''}`)} className="flex justify-between items-center gap-2.5 py-1 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <img referrerPolicy="no-referrer" src={item.image} alt={item.name} className="w-9 h-9 rounded object-cover bg-gray-100 shrink-0 border border-gray-100" />
                          
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-900 truncate leading-tight">{item.name}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>পরিমাণ: {item.quantity}</span>
                              <span className="text-gray-300">•</span>
                              <span className="text-gray-600 font-medium">ওজন: {weightLabel}</span>
                            </p>
                            {(item.selectedColor || item.color || item.selectedSize || item.size) && (
                              <div className="text-[10px] text-gray-600 flex flex-wrap gap-1 mt-0.5">
                                {(item.selectedColor || item.color) && (
                                  <span className="bg-slate-100 text-slate-700 font-medium px-1.5 py-0.2 rounded">
                                    {item.selectedColor || item.color}
                                  </span>
                                )}
                                {(item.selectedSize || item.size) && (
                                  <span className="bg-slate-100 text-slate-700 font-medium px-1.5 py-0.2 rounded">
                                    {item.selectedSize || item.size}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-gray-900 shrink-0">৳{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1.5 text-xs py-2.5 border-t border-gray-100">
                  <div className="flex justify-between items-baseline text-gray-600">
                    <span>ডেলিভারি চার্জ</span>
                    <span className="font-medium text-gray-900">৳{shippingCharge.toFixed(2)}</span>
                  </div>
                  {paymentMethod === 'cod' && (
                    <div className="flex justify-between items-baseline text-gray-600">
                      <span>ক্যাশ অন ডেলিভারি ফি</span>
                      <span className="font-medium text-gray-900">
                        {codCharge === 0 ? <span className="text-emerald-600 font-bold">ফ্রি</span> : `৳${codCharge.toFixed(2)}`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>প্ল্যাটফর্ম ফি</span>
                    <span className="font-medium text-gray-900">৳{platformFee.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>কুপন ছাড়</span>
                      <span>-৳{discount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1.5 py-2.5 border-t border-gray-100">
                  <div className="flex justify-between items-center text-sm sm:text-base font-bold text-gray-900">
                    <span>সর্বমোট প্রদেয়</span>
                    <span className="text-primary-main">৳{grandTotal.toFixed(2)}</span>
                  </div>

                  {(paymentMethod === 'product_full_payment' || paymentMethod === 'wallet') && (
                    <div className="p-2.5 bg-emerald-50/80 border border-emerald-200/80 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between font-bold text-emerald-800">
                        <span>অগ্রিম পরিশোধ:</span>
                        <span>৳{grandTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 pt-0.5 border-t border-emerald-100">
                        <span>বাকি প্রদেয় (COD):</span>
                        <span className="font-bold text-emerald-800">৳0.00</span>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'only_delivery_charge' && (
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between font-bold text-amber-800">
                        <span>অগ্রিম ডেলিভারি চার্জ:</span>
                        <span>৳{shippingCharge.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-700 pt-0.5 border-t border-amber-100">
                        <span>বাকি প্রদেয় (COD):</span>
                        <span className="font-bold text-gray-900">৳{Math.max(0, grandTotal - shippingCharge).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'cod' && (
                    <div className="p-2 bg-gray-50 border border-gray-200/70 rounded-lg text-xs space-y-0.5">
                      <div className="flex justify-between text-gray-600 text-[11px]">
                        <span>অগ্রিম পরিশোধ:</span>
                        <span className="font-semibold text-gray-700">৳0.00</span>
                      </div>
                      <div className="flex justify-between font-bold text-gray-900">
                        <span>বাকি প্রদেয় (COD):</span>
                        <span className="text-primary-main">৳{grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={loading || items.length === 0}
                  className="w-full py-2.5 sm:py-3 bg-primary-main text-white font-bold rounded-lg hover:bg-primary-hover transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm cursor-pointer"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> প্রসেসিং হচ্ছে...</>
                  ) : (
                    'অর্ডার নিশ্চিত করুন'
                  )}
                </button>
                
                <div className="mt-2.5 flex items-center justify-center gap-1 text-[10px] text-gray-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ১০০% সুরক্ষিত অর্ডার ও পেমেন্ট
                </div>
              </div>
            </div>
          </form>

          {/* Related Products Section */}
          <div className="mt-8 sm:mt-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-5">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400 shrink-0" />
                  <span>সম্পর্কিত পণ্যসমূহ</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  আপনার পছন্দ হতে পারে এমন কিছু জনপ্রিয় পণ্য
                </p>
              </div>
              {relatedProducts.length > 0 && (
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
                  {relatedProducts.length} টি পণ্য পাওয়া গেছে
                </span>
              )}
            </div>

            {loadingRelated ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 text-primary-main animate-spin" />
              </div>
            ) : relatedProducts.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {relatedProducts.slice(0, visibleRelatedCount).map(product => (
                    <ProductCard key={product.id} product={product} showAddToCart={true} />
                  ))}
                </div>
                {visibleRelatedCount < relatedProducts.length && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setVisibleRelatedCount(prev => prev + 8)}
                      className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs hover:shadow transition-all cursor-pointer"
                    >
                      আরো পণ্য দেখুন ({relatedProducts.length - visibleRelatedCount} টি বাকি)
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm py-4">No related products found.</p>
            )}
          </div>
        </div>
      </main>
      <Footer />

      {/* 2-Step Address Selector Modal (District -> Upazila) */}
      <AddressSelectorModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        selectedLocation={selectedLocationProp}
        onSelect={handleLocationSelected}
      />

      {/* Online Payment Method Selection Modal matching reference screenshot */}
      <PaymentMethodSelectionModal
        isOpen={showOnlinePaymentModal}
        onClose={() => setShowOnlinePaymentModal(false)}
        amount={paymentMethod === 'only_delivery_charge' ? shippingCharge : grandTotal}
        paymentType={paymentMethod === 'only_delivery_charge' ? 'only_delivery_charge' : 'product_full_payment'}
        invoiceId={currentInvoiceId}
        isSubmitting={loading}
        selectedChannel={selectedOnlineChannel}
        onSelectChannel={setSelectedOnlineChannel}
        onConfirmPayment={(channel) => {
          setPaymentErrorMessage('');
          setShowOnlinePaymentModal(false);
          if (!currentInvoiceId) {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let inv = 'S2N';
            for (let i = 0; i < 9; i++) {
              inv += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            setCurrentInvoiceId(inv);
          }

          if (channel === 'bkash') {
            setShowBkashModal(true);
          } else if (channel === 'nagad') {
            setShowNagadModal(true);
          } else if (channel === 'rocket') {
            setShowRocketModal(true);
          } else if (channel === 'upay') {
            setShowUpayModal(true);
          } else {
            handlePlaceOrder(undefined, channel);
          }
        }}
      />

      {/* bKash Payment Instruction Modal (matching reference screenshot) */}
      <BkashPaymentModal
        isOpen={showBkashModal}
        onClose={() => {
          setShowBkashModal(false);
          setPaymentErrorMessage('');
        }}
        onBack={() => {
          setShowBkashModal(false);
          setPaymentErrorMessage('');
          setShowOnlinePaymentModal(true);
        }}
        amount={paymentMethod === 'only_delivery_charge' ? shippingCharge : grandTotal}
        invoiceId={currentInvoiceId || 'S2N4HE603308'}
        bkashNumber="01864670673"
        isSubmitting={loading}
        errorMessage={paymentErrorMessage}
        onVerify={async (trxId) => {
          await handleOnlineOrderPaymentVerify('bkash', trxId);
        }}
      />

      {/* Nagad Payment Instruction Modal (matching reference screenshot) */}
      <NagadPaymentModal
        isOpen={showNagadModal}
        onClose={() => {
          setShowNagadModal(false);
          setPaymentErrorMessage('');
        }}
        onBack={() => {
          setShowNagadModal(false);
          setPaymentErrorMessage('');
          setShowOnlinePaymentModal(true);
        }}
        amount={paymentMethod === 'only_delivery_charge' ? shippingCharge : grandTotal}
        invoiceId={currentInvoiceId || 'S2N4HE603308'}
        nagadNumber="01864670673"
        isSubmitting={loading}
        errorMessage={paymentErrorMessage}
        onVerify={async (trxId) => {
          await handleOnlineOrderPaymentVerify('nagad', trxId);
        }}
      />

      {/* Rocket Payment Instruction Modal (matching reference screenshot) */}
      <RocketPaymentModal
        isOpen={showRocketModal}
        onClose={() => {
          setShowRocketModal(false);
          setPaymentErrorMessage('');
        }}
        onBack={() => {
          setShowRocketModal(false);
          setPaymentErrorMessage('');
          setShowOnlinePaymentModal(true);
        }}
        amount={paymentMethod === 'only_delivery_charge' ? shippingCharge : grandTotal}
        invoiceId={currentInvoiceId || 'S2N4HE603308'}
        rocketNumber="01864670673"
        isSubmitting={loading}
        errorMessage={paymentErrorMessage}
        onVerify={async (trxId) => {
          await handleOnlineOrderPaymentVerify('rocket', trxId);
        }}
      />

      {/* Upay Payment Instruction Modal (matching reference screenshot) */}
      <UpayPaymentModal
        isOpen={showUpayModal}
        onClose={() => {
          setShowUpayModal(false);
          setPaymentErrorMessage('');
        }}
        onBack={() => {
          setShowUpayModal(false);
          setPaymentErrorMessage('');
          setShowOnlinePaymentModal(true);
        }}
        amount={paymentMethod === 'only_delivery_charge' ? shippingCharge : grandTotal}
        invoiceId={currentInvoiceId || 'S2N4HE603308'}
        upayNumber="01864670673"
        isSubmitting={loading}
        errorMessage={paymentErrorMessage}
        onVerify={async (trxId) => {
          await handleOnlineOrderPaymentVerify('upay', trxId);
        }}
      />

      {/* Payment Success Popup Modal (Automatic redirect after 1.5s) */}
      <PaymentSuccessModal
        isOpen={showPaymentSuccessModal}
        title="আপনার পেমেন্ট সফল হয়েছে! 🎉"
        subtitle="Payment Successful"
        targetName="Order Confirmation"
        autoRedirectDelayMs={1500}
        onComplete={() => {
          setShowPaymentSuccessModal(false);
          navigate(`/order-confirmation/${successTargetOrderId}`);
        }}
      />

      {/* Emon Pay Hosted Gateway Redirection Overlay */}
      {redirectingPaymentUrl && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Redirecting to Emon Pay</h3>
              <p className="text-xs text-gray-500 mt-1">
                Please wait while we redirect you to the secure hosted payment page.
              </p>
            </div>
            <a 
              href={redirectingPaymentUrl}
              target="_top"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-xs"
            >
              Click here if not redirected automatically
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
