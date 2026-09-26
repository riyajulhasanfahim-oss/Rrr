import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { rtdbGet, rtdbList } from '../../lib/rtdb';
import { ArrowLeft, Tags, Image as ImageIcon, CheckCircle, XCircle, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { MAIN_CATEGORIES } from '../../constants/categories';

export default function AdminCategoryDetails() {
  const { id } = useParams();
  const [category, setCategory] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchCategoryDetails();
    }
  }, [id]);

  const fetchCategoryDetails = async () => {
    try {
      setLoading(true);
      const catData = await rtdbGet<any>(`categories/${id}`);
      
      let fullCategory = catData ? { id, ...catData } : null;
      if (!fullCategory) {
        const found = MAIN_CATEGORIES.find(c => c.id === id || c.path === id);
        if (found) {
          fullCategory = { ...found, status: 'active' };
        }
      }

      if (fullCategory) {
        setCategory(fullCategory);
        
        // Fetch products associated with this category from RTDB
        const prodsSnap = await rtdbList<any>('products').catch(() => []);
        const matchedProds = prodsSnap
          .map(p => ({ id: p.id, ...(p.data || {}) }))
          .filter(p => {
            const catName = (fullCategory.name || '').toLowerCase();
            const catPath = (fullCategory.path || '').toLowerCase();
            const prodCat = (p.category || '').toLowerCase();
            return prodCat === catName || (catPath && prodCat === catPath) || p.categoryId === id;
          });
        
        setProducts(matchedProds);
      }
    } catch (error) {
      console.error('Error fetching category details from RTDB:', error);
      toast.error('Failed to load category data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main"></div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Category not found.</p>
        <Link to="/admin/categories" className="text-primary-main hover:underline mt-2 inline-block">Back to Categories</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      <div className="flex items-center gap-4">
        <Link to="/admin/categories" className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Category Details</h1>
          <p className="text-sm text-slate-500">View information and related products for this category.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Category Info */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
            <div className="flex justify-center mb-4">
              {category.imageUrl ? (
                <img src={category.imageUrl} alt={category.name} className="w-24 h-24 rounded-2xl object-cover border border-slate-200 shadow-sm" />
              ) : (
                <div className={`w-24 h-24 rounded-2xl flex items-center justify-center border border-slate-100 ${category.color || 'bg-slate-100 text-slate-500'}`}>
                  <Tags className="w-10 h-10" />
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{category.name}</h2>
            <p className="text-xs text-slate-500 font-mono mt-1">ID: {category.id}</p>
            
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700">
              Display Order: {category.order}
            </div>

            <div className="mt-3">
              {category.status === 'inactive' ? (
                <span className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold bg-red-50 px-2 py-1 rounded-md">
                  <XCircle className="w-3.5 h-3.5" /> Inactive
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold bg-emerald-50 px-2 py-1 rounded-md">
                  <CheckCircle className="w-3.5 h-3.5" /> Active
                </span>
              )}
            </div>

            {category.description && (
              <div className="mt-6 pt-6 border-t border-slate-100 text-left">
                <p className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-slate-600 leading-relaxed">{category.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Related Products */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-main" /> Related Products
              </h3>
              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                {products.length} Products
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Product</th>
                    <th className="px-6 py-4 font-semibold">Price</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                        No products found in this category.
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                              {product.images && product.images.length > 0 ? (
                                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-5 h-5 m-auto mt-2.5 text-slate-300" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 max-w-[200px] truncate" title={product.name}>
                                {product.name}
                              </p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{product.sku || 'No SKU'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900">
                          ৳{product.salePrice || product.price}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                            product.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
