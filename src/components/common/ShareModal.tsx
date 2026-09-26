import React, { useState } from 'react';
import { X, Copy, Check, Share2, MessageCircle, Send, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
  description?: string;
  badge?: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  title,
  url,
  description,
  badge
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      toast.error('Failed to copy link');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description || title,
          url,
        });
        toast.success('Shared successfully!');
        onClose();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  const shareText = encodeURIComponent(`${title}\n${description ? description + '\n' : ''}${url}`);
  const encodedUrl = encodeURIComponent(url);

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: <MessageCircle className="w-5 h-5" />,
      color: 'bg-[#25D366] text-white hover:bg-[#1ebd59]',
      action: () => window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank')
    },
    {
      name: 'Facebook',
      icon: <Share2 className="w-5 h-5" />,
      color: 'bg-[#1877F2] text-white hover:bg-[#166fe5]',
      action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank')
    },
    {
      name: 'Messenger',
      icon: <MessageSquare className="w-5 h-5" />,
      color: 'bg-[#0084FF] text-white hover:bg-[#0077e6]',
      action: () => {
        // Mobile fallback / Web dialog
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          window.location.href = `fb-messenger://share/?link=${encodedUrl}`;
        } else {
          window.open(`https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=291494419107518&redirect_uri=${encodedUrl}`, '_blank');
        }
      }
    },
    {
      name: 'Telegram',
      icon: <Send className="w-5 h-5" />,
      color: 'bg-[#0088cc] text-white hover:bg-[#0077b5]',
      action: () => window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(title)}`, '_blank')
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-main/10 text-primary-main flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">Share</h3>
                {badge && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate max-w-[220px]">{title}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Quick Copy Link Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Share Link</label>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                readOnly 
                value={url} 
                className="flex-1 px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none font-mono truncate"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2.5 text-xs font-bold rounded-xl text-white bg-primary-main hover:bg-sky-600 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Native Web Share Button (if supported) */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-primary-main" />
              <span>More Share Options on Device</span>
            </button>
          )}

          {/* Social Platforms */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Share via App</label>
            <div className="grid grid-cols-4 gap-2">
              {shareOptions.map((opt) => (
                <button
                  key={opt.name}
                  type="button"
                  onClick={opt.action}
                  className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors text-xs font-medium cursor-pointer group"
                >
                  <div className={`w-9 h-9 rounded-full ${opt.color} flex items-center justify-center shadow-xs transition-transform group-hover:scale-105`}>
                    {opt.icon}
                  </div>
                  <span className="text-[11px] text-slate-600 truncate">{opt.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
