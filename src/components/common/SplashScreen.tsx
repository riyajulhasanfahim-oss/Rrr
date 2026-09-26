import React, { useEffect } from 'react';

interface SplashScreenProps {
  onFinish?: () => void;
  minDuration?: number;
}

/**
 * SplashScreen coordinator:
 * The visual animation is hardware-accelerated directly in the root HTML,
 * ensuring immediate 0ms launch, zero jank, and high-performance 60fps GPU rendering.
 * This component notifies that React has booted and handles any onFinish callbacks.
 */
export default function SplashScreen({ onFinish }: SplashScreenProps) {
  useEffect(() => {
    // Notify the hardware-accelerated splash screen that React is ready
    if (typeof window !== 'undefined' && typeof (window as any).markAppReady === 'function') {
      (window as any).markAppReady();
    }

    const checkTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 3000);

    return () => clearTimeout(checkTimer);
  }, [onFinish]);

  // Avoid duplicate DOM rendering to prevent hanging or duplicate logos
  return null;
}

