import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Store, ShoppingCart, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useLanguage } from '../common/LanguageProvider';
import { motion, AnimatePresence } from 'motion/react';

function TeamIcon({ className, size = 24 }: { className?: string, size?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <defs>
        <mask id="team-solid-mask">
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <circle cx="12" cy="11.5" r="4.5" fill="black" />
          <path d="M12 15.5c-3.5 0-7 1.5-7 4.5V22h14v-2c0-3-3.5-4.5-7-4.5Z" fill="black" />
        </mask>
      </defs>
      
      <g mask="url(#team-solid-mask)">
        <circle cx="6.5" cy="8" r="3.5" />
        <path d="M6.5 13C3.5 13 1 14.5 1 17.5V20h7" />
        <circle cx="17.5" cy="8" r="3.5" />
        <path d="M17.5 13c3 0 5.5 1.5 5.5 4.5V20h-7" />
      </g>
      
      <circle cx="12" cy="11.5" r="3.5" />
      <path d="M12 16.5c-3.3 0-6 1.5-6 4V22h12v-1.5c0-2.5-2.7-4-6-4Z" />
    </svg>
  );
}

const navItems = [
  { label: 'Home', icon: Home, route: '/' },
  { label: 'Reseller', icon: Users, id: 'reseller' },
  { label: 'My Store', icon: Store, id: 'vendor' },
  { label: 'Cart', icon: ShoppingCart, route: '/cart', isCart: true },
  { label: 'Profile', icon: UserIcon, id: 'profile' },
];

function NavItem({ item, isActive, route, badge }: { item: any, isActive: boolean, route: string, badge?: number }) {
  const Icon = item.icon;
  const { t } = useLanguage();
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const addRipple = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { id: Date.now(), x, y };
    
    setRipples((prev) => [...prev, newRipple]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
  };

  return (
    <Link
      to={route}
      onClick={addRipple}
      className="relative flex flex-col items-center justify-center w-full h-full group active:scale-95 transition-transform duration-200 -webkit-tap-highlight-transparent overflow-hidden rounded-xl mx-0.5"
    >
      {/* Ripple Effect */}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.div
            key={ripple.id}
            initial={{ top: ripple.y, left: ripple.x, width: 0, height: 0, opacity: 0.5 }}
            animate={{ top: ripple.y - 40, left: ripple.x - 40, width: 80, height: 80, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute bg-primary-main/30 rounded-full pointer-events-none"
          />
        ))}
      </AnimatePresence>

      {isActive && (
        <motion.div
          layoutId="bottom-nav-active"
          className="absolute inset-0 bg-primary-main/10 rounded-lg"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      
      <div className="relative z-10 flex flex-col items-center justify-center py-0.5">
        <div className="relative">
          <Icon 
            className={`w-[19px] h-[19px] transition-all duration-300 ${
              isActive 
                ? 'text-primary-main' 
                : 'text-slate-400 group-hover:text-slate-600'
            }`} 
          />
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1 -right-2 bg-secondary-main text-white text-[9px] font-bold rounded-full min-w-[15px] h-3.5 flex items-center justify-center px-0.5 border border-white shadow-2xs transition-transform duration-300">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        
        <span 
          className={`text-[9px] font-semibold mt-0.5 leading-none transition-all duration-300 ${
            isActive 
              ? 'text-primary-main' 
              : 'text-slate-400 group-hover:text-slate-600'
          }`}
        >
          {t(item.label)}
        </span>
      </div>
    </Link>
  );
}

export default function BottomNavigation() {
  const location = useLocation();
  const { user, userData, isAdmin } = useAuth();
  const { itemCount } = useCart();

  if (
    location.pathname.startsWith('/admin') || 
    location.pathname.startsWith('/product/') ||
    location.pathname.startsWith('/chat/') ||
    location.pathname.startsWith('/vendor/chat/')
  ) {
    return null;
  }

  const getRoute = (item: any) => {
    if (item.route) return item.route;
    
    if (item.id === 'reseller') {
      if (userData?.role === 'Reseller') return '/reseller/dashboard';
      return '/reseller/apply';
    }
    if (item.id === 'vendor') {
      if (userData?.role === 'Vendor' && userData?.hasActiveVendor) return '/vendor-dashboard';
      return '/become-vendor';
    }
    if (item.id === 'profile') {
      if (user) {
        if (isAdmin) return '/admin/dashboard';
        return '/dashboard';
      }
      return '/login';
    }
    return '/';
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] pb-[env(safe-area-inset-bottom)]">
      <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200/60 rounded-t-[16px] shadow-[0_-6px_25px_-12px_rgba(0,0,0,0.1)] relative max-w-7xl mx-auto">
          
          <div className="flex justify-between items-center h-[50px] px-1 md:px-8">
            {navItems.map((item) => {
              const route = getRoute(item);
              const isActive = location.pathname === route;
              const badge = item.isCart ? itemCount : undefined;

              return (
                <NavItem 
                  key={item.label} 
                  item={item} 
                  isActive={isActive} 
                  route={route}
                  badge={badge} 
                />
              );
            })}
          </div>
        </div>
      </div>
  );
}
