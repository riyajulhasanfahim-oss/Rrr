import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { rtdbSubscribe, rtdbRemove, rtdbList } from '../../../lib/rtdb';
import VendorLayout from '../../../components/layout/VendorLayout';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Copy, 
  Archive,
  Eye,
  ArrowUpDown,
  Share2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { StorageManager } from '../../../services/storage/StorageManager';
import ShareModal from '../../../components/common/ShareModal';

export default function ProductsList() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedProductToShare, setSelectedProductToShare] = useState<any>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // Subscribe to products in RTDB
    const unsubscribe = rtdbSubscribe<Record<string, any>>('products', (data) => {
      if (!data) {
        setProducts([]);
        setLoading(false);
        return;
      }
      const list: any[] = [];
      for (const [key, val] of Object.entries(data)) {
        if (val && typeof val === 'object') {
          if (val.vendorId === user.uid || val.storeId === user.uid || val.userId === user.uid) {
            list.push({ id: key, ...val });
          }
        }
      }
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setProducts(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        // Clean up stored Google Drive images asynchronously
        StorageManager.deleteProductImages(id).catch(err => console.warn('Drive cleanup warning', err));
        await rtdbRemove(`products/${id}`);
        setProducts(prev => prev.filter(p => p.id !== id));
        toast.success('Product and storage files deleted successfully');
      } catch (error) {
        console.error("Error deleting product from RTDB:", error);
        toast.error('Failed to delete product');
      }
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <VendorLayout>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Manage your store's products and inventory.</p>
        </div>
        <Link 
          to="/vendor/products/new"
          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-primary-main text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-sky-600 transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        {/* Toolbar */}
        <div className="p-3 sm:p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-2.5 sm:gap-4 justify-between items-center bg-gray-50/70">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search products or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 sm:py-2 border border-gray-300 rounded-xl bg-white text-gray-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Filter className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-xl bg-white text-gray-900 px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-main/20 w-full sm:w-auto"
            >
              <option value="All">All Status</option>
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Mobile Product Card List (Visible on sm/mobile) */}
        <div className="block md:hidden divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 animate-pulse flex gap-3 items-center">
                <div className="w-14 h-14 bg-gray-200 rounded-xl shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
              </div>
            ))
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <PackageIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-900 mb-1">No products found</p>
              <p className="text-xs">Add your first product to get started.</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <div key={product.id} className="p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                <div className="h-14 w-14 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                  {product.featuredImage ? (
                    <img referrerPolicy="no-referrer" className="h-full w-full object-cover" src={product.featuredImage} alt={product.name} />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-400">
                      <Archive className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate leading-tight">{product.name}</h4>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md shrink-0 ${
                      product.status === 'Published' ? 'bg-blue-50 text-blue-700' :
                      product.status === 'Draft' ? 'bg-gray-100 text-gray-700' :
                      'bg-orange-50 text-orange-700'
                    }`}>
                      {product.status || 'Draft'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1">
                    <span>SKU: {product.sku || '-'}</span>
                    <span>•</span>
                    <span className={product.stock > 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                      {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">৳{product.price || 0}</span>
                      <span className="text-[10px] text-green-600 font-semibold">Reseller: ৳{((product.price || 0) * 0.8).toFixed(0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/vendor/products/${product.id}/edit`} className="p-1 text-gray-500 hover:text-primary-main transition-colors">
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button onClick={() => handleDelete(product.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table (Visible on md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-200">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse bg-white">
                    <td className="px-4 py-3"><div className="h-8 bg-gray-200 rounded w-48"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                    <td className="px-4 py-3"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
                    <td className="px-4 py-3 text-right"><div className="h-6 bg-gray-200 rounded w-8 ml-auto"></div></td>
                  </tr>
                ))
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <PackageIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-base font-medium text-gray-900 mb-1">No products found</p>
                    <p className="text-xs">Get started by adding your first product.</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="bg-white hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-9 w-9 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          {product.featuredImage ? (
                            <img referrerPolicy="no-referrer" className="h-9 w-9 object-cover" src={product.featuredImage} alt={product.name} />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-400">
                              <Archive className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="ml-3">
                          <div className="text-xs font-semibold text-gray-900 line-clamp-1 max-w-[220px]">
                            {product.name}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {product.category || 'Uncategorized'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                      {product.sku || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-900">
                        ৳{product.price || 0}
                      </div>
                      <div className="text-[10px] font-semibold text-green-600">
                        ৳{((product.price || 0) * 0.8).toFixed(2)} <span className="text-gray-400">Reseller</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 inline-flex text-[11px] font-semibold rounded-full ${
                        product.stock > 10 ? 'bg-green-100 text-green-800' :
                        product.stock > 0 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {product.stock || 0} in stock
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 inline-flex text-[11px] font-semibold rounded-full ${
                        product.status === 'Published' ? 'bg-blue-100 text-blue-800' :
                        product.status === 'Draft' ? 'bg-gray-100 text-gray-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {product.status || 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          type="button"
                          onClick={() => {
                            setSelectedProductToShare(product);
                            setIsShareModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-sky-600 transition-colors cursor-pointer"
                          title="Share Product"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <Link to={`/vendor/products/${product.id}/edit`} className="p-1 text-gray-400 hover:text-primary-main transition-colors">
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button onClick={() => handleDelete(product.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedProductToShare && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => {
            setIsShareModalOpen(false);
            setSelectedProductToShare(null);
          }}
          title={selectedProductToShare.name || selectedProductToShare.title || 'Product'}
          url={`${window.location.origin}/product/${selectedProductToShare.slug || selectedProductToShare.id}`}
          description={selectedProductToShare.shortDescription || selectedProductToShare.name}
          badge="Product Link"
        />
      )}
    </VendorLayout>
  );
}

const PackageIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);
