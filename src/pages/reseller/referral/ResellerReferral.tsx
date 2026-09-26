import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Copy, 
  Share2, 
  MessageCircle, 
  Send, 
  Check, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Gift, 
  Award, 
  ShieldCheck, 
  ExternalLink,
  ArrowRight,
  Sparkles,
  Clock,
  UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import Header from '../../../components/layout/Header';
import Footer from '../../../components/layout/Footer';
import { 
  getOrCreateReferralCode, 
  getReferralStatsAndHistory, 
  REFERRAL_BONUS_AMOUNT,
  type ReferralItem,
  type ReferralStats 
} from '../../../services/resellerReferralService';

export default function ResellerReferral() {
  const { user, userData } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  
  const [actualRefCode, setActualRefCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    totalEarnings: 0,
    activeResellers: 0
  });
  const [history, setHistory] = useState<ReferralItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadReferralData = async () => {
      if (!user) return;
      try {
        setLoading(true);
        // 1. Get or create referral code
        const refInfo = await getOrCreateReferralCode(user.uid, userData?.name);
        if (isMounted) {
          setActualRefCode(refInfo.code);
          setReferralLink(refInfo.referralLink);
        }

        // 2. Fetch stats and referral history
        const { stats: fetchedStats, history: fetchedHistory } = await getReferralStatsAndHistory(user.uid);
        if (isMounted) {
          setStats(fetchedStats);
          setHistory(fetchedHistory);
        }
      } catch (err) {
        console.error('Error loading referral info:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadReferralData();

    return () => {
      isMounted = false;
    };
  }, [user, userData]);

  const handleCopyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    toast.success('রেফারেল লিংক কপি করা হয়েছে!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    if (!actualRefCode) return;
    navigator.clipboard.writeText(actualRefCode);
    setCopiedCode(true);
    toast.success('রেফারেল কোড কপি করা হয়েছে!');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const shareText = `RJ WORLD BD-তে রিসেলার হিসেবে জয়েন করে ঘরে বসেই অনলাইন বিজনেস শুরু করুন! রেজিস্ট্রেশনের সময় আমার রেফারেল কোড ${actualRefCode} ব্যবহার করুন অথবা নিচের লিংকে ক্লিক করুন: ${referralLink}`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'RJ WORLD BD রিসেলার পার্টনার',
          text: `RJ WORLD BD-তে রিসেলার হিসেবে যুক্ত হয়ে ঘরে বসেই আয় করুন! রেফারেল কোড: ${actualRefCode}`,
          url: referralLink,
        });
        toast.success('শেয়ার সম্পন্ন হয়েছে!');
      } catch (error) {
        console.log('Share canceled or failed', error);
      }
    } else {
      handleCopyLink();
    }
  };

  const shareLinks = [
    {
      name: 'WhatsApp',
      icon: <MessageCircle className="w-5 h-5" />,
      color: 'bg-[#25D366] hover:bg-[#1ebd59] text-white',
      url: `https://wa.me/?text=${encodeURIComponent(shareText)}`
    },
    {
      name: 'Facebook',
      icon: <Share2 className="w-5 h-5" />,
      color: 'bg-[#1877F2] hover:bg-[#166fe5] text-white',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`
    },
    {
      name: 'Telegram',
      icon: <Send className="w-5 h-5" />,
      color: 'bg-[#0088cc] hover:bg-[#0077b5] text-white',
      url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('RJ WORLD BD রিসেলার পার্টনার হতে জয়েন করুন! রেফারেল কোড: ' + actualRefCode)}`
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      
      <main className="flex-grow py-4 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full space-y-4 sm:space-y-6">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-primary-main rounded-2xl sm:rounded-3xl p-4 sm:p-7 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-primary-main/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-12 w-40 h-40 bg-sky-400/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-sky-200 text-xs font-bold mb-2.5 border border-white/15">
                <Gift className="w-3.5 h-3.5 text-amber-300" />
                <span>প্রতি সফল রেফারেল-এ নিশ্চিত ২০০ টাকা বোনাস</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white">
                রেফার করুন ও আয় করুন (Referral Program)
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
                আপনার রেফারেল লিংক বা কোড দিয়ে নতুন কেউ রিসেলার হিসেবে জয়েন করলেই সাথে সাথে আপনার ওয়ালেটে <strong className="text-amber-300 font-black">৳{REFERRAL_BONUS_AMOUNT}</strong> যোগ হয়ে যাবে।
              </p>
            </div>

            <div className="shrink-0 bg-white/10 backdrop-blur-md border border-white/15 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-black">
                <Award className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] text-slate-300 font-semibold uppercase tracking-wider">রেফারেল বোনাস রেট</p>
                <p className="text-xl sm:text-2xl font-black text-amber-300 font-mono">৳{REFERRAL_BONUS_AMOUNT} / জন</p>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Metric Stats Cards Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">মোট রেফারেল</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-blue-50 text-primary-main flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <p className="text-lg sm:text-2xl font-black text-slate-900 font-sans truncate">
              {stats.totalReferrals}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate hidden sm:block">আবেদনের সংখ্যা</p>
          </div>

          <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/20 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] sm:text-xs font-bold text-emerald-800 truncate">রেফারেল আয়</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <p className="text-lg sm:text-2xl font-black text-emerald-700 font-sans truncate">
              ৳{stats.totalEarnings}
            </p>
            <p className="text-[10px] sm:text-xs text-emerald-600 font-semibold mt-0.5 truncate hidden sm:block">ওয়ালেটে জমা হয়েছে</p>
          </div>

          <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 truncate">সফল রিসেলার</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <p className="text-lg sm:text-2xl font-black text-slate-900 font-sans truncate">
              {stats.activeResellers}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate hidden sm:block">অ্যাক্টিভ পার্টনার</p>
          </div>
        </div>

        {/* Main Section: Referral Code & Link + QR Code */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          
          {/* Referral Code & Links Card (2 columns on desktop) */}
          <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between space-y-4 sm:space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-primary-main" />
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  আপনার রেফারেল কোড ও লিংক
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                নিচের কোড বা লিংকটি আপনার বন্ধুদের সাথে শেয়ার করুন। তারা যখন একাউন্ট খুলবে, কোডটি ব্যবহার করলে আপনি সাথে সাথে ২০০ টাকা কমিশন পাবেন।
              </p>
            </div>

            {/* 1. Referral Code Box */}
            <div className="bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  রেফারেল কোড (Referral Code)
                </span>
                <span className="text-[11px] text-primary-main font-semibold">১-ক্লিক কপি</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 sm:py-3 font-mono font-black text-base sm:text-xl text-primary-main tracking-widest truncate select-all">
                  {loading ? 'লোড হচ্ছে...' : (actualRefCode || '...')}
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  disabled={loading || !actualRefCode}
                  className={`h-10 sm:h-12 px-4 sm:px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0 ${
                    copiedCode
                      ? 'bg-emerald-600 text-white'
                      : 'bg-primary-main hover:bg-sky-600 text-white'
                  }`}
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>কপি হয়েছে</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>কপি করুন</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 2. Referral Link Box */}
            <div className="bg-slate-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  রেফারেল লিংক (Direct Referral Link)
                </span>
                <span className="text-[11px] text-slate-500 font-medium">লিংকে সরাসরি কোড যুক্ত আছে</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={loading ? 'লোড হচ্ছে...' : referralLink}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-600 font-medium truncate outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={loading || !referralLink}
                  className={`h-10 sm:h-12 px-4 sm:px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer shrink-0 ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>কপি হয়েছে</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>লিংক কপি</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 3. Social Share Buttons */}
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                সরাসরি শেয়ার করুন:
              </p>
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                {shareLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 ${link.color}`}
                  >
                    {link.icon}
                    <span>{link.name}</span>
                  </a>
                ))}

                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-all shadow-2xs active:scale-95 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>অন্যান্য অ্যাপস</span>
                </button>
              </div>
            </div>
          </div>

          {/* QR Code Card (1 column on desktop) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">
              রেফারেল QR কোড
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              মোবাইল ক্যামেরা দিয়ে স্ক্যান করলেই রেজিস্ট্রেশন পেজ চালু হবে
            </p>

            <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-inner mb-4 flex items-center justify-center">
              {referralLink ? (
                <QRCodeSVG 
                  value={referralLink} 
                  size={160} 
                  level="H" 
                  includeMargin={true}
                  className="rounded-lg"
                />
              ) : (
                <div className="w-[160px] h-[160px] bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                  তৈরি হচ্ছে...
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/70 text-center">
              <span className="text-[11px] text-slate-600 font-semibold">
                কোড: <strong className="text-primary-main font-mono">{actualRefCode || '...'}</strong>
              </span>
            </div>
          </div>

        </div>

        {/* How It Works - 3 Step Guide */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              রেফারেল বোনাস যেভাবে কাজ করে
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-primary-main text-white font-black text-xs flex items-center justify-center shrink-0">
                ১
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 mb-0.5">লিংক বা কোড পাঠান</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  আপনার রেফারেল কোড বা লিংকটি মেসেঞ্জার, হোয়াটসঅ্যাপ বা ফেসবুকে বন্ধুদের দিন।
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-primary-main text-white font-black text-xs flex items-center justify-center shrink-0">
                ২
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 mb-0.5">রিসেলার অ্যাকাউন্ট চালু</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  আপনার বন্ধু রেফারেল কোড ব্যবহার করে রিসেলার রেজিস্ট্রেশন ও ফি পরিশোধ করবে।
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                ৩
              </div>
              <div>
                <h3 className="text-xs font-bold text-emerald-950 mb-0.5">ইন্সট্যান্ট ৳২০০ লাভ</h3>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  রেজিস্ট্রেশন সম্পূর্ণ হওয়ার সাথে সাথেই আপনার ওয়ালেটে ২০০ টাকা জমা হয়ে যাবে।
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Referral History / Joined Resellers */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                আপনার রেফারেল হিস্ট্রি ({history.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              মোট আয়: <strong className="text-emerald-600 font-mono">৳{stats.totalEarnings}</strong>
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              তথ্য লোড হচ্ছে...
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-slate-500 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-700">এখনো কোনো রেফারেল রেকর্ড নেই</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                উপরে আপনার রেফারেল লিংক বা কোড কপি করে বন্ধুদের সাথে শেয়ার করুন এবং প্রতিটি জয়েনিংয়ে ২০০ টাকা করে আয় শুরু করুন।
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-3 sm:p-3.5 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary-main/10 text-primary-main font-bold text-xs flex items-center justify-center shrink-0">
                      {item.referredName ? item.referredName.charAt(0).toUpperCase() : 'R'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {item.referredName}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(item.createdAt).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-100 text-emerald-800 font-mono">
                      +৳{item.bonusAmount || REFERRAL_BONUS_AMOUNT}
                    </span>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">সফল রেফারেল</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      <Footer />
    </div>
  );
}
