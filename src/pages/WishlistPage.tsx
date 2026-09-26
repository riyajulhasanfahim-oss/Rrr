import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Trash2, 
  ShoppingCart, 
  Search, 
  ChevronDown, 
  ArrowRight, 
  ArrowLeft,
  LayoutGrid,
  List as ListIcon,
  CheckCircle2,
  Star,
  Zap,
  CheckSquare,
  Square,
  X,
  Sparkles,
  ShoppingBag,
  Flame,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { useWishlist, WishlistItem } from '../contexts/WishlistContext';
import { useCart } from '../contexts/CartContext';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../utils/imageUrl';
import { fetchAllMarketplaceProducts, getCachedMarketplaceProducts } from '../services/productService';

export default function WishlistPage() {
  const navigate = useNavigate();
  const { items, removeFromWishlist, clearWishlist, addToWishlist, isInWishlist } = useWishlist();
  const { addToCart } = useCart();
  
  // State for search, sort, filter & view
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'priceAsc' | 'priceDesc' | 'rating' | 'discount'>('newest');
  const [activeFilter, setActiveFilter] = useState<'all' | 'discount' | 'inStock'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Confirmation modal for clear wishlist
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Recommended products for empty state or footer discovery
  const [recommendedProducts, setRecommendedProducts] = useState<any[]>(() => {
    return getCachedMarketplaceProducts().slice(0, 10);
  });

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Fetch recommended products from RTDB
  useEffect(() => {
    let isMounted = true;
    const fetchRecs = async () => {
      try {
        const prods = await fetchAllMarketplaceProducts();
        if (isMounted && prods && prods.length > 0) {
          setRecommendedProducts(prods.slice(0, 10));
        }
      } catch (err) {
        console.warn('Error loading recommended products for wishlist:', err);
      }
    };
    fetchRecs();
    return () => { isMounted = false; };
  }, []);

  // Sync selected IDs if items get removed
  useEffect(() => {
    setSelectedIds(prev => {
      const itemIds = new Set(items.map(i => i.id));
      return prev.filter(id => itemIds.has(id));
    });
  }, [items]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];
    
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => 
        (item.name || '').toLowerCase().includes(q)
      );
    }
    
    // Filter chips
    if (activeFilter === 'discount') {
      result = result.filter(item => 
        (item.discount && item.discount > 0) || 
        (item.originalPrice && item.originalPrice > item.price)
      );
    }

    // Sort order
    switch (sortOrder) {
      case 'newest':
        result.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        break;
      case 'oldest':
        result.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
        break;
      case 'priceAsc':
        result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        break;
      case 'priceDesc':
        result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
        break;
      case 'rating':
        result.sort((a, b) => Number(b.rating || 4.8) - Number(a.rating || 4.8));
        break;
      case 'discount':
        result.sort((a, b) => {
          const discA = a.discount || (a.originalPrice ? ((a.originalPrice - a.price) / a.originalPrice) * 100 : 0);
          const discB = b.discount || (b.originalPrice ? ((b.originalPrice - b.price) / b.originalPrice) * 100 : 0);
          return discB - discA;
        });
        break;
      default:
        break;
    }
    
    return result;
  }, [items, searchQuery, activeFilter, sortOrder]);

  // Calculations for summary
  const totalValue = useMemo(() => {
    return items.reduce((acc, item) => acc + (Number(item.price) || 0), 0);
  }, [items]);

  const totalSavings = useMemo(() => {
    return items.reduce((acc, item) => {
      if (item.originalPrice && item.originalPrice > item.price) {
        return acc + (item.originalPrice - item.price);
      }
      return acc;
    }, 0);
  }, [items]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map(i => i.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Add to cart handler
  const handleAddToCart = (e: React.MouseEvent, item: WishlistItem) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      id: item.id,
      name: item.name,
      price: Number(item.price) || 0,
      originalPrice: item.originalPrice ? Number(item.originalPrice) : undefined,
      image: item.image,
      quantity: 1
    });
    toast.success(`${item.name} কার্টে যুক্ত করা হয়েছে`);
  };

  // Direct Buy Now / Order Now
  const handleBuyNow = (e: React.MouseEvent, item: WishlistItem) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      id: item.id,
      name: item.name,
      price: Number(item.price) || 0,
      originalPrice: item.originalPrice ? Number(item.originalPrice) : undefined,
      image: item.image,
      quantity: 1
    });
    navigate('/checkout', {
      state: {
        buyNowItem: {
          id: item.id,
          name: item.name,
          price: Number(item.price) || 0,
          originalPrice: item.originalPrice ? Number(item.originalPrice) : undefined,
          image: item.image,
          quantity: 1
        }
      }
    });
  };

  // Add all to cart
  const handleAddAllToCart = () => {
    if (items.length === 0) return;
    items.forEach(item => {
      addToCart({
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        originalPrice: item.originalPrice ? Number(item.originalPrice) : undefined,
        image: item.image,
        quantity: 1
      });
    });
    toast.success(`সকল ${items.length} টি পণ্য কার্টে যুক্ত করা হয়েছে!`);
  };

  // Add selected to cart
  const handleAddSelectedToCart = () => {
    if (selectedIds.length === 0) return;
    const selectedList = items.filter(i => selectedIds.includes(i.id));
    selectedList.forEach(item => {
      addToCart({
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        originalPrice: item.originalPrice ? Number(item.originalPrice) : undefined,
        image: item.image,
        quantity: 1
      });
    });
    toast.success(`${selectedList.length} টি নির্বাচিত পণ্য কার্টে যোগ করা হয়েছে`);
    setSelectedIds([]);
  };

  // Remove selected items
  const handleRemoveSelected = () => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach(id => removeFromWishlist(id));
    toast.success(`${selectedIds.length} টি পণ্য উইশলিস্ট থেকে সরানো হয়েছে`);
    setSelectedIds([]);
  };

  // Confirm Clear All
  const handleConfirmClear = () => {
    clearWishlist();
    setShowClearConfirm(false);
    setSelectedIds([]);
    toast.success('উইশলিস্ট খালি করা হয়েছে');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-3 sm:pt-6 md:pt-8 pb-20 sm:pb-24">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          
          {/* Top Navigation & Breadcrumbs */}
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <Link
                to="/"
                id="wishlist-back-to-home-btn"
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
                <span className="text-slate-800 font-semibold">Wishlist</span>
              </nav>
            </div>

            {items.length > 0 && (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={handleAddAllToCart}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary-main hover:bg-sky-600 active:scale-95 text-white text-xs font-bold rounded-lg shadow-2xs transition-all cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>সব কার্টে যোগ করুন</span>
                </button>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>খালি করুন</span>
                </button>
              </div>
            )}
          </div>

          {/* Page Banner / Header Card */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs mb-4 sm:mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shadow-2xs shrink-0">
                  <Heart className="w-5 h-5 sm:w-6 sm:h-6 fill-rose-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                      My Wishlist
                    </h1>
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200/70 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                      {items.length} টি পণ্য সংরক্ষিত
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    আপনার পছন্দের পণ্যগুলো এখানে সংরক্ষিত রয়েছে। সহজে কার্টে যুক্ত করুন বা সরাসরি অর্ডার করুন।
                  </p>
                </div>
              </div>

              {/* Price Stats pill if items exist */}
              {items.length > 0 && (
                <div className="flex items-center gap-3 sm:gap-4 bg-slate-50 border border-slate-200/70 px-3.5 py-2 rounded-xl self-start md:self-auto shrink-0 text-xs sm:text-sm">
                  <div>
                    <span className="text-[10px] sm:text-xs text-slate-500 block">মোট আনুমানিক মূল্য</span>
                    <span className="font-black text-slate-900 text-sm sm:text-base">
                      ৳{totalValue.toLocaleString()}
                    </span>
                  </div>
                  {totalSavings > 0 && (
                    <>
                      <div className="w-px h-7 bg-slate-200" />
                      <div>
                        <span className="text-[10px] sm:text-xs text-emerald-600 block">সম্ভাব্য সাশ্রয়</span>
                        <span className="font-bold text-emerald-600 text-sm sm:text-base">
                          ৳{totalSavings.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Action Buttons (Add All & Clear) */}
            {items.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 sm:hidden">
                <button
                  onClick={handleAddAllToCart}
                  className="w-full py-2 px-2 bg-primary-main active:bg-sky-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>সব কার্টে যোগ</span>
                </button>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="w-full py-2 px-2 bg-white active:bg-rose-50 text-slate-600 border border-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>উইশলিস্ট খালি</span>
                </button>
              </div>
            )}
          </div>

          {/* Controls Bar: Search, Sort, Filter & View Toggle */}
          {items.length > 0 && (
            <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-2xs mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="পছন্দের পণ্য খুঁজুন..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-primary-main rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filters, Sort & View Mode */}
                <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                  {/* Filter Chips */}
                  <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/70 text-xs">
                    <button
                      onClick={() => setActiveFilter('all')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        activeFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      সব ({items.length})
                    </button>
                    <button
                      onClick={() => setActiveFilter('discount')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                        activeFilter === 'discount'
                          ? 'bg-white text-rose-600 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Zap className="w-3 h-3 text-rose-500 fill-current" />
                      ছাড়
                    </button>
                  </div>

                  {/* Sort Order Dropdown */}
                  <div className="relative">
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as any)}
                      className="appearance-none pl-3 pr-8 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                    >
                      <option value="newest">নতুন আগে</option>
                      <option value="oldest">পুরাতন আগে</option>
                      <option value="priceAsc">মূল্য: কম থেকে বেশি</option>
                      <option value="priceDesc">মূল্য: বেশি থেকে কম</option>
                      <option value="rating">টপ রেটিং</option>
                      <option value="discount">সর্বোচ্চ ছাড়</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
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

              {/* Bulk Selection Bar if items match filter */}
              {filteredItems.length > 0 && (
                <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleSelectAll}
                      className="inline-flex items-center gap-1.5 font-medium hover:text-slate-900 cursor-pointer select-none"
                    >
                      {selectedIds.length === filteredItems.length && filteredItems.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-primary-main fill-primary-main/10" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <span>সব নির্বাচন করুন ({selectedIds.length}/{filteredItems.length})</span>
                    </button>
                  </div>

                  {selectedIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddSelectedToCart}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-primary-main font-semibold rounded-lg border border-sky-200/80 transition-colors cursor-pointer"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        <span>নির্বাচিত কার্টে যোগ ({selectedIds.length})</span>
                      </button>
                      <button
                        onClick={handleRemoveSelected}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium rounded-lg border border-rose-200/80 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>মুছুন</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty State View */}
          {items.length === 0 ? (
            <div className="bg-white rounded-2xl md:rounded-3xl p-8 sm:p-14 text-center shadow-xs border border-slate-200/90 max-w-xl mx-auto my-6 sm:my-10">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-2xs border border-rose-100">
                <Heart className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
                আপনার উইশলিস্ট বর্তমানে ফাঁকা
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mb-6 max-w-md mx-auto leading-relaxed">
                পণ্য ব্রাউজ করার সময় হার্ট আইকনে ক্লিক করে পছন্দের পণ্যগুলো এখানে সংরক্ষণ করুন। যেকোনো সময় দ্রুত কার্টে যোগ বা সরাসরি অর্ডার করতে পারবেন।
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary-main hover:bg-sky-600 active:scale-95 text-white font-bold rounded-xl shadow-xs transition-all text-xs sm:text-sm"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>পণ্য ব্রাউজ করুন</span>
                </Link>
                <Link
                  to="/cart"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all text-xs sm:text-sm"
                >
                  <span>আমার কার্ট দেখুন</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            /* No results from search */
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200/80 my-6">
              <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Search className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                কোনো পণ্য খুঁজে পাওয়া যায়নি
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                "{searchQuery}" এর সাথে মিলে এমন কোনো পণ্য আপনার উইশলিস্টে নেই।
              </p>
              <button
                onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                ফিল্টার মুছুন
              </button>
            </div>
          ) : (
            /* Wishlist Items Display (Grid or List View) */
            viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {filteredItems.map(item => (
                  <WishlistGridCard
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.includes(item.id)}
                    onToggleSelect={() => toggleSelectItem(item.id)}
                    onAddToCart={(e) => handleAddToCart(e, item)}
                    onBuyNow={(e) => handleBuyNow(e, item)}
                    onRemove={() => {
                      removeFromWishlist(item.id);
                      toast.success('উইশলিস্ট থেকে সরানো হয়েছে');
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 sm:gap-3">
                {filteredItems.map(item => (
                  <WishlistListCard
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.includes(item.id)}
                    onToggleSelect={() => toggleSelectItem(item.id)}
                    onAddToCart={(e) => handleAddToCart(e, item)}
                    onBuyNow={(e) => handleBuyNow(e, item)}
                    onRemove={() => {
                      removeFromWishlist(item.id);
                      toast.success('উইশলিস্ট থেকে সরানো হয়েছে');
                    }}
                  />
                ))}
              </div>
            )
          )}

          {/* Recommended / Popular Products Section */}
          {recommendedProducts.length > 0 && (
            <div className="mt-10 sm:mt-14 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                      জনপ্রিয় ও ট্রেন্ডিং পণ্যসমূহ
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500">
                      আপনার পছন্দের সাথে মিলে এমন কিছু সেরা প্রোডাক্ট
                    </p>
                  </div>
                </div>
                <Link
                  to="/"
                  className="text-xs font-bold text-primary-main hover:text-sky-700 flex items-center gap-1"
                >
                  <span>সব দেখুন</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
                {recommendedProducts.slice(0, 5).map(prod => (
                  <div
                    key={prod.id}
                    className="group bg-white rounded-xl border border-slate-200 hover:border-amber-300 shadow-2xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer"
                    onClick={() => navigate(`/product/${prod.id}`, { state: { product: prod } })}
                  >
                    <div className="relative aspect-square overflow-hidden bg-slate-50">
                      <img
                        referrerPolicy="no-referrer"
                        src={prod.featuredImage || prod.image || (prod.images && prod.images[0])}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isInWishlist(prod.id)) {
                            removeFromWishlist(prod.id);
                            toast.success('উইশলিস্ট থেকে সরানো হয়েছে');
                          } else {
                            addToWishlist({
                              id: prod.id,
                              name: prod.name,
                              price: Number(prod.price) || 0,
                              originalPrice: prod.originalPrice,
                              image: prod.featuredImage || prod.image || (prod.images && prod.images[0]) || '',
                              addedAt: Date.now()
                            });
                            toast.success('উইশলিস্টে যুক্ত করা হয়েছে');
                          }
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-2xs"
                      >
                        <Heart className={`w-3.5 h-3.5 ${isInWishlist(prod.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                    </div>
                    <div className="p-2 sm:p-2.5 flex flex-col justify-between flex-1">
                      <h3 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-primary-main">
                        {prod.name}
                      </h3>
                      <div className="mt-2 flex items-baseline justify-between gap-1">
                        <span className="text-xs sm:text-sm font-black text-slate-900">
                          ৳{Number(prod.price || 0).toLocaleString()}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart({
                              id: prod.id,
                              name: prod.name,
                              price: Number(prod.price) || 0,
                              originalPrice: prod.originalPrice,
                              image: prod.featuredImage || prod.image || (prod.images && prod.images[0]) || '',
                              quantity: 1
                            });
                            toast.success(`${prod.name} কার্টে যোগ হয়েছে`);
                          }}
                          className="p-1.5 rounded-lg bg-sky-50 hover:bg-primary-main text-primary-main hover:text-white transition-colors cursor-pointer"
                          title="কার্টে যোগ করুন"
                        >
                          <ShoppingCart className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Confirmation Modal for Clear Wishlist */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 text-center mb-1">
              উইশলিস্ট খালি করতে চান?
            </h3>
            <p className="text-xs text-slate-500 text-center mb-5 leading-relaxed">
              আপনার সংরক্ষিত সকল {items.length} টি পণ্য উইশলিস্ট থেকে মুছে ফেলা হবে।
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                onClick={handleConfirmClear}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-xs font-bold text-white shadow-2xs transition-all cursor-pointer"
              >
                হ্যাঁ, খালি করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Bar for Mobile Multi-select */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:hidden shadow-lg animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate-900 block">
                {selectedIds.length} টি নির্বাচিত
              </span>
              <span className="text-[10px] text-slate-500">
                ৳{items.filter(i => selectedIds.includes(i.id)).reduce((a, b) => a + Number(b.price || 0), 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRemoveSelected}
                className="p-2 rounded-xl bg-slate-100 text-rose-600 active:bg-rose-50"
                title="মুছে ফেলুন"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleAddSelectedToCart}
                className="px-4 py-2 rounded-xl bg-primary-main text-white text-xs font-bold active:bg-sky-600 flex items-center gap-1.5 shadow-2xs"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>কার্টে যোগ করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

// -------------------------------------------------------------
// Component: Wishlist Grid Card (Optimized for Mobile & Desktop)
// -------------------------------------------------------------
interface WishlistCardProps {
  item: WishlistItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  onAddToCart: (e: React.MouseEvent) => void;
  onBuyNow: (e: React.MouseEvent) => void;
  onRemove: () => void;
}

function WishlistGridCard({
  item,
  isSelected,
  onToggleSelect,
  onAddToCart,
  onBuyNow,
  onRemove
}: WishlistCardProps) {
  const currentPrice = Number(item.price) || 0;
  const originalPrice = item.originalPrice ? Number(item.originalPrice) : undefined;
  
  const discountPercent = item.discount || (
    originalPrice && originalPrice > currentPrice
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
      : undefined
  );

  return (
    <div
      className={`group relative bg-white rounded-xl sm:rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-md ${
        isSelected 
          ? 'border-primary-main ring-2 ring-primary-main/20 bg-sky-50/20' 
          : 'border-slate-200/90 hover:border-slate-300'
      }`}
    >
      {/* Top Media Area */}
      <div className="relative aspect-square w-full bg-slate-50 overflow-hidden shrink-0">
        <Link to={`/product/${item.id}`} state={{ product: item }} className="block w-full h-full">
          <img
            referrerPolicy="no-referrer"
            loading="lazy"
            src={formatDirectImageUrl(item.image) || PLACEHOLDER_PRODUCT_IMAGE}
            alt={item.name}
            onError={(e) => handleProductImageError(e)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none"
          />
        </Link>

        {/* Checkbox for Multi-select */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className="absolute top-2 left-2 w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-700 shadow-2xs z-10 cursor-pointer"
          title={isSelected ? 'বাছাই বাতিল করুন' : 'বাছাই করুন'}
        >
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-primary-main fill-primary-main/15" />
          ) : (
            <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          )}
        </button>

        {/* Remove Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/90 hover:bg-white text-slate-400 hover:text-rose-600 backdrop-blur-xs flex items-center justify-center shadow-2xs transition-colors z-10 cursor-pointer"
          title="উইশলিস্ট থেকে মুছুন"
        >
          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Discount Badge */}
        {discountPercent ? (
          <span className="absolute bottom-2 left-2 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black bg-rose-500 text-white rounded-md shadow-2xs">
            -{discountPercent}%
          </span>
        ) : null}
      </div>

      {/* Details Container */}
      <div className="p-2 sm:p-3 flex flex-col justify-between flex-1 gap-1.5">
        <div>
          {/* Rating */}
          <div className="flex items-center gap-1 mb-1">
            <div className="flex items-center text-amber-500">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-[11px] font-bold text-slate-700 ml-1">
                {item.rating || 4.8}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              ({item.reviews || 24})
            </span>
          </div>

          {/* Product Title */}
          <Link to={`/product/${item.id}`} state={{ product: item }}>
            <h3 
              className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-2 leading-snug hover:text-primary-main transition-colors"
              title={item.name}
            >
              {item.name}
            </h3>
          </Link>
        </div>

        {/* Price & Action Row */}
        <div className="mt-auto pt-1">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm sm:text-base font-black text-slate-950">
              ৳{currentPrice.toLocaleString()}
            </span>
            {originalPrice && originalPrice > currentPrice && (
              <span className="text-[10px] sm:text-xs text-slate-400 line-through">
                ৳{originalPrice.toLocaleString()}
              </span>
            )}
          </div>

          {/* Action Buttons: Add to Cart & Buy Now */}
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <button
              onClick={onAddToCart}
              className="w-full py-2 sm:py-2 px-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-lg text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-200/80 min-h-[36px]"
              title="কার্টে যোগ করুন"
            >
              <ShoppingCart className="w-3 h-3 shrink-0" />
              <span className="truncate">কার্ট</span>
            </button>

            <button
              onClick={onBuyNow}
              className="w-full py-2 sm:py-2 px-1 bg-primary-main hover:bg-sky-600 active:scale-95 text-white rounded-lg text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer min-h-[36px]"
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
// Component: Wishlist List Card (Compact Horizontal Format)
// -------------------------------------------------------------
function WishlistListCard({
  item,
  isSelected,
  onToggleSelect,
  onAddToCart,
  onBuyNow,
  onRemove
}: WishlistCardProps) {
  const currentPrice = Number(item.price) || 0;
  const originalPrice = item.originalPrice ? Number(item.originalPrice) : undefined;
  
  const discountPercent = item.discount || (
    originalPrice && originalPrice > currentPrice
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
      : undefined
  );

  return (
    <div
      className={`group bg-white rounded-xl sm:rounded-2xl border p-2.5 sm:p-3.5 transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs hover:shadow-xs ${
        isSelected 
          ? 'border-primary-main ring-2 ring-primary-main/20 bg-sky-50/20' 
          : 'border-slate-200/90 hover:border-slate-300'
      }`}
    >
      {/* Left side: Checkbox + Thumbnail + Details */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1 w-full sm:w-auto">
        {/* Checkbox */}
        <button
          onClick={onToggleSelect}
          className="p-1 text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
          title={isSelected ? 'বাছাই বাতিল করুন' : 'বাছাই করুন'}
        >
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-primary-main fill-primary-main/15" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>

        {/* Thumbnail */}
        <Link
          to={`/product/${item.id}`}
          state={{ product: item }}
          className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-50 shrink-0 border border-slate-100"
        >
          <img
            referrerPolicy="no-referrer"
            src={formatDirectImageUrl(item.image) || PLACEHOLDER_PRODUCT_IMAGE}
            alt={item.name}
            onError={(e) => handleProductImageError(e)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {discountPercent ? (
            <span className="absolute top-1 left-1 px-1 py-0.2 text-[8px] font-black bg-rose-500 text-white rounded">
              -{discountPercent}%
            </span>
          ) : null}
        </Link>

        {/* Text details */}
        <div className="min-w-0 flex-1">
          <Link to={`/product/${item.id}`} state={{ product: item }}>
            <h3 
              className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-2 hover:text-primary-main transition-colors leading-snug"
              title={item.name}
            >
              {item.name}
            </h3>
          </Link>

          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center text-amber-500">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-[11px] font-bold text-slate-700 ml-0.5">
                {item.rating || 4.8}
              </span>
            </div>
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded font-medium">
              ইন-স্টক
            </span>
          </div>

          {/* Mobile inline price */}
          <div className="flex items-baseline gap-1.5 mt-1 sm:hidden">
            <span className="text-sm font-black text-slate-950">
              ৳{currentPrice.toLocaleString()}
            </span>
            {originalPrice && originalPrice > currentPrice && (
              <span className="text-[10px] text-slate-400 line-through">
                ৳{originalPrice.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Desktop Price & Actions */}
      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        {/* Desktop Price */}
        <div className="hidden sm:block text-right shrink-0">
          <div className="text-base font-black text-slate-900">
            ৳{currentPrice.toLocaleString()}
          </div>
          {originalPrice && originalPrice > currentPrice && (
            <div className="text-xs text-slate-400 line-through">
              ৳{originalPrice.toLocaleString()}
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
            onClick={onRemove}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="উইশলিস্ট থেকে মুছুন"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
