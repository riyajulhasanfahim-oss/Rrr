import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MailCheck, ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VerifyEmail() {
  const { user, verifyEmail, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    try {
      await verifyEmail();
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50  p-4">
      <div className="max-w-md w-full bg-white  rounded-2xl shadow-xl p-8 space-y-6 text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary-main/10 mb-6">
          <MailCheck className="h-8 w-8 text-primary-main" />
        </div>
        
        <h2 className="text-3xl font-bold text-gray-900 ">Verify your email</h2>
        
        <p className="text-sm text-gray-500 ">
          We've sent a verification link to<br />
          <span className="font-medium text-gray-900 ">{user?.email}</span>
        </p>

        <p className="text-sm text-gray-500 ">
          Please check your inbox and click the link to verify your account and continue.
        </p>

        <div className="space-y-3 pt-4">
          <button
            onClick={handleResend}
            disabled={loading}
            className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-main hover focus focus focus focus disabled transition-colors"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Sending...' : 'Resend verification email'}
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300  rounded-lg shadow-sm bg-white  text-sm font-medium text-gray-700  hover  transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
