// Expanded view of a single record — opens when clicking a record's body in a Card.
// Shows full details (label, full review, all tags) and all action buttons.
// Clicking "Comments" closes this and opens CommentsModal; clicking "Buy" closes this and opens BuyModal.
// Clicking the poster row closes this and opens UserProfileModal.
import Modal from '../ui/Modal';
import AlbumArt from '../ui/AlbumArt';
import Stars from '../ui/Stars';
import Badge from '../ui/Badge';
import Avatar from '../ui/Avatar';
import { condColor } from '../../utils/helpers';
import { USER_WISHLISTS } from '../../constants';

export default function DetailModal({ open, onClose, record, onLike, onSave, onComment, onBuy, onViewUser, onViewArtist, onAddWishlistItem, currentUser, records, onOfferFromDetail, onVerifyRecord }) {
  if (!record) return null;

  // When viewing your own record, find users who have it on their wishlist
  const isOwn = record.user === currentUser;
  const wantedBy = isOwn
    ? Object.entries(USER_WISHLISTS)
        .filter(([, items]) => items.some(
          w => w.album.toLowerCase() === record.album.toLowerCase() && w.artist.toLowerCase() === record.artist.toLowerCase()
        ))
        .map(([username, items]) => ({
          username,
          wishlistItem: items.find(w => w.album.toLowerCase() === record.album.toLowerCase() && w.artist.toLowerCase() === record.artist.toLowerCase()),
        }))
    : [];

  return (
    <Modal open={open} onClose={onClose} title="Record Detail" width="520px">
      <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
        <AlbumArt album={record.album} artist={record.artist} accent={record.accent} size={96} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.03em", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            {record.album}
            {record.verified && <span title="Verified vinyl" style={{ color: "#3b82f6", fontSize: 16 }}>✓</span>}
          </h2>
          <p style={{ fontSize: 14, color: "#888", marginBottom: 10 }}>
            <button onClick={() => { onClose(); onViewArtist?.(record.artist); }} style={{ background: "none", border: "none", color: "#888", fontSize: 14, padding: 0, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.color = "#ccc"} onMouseLeave={e => e.currentTarget.style.color = "#888"}
            >{record.artist}</button>
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Stars rating={record.rating} size={14} />
            <Badge label={record.condition} color={condColor(record.condition)} />
            <span style={{ fontSize: "11px", color: "#555", fontFamily: "'DM Mono',monospace" }}>{record.format} · {record.year} · {record.label}</span>
          </div>
        </div>
      </div>

      {/* Posted by */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#111", borderRadius: 10, marginBottom: 16, cursor: "pointer" }}
        onClick={() => { onClose(); onViewUser(record.user); }}
      >
        <Avatar username={record.user} size={28} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12, color: "#888" }}>Posted by </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#0ea5e9" }}>@{record.user}</span>
        </div>
        <span style={{ fontSize: 11, color: "#444" }}>→ view profile</span>
      </div>

      {record.review && (
        <blockquote style={{ borderLeft: `2px solid ${record.accent}55`, paddingLeft: 14, color: "#aaa", fontSize: 13, lineHeight: 1.7, fontStyle: "italic", marginBottom: 18 }}>
          "{record.review}"
        </blockquote>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {record.tags.map(t => (
          <span key={t} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "#1a1a1a", color: "#666", border: "1px solid #2a2a2a" }}>#{t}</span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => onLike(record.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, background: record.liked ? record.accent + "22" : "#1a1a1a", border: `1px solid ${record.liked ? record.accent + "44" : "#2a2a2a"}`, color: record.liked ? record.accent : "#888", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          ❤ {record.likes}
        </button>
        <button onClick={() => { onClose(); onComment(record); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          💬 {record.comments.length}
        </button>
        <button onClick={() => onSave(record.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, background: record.saved ? "#f59e0b22" : "#1a1a1a", border: `1px solid ${record.saved ? "#f59e0b44" : "#2a2a2a"}`, color: record.saved ? "#f59e0b" : "#888", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {record.saved ? "★ Saved" : "☆ Save"}
        </button>
        <button onClick={() => onAddWishlistItem(record.album, record.artist)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          ✨ Wishlist
        </button>
        {isOwn && !record.verified && onVerifyRecord && (
          <button onClick={() => { onClose(); onVerifyRecord(record); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, background: "#3b82f622", border: "1px solid #3b82f644", color: "#3b82f6", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            📷 Verify
          </button>
        )}
        {record.forSale && (
          <button onClick={() => { onClose(); onBuy(record); }} style={{ marginLeft: "auto", padding: "9px 18px", borderRadius: 8, background: `linear-gradient(135deg,${record.accent},#6366f1)`, border: "none", color: "#000", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
            Buy · ${record.price}
          </button>
        )}
      </div>

      {wantedBy.length > 0 && (
        <div style={{ marginTop: 20, borderTop: "1px solid #1a1a1a", paddingTop: 16 }}>
          <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", marginBottom: 10, letterSpacing: "0.08em" }}>WANTED BY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {wantedBy.map(({ username, wishlistItem }) => (
              <div key={username} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#111", borderRadius: 10 }}>
                <Avatar username={username} size={28} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#0ea5e9" }}>@{username}</span>
                <button
                  onClick={() => onOfferFromDetail(record, username, wishlistItem)}
                  style={{ padding: "5px 12px", borderRadius: 7, background: "linear-gradient(135deg,#f59e0b,#ef4444)", border: "none", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" }}
                >
                  Offer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
