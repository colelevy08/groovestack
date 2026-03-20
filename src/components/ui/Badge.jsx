// Small colored pill — used for condition grades, prices, etc.
// Supports size variants, prepend icon, clickable/dismissable mode,
// animated entrance, counter badge, notification dot, and dismissable with animation callback.
import { useState, useEffect, useRef } from 'react';

const SIZE_CLASSES = {
  sm: 'text-[9px] px-1.5 py-0.5',
  md: 'text-[10px] px-2 py-0.5',
  lg: 'text-[12px] px-2.5 py-1',
};

export default function Badge({
  label,
  color,
  size,
  icon,
  onClick,
  onDismiss,
  animate = false,      // Improvement 11: Animated entrance
  counter,              // Improvement 12: Counter badge (number overlay)
  dot,                  // Improvement 13: Notification dot
  dotColor = '#ef4444',
  dismissAnimationMs = 200, // Improvement 14: Dismiss animation duration
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const isClickable = onClick || onDismiss;
  const [visible, setVisible] = useState(true);
  const [dismissing, setDismissing] = useState(false);
  const [entered, setEntered] = useState(!animate);
  const badgeRef = useRef(null);

  // Improvement 11: Trigger entrance animation on mount
  useEffect(() => {
    if (animate) {
      requestAnimationFrame(() => setEntered(true));
    }
  }, [animate]);

  // Improvement 14: Animated dismiss with callback
  const handleDismiss = (e) => {
    e.stopPropagation();
    if (!onDismiss) return;
    setDismissing(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss(e);
    }, dismissAnimationMs);
  };

  if (!visible) return null;

  // Improvement 12: If counter is provided, render as a counter badge
  if (counter != null) {
    const displayCount = counter > 99 ? '99+' : String(counter);
    return (
      <span
        className={`inline-flex items-center justify-center font-bold font-mono rounded-full ${
          animate && !entered ? 'opacity-0 scale-50' : 'opacity-100 scale-100'
        }`}
        style={{
          background: color || '#ef4444',
          color: '#fff',
          minWidth: 18,
          height: 18,
          padding: '0 5px',
          fontSize: 10,
          lineHeight: '18px',
          transition: 'opacity 0.2s, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        aria-label={`${counter} notifications`}
      >
        {displayCount}
      </span>
    );
  }

  return (
    <span
      ref={badgeRef}
      className={`${sizeClass} font-bold tracking-wide rounded font-mono inline-flex items-center gap-1 relative ${
        isClickable ? 'cursor-pointer hover:opacity-80' : ''
      }`}
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
        transition: `opacity ${dismissAnimationMs}ms, transform ${dismissAnimationMs}ms, background 0.15s`,
        opacity: dismissing ? 0 : (animate && !entered ? 0 : 1),
        transform: dismissing
          ? 'scale(0.7)'
          : (animate && !entered ? 'scale(0.7) translateY(4px)' : 'scale(1) translateY(0)'),
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
    >
      {/* Improvement 13: Notification dot */}
      {dot && (
        <span
          className="absolute -top-1 -right-1 rounded-full border border-gs-bg"
          style={{
            width: 7,
            height: 7,
            background: dotColor,
          }}
          aria-label="New notification"
        />
      )}
      {icon && <span className="flex items-center shrink-0" style={{ fontSize: 'inherit' }}>{icon}</span>}
      {label}
      {onDismiss && (
        <button
          type="button"
          onClick={handleDismiss}
          className="ml-0.5 border-none bg-transparent cursor-pointer p-0 leading-none hover:opacity-100 transition-opacity"
          style={{ color: color + '99', fontSize: 'inherit' }}
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
