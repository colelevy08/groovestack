// Reusable image lightbox with zoom, pan, keyboard navigation, gallery mode,
// download, and share. Self-contained overlay component.
import { useState, useEffect, useRef, useCallback } from 'react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.5;

function IconButton({ onClick, label, children, className = '' }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`w-9 h-9 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center cursor-pointer text-white/70 hover:text-white hover:bg-black/70 transition-colors backdrop-blur-sm ${className}`}
    >
      {children}
    </button>
  );
}

export default function ImageLightbox({
  images = [],
  initialIndex = 0,
  open = false,
  onClose,
  alt = 'Image',
}) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const currentImage = images[index] || null;
  const hasMultiple = images.length > 1;

  // Reset zoom/pan when image changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [index]);

  // Reset index when opening
  useEffect(() => {
    if (open) {
      setIndex(initialIndex);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [open, initialIndex]);

  const goNext = useCallback(() => {
    if (hasMultiple) setIndex(prev => (prev + 1) % images.length);
  }, [hasMultiple, images.length]);

  const goPrev = useCallback(() => {
    if (hasMultiple) setIndex(prev => (prev - 1 + images.length) % images.length);
  }, [hasMultiple, images.length]);

  const zoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(prev => {
      const next = Math.max(prev - ZOOM_STEP, MIN_ZOOM);
      if (next === MIN_ZOOM) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      switch (e.key) {
        case 'Escape': onClose?.(); break;
        case 'ArrowRight': goNext(); break;
        case 'ArrowLeft': goPrev(); break;
        case '+':
        case '=': zoomIn(); break;
        case '-': zoomOut(); break;
        case '0': resetZoom(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, goNext, goPrev, zoomIn, zoomOut, resetZoom]);

  // Mouse wheel zoom
  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [open, zoomIn, zoomOut]);

  // Pan handlers (mouse)
  const handleMouseDown = useCallback((e) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Pan handlers (touch)
  const handleTouchStart = useCallback((e) => {
    if (zoom <= 1 || e.touches.length !== 1) return;
    setDragging(true);
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    panStart.current = { ...pan };
  }, [zoom, pan]);

  const handleTouchMove = useCallback((e) => {
    if (!dragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.current.x;
    const dy = e.touches[0].clientY - dragStart.current.y;
    setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy });
  }, [dragging]);

  const handleTouchEnd = useCallback(() => {
    setDragging(false);
  }, []);

  // Download
  const handleDownload = useCallback(() => {
    if (!currentImage) return;
    const src = typeof currentImage === 'string' ? currentImage : currentImage.src;
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = (typeof currentImage === 'object' && currentImage.filename) || `image-${index + 1}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }, [currentImage, index]);

  // Share
  const handleShare = useCallback(async () => {
    const src = typeof currentImage === 'string' ? currentImage : currentImage?.src;
    if (!src) return;
    if (navigator.share) {
      try {
        await navigator.share({ url: src, title: alt });
      } catch {
        // User cancelled or share failed — silently ignore
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(src);
      } catch {
        // Clipboard write failed — silently ignore
      }
    }
  }, [currentImage, alt]);

  if (!open || images.length === 0) return null;

  const src = typeof currentImage === 'string' ? currentImage : currentImage?.src;
  const imageAlt = (typeof currentImage === 'object' && currentImage.alt) || `${alt} ${index + 1}`;

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[3000] flex flex-col items-center justify-center backdrop-blur-sm animate-overlay-in"
      onClick={e => e.target === e.currentTarget && onClose?.()}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10">
        <div className="flex items-center gap-2">
          {hasMultiple && (
            <span className="text-[12px] text-white/50 font-mono">
              {index + 1} / {images.length}
            </span>
          )}
          <span className="text-[12px] text-white/40">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <IconButton onClick={zoomOut} label="Zoom out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><path d="M8 11h6" />
            </svg>
          </IconButton>
          <IconButton onClick={zoomIn} label="Zoom in">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><path d="M11 8v6" /><path d="M8 11h6" />
            </svg>
          </IconButton>
          <IconButton onClick={resetZoom} label="Reset zoom">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" /><path d="M3 3v5h5" />
            </svg>
          </IconButton>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Download */}
          <IconButton onClick={handleDownload} label="Download">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
            </svg>
          </IconButton>

          {/* Share */}
          <IconButton onClick={handleShare} label="Share">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
            </svg>
          </IconButton>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Close */}
          <IconButton onClick={onClose} label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </IconButton>
        </div>
      </div>

      {/* Navigation arrows */}
      {hasMultiple && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center cursor-pointer text-white/60 hover:text-white hover:bg-black/70 transition-colors z-10 backdrop-blur-sm"
            aria-label="Previous image"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center cursor-pointer text-white/60 hover:text-white hover:bg-black/70 transition-colors z-10 backdrop-blur-sm"
            aria-label="Next image"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center w-full overflow-hidden select-none"
        style={{ cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {src ? (
          <img
            src={src}
            alt={imageAlt}
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg transition-transform duration-150"
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transition: dragging ? 'none' : 'transform 0.15s ease-out',
            }}
            draggable={false}
            onDoubleClick={() => zoom === 1 ? zoomIn() : resetZoom()}
          />
        ) : (
          <div className="w-64 h-64 rounded-xl bg-[#111] border border-[#222] flex items-center justify-center text-white/30 text-[14px]">
            Image not available
          </div>
        )}
      </div>

      {/* Gallery thumbnails */}
      {hasMultiple && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-t from-black/60 to-transparent z-10">
          {images.map((img, i) => {
            const thumbSrc = typeof img === 'string' ? img : img?.src;
            return (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`w-12 h-12 rounded-lg overflow-hidden border-2 cursor-pointer transition-all duration-150 shrink-0 ${
                  i === index ? 'border-white/80 scale-110' : 'border-white/20 opacity-50 hover:opacity-80'
                }`}
                aria-label={`View image ${i + 1}`}
              >
                {thumbSrc ? (
                  <img src={thumbSrc} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="w-full h-full bg-[#222] flex items-center justify-center text-white/30 text-[10px]">{i + 1}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
