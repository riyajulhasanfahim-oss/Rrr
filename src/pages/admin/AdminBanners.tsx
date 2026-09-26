import React, { useEffect, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { rtdbList, rtdbSet, rtdbRemove, rtdbUpdate } from '../../lib/rtdb';
import { Search, Plus, Edit, Trash2, Eye, Image as ImageIcon, CheckCircle, XCircle, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isBefore, isAfter, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

export default function AdminBanners() {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'order', direction: 'asc' });
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentBanner, setCurrentBanner] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    subtitle: '',
    ctaText: '',
    ctaLink: '',
    align: 'left',
    order: 0,
    active: true,
    startDate: '',
    endDate: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const bList = await rtdbList<any>('banners').catch(() => []);
      
      const bData = bList.map(item => ({ 
        id: item.id, 
        ...(item.data || {}) 
      }));
      bData.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      setBanners(bData);
    } catch (error) {
      console.error('Error fetching banners from RTDB:', error);
      toast.error('Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (banner: any = null) => {
    if (banner) {
      setIsEditing(true);
      setCurrentBanner(banner);
      setFormData({
        id: banner.id,
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        ctaText: banner.ctaText || 'Shop Now',
        ctaLink: banner.ctaLink || '',
        align: banner.align || 'left',
        order: banner.order || 0,
        active: banner.active !== false,
        startDate: banner.startDate || '',
        endDate: banner.endDate || ''
      });
      setImagePreview(banner.image || '');
    } else {
      setIsEditing(false);
      setCurrentBanner(null);
      setFormData({
        id: '',
        title: '',
        subtitle: '',
        ctaText: 'Shop Now',
        ctaLink: '',
        align: 'left',
        order: banners.length + 1,
        active: true,
        startDate: '',
        endDate: ''
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

  const generateId = () => {
    return 'banner-' + Date.now();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error('Banner title is required');
      return;
    }

    try {
      setIsSaving(true);
      
      const bannerId = isEditing ? currentBanner.id : generateId();
      let imageUrl = isEditing ? currentBanner.image : '';

      if (imageFile) {
        const storageRef = ref(storage, `banners/${bannerId}_${Date.now()}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      if (!imageUrl) {
        toast.error('Banner image is required');
        setIsSaving(false);
        return;
      }

      const bannerData = {
        title: formData.title,
        subtitle: formData.subtitle,
        ctaText: formData.ctaText,
        ctaLink: formData.ctaLink,
        align: formData.align,
        order: Number(formData.order),
        active: formData.active,
        image: imageUrl,
        startDate: formData.startDate,
        endDate: formData.endDate,
        updatedAt: Date.now(),
        ...(!isEditing && { createdAt: Date.now() })
      };

      await rtdbSet(`banners/${bannerId}`, bannerData);
      
      toast.success(`Banner ${isEditing ? 'updated' : 'created'} successfully`);
      setIsModalOpen(false);
      fetchBanners();
    } catch (error) {
      console.error('Error saving banner in RTDB:', error);
      toast.error('Failed to save banner');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (banner: any) => {
    if (window.confirm(`Are you sure you want to delete ${banner.title}?`)) {
      try {
        await rtdbRemove(`banners/${banner.id}`);
        toast.success('Banner deleted successfully');
        fetchBanners();
      } catch (error) {
        console.error('Error deleting banner from RTDB:', error);
        toast.error('Failed to delete banner');
      }
    }
  };

  const handleStatusToggle = async (banner: any) => {
    try {
      const newStatus = !banner.active;
      await rtdbUpdate(`banners/${banner.id}`, { active: newStatus, updatedAt: Date.now() });
      toast.success(`Banner marked as ${newStatus ? 'Active' : 'Inactive'}`);
      fetchBanners();
    } catch (error) {
      console.error('Error updating status in RTDB:', error);
      toast.error('Failed to update status');
    }
  };

  const getComputedStatus = (banner: any) => {
    if (!banner.active) return 'Inactive';
    
    const now = new Date();
    if (banner.startDate && isBefore(now, parseISO(banner.startDate))) {
      return 'Scheduled';
    }
    if (banner.endDate && isAfter(now, parseISO(banner.endDate))) {
      return 'Expired';
    }
    return 'Active';
  };

  const handleSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredBanners = banners.filter(banner => {
    const computedStatus = getComputedStatus(banner);
    const matchSearch = 
      (banner.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (banner.id || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchStatus = filterStatus === 'All' || computedStatus === filterStatus;
                        
    return matchSearch && matchStatus;
  }).sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    if (sortConfig.key === 'computedStatus') {
      aVal = getComputedStatus(a);
      bVal = getComputedStatus(b);
    }
    
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Banner Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage homepage slider banners and promotional images.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-primary-main text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add New Banner
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Total Banners</p>
          <p className="text-xl font-bold text-slate-900">{banners.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Active</p>
          <p className="text-xl font-bold text-emerald-600">
            {banners.filter(b => getComputedStatus(b) === 'Active').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Scheduled</p>
          <p className="text-xl font-bold text-blue-600">
            {banners.filter(b => getComputedStatus(b) === 'Scheduled').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Expired</p>
          <p className="text-xl font-bold text-amber-600">
            {banners.filter(b => getComputedStatus(b) === 'Expired').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
          <p className="text-xs text-slate-500 font-medium mb-1">Inactive</p>
          <p className="text-xl font-bold text-slate-400">
            {banners.filter(b => getComputedStatus(b) === 'Inactive').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between bg-slate-50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search banners by title or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main text-sm"
            />
          </div>
          
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 overflow-x-auto">
            {['All', 'Active', 'Scheduled', 'Expired', 'Inactive'].map(status => (
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
                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-50" onClick={() => handleSort('title')}>
                  Banner Info {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-6 py-4 font-semibold">Schedule</th>
                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-50" onClick={() => handleSort('computedStatus')}>
                  Status {sortConfig.key === 'computedStatus' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
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
              ) : filteredBanners.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">No banners found.</td>
                </tr>
              ) : (
                filteredBanners.map((banner) => {
                  const computedStatus = getComputedStatus(banner);
                  return (
                    <tr key={banner.id} className={`hover:bg-slate-50 transition-colors bg-white ${computedStatus === 'Inactive' ? 'opacity-75' : ''}`}>
                      <td className="px-6 py-4">
                        <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">{banner.order}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {banner.image ? (
                            <img src={banner.image} alt={banner.title} className="w-20 h-10 rounded object-cover border border-slate-200" />
                          ) : (
                            <div className="w-20 h-10 rounded flex items-center justify-center border border-slate-100 bg-slate-100 text-slate-500">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900 text-base max-w-[200px] truncate" title={banner.title}>{banner.title}</p>
                            <p className="text-xs text-slate-500 max-w-[200px] truncate">{banner.ctaLink}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-600">
                          {banner.startDate ? <div className="flex items-center gap-1"><Calendar className="w-3 h-3"/> Start: {banner.startDate}</div> : <div className="text-slate-400">No start date</div>}
                          {banner.endDate ? <div className="flex items-center gap-1 mt-0.5"><Clock className="w-3 h-3"/> End: {banner.endDate}</div> : <div className="text-slate-400 mt-0.5">No end date</div>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleStatusToggle(banner)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                            computedStatus === 'Active' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 
                            computedStatus === 'Scheduled' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                            computedStatus === 'Expired' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
                            'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {computedStatus === 'Active' && <CheckCircle className="w-3.5 h-3.5" />}
                          {computedStatus === 'Scheduled' && <Clock className="w-3.5 h-3.5" />}
                          {computedStatus === 'Expired' && <AlertTriangle className="w-3.5 h-3.5" />}
                          {computedStatus === 'Inactive' && <XCircle className="w-3.5 h-3.5" />}
                          {computedStatus}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link 
                            to={`/admin/banners/${banner.id}`}
                            className="p-1.5 bg-slate-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-slate-200 hover:border-blue-200"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button 
                            onClick={() => handleOpenModal(banner)}
                            className="p-1.5 bg-slate-50 text-slate-600 hover:bg-primary-main hover:text-white rounded-lg transition-colors border border-slate-200 hover:border-primary-main"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(banner)}
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-colors border border-red-100 hover:border-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-xl my-8 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                {isEditing ? 'Edit Banner' : 'Add New Banner'}
              </h3>
              <button 
                onClick={() => !isSaving && setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                disabled={isSaving}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-2">Banner Image *</label>
                <div className="flex flex-col gap-4">
                  <div className="w-full h-40 rounded-xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden relative">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <span className="text-sm">Upload Banner Image</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      id="bannerImage"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-slate-500">Recommended size: 1200x400px (PNG/JPG). It will be scaled responsively.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                    placeholder="e.g. Summer Sale, New Arrivals"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subtitle / Description</label>
                  <input 
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({...formData, subtitle: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                    placeholder="e.g. Up to 50% off on premium items"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Route/Link</label>
                  <input 
                    type="text" 
                    value={formData.ctaLink}
                    onChange={(e) => setFormData({...formData, ctaLink: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                    placeholder="e.g. /category/electronics, /products/123"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Button Text</label>
                  <input 
                    type="text" 
                    value={formData.ctaText}
                    onChange={(e) => setFormData({...formData, ctaText: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                    placeholder="e.g. Shop Now"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Content Alignment</label>
                  <select 
                    value={formData.align}
                    onChange={(e) => setFormData({...formData, align: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main bg-white"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Display Order</label>
                  <input 
                    type="number" 
                    value={formData.order}
                    onChange={(e) => setFormData({...formData, order: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date (Optional)</label>
                  <input 
                    type="datetime-local" 
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date (Optional)</label>
                  <input 
                    type="datetime-local" 
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main"
                  />
                </div>

                <div className="md:col-span-2 pt-2">
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={formData.active}
                      onChange={(e) => setFormData({...formData, active: e.target.checked})}
                      className="w-5 h-5 rounded text-primary-main focus:ring-primary-main"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">Active Status</p>
                      <p className="text-xs text-slate-500">Enable or disable this banner globally</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
                >
                  Preview
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
                    'Save Banner'
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
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden relative">
            <button 
              onClick={() => setIsPreviewOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <div className="relative h-[200px] sm:h-[300px] lg:h-[400px] w-full overflow-hidden bg-slate-100">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                  No Image Selected
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
              <div className={`absolute inset-0 p-6 md:p-12 flex flex-col justify-center ${
                formData.align === 'center' ? 'items-center text-center bg-black/20' : 
                formData.align === 'right' ? 'items-end text-right bg-gradient-to-l from-black/60 to-transparent' : 
                'items-start text-left'
              }`}>
                <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-2 md:mb-4 max-w-xl">
                  {formData.title || 'Banner Title'}
                </h2>
                <p className="text-sm md:text-lg text-slate-200 mb-6 max-w-lg">
                  {formData.subtitle || 'Banner Subtitle'}
                </p>
                <div className="inline-block bg-white text-slate-900 px-6 py-2.5 rounded-full font-bold text-sm">
                  {formData.ctaText || 'Shop Now'}
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 text-center text-sm text-slate-500 border-t border-slate-100">
              This is a preview of how the banner might look. Actual rendering depends on the User Panel's design.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
