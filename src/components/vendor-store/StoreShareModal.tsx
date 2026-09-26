import React, { useState } from 'react';
import { X, Copy, Check, Share2, Send, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface StoreShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
  storeUrl: string;
  storeLogo?: string;
  primaryColor?: string;
}

export default function StoreShareModal({
  isOpen,
  onClose,
  storeName,
  storeUrl,
  storeLogo,
  primaryColor = '#0284c7'
}: StoreShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    toast.success('স্টোরের লিংক কপি করা হয়েছে!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(`🛍️ "${storeName}" এর আকর্ষণীয় পণ্যসমূহ দেখুন RJ WORLD BD তে:\n${storeUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storeUrl)}`, '_blank');
  };

  const shareToTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(storeUrl)}&text=${encodeURIComponent(storeName)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            {storeLogo ? (
              <img 
                src={storeLogo} 
                alt={storeName} 
                className="w-10 h-10 rounded-xl border border-slate-200 object-cover bg-white"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div 
                className="w-10 h-10 rounded-xl text-white font-bold flex items-center justify-center text-sm shadow-xs"
                style={{ backgroundColor: primaryColor }}
              >
                {storeName.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">{storeName}</h3>
              <p className="text-xs text-slate-500">স্টোর লিংক শেয়ার করুন</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Store URL Copy Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">স্টোরের সরাসরি লিংক</label>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                readOnly 
                value={storeUrl} 
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none font-mono truncate"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3.5 py-2 text-xs font-bold rounded-xl text-white flex items-center gap-1.5 transition-opacity hover:opacity-90 cursor-pointer shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'কপি হয়েছে' : 'কপি করুন'}</span>
              </button>
            </div>
          </div>

          {/* Social Share Icons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">সোশ্যাল প্ল্যাটফর্মে শেয়ার</label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={shareToWhatsApp}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-emerald-100 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 transition-colors text-xs font-medium cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <span>WhatsApp</span>
              </button>
              
              <button
                type="button"
                onClick={shareToFacebook}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-blue-100 bg-blue-50/60 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-medium cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Share2 className="w-4 h-4" />
                </div>
                <span>Facebook</span>
              </button>

              <button
                type="button"
                onClick={shareToTelegram}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-sky-100 bg-sky-50/60 text-sky-700 hover:bg-sky-100 transition-colors text-xs font-medium cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-xs">
                  <Send className="w-4 h-4" />
                </div>
                <span>Telegram</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
