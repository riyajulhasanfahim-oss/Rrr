import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import LiveSupportChatBox from '../../components/support/LiveSupportChatBox';
import ImageLightboxModal from '../../components/common/ImageLightboxModal';
import {
  submitPhysicalSupportRequest,
  subscribeUserPhysicalRequests,
  PhysicalSupportRequest,
  subscribeUserRoleUnreads,
  SupportRole
} from '../../services/supportChatService';
import { StorageManager } from '../../services/storage/StorageManager';
import {
  ArrowLeft,
  MessageSquare,
  Building2,
  Clock,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Send,
  Image as ImageIcon,
  Loader2,
  X,
  ZoomIn,
  FileCheck2,
  AlertCircle,
  Sparkles,
  Calendar,
  Phone,
  User,
  HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const SERVICE_PURPOSES = [
  'পণ্য ড্রপ-অফ ও রিটার্ন যাচাইকরণ',
  'ভেন্ডর ট্রেড লাইসেন্স ও শপ ভেরিফিকেশন',
  'রিসেলার পার্টনারশিপ ও কমিশন মীমাংসা',
  'পেমেন্ট রিফান্ড ও ব্যাংক ট্রানজ্যাকশন চেক',
  'সরাসরি ফিজিক্যাল ইনকোয়ারি ও অন্যান্য'
];

export default function CustomerCarePage() {
  const navigate = useNavigate();
  const { user, userData } = useAuth();

  // Two main options under সাপোর্ট ট্রিকস: 'physical_support' | 'live_chat'
  const [selectedOption, setSelectedOption] = useState<'physical_support' | 'live_chat'>('physical_support');

  // Physical Support Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState(SERVICE_PURPOSES[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Photo Attachment
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string; uploadedUrl: string | null } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User's Submitted Physical Requests
  const [myRequests, setMyRequests] = useState<PhysicalSupportRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [chatUnreads, setChatUnreads] = useState<Record<SupportRole, number>>({
    customer: 0,
    physical: 0,
    vendor: 0,
    reseller: 0
  });

  // Prefill name and phone from authenticated user
  useEffect(() => {
    if (userData?.name) setName(userData.name);
    else if (user?.displayName) setName(user.displayName);

    if (userData?.phone) setPhone(userData.phone);
    else if (user?.phoneNumber) setPhone(user.phoneNumber);
  }, [user, userData]);

  // Subscribe to unread messages across all roles
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeUserRoleUnreads(user.uid, (unreads) => {
      setChatUnreads(unreads);
    });
    return () => unsub();
  }, [user?.uid]);

  // Subscribe to user's physical support requests in real-time
  useEffect(() => {
    if (!user) {
      setLoadingRequests(false);
      setMyRequests([]);
      return;
    }
    const unsub = subscribeUserPhysicalRequests(user.uid, (list) => {
      setMyRequests(list);
      setLoadingRequests(false);
    });
    return () => unsub();
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
      console.warn('Fallback to base64 for physical support image:', err);
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

  const handleSubmitPhysicalSupport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('অনুরোধ পাঠাতে অনুগ্রহ করে লগইন করুন');
      navigate('/login');
      return;
    }

    if (!name.trim()) {
      toast.error('আপনার নাম লিখুন');
      return;
    }

    if (!phone.trim()) {
      toast.error('আপনার মোবাইল নম্বর লিখুন');
      return;
    }

    if (!description.trim()) {
      toast.error('সমস্যার বিস্তারিত বিবরণ লিখুন');
      return;
    }

    if (uploadingImage) {
      toast.loading('ছবি আপলোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...', { duration: 1500 });
      return;
    }

    try {
      setSubmitting(true);
      const finalImageUrl = pendingImage?.uploadedUrl || null;

      await submitPhysicalSupportRequest({
        userId: user.uid,
        userName: name.trim(),
        userPhone: phone.trim(),
        userEmail: user.email || '',
        subject: subject.trim(),
        description: description.trim(),
        imageUrl: finalImageUrl
      });

      toast.success('ফিজিক্যাল সাপোর্ট আবেদন সফলভাবে পাঠানো হয়েছে!');
      setDescription('');
      setPendingImage(null);
    } catch (err) {
      console.error('Failed to submit physical support request:', err);
      toast.error('আবেদন পাঠানো সম্ভব হয়নি, পুনরায় চেষ্টা করুন');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: 'open' | 'scheduled' | 'resolved') => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            পর্যালোচনাধীন
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Calendar className="w-3 h-3 text-sky-600" />
            সময় নির্ধারিত
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            সমাধান সম্পন্ন
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-4 sm:pt-6 pb-20 sm:pb-16 px-3 sm:px-6 max-w-4xl mx-auto w-full">
        {/* Top Header with Back Navigation */}
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-950 bg-white px-3.5 py-2 rounded-xl border border-slate-200 transition-colors shadow-2xs min-h-[44px] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>প্রোফাইলে ফিরুন</span>
          </button>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-primary-main text-xs font-bold border border-sky-100">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>সাপোর্ট ট্রিকস ডেস্ক</span>
          </span>
        </div>

        {/* Hero Card: সাপোর্ট ট্রিকস */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-primary-main" />
                <span>সাপোর্ট ট্রিকস</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                আপনার প্রয়োজনীয় সহায়তা পেতে নিচের <strong>ফিজিক্যাল সাপোর্ট</strong> অথবা <strong>লাইভ চ্যাট</strong> নির্বাচন করুন
              </p>
            </div>

            {/* The 2 Core Options Switcher (Responsive Buttons) */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSelectedOption('physical_support')}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all min-h-[44px] cursor-pointer ${
                  selectedOption === 'physical_support'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>ফিজিক্যাল সাপোর্ট</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedOption('live_chat')}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all min-h-[44px] cursor-pointer relative ${
                  selectedOption === 'live_chat'
                    ? 'bg-primary-main text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>লাইভ চ্যাট</span>
                {Object.values(chatUnreads).reduce((a, b) => a + b, 0) > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">
                    {Object.values(chatUnreads).reduce((a, b) => a + b, 0)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Content Container */}
        {selectedOption === 'live_chat' ? (
          /* Live Chat Option */
          <div className="space-y-4">
            <LiveSupportChatBox
              title="সরাসরি সাপোর্ট লাইভ চ্যাট"
              subtitle="কাষ্টমার, ভেন্ডর ও রিসেলারদের সরাসরি এডমিন সাপোর্ট ইনবক্স"
            />
          </div>
        ) : (
          /* Physical Support Option */
          <div className="space-y-6">
            {/* Form Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    ফিজিক্যাল সাপোর্ট আবেদন
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    আপনার নাম, বিস্তারিত সমস্যা ও ছবি পাঠিয়ে এডমিন প্যানেল থেকে সরাসরি কাউন্টার সার্ভিস বা অ্যাপয়েন্টমেন্ট পান
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitPhysicalSupport} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>আপনার নাম <span className="text-rose-500">*</span></span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="পুরো নাম লিখুন"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none transition-all min-h-[44px]"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>মোবাইল নম্বর <span className="text-rose-500">*</span></span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none transition-all min-h-[44px]"
                    />
                  </div>
                </div>

                {/* Service Subject */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                    <span>সার্ভিসের বিষয় নির্বাচন করুন <span className="text-rose-500">*</span></span>
                  </label>
                  <select
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none transition-all min-h-[44px] cursor-pointer"
                  >
                    {SERVICE_PURPOSES.map((p, idx) => (
                      <option key={idx} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>বিস্তারিত বিবরণ <span className="text-rose-500">*</span></span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="আপনার সমস্যা বা ভিজিটের কারণ বিস্তারিতভাবে লিখুন (যেমন: অর্ডারের ত্রুটি, ভেন্ডর অনুমোদনের প্রমাণপত্র, ইত্যাদি)..."
                    className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none transition-all resize-none"
                  />
                </div>

                {/* Photo Attachment (Messenger Style) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>ছবি বা প্রমাণপত্র সংযুক্ত করুন (ঐচ্ছিক)</span>
                  </label>

                  {pendingImage ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                      <div
                        onClick={() => setLightboxImage(pendingImage.uploadedUrl || pendingImage.previewUrl)}
                        className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-300 bg-white shrink-0 cursor-pointer group"
                      >
                        <img
                          src={pendingImage.previewUrl}
                          alt="Attachment"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        {uploadingImage ? (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center transition-colors">
                            <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {pendingImage.file.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {uploadingImage ? 'ছবি সার্ভারে আপলোড হচ্ছে...' : 'ছবি প্রস্তুত হয়েছে'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPendingImage(null)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="ছবি বাদ দিন"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-slate-200 hover:border-amber-400 bg-slate-50 hover:bg-amber-50/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-slate-600 transition-all cursor-pointer min-h-[50px]"
                      >
                        <ImageIcon className="w-5 h-5 text-amber-500" />
                        <span className="text-xs font-semibold">
                          ছবি বা স্ক্রিনশট সিলেক্ট করতে ক্লিক করুন (JPEG, PNG, WebP)
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting || uploadingImage}
                    className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs sm:text-sm active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                  >
                    {submitting || uploadingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>পাঠানো হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>ফিজিক্যাল সাপোর্ট আবেদন জমা দিন</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* My Submitted Requests History */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <span>আমার পূর্ববর্তী ফিজিক্যাল সাপোর্ট আবেদনসমূহ</span>
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  মোট: {myRequests.length}টি
                </span>
              </div>

              {loadingRequests ? (
                <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  <span className="text-xs">লোড হচ্ছে...</span>
                </div>
              ) : myRequests.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-medium text-slate-600">এখনও কোনো ফিজিক্যাল সাপোর্ট আবেদন পাঠাননি</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    উপরের ফরমটি পূরণ করে আবেদন পাঠালে তা সরাসরি এডমিন প্যানেলের ফিজিক্যাল সাপোর্ট অপশনে পৌঁছে যাবে
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myRequests.map(req => (
                    <div
                      key={req.id}
                      className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-800">
                            {req.subject}
                          </span>
                          {getStatusBadge(req.status)}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(req.createdAt).toLocaleDateString('bn-BD', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {req.description}
                      </p>

                      {/* Photo preview if submitted */}
                      {req.imageUrl && (
                        <div className="pt-1">
                          <div
                            onClick={() => setLightboxImage(req.imageUrl || null)}
                            className="inline-flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 bg-white hover:border-amber-400 transition-colors cursor-pointer group"
                            title="বড় করে দেখুন"
                          >
                            <img
                              src={req.imageUrl}
                              alt="Attachment"
                              className="w-12 h-12 rounded object-cover"
                            />
                            <div className="px-2 text-left">
                              <span className="text-[11px] font-semibold text-slate-700 group-hover:text-amber-600 flex items-center gap-1">
                                <ZoomIn className="w-3 h-3" />
                                ছবি দেখুন
                              </span>
                              <span className="text-[10px] text-slate-400 block">ক্লিক করে জুম করুন</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Admin Note if replied */}
                      {req.adminNotes && (
                        <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 space-y-2">
                          <div className="font-bold flex items-center gap-1.5 text-amber-800">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            <span>এডমিন সাপোর্ট রেসপন্স:</span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{req.adminNotes}</p>
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setSelectedOption('live_chat')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>সরাসরি চ্যাটে কথা বলুন</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Physical Address & Office Info Cards */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <MapPin className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  RJ World ফিজিক্যাল সাপোর্ট কাউন্টার তথ্য
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    <span>অফিস ও সার্ভিস কাউন্টার</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    RJ World প্রধান কার্যালয় ও গ্রাহক সেবা বুথ<br />
                    লেভেল ৪, ব্লক-সি, বাণিজ্যিক এলাকা, ঢাকা, বাংলাদেশ।
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>কাউন্টার সেবার সময়</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    রবিবার – বৃহস্পতিবার: সকাল ১০:০০ টা হতে সন্ধ্যা ৬:০০ টা<br />
                    শনিবার: সকাল ১০:০০ টা হতে বিকাল ৩:০০ টা
                  </p>
                  <p className="text-[10px] text-rose-500 font-medium">
                    * শুক্রবার ও সরকারি ছুটির দিনে ফিজিক্যাল সেবা বন্ধ থাকে।
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-900 leading-relaxed">
                  <strong>জরুরি টিপস:</strong> সরাসরি অফিসে আসার পূর্বে উপরের ফরমটি পূরণ করে আবেদন পাঠালে এডমিন আপনার ফাইলিং প্রস্তুত রাখবে এবং আপনি দ্রুততম সময়ে কাউন্টারে সেবা পাবেন।
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Lightbox for zooming attached photos */}
      <ImageLightboxModal
        isOpen={!!lightboxImage}
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
        title="সংযুক্ত ছবি"
      />

      <Footer />
    </div>
  );
}
