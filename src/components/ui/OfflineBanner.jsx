// Offline detection banner — shows a persistent banner when the user loses internet connectivity.
// Improvements: reconnection countdown, cached data indicator, retry button.
import { useState, useEffect, useCallback, useRef } from 'react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [countdown, setCountdown] = useState(0);
  const [cachedPages, setCachedPages] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      setCountdown(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Check cached data count
  useEffect(() => {
    if (isOffline && 'caches' in window) {
      caches.keys().then(names => {
        setCachedPages(names.length);
      }).catch(() => setCachedPages(0));
    }
  }, [isOffline]);

  // Auto-reconnection countdown
  useEffect(() => {
    if (!isOffline) return;
    setCountdown(30);
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Attempt reconnection check
          fetch('/manifest.json', { method: 'HEAD', cache: 'no-store' })
            .then(() => setIsOffline(false))
            .catch(() => setCountdown(30));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOffline]);

  const handleRetry = useCallback(() => {
    fetch('/manifest.json', { method: 'HEAD', cache: 'no-store' })
      .then(() => {
        setIsOffline(false);
        setCountdown(0);
      })
      .catch(() => setCountdown(30));
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[3000] bg-amber-600 text-black py-2 px-4 text-[13px] font-semibold animate-slide-down"
    >
      <div className="flex items-center justify-center gap-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
          <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0122.56 9" />
          <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
          <path d="M8.53 16.11a6 6 0 016.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
        <span>
          You&apos;re offline.
          {countdown > 0 && ` Retrying in ${countdown}s...`}
          {countdown === 0 && ' Checking connection...'}
        </span>
        {cachedPages > 0 && (
          <span className="bg-black/15 rounded px-1.5 py-0.5 text-[11px]">
            {cachedPages} cached {cachedPages === 1 ? 'resource' : 'resources'}
          </span>
        )}
        <button
          onClick={handleRetry}
          className="bg-black/20 hover:bg-black/30 text-black border-none rounded px-2.5 py-1 text-[12px] font-bold cursor-pointer transition-colors"
        >
          Retry Now
        </button>
      </div>
    </div>
  );
}
