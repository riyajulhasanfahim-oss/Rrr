import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useVendorStore } from '../../context/VendorStoreContext';
import { useVendorNotifications } from '../../context/VendorNotificationContext';
import VendorNotificationDropdown from '../vendor/VendorNotificationDropdown';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  ArchiveRestore, 
  Users, 
  Wallet, 
  Banknote, MessageSquare, 
  Store, 
  Bell, 
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Star,
  Receipt
} from 'lucide-react';
import { getVendorOpenUrl } from '../../utils/subdomain';

interface VendorLayoutProps {
  children: React.ReactNode;
}

export default function VendorLayout({ children }: VendorLayoutProps) {
  const { userData, logout } = useAuth();
  const { vendorInfo } = useVendorStore();
  const { 
    unreadOrdersCount, 
    unreadMessagesCount, 
    unreadReviewsCount, 
    unreadNotificationsCount,
    totalUnreadCount 
  } = useVendorNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/vendor-dashboard', icon: LayoutDashboard },
    { name: 'Products', path: '/vendor/products', icon: Package },
    { name: 'Orders', path: '/vendor/orders', icon: ShoppingCart },
    { name: 'Reviews', path: '/vendor/reviews', icon: Star },
    { name: 'Inventory', path: '/vendor/inventory', icon: ArchiveRestore },
    { name: 'Customers', path: '/vendor/customers', icon: Users },
    { name: 'Messages', path: '/vendor/messages', icon: MessageSquare },
    { name: 'Wallet', path: '/vendor/wallet', icon: Wallet },
    { name: 'Platform Fee', path: '/vendor/platform-fee', icon: Receipt },
    { name: 'Withdraw', path: '/vendor/withdraw', icon: Banknote },
    { name: 'Shop Profile', path: '/vendor/profile', icon: Store },
    { name: 'Notifications', path: '/vendor/notifications', icon: Bell },
    { name: 'Settings', path: '/vendor/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50  flex font-sans text-gray-900 ">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:sticky top-0 h-screen z-50 bg-white border-r border-gray-200 transition-all duration-300 flex flex-col shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${sidebarCollapsed ? 'w-20' : 'w-64'}
        `}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {!sidebarCollapsed && (
            <Link to="/vendor-dashboard" className="flex items-center gap-2 text-xl font-bold text-primary-main truncate">
              {vendorInfo?.logo || vendorInfo?.shopLogo ? (
                <img 
                  referrerPolicy="no-referrer"
                  src={vendorInfo.logo || vendorInfo.shopLogo} 
                  alt="" 
                  className="w-7 h-7 rounded-lg object-cover border border-gray-200 shrink-0" 
                />
              ) : null}
              <span className="truncate">{vendorInfo?.shopName || vendorInfo?.storeName || 'Vendor Portal'}</span>
            </Link>
          )}
          {sidebarCollapsed && (
            <Link to="/vendor-dashboard" className="mx-auto text-xl font-bold text-primary-main flex items-center justify-center">
              {vendorInfo?.logo || vendorInfo?.shopLogo ? (
                <img 
                  referrerPolicy="no-referrer"
                  src={vendorInfo.logo || vendorInfo.shopLogo} 
                  alt="" 
                  className="w-8 h-8 rounded-lg object-cover shrink-0" 
                />
              ) : (
                <span>{(vendorInfo?.shopName || vendorInfo?.storeName || userData?.name || 'V').charAt(0).toUpperCase()}</span>
              )}
            </Link>
          )}
          <button 
            className="hidden lg:inline-flex text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
          <button 
            className="lg:hidden text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
          <nav className="space-y-1 px-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(`${item.path}`));
              const Icon = item.icon;

              let badgeCount = 0;
              let badgeColor = 'bg-blue-600';
              if (item.name === 'Orders') {
                badgeCount = unreadOrdersCount;
                badgeColor = 'bg-blue-600';
              } else if (item.name === 'Messages') {
                badgeCount = unreadMessagesCount;
                badgeColor = 'bg-red-500';
              } else if (item.name === 'Reviews') {
                badgeCount = unreadReviewsCount;
                badgeColor = 'bg-amber-500';
              } else if (item.name === 'Notifications') {
                badgeCount = unreadNotificationsCount || totalUnreadCount;
                badgeColor = 'bg-cyan-600';
              }

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center px-3 py-2.5 rounded-xl font-medium transition-colors group relative ${
                    isActive 
                      ? 'bg-primary-main/10 text-primary-main font-semibold' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={sidebarCollapsed ? `${item.name}${badgeCount > 0 ? ` (${badgeCount})` : ''}` : undefined}
                >
                  <div className="relative flex-shrink-0">
                    <Icon className={`w-5 h-5 ${sidebarCollapsed ? 'mx-auto' : 'mr-3'} ${isActive ? 'text-primary-main' : 'text-gray-400 group-hover:text-primary-main'}`} />
                    {sidebarCollapsed && badgeCount > 0 && (
                      <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${badgeColor} ring-2 ring-white`} />
                    )}
                  </div>
                  {!sidebarCollapsed && <span className="flex-1">{item.name}</span>}
                  {!sidebarCollapsed && badgeCount > 0 && (
                    <span className={`${badgeColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto animate-pulse`}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className={`flex items-center px-3 py-2.5 rounded-xl font-medium text-red-600 hover:bg-red-50 transition-colors w-full ${sidebarCollapsed ? 'justify-center' : ''}`}
            title={sidebarCollapsed ? 'Logout' : undefined}
          >
            <LogOut className={`w-5 h-5 flex-shrink-0 ${sidebarCollapsed ? '' : 'mr-3'}`} />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 sm:h-16 bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-6 sticky top-0 z-30">
          <div className="flex items-center">
            <button
              className="lg:hidden text-gray-500 hover:text-gray-700 mr-2.5 sm:mr-4 p-1 rounded-lg hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} className="sm:w-6 sm:h-6" />
            </button>
            <h1 className="text-base sm:text-xl font-bold text-gray-900 truncate">
              {navItems.find(item => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(`${item.path}`)))?.name || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
             <VendorNotificationDropdown />
             <a 
               href={vendorInfo?.freeShopDomain ? getVendorOpenUrl(vendorInfo.freeShopDomain, userData?.uid) : (userData?.uid ? `/store/${userData.uid}` : '/')}
               target="_blank"
               rel="noopener noreferrer"
               className="text-xs sm:text-sm font-medium text-primary-main hover:underline hidden sm:inline-block cursor-pointer"
             >
               View Store
             </a>
             <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary-main text-white flex items-center justify-center font-bold text-xs sm:text-sm overflow-hidden border border-gray-200">
               {vendorInfo?.logo || vendorInfo?.shopLogo || vendorInfo?.profileImage ? (
                 <img 
                   referrerPolicy="no-referrer" 
                   src={vendorInfo.logo || vendorInfo.shopLogo || vendorInfo.profileImage} 
                   alt="" 
                   className="w-full h-full object-cover" 
                 />
               ) : (
                 (vendorInfo?.shopName || vendorInfo?.storeName || userData?.name || 'V').charAt(0).toUpperCase()
               )}
             </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl text-center relative">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
              <LogOut className="w-8 h-8 text-red-600 ml-1" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Logout</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to logout?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout}
                className="flex-1 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
