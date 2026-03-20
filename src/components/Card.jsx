// Record post card — the primary visual unit of the feed.
// Receives a record (r) and action callbacks from App.js via cardHandlers.
import { useState, useRef } from 'react';
import AlbumArt from './ui/AlbumArt';
import Stars from './ui/Stars';
import Badge from './ui/Badge';
import UserChip from './UserChip';
import { condColor } from '../utils/helpers';

// #1 — Time ago helper
function timeAgoFromDate(dateStr) {
  if (!dateStr) return null;
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// #4 — Rarity indicator
function rarityLabel(r) {
  // Simulate rarity from likes + condition
  if (r.condition === 'M' && r.likes > 8) return { label: 'Rare', color: '#f59e0b' };
  if (r.condition === 'NM' && r.likes > 12) return { label: 'Scarce', color: '#a78bfa' };
  if (r.condition === 'M') return { label: 'Uncommon', color: '#60a5fa' };
  return null;
}

// #10 — Price comparison
function priceTag(r) {
  if (!r.forSale || !r.price) return null;
  const p = parseFloat(r.price);
  // Heuristic: condition-based "market" value
  const marketBase = { M: 45, NM: 35, 'VG+': 25, VG: 18, 'G+': 12, G: 8, F: 5, P: 3 };
  const est = marketBase[r.condition] || 20;
  if (p < est * 0.85) return { label: 'Below Market', color: '#10b981' };
  if (p <= est * 1.15) return { label: 'Fair Price', color: '#60a5fa' };
  return null;
}

export default function Card({ r, onLike, onSave, onComment, onBuy, onDetail, onViewUser, onViewArtist, onQuickBuy, onPin, currentUser }) {
  const [likeAnim, setLikeAnim] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [shareCount] = useState(() => Math.floor(Math.random() * 12));
  const [showShareCopied, setShowShareCopied] = useState(false);
  const [imgZoomed, setImgZoomed] = useState(false);
  const [showHoverPreview, setShowHoverPreview] = useState(false);
  const [pinned, setPinned] = useState(r.pinned || false);
  const hoverTimeout = useRef(null);
  const menuRef = useRef(null);

  // #18 — Improved like animation
  const handleLike = () => {
    setLikeAnim(true);
    onLike(r.id);
    setTimeout(() => setLikeAnim(false), 350);
  };

  // #16 — "NEW" badge: added in last 24h (check timeAgo string)
  const computedTimeAgo = r.postedAt ? timeAgoFromDate(r.postedAt) : r.timeAgo;
  const isNew = computedTimeAgo && (computedTimeAgo.includes("just now") || computedTimeAgo.includes("m ago") || computedTimeAgo.includes("h ago") || computedTimeAgo === "1h ago");

  // #5 — "Featured" badge for rating >= 4.5
  const isFeatured = r.rating >= 4.5;

  // #2 — Condition border accent color
  const borderAccent = condColor(r.condition);

  // #4 — Rarity
  const rarity = rarityLabel(r);

  // #10 — Price comparison
  const priceBadge = priceTag(r);

  // #11/#19 — Share handler
  const handleShare = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}?record=${r.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setShowShareCopied(true);
    setTimeout(() => setShowShareCopied(false), 1500);
  };

  // #8 — Share to social
  const handleSocialShare = (platform, e) => {
    e.stopPropagation();
    const url = `${window.location.origin}?record=${r.id}`;
    const text = `Check out "${r.album}" by ${r.artist} on GrooveStack!`;
    const links = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    };
    window.open(links[platform], '_blank', 'width=600,height=400');
    setShowMenu(false);
  };

  // #7 — Pin to top
  const handlePin = (e) => {
    e.stopPropagation();
    setPinned(p => !p);
    onPin?.(r.id);
    setShowMenu(false);
  };

  // #5 — Hover preview (desktop)
  const handleMouseEnter = () => {
    hoverTimeout.current = setTimeout(() => setShowHoverPreview(true), 600);
  };
  const handleMouseLeave = () => {
    clearTimeout(hoverTimeout.current);
    setShowHoverPreview(false);
    setImgZoomed(false);
  };

  return (
    <div
      role="article"
      className="gs-card group relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* #2 — Condition-based left border accent */}
      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full opacity-40" style={{ background: borderAccent }} />

      {/* Accent bar */}
      <div className="h-0.5" style={{ background: `linear-gradient(90deg,${r.accent},transparent)` }} />
      <div className="p-4 pl-5">
        {/* User header */}
        <div className="flex justify-between items-center mb-3">
          <UserChip username={r.user} onViewUser={onViewUser} />
          <div className="flex items-center gap-1.5">
            {/* #7 — Pin indicator */}
            {pinned && (
              <span className="text-[10px] text-amber-400" title="Pinned">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><path d="M16 4l4 4-1.5 1.5-1-1L14 12l-1 5-2 2-5-5 2-2 5-1 3.5-3.5-1-1z"/></svg>
              </span>
            )}
            {/* #16 — NEW badge */}
            {isNew && <span className="gs-badge-new">NEW</span>}
            {/* #5 — Featured badge */}
            {isFeatured && <span className="gs-badge-featured">FEATURED</span>}
            {/* #4 — Rarity indicator */}
            {rarity && (
              <span
                className="text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-[4px] border"
                style={{ color: rarity.color, borderColor: `${rarity.color}33`, background: `${rarity.color}11` }}
              >
                {rarity.label.toUpperCase()}
              </span>
            )}
            {r.forSale && (
              <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-[5px] bg-amber-500/10 text-amber-500 border border-amber-500/20">
                FOR SALE
              </span>
            )}
            {/* #10 — Price comparison badge */}
            {priceBadge && (
              <span
                className="text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-[4px] border"
                style={{ color: priceBadge.color, borderColor: `${priceBadge.color}33`, background: `${priceBadge.color}11` }}
              >
                {priceBadge.label.toUpperCase()}
              </span>
            )}
            {/* #1 — Time ago display */}
            <span className="text-[10px] text-[#3a3a3a] font-mono">{computedTimeAgo || r.timeAgo}</span>
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
                <div className="absolute right-0 top-full mt-1 bg-gs-surface border border-gs-border rounded-lg shadow-xl z-10 min-w-[160px] py-1 animate-fade-in">
                  <button onClick={(e) => { e.stopPropagation(); handleShare(e); setShowMenu(false); }}
                    className="w-full text-left px-3.5 py-2 text-xs text-gs-muted bg-transparent border-none cursor-pointer hover:bg-[#1a1a1a] transition-colors flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                    Copy Link
                  </button>
                  {/* #8 — Share to social */}
                  <button onClick={(e) => handleSocialShare('twitter', e)}
                    className="w-full text-left px-3.5 py-2 text-xs text-gs-muted bg-transparent border-none cursor-pointer hover:bg-[#1a1a1a] transition-colors flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 3a10.9 10.9 0 01-3.14 1.53A4.48 4.48 0 0012 7.5v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5 0-.28 0-.56-.04-.83A7.72 7.72 0 0023 3z"/></svg>
                    Share to X
                  </button>
                  <button onClick={(e) => handleSocialShare('facebook', e)}
                    className="w-full text-left px-3.5 py-2 text-xs text-gs-muted bg-transparent border-none cursor-pointer hover:bg-[#1a1a1a] transition-colors flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
                    Share to Facebook
                  </button>
                  {/* #7 — Pin to top */}
                  {r.user === currentUser && (
                    <button onClick={handlePin}
                      className="w-full text-left px-3.5 py-2 text-xs text-gs-muted bg-transparent border-none cursor-pointer hover:bg-[#1a1a1a] transition-colors flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4l4 4-1.5 1.5-1-1L14 12l-1 5-2 2-5-5 2-2 5-1 3.5-3.5-1-1z"/></svg>
                      {pinned ? 'Unpin' : 'Pin to Top'}
                    </button>
                  )}
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
        <div className="flex gap-3 mb-3 cursor-pointer relative" onClick={() => onDetail(r)}>
          {/* #6 — Image zoom on hover + #9 — Vinyl spinning animation */}
          <div
            className="relative shrink-0 overflow-hidden rounded-xl"
            onMouseEnter={() => setImgZoomed(true)}
            onMouseLeave={() => setImgZoomed(false)}
          >
            <div className={`transition-transform duration-300 ${imgZoomed ? 'scale-110' : 'scale-100'}`}>
              <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={68} />
            </div>
            {/* #17 — Subtle gradient overlay */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            {/* #9 — Vinyl disc peek on hover */}
            <div
              className={`absolute -right-2 top-1/2 -translate-y-1/2 w-[52px] h-[52px] rounded-full bg-[#111] border-2 border-[#222] transition-all duration-500 pointer-events-none ${
                imgZoomed ? 'opacity-80 translate-x-3' : 'opacity-0 translate-x-0'
              }`}
              style={{ boxShadow: 'inset 0 0 12px rgba(0,0,0,0.5)' }}
            >
              <div className={`w-full h-full rounded-full border-[3px] border-[#1a1a1a] flex items-center justify-center ${imgZoomed ? 'animate-spin-slow' : ''}`}>
                <div className="w-3 h-3 rounded-full" style={{ background: r.accent }} />
              </div>
            </div>
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
              {/* #3 — Quick Buy button for logged-in users */}
              {onQuickBuy && (
                <button
                  onClick={e => { e.stopPropagation(); onQuickBuy(r); }}
                  className="mt-1 block w-full px-2 py-0.5 rounded-md bg-transparent border border-gs-border text-[9px] text-gs-muted font-semibold cursor-pointer hover:border-gs-accent/30 hover:text-gs-accent transition-colors"
                >
                  Quick Buy
                </button>
              )}
            </div>
          )}
        </div>

        {/* #5 — Hover card preview on desktop */}
        {showHoverPreview && (
          <div className="absolute left-full top-0 ml-2 w-[240px] bg-gs-surface border border-gs-border rounded-xl shadow-2xl z-20 p-3.5 animate-fade-in pointer-events-none hidden lg:block">
            <div className="text-sm font-bold text-gs-text mb-1">{r.album}</div>
            <div className="text-xs text-gs-muted mb-2">{r.artist} · {r.year}</div>
            <div className="flex items-center gap-1.5 mb-2">
              <Badge label={r.condition} color={condColor(r.condition)} />
              <Stars rating={r.rating} />
            </div>
            {r.review && <p className="text-[11px] text-[#777] leading-relaxed italic">{r.review.slice(0, 150)}{r.review.length > 150 ? '...' : ''}</p>}
            {r.forSale && <div className="mt-2 text-sm font-bold text-gs-text">${r.price}</div>}
            <div className="flex gap-1 mt-2 flex-wrap">
              {r.tags.slice(0, 3).map(t => <span key={t} className="gs-pill text-[9px]">#{t}</span>)}
            </div>
          </div>
        )}

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
