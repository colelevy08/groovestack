// Compact inline user widget showing an Avatar + display name + @handle.
// Clicking it opens that user's profile via onViewUser (stops event propagation to avoid triggering parent clicks).
// Used in Card.jsx as the author header on each record post.
// Includes: #16 Reputation badge, #17 Activity indicator, #18 Quick action dropdown,
// #19 Hover stats card enhancement, #20 Verified seller checkmark.
import { useState, useRef } from 'react';
import Avatar from './ui/Avatar';
import { getProfile } from '../utils/helpers';

export default function UserChip({ username, onViewUser, onFollow, onMessage, showFollowBtn = false, mutualFriends = 0, forSaleCount = 0, followerCount = 0, verified = false }) {
  const p = getProfile(username);
  const [showPopup, setShowPopup] = useState(false);
  const [following, setFollowing] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const hoverTimeout = useRef(null);

  // Online status (simulated from username hash)
  const isOnline = username.length % 3 !== 0;

  // #16 — Reputation badge: derive tier from followerCount + forSaleCount
  const repScore = (followerCount * 3) + (forSaleCount * 5);
  const repBadge = repScore >= 30
    ? { label: 'Top', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
    : repScore >= 10
    ? { label: 'Trusted', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
    : null;

  // #17 — Activity indicator: derive current activity from username hash
  const activityHash = username.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const activities = [
    { label: 'Browsing', icon: '👀', color: 'text-blue-400' },
    { label: 'Listening', icon: '🎧', color: 'text-violet-400' },
    { label: 'Posting', icon: '✍️', color: 'text-emerald-400' },
  ];
  const currentActivity = isOnline ? activities[activityHash % 3] : null;

  // Hover popup handlers
  const handleMouseEnter = () => {
    hoverTimeout.current = setTimeout(() => setShowPopup(true), 500);
  };
  const handleMouseLeave = () => {
    clearTimeout(hoverTimeout.current);
    setShowPopup(false);
    setShowActions(false);
  };

  // Follow handler
  const handleFollow = (e) => {
    e.stopPropagation();
    setFollowing(f => !f);
    onFollow?.(username);
  };

  // #18 — Quick action handlers
  const handleMessage = (e) => {
    e.stopPropagation();
    setShowActions(false);
    onMessage?.(username);
  };

  const handleQuickOffer = (e) => {
    e.stopPropagation();
    setShowActions(false);
    onViewUser(username);
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
        {/* Avatar with online status dot */}
        <div className="relative">
          <Avatar username={username} size={30} />
          {isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-gs-surface" />
          )}
        </div>
        <div className="text-left">
          <div className="text-xs font-semibold text-[#e5e5e5] leading-tight flex items-center gap-1">
            {p.displayName || username}
            {/* #20 — Verified seller checkmark */}
            {verified && (
              <span title="Verified seller" className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500 shrink-0">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
            )}
            {/* #16 — Reputation badge */}
            {repBadge && (
              <span className={`text-[8px] font-bold border rounded-full px-1.5 py-px ${repBadge.color}`}>
                {repBadge.label}
              </span>
            )}
            {/* Mutual friend indicator */}
            {mutualFriends > 0 && (
              <span className="text-[9px] text-gs-dim font-normal" title={`${mutualFriends} mutual friend${mutualFriends > 1 ? 's' : ''}`}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline -mt-px">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
                {mutualFriends}
              </span>
            )}
          </div>
          <div className="text-[10px] text-gs-dim font-mono flex items-center gap-1">
            @{username}
            {/* #17 — Activity indicator */}
            {currentActivity && (
              <span className={`inline-flex items-center gap-0.5 text-[8px] ${currentActivity.color}`} title={currentActivity.label}>
                <span>{currentActivity.icon}</span>
                <span className="hidden sm:inline">{currentActivity.label}</span>
              </span>
            )}
          </div>
        </div>
        {/* Inline follow button */}
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
        {/* #18 — Quick action dropdown trigger */}
        <button
          onClick={e => { e.stopPropagation(); setShowActions(!showActions); }}
          className="ml-0.5 bg-transparent border-none text-gs-faint cursor-pointer p-0.5 hover:text-gs-dim transition-colors opacity-0 group-hover:opacity-100"
          title="Quick actions"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
      </button>

      {/* #18 — Quick action dropdown menu */}
      {showActions && (
        <div className="absolute left-0 top-full mt-1 bg-gs-surface border border-gs-border rounded-lg shadow-xl z-40 py-1 min-w-[130px] animate-fade-in">
          <button onClick={handleMessage} className="w-full text-left px-3 py-1.5 bg-transparent border-none text-gs-muted text-[11px] cursor-pointer hover:bg-gs-accent/10 flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Message
          </button>
          <button onClick={handleQuickOffer} className="w-full text-left px-3 py-1.5 bg-transparent border-none text-gs-muted text-[11px] cursor-pointer hover:bg-gs-accent/10 flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Make Offer
          </button>
          <button onClick={handleFollow} className="w-full text-left px-3 py-1.5 bg-transparent border-none text-gs-muted text-[11px] cursor-pointer hover:bg-gs-accent/10 flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            {following ? 'Unfollow' : 'Follow'}
          </button>
        </div>
      )}

      {/* #19 — Enhanced hover stats card */}
      {showPopup && (
        <div
          className="absolute left-0 top-full mt-1 bg-gs-surface border border-gs-border rounded-xl shadow-2xl z-30 w-[240px] p-3.5 animate-fade-in"
          onMouseEnter={() => clearTimeout(hoverTimeout.current)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="relative">
              <Avatar username={username} size={40} />
              {isOnline && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-gs-surface" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-gs-text flex items-center gap-1">
                {p.displayName || username}
                {verified && (
                  <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-blue-500 shrink-0">
                    <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </span>
                )}
              </div>
              <div className="text-[10px] text-gs-dim font-mono">@{username}</div>
              {/* Activity indicator in popup */}
              {currentActivity && (
                <div className={`text-[9px] flex items-center gap-0.5 mt-0.5 ${currentActivity.color}`}>
                  <span>{currentActivity.icon}</span> {currentActivity.label}
                </div>
              )}
            </div>
          </div>
          {p.bio && <p className="text-[11px] text-[#777] leading-relaxed mb-2">{p.bio.slice(0, 100)}{p.bio.length > 100 ? '...' : ''}</p>}
          {/* Enhanced stats grid */}
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            <div className="bg-[#111] rounded-lg py-1.5 px-1 text-center">
              <div className="text-[11px] font-extrabold text-gs-text">{p.followers?.length || 0}</div>
              <div className="text-[8px] text-gs-faint">Followers</div>
            </div>
            <div className="bg-[#111] rounded-lg py-1.5 px-1 text-center">
              <div className="text-[11px] font-extrabold text-gs-text">{forSaleCount}</div>
              <div className="text-[8px] text-gs-faint">For Sale</div>
            </div>
            <div className="bg-[#111] rounded-lg py-1.5 px-1 text-center">
              <div className="text-[11px] font-extrabold text-gs-text">{followerCount}</div>
              <div className="text-[8px] text-gs-faint">Following</div>
            </div>
          </div>
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
          {/* Reputation badge in popup */}
          {repBadge && (
            <div className="mb-2.5">
              <span className={`inline-flex items-center gap-1 text-[9px] font-bold border rounded-full px-2 py-0.5 ${repBadge.color}`}>
                {repBadge.label} Seller
              </span>
            </div>
          )}
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
