import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  SupportRole,
  SupportMessage,
  getThreadId,
  sendUserSupportMessage,
  subscribeToThreadMessages,
  markThreadReadByUser,
  subscribeUserRoleUnreads,
  triggerAiSupportReply
} from '../../services/supportChatService';
import { StorageManager } from '../../services/storage/StorageManager';
import ImageLightboxModal from '../common/ImageLightboxModal';
import {
  Send,
  Image as ImageIcon,
  Loader2,
  X,
  ZoomIn,
  MessageSquare,
  ShieldCheck,
  User,
  Store,
  Briefcase,
  Building2,
  Bot,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

interface LiveSupportChatBoxProps {
  initialRole?: SupportRole;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  className?: string;
}

export default function LiveSupportChatBox({
  initialRole,
  title = 'সরাসরি এডমিন লাইভ চ্যাট',
  subtitle = 'এডমিন সাপোর্ট ডেস্কের সাথে সার্বক্ষণিক যোগাযোগ',
  onClose,
  className = ''
}: LiveSupportChatBoxProps) {
  const { user, userData } = useAuth();

  // Determine initial role
  const detectedRole: SupportRole = (() => {
    if (initialRole) return initialRole;
    if (userData?.role === 'vendor') return 'vendor';
    if (userData?.role === 'reseller') return 'reseller';
    return 'customer';
  })();

  const [selectedRole, setSelectedRole] = useState<SupportRole>(detectedRole);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [roleUnreads, setRoleUnreads] = useState<Record<SupportRole, number>>({
    customer: 0,
    physical: 0,
    vendor: 0,
    reseller: 0
  });
  const autoSwitchedRef = useRef(false);

  // Photo attachment state
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string; uploadedUrl: string | null } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Listen to unread counts across all support channels
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeUserRoleUnreads(user.uid, (unreads) => {
      setRoleUnreads(unreads);

      // Auto switch to the channel that has unread replies from Admin
      if (!initialRole && !autoSwitchedRef.current) {
        if (unreads.physical > 0 && selectedRole !== 'physical') {
          setSelectedRole('physical');
          autoSwitchedRef.current = true;
        } else if (unreads.customer > 0 && selectedRole !== 'customer') {
          setSelectedRole('customer');
          autoSwitchedRef.current = true;
        }
      }
    });
    return () => unsub();
  }, [user?.uid, initialRole, selectedRole]);

  // Sync role if user data changes
  useEffect(() => {
    if (!initialRole && userData?.role) {
      if (userData.role === 'vendor') setSelectedRole('vendor');
      else if (userData.role === 'reseller') setSelectedRole('reseller');
      else setSelectedRole('customer');
    }
  }, [userData?.role, initialRole]);

  const threadId = user ? getThreadId(selectedRole, user.uid) : null;

  // Real-time subscription to thread messages
  useEffect(() => {
    if (!threadId || !user) {
      setLoading(false);
      setMessages([]);
      return;
    }

    setLoading(true);
    markThreadReadByUser(selectedRole, user.uid).catch(() => {});

    const unsub = subscribeToThreadMessages(threadId, (list) => {
      setMessages(list);
      setLoading(false);
    });

    return () => unsub();
  }, [threadId, selectedRole, user?.uid]);

  // Auto scroll to bottom
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
      console.warn('Fallback to base64 for chat image:', err);
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

      const roleSubject =
        selectedRole === 'vendor'
          ? 'ভেন্ডর স্টোর ও পণ্য সহায়তা'
          : selectedRole === 'reseller'
          ? 'রিসেলার কমিশন ও পে-আউট সহায়তা'
          : 'কাস্টমার অর্ডার ও সাধারণ সহায়তা';

      await sendUserSupportMessage({
        role: selectedRole,
        userId: user.uid,
        userName: userData?.name || (userData as any)?.storeName || user.displayName || 'ব্যবহারকারী',
        userEmail: user.email || '',
        userPhone: userData?.phone || user.phoneNumber || '',
        subject: roleSubject,
        text: msgToSend,
        imageUrl: finalImageUrl
      });

      // AI ASSISTANT TRIGGER:
      // STRICT REQUIREMENT: Only replies to live chat ('customer', 'vendor', 'reseller').
      // NEVER replies to 'physical' support (physical support is answered manually by Admin).
      if (selectedRole !== 'physical' && msgToSend.trim()) {
        setIsAiTyping(true);
        // Fire asynchronously to allow UI to immediately update while AI thinks
        const historyForAi = messages.slice(-6).map(m => ({
          senderType: m.senderType,
          text: m.text
        }));

        triggerAiSupportReply({
          role: selectedRole,
          userId: user.uid,
          userName: userData?.name || (userData as any)?.storeName || user.displayName || 'ব্যবহারকারী',
          message: msgToSend.trim(),
          history: historyForAi
        })
          .catch(err => {
            console.warn('AI reply generation warning:', err);
          })
          .finally(() => {
            setIsAiTyping(false);
          });
      }

      toast.success(
        selectedRole === 'physical'
          ? 'মেসেজ এডমিন প্যানেলে পাঠানো হয়েছে'
          : 'মেসেজ পাঠানো হয়েছে'
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('মেসেজ পাঠানো সম্ভব হয়নি');
    } finally {
      setSending(false);
    }
  };

  const roleLabels = [
    { key: 'customer' as SupportRole, label: 'কাষ্টমার চ্যাট', icon: User, desc: 'অর্ডার ও কেনাকাটা' },
    { key: 'physical' as SupportRole, label: 'ফিজিক্যাল সাপোর্ট', icon: Building2, desc: 'কাউন্টার ও রিটার্ন সার্ভিস' },
    { key: 'vendor' as SupportRole, label: 'ভেন্ডর চ্যাট', icon: Store, desc: 'শপ ও পণ্য' },
    { key: 'reseller' as SupportRole, label: 'রিসেলার চ্যাট', icon: Briefcase, desc: 'কমিশন ও উইথড্রয়াল' },
  ];

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden ${className || 'h-[560px] sm:h-[620px]'}`}>
      {/* Header */}
      <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-primary-main/20 text-primary-400 flex items-center justify-center font-bold border border-primary-500/30">
                <MessageSquare className="w-5 h-5 text-primary-400" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
            </div>
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <span>{title}</span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-normal flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  সরাসরি কানেক্টেড
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {subtitle}
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto max-w-full">
          {/* Role Switcher Pills (Customer / Physical / Vendor / Reseller) */}
          <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700 overflow-x-auto max-w-full">
          {roleLabels.map(r => {
            const Icon = r.icon;
            const active = selectedRole === r.key;
            const unreadCount = roleUnreads[r.key] || 0;

            return (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  setSelectedRole(r.key);
                  if (user?.uid) {
                    markThreadReadByUser(r.key, user.uid).catch(() => {});
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 min-h-[36px] relative ${
                  active
                    ? r.key === 'physical'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : r.key === 'reseller'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-primary-main text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
                title={r.desc}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{r.label}</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="hidden sm:flex w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Role Notice Banner */}
      <div className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
        selectedRole === 'physical'
          ? 'bg-amber-50/90 border-amber-200 text-amber-900'
          : 'bg-sky-50/90 border-sky-100 text-sky-900'
      }`}>
        <div className="flex items-center gap-1.5 font-medium truncate">
          {selectedRole === 'physical' ? (
            <>
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">ফিজিক্যাল সাপোর্ট এর রিপ্লাই প্রধান এডমিন নিজে ম্যানুয়ালি দিয়ে থাকেন।</span>
            </>
          ) : (
            <>
              <Bot className="w-4 h-4 text-primary-main shrink-0" />
              <span className="truncate">RJ WORLD BD স্মার্ট এআই অ্যাসিস্ট্যান্ট লাইভ চ্যাটে তাৎক্ষণিক সহায়তা প্রদান করছে।</span>
            </>
          )}
        </div>
        {selectedRole !== 'physical' && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200 font-semibold shrink-0">
            <Sparkles className="w-3 h-3 text-primary-main" />
            AI অ্যাক্টিভ
          </span>
        )}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 bg-slate-50/60">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary-main" />
            <span className="text-xs">মেসেজ লোড হচ্ছে...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-6">
            <div className="w-12 h-12 rounded-full bg-white shadow-2xs flex items-center justify-center mb-2">
              <MessageSquare className="w-6 h-6 text-primary-main" />
            </div>
            <p className="text-xs font-semibold text-slate-800">
              {selectedRole === 'vendor'
                ? 'ভেন্ডর সাপোর্ট ইনবক্স'
                : selectedRole === 'reseller'
                ? 'রিসেলার সাপোর্ট ইনবক্স'
                : selectedRole === 'physical'
                ? 'ফিজিক্যাল সাপোর্ট ইনবক্স'
                : 'কাষ্টমার সাপোর্ট ইনবক্স'}
            </p>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1">
              {selectedRole === 'physical'
                ? 'ফিজিক্যাল সাপোর্ট সংক্রান্ত আপনার যেকোনো প্রশ্ন বা তথ্যের জন্য বার্তা লিখুন। এডমিন প্যানেল থেকে সরাসরি উত্তর দেওয়া হবে।'
                : 'আপনার প্রশ্ন বা সমস্যার কথা নিচে লিখুন। আপনার মেসেজ সরাসরি এডমিন প্যানেলের সাপোর্ট ইনবক্সে পৌঁছে যাবে।'}
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {selectedRole === 'customer' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSend(undefined, 'আমার অর্ডারটি কখন ডেলিভারি হবে জানতে চাচ্ছিলাম।')}
                    className="px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-primary-main text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    ডেলিভারি আপডেট জানতে চাই
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend(undefined, 'পেমেন্ট সম্পন্ন করেছি, স্ট্যাটাস চেক করবেন?')}
                    className="px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-primary-main text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    পেমেন্ট সংক্রান্ত তথ্য
                  </button>
                </>
              )}

              {selectedRole === 'physical' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSend(undefined, 'আমার ফিজিক্যাল সাপোর্ট আবেদনের অগ্রগতি জানতে চাই।')}
                    className="px-2.5 py-1 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-700 text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    আবেদনের অগ্রগতি
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend(undefined, 'হেড অফিসে আসার উপযুক্ত সময় ও কাউন্টার লোকেশন জানতে চাই।')}
                    className="px-2.5 py-1 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-700 text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    কাউন্টার ভিজিটের সময়
                  </button>
                </>
              )}

              {selectedRole === 'vendor' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSend(undefined, 'আমার ভেন্ডর স্টোরের পে-আউট উইথড্রয়াল স্ট্যাটাস জানতে চাই।')}
                    className="px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-primary-main text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    উইথড্রয়াল পে-আউট
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend(undefined, 'নতুন প্রোডাক্ট লিস্টিং অনুমোদনের জন্য সহায়তা প্রয়োজন।')}
                    className="px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-primary-main text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    প্রোডাক্ট অনুমোদন
                  </button>
                </>
              )}

              {selectedRole === 'reseller' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSend(undefined, 'আমার রিসেলার কমিশন হিসেব ও ব্যালেন্স নিয়ে জানতে চাই।')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    কমিশন অনুসন্ধান
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend(undefined, 'রেফারেল ও টিম আর্নিং উইথড্র করতে সাহায্য চাই।')}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    উইথড্রয়াল রিকোয়েস্ট
                  </button>
                </>
              )}
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
                  <span className="font-semibold text-slate-600 flex items-center gap-1">
                    {isMine ? (
                      `আপনি (${
                        selectedRole === 'vendor'
                          ? 'ভেন্ডর'
                          : selectedRole === 'reseller'
                          ? 'রিসেলার'
                          : selectedRole === 'physical'
                          ? 'ফিজিক্যাল সাপোর্ট'
                          : 'কাষ্টমার'
                      })`
                    ) : msg.senderId === 'rj_ai_assistant' || msg.senderName?.includes('AI') ? (
                      <>
                        <Bot className="w-3.5 h-3.5 text-primary-main" />
                        <span className="text-primary-700 font-bold">RJ World AI অ্যাসিস্ট্যান্ট</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>RJ World এডমিন সাপোর্ট</span>
                      </>
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
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 text-xs sm:text-[13px] leading-relaxed break-words shadow-2xs ${
                    isMine
                      ? selectedRole === 'reseller'
                        ? 'bg-emerald-600 text-white rounded-tr-none'
                        : selectedRole === 'physical'
                        ? 'bg-amber-600 text-white rounded-tr-none'
                        : 'bg-primary-main text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none ring-1 ring-slate-100'
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

        {/* AI Typing Indicator */}
        {isAiTyping && (
          <div className="flex flex-col items-start animate-fade-in">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5 px-1">
              <span className="font-semibold text-primary-main flex items-center gap-1">
                <Bot className="w-3.5 h-3.5" />
                RJ World AI অ্যাসিস্ট্যান্ট
              </span>
              <span>•</span>
              <span className="text-slate-500">লিখছে...</span>
            </div>
            <div className="rounded-2xl rounded-tl-none p-3 bg-white border border-slate-200 ring-1 ring-slate-100 flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-primary-main animate-bounce" />
              <span className="w-2 h-2 rounded-full bg-primary-main animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-primary-main animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
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
            className={`p-2.5 rounded-xl border border-slate-200 min-h-[44px] min-w-[44px] transition-colors flex items-center justify-center cursor-pointer ${
              pendingImage
                ? 'text-primary-main bg-sky-50 border-sky-300'
                : 'text-slate-500 hover:text-primary-main hover:bg-sky-50'
            }`}
            title="ছবি বা স্ক্রিনশট সংযুক্ত করুন"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`এডমিনকে বার্তা লিখুন (${
              selectedRole === 'vendor'
                ? 'ভেন্ডর হিসেবে'
                : selectedRole === 'reseller'
                ? 'রিসেলার হিসেবে'
                : selectedRole === 'physical'
                ? 'ফিজিক্যাল সাপোর্ট হিসেবে'
                : 'কাষ্টমার হিসেবে'
            })...`}
            className="flex-1 px-3.5 py-2.5 min-h-[44px] text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-main outline-none transition-all"
          />

          <button
            type="submit"
            disabled={sending || uploadingImage || (!text.trim() && !pendingImage?.uploadedUrl)}
            className={`px-4 py-2.5 min-h-[44px] text-white rounded-xl text-xs sm:text-sm font-semibold active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer ${
              selectedRole === 'reseller'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : selectedRole === 'physical'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-primary-main hover:bg-sky-600'
            }`}
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

      {/* Lightbox for zooming photos */}
      <ImageLightboxModal
        isOpen={!!lightboxImage}
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
        title="সাপোর্ট ছবি"
      />
    </div>
  );
}
