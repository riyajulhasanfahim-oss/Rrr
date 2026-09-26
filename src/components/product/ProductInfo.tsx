import React, { useState, useEffect, useMemo } from 'react';
import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { Star, Heart, Share2, ShoppingCart, ShieldCheck, Truck, RefreshCw, DollarSign, ArrowRight, MessageCircle, Store, CheckCircle2, BadgeCheck, Zap, Loader2 } from 'lucide-react';
import VerifiedBadge from '../ui/VerifiedBadge';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCart } from '../../contexts/CartContext';
import { useWishlist } from '../../contexts/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getStoreFromCache, fetchStoreDetailFromRTDB, isStorePlanVerified } from '../../services/storeCache';
import { fetchProductMetricsFromRTDB } from '../../services/productMetricsService';
import { rtdbGet, rtdbList } from '../../lib/rtdb';
import type { ProductVariant, ProductColor, ProductSize } from '../../types/variant';
import { getResellerProduct, saveOrUpdateResellerProductPrice, createResellerPriceSnapshot } from '../../services/resellerPricingService';
import ShareModal from '../common/ShareModal';

export function formatProductWeight(raw: any): string | null {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Check if explicitly contains kg
  const isKg = /kg/i.test(str);
  const numMatch = str.match(/([0-9]+(\.[0-9]+)?)/);
  if (!numMatch) return null;

  const num = parseFloat(numMatch[1]);
  if (isNaN(num) || num <= 0) return null;

  if (isKg) {
    return `${parseFloat(num.toFixed(2))} kg`;
  }

  // Weight in grams: 1000g or more should display in kg (e.g. 1 kg, 1.5 kg)
  if (num >= 1000) {
    const kg = num / 1000;
    return `${parseFloat(kg.toFixed(2))} kg`;
  }

  return `${parseFloat(num.toFixed(2))}g`;
}

interface ProductInfoProps {
  product: {
    id: string;
    name: string;
    brand?: string;
    category?: string;
    vendorId?: string;
    storeId?: string;
    vendor?: any;
    sku?: string;
    rating?: number;
    reviews?: number;
    price: number;
    regularPrice?: number;
    originalPrice?: number;
    discount?: number;
    resellerPrice?: number;
    inStock: boolean;
    stockCount?: number;
    shortDescription?: string;
    image: string;
    colors?: string[];
    sizes?: string[];
    tags?: string[];
    weight?: number | string;
    specifications?: Record<string, any>;
    age?: string;
    ageGroup?: string;
    babyAge?: string;
    targetAge?: string;
    soldCount?: number;
    salesCount?: number;
    totalSold?: number;
    hasVariants?: boolean;
    variantColors?: any[];
    variantSizes?: any[];
    variants?: any[];
  };
  onVariantImageChange?: (url: string) => void;
}

export default function ProductInfo({ product, onVariantImageChange }: ProductInfoProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');

  // Daraz-style Variant Resolution
  const rawVariants: ProductVariant[] = useMemo(() => {
    const v = (product as any).variants;
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.values(v);
    return [];
  }, [product]);

  const hasVariants = useMemo(() => {
    return !!((product as any).hasVariants || rawVariants.length > 0);
  }, [product, rawVariants]);

  const variantColors: ProductColor[] = useMemo(() => {
    const vc = (product as any).variantColors;
    if (Array.isArray(vc) && vc.length > 0) return vc;
    if (vc && typeof vc === 'object') return Object.values(vc);
    const map = new Map<string, ProductColor>();
    rawVariants.forEach((v) => {
      if (v.colorName && !map.has(v.colorName.toLowerCase())) {
        map.set(v.colorName.toLowerCase(), {
          id: v.colorId || v.colorName,
          name: v.colorName,
          image: v.image
        });
      }
    });
    return Array.from(map.values());
  }, [product, rawVariants]);

  const variantSizes: ProductSize[] = useMemo(() => {
    const vs = (product as any).variantSizes;
    if (Array.isArray(vs) && vs.length > 0) return vs;
    if (vs && typeof vs === 'object') return Object.values(vs);
    const map = new Map<string, ProductSize>();
    rawVariants.forEach((v) => {
      if (v.sizeName && !map.has(v.sizeName.toLowerCase())) {
        map.set(v.sizeName.toLowerCase(), {
          id: v.sizeId || v.sizeName,
          name: v.sizeName
        });
      }
    });
    return Array.from(map.values());
  }, [product, rawVariants]);

  const legacyColors: string[] = (product as any).colors || [];
  const legacySizes: string[] = (product as any).sizes || [];

  // Initialize selected color and size
  useEffect(() => {
    if (hasVariants && rawVariants.length > 0) {
      const defaultVariant = rawVariants.find(v => (Number(v.stock) || 0) > 0) || rawVariants[0];
      if (defaultVariant) {
        if (defaultVariant.colorName) {
          setSelectedColor(defaultVariant.colorName);
        }
        if (defaultVariant.sizeName) {
          setSelectedSize(defaultVariant.sizeName);
        }
      }
    } else {
      if (legacyColors.length > 0 && !selectedColor) setSelectedColor(legacyColors[0]);
      if (legacySizes.length > 0 && !selectedSize) setSelectedSize(legacySizes[0]);
    }
  }, [product.id, hasVariants]);

  // Current matched variant
  const matchedVariant = useMemo(() => {
    if (!hasVariants || rawVariants.length === 0) return null;
    return rawVariants.find(v => {
      const colorMatch = !v.colorName || !selectedColor || v.colorName.toLowerCase() === selectedColor.toLowerCase();
      const sizeMatch = !v.sizeName || !selectedSize || v.sizeName.toLowerCase() === selectedSize.toLowerCase();
      return colorMatch && sizeMatch;
    }) || null;
  }, [hasVariants, rawVariants, selectedColor, selectedSize]);

  // Effective price, regular price, original price, stock, sku
  const effectivePrice = useMemo(() => {
    if (matchedVariant) {
      if (matchedVariant.salePrice !== undefined && matchedVariant.salePrice !== null && Number(matchedVariant.salePrice) > 0 && Number(matchedVariant.salePrice) < Number(matchedVariant.price)) {
        return Number(matchedVariant.salePrice);
      }
      return Number(matchedVariant.price) || 0;
    }
    return Number(product.price) || 0;
  }, [matchedVariant, product.price]);

  const effectiveRegularPrice = useMemo(() => {
    if (matchedVariant) {
      return Number(matchedVariant.price) || 0;
    }
    return Number(product.regularPrice || product.originalPrice) || 0;
  }, [matchedVariant, product.regularPrice, product.originalPrice]);

  const effectiveOriginalPrice = useMemo(() => {
    if (matchedVariant) {
      if (matchedVariant.salePrice !== undefined && matchedVariant.salePrice !== null && Number(matchedVariant.salePrice) > 0 && Number(matchedVariant.salePrice) < Number(matchedVariant.price)) {
        return Number(matchedVariant.price);
      }
      return undefined;
    }
    return product.originalPrice;
  }, [matchedVariant, product.originalPrice]);

  const effectiveStock = useMemo(() => {
    if (matchedVariant) {
      return Number(matchedVariant.stock) || 0;
    }
    if (product.stockCount !== undefined && product.stockCount !== null) return Number(product.stockCount);
    if ((product as any).stock !== undefined && (product as any).stock !== null) return Number((product as any).stock);
    return product.inStock ? 99 : 0;
  }, [matchedVariant, product.stockCount, (product as any).stock, product.inStock]);

  const effectiveInStock = useMemo(() => {
    if (matchedVariant) {
      return (Number(matchedVariant.stock) || 0) > 0;
    }
    return !!product.inStock && effectiveStock > 0;
  }, [matchedVariant, product.inStock, effectiveStock]);

  const effectiveSku = useMemo(() => {
    if (matchedVariant && matchedVariant.sku) {
      return String(matchedVariant.sku).trim();
    }
    return product.sku ? String(product.sku).trim() : '';
  }, [matchedVariant, product.sku]);

  // Color change handler
  const handleColorChange = (cName: string, cImage?: string) => {
    setSelectedColor(cName);
    if (cImage && onVariantImageChange) {
      onVariantImageChange(cImage);
    } else {
      const vWithImage = rawVariants.find(v => v.colorName && v.colorName.toLowerCase() === cName.toLowerCase() && v.image);
      if (vWithImage?.image && onVariantImageChange) {
        onVariantImageChange(vWithImage.image);
      }
    }

    if (hasVariants && variantSizes.length > 0) {
      const isCombInStock = rawVariants.some(v => 
        (!v.colorName || v.colorName.toLowerCase() === cName.toLowerCase()) &&
        (!v.sizeName || v.sizeName.toLowerCase() === (selectedSize || '').toLowerCase()) &&
        (Number(v.stock) || 0) > 0
      );

      if (!isCombInStock) {
        const inStockVar = rawVariants.find(v => 
          (!v.colorName || v.colorName.toLowerCase() === cName.toLowerCase()) &&
          (Number(v.stock) || 0) > 0
        );
        if (inStockVar?.sizeName) {
          setSelectedSize(inStockVar.sizeName);
        }
      }
    }
  };

  const isColorOutOfStock = (cName: string) => {
    if (!hasVariants || rawVariants.length === 0) return false;
    const variantsForColor = rawVariants.filter(v => !v.colorName || v.colorName.toLowerCase() === cName.toLowerCase());
    if (variantsForColor.length === 0) return false;
    return variantsForColor.every(v => (Number(v.stock) || 0) <= 0);
  };

  const isSizeOutOfStock = (sName: string) => {
    if (!hasVariants || rawVariants.length === 0) return false;
    const variantForColorAndSize = rawVariants.find(v => 
      (!v.colorName || !selectedColor || v.colorName.toLowerCase() === selectedColor.toLowerCase()) &&
      (!v.sizeName || v.sizeName.toLowerCase() === sName.toLowerCase())
    );
    if (variantForColorAndSize) {
      return (Number(variantForColorAndSize.stock) || 0) <= 0;
    }
    return false;
  };
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlRef = searchParams.get('ref');
  
  useEffect(() => {
    if (urlRef) {
      localStorage.setItem(`ref_${product.id}`, urlRef);
      // also optionally track click
      try {
        const q = query(collection(db, 'resellerTracking'), where('referralId', '==', urlRef));
        getDocs(q).then(snap => {
          if (!snap.empty) {
             const trackDoc = snap.docs[0];
             updateDoc(trackDoc.ref, { clicks: (trackDoc.data().clicks || 0) + 1 }).catch(() => {});
          }
        }).catch(() => {});
      } catch(e) {}
    }
  }, [urlRef, product.id]);

  const referralId = urlRef || localStorage.getItem(`ref_${product.id}`);

  const { userData } = useAuth();
  const [isAddedToStore, setIsAddedToStore] = useState(false);
  const [isAddingToStore, setIsAddingToStore] = useState(false);

  useEffect(() => {
    const checkStore = async () => {
      if (userData?.role === 'Reseller' && userData?.uid) {
        try {
          const q = query(collection(db, 'products'), where('resellerId', '==', userData.uid), where('originalProductId', '==', product.id));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setIsAddedToStore(true);
          }
        } catch (e) {
          console.error('Error checking store', e);
        }
      }
    };
    checkStore();
  }, [userData, product.id]);

  // Resolve effective vendor/store ID
  const effectiveStoreId = useMemo(() => {
    return (
      product.vendorId ||
      product.storeId ||
      product.vendor?.id ||
      product.vendor?.vendorId ||
      (typeof product.vendor === 'string' ? product.vendor : '') ||
      'admin'
    );
  }, [product.vendorId, product.storeId, product.vendor]);

  // Synchronously initialize store data from in-memory cache, product data, or fallback
  const [storeData, setStoreData] = useState<any>(() => {
    const cached = getStoreFromCache(effectiveStoreId);
    if (cached) return cached;
    if (product.vendor && typeof product.vendor === 'object') {
      return {
        id: effectiveStoreId,
        shopName: product.vendor.name || product.vendor.storeName || 'Official Store',
        storeName: product.vendor.name || product.vendor.storeName || 'Official Store',
        logo: product.vendor.logo || product.vendor.shopLogo || product.vendor.profileImage || '',
        rating: product.vendor.reviewsCount ? product.vendor.rating : undefined,
        reviewsCount: product.vendor.reviewsCount || 0,
        joined: product.vendor.joined || (product.vendor.createdAt ? String(new Date(product.vendor.createdAt).getFullYear()) : ''),
        verified: !!product.vendor.verified
      };
    }
    if (effectiveStoreId === 'admin') {
      return {
        id: 'admin',
        shopName: 'RJ WORLD BD Official Store',
        storeName: 'RJ WORLD BD Official Store',
        logo: 'https://i.postimg.cc/02BC9ZMs/file-00000000c36881fa822edc96c75d817a.png',
        rating: undefined,
        reviewsCount: 0,
        joined: '',
        verified: true
      };
    }
    return null;
  });

  // Fetch real-time Vendor/Store details strictly from RTDB
  useEffect(() => {
    let isMounted = true;

    const loadStoreFromRTDB = async () => {
      try {
        if (!effectiveStoreId || effectiveStoreId === 'admin') {
          const adminStore = await rtdbGet<any>('stores/admin').catch(() => null);
          if (isMounted && adminStore) {
            setStoreData((prev: any) => ({
              ...prev,
              ...adminStore,
              shopName: adminStore.shopName || adminStore.storeName || 'RJ WORLD BD Official Store',
              logo: adminStore.logo || adminStore.shopLogo || 'https://i.postimg.cc/02BC9ZMs/file-00000000c36881fa822edc96c75d817a.png'
            }));
          } else if (isMounted) {
            setStoreData((prev: any) => ({
              ...prev,
              id: 'admin',
              shopName: 'RJ WORLD BD Official Store',
              storeName: 'RJ WORLD BD Official Store',
              logo: 'https://i.postimg.cc/02BC9ZMs/file-00000000c36881fa822edc96c75d817a.png'
            }));
          }
          return;
        }

        // Fetch from RTDB via storeCache (which queries vendors/${id}, vendor_profiles/${id}, stores/${id})
        const freshStore = await fetchStoreDetailFromRTDB(effectiveStoreId);
        if (isMounted && freshStore) {
          setStoreData(freshStore);
        }
      } catch (err) {
        console.warn('Failed to load store from RTDB in ProductInfo:', err);
      }
    };

    loadStoreFromRTDB();
    return () => {
      isMounted = false;
    };
  }, [effectiveStoreId]);

  const displayStoreName = 
    storeData?.shopName ||
    storeData?.storeName ||
    storeData?.name ||
    product.vendor?.name ||
    product.vendor?.storeName ||
    (product as any).storeName ||
    (effectiveStoreId === 'admin' ? 'RJ WORLD BD Official Store' : 'Official Store');

  const displayStoreLogo = 
    storeData?.logo ||
    storeData?.shopLogo ||
    storeData?.profileImage ||
    storeData?.photoURL ||
    storeData?.avatar ||
    product.vendor?.logo ||
    product.vendor?.shopLogo ||
    (effectiveStoreId === 'admin' ? 'https://i.postimg.cc/02BC9ZMs/file-00000000c36881fa822edc96c75d817a.png' : '');

  const storeReviewsCount = Number(storeData?.reviewsCount ?? (product.vendor?.reviewsCount || 0));
  const storeRating = Number(storeData?.rating ?? (product.vendor?.rating || 0));
  const displayStoreJoined = storeData?.joined || (storeData?.createdAt ? String(new Date(storeData.createdAt).getFullYear()) : (product.vendor?.joined || (product.vendor?.createdAt ? String(new Date(product.vendor.createdAt).getFullYear()) : '')));
  const isStoreVerified = isStorePlanVerified(storeData || product?.vendor);

  const handleShareToStore = async () => {
    if (!userData) {
      toast.error('Please login as a reseller to add products to your store.');
      return;
    }
    if (userData.role !== 'Reseller') {
      toast.error('Please login as a reseller to add products to your store.');
      return;
    }

    if (isAddedToStore) {
      navigate('/reseller/dashboard?tab=shop'); // Navigate to store
      return;
    }

    setIsAddingToStore(true);
    try {
      const fullProduct = product as any;
      const newProductData = {
        ...fullProduct,
        id: undefined, // Let firestore generate a new ID
        originalProductId: product.id,
        resellerId: userData.uid,
        shopId: userData.uid,
        source: 'rjworld',
        publishedAt: serverTimestamp(),
        status: 'published'
      };
      delete newProductData.id;

      await addDoc(collection(db, 'products'), newProductData);
      setIsAddedToStore(true);
      toast.success('Product added to your store successfully.');
    } catch (e) {
      console.error(e);
      toast.error('Unable to add product to your store. Please try again.');
    } finally {
      setIsAddingToStore(false);
    }
  };

  const inWishlist = isInWishlist(product.id);

  const isReseller = Boolean(
    userData?.role?.toLowerCase() === 'reseller' || 
    userData?.accountType?.toLowerCase() === 'reseller' || 
    userData?.hasActiveReseller === true
  );
  const isVendorOrAdmin = userData?.role === 'Vendor' || userData?.role === 'Admin';
  
  const shopPrice = effectivePrice;
  const hasVendorResellerPrice = (product as any).resellerPrice !== undefined && (product as any).resellerPrice !== null && Number((product as any).resellerPrice) > 0;
  const explicitVendorPrice = (product as any).vendorPrice !== undefined && (product as any).vendorPrice !== null && Number((product as any).vendorPrice) > 0;
  const vendorPriceValue = explicitVendorPrice
    ? Number((product as any).vendorPrice)
    : (hasVendorResellerPrice ? Number((product as any).resellerPrice) : shopPrice);
  
  const adminPrice = vendorPriceValue;
  const minSellingPrice = adminPrice;
  
  const [resellerSellingPrice, setResellerSellingPrice] = useState(adminPrice);
  const [priceError, setPriceError] = useState('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [isPriceSaved, setIsPriceSaved] = useState(false);

  // Load existing saved reseller price configuration from RTDB
  useEffect(() => {
    let isMounted = true;
    if (isReseller && userData?.uid && product?.id) {
      getResellerProduct(userData.uid, product.id)
        .then((saved) => {
          if (isMounted && saved) {
            if (saved.resellerSellingPrice >= adminPrice) {
              setResellerSellingPrice(saved.resellerSellingPrice);
              setIsPriceSaved(true);
            } else {
              setResellerSellingPrice(adminPrice);
            }
          } else if (isMounted) {
            setResellerSellingPrice(adminPrice);
            setIsPriceSaved(false);
          }
        })
        .catch((err) => {
          console.warn('Notice fetching saved reseller price:', err);
        });
    } else {
      setResellerSellingPrice(adminPrice);
      setPriceError('');
    }
    return () => {
      isMounted = false;
    };
  }, [isReseller, userData?.uid, product?.id, adminPrice]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setResellerSellingPrice(val);
    setIsPriceSaved(false);
    if (val < minSellingPrice) {
      setPriceError('Reseller selling price cannot be lower than the vendor price.');
    } else {
      setPriceError('');
    }
  };

  const handleSaveResellerPrice = async () => {
    if (!isReseller || !userData?.uid || !product?.id) return;
    if (resellerSellingPrice < minSellingPrice || isNaN(resellerSellingPrice)) {
      setPriceError('Reseller selling price cannot be lower than the vendor price.');
      toast.error('Reseller selling price cannot be lower than the vendor price.');
      return;
    }

    setIsSavingPrice(true);
    try {
      await saveOrUpdateResellerProductPrice({
        resellerId: userData.uid,
        productId: product.id,
        resellerSellingPrice
      });
      setIsPriceSaved(true);
      setPriceError('');
      toast.success('Reseller price and profit saved successfully!');
    } catch (err: any) {
      console.error('Error saving reseller selling price:', err);
      toast.error(err.message || 'Failed to save reseller price');
    } finally {
      setIsSavingPrice(false);
    }
  };

  const handleWishlistClick = () => {
    if (inWishlist) {
      removeFromWishlist(product.id);
      toast.success('Removed from wishlist');
    } else {
      addToWishlist({
        id: product.id,
        name: product.name,
        price: effectivePrice,
        originalPrice: effectiveOriginalPrice,
        image: matchedVariant?.image || product.image,
        addedAt: Date.now()
      });
      toast.success('Added to wishlist');
    }
  };

  const handleAddToCart = () => {
    if (!effectiveInStock) {
      toast.error("This product/variant is currently out of stock");
      return;
    }

    if (isReseller && (resellerSellingPrice < minSellingPrice || isNaN(resellerSellingPrice))) {
       setPriceError('Reseller selling price cannot be lower than the vendor price.');
       toast.error("Reseller selling price cannot be lower than the vendor price.");
       return;
    }

    const chosenColor = selectedColor || undefined;
    const chosenSize = selectedSize || undefined;
    const chosenImage = matchedVariant?.image || variantColors.find(c => c.name.toLowerCase() === (selectedColor || '').toLowerCase())?.image || product.image;
    
    const calculatedUnitProfit = isReseller 
      ? Math.max(0, Number((resellerSellingPrice - adminPrice).toFixed(2)))
      : undefined;
    const calculatedResellerProfit = isReseller 
      ? Math.max(0, Number(((resellerSellingPrice - adminPrice) * quantity).toFixed(2)))
      : undefined;
    
    addToCart({
      id: product.id,
      cartItemId: matchedVariant ? `${product.id}_${matchedVariant.id}` : (chosenColor || chosenSize ? `${product.id}_${chosenColor || ''}_${chosenSize || ''}` : undefined),
      name: product.name,
      price: isReseller ? resellerSellingPrice : effectivePrice,
      color: chosenColor,
      size: chosenSize,
      selectedColor: chosenColor,
      selectedSize: chosenSize,
      variantId: matchedVariant?.id || undefined,
      variantSku: effectiveSku || undefined,
      sku: effectiveSku || undefined,
      stock: effectiveStock,
      originalPrice: effectiveOriginalPrice,
      image: chosenImage,
      quantity: quantity,
      adminPrice: isReseller ? adminPrice : undefined,
      vendorPrice: isReseller ? adminPrice : undefined,
      unitProfit: calculatedUnitProfit,
      resellerProfit: calculatedResellerProfit,
      resellerSellingPrice: isReseller ? resellerSellingPrice : undefined,
      priceSnapshot: isReseller ? createResellerPriceSnapshot(adminPrice, resellerSellingPrice, quantity) : undefined,
      referralId: referralId || undefined,
      vendorId: product.vendorId || (product as any).vendor?.id || (product as any).storeId || (product as any).resellerId || undefined,
      storeId: product.vendorId || (product as any).vendor?.id || (product as any).storeId || undefined,
      weight: product.weight ?? (product.specifications?.Weight || product.specifications?.weight),
      specifications: product.specifications,
    });
    toast.success(`Added ${quantity} ${product.name} to cart`);
  };

  const handleBuyNow = () => {
    if (!effectiveInStock) {
      toast.error("This product/variant is currently out of stock");
      return;
    }

    if (isReseller && (resellerSellingPrice < minSellingPrice || isNaN(resellerSellingPrice))) {
       setPriceError('Reseller selling price cannot be lower than the vendor price.');
       toast.error("Reseller selling price cannot be lower than the vendor price.");
       return;
    }

    const chosenColor = selectedColor || undefined;
    const chosenSize = selectedSize || undefined;
    const chosenImage = matchedVariant?.image || variantColors.find(c => c.name.toLowerCase() === (selectedColor || '').toLowerCase())?.image || product.image;

    const calculatedUnitProfit = isReseller 
      ? Math.max(0, Number((resellerSellingPrice - adminPrice).toFixed(2)))
      : undefined;
    const calculatedResellerProfit = isReseller 
      ? Math.max(0, Number(((resellerSellingPrice - adminPrice) * quantity).toFixed(2)))
      : undefined;

    // Navigate straight to checkout without adding to cart
    navigate('/checkout', { state: { buyNowItem: { 
      ...product, 
      productId: product.id,
      productName: product.name,
      quantity,
      price: isReseller ? resellerSellingPrice : effectivePrice,
      originalPrice: effectiveOriginalPrice,
      image: chosenImage,
      color: chosenColor,
      size: chosenSize,
      selectedColor: chosenColor,
      selectedSize: chosenSize,
      variantId: matchedVariant?.id || undefined,
      variantSku: effectiveSku || undefined,
      sku: effectiveSku || undefined,
      stock: effectiveStock,
      weight: product.weight ?? (product.specifications?.Weight || product.specifications?.weight),
      specifications: product.specifications,
      adminPrice: isReseller ? adminPrice : undefined,
      vendorPrice: isReseller ? adminPrice : undefined,
      unitProfit: calculatedUnitProfit,
      resellerProfit: calculatedResellerProfit,
      resellerSellingPrice: isReseller ? resellerSellingPrice : undefined,
      priceSnapshot: isReseller ? createResellerPriceSnapshot(adminPrice, resellerSellingPrice, quantity) : undefined,
      referralId: referralId || undefined,
      vendorId: product.vendorId || (product as any).vendor?.id || (product as any).storeId || (product as any).resellerId || undefined,
      storeId: product.vendorId || (product as any).vendor?.id || (product as any).storeId || undefined,
    } } });
  };

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const shareableUrl = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      if (userData?.uid) {
        url.searchParams.set('ref', userData.uid);
      } else if (referralId) {
        url.searchParams.set('ref', referralId);
      }
      return url.toString();
    } catch (_) {
      return window.location.href;
    }
  }, [userData, referralId]);

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  const copyToClipboardOriginal = () => {
    navigator.clipboard.writeText(shareableUrl);
    toast.success('Link copied to clipboard');
  };

  const regPrice = effectiveRegularPrice;
  const hasDiscount = regPrice > shopPrice && shopPrice > 0;
  const discountPercent = product.discount || (hasDiscount ? Math.round(((regPrice - shopPrice) / regPrice) * 100) : 0);
  const currentProfit = resellerSellingPrice - adminPrice;

  // Formatted Product Weight (only if vendor provided weight)
  const weightDisplay = useMemo(() => {
    const p = product as any;
    const rawWeight = p.weight 
      ?? p.specifications?.Weight 
      ?? p.specifications?.weight 
      ?? p.specifications?.['ওজন'];
    return formatProductWeight(rawWeight);
  }, [product]);

  // Vendor-selected Brand from RTDB product data
  const displayBrand = useMemo(() => {
    const p = product as any;
    const raw = p.brand 
      ?? p.brandName 
      ?? p.brandTitle 
      ?? p.selectedBrand
      ?? p.specifications?.Brand 
      ?? p.specifications?.brand 
      ?? p.specifications?.['ব্র্যান্ড'];

    if (!raw) return null;
    const str = String(typeof raw === 'object' && raw.name ? raw.name : raw).trim();
    if (!str) return null;
    if (/^(no brand|generic|n\/a|none|null|undefined|demo|test)$/i.test(str)) return null;
    return str;
  }, [product]);

  // Actual Sold Count from RTDB actual order/sales data
  const [actualSoldCount, setActualSoldCount] = useState<number>(() => {
    const p = product as any;
    return Number(p.soldCount ?? p.salesCount ?? p.totalSold ?? 0);
  });

  // Authentic Reviews & Rating from RTDB
  const [actualRating, setActualRating] = useState<number>(() => Number(product.rating || 0));
  const [actualReviewsCount, setActualReviewsCount] = useState<number>(() => Number(product.reviews || 0));

  useEffect(() => {
    let isSubscribed = true;
    const targetId = product.id;
    if (!targetId) return;

    const syncRealMetrics = async () => {
      try {
        const metrics = await fetchProductMetricsFromRTDB(targetId);
        if (isSubscribed) {
          setActualSoldCount(metrics.soldCount);
          if (metrics.reviewsCount > 0) {
            setActualRating(metrics.rating);
            setActualReviewsCount(metrics.reviewsCount);
          } else {
            setActualRating(Number(product.rating || 0));
            setActualReviewsCount(Number(product.reviews || 0));
          }
        }
      } catch (e) {
        console.warn('Notice syncing real product metrics from RTDB:', e);
      }
    };

    syncRealMetrics();

    return () => {
      isSubscribed = false;
    };
  }, [product.id, product.rating, product.reviews]);

  // Age / Baby / বয়স info (prominently shown in upper/middle section if provided)
  const ageInfo = useMemo(() => {
    const p = product as any;
    if (p.age && String(p.age).trim() !== '') return String(p.age).trim();
    if (p.ageGroup && String(p.ageGroup).trim() !== '') return String(p.ageGroup).trim();
    if (p.babyAge && String(p.babyAge).trim() !== '') return String(p.babyAge).trim();
    if (p.targetAge && String(p.targetAge).trim() !== '') return String(p.targetAge).trim();

    if (p.specifications && typeof p.specifications === 'object') {
      for (const [k, v] of Object.entries(p.specifications)) {
        if (/age|baby|বয়স|বাচ্চা/i.test(k) && v !== undefined && v !== null && String(v).trim() !== '') {
          return String(v).trim();
        }
      }
    }
    return null;
  }, [product]);

  return (
    <div className="flex flex-col space-y-2 sm:space-y-3">
      {/* Header Info */}
      <div>
        {/* Category / SKU Row - ONLY rendered if non-empty (Brand removed) */}
        {(() => {
          const items = [];
          if (product.category && String(product.category).trim()) {
            items.push(<span key="category">{String(product.category).trim()}</span>);
          }
          if (effectiveSku) {
            items.push(<span key="sku">SKU: {effectiveSku}</span>);
          }
          if (items.length === 0) return null;
          return (
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500 mb-0.5 font-medium">
              {items.map((item, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-slate-300">•</span>}
                  {item}
                </React.Fragment>
              ))}
            </div>
          );
        })()}
        
        <h1 className="text-base sm:text-xl lg:text-2xl font-bold text-slate-900 leading-snug mb-1">
          {product.name}
        </h1>
        
        {/* Rating & Reviews + Sold Count + Weight + Brand Row */}
        <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-2.5 gap-y-1 text-xs sm:text-sm mb-1.5 font-medium">
          {/* Rating / Review Stars - Real Data Only */}
          <div className="flex items-center gap-1.5">
            {actualReviewsCount > 0 && actualRating > 0 ? (
              <>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star}
                      className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                        star <= Math.round(actualRating) 
                          ? 'fill-amber-400 text-amber-400' 
                          : 'fill-slate-200 text-slate-200'
                      }`} 
                    />
                  ))}
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('reviews');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }} 
                  className="font-bold text-sky-600 hover:text-sky-700 hover:underline"
                >
                  {actualRating.toFixed(1)} ({actualReviewsCount} {actualReviewsCount === 1 ? 'Review' : 'Reviews'})
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1 text-slate-400">
                <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-300" />
                <span className="text-xs font-medium text-slate-400">No reviews</span>
              </div>
            )}
          </div>

          <span className="text-slate-300">•</span>

          {/* Sold Count based on RTDB actual order/sales data */}
          <div className="flex items-center gap-1 text-slate-700">
            <span className="font-bold text-slate-900">{actualSoldCount}</span>
            <span>বিক্রি হয়েছে</span>
          </div>

          {/* Product Weight - ONLY if Vendor gave weight */}
          {weightDisplay && (
            <>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1 text-slate-700">
                <span className="text-slate-500 font-normal">Weight:</span>
                <span className="font-bold text-slate-900">{weightDisplay}</span>
              </div>
            </>
          )}

          {/* Vendor-Selected Brand - Sourced directly from RTDB, displayed right beside Weight */}
          {displayBrand && (
            <>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1 text-slate-700">
                <span className="text-slate-500 font-normal">Brand:</span>
                <span className="font-bold text-slate-900">{displayBrand}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* Pricing & Stock & Age Info */}
      <div>
        <div className="flex flex-col gap-1 mb-1.5">
          {isReseller ? (
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
                ৳{adminPrice.toFixed(2)}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ভেন্ডর প্রাইস
              </span>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium">
                <span>স্টোর প্রাইস:</span>
                <span className="font-bold text-slate-900">৳{shopPrice.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                ৳{shopPrice.toFixed(2)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-base sm:text-lg text-slate-400 line-through font-medium">
                    ৳{regPrice.toFixed(2)}
                  </span>
                  {discountPercent > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700 rounded-md">
                      {discountPercent}% OFF
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {effectiveInStock ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              In Stock {effectiveStock > 0 ? `(${effectiveStock} available)` : ''}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
              Out of Stock
            </span>
          )}

          {/* Age / Baby / বয়স compact information if provided */}
          {ageInfo && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200/80">
              <span className="text-amber-800 font-bold">বয়স / Age:</span>
              <span className="font-extrabold text-slate-900">{ageInfo}</span>
            </span>
          )}
        </div>
      </div>
      
      {/* PROFESSIONAL RESELLER PRICING PANEL - For Resellers */}
      {isReseller && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-4 sm:p-5 border border-blue-100 shadow-sm"
        >
          <div className="flex items-center gap-1.5 mb-3">
            <DollarSign className="w-4 h-4 text-primary-main" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Professional Pricing</h3>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
            <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ভেন্ডর রিসেলার প্রাইস</p>
              <p className="text-base sm:text-lg font-black text-emerald-600">৳{adminPrice}</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">স্টোর প্রাইস</p>
              <p className="text-base sm:text-lg font-black text-slate-800">৳{shopPrice}</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm col-span-2 sm:col-span-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">মিনিমাম সেলিং প্রাইস</p>
              <p className="text-xs sm:text-sm font-bold text-slate-700">Min: <span className="text-slate-900 font-black">৳{minSellingPrice}</span></p>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs sm:text-sm font-bold text-slate-700">Your Selling Price</label>
              <button
                type="button"
                onClick={handleSaveResellerPrice}
                disabled={isSavingPrice || !!priceError || resellerSellingPrice < minSellingPrice}
                className={`text-xs font-bold px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 shadow-sm ${
                  isPriceSaved 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-primary-main text-white hover:bg-primary-dark active:scale-95 disabled:opacity-50'
                }`}
              >
                {isSavingPrice ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                ) : isPriceSaved ? (
                  <><Check className="w-3.5 h-3.5 text-emerald-700" /> Saved</>
                ) : (
                  'Save Price'
                )}
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">৳</span>
              <input 
                type="number" 
                value={resellerSellingPrice || ''}
                onChange={handlePriceChange}
                className={`w-full pl-7 pr-3 py-2 bg-white border ${priceError ? 'border-red-300 focus:ring-red-500' : 'border-blue-200 focus:ring-primary-main'} rounded-xl text-base font-black text-slate-900 focus:outline-none focus:ring-2 shadow-sm transition-all`}
                placeholder="Enter selling price"
              />
            </div>
            {priceError && (
              <p className="text-xs text-red-500 mt-1.5 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span> {priceError}
              </p>
            )}
          </div>
          
            <div className="bg-blue-600 rounded-xl p-3 sm:p-4 text-white shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -translate-y-16 translate-x-8 blur-2xl"></div>
              <h4 className="text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-2">Live Profit Calculation</h4>
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-blue-100">Customer Pays:</span>
                  <span className="font-bold">
                    ৳{Number(((resellerSellingPrice || 0) * quantity).toFixed(2))}
                    {quantity > 1 && <span className="text-[11px] text-blue-200 font-normal ml-1">(৳{resellerSellingPrice} × {quantity})</span>}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs sm:text-sm text-blue-200">
                  <span>Vendor Price:</span>
                  <span>
                    - ৳{Number((adminPrice * quantity).toFixed(2))}
                    {quantity > 1 && <span className="text-[11px] text-blue-300 font-normal ml-1">(৳{adminPrice} × {quantity})</span>}
                  </span>
                </div>
                {quantity > 1 && (
                  <div className="flex justify-between items-center text-xs sm:text-sm text-blue-200">
                    <span>Quantity:</span>
                    <span>{quantity} pcs</span>
                  </div>
                )}
                <div className="h-px bg-blue-500/50 my-1.5"></div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs sm:text-sm">Reseller Profit:</span>
                  <span className="text-base sm:text-lg font-black text-green-300">
                    ৳{Math.max(0, Number((((resellerSellingPrice || 0) - adminPrice) * quantity).toFixed(2)))}
                  </span>
                </div>
                {quantity > 1 && (
                  <p className="text-[10px] text-right text-emerald-200/90 font-medium">
                    (৳{Math.max(0, Number(((resellerSellingPrice || 0) - adminPrice).toFixed(2)))} / unit profit)
                  </p>
                )}
              </div>
            </div>
        </motion.div>
      )}

      {product.shortDescription && product.shortDescription.trim() !== '' && (
        <p className="text-slate-600 text-xs sm:text-sm leading-relaxed hidden sm:block">
          {product.shortDescription}
        </p>
      )}

      {/* Daraz-Style Color Family Selection */}
      {hasVariants && variantColors.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Color Family: <span className="font-extrabold text-slate-900">{selectedColor || variantColors[0]?.name}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {variantColors.map((c) => {
              const isSelected = (selectedColor || variantColors[0]?.name)?.toLowerCase() === c.name.toLowerCase();
              const isOutOfStock = isColorOutOfStock(c.name);

              return (
                <button
                  key={c.id || c.name}
                  type="button"
                  onClick={() => handleColorChange(c.name, c.image)}
                  className={`group relative flex items-center gap-2 p-1.5 pr-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary-main bg-sky-50/80 text-primary-main ring-2 ring-primary-main/20 font-bold shadow-2xs'
                      : isOutOfStock
                        ? 'border-dashed border-slate-200 bg-slate-50/70 text-slate-400 opacity-60'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                  title={isOutOfStock ? `${c.name} (Out of Stock)` : c.name}
                >
                  {c.image ? (
                    <div className="w-7 h-7 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      <img
                        referrerPolicy="no-referrer"
                        src={c.image}
                        alt={c.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    </div>
                  )}
                  <span>{c.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 ml-auto text-primary-main shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Daraz-Style Size Selection */}
      {hasVariants && variantSizes.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Size: <span className="font-extrabold text-slate-900">{selectedSize || variantSizes[0]?.name}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {variantSizes.map((s) => {
              const isSelected = (selectedSize || variantSizes[0]?.name)?.toLowerCase() === s.name.toLowerCase();
              const isOutOfStock = isSizeOutOfStock(s.name);

              return (
                <button
                  key={s.id || s.name}
                  type="button"
                  onClick={() => setSelectedSize(s.name)}
                  className={`min-w-[44px] h-9 px-3.5 text-xs font-bold rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'border-primary-main bg-sky-50 text-primary-main ring-2 ring-primary-main/20 font-extrabold shadow-xs'
                      : isOutOfStock
                        ? 'border-dashed border-slate-200 bg-slate-50 text-slate-400 opacity-60 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                  title={isOutOfStock ? `${s.name} (Out of Stock)` : s.name}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Legacy Color Options fallback if product has no Daraz variants */}
      {!hasVariants && legacyColors && Array.isArray(legacyColors) && legacyColors.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-bold text-slate-700">
            Color: <span className="font-semibold text-slate-900">{selectedColor || legacyColors[0]}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {legacyColors.map((c: string) => {
              const isSelected = (selectedColor || legacyColors[0]) === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    isSelected
                      ? 'border-primary-main bg-sky-50 text-primary-main shadow-2xs font-bold'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Legacy Size Options fallback if product has no Daraz variants */}
      {!hasVariants && legacySizes && Array.isArray(legacySizes) && legacySizes.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-bold text-slate-700">
            Size: <span className="font-semibold text-slate-900">{selectedSize || legacySizes[0]}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {legacySizes.map((s: string) => {
              const isSelected = (selectedSize || legacySizes[0]) === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSize(s)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    isSelected
                      ? 'border-primary-main bg-sky-50 text-primary-main shadow-2xs font-bold'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tags */}
      {(product as any).tags && Array.isArray((product as any).tags) && (product as any).tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs font-bold text-slate-500">Tags:</span>
          {(product as any).tags.map((tag: string, idx: number) => (
            <span
              key={idx}
              className="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <hr className="border-slate-100" />

      {/* Quantity, Wishlist and Share */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center border border-slate-200 rounded-xl bg-white h-11 px-1 shrink-0 shadow-2xs">
          <button 
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-9 h-full flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-90 font-bold text-lg rounded-lg transition-all"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-9 text-center font-bold text-sm text-slate-900">
            {quantity}
          </span>
          <button 
            type="button"
            onClick={() => {
              if (effectiveStock > 0 && quantity >= effectiveStock) {
                toast.error(`Only ${effectiveStock} items available in stock`);
                return;
              }
              setQuantity(quantity + 1);
            }}
            className="w-9 h-full flex items-center justify-center text-slate-700 hover:bg-slate-50 active:scale-90 font-bold text-lg rounded-lg transition-all"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button 
          type="button"
          onClick={handleWishlistClick}
          className="flex-1 sm:flex-none h-11 px-3 sm:px-4 flex items-center justify-center gap-1.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors bg-white font-medium text-xs sm:text-sm shadow-2xs"
        >
          <Heart className={`h-4 w-4 sm:h-5 sm:w-5 ${inWishlist ? 'fill-red-500 text-red-500' : 'text-slate-600'}`} />
          <span className="font-semibold text-xs sm:text-sm">{inWishlist ? 'Wishlisted' : 'Wishlist'}</span>
        </button>

        <button 
          type="button"
          onClick={handleShare}
          className="h-11 w-11 sm:w-auto sm:px-4 flex items-center justify-center gap-1.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors bg-white font-medium text-xs sm:text-sm shadow-2xs shrink-0"
          aria-label="Share product"
        >
          <Share2 className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" />
          <span className="hidden sm:inline font-semibold">Share</span>
        </button>
      </div>

      {/* Vendor / Store Info & View Shop Button */}
      <div className="flex items-center justify-between gap-3 p-2.5 sm:p-3 bg-slate-50/90 hover:bg-slate-50 rounded-xl border border-slate-200/80 mt-1 transition-all">
        {/* Store Logo + Store Name + Rating */}
        <div 
          onClick={() => navigate(`/store/${effectiveStoreId}`)}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1"
        >
          {/* Store Logo with verified badge on bottom-right */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden flex items-center justify-center p-0.5 group-hover:border-primary-main/60 transition-colors">
              {displayStoreLogo ? (
                <img 
                  src={displayStoreLogo} 
                  alt={displayStoreName} 
                  className="w-full h-full object-contain rounded-lg"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                    const parent = (e.target as HTMLElement).parentElement;
                    if (parent && !parent.querySelector('.store-fallback-icon')) {
                      const fallback = document.createElement('div');
                      fallback.className = 'store-fallback-icon w-full h-full rounded-lg bg-sky-50 text-primary-main flex items-center justify-center font-black text-sm';
                      fallback.innerText = (displayStoreName || 'S').charAt(0).toUpperCase();
                      parent.appendChild(fallback);
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full rounded-lg bg-sky-50 border border-sky-100/60 text-primary-main flex items-center justify-center font-bold text-sm">
                  {displayStoreName ? displayStoreName.charAt(0).toUpperCase() : <Store className="w-4 h-4 text-primary-main" />}
                </div>
              )}
            </div>

            {isStoreVerified && (
              <VerifiedBadge 
                className="absolute -bottom-1 -right-1 z-10" 
                title="অনুমোদিত ভেরিফাইড স্টোর" 
              />
            )}
          </div>

          {/* Store Name & Stats */}
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Sold By</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-primary-main transition-colors truncate">
                {displayStoreName}
              </h4>
              {isStoreVerified && (
                <VerifiedBadge 
                  title="অনুমোদিত ভেরিফাইড স্টোর" 
                />
              )}
            </div>

            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-0.5">
              {storeReviewsCount > 0 && storeRating > 0 ? (
                <>
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                  <span className="font-semibold text-slate-700">{storeRating.toFixed(1)}</span>
                  <span className="text-slate-400">({storeReviewsCount})</span>
                </>
              ) : (
                <>
                  <Star className="w-3 h-3 text-slate-300 shrink-0" />
                  <span className="text-slate-400">No reviews</span>
                </>
              )}
              {displayStoreJoined && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>Joined {displayStoreJoined}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* View Shop Button */}
        <button 
          type="button"
          id="top-view-shop-btn"
          onClick={() => navigate(`/store/${effectiveStoreId}`)} 
          className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 bg-white hover:bg-slate-100 active:scale-95 text-slate-800 rounded-lg sm:rounded-xl text-xs font-bold transition-all border border-slate-200 shadow-2xs whitespace-nowrap shrink-0 group"
        >
          <span>View Shop</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>

      <button 
        type="button"
        onClick={() => navigate(`/chat/${effectiveStoreId}?product=${product.id}`)} 
        className="w-full flex items-center justify-center gap-2 mt-1 bg-sky-50 text-primary-main font-bold py-2 sm:py-2.5 rounded-xl hover:bg-sky-100 active:scale-[0.99] transition-all border border-sky-100 text-xs sm:text-sm"
      >
        <MessageCircle className="w-4 h-4" /> Chat with Seller
      </button>

      {isReseller && (
        <button 
          onClick={handleShareToStore} 
          disabled={isAddingToStore}
          className={`w-full flex items-center justify-center gap-2 mt-2.5 font-bold py-2.5 rounded-xl transition-colors border text-xs sm:text-sm ${isAddedToStore ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'}`}
        >
          {isAddedToStore ? (
            <>
              <CheckCircle2 className="w-4 h-4" /> ✓ Added to My Store (View)
            </>
          ) : (
            <>
              <Store className="w-4 h-4" /> Share to My Store
            </>
          )}
        </button>
      )}

      {/* Desktop In-Page Action Buttons (Add to Cart & Buy Now directly in the product column) */}
      <div className="hidden lg:grid grid-cols-2 gap-3 pt-2">
        <button 
          type="button"
          onClick={handleAddToCart}
          disabled={!effectiveInStock || (isReseller && !!priceError)}
          className="w-full h-12 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold rounded-xl flex items-center justify-center gap-2 px-4 shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm xl:text-base cursor-pointer"
        >
          <ShoppingCart className="w-4 h-4" />
          {effectiveInStock ? 'Add to Cart' : 'Out of Stock'}
        </button>

        <button 
          type="button"
          onClick={handleBuyNow}
          disabled={!effectiveInStock || (isReseller && !!priceError)}
          className="w-full h-12 bg-primary-main hover:bg-sky-600 active:scale-[0.98] text-white font-bold rounded-xl flex items-center justify-center gap-2 px-4 shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm xl:text-base cursor-pointer"
        >
          <Zap className="w-4 h-4" />
          {effectiveInStock ? 'Buy Now' : 'Out of Stock'}
        </button>
      </div>

      {/* Fixed Sticky Daraz-style Bottom Action Bar (Mobile & Tablet ONLY - Hidden on Desktop lg+) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.12)] pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3">
          {/* Quick Action: Store */}
          <button
            type="button"
            onClick={() => navigate(`/store/${effectiveStoreId}`)}
            className="flex flex-col items-center justify-center min-w-[48px] sm:min-w-[56px] py-1 px-1 text-slate-600 hover:text-primary-main active:scale-95 transition-all text-center group shrink-0"
          >
            <Store className="w-5 h-5 text-slate-500 group-hover:text-primary-main transition-colors" />
            <span className="text-[10px] sm:text-xs font-semibold text-slate-600 group-hover:text-primary-main mt-0.5 whitespace-nowrap">দোকান</span>
          </button>

          {/* Quick Action: Chat */}
          <button
            type="button"
            onClick={() => navigate(`/chat/${effectiveStoreId}?product=${product.id}`)}
            className="flex flex-col items-center justify-center min-w-[48px] sm:min-w-[56px] py-1 px-1 text-slate-600 hover:text-primary-main active:scale-95 transition-all text-center group shrink-0"
          >
            <MessageCircle className="w-5 h-5 text-slate-500 group-hover:text-primary-main transition-colors" />
            <span className="text-[10px] sm:text-xs font-semibold text-slate-600 group-hover:text-primary-main mt-0.5 whitespace-nowrap">চ্যাট</span>
          </button>

          {/* Two Large Buttons Side-by-Side (Black & Blue Theme) */}
          <div className="flex-1 grid grid-cols-2 gap-2 sm:gap-3">
            {/* Add to Cart Button (Classic Black) */}
            <button 
              type="button"
              onClick={handleAddToCart}
              disabled={!effectiveInStock || (isReseller && !!priceError)}
              className="w-full h-11 sm:h-12 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold rounded-lg sm:rounded-xl flex items-center justify-center gap-1.5 px-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm md:text-base tracking-wide"
            >
              <ShoppingCart className="w-4 h-4 hidden sm:inline-block" />
              {effectiveInStock ? 'Add to Cart' : 'Out of Stock'}
            </button>

            {/* Buy Now Button (RJ WORLD BD Primary Blue) */}
            <button 
              type="button"
              onClick={handleBuyNow}
              disabled={!effectiveInStock || (isReseller && !!priceError)}
              className="w-full h-11 sm:h-12 bg-primary-main hover:bg-sky-600 active:scale-[0.98] text-white font-bold rounded-lg sm:rounded-xl flex items-center justify-center px-2 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm md:text-base tracking-wide"
            >
              {effectiveInStock ? 'Buy Now' : 'Out of Stock'}
            </button>
          </div>
        </div>
      </div>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={product.name}
        url={shareableUrl}
        description={product.shortDescription || product.name}
        badge={userData?.role === 'Reseller' ? 'Reseller Link' : (userData?.uid ? 'Affiliate Link' : undefined)}
      />
    </div>
  );
}
