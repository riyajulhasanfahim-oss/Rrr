import React, { useEffect, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { rtdbList, rtdbSet, rtdbRemove } from '../../lib/rtdb';
import { Search, Plus, Edit, Trash2, Eye, Image as ImageIcon, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { MAIN_CATEGORIES } from '../../constants/categories';

export default function AdminCategories() {
  const [categories, setCategories] = useState<any[]>(MAIN_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'order', direction: 'asc' });
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    iconName: 'Tags',
    color: 'bg-slate-100 text-slate-600',
    order: 0,
    status: 'active'
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const [catList, prodList] = await Promise.all([
        rtdbList<any>('categories').catch(() => []),
        rtdbList<any>('products').catch(() => [])
      ]);
      
      const allProducts = prodList.map(p => ({ id: p.id, ...(p.data || {}) }));

      const catsData = catList.map(({ id, data }) => {
        const cat = data || {};
        const catName = (cat.name || '').toLowerCase();
        const catPath = (cat.path || '').toLowerCase();
        
        const count = allProducts.filter(p => {
          const pCat = (p.category || '').toLowerCase();
          return pCat === catName || (catPath && pCat === catPath) || p.categoryId === id;
        }).length;

        return {
          id,
          ...cat,
          productCount: count
        };
      });
      
      const mergedCats = [...catsData];
      MAIN_CATEGORIES.forEach(def => {
        if (!mergedCats.some(m => m.id === def.id || (m.name && m.name.toLowerCase() === def.name.toLowerCase()))) {
          const count = allProducts.filter(p => {
            const pCat = (p.category || '').toLowerCase();
            return pCat === def.name.toLowerCase() || pCat === def.path.toLowerCase();
          }).length;
          mergedCats.push({
            ...def,
            status: 'active',
            productCount: count
          });
        }
      });
      mergedCats.sort((a, b) => (a.order || 0) - (b.order || 0));

      setCategories(mergedCats);
    } catch (error) {
      console.error('Error fetching categories from RTDB:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category: any = null) => {
    if (category) {
      setIsEditing(true);
      setCurrentCategory(category);
      setFormData({
        id: category.id,
        name: category.name || '',
        description: category.description || '',
        iconName: category.iconName || 'Tags',
        color: category.color || 'bg-slate-100 text-slate-600',
        order: category.order || 0,
        status: category.status || 'active'
      });
      setImagePreview(category.imageUrl || '');
    } else {
      setIsEditing(false);
      setCurrentCategory(null);
      setFormData({
        id: '',
        name: '',
        description: '',
        iconName: 'Tags',
        color: 'bg-slate-100 text-slate-600',
        order: categories.length + 1,
        status: 'active'
      });
      setImagePreview('');
    }
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const generateSlug = (text: string) => {
    return text.toString().toLowerCase().trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Category name is required');
      return;
    }

    try {
      setIsSaving(true);
      
      const categoryId = isEditing ? currentCategory.id : generateSlug(formData.name);
      
      let imageUrl = isEditing ? currentCategory.imageUrl : '';

      if (imageFile) {
        const storageRef = ref(storage, `categories/${categoryId}_${Date.now()}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      const categoryData = {
        name: formData.name,
        path: categoryId, // For compatibility with existing path fields
        description: formData.description,
        iconName: formData.iconName,
        color: formData.color,
        order: Number(formData.order),
        status: formData.status,
        ...(imageUrl && { imageUrl }),
        updatedAt: Date.now(),
        ...(!isEditing && { createdAt: Date.now() })
      };

      await rtdbSet(`categories/${categoryId}`, categoryData);
      
      toast.success(`Category ${isEditing ? 'updated' : 'created'} successfully`);
      setIsModalOpen(false);
      fetchCategories();
    } catch (error) {
      console.error('Error saving category in RTDB:', error);
      toast.error('Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (category: any) => {
    if (category.productCount > 0) {
      toast.error('Cannot delete category because products are assigned to it. Please deactivate it instead.');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ${category.name}?`)) {
      try {
        await rtdbRemove(`categories/${category.id}`);
        toast.success('Category deleted successfully');
        fetchCategories();
      } catch (error) {
        console.error('Error deleting category from RTDB:', error);
        toast.error('Failed to delete category');
      }
    }
  };

  const handleStatusToggle = async (category: any) => {
    try {
      const newStatus = category.status === 'inactive' ? 'active' : 'inactive';
      await rtdbSet(`categories/${category.id}`, { ...category, status: newStatus, updatedAt: Date.now() });
      toast.success(`Category marked as ${newStatus}`);
      fetchCategories();
    } catch (error) {
      console.error('Error updating status in RTDB:', error);
      toast.error('Failed to update status');
    }
  };

  
  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredCategories = categories.filter(cat => {
    const matchSearch = 
      (cat.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cat.id || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchStatus = filterStatus === 'All' || 
                        (filterStatus === 'Active' && cat.status !== 'inactive') ||
                        (filterStatus === 'Inactive' && cat.status === 'inactive');
                        
    return matchSearch && matchStatus;
  }).sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categories Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage product categories, sub-categories, and their display order.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary-main text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add New Category
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Total Categories</p>
          <p className="text-xl font-bold text-slate-900">{categories.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Active</p>
          <p className="text-xl font-bold text-emerald-600">
            {categories.filter(c => c.status !== 'inactive').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Inactive</p>
          <p className="text-xl font-bold text-slate-400">
            {categories.filter(c => c.status === 'inactive').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Empty Categories</p>
          <p className="text-xl font-bold text-amber-600">
            {categories.filter(c => c.productCount === 0).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between bg-slate-50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search categories by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main text-sm"
            />
          </div>
          
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
            {['All', 'Active', 'Inactive'].map(status => (
              <button 
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === status ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-50" onClick={() => handleSort('order')}>
                  Order {sortConfig.key === 'order' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-50" onClick={() => handleSort('name')}>
                  Category Info {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-50" onClick={() => handleSort('productCount')}>
                  Products {sortConfig.key === 'productCount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
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
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-primary-main mx-auto"></div>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">No categories found.</td>
                </tr>
              ) : (
                filteredCategories.map((category) => (
                  <tr key={category.id} className={`hover:bg-slate-50 transition-colors bg-white ${category.status === 'inactive' ? 'opacity-75' : ''}`}>
                    <td className="px-6 py-4">
                      <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">{category.order}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {category.imageUrl ? (
                          <img src={category.imageUrl} alt={category.name} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                        ) : (
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border border-slate-100 ${category.color || 'bg-slate-100 text-slate-500'}`}>
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900 text-base">{category.name}</p>
                          <p className="text-xs text-slate-500 font-mono">ID: {category.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${category.productCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {category.productCount} Products
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleStatusToggle(category)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                          category.status !== 'inactive' 
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {category.status !== 'inactive' ? (
                          <><CheckCircle className="w-3.5 h-3.5" /> Active</>
                        ) : (
                          <><XCircle className="w-3.5 h-3.5" /> Inactive</>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link 
                          to={`/admin/categories/${category.id}`}
                          className="p-1.5 bg-slate-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-slate-200 hover:border-blue-200"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleOpenModal(category)}
                          className="p-1.5 bg-slate-50 text-slate-600 hover:bg-primary-main hover:text-white rounded-lg transition-colors border border-slate-200 hover:border-primary-main"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(category)}
                          className={`p-1.5 rounded-lg transition-colors border ${
                            category.productCount > 0 
                            ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' 
                            : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border-red-100 hover:border-red-600'
                          }`}
                          title={category.productCount > 0 ? "Cannot delete category with products" : "Delete"}
                        >
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-xl my-8">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                {isEditing ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button 
                onClick={() => !isSaving && setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                disabled={isSaving}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category Name *</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                  placeholder="e.g. Electronics, Fashion"
                  required
                />
                {!isEditing && (
                  <p className="text-xs text-slate-500 mt-1">ID will be automatically generated as: {formData.name ? generateSlug(formData.name) : '...'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main resize-none"
                  placeholder="Brief description of the category..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Display Order</label>
                  <input 
                    type="number" 
                    value={formData.order}
                    onChange={(e) => setFormData({...formData, order: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                  />
                  <p className="text-xs text-slate-500 mt-1">Lower numbers appear first</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-2">Category Image/Icon</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input 
                      type="file" 
                      id="categoryImage"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <label 
                      htmlFor="categoryImage"
                      className="inline-block px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                    >
                      Choose Image
                    </label>
                    <p className="text-xs text-slate-500 mt-1">Recommended size: 200x200px (PNG/JPG)</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
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
                    'Save Category'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
