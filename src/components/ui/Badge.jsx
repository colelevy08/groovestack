// Small colored pill — used for condition grades, prices, etc.
// Supports size variants, prepend icon, clickable/dismissable mode,
// animated entrance, counter badge, notification dot, dismissable with animation callback,
// tooltip on hover with description, and badge stacking (multiple overlapping).
import { useState, useEffect, useRef } from 'react';

const SIZE_CLASSES = {
  sm: 'text-[9px] px-1.5 py-0.5',
  md: 'text-[10px] px-2 py-0.5',
  lg: 'text-[12px] px-2.5 py-1',
};

// --- Improvement 19: Badge stacking component ---
export function BadgeStack({
  badges = [], // Array of { label, color, ...otherBadgeProps }
  max = 3,
  size = 'md',
  overlapPx = 8,
}) {
  const displayed = badges.slice(0, max);
  const overflow = badges.length - max;

  return (
    <div className="inline-flex items-center" style={{ paddingLeft: overlapPx }}>
      {displayed.map((badge, i) => (
        <div
          key={badge.label + i}
          className="relative"
          style={{
            marginLeft: i === 0 ? 0 : -overlapPx,
            zIndex: displayed.length - i,
          }}
        >
          <Badge {...badge} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <span
          className="relative inline-flex items-center justify-center font-mono font-bold rounded text-gs-muted bg-[#2a2a2a] border border-gs-border"
          style={{
            marginLeft: -overlapPx / 2,
            zIndex: 0,
            fontSize: SIZE_CLASSES[size]?.includes('9px') ? 9 : SIZE_CLASSES[size]?.includes('12px') ? 12 : 10,
            padding: '1px 5px',
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

export default function Badge({
  label,
  color,
  size,
  icon,
  onClick,
  onDismiss,
  animate = false,
  counter,
  dot,
  dotColor = '#ef4444',
  dismissAnimationMs = 200,
  tooltip,         // Improvement 18: Tooltip text shown on hover
  tooltipPosition = 'top', // 'top' | 'bottom'
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const isClickable = onClick || onDismiss;
  const [visible, setVisible] = useState(true);
  const [dismissing, setDismissing] = useState(false);
  const [entered, setEntered] = useState(!animate);
  const [showTooltip, setShowTooltip] = useState(false);
  const badgeRef = useRef(null);

  // Trigger entrance animation on mount
  useEffect(() => {
    if (animate) {
      requestAnimationFrame(() => setEntered(true));
    }
  }, [animate]);

  // Animated dismiss with callback
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

  // If counter is provided, render as a counter badge
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

  const tooltipPositionClass = tooltipPosition === 'bottom'
    ? 'top-full mt-1.5'
    : 'bottom-full mb-1.5';

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
      onMouseEnter={() => tooltip && setShowTooltip(true)}
      onMouseLeave={() => tooltip && setShowTooltip(false)}
      onFocus={() => tooltip && setShowTooltip(true)}
      onBlur={() => tooltip && setShowTooltip(false)}
    >
      {/* Notification dot */}
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

      {/* Tooltip on hover */}
      {tooltip && showTooltip && (
        <span
          className={`absolute ${tooltipPositionClass} left-1/2 -translate-x-1/2 bg-gs-card border border-gs-border rounded-md px-2.5 py-1.5 shadow-xl z-50 whitespace-nowrap animate-fade-in pointer-events-none`}
          role="tooltip"
        >
          <span className="text-[11px] text-gs-text font-normal tracking-normal font-sans">{tooltip}</span>
          {/* Tooltip arrow */}
          <span
            className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-gs-card border-gs-border rotate-45 ${
              tooltipPosition === 'bottom'
                ? '-top-1 border-t border-l'
                : '-bottom-1 border-b border-r'
            }`}
          />
        </span>
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
