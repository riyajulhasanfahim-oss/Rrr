import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { fetchAllAttentionOrders } from '../../services/adminExceptionService';
import { subscribeToAdminSupportUnreadCounts } from '../../services/supportChatService';
import { subscribeToCourierReviews } from '../../services/courierReviewService';
import { subscribeToResellerProfitReviews } from '../../services/resellerProfitReviewService';
import { subscribeToResellerReturnRequests } from '../../services/resellerReturnService';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Tags,
  Store,
  LogOut,
  Menu,
  X,
  Settings,
  DollarSign,
  Image,
  FileText,
  Network,
  CreditCard,
  Wallet,
  Activity,
  BarChart2,
  ClipboardList,
  Bell,
  BadgeCheck,
  HardDrive,
  ShieldAlert,
  AlertOctagon,
  Globe,
  Inbox,
  Building2,
  Receipt,
  Truck,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

export default function AdminLayout() {
  const { logout, userData, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attentionCount, setAttentionCount] = useState<number>(0);
  const [supportUnreadCount, setSupportUnreadCount] = useState<number>(0);
  const [physicalUnreadCount, setPhysicalUnreadCount] = useState<number>(0);
  const [pendingCourierCount, setPendingCourierCount] = useState<number>(0);
  const [pendingResellerReviewsCount, setPendingResellerReviewsCount] = useState<number>(0);
  const [pendingResellerReturnsCount, setPendingResellerReturnsCount] = useState<number>(0);

  useEffect(() => {
    const unsubReseller = subscribeToResellerProfitReviews((items) => {
      const pendingCount = items.filter(i => i.reviewStatus === 'PENDING').length;
      setPendingResellerReviewsCount(pendingCount);
    });
    return () => unsubReseller();
  }, []);

  useEffect(() => {
    const unsubReturns = subscribeToResellerReturnRequests((items, pendingCount) => {
      setPendingResellerReturnsCount(pendingCount);
    });
    return () => unsubReturns();
  }, []);

  useEffect(() => {
    const unsub = subscribeToAdminSupportUnreadCounts((counts) => {
      setSupportUnreadCount(counts.customer + counts.vendor + counts.reseller);
      setPhysicalUnreadCount(counts.physical || 0);
    });
    return () => unsub();
  }, []);

  const prevPendingCourierRef = useRef<number>(-1);
  useEffect(() => {
    const unsubCourier = subscribeToCourierReviews((items, pendingCount) => {
      setPendingCourierCount(pendingCount);

      // Trigger high-priority notification when a new pending review arrives
      if (prevPendingCourierRef.current !== -1 && pendingCount > prevPendingCourierRef.current) {
        const latestPending = items.find(i => i.status === 'pending');
        if (latestPending) {
          toast((t) => (
            <div className="flex items-center gap-3 p-1">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                <Truck className="w-5 h-5" />
              </div>
              <div className="text-xs min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-900">নতুন কুরিয়ার ট্র্যাকিং রিভিউ!</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">🟡 Pending</span>
                </div>
                <p className="text-slate-600 truncate mt-0.5">
                  অর্ডার #{latestPending.orderNumber || latestPending.orderId} • {latestPending.courierName}
                </p>
                <p className="text-[11px] text-slate-500">ভেন্ডর: {latestPending.vendorShopName || latestPending.vendorName || 'Vendor'}</p>
              </div>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  navigate(`/admin/courier-review?openReview=${latestPending.orderId}`);
                }}
                className="px-3 py-1.5 bg-primary-main hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs shrink-0 cursor-pointer"
              >
                রিভিউ করুন
              </button>
            </div>
          ), {
            duration: 9000,
            id: `courier-new-${latestPending.orderId}`,
            position: 'top-right'
          });
        }
      }
      prevPendingCourierRef.current = pendingCount;
    });
    return () => unsubCourier();
  }, [navigate]);

  useEffect(() => {
    async function loadCount() {
      try {
        const res = await fetchAllAttentionOrders();
        setAttentionCount(res.summaryCounts.total);
      } catch (e) {
        // ignore
      }
    }
    loadCount();
    const interval = setInterval(loadCount, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Inbox, label: 'Support Inbox', path: '/admin/support', badge: supportUnreadCount, badgeColor: 'bg-primary-500' },
    { icon: Building2, label: 'Physical Support', path: '/admin/physical-support', badge: physicalUnreadCount, badgeColor: 'bg-amber-500' },
    { icon: AlertOctagon, label: 'Requires Attention', path: '/admin/attention', badge: attentionCount, badgeColor: 'bg-rose-500' },
    { icon: Users, label: 'Users', path: '/admin/users' },
    { icon: Package, label: 'Products', path: '/admin/products' },
    { icon: DollarSign, label: 'Pricing', path: '/admin/pricing' },
    { icon: Tags, label: 'Categories', path: '/admin/categories' },
    { icon: ShoppingCart, label: 'Orders', path: '/admin/orders' },
    { icon: Truck, label: 'Courier Link Review', path: '/admin/courier-review', badge: pendingCourierCount, badgeColor: 'bg-amber-500' },
    { icon: ShieldAlert, label: 'Dispute Orders', path: '/admin/disputes' },
    { icon: Store, label: 'Vendors', path: '/admin/vendors' },
    { icon: Receipt, label: 'Platform Fee', path: '/admin/platform-fee' },
    { icon: BadgeCheck, label: 'Verified Sellers', path: '/admin/verified-sellers' },
    { icon: Users, label: 'Resellers', path: '/admin/resellers' },
    { icon: ShieldCheck, label: 'Reseller Reviews', path: '/admin/reseller-reviews', badge: pendingResellerReviewsCount, badgeColor: 'bg-amber-500' },
    { icon: RotateCcw, label: 'Reseller Returns', path: '/admin/reseller-returns', badge: pendingResellerReturnsCount, badgeColor: 'bg-rose-500' },
    { icon: Network, label: 'Leadership Management', path: '/admin/mlm' },
    { icon: CreditCard, label: 'Commissions', path: '/admin/commissions' },
    { icon: Wallet, label: 'Withdrawals', path: '/admin/withdrawals' },
    { icon: Image, label: 'Banners', path: '/admin/banners' },
    { icon: FileText, label: 'Website Content', path: '/admin/content' },
    { icon: BarChart2, label: 'Reports', path: '/admin/reports' },
    { icon: ClipboardList, label: 'Activity Logs', path: '/admin/activity-logs' },
    { icon: HardDrive, label: 'Storage Pool', path: '/admin/storage' },
    { icon: Bell, label: 'Notifications', path: '/admin/notifications' },
    { icon: Globe, label: 'Domain Settings', path: '/admin/domain-settings' },
    { icon: Settings, label: 'Settings', path: '/admin/settings' },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <Link to="/admin/dashboard" className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-primary-main">RJ</span> Admin
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-lg">
              {userData?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="font-medium text-sm truncate">{userData?.name || 'Admin'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-140px)]">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                  isActive 
                    ? 'bg-primary-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-black text-white ${item.badgeColor || 'bg-rose-600'} animate-pulse`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-md text-red-400 hover:bg-slate-800 transition-colors mt-8"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 md:px-6 z-10">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-500 hover:text-gray-900">
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex-1 md:hidden text-center font-bold text-lg">
            RJ Admin
          </div>
          
          <div className="hidden md:block font-medium text-gray-800">
            Admin Panel
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
      
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
