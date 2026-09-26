import React, { useState, useEffect, useMemo } from 'react';
import Header from '../../../components/layout/Header';
import Footer from '../../../components/layout/Footer';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Wallet, 
  Smartphone, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ShieldCheck, 
  Zap, 
  History, 
  Info,
  Check
} from 'lucide-react';
import { db } from '../../../lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { rtdbGet, rtdbList, rtdbPush, rtdbUpdate, rtdbSubscribe } from '../../../lib/rtdb';
import { getResellerWallet, executeResellerWalletTransaction } from '../../../services/resellerWalletService';
import { ResellerTransactionType } from '../../../types/resellerWallet';
import toast from 'react-hot-toast';

interface WithdrawalRecord {
  id: string;
  amount: number;
  method: string;
  paymentMethod?: string;
  mobileNumber?: string;
  paymentNumber?: string;
  accountNumber?: string;
  accountType?: string;
  status: string;
  createdAt: number;
  transactionRef?: string;
  adminNote?: string;
}

export default function ResellerWithdraw() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  
  const [method, setMethod] = useState<'bKash' | 'Nagad' | 'Rocket' | 'Upay'>('bKash');
  const [accountType, setAccountType] = useState<'Personal' | 'Agent'>('Personal');
  const [mobileNumber, setMobileNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [heldBalance, setHeldBalance] = useState(0);
  const [history, setHistory] = useState<WithdrawalRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Fetch Reseller Wallet & Withdrawal History
  const fetchData = async () => {
    if (!user) return;
    try {
      setHistoryLoading(true);
      // 1. Fetch Wallet from Firestore & RTDB
      let rBal = 0;
      let rHeld = 0;

      try {
        const uRtdb = await rtdbGet<any>(`users/${user.uid}`);
        if (uRtdb) {
          rBal = Number(uRtdb.resellerBalance) || 0;
          rHeld = Number(uRtdb.resellerHeldBalance) || 0;
        }
      } catch (e) {}

      try {
        const wallet = await getResellerWallet(user.uid);
        if (wallet) {
          if (typeof wallet.availableBalance === 'number') {
            rBal = wallet.availableBalance;
          }
          if (typeof wallet.lockedBalance === 'number') {
            rHeld = wallet.lockedBalance;
          }
        }
      } catch (e) {}

      setWalletBalance(rBal);
      setHeldBalance(rHeld);

      // 2. Fetch withdrawal history strictly from RTDB
      const rtdbListRes = await rtdbList<any>('withdrawals', (w) => w.userId === user.uid && w.accountType === 'Reseller').catch(() => []);

      const map = new Map<string, WithdrawalRecord>();
      rtdbListRes.forEach(item => {
        if (item.id) {
          map.set(item.id, {
            id: item.id,
            ...item.data,
            method: item.data?.paymentMethod || item.data?.method || 'bKash',
            accountNumber: item.data?.accountNumber || item.data?.paymentNumber || item.data?.mobileNumber || '',
            amount: Number(item.data?.amount) || 0,
            status: item.data?.status || 'Pending',
            createdAt: item.data?.createdAt || Date.now()
          });
        }
      });

      const fetchedReqs = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setHistory(fetchedReqs);
    } catch (error) {
      console.error("Error fetching reseller withdraw data:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Live subscription to RTDB withdrawals
    if (!user) return;
    const unsub = rtdbSubscribe<any>('withdrawals', (snap) => {
      if (!snap) return;
      const resellerWithdrawals: WithdrawalRecord[] = [];
      Object.keys(snap).forEach(key => {
        const item = snap[key];
        if (item && item.userId === user.uid && item.accountType === 'Reseller') {
          resellerWithdrawals.push({
            id: key,
            ...item,
            method: item.paymentMethod || item.method || 'bKash',
            accountNumber: item.accountNumber || item.paymentNumber || item.mobileNumber || '',
            amount: Number(item.amount) || 0,
            status: item.status || 'Pending',
            createdAt: item.createdAt || Date.now()
          });
        }
      });
      if (resellerWithdrawals.length > 0) {
        resellerWithdrawals.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setHistory(resellerWithdrawals);
      }
    });

    return () => {
      if (unsub) unsub();
    };
  }, [user?.uid]);

  // Balance calculations
  const withdrawableBalance = walletBalance;
  const pendingAmount = useMemo(() => {
    return history
      .filter(h => h.status === 'Pending')
      .reduce((sum, h) => sum + (h.amount || 0), 0);
  }, [history]);
  const displayTotal = withdrawableBalance + (heldBalance || pendingAmount);

  // Quick preset amount buttons
  const presetAmounts = [100, 300, 500, 1000, 2000];

  const handleSelectPreset = (val: number) => {
    setAmount(val.toString());
  };

  const handleSelectMax = () => {
    const rounded = Math.floor(withdrawableBalance);
    if (rounded > 0) {
      setAmount(rounded.toString());
    } else {
      toast.error('উত্তলনযোগ্য ব্যালেন্স নেই');
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!method) {
      toast.error('অনুগ্রহ করে একটি পেমেন্ট মেথড নির্বাচন করুন');
      return;
    }
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('একটি সঠিক টাকার পরিমাণ লিখুন');
      return;
    }

    if (numAmount < 100) {
      toast.error('সর্বনিম্ন উইথড্র পরিমাণ ৳১০০');
      return;
    }
    
    if (numAmount > withdrawableBalance) {
      toast.error('আপনার একাউন্টে পর্যাপ্ত উত্তলনযোগ্য ব্যালেন্স নেই');
      return;
    }

    // Check for existing pending requests
    const hasPending = history.some(w => w.status === 'Pending');
    if (hasPending) {
      toast.error('আপনার ইতিমধ্যে একটি পেন্ডিং উইথড্র রিকোয়েস্ট রয়েছে');
      return;
    }
    
    const cleanNumber = mobileNumber.replace(/\D/g, '');
    if (cleanNumber.length !== 11 || !cleanNumber.startsWith('01')) {
      toast.error('একটি সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)');
      return;
    }

    try {
      setLoading(true);
      
      const requestData: any = {
        userId: user.uid,
        userName: userData?.name || 'Reseller',
        userEmail: user.email || '',
        userPhone: cleanNumber,
        method,
        paymentMethod: method,
        accountType: 'Reseller',
        mfsAccountType: accountType || 'Personal',
        mobileNumber: cleanNumber,
        paymentNumber: cleanNumber,
        accountNumber: cleanNumber,
        amount: numAmount,
        netAmount: numAmount,
        fee: 0,
        status: 'Pending',
        source: 'reseller',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // 1. Push to RTDB 'withdrawals' (Admin Panel monitors this)
      const withdrawKey = await rtdbPush('withdrawals', requestData);

      // 2. Atomically update Reseller Wallet in RTDB using runTransaction
      try {
        await executeResellerWalletTransaction({
          resellerId: user.uid,
          userId: user.uid,
          orderId: withdrawKey,
          amount: numAmount,
          type: ResellerTransactionType.WITHDRAWAL,
          status: 'PENDING',
          description: `Reseller withdrawal request (${method} - ${cleanNumber})`,
          metadata: {
            method,
            accountNumber: cleanNumber,
            accountType: accountType || 'Personal'
          }
        });
      } catch (rErr) {
        console.warn('Error adjusting reseller balance in RTDB:', rErr);
      }

      // 4. Add Transaction Record
      await rtdbPush('wallet_transactions', {
        userId: user.uid,
        userName: userData?.name || 'Reseller',
        type: 'Withdraw',
        amount: numAmount,
        status: 'Pending',
        paymentMethod: method,
        withdrawId: withdrawKey,
        description: `Reseller withdraw request (${method} - ${cleanNumber})`,
        createdAt: Date.now()
      }).catch(() => {});

      // 5. Notify Admin in RTDB
      await rtdbPush('vendor_notifications', {
        userId: 'admin',
        title: 'নতুন রিসেলার উইথড্র রিকোয়েস্ট',
        message: `${userData?.name || 'রিসেলার'} ৳${numAmount} উত্তোলনের রিকোয়েস্ট পাঠিয়েছে (${method} - ${cleanNumber})`,
        read: false,
        type: 'withdraw',
        withdrawId: withdrawKey,
        timestamp: Date.now()
      }).catch(() => {});
      
      toast.success('উইথড্র রিকোয়েস্ট সফলভাবে সাবমিট হয়েছে এবং এডমিন প্যানেলে পাঠানো হয়েছে!');
      setAmount('');
      setMobileNumber('');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('উইথড্র রিকোয়েস্ট জমা দিতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const numAmount = parseFloat(amount) || 0;
  const isOverBalance = numAmount > withdrawableBalance;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-grow pt-3 sm:pt-6 pb-24 md:pb-16 px-3 sm:px-6">
        <div className="max-w-4xl mx-auto w-full">
          
          {/* Top Navigation & Breadcrumb */}
          <div className="flex items-center justify-between mb-3 sm:mb-5">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate('/reseller/dashboard')} 
                className="p-1.5 sm:p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
                title="Back to Reseller Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">
                  উইথড্র / Withdraw Funds
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  bKash, Nagad, Rocket ও Upay এর মাধ্যমে দ্রুত টাকা উত্তোলন
                </p>
              </div>
            </div>

            <button 
              onClick={() => navigate('/reseller/commissions')} 
              className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-primary-main bg-sky-50 px-3 py-1.5 rounded-xl hover:bg-sky-100 transition-colors cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              <span>Commission History</span>
            </button>
          </div>

          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
            
            {/* Left Column (Withdrawal Form) */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Balance Summary Card */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                  <Wallet className="w-28 h-28" />
                </div>
                
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
                      উত্তলনযোগ্য ব্যালেন্স (Withdrawable)
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5 text-white">
                      ৳{withdrawableBalance.toFixed(2)}
                    </h2>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] sm:text-[11px] text-slate-400 block font-medium">মোট ব্যালেন্স</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-200">
                      ৳{displayTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Sub info row: Pending / Fee info */}
                <div className="relative z-10 mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>প্রসেসিংয়ে আছে: <strong className="text-amber-400">৳{(heldBalance || pendingAmount).toFixed(2)}</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                    <Zap className="w-3.5 h-3.5" />
                    <span>থার্ড পার্টি ফি: ৳০ (ফ্রি)</span>
                  </div>
                </div>
              </div>

              {/* Payment Method Selection (bKash, Nagad, Rocket, Upay) */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xs border border-slate-200/80">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-primary-main" />
                    <span>পেমেন্ট মেথড নির্বাচন করুন</span>
                  </label>
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Active MFS
                  </span>
                </div>

                {/* 4 MFS Cards: bKash, Nagad, Rocket, Upay */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  
                  {/* Card 1: bKash */}
                  <button
                    type="button"
                    onClick={() => setMethod('bKash')}
                    className={`relative rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 select-none min-h-[96px] sm:min-h-[110px] touch-manipulation active:scale-[0.98] ${
                      method === 'bKash'
                        ? 'border-2 border-[#e2136e] bg-[#fdf2f7] ring-2 ring-[#e2136e]/20 shadow-sm'
                        : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                    }`}
                  >
                    {method === 'bKash' && (
                      <span className="absolute top-1.5 left-1.5 bg-[#e2136e] text-white rounded-full p-0.5 shadow-2xs">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                      </span>
                    )}
                    <span className="absolute top-1.5 right-1.5 bg-[#e2136e] text-white text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.2 rounded-full tracking-wider leading-none shadow-2xs">
                      MFS
                    </span>
                    <div className="h-8 sm:h-9 flex items-center justify-center mt-1 pointer-events-none">
                      <svg viewBox="0 0 110 36" className="h-6 sm:h-7.5 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 24L10 8L15 8C18 8 19.5 9.5 19.5 12C19.5 13.5 18.8 14.5 17.5 15C19.2 15.6 20 17 20 19C20 22 18 24 14.5 24L10 24ZM13 15L14.5 15C16 15 16.8 14.3 16.8 13.2C16.8 12.1 16 11.5 14.5 11.5L13 11.5L13 15ZM13 21.2L14.8 21.2C16.5 21.2 17.3 20.3 17.3 19C17.3 17.7 16.5 16.8 14.8 16.8L13 16.8L13 21.2Z" fill="#e2136e"/>
                        <path d="M22 24L22 8L25 8L25 17L30.5 8L34.5 8L28.5 17L35 24L31 24L26 18.2L25 19.5L25 24L22 24Z" fill="#e2136e"/>
                        <path d="M39.5 24L39 22.2C38 23.6 36.8 24.2 35.5 24.2C33.2 24.2 32 22.8 32 20.5C32 17.8 34.2 16.8 39 16.8L39 16.2C39 15 38.2 14.2 36.8 14.2C35.5 14.2 34.5 14.7 33.8 15.2L33 13.2C34.2 12.4 35.8 12 37.2 12C40.2 12 41.8 13.5 41.8 16.5L41.8 24L39.5 24ZM39 18.8C36 18.8 34.5 19.3 34.5 20.8C34.5 21.9 35.2 22.5 36.3 22.5C38 22.5 39 21.3 39 19.8L39 18.8Z" fill="#e2136e"/>
                        <path d="M47 15C46 14.2 45 13.8 44 13.8C42.8 13.8 42.2 14.4 42.2 15C42.2 15.9 43.2 16.4 45 17C47.8 18 49 19.2 49 21.2C49 23.2 47.2 24.2 44.5 24.2C42.8 24.2 41.2 23.6 40.2 22.8L41.2 20.8C42.2 21.6 43.5 22 44.5 22C45.8 22 46.5 21.5 46.5 20.8C46.5 19.9 45.5 19.3 43.5 18.5C41.2 17.6 40 16.5 40 14.8C40 13 41.5 12 43.8 12C45.2 12 46.6 12.6 47.5 13.2L47 15Z" fill="#e2136e"/>
                        <path d="M51 24L51 8L53.8 8L53.8 14.2C54.8 13.2 55.8 12.6 57.2 12.6C59.6 12.6 61 14.4 61 17.2L61 24L58.2 24L58.2 17.5C58.2 15.8 57.3 14.8 56 14.8C54.5 14.8 53.8 16 53.8 17.8L53.8 24L51 24Z" fill="#e2136e"/>
                        <path d="M72 8L86 16L78 24L72 8Z" fill="#e2136e"/>
                        <path d="M78 24L92 25L86 16L78 24Z" fill="#d00b61"/>
                        <path d="M72 8L78 24L68 32L72 8Z" fill="#b80852"/>
                        <path d="M68 32L78 24L82 34L68 32Z" fill="#e2136e"/>
                      </svg>
                    </div>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-800 mt-1">
                      বিকাশ
                    </span>
                  </button>

                  {/* Card 2: Nagad */}
                  <button
                    type="button"
                    onClick={() => setMethod('Nagad')}
                    className={`relative rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 select-none min-h-[96px] sm:min-h-[110px] touch-manipulation active:scale-[0.98] ${
                      method === 'Nagad'
                        ? 'border-2 border-[#f7941d] bg-[#fff7ed] ring-2 ring-[#f7941d]/20 shadow-sm'
                        : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                    }`}
                  >
                    {method === 'Nagad' && (
                      <span className="absolute top-1.5 left-1.5 bg-[#f7941d] text-white rounded-full p-0.5 shadow-2xs">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                      </span>
                    )}
                    <span className="absolute top-1.5 right-1.5 bg-[#ee3124] text-white text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.2 rounded-full tracking-wider leading-none shadow-2xs">
                      MFS
                    </span>
                    <div className="h-8 sm:h-9 flex items-center justify-center mt-1 pointer-events-none">
                      <svg viewBox="0 0 100 36" className="h-6 sm:h-7.5 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="18" cy="18" r="13" fill="#f7941d" />
                        <path d="M18 7C21 10 22 14 20 17C18 20 14 21 12 24C10 20 11 15 14 11C15.5 9 17 7.8 18 7Z" fill="#fff"/>
                        <circle cx="19" cy="16" r="3.2" fill="#ee3124"/>
                        <text x="36" y="24" fontFamily="sans-serif" fontWeight="900" fontSize="18" fill="#f7941d">নগদ</text>
                      </svg>
                    </div>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-800 mt-1">
                      নগদ
                    </span>
                  </button>

                  {/* Card 3: Rocket */}
                  <button
                    type="button"
                    onClick={() => setMethod('Rocket')}
                    className={`relative rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 select-none min-h-[96px] sm:min-h-[110px] touch-manipulation active:scale-[0.98] ${
                      method === 'Rocket'
                        ? 'border-2 border-[#8c3494] bg-[#faf5ff] ring-2 ring-[#8c3494]/20 shadow-sm'
                        : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                    }`}
                  >
                    {method === 'Rocket' && (
                      <span className="absolute top-1.5 left-1.5 bg-[#8c3494] text-white rounded-full p-0.5 shadow-2xs">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                      </span>
                    )}
                    <span className="absolute top-1.5 right-1.5 bg-[#8c3494] text-white text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.2 rounded-full tracking-wider leading-none shadow-2xs">
                      DBBL
                    </span>
                    <div className="h-8 sm:h-9 flex items-center justify-center mt-1 pointer-events-none">
                      <svg viewBox="0 0 100 36" className="h-6 sm:h-7.5 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 26L20 8L26 20L10 26Z" fill="#8c3494"/>
                        <path d="M20 8L30 13L26 20L20 8Z" fill="#aa42b4"/>
                        <path d="M26 20L34 28L18 24L26 20Z" fill="#6d1e75"/>
                        <text x="38" y="24" fontFamily="sans-serif" fontWeight="900" fontSize="17" fill="#8c3494">রকেট</text>
                      </svg>
                    </div>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-800 mt-1">
                      রকেট
                    </span>
                  </button>

                  {/* Card 4: Upay */}
                  <button
                    type="button"
                    onClick={() => setMethod('Upay')}
                    className={`relative rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 select-none min-h-[96px] sm:min-h-[110px] touch-manipulation active:scale-[0.98] ${
                      method === 'Upay'
                        ? 'border-2 border-[#004b93] bg-[#f0f7ff] ring-2 ring-[#004b93]/20 shadow-sm'
                        : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                    }`}
                  >
                    {method === 'Upay' && (
                      <span className="absolute top-1.5 left-1.5 bg-[#004b93] text-white rounded-full p-0.5 shadow-2xs">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                      </span>
                    )}
                    <span className="absolute top-1.5 right-1.5 bg-[#004b93] text-white text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.2 rounded-full tracking-wider leading-none shadow-2xs">
                      UCB
                    </span>
                    <div className="h-8 sm:h-9 flex items-center justify-center mt-1 pointer-events-none">
                      <svg viewBox="0 0 100 36" className="h-6 sm:h-7.5 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="16" cy="18" r="12" fill="#FFC72C" />
                        <path d="M16 9C19 12 19.5 15.5 16 19.5C13 15.5 13.5 12 16 9Z" fill="#004b93"/>
                        <text x="35" y="24" fontFamily="sans-serif" fontWeight="900" fontSize="17" fill="#004b93">উপায়</text>
                      </svg>
                    </div>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-800 mt-1">
                      উপায়
                    </span>
                  </button>
                </div>

                {/* Account Type Selector (Personal vs Agent) */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">অ্যাকাউন্টের ধরন:</span>
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setAccountType('Personal')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        accountType === 'Personal'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Personal (পার্সোনাল)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType('Agent')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        accountType === 'Agent'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Agent (এজেন্ট)
                    </button>
                  </div>
                </div>
              </div>

              {/* Form Input Fields */}
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xs border border-slate-200/80 space-y-4">
                
                {/* Mobile Number Field */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs sm:text-sm font-bold text-slate-800">
                      {method} অ্যাকাউন্ট নম্বর
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      ১১ ডিজিট (01XXXXXXXXX)
                    </span>
                  </div>

                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-500 font-bold text-xs pointer-events-none border-r border-slate-200 pr-2">
                      <span>🇧🇩 +88</span>
                    </div>
                    <input
                      type="tel"
                      maxLength={11}
                      placeholder="01XXXXXXXXX"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-20 pr-3 py-2.5 rounded-xl text-sm font-bold tracking-wider border border-slate-200 focus:outline-none focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 text-slate-900 bg-slate-50/50 focus:bg-white transition-colors"
                      required
                    />
                    {mobileNumber.length === 11 && mobileNumber.startsWith('01') && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        ✓ Valid
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount Field */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs sm:text-sm font-bold text-slate-800">
                      উত্তোলনের পরিমাণ (৳)
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      সর্বনিম্ন: ৳১০০
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">
                      ৳
                    </span>
                    <input
                      type="number"
                      placeholder="0.00"
                      min="100"
                      step="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl text-base sm:text-lg font-black tracking-tight border border-slate-200 focus:outline-none focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 text-slate-900 bg-slate-50/50 focus:bg-white transition-colors"
                      required
                    />
                  </div>

                  {/* Preset Amount Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {presetAmounts.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleSelectPreset(p)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          amount === p.toString()
                            ? 'bg-primary-main text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        ৳{p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleSelectMax}
                      className="px-2.5 py-1 rounded-lg text-xs font-black bg-sky-50 text-primary-main hover:bg-sky-100 transition-colors ml-auto cursor-pointer"
                    >
                      সর্বোচ্চ (Max)
                    </button>
                  </div>

                  {/* Insufficient balance warning */}
                  {isOverBalance && (
                    <p className="mt-2 text-xs font-semibold text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      আপনার উত্তলনযোগ্য ব্যালেন্সের চেয়ে বেশি পরিমাণ চাওয়া হয়েছে
                    </p>
                  )}
                </div>

                {/* Calculation Summary Box & Fee Disclosure Notice */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>উত্তোলনের পরিমাণ:</span>
                    <span className="font-bold text-slate-900">৳{numAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>থার্ড পার্টি ফি:</span>
                    <span className="font-bold text-emerald-600">৳০.০০ (কোনো থার্ড পার্টি ফি নেই)</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200/80 flex justify-between font-extrabold text-slate-900">
                    <span>আপনার {method} অ্যাকাউন্টে পাবেন:</span>
                    <span className="text-primary-main text-sm font-black">৳{numAmount.toFixed(2)}</span>
                  </div>

                  {/* Fee Disclosure Notice */}
                  <div className="mt-2 pt-2 border-t border-slate-200/70 bg-amber-50/80 rounded-lg p-2.5 text-[11px] text-amber-900 leading-relaxed flex items-start gap-1.5">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>পেমেন্ট ফি সম্পর্কিত নোটিশ:</strong> পেমেন্ট করার ফি ব্যালেন্স থেকে কাটা হবে। এখানে কোনো থার্ড পার্টি ফি নেই, তবে বিকাশ, নগদ, রকেট ও উপায় সেন্ড মানি ফি প্রযোজ্য (যা ব্যালেন্স থেকে সমন্বয় করা হবে)।
                    </span>
                  </div>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={
                    loading || 
                    !method || 
                    !amount || 
                    numAmount < 100 || 
                    isOverBalance || 
                    mobileNumber.length !== 11
                  }
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold text-sm sm:text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>রিকোয়েস্ট প্রসেস হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>উইথড্র রিকোয়েস্ট নিশ্চিত করুন</span>
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] text-slate-400 mt-2">
                  উইথড্র রিকোয়েস্ট সর্বোচ্চ ২৪ ঘণ্টার মধ্যে আপনার একাউন্টে ট্রান্সফার করা হবে।
                </p>
              </form>

            </div>

            {/* Right Column (Instructions, Badges & Withdrawal History) */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Trust & Guarantee Card */}
              <div className="bg-white rounded-2xl p-4 shadow-2xs border border-slate-200/80 space-y-3">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>নিরাপদ ও নির্ভরযোগ্য পেমেন্ট</span>
                </h3>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      ✓
                    </span>
                    <div>
                      <strong className="text-slate-800">পেমেন্ট ও সেন্ড মানি ফি:</strong> কোনো থার্ড-পার্টি ফি নেই, তবে বিকাশ/নগদ/রকেট/উপায় সেন্ড মানি ফি ব্যালেন্স থেকে কাটা হবে।
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      ⏱
                    </span>
                    <div>
                      <strong className="text-slate-800">পেমেন্ট টাইম:</strong> সর্বোচ্চ ২৪ ঘণ্টার মধ্যে ফান্ড স্থানান্তর করা হবে।
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      ৳
                    </span>
                    <div>
                      <strong className="text-slate-800">সীমাবদ্ধতা:</strong> একবারে সর্বনিম্ন ৳১০০ উত্তোলন করা যাবে।
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Withdrawal Requests */}
              <div className="bg-white rounded-2xl p-4 shadow-2xs border border-slate-200/80">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-slate-500" />
                    <span>উইথড্র হিস্ট্রি ({history.length})</span>
                  </h3>
                  <button 
                    onClick={fetchData} 
                    className="text-[11px] font-semibold text-primary-main hover:underline cursor-pointer"
                  >
                    রিফ্রেশ
                  </button>
                </div>

                {historyLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => (
                      <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse"></div>
                    ))}
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-400">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <p className="text-xs text-slate-500">এখনো কোনো উইথড্র রিকোয়েস্ট করেননি</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {history.map(item => (
                      <div 
                        key={item.id}
                        className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                              item.method === 'bKash' ? 'bg-[#fdf2f7] text-[#e2136e]' :
                              item.method === 'Nagad' ? 'bg-[#fff7ed] text-[#f7941d]' :
                              item.method === 'Rocket' ? 'bg-[#faf5ff] text-[#8c3494]' :
                              'bg-[#f0f7ff] text-[#004b93]'
                            }`}>
                              {item.method}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              ৳{item.amount?.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {item.accountNumber || item.mobileNumber || 'N/A'} • {item.createdAt ? new Date(item.createdAt).toLocaleDateString('bn-BD', { month: 'short', day: 'numeric' }) : 'Recent'}
                          </p>
                          {item.transactionRef && (
                            <p className="text-[10px] text-emerald-700 font-mono mt-0.5">
                              Trx: {item.transactionRef}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            item.status === 'Paid' || item.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'Rejected'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {item.status === 'Paid' || item.status === 'Approved' ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : item.status === 'Rejected' ? (
                              <XCircle className="w-2.5 h-2.5" />
                            ) : (
                              <Clock className="w-2.5 h-2.5" />
                            )}
                            <span>{item.status || 'Pending'}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Need Help CTA */}
              <div className="bg-sky-50/70 rounded-2xl p-3.5 border border-sky-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">উইথড্র নিয়ে কোনো সমস্যা?</p>
                  <p className="text-[11px] text-slate-500">আমাদের রিসেলার সাপোর্ট টিমের সাথে কথা বলুন</p>
                </div>
                <button
                  onClick={() => navigate('/reseller/support')}
                  className="px-3 py-1.5 bg-white text-primary-main rounded-lg text-xs font-bold border border-sky-200 hover:bg-sky-50 shadow-2xs transition-colors cursor-pointer"
                >
                  সাহায্য নিন
                </button>
              </div>

            </div>

          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
