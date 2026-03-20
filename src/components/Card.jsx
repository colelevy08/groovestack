// Record post card — the primary visual unit of the feed.
// Receives a record (r) and action callbacks from App.js via cardHandlers.
import AlbumArt from './ui/AlbumArt';
import Stars from './ui/Stars';
import Badge from './ui/Badge';
import UserChip from './UserChip';
import { condColor } from '../utils/helpers';

export default function Card({ r, onLike, onSave, onComment, onBuy, onDetail, onViewUser, onViewArtist }) {
  return (
    <div role="article" className="gs-card group">
      {/* Accent bar */}
      <div className="h-0.5" style={{ background: `linear-gradient(90deg,${r.accent},transparent)` }} />
      <div className="p-4">
        {/* User header */}
        <div className="flex justify-between items-center mb-3">
          <UserChip username={r.user} onViewUser={onViewUser} />
          <div className="flex items-center gap-1.5">
            {r.forSale && (
              <span className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-[5px] bg-amber-500/10 text-amber-500 border border-amber-500/20">
                FOR SALE
              </span>
            )}
            <span className="text-[10px] text-[#3a3a3a] font-mono">{r.timeAgo}</span>
          </div>
        </div>

        {/* Record body */}
        <div className="flex gap-3 mb-3 cursor-pointer" onClick={() => onDetail(r)}>
          <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={68} />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-gs-text tracking-tight leading-tight mb-1 flex items-center gap-1.5 truncate">
              {r.album}
              {r.verified && <span title="Verified vinyl" className="text-blue-500 text-[13px] shrink-0">✓</span>}
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
            "{r.review.slice(0, 110)}{r.review.length > 110 ? "…" : ""}"
          </p>
        )}

        <div className="flex gap-1.5 flex-wrap mb-2.5">
          {r.tags.slice(0, 4).map(t => (
            <span key={t} className="gs-pill">#{t}</span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-gs-border pt-2.5">
          <div className="flex gap-3">
            <button
              onClick={() => onLike(r.id)}
              aria-label="Like"
              aria-pressed={r.liked}
              className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-xs font-semibold transition-colors hover:scale-110"
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
          </div>
          <button
            onClick={() => onSave(r.id)}
            aria-label="Save"
            aria-pressed={r.saved}
            className="bg-transparent border-none cursor-pointer text-xs transition-colors hover:scale-110"
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
