// Record post card — the primary visual unit of the feed.
// Receives a record (r) and action callbacks from App.js via cardHandlers.
import { useState, useRef } from 'react';
import AlbumArt from './ui/AlbumArt';
import Stars from './ui/Stars';
import Badge from './ui/Badge';
import UserChip from './UserChip';
import { condColor } from '../utils/helpers';

export default function Card({ r, onLike, onSave, onComment, onBuy, onDetail, onViewUser, onViewArtist }) {
  const [likeAnim, setLikeAnim] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [shareCount] = useState(() => Math.floor(Math.random() * 12));
  const [showShareCopied, setShowShareCopied] = useState(false);
  const menuRef = useRef(null);

  // #18 — Improved like animation
  const handleLike = () => {
    setLikeAnim(true);
    onLike(r.id);
    setTimeout(() => setLikeAnim(false), 350);
  };

  // #16 — "NEW" badge: added in last 24h (check timeAgo string)
  const isNew = r.timeAgo && (r.timeAgo.includes("just now") || r.timeAgo.includes("m ago") || r.timeAgo.includes("h ago") || r.timeAgo === "1h ago");

  // #5 — "Featured" badge for rating >= 4.5
  const isFeatured = r.rating >= 4.5;

  // #11/#19 — Share handler
  const handleShare = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}?record=${r.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setShowShareCopied(true);
    setTimeout(() => setShowShareCopied(false), 1500);
  };

  return (
    <div role="article" className="gs-card group relative">
      {/* Accent bar */}
      <div className="h-0.5" style={{ background: `linear-gradient(90deg,${r.accent},transparent)` }} />
      <div className="p-4">
        {/* User header */}
        <div className="flex justify-between items-center mb-3">
          <UserChip username={r.user} onViewUser={onViewUser} />
          <div className="flex items-center gap-1.5">
            {/* #16 — NEW badge */}
            {isNew && <span className="gs-badge-new">NEW</span>}
            {/* #5 — Featured badge */}
            {isFeatured && <span className="gs-badge-featured">FEATURED</span>}
            {r.forSale && (
              <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-[5px] bg-amber-500/10 text-amber-500 border border-amber-500/20">
                FOR SALE
              </span>
            )}
            <span className="text-[10px] text-[#3a3a3a] font-mono">{r.timeAgo}</span>
            {/* #14 — More menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(m => !m); }}
                className="bg-transparent border-none cursor-pointer text-gs-dim hover:text-gs-muted p-1 text-sm leading-none transition-colors"
                aria-label="More options"
              >
                ...
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-gs-surface border border-gs-border rounded-lg shadow-xl z-10 min-w-[140px] py-1 animate-fade-in">
                  <button onClick={(e) => { e.stopPropagation(); handleShare(e); setShowMenu(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-gs-muted bg-transparent border-none cursor-pointer hover:bg-[#1a1a1a] transition-colors flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                    Share
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-gs-muted bg-transparent border-none cursor-pointer hover:bg-[#1a1a1a] transition-colors flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    Hide
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-red-400/80 bg-transparent border-none cursor-pointer hover:bg-[#1a1a1a] transition-colors flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Report
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Record body — #17 gradient overlay on album art */}
        <div className="flex gap-3 mb-3 cursor-pointer" onClick={() => onDetail(r)}>
          <div className="relative shrink-0">
            <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={68} />
            {/* #17 — Subtle gradient overlay */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-gs-text tracking-tight leading-tight mb-1 flex items-center gap-1.5 truncate">
              {r.album}
              {/* #15 — Verified badge (blue checkmark) */}
              {r.verified && (
                <span title="Verified vinyl" className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 shrink-0">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
              )}
            </div>
            <div className="text-xs text-gs-muted mb-1.5">
              <button
                onClick={e => { e.stopPropagation(); onViewArtist?.(r.artist); }}
                className="bg-transparent border-none text-gs-muted text-xs p-0 cursor-pointer hover:text-neutral-300 transition-colors truncate"
              >
                {r.artist}
              </button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Stars rating={r.rating} />
              <Badge label={r.condition} color={condColor(r.condition)} />
              <span className="text-[10px] text-gs-faint font-mono">{r.year}</span>
            </div>
          </div>
          {r.forSale && (
            <div className="text-right shrink-0">
              <div className="text-xl font-extrabold text-gs-text tracking-tight whitespace-nowrap">${r.price}</div>
              <button
                onClick={e => { e.stopPropagation(); onBuy(r); }}
                className="mt-1.5 px-3 py-1 rounded-[7px] text-black border-none cursor-pointer text-[10px] font-bold hover:opacity-90 transition-opacity"
                style={{ background: r.accent }}
              >
                BUY
              </button>
            </div>
          )}
        </div>

        {r.review && (
          <p className="text-xs text-gs-muted leading-relaxed mb-2.5 italic pl-2.5" style={{ borderLeft: `2px solid ${r.accent}44` }}>
            "{r.review.slice(0, 110)}{r.review.length > 110 ? "\u2026" : ""}"
          </p>
        )}

        <div className="flex gap-1.5 flex-wrap mb-2.5">
          {r.tags.slice(0, 4).map(t => (
            <span key={t} className="gs-pill">#{t}</span>
          ))}
        </div>

        {/* Actions — #18 improved like animation, #19 share count */}
        <div className="flex items-center justify-between border-t border-gs-border pt-2.5">
          <div className="flex gap-3">
            <button
              onClick={() => handleLike()}
              aria-label="Like"
              aria-pressed={r.liked}
              className={`flex items-center gap-1 bg-transparent border-none cursor-pointer text-xs font-semibold transition-all duration-200 hover:scale-110 ${likeAnim ? 'animate-heart-pop' : ''}`}
              style={{ color: r.liked ? r.accent : '#555' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill={r.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {r.likes}
            </button>
            <button
              onClick={() => onComment(r)}
              aria-label={`${r.comments.length} comments`}
              className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-gs-dim text-xs font-semibold hover:text-gs-muted transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {r.comments.length}
            </button>
            {/* #19 — Share count + copy link */}
            <button
              onClick={handleShare}
              aria-label="Share"
              className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-gs-dim text-xs font-semibold hover:text-gs-muted transition-colors relative"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              {shareCount}
              {showShareCopied && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] text-gs-accent bg-gs-surface border border-gs-border rounded px-2 py-0.5 whitespace-nowrap animate-fade-in">
                  Link copied!
                </span>
              )}
            </button>
          </div>
          <button
            onClick={() => onSave(r.id)}
            aria-label="Save"
            aria-pressed={r.saved}
            className="bg-transparent border-none cursor-pointer text-xs transition-all duration-200 hover:scale-110"
            style={{ color: r.saved ? "#f59e0b" : "#555" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={r.saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
