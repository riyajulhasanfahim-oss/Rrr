import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShoppingCart, Heart, Star, Check, Sparkles, Flame, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { useWishlist } from '../../contexts/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import { getProductPath } from '../../utils/seo';
import { getCachedProductMetrics, fetchProductMetricsFromRTDB } from '../../services/productMetricsService';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../../utils/imageUrl';
import { useLanguage } from '../common/LanguageProvider';
import toast from 'react-hot-toast';

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  featuredImage?: string;
  images?: string[];
  rating?: number;
  reviews?: number;
  reviewsCount?: number;
  soldCount?: number;
  salesCount?: number;
  totalSold?: number;
  isNew?: boolean;
  discount?: number;
  vendorId?: string;
  vendor?: any;
  category?: string;
  categorySlug?: string;
  brand?: string;
  description?: string;
  tags?: string[];
  keywords?: string[];
  stock?: number;
  inStock?: boolean;
  weight?: number | string;
  specifications?: Record<string, any>;
  resellerPrice?: number;
  resellerProfit?: number;
  source?: string;
  createdAt?: number;
  updatedAt?: number;
  slug?: string;
}

interface ProductCardProps {
  product: Product;
  showAddToCart?: boolean;
  badgeText?: string;
}

export default function ProductCard({ product, showAddToCart = false, badgeText }: ProductCardProps) {
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { userData } = useAuth();
  const { t, language } = useLanguage();
  const [isAdded, setIsAdded] = useState(false);
  
  const inWishlist = isInWishlist(product.id);
  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inWishlist) {
      removeFromWishlist(product.id);
      toast.success(language === 'bn' ? 'উইশলিস্ট থেকে সরানো হয়েছে' : 'Removed from wishlist');
    } else {
      addToWishlist({
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.featuredImage || product.image || (product.images && product.images.length > 0 ? product.images[0] : ""),
        addedAt: Date.now()
      });
      toast.success(language === 'bn' ? 'উইশলিস্টে যুক্ত করা হয়েছে!' : 'Added to wishlist!');
    }
  };

  const isReseller = userData?.role === 'Reseller' || userData?.hasActiveReseller === true;
  const isVendorOrAdmin = userData?.role === 'Vendor' || userData?.role === 'Admin';
  
  const shopPrice = Number(product.price) || 0;
  const hasVendorResellerPrice = product.resellerPrice !== undefined && product.resellerPrice !== null && Number(product.resellerPrice) > 0;
  // Resellers see exactly the vendor-provided resellerPrice, or the regular shopPrice if none is specified
  const resellerPrice = hasVendorResellerPrice ? Number(product.resellerPrice) : shopPrice;

  const handleQuickAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const effectiveAddPrice = isReseller ? resellerPrice : (Number(product.price) || 0);
    addToCart({
      id: product.id,
      name: product.name,
      price: effectiveAddPrice,
      originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
      image: product.featuredImage || product.image || (product.images && product.images[0]) || '',
      quantity: 1,
      vendorId: product.vendorId,
      weight: product.weight ?? (product.specifications?.Weight || product.specifications?.weight),
      specifications: product.specifications,
      adminPrice: isReseller ? resellerPrice : undefined,
      resellerSellingPrice: isReseller ? resellerPrice : undefined
    });
    setIsAdded(true);
    toast.success(`${product.name} কার্টে যুক্ত হয়েছে!`);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const regularPrice = product.originalPrice && product.originalPrice > shopPrice ? Number(product.originalPrice) : undefined;
  const discountPercent = product.discount || (regularPrice ? Math.round(((regularPrice - shopPrice) / regularPrice) * 100) : undefined);

  // Real sales & review metrics from RTDB
  const cachedMetrics = product.id ? getCachedProductMetrics(product.id) : null;
  const [metrics, setMetrics] = useState<{ soldCount: number; rating: number; reviewsCount: number } | null>(cachedMetrics);

  useEffect(() => {
    if (product.id && !metrics) {
      let isMounted = true;
      fetchProductMetricsFromRTDB(product.id).then(m => {
        if (isMounted) setMetrics(m);
      });
      return () => { isMounted = false; };
    }
  }, [product.id, metrics]);

  const soldCount = metrics?.soldCount 
    ?? Number(product.soldCount ?? product.salesCount ?? product.totalSold ?? 0);

  const reviewsCount = metrics?.reviewsCount 
    ?? Number(product.reviewsCount ?? product.reviews ?? 0);

  const rating = metrics?.rating 
    ?? (reviewsCount > 0 ? Number(product.rating || 0) : 0);

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="group bg-white rounded-2xl border border-slate-200/90 hover:border-sky-400/80 shadow-2xs hover:shadow-xl transition-all duration-300 h-full flex flex-col overflow-hidden relative"
    >
      {/* 1. Image & Badges Container */}
      <div className="relative aspect-square overflow-hidden bg-slate-100 block">
        <Link to={getProductPath(product)} state={{ product }} className="block w-full h-full relative">
          <img 
            referrerPolicy="no-referrer" 
            loading="lazy" 
            src={formatDirectImageUrl(product.featuredImage || product.image || (product.images && product.images.length > 0 ? product.images[0] : '')) || PLACEHOLDER_PRODUCT_IMAGE} 
            alt={`${product.name} - ${product.brand || 'RJ WORLD BD'}`}
            onError={(e) => handleProductImageError(e)}
            className="w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-500 ease-out"
          />

          {/* Dark gradient overlay on hover for contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </Link>
        
        {/* Floating Badges (Top-Left) */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
          {discountPercent && discountPercent > 0 && (
            <span className="px-2 py-0.5 text-[10px] sm:text-[11px] font-extrabold bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-full shadow-sm flex items-center gap-0.5 animate-pulse">
              <Flame className="w-2.5 h-2.5 fill-white" />
              <span>-{discountPercent}%</span>
            </span>
          )}
          {product.isNew && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-sky-600 text-white rounded-full shadow-xs">
              ✨ নতুন
            </span>
          )}
          {badgeText && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full shadow-xs">
              {badgeText}
            </span>
          )}
        </div>

        {/* Floating Wishlist Button (Top-Right) */}
        <div className="absolute right-2 top-2 z-10">
          <button 
            type="button"
            onClick={handleWishlistClick}
            className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-200 shadow-sm cursor-pointer ${
              inWishlist 
                ? 'bg-rose-50 text-rose-500 border border-rose-200' 
                : 'bg-white/90 text-slate-400 hover:text-rose-500 hover:bg-white hover:scale-110'
            }`}
            title={inWishlist ? 'উইশলিস্টে আছে' : 'উইশলিস্টে যোগ করুন'}
          >
            <Heart className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${inWishlist ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>

        {/* Stock status overlay if out of stock */}
        {product.inStock === false && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center z-15 pointer-events-none">
            <span className="px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg shadow-md">
              স্টক শেষ
            </span>
          </div>
        )}
      </div>

      {/* 2. Product Content Area */}
      <div className="p-3 sm:p-3.5 flex flex-col flex-grow justify-between gap-1.5">
        
        <div>
          {/* Category / Brand mini tag */}
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 mb-1">
            <span className="truncate font-medium uppercase tracking-wider text-slate-500">
              {product.brand || product.category || 'Lifestyle'}
            </span>
            <span className="hidden sm:inline text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded">
              {t('Verified Seller')}
            </span>
          </div>

          {/* Product Title */}
          <Link to={getProductPath(product)} state={{ product }} className="block group/link">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-2 group-hover/link:text-sky-600 transition-colors leading-snug">
              {product.name}
            </h3>
          </Link>
        </div>

        {/* 3. Rating & Social Proof */}
        <div className="flex items-center justify-between gap-1 pt-1 text-[11px]">
          <div className="flex items-center gap-1">
            <Star className={`h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 ${reviewsCount > 0 ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
            {reviewsCount > 0 ? (
              <>
                <span className="font-bold text-slate-700">{rating.toFixed(1)}</span>
                <span className="text-slate-400 text-[10px]">({reviewsCount})</span>
              </>
            ) : (
              <span className="text-slate-400 text-[10px]">{language === 'bn' ? 'রিভিউ নেই' : 'No reviews'}</span>
            )}
          </div>
          
          <span className="text-[10px] text-slate-400 font-medium truncate">
            {soldCount > 0 
              ? `${soldCount} ${language === 'bn' ? 'বিক্রি' : 'sold'}` 
              : `0 ${language === 'bn' ? 'বিক্রি' : 'sold'}`}
          </span>
        </div>

        {/* 4. Pricing & Quick Add Button Row */}
        <div className="pt-2 border-t border-slate-100 mt-1">
          <div className="flex items-center justify-between gap-2">
            
            {/* Price Column */}
            <div className="flex flex-col min-w-0">
              {isVendorOrAdmin ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs sm:text-sm font-bold text-sky-600">৳{shopPrice.toFixed(0)}</span>
                    <span className="text-[9px] text-slate-400">{t('My Store')}</span>
                  </div>
                  {hasVendorResellerPrice && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs sm:text-sm font-bold text-emerald-600">৳{resellerPrice.toFixed(0)}</span>
                      <span className="text-[9px] text-emerald-600 font-semibold">{t('Reseller')}</span>
                    </div>
                  )}
                </>
              ) : isReseller ? (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-sm sm:text-base font-extrabold text-emerald-600">
                      ৳{resellerPrice.toFixed(0)}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1 py-0.2 rounded">
                      {t('Reseller')}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 text-[11px] text-slate-500 font-medium">
                    <span>{language === 'bn' ? 'স্টোর প্রাইস:' : 'Store Price:'}</span>
                    <span className="font-bold text-slate-700">৳{shopPrice.toFixed(0)}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                      ৳{shopPrice.toFixed(0)}
                    </span>
                    {regularPrice && regularPrice > shopPrice && (
                      <span className="text-[11px] text-slate-400 line-through">
                        ৳{regularPrice.toFixed(0)}
                      </span>
                    )}
                  </div>
                  {regularPrice && regularPrice > shopPrice && (
                    <span className="text-[10px] font-semibold text-emerald-600 block">
                      {language === 'bn' ? `বাঁচবে ৳${(regularPrice - shopPrice).toFixed(0)}` : `Save ৳${(regularPrice - shopPrice).toFixed(0)}`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quick Cart Button (Inline Compact) */}
            {!showAddToCart && (
              <button
                type="button"
                onClick={handleQuickAddToCart}
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 ${
                  isAdded 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-sky-50 hover:bg-sky-600 text-sky-600 hover:text-white border border-sky-100 hover:border-sky-600'
                }`}
                title={t('Add to Cart')}
              >
                {isAdded ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
              </button>
            )}

          </div>

          {/* Full Width Button (if requested) */}
          {showAddToCart && (
            <button
              type="button"
              onClick={handleQuickAddToCart}
              className={`w-full mt-2 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98 ${
                isAdded 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-sky-600 hover:bg-sky-700 text-white'
              }`}
            >
              {isAdded ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'কার্টে যুক্ত হয়েছে' : 'Added to Cart'}</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>{t('Add to Cart')}</span>
                </>
              )}
            </button>
          )}

        </div>

      </div>
    </motion.div>
  );
}
