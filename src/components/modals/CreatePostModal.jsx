// Modal for creating a new social post — opened from the compose prompt in SocialFeedScreen.
// Users can write a caption, optionally add an image/video URL, and tag any record (existing or custom).
// Record search autocompletes against the full record catalog; users can also tag records not yet on the platform.
import { useState, useRef, useEffect, useCallback } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';

// #34 — Common hashtags for auto-complete
const COMMON_HASHTAGS = [
  'vinylcommunity', 'nowspinning', 'vinyl', 'vinylcollection', 'recordcollection',
  'vinylrecords', 'vinyladdict', 'vinyloftheday', 'cratedigger', 'vintagvinyl',
  'hifi', 'turntable', 'audiophile', 'waxonly', 'vinylgram', 'musiclover',
  'jazz', 'hiphop', 'rock', 'soul', 'funk', 'electronic', 'classical', 'indie',
];

// #35 — Simulated user list for @mentions
const MENTION_USERS = [
  'vinyl.mike', 'sarah.spins', 'crate.digger', 'lo.fi.queen', 'jazz.hands',
  'beat.collector', 'wax.poetic', 'groove.master', 'needle.drop', 'deep.cuts',
];

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // #33 — Image upload support
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // #34 — Hashtag auto-complete
  const [hashtagSuggestions, setHashtagSuggestions] = useState([]);
  const [hashtagPos, setHashtagPos] = useState(null);

  // #35 — @mention auto-complete
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionPos, setMentionPos] = useState(null);

  // #36 — Post preview
  const [showPreview, setShowPreview] = useState(false);

  // #37 — Draft save
  const [draftSaved, setDraftSaved] = useState(false);

  const captionRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (open) {
      // #37 — Restore draft if available
      const saved = localStorage.getItem('gs_post_draft');
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          setCaption(draft.caption || "");
          setMediaUrl(draft.mediaUrl || "");
          setDraftSaved(true);
        } catch { /* ignore */ }
      } else {
        setCaption("");
        setMediaUrl("");
      }
      setMediaType("image");
      setShowTagSearch(false); setTagSearch(""); setTaggedRecord(null);
      setShowCustomTag(false); setCustomAlbum(""); setCustomArtist("");
      setShowMediaInput(false);
      setIsSubmitting(false);
      setUploadedImage(null); setUploadedImagePreview(null);
      setShowPreview(false);
      setHashtagSuggestions([]); setMentionSuggestions([]);
      setTimeout(() => captionRef.current?.focus(), 100);
    }
  }, [open]);

  // #37 — Auto-save draft
  const saveDraft = useCallback(() => {
    if (caption.trim() || mediaUrl.trim()) {
      localStorage.setItem('gs_post_draft', JSON.stringify({ caption, mediaUrl }));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 1500);
    }
  }, [caption, mediaUrl]);

  const clearDraft = () => {
    localStorage.removeItem('gs_post_draft');
  };

  if (!open) return null;

  // De-duplicate records by album+artist for search results
  const uniqueRecords = [...new Map(records.map(r => [`${r.album.toLowerCase()}|${r.artist.toLowerCase()}`, r])).values()];

  const searchResults = tagSearch.trim()
    ? uniqueRecords
        .filter(r => r.album.toLowerCase().includes(tagSearch.toLowerCase()) || r.artist.toLowerCase().includes(tagSearch.toLowerCase()))
        .slice(0, 6)
    : [];

  const canPost = caption.trim().length > 0;

  // #34 — Hashtag detection and auto-complete
  const handleCaptionChange = (e) => {
    const val = e.target.value;
    setCaption(val);

    // Detect hashtag being typed
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const hashMatch = textBefore.match(/#(\w*)$/);
    if (hashMatch) {
      const query = hashMatch[1].toLowerCase();
      setHashtagPos(cursorPos - hashMatch[0].length);
      setHashtagSuggestions(
        query.length > 0
          ? COMMON_HASHTAGS.filter(h => h.startsWith(query)).slice(0, 5)
          : COMMON_HASHTAGS.slice(0, 5)
      );
      setMentionSuggestions([]);
      return;
    }

    // #35 — Detect @mention being typed
    const mentionMatch = textBefore.match(/@([\w.]*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      setMentionPos(cursorPos - mentionMatch[0].length);
      setMentionSuggestions(
        query.length > 0
          ? MENTION_USERS.filter(u => u.includes(query)).slice(0, 5)
          : MENTION_USERS.slice(0, 5)
      );
      setHashtagSuggestions([]);
      return;
    }

    setHashtagSuggestions([]);
    setMentionSuggestions([]);
  };

  // #34 — Insert hashtag
  const insertHashtag = (tag) => {
    if (hashtagPos === null) return;
    const before = caption.slice(0, hashtagPos);
    const afterMatch = caption.slice(hashtagPos).match(/^#\w*/);
    const after = afterMatch ? caption.slice(hashtagPos + afterMatch[0].length) : caption.slice(hashtagPos);
    setCaption(`${before}#${tag} ${after}`);
    setHashtagSuggestions([]);
    setHashtagPos(null);
    captionRef.current?.focus();
  };

  // #35 — Insert mention
  const insertMention = (user) => {
    if (mentionPos === null) return;
    const before = caption.slice(0, mentionPos);
    const afterMatch = caption.slice(mentionPos).match(/^@[\w.]*/);
    const after = afterMatch ? caption.slice(mentionPos + afterMatch[0].length) : caption.slice(mentionPos);
    setCaption(`${before}@${user} ${after}`);
    setMentionSuggestions([]);
    setMentionPos(null);
    captionRef.current?.focus();
  };

  // #33 — Image upload handler
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }
    setUploadedImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadedImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handlePost = () => {
    if (!canPost || isSubmitting) return;
    setIsSubmitting(true);
    const tag = taggedRecord || (showCustomTag && customAlbum.trim() ? { album: customAlbum.trim(), artist: customArtist.trim() || "Unknown Artist" } : null);
    onSubmit({
      caption: caption.trim(),
      mediaUrl: mediaUrl.trim() || null,
      mediaType,
      taggedRecord: tag,
      uploadedImage: uploadedImage || null,
    });
    clearDraft();
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
      className="gs-overlay fixed inset-0 flex items-center justify-center z-[1000] backdrop-blur-[6px]"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gs-surface border border-gs-border rounded-[18px] w-[540px] max-w-[94vw] max-h-[88vh] overflow-hidden flex flex-col shadow-[0_32px_80px_rgba(0,0,0,0.85)]">
        {/* Gradient bar */}
        <div className="h-[3px] bg-gradient-to-r from-gs-accent to-gs-indigo" />

        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-[#1a1a1a]">
          <span className="text-[15px] font-bold text-gs-text">Create Post</span>
          <div className="flex items-center gap-2">
            {/* #37 — Save draft button */}
            <button
              onClick={saveDraft}
              className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer font-semibold"
            >
              {draftSaved ? 'Draft saved' : 'Save draft'}
            </button>
            {/* #36 — Preview toggle */}
            <button
              onClick={() => setShowPreview(p => !p)}
              className={`text-[10px] font-semibold cursor-pointer bg-transparent border-none transition-colors ${
                showPreview ? 'text-gs-accent' : 'text-gs-dim hover:text-gs-muted'
              }`}
            >
              Preview
            </button>
            <button onClick={onClose} className="bg-[#1a1a1a] border-none rounded-md w-7 h-7 cursor-pointer text-gs-muted text-lg flex items-center justify-center">x</button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {/* #36 — Post preview mode */}
          {showPreview ? (
            <div className="bg-[#111] border border-gs-border rounded-xl p-4 mb-4">
              <div className="text-[10px] text-gs-faint font-mono tracking-wider mb-3">POST PREVIEW</div>
              <div className="flex items-center gap-2.5 mb-3">
                <Avatar username={currentUser} size={32} src={profile?.avatarUrl} />
                <div>
                  <div className="text-xs font-semibold text-gs-text">@{currentUser}</div>
                  <div className="text-[10px] text-gs-faint">just now</div>
                </div>
              </div>
              <p className="text-[13px] text-[#ccc] leading-[1.6] whitespace-pre-wrap mb-3">
                {caption || <span className="text-gs-dim italic">No caption yet...</span>}
              </p>
              {uploadedImagePreview && (
                <img src={uploadedImagePreview} alt="Upload" className="w-full max-h-[200px] object-cover rounded-lg mb-3" />
              )}
              {mediaUrl && !uploadedImagePreview && (
                <div className="bg-[#0a0a0a] border border-gs-border rounded-lg p-3 mb-3 text-[11px] text-gs-dim break-all">
                  {mediaUrl}
                </div>
              )}
              {taggedRecord && (
                <div className="bg-gs-accent/[0.03] border border-gs-accent/[0.13] rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlbumArt album={taggedRecord.album} artist={taggedRecord.artist} accent="#0ea5e9" size={28} />
                  <div>
                    <div className="text-xs font-bold text-gs-text">{taggedRecord.album}</div>
                    <div className="text-[10px] text-gs-muted">{taggedRecord.artist}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* User header */}
              <div className="flex items-center gap-2.5 mb-4">
                <Avatar username={currentUser} size={36} src={profile?.avatarUrl} />
                <div className="text-[13px] font-semibold text-[#e0e0e0]">@{currentUser}</div>
              </div>

              {/* Caption with auto-complete */}
              <div className="relative">
                <textarea
                  ref={captionRef}
                  value={caption}
                  onChange={handleCaptionChange}
                  placeholder="What's spinning? Share what you're listening to..."
                  rows={4}
                  maxLength={500}
                  className="w-full bg-[#111] border border-gs-border rounded-xl px-4 py-3.5 text-[#e0e0e0] text-sm leading-[1.6] resize-y outline-none font-sans min-h-[100px] focus:border-gs-accent/20"
                />

                {/* #34 — Hashtag suggestions dropdown */}
                {hashtagSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-gs-surface border border-gs-border rounded-lg shadow-xl z-20 py-1 animate-fade-in">
                    {hashtagSuggestions.map(tag => (
                      <button
                        key={tag}
                        onClick={() => insertHashtag(tag)}
                        className="w-full text-left px-3.5 py-2 text-xs text-gs-muted bg-transparent border-none cursor-pointer hover:bg-[#1a1a1a] transition-colors flex items-center gap-2"
                      >
                        <span className="text-gs-accent">#</span>{tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* #35 — Mention suggestions dropdown */}
                {mentionSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-gs-surface border border-gs-border rounded-lg shadow-xl z-20 py-1 animate-fade-in">
                    {mentionSuggestions.map(user => (
                      <button
                        key={user}
                        onClick={() => insertMention(user)}
                        className="w-full text-left px-3.5 py-2 text-xs text-gs-muted bg-transparent border-none cursor-pointer hover:bg-[#1a1a1a] transition-colors flex items-center gap-2"
                      >
                        <span className="text-gs-accent">@</span>{user}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-gs-faint text-right mt-1">{caption.length}/500</div>

              {/* #33 — Uploaded image preview */}
              {uploadedImagePreview && (
                <div className="mt-3 relative">
                  <img src={uploadedImagePreview} alt="Upload preview" className="w-full max-h-[200px] object-cover rounded-xl border border-gs-border" />
                  <button
                    onClick={() => { setUploadedImage(null); setUploadedImagePreview(null); }}
                    className="absolute top-2 right-2 bg-black/70 border-none rounded-full w-6 h-6 cursor-pointer text-white text-sm flex items-center justify-center hover:bg-black/90"
                  >
                    x
                  </button>
                </div>
              )}

              {/* Tagged record preview */}
              {taggedRecord && (
                <div className="mt-3 bg-gs-accent/[0.03] border border-gs-accent/[0.13] rounded-xl px-3.5 py-3 flex items-center gap-3">
                  <AlbumArt album={taggedRecord.album} artist={taggedRecord.artist} accent="#0ea5e9" size={38} />
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-gs-text">{taggedRecord.album}</div>
                    <div className="text-[11px] text-gs-muted">{taggedRecord.artist}</div>
                  </div>
                  <button
                    onClick={() => setTaggedRecord(null)}
                    className="bg-[#1a1a1a] border border-gs-border-hover rounded-md w-6 h-6 cursor-pointer text-[#666] text-sm flex items-center justify-center"
                  >
                    x
                  </button>
                </div>
              )}

              {/* Media URL preview */}
              {showMediaInput && (
                <div className="mt-3">
                  <div className="flex gap-2 mb-2">
                    {["image", "video"].map(t => (
                      <button
                        key={t}
                        onClick={() => setMediaType(t)}
                        className={`px-3.5 py-[5px] rounded-[7px] text-[11px] font-semibold cursor-pointer capitalize ${
                          mediaType === t
                            ? 'bg-gs-accent/10 border border-gs-accent/25 text-gs-accent'
                            : 'bg-[#111] border border-gs-border text-[#666]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <input
                    value={mediaUrl}
                    onChange={e => setMediaUrl(e.target.value)}
                    placeholder={`Paste ${mediaType} URL...`}
                    className="w-full bg-[#111] border border-gs-border rounded-[10px] px-3.5 py-2.5 text-[#ccc] text-xs outline-none focus:border-gs-accent/20"
                  />
                </div>
              )}

              {/* Tag record search */}
              {showTagSearch && !taggedRecord && (
                <div className="mt-3">
                  <input
                    ref={searchRef}
                    value={tagSearch}
                    onChange={e => setTagSearch(e.target.value)}
                    placeholder="Search for a record to tag..."
                    className="w-full bg-[#111] border border-gs-border rounded-[10px] px-3.5 py-2.5 text-[#ccc] text-xs outline-none mb-2 focus:border-gs-accent/20"
                  />

                  {/* Search results */}
                  {searchResults.length > 0 && (
                    <div className="bg-[#111] border border-gs-border rounded-[10px] overflow-hidden mb-2">
                      {searchResults.map(r => (
                        <div
                          key={r.id}
                          onClick={() => selectRecord(r)}
                          className="px-3.5 py-2.5 flex gap-2.5 items-center cursor-pointer border-b border-[#1a1a1a] transition-colors duration-100 hover:bg-[#1a1a1a]"
                        >
                          <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={28} />
                          <div>
                            <div className="text-xs font-semibold text-gs-text">{r.album}</div>
                            <div className="text-[10px] text-[#666]">{r.artist}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Custom tag option */}
                  {!showCustomTag ? (
                    <button
                      onClick={() => setShowCustomTag(true)}
                      className="bg-transparent border-none text-gs-accent text-xs cursor-pointer p-0 font-semibold"
                    >
                      + Tag a record not on the platform
                    </button>
                  ) : (
                    <div className="bg-[#111] border border-gs-border rounded-[10px] p-3.5">
                      <div className="text-[11px] text-[#666] mb-2 font-semibold">Tag a custom record</div>
                      <input
                        value={customAlbum}
                        onChange={e => setCustomAlbum(e.target.value)}
                        placeholder="Album title"
                        className="w-full bg-gs-surface border border-gs-border rounded-lg px-3 py-2 text-[#ccc] text-xs outline-none mb-1.5"
                      />
                      <input
                        value={customArtist}
                        onChange={e => setCustomArtist(e.target.value)}
                        placeholder="Artist"
                        className="w-full bg-gs-surface border border-gs-border rounded-lg px-3 py-2 text-[#ccc] text-xs outline-none mb-2"
                      />
                      <button
                        onClick={confirmCustomTag}
                        disabled={!customAlbum.trim()}
                        className={`px-4 py-[7px] border-none rounded-[7px] font-bold text-[11px] ${
                          customAlbum.trim()
                            ? 'bg-gs-accent text-white cursor-pointer'
                            : 'bg-[#1a1a1a] text-gs-dim cursor-default'
                        }`}
                      >
                        Add Tag
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons row */}
              <div className="flex gap-2 mt-4 border-t border-[#1a1a1a] pt-3.5">
                {/* #33 — Image upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg text-[11px] font-semibold cursor-pointer ${
                    uploadedImage
                      ? 'bg-emerald-500/[0.07] border border-emerald-500/20 text-emerald-400'
                      : 'bg-[#111] border border-gs-border text-[#666]'
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                <button
                  onClick={() => { setShowMediaInput(s => !s); }}
                  className={`flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg text-[11px] font-semibold cursor-pointer ${
                    showMediaInput
                      ? 'bg-gs-accent/[0.07] border border-gs-accent/20 text-gs-accent'
                      : 'bg-[#111] border border-gs-border text-[#666]'
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                  </svg>
                  Media URL
                </button>
                <button
                  onClick={() => {
                    if (!taggedRecord) {
                      setShowTagSearch(s => !s);
                      setTimeout(() => searchRef.current?.focus(), 50);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg text-[11px] font-semibold cursor-pointer ${
                    (showTagSearch || taggedRecord)
                      ? 'bg-[#f59e0b]/[0.07] border border-[#f59e0b]/20 text-[#f59e0b]'
                      : 'bg-[#111] border border-gs-border text-[#666]'
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                  </svg>
                  Tag Record
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#1a1a1a] flex justify-between items-center">
          <span className="text-[11px] text-gs-subtle">
            {caption.length > 0 && `${caption.length} characters`}
          </span>
          <div className="flex items-center gap-2">
            {/* #37 — Draft indicator */}
            {draftSaved && (
              <span className="text-[10px] text-emerald-400 animate-fade-in">Draft saved</span>
            )}
            <button
              onClick={handlePost}
              disabled={!canPost || isSubmitting}
              className={`px-7 py-2.5 rounded-[10px] border-none font-bold text-[13px] transition-opacity duration-150 ${
                canPost && !isSubmitting
                  ? 'gs-btn-gradient text-white cursor-pointer'
                  : 'bg-[#1a1a1a] text-gs-dim cursor-default'
              }`}
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
