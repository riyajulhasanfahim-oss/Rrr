import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const processedEmail = email.trim().toLowerCase();
    
    if (!processedEmail) {
      toast.error('Please enter your registered email');
      return;
    }
    
    setLoading(true);
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false
      };
      await sendPasswordResetEmail(auth, processedEmail, actionCodeSettings);
      setSubmitted(true);
      toast.success('আপনার ইমেইল এ পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে, লিংক এ ঢোকে পাসওয়ার্ড নতুন করে পাসওয়ার্ড দিয়ে RJ WORLD BD তে এসে সেই নতুন পাসওয়ার্ড দিয়ে লগইন করুন');
    } catch (error: any) {
      console.error('Firebase Auth Error [Password Reset]:', error);
      // For user enumeration protection, if it's user-not-found, we can still show success,
      // but the prompt says: "যদি Firebase error দেয়, তাহলে success message দেখাবে না। তার পরিবর্তে user-friendly error দেখাবে।"
      // and "User email registered না থাকলেও এমন message দেখাতে পারো: If the email is registered, a password reset link will be sent."
      
      if (error.code === 'auth/user-not-found') {
        setSubmitted(true); // Proceed as if successful to prevent enumeration
      } else {
        toast.error('Unable to send reset email. Please try again.');
        setSubmitted(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans py-12">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 sm:p-8 space-y-6 border border-slate-100">
        <div className="text-center">
          <Link to="/" className="inline-block mb-1.5">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              RJ <span className="text-primary-main">WORLD BD</span>
            </span>
          </Link>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Reset Password</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter your registered email and we'll send a reset link.
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all"
                  placeholder="Enter your registered email"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-primary-main hover:bg-sky-600 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? 'Sending link...' : 'Send Reset Link'}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </button>
          </form>
        ) : (
          <div className="rounded-2xl bg-emerald-50 p-5 border border-emerald-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-emerald-900">রিসেট লিংক পাঠানো হয়েছে!</h3>
            <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed font-medium bg-emerald-100/50 p-3 rounded-xl border border-emerald-200/60">
              আপনার ইমেইল এ পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে, লিংক এ ঢোকে পাসওয়ার্ড নতুন করে পাসওয়ার্ড দিয়ে RJ WORLD BD তে এসে সেই নতুন পাসওয়ার্ড দিয়ে লগইন করুন
            </p>
          </div>
        )}

        {!submitted && (
          <div className="text-center pt-2 border-t border-slate-100">
            <Link to="/login" className="inline-flex items-center text-xs font-bold text-primary-main hover:underline">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

