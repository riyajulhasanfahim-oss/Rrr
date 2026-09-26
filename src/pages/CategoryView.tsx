import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, 
  SlidersHorizontal, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  ArrowLeft,
  LayoutGrid,
  List as ListIcon,
  Star,
  Zap,
  ShoppingBag,
  ShoppingCart,
  Heart,
  Sparkles,
  Filter,
  Check,
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { Product } from '../components/ui/ProductCard';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../utils/imageUrl';
import { 
  getFirestoreProducts, 
  searchFirestoreProducts, 
  addSearchHistoryToFirestore,
  getFirestoreCategories
} from '../services/firestoreService';
import { auth } from '../lib/firebase';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { INITIAL_CATEGORIES } from '../lib/firebaseSeed';
import { MAIN_CATEGORIES, isCategoryMatching } from '../constants/categories';
import { fetchAllMarketplaceProducts, subscribeToMarketplaceProducts, getCachedMarketplaceProducts } from '../services/productService';
import { matchProductsDarazStyle } from '../utils/searchEngine';
import toast from 'react-hot-toast';

function filterProductsForCategory(all: Product[], catId?: string, query?: string): Product[] {
  if (query && query.trim()) {
    return matchProductsDarazStyle(all, query);
  }
  let list = all;
  if (catId && catId !== 'all') {
    list = list.filter(p => isCategoryMatching(p.category || p.categorySlug, catId));
  }
  return list;
}

// Popular search tags for easy recovery
const POPULAR_SEARCH_TAGS = [
  'Smart Watch', 'Headphones', 'T-Shirt', 'Wireless Earbuds', 
  'Backpack', 'Shoes', 'Gaming Mouse', 'Keyboard'
];

// Price presets for quick filtering
const PRICE_PRESETS = [
  { label: 'সব মূল্য', min: '', max: '' },
  { label: '৳১,০০০ এর নিচে', min: '', max: '1000' },
  { label: '৳১,০০০ - ৳৩,০০০', min: '1000', max: '3000' },
  { label: '৳৩,০০০ - ৳১০,০০০', min: '3000', max: '10000' },
  { label: '৳১০,০০০+', min: '10000', max: '' },
];

export default function CategoryView() {
  const { categoryId: rawCategoryId } = useParams<{ categoryId?: string }>();
  const categoryId = rawCategoryId || 'all';
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const initialQuery = searchParams.get('q') || '';

  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { userData } = useAuth();

  // Filters State
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const isImageSearch = Boolean(location.state?.isImageSearch);
  const imageSearchMatches = (location.state?.imageSearchMatches as Product[]) || [];
  const isSearchMode = Boolean((searchQuery || initialQuery).trim() || isImageSearch);

  // Core Data State
  const [products, setProducts] = useState<Product[]>(() => {
    const cached = getCachedMarketplaceProducts();
    return filterProductsForCategory(cached, categoryId, initialQuery);
  });
  const [allMarketplaceProducts, setAllMarketplaceProducts] = useState<Product[]>(() => {
    return getCachedMarketplaceProducts();
  });
  const [allCategories, setAllCategories] = useState<any[]>(MAIN_CATEGORIES);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>(() => {
    const cached = getCachedMarketplaceProducts();
    return cached.slice(0, 8);
  });
  const [loading, setLoading] = useState<boolean>(() => products.length === 0);

  const [selectedCategory, setSelectedCategory] = useState<string>(categoryId);
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [minRating, setMinRating] = useState<number>(0);
  const [onlyDiscount, setOnlyDiscount] = useState<boolean>(false);
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('recommended');

  // Display View Mode: Grid or List
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Search Results using Daraz-style title and multi-vendor matching (Zero Clutter)
  const searchResults = useMemo(() => {
    if (!isSearchMode) return [];
    if (isImageSearch) {
      return imageSearchMatches;
    }
    const q = searchQuery.trim() || initialQuery.trim();
    if (!q) return [];
    return matchProductsDarazStyle(allMarketplaceProducts, q);
  }, [isSearchMode, isImageSearch, imageSearchMatches, searchQuery, initialQuery, allMarketplaceProducts]);

  const [searchPage, setSearchPage] = useState(1);
  const searchItemsPerPage = 20;
  const searchTotalPages = Math.ceil(searchResults.length / searchItemsPerPage);
  const currentSearchItems = useMemo(() => {
    return searchResults.slice(
      (searchPage - 1) * searchItemsPerPage,
      searchPage * searchItemsPerPage
    );
  }, [searchResults, searchPage, searchItemsPerPage]);

  useEffect(() => {
    setSearchPage(1);
  }, [searchQuery, initialQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    navigate('/category/all', { replace: true });
  }, [navigate]);

  // Mobile Filter Drawer State
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Sync selectedCategory with route param
  useEffect(() => {
    setSelectedCategory(categoryId);
  }, [categoryId]);

  // Sync search query with URL ?q= param
  useEffect(() => {
    setSearchQuery(initialQuery);
    setCurrentPage(1);
  }, [initialQuery]);

  // Fetch Categories
  useEffect(() => {
    let isMounted = true;
    async function loadCategories() {
      try {
        const cats = await getFirestoreCategories();
        if (isMounted && cats && cats.length > 0) {
          const merged = [...MAIN_CATEGORIES];
          cats.forEach((c: any) => {
            if (!merged.some(m => m.id === c.id || m.name?.toLowerCase() === c.name?.toLowerCase())) {
              merged.push(c);
            }
          });
          setAllCategories(merged);
        }
      } catch {
        if (isMounted) setAllCategories(MAIN_CATEGORIES);
      }
    }
    loadCategories();
    return () => { isMounted = false; };
  }, []);

  // Fetch Products based on search query or category from RTDB with live subscription
  useEffect(() => {
    let isMounted = true;

    const handleProductsList = (all: Product[]) => {
      if (!isMounted) return;
      setAllMarketplaceProducts(all);
      const filtered = filterProductsForCategory(all, categoryId, initialQuery);
      setProducts(filtered);
      setRecommendedProducts(all.slice(0, 8));
      setLoading(false);
    };

    if (products.length === 0) {
      setLoading(true);
    }

    if (initialQuery.trim() && auth.currentUser) {
      addSearchHistoryToFirestore(auth.currentUser.uid, initialQuery);
    }

    fetchAllMarketplaceProducts()
      .then((all) => {
        handleProductsList(all);
      })
      .catch((err) => {
        console.warn('Error loading products for category:', err);
        if (isMounted) setLoading(false);
      });

    const unsubscribe = subscribeToMarketplaceProducts((liveList) => {
      handleProductsList(liveList);
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [categoryId, initialQuery]);

  // Scroll to top when page changes
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      Boolean(searchQuery.trim()) ||
      Boolean(priceRange.min) ||
      Boolean(priceRange.max) ||
      minRating > 0 ||
      onlyDiscount ||
      onlyInStock ||
      selectedCategory !== 'all'
    );
  }, [searchQuery, priceRange, minRating, onlyDiscount, onlyInStock, selectedCategory]);

  // Reset all filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setPriceRange({ min: '', max: '' });
    setMinRating(0);
    setOnlyDiscount(false);
    setOnlyInStock(false);
    setSortBy('recommended');
    setCurrentPage(1);
    // If there was a search query in the URL, navigate to clean all category view
    if (initialQuery || categoryId !== 'all') {
      navigate('/category/all', { replace: true });
    }
  }, [initialQuery, categoryId, navigate]);

  // Switch category
  const handleCategorySelect = (catSlug: string) => {
    setSelectedCategory(catSlug);
    setCurrentPage(1);
    if (catSlug === 'all') {
      navigate(searchQuery ? `/category/all?q=${encodeURIComponent(searchQuery)}` : '/category/all');
    } else {
      navigate(`/category/${catSlug}`);
    }
  };

  // Filter & Sort Products
  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Filter by category if selected and not 'all'
    if (selectedCategory && selectedCategory !== 'all') {
      result = result.filter(p => isCategoryMatching(p.category || p.categorySlug, selectedCategory));
    }

    // Search query filter (fuzzy search across name, description, tags, keywords, brand, category)
    if (searchQuery.trim()) {
      const queryTerms = searchQuery.toLowerCase().split(' ').filter(Boolean);
      result = result.filter(p => {
        const searchableText = [
          p.name,
          p.description,
          p.category,
          p.brand,
          ...(p.tags || []),
          ...(p.keywords || [])
        ].join(' ').toLowerCase();

        return queryTerms.every(term => searchableText.includes(term));
      });
    }

    // Price filter
    const minP = parseFloat(priceRange.min);
    const maxP = parseFloat(priceRange.max);
    if (!isNaN(minP)) result = result.filter(p => Number(p.price) >= minP);
    if (!isNaN(maxP)) result = result.filter(p => Number(p.price) <= maxP);

    // Rating filter
    if (minRating > 0) {
      result = result.filter(p => (p.rating || 4.5) >= minRating);
    }

    // Discount filter
    if (onlyDiscount) {
      result = result.filter(p => (p.discount && p.discount > 0) || (p.originalPrice && p.originalPrice > p.price));
    }

    // In-Stock filter
    if (onlyInStock) {
      result = result.filter(p => p.stock === undefined || p.stock > 0);
    }

    // Sorting
    switch (sortBy) {
      case 'price_low':
        result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        break;
      case 'price_high':
        result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
        break;
      case 'rating':
        result.sort((a, b) => (b.rating || 4.5) - (a.rating || 4.5));
        break;
      case 'discount':
        result.sort((a, b) => (b.discount || 0) - (a.discount || 0));
        break;
      case 'newest':
        result.sort((a, b) => (a.isNew === b.isNew ? 0 : a.isNew ? -1 : 1));
        break;
      default:
        // recommended: preserve default or weighted order
        break;
    }

    return result;
  }, [products, selectedCategory, searchQuery, priceRange, minRating, onlyDiscount, onlyInStock, sortBy]);

  // Pagination Calculation
  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);
  const currentItems = useMemo(() => {
    return filteredAndSortedProducts.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredAndSortedProducts, currentPage, itemsPerPage]);

  // Auto reset page if filters shrink total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Dynamic Header Title
  const pageTitle = useMemo(() => {
    if (searchQuery.trim()) {
      return `"${searchQuery}" এর জন্য অনুসন্ধান ফলাফল`;
    }
    if (selectedCategory && selectedCategory !== 'all') {
      const match = allCategories.find(c => 
        c.path === selectedCategory || 
        c.id === selectedCategory ||
        c.name?.toLowerCase() === selectedCategory.toLowerCase()
      );
      if (match) return match.name;
      return selectedCategory.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return 'সব পণ্য (All Products)';
  }, [searchQuery, selectedCategory, allCategories]);

  // Active filter count for mobile badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (priceRange.min || priceRange.max) count++;
    if (minRating > 0) count++;
    if (onlyDiscount) count++;
    if (onlyInStock) count++;
    if (selectedCategory !== 'all') count++;
    return count;
  }, [searchQuery, priceRange, minRating, onlyDiscount, onlyInStock, selectedCategory]);

  // Wishlist click handler
  const handleWishlistClick = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id);
      toast.success('উইশলিস্ট থেকে সরানো হয়েছে');
    } else {
      addToWishlist({
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
        image: product.featuredImage || product.image || (product.images && product.images[0]) || '',
        addedAt: Date.now()
      });
      toast.success('উইশলিস্টে যুক্ত করা হয়েছে');
    }
  };

  // Direct Buy Now / Order Now
  const handleBuyNow = (e: React.MouseEvent, product: Product) => {
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
    navigate('/checkout', {
      state: {
        buyNowItem: {
          id: product.id,
          name: product.name,
          price: Number(product.price) || 0,
          originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
          image: product.featuredImage || product.image || (product.images && product.images[0]) || '',
          quantity: 1,
          vendorId: product.vendorId
        }
      }
    });
  };

  // Filter Sidebar Component (Shared by Desktop & Mobile Drawer)
  const FilterContent = () => (
    <div className="space-y-6">
      {/* Search within page */}
      <div>
        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
          পণ্য খুঁজুন
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="নাম বা বিবরণ লিখুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-slate-200 focus:border-primary-main rounded-xl bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 outline-none transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category Selection */}
      <div>
        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
          ক্যাটাগরি
        </label>
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => handleCategorySelect('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer text-left ${
              selectedCategory === 'all'
                ? 'bg-primary-main/10 text-primary-main font-bold border border-primary-main/30'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>সবগুলো ক্যাটাগরি</span>
            {selectedCategory === 'all' && <Check className="w-3.5 h-3.5 text-primary-main" />}
          </button>
          {allCategories.map(cat => {
            const isSelected = selectedCategory === (cat.path || cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat.path || cat.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer text-left ${
                  isSelected
                    ? 'bg-primary-main/10 text-primary-main font-bold border border-primary-main/30'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{cat.name}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-primary-main" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            মূল্য পরিসীমা (৳)
          </label>
          {(priceRange.min || priceRange.max) && (
            <button
              onClick={() => setPriceRange({ min: '', max: '' })}
              className="text-[11px] text-primary-main font-semibold hover:underline"
            >
              মুছুন
            </button>
          )}
        </div>

        {/* Quick price preset chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRICE_PRESETS.map((preset, idx) => {
            const isPresetActive = priceRange.min === preset.min && priceRange.max === preset.max;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setPriceRange({ min: preset.min, max: preset.max })}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  isPresetActive
                    ? 'bg-primary-main text-white border-primary-main font-bold shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Min & Max Inputs */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">৳</span>
            <input
              type="number"
              placeholder="সর্বনিম্ন"
              value={priceRange.min}
              onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
              className="w-full pl-6 pr-2 py-1.5 border border-slate-200 focus:border-primary-main rounded-xl bg-slate-50 focus:bg-white text-xs text-slate-900 outline-none"
            />
          </div>
          <span className="text-slate-400 text-xs font-bold">-</span>
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">৳</span>
            <input
              type="number"
              placeholder="সর্বোচ্চ"
              value={priceRange.max}
              onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
              className="w-full pl-6 pr-2 py-1.5 border border-slate-200 focus:border-primary-main rounded-xl bg-slate-50 focus:bg-white text-xs text-slate-900 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Special Badges & Toggles */}
      <div className="pt-2 border-t border-slate-100 space-y-2.5">
        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
          বিশেষ ফিচার
        </label>
        
        {/* Discount Only Toggle */}
        <label className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-rose-500 fill-current" />
            <span className="text-xs font-semibold text-slate-700">ছাড় ও বিশেষ অফার</span>
          </div>
          <input
            type="checkbox"
            checked={onlyDiscount}
            onChange={(e) => setOnlyDiscount(e.target.checked)}
            className="w-4 h-4 accent-primary-main rounded cursor-pointer"
          />
        </label>

        {/* In-Stock Only Toggle */}
        <label className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold text-slate-700">শুধুমাত্র ইন-স্টক পণ্য</span>
          </div>
          <input
            type="checkbox"
            checked={onlyInStock}
            onChange={(e) => setOnlyInStock(e.target.checked)}
            className="w-4 h-4 accent-primary-main rounded cursor-pointer"
          />
        </label>
      </div>

      {/* Minimum Rating */}
      <div className="pt-2 border-t border-slate-100">
        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
          কাস্টমার রেটিং
        </label>
        <div className="space-y-1.5">
          {[4, 3, 2].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => setMinRating(minRating === rating ? 0 : rating)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                minRating === rating
                  ? 'bg-amber-50 text-amber-900 border border-amber-300'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div className="flex items-center text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                    />
                  ))}
                </div>
                <span className="ml-1 text-[11px]">{rating}★ ও উপরে</span>
              </div>
              {minRating === rating && <Check className="w-3.5 h-3.5 text-amber-600" />}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMinRating(0)}
            className={`w-full px-3 py-1.5 rounded-xl text-xs font-medium text-left transition-colors cursor-pointer ${
              minRating === 0 ? 'text-primary-main font-bold' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            যেকোনো রেটিং
          </button>
        </div>
      </div>

      {/* Reset Button */}
      {hasActiveFilters && (
        <button
          onClick={handleClearFilters}
          className="w-full py-2.5 px-3 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>সব ফিল্টার মুছুন</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-20 sm:pb-24">
        
        {isSearchMode ? (
          /* ========================================================= */
          /* PURE CLEAN SEARCH RESULTS VIEW (DARAZ STYLE)             */
          /* Completely Free of Breadcrumb, Categories & Filter Clutter */
          /* ========================================================= */
          <div className="w-full">
            {/* Clean Minimalist Search Status Bar */}
            <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6 bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all shrink-0 cursor-pointer"
                  title="হোম পেজে ফিরে যান"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-600" />
                  <span>হোম</span>
                </Link>
                <div className="h-4 w-px bg-slate-200 shrink-0" />
                {isImageSearch && location.state?.uploadedImagePreview && (
                  <img
                    src={location.state.uploadedImagePreview}
                    alt="Uploaded search"
                    className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-2xs shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <h1 className="text-xs sm:text-base font-black text-slate-900 truncate">
                    {isImageSearch ? '📷 ছবির সাথে মিল থাকা পণ্যসমূহ' : `"${searchQuery || initialQuery}"`}
                  </h1>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {loading
                      ? 'পণ্য অনুসন্ধান করা হচ্ছে...'
                      : searchResults.length > 0
                        ? `${searchResults.length} টি পণ্য পাওয়া গেছে`
                        : 'কোনো পণ্য পাওয়া যায়নি'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleClearSearch}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                <span>সকল পণ্য</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Product Grid - Full Width without Sidebar or Filter clutter */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4">
                {Array.from({ length: 10 }).map((_, idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-3 animate-pulse">
                    <div className="aspect-square bg-slate-200 rounded-xl mb-3" />
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
                    <div className="h-5 bg-slate-200 rounded w-1/3 mb-2" />
                    <div className="h-8 bg-slate-100 rounded-lg w-full" />
                  </div>
                ))}
              </div>
            ) : currentSearchItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4 mb-8">
                {currentSearchItems.map((product) => (
                  <CategoryProductCard
                    key={product.id}
                    product={product}
                    isInWishlist={isInWishlist(product.id)}
                    onWishlistToggle={(e) => handleWishlistClick(e, product)}
                    onAddToCart={(e) => {
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
                      toast.success(`${product.name} কার্টে যোগ হয়েছে`);
                    }}
                    onBuyNow={(e) => handleBuyNow(e, product)}
                  />
                ))}
              </div>
            ) : (
              /* Clean Minimalist Empty State */
              <div className="bg-white rounded-2xl md:rounded-3xl p-8 sm:p-14 text-center border border-slate-200/90 shadow-xs mb-8 max-w-xl mx-auto">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-amber-100 shadow-2xs">
                  <Search className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <h3 className="text-base sm:text-xl font-black text-slate-900 mb-2">
                  কোনো পণ্য খুঁজে পাওয়া যায়নি
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
                  {isImageSearch
                    ? 'আপলোড করা ছবির সাথে মিল থাকা কোনো পণ্য আমাদের ভেন্ডারদের তালিকায় পাওয়া যায়নি। অন্য কোনো স্পষ্ট ছবি বা প্রোডাক্টের নাম লিখে অনুসন্ধান করুন।'
                    : searchQuery || initialQuery
                      ? `"${searchQuery || initialQuery}" এর সাথে মিলে এমন কোনো পণ্য আমাদের ভেন্ডারদের তালিকায় পাওয়া যায়নি।`
                      : 'আপনার অনুসন্ধানের সাথে মিলে এমন কোনো পণ্য পাওয়া যায়নি।'}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleClearSearch}
                    className="px-5 py-2.5 bg-primary-main hover:bg-sky-600 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm shadow-2xs transition-all cursor-pointer"
                  >
                    সকল পণ্য ব্রাউজ করুন
                  </button>
                  <Link
                    to="/"
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors"
                  >
                    হোমে ফিরে যান
                  </Link>
                </div>
              </div>
            )}

            {/* Clean Search Pagination */}
            {searchTotalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 py-4">
                <button
                  onClick={() => { setSearchPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={searchPage === 1}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: searchTotalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setSearchPage(i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                      searchPage === i + 1
                        ? 'bg-primary-main text-white shadow-2xs'
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => { setSearchPage(p => Math.min(searchTotalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={searchPage === searchTotalPages}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* REGULAR CATEGORY VIEW (FOR BROWSING CATEGORIES)           */
          /* ========================================================= */
          <>
            {/* Top Navigation & Breadcrumbs */}
            <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <Link
                  to="/"
                  id="category-back-btn"
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-lg sm:rounded-xl bg-white hover:bg-sky-50 border border-slate-200 hover:border-primary-main/40 text-slate-700 hover:text-primary-main text-xs font-semibold shadow-2xs transition-all shrink-0"
                  title="হোম পেজে ফিরে যান"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="text-[11px] sm:text-xs">হোম</span>
                </Link>

                <div className="h-4 w-px bg-slate-200 shrink-0" />

                <nav aria-label="Breadcrumb" className="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap hide-scrollbar">
                  <Link to="/" className="hover:text-primary-main transition-colors">Home</Link>
                  <span>/</span>
                  <Link to="/category/all" className="hover:text-primary-main transition-colors">Products</Link>
                  {selectedCategory !== 'all' ? (
                    <>
                      <span>/</span>
                      <span className="text-slate-800 font-semibold capitalize">
                        {selectedCategory.replace(/-/g, ' ')}
                      </span>
                    </>
                  ) : null}
                </nav>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs font-semibold text-slate-700">
                  <ShoppingBag className="w-3.5 h-3.5 text-primary-main" />
                  {filteredAndSortedProducts.length} টি পণ্য
                </span>
              </div>
            </div>

            {/* Page Banner / Header Card */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs mb-4 sm:mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                      {pageTitle}
                    </h1>
                    <span className="text-xs font-bold text-primary-main bg-sky-50 border border-sky-200/80 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                      {filteredAndSortedProducts.length} টি ফলাফল
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    প্রয়োজনীয় পণ্য সহজে খুঁজে পেতে ফিল্টার বা সর্ট অপশন ব্যবহার করুন
                  </p>
                </div>
              </div>

              {/* Quick Category Chips bar (Horizontal Scrolling) */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
                  ক্যাটাগরি:
                </span>
                <button
                  onClick={() => handleCategorySelect('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-primary-main text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  সবগুলো
                </button>
                {allCategories.map(cat => {
                  const isSelected = selectedCategory === (cat.path || cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.path || cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-primary-main text-white shadow-2xs font-bold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

        {/* Main Section: Left Sidebar + Product Grid */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* Desktop Left Sidebar Filter */}
          <aside className="hidden lg:block w-64 lg:w-72 shrink-0">
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/90 sticky top-24">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-primary-main" />
                  <h3 className="font-black text-sm text-slate-900">ফিল্টার</h3>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="text-xs text-primary-main hover:underline font-semibold"
                  >
                    রিসেট করুন
                  </button>
                )}
              </div>
              <FilterContent />
            </div>
          </aside>

          {/* Right Main Content */}
          <div className="flex-1 w-full min-w-0">
            
            {/* Toolbar: Counter, Active Filter Badges, Sort, Mobile Filter Button, View Toggle */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-2xs mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                
                {/* Result count */}
                <div className="flex items-center gap-2">
                  <p className="text-xs sm:text-sm text-slate-600">
                    দেখাচ্ছে <span className="font-bold text-slate-900">
                      {filteredAndSortedProducts.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedProducts.length)}
                    </span> (মোট <span className="font-bold text-primary-main">{filteredAndSortedProducts.length}</span> টি পণ্য)
                  </p>
                </div>

                {/* Right controls */}
                <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                  
                  {/* Mobile Filter Button */}
                  <button
                    onClick={() => setIsMobileFilterOpen(true)}
                    className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-primary-main rounded-xl text-xs font-bold text-slate-700 active:scale-95 shadow-2xs transition-all cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-primary-main" />
                    <span>ফিল্টার</span>
                    {activeFiltersCount > 0 && (
                      <span className="w-4 h-4 bg-primary-main text-white rounded-full text-[10px] flex items-center justify-center font-black ml-0.5">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>

                  {/* Sort dropdown */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 hidden md:inline">সর্ট:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="recommended">জনপ্রিয় (Recommended)</option>
                      <option value="newest">নতুন আগমন (Newest)</option>
                      <option value="price_low">মূল্য: কম থেকে বেশি</option>
                      <option value="price_high">মূল্য: বেশি থেকে কম</option>
                      <option value="rating">টপ রেটিং (Top Rated)</option>
                      <option value="discount">সর্বোচ্চ ছাড় (Discount)</option>
                    </select>
                  </div>

                  {/* View Mode Toggle (Grid vs List) */}
                  <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/70 text-slate-600">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        viewMode === 'grid'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="গ্রিড ভিউ"
                      aria-label="Grid View"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        viewMode === 'list'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="লিস্ট ভিউ"
                      aria-label="List View"
                    >
                      <ListIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Filter Tags (Removable Pills) */}
              {hasActiveFilters && (
                <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100 flex-wrap text-xs">
                  <span className="text-slate-400 font-medium text-[11px] mr-1">সক্রিয় ফিল্টার:</span>
                  
                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-50 text-primary-main rounded-lg border border-sky-200 font-semibold text-[11px]">
                      খুঁজছেন: "{searchQuery}"
                      <button onClick={() => setSearchQuery('')} className="hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {selectedCategory !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 font-semibold text-[11px]">
                      {selectedCategory}
                      <button onClick={() => handleCategorySelect('all')} className="hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {(priceRange.min || priceRange.max) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 font-semibold text-[11px]">
                      ৳{priceRange.min || '০'} - ৳{priceRange.max || 'সর্বোচ্চ'}
                      <button onClick={() => setPriceRange({ min: '', max: '' })} className="hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {onlyDiscount && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-200 font-semibold text-[11px]">
                      ছাড়যুক্ত পণ্য
                      <button onClick={() => setOnlyDiscount(false)} className="hover:text-rose-800">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {onlyInStock && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 font-semibold text-[11px]">
                      ইন-স্টক
                      <button onClick={() => setOnlyInStock(false)} className="hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {minRating > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 font-semibold text-[11px]">
                      {minRating}★ ও উপরে
                      <button onClick={() => setMinRating(0)} className="hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  <button
                    onClick={handleClearFilters}
                    className="text-rose-600 hover:underline font-bold text-[11px] ml-1"
                  >
                    সব মুছুন
                  </button>
                </div>
              )}
            </div>

            {/* Loading State Skeleton */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-3 animate-pulse">
                    <div className="aspect-square bg-slate-200 rounded-xl mb-3" />
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
                    <div className="h-5 bg-slate-200 rounded w-1/3 mb-2" />
                    <div className="h-8 bg-slate-100 rounded-lg w-full" />
                  </div>
                ))}
              </div>
            ) : currentItems.length > 0 ? (
              /* Product Display: Grid or List */
              viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 mb-8">
                  {currentItems.map((product) => (
                    <CategoryProductCard
                      key={product.id}
                      product={product}
                      isInWishlist={isInWishlist(product.id)}
                      onWishlistToggle={(e) => handleWishlistClick(e, product)}
                      onAddToCart={(e) => {
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
                        toast.success(`${product.name} কার্টে যোগ হয়েছে`);
                      }}
                      onBuyNow={(e) => handleBuyNow(e, product)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3 mb-8">
                  {currentItems.map((product) => (
                    <CategoryProductListCard
                      key={product.id}
                      product={product}
                      isInWishlist={isInWishlist(product.id)}
                      onWishlistToggle={(e) => handleWishlistClick(e, product)}
                      onAddToCart={(e) => {
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
                        toast.success(`${product.name} কার্টে যোগ হয়েছে`);
                      }}
                      onBuyNow={(e) => handleBuyNow(e, product)}
                    />
                  ))}
                </div>
              )
            ) : (
              /* Empty Search Results State */
              <div className="bg-white rounded-2xl md:rounded-3xl p-6 sm:p-12 text-center border border-slate-200/90 shadow-xs mb-8">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-amber-100 shadow-2xs">
                  <Search className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <h3 className="text-base sm:text-xl font-black text-slate-900 mb-1.5">
                  {selectedCategory && selectedCategory !== 'all' && !searchQuery.trim()
                    ? `"${pageTitle}" ক্যাটাগরিতে বর্তমানে কোনো পণ্য নেই`
                    : 'আপনার অনুসন্ধানের সাথে মিলে এমন কোনো পণ্য পাওয়া যায়নি'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
                  {searchQuery 
                    ? `"${searchQuery}" এর জন্য কোনো ফলাফল নেই।` 
                    : (selectedCategory && selectedCategory !== 'all' 
                        ? 'এই ক্যাটাগরিতে শীঘ্রই নতুন পণ্য যুক্ত করা হবে।' 
                        : 'বর্তমান ফিল্টারের সাথে মিলে কোনো পণ্য নেই।')} অনুগ্রহ করে অন্য কোনো ক্যাটাগরি দেখুন বা সার্চ ফিল্টার পরিবর্তন করুন।
                </p>

                {/* Popular Keywords suggestion chips */}
                <div className="mb-6">
                  <span className="text-xs font-bold text-slate-700 block mb-2">
                    জনপ্রিয় সার্চ পরামর্শ:
                  </span>
                  <div className="flex flex-wrap justify-center gap-1.5 max-w-lg mx-auto">
                    {POPULAR_SEARCH_TAGS.map((tag, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSearchQuery(tag);
                          navigate(`/category/all?q=${encodeURIComponent(tag)}`);
                        }}
                        className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-sky-50 hover:text-primary-main hover:border-primary-main/40 border border-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <button
                    onClick={handleClearFilters}
                    className="w-full sm:w-auto px-5 py-2.5 bg-primary-main hover:bg-sky-600 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm shadow-2xs transition-all cursor-pointer"
                  >
                    সকল ফিল্টার রিসেট করুন
                  </button>
                  <Link
                    to="/"
                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors"
                  >
                    হোম পেজে ফিরে যান
                  </Link>
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="text-xs text-slate-500">
                  পাতা <span className="font-bold text-slate-900">{currentPage}</span> / <span className="font-bold text-slate-900">{totalPages}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    title="পূর্ববর্তী পাতা"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pageNum = i + 1;
                    // Keep pagination compact if many pages
                    if (
                      totalPages > 7 &&
                      pageNum !== 1 &&
                      pageNum !== totalPages &&
                      Math.abs(pageNum - currentPage) > 1
                    ) {
                      if (pageNum === 2 || pageNum === totalPages - 1) {
                        return <span key={i} className="px-1 text-slate-400 text-xs">...</span>;
                      }
                      return null;
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-primary-main text-white shadow-2xs border border-primary-main'
                            : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    title="পরবর্তী পাতা"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Popular Recommendations Section (Shown if 0 results or at page bottom) */}
            {currentItems.length === 0 && recommendedProducts.length > 0 && (
              <div className="mt-8 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-2xs">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      জনপ্রিয় ও ট্রেন্ডিং পণ্যসমূহ
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      আপনি এগুলোও দেখে নিতে পারেন
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3.5">
                  {recommendedProducts.slice(0, 4).map(prod => (
                    <CategoryProductCard
                      key={prod.id}
                      product={prod}
                      isInWishlist={isInWishlist(prod.id)}
                      onWishlistToggle={(e) => handleWishlistClick(e, prod)}
                      onAddToCart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addToCart({
                          id: prod.id,
                          name: prod.name,
                          price: Number(prod.price) || 0,
                          originalPrice: prod.originalPrice ? Number(prod.originalPrice) : undefined,
                          image: prod.featuredImage || prod.image || (prod.images && prod.images[0]) || '',
                          quantity: 1,
                          vendorId: prod.vendorId
                        });
                        toast.success(`${prod.name} কার্টে যোগ হয়েছে`);
                      }}
                      onBuyNow={(e) => handleBuyNow(e, prod)}
                    />
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
        </>
      )}

      </main>

      {/* Mobile Filter Drawer / Slide-Over - Only active when not in search mode */}
      <AnimatePresence>
        {isMobileFilterOpen && !isSearchMode && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileFilterOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 lg:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-full max-w-xs bg-white z-50 shadow-2xl flex flex-col lg:hidden"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-primary-main" />
                  <h2 className="text-base font-black text-slate-900">ফিল্টার ও ক্যাটাগরি</h2>
                </div>
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-4 overflow-y-auto flex-1 hide-scrollbar">
                <FilterContent />
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    handleClearFilters();
                    setIsMobileFilterOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white transition-colors"
                >
                  রিসেট
                </button>
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="w-full py-2.5 bg-primary-main hover:bg-sky-600 text-white font-bold rounded-xl text-xs shadow-2xs transition-colors"
                >
                  ফলাফল ({filteredAndSortedProducts.length})
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}

// -------------------------------------------------------------
// Component: Category Product Card (Grid View)
// -------------------------------------------------------------
interface CategoryCardProps {
  product: Product;
  isInWishlist: boolean;
  onWishlistToggle: (e: React.MouseEvent) => void;
  onAddToCart: (e: React.MouseEvent) => void;
  onBuyNow: (e: React.MouseEvent) => void;
}

function CategoryProductCard({
  product,
  isInWishlist,
  onWishlistToggle,
  onAddToCart,
  onBuyNow
}: CategoryCardProps) {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const isReseller = userData?.role === 'Reseller' || userData?.hasActiveReseller === true;
  const isVendorOrAdmin = userData?.role === 'Vendor' || userData?.role === 'Admin';

  const shopPrice = Number(product.price) || 0;
  const hasVendorResellerPrice = (product as any).resellerPrice !== undefined && (product as any).resellerPrice !== null && Number((product as any).resellerPrice) > 0;
  const resellerPrice = hasVendorResellerPrice ? Number((product as any).resellerPrice) : shopPrice;
  const originalPrice = product.originalPrice ? Number(product.originalPrice) : undefined;

  const discountPercent = product.discount || (
    originalPrice && originalPrice > shopPrice
      ? Math.round(((originalPrice - shopPrice) / originalPrice) * 100)
      : undefined
  );

  return (
    <div
      onClick={() => navigate(`/product/${product.id}`, { state: { product } })}
      className="group bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 hover:border-sky-300 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer"
    >
      {/* Media Box */}
      <div className="relative aspect-square w-full bg-slate-50 overflow-hidden shrink-0">
        <img
          referrerPolicy="no-referrer"
          loading="lazy"
          src={formatDirectImageUrl(product.featuredImage || product.image || (product.images && product.images[0])) || PLACEHOLDER_PRODUCT_IMAGE}
          alt={product.name}
          onError={(e) => handleProductImageError(e)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none"
        />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
          {discountPercent ? (
            <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black bg-rose-500 text-white rounded-md shadow-2xs">
              -{discountPercent}%
            </span>
          ) : null}
          {product.isNew && (
            <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black bg-primary-main text-white rounded-md shadow-2xs">
              NEW
            </span>
          )}
        </div>

        {/* Wishlist Heart Button */}
        <button
          onClick={onWishlistToggle}
          className="absolute top-2 right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 hover:bg-white text-slate-400 hover:text-rose-500 backdrop-blur-xs flex items-center justify-center shadow-2xs transition-colors z-10 cursor-pointer"
          title="পছন্দের তালিকায় রাখুন"
        >
          <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isInWishlist ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>
      </div>

      {/* Details Box */}
      <div className="p-2 sm:p-3 flex flex-col justify-between flex-1 gap-1.5">
        <div>
          {/* Rating */}
          <div className="flex items-center gap-1 mb-1">
            <div className="flex items-center text-amber-500">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-[11px] font-bold text-slate-700 ml-1">
                {product.rating || 4.8}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              ({product.reviews || 16})
            </span>
          </div>

          {/* Product Title */}
          <h3
            className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-primary-main transition-colors"
            title={product.name}
          >
            {product.name}
          </h3>
        </div>

        {/* Price & Action Row */}
        <div className="mt-auto pt-1">
          {/* Price display */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            {isReseller ? (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-sm sm:text-base font-black text-emerald-600">
                    ৳{resellerPrice.toLocaleString()}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1 py-0.2 rounded">
                    রিসেলার
                  </span>
                </div>
                <div className="flex items-baseline gap-1 text-[11px] text-slate-500 font-medium">
                  <span>স্টোর প্রাইস:</span>
                  <span className="font-bold text-slate-700">৳{shopPrice.toLocaleString()}</span>
                </div>
              </div>
            ) : isVendorOrAdmin ? (
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-black text-slate-900">
                  ৳{shopPrice.toLocaleString()}
                </span>
                {hasVendorResellerPrice && (
                  <span className="text-[9px] text-emerald-600 font-semibold">
                    রিসেলার: ৳{resellerPrice.toLocaleString()}
                  </span>
                )}
              </div>
            ) : (
              <>
                <span className="text-sm sm:text-base font-black text-slate-950">
                  ৳{shopPrice.toLocaleString()}
                </span>
                {originalPrice && originalPrice > shopPrice && (
                  <span className="text-[10px] sm:text-xs text-slate-400 line-through">
                    ৳{originalPrice.toLocaleString()}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Action Buttons: Add to Cart & Buy Now */}
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <button
              onClick={onAddToCart}
              className="w-full py-1.5 sm:py-2 px-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-lg text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-200/80 min-h-[34px] sm:min-h-[36px]"
              title="কার্টে যোগ করুন"
            >
              <ShoppingCart className="w-3 h-3 shrink-0" />
              <span className="truncate">কার্ট</span>
            </button>

            <button
              onClick={onBuyNow}
              className="w-full py-1.5 sm:py-2 px-1 bg-primary-main hover:bg-sky-600 active:scale-95 text-white rounded-lg text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer min-h-[34px] sm:min-h-[36px]"
              title="সরাসরি অর্ডার করুন"
            >
              <Zap className="w-3 h-3 fill-current shrink-0" />
              <span className="truncate">অর্ডার</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: Category Product List Card (List View)
// -------------------------------------------------------------
function CategoryProductListCard({
  product,
  isInWishlist,
  onWishlistToggle,
  onAddToCart,
  onBuyNow
}: CategoryCardProps) {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const isReseller = userData?.role === 'Reseller' || userData?.hasActiveReseller === true;

  const shopPrice = Number(product.price) || 0;
  const hasVendorResellerPrice = (product as any).resellerPrice !== undefined && (product as any).resellerPrice !== null && Number((product as any).resellerPrice) > 0;
  const resellerPrice = hasVendorResellerPrice ? Number((product as any).resellerPrice) : shopPrice;
  const originalPrice = product.originalPrice ? Number(product.originalPrice) : undefined;

  const discountPercent = product.discount || (
    originalPrice && originalPrice > shopPrice
      ? Math.round(((originalPrice - shopPrice) / originalPrice) * 100)
      : undefined
  );

  return (
    <div
      onClick={() => navigate(`/product/${product.id}`, { state: { product } })}
      className="group bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 hover:border-sky-300 p-2.5 sm:p-4 transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs hover:shadow-sm cursor-pointer"
    >
      {/* Left side: Image + Title + Specs */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 w-full sm:w-auto">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-50 shrink-0 border border-slate-100">
          <img
            referrerPolicy="no-referrer"
            loading="lazy"
            src={formatDirectImageUrl(product.featuredImage || product.image || (product.images && product.images[0])) || PLACEHOLDER_PRODUCT_IMAGE}
            alt={product.name}
            onError={(e) => handleProductImageError(e)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {discountPercent ? (
            <span className="absolute top-1 left-1 px-1 py-0.2 text-[8px] font-black bg-rose-500 text-white rounded">
              -{discountPercent}%
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-primary-main transition-colors leading-snug"
            title={product.name}
          >
            {product.name}
          </h3>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <div className="flex items-center text-amber-500">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-[11px] font-bold text-slate-700 ml-0.5">
                {product.rating || 4.8}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              ({product.reviews || 16} রিভিউ)
            </span>
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded font-medium">
              ইন-স্টক
            </span>
          </div>

          {/* Mobile inline price */}
          <div className="mt-1 sm:hidden">
            {isReseller ? (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-black text-emerald-600">
                    ৳{resellerPrice.toLocaleString()}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                    রিসেলার
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  স্টোর প্রাইস: <span className="font-bold text-slate-800">৳{shopPrice.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-black text-slate-950">
                  ৳{shopPrice.toLocaleString()}
                </span>
                {originalPrice && originalPrice > shopPrice && (
                  <span className="text-[10px] text-slate-400 line-through">
                    ৳{originalPrice.toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Desktop Price & Buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        {/* Desktop Price */}
        <div className="hidden sm:block text-right shrink-0">
          {isReseller ? (
            <div>
              <div className="text-base font-black text-emerald-600">
                ৳{resellerPrice.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500">
                স্টোর প্রাইস: <span className="font-bold text-slate-700">৳{shopPrice.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-base font-black text-slate-900">
                ৳{shopPrice.toLocaleString()}
              </div>
              {originalPrice && originalPrice > shopPrice && (
                <div className="text-xs text-slate-400 line-through">
                  ৳{originalPrice.toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={onAddToCart}
            className="flex-1 sm:flex-initial px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200/80 min-h-[38px]"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>কার্টে যোগ</span>
          </button>

          <button
            onClick={onBuyNow}
            className="flex-1 sm:flex-initial px-3.5 py-2 bg-primary-main hover:bg-sky-600 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer min-h-[38px]"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>অর্ডার</span>
          </button>

          <button
            onClick={onWishlistToggle}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="উইশলিস্ট"
          >
            <Heart className={`w-4 h-4 ${isInWishlist ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
