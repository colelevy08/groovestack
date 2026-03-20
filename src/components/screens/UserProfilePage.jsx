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
      <button onClick={onBack} className="flex items-center gap-1.5 bg-transparent border-none text-gs-dim text-xs font-semibold cursor-pointer mb-4 p-0 hover:text-gs-accent">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
        Back
      </button>

      {/* Profile card */}
      <div className="gs-card mb-6">
        {/* Header banner */}
        <div className="h-[100px]" style={p.headerUrl ? { background: `url(${p.headerUrl}) center/cover` } : { background: `linear-gradient(135deg,${p.accent || "#0ea5e9"}33,#6366f122)` }} />

        <div className="px-6 pb-6 -mt-8">
          <div className="flex justify-between items-end mb-3.5">
            <div className="rounded-full border-[3px] border-gs-card leading-none relative z-[2]">
              <Avatar username={username} size={64} src={isOwn ? profile?.avatarUrl : undefined} />
            </div>
            {!isOwn && (
              <button
                onClick={() => onFollow(username)}
                className={isFollowing ? "gs-btn-secondary py-2 px-5 !rounded-[20px] text-xs font-bold" : "gs-btn-gradient py-2 px-5 !rounded-[20px] text-xs"}
              >
                {isFollowing ? "Following ✓" : "Follow"}
              </button>
            )}
          </div>

          <div className="text-xl font-extrabold text-gs-text tracking-tight mb-0.5">{p.displayName}</div>
          <div className="text-xs font-mono mb-3" style={{ color: p.accent || "#0ea5e9" }}>@{username}</div>
          {p.bio && <p className="text-[13px] text-gs-muted leading-relaxed mb-3.5 line-clamp-3">{p.bio}</p>}

          <div className="flex gap-3.5 text-xs text-gs-dim mb-5 flex-wrap">
            {p.location && <span>📍 {p.location}</span>}
            {p.favGenre && <span>🎵 {p.favGenre}</span>}
          </div>

          {/* Stats — 4 key numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { l: "Records", v: userRecords.length, click: () => setTab("records") },
              { l: "For Sale", v: forSale.length, click: () => setTab("for sale") },
              { l: "Followers", v: followerCount },
              { l: "Posts", v: userPosts.length, click: () => setTab("posts") },
            ].map(s => (
              <div
                key={s.l} onClick={s.click}
                className={`gs-stat ${s.click ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="text-xl font-extrabold text-gs-text tracking-tight">{s.v}</div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: p.accent || "#0ea5e9" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs with counts */}
      <div className="flex border-b border-[#1a1a1a] mb-4">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`py-2.5 px-3.5 bg-transparent border-none border-b-2 text-xs font-semibold cursor-pointer capitalize -mb-px flex items-center gap-1.5 ${tab === t.id ? 'border-b-gs-accent text-gs-accent' : 'border-b-transparent text-gs-dim'}`}>
            {t.id}
            <span className={`text-[10px] font-mono ${tab === t.id ? 'text-gs-accent/40' : 'text-gs-subtle'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* === Tab content === */}

      {/* Posts */}
      {tab === "posts" && (
        userPosts.length === 0 ? (
          <Empty icon="📝" text={`@${username} hasn't posted yet.`} />
        ) : (
          <div className="flex flex-col gap-3">
            {userPosts.map(post => {
              const matchedRecord = post.taggedRecord ? records.find(r => r.album.toLowerCase() === post.taggedRecord.album.toLowerCase() && r.artist.toLowerCase() === post.taggedRecord.artist.toLowerCase()) : null;
              const tagAccent = matchedRecord?.accent || post.accent || p.accent || "#0ea5e9";
              return (
                <div key={post.id} className="bg-gs-card border border-gs-border rounded-[14px] overflow-hidden">
                  <div className="h-0.5" style={{ background: `linear-gradient(90deg,${tagAccent},transparent)` }} />
                  <div className="p-4">
                    {/* Author chip */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <Avatar username={username} size={24} src={isOwn ? profile?.avatarUrl : undefined} />
                      <span className="text-xs font-semibold text-[#aaa]">{p.displayName}</span>
                      <span className="text-[10px] text-gs-faint font-mono">{post.timeAgo}</span>
                    </div>
                    {post.taggedRecord && (
                      <div onClick={() => matchedRecord && onDetail(matchedRecord)} className="flex items-center gap-2.5 mb-2.5 p-2 rounded-lg" style={{ background: tagAccent + "0a", cursor: matchedRecord ? "pointer" : "default" }}>
                        <AlbumArt album={post.taggedRecord.album} artist={post.taggedRecord.artist} accent={tagAccent} size={30} />
                        <div>
                          <div className="text-xs font-bold text-gs-text">{post.taggedRecord.album}</div>
                          <div className="text-[10px] text-[#666]">{post.taggedRecord.artist}</div>
                        </div>
                      </div>
                    )}
                    <p className="text-[13px] text-[#ccc] leading-relaxed mb-2.5">{post.caption}</p>
                    <div className="flex items-center justify-between border-t border-[#1a1a1a] pt-2.5">
                      <div className="flex gap-3">
                        <button onClick={() => onLikePost && onLikePost(post.id)} className={`flex items-center gap-1 bg-transparent border-none cursor-pointer text-xs font-semibold ${post.liked ? 'text-red-500' : 'text-gs-dim'}`}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={post.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                          {post.likes}
                        </button>
                        <span className="flex items-center gap-1 text-gs-dim text-xs font-semibold">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                          {post.comments.length}
                        </span>
                      </div>
                      <button onClick={() => onBookmarkPost && onBookmarkPost(post.id)} className={`bg-transparent border-none cursor-pointer ${post.bookmarked ? 'text-amber-500' : 'text-gs-dim'}`}>
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
            <div className="flex gap-2 mb-4">
              {(() => {
                const artists = new Set(userListens.map(s => s.track.artist));
                const albums = new Set(userListens.map(s => s.track.album));
                return [
                  { label: "Sessions", value: userListens.length, color: "#0ea5e9" },
                  { label: "Artists", value: artists.size, color: "#8b5cf6" },
                  { label: "Albums", value: albums.size, color: "#f59e0b" },
                ].map(s => (
                  <div key={s.label} className="flex-1 bg-[#111] rounded-[10px] py-2.5 px-3 text-center">
                    <div className="text-base font-extrabold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px] text-gs-dim font-mono mt-0.5">{s.label}</div>
                  </div>
                ));
              })()}
            </div>

            {/* Session list */}
            <div className="flex flex-col gap-2">
              {userListens.map(session => (
                <div key={session.id} className="bg-gs-card border border-gs-border rounded-xl overflow-hidden transition-colors duration-150 hover:border-gs-accent/20">
                  <div className="h-0.5 bg-gradient-to-r from-gs-accent via-violet-500 to-transparent" />
                  <div className="py-3 px-3.5 flex gap-3 items-center">
                    <AlbumArt album={session.track.album} artist={session.track.artist} accent="#0ea5e9" size={38} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-gs-text whitespace-nowrap overflow-hidden text-ellipsis">{session.track.title}</div>
                      <div className="text-[11px] text-gs-muted">{session.track.artist}</div>
                      <div className="text-[10px] text-gs-dim">{session.track.album}{session.track.year ? ` \u00B7 ${session.track.year}` : ""}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-gs-faint font-mono">{relTime(session.timestampMs)}</span>
                      <span className="text-[9px] py-0.5 px-1.5 bg-gs-accent/[0.07] border border-gs-accent/[0.13] rounded text-gs-accent font-semibold font-mono">vinyl buddy</span>
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
          <div className="flex flex-col gap-2">
            {userWishlist.map(w => {
              const canOffer = !isOwn && myRecords.some(r => r.album.toLowerCase() === w.album.toLowerCase() && r.artist.toLowerCase() === w.artist.toLowerCase());
              const matchedRecord = records.find(r => r.album.toLowerCase() === w.album.toLowerCase() && r.artist.toLowerCase() === w.artist.toLowerCase());
              return (
                <div key={w.id} onClick={() => matchedRecord && onDetail(matchedRecord)}
                  className="bg-gs-card border border-gs-border rounded-xl p-3 flex gap-3 items-center transition-colors duration-150"
                  style={{ cursor: matchedRecord ? "pointer" : "default" }}
                  onMouseEnter={e => matchedRecord && (e.currentTarget.style.borderColor = (matchedRecord.accent || "#555") + "55")}
                  onMouseLeave={e => matchedRecord && (e.currentTarget.style.borderColor = "")}>
                  {matchedRecord ? <AlbumArt album={matchedRecord.album} artist={matchedRecord.artist} accent={matchedRecord.accent} size={38} /> : <AlbumArt album={w.album} artist={w.artist} accent="#555" size={38} />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-gs-text">{w.album}</div>
                    <div className="text-[11px] text-[#666]">{w.artist}</div>
                  </div>
                  {canOffer && (
                    <button onClick={e => { e.stopPropagation(); onMakeOffer(w, username); }} className="py-1.5 px-3.5 rounded-lg bg-gradient-to-br from-amber-500 to-red-500 border-none text-white font-bold text-[11px] cursor-pointer whitespace-nowrap">
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
          <div className="flex flex-col gap-2">
            {display.slice(0, 50).map(r => (
              <div key={r.id} onClick={() => onDetail(r)} className="bg-gs-card border border-gs-border rounded-xl p-3 flex gap-3 items-center cursor-pointer transition-colors duration-150"
                onMouseEnter={e => e.currentTarget.style.borderColor = r.accent + "55"}
                onMouseLeave={e => e.currentTarget.style.borderColor = ""}>
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={38} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-gs-text whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1">
                    {r.album}
                    {r.verified && <span title="Verified vinyl" className="text-blue-500 text-[11px] shrink-0">✓</span>}
                  </div>
                  <div className="text-[11px] text-[#666]">{r.artist} · {r.year} · {r.format}</div>
                </div>
                <div className="flex gap-1.5 items-center shrink-0">
                  <Badge label={r.condition} color={condColor(r.condition)} />
                  {r.forSale && <Badge label={`$${r.price}`} color="#f59e0b" />}
                  {tab === "for sale" && (
                    <button onClick={e => { e.stopPropagation(); onBuy(r); }} className="py-1.5 px-3.5 rounded-[7px] border-none text-white font-bold text-[11px] cursor-pointer" style={{ background: `linear-gradient(135deg,${r.accent},#6366f1)` }}>Buy</button>
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
