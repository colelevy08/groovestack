// Circular user avatar — shows a custom image (via src prop), profile avatarUrl, or initials as fallback.
// Looks up the user's accent color and avatarUrl from USER_PROFILES via getProfile.
// Supports online status indicator, size variants, hover card preview, gradient fallback,
// group avatar stacking, edit overlay, and loading skeleton.
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

// Improvement 4: Group avatar stacking component
export function AvatarGroup({ users, max = 4, size, sizeVariant = 'sm', onOverflowClick }) {
  const displayed = users.slice(0, max);
  const overflow = users.length - max;
  const resolvedSize = sizeVariant ? (SIZE_MAP[sizeVariant] || SIZE_MAP.sm) : (size || 28);

  return (
    <div className="flex items-center" style={{ paddingLeft: resolvedSize * 0.3 }}>
      {displayed.map((user, i) => (
        <div
          key={typeof user === 'string' ? user : user.username}
          className="relative rounded-full border-2 border-gs-bg"
          style={{
            marginLeft: i === 0 ? 0 : -(resolvedSize * 0.3),
            zIndex: displayed.length - i,
          }}
        >
          <Avatar
            username={typeof user === 'string' ? user : user.username}
            src={typeof user === 'object' ? user.src : undefined}
            sizeVariant={sizeVariant}
            size={size}
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="relative rounded-full border-2 border-gs-bg flex items-center justify-center bg-[#2a2a2a] text-gs-muted font-mono font-bold shrink-0"
          style={{
            width: resolvedSize,
            height: resolvedSize,
            marginLeft: -(resolvedSize * 0.3),
            zIndex: 0,
            fontSize: resolvedSize * 0.3,
            cursor: onOverflowClick ? 'pointer' : 'default',
          }}
          onClick={onOverflowClick}
          role={onOverflowClick ? 'button' : undefined}
          tabIndex={onOverflowClick ? 0 : undefined}
          onKeyDown={onOverflowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOverflowClick(e); } } : undefined}
          aria-label={`${overflow} more users`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

export default function Avatar({ username, size, onClick, src, sizeVariant, online, showHoverCard, editable, onEdit, loading }) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
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
    cursor: onClick || editable ? "pointer" : "default", flexShrink: 0,
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

  // Improvement 5: Edit overlay on hover when editable
  const EditOverlay = editable && hovered ? (
    <div
      className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center animate-fade-in"
      onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
      role="button"
      aria-label="Edit avatar"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit?.(); } }}
    >
      <svg width={resolvedSize * 0.35} height={resolvedSize * 0.35} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    </div>
  ) : null;

  // Improvement 6: Loading skeleton state
  if (loading) {
    return (
      <div
        style={{ width: resolvedSize, height: resolvedSize, borderRadius: '50%', flexShrink: 0 }}
        className="overflow-hidden"
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.8s ease-in-out infinite',
          }}
        />
      </div>
    );
  }

  const wrapperProps = {
    onClick: editable ? onEdit : onClick,
    onMouseEnter: (e) => {
      if (onClick || editable) e.currentTarget.style.opacity = "0.75";
      if (showHoverCard || editable) setHovered(true);
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.opacity = "1";
      if (showHoverCard || editable) setHovered(false);
    },
    style: { ...baseStyle, display: 'inline-block', position: 'relative' },
  };

  if (imgSrc) {
    return (
      <div {...wrapperProps}>
        {/* Shimmer while image loads */}
        {!imgLoaded && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.8s ease-in-out infinite',
            }}
          />
        )}
        <img
          src={imgSrc}
          alt={`${p.displayName || username}'s avatar`}
          className={`w-full h-full object-cover block rounded-full transition-opacity duration-200 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImgLoaded(true)}
        />
        {EditOverlay}
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
      {EditOverlay}
      {StatusDot}
      {HoverCard}
    </div>
  );
}
