import React, { useState, useEffect } from 'react';
import { rtdbGet, rtdbSet } from '../../lib/rtdb';
import { Save, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import DriveImageUpload from '../../components/admin/DriveImageUpload';

export default function AdminContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [content, setContent] = useState({
    websiteName: '',
    websiteDescription: '',
    logoUrl: '',
    logoDriveId: '',
    aboutUs: '',
    phoneNumber: '',
    email: '',
    address: '',
    termsAndConditions: '',
    privacyPolicy: '',
    returnPolicy: '',
    facebookUrl: '',
    instagramUrl: '',
    youtubeUrl: '',
  });

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const data = await rtdbGet<any>('settings/websiteContent');
      if (data) {
        setContent(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error('Error fetching content from RTDB:', error);
      toast.error('Failed to load website content');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await rtdbSet('settings/websiteContent', {
        ...content,
        updatedAt: Date.now()
      });
      toast.success('Website content saved successfully');
    } catch (error) {
      console.error('Error saving content to RTDB:', error);
      toast.error('Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContent(prev => ({ ...prev, [name]: value }));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Website Content Management</h1>
          <p className="text-slate-500 mt-1">Manage texts, policies, and images for the public website</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* General Info */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-main" /> General Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Website Name</label>
                <input
                  type="text"
                  name="websiteName"
                  value={content.websiteName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none"
                  placeholder="e.g. My Awesome Store"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Website Description</label>
                <textarea
                  name="websiteDescription"
                  value={content.websiteDescription}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none"
                  placeholder="Short description of the website"
                />
              </div>
            </div>
            <div>
              <DriveImageUpload
                label="Website Logo"
                value={content.logoUrl}
                onChange={(url, driveId) => setContent(prev => ({ ...prev, logoUrl: url, logoDriveId: driveId || '' }))}
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-main" /> Contact Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                name="phoneNumber"
                value={content.phoneNumber}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={content.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <input
                type="text"
                name="address"
                value={content.address}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-main" /> Social Media Links
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Facebook URL</label>
              <input
                type="url"
                name="facebookUrl"
                value={content.facebookUrl}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Instagram URL</label>
              <input
                type="url"
                name="instagramUrl"
                value={content.instagramUrl}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">YouTube URL</label>
              <input
                type="url"
                name="youtubeUrl"
                value={content.youtubeUrl}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Policies */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-main" /> Policies & About
          </h2>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">About Us</label>
            <textarea
              name="aboutUs"
              value={content.aboutUs}
              onChange={handleChange}
              rows={5}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Terms and Conditions</label>
            <textarea
              name="termsAndConditions"
              value={content.termsAndConditions}
              onChange={handleChange}
              rows={5}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Privacy Policy</label>
            <textarea
              name="privacyPolicy"
              value={content.privacyPolicy}
              onChange={handleChange}
              rows={5}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Return & Refund Policy</label>
            <textarea
              name="returnPolicy"
              value={content.returnPolicy}
              onChange={handleChange}
              rows={5}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-main focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 pb-12">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-primary-main text-white font-bold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-70"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save All Content
          </button>
        </div>
      </form>
    </div>
  );
}
