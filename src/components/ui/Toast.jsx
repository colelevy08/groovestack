// Notification toast — supports multiple types, auto-dismiss, close button, stacking,
// keyboard dismiss (Escape), screen reader focus, auto-dismiss countdown progress bar,
// action buttons, toast grouping, persistence, queue management, position configuration,
// undo action toast, progress toast with live updates, rich media toast (image/avatar),
// and optional sound notification.
import { useState, useEffect, useRef, useCallback, createContext, useContext, useMemo } from 'react';

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

// --- Sound notification support ---
const NOTIFICATION_SOUNDS = {
  default: [440, 0.15], // [frequency, duration]
  success: [523, 0.12],
  error: [220, 0.2],
  warning: [349, 0.15],
};

function playNotificationSound(type = 'default') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const [freq, dur] = NOTIFICATION_SOUNDS[type] || NOTIFICATION_SOUNDS.default;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
    setTimeout(() => ctx.close(), dur * 1000 + 100);
  } catch {
    // Silently fail if audio context is not available
  }
}

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
    sound = false, // Improvement 20: Play sound notification
    undoAction = null, // Improvement 4: Undo callback
    undoDuration = 5000, // How long undo is available
    progress = null, // Improvement 5: Progress value 0-100 or null
    image = null, // Improvement 6: Rich media image URL
    avatar = null, // Improvement 6: Rich media avatar URL
    subtitle = null, // Improvement 6: Subtitle text
  }) => {
    const id = ++idCounter.current;

    // Play sound if requested
    if (sound) {
      playNotificationSound(type);
    }

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

      // If undoAction is provided, auto-add the undo button as an action
      const resolvedActions = [...actions];
      if (undoAction) {
        resolvedActions.unshift({ label: 'Undo', onClick: () => undoAction(id), isUndo: true });
      }

      return [...prev, {
        id, message, type,
        duration: undoAction ? undoDuration : duration,
        persistent: persistent || !!undoAction,
        groupKey, groupCount: 1,
        actions: resolvedActions, dismissing: false,
        progress, image, avatar, subtitle,
        isUndo: !!undoAction,
      }];
    });

    return id;
  }, []);

  const updateToast = useCallback((id, updates) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
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
    <ToastQueueContext.Provider value={{ addToast, updateToast, dismissToast, clearAll, toasts }}>
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
  sound = false,
}) {
  const config = TYPE_CONFIG[type] || {
    bg: 'bg-gs-accent',
    shadow: 'shadow-gs-accent/30',
    barColor: 'bg-black/20',
    icon: null,
  };
  const toastRef = useRef(null);
  const soundPlayed = useRef(false);
  const posClass = POSITION_CLASSES[position] || POSITION_CLASSES['bottom-center'];

  // Focus the toast when it becomes visible for screen reader access
  useEffect(() => {
    if (visible && toastRef.current) {
      toastRef.current.focus();
    }
  }, [visible]);

  // Play sound when toast becomes visible
  useEffect(() => {
    if (visible && sound && !soundPlayed.current) {
      playNotificationSound(type);
      soundPlayed.current = true;
    }
    if (!visible) {
      soundPlayed.current = false;
    }
  }, [visible, sound, type]);

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
    progress = null,
    image = null,
    avatar = null,
    subtitle = null,
    isUndo = false,
  } = toast;
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const itemRef = useRef(null);
  const [undoCountdown, setUndoCountdown] = useState(isUndo ? Math.ceil(duration / 1000) : 0);

  // Auto-dismiss (skip for persistent toasts unless it's an undo toast)
  useEffect(() => {
    if (isUndo && duration && onDismiss) {
      // Undo toasts auto-dismiss after their duration
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
    if (duration && onDismiss && !persistent) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss, persistent, isUndo]);

  // Countdown timer for undo toasts
  useEffect(() => {
    if (!isUndo || undoCountdown <= 0) return;
    const interval = setInterval(() => {
      setUndoCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isUndo, undoCountdown]);

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

  const hasMedia = image || avatar;

  return (
    <div
      ref={itemRef}
      role="status"
      aria-live="polite"
      tabIndex={0}
      className={`${config.bg} text-black px-5 py-2.5 rounded-[10px] text-[13px] font-bold shadow-lg ${config.shadow} flex items-center gap-2 overflow-hidden ${
        dismissing ? 'animate-toast-out' : 'animate-toast-in'
      }`}
      style={{ position: 'relative', outline: 'none', maxWidth: hasMedia ? 400 : undefined }}
    >
      {/* Rich media: avatar */}
      {avatar && (
        <img
          src={avatar}
          alt=""
          className="w-7 h-7 rounded-full object-cover shrink-0 border border-black/20"
        />
      )}
      {/* Rich media: image */}
      {image && !avatar && (
        <img
          src={image}
          alt=""
          className="w-8 h-8 rounded-md object-cover shrink-0 border border-black/20"
        />
      )}
      {!hasMedia && config.icon}
      <div className="flex flex-col min-w-0">
        <span className="truncate">{message}</span>
        {/* Subtitle for rich media toasts */}
        {subtitle && (
          <span className="text-[11px] text-black/60 font-medium truncate">{subtitle}</span>
        )}
      </div>
      {/* Undo countdown badge */}
      {isUndo && undoCountdown > 0 && (
        <span className="ml-1 bg-black/20 text-black/80 text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0">
          {undoCountdown}s
        </span>
      )}
      {/* Group count badge */}
      {groupCount > 1 && (
        <span className="ml-1 bg-black/20 text-black/80 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
          {groupCount}x
        </span>
      )}
      {/* Progress bar for progress toasts */}
      {progress != null && (
        <div className="flex items-center gap-1.5 ml-1 shrink-0">
          <div className="w-16 h-1.5 rounded-full bg-black/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-black/40 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <span className="text-[10px] text-black/70 font-mono">{Math.round(progress)}%</span>
        </div>
      )}
      {/* Action buttons inside toast */}
      {actions.length > 0 && (
        <div className="flex items-center gap-1 ml-1">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                action.onClick?.();
                if (action.isUndo && onDismiss) onDismiss();
              }}
              className={`px-2 py-0.5 rounded border-none cursor-pointer text-[11px] font-bold transition-colors ${
                action.isUndo
                  ? 'bg-black/25 text-black hover:bg-black/35 underline'
                  : 'bg-black/15 text-black/80 hover:bg-black/25'
              }`}
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
      {/* Auto-dismiss countdown progress bar (hidden for persistent toasts unless undo) */}
      {!dismissing && duration && (!persistent || isUndo) && (
        <div
          className={`gs-toast-progress ${config.barColor || 'bg-black/20'}`}
          style={{ animationDuration: `${duration}ms` }}
        />
      )}
    </div>
  );
}
