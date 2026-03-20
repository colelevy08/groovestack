// "Scroll to top" button — appears when new content is loaded or user scrolls down.
// Improvements: scroll progress indicator, configurable threshold, animation options.
import { useState, useEffect, useCallback } from 'react';

export default function ScrollToTop({
  trigger,
  threshold = 400,
  showProgress = true,
  animation = 'smooth',
}) {
  const [visible, setVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const updateScroll = useCallback(() => {
    const scrollY = window.scrollY;
    setVisible(scrollY > threshold);

    if (showProgress) {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min((scrollY / docHeight) * 100, 100) : 0;
      setScrollProgress(progress);
    }
  }, [threshold, showProgress]);

  useEffect(() => {
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, [updateScroll]);

  // Show briefly when trigger changes (new content loaded)
  useEffect(() => {
    if (trigger) {
      setVisible(true);
      const timer = setTimeout(() => {
        if (window.scrollY <= threshold) setVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [trigger, threshold]);

  const handleClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: animation });
  }, [animation]);

  if (!visible) return null;

  const circumference = 2 * Math.PI * 17;
  const dashOffset = circumference - (scrollProgress / 100) * circumference;

  return (
    <button
      onClick={handleClick}
      className="gs-back-to-top"
      aria-label="Scroll to top"
      title={`Back to top (${Math.round(scrollProgress)}% scrolled)`}
      style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1000 }}
    >
      {showProgress && (
        <svg
          width="44"
          height="44"
          viewBox="0 0 44 44"
          className="absolute inset-0"
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx="22"
            cy="22"
            r="17"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.15"
          />
          <circle
            cx="22"
            cy="22"
            r="17"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.15s ease-out' }}
          />
        </svg>
      )}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
