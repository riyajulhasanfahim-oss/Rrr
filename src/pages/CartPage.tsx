import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, 
  Minus, 
  Plus, 
  ShoppingBag, 
  ArrowRight, 
  ShieldCheck, 
  CheckSquare, 
  Square, 
  Heart, 
  Sparkles,
  Truck,
  RotateCcw,
  Scale,
  MapPin,
  AlertTriangle
} from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../contexts/WishlistContext';
import toast from 'react-hot-toast';
import ProductCard from '../components/ui/ProductCard';
import type { Product } from '../components/ui/ProductCard';
import { fetchAllMarketplaceProducts, subscribeToMarketplaceProducts, getCachedMarketplaceProducts } from '../services/productService';
import { rtdbGet } from '../lib/rtdb';
import { 
  calculateCartTotalWeightDetailed, 
  calculateCourierCharge, 
  resolveDeliveryZone,
  type DeliveryZone,
  type DeliveryCalculationResult
} from '../utils/deliveryCalculator';

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, cartTotal, itemCount } = useCart();
  const { addToWishlist } = useWishlist();
  const { userData } = useAuth();
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [selectedItems, setSelectedItems] = useState<string[]>(items.map(i => i.id));
  const [relatedProducts, setRelatedProducts] = useState<Product[]>(() => {
    const cached = getCachedMarketplaceProducts();
    const cartIds = new Set(items.map(i => String(i.id).trim()));
    const avail = cached.filter(p => !cartIds.has(String(p.id).trim()));
    return avail.length > 0 ? avail : cached;
  });
  const [loadingRelated, setLoadingRelated] = useState<boolean>(() => relatedProducts.length === 0);
  const [visibleRelatedCount, setVisibleRelatedCount] = useState<number>(10);
  const navigate = useNavigate();

  // Preferred Delivery Zone for accurate shipping estimation
  const [selectedZone, setSelectedZone] = useState<DeliveryZone>(() => {
    const saved = sessionStorage.getItem('preferred_shipping_zone') as DeliveryZone;
    if (saved && ['inside_dhaka', 'dhaka_suburb', 'outside_dhaka'].includes(saved)) {
      return saved;
    }
    const userDist = (userData as any)?.district || (userData as any)?.shippingAddress?.district;
    const userUpazila = (userData as any)?.upazila || (userData as any)?.shippingAddress?.upazila || '';
    if (userDist) {
      return resolveDeliveryZone(userDist, userUpazila).zone;
    }
    return 'outside_dhaka';
  });

  const handleZoneChange = (zone: DeliveryZone) => {
    setSelectedZone(zone);
    sessionStorage.setItem('preferred_shipping_zone', zone);
  };

  // Enrich cart items with product weight from RTDB if missing from cart item
  const [enrichedItems, setEnrichedItems] = useState<any[]>(items);

  useEffect(() => {
    let isMounted = true;
    const enrichWeights = async () => {
      if (!items || items.length === 0) {
        if (isMounted) setEnrichedItems([]);
        return;
      }

      const enriched = await Promise.all(items.map(async (item) => {
        let w = item.weight ?? (item.specifications?.Weight || item.specifications?.weight);
        if ((w === undefined || w === null || w === '') && item.id) {
          try {
            const pData = await rtdbGet<any>(`products/${item.id}`);
            if (pData) {
              w = pData.weight ?? (pData.specifications?.Weight || pData.specifications?.weight);
            }
          } catch (e) {
            console.warn('Error fetching weight in CartPage:', e);
          }
        }
        return {
          ...item,
          weight: w
        };
      }));

      if (isMounted) setEnrichedItems(enriched);
    };

    enrichWeights();
    return () => { isMounted = false; };
  }, [items]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  // Update selectedItems when items change (e.g. newly added item)
  useEffect(() => {
    setSelectedItems(prev => {
      const validIds = new Set(items.map(i => i.id));
      const filtered = prev.filter(id => validIds.has(id));
      // If newly added item was not in selectedItems, select it by default
      const newlyAdded = items.map(i => i.id).filter(id => !prev.includes(id));
      return [...filtered, ...newlyAdded];
    });
  }, [items]);

  // Fetch all marketplace products across vendors, prioritizing real vendor items and matching categories
  useEffect(() => {
    let isMounted = true;

    const processAndSetRelated = (allProducts: Product[]) => {
      if (!isMounted || !allProducts || allProducts.length === 0) return;

      const cartItemIds = new Set(items.map(i => String(i.id).trim()));
      let available = allProducts.filter(p => !cartItemIds.has(String(p.id).trim()));
      if (available.length === 0 && allProducts.length > 0) {
        available = allProducts;
      }

      const cartVendorIds = new Set(items.map(i => String(i.vendorId || '').trim()).filter(Boolean));
      const cartCategories = new Set(items.map(i => String(i.category || '').toLowerCase().trim()).filter(Boolean));

      const scored = available.map(prod => {
        let score = 0;
        const pVendorId = String(prod.vendorId || prod.vendor?.id || '').trim();
        const pCat = String(prod.category || '').toLowerCase().trim();

        if (pVendorId && (prod.vendor?.storeName || prod.vendor?.name)) {
          score += 60;
        }
        if (prod.featuredImage || prod.image) {
          score += 10;
        }
        if (pVendorId && cartVendorIds.has(pVendorId)) {
          score += 40;
        }
        if (pCat && cartCategories.has(pCat)) {
          score += 25;
        }

        return { prod, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const sorted = scored.map(s => s.prod);

      setRelatedProducts(sorted);
      setLoadingRelated(false);
    };

    fetchAllMarketplaceProducts()
      .then((all) => {
        processAndSetRelated(all);
      })
      .catch((err) => {
        console.error('Could not fetch related products in cart:', err);
        if (isMounted) setLoadingRelated(false);
      });

    const unsubscribe = subscribeToMarketplaceProducts((liveItems) => {
      processAndSetRelated(liveItems);
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [items]);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponCode.trim().toUpperCase() === 'WELCOME10') {
      setDiscount(cartTotal * 0.1);
      toast.success('Coupon applied successfully! (10% OFF)');
    } else {
      toast.error('Invalid or expired coupon code');
      setDiscount(0);
    }
  };

  const getItemKey = (item: any) => item.cartItemId || item.id;

  const toggleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(i => getItemKey(i)));
    }
  };

  const toggleSelectItem = (idOrKey: string) => {
    if (selectedItems.includes(idOrKey)) {
      setSelectedItems(selectedItems.filter(itemId => itemId !== idOrKey));
    } else {
      setSelectedItems([...selectedItems, idOrKey]);
    }
  };

  // Detailed selected items with enriched weights
  const selectedCartItems = useMemo(() => {
    const list = enrichedItems.length > 0 ? enrichedItems : items;
    return list.filter(item => selectedItems.includes(getItemKey(item)));
  }, [enrichedItems, items, selectedItems]);

  // Dynamic weight calculation across selected cart items
  const weightSummary = useMemo(() => {
    return calculateCartTotalWeightDetailed(selectedCartItems);
  }, [selectedCartItems]);

  const selectedTotal = useMemo(() => {
    return selectedCartItems.reduce((total, item) => total + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
  }, [selectedCartItems]);

  // Dynamic Courier Charge using Pathao Courier rate slab
  const deliveryCalc: DeliveryCalculationResult = useMemo(() => {
    let custDist = 'Chittagong';
    let custUpazila = 'Chittagong Sadar';
    if (selectedZone === 'inside_dhaka') {
      custDist = 'Dhaka';
      custUpazila = 'Dhanmondi';
    } else if (selectedZone === 'dhaka_suburb') {
      custDist = 'Dhaka';
      custUpazila = 'Savar';
    }

    return calculateCourierCharge(
      'Dhaka',
      'Dhaka Sadar / Kotwali',
      custDist,
      custUpazila,
      weightSummary.totalWeightKg,
      {
        orderSubtotal: selectedTotal,
        paymentMethod: 'cod',
        hasFallbackWeight: weightSummary.hasFallbackWeight,
        missingWeightCount: weightSummary.missingWeightCount
      }
    );
  }, [selectedZone, weightSummary, selectedTotal]);

  const shipping = selectedCartItems.length === 0 ? 0 : deliveryCalc.deliveryCharge;
  const grandTotal = Math.max(0, selectedTotal + shipping - discount);

  const estimatedDelivery = new Date();
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);

  const moveToWishlist = (item: any) => {
    addToWishlist({
      id: item.id,
      name: item.name,
      price: item.price,
      originalPrice: item.originalPrice,
      image: item.image,
      addedAt: Date.now()
    });
    removeFromCart(item.id);
    toast.success('Moved to wishlist');
  };

  const handleProceedToCheckout = () => {
    if (selectedItems.length > 0) {
      navigate('/checkout', { 
        state: { 
          preferredZone: selectedZone,
          selectedCartItemIds: selectedItems 
        } 
      });
    } else {
      toast.error('Please select at least one item');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-3 sm:pt-6 md:pt-8 pb-16 sm:pb-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between mb-4 sm:mb-6 md:mb-8 pb-3 sm:pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl bg-primary-main/10 flex items-center justify-center text-primary-main">
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h1 className="text-base sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  Shopping Cart
                </h1>
                <p className="text-[11px] sm:text-xs md:text-sm text-slate-500 hidden sm:block">
                  Manage items in your cart and proceed to secure checkout
                </p>
              </div>
            </div>

            <span className="text-xs sm:text-sm md:text-base text-slate-700 font-bold bg-white px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border border-slate-200 shadow-2xs">
              {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          {items.length === 0 ? (
            /* Empty Cart View */
            <div className="bg-white rounded-2xl md:rounded-3xl p-8 sm:p-14 text-center shadow-xs border border-slate-200/90 max-w-lg mx-auto my-6 sm:my-10">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-sky-50 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-4 text-primary-main">
                <ShoppingBag className="h-8 w-8 sm:h-10 sm:w-10" />
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-slate-900 mb-2">
                Your cart is empty
              </h2>
              <p className="text-xs sm:text-sm md:text-base text-slate-500 mb-6 max-w-sm mx-auto leading-relaxed">
                Looks like you haven't added any products to your cart yet. Browse our collection below!
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-primary-main text-xs sm:text-sm md:text-base text-white font-bold rounded-xl md:rounded-2xl hover:bg-sky-600 active:scale-95 transition-all shadow-xs"
              >
                Continue Shopping
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            /* Main Cart Layout (Desktop 12-col grid, Mobile 1-col) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-start">
              
              {/* Cart Items Column (8 cols on desktop/laptop) */}
              <div className="lg:col-span-8 space-y-3 sm:space-y-4">
                
                {/* Select All Bar */}
                <div className="bg-white rounded-xl md:rounded-2xl px-3.5 py-2.5 sm:px-5 sm:py-3.5 shadow-xs border border-slate-200/90 flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button 
                      onClick={toggleSelectAll} 
                      className="text-primary-main focus:outline-none flex items-center cursor-pointer p-0.5"
                    >
                      {selectedItems.length === items.length && items.length > 0 ? (
                        <CheckSquare className="h-4 w-4 md:h-5 md:w-5 text-primary-main" />
                      ) : (
                        <Square className="h-4 w-4 md:h-5 md:w-5 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                    <span className="text-xs sm:text-sm md:text-sm font-bold text-slate-800 tracking-tight">
                      Select All ({items.length} {items.length === 1 ? 'item' : 'items'})
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      selectedItems.forEach(id => removeFromCart(id));
                      setSelectedItems([]);
                    }}
                    className="text-xs sm:text-sm font-semibold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Clear Selected</span>
                  </button>
                </div>

                {/* Product List */}
                <AnimatePresence>
                  {items.map(item => {
                    const itemKey = item.cartItemId || item.id;
                    const displayColor = item.selectedColor || item.color;
                    const displaySize = item.selectedSize || item.size;
                    const displaySku = item.variantSku || item.sku;
                    const itemBreakdown = weightSummary.itemBreakdowns.find(b => b.id === item.id);

                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98, height: 0, marginBottom: 0, padding: 0 }}
                        transition={{ duration: 0.15 }}
                        key={itemKey}
                        className="bg-white rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-5 shadow-xs border border-slate-200/90 flex gap-3 sm:gap-4 md:gap-5 overflow-hidden hover:border-slate-300 transition-all"
                      >
                        {/* Checkbox & Product Thumbnail */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          <button 
                            onClick={() => toggleSelectItem(itemKey)} 
                            className="text-primary-main focus:outline-none cursor-pointer p-0.5"
                          >
                            {selectedItems.includes(itemKey) ? (
                              <CheckSquare className="h-4 w-4 md:h-5 md:w-5 text-primary-main" />
                            ) : (
                              <Square className="h-4 w-4 md:h-5 md:w-5 text-slate-400 hover:text-slate-600" />
                            )}
                          </button>
                          <Link 
                            to={`/product/${item.id}`} 
                            state={{ product: item }} 
                            className="shrink-0 group"
                          >
                            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-28 md:h-28 lg:w-32 lg:h-32 shrink-0 rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center">
                              <img
                                referrerPolicy="no-referrer"
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          </Link>
                        </div>

                        {/* Product Details */}
                        <div className="flex-grow min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            <div className="flex justify-between items-start gap-3">
                              <Link
                                to={`/product/${item.id}`}
                                state={{ product: item }}
                                className="text-xs sm:text-sm md:text-base lg:text-lg font-bold text-slate-900 hover:text-primary-main transition-colors line-clamp-2 leading-snug md:leading-normal"
                              >
                                {item.name}
                              </Link>
                              
                              <div className="text-right shrink-0">
                                <p className="text-xs sm:text-base md:text-xl font-extrabold text-slate-900">
                                  ৳{(item.price * item.quantity).toFixed(2)}
                                </p>
                                {item.quantity > 1 && (
                                  <p className="text-[10px] sm:text-xs text-slate-400">
                                    (৳{item.price.toFixed(2)} each)
                                  </p>
                                )}
                                {item.originalPrice && (
                                  <p className="text-[10px] sm:text-xs md:text-sm text-slate-400 line-through">
                                    ৳{(item.originalPrice * item.quantity).toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Attributes / Store Info */}
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5">
                              <span className="text-[10px] sm:text-xs text-slate-400 font-medium">
                                RJ WORLD BD
                              </span>
                              {(displayColor || displaySize || displaySku) && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {displayColor && (
                                    <span className="bg-slate-100 text-slate-700 text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-medium">
                                      Color: {displayColor}
                                    </span>
                                  )}
                                  {displaySize && (
                                    <span className="bg-slate-100 text-slate-700 text-[10px] sm:text-xs px-2 py-0.5 rounded-md font-medium">
                                      Size: {displaySize}
                                    </span>
                                  )}
                                  {displaySku && (
                                    <span className="bg-slate-100 text-slate-500 font-mono text-[10px] px-1.5 py-0.5 rounded">
                                      SKU: {displaySku}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Weight Badge (Dynamic per-item & total weight) */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <div className="inline-flex items-center gap-1 text-[11px] text-slate-700 bg-sky-50/80 border border-sky-200/70 px-2 py-0.5 rounded-md font-medium">
                                <Scale className="w-3 h-3 text-primary-main shrink-0" />
                                <span>ওজন: <strong>{itemBreakdown?.unitWeightText || '৫০০ গ্রাম'}</strong></span>
                                {item.quantity > 1 && itemBreakdown && (
                                  <span className="text-slate-500">
                                    (মোট {itemBreakdown.totalItemWeightKg < 1 ? `${Math.round(itemBreakdown.totalItemWeightKg * 1000)} গ্রাম` : `${itemBreakdown.totalItemWeightKg.toFixed(2)} কেজি`})
                                  </span>
                                )}
                              </div>
                              {itemBreakdown?.isFallback && (
                                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded" title="নির্দিষ্ট ওজন উল্লেখ না থাকায় কুরিয়ারের স্ট্যান্ডার্ড সর্বনিম্ন ৫০০ গ্রাম ধার্য হয়েছে">
                                  স্ট্যান্ডার্ড ৫০০ গ্রাম
                                </span>
                              )}
                            </div>

                            {userData?.role === 'Reseller' && item.adminPrice && (
                              <div className="mt-1.5 text-[10px] sm:text-xs font-semibold flex items-center gap-2">
                                <span className="text-slate-500">Admin: ৳{item.adminPrice}</span>
                                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                  Profit: ৳{item.resellerProfit}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Bottom Actions Row */}
                          <div className="flex items-center justify-between mt-2 pt-2 sm:mt-3 sm:pt-3 border-t border-slate-100">
                            {/* Quantity Selector */}
                            <div className="flex items-center bg-slate-50 rounded-lg sm:rounded-xl border border-slate-200 h-7 sm:h-8 md:h-9 px-1">
                              <button
                                onClick={() => updateQuantity(itemKey, Math.max(1, item.quantity - 1))}
                                className="w-6 sm:w-7 md:w-8 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 active:scale-95 transition-colors focus:outline-none cursor-pointer"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                              </button>
                              <span className="w-7 sm:w-8 md:w-10 text-center font-bold text-slate-900 text-xs sm:text-sm md:text-base">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(itemKey, item.quantity + 1)}
                                className="w-6 sm:w-7 md:w-8 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 active:scale-95 transition-colors focus:outline-none cursor-pointer"
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                              </button>
                            </div>

                            {/* Move to Wishlist / Remove */}
                            <div className="flex items-center gap-2 sm:gap-4">
                              <button
                                onClick={() => moveToWishlist(item)}
                                className="text-[11px] sm:text-xs md:text-sm font-semibold text-slate-500 hover:text-primary-main transition-colors flex items-center gap-1 md:gap-1.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-sky-50"
                                title="Move to Wishlist"
                              >
                                <Heart className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                <span className="hidden sm:inline">Move to Wishlist</span>
                              </button>
                              <button
                                onClick={() => removeFromCart(itemKey)}
                                className="text-[11px] sm:text-xs md:text-sm font-semibold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1 md:gap-1.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-red-50"
                                title="Remove item"
                              >
                                <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                <span>Remove</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Order Summary Sidebar (Desktop/Laptop: 4 cols) */}
              <div className="hidden lg:block lg:col-span-4 space-y-4">
                <div className="bg-white rounded-2xl p-5 md:p-6 shadow-xs border border-slate-200/90 sticky top-24">
                  <h3 className="text-base md:text-lg font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                    <span>Order Summary</span>
                    <span className="text-xs font-semibold text-slate-500">
                      {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'} selected
                    </span>
                  </h3>

                  {/* Delivery Location Selector */}
                  <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-primary-main" />
                        ডেলিভারি এরিয়া
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Pathao Courier</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleZoneChange('inside_dhaka')}
                        className={`py-1.5 px-1 rounded-lg border font-bold transition-all cursor-pointer ${
                          selectedZone === 'inside_dhaka'
                            ? 'bg-primary-main text-white border-primary-main shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        ঢাকা সিটি
                      </button>
                      <button
                        type="button"
                        onClick={() => handleZoneChange('dhaka_suburb')}
                        className={`py-1.5 px-1 rounded-lg border font-bold transition-all cursor-pointer ${
                          selectedZone === 'dhaka_suburb'
                            ? 'bg-primary-main text-white border-primary-main shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        উপশহর
                      </button>
                      <button
                        type="button"
                        onClick={() => handleZoneChange('outside_dhaka')}
                        className={`py-1.5 px-1 rounded-lg border font-bold transition-all cursor-pointer ${
                          selectedZone === 'outside_dhaka'
                            ? 'bg-primary-main text-white border-primary-main shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        সারাদেশ
                      </button>
                    </div>
                  </div>

                  {/* Weight Summary Box */}
                  <div className="mb-4 p-3 rounded-xl bg-sky-50/70 border border-sky-100 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span className="flex items-center gap-1.5">
                        <Scale className="w-4 h-4 text-primary-main shrink-0" />
                        মোট অর্ডারের ওজন:
                      </span>
                      <span className="text-sm font-black text-primary-main">
                        {weightSummary.totalWeightKg.toFixed(2)} কেজি
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1.5 pt-1.5 border-t border-sky-200/50 flex flex-col gap-0.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">প্রযোজ্য স্ল্যাব:</span>
                        <span className="font-semibold text-slate-800">{deliveryCalc.weightSlabLabelBn}</span>
                      </div>
                      {deliveryCalc.extraWeightKg > 0 && (
                        <div className="flex justify-between items-center text-emerald-700 font-semibold">
                          <span>অতিরিক্ত ওজন চার্জ:</span>
                          <span>+{deliveryCalc.extraWeightKg} কেজি × ৳২৫ = ৳{deliveryCalc.extraWeightCharge}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {weightSummary.hasFallbackWeight && (
                    <div className="mb-3.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>কিছু পণ্যে ওজন উল্লেখ না থাকায় কুরিয়ারের স্ট্যান্ডার্ড সর্বনিম্ন ওজন (০.৫ কেজি) ধরা হয়েছে।</span>
                    </div>
                  )}

                  <div className="space-y-3 text-xs sm:text-sm text-slate-600">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-bold text-slate-900">৳{selectedTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <div className="flex flex-col">
                        <span>Shipping Fee</span>
                        <span className="text-[10px] text-slate-400">
                          {selectedZone === 'inside_dhaka' ? 'ঢাকার ভিতরে' : selectedZone === 'dhaka_suburb' ? 'ঢাকা উপশহর' : 'ঢাকার বাইরে'} ({weightSummary.totalWeightKg.toFixed(2)} কেজি)
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 text-sm">
                        {shipping === 0 ? (
                          <span className="text-emerald-600 font-bold">FREE</span>
                        ) : (
                          `৳${shipping.toFixed(2)}`
                        )}
                      </span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-semibold">
                        <span>Coupon Discount</span>
                        <span>-৳{discount.toFixed(2)}</span>
                      </div>
                    )}

                    <hr className="border-slate-100 !my-3" />

                    <div className="flex justify-between items-baseline pt-1">
                      <span className="text-base font-extrabold text-slate-900">Grand Total</span>
                      <span className="text-xl md:text-2xl font-black text-primary-main">
                        ৳{grandTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Coupon Form */}
                  <form onSubmit={handleApplyCoupon} className="mt-5 mb-4">
                    <label htmlFor="coupon" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Have a promo code?
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="coupon"
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value)}
                        placeholder="e.g. WELCOME10"
                        className="flex-grow px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main uppercase font-medium placeholder:normal-case"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 active:scale-95 transition-all text-xs md:text-sm cursor-pointer shrink-0"
                      >
                        Apply
                      </button>
                    </div>
                  </form>

                  {/* Checkout Button */}
                  <button
                    onClick={handleProceedToCheckout}
                    className="w-full py-3.5 bg-primary-main text-white text-sm md:text-base font-extrabold rounded-xl hover:bg-sky-600 active:scale-[0.99] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  {/* Trust Badges */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2.5 text-xs text-slate-500">
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                      <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>100% Safe & Secure Checkout</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                      <Truck className="h-4 w-4 text-primary-main shrink-0" />
                      <span>Estimated delivery: {estimatedDelivery.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                      <RotateCcw className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>7-Day Easy Return Policy</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Related Products Section */}
          <section className="mt-10 sm:mt-14 md:mt-16 pt-8 sm:pt-10 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
              <div>
                <h2 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400 shrink-0" />
                  <span>Related Products</span>
                  <span className="text-xs sm:text-sm font-medium text-slate-500 hidden sm:inline">
                    (You May Also Like)
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  আসল ভেন্ডারদের সেরা পণ্যসমূহ – এখনই কার্টে যুক্ত করে একসাথে অর্ডার করুন!
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {relatedProducts.length > 0 && (
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                    {relatedProducts.length} টি পণ্য পাওয়া গেছে
                  </span>
                )}
                <Link
                  to="/"
                  className="text-xs sm:text-sm font-bold text-primary-main hover:text-sky-600 flex items-center gap-1 py-1"
                >
                  <span>Browse All Products</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {loadingRelated ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-64 flex flex-col justify-between"
                  >
                    <div className="aspect-square bg-slate-100 rounded-lg mb-3"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : relatedProducts.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-xs sm:text-sm">
                No related products found at this moment.
              </p>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                  {relatedProducts.slice(0, visibleRelatedCount).map(prod => (
                    <ProductCard key={prod.id} product={prod} showAddToCart={true} />
                  ))}
                </div>

                {visibleRelatedCount < relatedProducts.length && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setVisibleRelatedCount(prev => prev + 10)}
                      className="px-6 py-2.5 text-xs sm:text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs hover:shadow transition-all cursor-pointer"
                    >
                      আরো পণ্য দেখুন ({relatedProducts.length - visibleRelatedCount} টি বাকি)
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

        </div>
      </main>

      {/* Sticky Bottom Checkout Bar for Mobile Cart */}
      {items.length > 0 && (
        <div className="lg:hidden fixed bottom-[50px] left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 max-w-7xl mx-auto">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={toggleSelectAll}
                className="text-primary-main focus:outline-none shrink-0 cursor-pointer p-0.5"
              >
                {selectedItems.length === items.length && items.length > 0 ? (
                  <CheckSquare className="h-4 w-4 text-primary-main" />
                ) : (
                  <Square className="h-4 w-4 text-slate-400" />
                )}
              </button>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] text-slate-500 font-medium">Total:</span>
                  <span className="text-sm sm:text-base font-black text-primary-main">
                    ৳{grandTotal.toFixed(2)}
                  </span>
                </div>
                <p className="text-[9px] text-slate-400 truncate">
                  {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'} selected
                </p>
              </div>
            </div>

            <button
              onClick={handleProceedToCheckout}
              className="px-4 sm:px-5 py-2 sm:py-2.5 bg-primary-main text-xs sm:text-sm text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs shrink-0 active:scale-95 transition-transform cursor-pointer"
            >
              <span>Checkout ({selectedItems.length})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
