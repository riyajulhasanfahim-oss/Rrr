import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop component that resets the window scroll position to the top (0, 0)
 * on every route navigation.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Disable browser automatic scroll restoration if available
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // Scroll immediately to top
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' as ScrollBehavior,
    });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search]);

  return null;
}
