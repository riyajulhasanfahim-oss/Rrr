import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../../../components/layout/Header';
import Footer from '../../../components/layout/Footer';
import {
  SupportMessage,
  getThreadId,
  sendUserSupportMessage,
  subscribeToThreadMessages,
  markThreadReadByUser
} from '../../../services/supportChatService';
import { StorageManager } from '../../../services/storage/StorageManager';
import ImageLightboxModal from '../../../components/common/ImageLightboxModal';
import {
  Briefcase,
  Headset,
  Phone,
  ArrowLeft,
  Send,
  Image as ImageIcon,
  Loader2,
  X,
  ZoomIn,
  CheckCheck,
  Check,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ResellerSupport() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Photo attachment state
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string; uploadedUrl: string | null } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const HELPLINE_PHONE = '018783764577';

  const threadId = user ? getThreadId('reseller', user.uid) : null;

  useEffect(() => {
    if (!threadId || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    markThreadReadByUser('reseller', user.uid).catch(() => {});

    const unsub = subscribeToThreadMessages(threadId, (list) => {
      setMessages(list);
      setLoading(false);
    });

    return () => unsub();
  }, [threadId, user?.uid]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('ছবিটি ২৫MB এর বেশি হতে পারবে না');
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
      console.warn('Fallback to base64 for reseller chat image:', err);
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

  const handleSend = async (e?: React.FormEvent, customMsg?: string) => {
    e?.preventDefault();
    if (!user) {
      toast.error('অনুগ্রহ করে লগইন করুন');
      return;
    }

    if (uploadingImage) {
      toast.loading('ছবি আপলোড হচ্ছে, দয়া করে অপেক্ষা করুন...', { duration: 1500 });
      return;
    }

    const msgToSend = customMsg !== undefined ? customMsg.trim() : text.trim();
    const finalImageUrl = pendingImage?.uploadedUrl || null;

    if (!msgToSend && !finalImageUrl) return;

    try {
      setSending(true);
      if (customMsg === undefined) {
        setText('');
      }
      setPendingImage(null);

      await sendUserSupportMessage({
        role: 'reseller',
        userId: user.uid,
        userName: userData?.name || user.displayName || 'রিসেলার পার্টনার',
        userEmail: user.email || '',
        userPhone: userData?.phone || user.phoneNumber || '',
        subject: 'রিসেলার সহায়তা ও কমিশন সংক্রান্ত',
        text: msgToSend,
        imageUrl: finalImageUrl
      });

      toast.success('মেসেজ সফলভাবে পাঠানো হয়েছে');
    } catch (err) {
      console.error('Failed to send reseller message:', err);
      toast.error('মেসেজ পাঠানো সম্ভব হয়নি');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow max-w-4xl mx-auto w-full px-3 sm:px-4 py-6">
        {/* Back Link & Title */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <Link
            to="/reseller/dashboard"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ড্যাশবোর্ডে ফিরুন</span>
          </Link>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>রিসেলার হেল্পলাইন ও সাপোর্ট</span>
          </span>
        </div>

        {/* Live Chat Window with Admin */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[520px] sm:h-[580px] overflow-hidden">
          {/* Chat Header */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
                  <Headset className="w-5 h-5" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                  <span>RJ World অ্যাডমিন সাপোর্ট ডেস্ক</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-normal">
                    সরাসরি লাইভ
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  কমিশন, প্রত্যাহার, অর্ডার ট্র্যাকিং ও অন্যান্য বিষয়ে মেসেজ করুন
                </p>
              </div>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 bg-slate-50/50">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary-main" />
                <span className="text-xs">মেসেজ লোড হচ্ছে...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-6">
                <div className="w-12 h-12 rounded-full bg-white shadow-2xs flex items-center justify-center mb-2">
                  <Briefcase className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="text-xs font-semibold text-slate-700">রিসেলার সাপোর্ট ইনবক্সে স্বাগতম!</p>
                <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                  আপনার কমিশন, উত্তোলন বা যেকোনো সহায়তার জন্য নিচের বক্সে লিখে অ্যাডমিনকে সরাসরি মেসেজ দিন।
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSend(undefined, 'আমার রিসেলার উইথড্রয়াল পেন্ডিং রয়েছে, অনুগ্রহ করে চেক করবেন?')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    উইথড্রয়াল স্ট্যাটাস জানতে চাই
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend(undefined, 'কমিশন হিসাব সংক্রান্ত তথ্য প্রয়োজন।')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    কমিশন অনুসন্ধান
                  </button>
                </div>
              </div>
            ) : (
              messages.map(msg => {
                const isMine = msg.senderType === 'user';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5 px-1">
                      <span className="font-semibold text-slate-600">
                        {isMine ? 'আপনি' : 'এডমিন সাপোর্ট'}
                      </span>
                      <span>•</span>
                      <span>
                        {msg.createdAt
                          ? new Date(msg.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>

                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 text-xs sm:text-[13px] leading-relaxed break-words shadow-2xs ${
                        isMine
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                      }`}
                    >
                      {/* Photo Attachment if present */}
                      {msg.imageUrl && (
                        <div
                          onClick={() => setLightboxImage(msg.imageUrl || null)}
                          className="group/img relative cursor-pointer overflow-hidden rounded-xl mb-2 bg-slate-100"
                          title="বড় করে দেখতে ক্লিক করুন"
                        >
                          <img
                            src={msg.imageUrl}
                            alt="Attachment"
                            referrerPolicy="no-referrer"
                            className="max-h-56 max-w-full object-contain rounded-xl group-hover/img:scale-102 transition-transform duration-150"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/25 flex items-center justify-center transition-colors">
                            <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-xs" />
                          </div>
                        </div>
                      )}

                      {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending Photo Preview */}
          {pendingImage && (
            <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex items-center gap-3 relative">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300 bg-white shrink-0">
                <img
                  src={pendingImage.previewUrl}
                  alt="Attachment preview"
                  className="w-full h-full object-cover"
                />
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {pendingImage.file.name}
                </p>
                <p className="text-[10px] text-slate-500">
                  {uploadingImage ? 'ছবি আপলোড হচ্ছে...' : 'ছবি প্রস্তুত (পাঠাতে Send চাপুন)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {/* Input Form */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`p-2 rounded-xl border border-slate-200 transition-colors flex items-center justify-center cursor-pointer ${
                  pendingImage
                    ? 'text-emerald-600 bg-emerald-50 border-emerald-300'
                    : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                }`}
                title="স্ক্রিনশট বা ছবি সংযুক্ত করুন"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="এখানে আপনার মেসেজ লিখুন..."
                className="flex-1 px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 outline-none transition-all"
              />

              <button
                type="submit"
                disabled={sending || uploadingImage || (!text.trim() && !pendingImage?.uploadedUrl)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-emerald-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
              >
                {sending || uploadingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">পাঠান</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Lightbox for zooming photos */}
      <ImageLightboxModal
        isOpen={!!lightboxImage}
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
        title="সাপোর্ট ছবি"
      />

      <Footer />
    </div>
  );
}
