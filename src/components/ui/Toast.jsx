// Notification toast — supports multiple types, auto-dismiss, close button, stacking,
// keyboard dismiss (Escape), screen reader focus, auto-dismiss countdown progress bar,
// action buttons, toast grouping, persistence, queue management, and position configuration.
import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';

const TYPE_CONFIG = {
  success: {
    bg: 'bg-emerald-500',
    shadow: 'shadow-emerald-500/30',
    barColor: 'bg-emerald-800',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    ),
  },
  error: {
    bg: 'bg-red-500',
    shadow: 'shadow-red-500/30',
    barColor: 'bg-red-800',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    ),
  },
  warning: {
    bg: 'bg-amber-500',
    shadow: 'shadow-amber-500/30',
    barColor: 'bg-amber-800',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
  },
  info: {
    bg: 'bg-sky-500',
    shadow: 'shadow-sky-500/30',
    barColor: 'bg-sky-800',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    ),
  },
};

// --- Position presets ---
const POSITION_CLASSES = {
  'bottom-center': 'fixed bottom-7 left-1/2 -translate-x-1/2',
  'top-center': 'fixed top-7 left-1/2 -translate-x-1/2',
  'top-right': 'fixed top-7 right-7',
  'top-left': 'fixed top-7 left-7',
  'bottom-right': 'fixed bottom-7 right-7',
  'bottom-left': 'fixed bottom-7 left-7',
};

// --- Toast Queue Manager Context ---
// Provides centralized toast management with queue, grouping, and persistence.
const ToastQueueContext = createContext(null);

export function ToastQueueProvider({ children, maxVisible = 5, position = 'bottom-center' }) {
  const [toasts, setToasts] = useState([]);
  const idCounter = useRef(0);

  const addToast = useCallback(({
    message,
    type = 'info',
    duration = 3000,
    persistent = false,
    groupKey = null,
    actions = [], // Array of { label, onClick }
  }) => {
    const id = ++idCounter.current;

    setToasts(prev => {
      // Grouping: if groupKey matches an existing toast, collapse into it
      if (groupKey) {
        const existingIndex = prev.findIndex(t => t.groupKey === groupKey && !t.dismissing);
        if (existingIndex !== -1) {
          const updated = [...prev];
          const existing = updated[existingIndex];
          updated[existingIndex] = {
            ...existing,
            message,
            groupCount: (existing.groupCount || 1) + 1,
          };
          return updated;
        }
      }
      return [...prev, { id, message, type, duration, persistent, groupKey, groupCount: 1, actions, dismissing: false }];
    });

    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, dismissing: true } : t));
    // Remove after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Queue management: only show maxVisible at a time
  const visibleToasts = toasts.slice(-maxVisible);

  return (
    <ToastQueueContext.Provider value={{ addToast, dismissToast, clearAll, toasts }}>
      {children}
      <ToastContainer toasts={visibleToasts} onDismiss={dismissToast} position={position} />
    </ToastQueueContext.Provider>
  );
}

export function useToastQueue() {
  return useContext(ToastQueueContext);
}

// Simple single toast — backwards compatible with existing usage
// Focusable for screen reader accessibility, supports Escape to dismiss
export default function Toast({
  message,
  visible,
  type,
  onClose,
  duration = 2200,
  actions = [],
  persistent = false,
  position = 'bottom-center',
}) {
  const config = TYPE_CONFIG[type] || {
    bg: 'bg-gs-accent',
    shadow: 'shadow-gs-accent/30',
    barColor: 'bg-black/20',
    icon: null,
  };
  const toastRef = useRef(null);
  const posClass = POSITION_CLASSES[position] || POSITION_CLASSES['bottom-center'];

  // Focus the toast when it becomes visible for screen reader access
  useEffect(() => {
    if (visible && toastRef.current) {
      toastRef.current.focus();
    }
  }, [visible]);

  return (
    <div
      ref={toastRef}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={visible ? 0 : -1}
      className={`${posClass} ${config.bg} text-black px-5 py-2.5 rounded-[10px] text-[13px] font-bold z-[2000] transition-all duration-300 shadow-lg ${config.shadow} flex items-center gap-2 overflow-hidden ${
        visible ? 'opacity-100 translate-y-0 animate-toast-in pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      style={{ outline: 'none' }}
    >
      {config.icon}
      <span>{message}</span>
      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="flex items-center gap-1 ml-2">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className="px-2 py-0.5 rounded bg-black/15 border-none cursor-pointer text-black/80 text-[11px] font-bold hover:bg-black/25 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {onClose && (
        <button
          onClick={onClose}
          className="ml-2 w-5 h-5 rounded-full bg-black/15 border-none cursor-pointer text-black/60 text-sm flex items-center justify-center hover:bg-black/25 hover:text-black transition-colors"
          aria-label="Dismiss"
        >
          x
        </button>
      )}
      {/* Auto-dismiss countdown progress bar (not shown for persistent toasts) */}
      {visible && !persistent && (
        <div
          className={`gs-toast-progress ${config.barColor || 'bg-black/20'}`}
          style={{ animationDuration: `${duration}ms` }}
        />
      )}
    </div>
  );
}

// Stacked toast container for multiple simultaneous toasts
export function ToastContainer({ toasts = [], onDismiss, position = 'bottom-center' }) {
  const posClass = POSITION_CLASSES[position] || POSITION_CLASSES['bottom-center'];
  const isTop = position.startsWith('top');

  return (
    <div className={`${posClass} z-[2000] flex ${isTop ? 'flex-col' : 'flex-col-reverse'} gap-2 items-center`}>
      {toasts.map((toast, i) => (
        <ToastItem
          key={toast.id || i}
          toast={toast}
          onDismiss={onDismiss ? () => onDismiss(toast.id) : undefined}
        />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const {
    message,
    type = 'info',
    duration = 3000,
    dismissing,
    persistent = false,
    actions = [],
    groupCount = 1,
  } = toast;
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const itemRef = useRef(null);

  // Auto-dismiss (skip for persistent toasts)
  useEffect(() => {
    if (duration && onDismiss && !persistent) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss, persistent]);

  // Keyboard dismiss on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && onDismiss) onDismiss();
    };
    const el = itemRef.current;
    if (el) {
      el.addEventListener('keydown', handleKey);
      return () => el.removeEventListener('keydown', handleKey);
    }
  }, [onDismiss]);

  return (
    <div
      ref={itemRef}
      role="status"
      aria-live="polite"
      tabIndex={0}
      className={`${config.bg} text-black px-5 py-2.5 rounded-[10px] text-[13px] font-bold shadow-lg ${config.shadow} flex items-center gap-2 overflow-hidden ${
        dismissing ? 'animate-toast-out' : 'animate-toast-in'
      }`}
      style={{ position: 'relative', outline: 'none' }}
    >
      {config.icon}
      <span>{message}</span>
      {/* Group count badge */}
      {groupCount > 1 && (
        <span className="ml-1 bg-black/20 text-black/80 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
          {groupCount}x
        </span>
      )}
      {/* Action buttons inside toast */}
      {actions.length > 0 && (
        <div className="flex items-center gap-1 ml-1">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className="px-2 py-0.5 rounded bg-black/15 border-none cursor-pointer text-black/80 text-[11px] font-bold hover:bg-black/25 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 w-5 h-5 rounded-full bg-black/15 border-none cursor-pointer text-black/60 text-sm flex items-center justify-center hover:bg-black/25 hover:text-black transition-colors"
          aria-label="Dismiss"
        >
          x
        </button>
      )}
      {/* Auto-dismiss countdown progress bar (hidden for persistent toasts) */}
      {!dismissing && duration && !persistent && (
        <div
          className={`gs-toast-progress ${config.barColor || 'bg-black/20'}`}
          style={{ animationDuration: `${duration}ms` }}
        />
      )}
    </div>
  );
}
