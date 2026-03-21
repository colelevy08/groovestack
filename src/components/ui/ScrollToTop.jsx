// "Scroll to top" button — appears when new content is loaded or user scrolls down.
// Improvements: scroll progress indicator, configurable threshold, animation options,
// scroll position memory per screen, scroll-to-section navigation, and reading progress indicator.
import { useState, useEffect, useCallback, useRef } from 'react';

// --- Scroll position memory per screen ---
const scrollMemory = {};

export function saveScrollPosition(screenKey) {
  scrollMemory[screenKey] = window.scrollY;
}

export function restoreScrollPosition(screenKey, behavior = 'auto') {
  const saved = scrollMemory[screenKey];
  if (saved != null && saved > 0) {
    window.scrollTo({ top: saved, behavior });
  }
}

export function useScrollMemory(screenKey) {
  // Save on unmount / screen change, restore on mount
  useEffect(() => {
    restoreScrollPosition(screenKey);
    return () => {
      saveScrollPosition(screenKey);
    };
  }, [screenKey]);
}

// --- Scroll-to-section navigation ---
export function ScrollToSection({ sections = [], className = '' }) {
  // sections: Array of { id, label }
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  const scrollTo = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  if (sections.length === 0) return null;

  return (
    <nav className={`flex flex-col gap-1 ${className}`} aria-label="Page sections">
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => scrollTo(section.id)}
          className={`text-left text-[11px] px-2 py-1 rounded border-none cursor-pointer transition-colors ${
            activeSection === section.id
              ? 'bg-gs-accent/10 text-gs-accent font-bold'
              : 'bg-transparent text-gs-muted hover:text-gs-text hover:bg-gs-surface'
          }`}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

// --- Reading progress indicator ---
export function ReadingProgress({ color = 'bg-gs-accent', height = 'h-0.5' }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setProgress(Math.min((window.scrollY / docHeight) * 100, 100));
      }
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  return (
    <div className={`fixed top-0 left-0 right-0 z-[1100] ${height} bg-transparent`}>
      <div
        className={`${height} ${color} transition-all duration-150 ease-out`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// --- Main ScrollToTop component ---
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
