import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { rtdbGet, rtdbUpdate } from '../../../lib/rtdb';
import { useAuth } from '../../../context/AuthContext';
import { Store, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { checkAccountStatus } from '../../../services/accountStatusService';

export default function VendorLogin() {
  const navigate = useNavigate();
  const { refreshUserData } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot password sub-view
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      toast.error('জিমেইল ও পাসওয়ার্ড প্রদান করুন');
      return;
    }

    setLoading(true);
    try {
      // 1. Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // 2. Check if Vendor exists in RTDB (by UID and by email)
      let isVendor = false;
      let isPending = false;

      // Check vendors doc by UID in RTDB
      const vData = await rtdbGet<any>(`vendors/${user.uid}`).catch(() => null);

      if (vData) {
        const status = (vData.status || '').toLowerCase();
        const isPaid = Boolean(
          vData.registrationPayment === 'completed' ||
          vData.transactionId ||
          vData.verifiedAt ||
          vData.paymentMethod ||
          vData.registrationFee === 0
        );
        if ((status === 'active' || status === 'approved' || status === 'vacation') && isPaid) {
          isVendor = true;
        } else if (status === 'pending' || !isPaid) {
          isPending = true;
        }
      }

      // Check accountStatusService as well for comprehensive verification
      if (!isVendor && !isPending) {
        const statusResult = await checkAccountStatus(cleanEmail, user.uid);
        if (statusResult.hasActiveVendor) {
          isVendor = true;
        } else if (statusResult.isPendingVendor) {
          isPending = true;
        }
      }

      // Check if Admin
      const adminEmails = ['riyajulhasanfahim@gmail.com', 'frofficialbd1@gmail.com', 'mdfahim776154@gmail.com'];
      const uData = await rtdbGet<any>(`users/${user.uid}`).catch(() => null);
      const role = uData?.role;
      const isAdmin = role === 'Admin' || adminEmails.includes(cleanEmail);

      // Handle redirect according to vendor status
      if (isVendor || isAdmin) {
        localStorage.setItem('rj_has_active_vendor_' + user.uid, 'true');
        // Ensure user role is Vendor if not Admin
        if (!isAdmin && role !== 'Vendor') {
          await rtdbUpdate(`users/${user.uid}`, { role: 'Vendor', updatedAt: Date.now() }).catch(() => {});
        }
        await refreshUserData().catch(() => {});
        toast.success('ভেন্ডর লগইন সফল হয়েছে! ড্যাশবোর্ডে প্রবেশ করা হচ্ছে...');
        navigate('/vendor-dashboard', { replace: true });
        return;
      }

      if (isPending) {
        await refreshUserData().catch(() => {});
        toast('আপনার ভেন্ডর আবেদনটি বর্তমানে অনুমোদনের অপেক্ষায় রয়েছে।', { icon: '⏳' });
        navigate('/become-vendor', { replace: true });
        return;
      }

      // If registered as normal customer but not yet vendor
      await refreshUserData().catch(() => {});
      toast.error('এই অ্যাকাউন্টটি ভেন্ডর হিসেবে নিবন্ধিত নয়। অনুগ্রহ করে ভেন্ডর রেজিস্ট্রেশন সম্পন্ন করুন।');
      navigate('/become-vendor');
    } catch (error: any) {
      console.error('Vendor Login Error:', error);
      const code = error?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        toast.error('ভুল জিমেইল বা পাসওয়ার্ড। দয়া করে সঠিক তথ্য দিয়ে পুনরায় চেষ্টা করুন।');
      } else if (code === 'auth/invalid-email') {
        toast.error('সঠিক ফরম্যাটের জিমেইল/ইমেইল লিখুন।');
      } else if (code === 'auth/too-many-requests') {
        toast.error('অতিরিক্ত চেষ্টার কারণে অ্যাকাউন্ট সাময়িক ব্লক। কিছুক্ষণ পর চেষ্টা করুন।');
      } else {
        toast.error(error?.message || 'লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanResetEmail = (resetEmail || email).trim().toLowerCase();

    if (!cleanResetEmail) {
      toast.error('আপনার নিবন্ধিত জিমেইল প্রদান করুন');
      return;
    }

    setResetLoading(true);
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/vendor-login`,
        handleCodeInApp: false
      };
      await sendPasswordResetEmail(auth, cleanResetEmail, actionCodeSettings);
      setResetSent(true);
      toast.success('আপনার ইমেইল এ পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে, লিংক এ ঢোকে পাসওয়ার্ড নতুন করে পাসওয়ার্ড দিয়ে RJ WORLD BD তে এসে সেই নতুন পাসওয়ার্ড দিয়ে লগইন করুন');
    } catch (error: any) {
      console.error('Forgot Password Error:', error);
      if (error?.code === 'auth/user-not-found') {
        setResetSent(true); // User enumeration protection
      } else if (error?.code === 'auth/invalid-email') {
        toast.error('সঠিক ফরম্যাটের জিমেইল লিখুন');
      } else {
        toast.error('পাসওয়ার্ড রিসেট লিংক পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans flex items-center justify-center p-3 sm:p-6 py-8 sm:py-12">
      <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-lg shadow-slate-200/50 p-5 sm:p-8 border border-slate-200/80">
        
        {/* Portal Header */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-3">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              RJ <span className="text-primary-main">WORLD BD</span>
            </span>
          </Link>
          <div className="w-12 h-12 bg-primary-main/10 text-primary-main rounded-2xl flex items-center justify-center mx-auto mb-2 border border-primary-main/20">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isForgotPassword ? 'ভেন্ডর পাসওয়ার্ড রিসেট' : 'ভেন্ডর লগইন'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isForgotPassword 
              ? 'আপনার নিবন্ধিত জিমেইল দিলে পাসওয়ার্ড পরিবর্তনের লিংক পাঠানো হবে' 
              : 'ভেন্ডর ড্যাশবোর্ডে প্রবেশ করতে আপনার জিমেইল ও পাসওয়ার্ড দিন'}
          </p>
        </div>

        {/* FORGOT PASSWORD FORM */}
        {isForgotPassword ? (
          <div className="space-y-4">
            {!resetSent ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Registered Gmail / Email *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      inputMode="email"
                      value={resetEmail || email}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="vendor@example.com"
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-2.5 sm:py-3 px-4 bg-primary-main hover:bg-sky-600 active:scale-[0.99] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-primary-main/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {resetLoading ? 'লিংক পাঠানো হচ্ছে...' : 'Send Reset Link'}
                  {!resetLoading && <ArrowRight className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetSent(false);
                  }}
                  className="w-full inline-flex items-center justify-center text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  ভেন্ডর লগইনে ফিরে যান
                </button>
              </form>
            ) : (
              <div className="space-y-4 text-center">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-left space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    রিসেট লিংক পাঠানো হয়েছে!
                  </div>
                  <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed font-medium">
                    আপনার ইমেইল এ পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে, লিংক এ ঢোকে পাসওয়ার্ড নতুন করে পাসওয়ার্ড দিয়ে RJ WORLD BD তে এসে সেই নতুন পাসওয়ার্ড দিয়ে লগইন করুন
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetSent(false);
                  }}
                  className="w-full py-2.5 sm:py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  লগইনে ফিরে যান
                </button>
              </div>
            )}
          </div>
        ) : (
          /* VENDOR LOGIN FORM */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Vendor Gmail / Email *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vendor@example.com"
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Password *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setIsForgotPassword(true);
                  }}
                  className="text-xs font-bold text-primary-main hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 sm:h-12 bg-primary-main hover:bg-sky-600 active:scale-[0.99] text-white text-xs sm:text-sm md:text-base font-bold rounded-xl shadow-md shadow-primary-main/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span>লগইন হচ্ছে...</span>
              ) : (
                <>
                  <span>Vendor Login</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Quick Links */}
            <div className="pt-4 border-t border-slate-100 space-y-2 text-center text-xs sm:text-sm">
              <div className="text-slate-600">
                নতুন ভেন্ডর হতে চান?{' '}
                <Link to="/become-vendor" className="font-bold text-primary-main hover:underline">
                  ভেন্ডর রেজিস্ট্রেশন করুন
                </Link>
              </div>
              <div className="text-slate-500 pt-1 flex items-center justify-center gap-3">
                <Link to="/reseller-login" className="hover:text-slate-800 font-medium">
                  রিসেলার লগইন
                </Link>
                <span>•</span>
                <Link to="/login" className="hover:text-slate-800 font-medium">
                  কাস্টমার লগইন
                </Link>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
