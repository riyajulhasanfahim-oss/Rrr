import React, { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { Settings, ArrowLeft, User, Phone, Globe, Camera, Mail, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { rtdbUpdate } from '../../lib/rtdb';
import { updateProfile } from 'firebase/auth';
import toast from 'react-hot-toast';
import { DriveImageUpload } from '../../components/common/DriveImageUpload';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, userData, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    language: 'en',
    photo: ''
  });

  useEffect(() => {
    if (userData) {
      setFormData({
        name: userData.name || '',
        phone: userData.phone || '',
        language: userData.language || 'en',
        photo: userData.photo || ''
      });
    } else if (user) {
      setFormData({
        name: user.displayName || user.email?.split('@')[0] || '',
        phone: user.phoneNumber || '',
        language: 'en',
        photo: user.photoURL || ''
      });
    }
  }, [userData, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setLoading(true);
      await rtdbUpdate(`users/${user.uid}`, {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        language: formData.language,
        photo: formData.photo || null,
        updatedAt: Date.now()
      });

      try {
        await updateProfile(user, { 
          displayName: formData.name.trim(),
          photoURL: formData.photo || undefined 
        });
      } catch (authErr) {
        console.warn('Auth profile update error:', authErr);
      }

      await refreshUserData();
      toast.success('Settings updated successfully!');
    } catch (e) {
      console.error('Settings update error:', e);
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUploaded = async (url: string) => {
    setFormData(prev => ({ ...prev, photo: url }));
    if (user) {
      try {
        await rtdbUpdate(`users/${user.uid}`, { 
          photo: url,
          updatedAt: Date.now()
        });
        await updateProfile(user, { photoURL: url });
        await refreshUserData();
        toast.success('Profile photo updated!');
      } catch (err) {
        console.warn('Photo save warning:', err);
      }
    }
    setShowPhotoModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow pt-8 pb-16 px-4 md:px-8 max-w-2xl mx-auto w-full">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
          <p className="text-slate-500">Manage your personal profile and preferences.</p>
        </div>

        {/* Profile Avatar Card */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 mb-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group">
            {formData.photo ? (
              <img 
                src={formData.photo} 
                referrerPolicy="no-referrer" 
                alt="Profile" 
                className="w-24 h-24 rounded-full object-cover border-4 border-slate-50 shadow-md"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-main to-sky-400 flex items-center justify-center text-white text-3xl font-bold border-4 border-slate-50 shadow-md">
                {(formData.name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <button 
              type="button"
              onClick={() => setShowPhotoModal(true)}
              className="absolute bottom-0 right-0 p-2 bg-slate-900 text-white rounded-full hover:bg-primary-main transition-colors shadow-md"
              title="Change Photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center sm:text-left flex-1">
            <h3 className="text-lg font-bold text-slate-900">{formData.name || 'RJ WORLD BD User'}</h3>
            <p className="text-sm text-slate-500 flex items-center justify-center sm:justify-start gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5" /> {user?.email || 'No email provided'}
            </p>
            <div className="mt-2 inline-flex items-center gap-1 bg-sky-50 text-primary-main px-3 py-1 rounded-full text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Role: {userData?.role || 'Customer'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-primary-main"/> Full Name
            </label>
            <input 
              required 
              type="text" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 text-slate-900 bg-slate-50 focus:bg-white transition-colors" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary-main"/> Phone Number
            </label>
            <input 
              type="tel" 
              value={formData.phone} 
              onChange={e => setFormData({...formData, phone: e.target.value})} 
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 text-slate-900 bg-slate-50 focus:bg-white transition-colors" 
              placeholder="e.g. +880 1700 000000" 
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary-main"/> Preferred Language
            </label>
            <select 
              value={formData.language} 
              onChange={e => setFormData({...formData, language: e.target.value})} 
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 text-slate-900 bg-slate-50 focus:bg-white transition-colors"
            >
              <option value="en">English (US)</option>
              <option value="bn">বাংলা (Bengali)</option>
            </select>
          </div>
          
          <div className="pt-4">
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving Changes...</span>
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </main>

      {showPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md relative shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900">Upload Profile Photo</h3>
              <button 
                onClick={() => setShowPhotoModal(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <DriveImageUpload 
              onUploadSuccess={handlePhotoUploaded} 
              folderName="Profile Photos"
            />
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
