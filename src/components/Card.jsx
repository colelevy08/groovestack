// The main record post card — the primary visual unit of the feed.
// Receives a record object (r) and all action callbacks from App.js via cardHandlers.
// Clicking the record body opens DetailModal; the BUY button opens BuyModal without triggering the detail view.
// The accent color top bar and hover lift effect are derived from r.accent.
import AlbumArt from './ui/AlbumArt';
import Stars from './ui/Stars';
import Badge from './ui/Badge';
import UserChip from './UserChip';
import { condColor } from '../utils/helpers';

export default function Card({ r, onLike, onSave, onComment, onBuy, onDetail, onViewUser, onViewArtist }) {
  return (
    <div
      style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 16, overflow: "hidden", transition: "border-color 0.2s, transform 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = r.accent + "55"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e1e"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ height: 2, background: `linear-gradient(90deg,${r.accent},transparent)` }} />
      <div style={{ padding: 16 }}>
        {/* User header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <UserChip username={r.user} onViewUser={onViewUser} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {r.forSale && <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", padding: "2px 7px", borderRadius: 5, background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b33" }}>FOR SALE</span>}
            <span style={{ fontSize: 10, color: "#3a3a3a", fontFamily: "'DM Mono',monospace" }}>{r.timeAgo}</span>
          </div>
        </div>

        {/* Record body */}
        <div style={{ display: "flex", gap: 12, marginBottom: 12, cursor: "pointer" }} onClick={() => onDetail(r)}>
          <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={68} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f5", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 3 }}>{r.album}</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
              <button onClick={e => { e.stopPropagation(); onViewArtist?.(r.artist); }} style={{ background: "none", border: "none", color: "#888", fontSize: 12, padding: 0, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.color = "#ccc"} onMouseLeave={e => e.currentTarget.style.color = "#888"}
              >{r.artist}</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Stars rating={r.rating} />
              <Badge label={r.condition} color={condColor(r.condition)} />
              <span style={{ fontSize: "10px", color: "#444", fontFamily: "'DM Mono',monospace" }}>{r.year}</span>
            </div>
          </div>
          {r.forSale && (
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.03em" }}>${r.price}</div>
              <button
                onClick={e => { e.stopPropagation(); onBuy(r); }}
                style={{ marginTop: 5, padding: "5px 11px", borderRadius: 7, background: r.accent, color: "#000", border: "none", cursor: "pointer", fontSize: "10px", fontWeight: 700 }}
              >
                BUY
              </button>
            </div>
          )}
        </div>

        {r.review && (
          <p style={{ fontSize: 12, color: "#888", lineHeight: 1.6, margin: "0 0 10px", fontStyle: "italic", borderLeft: `2px solid ${r.accent}44`, paddingLeft: 10 }}>
            "{r.review.slice(0, 110)}{r.review.length > 110 ? "…" : ""}"
          </p>
        )}

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
          {r.tags.slice(0, 4).map(t => (
            <span key={t} style={{ fontSize: "10px", padding: "2px 7px", borderRadius: 20, background: "#1a1a1a", color: "#555", border: "1px solid #2a2a2a" }}>#{t}</span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1a1a1a", paddingTop: 10 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => onLike(r.id)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: r.liked ? r.accent : "#555", fontSize: 12, fontWeight: 600, transition: "color 0.15s" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={r.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {r.likes}
            </button>
            <button onClick={() => onComment(r)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: 12, fontWeight: 600 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {r.comments.length}
            </button>
          </div>
          <button onClick={() => onSave(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: r.saved ? "#f59e0b" : "#555", fontSize: 12, transition: "color 0.15s" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={r.saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
