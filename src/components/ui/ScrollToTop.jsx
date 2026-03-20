// "Scroll to top" button — appears when new content is loaded or user scrolls down.
import { useState, useEffect } from 'react';

export default function ScrollToTop({ trigger }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Show briefly when trigger changes (new content loaded)
  useEffect(() => {
    if (trigger) {
      setVisible(true);
      const timer = setTimeout(() => {
        if (window.scrollY <= 400) setVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [trigger]);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="gs-back-to-top"
      aria-label="Scroll to top"
      title="Back to top"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
