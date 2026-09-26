import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react';
import { formatDirectImageUrl, handleProductImageError, PLACEHOLDER_PRODUCT_IMAGE } from '../../utils/imageUrl';

interface ImageGalleryProps {
  images: string[];
  videoUrl?: string;
  activeImage?: string;
}

export default function ImageGallery({ images, videoUrl, activeImage }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [touchStart, setTouchStart] = useState<number | null>(null);
  
  // Clean and format valid image URLs
  const formattedActive = activeImage ? formatDirectImageUrl(activeImage) : '';
  let validImages = (images || [])
    .filter(img => typeof img === 'string' && img.trim() !== '')
    .map(img => formatDirectImageUrl(img));

  if (formattedActive && !validImages.includes(formattedActive)) {
    validImages = [formattedActive, ...validImages];
  }
  if (validImages.length === 0) {
    validImages = [PLACEHOLDER_PRODUCT_IMAGE];
  }
  const hasVideo = !!(videoUrl && typeof videoUrl === 'string' && videoUrl.trim() !== '');

  // Main featured image is index 0. Additional images (Image 2, 3, 4) follow. Video is at the end if provided.
  const items = [
    ...validImages.map(url => ({ type: 'image' as const, url })),
    ...(hasVideo ? [{ type: 'video' as const, url: videoUrl.trim() }] : [])
  ];

  // If activeImage changes, update index to point to that image
  React.useEffect(() => {
    if (formattedActive) {
      const foundIndex = items.findIndex(item => item.url === formattedActive);
      if (foundIndex !== -1) {
        setCurrentIndex(foundIndex);
      }
    }
  }, [formattedActive]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed || items[currentIndex]?.type === 'video') return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setMousePos({ x, y });
  };

  const nextItem = () => {
    setCurrentIndex((prev) => (prev === items.length - 1 ? 0 : prev + 1));
  };

  const prevItem = () => {
    setCurrentIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1));
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (diff > 50) {
      nextItem();
    } else if (diff < -50) {
      prevItem();
    }
    setTouchStart(null);
  };

  if (!items || items.length === 0) {
    return (
      <div className="w-full aspect-square max-w-[340px] sm:max-w-[420px] lg:max-w-[460px] mx-auto bg-white rounded-2xl flex flex-col items-center justify-center border border-slate-200 shadow-xs p-6">
        <div className="text-slate-300 mb-2">
          <svg className="w-14 h-14 sm:w-16 sm:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-slate-400 font-medium text-xs sm:text-sm">No Image Available</p>
      </div>
    );
  }

  // Ensure currentIndex stays within bounds if items change
  const safeIndex = currentIndex < items.length ? currentIndex : 0;
  const currentItem = items[safeIndex];

  return (
    <div className="w-full mx-auto flex flex-col gap-2 select-none">
      {/* Main Display - 1:1 Aspect Ratio filling full available width and height like Daraz */}
      <div 
        className={`relative aspect-square w-full bg-slate-50 sm:bg-white rounded-none sm:rounded-xl overflow-hidden group border-b sm:border border-slate-200/80 flex items-center justify-center ${currentItem.type === 'image' ? 'cursor-zoom-in' : ''}`}
        onMouseEnter={() => currentItem.type === 'image' && setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          {currentItem.type === 'video' ? (
            <motion.div
              key="video-player"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full bg-black flex items-center justify-center"
            >
              {currentItem.url.includes('youtube.com') || currentItem.url.includes('youtu.be') ? (
                <iframe 
                  src={currentItem.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} 
                  className="w-full h-full"
                  allowFullScreen
                  title="Product Video"
                ></iframe>
              ) : (
                <video controls className="w-full h-full">
                  <source src={currentItem.url} />
                  Your browser does not support the video tag.
                </video>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={`img-${safeIndex}-${currentItem.url}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full flex items-center justify-center overflow-hidden bg-slate-50 sm:bg-white"
            >
              <img
                src={currentItem.url}
                alt="Product"
                referrerPolicy="no-referrer"
                onError={(e) => handleProductImageError(e)}
                className={`w-full h-full object-cover sm:object-contain transition-transform duration-200 select-none ${isZoomed ? 'scale-150' : 'scale-100'}`}
                style={isZoomed ? { transformOrigin: `${mousePos.x}% ${mousePos.y}%` } : {}}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Arrows */}
        {items.length > 1 && (
          <>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); prevItem(); }}
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-9 sm:w-9 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center transition-all z-10 active:scale-95 cursor-pointer backdrop-blur-xs"
              aria-label="Previous item"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); nextItem(); }}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-9 sm:w-9 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center transition-all z-10 active:scale-95 cursor-pointer backdrop-blur-xs"
              aria-label="Next item"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </>
        )}

        {/* Index Pill Badge (e.g. 1/2) - Exactly like Daraz screenshot */}
        {items.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white text-xs font-semibold px-2 py-0.5 rounded-sm pointer-events-none z-10 shadow-xs tracking-wider">
            {safeIndex + 1}/{items.length}
          </div>
        )}
      </div>

      {/* Thumbnails - Clean E-commerce Layout */}
      {items.length > 1 && (
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 px-2 sm:px-0.5 hide-scrollbar scroll-smooth">
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 aspect-square rounded-md sm:rounded-lg overflow-hidden border-2 transition-all shrink-0 bg-white flex items-center justify-center cursor-pointer ${
                safeIndex === idx 
                  ? 'border-primary-main ring-1 ring-primary-main/30 shadow-xs opacity-100' 
                  : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
              }`}
            >
              {item.type === 'video' ? (
                <div className="w-full h-full bg-slate-900 rounded-sm flex items-center justify-center">
                  <PlayCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white/90" />
                </div>
              ) : (
                <img 
                  referrerPolicy="no-referrer" 
                  src={item.url} 
                  alt={`Thumbnail ${idx + 1}`} 
                  onError={(e) => handleProductImageError(e)}
                  className="w-full h-full object-cover rounded-sm select-none" 
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
