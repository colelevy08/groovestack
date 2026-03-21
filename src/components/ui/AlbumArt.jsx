// Album art component — drop-in replacement for VinylDisc.
// Fetches real album cover art via iTunes Search API, falls back to VinylDisc while loading or on error.
// Supports lazy loading with IntersectionObserver, blur-up placeholder, click to expand, skeleton shimmer,
// vinyl record peek animation on hover, responsive sizes, and broken image fallback art.
import { useState, useEffect, useRef, useCallback } from 'react';
import VinylDisc from './VinylDisc';
import { getCoverUrl } from '../../utils/coverArt';

// Improvement 1: Responsive size presets for different contexts
const SIZE_PRESETS = {
  thumb: 48,
  sm: 72,
  md: 120,
  lg: 200,
  xl: 300,
};

export default function AlbumArt({ album, artist, size = 72, sizePreset, accent = "#555", expandable, priority = false }) {
  const [url, setUrl] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [inView, setInView] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef(null);

  // Improvement 2: Resolve size from preset or raw value
  const resolvedSize = sizePreset ? (SIZE_PRESETS[sizePreset] || size) : size;

  // Lazy loading with IntersectionObserver (skip for priority/above-the-fold images #16)
  useEffect(() => {
    // Priority images (above-the-fold) skip lazy loading and load immediately
    if (priority) {
      setInView(true);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    // If IntersectionObserver is not available, treat as in-view immediately
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [priority]);

  useEffect(() => {
    if (!inView) return;

    let cancelled = false;
    setLoaded(false);
    setErrored(false);
    setUrl(null);

    if (album || artist) {
      getCoverUrl(album, artist).then(result => {
        if (!cancelled) {
          setUrl(result);
          // Preload priority images into browser cache (#16)
          if (priority && result) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = result;
            document.head.appendChild(link);
          }
        }
      });
    }
    return () => { cancelled = true; };
  }, [album, artist, inView, priority]);

  const handleClick = useCallback(() => {
    if (expandable && url && loaded) {
      setExpanded(true);
    }
  }, [expandable, url, loaded]);

  // Improvement 3: Keyboard support for expanded lightbox (Escape to close)
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded]);

  // Show VinylDisc as fallback while loading, on error, or if no art found
  if (!inView || (!url && !errored)) {
    const radius = Math.round(resolvedSize * 0.18);
    return (
      <div
        ref={containerRef}
        className="overflow-hidden shrink-0 relative"
        style={{ width: resolvedSize, height: resolvedSize, borderRadius: radius }}
      >
        {/* Skeleton shimmer while waiting to load */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.8s ease-in-out infinite',
            borderRadius: radius,
          }}
        />
        {!inView && (
          <div className="absolute inset-0 flex items-center justify-center">
            <VinylDisc accent={accent} size={resolvedSize} />
          </div>
        )}
      </div>
    );
  }

  // Improvement 3: Broken image fallback with music note icon instead of just VinylDisc
  if (!url || errored) {
    const radius = Math.round(resolvedSize * 0.18);
    return (
      <div
        className="overflow-hidden shrink-0 relative flex items-center justify-center bg-[#1a1a1a] border border-gs-border"
        style={{ width: resolvedSize, height: resolvedSize, borderRadius: radius }}
      >
        <svg
          width={resolvedSize * 0.4}
          height={resolvedSize * 0.4}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#444"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" fill="#333" stroke="#444" />
          <circle cx="18" cy="16" r="3" fill="#333" stroke="#444" />
        </svg>
        {album && (
          <span
            className="absolute bottom-1 left-1 right-1 text-center text-gs-faint truncate"
            style={{ fontSize: Math.max(8, resolvedSize * 0.1) }}
          >
            {album}
          </span>
        )}
      </div>
    );
  }

  const radius = Math.round(resolvedSize * 0.18);

  return (
    <>
      <div
        ref={containerRef}
        className={`overflow-hidden shrink-0 bg-[#1a1a1a] border border-gs-border-hover relative hover:scale-105 transition-transform duration-200 ${expandable ? 'cursor-pointer' : ''}`}
        style={{ width: resolvedSize, height: resolvedSize, borderRadius: radius }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Blur-up placeholder while image is loading */}
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            {url ? (
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover blur-lg scale-110 opacity-50"
                aria-hidden="true"
              />
            ) : (
              <VinylDisc accent={accent} size={resolvedSize} />
            )}
          </div>
        )}
        <img
          src={url}
          alt={`${album || "Album"} cover`}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`w-full h-full object-cover transition-opacity duration-[250ms] ${loaded ? "opacity-100" : "opacity-0"}`}
        />

        {/* Improvement 1: Vinyl record peek animation on hover */}
        {loaded && hovered && (
          <div
            className="absolute pointer-events-none"
            style={{
              right: -resolvedSize * 0.25,
              top: '50%',
              transform: 'translateY(-50%)',
              width: resolvedSize * 0.85,
              height: resolvedSize * 0.85,
              transition: 'right 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
              animation: 'vinylPeek 0.35s ease-out forwards',
            }}
          >
            <div style={{ width: '100%', height: '100%', animation: 'vinylSpin 3s linear infinite' }}>
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 100 100"
              style={{ filter: 'drop-shadow(-2px 0 4px rgba(0,0,0,0.5))' }}
            >
              <defs>
                <clipPath id={`vinyl-label-clip-${resolvedSize}`}>
                  <circle cx="50" cy="50" r="20" />
                </clipPath>
                <radialGradient id={`vinyl-sheen-${resolvedSize}`} cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              </defs>
              {/* Outer disc */}
              <circle cx="50" cy="50" r="48" fill="#111" stroke="#222" strokeWidth="1" />
              {/* Vinyl grooves — outer region */}
              <circle cx="50" cy="50" r="46" fill="none" stroke="#1a1a1a" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="#1c1c1c" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1a1a1a" strokeWidth="0.4" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1c1c1c" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="38" fill="none" stroke="#1a1a1a" strokeWidth="0.4" />
              <circle cx="50" cy="50" r="36" fill="none" stroke="#1c1c1c" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="34" fill="none" stroke="#1a1a1a" strokeWidth="0.4" />
              <circle cx="50" cy="50" r="32" fill="none" stroke="#1c1c1c" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="30" fill="none" stroke="#1a1a1a" strokeWidth="0.4" />
              <circle cx="50" cy="50" r="28" fill="none" stroke="#1c1c1c" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="26" fill="none" stroke="#1a1a1a" strokeWidth="0.4" />
              <circle cx="50" cy="50" r="24" fill="none" stroke="#1c1c1c" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="22" fill="none" stroke="#1a1a1a" strokeWidth="0.3" />
              {/* Label area background */}
              <circle cx="50" cy="50" r="20" fill="#222" />
              {/* Album art as center label */}
              {url && (
                <image
                  href={url}
                  x="30" y="30" width="40" height="40"
                  clipPath={`url(#vinyl-label-clip-${resolvedSize})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              )}
              {/* Label ring border */}
              <circle cx="50" cy="50" r="20" fill="none" stroke="#333" strokeWidth="0.8" />
              {/* Spindle hole */}
              <circle cx="50" cy="50" r="2.5" fill="#0a0a0a" stroke="#333" strokeWidth="0.5" />
              {/* Vinyl sheen overlay */}
              <circle cx="50" cy="50" r="48" fill={`url(#vinyl-sheen-${resolvedSize})`} />
            </svg>
            </div>
          </div>
        )}
      </div>

      {/* Full-size expanded preview overlay */}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[2000] animate-fade-in cursor-pointer"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-label={`${album || 'Album'} cover preview`}
        >
          <div className="relative animate-slide-up max-w-[90vw] max-h-[90vh]">
            <img
              src={url}
              alt={`${album || "Album"} cover`}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent rounded-b-2xl p-4">
              {album && <div className="text-white text-[15px] font-bold">{album}</div>}
              {artist && <div className="text-white/60 text-[13px]">{artist}</div>}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 border-none cursor-pointer text-white text-lg flex items-center justify-center hover:bg-black/70 transition-colors"
              aria-label="Close preview"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Inline styles for vinyl peek animation */}
      <style>{`
        @keyframes vinylPeek {
          from { right: ${-resolvedSize * 0.6}px; opacity: 0; }
          to { right: ${-resolvedSize * 0.25}px; opacity: 1; }
        }
        @keyframes vinylSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
