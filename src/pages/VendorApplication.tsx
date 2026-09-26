import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function VendorApplication() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/become-vendor', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-primary-main border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-3 text-sm text-slate-500 font-medium">ভেন্ডর রেজিস্ট্রেশন পেজে রিডাইরেক্ট করা হচ্ছে...</p>
    </div>
  );
}
