import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { rtdbList, rtdbUpdate, rtdbPush } from '../../../lib/rtdb';
import VendorLayout from '../../../components/layout/VendorLayout';
import { 
  Rocket, 
  Sparkles, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Package, 
  Search,
  Zap,
  Flame,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function VendorProductBoost() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [boostDays, setBoostDays] = useState<number>(7);
  const [boosting, setBoosting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadProducts();
  }, [user]);

  const loadProducts = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await rtdbList<any>('products', (p) => 
        p.vendorId === user.uid || p.storeId === user.uid || p.userId === user.uid
      );
      const list = items.map(it => ({ id: it.id, ...it.data }));
      setProducts(list);
      if (list.length > 0 && !selectedProductId) {
        setSelectedProductId(list[0].id);
      }
    } catch (err) {
      console.error('Error loading products for boost:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBoost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProductId) {
      toast.error('Please select a product to boost');
      return;
    }

    const targetProduct = products.find(p => p.id === selectedProductId);
    if (!targetProduct) return;

    setBoosting(true);
    try {
      const expiresAt = Date.now() + (boostDays * 24 * 60 * 60 * 1000);

      // 1. Update product in RTDB
      await rtdbUpdate(`products/${selectedProductId}`, {
        boosted: true,
        boostExpiresAt: expiresAt,
        boostDays: boostDays,
        boostUpdatedAt: Date.now()
      });

      // 2. Record boost log
      await rtdbPush('product_boosts', {
        vendorId: user.uid,
        productId: selectedProductId,
        productName: targetProduct.name,
        boostDays,
        expiresAt,
        createdAt: Date.now()
      });

      toast.success(`"${targetProduct.name}" has been boosted for ${boostDays} days!`);
      loadProducts();
    } catch (err) {
      console.error('Failed to boost product:', err);
      toast.error('Failed to boost product');
    } finally {
      setBoosting(false);
    }
  };

  const boostedProducts = products.filter(p => p.boosted && (!p.boostExpiresAt || p.boostExpiresAt > Date.now()));
  const unboostedProducts = products.filter(p => !p.boosted || (p.boostExpiresAt && p.boostExpiresAt <= Date.now()));

  const filteredUnboosted = unboostedProducts.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <VendorLayout>
      <div className="max-w-5xl mx-auto pb-12">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-pink-600" />
            Product Boost Promotion
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Boost your products to appear on top of marketplace search results and featured shelves
          </p>
        </div>

        {/* Benefits Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200/80 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-pink-500 text-white flex items-center justify-center mb-2 shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">3X More Impressions</h3>
            <p className="text-xs text-gray-600 leading-relaxed">Boosted products are given prime priority on the marketplace search.</p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-2 shadow-xs">
              <Flame className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">Featured Store Badge</h3>
            <p className="text-xs text-gray-600 leading-relaxed">Displays a high-converting 'Featured' badge directly on product card.</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4">
            <div className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center mb-2 shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">Faster Sales Conversion</h3>
            <p className="text-xs text-gray-600 leading-relaxed">Reach active shoppers who are ready to order products right now.</p>
          </div>
        </div>

        {/* Active Boosted Products Section */}
        {boostedProducts.length > 0 && (
          <div className="bg-white rounded-2xl border border-pink-100 p-4 sm:p-6 shadow-2xs mb-8">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-pink-600" />
              Currently Boosted Products ({boostedProducts.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {boostedProducts.map(prod => (
                <div key={prod.id} className="p-3 bg-pink-50/50 rounded-xl border border-pink-200 flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-lg border border-pink-200 flex items-center justify-center overflow-hidden shrink-0">
                    {prod.image || prod.imageUrl || prod.images?.[0] ? (
                      <img src={prod.image || prod.imageUrl || prod.images?.[0]} alt={prod.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-gray-900 text-xs truncate">{prod.name}</h4>
                    <span className="text-[11px] text-pink-700 font-bold block">৳{prod.price || prod.salePrice}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                      <Clock className="w-3 h-3 text-pink-500" />
                      Expires: {prod.boostExpiresAt ? new Date(prod.boostExpiresAt).toLocaleDateString() : 'Active'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Boost Form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-2xs">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
            <Rocket className="w-5 h-5 text-pink-600" />
            Launch a New Product Boost
          </h2>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-10">
              <Package className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-600 font-medium">No products in your store yet.</p>
              <p className="text-xs text-gray-400">Add products to your store first to boost them.</p>
            </div>
          ) : (
            <form onSubmit={handleBoost} className="space-y-6">
              {/* Select Product */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  1. Choose Product to Boost
                </label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search product..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                  {filteredUnboosted.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">No matching products found</div>
                  ) : (
                    filteredUnboosted.map(prod => (
                      <label 
                        key={prod.id} 
                        className={`flex items-center gap-3 p-2.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                          selectedProductId === prod.id ? 'bg-pink-50/60' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="boostProduct"
                          value={prod.id}
                          checked={selectedProductId === prod.id}
                          onChange={() => setSelectedProductId(prod.id)}
                          className="w-4 h-4 text-pink-600"
                        />
                        <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                          {prod.image || prod.imageUrl || prod.images?.[0] ? (
                            <img src={prod.image || prod.imageUrl || prod.images?.[0]} alt={prod.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-900 truncate">{prod.name}</p>
                          <span className="text-[11px] text-gray-500">৳{prod.price || prod.salePrice} • Stock: {prod.stock ?? 10}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Select Duration */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  2. Choose Boost Duration
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { days: 3, label: '3 Days', badge: 'Starter' },
                    { days: 7, label: '7 Days', badge: 'Most Popular' },
                    { days: 30, label: '30 Days', badge: 'Best Value' },
                  ].map(plan => (
                    <button
                      key={plan.days}
                      type="button"
                      onClick={() => setBoostDays(plan.days)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        boostDays === plan.days
                          ? 'border-pink-500 bg-pink-50/70 text-pink-900 font-bold shadow-2xs'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <span className="text-sm font-bold block">{plan.label}</span>
                      <span className="text-[10px] text-pink-600 font-medium">{plan.badge}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={boosting || !selectedProductId}
                  className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-xs transition-colors disabled:opacity-50 text-xs sm:text-sm"
                >
                  <Rocket className="w-4 h-4" />
                  {boosting ? 'Activating Boost...' : `Activate Boost (${boostDays} Days)`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </VendorLayout>
  );
}
