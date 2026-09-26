import React, { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, ExternalLink, Download } from 'lucide-react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  onClose: () => void;
  title?: string;
}

export default function ImageLightboxModal({
  isOpen,
  imageUrl,
  onClose,
  title = 'ছবি প্রিভিউ (Image Preview)'
}: ImageLightboxModalProps) {
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsZoomed(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Prevent background scrolling while modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `image_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* Top Action Bar */}
      <div 
        className="absolute top-3 inset-x-3 sm:top-5 sm:inset-x-6 flex items-center justify-between pointer-events-auto z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white/95 font-semibold text-xs sm:text-sm bg-black/60 px-3.5 py-1.5 rounded-full border border-white/15 flex items-center gap-2 backdrop-blur-md">
          <span>{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom In/Out Toggle */}
          <button
            type="button"
            onClick={() => setIsZoomed(!isZoomed)}
            className="p-2 sm:p-2.5 text-white/90 hover:text-white bg-white/15 hover:bg-white/25 rounded-full transition-colors cursor-pointer border border-white/10"
            title={isZoomed ? "আসল সাইজ (Reset)" : "আরও বড় করুন (Zoom in)"}
          >
            {isZoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>

          {/* Download button */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 sm:p-2.5 text-white/90 hover:text-white bg-white/15 hover:bg-white/25 rounded-full transition-colors cursor-pointer border border-white/10"
            title="ছবি ডাউনলোড করুন"
          >
            <Download className="w-5 h-5" />
          </button>

          {/* Open full in new tab */}
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 sm:p-2.5 text-white/90 hover:text-white bg-white/15 hover:bg-white/25 rounded-full transition-colors cursor-pointer border border-white/10"
            title="নতুন ট্যাবে ফুল রেজোলিউশন দেখুন"
          >
            <ExternalLink className="w-5 h-5" />
          </a>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:p-2.5 text-white hover:text-white bg-rose-600/80 hover:bg-rose-600 rounded-full transition-colors cursor-pointer shadow-lg border border-white/20 ml-1"
            title="বন্ধ করুন (Close)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div 
        className="relative max-w-6xl max-h-[88vh] w-full flex items-center justify-center p-2 overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          referrerPolicy="no-referrer"
          alt={title || "Enlarged Review"}
          onClick={() => setIsZoomed(!isZoomed)}
          className={`object-contain rounded-xl shadow-2xl transition-all duration-300 cursor-zoom-in ${
            isZoomed
              ? 'max-h-none max-w-none scale-125 cursor-zoom-out'
              : 'max-h-[85vh] max-w-[95vw] sm:max-w-[90vw]'
          }`}
        />
      </div>

      {/* Bottom helper tip */}
      <div 
        className="absolute bottom-3 sm:bottom-4 text-center text-[11px] text-white/60 pointer-events-none"
      >
        ছবিতে ক্লিক করে বা জুম বাটনে চেপে আরও বড় করতে পারবেন • বন্ধ করতে বাইরে বা ✕ বাটনে চাপুন
      </div>
    </div>
  );
}
