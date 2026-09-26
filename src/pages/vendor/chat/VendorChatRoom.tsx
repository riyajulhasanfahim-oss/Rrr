import React, { useState, useEffect, useRef } from 'react';
import Header from '../../../components/layout/Header';
import { useAuth } from '../../../context/AuthContext';
import { rtdbGet, rtdbSet, rtdbUpdate, rtdbPush, rtdbSubscribe, rtdbRemove } from '../../../lib/rtdb';
import { useNavigate, useParams } from 'react-router-dom';
import { Send, Image as ImageIcon, ArrowLeft, Loader2, Check, CheckCheck, Trash2, X, ZoomIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { StorageManager } from '../../../services/storage/StorageManager';
import ImageLightboxModal from '../../../components/common/ImageLightboxModal';

export default function VendorChatRoom() {
  const { customerId } = useParams<{ customerId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState('Customer');
  const [newMessage, setNewMessage] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Messenger-style photo attachment
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string; uploadedUrl: string | null } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedMessageForAction, setSelectedMessageForAction] = useState<any | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const startPress = (msg: any) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(40);
        }
      } catch {}
      setSelectedMessageForAction(msg);
    }, 500);
  };

  const cancelPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!longPressTimerRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      cancelPress();
    }
  };

  const handleDeleteMessage = async (msgToDelete?: any) => {
    const targetMsg = msgToDelete || selectedMessageForAction;
    if (!targetMsg || !chatId) return;

    try {
      setDeletingMessageId(targetMsg.id);
      await rtdbRemove(`chats/${chatId}/messages/${targetMsg.id}`);

      // Optimistically update local message list
      const updatedMessages = messages.filter(m => m.id !== targetMsg.id);
      setMessages(updatedMessages);

      // If this was the last message, update the chat header's lastMessage
      if (updatedMessages.length > 0) {
        const lastMsg = updatedMessages[updatedMessages.length - 1];
        await rtdbUpdate(`chats/${chatId}`, {
          lastMessage: lastMsg.imageUrl ? 'Sent an image' : (lastMsg.text || ''),
          lastMessageTime: lastMsg.createdAt || Date.now()
        }).catch(() => {});
      } else {
        await rtdbUpdate(`chats/${chatId}`, {
          lastMessage: '',
          lastMessageTime: Date.now()
        }).catch(() => {});
      }

      toast.success('মেসেজটি মুছে ফেলা হয়েছে');
      setSelectedMessageForAction(null);
    } catch (err) {
      console.error('Failed to delete message:', err);
      toast.error('মেসেজ মুছে ফেলা যায়নি');
    } finally {
      setDeletingMessageId(null);
    }
  };
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!user || !customerId) return;

    const chatDocId = `${customerId}_${user.uid}`;
    setChatId(chatDocId);
    
    // Fetch chat doc to get customer name from RTDB
    const fetchChatDoc = async () => {
       const chatData = await rtdbGet<any>(`chats/${chatDocId}`);
       if (chatData) {
         setCustomerName(chatData.customerName || 'Customer');
       }
    };
    fetchChatDoc();
    rtdbUpdate(`chats/${chatDocId}`, { unreadCountVendor: 0 }).catch(() => {});

    const unsubscribe = rtdbSubscribe<any>(`chats/${chatDocId}/messages`, (snap) => {
      if (snap) {
        const data = Object.keys(snap).map(key => ({ id: key, ...snap[key] }));
        data.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        setMessages(data);
        
        // Mark unread messages from customer as read
        const unread = data.filter(d => !d.read && d.senderId === customerId);
        if (unread.length > 0) {
          unread.forEach(d => {
            rtdbUpdate(`chats/${chatDocId}/messages/${d.id}`, { read: true });
          });
        }
        rtdbUpdate(`chats/${chatDocId}`, { unreadCountVendor: 0 }).catch(() => {});
      } else {
        setMessages([]);
      }
      setLoading(false);
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, customerId]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('ছবিটি ২৫MB এর বেশি হতে পারবে না (Max 25MB allowed)');
      return;
    }

    const preview = URL.createObjectURL(file);
    setPendingImage({ file, previewUrl: preview, uploadedUrl: null });
    setUploadingImage(true);

    try {
      const stored = await StorageManager.uploadProductImage(file, { userId: user?.uid });
      if (stored?.fileUrl) {
        setPendingImage(prev => prev ? { ...prev, uploadedUrl: stored.fileUrl } : null);
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      console.warn('Fallback to base64 for vendor chat image:', err);
      const base64: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      setPendingImage(prev => prev ? { ...prev, uploadedUrl: base64 } : null);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemovePendingImage = () => {
    setPendingImage(null);
    setUploadingImage(false);
  };

  const handleSend = async (e?: React.FormEvent, customImageUrl?: string) => {
    e?.preventDefault();
    if (uploadingImage) {
      toast.loading('ছবি আপলোড হচ্ছে, দয়া করে অপেক্ষা করুন...', { duration: 1500 });
      return;
    }

    const text = newMessage.trim();
    const finalImageUrl = customImageUrl || pendingImage?.uploadedUrl || undefined;

    if ((!text && !finalImageUrl) || !user || !customerId || !chatId) return;
    
    try {
      setSending(true);
      setNewMessage('');
      setPendingImage(null);
      
      const chatData = await rtdbGet<any>(`chats/${chatId}`);
      
      const payload = {
        lastMessage: finalImageUrl ? 'Sent an image' : text,
        lastMessageTime: Date.now(),
        unreadCountCustomer: chatData ? (chatData.unreadCountCustomer || 0) + 1 : 1
      };
      
      await rtdbUpdate(`chats/${chatId}`, payload);
      
      await rtdbPush(`chats/${chatId}/messages`, {
        senderId: user.uid,
        text: text,
        imageUrl: finalImageUrl || null,
        createdAt: Date.now(),
        read: false
      });
      
    } catch (err) {
      console.error(err);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Show website header on desktop only */}
      <div className="hidden md:block shrink-0">
        <Header />
      </div>

      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full bg-white sm:border-x sm:border-slate-200 overflow-hidden relative shadow-xs">
        
        {/* Compact Mobile-Friendly Chat Header */}
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-white z-10 shrink-0 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <button 
              onClick={() => navigate(-1)} 
              className="p-1.5 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 rounded-full transition-colors shrink-0"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold shrink-0 border border-amber-200">
                <span className="text-xs sm:text-sm">{customerName[0]?.toUpperCase() || 'C'}</span>
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                  {customerName}
                </h2>
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 font-medium">
                  <span>Customer</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-2.5 sm:space-y-3 bg-slate-50/70">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-primary-main" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs sm:text-sm">
              <p>No messages yet.</p>
            </div>
          ) : (
            messages.map(msg => {
              const isMine = msg.senderId === user?.uid;
              const isSelected = selectedMessageForAction?.id === msg.id;
              return (
                <div 
                  key={msg.id} 
                  className={`flex items-center gap-1.5 group ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Quick delete icon on hover for vendor's own message */}
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => setSelectedMessageForAction(msg)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 rounded-full transition-opacity cursor-pointer shrink-0"
                      title="মুছে ফেলতে চাপ দিয়ে ধরুন বা ক্লিক করুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div 
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedMessageForAction(msg);
                    }}
                    onTouchStart={(e) => {
                      if (e.touches[0]) {
                        touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                      }
                      startPress(msg);
                    }}
                    onTouchEnd={cancelPress}
                    onTouchMove={handleTouchMove}
                    onMouseDown={() => startPress(msg)}
                    onMouseUp={cancelPress}
                    onMouseLeave={cancelPress}
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm select-none cursor-pointer transition-all duration-150 ${
                      isSelected ? 'ring-2 ring-red-400 ring-offset-2 scale-[0.98]' : ''
                    } ${
                      isMine 
                        ? 'bg-primary-main text-white rounded-tr-xs shadow-xs' 
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-xs'
                    }`}
                  >
                    {msg.imageUrl && (
                      <div 
                        onClick={(e) => { e.stopPropagation(); setLightboxImage(msg.imageUrl); }}
                        className="group/img relative cursor-pointer overflow-hidden rounded-lg mb-1.5"
                        title="ছবিটি বড় করে দেখতে ক্লিক করুন"
                      >
                        <img 
                          referrerPolicy="no-referrer" 
                          src={msg.imageUrl} 
                          alt="Attachment" 
                          className="max-w-full max-h-48 sm:max-h-60 object-contain rounded-lg group-hover/img:scale-102 transition-transform duration-150" 
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/25 flex items-center justify-center transition-colors">
                          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-xs" />
                        </div>
                      </div>
                    )}
                    {msg.text && <p className="leading-relaxed break-words">{msg.text}</p>}
                    <div className={`text-[9px] sm:text-[10px] flex items-center gap-1 mt-0.5 justify-end ${isMine ? 'text-sky-200' : 'text-slate-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMine && (msg.read ? <CheckCheck className="w-3 h-3 text-sky-200" /> : <Check className="w-3 h-3" />)}
                    </div>
                  </div>

                  {/* Quick delete icon on hover for customer message */}
                  {!isMine && (
                    <button
                      type="button"
                      onClick={() => setSelectedMessageForAction(msg)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 rounded-full transition-opacity cursor-pointer shrink-0"
                      title="মুছে ফেলতে চাপ দিয়ে ধরুন বা ক্লিক করুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Compact, Always-Visible Input Area */}
        <div className="p-2 sm:p-2.5 bg-white border-t border-slate-200 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {/* Messenger-style Image Attachment Preview */}
          {pendingImage && (
            <div className="mb-2 p-2 bg-slate-100/90 rounded-xl border border-slate-200 flex items-center gap-3 relative animate-in fade-in duration-150">
              <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-300 bg-white shrink-0">
                <img
                  src={pendingImage.previewUrl}
                  alt="Selected attachment"
                  className="w-full h-full object-cover"
                />
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {pendingImage.file.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {uploadingImage ? 'ছবি আপলোড হচ্ছে...' : 'ছবি প্রস্তুত (Send এ ক্লিক করুন)'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemovePendingImage}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                title="বাতিল করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Hidden File Input for Messenger-style fast photo picker */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          <form onSubmit={handleSend} className="flex items-center gap-1.5 sm:gap-2">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()} 
              className={`p-2 sm:p-2.5 rounded-xl transition-colors shrink-0 border border-slate-200 flex items-center justify-center cursor-pointer ${
                pendingImage 
                  ? 'text-primary-main bg-sky-50 border-sky-300' 
                  : 'text-slate-500 hover:text-primary-main hover:bg-sky-50 active:bg-sky-100'
              }`}
              title="ছবি নির্বাচন করুন (Attach Image)"
            >
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <input 
              type="text" 
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type a reply..." 
              className="flex-grow px-3 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1.5 focus:ring-primary-main/30 focus:border-primary-main text-xs sm:text-sm text-slate-900 placeholder:text-slate-400"
            />
            <button 
              type="submit" 
              disabled={sending || uploadingImage || (!newMessage.trim() && !pendingImage?.uploadedUrl)}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-primary-main text-white rounded-xl hover:bg-sky-600 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center shadow-xs font-semibold text-xs sm:text-sm gap-1"
              title="Send Reply"
            >
              {sending || uploadingImage ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Delete Message Confirmation Modal (চাপ দিয়ে ধরলে কাটার অপশন) */}
        {selectedMessageForAction && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setSelectedMessageForAction(null)}
          >
            <div 
              className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-slate-100 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">মেসেজ মুছে ফেলুন</h3>
                  <p className="text-xs text-slate-500">আপনি কি এই চ্যাট মেসেজটি মুছে ফেলতে চান?</p>
                </div>
              </div>

              {/* Message preview snippet */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-700 max-h-24 overflow-y-auto mb-4">
                {selectedMessageForAction.imageUrl ? (
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <ImageIcon className="w-3.5 h-3.5 text-primary-main" />
                    <span>[ছবি মেসেজ]</span>
                  </span>
                ) : (
                  <span className="line-clamp-3">{selectedMessageForAction.text || 'মেসেজ'}</span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMessageForAction(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={deletingMessageId === selectedMessageForAction.id}
                  onClick={() => handleDeleteMessage()}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {deletingMessageId === selectedMessageForAction.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>মুছে ফেলুন</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox Modal for Chat Images */}
        <ImageLightboxModal
          isOpen={!!lightboxImage}
          imageUrl={lightboxImage}
          onClose={() => setLightboxImage(null)}
          title="চ্যাট ছবি (Chat Photo)"
        />

      </div>
    </div>
  );
}
