import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { rtdbList, rtdbUpdate, rtdbSet, rtdbPush } from '../../../lib/rtdb';
import VendorLayout from '../../../components/layout/VendorLayout';
import { 
  Package, AlertTriangle, XCircle, DollarSign, Search, Filter, 
  ArrowUpRight, ArrowDownRight, Edit2, FileText, Download, Upload, Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InventoryDashboard() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stats
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    inventoryValue: 0
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Modal states
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [adjustType, setAdjustType] = useState<'in' | 'out' | 'set'>('in');
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNotes, setAdjustNotes] = useState('');

  useEffect(() => {
    fetchInventory();
    fetchLogs();
  }, [user]);

  const fetchInventory = async () => {
    if (!user) return;
    try {
      const itemsList = await rtdbList<any>('products', (p) => p.vendorId === user.uid);
      const items = itemsList.map(doc => ({ id: doc.id, ...doc.data })) as any[];
      
      setInventory(items);
      
      // Calculate stats
      let total = items.length;
      let active = items.filter(i => i.status === 'Published').length;
      let low = items.filter(i => i.stock > 0 && i.stock <= (i.lowStockAlert || 5)).length;
      let out = items.filter(i => i.stock <= 0).length;
      let value = items.reduce((acc, i) => acc + (i.stock * (i.price || 0)), 0);
      
      setStats({
        totalProducts: total,
        activeProducts: active,
        lowStock: low,
        outOfStock: out,
        inventoryValue: value
      });
    } catch (error) {
      console.error("Error fetching inventory from RTDB", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    if (!user) return;
    try {
      const logList = await rtdbList<any>('inventory_logs', (l) => l.vendorId === user.uid);
      const logItems = logList.map(doc => ({ id: doc.id, ...doc.data })) as any[];
      logItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setLogs(logItems.slice(0, 10)); // Just recent 10 for dashboard
    } catch (error) {
      console.error("Error fetching logs from RTDB", error);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedItem) return;
    
    try {
      let newStock = selectedItem.stock || 0;
      if (adjustType === 'in') newStock += adjustQty;
      else if (adjustType === 'out') newStock = Math.max(0, newStock - adjustQty);
      else if (adjustType === 'set') newStock = adjustQty;
      
      // Update Product
      await rtdbUpdate(`products/${selectedItem.id}`, { stock: newStock });
      
      // Sync to Inventory Collection in RTDB
      await rtdbUpdate(`inventory/${selectedItem.id}`, { 
        vendorId: user.uid, 
        productId: selectedItem.id, 
        productName: selectedItem.name, 
        stock: newStock, 
        updatedAt: Date.now() 
      });

      // Add Log
      await rtdbPush('inventory_logs', {
        vendorId: user.uid,
        productId: selectedItem.id,
        productName: selectedItem.name,
        sku: selectedItem.sku,
        type: adjustType,
        quantity: adjustQty,
        previousStock: selectedItem.stock || 0,
        newStock: newStock,
        notes: adjustNotes,
        timestamp: Date.now()
      });
      
      toast.success('Stock adjusted successfully');
      setShowAdjustModal(false);
      setSelectedItem(null);
      setAdjustQty(0);
      setAdjustNotes('');
      fetchInventory();
      fetchLogs();
    } catch (error) {
      console.error("Error adjusting stock in RTDB", error);
      toast.error('Failed to adjust stock');
    }
  };

  const exportCSV = () => {
    const headers = ['SKU', 'Name', 'Category', 'Stock', 'Price', 'Value'];
    const rows = inventory.map(item => [
      item.sku || '',
      `"${item.name || ''}"`,
      item.category || '',
      item.stock || 0,
      item.price || 0,
      (item.stock || 0) * (item.price || 0)
    ]);
    
    const csvContent = "data;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      (item.name?.toLowerCase().includes(searchTerm.toLowerCase())) || 
      (item.sku?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.barcode?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...Array.from(new Set(inventory.map(i => i.category).filter(Boolean)))];

  return (
    <VendorLayout>
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Track and manage product stock levels.</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button 
            onClick={exportCSV}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white border border-gray-200 text-gray-700 text-xs sm:text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-1 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span> CSV
          </button>
        </div>
      </div>

      {/* Compact Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-3 mb-3 sm:mb-5">
        <div className="bg-white rounded-xl p-2.5 sm:p-3.5 border border-gray-100 shadow-sm">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 mb-0.5">Total Items</p>
          <h3 className="text-base sm:text-xl font-bold text-gray-900 leading-tight">{stats.totalProducts}</h3>
        </div>
        
        <div className="bg-white rounded-xl p-2.5 sm:p-3.5 border border-gray-100 shadow-sm">
          <p className="text-[10px] sm:text-xs font-medium text-green-600 mb-0.5">Active</p>
          <h3 className="text-base sm:text-xl font-bold text-green-600 leading-tight">{stats.activeProducts}</h3>
        </div>

        <div className="bg-white rounded-xl p-2.5 sm:p-3.5 border border-gray-100 shadow-sm">
          <p className="text-[10px] sm:text-xs font-medium text-yellow-600 mb-0.5">Low Stock</p>
          <h3 className="text-base sm:text-xl font-bold text-yellow-600 leading-tight">{stats.lowStock}</h3>
        </div>

        <div className="bg-white rounded-xl p-2.5 sm:p-3.5 border border-gray-100 shadow-sm">
          <p className="text-[10px] sm:text-xs font-medium text-red-600 mb-0.5">Out of Stock</p>
          <h3 className="text-base sm:text-xl font-bold text-red-600 leading-tight">{stats.outOfStock}</h3>
        </div>

        <div className="bg-white rounded-xl p-2.5 sm:p-3.5 border border-gray-100 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-[10px] sm:text-xs font-medium text-emerald-600 mb-0.5">Stock Value</p>
          <h3 className="text-base sm:text-xl font-bold text-gray-900 leading-tight">৳{stats.inventoryValue.toFixed(0)}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-2.5 sm:p-3.5 border-b border-gray-200 flex flex-col sm:flex-row gap-2 sm:gap-3 justify-between items-center bg-gray-50/70">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search SKU or Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 sm:py-2 border border-gray-300 rounded-xl bg-white text-gray-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20"
                />
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="border border-gray-300 rounded-xl bg-white text-gray-900 px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20 w-full sm:w-auto"
                >
                  {categories.map(c => (
                    <option key={c as string} value={c as string}>{c as string}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mobile Inventory List (Visible on mobile) */}
            <div className="block md:hidden divide-y divide-gray-100">
              {loading ? (
                <div className="p-4 text-center text-xs text-gray-500">Loading inventory...</div>
              ) : filteredInventory.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">No products found.</div>
              ) : (
                filteredInventory.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between gap-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        {item.featuredImage ? (
                          <img referrerPolicy="no-referrer" src={item.featuredImage} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 m-2.5 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 truncate">{item.name}</div>
                        <div className="text-[11px] text-gray-500">SKU: {item.sku || '-'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-bold text-gray-900">{item.stock || 0} left</div>
                        <span className={`text-[10px] font-semibold ${
                          item.stock <= 0 ? 'text-red-600' :
                          item.stock <= (item.lowStockAlert || 5) ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {item.stock <= 0 ? 'Out of Stock' : item.stock <= (item.lowStockAlert || 5) ? 'Low Stock' : 'In Stock'}
                        </span>
                      </div>
                      <button 
                        onClick={() => { setSelectedItem(item); setShowAdjustModal(true); }}
                        className="px-2 py-1 bg-primary-main/10 text-primary-main hover:bg-primary-main hover:text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Adjust
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Inventory Table (Visible on md and up) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-200">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan={5} className="p-4 text-center text-xs text-gray-500">Loading...</td></tr>
                  ) : filteredInventory.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-xs text-gray-500">No products found.</td></tr>
                  ) : (
                    filteredInventory.map((item) => (
                      <tr key={item.id} className="bg-white hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-9 w-9 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden mr-2.5 border border-gray-200">
                              {item.featuredImage ? (
                                <img referrerPolicy="no-referrer" src={item.featuredImage} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-4 h-4 m-2.5 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-gray-900 line-clamp-1 max-w-[180px]">{item.name}</div>
                              <div className="text-[11px] text-gray-500">{item.category || 'Uncategorized'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                          {item.sku || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs font-bold text-gray-900">{item.stock || 0}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.stock <= 0 ? (
                            <span className="px-2 py-0.5 inline-flex text-[11px] font-semibold rounded-full bg-red-100 text-red-800">
                              Out of Stock
                            </span>
                          ) : item.stock <= (item.lowStockAlert || 5) ? (
                            <span className="px-2 py-0.5 inline-flex text-[11px] font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 inline-flex text-[11px] font-semibold rounded-full bg-green-100 text-green-800">
                              In Stock
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <button 
                            onClick={() => { setSelectedItem(item); setShowAdjustModal(true); }}
                            className="text-primary-main hover:text-sky-700 font-semibold text-xs transition-colors inline-flex items-center gap-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Logs Sidebar */}
        <div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3.5 sm:p-5">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 mb-3 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-gray-400" />
              Recent Adjustments
            </h2>
            <div className="space-y-3">
              {logs.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No recent activity.</p>
              ) : (
                logs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex gap-2.5 items-start">
                    <div className="mt-0.5 shrink-0">
                      {log.type === 'in' ? (
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        </div>
                      ) : log.type === 'out' ? (
                        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                          <Edit2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {log.type === 'in' ? 'Stock Added' : log.type === 'out' ? 'Stock Removed' : 'Stock Set'}
                        {' '}- {log.productName}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {log.type === 'set' ? `Set to ${log.newStock}` : `${log.type === 'in' ? '+' : '-'}${log.quantity} units`}
                        {log.notes && ` • ${log.notes}`}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(log.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Adjust Modal */}
      {showAdjustModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white  rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="p-6 border-b border-gray-100  flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 ">Adjust Stock</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-gray-400 hover">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAdjustStock} className="p-6 space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-lg bg-gray-100  overflow-hidden flex-shrink-0">
                  {selectedItem.featuredImage ? (
                    <img referrerPolicy="no-referrer" src={selectedItem.featuredImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-6 h-6 m-3 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900  line-clamp-1">{selectedItem.name}</p>
                  <p className="text-sm text-gray-500">Current Stock: {selectedItem.stock || 0}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700  mb-1">Adjustment Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('in')}
                    className={`py-2 px-3 text-sm font-medium rounded-lg border ${adjustType === 'in' ? 'bg-green-50 border-green-200 text-green-700   ' : 'border-gray-200 text-gray-700  '}`}
                  >
                    Stock In
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('out')}
                    className={`py-2 px-3 text-sm font-medium rounded-lg border ${adjustType === 'out' ? 'bg-red-50 border-red-200 text-red-700   ' : 'border-gray-200 text-gray-700  '}`}
                  >
                    Stock Out
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('set')}
                    className={`py-2 px-3 text-sm font-medium rounded-lg border ${adjustType === 'set' ? 'bg-blue-50 border-blue-200 text-blue-700   ' : 'border-gray-200 text-gray-700  '}`}
                  >
                    Set Count
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700  mb-1">
                  {adjustType === 'set' ? 'New Quantity' : 'Quantity'}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300  rounded-lg bg-white  text-gray-900  focus focus outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700  mb-1">Reason / Notes (Optional)</label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. New shipment, Damaged item..."
                  className="w-full px-4 py-2 border border-gray-300  rounded-lg bg-white  text-gray-900  focus focus outline-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300  text-gray-700  font-medium rounded-lg hover  transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-main text-white font-medium rounded-lg hover transition-colors"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </VendorLayout>
  );
}
