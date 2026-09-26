import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, 
  ChevronRight, 
  Facebook, 
  MessageCircle, 
  Mail, 
  Youtube,
  Instagram,
  Phone,
  Send,
  MessageSquare
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Platform icons and data
const socialPlatforms = [
  {
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    bgHover: 'group-hover:bg-blue-50',
    link: '#',
  },
  {
    name: 'Messenger',
    icon: MessageCircle,
    color: 'text-blue-500',
    bgHover: 'group-hover:bg-blue-50',
    link: '#',
  },
  {
    name: 'WhatsApp',
    icon: Phone,
    color: 'text-green-500',
    bgHover: 'group-hover:bg-green-50',
    link: '#',
  },
  {
    name: 'Telegram',
    icon: Send,
    color: 'text-sky-500',
    bgHover: 'group-hover:bg-sky-50',
    link: '#',
  },
  {
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-600',
    bgHover: 'group-hover:bg-pink-50',
    link: '#',
  },
  {
    name: 'YouTube',
    icon: Youtube,
    color: 'text-red-600',
    bgHover: 'group-hover:bg-red-50',
    link: '#',
  },
  {
    name: 'Email',
    icon: Mail,
    color: 'text-slate-600',
    bgHover: 'group-hover:bg-slate-50',
    link: '#',
  }
];

const RippleCard = ({ platform, onClick }: { platform: typeof socialPlatforms[0], onClick: () => void }) => {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  
  const addRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { id: Date.now(), x, y };
    
    setRipples((prev) => [...prev, newRipple]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
    
    onClick();
  };

  const Icon = platform.icon;

  return (
    <button
      onClick={addRipple}
      className="relative w-full flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 group overflow-hidden active:scale-[0.98]"
    >
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.div
            key={ripple.id}
            initial={{ top: ripple.y, left: ripple.x, width: 0, height: 0, opacity: 0.3 }}
            animate={{ top: ripple.y - 100, left: ripple.x - 100, width: 200, height: 200, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={`absolute rounded-full pointer-events-none ${platform.color.replace('text-', 'bg-')}`}
          />
        ))}
      </AnimatePresence>
      
      <div className="flex items-center gap-4 relative z-10">
        <div className={`p-3 rounded-xl transition-colors duration-300 ${platform.bgHover} bg-slate-50`}>
          <Icon className={`w-6 h-6 ${platform.color}`} />
        </div>
        <span className="text-lg font-semibold text-slate-800">{platform.name}</span>
      </div>
      
      <div className="relative z-10">
        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary-main transition-colors" />
      </div>
    </button>
  );
};

export default function BecomeVendorContact() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header / Top Section */}
      <div className="bg-primary-main text-white pt-12 pb-24 px-6 rounded-b-[40px] relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none opacity-20">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full mix-blend-overlay blur-3xl"></div>
          <div className="absolute top-20 -left-10 w-32 h-32 bg-white rounded-full mix-blend-overlay blur-2xl"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center mt-8">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-6 shadow-xl border border-white/30">
            <Store className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3 tracking-tight">Become a Vendor</h1>
          <p className="text-primary-50 text-lg font-medium leading-relaxed max-w-sm">
            আপনার প্রোডাক্ট RJ WORLD BD-এ বিক্রি করতে আমাদের সাথে যোগাযোগ করুন।
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-12 relative z-20">
        {/* Info Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl p-6 shadow-lg shadow-slate-200/50 mb-8 border border-slate-100"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-2xl shrink-0">
              <MessageSquare className="w-6 h-6 text-primary-main" />
            </div>
            <p className="text-slate-600 leading-relaxed text-sm md:text-base pt-1">
              আপনি যদি আপনার ব্যবসা RJ WORLD BD-এ শুরু করতে চান, তাহলে নিচের যেকোনো মাধ্যমে আমাদের সাথে যোগাযোগ করুন। আমাদের টিম আপনার সাথে যোগাযোগ করে Vendor Account খুলে দেবে।
            </p>
          </div>
        </motion.div>

        {/* Social Links */}
        <div className="space-y-3 mb-10">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider pl-2 mb-4">Contact Platforms</h2>
          <div className="grid gap-3">
            {socialPlatforms.map((platform, index) => (
              <motion.div
                key={platform.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <RippleCard 
                  platform={platform} 
                  onClick={() => window.open(platform.link, '_blank')}
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Action Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <button
            onClick={() => navigate('/become-vendor')}
            className="w-full bg-slate-900 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
          >
            <span>Already Contacted? Continue Vendor Registration</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
