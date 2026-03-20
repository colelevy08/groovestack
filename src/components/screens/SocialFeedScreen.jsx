// Social feed — user-created posts with tagged records, likes, comments, and bookmarks.
// This replaces the old Feed as the main landing screen. Posts are the social layer on top of the record catalog.
// Includes a compose prompt that opens CreatePostModal, filter tabs (All / Following), and post cards with interactions.
import { useState, useRef } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';
import Empty from '../ui/Empty';
import { getProfile } from '../../utils/helpers';

// ── Post Card sub-component ──────────────────────────────────────────────────
function PostCard({ post, currentUser, profile, onLikePost, onCommentPost, onBookmarkPost, onViewUser, onViewArtist, onDetail, records }) {
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const inputRef = useRef(null);

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

  const visibleComments = showAllComments ? post.comments : post.comments.slice(-2);

  return (
    <div
      className="bg-gs-card border border-gs-border rounded-2xl overflow-hidden transition-colors duration-200"
      onMouseEnter={e => e.currentTarget.style.borderColor = accent + "33"}
      onMouseLeave={e => e.currentTarget.style.borderColor = ""}
    >
      {/* Accent bar */}
      <div className="h-0.5" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />

      <div className="p-[18px]">
        {/* User header */}
        <div className="flex justify-between items-center mb-3.5">
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => onViewUser(post.user)}
          >
            <Avatar username={post.user} size={36} src={post.user === currentUser ? profile?.avatarUrl : undefined} />
            <div>
              <div className="text-[13px] font-bold text-gs-text">{p.displayName}</div>
              <div className="text-[11px] text-gs-dim font-mono">@{post.user}</div>
            </div>
          </div>
          <span className="text-[10px] text-[#3a3a3a] font-mono">{post.timeAgo}</span>
        </div>

        {/* Tagged record visual */}
        {post.taggedRecord && (
          <div
            onClick={() => matchedRecord && onDetail(matchedRecord)}
            className="rounded-[14px] p-[18px] mb-3.5 flex items-center gap-4 transition-colors duration-200"
            style={{
              background: `linear-gradient(135deg, ${tagAccent}15, ${tagAccent}08)`,
              border: `1px solid ${tagAccent}22`,
              cursor: matchedRecord ? "pointer" : "default",
            }}
            onMouseEnter={e => matchedRecord && (e.currentTarget.style.borderColor = tagAccent + "55")}
            onMouseLeave={e => matchedRecord && (e.currentTarget.style.borderColor = tagAccent + "22")}
          >
            <AlbumArt album={post.taggedRecord.album} artist={post.taggedRecord.artist} accent={tagAccent} size={64} />
            <div className="flex-1 min-w-0">
              <div className="text-base font-extrabold text-gs-text tracking-tight mb-0.5">
                {post.taggedRecord.album}
              </div>
              <div className="text-[13px] text-gs-muted">
                <button onClick={e => { e.stopPropagation(); onViewArtist?.(post.taggedRecord.artist); }} className="bg-transparent border-none text-gs-muted text-[13px] p-0 cursor-pointer hover:text-[#ccc]"
                >{post.taggedRecord.artist}</button>
              </div>
              {matchedRecord && (
                <div className="flex gap-1.5 mt-1.5 items-center">
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

        {/* Caption */}
        <p className="text-sm text-[#ccc] leading-[1.7] mb-3.5">
          {post.caption}
        </p>

        {/* Media URL image (if provided) */}
        {post.mediaUrl && (
          <div className="rounded-xl overflow-hidden mb-3.5 bg-[#111] border border-[#1a1a1a]">
            {post.mediaType === "video" ? (
              <video src={post.mediaUrl} controls className="w-full block" />
            ) : (
              <img src={post.mediaUrl} alt="" className="w-full block" onError={e => e.target.style.display = "none"} />
            )}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between border-t border-[#1a1a1a] pt-3">
          <div className="flex gap-4">
            {/* Like */}
            <button
              onClick={() => onLikePost(post.id)}
              className={`flex items-center gap-[5px] bg-transparent border-none cursor-pointer text-xs font-semibold transition-colors duration-150 ${post.liked ? 'text-[#ef4444]' : 'text-gs-dim'}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={post.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {post.likes}
            </button>
            {/* Comment */}
            <button
              onClick={() => { setShowCommentInput(s => !s); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="flex items-center gap-[5px] bg-transparent border-none cursor-pointer text-gs-dim text-xs font-semibold"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {post.comments.length}
            </button>
          </div>
          {/* Bookmark */}
          <button
            onClick={() => onBookmarkPost(post.id)}
            className={`bg-transparent border-none cursor-pointer transition-colors duration-150 ${post.bookmarked ? 'text-[#f59e0b]' : 'text-gs-dim'}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={post.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>

        {/* Comments section */}
        {post.comments.length > 0 && (
          <div className="mt-3 border-t border-[#111] pt-2.5">
            {post.comments.length > 2 && !showAllComments && (
              <button
                onClick={() => setShowAllComments(true)}
                className="bg-transparent border-none text-gs-dim text-xs cursor-pointer mb-2 p-0 font-medium"
              >
                View all {post.comments.length} comments
              </button>
            )}
            {visibleComments.map(c => {
              const cp = getProfile(c.user);
              return (
                <div key={c.id} className="mb-1.5 text-[13px] leading-normal">
                  <span
                    onClick={() => onViewUser(c.user)}
                    className="font-bold text-[#e0e0e0] cursor-pointer mr-1.5 text-xs"
                  >
                    {cp.displayName || c.user}
                  </span>
                  <span className="text-gs-muted">{c.text}</span>
                  <span className="text-gs-subtle text-[10px] ml-2 font-mono">{c.time}</span>
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
export default function SocialFeedScreen({ posts, records, currentUser, following, profile, onCreatePost, onLikePost, onCommentPost, onBookmarkPost, onViewUser, onViewArtist, onDetail }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const filtered = (filter === "following"
    ? posts.filter(p => following.includes(p.user) || p.user === currentUser)
    : posts
  ).filter(p => {
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
  const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="max-w-[720px]">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[22px] font-extrabold tracking-tighter text-gs-text mb-1">Social</h1>
        <p className="text-xs text-gs-dim">See what the community is spinning</p>
      </div>

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
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-[#1a1a1a] mb-5">
        {[
          { id: "all", label: "All Posts" },
          { id: "following", label: "Following" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-5 py-2.5 bg-transparent border-none border-b-2 text-[13px] font-semibold cursor-pointer -mb-px ${
              filter === f.id
                ? 'border-b-gs-accent text-gs-accent'
                : 'border-b-transparent text-gs-dim'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {sorted.length === 0 ? (
        <Empty icon={q ? "🔍" : "📝"} text={q ? `No posts matching "${q}"` : "No posts yet. Be the first to share what you're listening to!"} />
      ) : (
        <div className="flex flex-col gap-4">
          {sorted.map(post => (
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
        </div>
      )}
    </div>
  );
}
