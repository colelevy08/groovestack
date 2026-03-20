// Full profile page for viewing any user — matches ProfileScreen's design language.
// Shows header banner, avatar, bio, stats, Follow/Unfollow, and tabs for their content.
// Tabs: Posts, Listening, Records, For Sale, Wishlist.
// Wishlist tab includes "Make Offer" button when the current user owns a matching record.
import { useState } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import Stars from '../ui/Stars';
import Empty from '../ui/Empty';
import { getProfile, condColor } from '../../utils/helpers';
import { USER_WISHLISTS } from '../../constants';

export default function UserProfilePage({ username, records, currentUser, following, onFollow, onBack, onDetail, onBuy, onViewArtist, onViewUser, onMakeOffer, posts, onLikePost, onBookmarkPost, listeningHistory, wishlist, profile }) {
  const [tab, setTab] = useState("posts");

  if (!username) return null;

  const isOwn = username === currentUser;
  const p = isOwn
    ? { ...getProfile(username), displayName: profile?.displayName || getProfile(username).displayName, bio: profile?.bio || getProfile(username).bio, location: profile?.location || getProfile(username).location, favGenre: profile?.favGenre || getProfile(username).favGenre }
    : getProfile(username);

  const userRecords = records.filter(r => r.user === username);
  const forSale = userRecords.filter(r => r.forSale);
  const isFollowing = following.includes(username);
  const followerCount = (p.followers || []).length + (isFollowing && !(p.followers || []).includes(currentUser) ? 1 : 0);
  const userWishlist = isOwn ? (wishlist || []) : (USER_WISHLISTS[username] || []);
  const myRecords = records.filter(r => r.user === currentUser);
  const userPosts = (posts || []).filter(pp => pp.user === username).sort((a, b) => b.createdAt - a.createdAt);
  const userListens = (listeningHistory || []).filter(s => s.username === username).sort((a, b) => b.timestampMs - a.timestampMs);

  const relTime = ts => {
    const d = Date.now() - ts; const m = Math.floor(d / 60000);
    if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const dy = Math.floor(h / 24); return dy === 1 ? "yesterday" : `${dy}d ago`;
  };

  const tabs = [
    { id: "posts", count: userPosts.length },
    { id: "listening", count: userListens.length },
    { id: "records", count: userRecords.length },
    { id: "for sale", count: forSale.length },
    { id: "wishlist", count: userWishlist.length },
  ];

  const display = tab === "records" ? userRecords : tab === "for sale" ? forSale : [];

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#555", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 16, padding: 0 }}
        onMouseEnter={e => e.currentTarget.style.color = "#0ea5e9"}
        onMouseLeave={e => e.currentTarget.style.color = "#555"}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
        Back
      </button>

      {/* Profile card */}
      <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
        {/* Header banner */}
        <div style={{ height: 100, background: p.headerUrl ? `url(${p.headerUrl}) center/cover` : `linear-gradient(135deg,${p.accent || "#0ea5e9"}33,#6366f122)` }} />

        <div style={{ padding: "0 24px 24px", marginTop: -32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
            <div style={{ borderRadius: "50%", border: "3px solid #0f0f0f", lineHeight: 0, position: "relative", zIndex: 2 }}>
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
          <div style={{ fontSize: 12, color: p.accent || "#0ea5e9", fontFamily: "'DM Mono',monospace", marginBottom: 12 }}>@{username}</div>
          {p.bio && <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, marginBottom: 14 }}>{p.bio}</p>}

          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#555", marginBottom: 20, flexWrap: "wrap" }}>
            {p.location && <span>📍 {p.location}</span>}
            {p.favGenre && <span>🎵 {p.favGenre}</span>}
          </div>

          {/* Stats — 4 key numbers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {[
              { l: "Records", v: userRecords.length, click: () => setTab("records") },
              { l: "For Sale", v: forSale.length, click: () => setTab("for sale") },
              { l: "Followers", v: followerCount },
              { l: "Posts", v: userPosts.length, click: () => setTab("posts") },
            ].map(s => (
              <div
                key={s.l} onClick={s.click}
                style={{ background: "#111", borderRadius: 10, padding: "12px 8px", textAlign: "center", cursor: s.click ? "pointer" : "default" }}
                onMouseEnter={e => s.click && (e.currentTarget.style.background = "#191919")}
                onMouseLeave={e => s.click && (e.currentTarget.style.background = "#111")}
              >
                <div style={{ fontSize: 20, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.02em" }}>{s.v}</div>
                <div style={{ fontSize: 10, color: p.accent || "#0ea5e9", fontFamily: "'DM Mono',monospace", marginTop: 3 }}>{s.l}</div>
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

      {/* === Tab content === */}

      {/* Posts */}
      {tab === "posts" && (
        userPosts.length === 0 ? (
          <Empty icon="📝" text={`@${username} hasn't posted yet.`} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {userPosts.map(post => {
              const matchedRecord = post.taggedRecord ? records.find(r => r.album.toLowerCase() === post.taggedRecord.album.toLowerCase() && r.artist.toLowerCase() === post.taggedRecord.artist.toLowerCase()) : null;
              const tagAccent = matchedRecord?.accent || post.accent || p.accent || "#0ea5e9";
              return (
                <div key={post.id} style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ height: 2, background: `linear-gradient(90deg,${tagAccent},transparent)` }} />
                  <div style={{ padding: 16 }}>
                    {/* Author chip */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Avatar username={username} size={24} src={isOwn ? profile?.avatarUrl : undefined} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#aaa" }}>{p.displayName}</span>
                      <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono',monospace" }}>{post.timeAgo}</span>
                    </div>
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
                      <button onClick={() => onBookmarkPost && onBookmarkPost(post.id)} style={{ background: "none", border: "none", cursor: "pointer", color: post.bookmarked ? "#f59e0b" : "#555" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={post.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Listening */}
      {tab === "listening" && (
        userListens.length === 0 ? (
          <Empty icon="🎧" text={`@${username} hasn't tracked any listening sessions yet.`} />
        ) : (
          <div>
            {/* Listening stats bar */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(() => {
                const artists = new Set(userListens.map(s => s.track.artist));
                const albums = new Set(userListens.map(s => s.track.album));
                return [
                  { label: "Sessions", value: userListens.length, color: "#0ea5e9" },
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
              {userListens.map(session => (
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
      )}

      {/* Wishlist */}
      {tab === "wishlist" && (
        userWishlist.length === 0 ? (
          <Empty icon="✨" text={`@${username} hasn't added any wishlist items yet.`} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {userWishlist.map(w => {
              const canOffer = !isOwn && myRecords.some(r => r.album.toLowerCase() === w.album.toLowerCase() && r.artist.toLowerCase() === w.artist.toLowerCase());
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
                  {canOffer && (
                    <button onClick={e => { e.stopPropagation(); onMakeOffer(w, username); }} style={{ padding: "6px 14px", borderRadius: 8, background: "linear-gradient(135deg,#f59e0b,#ef4444)", border: "none", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                      Make Offer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Records & For Sale — shared list layout */}
      {(tab === "records" || tab === "for sale") && (
        display.length === 0 ? (
          <Empty icon={tab === "for sale" ? "🏷️" : "💿"} text={tab === "for sale" ? `@${username} doesn't have anything for sale.` : `@${username} hasn't added any records yet.`} />
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
                  {tab === "for sale" && (
                    <button onClick={e => { e.stopPropagation(); onBuy(r); }} style={{ padding: "6px 14px", borderRadius: 7, background: `linear-gradient(135deg,${r.accent},#6366f1)`, border: "none", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Buy</button>
                  )}
                  {tab === "records" && <Stars rating={r.rating} size={10} />}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
