// Album art component — drop-in replacement for VinylDisc.
// Fetches real album cover art via iTunes Search API, falls back to VinylDisc while loading or on error.
// Supports lazy loading with IntersectionObserver, blur-up placeholder, click to expand, and skeleton shimmer.
import { useState, useEffect, useRef, useCallback } from 'react';
import VinylDisc from './VinylDisc';
import { getCoverUrl } from '../../utils/coverArt';

export default function AlbumArt({ album, artist, size = 72, accent = "#555", expandable, priority = false }) {
  const [url, setUrl] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [inView, setInView] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef(null);

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

  // Show VinylDisc as fallback while loading, on error, or if no art found
  if (!inView || (!url && !errored)) {
    const radius = Math.round(size * 0.18);
    return (
      <div
        ref={containerRef}
        className="overflow-hidden shrink-0 relative"
        style={{ width: size, height: size, borderRadius: radius }}
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
            <VinylDisc accent={accent} size={size} />
          </div>
        )}
      </div>
    );
  }

  if (!url || errored) {
    return <VinylDisc accent={accent} size={size} />;
  }

  const radius = Math.round(size * 0.18);

  return (
    <>
      <div
        ref={containerRef}
        className={`overflow-hidden shrink-0 bg-[#1a1a1a] border border-gs-border-hover relative hover:scale-105 transition-transform duration-200 ${expandable ? 'cursor-pointer' : ''}`}
        style={{ width: size, height: size, borderRadius: radius }}
        onClick={handleClick}
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
              <VinylDisc accent={accent} size={size} />
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
      </div>

      {/* Full-size expanded preview overlay */}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[2000] animate-fade-in cursor-pointer"
          onClick={() => setExpanded(false)}
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
    </>
  );
}
