import React, { useState, useEffect, useMemo } from 'react';
import { Store, ArrowLeft, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import VerifiedBadge from '../components/ui/VerifiedBadge';
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
} from '../services/storeCache';

export default function AllBrands() {
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
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const fetchBrands = async () => {
      try {
        const data = await fetchOfficialStoresFromRTDB();
        if (isMounted && data && data.length > 0) {
          setBrands(
            sortStoresByVerifiedFirst(
              data.filter(b => 
                b &&
                !isStoreDeletedFromCache(b.id) &&
                !isStoreDeletedFromCache(b.vendorId || '') &&
                !isStoreDeletedFromCache(b.storeId || '') &&
                !isStoreDeletedFromCache(b.userId || '')
              )
            )
          );
        }
      } catch (e) {
        console.warn("Failed to fetch brands from RTDB", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchBrands();

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
    window.addEventListener('storage', fetchBrands);

    return () => { 
      isMounted = false;
      window.removeEventListener('rj_store_deleted', handleStoreDeleted);
      window.removeEventListener('storage', fetchBrands);
    };
  }, []);

  const handleBrandClick = (brand: CachedStore) => {
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

  // Ensure verified stores are always ranked first before all normal stores
  const filteredBrands = useMemo(() => {
    const list = brands
      .filter(b => 
        b &&
        !isStoreDeletedFromCache(b.id) &&
        !isStoreDeletedFromCache(b.vendorId || '') &&
        !isStoreDeletedFromCache(b.storeId || '') &&
        !isStoreDeletedFromCache(b.userId || '')
      )
      .filter(brand => {
        const shopName = brand.shopName || brand.storeName || brand.vendorData?.shopName || brand.name || 'Vendor Shop';
        const originalName = brand.name || '';
        return shopName.toLowerCase().includes(searchTerm.toLowerCase()) || originalName.toLowerCase().includes(searchTerm.toLowerCase());
      });
    return sortStoresByVerifiedFirst(list);
  }, [brands, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      
      <main className="flex-grow pt-2 sm:pt-6 pb-6 sm:pb-10">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
          
          {/* Top Bar / Header */}
          <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-4">
             <div className="flex items-center gap-2">
               <button 
                 onClick={() => navigate(-1)} 
                 className="p-1.5 sm:p-2 text-slate-600 hover:bg-slate-200 active:bg-slate-300 rounded-full transition-colors flex items-center justify-center"
                 title="Go Back"
               >
                 <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
               </button>
               <h1 className="text-sm sm:text-lg md:text-xl font-bold text-slate-900 flex items-center gap-1.5">
                 <Store className="w-4 h-4 sm:w-5 sm:h-5 text-primary-main shrink-0" />
                 <span>Vendor List</span>
                 <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 bg-primary-main/10 text-primary-main rounded-full">
                   {filteredBrands.length}
                 </span>
               </h1>
             </div>
          </div>
          
          {/* Compact Search Bar */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-2 sm:p-3 border border-slate-200 shadow-2xs mb-2.5 sm:mb-4">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search vendor store..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1.5 focus:ring-primary-main/20 focus:border-primary-main text-xs sm:text-sm text-slate-800 placeholder:text-slate-400"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-main"></div>
            </div>
          ) : filteredBrands.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl sm:rounded-2xl border border-slate-100 p-4">
              <Store className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-slate-500 font-medium text-xs sm:text-sm">No vendors found matching "{searchTerm}"</p>
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="mt-2 text-xs text-primary-main hover:underline font-semibold"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
              {filteredBrands.map((brand) => {
                const shopName = brand.shopName || brand.storeName || brand.vendorData?.shopName || brand.name || 'Vendor Shop';
                const logo = brand.logo || brand.shopLogo || brand.vendorData?.shopLogo || brand.profileImage || brand.photo || null;
                const isVerified = isStorePlanVerified(brand);
                
                return (
                  <div 
                    key={brand.id}
                    onClick={() => handleBrandClick(brand)}
                    className={`rounded-2xl p-2 sm:p-2.5 active:scale-98 transition-all duration-200 flex flex-col items-center text-center cursor-pointer group h-full relative select-none ${
                      isVerified 
                        ? 'bg-gradient-to-b from-sky-50/40 via-white to-white border border-sky-300 ring-1 ring-sky-200/60 shadow-xs hover:border-sky-500 hover:shadow-md' 
                        : 'bg-white border border-slate-200/90 hover:border-sky-500 shadow-2xs hover:shadow-md'
                    }`}
                  >
                     {isVerified && (
                       <VerifiedBadge 
                         className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-20" 
                         title="অনুমোদিত ভেরিফাইড স্টোর"
                       />
                     )}
                     <div className="w-12 h-12 sm:w-15 sm:h-15 aspect-square bg-slate-50/90 rounded-xl sm:rounded-2xl border border-slate-200/90 p-1 sm:p-1.5 flex items-center justify-center overflow-hidden shrink-0 shadow-xs group-hover:shadow-sm group-hover:scale-105 transition-all duration-300 mb-1.5">
                       {logo ? (
                         <img src={logo} alt={shopName} className="w-full h-full object-contain rounded-lg sm:rounded-xl" referrerPolicy="no-referrer" />
                       ) : (
                         <div className="w-full h-full rounded-lg sm:rounded-xl bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100 flex items-center justify-center text-sky-700 font-black text-xs sm:text-base shadow-inner">
                           <span>{shopName.charAt(0).toUpperCase()}</span>
                         </div>
                       )}
                     </div>
                     <h3 className="font-bold text-slate-800 text-[10px] sm:text-xs mb-1.5 line-clamp-2 min-h-[26px] sm:min-h-[30px] flex items-center justify-center w-full leading-tight group-hover:text-sky-600 transition-colors">
                       {shopName}
                     </h3>
                     <button className="w-full py-1 sm:py-1.5 text-[9px] sm:text-[11px] font-bold text-sky-600 bg-sky-50 rounded-lg group-hover:bg-sky-600 group-hover:text-white transition-colors mt-auto tracking-tight border border-transparent">
                       View Shop
                     </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
