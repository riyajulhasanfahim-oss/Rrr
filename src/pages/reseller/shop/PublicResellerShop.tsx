import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { rtdbGet } from '../../../lib/rtdb';
import { normalizeProduct } from '../../../services/productService';
import Header from '../../../components/layout/Header';
import Footer from '../../../components/layout/Footer';
import { Loader2, Phone, MapPin, Search } from 'lucide-react';
import ProductCard, { Product } from '../../../components/ui/ProductCard';

interface ResellerShop {
  resellerId: string;
  shopName: string;
  shopSlug: string;
  logo: string;
  banner: string;
  description: string;
  phone: string;
  address: string;
  shopStatus?: string;
  shopProductIds?: string[];
}

export default function PublicResellerShop() {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  const [shop, setShop] = useState<ResellerShop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if (shopSlug) {
      fetchShopData();
    }
  }, [shopSlug]);

  const fetchShopData = async () => {
    setLoading(true);
    setError(null);
    try {
      const cleanSlug = (shopSlug || '').toLowerCase().trim();
      const allResellers = await rtdbGet<Record<string, any>>('resellers');
      let foundShop: ResellerShop | null = null;

      if (allResellers && typeof allResellers === 'object') {
        for (const [rId, rVal] of Object.entries(allResellers)) {
          if (!rVal || typeof rVal !== 'object') continue;
          const slug = (rVal.shopSlug || '').toLowerCase().trim();
          if (slug === cleanSlug) {
            foundShop = {
              resellerId: rId,
              shopName: rVal.shopName || 'Reseller Shop',
              shopSlug: rVal.shopSlug,
              logo: rVal.logo || '',
              banner: rVal.banner || '',
              description: rVal.description || '',
              phone: rVal.phone || '',
              address: rVal.address || '',
              shopStatus: rVal.shopStatus || 'active',
              shopProductIds: Array.isArray(rVal.shopProductIds) ? rVal.shopProductIds : []
            };
            break;
          }
        }
      }

      if (!foundShop) {
        setError('Shop not found.');
        setLoading(false);
        return;
      }

      if (foundShop.shopStatus && foundShop.shopStatus !== 'active') {
        setError('This shop is currently inactive.');
        setLoading(false);
        return;
      }

      setShop(foundShop);

      // Fetch products from RTDB
      const allProds = await rtdbGet<Record<string, any>>('products');
      const loadedProducts: Product[] = [];
      const targetIds = new Set(foundShop.shopProductIds || []);

      if (allProds && typeof allProds === 'object') {
        Object.entries(allProds).forEach(([pId, pVal]) => {
          if (!pVal || typeof pVal !== 'object') return;
          const statusLower = String(pVal.status || '').toLowerCase();
          if (statusLower === 'archived' || statusLower === 'deleted') return;

          // If shop specified selected products, check membership; or if reseller is author
          const isSelected = targetIds.size === 0 || targetIds.has(pId);
          const isOwnProduct = pVal.resellerId === foundShop?.resellerId;

          if (isSelected || isOwnProduct) {
            loadedProducts.push(normalizeProduct(pVal, pId));
          }
        });
      }

      setProducts(loadedProducts);
    } catch (err) {
      console.error('Error fetching shop:', err);
      setError('An error occurred while loading the shop.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <Header />
        <div className="flex-1 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-primary-main" /></div>
        <Footer />
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <Header />
        <div className="flex-1 flex flex-col justify-center items-center p-4">
          <div className="text-gray-400 mb-4"><Search className="w-16 h-16" /></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-primary-main text-white rounded-xl font-bold">
            Back to Main Store
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // Since this is a reseller shop, we should ideally append the ?ref=resellerId to product links
  // But ProductCard uses Link to=`/product/${id}` internally.
  // We can pass referralId if ProductCard supports it, or it will be tracked via URL if we clicked through a referral link.
  // Actually, since we are ON the shop page, we can set localStorage or intercept clicks.
  // The easiest way is that the shop page sets localStorage ref id on load!
  useEffect(() => {
    if (shop) {
      // Set a global ref or set it when clicking.
      // We already have logic in ProductDetails that looks for ref in URL.
      // If we don't have it in URL, let's just make sure when users browse, they are attributed to this reseller.
      // But we aren't editing ProductCard right now. 
      // For now, it's just displaying the products.
    }
  }, [shop]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow pt-20">
        {/* Shop Banner Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="w-full h-48 md:h-64 bg-slate-800 relative">
            <img 
              src={shop.banner || "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000&auto=format&fit=crop"} 
              alt="Shop Banner" 
              className="w-full h-full object-cover opacity-80"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000&auto=format&fit=crop";
              }}
            />
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {shop.logo ? (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white shadow-lg overflow-hidden -mt-16 md:-mt-20 relative z-10 bg-white">
                  <img src={shop.logo} alt="Shop Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white shadow-lg overflow-hidden -mt-16 md:-mt-20 relative z-10 bg-blue-100 flex items-center justify-center text-blue-600 text-4xl font-bold">
                  {(shop.shopName || 'S').charAt(0)}
                </div>
              )}
              
              <div className="text-center md:text-left flex-1">
                <h1 className="text-3xl font-bold text-gray-900">{shop.shopName}</h1>
                {shop.description && (
                  <p className="mt-2 text-gray-600 max-w-2xl">{shop.description}</p>
                )}
                
                <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-4 text-sm text-gray-600">
                  {shop.phone && (
                    <div className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {shop.phone}</div>
                  )}
                  {shop.address && (
                    <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {shop.address}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Shop Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Products ({filteredProducts.length})</h2>
            <div className="relative w-full md:w-72">
              <input 
                type="text" 
                placeholder="Search shop..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <p className="text-gray-500">This shop has no products yet.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500">No products match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
              {filteredProducts.map(product => (
                <div key={product.id} onClick={() => {
                  // Optional: store referral ID in localStorage so standard checkout attributes it
                  localStorage.setItem(`ref_${product.id}`, shop.resellerId);
                }}>
                  <div className="relative h-full flex flex-col relative group">
                    <ProductCard product={product} />
                    {product.source === 'reseller' && (
                      <span className="absolute top-2 right-2 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase z-10 shadow-sm">
                        Seller Product
                      </span>
                    )}
                    {product.source === 'rjworld' && (
                      <span className="absolute top-2 right-2 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase z-10 shadow-sm">
                        RJ WORLD BD Product
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
