import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { rtdbGet, rtdbSet, rtdbUpdate, rtdbRemove } from '../../../lib/rtdb';
import Header from '../../../components/layout/Header';
import Footer from '../../../components/layout/Footer';
import { Loader2, Store, Edit, Link as LinkIcon, Plus, Trash2, Check, Copy, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import ResellerOwnProductForm from './ResellerOwnProductForm';
import { StorageManager } from '../../../services/storage/StorageManager';
import ShareModal from '../../../components/common/ShareModal';

interface ResellerShop {
  resellerId: string;
  shopName: string;
  shopSlug: string;
  logo: string;
  banner: string;
  description: string;
  phone: string;
  address: string;
  shopCreatedAt?: number;
  shopStatus?: 'active' | 'disabled';
  shopProductIds?: string[];
}

interface Product {
  id: string;
  name: string;
  featuredImage?: string;
  price: number;
  status: string;
}

export default function ResellerShopManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<ResellerShop | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Setup form states
  const [shopName, setShopName] = useState('');
  const [shopSlug, setShopSlug] = useState('');
  const [logo, setLogo] = useState('');
  const [banner, setBanner] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Products
  const [activeTab, setActiveTab] = useState<'details' | 'products'>('details');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [shopProductIds, setShopProductIds] = useState<string[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSubTab, setProductSubTab] = useState<'rjworld' | 'own'>('rjworld');
  const [ownProducts, setOwnProducts] = useState<Product[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchShopData();
    }
  }, [user]);

  const fetchShopData = async () => {
    try {
      // 1. Try RTDB first (fastest, guaranteed)
      let data = await rtdbGet<ResellerShop>(`resellers/${user!.uid}`);
      if (!data) {
        // Fallback to Firestore with timeout
        const shopRef = doc(db, 'resellers', user!.uid);
        const shopSnap = await Promise.race([
          getDoc(shopRef),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
        ]);
        if (shopSnap && shopSnap.exists()) {
          data = shopSnap.data() as ResellerShop;
        }
      }

      if (data) {
        setShop(data);
        setShopName(data.shopName || '');
        setShopSlug(data.shopSlug || '');
        setLogo(data.logo || '');
        setBanner(data.banner || '');
        setDescription(data.description || '');
        setPhone(data.phone || '');
        setAddress(data.address || '');
        setShopProductIds(data.shopProductIds || []);
      }
    } catch (error) {
      console.error('Error fetching shop:', error);
      toast.error('Failed to load shop data.');
    } finally {
      setLoading(false);
    }
  };

  const checkSlugAvailability = async (slug: string) => {
    if (!slug) return false;
    try {
      const allResellers = await rtdbGet<Record<string, any>>('resellers');
      if (allResellers && typeof allResellers === 'object') {
        const lowerSlug = slug.toLowerCase().trim();
        for (const [rId, rVal] of Object.entries(allResellers)) {
          if (rId !== user!.uid && rVal && typeof rVal === 'object') {
            if ((rVal.shopSlug || '').toLowerCase().trim() === lowerSlug) {
              return false;
            }
          }
        }
      }
    } catch (_) {}
    return true;
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    setShopSlug(val);
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName || !shopSlug) {
      toast.error('Shop Name and URL slug are required.');
      return;
    }
    setLoading(true);
    try {
      const isAvailable = await checkSlugAvailability(shopSlug);
      if (!isAvailable) {
        toast.error('This Shop URL is already taken.');
        setLoading(false);
        return;
      }

      const shopData: ResellerShop = {
        resellerId: user!.uid,
        shopName,
        shopSlug,
        logo,
        banner,
        description,
        phone,
        address,
        shopCreatedAt: shop?.shopCreatedAt || Date.now(),
        shopStatus: shop?.shopStatus || 'active',
        shopProductIds
      };

      // Save to RTDB immediately
      await rtdbSet(`resellers/${user!.uid}`, { ...shopData });
      // Background Firestore sync
      setDoc(doc(db, 'resellers', user!.uid), { ...shopData }, { merge: true }).catch(() => {});

      setShop(shopData);
      setIsEditing(false);
      toast.success('Shop details saved successfully!');
    } catch (error) {
      console.error('Error saving shop:', error);
      toast.error('Failed to save shop.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOwnProducts = async () => {
    try {
      const allProds = await rtdbGet<Record<string, any>>('products');
      const prods: Product[] = [];
      if (allProds && typeof allProds === 'object') {
        Object.entries(allProds).forEach(([id, val]) => {
          if (val && typeof val === 'object' && val.resellerId === user!.uid) {
            prods.push({
              id,
              name: val.name || val.title || 'Product',
              featuredImage: val.featuredImage || val.image,
              price: Number(val.price) || 0,
              status: val.status || 'Published',
              source: 'reseller'
            } as any);
          }
        });
      }
      setOwnProducts(prods);
    } catch (error) {
      console.error('Error fetching own products:', error);
    }
  };

  const fetchAllProducts = async () => {
    setProductsLoading(true);
    try {
      const allProds = await rtdbGet<Record<string, any>>('products');
      const prods: Product[] = [];
      if (allProds && typeof allProds === 'object') {
        Object.entries(allProds).forEach(([id, val]) => {
          if (val && typeof val === 'object') {
            const st = String(val.status || '').toLowerCase();
            if (st !== 'archived' && st !== 'deleted') {
              prods.push({
                id,
                name: val.name || val.title || 'Product',
                featuredImage: val.featuredImage || val.image,
                price: Number(val.price) || 0,
                status: val.status || 'Published'
              });
            }
          }
        });
      }
      setAllProducts(prods);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    if (shop && activeTab === 'products') {
      fetchAllProducts();
      fetchOwnProducts();
    }
  }, [shop, activeTab]);

  const handleDeleteOwnProduct = async (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        StorageManager.deleteProductImages(productId).catch(err => console.warn('Storage cleanup error', err));
        await rtdbRemove(`products/${productId}`);
        deleteDoc(doc(db, 'products', productId)).catch(() => {});
        toast.success('Product deleted successfully');
        fetchOwnProducts();
      } catch (err) {
        toast.error('Failed to delete product');
      }
    }
  };

  const toggleProduct = async (productId: string) => {
    try {
      let updatedIds = [...shopProductIds];
      if (shopProductIds.includes(productId)) {
        updatedIds = updatedIds.filter(id => id !== productId);
        toast.success('Product removed from shop.');
      } else {
        updatedIds.push(productId);
        toast.success('Product added to shop.');
      }
      setShopProductIds(updatedIds);
      await rtdbUpdate(`resellers/${user!.uid}`, { shopProductIds: updatedIds });
      setDoc(doc(db, 'resellers', user!.uid), { shopProductIds: updatedIds }, { merge: true }).catch(() => {});
    } catch (error) {
      console.error('Error toggling product:', error);
      toast.error('Failed to update product.');
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/shop/${shopSlug}`;
    navigator.clipboard.writeText(url);
    toast.success('Shop link copied!');
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

  const renderSetupForm = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-2xl mx-auto mt-8">
      <div className="text-center mb-8">
        <Store className="w-12 h-12 text-primary-main mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900">Setup Your Reseller Shop</h2>
        <p className="text-slate-500 mt-2">Create your own online store to sell RJ WORLD BD products.</p>
      </div>
      <form onSubmit={handleSaveShop} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Shop Name *</label>
          <input required type="text" value={shopName} onChange={e => {
            setShopName(e.target.value);
            if (!shop) setShopSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
          }} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main outline-none" placeholder="e.g. Rahim Fashion" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Shop URL Slug *</label>
          <div className="flex items-center">
            <span className="bg-slate-50 px-4 py-2 border border-slate-200 border-r-0 rounded-l-xl text-slate-500 text-sm">/shop/</span>
            <input required type="text" value={shopSlug} onChange={handleSlugChange} className="w-full px-4 py-2 border border-slate-200 rounded-r-xl focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main outline-none" placeholder="rahim-fashion" />
          </div>
          <p className="text-xs text-slate-500 mt-1">This will be your unique shop link.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL</label>
          <input type="url" value={logo} onChange={e => setLogo(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main outline-none" placeholder="https://..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Banner URL</label>
          <input type="url" value={banner} onChange={e => setBanner(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main outline-none" placeholder="https://..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main outline-none" placeholder="Welcome to my shop..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main outline-none" />
          </div>
        </div>
        <div className="pt-4 flex gap-4">
          {shop && <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50">Cancel</button>}
          <button type="submit" disabled={loading} className="flex-1 py-3 bg-primary-main hover:bg-primary-main/90 text-white rounded-xl font-bold disabled:opacity-50 transition-colors shadow-sm">
            {loading ? 'Saving...' : 'Save Shop'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {!shop || isEditing ? renderSetupForm() : (
            <div className="space-y-6 mt-6">
              {/* Dashboard Banner & Header */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Banner */}
                <div className="h-48 md:h-64 w-full bg-slate-200 relative">
                  {shop.banner ? (
                    <img src={shop.banner} alt="Banner" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Store className="w-12 h-12 opacity-50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>

                {/* Shop Info Overlapping */}
                <div className="px-6 pb-6 relative">
                  <div className="flex flex-col md:flex-row gap-6 md:items-end -mt-12 md:-mt-16 mb-4">
                    {/* Logo */}
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white bg-white shadow-md overflow-hidden shrink-0 z-10">
                      {shop.logo ? (
                        <img src={shop.logo} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-3xl md:text-4xl">
                          {(shop.shopName || 'S').charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Title & Actions */}
                    <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 pt-2 md:pt-0">
                      <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{shop.shopName}</h1>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider rounded-md bg-green-100 text-green-700 uppercase">
                            {shop.shopStatus ? shop.shopStatus : 'ACTIVE'}
                          </span>
                          <a href={`/shop/${shop.shopSlug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary-main hover:underline flex items-center gap-1.5">
                            /shop/{shop.shopSlug} <LinkIcon className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 md:gap-3">
                        <button onClick={() => setIsShareModalOpen(true)} className="px-4 py-2.5 bg-sky-50 text-primary-main hover:bg-sky-100 rounded-xl font-bold flex items-center gap-2 transition-colors text-sm shadow-sm cursor-pointer">
                          <Share2 className="w-4 h-4" /> Share Shop
                        </button>
                        <button onClick={handleCopyLink} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-2 transition-colors text-sm shadow-sm cursor-pointer">
                          <Copy className="w-4 h-4" /> Copy Link
                        </button>
                        <button onClick={() => setIsEditing(true)} className="px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold flex items-center gap-2 transition-colors text-sm shadow-sm cursor-pointer">
                          <Edit className="w-4 h-4" /> Edit Shop
                        </button>
                        <Link to={`/shop/${shop.shopSlug}`} target="_blank" className="px-4 py-2.5 bg-primary-main hover:bg-primary-main/90 text-white rounded-xl font-bold flex items-center gap-2 transition-colors text-sm shadow-md">
                          View Shop
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Sidebar: Shop Details */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-5 pb-3 border-b border-slate-100">About Shop</h3>
                    <div className="space-y-5">
                      <div>
                        <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">Description</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{shop.description || 'No description provided.'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">Contact Phone</p>
                        <p className="text-sm text-slate-700 font-medium">{shop.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">Address</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{shop.address || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content: Products */}
                <div className="lg:col-span-3">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    {/* Tabs */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-100 pb-5">
                      <div className="flex bg-slate-100 p-1.5 rounded-xl w-full sm:w-auto">
                        <button 
                          onClick={() => setProductSubTab('rjworld')}
                          className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${productSubTab === 'rjworld' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          RJ WORLD BD Products
                        </button>
                        <button 
                          onClick={() => setProductSubTab('own')}
                          className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${productSubTab === 'own' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          My Own Products
                        </button>
                      </div>
                      
                      <div className="flex gap-3 w-full sm:w-auto">
                        <input 
                          type="text" 
                          placeholder="Search products..." 
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="flex-1 sm:w-48 md:w-64 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main bg-slate-50 focus:bg-white transition-colors placeholder:text-slate-400 font-medium"
                        />
                        {productSubTab === 'own' && (
                          <button 
                            onClick={() => setShowAddModal(true)}
                            className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 shrink-0 flex items-center gap-2 transition-colors shadow-md"
                          >
                            <Plus className="w-4 h-4" /> Add Product
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Products Grid */}
                    {productsLoading ? (
                      <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary-main" /></div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {productSubTab === 'rjworld' ? (
                          allProducts.length > 0 ? (
                            allProducts
                              .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                              .map(product => {
                              const isAdded = shopProductIds.includes(product.id);
                              return (
                                <div key={product.id} className={`group bg-white rounded-2xl overflow-hidden border transition-all duration-200 ${isAdded ? 'border-primary-main/50 shadow-[0_0_0_1px_rgba(14,165,233,0.15)] bg-blue-50/10' : 'border-slate-200 hover:border-slate-300'}`}>
                                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden border-b border-slate-100">
                                    <img src={product.featuredImage || ''} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
                                      <span className="bg-white/95 backdrop-blur-sm text-slate-800 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">
                                        RJ WORLD BD
                                      </span>
                                      {isAdded && (
                                        <span className="bg-primary-main/95 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm flex items-center gap-1">
                                          <Check className="w-3 h-3" /> Added
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="p-4 flex flex-col h-[160px]">
                                    <h4 className="font-bold text-slate-900 line-clamp-2 text-sm leading-snug mb-3 flex-1" title={product.name}>{product.name}</h4>
                                    <div className="flex items-center justify-between mb-4">
                                      <p className="text-lg font-extrabold text-slate-900">৳{product.price}</p>
                                      <span className="text-[11px] text-slate-500 font-bold tracking-wider uppercase">In Stock</span>
                                    </div>
                                    <button 
                                      onClick={() => toggleProduct(product.id)}
                                      className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${isAdded ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md hover:shadow-lg'}`}
                                    >
                                      {isAdded ? (
                                        <><Trash2 className="w-4 h-4" /> Remove</>
                                      ) : (
                                        <><Plus className="w-4 h-4" /> Add to Shop</>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                              <Store className="w-12 h-12 mb-4 opacity-30" />
                              <p className="text-sm font-medium">No RJ WORLD BD products found.</p>
                            </div>
                          )
                        ) : (
                          ownProducts.length > 0 ? (
                            ownProducts
                              .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                              .map(product => (
                                <div key={product.id} className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-slate-300 transition-all duration-200">
                                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden border-b border-slate-100">
                                    <img src={product.featuredImage || ''} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                    <div className="absolute top-2.5 left-2.5">
                                      <span className="bg-emerald-500/95 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">
                                        My Product
                                      </span>
                                    </div>
                                  </div>
                                  <div className="p-4 flex flex-col h-[160px]">
                                    <h4 className="font-bold text-slate-900 line-clamp-2 text-sm leading-snug mb-3 flex-1" title={product.name}>{product.name}</h4>
                                    <div className="flex items-center justify-between mb-4">
                                      <p className="text-lg font-extrabold text-slate-900">৳{product.price}</p>
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                        {product.status || 'Active'}
                                      </span>
                                    </div>
                                    <div className="flex gap-2">
                                      <button className="flex-1 py-2.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors">
                                        Edit
                                      </button>
                                      <button onClick={() => handleDeleteOwnProduct(product.id)} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors shrink-0">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                              <Store className="w-12 h-12 mb-4 text-slate-300" />
                              <h3 className="text-lg font-bold text-slate-800 mb-1">No products yet</h3>
                              <p className="text-sm text-slate-500 mb-6">You haven't added any of your own products.</p>
                              <button 
                                onClick={() => setShowAddModal(true)}
                                className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 flex items-center gap-2 transition-colors shadow-md hover:shadow-lg"
                              >
                                <Plus className="w-4 h-4" /> Add Your First Product
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Add Product Modal */}
              {showAddModal && (
                <ResellerOwnProductForm 
                  resellerId={user!.uid}
                  onClose={() => setShowAddModal(false)}
                  onSuccess={() => {
                    setShowAddModal(false);
                    fetchOwnProducts();
                  }}
                />
              )}
            </div>
          )}

          {shop && (
            <ShareModal
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
              title={shop.shopName}
              url={`${window.location.origin}/shop/${shop.shopSlug}`}
              description={shop.description || `Visit ${shop.shopName} on RJ WORLD BD!`}
              badge="Reseller Store"
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
