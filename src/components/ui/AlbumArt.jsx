// Album art component — drop-in replacement for VinylDisc.
// Fetches real album cover art via iTunes Search API, falls back to VinylDisc while loading or on error.
// Supports lazy loading with IntersectionObserver, blur-up placeholder, click to expand, skeleton shimmer,
// vinyl record peek animation on hover, responsive sizes, broken image fallback art,
// dominant color extraction, and album art comparison slider.
import { useState, useEffect, useRef, useCallback } from 'react';
import VinylDisc from './VinylDisc';
import { getCoverUrl } from '../../utils/coverArt';

// Responsive size presets for different contexts
const SIZE_PRESETS = {
  thumb: 48,
  sm: 72,
  md: 120,
  lg: 200,
  xl: 300,
};

// --- Improvement 14: Dominant color extraction from album art ---
function extractDominantColor(imgSrc, callback) {
  if (!imgSrc) return;
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // Sample at small size for performance
      const sampleSize = 10;
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Skip very dark and very bright pixels
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (brightness > 30 && brightness < 230) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      }
      if (count > 0) {
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        callback({ r, g, b, hex: `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}` });
      } else {
        callback(null);
      }
    } catch {
      callback(null);
    }
  };
  img.onerror = () => callback(null);
  img.src = imgSrc;
}

// --- Improvement 15: Album art comparison slider ---
export function AlbumArtComparison({ leftAlbum, leftArtist, rightAlbum, rightArtist, size = 200 }) {
  const [sliderPos, setSliderPos] = useState(50); // percentage
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef(null);
  const [leftUrl, setLeftUrl] = useState(null);
  const [rightUrl, setRightUrl] = useState(null);
  const [leftLoaded, setLeftLoaded] = useState(false);
  const [rightLoaded, setRightLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (leftAlbum || leftArtist) {
      getCoverUrl(leftAlbum, leftArtist).then(u => { if (!cancelled) setLeftUrl(u); });
    }
    if (rightAlbum || rightArtist) {
      getCoverUrl(rightAlbum, rightArtist).then(u => { if (!cancelled) setRightUrl(u); });
    }
    return () => { cancelled = true; };
  }, [leftAlbum, leftArtist, rightAlbum, rightArtist]);

  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const onMouseDown = useCallback(() => setDragging(true), []);
  const onMouseUp = useCallback(() => setDragging(false), []);
  const onMouseMove = useCallback((e) => {
    if (dragging) handleMove(e.clientX);
  }, [dragging, handleMove]);
  const onTouchMove = useCallback((e) => {
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('mousemove', onMouseMove);
      return () => {
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('mousemove', onMouseMove);
      };
    }
  }, [dragging, onMouseUp, onMouseMove]);

  const radius = Math.round(size * 0.12);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden shrink-0 select-none cursor-col-resize"
      style={{ width: size, height: size, borderRadius: radius }}
      onMouseDown={onMouseDown}
      onTouchMove={onTouchMove}
    >
      {/* Right image (full, behind) */}
      {rightUrl && (
        <img
          src={rightUrl}
          alt={`${rightAlbum || 'Album'} cover`}
          className={`absolute inset-0 w-full h-full object-cover ${rightLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setRightLoaded(true)}
        />
      )}
      {!rightUrl && (
        <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center">
          <VinylDisc size={size * 0.5} />
        </div>
      )}

      {/* Left image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPos}%` }}
      >
        {leftUrl && (
          <img
            src={leftUrl}
            alt={`${leftAlbum || 'Album'} cover`}
            className={`w-full h-full object-cover ${leftLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ width: size, height: size }}
            onLoad={() => setLeftLoaded(true)}
          />
        )}
        {!leftUrl && (
          <div className="w-full h-full bg-[#222] flex items-center justify-center" style={{ width: size }}>
            <VinylDisc size={size * 0.5} />
          </div>
        )}
      </div>

      {/* Slider handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
        style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="3" strokeLinecap="round">
            <polyline points="8 4 4 12 8 20" />
            <polyline points="16 4 20 12 16 20" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-1 left-1 text-[9px] text-white/80 bg-black/50 rounded px-1 py-0.5 pointer-events-none">
        {leftAlbum || 'A'}
      </div>
      <div className="absolute bottom-1 right-1 text-[9px] text-white/80 bg-black/50 rounded px-1 py-0.5 pointer-events-none">
        {rightAlbum || 'B'}
      </div>
    </div>
  );
}

export default function AlbumArt({
  album, artist, size = 72, sizePreset, accent = "#555", expandable, priority = false,
  onDominantColor, // Improvement 14: Callback with { r, g, b, hex } dominant color
  showDominantColor = false, // Show a glow/border with dominant color
}) {
  const [url, setUrl] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [inView, setInView] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dominantColor, setDominantColor] = useState(null);
  const containerRef = useRef(null);

  // Resolve size from preset or raw value
  const resolvedSize = sizePreset ? (SIZE_PRESETS[sizePreset] || size) : size;

  // Lazy loading with IntersectionObserver (skip for priority/above-the-fold images)
  useEffect(() => {
    if (priority) {
      setInView(true);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

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

  // Extract dominant color when image loads
  useEffect(() => {
    if (!url || !loaded) return;
    if (!onDominantColor && !showDominantColor) return;

    extractDominantColor(url, (color) => {
      if (color) {
        setDominantColor(color);
        onDominantColor?.(color);
      }
    });
  }, [url, loaded, onDominantColor, showDominantColor]);

  const handleClick = useCallback(() => {
    if (expandable && url && loaded) {
      setExpanded(true);
    }
  }, [expandable, url, loaded]);

  // Keyboard support for expanded lightbox (Escape to close)
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

  // Broken image fallback with music note icon
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

  // Dominant color glow style
  const dominantGlowStyle = showDominantColor && dominantColor ? {
    boxShadow: `0 0 ${resolvedSize * 0.15}px ${dominantColor.hex}40, 0 0 ${resolvedSize * 0.3}px ${dominantColor.hex}20`,
    borderColor: `${dominantColor.hex}60`,
  } : {};

  return (
    <>
      <div
        ref={containerRef}
        className={`overflow-hidden shrink-0 bg-[#1a1a1a] border border-gs-border-hover relative hover:scale-105 transition-all duration-200 ${expandable ? 'cursor-pointer' : ''}`}
        style={{ width: resolvedSize, height: resolvedSize, borderRadius: radius, ...dominantGlowStyle }}
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

        {/* Dominant color indicator dot */}
        {showDominantColor && dominantColor && loaded && (
          <div
            className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full border border-black/30 shadow-sm"
            style={{ background: dominantColor.hex }}
            title={`Dominant: ${dominantColor.hex}`}
          />
        )}

        {/* Vinyl record peek animation on hover */}
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
              <circle cx="50" cy="50" r="48" fill="#111" stroke="#222" strokeWidth="1" />
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
              <circle cx="50" cy="50" r="20" fill="#222" />
              {url && (
                <image
                  href={url}
                  x="30" y="30" width="40" height="40"
                  clipPath={`url(#vinyl-label-clip-${resolvedSize})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              )}
              <circle cx="50" cy="50" r="20" fill="none" stroke="#333" strokeWidth="0.8" />
              <circle cx="50" cy="50" r="2.5" fill="#0a0a0a" stroke="#333" strokeWidth="0.5" />
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
              {/* Show dominant color swatch in expanded view */}
              {dominantColor && (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-3 h-3 rounded-full border border-white/30" style={{ background: dominantColor.hex }} />
                  <span className="text-[11px] text-white/50 font-mono">{dominantColor.hex}</span>
                </div>
              )}
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
