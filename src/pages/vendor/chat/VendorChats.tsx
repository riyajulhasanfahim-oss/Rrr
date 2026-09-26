import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { rtdbSubscribe } from '../../../lib/rtdb';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ArrowLeft, Search, Filter } from 'lucide-react';
import VendorLayout from "../../../components/layout/VendorLayout";

export default function VendorChats() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    if (!user) return;
    const vendorKeys = new Set([
      user.uid,
      (userData as any)?.vendorId,
      (userData as any)?.storeId,
      (userData as any)?.id
    ].filter(Boolean));

    const unsubscribe = rtdbSubscribe<any>('chats', (snap) => {
      if (snap) {
        const data: any[] = [];
        Object.keys(snap).forEach(id => {
          const item = snap[id];
          if (item && (vendorKeys.has(item.vendorId) || vendorKeys.has(item.storeId))) {
            data.push({ id, ...item });
          }
        });
        data.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        setChats(data);
      } else {
        setChats([]);
      }
      setLoading(false);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, userData]);
  
  const filteredChats = chats.filter(chat => {
    if (showUnreadOnly && (!chat.unreadCountVendor || chat.unreadCountVendor === 0)) return false;
    if (searchQuery && !chat.customerName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <VendorLayout>
      <div className="flex-grow">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary-main" />
              <span>Customer Messages</span>
            </h1>
          </div>
          
          <div className="bg-white rounded-2xl p-2.5 sm:p-4 shadow-sm border border-slate-100 mb-3 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search customers..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-main/20 text-slate-900"
              />
            </div>
            <button 
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`px-3 py-1.5 border rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${showUnreadOnly ? 'bg-primary-main text-white border-primary-main' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            >
              <Filter className="w-3.5 h-3.5" /> Unread Only
            </button>
          </div>
          
          {loading ? (
             <div className="animate-pulse space-y-2">
               {[1,2,3].map(i => <div key={i} className="h-14 bg-white border border-slate-100 rounded-xl"></div>)}
             </div>
          ) : filteredChats.length === 0 ? (
             <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-slate-100 shadow-sm">
               <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300 mx-auto mb-2" />
               <h2 className="text-sm sm:text-base font-bold text-slate-800 mb-1">No Messages Found</h2>
               <p className="text-xs text-slate-500">You don't have any messages matching your criteria.</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
               {filteredChats.map(chat => (
                 <div key={chat.id} onClick={() => navigate(`/vendor/chat/${chat.customerId}`)} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:border-sky-200 hover:shadow-md transition-all flex items-center gap-2.5">
                   <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 font-bold text-base shrink-0">
                     {chat.customerName?.[0] || 'C'}
                   </div>
                   <div className="flex-grow min-w-0">
                     <div className="flex justify-between items-start">
                       <h3 className="font-bold text-slate-900 truncate text-xs sm:text-sm">{chat.customerName || 'Customer'}</h3>
                       <span className="text-[10px] text-slate-400 whitespace-nowrap ml-1">
                         {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleDateString() : ''}
                       </span>
                     </div>
                     <p className={`text-xs truncate ${chat.unreadCountVendor > 0 ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>{chat.lastMessage || 'Sent an image'}</p>
                   </div>
                   {chat.unreadCountVendor > 0 && (
                     <span className="bg-primary-main text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                       {chat.unreadCountVendor}
                     </span>
                   )}
                 </div>
               ))}
             </div>
          )}
      </div>
    </VendorLayout>
  );
}
