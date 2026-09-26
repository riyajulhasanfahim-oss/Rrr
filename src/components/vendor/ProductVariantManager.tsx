import React, { useState, useEffect, useRef } from 'react';
import { ProductColor, ProductSize, ProductVariant } from '../../types/variant';
import { Plus, Trash2, UploadCloud, Loader2, Sparkles, Layers, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { StorageManager } from '../../services/storage/StorageManager';
import toast from 'react-hot-toast';

interface ProductVariantManagerProps {
  hasVariants: boolean;
  onHasVariantsChange: (has: boolean) => void;
  colors: ProductColor[];
  onColorsChange: (colors: ProductColor[]) => void;
  sizes: ProductSize[];
  onSizesChange: (sizes: ProductSize[]) => void;
  variants: ProductVariant[];
  onVariantsChange: (variants: ProductVariant[]) => void;
  basePrice: string;
  baseSalePrice: string;
  baseStock: string;
  baseSku: string;
  vendorId?: string;
  productId?: string;
}

const COMMON_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size'];
const COMMON_COLORS = ['Black', 'White', 'Navy Blue', 'Royal Blue', 'Red', 'Maroon', 'Green', 'Olive', 'Grey', 'Yellow', 'Pink'];

export default function ProductVariantManager({
  hasVariants,
  onHasVariantsChange,
  colors,
  onColorsChange,
  sizes,
  onSizesChange,
  variants,
  onVariantsChange,
  basePrice,
  baseSalePrice,
  baseStock,
  baseSku,
  vendorId,
  productId,
}: ProductVariantManagerProps) {
  const [newColorName, setNewColorName] = useState('');
  const [newSizeName, setNewSizeName] = useState('');
  const [uploadingColorId, setUploadingColorId] = useState<string | null>(null);

  // Bulk edit state
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkSalePrice, setBulkSalePrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');

  // Track initialization to avoid blowing away existing variants on edit load
  const isFirstRender = useRef(true);

  // Auto-generate or synchronize combinations when colors or sizes change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!hasVariants) return;

    // If both colors and sizes are empty, variants is empty
    if (colors.length === 0 && sizes.length === 0) {
      if (variants.length > 0) onVariantsChange([]);
      return;
    }

    const defaultPrice = parseFloat(basePrice) || 0;
    const defaultSalePrice = baseSalePrice.trim() ? parseFloat(baseSalePrice) : null;
    const defaultStock = parseInt(baseStock) || 10;
    const cleanBaseSku = (baseSku.trim() || 'PROD').toUpperCase();

    // Generate new combination list while keeping existing data
    const existingMap = new Map<string, ProductVariant>();
    variants.forEach((v) => {
      const key = `${v.colorName || ''}___${v.sizeName || ''}`.toLowerCase();
      existingMap.set(key, v);
      if (v.id) existingMap.set(v.id, v);
    });

    const newVariants: ProductVariant[] = [];

    const sanitizeCode = (str: string) =>
      str.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'VAR';

    if (colors.length > 0 && sizes.length > 0) {
      // Color x Size matrix
      colors.forEach((col) => {
        sizes.forEach((sz) => {
          const key = `${col.name}___${sz.name}`.toLowerCase();
          const existing = existingMap.get(key);
          const colCode = sanitizeCode(col.name);
          const szCode = sanitizeCode(sz.name);
          const variantSku = existing?.sku || `${cleanBaseSku}-${colCode}-${szCode}`;

          newVariants.push({
            id: existing?.id || `var_${col.id || sanitizeCode(col.name)}_${sz.id || sanitizeCode(sz.name)}`,
            colorId: col.id,
            colorName: col.name,
            sizeId: sz.id,
            sizeName: sz.name,
            title: `${col.name} + ${sz.name}`,
            price: existing ? existing.price : defaultPrice,
            salePrice: existing ? existing.salePrice : defaultSalePrice,
            stock: existing ? existing.stock : defaultStock,
            sku: variantSku,
            image: col.image || existing?.image || undefined,
          });
        });
      });
    } else if (colors.length > 0) {
      // Colors only
      colors.forEach((col) => {
        const key = `${col.name}___`.toLowerCase();
        const existing = existingMap.get(key);
        const colCode = sanitizeCode(col.name);
        const variantSku = existing?.sku || `${cleanBaseSku}-${colCode}`;

        newVariants.push({
          id: existing?.id || `var_${col.id || sanitizeCode(col.name)}`,
          colorId: col.id,
          colorName: col.name,
          title: col.name,
          price: existing ? existing.price : defaultPrice,
          salePrice: existing ? existing.salePrice : defaultSalePrice,
          stock: existing ? existing.stock : defaultStock,
          sku: variantSku,
          image: col.image || existing?.image || undefined,
        });
      });
    } else if (sizes.length > 0) {
      // Sizes only
      sizes.forEach((sz) => {
        const key = `___${sz.name}`.toLowerCase();
        const existing = existingMap.get(key);
        const szCode = sanitizeCode(sz.name);
        const variantSku = existing?.sku || `${cleanBaseSku}-${szCode}`;

        newVariants.push({
          id: existing?.id || `var_${sz.id || sanitizeCode(sz.name)}`,
          sizeId: sz.id,
          sizeName: sz.name,
          title: sz.name,
          price: existing ? existing.price : defaultPrice,
          salePrice: existing ? existing.salePrice : defaultSalePrice,
          stock: existing ? existing.stock : defaultStock,
          sku: variantSku,
          image: existing?.image || undefined,
        });
      });
    }

    onVariantsChange(newVariants);
  }, [colors, sizes, hasVariants]);

  // Color handlers
  const handleAddColor = (nameToAdd?: string) => {
    const name = (nameToAdd || newColorName).trim();
    if (!name) return;

    if (colors.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`Color "${name}" already added`);
      return;
    }

    const newCol: ProductColor = {
      id: `col_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
      image: '',
    };
    onColorsChange([...colors, newCol]);
    setNewColorName('');
  };

  const handleRemoveColor = (id: string) => {
    onColorsChange(colors.filter((c) => c.id !== id));
  };

  const handleUpdateColorName = (id: string, name: string) => {
    onColorsChange(colors.map((c) => (c.id === id ? { ...c, name } : c)));
  };

  const handleUpdateColorImage = (id: string, imageUrl: string) => {
    onColorsChange(colors.map((c) => (c.id === id ? { ...c, image: imageUrl } : c)));
    // Also sync to matching variants
    onVariantsChange(
      variants.map((v) => {
        if (v.colorId === id || v.colorName === colors.find((c) => c.id === id)?.name) {
          return { ...v, image: imageUrl };
        }
        return v;
      })
    );
  };

  const handleColorImageUpload = async (colorId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingColorId(colorId);
    try {
      const storedRecord = await StorageManager.uploadProductImage(file, {
        vendorId,
        productId,
      });
      if (storedRecord?.fileUrl) {
        handleUpdateColorImage(colorId, storedRecord.fileUrl);
        toast.success('Color image uploaded');
      } else {
        throw new Error('Upload returned no URL');
      }
    } catch (err: any) {
      console.error('Color image upload error:', err);
      toast.error(err.message || 'Failed to upload color image');
    } finally {
      setUploadingColorId(null);
      if (e.target) e.target.value = '';
    }
  };

  // Size handlers
  const handleAddSize = (nameToAdd?: string) => {
    const name = (nameToAdd || newSizeName).trim();
    if (!name) return;

    if (sizes.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`Size "${name}" already added`);
      return;
    }

    const newSz: ProductSize = {
      id: `size_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
    };
    onSizesChange([...sizes, newSz]);
    setNewSizeName('');
  };

  const handleRemoveSize = (id: string) => {
    onSizesChange(sizes.filter((s) => s.id !== id));
  };

  // Variant field change
  const handleVariantFieldChange = (
    index: number,
    field: 'price' | 'salePrice' | 'stock' | 'sku',
    value: any
  ) => {
    const updated = [...variants];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    onVariantsChange(updated);
  };

  // Bulk Apply
  const applyBulkPrice = () => {
    const num = parseFloat(bulkPrice);
    if (isNaN(num) || num <= 0) {
      toast.error('Enter a valid price');
      return;
    }
    onVariantsChange(variants.map((v) => ({ ...v, price: num })));
    toast.success(`Price ৳${num} applied to all variants`);
    setBulkPrice('');
  };

  const applyBulkSalePrice = () => {
    const num = bulkSalePrice.trim() ? parseFloat(bulkSalePrice) : null;
    onVariantsChange(variants.map((v) => ({ ...v, salePrice: num })));
    toast.success('Sale price applied to all variants');
    setBulkSalePrice('');
  };

  const applyBulkStock = () => {
    const num = parseInt(bulkStock);
    if (isNaN(num) || num < 0) {
      toast.error('Enter a valid stock number');
      return;
    }
    onVariantsChange(variants.map((v) => ({ ...v, stock: num })));
    toast.success(`Stock ${num} applied to all variants`);
    setBulkStock('');
  };

  const autoGenerateAllSkus = () => {
    const cleanBaseSku = (baseSku.trim() || 'PROD').toUpperCase();
    const updated = variants.map((v, i) => {
      const colPart = v.colorName ? v.colorName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() : '';
      const szPart = v.sizeName ? v.sizeName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() : '';
      const parts = [cleanBaseSku, colPart, szPart].filter(Boolean);
      return {
        ...v,
        sku: `${parts.join('-')}-${String(i + 1).padStart(2, '0')}`,
      };
    });
    onVariantsChange(updated);
    toast.success('SKUs generated automatically');
  };

  const totalStock = variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
  const minPrice = variants.length > 0 ? Math.min(...variants.map((v) => v.price)) : 0;
  const maxPrice = variants.length > 0 ? Math.max(...variants.map((v) => v.price)) : 0;

  return (
    <div className="bg-white rounded-2xl p-3 sm:p-5 border border-gray-100 shadow-sm space-y-5">
      {/* Enable Variants Switcher */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-primary-main flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-gray-900">
              Product Variants (কালার ও সাইজ ভ্যারিয়েন্ট)
            </h2>
            <p className="text-[11px] text-gray-500">
              দারাজের মতো একাধিক কালার, সাইজ ও আলাদা দাম/স্টক নির্ধারণ করুন
            </p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={hasVariants}
            onChange={(e) => onHasVariantsChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-main"></div>
        </label>
      </div>

      {!hasVariants ? (
        <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
          <p className="text-xs text-slate-500">
            এই পণ্যের জন্য ভ্যারিয়েন্ট বন্ধ রয়েছে। সাধারণ একক মূল্য এবং স্টক প্রযোজ্য হবে।
          </p>
          <button
            type="button"
            onClick={() => onHasVariantsChange(true)}
            className="mt-2 text-xs font-bold text-primary-main hover:underline"
          >
            ভ্যারিয়েন্ট চালু করতে এখানে ক্লিক করুন →
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Colors */}
          <div className="space-y-3 bg-slate-50/70 p-3.5 sm:p-4 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <span>1. Color / কালার যোগ করুন</span>
                  <span className="text-[10px] text-gray-400 font-normal">({colors.length} Added)</span>
                </h3>
                <p className="text-[10px] text-gray-500">
                  প্রতিটি কালারের জন্য আলাদা প্রোডাক্ট ইমেজ দিতে পারবেন (রিকমেন্ডেড সাইজ: 800 × 800 px)
                </p>
              </div>
            </div>

            {/* Quick suggestion color chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-gray-400 font-semibold">Suggested:</span>
              {COMMON_COLORS.map((col) => {
                const isAdded = colors.some((c) => c.name.toLowerCase() === col.toLowerCase());
                return (
                  <button
                    key={col}
                    type="button"
                    disabled={isAdded}
                    onClick={() => handleAddColor(col)}
                    className={`text-[11px] px-2 py-0.5 rounded-md border transition-all ${
                      isAdded
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-primary-main hover:text-primary-main'
                    }`}
                  >
                    + {col}
                  </button>
                );
              })}
            </div>

            {/* Add color input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newColorName}
                onChange={(e) => setNewColorName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddColor();
                  }
                }}
                placeholder="যেমন: Black, Navy Blue, Red..."
                className="flex-1 px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main"
              />
              <button
                type="button"
                onClick={() => handleAddColor()}
                className="px-3 py-1.5 bg-primary-main text-white text-xs font-bold rounded-lg hover:bg-sky-600 transition-colors flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Color যোগ করুন
              </button>
            </div>

            {/* Colors list */}
            {colors.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
                {colors.map((col) => (
                  <div
                    key={col.id}
                    className="p-2.5 bg-white border border-gray-200 rounded-lg flex items-center gap-3 shadow-2xs"
                  >
                    {/* Thumbnail or Upload Button */}
                    <div className="relative w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                      {col.image ? (
                        <img
                          src={col.image}
                          alt={col.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-[10px] text-gray-400 text-center px-1">
                          {uploadingColorId === col.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary-main mx-auto" />
                          ) : (
                            'No Img'
                          )}
                        </div>
                      )}

                      <label
                        title="Upload color-specific image"
                        className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleColorImageUpload(col.id, e)}
                          disabled={uploadingColorId === col.id}
                        />
                      </label>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <input
                          type="text"
                          value={col.name}
                          onChange={(e) => handleUpdateColorName(col.id, e.target.value)}
                          className="text-xs font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary-main focus:outline-none w-full"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveColor(col.id)}
                          className="text-gray-400 hover:text-red-500 p-1"
                          title="Delete color"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="url"
                          value={col.image || ''}
                          onChange={(e) => handleUpdateColorImage(col.id, e.target.value)}
                          placeholder="Image URL (optional)"
                          className="text-[10px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 w-full focus:bg-white focus:outline-none"
                        />
                        <label className="text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer shrink-0 font-medium">
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleColorImageUpload(col.id, e)}
                            disabled={uploadingColorId === col.id}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Sizes */}
          <div className="space-y-3 bg-slate-50/70 p-3.5 sm:p-4 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <span>2. Size / আকার যোগ করুন</span>
                  <span className="text-[10px] text-gray-400 font-normal">({sizes.length} Added)</span>
                </h3>
                <p className="text-[10px] text-gray-500">
                  যেমন: S, M, L, XL অথবা কাস্টম সাইজ (যেমন: 28, 30, 32, Free Size)
                </p>
              </div>
            </div>

            {/* Quick chips for sizes */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-gray-400 font-semibold">Quick Add:</span>
              {COMMON_SIZES.map((sz) => {
                const isAdded = sizes.some((s) => s.name.toLowerCase() === sz.toLowerCase());
                return (
                  <button
                    key={sz}
                    type="button"
                    disabled={isAdded}
                    onClick={() => handleAddSize(sz)}
                    className={`text-[11px] px-2.5 py-0.5 rounded-md border font-semibold transition-all ${
                      isAdded
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-primary-main hover:text-primary-main'
                    }`}
                  >
                    + {sz}
                  </button>
                );
              })}
            </div>

            {/* Custom size input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSizeName}
                onChange={(e) => setNewSizeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSize();
                  }
                }}
                placeholder="কাস্টম সাইজ লিখুন (যেমন: XXL, 32, 34, 128GB...)"
                className="flex-1 px-3 py-1.5 text-xs sm:text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-main"
              />
              <button
                type="button"
                onClick={() => handleAddSize()}
                className="px-3 py-1.5 bg-primary-main text-white text-xs font-bold rounded-lg hover:bg-sky-600 transition-colors flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Size যোগ করুন
              </button>
            </div>

            {/* Active sizes chips */}
            {sizes.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {sizes.map((sz) => (
                  <div
                    key={sz.id}
                    className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-800 px-3 py-1 rounded-lg text-xs font-bold shadow-2xs"
                  >
                    <span>{sz.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSize(sz.id)}
                      className="text-gray-400 hover:text-red-500 p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Combination Matrix */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>3. Variant Combinations (Color + Size তালিকা)</span>
                  <span className="text-[10px] bg-primary-main/10 text-primary-main px-2 py-0.5 rounded-full font-bold">
                    {variants.length} Combinations
                  </span>
                </h3>
                <p className="text-[10px] text-gray-500">
                  প্রতিটি Color + Size-এর জন্য আলাদা দাম, স্টক ও SKU সেট করুন
                </p>
              </div>

              <button
                type="button"
                onClick={autoGenerateAllSkus}
                className="text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 font-semibold px-2.5 py-1 rounded-lg self-start sm:self-auto flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Auto SKUs
              </button>
            </div>

            {/* Bulk Toolbar */}
            {variants.length > 1 && (
              <div className="p-3 bg-sky-50/70 border border-sky-100 rounded-xl flex flex-wrap items-center gap-2.5 text-xs">
                <span className="font-bold text-sky-900 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-primary-main" /> Bulk Apply:
                </span>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Regular Price (৳)"
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(e.target.value)}
                    className="w-24 px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyBulkPrice}
                    className="bg-white border border-sky-200 hover:bg-sky-100 text-sky-900 px-2 py-1 rounded font-semibold text-[11px]"
                  >
                    Apply
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Sale Price (৳)"
                    value={bulkSalePrice}
                    onChange={(e) => setBulkSalePrice(e.target.value)}
                    className="w-24 px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyBulkSalePrice}
                    className="bg-white border border-sky-200 hover:bg-sky-100 text-sky-900 px-2 py-1 rounded font-semibold text-[11px]"
                  >
                    Apply
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Stock Qty"
                    value={bulkStock}
                    onChange={(e) => setBulkStock(e.target.value)}
                    className="w-20 px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyBulkStock}
                    className="bg-white border border-sky-200 hover:bg-sky-100 text-sky-900 px-2 py-1 rounded font-semibold text-[11px]"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            {/* Matrix Table */}
            {variants.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                <p className="text-xs text-slate-600 font-semibold">
                  কোনো Color বা Size যোগ করা হয়নি
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  উপরে কালার অথবা সাইজ যোগ করলে স্বয়ংক্রিয়ভাবে কম্বিনেশন তৈরি হবে
                </p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-gray-200 text-slate-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Variant (Color + Size)</th>
                        <th className="py-2.5 px-3">
                          Price (৳) <span className="text-red-500">*</span>
                        </th>
                        <th className="py-2.5 px-3">Sale Price (৳)</th>
                        <th className="py-2.5 px-3">
                          Stock <span className="text-red-500">*</span>
                        </th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {variants.map((variant, index) => {
                        const isOut = (Number(variant.stock) || 0) <= 0;
                        return (
                          <tr key={variant.id || index} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                {variant.image ? (
                                  <img
                                    src={variant.image}
                                    alt={variant.title}
                                    className="w-7 h-7 rounded object-cover border border-gray-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                                    {(variant.colorName || variant.sizeName || 'V').charAt(0)}
                                  </div>
                                )}
                                <div>
                                  <span className="font-bold text-slate-900 block leading-tight">
                                    {variant.title}
                                  </span>
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                                    {variant.colorName && (
                                      <span className="bg-slate-100 px-1 rounded">
                                        Color: {variant.colorName}
                                      </span>
                                    )}
                                    {variant.sizeName && (
                                      <span className="bg-slate-100 px-1 rounded">
                                        Size: {variant.sizeName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                required
                                min="1"
                                value={variant.price || ''}
                                onChange={(e) =>
                                  handleVariantFieldChange(index, 'price', parseFloat(e.target.value) || 0)
                                }
                                placeholder="350"
                                className="w-24 px-2 py-1.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-main font-semibold text-gray-900"
                              />
                            </td>

                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                min="0"
                                value={variant.salePrice !== null && variant.salePrice !== undefined ? variant.salePrice : ''}
                                onChange={(e) => {
                                  const val = e.target.value.trim() ? parseFloat(e.target.value) : null;
                                  handleVariantFieldChange(index, 'salePrice', val);
                                }}
                                placeholder="Optional"
                                className="w-24 px-2 py-1.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-main text-gray-900"
                              />
                            </td>

                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                required
                                min="0"
                                value={variant.stock !== undefined ? variant.stock : ''}
                                onChange={(e) =>
                                  handleVariantFieldChange(index, 'stock', parseInt(e.target.value) || 0)
                                }
                                placeholder="10"
                                className={`w-20 px-2 py-1.5 bg-white border rounded focus:outline-none focus:ring-1 focus:ring-primary-main font-semibold ${
                                  isOut ? 'border-red-300 text-red-600 bg-red-50/50' : 'border-gray-300 text-gray-900'
                                }`}
                              />
                            </td>

                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={variant.sku || ''}
                                onChange={(e) =>
                                  handleVariantFieldChange(index, 'sku', e.target.value)
                                }
                                placeholder="BL-M-01"
                                className="w-28 px-2 py-1.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-main font-mono text-[11px] text-gray-800"
                              />
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              {isOut ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
                                  Stock Out
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {variant.stock} In Stock
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Matrix Footer Summary */}
                <div className="bg-slate-50 p-2.5 px-4 border-t border-gray-200 flex flex-wrap items-center justify-between text-xs text-slate-700 font-semibold gap-2">
                  <div className="flex items-center gap-3">
                    <span>
                      মোট ভ্যারিয়েন্ট: <strong className="text-slate-900">{variants.length}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      মোট সমন্বিত স্টক: <strong className="text-slate-900">{totalStock} টি</strong>
                    </span>
                  </div>
                  {variants.length > 0 && (
                    <div className="text-primary-main font-bold">
                      দাম সীমা:{' '}
                      {minPrice === maxPrice ? `৳${minPrice}` : `৳${minPrice} - ৳${maxPrice}`}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
