import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { rtdbGet, rtdbSet } from '../../lib/rtdb';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, Chrome, Facebook, ArrowRight, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthNoticeBanner from '../../components/auth/AuthNoticeBanner';
import { checkAccountStatus, getPostLoginRedirect } from '../../services/accountStatusService';

export default function Login() {
  const navigate = useNavigate();
  const { signInWithGoogle, signInWithFacebook, refreshUserData } = useAuth();
  
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const syncUserProfile = async (user: any, loginEmail: string) => {
    try {
      const existing = await rtdbGet<any>(`users/${user.uid}`);
      if (!existing) {
        const fallbackName = user.displayName || user.email?.split('@')[0] || 'RJ WORLD BD User';
        const now = Date.now();
        await rtdbSet(`users/${user.uid}`, {
          uid: user.uid,
          id: user.uid,
          name: fallbackName,
          email: user.email || loginEmail,
          phone: user.phoneNumber || null,
          photo: user.photoURL || null,
          role: "Customer",
          accountType: "general",
          status: "active",
          balance: 0,
          wallet: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (rtdbErr: any) {
      console.warn('RTDB user profile sync error on login:', rtdbErr);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputVal = emailOrPhone.trim();
    if (!inputVal || !password) {
      toast.error('ইমেইল/ফোন নম্বর এবং পাসওয়ার্ড প্রদান করুন');
      return;
    }
    setLoading(true);

    try {
      let resolvedEmail = inputVal;

      // If user typed a phone number instead of email, resolve it from RTDB
      if (!inputVal.includes('@')) {
        const cleanPhone = inputVal.replace(/[^\d+]/g, '');
        const allUsers = await rtdbGet<Record<string, any>>('users').catch(() => null);
        let foundEmail = '';
        if (allUsers) {
          for (const u of Object.values(allUsers) as any[]) {
            if (u && (u.phone === inputVal || u.phone === cleanPhone || (u.phone && cleanPhone.endsWith(u.phone.replace(/^0+/, ''))))) {
              if (u.email) {
                foundEmail = u.email;
                break;
              }
            }
          }
        }
        if (foundEmail) {
          resolvedEmail = foundEmail;
        } else {
          // If no user found by phone, alert user
          if (cleanPhone.length >= 8) {
            toast.error('এই ফোন নম্বর দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি। অনুগ্রহ করে ইমেইল দিয়ে চেষ্টা করুন।');
            setLoading(false);
            return;
          }
        }
      }

      const userCredential = await signInWithEmailAndPassword(auth, resolvedEmail.trim(), password);
      await syncUserProfile(userCredential.user, resolvedEmail.trim());
      const uData = await refreshUserData();
      toast.success('লগইন সফল হয়েছে!');
      const adminEmails = ['riyajulhasanfahim@gmail.com', 'frofficialbd1@gmail.com', 'mdfahim776154@gmail.com'];
      const isUserAdmin = uData?.role === 'Admin' || adminEmails.includes(resolvedEmail.trim().toLowerCase()) || adminEmails.includes(userCredential.user.email?.toLowerCase() || '');
      if (isUserAdmin) {
        navigate('/admin/dashboard', { replace: true });
      } else if (uData?.role === 'Vendor') {
        navigate('/vendor-dashboard', { replace: true });
      } else if (uData?.role === 'Reseller') {
        navigate('/reseller/dashboard', { replace: true });
      } else {
        // Standard Customer navigates to homepage
        navigate('/', { replace: true });
      }
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthError = (error: any) => {
    console.error('Login Error:', error);
    const code = error?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
      toast.error('ভুল ইমেইল বা পাসওয়ার্ড। অনুগ্রহ করে পুনরায় চেক করুন।');
    } else if (code === 'auth/invalid-email') {
      toast.error('সঠিক ইমেইল ফরম্যাট লিখুন।');
    } else if (code === 'auth/too-many-requests') {
      toast.error('অনেকবার ভুল চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।');
    } else if (code === 'auth/operation-not-allowed') {
      toast.error('লগইন সাময়িকভাবে বন্ধ আছে।');
    } else if (error?.message?.includes('client is offline') || code === 'client-offline') {
      toast.error('ইন্টারনেট সংযোগ চেক করুন।');
    } else {
      toast.error(error.message || 'লগইন ব্যর্থ হয়েছে');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const loggedUser = await signInWithGoogle();
      if (loggedUser) {
        const uData = await refreshUserData();
        const adminEmails = ['riyajulhasanfahim@gmail.com', 'frofficialbd1@gmail.com', 'mdfahim776154@gmail.com'];
        const isUserAdmin = uData?.role === 'Admin' || adminEmails.includes(loggedUser.email?.toLowerCase() || '');
        if (isUserAdmin) {
          navigate('/admin/dashboard', { replace: true });
        } else {
          const accountStatus = await checkAccountStatus(loggedUser.email, loggedUser.uid);
          const destination = getPostLoginRedirect(accountStatus, { isUserAdmin: false, defaultPath: '/' });
          navigate(destination, { replace: true });
        }
      }
    } catch {
      // error handled in context
    }
  };

  const handleFacebookLogin = async () => {
    try {
      const loggedUser = await signInWithFacebook();
      if (loggedUser) {
        const uData = await refreshUserData();
        const adminEmails = ['riyajulhasanfahim@gmail.com', 'frofficialbd1@gmail.com', 'mdfahim776154@gmail.com'];
        const isUserAdmin = uData?.role === 'Admin' || adminEmails.includes(loggedUser.email?.toLowerCase() || '');
        if (isUserAdmin) {
          navigate('/admin/dashboard', { replace: true });
        } else {
          const accountStatus = await checkAccountStatus(loggedUser.email, loggedUser.uid);
          const destination = getPostLoginRedirect(accountStatus, { isUserAdmin: false, defaultPath: '/' });
          navigate(destination, { replace: true });
        }
      }
    } catch {
      // error handled in context
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-sky-50/20 to-slate-100 p-4 sm:p-6 md:p-8 font-sans py-8 sm:py-12 md:py-16">
      <div className="w-full max-w-md sm:max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-slate-200/60 p-5 sm:p-8 md:p-10 space-y-5 border border-slate-100">
        <div className="text-center">
          <Link to="/" className="inline-block mb-2 group">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 group-hover:opacity-90 transition-opacity">
              RJ <span className="text-primary-main">WORLD BD</span>
            </span>
          </Link>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">স্বাগতম (Welcome Back)</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">আপনার অ্যাকাউন্টে লগইন করুন</p>
        </div>

        <AuthNoticeBanner />

        <form onSubmit={handleLogin} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
              ইমেইল অথবা মোবাইল নম্বর
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              </div>
              <input
                type="text"
                required
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                className="block w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all"
                placeholder="you@example.com অথবা 01XXXXXXXXX"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                পাসওয়ার্ড
              </label>
              <Link to="/forgot-password" className="text-xs sm:text-sm font-medium text-primary-main hover:underline">
                পাসওয়ার্ড ভুলে গেছেন?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 sm:pl-11 pr-11 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3 sm:py-3.5 px-4 rounded-xl shadow-md text-sm sm:text-base font-bold text-white bg-primary-main hover:bg-sky-600 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer mt-2"
          >
            {loading ? 'লগইন হচ্ছে...' : 'লগইন করুন (Sign in)'}
            {!loading && <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />}
          </button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white text-slate-400 font-medium">অথবা সোশ্যাল মিডিয়া দিয়ে</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full inline-flex justify-center items-center py-2.5 sm:py-3 px-3 border border-slate-200 rounded-xl shadow-2xs bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
          >
            <Chrome className="h-4 w-4 text-red-500 mr-2 shrink-0" />
            Google
          </button>
          <button
            type="button"
            onClick={handleFacebookLogin}
            className="w-full inline-flex justify-center items-center py-2.5 sm:py-3 px-3 border border-slate-200 rounded-xl shadow-2xs bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
          >
            <Facebook className="h-4 w-4 text-blue-600 mr-2 shrink-0" />
            Facebook
          </button>
        </div>

        <p className="text-center text-xs sm:text-sm text-slate-600 pt-3 border-t border-slate-100">
          অ্যাকাউন্ট নেই?{' '}
          <Link to="/register" className="font-bold text-primary-main hover:underline">
            নতুন অ্যাকাউন্ট তৈরি করুন
          </Link>
        </p>
      </div>
    </div>
  );
}

