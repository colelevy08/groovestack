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
      style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 16, overflow: "hidden", transition: "border-color 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = accent + "33"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e1e"}
    >
      {/* Accent bar */}
      <div style={{ height: 2, background: `linear-gradient(90deg,${accent},transparent)` }} />

      <div style={{ padding: 18 }}>
        {/* User header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
            onClick={() => onViewUser(post.user)}
          >
            <Avatar username={post.user} size={36} src={post.user === currentUser ? profile?.avatarUrl : undefined} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5" }}>{p.displayName}</div>
              <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace" }}>@{post.user}</div>
            </div>
          </div>
          <span style={{ fontSize: 10, color: "#3a3a3a", fontFamily: "'DM Mono',monospace" }}>{post.timeAgo}</span>
        </div>

        {/* Tagged record visual */}
        {post.taggedRecord && (
          <div
            onClick={() => matchedRecord && onDetail(matchedRecord)}
            style={{
              background: `linear-gradient(135deg, ${tagAccent}15, ${tagAccent}08)`,
              border: `1px solid ${tagAccent}22`,
              borderRadius: 14,
              padding: 18,
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 16,
              cursor: matchedRecord ? "pointer" : "default",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={e => matchedRecord && (e.currentTarget.style.borderColor = tagAccent + "55")}
            onMouseLeave={e => matchedRecord && (e.currentTarget.style.borderColor = tagAccent + "22")}
          >
            <AlbumArt album={post.taggedRecord.album} artist={post.taggedRecord.artist} accent={tagAccent} size={64} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.02em", marginBottom: 3 }}>
                {post.taggedRecord.album}
              </div>
              <div style={{ fontSize: 13, color: "#888" }}>
                <button onClick={e => { e.stopPropagation(); onViewArtist?.(post.taggedRecord.artist); }} style={{ background: "none", border: "none", color: "#888", fontSize: 13, padding: 0, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#ccc"} onMouseLeave={e => e.currentTarget.style.color = "#888"}
                >{post.taggedRecord.artist}</button>
              </div>
              {matchedRecord && (
                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: tagAccent + "18", color: tagAccent, fontWeight: 600, fontFamily: "'DM Mono',monospace" }}>
                    {matchedRecord.format} · {matchedRecord.year}
                  </span>
                  {matchedRecord.forSale && (
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#f59e0b18", color: "#f59e0b", fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
                      ${matchedRecord.price}
                    </span>
                  )}
                </div>
              )}
            </div>
            {matchedRecord && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tagAccent} strokeWidth="2" style={{ flexShrink: 0, opacity: 0.5 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
          </div>
        )}

        {/* Caption */}
        <p style={{ fontSize: 14, color: "#ccc", lineHeight: 1.7, marginBottom: 14 }}>
          {post.caption}
        </p>

        {/* Media URL image (if provided) */}
        {post.mediaUrl && (
          <div style={{ borderRadius: 12, overflow: "hidden", marginBottom: 14, background: "#111", border: "1px solid #1a1a1a" }}>
            {post.mediaType === "video" ? (
              <video src={post.mediaUrl} controls style={{ width: "100%", display: "block" }} />
            ) : (
              <img src={post.mediaUrl} alt="" style={{ width: "100%", display: "block" }} onError={e => e.target.style.display = "none"} />
            )}
          </div>
        )}

        {/* Action bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #1a1a1a", paddingTop: 12 }}>
          <div style={{ display: "flex", gap: 16 }}>
            {/* Like */}
            <button
              onClick={() => onLikePost(post.id)}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: post.liked ? "#ef4444" : "#555", fontSize: 12, fontWeight: 600, transition: "color 0.15s" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={post.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {post.likes}
            </button>
            {/* Comment */}
            <button
              onClick={() => { setShowCommentInput(s => !s); setTimeout(() => inputRef.current?.focus(), 50); }}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "#555", fontSize: 12, fontWeight: 600 }}
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
            style={{ background: "none", border: "none", cursor: "pointer", color: post.bookmarked ? "#f59e0b" : "#555", transition: "color 0.15s" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={post.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>

        {/* Comments section */}
        {post.comments.length > 0 && (
          <div style={{ marginTop: 12, borderTop: "1px solid #111", paddingTop: 10 }}>
            {post.comments.length > 2 && !showAllComments && (
              <button
                onClick={() => setShowAllComments(true)}
                style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", marginBottom: 8, padding: 0, fontWeight: 500 }}
              >
                View all {post.comments.length} comments
              </button>
            )}
            {visibleComments.map(c => {
              const cp = getProfile(c.user);
              return (
                <div key={c.id} style={{ marginBottom: 6, fontSize: 13, lineHeight: 1.5 }}>
                  <span
                    onClick={() => onViewUser(c.user)}
                    style={{ fontWeight: 700, color: "#e0e0e0", cursor: "pointer", marginRight: 6, fontSize: 12 }}
                  >
                    {cp.displayName || c.user}
                  </span>
                  <span style={{ color: "#888" }}>{c.text}</span>
                  <span style={{ color: "#333", fontSize: 10, marginLeft: 8, fontFamily: "'DM Mono',monospace" }}>{c.time}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Comment input */}
        {showCommentInput && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <input
              ref={inputRef}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleComment()}
              placeholder="Add a comment..."
              style={{ flex: 1, background: "#111", border: "1px solid #222", borderRadius: 8, padding: "8px 12px", color: "#ccc", fontSize: 12, outline: "none" }}
            />
            <button
              onClick={handleComment}
              disabled={!commentText.trim()}
              style={{ padding: "8px 14px", background: commentText.trim() ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "#1a1a1a", border: "none", borderRadius: 8, color: commentText.trim() ? "#fff" : "#555", fontWeight: 700, fontSize: 11, cursor: commentText.trim() ? "pointer" : "default" }}
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
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: "#f5f5f5", marginBottom: 4 }}>Social</h1>
        <p style={{ fontSize: 12, color: "#555" }}>See what the community is spinning</p>
      </div>

      {/* Compose prompt */}
      <div
        onClick={onCreatePost}
        style={{
          background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 14, padding: "14px 18px",
          display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 16,
          transition: "border-color 0.2s",
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "#0ea5e933"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e1e"}
      >
        <Avatar username={currentUser} size={36} src={profile?.avatarUrl} />
        <span style={{ flex: 1, fontSize: 13, color: "#555" }}>What's spinning?</span>
        <div style={{ padding: "7px 16px", background: "linear-gradient(135deg,#0ea5e9,#6366f1)", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#fff" }}>
          Post
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#555" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search posts, users, albums, artists..."
          style={{ width: "100%", background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px 10px 36px", color: "#f0f0f0", fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif" }}
          onFocus={e => e.target.style.borderColor = "#0ea5e955"}
          onBlur={e => e.target.style.borderColor = "#1e1e1e"}
        />
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a1a1a", marginBottom: 20 }}>
        {[
          { id: "all", label: "All Posts" },
          { id: "following", label: "Following" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: "9px 20px", background: "none", border: "none",
              borderBottom: `2px solid ${filter === f.id ? "#0ea5e9" : "transparent"}`,
              color: filter === f.id ? "#0ea5e9" : "#555",
              fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: -1,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {sorted.length === 0 ? (
        <Empty icon={q ? "🔍" : "📝"} text={q ? `No posts matching "${q}"` : "No posts yet. Be the first to share what you're listening to!"} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
