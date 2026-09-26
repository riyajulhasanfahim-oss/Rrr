import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, MessageCircle, MessageSquare, Send, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { rtdbGet, rtdbSet } from '../../lib/rtdb';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

interface UserReferralModalProps {
  onClose: () => void;
}

export default function UserReferralModal({ onClose }: UserReferralModalProps) {
  const { user, userData } = useAuth();
  const [actualRefCode, setActualRefCode] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const initReferral = async () => {
      if (user && userData) {
        try {
          const userCodeData = await rtdbGet<any>(`referral_codes/${user.uid}`);
          if (userCodeData && userCodeData.code) {
            setActualRefCode(userCodeData.code);
          } else {
            const newCode = user.uid.substring(0, 8).toUpperCase();
            await rtdbSet(`referral_codes/${user.uid}`, {
              code: newCode,
              userId: user.uid,
              createdAt: Date.now()
            });
            await rtdbSet(`referral_codes/${newCode}`, {
              code: newCode,
              userId: user.uid,
              createdAt: Date.now()
            });
            setActualRefCode(newCode);
          }

          const wallet = await rtdbGet<any>(`user_wallet/${user.uid}`);
          if (wallet && typeof wallet.walletBalance === 'number') {
            setWalletBalance(wallet.walletBalance);
          }
        } catch (err) {
          console.warn("Could not load referral data from RTDB:", err);
          const fallbackCode = user.uid.substring(0, 8).toUpperCase();
          setActualRefCode(fallbackCode);
        }
      }
    };
    initReferral();
  }, [user, userData]);

  const referralLink = actualRefCode ? `${window.location.origin}/register?ref=${actualRefCode}` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    toast.success('Referral link copied successfully!');
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(actualRefCode);
    setCopiedCode(true);
    toast.success('Referral code copied successfully!');
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join RJ WORLD BD',
          text: `Join RJ WORLD BD using my referral link and start earning!`,
          url: referralLink,
        });
        toast.success('Shared successfully!');
      } catch (error) {
        console.log('Share canceled or failed', error);
      }
    } else {
      handleCopyLink();
    }
  };

  const shareLinks = [
    { name: 'WhatsApp', icon: <MessageCircle className="w-5 h-5" />, color: 'bg-green-500', hover: 'hover:bg-green-600', url: `https://wa.me/?text=Join%20RJ%20WORLD%20BD%20using%20my%20link:%20${encodeURIComponent(referralLink)}` },
    { name: 'Messenger', icon: <MessageSquare className="w-5 h-5" />, color: 'bg-blue-500', hover: 'hover:bg-blue-600', url: `fb-messenger://share/?link=${encodeURIComponent(referralLink)}` },
    { name: 'Facebook', icon: <Share2 className="w-5 h-5" />, color: 'bg-blue-600', hover: 'hover:bg-blue-700', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}` },
    { name: 'SMS', icon: <MessageSquare className="w-5 h-5" />, color: 'bg-green-600', hover: 'hover:bg-green-700', url: `sms:?body=Join%20RJ%20WORLD%20BD%20using%20my%20link:%20${encodeURIComponent(referralLink)}` },
    { name: 'Telegram', icon: <Send className="w-5 h-5" />, color: 'bg-sky-500', hover: 'hover:bg-sky-600', url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Join%20RJ%20WORLD%20BD` },
    { name: 'Email', icon: <Mail className="w-5 h-5" />, color: 'bg-slate-500', hover: 'hover:bg-slate-600', url: `mailto:?subject=Join%20RJ%20WORLD%20BD&body=Join%20RJ%20WORLD%20BD%20using%20my%20link:%20${encodeURIComponent(referralLink)}` },
    { name: 'Instagram', icon: <Share2 className="w-5 h-5" />, color: 'bg-pink-600', hover: 'hover:bg-pink-700', url: `https://www.instagram.com/` },
    { name: 'IMO', icon: <MessageCircle className="w-5 h-5" />, color: 'bg-blue-400', hover: 'hover:bg-blue-500', url: `imo://share/?text=Join%20RJ%20WORLD%20BD%20using%20my%20link:%20${encodeURIComponent(referralLink)}` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto pt-10 pb-10">
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg relative shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-2"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Invite & Earn</h2>
          <p className="text-sm text-slate-500">
            Earn ৳10 commission for every ৳1000 product value your friends purchase.
          </p>
          <div className="mt-4 bg-primary-main/10 text-primary-main rounded-xl p-3 inline-block">
            <p className="text-xs font-bold uppercase tracking-wide">Wallet Balance</p>
            <p className="text-xl font-black">৳{walletBalance.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
            {actualRefCode ? (
               <QRCodeSVG value={referralLink} size={150} level="H" includeMargin={true} />
            ) : (
               <div className="w-[150px] h-[150px] flex items-center justify-center text-slate-400">Loading...</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Referral Code</label>
            <div className="flex">
              <input 
                type="text" 
                readOnly 
                value={actualRefCode || 'Loading...'} 
                className="flex-grow bg-slate-50 border border-slate-200 rounded-l-xl px-4 py-3 text-primary-main font-black focus:outline-none tracking-widest text-center"
              />
              <button 
                onClick={handleCopyCode}
                className="bg-primary-main hover:bg-blue-600 text-white px-5 py-3 rounded-r-xl transition-colors flex items-center justify-center shadow-sm"
              >
                {copiedCode ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Referral Link</label>
            <div className="flex">
              <input 
                type="text" 
                readOnly 
                value={referralLink || 'Loading...'} 
                className="flex-grow bg-slate-50 border border-slate-200 rounded-l-xl px-4 py-3 text-sm text-slate-500 font-medium focus:outline-none truncate"
              />
              <button 
                onClick={handleCopyLink}
                className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-3 rounded-r-xl transition-colors flex items-center justify-center shadow-sm"
              >
                {copiedLink ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide text-center">Share Via</label>
            <div className="flex flex-wrap gap-3 justify-center">
              {shareLinks.map((link) => (
                <a 
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${link.color} ${link.hover} text-white w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 shadow-md`}
                  title={link.name}
                >
                  {link.icon}
                </a>
              ))}
              {navigator.share && (
                <button 
                  onClick={handleNativeShare}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 shadow-sm"
                  title="More options"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
