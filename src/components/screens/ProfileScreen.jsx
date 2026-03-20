// The current user's own profile page — not to be confused with UserProfileModal (other users).
// Shows a profile card with avatar, bio, stats, and an "Edit Profile" button that opens ProfileEditModal.
// Six tabs: posts, listening, records, for sale, saved, and personal wishlist.
import { useState } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import Stars from '../ui/Stars';
import Empty from '../ui/Empty';
import FormInput from '../ui/FormInput';
import { condColor } from '../../utils/helpers';

export default function ProfileScreen({ records, currentUser, profile, onEdit, following, followers, onShowFollowing, onShowFollowers, wishlist, onAddWishlistItem, onRemoveWishlistItem, onDetail, onViewArtist, posts, onLikePost, onCommentPost, onBookmarkPost, onViewUser, listeningHistory }) {
  const mine = records.filter(r => r.user === currentUser);
  const [tab, setTab] = useState("posts");
  const [newWishAlbum, setNewWishAlbum] = useState("");
  const [newWishArtist, setNewWishArtist] = useState("");

  const forSale = mine.filter(r => r.forSale);
  const saved = records.filter(r => r.saved);
  const myPosts = (posts || []).filter(p => p.user === currentUser).sort((a, b) => b.createdAt - a.createdAt);
  const myListens = (listeningHistory || []).filter(s => s.username === currentUser).sort((a, b) => b.timestampMs - a.timestampMs);

  const relTime = ts => {
    const d = Date.now() - ts; const m = Math.floor(d / 60000);
    if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const dy = Math.floor(h / 24); return dy === 1 ? "yesterday" : `${dy}d ago`;
  };

  const display = tab === "records" ? mine : tab === "for sale" ? forSale : tab === "saved" ? saved : [];

  // Tab definitions with counts
  const tabs = [
    { id: "posts", count: myPosts.length },
    { id: "listening", count: myListens.length },
    { id: "records", count: mine.length },
    { id: "for sale", count: forSale.length },
    { id: "saved", count: saved.length },
    { id: "wishlist", count: (wishlist || []).length },
  ];

  return (
    <div>
      {/* Profile card */}
      <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
        {/* Header — custom image or gradient fallback */}
        <div style={{
          height: profile.headerUrl ? 140 : 72,
          background: profile.headerUrl
            ? `url(${profile.headerUrl}) center/cover no-repeat`
            : "linear-gradient(135deg,#0ea5e933,#6366f122)",
          transition: "height 0.3s ease",
        }} />

        <div style={{ padding: "0 24px 24px", marginTop: -32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
            <div style={{ borderRadius: "50%", border: "3px solid #0f0f0f", lineHeight: 0, position: "relative", zIndex: 2 }}>
              <Avatar username={currentUser} size={64} src={profile.avatarUrl} />
            </div>
            <button onClick={onEdit} style={{ padding: "8px 18px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 20, color: "#aaa", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Edit Profile
            </button>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.03em", marginBottom: 2 }}>{profile.displayName}</div>
          <div style={{ fontSize: 12, color: "#0ea5e9", fontFamily: "'DM Mono',monospace", marginBottom: 12 }}>@{currentUser}</div>
          {profile.bio && <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 14 }}>{profile.bio}</p>}
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#555", marginBottom: 20, flexWrap: "wrap" }}>
            {profile.location && <span>📍 {profile.location}</span>}
            {profile.favGenre && <span>🎵 {profile.favGenre}</span>}
          </div>

          {/* Stats — 4 key numbers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {[
              { l: "Records", v: mine.length, click: () => setTab("records") },
              { l: "For Sale", v: forSale.length, click: () => setTab("for sale") },
              { l: "Following", v: following.length, click: onShowFollowing },
              { l: "Followers", v: (followers || []).length, click: onShowFollowers },
            ].map(s => (
              <div
                key={s.l} onClick={s.click}
                style={{ background: "#111", borderRadius: 10, padding: "12px 8px", textAlign: "center", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "#191919"}
                onMouseLeave={e => e.currentTarget.style.background = "#111"}
              >
                <div style={{ fontSize: 20, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.02em" }}>{s.v}</div>
                <div style={{ fontSize: 10, color: "#0ea5e9", fontFamily: "'DM Mono',monospace", marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs with counts */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a1a1a", marginBottom: 18 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 14px", background: "none", border: "none",
            borderBottom: `2px solid ${tab === t.id ? "#0ea5e9" : "transparent"}`,
            color: tab === t.id ? "#0ea5e9" : "#555", fontSize: 12, fontWeight: 600,
            cursor: "pointer", textTransform: "capitalize", marginBottom: -1,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            {t.id}
            <span style={{ fontSize: 10, color: tab === t.id ? "#0ea5e966" : "#333", fontFamily: "'DM Mono',monospace" }}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "posts" ? (
        myPosts.length === 0 ? (
          <Empty icon="📝" text="No posts yet. Share what you're spinning!" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {myPosts.map(post => {
              const matchedRecord = post.taggedRecord ? records.find(r => r.album.toLowerCase() === post.taggedRecord.album.toLowerCase() && r.artist.toLowerCase() === post.taggedRecord.artist.toLowerCase()) : null;
              const tagAccent = matchedRecord?.accent || post.accent || "#0ea5e9";
              return (
                <div key={post.id} style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ height: 2, background: `linear-gradient(90deg,${tagAccent},transparent)` }} />
                  <div style={{ padding: 16 }}>
                    {post.taggedRecord && (
                      <div onClick={() => matchedRecord && onDetail(matchedRecord)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 10px", background: tagAccent + "0a", borderRadius: 8, cursor: matchedRecord ? "pointer" : "default" }}>
                        <AlbumArt album={post.taggedRecord.album} artist={post.taggedRecord.artist} accent={tagAccent} size={30} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5" }}>{post.taggedRecord.album}</div>
                          <div style={{ fontSize: 10, color: "#666" }}>{post.taggedRecord.artist}</div>
                        </div>
                      </div>
                    )}
                    <p style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6, marginBottom: 10 }}>{post.caption}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1a1a1a", paddingTop: 10 }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        <button onClick={() => onLikePost && onLikePost(post.id)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: post.liked ? "#ef4444" : "#555", fontSize: 12, fontWeight: 600 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={post.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                          {post.likes}
                        </button>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#555", fontSize: 12, fontWeight: 600 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                          {post.comments.length}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button onClick={() => onBookmarkPost && onBookmarkPost(post.id)} style={{ background: "none", border: "none", cursor: "pointer", color: post.bookmarked ? "#f59e0b" : "#555" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={post.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                        </button>
                        <span style={{ fontSize: 10, color: "#333", fontFamily: "'DM Mono',monospace" }}>{post.timeAgo}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : tab === "listening" ? (
        myListens.length === 0 ? (
          <Empty icon="🎧" text="No listening history yet. Connect a Vinyl Buddy to start tracking!" />
        ) : (
          <div>
            {/* Listening stats bar */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(() => {
                const artists = new Set(myListens.map(s => s.track.artist));
                const albums = new Set(myListens.map(s => s.track.album));
                return [
                  { label: "Sessions", value: myListens.length, color: "#0ea5e9" },
                  { label: "Artists", value: artists.size, color: "#8b5cf6" },
                  { label: "Albums", value: albums.size, color: "#f59e0b" },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, background: "#111", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{s.label}</div>
                  </div>
                ));
              })()}
            </div>

            {/* Session list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myListens.map(session => (
                <div key={session.id} style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, overflow: "hidden", transition: "border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#0ea5e933"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e1e"}>
                  <div style={{ height: 2, background: "linear-gradient(90deg,#0ea5e9,#8b5cf6,transparent)" }} />
                  <div style={{ padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                    <AlbumArt album={session.track.album} artist={session.track.artist} accent="#0ea5e9" size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.track.title}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{session.track.artist}</div>
                      <div style={{ fontSize: 10, color: "#555" }}>{session.track.album}{session.track.year ? ` \u00B7 ${session.track.year}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono',monospace" }}>{relTime(session.timestampMs)}</span>
                      <span style={{ fontSize: 9, padding: "2px 6px", background: "#0ea5e911", border: "1px solid #0ea5e922", borderRadius: 4, color: "#0ea5e9", fontWeight: 600, fontFamily: "'DM Mono',monospace" }}>vinyl buddy</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : tab === "wishlist" ? (
        <div>
          {/* Inline add form */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}><FormInput label="" value={newWishAlbum} onChange={setNewWishAlbum} placeholder="Album title" /></div>
            <div style={{ flex: 1 }}><FormInput label="" value={newWishArtist} onChange={setNewWishArtist} placeholder="Artist" /></div>
            <button onClick={() => {
              if (newWishAlbum.trim() && newWishArtist.trim()) {
                onAddWishlistItem(newWishAlbum, newWishArtist);
                setNewWishAlbum(""); setNewWishArtist("");
              }
            }} style={{ padding: "10px 18px", marginBottom: 14, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              + Add
            </button>
          </div>

          {(wishlist || []).length === 0 ? (
            <Empty icon="✨" text="Your wishlist is empty. Add albums you're looking for!" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {wishlist.map(w => {
                const matchedRecord = records.find(r => r.album.toLowerCase() === w.album.toLowerCase() && r.artist.toLowerCase() === w.artist.toLowerCase());
                return (
                  <div key={w.id} onClick={() => matchedRecord && onDetail(matchedRecord)}
                    style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", cursor: matchedRecord ? "pointer" : "default", transition: "border-color 0.15s" }}
                    onMouseEnter={e => matchedRecord && (e.currentTarget.style.borderColor = (matchedRecord.accent || "#555") + "55")}
                    onMouseLeave={e => matchedRecord && (e.currentTarget.style.borderColor = "#1e1e1e")}>
                    {matchedRecord ? <AlbumArt album={matchedRecord.album} artist={matchedRecord.artist} accent={matchedRecord.accent} size={38} /> : <AlbumArt album={w.album} artist={w.artist} accent="#555" size={38} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5" }}>{w.album}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>{w.artist}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); onRemoveWishlistItem(w.id); }} style={{ padding: "5px 12px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 7, color: "#666", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : display.length === 0 ? (
        <Empty icon="💿" text={`No ${tab} yet.`} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {display.slice(0, 50).map(r => (
            <div key={r.id} onClick={() => onDetail(r)} style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = r.accent + "55"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e1e"}>
              <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4 }}>
                  {r.album}
                  {r.verified && <span title="Verified vinyl" style={{ color: "#3b82f6", fontSize: 11, flexShrink: 0 }}>✓</span>}
                </div>
                <div style={{ fontSize: 11, color: "#666" }}>{r.artist} · {r.year} · {r.format}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <Badge label={r.condition} color={condColor(r.condition)} />
                {r.forSale && <Badge label={`$${r.price}`} color="#f59e0b" />}
                <Stars rating={r.rating} size={10} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
