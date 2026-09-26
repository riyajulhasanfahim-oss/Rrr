import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShoppingCart, Eye, CheckCircle2, Store, Sparkles } from 'lucide-react';
import { Product } from '../ui/ProductCard';
import { useCart } from '../../contexts/CartContext';
import toast from 'react-hot-toast';
import { getProductPath } from '../../utils/seo';
import { fetchAllMarketplaceProducts, subscribeToMarketplaceProducts, getCachedMarketplaceProducts } from '../../services/productService';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../../utils/imageUrl';

export interface RelatedProductsSectionProps {
  currentProduct?: any;
  currentProductId?: string;
  currentCategory?: string;
  currentBrand?: string;
  currentTags?: string[] | string;
  products?: Product[];
}

export default function RelatedProductsSection({
  currentProduct,
  currentProductId,
  currentCategory,
  currentBrand,
  currentTags,
  products: initialProducts
}: RelatedProductsSectionProps) {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const activeId = currentProductId || currentProduct?.id || '';
  const activeCategory = currentCategory || currentProduct?.category || '';
  const activeBrand = currentBrand || currentProduct?.brand || '';

  const [relatedProducts, setRelatedProducts] = useState<Product[]>(() => {
    if (initialProducts && initialProducts.length > 0) {
      return initialProducts.filter(p => p.id !== activeId).slice(0, 18);
    }
    const cached = getCachedMarketplaceProducts();
    return cached.filter(p => p.id !== activeId).slice(0, 18);
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => relatedProducts.length === 0);

  useEffect(() => {
    let isMounted = true;

    const processAndSetProducts = (allCatalog: Product[]) => {
      if (!isMounted || !allCatalog || allCatalog.length === 0) return;

      // Filter out current active product
      const filteredCatalog = allCatalog.filter(p => {
        if (!p) return false;
        const pId = String(p.id || '').trim();
        if (activeId && (pId === String(activeId).trim() || pId === String(currentProduct?.id || '').trim())) {
          return false;
        }
        if (currentProduct?.slug && p.slug === currentProduct.slug) {
          return false;
        }
        return true;
      });

      // Relevance score based on vendor, category, brand, tags, and product name
      const currentVendorId = String(currentProduct?.vendorId || currentProduct?.vendor?.id || '').trim();
      const targetCatNorm = activeCategory.toLowerCase().trim();
      const targetBrandNorm = activeBrand.toLowerCase().trim();
      const rawTags = Array.isArray(currentTags) 
        ? currentTags 
        : (typeof currentTags === 'string' ? currentTags.split(',') : (currentProduct?.tags || []));
      const targetTagsNorm = (Array.isArray(rawTags) ? rawTags : [rawTags])
        .map((t: any) => String(t).toLowerCase().trim())
        .filter(Boolean);

      const nameKeywords = (currentProduct?.name || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, ' ')
        .split(/\s+/)
        .filter((w: string) => w.length >= 3 && !['and', 'the', 'for', 'with', 'pro', 'all', 'new'].includes(w));

      const scoredProducts = filteredCatalog.map(prod => {
        let score = 0;
        const pVendorId = String(prod.vendorId || prod.vendor?.id || '').trim();
        const pCat = (prod.category || '').toLowerCase().trim();
        const pBrand = (prod.brand || '').toLowerCase().trim();
        const pTags = (prod.tags || []).map(t => t.toLowerCase().trim());
        const pName = (prod.name || '').toLowerCase();

        // Same vendor match - huge priority to show other items by the same vendor
        if (currentVendorId && pVendorId && currentVendorId === pVendorId) {
          score += 50;
        }

        // Real vendor registered product boost
        if (pVendorId && (prod.vendor?.storeName || prod.vendor?.name)) {
          score += 30;
        }

        // Category match
        if (targetCatNorm && pCat) {
          if (pCat === targetCatNorm) score += 30;
          else if (pCat.includes(targetCatNorm) || targetCatNorm.includes(pCat)) score += 15;
        }

        // Brand match
        if (targetBrandNorm && pBrand && targetBrandNorm !== 'no brand' && targetBrandNorm !== 'generic') {
          if (pBrand === targetBrandNorm) score += 25;
          else if (pBrand.includes(targetBrandNorm) || targetBrandNorm.includes(pBrand)) score += 12;
        }

        // Tags overlap
        if (targetTagsNorm.length > 0 && pTags.length > 0) {
          const overlapCount = targetTagsNorm.filter(t => pTags.includes(t)).length;
          score += overlapCount * 10;
        }

        // Name keywords
        if (nameKeywords.length > 0) {
          let matches = 0;
          for (const kw of nameKeywords) {
            if (pName.includes(kw)) matches++;
          }
          score += matches * 6;
        }

        return { prod, score };
      });

      scoredProducts.sort((a, b) => b.score - a.score);
      const finalResults = scoredProducts.map(s => s.prod).slice(0, 18);

      setRelatedProducts(finalResults);
      setIsLoading(false);
    };

    if (relatedProducts.length === 0) {
      setIsLoading(true);
    }

    fetchAllMarketplaceProducts()
      .then((all) => {
        processAndSetProducts(all);
      })
      .catch((err) => {
        console.warn('[RelatedProducts] Notice:', err);
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const unsubscribe = subscribeToMarketplaceProducts((liveList) => {
      processAndSetProducts(liveList);
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [activeId, activeCategory, activeBrand, currentProduct, currentTags, initialProducts]);

  const handleCardClick = (product: Product) => {
    navigate(getProductPath(product), { state: { product } });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
      image: product.featuredImage || product.image || (product.images && product.images[0]) || '',
      quantity: 1,
      vendorId: product.vendorId
    });
    toast.success(`${product.name} কার্টে যুক্ত হয়েছে`);
  };

  // Skeleton during loading
  if (isLoading && relatedProducts.length === 0) {
    return (
      <section id="related-products-section" className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 mt-4 sm:mt-6">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-4">Related Products</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden animate-pulse">
              <div className="aspect-square bg-slate-200" />
              <div className="p-2.5 space-y-2">
                <div className="h-3.5 bg-slate-200 rounded w-4/5" />
                <div className="h-4 bg-slate-200 rounded w-1/2 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // If no products found, hide section completely
  if (!isLoading && relatedProducts.length === 0) {
    return null;
  }

  return (
    <section 
      id="related-products-section"
      className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs mt-4 sm:mt-6"
    >
      {/* Clean, Simple Heading */}
      <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-4">
        Related Products
      </h2>

      {/* Related Products Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {relatedProducts.map((product) => {
          const currentPrice = Number(product.price) || 0;
          const originalPrice = product.originalPrice ? Number(product.originalPrice) : undefined;
          const discountPercent = product.discount || (
            originalPrice && originalPrice > currentPrice
              ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
              : undefined
          );

          return (
            <div
              key={product.id}
              onClick={() => handleCardClick(product)}
              className="group bg-white rounded-xl border border-slate-200 hover:border-slate-400/80 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer h-full"
            >
              {/* Product Image */}
              <div className="relative aspect-square w-full overflow-hidden bg-slate-50 shrink-0">
                <img
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  draggable={false}
                  src={formatDirectImageUrl(product.featuredImage || product.image || (product.images && product.images[0])) || PLACEHOLDER_PRODUCT_IMAGE}
                  alt={product.name}
                  onError={(e) => handleProductImageError(e)}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300 select-none"
                />

                {/* Discount Badge */}
                {discountPercent ? (
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded shadow-2xs pointer-events-none">
                    -{discountPercent}%
                  </span>
                ) : null}
              </div>

              {/* Product Details */}
              <div className="p-2.5 flex flex-col flex-1 justify-between gap-1.5">
                <div>
                  {/* Stock Indicator & Vendor Store Badge */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> স্টক আছে
                    </span>
                    {(product.vendor?.storeName || product.vendor?.name) && (
                      <span className="text-[10px] font-medium text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 inline-flex items-center gap-1 max-w-[130px] truncate">
                        <Store className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                        <span className="truncate">{product.vendor?.storeName || product.vendor?.name}</span>
                      </span>
                    )}
                  </div>

                  {/* Product Name */}
                  <Link 
                    to={getProductPath(product)}
                    state={{ product }}
                    onClick={(e) => e.stopPropagation()}
                    className="block text-xs sm:text-[13px] font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-primary-main transition-colors"
                    title={product.name}
                  >
                    <h3>{product.name}</h3>
                  </Link>
                </div>

                {/* Price & Order Action */}
                <div className="mt-auto pt-1">
                  <div className="flex items-baseline gap-1.5 flex-wrap mb-2">
                    <span className="text-sm sm:text-base font-bold text-slate-900">
                      ৳{currentPrice.toFixed(0)}
                    </span>
                    {originalPrice && originalPrice > currentPrice && (
                      <span className="text-[11px] text-slate-400 line-through">
                        ৳{originalPrice.toFixed(0)}
                      </span>
                    )}
                  </div>

                  {/* Order & Cart Buttons */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={(e) => handleAddToCart(e, product)}
                      className="w-full py-1.5 px-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-lg text-[10px] sm:text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-200"
                      title="কার্টে যোগ করুন"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      <span className="truncate">কার্ট</span>
                    </button>

                    <button
                      onClick={() => handleCardClick(product)}
                      className="w-full py-1.5 px-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer"
                      title="অর্ডার করুন"
                    >
                      <Eye className="w-3 h-3" />
                      <span className="truncate">অর্ডার</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
