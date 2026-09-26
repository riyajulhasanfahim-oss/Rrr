import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { rtdbGet, rtdbUpdate, rtdbPush } from '../../../lib/rtdb';
import VendorLayout from '../../../components/layout/VendorLayout';
import { ArrowLeft, Save, UploadCloud, Copy, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { StorageManager } from '../../../services/storage/StorageManager';
import ProductVariantManager from '../../../components/vendor/ProductVariantManager';
import { ProductColor, ProductSize, ProductVariant } from '../../../types/variant';
import { generateProductSlug } from '../../../utils/seo';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../../../utils/imageUrl';
import { MAIN_CATEGORIES } from '../../../constants/categories';

interface ProductFormProps {
  productId?: string; // If provided, it's edit mode
}

export default function ProductForm({ productId }: ProductFormProps) {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const isEditMode = !!productId;
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [existingData, setExistingData] = useState<any>(null);
  
  // Product Variants state
  const [hasVariants, setHasVariants] = useState<boolean>(false);
  const [variantColors, setVariantColors] = useState<ProductColor[]>([]);
  const [variantSizes, setVariantSizes] = useState<ProductSize[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    category: '',
    subCategory: '',
    brand: '',
    sku: '',
    price: '', // Regular Price
    salePrice: '',
    resellerPrice: '',
    costPrice: '',
    stock: '',
    lowStockAlert: '5',
    status: 'Published',
    seoTitle: '',
    metaDescription: '',
    metaKeywords: '',
    featuredImage: '', // Image 1
    image2: '',        // Image 2
    image3: '',        // Image 3
    image4: '',        // Image 4
    videoUrl: '',
    weight: '',
    discountPercentage: '', // Vendor discount percentage (%)
    discountCode: '',       // Vendor discount coupon code
  });

  const [uploadingImages, setUploadingImages] = useState<Record<string, boolean>>({});
  const [copiedLinks, setCopiedLinks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isEditMode && productId) {
      const fetchProduct = async () => {
        try {
          const data = await rtdbGet<any>(`products/${productId}`);
          
          if (data) {
            setExistingData(data);

            const rawFeat = data.featuredImage || data.image || data.imageUrl || (Array.isArray(data.images) ? data.images[0] : '') || '';
            const feat = formatDirectImageUrl(rawFeat);
            let img2 = formatDirectImageUrl(data.image2 || '');
            let img3 = formatDirectImageUrl(data.image3 || '');
            let img4 = formatDirectImageUrl(data.image4 || '');

            if (!img2 && !img3 && !img4 && Array.isArray(data.images)) {
              const others = data.images.filter((img: string) => img && formatDirectImageUrl(img) !== feat);
              img2 = formatDirectImageUrl(others[0] || (data.images[1] && formatDirectImageUrl(data.images[1]) !== feat ? data.images[1] : '') || '');
              img3 = formatDirectImageUrl(others[1] || (data.images[2] && formatDirectImageUrl(data.images[2]) !== feat ? data.images[2] : '') || '');
              img4 = formatDirectImageUrl(others[2] || (data.images[3] && formatDirectImageUrl(data.images[3]) !== feat ? data.images[3] : '') || '');
            }

            let regularPriceStr = '';
            let salePriceStr = '';
            if (data.regularPrice !== undefined && data.regularPrice !== null) {
              regularPriceStr = data.regularPrice.toString();
              salePriceStr = data.salePrice !== undefined && data.salePrice !== null ? data.salePrice.toString() : '';
            } else if (data.originalPrice && data.price && Number(data.originalPrice) > Number(data.price)) {
              regularPriceStr = data.originalPrice.toString();
              salePriceStr = data.price.toString();
            } else {
              regularPriceStr = data.price !== undefined && data.price !== null ? data.price.toString() : '';
              salePriceStr = data.salePrice !== undefined && data.salePrice !== null ? data.salePrice.toString() : '';
            }

            setFormData({
              name: data.name || data.productName || data.title || '',
              slug: data.slug || '',
              description: data.description || '',
              category: data.category || '',
              subCategory: data.subCategory || '',
              brand: data.brand || '',
              sku: data.sku || '',
              price: regularPriceStr,
              salePrice: salePriceStr,
              resellerPrice: data.resellerPrice !== undefined && data.resellerPrice !== null ? data.resellerPrice.toString() : '',
              costPrice: data.costPrice !== undefined && data.costPrice !== null ? data.costPrice.toString() : '',
              stock: data.stock !== undefined && data.stock !== null ? data.stock.toString() : (data.stockCount !== undefined ? data.stockCount.toString() : ''),
              lowStockAlert: data.lowStockAlert !== undefined && data.lowStockAlert !== null ? data.lowStockAlert.toString() : '5',
              status: data.status || 'Published',
              seoTitle: data.seoTitle || '',
              metaDescription: data.metaDescription || '',
              metaKeywords: Array.isArray(data.metaKeywords) ? data.metaKeywords.join(', ') : (data.metaKeywords || ''),
              featuredImage: feat,
              image2: img2,
              image3: img3,
              image4: img4,
              videoUrl: data.videoUrl || '',
              weight: data.weight !== undefined && data.weight !== null ? data.weight.toString() : '',
              discountPercentage: data.discountPercentage !== undefined && data.discountPercentage !== null 
                ? data.discountPercentage.toString() 
                : (data.discountPercent !== undefined && data.discountPercent !== null ? data.discountPercent.toString() : ''),
              discountCode: data.discountCode || data.couponCode || '',
            });

            // Load Variant Data if present
            const loadedHasVariants = !!(
              data.hasVariants ||
              (Array.isArray(data.variants) && data.variants.length > 0) ||
              (data.variants && typeof data.variants === 'object' && Object.keys(data.variants).length > 0)
            );
            setHasVariants(loadedHasVariants);

            // Normalize colors
            let parsedColors: ProductColor[] = [];
            if (Array.isArray(data.variantColors) && data.variantColors.length > 0) {
              parsedColors = data.variantColors;
            } else if (Array.isArray(data.colors) && data.colors.length > 0) {
              parsedColors = data.colors.map((c: any, idx: number) =>
                typeof c === 'object' && c && c.name
                  ? { id: c.id || `col_${idx}`, name: c.name, image: c.image || '' }
                  : { id: `col_${idx}`, name: String(c), image: '' }
              );
            } else if (typeof data.colors === 'string' && data.colors.trim()) {
              parsedColors = data.colors
                .split(',')
                .map((c: string, idx: number) => ({ id: `col_${idx}`, name: c.trim(), image: '' }));
            }
            setVariantColors(parsedColors);

            // Normalize sizes
            let parsedSizes: ProductSize[] = [];
            if (Array.isArray(data.variantSizes) && data.variantSizes.length > 0) {
              parsedSizes = data.variantSizes;
            } else if (Array.isArray(data.sizes) && data.sizes.length > 0) {
              parsedSizes = data.sizes.map((s: any, idx: number) =>
                typeof s === 'object' && s && s.name
                  ? { id: s.id || `size_${idx}`, name: s.name }
                  : { id: `size_${idx}`, name: String(s) }
              );
            } else if (typeof data.sizes === 'string' && data.sizes.trim()) {
              parsedSizes = data.sizes
                .split(',')
                .map((s: string, idx: number) => ({ id: `size_${idx}`, name: s.trim() }));
            }
            setVariantSizes(parsedSizes);

            // Normalize variants
            let parsedVariants: ProductVariant[] = [];
            if (Array.isArray(data.variants)) {
              parsedVariants = data.variants;
            } else if (data.variants && typeof data.variants === 'object') {
              parsedVariants = Object.values(data.variants);
            }
            setVariants(parsedVariants);
          } else {
            toast.error("Product not found");
            navigate('/vendor/products');
          }
        } catch (error) {
          console.error("Error fetching product from RTDB:", error);
          toast.error("Failed to load product details");
        } finally {
          setInitialLoading(false);
        }
      };
      
      fetchProduct();
    }
  }, [isEditMode, productId, navigate]);

  // Generate Slug from Name if empty
  useEffect(() => {
    if (!isEditMode && formData.name && !formData.slug) {
      const generatedSlug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setFormData(prev => ({ ...prev, slug: generatedSlug }));
    }
  }, [formData.name, isEditMode, formData.slug]);

  // Generate SKU if empty
  useEffect(() => {
    if (!isEditMode && formData.name && !formData.sku) {
      const prefix = formData.name.substring(0, 3).toUpperCase();
      const random = Math.floor(1000 + Math.random() * 9000);
      setFormData(prev => ({ ...prev, sku: `${prefix}-${random}` }));
    }
  }, [formData.name, isEditMode, formData.sku]);

  const handleImageUpload = async (field: 'featuredImage' | 'image2' | 'image3' | 'image4', e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploadingImages[field]) return;

    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Unsupported file format. Please upload PNG, JPG, GIF, WEBP, AVIF, or BMP.');
      e.target.value = '';
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Image size must be less than 25MB');
      e.target.value = '';
      return;
    }

    setUploadingImages(prev => ({ ...prev, [field]: true }));

    try {
      const storedRecord = await StorageManager.uploadProductImage(file, {
        vendorId: user?.uid,
        productId: isEditMode ? productId : undefined,
      });

      if (storedRecord?.fileUrl) {
        const safeUrl = formatDirectImageUrl(storedRecord.fileUrl);
        setFormData(prev => ({ ...prev, [field]: safeUrl }));
        toast.success('Image uploaded successfully');
      } else {
        throw new Error('Failed to retrieve uploaded image URL');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Error uploading image');
    } finally {
      setUploadingImages(prev => ({ ...prev, [field]: false }));
      if (e.target) e.target.value = '';
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLinks(prev => ({ ...prev, [key]: true }));
    toast.success('Copied to clipboard');
    setTimeout(() => {
      setCopiedLinks(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const renderImageField = (
    label: string, 
    field: 'featuredImage' | 'image2' | 'image3' | 'image4', 
    value: string, 
    required: boolean,
    sizeHint?: string
  ) => (
    <div key={field}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="block text-xs font-semibold text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {sizeHint && (
          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
            {sizeHint}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="url"
            required={required}
            name={field}
            value={value}
            onChange={(e) => {
              const val = e.target.value;
              setFormData(prev => ({ ...prev, [field]: val }));
            }}
            placeholder={required ? "Direct Image URL (e.g. https://.../image.jpg)" : "Optional Direct Image URL"}
            className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900 pr-8"
          />
          {value && (
            <button
              type="button"
              onClick={() => copyToClipboard(value, field)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-primary-main transition-colors"
              title="Copy Link"
            >
              {copiedLinks[field] ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
            </button>
          )}
        </div>
        <label className={`shrink-0 flex items-center justify-center px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors font-medium text-xs ${uploadingImages[field] ? 'opacity-70 pointer-events-none' : ''}`}>
          {uploadingImages[field] ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <UploadCloud className="w-3.5 h-3.5 mr-1" />}
          <span>{uploadingImages[field] ? '...' : 'Upload'}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageUpload(field, e)}
            disabled={uploadingImages[field]}
          />
        </label>
        {value && (
          <div className="w-8 h-8 shrink-0 rounded border border-gray-200 overflow-hidden bg-white flex items-center justify-center p-0.5">
            <img 
              referrerPolicy="no-referrer"
              src={formatDirectImageUrl(value) || PLACEHOLDER_PRODUCT_IMAGE} 
              alt="Preview" 
              className="w-full h-full object-contain" 
              onError={(e) => handleProductImageError(e)}
            />
          </div>
        )}
      </div>
    </div>
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please login to save products");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Description is required");
      return;
    }

    if (!formData.featuredImage.trim()) {
      toast.error("Featured image URL is required");
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast.error("Valid regular price is required");
      return;
    }

    if (!formData.sku.trim()) {
      toast.error("SKU is required");
      return;
    }

    if (!formData.weight.trim() || parseFloat(formData.weight) <= 0) {
      toast.error("সঠিক পণ্যের ওজন (Weight in grams) প্রদান করুন (০ এর বেশি হতে হবে)");
      return;
    }
    
    setLoading(true);
    try {
      const resolvedVendorId = user.uid;
      const resolvedStoreId = (userData as any)?.storeId || (userData as any)?.vendorId || (userData as any)?.shopId || user.uid;
      const vendorStoreName = (userData as any)?.storeName || (userData as any)?.shopName || (userData as any)?.businessName || (userData as any)?.displayName || user.displayName || 'Vendor Shop';

      const featImg = formatDirectImageUrl(formData.featuredImage.trim());
      const img2 = formatDirectImageUrl(formData.image2.trim());
      const img3 = formatDirectImageUrl(formData.image3.trim());
      const img4 = formatDirectImageUrl(formData.image4.trim());
      const optionalImgs = [img2, img3, img4].filter(Boolean);
      const allImages = [featImg, ...optionalImgs];

      const regPrice = parseFloat(formData.price) || 0;
      const parsedSalePrice = formData.salePrice.trim() ? parseFloat(formData.salePrice) : null;
      const parsedResellerPrice = formData.resellerPrice.trim() ? parseFloat(formData.resellerPrice) : null;

      const hasValidSale = parsedSalePrice !== null && !isNaN(parsedSalePrice) && parsedSalePrice > 0 && parsedSalePrice < regPrice;
      let effectivePrice = hasValidSale ? parsedSalePrice : regPrice;
      let originalPriceVal = hasValidSale ? regPrice : null;
      let discountVal = hasValidSale ? Math.round(((regPrice - parsedSalePrice) / regPrice) * 100) : null;

      let parsedStock = parseInt(formData.stock) || 0;
      const isArchived = formData.status === 'Archived';
      let inStockVal = parsedStock > 0 && !isArchived;

      // Variants processing (Daraz-style)
      const finalHasVariants = hasVariants && variants.length > 0;
      let finalVariants: ProductVariant[] | null = null;
      let finalVariantColors: ProductColor[] | null = null;
      let finalVariantSizes: ProductSize[] | null = null;

      if (finalHasVariants) {
        // Validate each variant
        for (const v of variants) {
          if (!v.price || Number(v.price) <= 0) {
            toast.error(`Please provide a valid price for variant "${v.title}"`);
            setLoading(false);
            return;
          }
          if (v.stock === undefined || v.stock === null || isNaN(Number(v.stock)) || Number(v.stock) < 0) {
            toast.error(`Please provide valid stock for variant "${v.title}"`);
            setLoading(false);
            return;
          }
        }

        finalVariants = variants;
        finalVariantColors = variantColors;
        finalVariantSizes = variantSizes;

        // Sum variant stocks
        const totalVariantStock = variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
        parsedStock = totalVariantStock;
        inStockVal = totalVariantStock > 0 && !isArchived;

        // Base price is lowest variant price
        const varPrices = variants.map(v => Number(v.price) || 0).filter(p => p > 0);
        const minVarPrice = varPrices.length > 0 ? Math.min(...varPrices) : regPrice;

        const activeSalePrices = variants
          .map(v => (v.salePrice !== undefined && v.salePrice !== null ? Number(v.salePrice) : null))
          .filter((sp): sp is number => sp !== null && sp > 0);

        if (activeSalePrices.length > 0) {
          const minSale = Math.min(...activeSalePrices);
          if (minSale < minVarPrice) {
            effectivePrice = minSale;
            originalPriceVal = minVarPrice;
            discountVal = Math.round(((minVarPrice - minSale) / minVarPrice) * 100);
          } else {
            effectivePrice = minVarPrice;
            originalPriceVal = null;
            discountVal = null;
          }
        } else {
          effectivePrice = minVarPrice;
          originalPriceVal = null;
          discountVal = null;
        }
      }

      const weightVal = formData.weight.trim() ? formData.weight.trim() : null;
      const parsedDiscountPercent = formData.discountPercentage.trim() ? parseFloat(formData.discountPercentage) : null;
      const trimmedDiscountCode = formData.discountCode.trim() ? formData.discountCode.trim().toUpperCase() : null;

      const finalSlug = (formData.slug.trim() || existingData?.slug)
        ? generateProductSlug(formData.slug.trim() || existingData?.slug, productId)
        : generateProductSlug(formData.name.trim(), productId);

      // Build specifications only from valid inputs
      const specs: Record<string, string> = {};
      if (weightVal) {
        specs['Weight'] = weightVal.toLowerCase().includes('g') ? weightVal : `${weightVal}g`;
      }
      if (existingData?.specifications && typeof existingData.specifications === 'object') {
        for (const [k, v] of Object.entries(existingData.specifications)) {
          if (v && String(v).trim() !== '' && !specs[k]) {
            specs[k] = String(v).trim();
          }
        }
      }

      const productPayload: Record<string, any> = {
        name: formData.name.trim(),
        productName: formData.name.trim(),
        title: formData.name.trim(),
        slug: finalSlug,
        description: formData.description.trim(),
        shortDescription: formData.description.trim().slice(0, 160),

        // Media
        featuredImage: featImg,
        image: featImg,
        imageUrl: featImg,
        image2: img2 || null,
        image3: img3 || null,
        image4: img4 || null,
        images: allImages,
        videoUrl: formData.videoUrl.trim() || null,

        // Pricing
        price: effectivePrice,
        regularPrice: finalHasVariants ? effectivePrice : regPrice,
        salePrice: hasValidSale && !finalHasVariants ? parsedSalePrice : (finalHasVariants && originalPriceVal ? effectivePrice : null),
        originalPrice: originalPriceVal,
        discount: discountVal,
        discountPercentage: parsedDiscountPercent !== null && parsedDiscountPercent >= 0 ? parsedDiscountPercent : null,
        discountPercent: parsedDiscountPercent !== null && parsedDiscountPercent >= 0 ? parsedDiscountPercent : null,
        discountCode: trimmedDiscountCode || null,
        couponCode: trimmedDiscountCode || null,
        resellerPrice: parsedResellerPrice && parsedResellerPrice > 0 ? parsedResellerPrice : null,
        costPrice: formData.costPrice.trim() ? parseFloat(formData.costPrice) : null,

        // Inventory
        stock: parsedStock,
        stockCount: parsedStock,
        inStock: inStockVal,
        lowStockAlert: parseInt(formData.lowStockAlert) || 5,
        sku: formData.sku.trim(),

        // Status
        status: formData.status || 'Published',

        // Organization
        category: formData.category.trim() || null,
        categorySlug: (MAIN_CATEGORIES.find(c => c.name.toLowerCase() === formData.category.trim().toLowerCase())?.path) || (formData.category.trim().toLowerCase().replace(/ & /g, '-').replace(/ /g, '-') || null),
        subCategory: formData.subCategory.trim() || null,
        brand: formData.brand.trim() || null,
        tags: null,
        colors: finalHasVariants && variantColors.length > 0 ? variantColors.map(c => c.name) : null,
        sizes: finalHasVariants && variantSizes.length > 0 ? variantSizes.map(s => s.name) : null,
        weight: weightVal,
        specifications: Object.keys(specs).length > 0 ? specs : null,

        // Daraz-style Variant System
        hasVariants: finalHasVariants,
        variantColors: finalHasVariants ? finalVariantColors : null,
        variantSizes: finalHasVariants ? finalVariantSizes : null,
        variants: finalHasVariants ? finalVariants : null,

        // SEO
        seoTitle: null,
        metaDescription: null,
        metaKeywords: null,

        // Vendor details
        vendorId: isEditMode && existingData?.vendorId ? existingData.vendorId : resolvedVendorId,
        storeId: isEditMode && existingData?.storeId ? existingData.storeId : resolvedStoreId,
        vendor: {
          id: isEditMode && existingData?.vendor?.id ? existingData.vendor.id : resolvedVendorId,
          storeId: isEditMode && existingData?.vendor?.storeId ? existingData.vendor.storeId : resolvedStoreId,
          name: isEditMode && (existingData?.vendor?.name || existingData?.vendor?.storeName) ? (existingData.vendor.name || existingData.vendor.storeName) : vendorStoreName,
          storeName: isEditMode && (existingData?.vendor?.storeName || existingData?.vendor?.name) ? (existingData.vendor.storeName || existingData.vendor.name) : vendorStoreName,
          rating: existingData?.vendor?.rating || 5.0,
          joined: existingData?.vendor?.joined || new Date().getFullYear().toString()
        },

        updatedAt: Date.now()
      };

      if (isEditMode && productId) {
        const merged = {
          ...existingData,
          ...productPayload,
          id: productId,
          productId: productId
        };
        await rtdbUpdate(`products/${productId}`, merged);
        toast.success('Product updated successfully');
      } else {
        const newKey = await rtdbPush('products', {
          ...productPayload,
          createdAt: Date.now(),
          rating: 5.0,
          reviews: 0
        });
        if (newKey) {
          await rtdbUpdate(`products/${newKey}`, {
            id: newKey,
            productId: newKey
          });
        }
        toast.success('Product created successfully');
      }
      
      navigate('/vendor/products');
    } catch (error: any) {
      console.error("Error saving product to RTDB:", error);
      toast.error(error?.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <VendorLayout>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-main"></div>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout>
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto pb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={() => navigate('/vendor/products')}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-gray-500"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-gray-900 leading-tight">
                {isEditMode ? 'Edit Product' : 'Add New Product'}
              </h1>
              <p className="text-[11px] sm:text-xs text-gray-500">
                {isEditMode ? 'Update your product details' : 'Create a new product for your store'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => navigate('/vendor/products')}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 font-medium text-xs sm:text-sm rounded-lg hover:bg-slate-50 transition-colors flex-1 sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-1.5 bg-primary-main text-white font-medium text-xs sm:text-sm rounded-lg hover:bg-primary-main/90 transition-colors flex items-center justify-center gap-1.5 flex-1 sm:flex-none disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {loading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">
            {/* Basic Information */}
            <div className="bg-white rounded-2xl p-3 sm:p-5 border border-gray-100 shadow-sm">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-3">Basic Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Enter product title"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    required
                    rows={4}
                    placeholder="Detailed product features, specifications, and overview"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900 resize-y"
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Media */}
            <div className="bg-white rounded-2xl p-3 sm:p-5 border border-gray-100 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-gray-900">Media (Product Images)</h2>
                  <p className="text-[11px] sm:text-xs text-gray-500">চারকোনা (Square 1:1) সাইজের ছবি ব্যবহার করলে ওয়েবসাইটে সবচেয়ে সুন্দর দেখাবে</p>
                </div>
                <span className="self-start sm:self-auto inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold px-2.5 py-1 rounded-md">
                  অনুমোদিত সাইজ: 800 × 800 px (1:1)
                </span>
              </div>

              {/* Recommendation Note Box */}
              <div className="p-2.5 sm:p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl mb-3.5 flex items-start gap-2 text-blue-900">
                <div className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">i</div>
                <div className="text-[11px] sm:text-xs leading-relaxed">
                  <p className="font-semibold text-blue-950">সেরা ডিসপ্লের জন্য ছবির নির্দেশিকা:</p>
                  <p className="text-blue-800">
                    চারকোনা ফ্রেমের সাথে নিখুঁতভাবে মিলতে <span className="font-bold text-blue-950">800 × 800 পিক্সেল</span> অথবা ন্যূনতম <span className="font-bold text-blue-950">600 × 600 পিক্সেল (১:১ স্কয়ার রেশিও)</span> ছবি আপলোড করুন। সর্বোচ্চ 1000 × 1000 পিক্সেল পর্যন্ত ব্যবহার করতে পারবেন (JPG, PNG বা WEBP, সাইজ সর্বোচ্চ 2MB)।
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                {renderImageField('Image 1 (Featured Image)', 'featuredImage', formData.featuredImage, true, '800 × 800 px রিকমেন্ডেড')}
                {renderImageField('Image 2 (Optional)', 'image2', formData.image2, false, '800 × 800 px')}
                {renderImageField('Image 3 (Optional)', 'image3', formData.image3, false, '800 × 800 px')}
                {renderImageField('Image 4 (Optional)', 'image4', formData.image4, false, '800 × 800 px')}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Product Video URL (Optional)</label>
                  <input
                    type="url"
                    name="videoUrl"
                    value={formData.videoUrl}
                    onChange={handleChange}
                    placeholder="https://example.com/video.mp4 or YouTube URL"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Pricing & Inventory */}
            <div className="bg-white rounded-2xl p-3 sm:p-5 border border-gray-100 shadow-sm">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-3">Pricing & Inventory</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Regular Price *</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">৳</span>
                    <input
                      type="number"
                      step="0.01"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      required
                      placeholder="0.00"
                      className="w-full pl-6 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Sale Price</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">৳</span>
                    <input
                      type="number"
                      step="0.01"
                      name="salePrice"
                      value={formData.salePrice}
                      onChange={handleChange}
                      placeholder="Optional discounted price"
                      className="w-full pl-6 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Reseller Price</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">৳</span>
                    <input
                      type="number"
                      step="0.01"
                      name="resellerPrice"
                      value={formData.resellerPrice}
                      onChange={handleChange}
                      placeholder="Special reseller price"
                      className="w-full pl-6 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    required
                    placeholder="e.g. 50"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    required
                    placeholder="Unique product code"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Daraz-Style Product Variant System */}
            <ProductVariantManager
              hasVariants={hasVariants}
              onHasVariantsChange={setHasVariants}
              colors={variantColors}
              onColorsChange={setVariantColors}
              sizes={variantSizes}
              onSizesChange={setVariantSizes}
              variants={variants}
              onVariantsChange={setVariants}
              basePrice={formData.price}
              baseSalePrice={formData.salePrice}
              baseStock={formData.stock}
              baseSku={formData.sku}
              vendorId={user?.uid}
              productId={isEditMode ? productId : undefined}
            />
          </div>

          {/* Sidebar Column */}
          <div className="space-y-3 sm:space-y-4">
            {/* Status */}
            <div className="bg-white rounded-2xl p-3 sm:p-5 border border-gray-100 shadow-sm">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-2.5">Status</h2>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
              >
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            {/* Organization */}
            <div className="bg-white rounded-2xl p-3 sm:p-5 border border-gray-100 shadow-sm">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-2.5">Organization</h2>
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900 cursor-pointer"
                  >
                    <option value="">Select Category (ক্যাটাগরি নির্বাচন করুন)</option>
                    {MAIN_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Brand</label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    placeholder="e.g. Apple, Sony"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Weight (Gram) <span className="text-red-500">*</span>
                    <span className="text-[10px] text-gray-400 font-normal ml-1">(e.g. 500 = 0.5kg, 1000 = 1kg)</span>
                  </label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleChange}
                    placeholder="e.g. 250"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                  />
                </div>
              </div>
            </div>

            {/* Discount & Coupon Settings */}
            <div className="bg-white rounded-2xl p-3 sm:p-5 border border-gray-100 shadow-sm">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-2.5">Discount & Coupon Code</h2>
              <p className="text-[11px] text-gray-500 mb-3">
                Vendor হিসেবে আপনার প্রোডাক্টে নির্দিষ্ট % ডিসকাউন্ট এবং কুপন কোড সেট করুন। কাস্টমার চেকআউটে এই কোড দিলে স্বয়ংক্রিয়ভাবে ডিসকাউন্ট প্রযোজ্য হবে।
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Discount Percentage (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="discountPercentage"
                      value={formData.discountPercentage}
                      onChange={handleChange}
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="e.g. 10 or 15"
                      className="w-full px-3 py-1.5 pr-8 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">কত শতাংশ (%) ছাড় দিতে চান তা লিখুন</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Discount Coupon / Code
                  </label>
                  <input
                    type="text"
                    name="discountCode"
                    value={formData.discountCode}
                    onChange={handleChange}
                    placeholder="e.g. SAVE10, SUMMER15"
                    className="w-full px-3 py-1.5 uppercase font-mono tracking-wider text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">কাস্টমার যে কুপন কোড ব্যবহার করে এই ডিসকাউন্ট পাবে</p>
                </div>

                {formData.discountPercentage && formData.discountCode && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px]">
                    <span className="font-bold">{formData.discountCode.toUpperCase()}</span> কোড ব্যবহার করলে কাস্টমার এই প্রোডাক্টে <span className="font-bold">{formData.discountPercentage}%</span> ছাড় পাবেন।
                  </div>
                )}
              </div>
            </div>

            {/* URL Slug */}
            <div className="bg-white rounded-2xl p-3 sm:p-5 border border-gray-100 shadow-sm">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-2.5">Product Link (Slug)</h2>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">URL Slug (Optional)</label>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  placeholder="e.g. wireless-bluetooth-earbuds"
                  className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">খালি রাখলে প্রোডাক্টের নাম অনুযায়ী স্বয়ংক্রিয়ভাবে তৈরি হবে</p>
              </div>
            </div>

          </div>
        </div>
      </form>
    </VendorLayout>
  );
}
