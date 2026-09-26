import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getFirestoreBanners } from '../../services/firestoreService';
import { INITIAL_BANNERS } from '../../lib/firebaseSeed';

export default function HeroSlider() {
  const [slides, setSlides] = useState<any[]>(INITIAL_BANNERS);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    async function loadBanners() {
      try {
        const live = await getFirestoreBanners();
        if (active && live.length > 0) {
          setSlides(live);
        }
      } catch (e) {
        console.warn('Could not load banners from Firestore', e);
      }
    }
    loadBanners();
    return () => { active = false; };
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 40) {
      nextSlide();
    } else if (diff < -40) {
      prevSlide();
    }
    touchStartX.current = null;
  };

  useEffect(() => {
    if (!isHovered && slides.length > 1) {
      const timer = setInterval(() => {
        nextSlide();
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [isHovered, currentSlide, slides.length]);

  if (!slides || slides.length === 0) return null;
  const cur = slides[currentSlide] || slides[0];

  return (
    <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-8">
      <div 
        className="group relative w-full h-[115px] xs:h-[135px] sm:h-[180px] md:h-[220px] lg:h-[260px] overflow-hidden bg-slate-900 rounded-2xl shadow-xs border border-slate-200/80"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={cur?.id || currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="absolute inset-0"
          >
            {/* Background Image */}
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-102"
              style={{ backgroundImage: `url(${cur?.image})` }}
            />

            {/* Gradient Scrim for Professional Daraz/Amazon Contrast */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/55 to-transparent sm:from-slate-950/85 sm:via-slate-950/40 sm:to-transparent" />

            {/* Content Overlay */}
            <div className="relative h-full flex flex-col justify-center px-4 sm:px-8 md:px-12 max-w-xl text-white z-10">
              
              {/* Promotional Badge */}
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[9px] sm:text-[11px] font-bold w-fit mb-1 sm:mb-1.5 border border-white/20 shadow-2xs">
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300" />
                <span>মেগা অফার • ৫০% পর্যন্ত ছাড়</span>
              </div>

              {/* Title */}
              <h2 className="text-sm sm:text-xl md:text-2xl lg:text-3xl font-black tracking-tight text-white leading-tight drop-shadow-sm line-clamp-1 sm:line-clamp-2">
                {cur?.title || 'স্পেশাল সুপার সেল'}
              </h2>

              {/* Subtitle */}
              {cur?.subtitle && (
                <p className="text-[10px] sm:text-xs md:text-sm text-slate-200 line-clamp-1 mt-0.5 sm:mt-1 opacity-90 max-w-sm sm:max-w-md">
                  {cur.subtitle}
                </p>
              )}

              {/* CTA Link Button */}
              <div className="mt-2 sm:mt-3">
                <Link
                  to={cur?.ctaLink || '/category/all'}
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-3 py-1 sm:px-4 sm:py-1.5 bg-white hover:bg-slate-100 text-slate-900 rounded-lg text-[10px] sm:text-xs font-extrabold shadow-sm transition-transform active:scale-95 group/btn"
                >
                  <span>{cur?.ctaText || 'এখনই কিনুন'}</span>
                  <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-600 transform group-hover/btn:translate-x-0.5 transition-transform" />
                </Link>
              </div>

            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons (Compact & Sleek) */}
        {slides.length > 1 && (
          <>
            <button 
              type="button"
              onClick={prevSlide}
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-black/35 hover:bg-black/65 text-white/90 hover:text-white flex items-center justify-center backdrop-blur-xs transition-all shadow-xs opacity-75 sm:opacity-0 sm:group-hover:opacity-100 z-20 cursor-pointer"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button 
              type="button"
              onClick={nextSlide}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-black/35 hover:bg-black/65 text-white/90 hover:text-white flex items-center justify-center backdrop-blur-xs transition-all shadow-xs opacity-75 sm:opacity-0 sm:group-hover:opacity-100 z-20 cursor-pointer"
              aria-label="Next slide"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Indicators */}
        {slides.length > 1 && (
          <div className="absolute bottom-2 sm:bottom-3 right-3 sm:right-5 flex items-center space-x-1.5 z-20">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentSlide(index)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  index === currentSlide ? 'w-5 bg-sky-500' : 'w-1.5 bg-white/50 hover:bg-white/80'
                }`}
                aria-label={`Slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
