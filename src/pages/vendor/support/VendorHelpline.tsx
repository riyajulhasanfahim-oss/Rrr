import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { rtdbPush } from '../../../lib/rtdb';
import VendorLayout from '../../../components/layout/VendorLayout';
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
  Headset,
  Phone,
  MessageCircle,
  Mail,
  Clock,
  Send,
  HelpCircle,
  CheckCircle2,
  FileQuestion,
  ExternalLink,
  MessageSquare,
  Image as ImageIcon,
  Loader2,
  X,
  ZoomIn,
  Store,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function VendorHelpline() {
  const { user, userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'helpline'>('chat');

  // Live Chat State
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(true);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Photo attachment state
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string; uploadedUrl: string | null } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helpline Ticket Form State
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Payment Issue');
  const [message, setMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  const HELPLINE_PHONE = '018783764577';
  const HELPLINE_WHATSAPP = '018884267928';
  const HELPLINE_EMAIL = 'support@rjworldbd.com';

  const threadId = user ? getThreadId('vendor', user.uid) : null;

  // Subscribe to real-time vendor chat messages
  useEffect(() => {
    if (!threadId || !user) {
      setLoadingChat(false);
      return;
    }

    setLoadingChat(true);
    markThreadReadByUser('vendor', user.uid).catch(() => {});

    const unsub = subscribeToThreadMessages(threadId, (list) => {
      setMessages(list);
      setLoadingChat(false);
    });

    return () => unsub();
  }, [threadId, user?.uid]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0 && activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, activeTab]);

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
      console.warn('Fallback to base64 for vendor support chat image:', err);
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

  const handleSendChatMessage = async (e?: React.FormEvent, customMsg?: string) => {
    e?.preventDefault();
    if (!user) {
      toast.error('অনুগ্রহ করে লগইন করুন');
      return;
    }

    if (uploadingImage) {
      toast.loading('ছবি আপলোড হচ্ছে, দয়া করে অপেক্ষা করুন...', { duration: 1500 });
      return;
    }

    const msgToSend = customMsg !== undefined ? customMsg.trim() : chatText.trim();
    const finalImageUrl = pendingImage?.uploadedUrl || null;

    if (!msgToSend && !finalImageUrl) return;

    try {
      setSendingChat(true);
      if (customMsg === undefined) {
        setChatText('');
      }
      setPendingImage(null);

      await sendUserSupportMessage({
        role: 'vendor',
        userId: user.uid,
        userName: userData?.name || (userData as any)?.storeName || user.displayName || 'ভেন্ডর শপ',
        userEmail: user.email || '',
        userPhone: userData?.phone || user.phoneNumber || '',
        subject: 'ভেন্ডর স্টোর ও পে-আউট সহায়তা',
        text: msgToSend,
        imageUrl: finalImageUrl
      });

      toast.success('মেসেজ সফলভাবে পাঠানো হয়েছে');
    } catch (err) {
      console.error('Failed to send vendor message:', err);
      toast.error('মেসেজ পাঠানো সম্ভব হয়নি');
    } finally {
      setSendingChat(false);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!subject.trim() || !message.trim()) {
      toast.error('অনুগ্রহ করে বিষয় ও বার্তা পূরণ করুন');
      return;
    }

    setSubmittingTicket(true);
    try {
      await rtdbPush('vendor_support_tickets', {
        vendorId: user.uid,
        vendorName: userData?.name || (userData as any)?.storeName || user.displayName || 'Vendor',
        vendorEmail: user.email || '',
        vendorPhone: user.phoneNumber || userData?.phone || '',
        subject,
        category,
        message,
        status: 'open',
        createdAt: Date.now()
      });

      // Also mirror to real-time vendor thread so Admin sees it in Support Inbox
      await sendUserSupportMessage({
        role: 'vendor',
        userId: user.uid,
        userName: userData?.name || (userData as any)?.storeName || user.displayName || 'Vendor',
        userEmail: user.email || '',
        userPhone: user.phoneNumber || userData?.phone || '',
        subject: `[${category}] ${subject}`,
        text: message
      });

      setTicketSubmitted(true);
      toast.success('সাপোর্ট টিকিট জমা হয়েছে! আমাদের হেল্পলাইন টিম আপনার সাথে যোগাযোগ করবে।');
      setSubject('');
      setMessage('');
    } catch (err) {
      console.error('Ticket submission error:', err);
      toast.error('টিকিট জমা দেওয়া সম্ভব হয়নি');
    } finally {
      setSubmittingTicket(false);
    }
  };

  return (
    <VendorLayout>
      <div className="max-w-5xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Headset className="w-6 h-6 text-primary-main" />
              <span>ভেন্ডর স্টোর হেল্পলাইন ও সাপোর্ট</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              পে-আউট, পণ্য অনুমোদন, ডেলিভারি ও স্টোর ব্যবস্থাপনায় এডমিনের সাথে সার্বক্ষণিক যোগাযোগ
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-primary-main text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>এডমিন সাপোর্ট চ্যাট</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('helpline')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'helpline'
                  ? 'bg-primary-main text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Phone className="w-4 h-4" />
              <span>জরুরি হেল্পলাইন ও টিকিট</span>
            </button>
          </div>
        </div>

        {activeTab === 'chat' ? (
          /* Live Chat Box with Admin */
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[520px] sm:h-[600px] overflow-hidden">
            {/* Chat Box Header */}
            <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold border border-purple-500/30">
                    <Store className="w-5 h-5 text-purple-300" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
                </div>
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <span>RJ World এডমিন হেল্প ডেস্ক</span>
                    <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded font-normal">
                      ভেন্ডর সাপোর্ট ইনবক্স
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    আপনার যেকোনো প্রশ্ন বা সমস্যার কথা লিখে পাঠান, এডমিন সরাসরি রিপ্লাই দেবেন
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 bg-slate-50/50">
              {loadingChat ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-main" />
                  <span className="text-xs">মেসেজ লোড হচ্ছে...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-6">
                  <div className="w-12 h-12 rounded-full bg-white shadow-2xs flex items-center justify-center mb-2">
                    <MessageSquare className="w-6 h-6 text-primary-main" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">ভেন্ডর সাপোর্ট ইনবক্সে স্বাগতম!</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                    পে-আউট, স্টক অনুমোদন বা ডেলিভারি সংক্রান্ত যেকোনো বিষয়ের জন্য মেসেজ পাঠান।
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSendChatMessage(undefined, 'আমার স্টোরের উইথড্রয়াল পে-আউট পেন্ডিং রয়েছে, চেক করবেন?')}
                      className="px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-primary-main text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                    >
                      পে-আউট পেন্ডিং
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendChatMessage(undefined, 'নতুন পণ্য আপলোড করেছি, অনুমোদনের জন্য অনুরোধ।')}
                      className="px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-primary-main text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                    >
                      প্রোডাক্ট অনুমোদন
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
                          {isMine ? 'আপনি (ভেন্ডর)' : 'এডমিন সাপোর্ট'}
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
                            ? 'bg-primary-main text-white rounded-tr-none'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                        }`}
                      >
                        {/* Image Attachment if present */}
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
              <form onSubmit={handleSendChatMessage} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-xl border border-slate-200 transition-colors flex items-center justify-center cursor-pointer ${
                    pendingImage
                      ? 'text-primary-main bg-sky-50 border-sky-300'
                      : 'text-slate-500 hover:text-primary-main hover:bg-sky-50'
                  }`}
                  title="ছবি বা স্ক্রিনশট সংযুক্ত করুন"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={chatText}
                  onChange={e => setChatText(e.target.value)}
                  placeholder="এডমিনকে মেসেজ লিখুন..."
                  className="flex-1 px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-main outline-none transition-all"
                />

                <button
                  type="submit"
                  disabled={sendingChat || uploadingImage || (!chatText.trim() && !pendingImage?.uploadedUrl)}
                  className="px-4 py-2 bg-primary-main text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-sky-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                >
                  {sendingChat || uploadingImage ? (
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
        ) : (
          /* Helpline Cards & Ticket Form */
          <>
            {/* Quick Contact Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {/* Phone Call */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-primary-main flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">সরাসরি ফোন লাইন</h3>
                    <p className="text-[11px] text-gray-400">সকাল ৯:০০ - রাত ১০:০০</p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-3">জরুরি অর্ডার বা ডেলিভারি সমস্যার জন্য ফোন করুন।</p>
                <a
                  href={`tel:${HELPLINE_PHONE}`}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-primary-main hover:bg-sky-600 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" /> কল করুন: {HELPLINE_PHONE}
                </a>
              </div>

              {/* WhatsApp Support */}
              <div className="bg-white rounded-2xl border border-emerald-100 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">WhatsApp হেল্পলাইন</h3>
                    <p className="text-[11px] text-emerald-600 font-medium">দ্রুত রেসপন্স</p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-3">হোয়াটসঅ্যাপে সরাসরি এজেন্টের সাথে কথা বলুন।</p>
                <a
                  href={`https://wa.me/${HELPLINE_WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp মেসেজ
                </a>
              </div>

              {/* Email Support */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">অফিসিয়াল ইমেইল</h3>
                    <p className="text-[11px] text-gray-400">২৪ ঘণ্টার মধ্যে উত্তর</p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-3">ইনভয়েস বা প্রাতিষ্ঠানিক আলোচনার জন্য ইমেইল করুন।</p>
                <a
                  href={`mailto:${HELPLINE_EMAIL}`}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" /> ইমেইল পাঠান
                </a>
              </div>
            </div>

            {/* Submit Ticket Form */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-2xs mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                    <FileQuestion className="w-5 h-5 text-primary-main" />
                    সাপোর্ট টিকিট জমা দিন
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    নির্দিষ্ট কোনো অভিযোগ থাকলে টিকিট জমা দিন, আমাদের টিম দ্রুত সমাধান করবে।
                  </p>
                </div>
              </div>

              {ticketSubmitted && (
                <div className="p-4 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs sm:text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>আপনার সাপোর্ট টিকিট জমা হয়েছে। একজন বিশেষজ্ঞ শীঘ্রই আপনার সাথে যোগাযোগ করবেন।</span>
                </div>
              )}

              <form onSubmit={handleSubmitTicket} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">সমস্যার বিষয়</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full text-xs sm:text-sm p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-main"
                    >
                      <option value="Payment Issue">ওয়ালেট ও উইথড্রয়াল পে-আউট</option>
                      <option value="Product Issue">প্রোডাক্ট লিস্টিং ও অনুমোদন</option>
                      <option value="Order Issue">অর্ডার প্রসেসিং ও কুরিয়ার</option>
                      <option value="Store Profile">শপ প্রোফাইল ও ভেরিফিকেশন</option>
                      <option value="Technical Bug">অন্যান্য কারিগরি সমস্যা</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">শিরোনাম</label>
                    <input
                      type="text"
                      placeholder="যেমন: উইথড্রয়াল পেমেন্ট বিলম্বিত হচ্ছে"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full text-xs sm:text-sm p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-main"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">বিস্তারিত বার্তা</label>
                  <textarea
                    rows={4}
                    placeholder="অর্ডার নম্বর বা ট্রানজ্যাকশন আইডিসহ আপনার সমস্যাটি বিস্তারিত লিখুন..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full text-xs sm:text-sm p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-main"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingTicket}
                    className="flex items-center gap-2 bg-primary-main hover:bg-sky-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    {submittingTicket ? 'জমা হচ্ছে...' : 'টিকিট পাঠান'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Lightbox for zooming photos */}
      <ImageLightboxModal
        isOpen={!!lightboxImage}
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
        title="সাপোর্ট ছবি"
      />
    </VendorLayout>
  );
}
