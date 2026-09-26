import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Store, ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import VerifiedBadge from '../ui/VerifiedBadge';
import { 
  getOfficialStoresFromCache, 
  fetchOfficialStoresFromRTDB, 
  saveStoreToCache, 
  getStoreProductsFromCache,
  getStoreThemeFromCache,
  getStoreFollowStatusFromCache,
  isStorePlanVerified,
  sortStoresByVerifiedFirst,
  isStoreDeletedFromCache,
  CachedStore 
} from '../../services/storeCache';

export default function BrandList() {
  // Synchronously initialize with cached official stores with verified stores first
  const [brands, setBrands] = useState<CachedStore[]>(() => 
    sortStoresByVerifiedFirst(
      getOfficialStoresFromCache().filter(b => 
        b &&
        !isStoreDeletedFromCache(b.id) &&
        !isStoreDeletedFromCache(b.vendorId || '') &&
        !isStoreDeletedFromCache(b.storeId || '') &&
        !isStoreDeletedFromCache(b.userId || '')
      )
    )
  );
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const loadOfficialStores = async () => {
      try {
        const freshStores = await fetchOfficialStoresFromRTDB();
        if (isMounted && freshStores && freshStores.length > 0) {
          setBrands(
            sortStoresByVerifiedFirst(
              freshStores.filter(b => 
                b &&
                !isStoreDeletedFromCache(b.id) &&
                !isStoreDeletedFromCache(b.vendorId || '') &&
                !isStoreDeletedFromCache(b.storeId || '') &&
                !isStoreDeletedFromCache(b.userId || '')
              )
            )
          );
        }
      } catch (err) {
        console.warn('Error syncing official stores from RTDB:', err);
      }
    };

    loadOfficialStores();

    const handleStoreDeleted = (e: any) => {
      const deletedId = e.detail?.storeId;
      if (deletedId) {
        setBrands(prev => prev.filter(b => 
          b.id !== deletedId && 
          b.vendorId !== deletedId && 
          b.storeId !== deletedId &&
          b.userId !== deletedId
        ));
      }
    };

    window.addEventListener('rj_store_deleted', handleStoreDeleted);
    window.addEventListener('storage', loadOfficialStores);

    return () => { 
      isMounted = false;
      window.removeEventListener('rj_store_deleted', handleStoreDeleted);
      window.removeEventListener('storage', loadOfficialStores);
    };
  }, []);

  // Guarantee that verified stores are placed at the very front
  const sortedBrands = useMemo(() => {
    return sortStoresByVerifiedFirst(
      brands.filter(b => 
        b &&
        !isStoreDeletedFromCache(b.id) &&
        !isStoreDeletedFromCache(b.vendorId || '') &&
        !isStoreDeletedFromCache(b.storeId || '') &&
        !isStoreDeletedFromCache(b.userId || '')
      )
    );
  }, [brands]);

  const handleStoreClick = (brand: CachedStore) => {
    // Cache store & products and pass via navigation state for instant zero-blank rendering in Store Page
    saveStoreToCache(brand.id, brand);
    const initialProds = getStoreProductsFromCache(brand.id);
    const initialTheme = getStoreThemeFromCache(brand.id) || brand.theme;
    const initialFollowing = getStoreFollowStatusFromCache(brand.id);
    navigate(`/store/${brand.id}`, { 
      state: { 
        initialStore: brand,
        initialProducts: initialProds,
        initialTheme: initialTheme,
        initialFollowing: initialFollowing
      } 
    });
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -350 : 350;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (brands.length === 0) return null;

  return (
    <div className="py-2 sm:py-3.5 border-b border-slate-100 bg-white">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex items-center justify-between mb-1.5 sm:mb-2.5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-2xs">
              <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-base font-black text-slate-900 tracking-tight">
                অফিসিয়াল স্টোর
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Desktop Carousel Navigation Arrows */}
            <div className="hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={() => scroll('left')}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                title="আগের স্টোর"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                title="পরের স্টোর"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button 
              onClick={() => navigate('/brands')}
              className="inline-flex items-center gap-0.5 text-[10px] sm:text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100/80 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full transition-all cursor-pointer"
            >
              <span>সব দেখুন</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Official Stores Horizontal Scroll with App-Icon Style Rounded-Square Logos */}
        <div 
          ref={scrollContainerRef}
          className="flex overflow-x-auto gap-2 sm:gap-3.5 md:gap-4 pb-1 sm:pb-2 hide-scrollbar snap-x scroll-smooth"
        >
          {sortedBrands.map((brand) => {
            const shopName = brand.shopName || brand.storeName || brand.vendorData?.shopName || brand.name || 'Official Store';
            const logo = brand.logo || brand.shopLogo || brand.vendorData?.shopLogo || brand.profileImage || brand.photo || null;
            const isVerified = isStorePlanVerified(brand);

            return (
              <div 
                key={brand.id}
                onClick={() => handleStoreClick(brand)}
                className={`snap-start shrink-0 w-[78px] xs:w-[86px] sm:w-[110px] md:w-[130px] lg:w-[140px] rounded-2xl p-2 sm:p-2.5 transition-all duration-300 flex flex-col items-center text-center cursor-pointer group relative hover:-translate-y-1 select-none ${
                  isVerified 
                    ? 'bg-gradient-to-b from-sky-50/40 via-white to-white border border-sky-300 ring-1 ring-sky-200/60 shadow-xs hover:border-sky-500 hover:shadow-md' 
                    : 'bg-white border border-slate-200 hover:border-sky-500 shadow-2xs hover:shadow-md'
                }`}
              >
                {/* Verified Seller Badge */}
                {isVerified && (
                  <VerifiedBadge 
                    className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-20"
                    title="অনুমোদিত ভেরিফাইড স্টোর"
                  />
                )}

                {/* App-Icon Style Rounded-Square Logo Container */}
                <div className="w-11 h-11 xs:w-12 xs:h-12 sm:w-15 sm:h-15 md:w-16 md:h-16 aspect-square bg-slate-50/90 rounded-xl sm:rounded-2xl border border-slate-200/90 p-1 sm:p-1.5 flex items-center justify-center overflow-hidden shrink-0 shadow-xs group-hover:shadow-sm group-hover:scale-105 transition-all duration-300">
                  {logo ? (
                    <img 
                      src={logo} 
                      alt={shopName} 
                      className="w-full h-full object-contain rounded-lg sm:rounded-xl" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <div className="w-full h-full rounded-lg sm:rounded-xl bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100 flex items-center justify-center text-sky-700 font-black text-xs sm:text-base shadow-inner">
                      <span>{shopName.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>

                {/* Store Name */}
                <h3 className="font-bold text-slate-800 text-[10px] xs:text-[11px] sm:text-xs md:text-sm mt-1.5 mb-1 line-clamp-1 w-full group-hover:text-sky-600 transition-colors">
                  {shopName}
                </h3>

                {/* Micro Action Pill */}
                <span className="w-full py-0.5 sm:py-1 text-[8px] xs:text-[9px] sm:text-[10px] md:text-xs font-bold text-sky-600 bg-sky-50 rounded-lg group-hover:bg-sky-600 group-hover:text-white transition-colors">
                  ভিজিট
                </span>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="mt-2.5 sm:mt-4 flex justify-center w-full px-1">
          <button 
            type="button"
            onClick={() => navigate('/brands')} 
            className="w-full max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl flex items-center justify-center gap-2 sm:gap-3 px-5 sm:px-8 md:px-12 py-2.5 sm:py-3.5 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm md:text-base rounded-full shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer group"
          >
            <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-200" />
            <span className="tracking-wide">সকল রেজিস্টার্ড স্টোর দেখুন</span>
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 transform group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

      </div>
    </div>
  );
}
