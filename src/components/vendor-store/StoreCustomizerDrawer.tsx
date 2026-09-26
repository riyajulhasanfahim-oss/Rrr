import React, { useState } from 'react';
import { X, Palette, Type, Megaphone, Sparkles, Check, Save, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { rtdbUpdate } from '../../lib/rtdb';
import { saveStoreThemeToCache, saveStoreToCache, getStoreFromCache } from '../../services/storeCache';
import toast from 'react-hot-toast';

interface StoreCustomizerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  currentTheme: any;
  currentProfile: any;
  onThemeUpdated: (newTheme: any) => void;
  onProfileUpdated: (newProfile: any) => void;
}

const COLOR_PRESETS = [
  { name: 'Royal Sky', primary: '#0284c7', secondary: '#0369a1' },
  { name: 'Emerald Forest', primary: '#059669', secondary: '#047857' },
  { name: 'Indigo Dream', primary: '#4f46e5', secondary: '#4338ca' },
  { name: 'Ruby Crimson', primary: '#e11d48', secondary: '#be123c' },
  { name: 'Amber Gold', primary: '#d97706', secondary: '#b45309' },
  { name: 'Violet Velvet', primary: '#7c3aed', secondary: '#6d28d9' },
  { name: 'Midnight Charcoal', primary: '#334155', secondary: '#1e293b' },
  { name: 'Teal Modern', primary: '#0d9488', secondary: '#0f766e' },
];

const FONTS = [
  { id: 'Inter', name: 'Inter (Modern & Clean)' },
  { id: 'Poppins', name: 'Poppins (Friendly & Bold)' },
  { id: 'Roboto', name: 'Roboto (Standard Sans)' },
  { id: 'Playfair Display', name: 'Playfair Display (Luxury Serif)' },
];

export default function StoreCustomizerDrawer({
  isOpen,
  onClose,
  vendorId,
  currentTheme,
  currentProfile,
  onThemeUpdated,
  onProfileUpdated
}: StoreCustomizerDrawerProps) {
  const [primaryColor, setPrimaryColor] = useState(currentTheme?.primaryColor || '#0284c7');
  const [secondaryColor, setSecondaryColor] = useState(currentTheme?.secondaryColor || '#0369a1');
  const [fontStyle, setFontStyle] = useState(currentTheme?.fontStyle || 'Inter');
  const [announcement, setAnnouncement] = useState(currentTheme?.announcement || '');
  const [slogan, setSlogan] = useState(currentProfile?.slogan || '');
  const [bannerUrl, setBannerUrl] = useState(currentProfile?.banner || '');
  const [saving, setSaving] = useState(false);

  // Sync state if props change
  React.useEffect(() => {
    if (currentTheme) {
      setPrimaryColor(currentTheme.primaryColor || '#0284c7');
      setSecondaryColor(currentTheme.secondaryColor || '#0369a1');
      setFontStyle(currentTheme.fontStyle || 'Inter');
      setAnnouncement(currentTheme.announcement || '');
    }
    if (currentProfile) {
      setSlogan(currentProfile.slogan || '');
      setBannerUrl(currentProfile.banner || '');
    }
  }, [currentTheme, currentProfile, isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: { primary: string; secondary: string }) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
  };

  const handleSave = async () => {
    if (!vendorId) {
      toast.error('ভেন্ডার আইডি পাওয়া যায়নি');
      return;
    }

    setSaving(true);
    try {
      const updatedTheme = {
        ...currentTheme,
        primaryColor,
        secondaryColor,
        fontStyle,
        announcement,
        updatedAt: Date.now()
      };

      const updatedProfile = {
        ...currentProfile,
        slogan,
        banner: bannerUrl,
        updatedAt: Date.now()
      };

      // 1. Save to vendor_themes
      await rtdbUpdate(`vendor_themes/${vendorId}`, updatedTheme);

      // 2. Save to vendor_profiles
      await rtdbUpdate(`vendor_profiles/${vendorId}`, updatedProfile);

      // 3. Save to stores and vendors for universal synchronization
      await Promise.allSettled([
        rtdbUpdate(`stores/${vendorId}`, {
          theme: updatedTheme,
          primaryColor: updatedTheme.primaryColor,
          slogan: updatedProfile.slogan,
          banner: updatedProfile.banner
        }),
        rtdbUpdate(`vendors/${vendorId}`, {
          theme: updatedTheme,
          primaryColor: updatedTheme.primaryColor,
          slogan: updatedProfile.slogan,
          banner: updatedProfile.banner
        })
      ]);

      // 4. Save to synchronous caches for instant zero-flicker reload
      saveStoreThemeToCache(vendorId, updatedTheme);
      const existingCached = getStoreFromCache(vendorId);
      if (existingCached) {
        saveStoreToCache(vendorId, {
          ...existingCached,
          ...updatedProfile,
          theme: updatedTheme,
          primaryColor: updatedTheme.primaryColor
        });
      }

      // Notify parent
      onThemeUpdated(updatedTheme);
      onProfileUpdated(updatedProfile);

      toast.success('স্টোর কাস্টমাইজেশন সফলভাবে সংরক্ষিত হয়েছে!');
      onClose();
    } catch (error) {
      console.error('Error saving store customizations:', error);
      toast.error('সংরক্ষণে ত্রুটি হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div 
            className="p-4 sm:p-5 text-white flex items-center justify-between transition-colors shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/20 text-white">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold">স্টোর কাস্টমাইজার</h2>
                <p className="text-xs text-white/80">দোকানের রঙ ও স্টাইল পরিবর্তন করুন</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-slate-800">
            {/* Live Color Preview Bar */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-xs font-semibold text-slate-600 block mb-2">লাইভ প্রিভিউ কালার</span>
              <div className="flex items-center gap-2">
                <div 
                  className="flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-xs"
                  style={{ backgroundColor: primaryColor }}
                >
                  প্রাইমারি বাটন
                </div>
                <div 
                  className="flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-xs"
                  style={{ backgroundColor: secondaryColor }}
                >
                  সেকেন্ডারি এক্সেন্ট
                </div>
              </div>
            </div>

            {/* Color Presets */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                রং থিম প্রিসেট (Theme Presets)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {COLOR_PRESETS.map((preset) => {
                  const isSelected = primaryColor === preset.primary;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`p-2 rounded-xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                        isSelected 
                          ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span 
                          className="w-4 h-4 rounded-full border border-black/10 shrink-0" 
                          style={{ backgroundColor: preset.primary }} 
                        />
                        <span 
                          className="w-3 h-3 rounded-full border border-black/10 shrink-0" 
                          style={{ backgroundColor: preset.secondary }} 
                        />
                      </div>
                      <span className="text-[11px] font-medium text-slate-700 truncate">{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Color Pickers */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                কাস্টম কালার সিলেক্টর
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-600 block mb-1.5">প্রাইমারি কালার</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg uppercase font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-medium text-slate-600 block mb-1.5">সেকেন্ডারি কালার</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg uppercase font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Font Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-slate-500" />
                ফন্ট স্টাইল (Font Family)
              </label>
              <div className="grid grid-cols-1 gap-2">
                {FONTS.map((font) => (
                  <label 
                    key={font.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      fontStyle === font.id 
                        ? 'border-slate-800 bg-slate-50 font-semibold' 
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="storeFont" 
                        checked={fontStyle === font.id}
                        onChange={() => setFontStyle(font.id)}
                        className="text-slate-800 focus:ring-0"
                      />
                      <span className="text-xs text-slate-800">{font.name}</span>
                    </div>
                    {fontStyle === font.id && <Check className="w-4 h-4 text-slate-800" />}
                  </label>
                ))}
              </div>
            </div>

            {/* Slogan / Tagline */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                দোকানের স্লোগান বা ট্যাগলাইন (Store Slogan)
              </label>
              <input
                type="text"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="উদাঃ খাঁটি ও প্রিমিয়াম পণ্যের বিশ্বস্ত প্রতিষ্ঠান"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Announcement Banner */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-slate-500" />
                অ্যানাউন্সমেন্ট বা অফার নোটিশ (Announcement Bar)
              </label>
              <textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                rows={2}
                placeholder="উদাঃ ⚡ বিশেষ ছাড়! ১,০০০ টাকার অর্ডারে ফ্রি ডেলিভারি পেতে ব্যবহার করুন 'FREESHIP' কোড।"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              />
            </div>

            {/* Store Banner URL */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                ব্যানার ইমেজ লিংক (Hero Banner Image URL)
              </label>
              <input
                type="text"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://... (ইমেজ লিংক)"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-[11px]"
              />
              <p className="text-[11px] text-slate-500 mt-1">উচ্চমানের ল্যান্ডস্কেপ ব্যানার ইমেজ (অনুপাত ১৬:৯ বা ৩:১) দিন।</p>
            </div>
          </div>

          {/* Footer Action */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition-opacity hover:opacity-90 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'পরিবর্তন সংরক্ষণ করুন'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
