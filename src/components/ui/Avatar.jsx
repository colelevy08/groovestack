// Circular user avatar — shows a custom image (via src prop), profile avatarUrl, or initials as fallback.
// Looks up the user's accent color and avatarUrl from USER_PROFILES via getProfile.
// Supports online status indicator, size variants, hover card preview, and gradient fallback.
import { useState } from 'react';
import { getProfile, getInitials } from '../../utils/helpers';

const SIZE_MAP = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
};

// Generate a consistent gradient based on username
function usernameGradient(username) {
  if (!username) return ['#333', '#555'];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40) % 360;
  return [`hsl(${h1}, 60%, 35%)`, `hsl(${h2}, 60%, 45%)`];
}

export default function Avatar({ username, size, onClick, src, sizeVariant, online, showHoverCard }) {
  const [hovered, setHovered] = useState(false);
  const p = getProfile(username);
  const accent = p.accent || "#0ea5e9";
  const initials = getInitials(username) || (p.displayName || username).slice(0, 2).toUpperCase();

  // Resolve size: named variant takes priority over raw size
  const resolvedSize = sizeVariant ? (SIZE_MAP[sizeVariant] || SIZE_MAP.md) : (size || 34);

  // Use explicit src first, then fall back to profile avatarUrl
  const imgSrc = src || p.avatarUrl;

  const [grad1, grad2] = usernameGradient(username);

  const baseStyle = {
    width: resolvedSize, height: resolvedSize, borderRadius: "50%",
    cursor: onClick ? "pointer" : "default", flexShrink: 0,
    transition: "opacity 0.15s", overflow: "hidden",
    position: 'relative',
  };

  const statusDotSize = Math.max(8, resolvedSize * 0.22);

  const StatusDot = online != null ? (
    <span
      className="absolute block rounded-full border-2 border-gs-bg"
      style={{
        width: statusDotSize,
        height: statusDotSize,
        bottom: 0,
        right: 0,
        background: online ? '#22c55e' : '#555',
      }}
      aria-label={online ? 'Online' : 'Offline'}
    />
  ) : null;

  const HoverCard = showHoverCard && hovered ? (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gs-card border border-gs-border rounded-lg px-3 py-1.5 shadow-xl z-50 whitespace-nowrap animate-fade-in pointer-events-none"
      role="tooltip"
    >
      <span className="text-[12px] font-semibold text-gs-text">
        {p.displayName || username}
      </span>
      <span className="text-[11px] text-gs-muted ml-1">@{username}</span>
    </div>
  ) : null;

  const wrapperProps = {
    onClick,
    onMouseEnter: (e) => {
      if (onClick) e.currentTarget.style.opacity = "0.75";
      if (showHoverCard) setHovered(true);
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.opacity = "1";
      if (showHoverCard) setHovered(false);
    },
    style: { ...baseStyle, display: 'inline-block', position: 'relative' },
  };

  if (imgSrc) {
    return (
      <div {...wrapperProps}>
        <img src={imgSrc} alt={username} className="w-full h-full object-cover block rounded-full" />
        {StatusDot}
        {HoverCard}
      </div>
    );
  }

  return (
    <div {...wrapperProps}>
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${grad1}, ${grad2})`,
          border: `1.5px solid ${accent}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: resolvedSize * 0.33, fontWeight: 700, color: '#fff',
          fontFamily: "'DM Mono',monospace",
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        {initials}
      </div>
      {StatusDot}
      {HoverCard}
    </div>
  );
}
