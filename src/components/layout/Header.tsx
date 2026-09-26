import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User as UserIcon, Menu, X, MapPin, Globe, Heart, LogOut, Bell, Check, ChevronDown } from 'lucide-react';
import { rtdbSubscribe } from '../../lib/rtdb';
import { useLanguage } from '../common/LanguageProvider';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useWishlist } from '../../contexts/WishlistContext';
import { useNotifications } from '../../context/NotificationContext';
import NotificationBox from '../notifications/NotificationBox';
import LocationSelectionModal, { LocationItem } from '../common/LocationSelectionModal';
import { BANGLADESH_DISTRICTS } from '../../data/bangladeshDistricts';
import { motion, AnimatePresence } from 'motion/react';
import ProfessionalSearch from './ProfessionalSearch';
import toast from 'react-hot-toast';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isMobileLangMenuOpen, setIsMobileLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const mobileLangMenuRef = useRef<HTMLDivElement>(null);

  const { language, setLanguage, t } = useLanguage();
  const { user, userData, logout, isAdmin } = useAuth();
  const { itemCount } = useCart();
  const { items: wishlistItems } = useWishlist();
  const { unreadCount } = useNotifications();
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rj_user_location') || 'Dhaka';
    }
    return 'Dhaka';
  });

  useEffect(() => {
    const handleLocationEvent = (e: any) => {
      if (e?.detail?.id) {
        setSelectedLocation(e.detail.id);
      }
    };
    window.addEventListener('rj-location-changed', handleLocationEvent);
    return () => window.removeEventListener('rj-location-changed', handleLocationEvent);
  }, []);

  const displayedLocationName = useMemo(() => {
    const locId = selectedLocation || 'Dhaka';
    const district = BANGLADESH_DISTRICTS.find(d => d.id.toLowerCase() === locId.toLowerCase());
    if (district) {
      if (language === 'bn') {
        const bnMatch = district.name.match(/\((.*?)\)/);
        return bnMatch ? bnMatch[1].trim() : district.id;
      }
      return district.name.split(' (')[0].trim() || district.id;
    }
    return t(locId);
  }, [selectedLocation, language, t]);

  const handleSelectLocation = (location: LocationItem) => {
    setSelectedLocation(location.id);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('rj_user_location', location.id);
        localStorage.setItem('rj_user_location_data', JSON.stringify(location));
        window.dispatchEvent(new CustomEvent('rj-location-changed', { detail: location }));
      } catch (e) {}
    }
    toast.success(
      language === 'bn'
        ? `লোকেশন নির্বাচন করা হয়েছে: ${location.bn}`
        : `Location set to: ${location.en}`
    );
  };

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setIsLangMenuOpen(false);
      }
      if (mobileLangMenuRef.current && !mobileLangMenuRef.current.contains(e.target as Node)) {
        setIsMobileLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = rtdbSubscribe<any>('chats', (snap) => {
      let count = 0;
      if (snap) {
        const isVendor = String(userData?.role || '').toLowerCase() === 'vendor';
        Object.keys(snap).forEach(key => {
          const data = snap[key];
          if (!data) return;
          if (isVendor && data.vendorId === user.uid) {
            count += Number(data.unreadCountVendor) || 0;
          } else if (!isVendor && (data.customerId === user.uid || data.userId === user.uid)) {
            count += Number(data.unreadCountCustomer) || 0;
          }
        });
      }
      setChatUnreadCount(count);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, userData?.role]);
  const navigate = useNavigate();

  const wishlistCount = wishlistItems.length;

  const handleSelectLanguage = (lang: 'en' | 'bn') => {
    setLanguage(lang);
    setIsLangMenuOpen(false);
    setIsMobileLangMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setIsMobileMenuOpen(false);
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-12">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2 group">
              <span className="text-lg sm:text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary-main to-sky-600 tracking-tight">
                RJ WORLD BD
              </span>
              <div className="relative flex items-center justify-center ml-0.5">
                <img 
                  referrerPolicy="no-referrer"
                  src="https://i.postimg.cc/02BC9ZMs/file-00000000c36881fa822edc96c75d817a.png" 
                  alt="RJ WORLD BD Logo"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                  className="w-[28px] h-[28px] md:w-[36px] md:h-[36px] object-contain relative z-10"
                />
              </div>
            </Link>
          </div>

          {/* Search Box - Desktop */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-8">
            <ProfessionalSearch className="w-full" placeholder={t('Search products...')} />
          </div>

          {/* Right Actions */}
          <div className="hidden md:flex items-center space-x-6">
            {/* Desktop Location Selector */}
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="flex items-center text-slate-600 hover:text-primary-main cursor-pointer transition-colors px-1 py-1 rounded group"
              title={language === 'bn' ? 'লোকেশন নির্বাচন করুন' : 'Select Location'}
            >
              <MapPin className="h-5 w-5 mr-1 text-slate-500 group-hover:text-primary-main transition-colors" />
              <span className="text-sm font-medium">{displayedLocationName}</span>
            </button>
            
            {/* Language Selector Dropdown */}
            <div className="relative" ref={langMenuRef}>
              <button 
                type="button"
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center text-slate-600 hover:text-primary-main transition-colors px-1 py-1 rounded cursor-pointer group"
                title={language === 'bn' ? 'ভাষা নির্বাচন করুন' : 'Select Language'}
              >
                <Globe className="h-5 w-5 mr-1 text-slate-500 group-hover:text-primary-main transition-colors" />
                <span className="text-sm font-semibold tracking-wide uppercase">{language === 'bn' ? 'BN' : 'EN'}</span>
                <ChevronDown className={`h-3.5 w-3.5 ml-0.5 text-slate-400 transition-transform duration-200 ${isLangMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isLangMenuOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50 animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('en')}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      language === 'en'
                        ? 'text-primary-main bg-sky-50 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>English</span>
                    {language === 'en' && <Check className="w-3.5 h-3.5 text-primary-main" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('bn')}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      language === 'bn'
                        ? 'text-primary-main bg-sky-50 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>বাংলা</span>
                    {language === 'bn' && <Check className="w-3.5 h-3.5 text-primary-main" />}
                  </button>
                </div>
              )}
            </div>

            {/* Notification Bell (Directly to the left of Wishlist) */}
            {user && (
              <div className="relative">
                <button 
                  type="button"
                  data-notification-trigger="true"
                  onClick={() => setIsNotificationOpen(prev => !prev)}
                  className="relative p-1.5 text-slate-600 hover:text-primary-main hover:bg-slate-100 rounded-full transition-colors flex items-center justify-center cursor-pointer"
                  title={t('Notifications')}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow-xs animate-pulse">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                {isDesktop && (
                  <NotificationBox
                    isOpen={isNotificationOpen}
                    onClose={() => setIsNotificationOpen(false)}
                  />
                )}
              </div>
            )}

            <Link to="/wishlist" className="relative text-slate-600 hover:text-primary-main transition-colors">
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary-main text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <Link to="/cart" className="relative text-slate-600 hover:text-primary-main transition-colors">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-secondary-main text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
                  {itemCount}
                </span>
              )}
            </Link>

            {user ? (
              <div className="flex items-center space-x-3 sm:space-x-4">
                {isAdmin && (
                  <Link to="/admin/dashboard" className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors">
                    {t('Admin Panel')}
                  </Link>
                )}
                <Link to="/orders" className="flex items-center text-slate-600 hover:text-primary-main transition-colors">
                  <span className="text-sm font-medium">{t('Orders')}</span>
                </Link>
                <Link to={(userData?.role === 'Vendor' && userData?.hasActiveVendor) ? '/vendor-dashboard' : (userData?.role === 'Reseller' && userData?.hasActiveReseller) ? '/reseller/dashboard' : '/dashboard'} className="flex items-center text-slate-600 hover:text-primary-main transition-colors">
                  <UserIcon className="h-5 w-5 mr-1" />
                  <span className="text-sm font-medium">{userData?.name?.split(' ')[0] || t('Account')}</span>
                </Link>
                <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer" title={t('Logout')}>
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <Link to="/login" className="px-4 py-2 text-sm font-medium text-white bg-primary-main hover:bg-sky-600 rounded-full transition-colors shadow-sm">
                {t('Sign In')}
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden space-x-3">
            {user && (
              <div className="relative">
                <button 
                  type="button" 
                  data-notification-trigger="true"
                  onClick={() => setIsNotificationOpen(prev => !prev)}
                  className="relative p-1 text-slate-600 hover:text-primary-main flex items-center justify-center cursor-pointer"
                  title={t('Notifications')}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] px-0.5 flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                {!isDesktop && (
                  <NotificationBox
                    isOpen={isNotificationOpen}
                    onClose={() => setIsNotificationOpen(false)}
                  />
                )}
              </div>
            )}

            <Link to="/wishlist" className="relative text-slate-600">
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary-main text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link to="/cart" className="relative text-slate-600">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-secondary-main text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-600 hover:text-primary-main focus:outline-none"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Search Box - Mobile */}
        <div className="md:hidden pb-2">
          <ProfessionalSearch className="w-full" placeholder={t('Search products...')} />
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-slate-200"
          >
            <div className="px-4 pt-2 pb-4 space-y-1">
              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsLocationModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center text-slate-700 hover:text-primary-main transition-colors cursor-pointer group"
                  title={language === 'bn' ? 'লোকেশন নির্বাচন করুন' : 'Select Location'}
                >
                  <MapPin className="h-5 w-5 mr-2 text-primary-main group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-sm">{displayedLocationName}</span>
                </button>
                
                {/* Mobile Language Selector */}
                <div className="relative" ref={mobileLangMenuRef}>
                  <button 
                    type="button"
                    onClick={() => setIsMobileLangMenuOpen(!isMobileLangMenuOpen)} 
                    className="flex items-center text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
                  >
                    <Globe className="h-4 w-4 mr-1.5 text-primary-main" />
                    <span>{language === 'bn' ? 'বাংলা' : 'English'}</span>
                    <ChevronDown className="h-3 w-3 ml-1 text-slate-500" />
                  </button>

                  {isMobileLangMenuOpen && (
                    <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50 animate-in fade-in zoom-in-95">
                      <button
                        type="button"
                        onClick={() => handleSelectLanguage('en')}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold ${
                          language === 'en' ? 'text-primary-main bg-sky-50 font-bold' : 'text-slate-700'
                        }`}
                      >
                        <span>English</span>
                        {language === 'en' && <Check className="w-3.5 h-3.5 text-primary-main" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectLanguage('bn')}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold ${
                          language === 'bn' ? 'text-primary-main bg-sky-50 font-bold' : 'text-slate-700'
                        }`}
                      >
                        <span>বাংলা</span>
                        {language === 'bn' && <Check className="w-3.5 h-3.5 text-primary-main" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {user ? (
                <>
                  <Link 
                    to="/notifications" 
                    onClick={() => setIsMobileMenuOpen(false)} 
                    className="flex items-center justify-between py-3 text-base font-medium text-slate-900 border-b border-slate-100"
                  >
                    <div className="flex items-center">
                      <Bell className="h-5 w-5 mr-2 text-primary-main" />
                      {t('Notifications')}
                    </div>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-600 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </Link>

                  {isAdmin && (
                    <Link to="/admin/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block py-3 text-base font-bold text-slate-900 border-b border-slate-100">
                      <div className="flex items-center">
                        {t('Admin Panel')}
                      </div>
                    </Link>
                  )}
                  <Link to="/orders" onClick={() => setIsMobileMenuOpen(false)} className="block py-3 text-base font-medium text-slate-900 border-b border-slate-100">
                    <div className="flex items-center">
                      {t('Orders')}
                    </div>
                  </Link>
                  <Link to={(userData?.role === 'Vendor' && userData?.hasActiveVendor) ? '/vendor-dashboard' : (userData?.role === 'Reseller' && userData?.hasActiveReseller) ? '/reseller/dashboard' : '/dashboard'} onClick={() => setIsMobileMenuOpen(false)} className="block py-3 text-base font-medium text-slate-900 border-b border-slate-100">
                    <div className="flex items-center">
                      <UserIcon className="h-5 w-5 mr-2" />
                      {t('Dashboard')}
                    </div>
                  </Link>
                  <button onClick={handleLogout} className="w-full text-left py-3 text-base font-medium text-red-600 cursor-pointer">
                    <div className="flex items-center">
                      <LogOut className="h-5 w-5 mr-2" />
                      {t('Logout')}
                    </div>
                  </button>
                </>
              ) : (
                <div className="pt-4 space-y-2">
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-center px-4 py-2 text-base font-medium text-primary-main bg-primary-main/10 rounded-lg">
                    {t('Sign In')}
                  </Link>
                  <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-center px-4 py-2 text-base font-medium text-white bg-primary-main rounded-lg">
                    {t('Create Account')}
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Selection Modal */}
      {isLocationModalOpen && (
        <LocationSelectionModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          selectedLocationId={selectedLocation}
          onSelectLocation={handleSelectLocation}
        />
      )}
    </header>
  );
}
