import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { rtdbGet, rtdbList } from '../../lib/rtdb';
import { Package, TrendingUp, Calendar, AlertTriangle, CheckCircle, Image as ImageIcon, Edit, ShoppingCart, DollarSign, Share2 } from 'lucide-react';
import { format } from 'date-fns';

const formatDateVal = (val: any) => {
  if (!val) return 'Unknown';
  try {
    const d = typeof val === 'number' 
      ? new Date(val) 
      : typeof val === 'string' 
      ? new Date(val) 
      : val.toDate 
      ? val.toDate() 
      : val.seconds 
      ? new Date(val.seconds * 1000) 
      : new Date(val);
    return isNaN(d.getTime()) ? 'Unknown' : format(d, 'MMM d, yyyy');
  } catch {
    return 'Unknown';
  }
};

export default function AdminProductDetails() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalOrders: 0, totalSales: 0, relatedCommission: 0 });
  const [selectedImage, setSelectedImage] = useState<string>('');

  useEffect(() => {
    fetchProductDetails();
  }, [id]);

  const fetchProductDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const pData = await rtdbGet<any>(`products/${id}`);
      if (pData) {
        const fullProduct = { id, ...pData };
        setProduct(fullProduct);
        setSelectedImage(fullProduct.image || (fullProduct.images && fullProduct.images[0]) || '');
        
        if (fullProduct.vendorId) {
          const [userVendor, directVendor] = await Promise.all([
            rtdbGet<any>(`users/${fullProduct.vendorId}`).catch(() => null),
            rtdbGet<any>(`vendors/${fullProduct.vendorId}`).catch(() => null)
          ]);
          const foundVendor = directVendor || userVendor;
          if (foundVendor) {
            setVendor({ id: fullProduct.vendorId, ...foundVendor });
          }
        }
        
        // Fetch stats from RTDB orders and commissions
        try {
          const [rtdbOrders, rtdbCommissions] = await Promise.all([
            rtdbList<any>('orders').catch(() => []),
            rtdbList<any>('commissions').catch(() => [])
          ]);

          let totalOrders = 0;
          let totalSales = 0;
          rtdbOrders.forEach(({ data }) => {
            const o = data || {};
            const items = o.items || [];
            const item = items.find((i: any) => i.productId === id || i.id === id);
            if (item) {
              totalOrders++;
              totalSales += ((Number(item.price) || 0) * (Number(item.quantity) || 1));
            }
          });
          
          let totalComm = 0;
          rtdbCommissions.forEach(({ data }) => {
            if (data?.productId === id) {
              totalComm += (Number(data.amount) || 0);
            }
          });
          
          setStats({ totalOrders, totalSales, relatedCommission: totalComm });
        } catch (e) {
          console.error("Stats error from RTDB:", e);
        }
      }
    } catch (error) {
      console.error('Error fetching product details from RTDB:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Product Not Found</h2>
        <p className="text-slate-500 mt-2">The product you are looking for does not exist or has been deleted.</p>
        <Link to="/admin/products" className="text-primary-main hover:underline mt-4 inline-block">Back to Products</Link>
      </div>
    );
  }

  const outOfStock = product.stock <= 0;
  const displayStatus = outOfStock ? 'Out of Stock' : product.status;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin/products" className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-900 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            Product Details
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${
              displayStatus === 'Active' ? 'bg-emerald-100 text-emerald-700' : 
              displayStatus === 'Out of Stock' ? 'bg-red-100 text-red-700' :
              displayStatus === 'Archived' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-200 text-slate-700'
            }`}>
              {displayStatus}
            </span>
            {product.featured && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-700">
                Featured
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 font-mono mt-1">ID: {product.id} • SKU: {product.sku || 'N/A'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Images & Overview */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="aspect-square rounded-xl bg-slate-100 overflow-hidden mb-4 border border-slate-200 relative">
              {selectedImage ? (
                <img src={selectedImage} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <ImageIcon className="w-12 h-12 text-slate-300" />
                </div>
              )}
            </div>
            
            {product.images && product.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {product.images.map((img: string, idx: number) => (
                  <button 
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`w-16 h-16 rounded-lg border-2 shrink-0 overflow-hidden ${selectedImage === img ? 'border-primary-main' : 'border-slate-200 opacity-70'}`}
                  >
                    <img src={img} alt="Thumbnail" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Vendor Information</h3>
            {vendor ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-primary-main font-bold">
                  {(vendor.shopName || vendor.name || 'V').charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{vendor.shopName || vendor.name}</p>
                  <p className="text-xs text-slate-500">{vendor.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No vendor assigned or vendor deleted.</p>
            )}
          </div>
        </div>

        {/* Right Column: Details & Stats */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
            <div>
              <span className="text-xs font-bold text-primary-main bg-primary-50 px-2 py-1 rounded uppercase tracking-wider">{product.category || 'Uncategorized'}</span>
              <h2 className="text-3xl font-bold text-slate-900 mt-3">{product.name}</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-slate-100">
              <div>
                <p className="text-xs text-slate-500 font-medium">Regular Price</p>
                <p className="text-xl font-bold text-slate-900">৳{product.price || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Sale Price</p>
                <p className="text-xl font-bold text-emerald-600">
                  {product.salePrice ? `৳${product.salePrice}` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-purple-600 font-medium">Reseller Price</p>
                <p className="text-xl font-bold text-purple-700">
                  {product.resellerPrice ? `৳${product.resellerPrice}` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Current Stock</p>
                <p className={`text-xl font-bold ${outOfStock ? 'text-red-600' : 'text-slate-900'}`}>{product.stock || 0}</p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 mb-2">Description</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                {product.description || 'No description provided for this product.'}
              </p>
            </div>
            
            <div className="flex gap-4 pt-4">
               {product.commissionEligible && (
                 <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-semibold border border-green-100">
                   <Share2 className="w-4 h-4" /> Commission Eligible
                 </div>
               )}
               <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Calendar className="w-4 h-4" /> 
                  Added on {formatDateVal(product.createdAt)}
               </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Orders</p>
                <p className="text-xl font-bold text-slate-900">{stats.totalOrders}</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Sales</p>
                <p className="text-xl font-bold text-slate-900">৳{stats.totalSales.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Generated Comm.</p>
                <p className="text-xl font-bold text-slate-900">৳{stats.relatedCommission.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
