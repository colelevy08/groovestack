// Generic centered overlay modal — used by all modal components.
// Clicking the backdrop triggers onClose. Header is sticky for scrolling content.
// Supports entrance/exit animations, keyboard trap, backdrop blur, size variants,
// focus management (returns focus to trigger element on close),
// swipe-down-to-close on mobile, modal stacking with incremented z-index,
// size presets (xs-fullscreen), confirmation variant, multi-step wizard,
// minimize to corner, and modal history (back button between modals).
import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';

const SIZE_MAP = {
  xs: "320px",
  sm: "380px",
  md: "480px",
  lg: "620px",
  xl: "800px",
  fullscreen: "100vw",
};

const FULLSCREEN_STYLES = {
  width: '100vw',
  height: '100vh',
  maxWidth: '100vw',
  maxHeight: '100vh',
  borderRadius: 0,
};

// Global counter for stacking modals — each new modal gets a higher z-index
let modalStackCount = 0;

// --- Modal History Context ---
// Allows modals to push/pop a history stack for back-button navigation between modals.
const ModalHistoryContext = createContext(null);

export function ModalHistoryProvider({ children }) {
  const [history, setHistory] = useState([]); // stack of { id, props }
  const push = useCallback((entry) => {
    setHistory(prev => [...prev, entry]);
  }, []);
  const pop = useCallback(() => {
    setHistory(prev => prev.slice(0, -1));
  }, []);
  const current = history.length > 0 ? history[history.length - 1] : null;
  const canGoBack = history.length > 1;
  const goBack = useCallback(() => {
    setHistory(prev => prev.slice(0, -1));
  }, []);
  const clear = useCallback(() => setHistory([]), []);

  return (
    <ModalHistoryContext.Provider value={{ history, push, pop, current, canGoBack, goBack, clear }}>
      {children}
    </ModalHistoryContext.Provider>
  );
}

export function useModalHistory() {
  return useContext(ModalHistoryContext);
}

// --- Confirmation Modal ---
// A convenience wrapper that renders confirm/cancel buttons automatically.
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger', // 'danger' | 'primary'
  loading = false,
  size = 'sm',
  children,
}) {
  const confirmBtnClass = confirmVariant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'gs-btn-gradient text-white';

  return (
    <Modal open={open} onClose={onClose} title={title} size={size}>
      {message && (
        <p className="text-[13px] text-gs-muted mb-4">{message}</p>
      )}
      {children}
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gs-border">
        <button
          onClick={onClose}
          disabled={loading}
          className="gs-btn-secondary px-4 py-2 rounded-lg text-[13px] font-semibold"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-[13px] font-semibold border-none cursor-pointer transition-colors ${confirmBtnClass} ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Loading...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// --- Multi-Step Modal Wizard ---
// Renders a modal with step navigation, progress indicator, and per-step content.
export function WizardModal({
  open,
  onClose,
  title,
  steps = [], // Array of { title, content: ReactNode, validate?: () => bool }
  onComplete,
  size = 'lg',
  completeLabel = 'Complete',
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState('next');

  // Reset step when modal opens
  useEffect(() => {
    if (open) setCurrentStep(0);
  }, [open]);

  const canNext = currentStep < steps.length - 1;
  const canPrev = currentStep > 0;
  const step = steps[currentStep];

  const handleNext = useCallback(() => {
    if (step?.validate && !step.validate()) return;
    if (canNext) {
      setDirection('next');
      setCurrentStep(s => s + 1);
    } else if (onComplete) {
      onComplete();
    }
  }, [canNext, step, onComplete]);

  const handlePrev = useCallback(() => {
    if (canPrev) {
      setDirection('prev');
      setCurrentStep(s => s - 1);
    }
  }, [canPrev]);

  const goToStep = useCallback((i) => {
    setDirection(i > currentStep ? 'next' : 'prev');
    setCurrentStep(i);
  }, [currentStep]);

  return (
    <Modal open={open} onClose={onClose} title={title || step?.title} size={size}>
      {/* Step progress bar */}
      <div className="flex items-center gap-1 mb-4">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => i < currentStep && goToStep(i)}
            disabled={i > currentStep}
            className="p-0 border-none bg-transparent cursor-pointer disabled:cursor-not-allowed flex-1"
            aria-label={`Step ${i + 1}: ${s.title}`}
          >
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep ? 'bg-gs-accent' : i < currentStep ? 'bg-gs-accent/40' : 'bg-gs-border-hover'
              }`}
            />
          </button>
        ))}
      </div>

      {/* Step label */}
      <p className="text-[11px] text-gs-dim mb-3">
        Step {currentStep + 1} of {steps.length} {step?.title ? `- ${step.title}` : ''}
      </p>

      {/* Step content */}
      <div
        key={currentStep}
        className={direction === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'}
        style={{ animationDuration: '0.2s' }}
      >
        {step?.content}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-5 pt-3 border-t border-gs-border">
        <button
          onClick={handlePrev}
          disabled={!canPrev}
          className="gs-btn-secondary px-3.5 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          className="gs-btn-gradient px-4 py-2 rounded-lg text-[12px] font-bold"
        >
          {canNext ? 'Next' : completeLabel}
        </button>
      </div>
    </Modal>
  );
}

// --- Main Modal Component ---
export default function Modal({ open, onClose, title, children, width = "480px", size }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [stackIndex, setStackIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const modalRef = useRef(null);
  const triggerRef = useRef(null); // Stores the element that had focus before modal opened

  // Swipe-to-close state (mobile)
  const touchStartY = useRef(null);
  const touchCurrentY = useRef(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Modal history context (optional)
  const modalHistory = useContext(ModalHistoryContext);

  // Resolve width: named size takes priority over raw width
  const isFullscreen = size === 'fullscreen';
  const resolvedWidth = size ? (SIZE_MAP[size] || SIZE_MAP.md) : width;

  // Open animation + capture trigger element for focus return + stacking
  useEffect(() => {
    if (open) {
      // Store the currently focused element so we can return focus on close
      triggerRef.current = document.activeElement;
      setClosing(false);
      setMinimized(false);
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

  // Close with exit animation + return focus to trigger
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

  // Minimize to corner
  const handleMinimize = useCallback(() => {
    setMinimized(true);
  }, []);

  const handleRestore = useCallback(() => {
    setMinimized(false);
  }, []);

  // Keyboard: Escape to close + Tab trap
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (minimized) {
          handleClose();
        } else {
          handleClose();
        }
        return;
      }

      // Tab trap: keep focus within modal
      if (e.key === 'Tab' && modalRef.current && !minimized) {
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
  }, [open, handleClose, minimized]);

  // Focus first focusable element on open
  useEffect(() => {
    if (open && visible && modalRef.current && !minimized) {
      const focusable = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        setTimeout(() => focusable[0].focus(), 50);
      }
    }
  }, [open, visible, minimized]);

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

  // Minimized state: show as a small pill in the bottom-right corner
  if (minimized) {
    return (
      <button
        onClick={handleRestore}
        className="fixed bottom-4 right-4 flex items-center gap-2 bg-gs-card border border-gs-border rounded-lg px-3 py-2 shadow-xl cursor-pointer hover:border-gs-accent transition-colors animate-fade-in"
        style={{ zIndex }}
        aria-label={`Restore modal: ${title}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gs-accent">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
        <span className="text-[12px] font-semibold text-gs-text truncate max-w-[150px]">{title || 'Modal'}</span>
        <button
          onClick={(e) => { e.stopPropagation(); handleClose(); }}
          className="ml-1 w-5 h-5 rounded-full bg-black/15 border-none cursor-pointer text-gs-muted text-xs flex items-center justify-center hover:bg-black/25 hover:text-gs-text transition-colors"
          aria-label="Close"
        >
          x
        </button>
      </button>
    );
  }

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
          ...(isFullscreen ? FULLSCREEN_STYLES : {}),
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
        {/* Sticky header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gs-border sticky top-0 bg-gs-surface z-[1]">
          <div className="flex items-center gap-2">
            {/* Modal history back button */}
            {modalHistory?.canGoBack && (
              <button
                onClick={modalHistory.goBack}
                className="w-7 h-7 rounded-md bg-[#1a1a1a] border-none cursor-pointer text-gs-muted flex items-center justify-center hover:bg-[#222] hover:text-gs-text transition-colors"
                aria-label="Go back"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <h2 id="modal-title" className="text-[15px] font-bold tracking-tight text-gs-text m-0">{title}</h2>
          </div>
          <div className="flex items-center gap-1">
            {/* Minimize button */}
            <button
              onClick={handleMinimize}
              aria-label="Minimize"
              className="w-7 h-7 rounded-md bg-[#1a1a1a] border-none cursor-pointer text-gs-muted text-lg flex items-center justify-center hover:bg-[#222] hover:text-gs-text transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            {/* Close button */}
            <button
              onClick={handleClose}
              aria-label="Close"
              className="w-7 h-7 rounded-md bg-[#1a1a1a] border-none cursor-pointer text-gs-muted text-lg flex items-center justify-center hover:bg-[#222] hover:text-gs-text transition-colors"
            >
              x
            </button>
          </div>
        </div>
        <div className="gs-modal-body p-5">{children}</div>
      </div>
    </div>
  );
}
