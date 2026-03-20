// Social feed — user-created posts with tagged records, likes, comments, and bookmarks.
// This replaces the old Feed as the main landing screen. Posts are the social layer on top of the record catalog.
// Includes a compose prompt that opens CreatePostModal, filter tabs (All / Following), and post cards with interactions.
// Features: Trending section, post type filters, infinite scroll, redesigned cards, engagement metrics.
import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';
import Empty from '../ui/Empty';
import { getProfile } from '../../utils/helpers';

const POST_TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "reviews", label: "Reviews" },
  { id: "discussions", label: "Discussions" },
  { id: "photos", label: "Photos" },
];

// Infer post type from content
function inferPostType(post) {
  if (post.mediaUrl) return "photos";
  if (post.taggedRecord) return "reviews";
  return "discussions";
}

// ── Trending Post Card (compact) ────────────────────────────────────────────
function TrendingCard({ post, rank, onViewUser, onDetail, records }) {
  const p = getProfile(post.user);
  const accent = p.accent || post.accent || "#0ea5e9";
  const matchedRecord = post.taggedRecord
    ? records.find(r => r.album.toLowerCase() === post.taggedRecord.album.toLowerCase() && r.artist.toLowerCase() === post.taggedRecord.artist.toLowerCase())
    : null;

  return (
    <div
      className="bg-gs-card border border-gs-border rounded-xl p-3 min-w-[200px] max-w-[220px] shrink-0 cursor-pointer transition-all duration-200 hover:border-[#333] hover:translate-y-[-1px]"
      onClick={() => matchedRecord ? onDetail(matchedRecord) : onViewUser(post.user)}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-extrabold font-mono text-gs-accent">#{rank}</span>
        <Avatar username={post.user} size={20} />
        <span className="text-[11px] font-semibold text-gs-muted truncate">{p.displayName}</span>
      </div>
      {post.taggedRecord && (
        <div className="flex items-center gap-2 mb-2">
          <AlbumArt album={post.taggedRecord.album} artist={post.taggedRecord.artist} accent={accent} size={36} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-gs-text truncate">{post.taggedRecord.album}</div>
            <div className="text-[10px] text-gs-dim truncate">{post.taggedRecord.artist}</div>
          </div>
        </div>
      )}
      <p className="text-[11px] text-gs-muted leading-snug line-clamp-2 mb-2">{post.caption}</p>
      <div className="flex items-center gap-3 text-[10px] text-gs-dim">
        <span className="flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
          {post.likes}
        </span>
        <span className="flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          {/* Fix: use post.comments directly in TrendingCard (comments variable is only in PostCard) */}
          {(post.comments || []).length}
        </span>
      </div>
    </div>
  );
}

// ── Post Card sub-component ──────────────────────────────────────────────────
function PostCard({ post, currentUser, profile, onLikePost, onCommentPost, onBookmarkPost, onViewUser, onViewArtist, onDetail, records }) {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [showShareCopied, setShowShareCopied] = useState(false);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const inputRef = useRef(null);
  const lastTapRef = useRef(0);

  const p = getProfile(post.user);
  const accent = p.accent || post.accent || "#0ea5e9";

  // Try to find a matching record for the tagged record
  const matchedRecord = post.taggedRecord
    ? records.find(r => r.album.toLowerCase() === post.taggedRecord.album.toLowerCase() && r.artist.toLowerCase() === post.taggedRecord.artist.toLowerCase())
    : null;

  const tagAccent = matchedRecord?.accent || accent;

  const handleComment = () => {
    if (!commentText.trim()) return;
    onCommentPost(post.id, { id: Date.now(), user: currentUser, text: commentText.trim(), time: "just now" });
    setCommentText("");
    setShowCommentInput(false);
  };

  // Share button (copy link)
  const handleShare = () => {
    const url = `${window.location.origin}?post=${post.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setShowShareCopied(true);
    setTimeout(() => setShowShareCopied(false), 1500);
  };

  // Double-tap to like on post images/tagged record
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      if (!post.liked) onLikePost(post.id);
      setDoubleTapHeart(true);
      setTimeout(() => setDoubleTapHeart(false), 800);
    }
    lastTapRef.current = now;
  }, [post.id, post.liked, onLikePost]);

  // Fix: guard against undefined comments array for safety
  const comments = post.comments || [];
  const visibleComments = showAllComments ? comments : comments.slice(-2);

  return (
    <div
      className="bg-gs-card border border-gs-border rounded-2xl overflow-hidden transition-colors duration-200"
      onMouseEnter={e => e.currentTarget.style.borderColor = accent + "33"}
      onMouseLeave={e => e.currentTarget.style.borderColor = ""}
    >
      {/* Accent bar */}
      <div className="h-0.5" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />

      <div className="p-5">
        {/* User header */}
        <div className="flex justify-between items-center mb-4">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => onViewUser(post.user)}
          >
            <Avatar username={post.user} size={40} src={post.user === currentUser ? profile?.avatarUrl : undefined} />
            <div>
              <div className="text-[13px] font-bold text-gs-text">{p.displayName}</div>
              <div className="text-[11px] text-gs-dim font-mono">@{post.user}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Post type badge */}
            <span className="text-[9px] font-semibold font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#111] border border-[#1a1a1a] text-gs-dim">
              {inferPostType(post)}
            </span>
            <span className="text-[10px] text-[#3a3a3a] font-mono">{post.timeAgo}</span>
          </div>
        </div>

        {/* Tagged record visual — larger card redesign */}
        {post.taggedRecord && (
          <div
            onClick={() => matchedRecord && onDetail(matchedRecord)}
            onDoubleClick={handleDoubleTap}
            className="rounded-[16px] p-5 mb-4 flex items-center gap-5 transition-colors duration-200 relative select-none"
            style={{
              background: `linear-gradient(135deg, ${tagAccent}15, ${tagAccent}08)`,
              border: `1px solid ${tagAccent}22`,
              cursor: matchedRecord ? "pointer" : "default",
            }}
            onMouseEnter={e => matchedRecord && (e.currentTarget.style.borderColor = tagAccent + "55")}
            onMouseLeave={e => matchedRecord && (e.currentTarget.style.borderColor = tagAccent + "22")}
          >
            {/* Double-tap heart animation */}
            {doubleTapHeart && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="#ef4444" className="animate-double-tap-heart absolute top-1/2 left-1/2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
            )}
            {/* Larger album art */}
            <AlbumArt album={post.taggedRecord.album} artist={post.taggedRecord.artist} accent={tagAccent} size={80} />
            <div className="flex-1 min-w-0">
              <div className="text-[17px] font-extrabold text-gs-text tracking-tight mb-1">
                {post.taggedRecord.album}
              </div>
              <div className="text-[13px] text-gs-muted mb-1.5">
                <button onClick={e => { e.stopPropagation(); onViewArtist?.(post.taggedRecord.artist); }} className="bg-transparent border-none text-gs-muted text-[13px] p-0 cursor-pointer hover:text-[#ccc]"
                >{post.taggedRecord.artist}</button>
              </div>
              {matchedRecord && (
                <div className="flex gap-1.5 items-center flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold font-mono" style={{ background: tagAccent + "18", color: tagAccent }}>
                    {matchedRecord.format} · {matchedRecord.year}
                  </span>
                  {matchedRecord.forSale && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold font-mono bg-[#f59e0b18] text-[#f59e0b]">
                      ${matchedRecord.price}
                    </span>
                  )}
                </div>
              )}
            </div>
            {matchedRecord && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tagAccent} strokeWidth="2" className="shrink-0 opacity-50">
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
          </div>
        )}

        {/* Caption — more spacing */}
        <p className="text-sm text-[#ccc] leading-[1.75] mb-4 line-clamp-4">
          {post.caption}
        </p>

        {/* Media URL image (if provided) — larger images */}
        {post.mediaUrl && (
          <div
            className="rounded-xl overflow-hidden mb-4 bg-[#111] border border-[#1a1a1a] relative select-none"
            onDoubleClick={handleDoubleTap}
          >
            {doubleTapHeart && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="#ef4444" className="animate-double-tap-heart absolute top-1/2 left-1/2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
            )}
            {post.mediaType === "video" ? (
              <video src={post.mediaUrl} controls className="w-full block" />
            ) : (
              <img src={post.mediaUrl} alt={`Shared by ${post.user}${post.caption ? ': ' + post.caption.slice(0, 80) : ''}`} className="w-full block max-h-[360px] sm:max-h-[480px] object-cover" onError={e => e.target.style.display = "none"} />
            )}
          </div>
        )}

        {/* Engagement metrics bar */}
        <div className="flex items-center gap-4 mb-3 text-[11px] text-gs-dim">
          {post.likes > 0 && (
            <span>{post.likes} like{post.likes !== 1 ? 's' : ''}</span>
          )}
          {comments.length > 0 && (
            <span>{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
          )}
          {post.bookmarked && (
            <span className="text-[#f59e0b]">Saved</span>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between border-t border-[#1a1a1a] pt-3">
          <div className="flex gap-5">
            {/* Like */}
            <button
              onClick={() => onLikePost(post.id)}
              className={`flex items-center gap-[5px] bg-transparent border-none cursor-pointer text-xs font-semibold transition-all duration-200 ${post.liked ? 'text-[#ef4444]' : 'text-gs-dim'} ${post.liked ? 'animate-heart-pop' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={post.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {post.likes}
            </button>
            {/* Comment */}
            <button
              onClick={() => { setShowCommentInput(s => !s); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="flex items-center gap-[5px] bg-transparent border-none cursor-pointer text-gs-dim text-xs font-semibold"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {comments.length}
            </button>
            {/* Share button */}
            <button
              onClick={handleShare}
              className="flex items-center gap-[5px] bg-transparent border-none cursor-pointer text-gs-dim text-xs font-semibold hover:text-gs-muted transition-colors relative"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              Share
              {showShareCopied && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] text-gs-accent bg-gs-surface border border-gs-border rounded px-2 py-0.5 whitespace-nowrap animate-fade-in">
                  Link copied!
                </span>
              )}
            </button>
          </div>
          {/* Bookmark */}
          <button
            onClick={() => onBookmarkPost(post.id)}
            className={`bg-transparent border-none cursor-pointer transition-all duration-200 ${post.bookmarked ? 'text-[#f59e0b]' : 'text-gs-dim'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={post.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>

        {/* Inline comment preview */}
        {comments.length > 0 && (
          <div className="mt-3 border-t border-[#111] pt-2.5">
            {comments.length > 2 && !showAllComments && (
              <button
                onClick={() => setShowAllComments(true)}
                className="bg-transparent border-none text-gs-dim text-xs cursor-pointer mb-2 p-0 font-medium"
              >
                View all {comments.length} comments
              </button>
            )}
            {visibleComments.map(c => {
              const cp = getProfile(c.user);
              return (
                <div key={c.id} className="mb-1.5 text-[13px] leading-normal flex items-baseline gap-1.5">
                  <span
                    onClick={() => onViewUser(c.user)}
                    className="font-bold text-[#e0e0e0] cursor-pointer text-xs shrink-0"
                  >
                    {cp.displayName || c.user}
                  </span>
                  <span className="text-gs-muted flex-1 min-w-0">{c.text}</span>
                  <span className="text-gs-subtle text-[10px] font-mono shrink-0">{c.time}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Comment input */}
        {showCommentInput && (
          <div className="flex gap-2 mt-2.5 items-center">
            <input
              ref={inputRef}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleComment()}
              placeholder="Add a comment..."
              className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-[#ccc] text-xs outline-none"
            />
            <button
              onClick={handleComment}
              disabled={!commentText.trim()}
              className={`px-3.5 py-2 border-none rounded-lg font-bold text-[11px] ${commentText.trim() ? 'gs-btn-gradient text-white cursor-pointer' : 'bg-[#1a1a1a] text-gs-dim cursor-default'}`}
            >
              Post
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Social Feed Screen ──────────────────────────────────────────────────
const PAGE_SIZE = 6;

export default function SocialFeedScreen({ posts, records, currentUser, following, profile, onCreatePost, onLikePost, onCommentPost, onBookmarkPost, onViewUser, onViewArtist, onDetail }) {
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [q, setQ] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  // Trending: most-liked posts from last 7 days
  const trending = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return [...posts]
      .filter(p => p.createdAt >= weekAgo && p.likes >= 5)
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5);
  }, [posts]);

  const sorted = useMemo(() => {
    let filtered = filter === "following"
      ? posts.filter(p => following.includes(p.user) || p.user === currentUser)
      : posts;

    // Post type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(p => inferPostType(p) === typeFilter);
    }

    // Search filter
    filtered = filtered.filter(p => {
      if (!q) return true;
      const m = q.toLowerCase();
      return (
        p.caption?.toLowerCase().includes(m) ||
        p.user?.toLowerCase().includes(m) ||
        p.taggedRecord?.album?.toLowerCase().includes(m) ||
        p.taggedRecord?.artist?.toLowerCase().includes(m)
      );
    });

    // Sort by createdAt descending (newest first)
    return [...filtered].sort((a, b) => b.createdAt - a.createdAt);
  }, [posts, filter, typeFilter, following, currentUser, q]);

  // Visible slice for infinite scroll
  const visiblePosts = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);
  const hasMore = visibleCount < sorted.length;

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, typeFilter, q]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount(prev => prev + PAGE_SIZE);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore]);

  // Total likes across visible feed
  const totalFeedLikes = useMemo(() => sorted.reduce((sum, p) => sum + (p.likes || 0), 0), [sorted]);

  return (
    <div className="max-w-[720px] gs-page-transition">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[22px] font-extrabold tracking-tighter text-gs-text mb-1">Social</h1>
        <p className="text-xs text-gs-dim">
          See what the community is spinning
          {totalFeedLikes > 0 && (
            <span className="ml-2 text-gs-accent">
              · {totalFeedLikes} total likes across {sorted.length} posts
            </span>
          )}
        </p>
      </div>

      {/* Pull-to-refresh hint on mobile */}
      <div className="text-center text-[10px] text-gs-subtle mb-2 sm:hidden">
        Pull down to refresh
      </div>

      {/* Trending section */}
      {trending.length > 0 && !q && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
            </svg>
            <span className="text-xs font-bold text-gs-text">Trending This Week</span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {trending.map((post, i) => (
              <TrendingCard
                key={post.id}
                post={post}
                rank={i + 1}
                onViewUser={onViewUser}
                onDetail={onDetail}
                records={records}
              />
            ))}
          </div>
        </div>
      )}

      {/* Compose prompt */}
      <div
        onClick={onCreatePost}
        className="bg-gs-card border border-gs-border rounded-[14px] px-[18px] py-3.5 flex items-center gap-3 cursor-pointer mb-4 transition-colors duration-200 hover:border-gs-accent/20"
      >
        <Avatar username={currentUser} size={36} src={profile?.avatarUrl} />
        <span className="flex-1 text-[13px] text-gs-dim">What's spinning?</span>
        <div className="gs-btn-gradient px-4 py-[7px] text-xs text-white">
          Post
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-dim" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search posts, users, albums, artists..."
          className="w-full bg-gs-card border border-gs-border rounded-[10px] py-2.5 pr-3.5 pl-9 text-[#f0f0f0] text-[13px] outline-none font-sans focus:border-gs-accent/30"
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#222] border-none cursor-pointer text-gs-muted text-xs flex items-center justify-center hover:bg-[#333]"
          >
            &times;
          </button>
        )}
      </div>

      {/* Filter tabs: All / Following */}
      <div className="flex border-b border-[#1a1a1a] mb-3">
        {[
          { id: "all", label: "All Posts" },
          { id: "following", label: "Following" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-5 py-2.5 bg-transparent border-none border-b-2 text-[13px] font-semibold cursor-pointer -mb-px transition-colors duration-150 ${
              filter === f.id
                ? 'border-b-gs-accent text-gs-accent'
                : 'border-b-transparent text-gs-dim'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Post type filter pills */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {POST_TYPE_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setTypeFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all duration-150 cursor-pointer ${
              typeFilter === f.id
                ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent'
                : 'bg-transparent border-[#222] text-gs-dim hover:border-[#333] hover:text-gs-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {sorted.length === 0 ? (
        <Empty icon={q ? "&#128269;" : "&#128221;"} text={q ? `No posts matching "${q}"` : "No posts yet. Be the first to share what you're listening to!"} />
      ) : (
        <div className="flex flex-col gap-4">
          {visiblePosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              profile={profile}
              onLikePost={onLikePost}
              onCommentPost={onCommentPost}
              onBookmarkPost={onBookmarkPost}
              onViewUser={onViewUser}
              onViewArtist={onViewArtist}
              onDetail={onDetail}
              records={records}
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-1" />

          {/* Loading indicator */}
          {hasMore && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-xs text-gs-dim">
                <div className="w-4 h-4 border-2 border-gs-accent/30 border-t-gs-accent rounded-full animate-spin" />
                Loading more posts...
              </div>
            </div>
          )}

          {!hasMore && sorted.length > PAGE_SIZE && (
            <div className="text-center text-[11px] text-gs-faint py-4 font-mono">
              You've seen all {sorted.length} posts
            </div>
          )}
        </div>
      )}

      {/* Floating "New Post" action button (mobile) */}
      <button
        onClick={onCreatePost}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full gs-btn-gradient flex items-center justify-center shadow-xl shadow-gs-accent/30 z-[80] sm:hidden"
        aria-label="New Post"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>
  );
}
