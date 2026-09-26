import React, { useEffect, useState } from 'react';
import { rtdbList, rtdbUpdate, rtdbPush } from '../../lib/rtdb';
import { useAuth } from '../../context/AuthContext';
import { Search, Edit, History, Save, X, Filter, DollarSign, Package, CheckSquare, Square, Layers, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const formatHistoryDate = (val: any) => {
  if (!val) return 'Just now';
  try {
    const d = typeof val === 'number' ? new Date(val) : typeof val === 'string' ? new Date(val) : val.toDate ? val.toDate() : val.seconds ? new Date(val.seconds * 1000) : new Date(val);
    return isNaN(d.getTime()) ? 'Just now' : format(d, 'PPpp');
  } catch {
    return 'Just now';
  }
};

export default function AdminPricing() {
  const { userData } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterVendor, setFilterVendor] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  
  // Bulk Selection
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editResellerPrice, setEditResellerPrice] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  // Bulk Edit Modal
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkPrice, setBulkPrice] = useState<string>('');
  const [bulkResellerPrice, setBulkResellerPrice] = useState<string>('');
  
  // History Modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsData, categoriesData, vendorsData] = await Promise.all([
        rtdbList<any>('products').catch(() => []),
        rtdbList<any>('categories').catch(() => []),
        rtdbList<any>('vendors').catch(() => [])
      ]);

      const parsedProducts = productsData.map(p => ({ id: p.id, ...(p.data || {}) })).sort((a, b) => {
        const timeA = typeof a.createdAt === 'number' ? a.createdAt : a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = typeof b.createdAt === 'number' ? b.createdAt : b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      setProducts(parsedProducts);
      setCategories(categoriesData.map(c => ({ id: c.id, ...(c.data || {}) })));
      setVendors(vendorsData.map(v => ({ id: v.id, ...(v.data || {}) })));
    } catch (error) {
      console.error("Error fetching data from RTDB:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Unknown';
  const getVendorName = (id: string) => vendors.find(v => v.id === id)?.storeName || 'Unknown';

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = filterCategory === 'All' || p.categoryId === filterCategory;
    const matchesVendor = filterVendor === 'All' || p.vendorId === filterVendor;
    
    return matchesSearch && matchesCategory && matchesVendor;
  }).sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    if (sortConfig.key === 'price' || sortConfig.key === 'resellerPrice') {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedProducts(newSelection);
  };

  const selectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const startEdit = (product: any) => {
    setEditingId(product.id);
    setEditPrice(product.price || 0);
    setEditResellerPrice(product.resellerPrice || 0);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const savePrice = async (product: any) => {
    if (editPrice < 0 || editResellerPrice < 0) {
      toast.error('Price cannot be negative');
      return;
    }

    setIsSaving(true);
    try {
      const newPrice = Number(editPrice);
      const newResellerPrice = Number(editResellerPrice);
      
      if (newPrice !== product.price || newResellerPrice !== product.resellerPrice) {
        await rtdbUpdate(`products/${product.id}`, {
          price: newPrice,
          resellerPrice: newResellerPrice,
          updatedAt: Date.now()
        });
        
        await rtdbPush('priceHistory', {
          productId: product.id,
          productName: product.name || '',
          oldShopPrice: product.price || 0,
          newShopPrice: newPrice,
          oldResellerPrice: product.resellerPrice || 0,
          newResellerPrice: newResellerPrice,
          changedBy: userData?.name || 'Admin',
          changedByUid: userData?.uid || '',
          createdAt: Date.now()
        });

        setProducts(products.map(p => 
          p.id === product.id ? { ...p, price: newPrice, resellerPrice: newResellerPrice } : p
        ));
        
        toast.success('Price updated successfully');
      }
      setEditingId(null);
    } catch (error) {
      console.error('Error updating price in RTDB:', error);
      toast.error('Failed to update price');
    } finally {
      setIsSaving(false);
    }
  };

  const saveBulkPrice = async () => {
    if (selectedProducts.size === 0) {
      toast.error('No products selected');
      return;
    }

    const price = bulkPrice !== '' ? Number(bulkPrice) : null;
    const rPrice = bulkResellerPrice !== '' ? Number(bulkResellerPrice) : null;

    if ((price !== null && price < 0) || (rPrice !== null && rPrice < 0)) {
      toast.error('Price cannot be negative');
      return;
    }

    if (price === null && rPrice === null) {
      toast.error('Please enter at least one price to update');
      return;
    }

    setIsSaving(true);
    try {
      const productsToUpdate = products.filter(p => selectedProducts.has(p.id));

      const updatePromises = productsToUpdate.map(async (product) => {
        const updates: any = { updatedAt: Date.now() };
        let shouldLogHistory = false;
        const historyLog: any = {
          productId: product.id,
          productName: product.name || '',
          oldShopPrice: product.price || 0,
          newShopPrice: product.price || 0,
          oldResellerPrice: product.resellerPrice || 0,
          newResellerPrice: product.resellerPrice || 0,
          changedBy: userData?.name || 'Admin',
          changedByUid: userData?.uid || '',
          createdAt: Date.now()
        };

        if (price !== null && price !== product.price) {
          updates.price = price;
          historyLog.newShopPrice = price;
          shouldLogHistory = true;
        }

        if (rPrice !== null && rPrice !== product.resellerPrice) {
          updates.resellerPrice = rPrice;
          historyLog.newResellerPrice = rPrice;
          shouldLogHistory = true;
        }

        if (shouldLogHistory) {
          await rtdbUpdate(`products/${product.id}`, updates);
          await rtdbPush('priceHistory', historyLog);
        }
      });

      await Promise.allSettled(updatePromises);

      setProducts(products.map(p => {
        if (selectedProducts.has(p.id)) {
          const updated = { ...p };
          if (price !== null) updated.price = price;
          if (rPrice !== null) updated.resellerPrice = rPrice;
          return updated;
        }
        return p;
      }));

      toast.success(`Successfully updated pricing for ${selectedProducts.size} products`);
      setIsBulkEditOpen(false);
      setSelectedProducts(new Set());
      setBulkPrice('');
      setBulkResellerPrice('');
    } catch (error) {
      console.error('Error updating bulk prices in RTDB:', error);
      toast.error('Failed to update bulk prices');
    } finally {
      setIsSaving(false);
    }
  };

  const openHistory = async (product: any) => {
    setHistoryProductId(product.id);
    setIsHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const historyList = await rtdbList<any>('priceHistory').catch(() => []);
      const filtered = historyList
        .map(({ id, data }) => ({ id, ...(data || {}) }))
        .filter(item => item.productId === product.id)
        .sort((a, b) => {
          const timeA = typeof a.createdAt === 'number' ? a.createdAt : a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = typeof b.createdAt === 'number' ? b.createdAt : b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

      setPriceHistory(filtered);
    } catch (error) {
      console.error('Error fetching history from RTDB:', error);
      toast.error('Failed to load price history');
    } finally {
      setLoadingHistory(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-main" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pricing Management</h1>
          <p className="text-slate-500 mt-1">Manage shop and reseller pricing for all products</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedProducts.size > 0 && (
            <button
              onClick={() => setIsBulkEditOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Bulk Edit ({selectedProducts.size})
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name, ID, or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main transition-all"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 appearance-none text-sm"
            >
              <option value="All">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
              className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 appearance-none text-sm"
            >
              <option value="All">All Vendors</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.storeName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 w-12">
                  <button onClick={selectAll} className="text-slate-400 hover:text-primary-main">
                    {selectedProducts.size === filteredProducts.length && filteredProducts.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-primary-main" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                <th className="p-4 text-sm font-semibold text-slate-600">Product</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Details</th>
                <th className="p-4 text-sm font-semibold text-slate-600 cursor-pointer hover:text-primary-main" onClick={() => handleSort('price')}>
                  <div className="flex items-center gap-1">
                    Shop Price
                    {sortConfig.key === 'price' && (
                      <span className="text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="p-4 text-sm font-semibold text-slate-600 cursor-pointer hover:text-primary-main" onClick={() => handleSort('resellerPrice')}>
                  <div className="flex items-center gap-1">
                    Reseller Price
                    {sortConfig.key === 'resellerPrice' && (
                      <span className="text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="p-4 text-sm font-semibold text-slate-600">Status</th>
                <th className="p-4 text-sm font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${selectedProducts.has(product.id) ? 'bg-indigo-50/30' : ''}`}>
                  <td className="p-4">
                    <button 
                      onClick={() => toggleSelection(product.id)} 
                      className="text-slate-400 hover:text-primary-main"
                    >
                      {selectedProducts.has(product.id) ? (
                        <CheckSquare className="w-5 h-5 text-primary-main" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {product.images && product.images.length > 0 ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 line-clamp-1">{product.name}</div>
                        <div className="text-xs text-slate-500 font-mono">ID: {product.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs text-slate-600">Cat: {getCategoryName(product.categoryId)}</div>
                    <div className="text-xs text-slate-600">Ven: {getVendorName(product.vendorId)}</div>
                    {product.sku && <div className="text-xs text-slate-500 font-mono">SKU: {product.sku}</div>}
                  </td>
                  <td className="p-4">
                    {editingId === product.id ? (
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">৳</span>
                        <input
                          type="number"
                          min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(Number(e.target.value))}
                          className="w-24 pl-6 pr-2 py-1 bg-white border border-slate-300 rounded text-sm focus:outline-none focus:border-primary-main"
                        />
                      </div>
                    ) : (
                      <span className="font-medium text-slate-900">৳{product.price?.toLocaleString() || 0}</span>
                    )}
                  </td>
                  <td className="p-4">
                    {editingId === product.id ? (
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">৳</span>
                        <input
                          type="number"
                          min="0"
                          value={editResellerPrice}
                          onChange={(e) => setEditResellerPrice(Number(e.target.value))}
                          className="w-24 pl-6 pr-2 py-1 bg-white border border-slate-300 rounded text-sm focus:outline-none focus:border-primary-main"
                        />
                      </div>
                    ) : (
                      <span className="font-medium text-purple-600">৳{product.resellerPrice?.toLocaleString() || 0}</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      product.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {product.status || 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {editingId === product.id ? (
                        <>
                          <button
                            onClick={() => savePrice(product)}
                            disabled={isSaving}
                            className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(product)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Edit Price"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openHistory(product)}
                            className="p-1.5 text-slate-400 hover:text-purple-600 transition-colors"
                            title="Price History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No products found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Edit Modal */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Bulk Edit Pricing</h3>
              <button
                onClick={() => setIsBulkEditOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-indigo-50 text-indigo-700 p-4 rounded-xl text-sm mb-4">
                You are about to update pricing for <strong>{selectedProducts.size}</strong> selected products. Leave a field blank to keep its current value.
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Shop Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">৳</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Leave blank to keep existing"
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Reseller Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">৳</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Leave blank to keep existing"
                    value={bulkResellerPrice}
                    onChange={(e) => setBulkResellerPrice(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsBulkEditOpen(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveBulkPrice}
                disabled={isSaving || (bulkPrice === '' && bulkResellerPrice === '')}
                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Apply Updates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <History className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Price History</h3>
                  <p className="text-sm text-slate-500">ID: {historyProductId}</p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {loadingHistory ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : priceHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <History className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                  <p>No price history recorded for this product.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {priceHistory.map((hist, index) => (
                    <div key={hist.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-start mb-3">
                        <div className="text-sm font-medium text-slate-900">
                          Changed by {hist.changedBy}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatHistoryDate(hist.createdAt)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded-lg border border-slate-100">
                          <div className="text-xs text-slate-500 mb-1">Shop Price</div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 line-through">৳{hist.oldShopPrice || 0}</span>
                            <span className="text-slate-400">→</span>
                            <span className="font-medium text-slate-900">৳{hist.newShopPrice || 0}</span>
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-100">
                          <div className="text-xs text-slate-500 mb-1">Reseller Price</div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 line-through">৳{hist.oldResellerPrice || 0}</span>
                            <span className="text-slate-400">→</span>
                            <span className="font-medium text-purple-600">৳{hist.newResellerPrice || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
