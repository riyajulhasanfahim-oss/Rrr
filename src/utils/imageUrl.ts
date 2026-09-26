/**
 * Utility functions for safe product image URLs and fallbacks.
 * Ensures vendor-uploaded images (especially Google Drive links) load reliably,
 * and prevents demo/stock images (e.g. Unsplash watches) from hijacking product views.
 */

// Clean, neutral SVG placeholder for products without an image or while loading
export const PLACEHOLDER_PRODUCT_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="none"><rect width="400" height="400" fill="%23F1F5F9"/><path d="M160 170C165.523 170 170 165.523 170 160C170 154.477 165.523 150 160 150C154.477 150 150 154.477 150 160C150 165.523 154.477 170 160 170Z" stroke="%2394A3B8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M130 250L180 200L220 230L250 190L270 250H130Z" fill="%23E2E8F0" stroke="%2394A3B8" stroke-width="6" stroke-linejoin="round"/><rect x="110" y="110" width="180" height="180" rx="12" stroke="%2394A3B8" stroke-width="6"/></svg>';

/**
 * Transforms any Google Drive URL into a direct CDN URL that can be hotlinked
 * in browser <img> tags without 403 or cookies blockage.
 */
export function formatDirectImageUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // Check if it's a Google Drive link
  if (trimmed.includes('drive.google.com') || trimmed.includes('drive.usercontent.google.com')) {
    // 1. Extract file ID from various Drive URL formats
    let fileId = '';

    // Match id=FILE_ID
    const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch && idParamMatch[1]) {
      fileId = idParamMatch[1];
    }

    // Match /d/FILE_ID/ or /file/d/FILE_ID/
    if (!fileId) {
      const pathMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (pathMatch && pathMatch[1]) {
        fileId = pathMatch[1];
      }
    }

    if (fileId) {
      // Use Google's official user content CDN for direct image rendering
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }

  return trimmed;
}

/**
 * Safe image onError handler that retries alternative Google Drive formats
 * before falling back to a clean SVG placeholder.
 * Strictly avoids demo stock images.
 */
export function handleProductImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackSrc: string = PLACEHOLDER_PRODUCT_IMAGE
) {
  const img = e.currentTarget as HTMLImageElement;
  if (!img) return;

  const currentSrc = img.src || '';

  // If already at fallback, stop
  if (currentSrc === fallbackSrc || currentSrc.startsWith('data:image/svg+xml')) {
    return;
  }

  // If it's an lh3.googleusercontent.com/d/ URL that failed, try thumbnail API
  const lh3Match = currentSrc.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match && lh3Match[1]) {
    img.src = `https://drive.google.com/thumbnail?id=${lh3Match[1]}&sz=w1000`;
    return;
  }

  // If it's drive.google.com with id, try lh3 first
  const driveMatch = currentSrc.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    img.src = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    return;
  }

  // Otherwise, use neutral placeholder
  img.src = fallbackSrc;
}
