// The current user's own profile page — not to be confused with UserProfileModal (other users).
// Shows a profile card with avatar, bio, stats, and an "Edit Profile" button that opens ProfileEditModal.
// Six tabs: posts, listening, records, for sale, saved, and personal wishlist.
// Includes profile completion indicator, highlights row, share button, and collection value.
import { useState, useMemo } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import Stars from '../ui/Stars';
import Empty from '../ui/Empty';
import FormInput from '../ui/FormInput';
import { condColor } from '../../utils/helpers';

export default function ProfileScreen({ records, currentUser, profile, onEdit, following, followers, onShowFollowing, onShowFollowers, wishlist, onAddWishlistItem, onRemoveWishlistItem, onDetail, onViewArtist, posts, onLikePost, onCommentPost, onBookmarkPost, onViewUser, listeningHistory, onAddRecord, onCreatePost }) {
  const mine = records.filter(r => r.user === currentUser);
  const [tab, setTab] = useState("posts");
  const [newWishAlbum, setNewWishAlbum] = useState("");
  const [newWishArtist, setNewWishArtist] = useState("");
  const [shareToast, setShareToast] = useState(false);

  const forSale = mine.filter(r => r.forSale);
  const saved = records.filter(r => r.saved);
  const myPosts = (posts || []).filter(p => p.user === currentUser).sort((a, b) => b.createdAt - a.createdAt);
  const myListens = (listeningHistory || []).filter(s => s.username === currentUser).sort((a, b) => b.timestampMs - a.timestampMs);

  // ── Profile completion ────────────────────────────────────────────────
  const completionFields = [
    { key: 'displayName', filled: !!profile.displayName },
    { key: 'bio', filled: !!profile.bio },
    { key: 'location', filled: !!profile.location },
    { key: 'favGenre', filled: !!profile.favGenre },
    { key: 'avatarUrl', filled: !!profile.avatarUrl },
    { key: 'headerUrl', filled: !!profile.headerUrl },
    { key: 'shippingStreet', filled: !!profile.shippingStreet },
  ];
  const completionPct = Math.round((completionFields.filter(f => f.filled).length / completionFields.length) * 100);
  const missingFields = completionFields.filter(f => !f.filled).map(f => f.key);

  // ── Collection value estimate (sum of for-sale prices) ────────────────
  const collectionValue = useMemo(() => forSale.reduce((sum, r) => sum + (Number(r.price) || 0), 0), [forSale]);

  // ── Highlights — top 3 rated records ──────────────────────────────────
  const highlights = useMemo(() =>
    [...mine].filter(r => r.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, 3),
    [mine]
  );

  // ── Share profile ─────────────────────────────────────────────────────
  const handleShare = () => {
    const url = `${window.location.origin}/u/${currentUser}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    });
  };

  const relTime = ts => {
    const d = Date.now() - ts; const m = Math.floor(d / 60000);
    if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const dy = Math.floor(h / 24); return dy === 1 ? "yesterday" : `${dy}d ago`;
  };

  const display = tab === "records" ? mine : tab === "for sale" ? forSale : tab === "saved" ? saved : [];

  // Tab definitions with counts
  const tabs = [
    { id: "posts", label: "Posts", count: myPosts.length },
    { id: "listening", label: "Listening", count: myListens.length },
    { id: "records", label: "Records", count: mine.length },
    { id: "for sale", label: "For Sale", count: forSale.length },
    { id: "saved", label: "Saved", count: saved.length },
    { id: "wishlist", label: "Wishlist", count: (wishlist || []).length },
  ];

  return (
    <div>
      {/* ── Profile completion bar ─────────────────────────────────────── */}
      {completionPct < 100 && (
        <div className="gs-card mb-4 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-gs-muted">Profile Completion</div>
            <div className="text-xs font-bold text-gs-accent font-mono">{completionPct}%</div>
          </div>
          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${completionPct}%`,
                background: completionPct < 50 ? 'linear-gradient(90deg,#ef4444,#f59e0b)' : completionPct < 80 ? 'linear-gradient(90deg,#f59e0b,#0ea5e9)' : 'linear-gradient(90deg,#0ea5e9,#10b981)',
              }}
            />
          </div>
          <div className="text-[10px] text-gs-dim">
            Add {missingFields.slice(0, 2).map(f => f.replace(/([A-Z])/g, ' $1').replace(/url$/i, '').trim().toLowerCase()).join(', ')}{missingFields.length > 2 ? ` and ${missingFields.length - 2} more` : ''} to complete your profile.
            <button onClick={onEdit} className="ml-1.5 text-gs-accent bg-transparent border-none cursor-pointer text-[10px] font-semibold p-0 hover:underline">Complete now</button>
          </div>
        </div>
      )}

      {/* Profile card */}
      <div className="gs-card mb-6">
        {/* Header — custom image or gradient fallback */}
        <div
          className="transition-[height] duration-300 ease-in-out"
          style={{
            height: profile.headerUrl ? 140 : 72,
            background: profile.headerUrl
              ? `url(${profile.headerUrl}) center/cover no-repeat`
              : "linear-gradient(135deg,#0ea5e933,#6366f122)",
          }}
        />

        <div className="px-6 pb-6 -mt-8">
          <div className="flex justify-between items-end mb-3.5">
            <div className="rounded-full border-[3px] border-gs-card leading-none relative z-[2]">
              <Avatar username={currentUser} size={64} src={profile.avatarUrl} />
            </div>
            <div className="flex gap-2 items-center">
              {/* Share Profile button */}
              <div className="relative">
                <button onClick={handleShare} className="gs-btn-secondary px-3 py-2 rounded-[20px] text-xs flex items-center gap-1.5" title="Copy profile link">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Share
                </button>
                {/* Toast */}
                {shareToast && (
                  <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 bg-gs-accent text-black text-[10px] font-bold px-3 py-1 rounded-md whitespace-nowrap z-10 animate-fade-in">
                    Link copied!
                  </div>
                )}
              </div>
              {/* Edit Profile button */}
              <button onClick={onEdit} className="gs-btn-secondary px-[18px] py-2 rounded-[20px] text-xs flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit Profile
              </button>
            </div>
          </div>
          <div className="text-xl font-extrabold text-gs-text tracking-tight mb-0.5">{profile.displayName}</div>
          <div className="text-xs text-gs-accent font-mono mb-3">@{currentUser}</div>
          {profile.bio && <p className="text-[13px] text-gs-muted leading-relaxed mb-3.5 line-clamp-3">{profile.bio}</p>}
          <div className="flex gap-3.5 text-xs text-gs-dim mb-5 flex-wrap">
            {profile.location && <span>📍 {profile.location}</span>}
            {profile.favGenre && <span>🎵 {profile.favGenre}</span>}
          </div>

          {/* Stats — 5 key numbers including collection value */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[
              { l: "Records", v: mine.length, click: () => setTab("records") },
              { l: "For Sale", v: forSale.length, click: () => setTab("for sale") },
              { l: "Value", v: collectionValue > 0 ? `$${collectionValue}` : "$0", click: () => setTab("for sale") },
              { l: "Following", v: following.length, click: onShowFollowing },
              { l: "Followers", v: (followers || []).length, click: onShowFollowers },
            ].map(s => (
              <div
                key={s.l} onClick={s.click}
                className="gs-stat"
              >
                <div className="text-xl font-extrabold text-gs-text tracking-tight">{s.v}</div>
                <div className="text-[10px] text-gs-accent font-mono mt-[3px]">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Highlights — top-rated records row ─────────────────────────── */}
      {highlights.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-gs-muted uppercase tracking-wider">Top Rated</div>
            <button onClick={() => setTab("records")} className="text-[10px] text-gs-accent bg-transparent border-none cursor-pointer font-semibold hover:underline p-0">View all</button>
          </div>
          <div className="flex gap-3">
            {highlights.map(r => (
              <div
                key={r.id}
                onClick={() => onDetail(r)}
                className="flex-1 bg-gs-card border border-gs-border rounded-xl p-3 cursor-pointer transition-all duration-150 hover:border-gs-accent/30 hover:scale-[1.02] min-w-0"
              >
                <div className="flex justify-center mb-2">
                  <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={64} />
                </div>
                <div className="text-[11px] font-bold text-gs-text text-center truncate">{r.album}</div>
                <div className="text-[10px] text-gs-dim text-center truncate mb-1.5">{r.artist}</div>
                <div className="flex justify-center">
                  <Stars rating={r.rating} size={10} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs with count badges */}
      <div className="flex border-b border-[#1a1a1a] mb-[18px] overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2.5 bg-transparent border-none border-b-2 text-xs font-semibold cursor-pointer -mb-px flex items-center gap-[5px] transition-colors duration-150 whitespace-nowrap ${
              tab === t.id
                ? "border-b-gs-accent text-gs-accent"
                : "border-b-transparent text-gs-dim hover:text-gs-muted"
            }`}
          >
            {t.label}
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              tab === t.id
                ? "bg-gs-accent/10 text-gs-accent"
                : "bg-[#1a1a1a] text-gs-subtle"
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "posts" ? (
        myPosts.length === 0 ? (
          <Empty icon="📝" text="No posts yet. Share what you're spinning!" action={onCreatePost} actionLabel="Create Post" />
        ) : (
          <div className="flex flex-col gap-3">
            {myPosts.map(post => {
              const matchedRecord = post.taggedRecord ? records.find(r => r.album.toLowerCase() === post.taggedRecord.album.toLowerCase() && r.artist.toLowerCase() === post.taggedRecord.artist.toLowerCase()) : null;
              const tagAccent = matchedRecord?.accent || post.accent || "#0ea5e9";
              return (
                <div key={post.id} className="bg-gs-card border border-gs-border rounded-[14px] overflow-hidden">
                  <div className="h-0.5" style={{ background: `linear-gradient(90deg,${tagAccent},transparent)` }} />
                  <div className="p-4">
                    {post.taggedRecord && (
                      <div
                        onClick={() => matchedRecord && onDetail(matchedRecord)}
                        className="flex items-center gap-2.5 mb-2.5 px-2.5 py-2 rounded-lg"
                        style={{ background: tagAccent + "0a", cursor: matchedRecord ? "pointer" : "default" }}
                      >
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
                        <button
                          onClick={() => onLikePost && onLikePost(post.id)}
                          className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-xs font-semibold"
                          style={{ color: post.liked ? "#ef4444" : "#555" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={post.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                          {post.likes}
                        </button>
                        <span className="flex items-center gap-1 text-gs-dim text-xs font-semibold">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                          {post.comments.length}
                        </span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => onBookmarkPost && onBookmarkPost(post.id)}
                          className="bg-transparent border-none cursor-pointer"
                          style={{ color: post.bookmarked ? "#f59e0b" : "#555" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={post.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                        </button>
                        <span className="text-[10px] text-gs-subtle font-mono">{post.timeAgo}</span>
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
            <div className="flex gap-2 mb-4">
              {(() => {
                const artists = new Set(myListens.map(s => s.track.artist));
                const albums = new Set(myListens.map(s => s.track.album));
                return [
                  { label: "Sessions", value: myListens.length, color: "#0ea5e9" },
                  { label: "Artists", value: artists.size, color: "#8b5cf6" },
                  { label: "Albums", value: albums.size, color: "#f59e0b" },
                ].map(s => (
                  <div key={s.label} className="flex-1 bg-[#111] rounded-[10px] px-3 py-2.5 text-center">
                    <div className="text-base font-extrabold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px] text-gs-dim font-mono mt-0.5">{s.label}</div>
                  </div>
                ));
              })()}
            </div>

            {/* Session list */}
            <div className="flex flex-col gap-2">
              {myListens.map(session => (
                <div key={session.id} className="bg-gs-card border border-gs-border rounded-xl overflow-hidden transition-colors duration-150 hover:border-gs-accent/20">
                  <div className="h-0.5 bg-gradient-to-r from-gs-accent via-[#8b5cf6] to-transparent" />
                  <div className="p-3 px-3.5 flex gap-3 items-center">
                    <AlbumArt album={session.track.album} artist={session.track.artist} accent="#0ea5e9" size={38} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-gs-text whitespace-nowrap overflow-hidden text-ellipsis">{session.track.title}</div>
                      <div className="text-[11px] text-gs-muted">{session.track.artist}</div>
                      <div className="text-[10px] text-gs-dim">{session.track.album}{session.track.year ? ` \u00B7 ${session.track.year}` : ""}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-gs-faint font-mono">{relTime(session.timestampMs)}</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-gs-accent/[0.07] border border-gs-accent/[0.13] rounded text-gs-accent font-semibold font-mono">vinyl buddy</span>
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
          <div className="flex gap-2 mb-4 items-end">
            <div className="flex-1"><FormInput label="" value={newWishAlbum} onChange={setNewWishAlbum} placeholder="Album title" /></div>
            <div className="flex-1"><FormInput label="" value={newWishArtist} onChange={setNewWishArtist} placeholder="Artist" /></div>
            <button onClick={() => {
              if (newWishAlbum.trim() && newWishArtist.trim()) {
                onAddWishlistItem(newWishAlbum, newWishArtist);
                setNewWishAlbum(""); setNewWishArtist("");
              }
            }} className="gs-btn-gradient px-[18px] py-2.5 mb-3.5 rounded-lg text-xs whitespace-nowrap">
              + Add
            </button>
          </div>

          {(wishlist || []).length === 0 ? (
            <Empty icon="✨" text="Your wishlist is empty. Add albums you're looking for!" />
          ) : (
            <div className="flex flex-col gap-2">
              {wishlist.map(w => {
                const matchedRecord = records.find(r => r.album.toLowerCase() === w.album.toLowerCase() && r.artist.toLowerCase() === w.artist.toLowerCase());
                return (
                  <div key={w.id} onClick={() => matchedRecord && onDetail(matchedRecord)}
                    className="bg-gs-card border border-gs-border rounded-xl p-3 px-3.5 flex gap-3 items-center transition-colors duration-150"
                    style={{ cursor: matchedRecord ? "pointer" : "default" }}
                    onMouseEnter={e => matchedRecord && (e.currentTarget.style.borderColor = (matchedRecord.accent || "#555") + "55")}
                    onMouseLeave={e => matchedRecord && (e.currentTarget.style.borderColor = "#1e1e1e")}>
                    {matchedRecord ? <AlbumArt album={matchedRecord.album} artist={matchedRecord.artist} accent={matchedRecord.accent} size={38} /> : <AlbumArt album={w.album} artist={w.artist} accent="#555" size={38} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-gs-text">{w.album}</div>
                      <div className="text-[11px] text-[#666]">{w.artist}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); if (window.confirm('Remove from wishlist?')) onRemoveWishlistItem(w.id); }} className="gs-btn-secondary px-3 py-[5px] rounded-[7px] text-[11px]">
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : display.length === 0 ? (
        <Empty
          icon={tab === "for sale" ? "🏷️" : tab === "saved" ? "🔖" : "💿"}
          text={tab === "for sale" ? "You don't have any records listed for sale yet." : tab === "saved" ? "You haven't saved any records yet. Browse the marketplace!" : `No ${tab} yet.`}
          action={tab === "records" ? onAddRecord : undefined}
          actionLabel={tab === "records" ? "Add Record" : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {display.slice(0, 50).map(r => (
            <div key={r.id} onClick={() => onDetail(r)}
              className="bg-gs-card border border-gs-border rounded-xl p-3 px-3.5 flex gap-3 items-center cursor-pointer transition-colors duration-150"
              onMouseEnter={e => e.currentTarget.style.borderColor = r.accent + "55"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e1e"}>
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
                <Stars rating={r.rating} size={10} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
