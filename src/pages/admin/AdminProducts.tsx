import React, { useEffect, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { rtdbList, rtdbSet, rtdbUpdate, rtdbPush } from '../../lib/rtdb';
import { Search, Plus, Edit, Trash2, Eye, Image as ImageIcon, CheckCircle, XCircle, Package, TrendingUp, AlertTriangle, Archive, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { StorageManager } from '../../services/storage/StorageManager';
import { MAIN_CATEGORIES } from '../../constants/categories';

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>(MAIN_CATEGORIES);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterVendor, setFilterVendor] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterFeatured, setFilterFeatured] = useState('All');
  const [filterCommission, setFilterCommission] = useState('All');
  
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  
  // Bulk Selection
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    slug: '',
    description: '',
    category: '',
    vendorId: '',
    sku: '',
    price: 0,
    salePrice: 0,
    resellerPrice: 0,
    stock: 0,
    status: 'Active',
    featured: false,
    commissionEligible: false,
    images: [] as string[]
  });
  
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState<number>(0);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      const [pList, cList, uList, vList] = await Promise.all([
        rtdbList<any>('products').catch(() => []),
        rtdbList<any>('categories').catch(() => []),
        rtdbList<any>('users').catch(() => []),
        rtdbList<any>('vendors').catch(() => [])
      ]);
      
      const pData = pList.map(item => ({ id: item.id, ...(item.data || {}) }));
      setProducts(pData);
      
      const cData = cList.map(item => ({ id: item.id, ...(item.data || {}) }));
      const mergedCats = [...MAIN_CATEGORIES];
      cData.forEach((c: any) => {
        if (!mergedCats.some(m => m.id === c.id || m.name?.toLowerCase() === c.name?.toLowerCase())) {
          mergedCats.push(c);
        }
      });
      setCategories(mergedCats);
      
      const vendorsFromUsers = uList
        .filter(({ data }) => (data?.role || '').toLowerCase() === 'vendor')
        .map(({ id, data }) => ({ id, ...(data || {}) }));
      const vendorsDirect = vList.map(({ id, data }) => ({ id, ...(data || {}) }));
      const allVendors = [...vendorsFromUsers, ...vendorsDirect];
      
      const uniqueVendors = Array.from(new Map(allVendors.map(item => [item.id, item])).values());
      setVendors(uniqueVendors);

    } catch (error) {
      console.error('Error fetching data from RTDB:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product: any = null) => {
    if (product) {
      setIsEditing(true);
      setCurrentProduct(product);
      setFormData({
        id: product.id,
        name: product.name || '',
        slug: product.slug || '',
        description: product.description || '',
        category: product.category || '',
        vendorId: product.vendorId || '',
        sku: product.sku || '',
        price: product.price || 0,
        salePrice: product.salePrice || 0,
        resellerPrice: product.resellerPrice || 0,
        stock: product.stock || 0,
        status: product.status || 'Active',
        featured: product.featured || false,
        commissionEligible: product.commissionEligible || false,
        images: product.images || []
      });
      setPreviewImages(product.images || []);
      setMainImageIndex(0); // Existing products usually have main image at index 0 or 'image' field matches
      if (product.image && product.images?.includes(product.image)) {
         setMainImageIndex(product.images.indexOf(product.image));
      }
    } else {
      setIsEditing(false);
      setCurrentProduct(null);
      setFormData({
        id: '',
        name: '',
        slug: '',
        description: '',
        category: '',
        vendorId: '',
        sku: '',
        price: 0,
        salePrice: 0,
        resellerPrice: 0,
        stock: 0,
        status: 'Active',
        featured: false,
        commissionEligible: false,
        images: []
      });
      setPreviewImages([]);
      setMainImageIndex(0);
    }
    setNewImageFiles([]);
    setIsModalOpen(true);
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setNewImageFiles(prev => [...prev, ...files]);
      
      const newPreviews = files.map(f => URL.createObjectURL(f));
      setPreviewImages(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    // If it's an existing image (index < formData.images.length)
    if (index < formData.images.length) {
      const updatedImages = [...formData.images];
      updatedImages.splice(index, 1);
      setFormData({ ...formData, images: updatedImages });
      
      const updatedPreviews = [...previewImages];
      updatedPreviews.splice(index, 1);
      setPreviewImages(updatedPreviews);
    } else {
      // It's a new file
      const newFileIndex = index - formData.images.length;
      const updatedFiles = [...newImageFiles];
      updatedFiles.splice(newFileIndex, 1);
      setNewImageFiles(updatedFiles);
      
      const updatedPreviews = [...previewImages];
      updatedPreviews.splice(index, 1);
      setPreviewImages(updatedPreviews);
    }
    
    if (mainImageIndex === index) {
      setMainImageIndex(0);
    } else if (mainImageIndex > index) {
      setMainImageIndex(mainImageIndex - 1);
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.vendorId) {
      toast.error('Name, Category, and Vendor are required');
      return;
    }
    
    if (formData.images.length === 0 && newImageFiles.length === 0) {
      toast.error('At least one product image is required');
      return;
    }

    try {
      setIsSaving(true);
      
      const finalSlug = formData.slug || generateSlug(formData.name);
      let finalImages = [...formData.images];

      // Upload new images via pooled storage manager
      for (let i = 0; i < newImageFiles.length; i++) {
        const file = newImageFiles[i];
        try {
          const storedRecord = await StorageManager.uploadProductImage(file, {
            productId: isEditing ? currentProduct.id : undefined,
            vendorId: formData.vendorId,
          });
          if (storedRecord?.fileUrl) {
            finalImages.push(storedRecord.fileUrl);
          }
        } catch (uploadErr) {
          // Fallback to Firebase Storage if available
          try {
            const storageRef = ref(storage, `products/${finalSlug}_${Date.now()}_${i}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            finalImages.push(url);
          } catch (fbErr) {
            console.error('Image upload failed:', fbErr);
          }
        }
      }

      // Reorder images so main image is first, or just keep track of it
      let mainImageUrl = finalImages[mainImageIndex] || finalImages[0];

      const productDataToSave = {
        name: formData.name,
        slug: finalSlug,
        description: formData.description,
        category: formData.category,
        vendorId: formData.vendorId,
        sku: formData.sku,
        price: Number(formData.price),
        salePrice: Number(formData.salePrice) || null,
        resellerPrice: Number(formData.resellerPrice) || null,
        stock: Number(formData.stock),
        status: formData.status,
        featured: formData.featured,
        commissionEligible: formData.commissionEligible,
        images: finalImages,
        image: mainImageUrl, // For backwards compatibility
        updatedAt: Date.now(),
      };

      if (isEditing) {
        await rtdbUpdate(`products/${currentProduct.id}`, productDataToSave);
        toast.success('Product updated successfully');
      } else {
        await rtdbPush('products', {
          ...productDataToSave,
          createdAt: Date.now(),
          soldQuantity: 0
        });
        toast.success('Product created successfully');
      }

      setIsModalOpen(false);
      fetchInitialData();
    } catch (error) {
      console.error('Error saving product in RTDB:', error);
      toast.error('Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (product: any) => {
    if (window.confirm(`Are you sure you want to archive ${product.name}?\n\nIt is recommended to archive instead of hard delete to preserve order history.`)) {
      try {
        await rtdbUpdate(`products/${product.id}`, { status: 'Archived', updatedAt: Date.now() });
        toast.success('Product archived successfully');
        fetchInitialData();
      } catch (error) {
        console.error('Error archiving product in RTDB:', error);
        toast.error('Failed to archive product');
      }
    }
  };

  const handleBulkAction = async (action: 'Active' | 'Inactive' | 'Archived') => {
    if (selectedProducts.size === 0) return;
    
    if (window.confirm(`Are you sure you want to mark ${selectedProducts.size} products as ${action}?`)) {
      try {
        setLoading(true);
        await Promise.all(
          Array.from(selectedProducts).map(id =>
            rtdbUpdate(`products/${id}`, { status: action, updatedAt: Date.now() })
          )
        );
        toast.success(`Bulk action successful`);
        setSelectedProducts(new Set());
        fetchInitialData();
      } catch (error) {
        console.error('Error performing bulk action in RTDB:', error);
        toast.error('Bulk action failed');
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleProductSelection = (id: string) => {
    const newSet = new Set(selectedProducts);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedProducts(newSet);
  };

  const toggleAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map((p: any) => p.id)));
    }
  };

  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredProducts = products.filter(product => {
    const matchSearch = 
      (product.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchCategory = filterCategory === 'All' || product.category === filterCategory;
    const matchVendor = filterVendor === 'All' || product.vendorId === filterVendor;
    const matchStatus = filterStatus === 'All' || 
                        (filterStatus === 'Out of Stock' ? product.stock <= 0 : product.status === filterStatus);
    const matchFeatured = filterFeatured === 'All' || 
                          (filterFeatured === 'Featured' ? product.featured : !product.featured);
    const matchCommission = filterCommission === 'All' || 
                            (filterCommission === 'Eligible' ? product.commissionEligible : !product.commissionEligible);
                        
    return matchSearch && matchCategory && matchVendor && matchStatus && matchFeatured && matchCommission;
  }).sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    // Derived value sorting
    if (sortConfig.key === 'sales') {
      aVal = a.soldQuantity || 0;
      bVal = b.soldQuantity || 0;
    } else if (sortConfig.key === 'price') {
      aVal = a.salePrice || a.price || 0;
      bVal = b.salePrice || b.price || 0;
    }
    
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage all products, stock, pricing, and vendors.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary-main text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add New Product
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Total Products</p>
          <p className="text-xl font-bold text-slate-900">{products.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Active</p>
          <p className="text-xl font-bold text-emerald-600">
            {products.filter(p => p.status === 'Active' && p.stock > 0).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Out of Stock</p>
          <p className="text-xl font-bold text-red-600">
            {products.filter(p => p.stock <= 0).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Featured</p>
          <p className="text-xl font-bold text-blue-600">
            {products.filter(p => p.featured).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Comm. Eligible</p>
          <p className="text-xl font-bold text-purple-600">
            {products.filter(p => p.commissionEligible).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col gap-4 bg-slate-50">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search products by name, ID, or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main text-sm"
              />
            </div>
            
            {selectedProducts.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600 bg-slate-200 px-3 py-1.5 rounded-lg">{selectedProducts.size} selected</span>
                <button onClick={() => handleBulkAction('Active')} className="px-3 py-1.5 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">Set Active</button>
                <button onClick={() => handleBulkAction('Inactive')} className="px-3 py-1.5 text-xs font-semibold bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Set Inactive</button>
                <button onClick={() => handleBulkAction('Archived')} className="px-3 py-1.5 text-xs font-semibold bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">Archive</button>
              </div>
            )}
          </div>
          
          {/* Filters Row */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Filter className="w-4 h-4" /> Filters:
            </div>
            
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none">
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            
            <select value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none">
              <option value="All">All Vendors</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.shopName || v.name || v.id}</option>)}
            </select>
            
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none">
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
            
            <select value={filterFeatured} onChange={(e) => setFilterFeatured(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none">
              <option value="All">Featured: All</option>
              <option value="Featured">Yes</option>
              <option value="Not Featured">No</option>
            </select>
            
            <select value={filterCommission} onChange={(e) => setFilterCommission(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none">
              <option value="All">Commission: All</option>
              <option value="Eligible">Eligible</option>
              <option value="Not Eligible">Not Eligible</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-4 w-12">
                  <input type="checkbox" checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0} onChange={toggleAll} className="w-4 h-4 rounded text-primary-main focus:ring-primary-main border-slate-300" />
                </th>
                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-50" onClick={() => handleSort('name')}>
                  Product {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-50" onClick={() => handleSort('price')}>
                  Pricing {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-50" onClick={() => handleSort('stock')}>
                  Stock {sortConfig.key === 'stock' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-50" onClick={() => handleSort('sales')}>
                  Sales {sortConfig.key === 'sales' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-50" onClick={() => handleSort('status')}>
                  Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main mx-auto"></div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No products found matching the criteria.</td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const outOfStock = product.stock <= 0;
                  const displayStatus = outOfStock ? 'Out of Stock' : product.status;
                  const vendor = vendors.find(v => v.id === product.vendorId);
                  
                  return (
                    <tr key={product.id} className={`hover:bg-slate-50 transition-colors bg-white ${product.status === 'Archived' ? 'opacity-70' : ''}`}>
                      <td className="px-4 py-4">
                        <input type="checkbox" checked={selectedProducts.has(product.id)} onChange={() => toggleProductSelection(product.id)} className="w-4 h-4 rounded text-primary-main focus:ring-primary-main border-slate-300" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 relative">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-6 h-6 m-auto mt-3 text-slate-400" />
                            )}
                            {product.featured && (
                              <div className="absolute top-0 right-0 bg-blue-500 w-3 h-3 rounded-bl-lg" title="Featured" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm max-w-[200px] truncate" title={product.name}>{product.name}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{product.sku || 'No SKU'}</p>
                            <p className="text-xs text-primary-main mt-0.5 font-medium truncate max-w-[200px]">{vendor?.shopName || vendor?.name || 'Unknown Vendor'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p><span className="text-slate-500 text-xs">Shop:</span> <span className="font-bold text-slate-900">৳{product.salePrice || product.price}</span></p>
                          {product.resellerPrice > 0 && (
                            <p><span className="text-slate-500 text-xs">R.P:</span> <span className="font-semibold text-purple-600">৳{product.resellerPrice}</span></p>
                          )}
                          {product.commissionEligible && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold">Comm. Eligible</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${outOfStock ? 'text-red-600' : product.stock <= (product.lowStockAlert || 5) ? 'text-amber-600' : 'text-slate-900'}`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                          <TrendingUp className="w-4 h-4 text-slate-400" />
                          {product.soldQuantity || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${
                          displayStatus === 'Active' ? 'bg-emerald-100 text-emerald-700' : 
                          displayStatus === 'Out of Stock' ? 'bg-red-100 text-red-700' :
                          displayStatus === 'Archived' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link 
                            to={`/admin/products/${product.id}`}
                            className="p-1.5 bg-slate-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-slate-200 hover:border-blue-200"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button 
                            onClick={() => handleOpenModal(product)}
                            className="p-1.5 bg-slate-50 text-slate-600 hover:bg-primary-main hover:text-white rounded-lg transition-colors border border-slate-200 hover:border-primary-main"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {product.status !== 'Archived' && (
                            <button 
                              onClick={() => handleDelete(product)}
                              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-colors border border-red-100 hover:border-red-600"
                              title="Archive"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-xl my-8 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                {isEditing ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button 
                onClick={() => !isSaving && setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                disabled={isSaving}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column: Basic Info & Images */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Basic Info */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
                    <h4 className="font-semibold text-slate-900 border-b border-slate-200 pb-2">Basic Information</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
                      <input 
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main bg-white"
                        placeholder="e.g. Wireless Noise Cancelling Headphones"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                      <textarea 
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main bg-white min-h-[120px]"
                        placeholder="Detailed product description..."
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                        <select 
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main bg-white"
                          required
                        >
                          <option value="">Select Category</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Vendor *</label>
                        <select 
                          value={formData.vendorId}
                          onChange={(e) => setFormData({...formData, vendorId: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main bg-white"
                          required
                        >
                          <option value="">Select Vendor</option>
                          {vendors.map(v => (
                            <option key={v.id} value={v.id}>{v.shopName || v.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Images */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <h4 className="font-semibold text-slate-900">Product Images</h4>
                      <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        রিকমেন্ডেড সাইজ: 800 × 800 px (1:1)
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {previewImages.map((src, idx) => (
                        <div key={idx} className={`relative aspect-square rounded-xl border-2 overflow-hidden group ${mainImageIndex === idx ? 'border-primary-main' : 'border-slate-200'}`}>
                          <img src={src} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-2">
                            <button 
                              type="button" 
                              onClick={() => removeImage(idx)}
                              className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs"
                            >
                              Remove
                            </button>
                            {mainImageIndex !== idx && (
                              <button 
                                type="button" 
                                onClick={() => setMainImageIndex(idx)}
                                className="p-1.5 bg-primary-main text-white rounded-lg hover:bg-primary-dark transition-colors text-xs"
                              >
                                Set Main
                              </button>
                            )}
                          </div>
                          {mainImageIndex === idx && (
                            <div className="absolute top-1 left-1 bg-primary-main text-white text-[10px] font-bold px-1.5 py-0.5 rounded">Main</div>
                          )}
                        </div>
                      ))}
                      
                      <div className="relative aspect-square rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors">
                        <ImageIcon className="w-8 h-8 text-slate-400 mb-1" />
                        <span className="text-xs text-slate-500 font-medium text-center px-2">Add Images</span>
                        <input 
                          type="file" 
                          multiple
                          accept="image/*"
                          onChange={handleImagesChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">First image will be used as the primary image if "Set Main" is not clicked.</p>
                  </div>
                </div>

                {/* Right Column: Pricing & Inventory */}
                <div className="space-y-6">
                  {/* Pricing */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
                    <h4 className="font-semibold text-slate-900 border-b border-slate-200 pb-2">Pricing</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Regular Price (৳) *</label>
                      <input 
                        type="number" 
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main bg-white"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Sale Price (৳)</label>
                      <input 
                        type="number" 
                        min="0"
                        value={formData.salePrice}
                        onChange={(e) => setFormData({...formData, salePrice: Number(e.target.value)})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main bg-white"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Leave 0 if no discount</p>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <label className="block text-sm font-bold text-purple-700 mb-1">Reseller Price (৳)</label>
                      <input 
                        type="number" 
                        min="0"
                        value={formData.resellerPrice}
                        onChange={(e) => setFormData({...formData, resellerPrice: Number(e.target.value)})}
                        className="w-full px-4 py-2 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                      />
                      <p className="text-[10px] text-purple-600 mt-1">Special price for approved resellers</p>
                    </div>
                  </div>

                  {/* Inventory & Status */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
                    <h4 className="font-semibold text-slate-900 border-b border-slate-200 pb-2">Inventory & Status</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Stock *</label>
                        <input 
                          type="number" 
                          min="0"
                          value={formData.stock}
                          onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
                        <input 
                          type="text" 
                          value={formData.sku}
                          onChange={(e) => setFormData({...formData, sku: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main bg-white"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                      <select 
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main bg-white"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Archived">Archived</option>
                      </select>
                    </div>

                    <div className="pt-3 border-t border-slate-200 space-y-3">
                      <label className="flex items-center gap-3 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 bg-white">
                        <input 
                          type="checkbox" 
                          checked={formData.featured}
                          onChange={(e) => setFormData({...formData, featured: e.target.checked})}
                          className="w-4 h-4 rounded text-primary-main focus:ring-primary-main"
                        />
                        <span className="text-sm font-medium text-slate-700">Featured Product</span>
                      </label>
                      
                      <label className="flex items-center gap-3 p-2 border border-purple-200 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100">
                        <input 
                          type="checkbox" 
                          checked={formData.commissionEligible}
                          onChange={(e) => setFormData({...formData, commissionEligible: e.target.checked})}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <span className="text-sm font-bold text-purple-900 block">Commission Eligible</span>
                          <span className="text-[10px] text-purple-700 block">Allow sharing for commission</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
                >
                  Preview Details
                </button>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-primary-main text-white hover:bg-primary-dark rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  {isSaving ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Saving...</>
                  ) : (
                    'Save Product'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900">Admin Preview</h3>
              <button onClick={() => setIsPreviewOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-1/2">
                <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden mb-4 border border-slate-200">
                   {previewImages.length > 0 ? (
                     <img src={previewImages[mainImageIndex] || previewImages[0]} alt="Preview" className="w-full h-full object-cover" />
                   ) : (
                     <div className="flex items-center justify-center h-full text-slate-400">No Image</div>
                   )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {previewImages.map((src, i) => (
                    <img key={i} src={src} className="w-12 h-12 rounded border border-slate-200 object-cover shrink-0" />
                  ))}
                </div>
              </div>
              <div className="w-full md:w-1/2 space-y-4">
                <div>
                  <span className="text-xs font-bold text-primary-main bg-primary-50 px-2 py-1 rounded uppercase tracking-wider">{formData.category || 'Uncategorized'}</span>
                  <h2 className="text-2xl font-bold text-slate-900 mt-2 leading-tight">{formData.name || 'Product Name'}</h2>
                </div>
                
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">৳{formData.salePrice || formData.price}</span>
                  {formData.salePrice > 0 && formData.salePrice < formData.price && (
                    <span className="text-sm text-slate-400 line-through">৳{formData.price}</span>
                  )}
                </div>
                
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Stock:</span>
                    <span className="font-bold text-slate-900">{formData.stock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reseller Price:</span>
                    <span className="font-bold text-purple-600">৳{formData.resellerPrice || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Commission:</span>
                    <span className="font-bold text-slate-900">{formData.commissionEligible ? 'Eligible' : 'No'}</span>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-semibold text-slate-900 mb-1">Description</p>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-4">{formData.description || 'No description provided.'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
