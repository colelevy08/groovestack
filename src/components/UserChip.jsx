// Compact inline user widget showing an Avatar + display name + @handle.
// Clicking it opens that user's profile via onViewUser (stops event propagation to avoid triggering parent clicks).
// Used in Card.jsx as the author header on each record post.
import { useState, useRef } from 'react';
import Avatar from './ui/Avatar';
import { getProfile } from '../utils/helpers';

export default function UserChip({ username, onViewUser, onFollow, showFollowBtn = false, mutualFriends = 0 }) {
  const p = getProfile(username);
  const [showPopup, setShowPopup] = useState(false);
  const [following, setFollowing] = useState(false);
  const hoverTimeout = useRef(null);

  // #16 — Online status (simulated from username hash)
  const isOnline = username.length % 3 !== 0;

  // #17 — Hover popup handlers
  const handleMouseEnter = () => {
    hoverTimeout.current = setTimeout(() => setShowPopup(true), 500);
  };
  const handleMouseLeave = () => {
    clearTimeout(hoverTimeout.current);
    setShowPopup(false);
  };

  // #18 — Follow handler
  const handleFollow = (e) => {
    e.stopPropagation();
    setFollowing(f => !f);
    onFollow?.(username);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={e => { e.stopPropagation(); onViewUser(username); }}
        className="bg-transparent border-none cursor-pointer p-0 flex items-center gap-1.5 hover:bg-[#111] rounded-lg transition-colors"
      >
        {/* #16 — Avatar with online status dot */}
        <div className="relative">
          <Avatar username={username} size={30} />
          {isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-gs-surface" />
          )}
        </div>
        <div className="text-left">
          <div className="text-xs font-semibold text-[#e5e5e5] leading-tight flex items-center gap-1">
            {p.displayName || username}
            {/* #19 — Mutual friend indicator */}
            {mutualFriends > 0 && (
              <span className="text-[9px] text-gs-dim font-normal" title={`${mutualFriends} mutual friend${mutualFriends > 1 ? 's' : ''}`}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline -mt-px">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
                {mutualFriends}
              </span>
            )}
          </div>
          <div className="text-[10px] text-gs-dim font-mono">@{username}</div>
        </div>
        {/* #18 — Inline follow button */}
        {showFollowBtn && (
          <button
            onClick={handleFollow}
            className={`ml-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold cursor-pointer border transition-colors ${
              following
                ? 'bg-gs-accent/10 border-gs-accent/25 text-gs-accent'
                : 'bg-[#111] border-gs-border text-gs-dim hover:text-gs-muted hover:border-gs-border-hover'
            }`}
          >
            {following ? 'Following' : 'Follow'}
          </button>
        )}
      </button>

      {/* #17 — Hover popup with mini profile card */}
      {showPopup && (
        <div
          className="absolute left-0 top-full mt-1 bg-gs-surface border border-gs-border rounded-xl shadow-2xl z-30 w-[220px] p-3.5 animate-fade-in"
          onMouseEnter={() => clearTimeout(hoverTimeout.current)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="relative">
              <Avatar username={username} size={36} />
              {isOnline && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-gs-surface" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-gs-text">{p.displayName || username}</div>
              <div className="text-[10px] text-gs-dim font-mono">@{username}</div>
            </div>
          </div>
          {p.bio && <p className="text-[11px] text-[#777] leading-relaxed mb-2">{p.bio.slice(0, 100)}{p.bio.length > 100 ? '...' : ''}</p>}
          <div className="flex gap-3 mb-2.5">
            {p.location && (
              <span className="text-[10px] text-gs-dim flex items-center gap-1">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {p.location}
              </span>
            )}
            {p.favGenre && (
              <span className="text-[10px] text-gs-dim flex items-center gap-1">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M8 17V5l12-2v12"/></svg>
                {p.favGenre}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gs-faint font-mono">{p.followers?.length || 0} followers</span>
            <button
              onClick={handleFollow}
              className={`px-3 py-1 rounded-md text-[10px] font-bold cursor-pointer border transition-colors ${
                following
                  ? 'bg-gs-accent/10 border-gs-accent/25 text-gs-accent'
                  : 'bg-[#111] border-gs-border text-gs-dim hover:text-gs-muted hover:border-gs-border-hover'
              }`}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
