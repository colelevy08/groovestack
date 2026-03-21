// Inline @handle text link that opens a user's profile on click.
// Animated underline on hover. Stops event propagation so parent card clicks don't also fire.
// Includes: #21 Inline avatar, #22 Follow status indicator, #23 Tooltip with mini profile,
// #24 Click ripple effect, #25 Blocked user indicator.
import { useState, useRef, useCallback } from 'react';
import Avatar from './ui/Avatar';
import { getProfile } from '../utils/helpers';

export default function UserLink({ username, onViewUser, className = "", verified = false, isFollowing = false, isBlocked = false }) {
  // All hooks declared before any conditional returns
  const [showTooltip, setShowTooltip] = useState(false);
  const [ripple, setRipple] = useState(null);
  const hoverTimeout = useRef(null);
  const linkRef = useRef(null);
  const p = getProfile(username);

  // #23 — Tooltip handlers
  const handleMouseEnter = useCallback(() => {
    if (isBlocked) return;
    hoverTimeout.current = setTimeout(() => setShowTooltip(true), 600);
  }, [isBlocked]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimeout.current);
    setShowTooltip(false);
  }, []);

  // #24 — Click ripple effect
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (isBlocked) return;

    // Create ripple
    const rect = linkRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setRipple({ x, y, key: Date.now() });
      setTimeout(() => setRipple(null), 500);
    }

    onViewUser(username);
  }, [username, onViewUser, isBlocked]);

  // #25 — Blocked user rendering
  if (isBlocked) {
    return (
      <span
        className={`text-gs-faint font-semibold text-xs inline-flex items-center gap-1 line-through opacity-50 cursor-not-allowed ${className}`}
        title="This user is blocked"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
          <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
        @{username}
      </span>
    );
  }

  return (
    <span
      ref={linkRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`text-gs-accent font-semibold cursor-pointer text-xs relative inline-flex items-center gap-1 group/link overflow-hidden ${className}`}
    >
      {/* #21 — Inline avatar */}
      <Avatar username={username} size={14} />

      {/* Hover underline animation */}
      <span className="relative">
        @{username}
        <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-gs-accent transition-all duration-300 group-hover/link:w-full" />
      </span>

      {/* Verified badge for verified users */}
      {verified && (
        <span title="Verified user" className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500 shrink-0">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
      )}

      {/* #22 — Follow status indicator */}
      {isFollowing && (
        <span title="You follow this user" className="inline-flex items-center justify-center text-[8px] text-gs-accent opacity-70">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
        </span>
      )}

      {/* #24 — Click ripple effect */}
      {ripple && (
        <span
          key={ripple.key}
          className="absolute rounded-full bg-gs-accent/20 pointer-events-none animate-ping"
          style={{
            left: ripple.x - 8,
            top: ripple.y - 8,
            width: 16,
            height: 16,
            animationDuration: '0.5s',
            animationIterationCount: 1,
          }}
        />
      )}

      {/* #23 — Tooltip with mini profile */}
      {showTooltip && (
        <span
          className="absolute left-0 top-full mt-1.5 bg-gs-surface border border-gs-border rounded-lg shadow-2xl z-40 w-[190px] p-2.5 animate-fade-in cursor-default"
          onClick={e => e.stopPropagation()}
          onMouseEnter={() => clearTimeout(hoverTimeout.current)}
          onMouseLeave={handleMouseLeave}
        >
          <span className="flex items-center gap-2 mb-1.5">
            <Avatar username={username} size={28} />
            <span className="block">
              <span className="text-[11px] font-bold text-gs-text block leading-tight flex items-center gap-1">
                {p.displayName || username}
                {verified && (
                  <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-blue-500 shrink-0">
                    <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </span>
                )}
              </span>
              <span className="text-[9px] text-gs-dim font-mono block">@{username}</span>
            </span>
          </span>
          {p.bio && <span className="text-[10px] text-gs-dim leading-relaxed block mb-1.5">{p.bio.slice(0, 80)}{p.bio.length > 80 ? '...' : ''}</span>}
          <span className="flex gap-2 text-[9px] text-gs-faint">
            {p.location && <span>{p.location}</span>}
            {p.favGenre && <span>{p.favGenre}</span>}
            {p.followers && <span>{p.followers.length} followers</span>}
          </span>
          {isFollowing && (
            <span className="block mt-1.5 text-[9px] text-gs-accent font-semibold">Following</span>
          )}
        </span>
      )}
    </span>
  );
}
