import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invalidCode, setInvalidCode] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    if (!oobCode) {
      setInvalidCode(true);
      setVerifying(false);
    } else {
      verifyPasswordResetCode(auth, oobCode)
        .then(() => {
          setInvalidCode(false);
        })
        .catch(() => {
          setInvalidCode(true);
        })
        .finally(() => {
          setVerifying(false);
        });
    }
  }, [oobCode]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in both password fields');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!oobCode) return;

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-main"></div>
        </div>
      </div>
    );
  }

  if (invalidCode) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white py-8 px-4 shadow-sm sm:rounded-2xl border border-slate-100 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Invalid or Expired Link</h2>
          <p className="text-sm text-slate-600 mb-6">The password reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="text-primary-main hover:underline font-medium text-sm inline-flex items-center">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-2xl sm:px-10 border border-slate-100">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {success ? 'Success' : 'Create New Password'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {success 
                ? 'Your password has been successfully reset.' 
                : 'Please enter your new password below.'}
            </p>
          </div>

          {!success ? (
            <form onSubmit={handleResetPassword} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all"
                    placeholder="At least 6 characters"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 outline-none transition-all"
                    placeholder="Confirm new password"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-primary-main hover:bg-sky-600 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer mt-4"
              >
                {loading ? 'Saving...' : 'Save New Password'}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl bg-emerald-50 p-5 border border-emerald-200 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-emerald-900">Password reset successfully.</h3>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  You can now login with your new password.
                </p>
              </div>
              
              <button
                onClick={() => navigate('/login')}
                className="w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-primary-main hover:bg-sky-600 active:scale-[0.99] transition-all cursor-pointer"
              >
                Go to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
