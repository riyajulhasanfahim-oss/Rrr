import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  SupportRole,
  SupportThreadInfo,
  SupportMessage,
  subscribeToRoleThreads,
  subscribeToThreadMessages,
  sendAdminSupportMessage,
  markThreadReadByAdmin,
  updateThreadStatus,
  deleteSupportMessage
} from '../../services/supportChatService';
import { StorageManager } from '../../services/storage/StorageManager';
import ImageLightboxModal from '../../components/common/ImageLightboxModal';
import {
  Inbox,
  Users,
  Store,
  Briefcase,
  Building2,
  Search,
  CheckCircle2,
  Clock,
  Send,
  Image as ImageIcon,
  Loader2,
  X,
  Phone,
  Mail,
  ArrowLeft,
  Trash2,
  ZoomIn,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Bot
} from 'lucide-react';
import toast from 'react-hot-toast';

const GENERAL_QUICK_REPLIES = [
  'আপনার বার্তাটি পেয়েছি, আমরা বিষয়টি খতিয়ে দেখছি।',
  'আপনার বিবরণ যাচাই করা হচ্ছে। অনুগ্রহ করে একটু অপেক্ষা করুন।',
  'আপনার সমস্যাটি সমাধান করা হয়েছে। আর কোনো তথ্য লাগলে জানাবেন।',
  'অনুগ্রহ করে আপনার অর্ডার আইডি অথবা ট্রানজ্যাকশন আইডি পাঠান।'
];

const PHYSICAL_QUICK_REPLIES = [
  'আপনার ফিজিক্যাল সাপোর্ট আবেদনটি গৃহীত হয়েছে। আগামী কার্যদিবসে সকাল ১০টা থেকে বিকাল ৫টার মধ্যে হেড অফিসে আসার অনুরোধ করা হলো।',
  'কাউন্টারে আসার সময় অনুগ্রহ করে আপনার মূল চালান বা অর্ডার রসিদ এবং জাতীয় পরিচয়পত্র সাথে রাখুন।',
  'আপনার পণ্য ড্রপ-অফ বা রিটার্ন আবেদনটি অনুমোদিত হয়েছে। কাউন্টার বুথ নম্বর ২-এ যোগাযোগ করুন।',
  'আপনার নির্ধারিত ভিজিটের সময়সূচি সফলভাবে রেজিস্টার করা হয়েছে।'
];

interface AdminSupportInboxProps {
  defaultTab?: SupportRole;
}

export default function AdminSupportInbox({ defaultTab }: AdminSupportInboxProps) {
  const { user, userData } = useAuth();
  const [searchParams] = useSearchParams();
  const queryTab = searchParams.get('tab') as SupportRole | null;
  const initialTab: SupportRole = queryTab && ['customer', 'vendor', 'reseller', 'physical'].includes(queryTab)
    ? queryTab
    : defaultTab || 'customer';

  const [activeTab, setActiveTab] = useState<SupportRole>(initialTab);
  const [threads, setThreads] = useState<SupportThreadInfo[]>([]);
  const [loadingThreads, setLoadingThreads] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');

  const [selectedThread, setSelectedThread] = useState<SupportThreadInfo | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);

  // Photo attachment state
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string; uploadedUrl: string | null } | null>(null);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Counts for tabs
  const [tabCounts, setTabCounts] = useState<Record<SupportRole, { total: number; unread: number }>>({
    customer: { total: 0, unread: 0 },
    vendor: { total: 0, unread: 0 },
    reseller: { total: 0, unread: 0 },
    physical: { total: 0, unread: 0 }
  });

  // Track thread counts across all 4 roles
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const roles: SupportRole[] = ['customer', 'vendor', 'reseller', 'physical'];

    roles.forEach(r => {
      const unsub = subscribeToRoleThreads(r, (list) => {
        const unreadCount = list.reduce((sum, item) => sum + (item.unreadAdmin || 0), 0);
        setTabCounts(prev => ({
          ...prev,
          [r]: { total: list.length, unread: unreadCount }
        }));
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, []);

  // Subscribe to threads of active tab
  useEffect(() => {
    setLoadingThreads(true);
    const unsub = subscribeToRoleThreads(activeTab, (list) => {
      setThreads(list);
      setLoadingThreads(false);

      // If a thread is already selected, update its local metadata
      setSelectedThread(prev => {
        if (!prev) return null;
        const updated = list.find(t => t.threadId === prev.threadId);
        return updated || prev;
      });
    });

    return () => unsub();
  }, [activeTab]);

  // Subscribe to messages when a thread is selected
  useEffect(() => {
    if (!selectedThread) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    // Mark read for admin
    markThreadReadByAdmin(selectedThread.role, selectedThread.userId).catch(() => {});

    const unsub = subscribeToThreadMessages(selectedThread.threadId, (list) => {
      setMessages(list);
      setLoadingMessages(false);
    });

    return () => unsub();
  }, [selectedThread?.threadId]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleTabChange = (role: SupportRole) => {
    if (role === activeTab) return;
    setActiveTab(role);
    setSelectedThread(null);
    setSearchQuery('');
  };

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
      console.warn('Fallback to base64 for admin support image:', err);
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

  const handleSendReply = async (e?: React.FormEvent, customText?: string) => {
    e?.preventDefault();
    if (!selectedThread || !user) return;

    if (uploadingImage) {
      toast.loading('ছবি আপলোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...', { duration: 1500 });
      return;
    }

    const text = customText !== undefined ? customText.trim() : replyText.trim();
    const finalImageUrl = pendingImage?.uploadedUrl || null;

    if (!text && !finalImageUrl) return;

    try {
      setSending(true);
      if (customText === undefined) {
        setReplyText('');
      }
      setPendingImage(null);

      await sendAdminSupportMessage({
        role: selectedThread.role,
        userId: selectedThread.userId,
        adminId: user.uid,
        adminName: userData?.name || 'RJ World Support Admin',
        text,
        imageUrl: finalImageUrl
      });

      toast.success('উত্তর পাঠানো হয়েছে');
    } catch (err) {
      console.error('Failed to send admin reply:', err);
      toast.error('বার্তা পাঠানো সম্ভব হয়নি');
    } finally {
      setSending(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedThread) return;
    const newStatus = selectedThread.status === 'open' ? 'resolved' : 'open';
    try {
      await updateThreadStatus(selectedThread.role, selectedThread.userId, newStatus);
      setSelectedThread(prev => prev ? { ...prev, status: newStatus } : null);
      toast.success(newStatus === 'resolved' ? 'সমস্যা সমাধানকৃত হিসেবে চিহ্নিত করা হয়েছে' : 'থ্রেড পুনরায় সচল করা হয়েছে');
    } catch (e) {
      toast.error('স্ট্যাটাস পরিবর্তন করা যায়নি');
    }
  };

  const handleDeleteMsg = async (messageId: string) => {
    if (!selectedThread) return;
    if (!window.confirm('আপনি কি এই বার্তাটি মুছে ফেলতে চান?')) return;
    try {
      await deleteSupportMessage(selectedThread.threadId, messageId);
      toast.success('বার্তা মুছে ফেলা হয়েছে');
    } catch (e) {
      toast.error('বার্তা মুছে ফেলা সম্ভব হয়নি');
    }
  };

  // Filter threads
  const filteredThreads = threads.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.userName.toLowerCase().includes(q) ||
      (t.userPhone && t.userPhone.toLowerCase().includes(q)) ||
      (t.userEmail && t.userEmail.toLowerCase().includes(q)) ||
      (t.subject && t.subject.toLowerCase().includes(q)) ||
      (t.lastMessage && t.lastMessage.toLowerCase().includes(q))
    );
  });

  const getRoleLabel = (role: SupportRole) => {
    switch (role) {
      case 'customer':
        return 'কাষ্টমার';
      case 'vendor':
        return 'ভেন্ডর';
      case 'reseller':
        return 'রিসেলার';
      case 'physical':
        return 'ফিজিক্যাল সাপোর্ট';
    }
  };

  const getRoleBadgeStyle = (role: SupportRole) => {
    switch (role) {
      case 'customer':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'vendor':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'reseller':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'physical':
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Top Bar: Tabs for Customer, Vendor, Reseller, Physical */}
      <div className="bg-slate-900 text-white px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary-main/20 text-primary-300 flex items-center justify-center border border-primary-500/30">
            <Inbox className="w-5 h-5 text-primary-300" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
              সাপোর্ট ইনবক্স (Support Inbox)
            </h1>
            <p className="text-[11px] text-slate-400">
              কাষ্টমার, ভেন্ডর, রিসেলার ও ফিজিক্যাল সাপোর্ট রিকোয়েস্ট ব্যবস্থাপনা
            </p>
          </div>
        </div>

        {/* The 4 Dedicated Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => handleTabChange('customer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeTab === 'customer'
                ? 'bg-primary-main text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>কাষ্টমার ({tabCounts.customer.total})</span>
            {tabCounts.customer.unread > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-rose-500 text-white font-bold animate-pulse">
                {tabCounts.customer.unread}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('vendor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeTab === 'vendor'
                ? 'bg-primary-main text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>ভেন্ডর ({tabCounts.vendor.total})</span>
            {tabCounts.vendor.unread > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-purple-500 text-white font-bold animate-pulse">
                {tabCounts.vendor.unread}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('reseller')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeTab === 'reseller'
                ? 'bg-primary-main text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>রিসেলার ({tabCounts.reseller.total})</span>
            {tabCounts.reseller.unread > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-500 text-white font-bold animate-pulse">
                {tabCounts.reseller.unread}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('physical')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
              activeTab === 'physical'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>ফিজিক্যাল সাপোর্ট ({tabCounts.physical.total})</span>
            {tabCounts.physical.unread > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-amber-600 text-white font-bold animate-pulse">
                {tabCounts.physical.unread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Body: Two-Pane Split Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden bg-slate-50">
        {/* Left Pane: Conversation Threads */}
        <div
          className={`w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 ${
            selectedThread ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-slate-100 space-y-2 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`${getRoleLabel(activeTab)} নাম, ফোন বা মেসেজ খুঁজুন...`}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-main outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                সবগুলো ({threads.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('open')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'open'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                সচল ({threads.filter(t => t.status === 'open').length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('resolved')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  statusFilter === 'resolved'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                সমাধানকৃত ({threads.filter(t => t.status === 'resolved').length})
              </button>
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingThreads ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary-main" />
                <span className="text-xs">লোড হচ্ছে...</span>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                  <MessageSquare className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-xs font-semibold text-slate-700">কোনো বার্তা পাওয়া যায়নি</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {searchQuery
                    ? 'অন্য নাম বা নম্বর দিয়ে খুঁজুন'
                    : `এখনো কোনো ${getRoleLabel(activeTab)} মেসেজ পাঠাননি`}
                </p>
              </div>
            ) : (
              filteredThreads.map(thread => {
                const isSelected = selectedThread?.threadId === thread.threadId;
                const isUnread = (thread.unreadAdmin || 0) > 0;

                return (
                  <div
                    key={thread.threadId}
                    onClick={() => setSelectedThread(thread)}
                    className={`p-3 cursor-pointer transition-all flex gap-3 items-start relative hover:bg-slate-50 ${
                      isSelected
                        ? 'bg-sky-50/80 border-l-4 border-primary-main'
                        : isUnread
                        ? 'bg-white font-medium'
                        : 'bg-white'
                    }`}
                  >
                    {/* User Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm overflow-hidden">
                        {thread.userAvatar ? (
                          <img src={thread.userAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          thread.userName?.charAt(0)?.toUpperCase() || 'U'
                        )}
                      </div>
                      <span
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border border-white ${
                          thread.role === 'customer'
                            ? 'bg-blue-600 text-white'
                            : thread.role === 'vendor'
                            ? 'bg-purple-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                        title={getRoleLabel(thread.role)}
                      >
                        {thread.role === 'customer' ? 'C' : thread.role === 'vendor' ? 'V' : 'R'}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h3 className={`text-xs truncate ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                          {thread.userName}
                        </h3>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {thread.lastMessageTime
                            ? new Date(thread.lastMessageTime).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                      </div>

                      {/* Subject / Phone */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                        {thread.userPhone && (
                          <span className="truncate">{thread.userPhone}</span>
                        )}
                        {thread.status === 'resolved' ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 font-semibold text-[9px]">
                            সমাধানকৃত
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 font-semibold text-[9px]">
                            সচল
                          </span>
                        )}
                      </div>

                      {/* Last Message preview */}
                      <p className={`text-[11px] truncate ${isUnread ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                        {thread.lastSenderType === 'admin' && (
                          <span className="text-primary-600 font-medium">আপনি: </span>
                        )}
                        {thread.lastMessage || 'কোনো বার্তা নেই'}
                      </p>
                    </div>

                    {/* Unread Pill */}
                    {isUnread && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold shrink-0 self-center">
                        {thread.unreadAdmin}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Active Conversation or Empty Placeholder */}
        <div
          className={`flex-1 flex flex-col bg-slate-50/50 min-w-0 ${
            !selectedThread ? 'hidden md:flex' : 'flex'
          }`}
        >
          {selectedThread ? (
            <>
              {/* Conversation Header */}
              <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedThread(null)}
                    className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                    title="তালিকা দেখুন"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0 overflow-hidden">
                    {selectedThread.userAvatar ? (
                      <img src={selectedThread.userAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      selectedThread.userName?.charAt(0)?.toUpperCase() || 'U'
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900 truncate">
                        {selectedThread.userName}
                      </h2>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRoleBadgeStyle(selectedThread.role)}`}>
                        {getRoleLabel(selectedThread.role)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                      {selectedThread.userPhone && (
                        <a href={`tel:${selectedThread.userPhone}`} className="flex items-center gap-1 hover:text-primary-main">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{selectedThread.userPhone}</span>
                        </a>
                      )}
                      {selectedThread.userEmail && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[160px]">{selectedThread.userEmail}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Toggle & Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleStatus}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      selectedThread.status === 'resolved'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{selectedThread.status === 'resolved' ? 'সচল করুন (Reopen)' : 'সমাধানকৃত (Resolve)'}</span>
                  </button>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-main" />
                    <span className="text-xs">মেসেজ লোড হচ্ছে...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-6">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                      <MessageSquare className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">এখনো কোনো কথোপকথন শুরু হয়নি</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">নিচের বক্সে বার্তা লিখে সাপোর্ট প্রদান করুন</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isAdmin = msg.senderType === 'admin';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col group ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5 px-1">
                          <span className="font-semibold text-slate-600 flex items-center gap-1">
                            {msg.senderId === 'rj_ai_assistant' || msg.senderName?.includes('AI') ? (
                              <>
                                <Bot className="w-3.5 h-3.5 text-primary-main" />
                                <span className="text-primary-700 font-bold">RJ World AI অ্যাসিস্ট্যান্ট</span>
                              </>
                            ) : isAdmin ? (
                              'এডমিন (আপনি)'
                            ) : (
                              selectedThread.userName
                            )}
                          </span>
                          <span>•</span>
                          <span>
                            {msg.createdAt
                              ? new Date(msg.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </span>
                        </div>

                        <div
                          className={`relative max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 shadow-2xs text-xs sm:text-[13px] leading-relaxed break-words ${
                            isAdmin
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
                                className="max-h-60 max-w-full object-contain rounded-xl group-hover/img:scale-102 transition-transform duration-150"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/25 flex items-center justify-center transition-colors">
                                <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-xs" />
                              </div>
                            </div>
                          )}

                          {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                          {/* Delete Message Button for Admin */}
                          <button
                            type="button"
                            onClick={() => handleDeleteMsg(msg.id)}
                            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-110 cursor-pointer"
                            title="মেসেজ মুছুন"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Reply Chips */}
              <div className="px-3 py-1.5 bg-slate-100/80 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0 no-scrollbar">
                <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  দ্রুত উত্তর:
                </span>
                {(activeTab === 'physical' ? PHYSICAL_QUICK_REPLIES : GENERAL_QUICK_REPLIES).map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendReply(undefined, q)}
                    className="px-2.5 py-1 bg-white hover:bg-sky-50 hover:text-primary-main hover:border-sky-300 text-slate-700 border border-slate-200 rounded-lg shrink-0 transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Attachment Preview Box if an image is selected */}
              {pendingImage && (
                <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex items-center gap-3 relative animate-in fade-in duration-150">
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
                      {uploadingImage ? 'ছবি আপলোড হচ্ছে...' : 'ছবি প্রস্তুত (পাঠাতে Send চাপুন)'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingImage(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                    title="বাতিল করুন"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Hidden File Input for Image Upload */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              {/* Input & Send Form */}
              <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                <form onSubmit={handleSendReply} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2 rounded-xl border border-slate-200 transition-colors flex items-center justify-center cursor-pointer ${
                      pendingImage
                        ? 'text-primary-main bg-sky-50 border-sky-300'
                        : 'text-slate-500 hover:text-primary-main hover:bg-sky-50'
                    }`}
                    title="ছবি বা স্ক্রিনশট পাঠান"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder={`${selectedThread.userName}-কে উত্তর দিন...`}
                    className="flex-1 px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-main outline-none transition-all"
                  />

                  <button
                    type="submit"
                    disabled={sending || uploadingImage || (!replyText.trim() && !pendingImage?.uploadedUrl)}
                    className="px-4 py-2 bg-primary-main text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-sky-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
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
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
                <Inbox className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-sm font-bold text-slate-700">কোনো কথোপকথন নির্বাচন করা হয়নি</h2>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                বাম পাশের তালিকা থেকে যেকোনো {getRoleLabel(activeTab)} এর মেসেজে ক্লিক করে সরাসরি চ্যাট ও সাপোর্ট প্রদান করুন।
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox for zooming photos */}
      <ImageLightboxModal
        isOpen={!!lightboxImage}
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
        title="সাপোর্ট ছবি (Support Photo)"
      />
    </div>
  );
}
