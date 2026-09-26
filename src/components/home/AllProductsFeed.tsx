import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Store, 
  SlidersHorizontal, 
  ChevronDown, 
  ArrowUpDown, 
  Check, 
  RotateCcw,
  Package,
  Layers,
  Flame,
  Clock,
  TrendingDown
} from 'lucide-react';
import ProductCard, { Product } from '../ui/ProductCard';

interface AllProductsFeedProps {
  products: Product[];
}

export default function AllProductsFeed({ products }: AllProductsFeedProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'popular' | 'deals' | 'new'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'rating' | 'discount'>('default');
  
  // Infinite scroll / pagination
  const [visibleCount, setVisibleCount] = useState<number>(16);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Extract unique categories from actual products
  const categoriesList = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      const cat = (p.category || '').trim();
      if (cat) {
        map.set(cat, (map.get(cat) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [products]);

  // Extract unique vendors from actual products
  const vendorsList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    products.forEach(p => {
      const vId = p.vendorId || p.vendor?.id || p.vendor?.storeId || '';
      const vName = p.vendor?.storeName || p.vendor?.name || p.brand || (vId ? 'Vendor Shop' : '');
      if (vId && vName) {
        const existing = map.get(vId);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(vId, { id: vId, name: vName, count: 1 });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [products]);

  // Filtered & Sorted products
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // 1. Quick Tab filter
    if (activeTab === 'popular') {
      list = list.filter(p => (p.soldCount || 0) > 0 || (p.rating || 0) >= 4.5);
      list.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
    } else if (activeTab === 'deals') {
      list = list.filter(p => (p.discount || 0) > 0 || (p.originalPrice && p.originalPrice > p.price));
      list.sort((a, b) => (b.discount || 0) - (a.discount || 0));
    } else if (activeTab === 'new') {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    // 2. Category filter
    if (selectedCategory !== 'all') {
      list = list.filter(p => 
        (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase()) ||
        (p.categorySlug && p.categorySlug.toLowerCase() === selectedCategory.toLowerCase())
      );
    }

    // 3. Vendor filter
    if (selectedVendor !== 'all') {
      list = list.filter(p => 
        p.vendorId === selectedVendor || 
        p.vendor?.id === selectedVendor || 
        p.vendor?.storeId === selectedVendor
      );
    }

    // 4. Sort
    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'discount') {
      list.sort((a, b) => (b.discount || 0) - (a.discount || 0));
    }

    return list;
  }, [products, activeTab, selectedCategory, selectedVendor, sortBy]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(16);
  }, [selectedCategory, selectedVendor, activeTab, sortBy]);

  // Handle Load More
  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + 16, filteredProducts.length));
      setIsLoadingMore(false);
    }, 200);
  };

  // Auto-scroll infinite load via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first.isIntersecting && visibleCount < filteredProducts.length && !isLoadingMore) {
        handleLoadMore();
      }
    }, { threshold: 0.1, rootMargin: '200px' });

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [visibleCount, filteredProducts.length, isLoadingMore]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const hasMore = visibleCount < filteredProducts.length;

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedVendor('all');
    setActiveTab('all');
    setSortBy('default');
  };

  if (!products || products.length === 0) return null;

  return (
    <section className="py-4 sm:py-6 lg:py-8 bg-slate-50 border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/90 shadow-xs mb-3 sm:mb-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Title & Stats */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1.5 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-2xs">
                  <Sparkles className="w-5 h-5" />
                </span>
                <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                  সকল ভেন্ডরের পণ্য (Just For You)
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 shadow-2xs">
                  {filteredProducts.length}টি পণ্য উপলব্ধ
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                সবগুলো রেজিস্টার্ড ভেন্ডর ও স্টোরের সকল আসল পণ্য কালেকশন স্ক্রল করে উপভোগ করুন
              </p>
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-slate-950 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                সব পণ্য ({products.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('popular')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'popular'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>জনপ্রিয়</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('deals')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'deals'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>বিশেষ ছাড়</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('new')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'new'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>নতুন আগমন</span>
              </button>
            </div>
          </div>

          {/* Secondary Filter & Sort Row */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
            
            {/* Vendor Selector Pill or Dropdown */}
            {vendorsList.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-sky-600" />
                  <span>ভেন্ডর:</span>
                </span>
                
                <select
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="all">সবগুলো ভেন্ডর ({vendorsList.length})</option>
                  {vendorsList.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.count})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category Selector */}
            {categoriesList.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>ক্যাটাগরি:</span>
                </span>
                
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="all">সব ক্যাটাগরি</option>
                  {categoriesList.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Sorter */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <span>সাজান:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value="default">ডিফল্ট</option>
                <option value="price-asc">দাম: কম থেকে বেশি</option>
                <option value="price-desc">দাম: বেশি থেকে কম</option>
                <option value="rating">রেটিং অনুযায়ী</option>
                <option value="discount">ডিসকাউন্ট অনুযায়ী</option>
              </select>

              {(selectedCategory !== 'all' || selectedVendor !== 'all' || activeTab !== 'all' || sortBy !== 'default') && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="ফিল্টার রিসেট করুন"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>

          {/* Category Quick Chips */}
          {categoriesList.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                }`}
              >
                সব
              </button>
              {categoriesList.slice(0, 8).map(c => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedCategory(c.name)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory.toLowerCase() === c.name.toLowerCase()
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Product Grid */}
        {displayedProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
            {displayedProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.2) }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center p-6 space-y-3">
            <Package className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              কোনো পণ্য পাওয়া যায়নি
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              আপনার নির্বাচিত ফিল্টারে বর্তমানে কোনো পণ্য নেই। ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ফিল্টার রিসেট করুন</span>
            </button>
          </div>
        )}

        {/* Load More & Infinite Scroll Trigger Element */}
        <div ref={loadMoreRef} className="mt-6 sm:mt-8 flex flex-col items-center justify-center gap-2">
          {hasMore ? (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm rounded-full border border-slate-300 shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {isLoadingMore ? (
                <>
                  <div className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                  <span>পণ্য লোড হচ্ছে...</span>
                </>
              ) : (
                <>
                  <span>আরও পণ্য লোড করুন ({filteredProducts.length - visibleCount}টি বাকি)</span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </>
              )}
            </button>
          ) : (
            displayedProducts.length > 0 && (
              <div className="text-center py-3 text-xs font-semibold text-slate-400 bg-white/70 px-4 py-2 rounded-full border border-slate-200/60 inline-flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                <span>সকল ভেন্ডরের সব পণ্য দেখানো হয়েছে ({filteredProducts.length}টি পণ্য)</span>
              </div>
            )
          )}
        </div>

      </div>
    </section>
  );
}
