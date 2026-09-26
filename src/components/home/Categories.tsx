import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MAIN_CATEGORIES } from '../../constants/categories';
import { useLanguage } from '../common/LanguageProvider';

export default function Categories() {
  const { t, tCategory } = useLanguage();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  // Mouse Drag support for smooth scrolling on desktop as well
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeft.current = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -240 : 240;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="relative pt-1.5 pb-2 sm:pt-2.5 sm:pb-3 bg-gradient-to-br from-slate-50 via-white to-sky-50/30 border-b border-slate-100 overflow-hidden">
      {/* Decorative background blur elements */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary-main/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-36 h-36 bg-sky-200/20 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-8 relative z-10">
        <div className="flex items-center justify-between mb-1.5 sm:mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm md:text-base font-bold text-slate-900 tracking-tight">
              {t('Categories')}
            </h2>
            <span className="text-[10px] text-slate-400 font-normal">
              ({MAIN_CATEGORIES.length})
            </span>
          </div>

          {/* Desktop scroll navigation buttons */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              className="p-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-primary-main shadow-2xs transition-colors cursor-pointer"
              title={t('Previous')}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-primary-main shadow-2xs transition-colors cursor-pointer"
              title={t('Next')}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Horizontal Finger/Touch Scrollable Container */}
        <div 
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="flex overflow-x-auto gap-2.5 sm:gap-3.5 pb-1 hide-scrollbar snap-x scroll-smooth cursor-grab active:cursor-grabbing"
          style={{
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {MAIN_CATEGORIES.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.015, 0.15) }}
              className="flex-shrink-0 snap-start"
            >
              <Link 
                to={`/category/${category.path}`}
                className="group flex flex-col items-center w-[64px] sm:w-[76px] md:w-[82px] transition-transform active:scale-95"
                draggable={false}
              >
                <div 
                  className="relative h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center mb-1 shadow-2xs border border-slate-100 bg-white group-hover:shadow-md group-hover:border-sky-300 transition-all duration-300 overflow-hidden"
                >
                  <img 
                    src={category.imageUrl} 
                    alt={category.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                </div>
                <span className="text-[9px] sm:text-[10px] md:text-[11px] font-medium text-center text-slate-700 group-hover:text-primary-main transition-colors leading-tight line-clamp-2 h-6 sm:h-7 w-full px-0.5 pointer-events-none">
                  {tCategory(category.name || category.id)}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
}
