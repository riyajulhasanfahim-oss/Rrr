import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { rtdbList, rtdbPush, rtdbUpdate } from '../../../lib/rtdb';
import VendorLayout from '../../../components/layout/VendorLayout';
import { 
  Megaphone, 
  Plus, 
  BarChart3, 
  Eye, 
  MousePointerClick, 
  Clock, 
  CheckCircle2, 
  Package, 
  Image as ImageIcon,
  DollarSign,
  Play,
  Pause
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function VendorProductAds() {
  const { user } = useAuth();
  const [ads, setAds] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Ad State
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignType, setCampaignType] = useState('Banner Ad');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [budget, setBudget] = useState('500');

  useEffect(() => {
    loadAdsAndProducts();
  }, [user]);

  const loadAdsAndProducts = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [adsSnap, prodsSnap] = await Promise.all([
        rtdbList<any>('vendor_ads', (ad) => ad.vendorId === user.uid),
        rtdbList<any>('products', (p) => p.vendorId === user.uid || p.storeId === user.uid)
      ]);

      setAds(adsSnap.map(a => ({ id: a.id, ...a.data })));
      const prodList = prodsSnap.map(p => ({ id: p.id, ...p.data }));
      setProducts(prodList);
      if (prodList.length > 0 && !selectedProductId) {
        setSelectedProductId(prodList[0].id);
      }
    } catch (err) {
      console.error('Failed to load vendor ads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!campaignTitle.trim()) {
      toast.error('Please enter campaign title');
      return;
    }

    setSubmitting(true);
    try {
      const targetProd = products.find(p => p.id === selectedProductId);
      const newAd = {
        vendorId: user.uid,
        title: campaignTitle,
        type: campaignType,
        productId: selectedProductId || '',
        productName: targetProd?.name || '',
        bannerUrl: bannerUrl || targetProd?.image || targetProd?.imageUrl || '',
        durationDays: Number(durationDays),
        budget: Number(budget),
        impressions: Math.floor(Math.random() * 20) + 5,
        clicks: 0,
        status: 'active',
        createdAt: Date.now(),
        expiresAt: Date.now() + (Number(durationDays) * 24 * 60 * 60 * 1000)
      };

      await rtdbPush('vendor_ads', newAd);
      toast.success('Ad campaign launched successfully!');
      setShowCreateModal(false);
      setCampaignTitle('');
      setBannerUrl('');
      loadAdsAndProducts();
    } catch (err) {
      console.error('Failed to create ad:', err);
      toast.error('Failed to launch ad campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAdStatus = async (ad: any) => {
    const nextStatus = ad.status === 'active' ? 'paused' : 'active';
    try {
      await rtdbUpdate(`vendor_ads/${ad.id}`, { status: nextStatus });
      setAds(prev => prev.map(item => item.id === ad.id ? { ...item, status: nextStatus } : item));
      toast.success(`Campaign ${nextStatus === 'active' ? 'resumed' : 'paused'}`);
    } catch (err) {
      console.error('Error updating ad status:', err);
      toast.error('Failed to update status');
    }
  };

  return (
    <VendorLayout>
      <div className="max-w-5xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-purple-600" />
              Product Ads & Campaigns
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Create targeted advertisements to reach tens of thousands of buyers on RJ World BD
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Create New Ad
          </button>
        </div>

        {/* Analytics Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500">Active Campaigns</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Megaphone className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-gray-900">
              {ads.filter(a => a.status === 'active').length}
            </h3>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500">Total Impressions</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-gray-900">
              {ads.reduce((acc, a) => acc + (a.impressions || 0), 0).toLocaleString()}
            </h3>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500">Total Clicks</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <MousePointerClick className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-gray-900">
              {ads.reduce((acc, a) => acc + (a.clicks || 0), 0).toLocaleString()}
            </h3>
          </div>
        </div>

        {/* Campaigns List */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-2xs">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-4">
            Campaigns Management
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ads.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-800">No ad campaigns yet</p>
              <p className="text-xs text-gray-500 mb-4">Launch your first promotional ad to boost your product sales.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Start Campaign
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {ads.map(ad => (
                <div key={ad.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {ad.bannerUrl ? (
                        <img src={ad.bannerUrl} alt={ad.title} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{ad.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                          {ad.type}
                        </span>
                        <span>•</span>
                        <span>Budget: ৳{ad.budget}</span>
                        <span>•</span>
                        <span>{ad.durationDays} Days</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div className="text-right">
                      <span className="text-xs font-bold text-gray-900 block">{ad.impressions || 0} Views</span>
                      <span className="text-[11px] text-gray-500">{ad.clicks || 0} Clicks</span>
                    </div>

                    <button
                      onClick={() => toggleAdStatus(ad)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        ad.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {ad.status === 'active' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      {ad.status === 'active' ? 'Active' : 'Paused'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Ad Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-purple-600" />
                Launch New Product Ad
              </h3>

              <form onSubmit={handleCreateAd} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Campaign Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Eid Mega Sale Featured Banner"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    className="w-full text-xs sm:text-sm p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-600"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Ad Type</label>
                    <select
                      value={campaignType}
                      onChange={(e) => setCampaignType(e.target.value)}
                      className="w-full text-xs sm:text-sm p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-600"
                    >
                      <option value="Banner Ad">Banner Ad</option>
                      <option value="Featured Slider">Featured Slider</option>
                      <option value="Search Spotlight">Search Spotlight</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Duration</label>
                    <select
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-full text-xs sm:text-sm p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-600"
                    >
                      <option value={3}>3 Days</option>
                      <option value={7}>7 Days</option>
                      <option value={15}>15 Days</option>
                      <option value={30}>30 Days</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Product</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full text-xs sm:text-sm p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-600"
                  >
                    <option value="">-- Select Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Banner Image URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    className="w-full text-xs sm:text-sm p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-600"
                  />
                  <span className="text-[10px] text-gray-400">Leaves blank to use target product image automatically</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Budget (৳)</label>
                  <input
                    type="number"
                    min="100"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full text-xs sm:text-sm p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-600"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Launching...' : 'Launch Campaign'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </VendorLayout>
  );
}
