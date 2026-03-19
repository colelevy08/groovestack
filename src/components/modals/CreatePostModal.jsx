// Modal for creating a new social post — opened from the compose prompt in SocialFeedScreen.
// Users can write a caption, optionally add an image/video URL, and tag any record (existing or custom).
// Record search autocompletes against the full record catalog; users can also tag records not yet on the platform.
import { useState, useRef, useEffect } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';

export default function CreatePostModal({ open, onClose, onSubmit, records, currentUser, profile }) {
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [showTagSearch, setShowTagSearch] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [taggedRecord, setTaggedRecord] = useState(null);
  const [showCustomTag, setShowCustomTag] = useState(false);
  const [customAlbum, setCustomAlbum] = useState("");
  const [customArtist, setCustomArtist] = useState("");
  const [showMediaInput, setShowMediaInput] = useState(false);

  const captionRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (open) {
      setCaption(""); setMediaUrl(""); setMediaType("image");
      setShowTagSearch(false); setTagSearch(""); setTaggedRecord(null);
      setShowCustomTag(false); setCustomAlbum(""); setCustomArtist("");
      setShowMediaInput(false);
      setTimeout(() => captionRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  // De-duplicate records by album+artist for search results
  const uniqueRecords = [...new Map(records.map(r => [`${r.album.toLowerCase()}|${r.artist.toLowerCase()}`, r])).values()];

  const searchResults = tagSearch.trim()
    ? uniqueRecords
        .filter(r => r.album.toLowerCase().includes(tagSearch.toLowerCase()) || r.artist.toLowerCase().includes(tagSearch.toLowerCase()))
        .slice(0, 6)
    : [];

  const canPost = caption.trim().length > 0;

  const handlePost = () => {
    if (!canPost) return;
    const tag = taggedRecord || (showCustomTag && customAlbum.trim() ? { album: customAlbum.trim(), artist: customArtist.trim() || "Unknown Artist" } : null);
    onSubmit({
      caption: caption.trim(),
      mediaUrl: mediaUrl.trim() || null,
      mediaType,
      taggedRecord: tag,
    });
    onClose();
  };

  const selectRecord = (r) => {
    setTaggedRecord({ album: r.album, artist: r.artist });
    setShowTagSearch(false);
    setTagSearch("");
  };

  const confirmCustomTag = () => {
    if (customAlbum.trim()) {
      setTaggedRecord({ album: customAlbum.trim(), artist: customArtist.trim() || "Unknown Artist" });
      setShowCustomTag(false);
      setShowTagSearch(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 18, width: 540, maxWidth: "94vw", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.85)" }}>
        {/* Gradient bar */}
        <div style={{ height: 3, background: "linear-gradient(90deg,#0ea5e9,#6366f1)" }} />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #1a1a1a" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f5" }}>Create Post</span>
          <button onClick={onClose} style={{ background: "#1a1a1a", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", color: "#888", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: 20 }}>
          {/* User header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Avatar username={currentUser} size={36} src={profile?.avatarUrl} />
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>@{currentUser}</div>
          </div>

          {/* Caption */}
          <textarea
            ref={captionRef}
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="What's spinning? Share what you're listening to..."
            rows={4}
            style={{
              width: "100%", background: "#111", border: "1px solid #1e1e1e", borderRadius: 12,
              padding: "14px 16px", color: "#e0e0e0", fontSize: 14, lineHeight: 1.6,
              resize: "vertical", outline: "none", fontFamily: "'DM Sans',sans-serif",
              minHeight: 100,
            }}
            onFocus={e => e.target.style.borderColor = "#0ea5e933"}
            onBlur={e => e.target.style.borderColor = "#1e1e1e"}
          />

          {/* Tagged record preview */}
          {taggedRecord && (
            <div style={{ marginTop: 12, background: "#0ea5e908", border: "1px solid #0ea5e922", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <AlbumArt album={taggedRecord.album} artist={taggedRecord.artist} accent="#0ea5e9" size={38} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5" }}>{taggedRecord.album}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{taggedRecord.artist}</div>
              </div>
              <button
                onClick={() => setTaggedRecord(null)}
                style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, width: 24, height: 24, cursor: "pointer", color: "#666", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ×
              </button>
            </div>
          )}

          {/* Media URL preview */}
          {showMediaInput && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {["image", "video"].map(t => (
                  <button
                    key={t}
                    onClick={() => setMediaType(t)}
                    style={{
                      padding: "5px 14px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      background: mediaType === t ? "#0ea5e918" : "#111",
                      border: `1px solid ${mediaType === t ? "#0ea5e944" : "#1e1e1e"}`,
                      color: mediaType === t ? "#0ea5e9" : "#666",
                      textTransform: "capitalize",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
                placeholder={`Paste ${mediaType} URL...`}
                style={{ width: "100%", background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", color: "#ccc", fontSize: 12, outline: "none" }}
                onFocus={e => e.target.style.borderColor = "#0ea5e933"}
                onBlur={e => e.target.style.borderColor = "#1e1e1e"}
              />
            </div>
          )}

          {/* Tag record search */}
          {showTagSearch && !taggedRecord && (
            <div style={{ marginTop: 12 }}>
              <input
                ref={searchRef}
                value={tagSearch}
                onChange={e => setTagSearch(e.target.value)}
                placeholder="Search for a record to tag..."
                style={{ width: "100%", background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", color: "#ccc", fontSize: 12, outline: "none", marginBottom: 8 }}
                onFocus={e => e.target.style.borderColor = "#0ea5e933"}
                onBlur={e => e.target.style.borderColor = "#1e1e1e"}
              />

              {/* Search results */}
              {searchResults.length > 0 && (
                <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
                  {searchResults.map(r => (
                    <div
                      key={r.id}
                      onClick={() => selectRecord(r)}
                      style={{ padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", cursor: "pointer", borderBottom: "1px solid #1a1a1a", transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#1a1a1a"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={28} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#f5f5f5" }}>{r.album}</div>
                        <div style={{ fontSize: 10, color: "#666" }}>{r.artist}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom tag option */}
              {!showCustomTag ? (
                <button
                  onClick={() => setShowCustomTag(true)}
                  style={{ background: "none", border: "none", color: "#0ea5e9", fontSize: 12, cursor: "pointer", padding: 0, fontWeight: 600 }}
                >
                  + Tag a record not on the platform
                </button>
              ) : (
                <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 8, fontWeight: 600 }}>Tag a custom record</div>
                  <input
                    value={customAlbum}
                    onChange={e => setCustomAlbum(e.target.value)}
                    placeholder="Album title"
                    style={{ width: "100%", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, padding: "8px 12px", color: "#ccc", fontSize: 12, outline: "none", marginBottom: 6 }}
                  />
                  <input
                    value={customArtist}
                    onChange={e => setCustomArtist(e.target.value)}
                    placeholder="Artist"
                    style={{ width: "100%", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, padding: "8px 12px", color: "#ccc", fontSize: 12, outline: "none", marginBottom: 8 }}
                  />
                  <button
                    onClick={confirmCustomTag}
                    disabled={!customAlbum.trim()}
                    style={{ padding: "7px 16px", background: customAlbum.trim() ? "#0ea5e9" : "#1a1a1a", border: "none", borderRadius: 7, color: customAlbum.trim() ? "#fff" : "#555", fontWeight: 700, fontSize: 11, cursor: customAlbum.trim() ? "pointer" : "default" }}
                  >
                    Add Tag
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action buttons row */}
          <div style={{ display: "flex", gap: 8, marginTop: 16, borderTop: "1px solid #1a1a1a", paddingTop: 14 }}>
            <button
              onClick={() => { setShowMediaInput(s => !s); }}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                background: showMediaInput ? "#0ea5e912" : "#111",
                border: `1px solid ${showMediaInput ? "#0ea5e933" : "#1e1e1e"}`,
                borderRadius: 8, color: showMediaInput ? "#0ea5e9" : "#666", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
              </svg>
              Media
            </button>
            <button
              onClick={() => {
                if (!taggedRecord) {
                  setShowTagSearch(s => !s);
                  setTimeout(() => searchRef.current?.focus(), 50);
                }
              }}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                background: (showTagSearch || taggedRecord) ? "#f59e0b12" : "#111",
                border: `1px solid ${(showTagSearch || taggedRecord) ? "#f59e0b33" : "#1e1e1e"}`,
                borderRadius: 8, color: (showTagSearch || taggedRecord) ? "#f59e0b" : "#666", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
              </svg>
              Tag Record
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#333" }}>
            {caption.length > 0 && `${caption.length} characters`}
          </span>
          <button
            onClick={handlePost}
            disabled={!canPost}
            style={{
              padding: "10px 28px", borderRadius: 10,
              background: canPost ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "#1a1a1a",
              border: "none", color: canPost ? "#fff" : "#555",
              fontWeight: 700, fontSize: 13, cursor: canPost ? "pointer" : "default",
              transition: "opacity 0.15s",
            }}
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
