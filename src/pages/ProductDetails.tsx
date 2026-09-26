import { safeStorage } from "../utils/storage";
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Heart, ShoppingCart, Building2, Truck, RefreshCw, ChevronRight, Copy, Download, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import ImageGallery from '../components/product/ImageGallery';
import ProductInfo from '../components/product/ProductInfo';
import ProductReviews from '../components/product/ProductReviews';
import RelatedProductsSection from '../components/product/RelatedProductsSection';
import { Product } from '../components/ui/ProductCard';
import { rtdbGet, rtdbPush, rtdbList } from '../lib/rtdb';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { fetchProductById, normalizeProduct } from '../services/productService';
import { updateClientSeo, resetDefaultSeo } from '../utils/seo';
import { formatDirectImageUrl, PLACEHOLDER_PRODUCT_IMAGE } from '../utils/imageUrl';

// Skeleton Loading Component
const ProductSkeleton = () => (
  <div className="animate-pulse">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 mb-6 sm:mb-12">
      <div className="lg:col-span-5 flex flex-col gap-2 sm:gap-3 w-full max-w-[340px] sm:max-w-[420px] lg:max-w-none mx-auto">
        <div className="aspect-square w-full bg-slate-200 rounded-xl sm:rounded-2xl"></div>
        <div className="flex gap-2 overflow-x-auto">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 aspect-square bg-slate-200 rounded-lg sm:rounded-xl shrink-0"></div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-7 space-y-4 pt-1 sm:pt-4">
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
        <div className="h-8 bg-slate-200 rounded w-3/4"></div>
        <div className="h-6 bg-slate-200 rounded w-1/4"></div>
        <div className="h-10 bg-slate-200 rounded w-1/3 mt-4"></div>
        <div className="space-y-2 mt-4">
          <div className="h-4 bg-slate-200 rounded w-full"></div>
          <div className="h-4 bg-slate-200 rounded w-full"></div>
          <div className="h-4 bg-slate-200 rounded w-2/3"></div>
        </div>
      </div>
    </div>
  </div>
);

export default function ProductDetails() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const stateProduct = location.state?.product;
  const { id: productId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const [productData, setProductData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [selectedVariantImage, setSelectedVariantImage] = useState<string | null>(null);

  const filteredSpecs = useMemo(() => {
    if (!productData?.specifications || typeof productData.specifications !== 'object') {
      return null;
    }
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(productData.specifications)) {
      if (value === undefined || value === null || String(value).trim() === '') continue;
      if (/weight|ওজন/i.test(key)) continue;
      if (/brand|ব্র্যান্ড/i.test(key)) continue;
      if (/age|baby|বয়স|বাচ্চা/i.test(key)) continue;
      result[key] = value;
    }
    return Object.keys(result).length > 0 ? result : null;
  }, [productData?.specifications]);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard!`);
  };

  const handleDownload = async (url: string, index: number) => {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${productData?.name ? productData.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() : 'product'}-image-${index + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      toast.success('Image downloaded successfully!');
    } catch (error) {
      console.warn('CORS download failed, falling back to new tab:', error);
      toast.success('Opening image... Please long-press or right-click to save.', { duration: 4000 });
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    let isMounted = true;

    const fetchProductData = async () => {
      setLoading(true);
      setNotFound(false);

      try {
        let rawProd: any = null;

        // 1. First attempt: If stateProduct is passed via navigation, initialize with it
        if (stateProduct) {
          rawProd = { ...stateProduct, id: stateProduct.id || productId };
        }

        // 2. Fetch authoritative product from RTDB by ID, slug, or generated slug
        if (productId) {
          const rtdbProd = await fetchProductById(productId);
          if (rtdbProd) {
            rawProd = rtdbProd;
          }
        }

        // If product still not found or explicitly archived/inactive/deleted, mark notFound
        const statusLower = String(rawProd?.status || '').toLowerCase();
        if (!rawProd || statusLower === 'archived' || statusLower === 'inactive' || statusLower === 'deleted') {
          if (isMounted) {
            setNotFound(true);
            setLoading(false);
            updateClientSeo(null, true);
          }
          return;
        }

        // Normalize images
        const rawFeat = rawProd.featuredImage || rawProd.image || rawProd.imageUrl || (Array.isArray(rawProd.images) ? rawProd.images[0] : '') || '';
        const featImg = formatDirectImageUrl(rawFeat);
        let rawImages: string[] = [];
        if (Array.isArray(rawProd.images) && rawProd.images.length > 0) {
          rawImages = rawProd.images.map((img: any) => typeof img === 'string' ? formatDirectImageUrl(img) : '').filter(Boolean);
        } else {
          rawImages = [rawFeat, rawProd.image2, rawProd.image3, rawProd.image4].filter(Boolean).map(img => formatDirectImageUrl(img)).filter(Boolean);
        }
        const filteredImages = rawImages.filter(img => typeof img === 'string' && img.trim() !== '');
        const finalImages = featImg && !filteredImages.includes(featImg)
          ? [featImg, ...filteredImages]
          : (filteredImages.length > 0 ? filteredImages : (featImg ? [featImg] : []));

        // Price calculations
        const regPrice = rawProd.regularPrice !== undefined && rawProd.regularPrice !== null
          ? Number(rawProd.regularPrice)
          : (rawProd.originalPrice ? Number(rawProd.originalPrice) : Number(rawProd.price) || 0);

        const currentPrice = Number(rawProd.price) || 0;
        const hasValidSale = rawProd.salePrice !== undefined && rawProd.salePrice !== null && Number(rawProd.salePrice) > 0 && Number(rawProd.salePrice) < regPrice;
        const effectivePrice = hasValidSale ? Number(rawProd.salePrice) : currentPrice;
        const discountPercent = rawProd.discount || (hasValidSale && regPrice > effectivePrice ? Math.round(((regPrice - effectivePrice) / regPrice) * 100) : undefined);

        // Parse arrays
        const colorsList = Array.isArray(rawProd.colors) 
          ? rawProd.colors.filter(Boolean)
          : (typeof rawProd.colors === 'string' && rawProd.colors.trim() ? rawProd.colors.split(',').map((c: string) => c.trim()).filter(Boolean) : undefined);

        const sizesList = Array.isArray(rawProd.sizes) 
          ? rawProd.sizes.filter(Boolean)
          : (typeof rawProd.sizes === 'string' && rawProd.sizes.trim() ? rawProd.sizes.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined);

        const tagsList = Array.isArray(rawProd.tags) 
          ? rawProd.tags.filter(Boolean)
          : (typeof rawProd.tags === 'string' && rawProd.tags.trim() ? rawProd.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined);

        // Normalize specifications
        let validSpecs: Record<string, string> | undefined = undefined;
        if (rawProd.specifications && typeof rawProd.specifications === 'object') {
          const entries = Object.entries(rawProd.specifications).filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '');
          if (entries.length > 0) {
            validSpecs = Object.fromEntries(entries) as Record<string, string>;
          }
        }

        // Resolve vendor-selected brand from RTDB product
        const rawBrand = rawProd.brand ?? rawProd.brandName ?? rawProd.brandTitle ?? rawProd.selectedBrand ?? rawProd.specifications?.Brand ?? rawProd.specifications?.brand ?? rawProd.specifications?.['ব্র্যান্ড'];
        const normalizedBrand = (rawBrand && typeof rawBrand === 'string' && rawBrand.trim() && !/^(no brand|generic|n\/a|none|null|undefined|demo|test)$/i.test(rawBrand.trim()))
          ? rawBrand.trim()
          : (rawBrand && typeof rawBrand === 'object' && rawBrand.name && typeof rawBrand.name === 'string' && rawBrand.name.trim() && !/^(no brand|generic|n\/a|none|null|undefined|demo|test)$/i.test(rawBrand.name.trim())
            ? rawBrand.name.trim() 
            : undefined);

        const normalized: any = {
          id: rawProd.id || productId,
          name: rawProd.name || rawProd.productName || rawProd.title || '',
          description: rawProd.description ? String(rawProd.description).trim() : '',
          shortDescription: rawProd.shortDescription ? String(rawProd.shortDescription).trim() : (rawProd.description ? String(rawProd.description).slice(0, 160).trim() : ''),
          image: featImg || finalImages[0] || '',
          images: finalImages,
          videoUrl: rawProd.videoUrl && String(rawProd.videoUrl).trim() !== '' ? String(rawProd.videoUrl).trim() : undefined,
          price: effectivePrice,
          regularPrice: regPrice,
          originalPrice: hasValidSale ? regPrice : undefined,
          discount: discountPercent,
          resellerPrice: rawProd.resellerPrice !== undefined && rawProd.resellerPrice !== null && Number(rawProd.resellerPrice) > 0 ? Number(rawProd.resellerPrice) : undefined,
          inStock: rawProd.inStock !== undefined ? !!rawProd.inStock : ((Number(rawProd.stock) || Number(rawProd.stockCount) || 0) > 0),
          stockCount: rawProd.stock !== undefined ? Number(rawProd.stock) : (rawProd.stockCount !== undefined ? Number(rawProd.stockCount) : undefined),
          sku: rawProd.sku && String(rawProd.sku).trim() !== '' ? String(rawProd.sku).trim() : undefined,
          brand: normalizedBrand,
          category: rawProd.category && String(rawProd.category).trim() !== '' ? String(rawProd.category).trim() : undefined,
          rating: Number(rawProd.rating) || 0,
          reviews: Number(rawProd.reviews) || 0,
          colors: colorsList && colorsList.length > 0 ? colorsList : undefined,
          sizes: sizesList && sizesList.length > 0 ? sizesList : undefined,
          tags: tagsList && tagsList.length > 0 ? tagsList : undefined,
          specifications: validSpecs,
          vendor: rawProd.vendor,
          vendorId: rawProd.vendorId || rawProd.storeId || rawProd.vendor?.id,
          storeId: rawProd.storeId || rawProd.vendorId,
          // Daraz-style Variant System
          hasVariants: !!rawProd.hasVariants,
          variantColors: Array.isArray(rawProd.variantColors) ? rawProd.variantColors : (rawProd.variantColors && typeof rawProd.variantColors === 'object' ? Object.values(rawProd.variantColors) : undefined),
          variantSizes: Array.isArray(rawProd.variantSizes) ? rawProd.variantSizes : (rawProd.variantSizes && typeof rawProd.variantSizes === 'object' ? Object.values(rawProd.variantSizes) : undefined),
          variants: Array.isArray(rawProd.variants) ? rawProd.variants : (rawProd.variants && typeof rawProd.variants === 'object' ? Object.values(rawProd.variants) : undefined),
          // Weight, Sales, and Age/Baby info
          weight: rawProd.weight !== undefined && rawProd.weight !== null ? rawProd.weight : undefined,
          soldCount: rawProd.soldCount !== undefined ? Number(rawProd.soldCount) : (rawProd.salesCount !== undefined ? Number(rawProd.salesCount) : undefined),
          salesCount: rawProd.salesCount !== undefined ? Number(rawProd.salesCount) : undefined,
          totalSold: rawProd.totalSold !== undefined ? Number(rawProd.totalSold) : undefined,
          age: rawProd.age || undefined,
          ageGroup: rawProd.ageGroup || undefined,
          babyAge: rawProd.babyAge || undefined,
          targetAge: rawProd.targetAge || undefined,
        };

        if (isMounted) {
          setProductData(normalized);
          setLoading(false);
          updateClientSeo(normalized);
        }

        // Cache recently viewed in localStorage
        if (normalized.id) {
          try {
            const rawStored = localStorage.getItem('rj_recently_viewed');
            const parsed = rawStored ? JSON.parse(rawStored) : [];
            const filtered = Array.isArray(parsed) ? parsed.filter((p: any) => p.id !== normalized.id) : [];
            const updated = [
              {
                id: normalized.id,
                name: normalized.name,
                price: Number(normalized.price) || 0,
                originalPrice: normalized.originalPrice ? Number(normalized.originalPrice) : undefined,
                image: normalized.image,
                rating: normalized.rating || 0,
                reviews: normalized.reviews || 0,
                discount: normalized.discount
              },
              ...filtered
            ].slice(0, 12);
            localStorage.setItem('rj_recently_viewed', JSON.stringify(updated));
          } catch {
            // Ignore quota errors
          }
        }
      } catch (err) {
        console.error("Error loading product from RTDB:", err);
        if (isMounted) {
          setNotFound(true);
          setLoading(false);
          updateClientSeo(null, true);
        }
      }
    };

    fetchProductData();

    // Handle Referral Tracking
    const refId = searchParams.get('ref');
    if (refId) {
      safeStorage.setItem('referralId', refId);
      try {
        rtdbPush('referral_tracking', {
          resellerId: refId,
          productId: productId || 'unknown',
          type: 'view',
          timestamp: Date.now()
        }).catch(() => {});
      } catch (e) {
        console.error('Failed to track referral', e);
      }
    }

    return () => {
      isMounted = false;
      resetDefaultSeo();
    };
  }, [productId, searchParams]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header />
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md w-full">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold">!</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Product Not Found</h2>
            <p className="text-slate-500 mb-6">The product you're looking for doesn't exist or has been removed.</p>
            <Link to="/" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-primary-main hover:bg-sky-600 transition-colors">
              Return Home
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      
      <main className="flex-grow pt-0 sm:pt-1.5 pb-6 sm:pb-10">
        <div className="max-w-7xl mx-auto px-0 sm:px-4 lg:px-8">
          {loading ? (
            <ProductSkeleton />
          ) : (
            <div className="flex flex-col gap-2 sm:gap-4">
              {/* SEO & Internal Linking Breadcrumb Trail */}
              {productData && (
                <nav aria-label="Breadcrumb" className="px-3 sm:px-0 py-1.5 sm:py-2 text-xs text-slate-500 flex items-center flex-wrap gap-1.5 font-medium">
                  <Link to="/" className="hover:text-sky-600 transition-colors">
                    হোম
                  </Link>
                  <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                  {productData.category && (
                    <>
                      <Link to={`/category/${encodeURIComponent(productData.category)}`} className="hover:text-sky-600 transition-colors">
                        {productData.category}
                      </Link>
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                    </>
                  )}
                  {productData.brand && (
                    <>
                      <span className="text-slate-600">{productData.brand}</span>
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                    </>
                  )}
                  <span className="text-slate-900 font-semibold truncate max-w-[200px] sm:max-w-md">
                    {productData.name}
                  </span>
                </nav>
              )}

              {/* Top Main Section: Modern Desktop & Mobile E-Commerce Layout */}
              <div className="bg-white p-0 sm:p-5 lg:p-6 rounded-none sm:rounded-2xl border-b sm:border border-slate-100 shadow-none sm:shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-0 sm:gap-6 lg:gap-8 xl:gap-10 items-start">
                {/* Left: Image Gallery (Desktop Sticky Sticky-Top so it stays visible while scrolling details) */}
                <div className="lg:col-span-5 xl:col-span-5 w-full lg:sticky lg:top-20 self-start">
                  <ImageGallery
                    images={productData?.images || []}
                    videoUrl={productData?.videoUrl}
                    activeImage={selectedVariantImage || undefined}
                  />
                  
                  {/* Delivery & Assurance Info - Desktop Box under Gallery */}
                  <div className="hidden lg:block mt-4 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100/90">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-start gap-2.5">
                        <Truck className="w-4 h-4 text-primary-main shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-tight">ফাস্ট ডেলিভারি</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">৩ - ৫ কার্যদিবসের মধ্যে</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <RefreshCw className="w-4 h-4 text-primary-main shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-tight">সহজ রিটার্ন পলিসি</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">৭ দিনের সহজ রিটার্ন</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Product Info & Actions */}
                <div className="lg:col-span-7 xl:col-span-7 w-full flex flex-col p-3 sm:p-0">
                  <ProductInfo
                    product={productData}
                    onVariantImageChange={setSelectedVariantImage}
                  />
                  
                  {/* Delivery Info - Mobile & Tablet only */}
                  <div className="lg:hidden mt-3 pt-2.5 border-t border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 sm:p-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <Truck className="w-4 h-4 text-primary-main shrink-0" />
                        <div className="min-w-0 text-xs">
                          <span className="font-bold text-slate-900">Delivery: </span>
                          <span className="text-[11px] text-slate-500">3-5 business days</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <RefreshCw className="w-4 h-4 text-primary-main shrink-0" />
                        <div className="min-w-0 text-xs">
                          <span className="font-bold text-slate-900">Return Policy: </span>
                          <span className="text-[11px] text-slate-500">7 days easy return</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reseller Marketing Tools */}
              {userData?.role === 'Reseller' && userData?.status === 'active' && (
                <div className="px-2.5 sm:px-0">
                  <div className="bg-blue-50/50 rounded-2xl p-3.5 sm:p-4 border border-blue-100">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-2.5 flex items-center gap-2">
                      <Star className="w-4 h-4 text-blue-600" />
                      Reseller Marketing Tools
                    </h3>
                    
                    <div className="space-y-2.5">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button 
                          onClick={() => handleCopy(productData?.name || '', 'Title')}
                          className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 bg-white border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50 font-semibold text-xs sm:text-sm transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy Title
                        </button>
                        <button 
                          onClick={() => handleCopy(productData?.description || productData?.shortDescription || '', 'Description')}
                          className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 bg-white border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50 font-semibold text-xs sm:text-sm transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy Description
                        </button>
                      </div>

                      {productData?.images && productData.images.length > 0 && (
                        <div className="bg-white rounded-xl p-3 border border-blue-100">
                          <h4 className="text-xs font-bold text-slate-800 mb-2">Download Product Assets</h4>
                          <div className="flex gap-2.5 overflow-x-auto pb-1 hide-scrollbar">
                            {productData.images.map((img: string, idx: number) => (
                              <div key={idx} className="flex flex-col items-center gap-1.5 shrink-0">
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shadow-2xs">
                                  <img referrerPolicy="no-referrer" src={img} alt="" className="w-full h-full object-cover" />
                                </div>
                                <button 
                                  onClick={() => handleDownload(img, idx)}
                                  className="flex items-center justify-center gap-1 w-full py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md transition-colors"
                                >
                                  <Download className="w-2.5 h-2.5" /> Save
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Main Content Areas: Stacked flow */}
              <div className="flex flex-col gap-3 sm:gap-4 px-2.5 sm:px-0">
                
                {/* Ratings & Reviews Section - Compact */}
                <div id="reviews" className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-2xs">
                  <ProductReviews productId={productData?.originalProductId || productData?.id || productId || ''} />
                </div>

                {/* Product Video Section - ONLY if videoUrl is provided */}
                {productData?.videoUrl && String(productData.videoUrl).trim() !== '' && (
                  <div className="bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-slate-100 shadow-2xs">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Product Video</h3>
                    <div className="aspect-video bg-black rounded-xl overflow-hidden">
                      {productData.videoUrl.includes('youtube.com') || productData.videoUrl.includes('youtu.be') ? (
                         <iframe 
                           src={productData.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} 
                           className="w-full h-full"
                           allowFullScreen
                           title="Product Video"
                         ></iframe>
                      ) : (
                         <video controls className="w-full h-full">
                           <source src={productData.videoUrl} />
                           Your browser does not support the video tag.
                         </video>
                      )}
                    </div>
                  </div>
                )}

                {/* Description Section - Compact: 2 lines with See More toggle */}
                {productData?.description && String(productData.description).trim() !== '' && (
                  <div className="bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-slate-100 shadow-2xs">
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Product Description</h2>
                    <div className="relative">
                      <div
                        className={`text-xs sm:text-sm text-slate-700 leading-relaxed transition-all ${
                          isDescriptionExpanded ? 'space-y-2' : 'line-clamp-2 max-h-[3.6rem] overflow-hidden'
                        }`}
                      >
                        {String(productData.description).split('\n').filter(Boolean).map((paragraph: string, idx: number) => (
                          <p key={idx}>{paragraph}</p>
                        ))}
                      </div>

                      <div className="mt-2 pt-0.5">
                        <button
                          type="button"
                          id="product-desc-toggle-btn"
                          onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary-main hover:text-sky-700 transition-colors"
                        >
                          <span>{isDescriptionExpanded ? 'See Less' : 'See More'}</span>
                          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isDescriptionExpanded ? '-rotate-90' : 'rotate-90'}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Specifications Section - ONLY if specifications exist after filtering weight & age */}
                {filteredSpecs && (
                  <div className="bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-slate-100 shadow-2xs">
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-2.5">Specifications</h2>
                    <div className="overflow-hidden border border-slate-200/80 rounded-xl">
                      <table className="min-w-full divide-y divide-slate-200">
                        <tbody className="divide-y divide-slate-100">
                          {Object.entries(filteredSpecs).map(([key, value], idx) => (
                            <tr key={key} className={idx % 2 === 0 ? 'bg-slate-50/70' : 'bg-white'}>
                              <td className="py-2 px-3 sm:px-4 text-xs font-semibold text-slate-700 w-1/3 md:w-1/4 bg-slate-50/80">
                                {key}
                              </td>
                              <td className="py-2 px-3 sm:px-4 text-xs text-slate-600">
                                {String(value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>

              {/* Daraz-Style Related Products Section from RTDB */}
              <div className="px-2.5 sm:px-0">
                <RelatedProductsSection
                  currentProduct={productData}
                  currentProductId={productData?.id || productId}
                  currentCategory={productData?.category}
                  currentBrand={productData?.brand}
                  currentTags={productData?.tags}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
