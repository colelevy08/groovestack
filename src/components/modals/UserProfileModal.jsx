// Quick-preview card for another user's profile — triggered by clicking avatars/handles.
// Matches the ProfileScreen design language: header banner, overlapping avatar, clean stat grid.
// "View Full Profile" navigates to their full profile page in the main content area.
import Avatar from '../ui/Avatar';
import { getProfile } from '../../utils/helpers';

export default function UserProfileModal({ username, open, onClose, records, currentUser, following, onFollow, onViewFullProfile, posts, listeningHistory, profile }) {
  if (!open || !username) return null;

  const isOwn = username === currentUser;
  const p = isOwn ? { ...getProfile(username), displayName: profile?.displayName || getProfile(username).displayName, bio: profile?.bio || getProfile(username).bio, location: profile?.location || getProfile(username).location, favGenre: profile?.favGenre || getProfile(username).favGenre } : getProfile(username);
  const userRecords = records.filter(r => r.user === username);
  const forSale = userRecords.filter(r => r.forSale);
  const isFollowing = following.includes(username);
  const followerCount = (p.followers || []).length + (isFollowing && !(p.followers || []).includes(currentUser) ? 1 : 0);
  const userPosts = (posts || []).filter(pp => pp.user === username);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 18, width: 420, maxWidth: "94vw", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.85)" }}>
        {/* Header banner */}
        <div style={{ height: 80, background: p.headerUrl ? `url(${p.headerUrl}) center/cover` : `linear-gradient(135deg,${p.accent || "#0ea5e9"}33,#6366f122)`, position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", color: "#aaa", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>×</button>
        </div>

        {/* Profile info */}
        <div style={{ padding: "0 24px 24px", marginTop: -32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
            <div style={{ borderRadius: "50%", border: "3px solid #0d0d0d", lineHeight: 0, position: "relative", zIndex: 2 }}>
              <Avatar username={username} size={64} src={isOwn ? profile?.avatarUrl : undefined} />
            </div>
            {!isOwn && (
              <button
                onClick={() => onFollow(username)}
                style={{ padding: "8px 20px", borderRadius: 20, border: isFollowing ? "1px solid #2a2a2a" : "none", background: isFollowing ? "#1a1a1a" : "linear-gradient(135deg,#0ea5e9,#6366f1)", color: isFollowing ? "#888" : "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {isFollowing ? "Following ✓" : "Follow"}
              </button>
            )}
          </div>

          <div style={{ fontSize: 20, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.03em", marginBottom: 2 }}>{p.displayName}</div>
          <div style={{ fontSize: 12, color: p.accent || "#0ea5e9", fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>@{username}</div>
          {p.bio && <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.bio}</p>}

          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#555", marginBottom: 18, flexWrap: "wrap" }}>
            {p.location && <span>📍 {p.location}</span>}
            {p.favGenre && <span>🎵 {p.favGenre}</span>}
          </div>

          {/* Stats — 4 clean boxes */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 20 }}>
            {[
              { l: "Records", v: userRecords.length },
              { l: "For Sale", v: forSale.length },
              { l: "Followers", v: followerCount },
              { l: "Posts", v: userPosts.length },
            ].map(s => (
              <div key={s.l} style={{ background: "#111", borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.02em" }}>{s.v}</div>
                <div style={{ fontSize: 10, color: p.accent || "#0ea5e9", fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* View Full Profile button */}
          <button
            onClick={() => { onClose(); onViewFullProfile(username); }}
            style={{ width: "100%", padding: 12, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}
          >
            View Full Profile
          </button>
          <button
            onClick={onClose}
            style={{ width: "100%", padding: 10, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, color: "#666", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
