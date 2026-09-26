import React from 'react';

export interface VerifiedBadgeProps {
  /** Optional custom CSS classes (e.g. positioning, size override) */
  className?: string;
  /** Accessible tooltip text */
  title?: string;
  /** Size variant: default 'sm' */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * VerifiedBadge
 * 
 * Professional scalloped verified badge (খাঁজ কাটা ভেরিফাইড ব্যাজ):
 * - Deep, rich saturated royal blue ("খরা কালার" #1D7BF2 -> #0846A8)
 * - Slightly larger badge proportion with prominent scalloped notches
 * - Compact, beautifully centered white checkmark with generous breathing room
 * - Razor-sharp white contour stroke & soft depth shadow
 */
export default function VerifiedBadge({
  className = '',
  title = 'অনুমোদিত ভেরিফাইড স্টোর',
  size = 'sm'
}: VerifiedBadgeProps) {
  let sizeClasses = 'w-4.5 h-4.5 sm:w-5 sm:h-5';

  if (size === 'xs') {
    sizeClasses = 'w-4 h-4 sm:w-4.5 sm:h-4.5';
  } else if (size === 'md') {
    sizeClasses = 'w-6 h-6 sm:w-7 sm:h-7';
  } else if (size === 'lg') {
    sizeClasses = 'w-9 h-9 sm:w-11 sm:h-11';
  } else if (size === 'xl') {
    sizeClasses = 'w-16 h-16 sm:w-20 sm:h-20';
  }

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 select-none drop-shadow-xs ${sizeClasses} ${className}`}
      title={title}
      aria-label={title}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-full h-full overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="scalloped_badge_deep_blue" x1="12" y1="1" x2="12" y2="23" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E80F5" />
            <stop offset="45%" stopColor="#0E62DE" />
            <stop offset="100%" stopColor="#0845A6" />
          </linearGradient>
        </defs>

        {/* 16-lobed scalloped rosette with notched edges */}
        <path
          d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
          fill="url(#scalloped_badge_deep_blue)"
          stroke="#FFFFFF"
          strokeWidth="0.85"
          paintOrder="stroke fill"
        />

        {/* Scaled-down, optically centered thick rounded white checkmark */}
        <polyline
          points="8.2 12.2 10.6 14.8 15.8 9.4"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

