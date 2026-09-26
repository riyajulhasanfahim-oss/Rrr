import React, { useState, useEffect, useRef } from 'react';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import {
  HelpCircle,
  ArrowLeft,
  Plus,
  Send,
  Clock,
  CheckCircle,
  MessageSquare,
  Phone,
  MessageCircle,
  Image as ImageIcon,
  Loader2,
  X,
  ZoomIn,
  Headset,
  FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import {
  SupportMessage,
  getThreadId,
  sendUserSupportMessage,
  subscribeToThreadMessages,
  markThreadReadByUser
} from '../../services/supportChatService';
import { StorageManager } from '../../services/storage/StorageManager';
import ImageLightboxModal from '../../components/common/ImageLightboxModal';
import toast from 'react-hot-toast';

export default function SupportPage() {
  const navigate = useNavigate();
  const { user, userData } = useAuth();

  const [activeTab, setActiveTab] = useState<'chat' | 'tickets'>('chat');

  // Live Chat State
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(true);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Photo Attachment
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string; uploadedUrl: string | null } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tickets State
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Order Issues');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const HELPLINE_PHONE = '018783764577';
  const HELPLINE_WHATSAPP = '018884267928';

  const threadId = user ? getThreadId('customer', user.uid) : null;

  // Real-time Chat Subscription
  useEffect(() => {
    if (!threadId || !user) {
      setLoadingChat(false);
      return;
    }

    setLoadingChat(true);
    markThreadReadByUser('customer', user.uid).catch(() => {});

    const unsub = subscribeToThreadMessages(threadId, (list) => {
      setMessages(list);
      setLoadingChat(false);
    });

    return () => unsub();
  }, [threadId, user?.uid]);

  useEffect(() => {
    if (messages.length > 0 && activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, activeTab]);

  const fetchTickets = async () => {
    if (!user) {
      setLoadingTickets(false);
      return;
    }
    try {
      const q = query(
        collection(db, 'supportTickets'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTickets(list);
    } catch (e) {
      console.warn('Could not fetch support tickets', e);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [user]);

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
      console.warn('Fallback to base64 for customer support image:', err);
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
      toast.error('অনুগ্রহ করে আগে লগইন করুন');
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
        role: 'customer',
        userId: user.uid,
        userName: userData?.name || user.displayName || 'কাষ্টমার',
        userEmail: user.email || '',
        userPhone: userData?.phone || user.phoneNumber || '',
        subject: 'অর্ডার ও সাধারণ সহায়তা',
        text: msgToSend,
        imageUrl: finalImageUrl
      });

      toast.success('বার্তা সফলভাবে পাঠানো হয়েছে');
    } catch (err) {
      console.error('Failed to send customer support message:', err);
      toast.error('বার্তা পাঠানো সম্ভব হয়নি');
    } finally {
      setSendingChat(false);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in to submit a support ticket');
      return;
    }
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'supportTickets'), {
        userId: user.uid,
        userEmail: user.email || '',
        userName: userData?.name || user.displayName || 'User',
        subject: subject.trim(),
        category,
        message: message.trim(),
        status: 'Open',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      // Also mirror to real-time chat so Admin sees it in Customer Inbox
      await sendUserSupportMessage({
        role: 'customer',
        userId: user.uid,
        userName: userData?.name || user.displayName || 'User',
        userEmail: user.email || '',
        userPhone: userData?.phone || user.phoneNumber || '',
        subject: `[${category}] ${subject.trim()}`,
        text: message.trim()
      });

      toast.success('Support ticket submitted successfully!');
      setSubject('');
      setMessage('');
      setShowForm(false);
      fetchTickets();
    } catch (err) {
      toast.error('Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow pt-6 pb-16 px-3 sm:px-6 max-w-4xl mx-auto w-full">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors self-start cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs sm:text-sm font-semibold">ফিরে যান</span>
          </button>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-primary-main text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>লাইভ সাপোর্ট চ্যাট</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tickets')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'tickets'
                  ? 'bg-primary-main text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>টিকিট ও হিস্ট্রি</span>
            </button>
          </div>
        </div>

        {/* Quick Helpline Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-primary-main flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">জরুরি কাস্টমার হেল্পলাইন</p>
                <p className="text-[11px] text-slate-500">{HELPLINE_PHONE} (সকাল ৯টা - রাত ১০টা)</p>
              </div>
            </div>
            <a
              href={`tel:${HELPLINE_PHONE}`}
              className="px-3 py-1.5 bg-primary-main text-white rounded-lg text-xs font-bold hover:bg-sky-600 transition-colors"
            >
              কল দিন
            </a>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">WhatsApp হেল্পলাইন</p>
                <p className="text-[11px] text-slate-500">{HELPLINE_WHATSAPP}</p>
              </div>
            </div>
            <a
              href={`https://wa.me/88${HELPLINE_WHATSAPP}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
            >
              হোয়াটসঅ্যাপ
            </a>
          </div>
        </div>

        {activeTab === 'chat' ? (
          /* Live Chat Box with Admin */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[520px] sm:h-[600px] overflow-hidden">
            {/* Header */}
            <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-primary-main/20 text-primary-300 flex items-center justify-center font-bold border border-primary-500/30">
                    <Headset className="w-5 h-5 text-primary-300" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
                </div>
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <span>RJ World সাপোর্ট ডেস্ক</span>
                    <span className="text-[10px] px-2 py-0.5 bg-sky-500/20 text-sky-300 rounded font-normal">
                      কাষ্টমার ইনবক্স
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    অর্ডার, পেমেন্ট বা যেকোনো অভিযোগের জন্য সরাসরি এডমিন সাপোর্ট টিমের সাথে চ্যাট করুন
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
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
                  <p className="text-xs font-semibold text-slate-700">সাপোর্ট ডেস্কে স্বাগতম!</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                    আপনার কোনো অর্ডার বা পণ্যের বিষয়ে সাহায্যের প্রয়োজন হলে নিচের বক্সে লিখে পাঠান।
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSendChatMessage(undefined, 'আমার অর্ডারটি কখন ডেলিভারি হবে জানতে চাচ্ছিলাম।')}
                      className="px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-primary-main text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                    >
                      ডেলিভারি আপডেট জানতে চাই
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendChatMessage(undefined, 'পেমেন্ট সম্পন্ন করেছি কিন্তু স্ট্যাটাস পেন্ডিং দেখাচ্ছে।')}
                      className="px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-primary-main text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                    >
                      পেমেন্ট যাচাই
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
                            ? 'bg-primary-main text-white rounded-tr-none'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                        }`}
                      >
                        {/* Image Attachment */}
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
                  placeholder="আপনার মেসেজ লিখুন..."
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
          /* Tickets Tab */
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-900">আপনার সাপোর্ট টিকিটসমূহ</h2>
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1.5 bg-primary-main text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-sky-600 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> নতুন টিকিট খুলুন
                </button>
              )}
            </div>

            {showForm && (
              <form onSubmit={handleSubmitTicket} className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 mb-6 space-y-4">
                <h3 className="text-sm sm:text-base font-bold text-slate-800">নতুন সাপোর্ট টিকিট ফর্ম</h3>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">বিষয় (Subject)</label>
                  <input
                    type="text"
                    required
                    placeholder="সমস্যার সংক্ষিপ্ত শিরোনাম..."
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full p-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:border-primary-main outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ক্যাটাগরি</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full p-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:border-primary-main outline-none bg-white"
                  >
                    <option value="Order Issues">অর্ডার সংক্রান্ত সমস্যা</option>
                    <option value="Payment & Refunds">পেমেন্ট ও রিফান্ড</option>
                    <option value="Delivery Tracking">ডেলিভারি ট্র্যাকিং</option>
                    <option value="General Inquiry">সাধারণ প্রশ্ন</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">বিস্তারিত বিবরণ</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="অর্ডার নম্বর বা বিবরণসহ আপনার সমস্যাটি বিস্তারিত জানান..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full p-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:border-primary-main outline-none"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-primary-main text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-sky-600 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? 'জমা হচ্ছে...' : 'টিকিট জমা দিন'}
                  </button>
                </div>
              </form>
            )}

            {loadingTickets ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary-main" />
              </div>
            ) : tickets.length > 0 ? (
              <div className="space-y-3">
                {tickets.map(ticket => (
                  <div key={ticket.id} className="bg-white p-4 sm:p-5 rounded-2xl shadow-2xs border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 mr-2">
                          {ticket.category}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          ticket.status === 'Open' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {ticket.status}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-1.5">{ticket.subject}</h4>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('bn-BD') : ''}
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">{ticket.message}</p>
                  </div>
                ))}
              </div>
            ) : !showForm ? (
              <div className="bg-white rounded-2xl p-8 sm:p-12 shadow-2xs border border-slate-100 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HelpCircle className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">কোনো টিকিট নেই</h3>
                <p className="text-slate-500 text-xs max-w-sm mx-auto mb-6">
                  আপনার কোনো অর্ডার বা সেবায় সমস্যা হলে টিকিট খুলতে পারেন অথবা সরাসরি চ্যাট করুন।
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="bg-primary-main text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:bg-sky-600 transition-colors cursor-pointer"
                >
                  নতুন টিকিট খুলুন
                </button>
              </div>
            ) : null}
          </div>
        )}
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
