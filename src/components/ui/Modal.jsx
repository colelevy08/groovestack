// Generic centered overlay modal — used by all modal components.
// Clicking the backdrop triggers onClose. Header is sticky for scrolling content.
// Supports entrance/exit animations, keyboard trap, backdrop blur, size variants,
// focus management (returns focus to trigger element on close),
// swipe-down-to-close on mobile, and modal stacking with incremented z-index.
import { useState, useEffect, useRef, useCallback } from 'react';

const SIZE_MAP = {
  sm: "380px",
  md: "480px",
  lg: "620px",
  xl: "800px",
};

// Global counter for stacking modals — each new modal gets a higher z-index
let modalStackCount = 0;

export default function Modal({ open, onClose, title, children, width = "480px", size }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [stackIndex, setStackIndex] = useState(0);
  const modalRef = useRef(null);
  const triggerRef = useRef(null); // Stores the element that had focus before modal opened (#5)

  // Swipe-to-close state (mobile)
  const touchStartY = useRef(null);
  const touchCurrentY = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Resolve width: named size takes priority over raw width
  const resolvedWidth = size ? (SIZE_MAP[size] || SIZE_MAP.md) : width;

  // Open animation + capture trigger element for focus return + stacking
  useEffect(() => {
    if (open) {
      // Store the currently focused element so we can return focus on close
      triggerRef.current = document.activeElement;
      setClosing(false);
      modalStackCount++;
      setStackIndex(modalStackCount);
      // Small delay so the DOM is mounted before animation class applies
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
    return () => {
      if (open) modalStackCount = Math.max(0, modalStackCount - 1);
    };
  }, [open]);

  // Close with exit animation + return focus to trigger (#5)
  const handleClose = useCallback(() => {
    setClosing(true);
    setSwipeOffset(0);
    setTimeout(() => {
      setClosing(false);
      setVisible(false);
      onClose();
      // Return focus to the element that triggered the modal
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        try { triggerRef.current.focus(); } catch { /* element may be unmounted */ }
      }
    }, 150); // matches modal-out duration
  }, [onClose]);

  // Keyboard: Escape to close + Tab trap
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      // Tab trap: keep focus within modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  // Focus first focusable element on open
  useEffect(() => {
    if (open && visible && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        setTimeout(() => focusable[0].focus(), 50);
      }
    }
  }, [open, visible]);

  // Swipe-to-close handlers (mobile)
  const onTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = null;
  }, []);

  const onTouchMove = useCallback((e) => {
    if (touchStartY.current === null) return;
    touchCurrentY.current = e.touches[0].clientY;
    const delta = touchCurrentY.current - touchStartY.current;
    // Only allow downward swipe
    if (delta > 0) {
      setSwipeOffset(delta);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (swipeOffset > 120) {
      handleClose();
    } else {
      setSwipeOffset(0);
    }
    touchStartY.current = null;
    touchCurrentY.current = null;
  }, [swipeOffset, handleClose]);

  if (!open && !closing) return null;

  // Stacked z-index: base 1000 + 10 per stack level
  const zIndex = 1000 + (stackIndex * 10);

  return (
    <div
      className={`fixed inset-0 bg-black/85 flex items-center justify-center backdrop-blur-md ${
        closing ? 'animate-overlay-out' : 'animate-overlay-in'
      }`}
      style={{ zIndex }}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-label={title || undefined}
        className={`gs-modal-box ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        style={{
          width: resolvedWidth,
          transform: swipeOffset > 0 ? `translateY(${swipeOffset}px)` : undefined,
          opacity: swipeOffset > 0 ? Math.max(0.4, 1 - swipeOffset / 300) : undefined,
          transition: swipeOffset > 0 ? 'none' : undefined,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Swipe indicator for mobile */}
        <div className="flex justify-center pt-2 pb-0 md:hidden">
          <div className="w-8 h-1 rounded-full bg-gs-border-hover" />
        </div>
        {/* Sticky header with proper heading hierarchy (#3) */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gs-border sticky top-0 bg-gs-surface z-[1]">
          <h2 id="modal-title" className="text-[15px] font-bold tracking-tight text-gs-text m-0">{title}</h2>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="w-7 h-7 rounded-md bg-[#1a1a1a] border-none cursor-pointer text-gs-muted text-lg flex items-center justify-center hover:bg-[#222] hover:text-gs-text transition-colors"
          >
            ×
          </button>
        </div>
        <div className="gs-modal-body p-5">{children}</div>
      </div>
    </div>
  );
}
