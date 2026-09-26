import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';

export default function CoverFlashBanner() {
  const navigate = useNavigate();

  // Real-time ticking countdown timer (starts from 06:59:09 to match the user reference)
  const [timeLeft, setTimeLeft] = useState({
    hours: 6,
    minutes: 59,
    seconds: 9
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        }
        if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        }
        if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: 6, minutes: 59, seconds: 59 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatNum = (n: number) => String(n).padStart(2, '0');

  const handleCtaClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/category/all?deal=flash');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-8 pt-2 sm:pt-3.5">
      <div 
        onClick={() => navigate('/category/all?deal=flash')}
        className="relative w-full h-[120px] xs:h-[140px] sm:h-[185px] md:h-[225px] lg:h-[260px] rounded-2xl overflow-hidden shadow-sm border border-amber-500/30 cursor-pointer select-none transition-all duration-300 hover:shadow-md group"
        style={{
          background: 'linear-gradient(115deg, #d80f0f 0%, #ea2310 38%, #f85b00 78%, #ff6e00 100%)'
        }}
      >
        {/* Dynamic Energy Slash / Speed Lines in Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Ambient Glows */}
          <div className="absolute -top-12 -left-12 w-48 sm:w-64 h-48 sm:h-64 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-52 sm:w-72 h-52 sm:h-72 bg-yellow-400/25 rounded-full blur-3xl pointer-events-none" />
          
          {/* Angled Dynamic Speed Shards */}
          <svg 
            className="absolute inset-0 w-full h-full opacity-25 object-cover mix-blend-overlay"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 500" 
            preserveAspectRatio="none"
          >
            <polygon points="0,500 280,0 340,0 60,500" fill="#ffffff" />
            <polygon points="180,500 520,0 590,0 250,500" fill="#ffffff" />
            <polygon points="460,500 820,0 900,0 540,500" fill="#ffffff" />
            <polygon points="760,500 1120,0 1200,0 840,500" fill="#ffffff" />
            <polygon points="0,200 450,0 480,0 0,220" fill="#ffdd00" opacity="0.4" />
          </svg>
        </div>

        {/* Inner Content Grid - Always horizontally arranged to fit exact cover height */}
        <div className="relative z-10 w-full h-full px-2.5 xs:px-3.5 sm:px-6 md:px-8 lg:px-10 py-1 sm:py-2 flex flex-row items-center justify-between gap-2 sm:gap-4">
          
          {/* LEFT SECTION: 3D Lightning Bolt + FLASH SALE + Bengali Taglines */}
          <div className="flex items-center gap-1.5 xs:gap-2.5 sm:gap-4 shrink-0">
            
            {/* 3D Lightning Bolt with Flame on Top */}
            <div className="shrink-0 relative w-8 h-14 xs:w-11 xs:h-18 sm:w-16 sm:h-26 md:w-20 md:h-34 lg:w-24 lg:h-38 flex items-center justify-center -rotate-6 transition-transform duration-300 group-hover:scale-105">
              
              {/* Little Flame on Top Notch */}
              <div className="absolute -top-1 xs:-top-1.5 sm:-top-2 right-1 sm:right-2 z-20 animate-bounce">
                <svg className="w-3.5 h-4 xs:w-4 xs:h-5 sm:w-6 sm:h-7" viewBox="0 0 32 40" fill="none">
                  <path 
                    d="M16 2C16 2 24 10 24 20C24 26.6 19.5 32 14 32C19 28 20 23 18 20C16 17 12 18 10 13C8 20 5 24 6 29C2.5 24 3 16 9 10C12 7 16 2 16 2Z" 
                    fill="url(#flameGrad)" 
                  />
                  <defs>
                    <linearGradient id="flameGrad" x1="16" y1="2" x2="16" y2="32" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#FFF700" />
                      <stop offset="0.5" stopColor="#FF8000" />
                      <stop offset="1" stopColor="#E60000" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* 3D Extruded Lightning Bolt SVG */}
              <svg 
                className="w-full h-full drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" 
                viewBox="0 0 100 130" 
                fill="none"
              >
                <defs>
                  {/* Front Yellow Gradient */}
                  <linearGradient id="lightningFront" x1="20" y1="5" x2="75" y2="120" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFF845" />
                    <stop offset="35%" stopColor="#FFDE00" />
                    <stop offset="85%" stopColor="#FFA600" />
                    <stop offset="100%" stopColor="#FF9000" />
                  </linearGradient>
                  {/* 3D Side Shadow Gradient */}
                  <linearGradient id="lightningSide" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#A81D00" />
                    <stop offset="60%" stopColor="#780C00" />
                    <stop offset="100%" stopColor="#520700" />
                  </linearGradient>
                </defs>

                {/* 3D Extrusion Layer */}
                <path 
                  d="M60 4 L14 66 L42 66 L26 128 L88 56 L58 56 Z" 
                  fill="url(#lightningSide)" 
                  transform="translate(3, 4)"
                />
                <path 
                  d="M60 4 L14 66 L42 66 L26 128 L88 56 L58 56 Z" 
                  fill="#520700" 
                  transform="translate(5, 5)"
                  opacity="0.5"
                />

                {/* Front Face Lightning Bolt */}
                <path 
                  d="M58 5 L16 65 L44 65 L28 125 L86 57 L58 57 Z" 
                  fill="url(#lightningFront)" 
                  stroke="#FFF" 
                  strokeWidth="1.2"
                />

                {/* Highlight Sheen on Front */}
                <path 
                  d="M55 9 L22 62 L42 62 L32 105 L45 80 L38 65 L55 65 Z" 
                  fill="#FFFFFF" 
                  opacity="0.35"
                />
              </svg>
            </div>

            {/* Typography Stack: FLASH + SALE + Bengali Pills */}
            <div className="flex flex-col justify-center">
              
              {/* FLASH - Bold White with 3D Dark-Red Drop Shadow */}
              <div 
                className="text-lg xs:text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black italic tracking-tighter text-white uppercase leading-[0.85] select-none"
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  textShadow: '0 2px 0 #7A0606, 0 4px 0 #5E0000, 0 6px 8px rgba(0,0,0,0.6)'
                }}
              >
                FLASH
              </div>

              {/* SALE - Vibrant 3D Yellow with Deep Beveled Outlines */}
              <div 
                className="text-xl xs:text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black italic tracking-tighter uppercase leading-[0.88] select-none"
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  background: 'linear-gradient(180deg, #FFF644 0%, #FFD000 45%, #FFA000 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: '#FFE000',
                  textShadow: '0 2px 0 #B91C1C, 0 4px 0 #7F1D1D, 0 6px 10px rgba(0,0,0,0.65)',
                  filter: 'drop-shadow(0 1px 2px rgba(255,255,255,0.4))'
                }}
              >
                SALE
              </div>

              {/* Bengali Text: "সীমিত সময়ের জন্য!" */}
              <div 
                className="text-white font-black text-[9px] xs:text-[11px] sm:text-sm md:text-base leading-tight mt-0.5 tracking-tight"
                style={{ textShadow: '0 1.5px 3px rgba(0,0,0,0.6)' }}
              >
                সীমিত সময়ের জন্য!
              </div>

              {/* Yellow Pill: "বিশেষ ডিসকাউন্টে জনপ্রিয় পণ্য!" */}
              <div className="mt-0.5 self-start">
                <span className="inline-block bg-[#FFD500] text-slate-950 font-black text-[7.5px] xs:text-[9px] sm:text-xs md:text-sm px-1.5 xs:px-2.5 sm:px-3 py-0.2 xs:py-0.5 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.3)] whitespace-nowrap">
                  বিশেষ ডিসকাউন্টে জনপ্রিয় পণ্য!
                </span>
              </div>

            </div>
          </div>

          {/* RIGHT SECTION: Capsule Countdown Timer + "সময় শেষ হওয়ার আগেই কিনুন!" + UP TO 60% OFF + CTA Button */}
          <div className="flex flex-col items-end justify-center shrink-0 gap-1 xs:gap-1.5 sm:gap-2">
            
            {/* High-Gloss Dark Capsule Countdown Timer with Glowing Gold Rim */}
            <div 
              className="inline-flex items-center gap-1 xs:gap-1.5 sm:gap-2.5 px-2 xs:px-3 sm:px-4 py-0.5 xs:py-1 sm:py-1.5 rounded-full border border-[#FFC700] sm:border-2 shadow-[0_0_12px_rgba(255,199,0,0.4)]"
              style={{
                background: 'linear-gradient(90deg, #050101 0%, #1a0404 50%, #080101 100%)'
              }}
            >
              {/* Circular Gold Clock Badge */}
              <div className="w-4 h-4 xs:w-5 xs:h-5 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 p-0.5 flex items-center justify-center shadow-inner">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                  <Clock className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-3.5 sm:h-3.5 text-[#FFE600] animate-pulse" />
                </div>
              </div>

              {/* Live Digital Timer: 06 : 59 : 09 */}
              <div className="font-mono font-black text-xs xs:text-sm sm:text-xl md:text-2xl text-[#FFE600] tracking-wider drop-shadow-[0_0_6px_rgba(255,230,0,0.6)]">
                <span>{formatNum(timeLeft.hours)}</span>
                <span className="mx-0.5 text-amber-200 animate-pulse">:</span>
                <span>{formatNum(timeLeft.minutes)}</span>
                <span className="mx-0.5 text-amber-200 animate-pulse">:</span>
                <span>{formatNum(timeLeft.seconds)}</span>
              </div>
            </div>

            {/* Subtitle: "সময় শেষ হওয়ার আগেই কিনুন!" */}
            <p 
              className="text-white font-bold text-[8px] xs:text-[9.5px] sm:text-xs md:text-sm text-right leading-none"
              style={{ textShadow: '0 1.5px 3px rgba(0,0,0,0.5)' }}
            >
              সময় শেষ হওয়ার আগেই কিনুন!
            </p>

            {/* Bottom Row: UP TO 60% OFF Splash Badge + CTA Button */}
            <div className="flex items-center justify-end gap-1.5 xs:gap-2 sm:gap-3">
              
              {/* "UP TO 60% OFF" Graphic Splash Badge */}
              <div className="relative inline-flex items-center justify-center px-1.5 xs:px-2 sm:px-2.5 py-0.5 bg-[#D11414] rounded-md sm:rounded-xl border border-red-400/40 shadow-[0_2px_6px_rgba(0,0,0,0.4)]">
                <div className="flex items-baseline gap-0.5 xs:gap-1">
                  <span className="text-white font-black text-[6.5px] xs:text-[8px] sm:text-[10px] tracking-wider uppercase">
                    UP TO
                  </span>
                  <span 
                    className="text-sm xs:text-base sm:text-2xl md:text-3xl font-black text-[#FFE600] tracking-tighter leading-none"
                    style={{
                      textShadow: '0 1.5px 0 #8B0000, 0 3px 0 #5E0000, 0 4px 6px rgba(0,0,0,0.6)'
                    }}
                  >
                    60%
                  </span>
                  <span className="text-white font-black text-[6.5px] xs:text-[8px] sm:text-[10px] tracking-wider uppercase">
                    OFF
                  </span>
                </div>
              </div>

              {/* White Pill CTA Button: "এখনই দেখুন ➔" */}
              <button
                type="button"
                onClick={handleCtaClick}
                className="inline-flex items-center gap-1 xs:gap-1.5 px-2 xs:px-3 sm:px-4 py-0.5 xs:py-1 sm:py-1.5 bg-white hover:bg-amber-50 text-slate-950 rounded-full font-black text-[8px] xs:text-[10px] sm:text-xs md:text-sm shadow-[0_2px_6px_rgba(0,0,0,0.3)] transition-all transform group-hover:scale-102 active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <span>এখনই দেখুন</span>
                <span className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 rounded-full bg-[#E11D1E] flex items-center justify-center text-white shadow-2xs">
                  <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                </span>
              </button>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
