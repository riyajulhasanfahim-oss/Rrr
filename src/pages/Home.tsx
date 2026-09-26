import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import CoverFlashBanner from '../components/home/CoverFlashBanner';
import Categories from '../components/home/Categories';
import BrandList from '../components/home/BrandList';
import ProductSection from '../components/home/ProductSection';
import AllProductsFeed from '../components/home/AllProductsFeed';
import ProductCard, { Product } from '../components/ui/ProductCard';
import { fetchAllMarketplaceProducts, subscribeToMarketplaceProducts, getCachedMarketplaceProducts } from '../services/productService';
import { 
  ArrowRight, Flame, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion } from 'motion/react';

export default function Home() {
  const [allProducts, setAllProducts] = useState<Product[]>(() => getCachedMarketplaceProducts());
  const [loading, setLoading] = useState<boolean>(() => allProducts.length === 0);
  const [isFlashExpanded, setIsFlashExpanded] = useState<boolean>(false);

  // Flash Sale Countdown Timer
  const [timeLeft, setTimeLeft] = useState({ hours: 6, minutes: 34, seconds: 20 });

  useEffect(() => {
    document.title = "RJ WORLD BD - E-commerce & Reseller Marketplace";
    
    // Smooth scroll if navigated to #top-products
    if (window.location.hash === '#top-products') {
      const scrollTimer = setTimeout(() => {
        const el = document.getElementById('top-products');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 350);
      return () => clearTimeout(scrollTimer);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 8, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch all products across all vendors and set up real-time live sync
  useEffect(() => {
    let isMounted = true;

    // 1. Initial robust fetch from RTDB + Firestore
    fetchAllMarketplaceProducts()
      .then((items) => {
        if (isMounted) {
          if (items && items.length > 0) {
            setAllProducts(items);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Initial marketplace products fetch notice:', err);
        if (isMounted) setLoading(false);
      });

    // 2. Real-time subscription to RTDB products node for live vendor updates
    const unsubscribe = subscribeToMarketplaceProducts((liveProducts) => {
      if (isMounted && liveProducts) {
        setAllProducts(liveProducts);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Derived: Best Selling / Top Products from all vendors
  const bestSelling = useMemo(() => {
    const sorted = [...allProducts].sort((a, b) => {
      const aScore = (a.soldCount || 0) * 2 + (a.rating || 0) + (a.reviewsCount || 0);
      const bScore = (b.soldCount || 0) * 2 + (b.rating || 0) + (b.reviewsCount || 0);
      if (aScore === bScore) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      return bScore - aScore;
    });
    return sorted;
  }, [allProducts]);

  // Derived: Flash Sale Products from all vendors
  const flashSaleProducts = useMemo(() => {
    const discounted = allProducts.filter(p => 
      (p.discount || 0) > 0 || (p.originalPrice && p.originalPrice > p.price)
    );
    return discounted.length > 0 ? discounted : allProducts;
  }, [allProducts]);

  // Derived: New Arrivals from all vendors (sorted by newest created or updated)
  const newArrivals = useMemo(() => {
    const sorted = [...allProducts].sort((a, b) => {
      const aTime = a.createdAt || 0;
      const bTime = b.createdAt || 0;
      return bTime - aTime;
    });
    return sorted;
  }, [allProducts]);

  const displayedFlashSale = isFlashExpanded 
    ? flashSaleProducts 
    : flashSaleProducts.slice(0, 8);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      
      <main className="flex-grow pb-10 sm:pb-16 space-y-1.5 sm:space-y-3">
        
        {/* 1. Flash Sale Top Cover Photo Banner */}
        <CoverFlashBanner />

        {/* 2. Official Brands List */}
        <BrandList />

        {/* 3. Popular Categories */}
        <Categories />

        {/* 4. TOP PRODUCTS (টপ প্রোডাক্ট) */}
        <div id="top-products" className="scroll-mt-20">
          <ProductSection 
            title="টপ প্রোডাক্ট" 
            products={bestSelling}
            initialLimit={8}
            bgWhite={true}
            icon="sparkles"
          />
        </div>

        {/* 5. FLASH SALE (হলুদ ও আকর্ষণীয় ফ্ল্যাশ সেল) */}
        <section className="py-2.5 sm:py-5 bg-gradient-to-b from-amber-50/50 to-slate-50">
          <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
            
            {/* Attractive, Yellow-Themed, Compact Flash Sale Header */}
            <div className="relative overflow-hidden bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 rounded-2xl p-3 sm:p-4 border-2 border-yellow-300 shadow-md mb-2.5 sm:mb-4">
              {/* Subtle ambient light reflections */}
              <div className="absolute -right-8 -top-8 w-28 h-28 bg-white/35 rounded-full blur-xl pointer-events-none" />
              <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-amber-500/20 rounded-full blur-lg pointer-events-none" />
              
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                
                {/* Left: Big Bold Title + Countdown + Mega Discount Tag */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 sm:p-1.5 rounded-xl bg-slate-950 text-amber-400 shadow-xs flex items-center justify-center">
                      <Flame className="w-5 h-5 sm:w-6 sm:h-6 fill-amber-400 text-amber-400 animate-pulse" />
                    </span>
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-950 tracking-tight">
                      ফ্ল্যাশ সেল
                    </h2>
                  </div>

                  {/* Live Countdown Timer in High-Contrast Black & Yellow */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 text-amber-300 text-xs sm:text-sm font-bold shadow-xs border border-slate-900">
                    <Clock className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                    <span className="text-slate-300 text-[11px] hidden xs:inline">বাকি:</span>
                    <span className="font-mono font-black text-amber-300 tracking-wider">
                      {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                  </div>

                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-slate-950 text-amber-300 shadow-2xs">
                    ৫০% পর্যন্ত ছাড়! ({flashSaleProducts.length}টি অফার)
                  </span>
                </div>

                {/* Right: Compelling Click Button */}
                <Link
                  to="/deals"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 sm:px-5 sm:py-2 bg-slate-950 hover:bg-slate-900 text-amber-300 hover:text-amber-200 text-xs sm:text-sm font-black rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap self-start sm:self-auto cursor-pointer group"
                >
                  <span>সব ডিল দেখুন</span>
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
              {displayedFlashSale.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.25) }}
                >
                  <ProductCard product={product} badgeText="ফ্ল্যাশ ডিল" />
                </motion.div>
              ))}
            </div>

            {/* Flash Sale Expand / Show More Toggle */}
            {flashSaleProducts.length > 8 && (
              <div className="mt-3 sm:mt-5 text-center">
                <button
                  type="button"
                  onClick={() => setIsFlashExpanded(!isFlashExpanded)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-white hover:bg-amber-100/70 text-slate-900 text-xs sm:text-sm font-black rounded-full border border-amber-300 shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  {isFlashExpanded ? (
                    <>
                      <span>কম দেখুন</span>
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>আরও {flashSaleProducts.length - 8}টি ফ্ল্যাশ ডিল দেখুন</span>
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

          </div>
        </section>

        {/* 6. NEW ARRIVALS */}
        <ProductSection 
          title="🆕 নতুন আগমন (New Arrivals)" 
          subtitle="নতুন কালেকশন ও লেটেস্ট মডেল সবার আগে আপনার জন্য"
          products={newArrivals}
          initialLimit={8}
          viewAllLink="/new-arrivals"
          bgWhite={true}
          icon="clock"
          badge="নতুন"
        />

        {/* 7. ALL VENDOR PRODUCTS FEED (সকল ভেন্ডরের সকল পণ্য ও স্ক্রলিং মার্কেটপ্লেস ফিড) */}
        <AllProductsFeed products={allProducts} />

      </main>

      <Footer />
    </div>
  );
}
