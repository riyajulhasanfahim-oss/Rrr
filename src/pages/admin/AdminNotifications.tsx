import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { rtdbList, rtdbSet } from '../../lib/rtdb';
import { useAuth } from '../../context/AuthContext';
import { 
  Bell, 
  Image as ImageIcon, 
  Send, 
  Clock, 
  Users, 
  Target, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  History,
  Trash2,
  ExternalLink,
  Sparkles,
  ShoppingBag,
  Tag,
  User,
  Store,
  Briefcase,
  Upload,
  Eye,
  Check,
  BarChart3,
  MousePointerClick,
  TrendingUp,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { 
  sendAdminNotification, 
  AdminNotificationPayload,
  fetchAllNotificationAnalytics,
  NotificationAnalyticsData,
  formatBengaliDigit
} from '../../services/notificationService';

const formatNotificationDate = (val: any) => {
  if (!val) return 'অজানা';
  try {
    const d = typeof val === 'number' 
      ? new Date(val) 
      : typeof val === 'string' 
      ? new Date(val) 
      : val.toDate 
      ? val.toDate() 
      : val.seconds 
      ? new Date(val.seconds * 1000) 
      : new Date(val);
    return isNaN(d.getTime()) ? 'অজানা' : format(d, 'dd MMM yyyy, hh:mm a');
  } catch {
    return 'অজানা';
  }
};

export default function AdminNotifications() {
  const { userData, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'history' | 'analytics' | 'messages'>('create');
  
  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [notificationType, setNotificationType] = useState<string>('deal');
  const [targetType, setTargetType] = useState<'all' | 'users' | 'vendors' | 'resellers' | 'single'>('all');
  
  // Target Single User State
  const [targetUserId, setTargetUserId] = useState('');
  const [targetUserName, setTargetUserName] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Products State (for quick product selection)
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  
  // Action Link State
  const [actionType, setActionType] = useState<'product' | 'deals' | 'custom' | 'home' | 'orders'>('product');
  const [customLink, setCustomLink] = useState('');
  
  // Image State
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isImageValid, setIsImageValid] = useState<boolean | null>(null);
  
  const [isSending, setIsSending] = useState(false);
  
  // History & Separation State
  const [history, setHistory] = useState<any[]>([]);
  const [userVendorMessages, setUserVendorMessages] = useState<any[]>([]);
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, NotificationAnalyticsData>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedItemForAnalytics, setSelectedItemForAnalytics] = useState<any | null>(null);

  // Load available users and products on mount
  useEffect(() => {
    fetchUsers();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'analytics' || activeTab === 'messages') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const list = await rtdbList<any>('users').catch(() => []);
      const formatted = list.map(({ id, data }) => ({
        id,
        name: data?.name || data?.displayName || 'নামহীন ইউজার',
        phone: data?.phone || data?.phoneNumber || '',
        email: data?.email || '',
        role: data?.role || data?.userType || 'user'
      }));
      setAvailableUsers(formatted);
    } catch (err) {
      console.warn('Error fetching users for targeting:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const list = await rtdbList<any>('products').catch(() => []);
      const formatted = list.map(({ id, data }) => ({
        id,
        name: data?.name || data?.title || 'প্রোডাক্ট',
        image: data?.image || data?.images?.[0] || data?.thumbnail || '',
        price: data?.price || data?.salePrice || 0
      }));
      setAvailableProducts(formatted);
    } catch (err) {
      console.warn('Error fetching products for targeting:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const historyMap = new Map<string, any>();
      const messagesList: any[] = [];

      const [rtdbHistory, rtdbNotifications, analyticsData, chatsList] = await Promise.all([
        rtdbList<any>('notificationHistory').catch(() => []),
        rtdbList<any>('notifications').catch(() => []),
        fetchAllNotificationAnalytics().catch(() => ({})),
        rtdbList<any>('chats').catch(() => [])
      ]);

      setAnalyticsMap(analyticsData);

      // 1. Separate user-vendor chat notifications from marketing notifications
      const processItem = (id: string, data: any) => {
        if (!id || !data) return;
        const isMsg = data.type === 'message' || 
                      data.type === 'chat' || 
                      data.chatId || 
                      data.source === 'chat' ||
                      (data.title && data.title.includes('নতুন মেসেজ'));

        if (isMsg) {
          if (!messagesList.some(m => m.id === id)) {
            messagesList.push({ id, ...data });
          }
        } else {
          if (!historyMap.has(id)) {
            historyMap.set(id, { id, ...data });
          }
        }
      };

      rtdbHistory.forEach(({ id, data }) => processItem(id, data));
      rtdbNotifications.forEach(({ id, data }) => processItem(id, data));

      // 2. Also populate chat conversations so Admin can monitor User-Vendor interactions without cluttering marketing
      chatsList.forEach(({ id: chatId, data: chatData }) => {
        if (chatData?.lastMessage || chatData?.customerName || chatData?.storeName) {
          const virtualId = `chat_${chatId}`;
          if (!messagesList.some(m => m.id === virtualId || m.chatId === chatId)) {
            messagesList.push({
              id: virtualId,
              chatId,
              title: `চ্যাট: ${chatData.userName || chatData.customerName || 'কাস্টমার'} ↔ ${chatData.vendorName || chatData.storeName || 'ভেন্ডর'}`,
              message: chatData.lastMessage || 'চ্যাট যোগাযোগ',
              senderName: chatData.lastSenderName || chatData.userName || 'কাস্টমার',
              vendorName: chatData.vendorName || chatData.storeName || 'ভেন্ডর',
              customerName: chatData.userName || chatData.customerName || 'কাস্টমার',
              createdAt: chatData.lastMessageTime || chatData.updatedAt || Date.now(),
              type: 'chat',
              isRead: chatData.lastMessageRead ?? true,
              link: `/vendor/chat?id=${chatId}`
            });
          }
        }
      });

      const marketingData = Array.from(historyMap.values()).sort((a, b) => {
        const timeA = typeof a.createdAt === 'number' ? a.createdAt : a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = typeof b.createdAt === 'number' ? b.createdAt : b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      const sortedMessages = messagesList.sort((a, b) => {
        const timeA = typeof a.createdAt === 'number' ? a.createdAt : a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = typeof b.createdAt === 'number' ? b.createdAt : b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      setHistory(marketingData);
      setUserVendorMessages(sortedMessages);
    } catch (error) {
      console.error("Error fetching notification history:", error);
      toast.error("হিস্টোরি লোড করা সম্ভব হয়নি");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value.trim();
    setImageUrlInput(url);
    if (!url) {
      setIsImageValid(null);
      return;
    }
    
    if (url.startsWith('data:image/') || url.startsWith('http://') || url.startsWith('https://')) {
      const img = new window.Image();
      img.onload = () => setIsImageValid(true);
      img.onerror = () => setIsImageValid(false);
      img.src = url;
    } else {
      setIsImageValid(false);
    }
  };

  // Handle local image file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('অনুগ্রহ করে শুধুমাত্র ছবি ফাইল সিলেক্ট করুন');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('ছবির সাইজ সর্বোচ্চ ২ মেগাবাইট হতে পারবে');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageUrlInput(result);
      setIsImageValid(true);
      toast.success('ছবি আপলোড করা হয়েছে!');
    };
    reader.onerror = () => {
      toast.error('ছবি প্রসেস করতে ব্যর্থ হয়েছে');
    };
    reader.readAsDataURL(file);
  };

  // Auto-fill when picking a product
  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    if (!productId) return;

    const prod = availableProducts.find(p => p.id === productId);
    if (prod) {
      if (!title) setTitle(`🔥 বিশেষ অফার: ${prod.name}`);
      if (!message) setMessage(`${prod.name} এখন বিশেষ মূল্যে পাওয়া যাচ্ছে! দ্রুত অর্ডার করে অফারটি গ্রহণ করুন।`);
      if (prod.image && !imageUrlInput) {
        setImageUrlInput(prod.image);
        setIsImageValid(true);
      }
      setActionType('product');
    }
  };

  // Filtered users for specific user targeting
  const filteredUsers = availableUsers.filter(u => {
    if (!userSearchQuery) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  }).slice(0, 10);

  const handleSelectUser = (u: any) => {
    setTargetUserId(u.id);
    setTargetUserName(`${u.name} (${u.phone || u.email || u.id})`);
    setShowUserDropdown(false);
    setUserSearchQuery('');
  };

  const getComputedLink = (): string => {
    switch (actionType) {
      case 'product':
        return selectedProductId ? `/product/${selectedProductId.trim()}` : '/';
      case 'deals':
        return '/category/deals';
      case 'orders':
        return '/orders';
      case 'custom': {
        const cl = customLink.trim();
        if (!cl) return '/';
        // If it starts with http/https, keep it
        if (cl.startsWith('http://') || cl.startsWith('https://')) return cl;
        // If internal route without leading slash, add slash
        return cl.startsWith('/') ? cl : `/${cl}`;
      }
      case 'home':
      default:
        return '/';
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("নোটিফিকেশনের শিরোনাম ও বার্তা আবশ্যক!");
      return;
    }

    if (targetType === 'single' && !targetUserId.trim()) {
      toast.error("অনুগ্রহ করে নির্দিষ্ট ইউজার সিলেক্ট করুন অথবা ইউজার আইডি দিন!");
      return;
    }

    if (actionType === 'product' && !selectedProductId.trim()) {
      toast.error("অনুগ্রহ করে প্রোডাক্ট সিলেক্ট করুন বা প্রোডাক্ট আইডি দিন!");
      return;
    }

    try {
      setIsSending(true);

      const finalLink = getComputedLink();

      const payload: AdminNotificationPayload = {
        title: title.trim(),
        message: message.trim(),
        targetType,
        targetUserId: targetType === 'single' ? targetUserId.trim() : undefined,
        targetUserName: targetType === 'single' ? targetUserName : undefined,
        type: notificationType,
        imageUrl: imageUrlInput.trim() || undefined,
        link: finalLink,
        productId: actionType === 'product' ? selectedProductId.trim() : undefined,
        adminId: user?.uid,
        adminName: userData?.name || 'Admin',
      };

      // 1. Send via Realtime Database
      const result = await sendAdminNotification(payload);

      // 2. Also try Cloud Functions FCM push if available (fire-and-forget)
      try {
        const functions = getFunctions();
        const sendPushFn = httpsCallable(functions, 'sendPushNotification');
        sendPushFn({
          title: payload.title,
          body: payload.message,
          imageUrl: payload.imageUrl,
          dataPayload: {
            link: finalLink,
            route: finalLink,
            type: notificationType
          }
        }).catch(() => {});
      } catch {
        // FCM fallback handled gracefully
      }

      if (result.success) {
        toast.success("নোটিফিকেশন সফলভাবে পাঠানো হয়েছে! গ্রাহকদের ডিভাইসে সাউন্ডসহ পৌঁছে যাবে।", {
          duration: 4000
        });

        // Reset form
        setTitle('');
        setMessage('');
        setImageUrlInput('');
        setIsImageValid(null);
        setSelectedProductId('');
        setTargetUserId('');
        setTargetUserName('');
        setCustomLink('');

        // Switch to history
        fetchHistory();
        setActiveTab('history');
      }
    } catch (err) {
      console.error("Error sending notification:", err);
      toast.error("নোটিফিকেশন পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিত এই নোটিফিকেশনটি মুছে ফেলতে চান?")) return;

    try {
      setDeletingId(id);
      await Promise.allSettled([
        rtdbSet(`notifications/${id}`, null),
        rtdbSet(`notificationHistory/${id}`, null)
      ]);
      setHistory(prev => prev.filter(h => h.id !== id));
      toast.success("নোটিফিকেশন মুছে ফেলা হয়েছে");
    } catch (err) {
      toast.error("মুছে ফেলা সম্ভব হয়নি");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-main/10 text-primary-main rounded-xl">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                নোটিফিকেশন ম্যানেজমেন্ট
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                সাধারণ ইউজার, ভেন্ডর, রিসেলার বা নির্দিষ্ট কাউকে সাউন্ডসহ অফার ও প্রোডাক্ট নোটিফিকেশন পাঠান
              </p>
            </div>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl self-start sm:self-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'bg-white text-primary-main shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>নতুন পাঠান</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white text-primary-main shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>ক্যাম্পেইন হিস্টোরি ({history.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'bg-white text-primary-main shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <span>অ্যানালিটিক্স</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'messages'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            <span>ইউজার-ভেন্ডর মেসেজ ({userVendorMessages.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form (2 Cols) */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSend} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              {/* Section 1: Target Audience */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-primary-main" />
                  <span>টার্গেট অডিয়েন্স (কার কাছে পাঠাবেন) *</span>
                </label>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTargetType('all')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      targetType === 'all'
                        ? 'border-primary-main bg-sky-50/60 ring-2 ring-primary-main/20 text-primary-main'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                      <Users className="w-4 h-4" />
                      <span>সকল গ্রাহক</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">সবাই নোটিফিকেশন পাবে</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('users')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      targetType === 'users'
                        ? 'border-primary-main bg-sky-50/60 ring-2 ring-primary-main/20 text-primary-main'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                      <User className="w-4 h-4" />
                      <span>সাধারণ ইউজার</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">শুধুমাত্র সাধারণ ক্রেতাগণ</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('resellers')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      targetType === 'resellers'
                        ? 'border-primary-main bg-sky-50/60 ring-2 ring-primary-main/20 text-primary-main'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                      <Briefcase className="w-4 h-4" />
                      <span>রিসেলার</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">সকল নিবন্ধিত রিসেলার</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('vendors')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      targetType === 'vendors'
                        ? 'border-primary-main bg-sky-50/60 ring-2 ring-primary-main/20 text-primary-main'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                      <Store className="w-4 h-4" />
                      <span>ভেন্ডর / মার্চেন্ট</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">সকল স্টোর মালিক</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('single')}
                    className={`p-3 rounded-xl border text-left transition-all col-span-2 sm:col-span-2 ${
                      targetType === 'single'
                        ? 'border-primary-main bg-sky-50/60 ring-2 ring-primary-main/20 text-primary-main'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                      <Target className="w-4 h-4" />
                      <span>নির্দিষ্ট ইউজার (User ID দিয়ে)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">যেকোনো নির্দিষ্ট একজনকে ব্যক্তিগত বার্তা পাঠান</p>
                  </button>
                </div>

                {/* Specific User Search & Input if targetType === 'single' */}
                {targetType === 'single' && (
                  <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
                    <label className="block text-xs font-bold text-slate-700">
                      নির্দিষ্ট ইউজার নির্বাচন বা আইডি লিখুন:
                    </label>

                    {targetUserId && (
                      <div className="flex items-center justify-between p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-xs">
                        <div>
                          <span className="font-bold text-primary-main">নির্বাচিত: </span>
                          <span className="text-slate-800">{targetUserName || targetUserId}</span>
                          <span className="text-slate-400 ml-1">({targetUserId})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetUserId('');
                            setTargetUserName('');
                          }}
                          className="text-red-500 hover:underline font-bold text-[11px]"
                        >
                          পরিবর্তন করুন
                        </button>
                      </div>
                    )}

                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            value={userSearchQuery}
                            onChange={(e) => {
                              setUserSearchQuery(e.target.value);
                              setShowUserDropdown(true);
                            }}
                            onFocus={() => setShowUserDropdown(true)}
                            placeholder="নাম, ফোন নম্বর বা আইডি লিখে ইউজার খুঁজুন..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main outline-none"
                          />
                        </div>
                        <input
                          type="text"
                          value={targetUserId}
                          onChange={(e) => setTargetUserId(e.target.value)}
                          placeholder="অথবা সরাসরি UID পেস্ট করুন"
                          className="w-48 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main outline-none"
                        />
                      </div>

                      {/* Dropdown list of users */}
                      {showUserDropdown && userSearchQuery && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-30 max-h-52 overflow-y-auto divide-y divide-slate-100">
                          {filteredUsers.length === 0 ? (
                            <div className="p-3 text-xs text-slate-400 text-center">কোনো ইউজার পাওয়া যায়নি</div>
                          ) : (
                            filteredUsers.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => handleSelectUser(u)}
                                className="w-full p-2.5 text-left hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
                              >
                                <div>
                                  <p className="font-bold text-slate-800">{u.name}</p>
                                  <p className="text-[11px] text-slate-500">{u.phone || u.email || u.id}</p>
                                </div>
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-700 capitalize">
                                  {u.role}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Notification Category / Type */}
              <div className="border-t border-slate-100 pt-5">
                <label className="block text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-primary-main" />
                  <span>নোটিফিকেশনের ধরন (Category)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'deal', label: '🔥 হট ডিলস ও অফার' },
                    { id: 'product', label: '📦 নতুন প্রোডাক্ট' },
                    { id: 'system', label: '📢 সাধারণ বিজ্ঞপ্তি' },
                    { id: 'order', label: '🛍️ অর্ডার আপডেট' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNotificationType(cat.id)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        notificationType === cat.id
                          ? 'border-primary-main bg-sky-50 text-primary-main'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 3: Title & Message */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-bold text-slate-900">
                      শিরোনাম (Notification Title) *
                    </label>
                    <span className="text-xs text-slate-400">{title.length}/80</span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="যেমন: আজকের সেরা অফার! ৫০% পর্যন্ত ছাড় 🔥"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-bold text-slate-900">
                      বিস্তারিত বার্তা (Detailed Message) *
                    </label>
                    <span className="text-xs text-slate-400">{message.length}/300</span>
                  </div>
                  <textarea
                    required
                    rows={4}
                    maxLength={300}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="নোটিফিকেশনের বিস্তারিত লিখুন। গ্রাহকরা ক্লিক করে ডিটেলস পেজে গিয়ে সম্পূর্ণ বার্তা ও ছবি দেখতে পাবেন..."
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main outline-none resize-none"
                  />
                </div>
              </div>

              {/* Section 4: Image Attachment (Product Banner / Offer Image) */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <label className="block text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-primary-main" />
                  <span>প্রোডাক্ট ছবি বা ব্যানার (Image) - ঐচ্ছিক</span>
                </label>

                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <div className="flex-1 w-full space-y-2">
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={handleImageUrlChange}
                      placeholder="ছবির সরাসরি লিংক (URL) পেস্ট করুন..."
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-main/20 focus:border-primary-main outline-none"
                    />

                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>ডিভাইস থেকে আপলোড</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>

                      {imageUrlInput && (
                        <button
                          type="button"
                          onClick={() => {
                            setImageUrlInput('');
                            setIsImageValid(null);
                          }}
                          className="text-xs text-red-500 hover:underline font-semibold"
                        >
                          ছবি মুছুন
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Thumbnail Preview */}
                  {imageUrlInput && (
                    <div className="w-24 h-24 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0 relative group">
                      <img
                        referrerPolicy="no-referrer"
                        src={imageUrlInput}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={() => setIsImageValid(false)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Section 5: Action Link / Product Deep Link */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <label className="block text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4 text-primary-main" />
                  <span>ক্লিক করলে কোথায় নিয়ে যাবে (Action Link) *</span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'product', label: 'নির্দিষ্ট প্রোডাক্ট' },
                    { id: 'deals', label: 'হট ডিলস পেজ' },
                    { id: 'orders', label: 'অর্ডার পেজ' },
                    { id: 'custom', label: 'কাস্টম লিংক' },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setActionType(act.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        actionType === act.id
                          ? 'border-primary-main bg-sky-50 text-primary-main'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>

                {/* Product Dropdown Selector if actionType === 'product' */}
                {actionType === 'product' && (
                  <div className="space-y-2 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700">
                      স্টোর থেকে প্রোডাক্ট সিলেক্ট করুন:
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleSelectProduct(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary-main/20"
                    >
                      <option value="">-- প্রোডাক্ট বেছে নিন --</option>
                      {availableProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.price ? `(৳${p.price})` : ''} - ID: {p.id}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-500">অথবা সরাসরি প্রোডাক্ট আইডি:</span>
                      <input
                        type="text"
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        placeholder="প্রোডাক্ট আইডি লিখুন"
                        className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Custom Link input */}
                {actionType === 'custom' && (
                  <div>
                    <input
                      type="text"
                      value={customLink}
                      onChange={(e) => setCustomLink(e.target.value)}
                      placeholder="যেমন: /category/electronics বা https://..."
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-main/20 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="border-t border-slate-100 pt-5 flex items-center justify-between">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>তাত্ক্ষণিকভাবে শব্দসহ ব্যবহারকারীর বক্সে যাবে</span>
                </p>

                <button
                  type="submit"
                  disabled={isSending}
                  className="px-6 py-3 bg-primary-main hover:bg-sky-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>পাঠানো হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>নোটিফিকেশন পাঠান</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Col: Live Preview on User Mobile/Web (1 Col) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-primary-main" />
                  <span>গ্রাহক যেভাবে দেখবে (Preview)</span>
                </h3>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 font-bold text-[10px] rounded-full">
                  লাইভ প্রিভিউ
                </span>
              </div>

              {/* In-App Notification Item Preview */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-primary-main flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-primary-main bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                        {notificationType === 'deal' ? 'হট ডিলস' : notificationType === 'product' ? 'নতুন প্রোডাক্ট' : 'বিজ্ঞপ্তি'}
                      </span>
                      <span className="text-[10px] text-slate-400">এইমাত্র</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-1 line-clamp-1">
                      {title || 'নোটিফিকেশন শিরোনাম'}
                    </h4>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                      {message || 'এখানে আপনার নোটিফিকেশন বিস্তারিত বার্তা প্রদর্শিত হবে...'}
                    </p>
                  </div>
                </div>

                {/* Image in preview if provided */}
                {imageUrlInput && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-36">
                    <img
                      referrerPolicy="no-referrer"
                      src={imageUrlInput}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Target badge */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                  <span>টার্গেট:</span>
                  <span className="font-bold text-slate-700">
                    {targetType === 'all'
                      ? 'সকল ব্যবহারকারী'
                      : targetType === 'users'
                      ? 'সাধারণ ইউজার'
                      : targetType === 'vendors'
                      ? 'ভেন্ডর'
                      : targetType === 'resellers'
                      ? 'রিসেলার'
                      : 'নির্দিষ্ট ইউজার'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>ক্লিক অ্যাকশন:</span>
                  <span className="font-semibold text-primary-main truncate max-w-[140px]">
                    {getComputedLink()}
                  </span>
                </div>
              </div>

              {/* Notification Detail Page Preview Hint */}
              <div className="mt-4 p-3 bg-sky-50/70 border border-sky-100 rounded-xl text-xs text-sky-800 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-primary-main" />
                  <span>ফুল ডিটেলস পেজ সাপোর্ট:</span>
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  ইউজাররা নোটিফিকেশনে চাপ দিলে সরাসরি তাদের জন্য তৈরি <strong>/notification/:id</strong> ডিটেলস পেজে চলে যাবে, যেখানে পুরো ছবি, দীর্ঘ বার্তা ও সরাসরি অফার লিংকে যাওয়ার বাটন থাকবে।
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-primary-main" />
                <span>প্রেরিত ক্যাম্পেইন ও মার্কেটিং নোটিফিকেশন হিস্টোরি</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                এখানে শুধুমাত্র অ্যাডমিন থেকে প্রেরিত অফার, ডিলস ও ব্রডকাস্ট সংরক্ষিত আছে (ইউজার মেসেজ আলাদা রাখা হয়েছে)
              </p>
            </div>
            <button
              type="button"
              onClick={fetchHistory}
              className="text-xs font-semibold text-primary-main hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>রিফ্রেশ করুন</span>
            </button>
          </div>

          {loadingHistory ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-3 border-primary-main border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500">হিস্টোরি লোড হচ্ছে...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Bell className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">কোনো নোটিফিকেশন হিস্টোরি নেই</h3>
              <p className="text-xs text-slate-500 mt-1">
                আপনি যে নোটিফিকেশনগুলো পাঠাবেন সেগুলো এখানে সংরক্ষিত থাকবে।
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3.5">তারিখ ও সময়</th>
                    <th className="px-4 py-3.5">ছবি</th>
                    <th className="px-4 py-3.5">শিরোনাম ও বার্তা</th>
                    <th className="px-4 py-3.5">টার্গেট</th>
                    <th className="px-4 py-3.5">পারফরম্যান্স অ্যানালিটিক্স</th>
                    <th className="px-4 py-3.5">অ্যাকশন লিংক</th>
                    <th className="px-4 py-3.5 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((item) => {
                    const analytics = analyticsMap[item.id];
                    const sent = analytics?.sentCount || item.targetCount || (item.targetType === 'single' ? 1 : 1);
                    const opened = analytics?.openedCount || 0;
                    const details = analytics?.detailsViewCount || 0;
                    const clicks = analytics?.linkClickCount || 0;
                    const ctrVal = analytics?.ctr ?? (sent > 0 ? (clicks / sent) * 100 : 0);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatNotificationDate(item.createdAt)}</span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {item.imageUrl ? (
                            <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 shrink-0">
                              <img
                                referrerPolicy="no-referrer"
                                src={item.imageUrl}
                                alt="Thumbnail"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">ছবি নেই</span>
                          )}
                        </td>

                        <td className="px-4 py-4 max-w-xs">
                          <p className="font-bold text-slate-900 line-clamp-1">{item.title}</p>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{item.message}</p>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            item.targetType === 'vendors' 
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              : item.targetType === 'resellers'
                              ? 'bg-purple-50 text-purple-700 border border-purple-100'
                              : item.targetType === 'users'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : item.targetType === 'single'
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-sky-50 text-primary-main border border-sky-100'
                          }`}>
                            {item.targetType === 'vendors' ? 'ভেন্ডর' :
                             item.targetType === 'resellers' ? 'রিসেলার' :
                             item.targetType === 'users' ? 'সাধারণ ইউজার' :
                             item.targetType === 'single' ? (item.targetUserName || `ইউজার: ${item.userId || 'সিঙ্গেল'}`) : 'সকল গ্রাহক'}
                          </span>
                        </td>

                        {/* Real-time Analytics column */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-slate-500 font-medium">খোলা:</span>
                              <span className="font-bold text-slate-800">{formatBengaliDigit(opened)}</span>
                              <span className="text-slate-300">|</span>
                              <span className="text-slate-500 font-medium">ক্লিক:</span>
                              <span className="font-bold text-emerald-600">{formatBengaliDigit(clicks)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                ctrVal > 10 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                              }`}>
                                CTR {ctrVal.toFixed(1)}%
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedItemForAnalytics(item)}
                                className="text-[11px] text-primary-main hover:underline font-semibold flex items-center gap-0.5 ml-1"
                              >
                                <span>বিস্তারিত</span>
                                <BarChart3 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-xs">
                          {item.link ? (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-main hover:underline flex items-center gap-1 font-semibold"
                            >
                              <span className="truncate max-w-[100px]">{item.link}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteNotification(item.id)}
                            disabled={deletingId === item.id}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Analytics Dashboard Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          {(() => {
            let totalSent = 0;
            let totalOpened = 0;
            let totalRead = 0;
            let totalDetailsView = 0;
            let totalClicks = 0;

            history.forEach(item => {
              const a = analyticsMap[item.id];
              totalSent += a?.sentCount || item.targetCount || (item.targetType === 'single' ? 1 : 1);
              totalOpened += a?.openedCount || 0;
              totalRead += a?.readCount || 0;
              totalDetailsView += a?.detailsViewCount || 0;
              totalClicks += a?.linkClickCount || 0;
            });

            const avgCtr = totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(1) : '0.0';

            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold">ক্যাম্পেইন</span>
                    <Bell className="w-4 h-4 text-primary-main" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900">
                    {formatBengaliDigit(history.length)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">মোট পাঠানো বিজ্ঞপ্তি</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold">প্রেরিত সংখ্যা</span>
                    <Send className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900">
                    {formatBengaliDigit(totalSent)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">সর্বমোট পুশ ও বার্তা</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold">ওপেন হয়েছে</span>
                    <Eye className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900">
                    {formatBengaliDigit(totalOpened)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">ড্রপডাউনে দেখা হয়েছে</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold">ডিটেইলস ভিউ</span>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900">
                    {formatBengaliDigit(totalDetailsView)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">ডিটেইলস পেজে প্রবেশ</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold">অফার ক্লিক</span>
                    <MousePointerClick className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-600">
                    {formatBengaliDigit(totalClicks)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">প্রোডাক্ট/অফার লিংক ক্লিক</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-2">
                    <span className="text-xs font-bold">গড় CTR</span>
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-purple-600">
                    {avgCtr}%
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">ক্লিক থ্রু রেট</p>
                </div>
              </div>
            );
          })()}

          {/* Performance Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                  <span>ক্যাম্পেইন পারফরম্যান্স ও কনভার্সন বিশ্লেষণ</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  প্রতিটি ক্যাম্পেইনের সেন্ট, ওপেন, ডিটেইলস ভিউ এবং লিংকে ক্লিকের বাস্তব মেট্রিক্স
                </p>
              </div>
              <button
                type="button"
                onClick={fetchHistory}
                className="text-xs font-semibold text-primary-main hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>রিফ্রেশ</span>
              </button>
            </div>

            {history.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                কোনো ক্যাম্পেইন ডাটা পাওয়া যায়নি
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5">ক্যাম্পেইন নাম ও তারিখ</th>
                      <th className="px-4 py-3.5 text-center">টার্গেট</th>
                      <th className="px-4 py-3.5 text-center">সেন্ট (Sent)</th>
                      <th className="px-4 py-3.5 text-center">ওপেন (Opened)</th>
                      <th className="px-4 py-3.5 text-center">পঠিত (Read)</th>
                      <th className="px-4 py-3.5 text-center">ডিটেইলস ভিউ</th>
                      <th className="px-4 py-3.5 text-center">ক্লিক (Clicks)</th>
                      <th className="px-5 py-3.5 text-center">CTR %</th>
                      <th className="px-4 py-3.5 text-right">ডিটেইলস</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((item) => {
                      const a = analyticsMap[item.id];
                      const sent = a?.sentCount || item.targetCount || (item.targetType === 'single' ? 1 : 1);
                      const opened = a?.openedCount || 0;
                      const read = a?.readCount || 0;
                      const details = a?.detailsViewCount || 0;
                      const clicks = a?.linkClickCount || 0;
                      const ctrVal = a?.ctr ?? (sent > 0 ? (clicks / sent) * 100 : 0);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {item.imageUrl ? (
                                <img
                                  referrerPolicy="no-referrer"
                                  src={item.imageUrl}
                                  alt="Icon"
                                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-sky-50 text-primary-main flex items-center justify-center font-bold text-xs shrink-0">
                                  <Bell className="w-5 h-5" />
                                </div>
                              )}
                              <div className="min-w-0 max-w-xs">
                                <p className="font-bold text-slate-900 truncate">{item.title}</p>
                                <p className="text-[11px] text-slate-400">
                                  {formatNotificationDate(item.createdAt)}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                              {item.targetType === 'vendors' ? 'ভেন্ডর' :
                               item.targetType === 'resellers' ? 'রিসেলার' :
                               item.targetType === 'users' ? 'ইউজার' :
                               item.targetType === 'single' ? 'সিঙ্গেল' : 'সবাই'}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-center font-bold text-slate-800">
                            {formatBengaliDigit(sent)}
                          </td>

                          <td className="px-4 py-4 text-center font-bold text-slate-800">
                            {formatBengaliDigit(opened)}
                          </td>

                          <td className="px-4 py-4 text-center font-bold text-slate-800">
                            {formatBengaliDigit(read)}
                          </td>

                          <td className="px-4 py-4 text-center font-bold text-amber-600">
                            {formatBengaliDigit(details)}
                          </td>

                          <td className="px-4 py-4 text-center font-bold text-emerald-600">
                            {formatBengaliDigit(clicks)}
                          </td>

                          <td className="px-5 py-4 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full rounded-full transition-all"
                                  style={{ width: `${Math.min(100, ctrVal)}%` }}
                                />
                              </div>
                              <span className="font-black text-xs text-slate-900">
                                {ctrVal.toFixed(1)}%
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedItemForAnalytics(item)}
                              className="px-2.5 py-1 bg-sky-50 text-primary-main rounded-lg text-xs font-bold hover:bg-sky-100 transition-colors inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>ভিউ</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User-Vendor Messages Tab (Strictly separated from marketing notifications) */}
      {activeTab === 'messages' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                <span>ইউজার–ভেন্ডর মেসেজ নোটিফিকেশন সেন্টার</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                গ্রাহক ও স্টোর মালিকদের ব্যক্তিগত চ্যাট বার্তা। সাধারণ মার্কেটিং নোটিফিকেশনের সাথে এটি মেশানো হয় না।
              </p>
            </div>
            <button
              type="button"
              onClick={fetchHistory}
              className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>রিফ্রেশ</span>
            </button>
          </div>

          {userVendorMessages.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">কোনো ইউজার-ভেন্ডর মেসেজ নোটিফিকেশন নেই</h3>
              <p className="text-xs text-slate-500 mt-1">
                গ্রাহক ও ভেন্ডরের মধ্যে মেসেজিং হলে তা এখানে তালিকাভুক্ত হবে।
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {userVendorMessages.map((msg) => (
                <div key={msg.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      <Store className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900">
                          {msg.title || `${msg.senderName || 'গ্রাহক'} ↔ ${msg.vendorName || 'ভেন্ডর'}`}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          ইউজার-ভেন্ডর চ্যাট
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {msg.message}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatNotificationDate(msg.createdAt)}</span>
                        </span>
                        {msg.customerName && (
                          <span>গ্রাহক: <strong className="text-slate-600">{msg.customerName}</strong></span>
                        )}
                        {msg.vendorName && (
                          <span>ভেন্ডর: <strong className="text-slate-600">{msg.vendorName}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {msg.link && (
                      <a
                        href={msg.link}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                      >
                        <span>চ্যাট দেখুন</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detailed Analytics Modal */}
      {selectedItemForAnalytics && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">ক্যাম্পেইন অ্যানালিটিক্স রিপোর্ট</h3>
                  <p className="text-xs text-slate-500">আইডি: {selectedItemForAnalytics.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForAnalytics(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campaign Summary */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
              {selectedItemForAnalytics.imageUrl && (
                <img
                  referrerPolicy="no-referrer"
                  src={selectedItemForAnalytics.imageUrl}
                  alt="Banner"
                  className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-slate-900 line-clamp-1">
                  {selectedItemForAnalytics.title}
                </h4>
                <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                  {selectedItemForAnalytics.message}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {formatNotificationDate(selectedItemForAnalytics.createdAt)}
                </p>
              </div>
            </div>

            {/* Funnel Metrics */}
            {(() => {
              const a = analyticsMap[selectedItemForAnalytics.id];
              const sent = a?.sentCount || selectedItemForAnalytics.targetCount || 1;
              const opened = a?.openedCount || 0;
              const read = a?.readCount || 0;
              const details = a?.detailsViewCount || 0;
              const clicks = a?.linkClickCount || 0;
              const ctr = a?.ctr ?? (sent > 0 ? (clicks / sent) * 100 : 0);

              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                    <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                      <p className="text-[11px] text-slate-600 font-bold">প্রেরিত (Sent)</p>
                      <p className="text-lg font-black text-sky-700 mt-0.5">{formatBengaliDigit(sent)}</p>
                    </div>

                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-[11px] text-slate-600 font-bold">ওপেন (Opened)</p>
                      <p className="text-lg font-black text-indigo-700 mt-0.5">{formatBengaliDigit(opened)}</p>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-[11px] text-slate-600 font-bold">ডিটেইলস পেজ</p>
                      <p className="text-lg font-black text-amber-700 mt-0.5">{formatBengaliDigit(details)}</p>
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-[11px] text-slate-600 font-bold">অফার ক্লিক</p>
                      <p className="text-lg font-black text-emerald-700 mt-0.5">{formatBengaliDigit(clicks)}</p>
                    </div>
                  </div>

                  {/* CTR Performance Gauge */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <span>কনভার্সন ও CTR পারফরম্যান্স:</span>
                      </span>
                      <span className="font-black text-emerald-700 text-sm">
                        {ctr.toFixed(1)}% CTR
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, ctr)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      গড় সফলতার পরিমাপ: প্রতি ১০০ জন পাঠকের মধ্যে {ctr.toFixed(1)} জন সরাসরি অফার লিংকে প্রবেশ করেছেন।
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Action Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedItemForAnalytics(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
