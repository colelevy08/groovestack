// Generic centered overlay modal — used by all modal components.
// Clicking the backdrop triggers onClose. Header is sticky for scrolling content.
// Supports entrance/exit animations, keyboard trap, backdrop blur, size variants,
// and focus management (returns focus to trigger element on close).
import { useState, useEffect, useRef, useCallback } from 'react';

const SIZE_MAP = {
  sm: "380px",
  md: "480px",
  lg: "620px",
  xl: "800px",
};

export default function Modal({ open, onClose, title, children, width = "480px", size }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const modalRef = useRef(null);
  const triggerRef = useRef(null); // Stores the element that had focus before modal opened (#5)

  // Resolve width: named size takes priority over raw width
  const resolvedWidth = size ? (SIZE_MAP[size] || SIZE_MAP.md) : width;

  // Open animation + capture trigger element for focus return
  useEffect(() => {
    if (open) {
      // Store the currently focused element so we can return focus on close
      triggerRef.current = document.activeElement;
      setClosing(false);
      // Small delay so the DOM is mounted before animation class applies
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  // Close with exit animation + return focus to trigger (#5)
  const handleClose = useCallback(() => {
    setClosing(true);
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

  if (!open && !closing) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/85 flex items-center justify-center z-[1000] backdrop-blur-md ${
        closing ? 'animate-overlay-out' : 'animate-overlay-in'
      }`}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-label={title || undefined}
        className={`gs-modal-box ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        style={{ width: resolvedWidth }}
      >
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
