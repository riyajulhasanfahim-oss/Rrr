import React, { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { useAuth } from '../../context/AuthContext';
import { rtdbSubscribe } from '../../lib/rtdb';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ArrowLeft } from 'lucide-react';

export default function MyChats() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = rtdbSubscribe<any>('chats', (snap) => {
      if (snap) {
        const data: any[] = [];
        Object.keys(snap).forEach(id => {
          const item = snap[id];
          if (item && item.customerId === user.uid) {
            data.push({ id, ...item });
          }
        });
        data.sort((a, b) => (Number(b.lastMessageTime) || 0) - (Number(a.lastMessageTime) || 0));
        setChats(data);
      } else {
        setChats([]);
      }
      setLoading(false);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow pt-8 pb-16 px-4 md:px-8 max-w-4xl mx-auto w-full">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">My Chats</h1>
        
        {loading ? (
           <div className="animate-pulse space-y-4">
             {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>)}
           </div>
        ) : chats.length === 0 ? (
           <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
             <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
             <h2 className="text-xl font-bold text-slate-800 mb-2">No Conversations</h2>
             <p className="text-slate-500">You don't have any ongoing chats with sellers yet.</p>
           </div>
        ) : (
           <div className="space-y-4">
             {chats.map(chat => (
               <div key={chat.id} onClick={() => navigate(`/chat/${chat.vendorId}`)} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm cursor-pointer hover:border-sky-200 transition-all flex items-center gap-4">
                 <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center text-primary-main font-bold shrink-0">
                   {chat.vendorName?.[0] || 'V'}
                 </div>
                 <div className="flex-grow min-w-0">
                   <div className="flex justify-between items-start mb-1">
                     <h3 className="font-bold text-slate-900 truncate">{chat.vendorName || 'Vendor'}</h3>
                     <span className="text-xs text-slate-400 whitespace-nowrap ml-2">
                       {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleDateString() : ''}
                     </span>
                   </div>
                   <p className="text-sm text-slate-500 truncate">{chat.lastMessage || 'Sent an image'}</p>
                 </div>
                 {chat.unreadCountCustomer > 0 && (
                   <span className="bg-primary-main text-white text-xs font-bold px-2 py-1 rounded-full shrink-0">
                     {chat.unreadCountCustomer}
                   </span>
                 )}
               </div>
             ))}
           </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
