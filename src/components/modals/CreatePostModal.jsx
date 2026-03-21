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

// Improvement 22 (new): Poll option templates
const POLL_TEMPLATES = [
  { label: "Best Album", options: ["Option A", "Option B", "Option C"] },
  { label: "Genre Vote", options: ["Jazz", "Rock", "Hip-Hop", "Electronic"] },
  { label: "Yes/No", options: ["Yes", "No"] },
];

// Improvement 23 (new): Recommendation categories
const REC_CATEGORIES = [
  { label: "Must-Own Pressing", icon: "\uD83C\uDFC6" },
  { label: "Hidden Gem", icon: "\uD83D\uDC8E" },
  { label: "Perfect for Beginners", icon: "\uD83C\uDF31" },
  { label: "Audiophile Grade", icon: "\uD83C\uDFA7" },
  { label: "Underrated Classic", icon: "\u2B50" },
];

// Improvement 24 (new): Milestone types
const MILESTONE_TYPES = [
  { label: "100 Records", threshold: 100, icon: "\uD83D\uDCBF" },
  { label: "250 Records", threshold: 250, icon: "\uD83C\uDFC5" },
  { label: "500 Records", threshold: 500, icon: "\uD83C\uDFC6" },
  { label: "1000 Records", threshold: 1000, icon: "\uD83D\uDC51" },
  { label: "First Rare Find", threshold: 0, icon: "\uD83D\uDC8E" },
  { label: "Genre Milestone", threshold: 0, icon: "\uD83C\uDFB5" },
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

  // Improvement 22 (new): Poll creation
  const [pollMode, setPollMode] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollDuration, setPollDuration] = useState("24");

  // Improvement 23 (new): Record recommendation post
  const [recMode, setRecMode] = useState(false);
  const [recCategory, setRecCategory] = useState(null);
  const [recRating, setRecRating] = useState(0);

  // Improvement 24 (new): Collection milestone auto-post
  const [milestoneMode, setMilestoneMode] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState(null);

  // Improvement 25 (new): Collaboration post
  const [collabMode, setCollabMode] = useState(false);
  const [collabUser, setCollabUser] = useState("");
  const [collabSearch, setCollabSearch] = useState("");

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
      setPollMode(false); setPollQuestion(""); setPollOptions(["", ""]); setPollDuration("24");
      setRecMode(false); setRecCategory(null); setRecRating(0);
      setMilestoneMode(false); setSelectedMilestone(null);
      setCollabMode(false); setCollabUser(""); setCollabSearch("");
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

  // Improvement 25: Filter collab user suggestions
  const collabResults = collabSearch.trim()
    ? MENTION_USERS.filter(u => u.includes(collabSearch.toLowerCase())).slice(0, 5)
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

  // Improvement 22: Add/remove poll options
  const addPollOption = () => {
    if (pollOptions.length < 6) setPollOptions([...pollOptions, ""]);
  };
  const removePollOption = (index) => {
    if (pollOptions.length > 2) setPollOptions(pollOptions.filter((_, i) => i !== index));
  };
  const updatePollOption = (index, value) => {
    setPollOptions(pollOptions.map((opt, i) => i === index ? value : opt));
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
      // Improvement 22: Poll data
      poll: pollMode ? {
        question: pollQuestion.trim(),
        options: pollOptions.filter(o => o.trim()),
        duration: parseInt(pollDuration),
      } : null,
      // Improvement 23: Recommendation data
      recommendation: recMode ? {
        category: recCategory,
        rating: recRating,
      } : null,
      // Improvement 24: Milestone data
      milestone: milestoneMode ? selectedMilestone : null,
      // Improvement 25: Collaboration data
      collaborator: collabMode ? collabUser : null,
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

  // Active post type for the mode selector
  const activePostType = pollMode ? "poll" : recMode ? "rec" : milestoneMode ? "milestone" : collabMode ? "collab" : "standard";

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

        {/* Post type selector (new) */}
        <div className="flex gap-1 px-5 pt-3 pb-1">
          {[
            { key: "standard", label: "Post", icon: "\u270D\uFE0F" },
            { key: "poll", label: "Poll", icon: "\uD83D\uDCCA" },
            { key: "rec", label: "Recommend", icon: "\u2B50" },
            { key: "milestone", label: "Milestone", icon: "\uD83C\uDFC6" },
            { key: "collab", label: "Collab", icon: "\uD83E\uDD1D" },
          ].map(type => (
            <button
              key={type.key}
              onClick={() => {
                setPollMode(type.key === "poll");
                setRecMode(type.key === "rec");
                setMilestoneMode(type.key === "milestone");
                setCollabMode(type.key === "collab");
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer border transition-colors ${
                activePostType === type.key
                  ? 'bg-gs-accent/10 border-gs-accent/30 text-gs-accent'
                  : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:text-gs-muted'
              }`}
            >
              <span>{type.icon}</span>
              {type.label}
            </button>
          ))}
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
                  <div className="text-xs font-semibold text-gs-text">
                    @{currentUser}
                    {collabMode && collabUser && <span className="text-gs-accent"> + @{collabUser}</span>}
                  </div>
                  <div className="text-[10px] text-gs-faint">just now</div>
                </div>
              </div>

              {/* Milestone badge in preview */}
              {milestoneMode && selectedMilestone && (
                <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3 py-2 mb-3 text-center">
                  <div className="text-2xl mb-1">{selectedMilestone.icon}</div>
                  <div className="text-[12px] text-amber-400 font-bold">{selectedMilestone.label}</div>
                  <div className="text-[10px] text-gs-dim">Collection Milestone</div>
                </div>
              )}

              {/* Recommendation badge in preview */}
              {recMode && recCategory && (
                <div className="bg-gs-accent/[0.05] border border-gs-accent/15 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                  <span className="text-lg">{recCategory.icon}</span>
                  <div>
                    <div className="text-[11px] text-gs-accent font-semibold">{recCategory.label}</div>
                    {recRating > 0 && (
                      <div className="text-[11px] text-amber-400">
                        {Array.from({ length: 5 }, (_, i) => i < recRating ? "\u2605" : "\u2606").join("")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <p className="text-[13px] text-[#ccc] leading-[1.6] whitespace-pre-wrap mb-3">
                {caption || <span className="text-gs-dim italic">No caption yet...</span>}
              </p>

              {/* Poll preview */}
              {pollMode && pollQuestion && (
                <div className="bg-[#0a0a0a] border border-gs-border rounded-lg p-3 mb-3">
                  <div className="text-[12px] font-bold text-gs-text mb-2">{pollQuestion}</div>
                  {pollOptions.filter(o => o.trim()).map((opt, i) => (
                    <div key={i} className="bg-[#1a1a1a] rounded-md px-3 py-2 mb-1.5 text-[12px] text-gs-muted border border-[#222] hover:border-gs-accent/30 cursor-pointer">
                      {opt}
                    </div>
                  ))}
                  <div className="text-[10px] text-gs-faint mt-1">{pollDuration}h remaining</div>
                </div>
              )}

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
                <div className="text-[13px] font-semibold text-[#e0e0e0]">
                  @{currentUser}
                  {/* Improvement 25: Collaborator indicator */}
                  {collabMode && collabUser && (
                    <span className="text-gs-accent"> + @{collabUser}</span>
                  )}
                </div>
              </div>

              {/* Improvement 25 (new): Collaboration user picker */}
              {collabMode && (
                <div className="mb-4 bg-purple-500/[0.04] border border-purple-500/15 rounded-xl p-3.5">
                  <div className="text-[10px] text-purple-400 font-mono mb-2">TAG A COLLABORATOR</div>
                  <input
                    value={collabSearch}
                    onChange={e => setCollabSearch(e.target.value)}
                    placeholder="Search for a user to collaborate with..."
                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-[12px] text-gs-text outline-none mb-2"
                  />
                  {collabResults.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {collabResults.map(user => (
                        <button
                          key={user}
                          onClick={() => { setCollabUser(user); setCollabSearch(""); }}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                            collabUser === user
                              ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                              : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:text-gs-muted'
                          }`}
                        >
                          @{user}
                        </button>
                      ))}
                    </div>
                  )}
                  {collabUser && (
                    <div className="flex items-center gap-2 text-[11px] text-purple-400">
                      <span>{"\uD83E\uDD1D"}</span>
                      <span>Collaborating with @{collabUser}</span>
                      <button onClick={() => setCollabUser("")} className="text-gs-faint bg-transparent border-none cursor-pointer hover:text-gs-muted text-[10px] ml-auto">Remove</button>
                    </div>
                  )}
                </div>
              )}

              {/* Improvement 24 (new): Collection milestone selector */}
              {milestoneMode && (
                <div className="mb-4 bg-amber-500/[0.04] border border-amber-500/15 rounded-xl p-3.5">
                  <div className="text-[10px] text-amber-400 font-mono mb-2">SELECT A MILESTONE</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MILESTONE_TYPES.map(milestone => (
                      <button
                        key={milestone.label}
                        onClick={() => setSelectedMilestone(milestone)}
                        className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedMilestone?.label === milestone.label
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:text-gs-muted'
                        }`}
                      >
                        <span className="text-lg">{milestone.icon}</span>
                        <span className="text-[10px] font-semibold text-center">{milestone.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Improvement 23 (new): Record recommendation section */}
              {recMode && (
                <div className="mb-4 bg-gs-accent/[0.03] border border-gs-accent/15 rounded-xl p-3.5">
                  <div className="text-[10px] text-gs-accent font-mono mb-2">RECOMMENDATION TYPE</div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {REC_CATEGORIES.map(cat => (
                      <button
                        key={cat.label}
                        onClick={() => setRecCategory(cat)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold cursor-pointer transition-colors ${
                          recCategory?.label === cat.label
                            ? 'bg-gs-accent/10 border-gs-accent/30 text-gs-accent'
                            : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:text-gs-muted'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-gs-dim font-mono mb-1.5">RATING</div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => setRecRating(star === recRating ? 0 : star)}
                        className={`text-lg cursor-pointer bg-transparent border-none p-0 transition-transform hover:scale-110 ${
                          star <= recRating ? 'text-amber-400' : 'text-[#333]'
                        }`}
                      >
                        {star <= recRating ? "\u2605" : "\u2606"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Improvement 22 (new): Poll creation */}
              {pollMode && (
                <div className="mb-4 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] text-gs-dim font-mono">CREATE A POLL</div>
                    <div className="flex gap-1">
                      {POLL_TEMPLATES.map(tpl => (
                        <button
                          key={tpl.label}
                          onClick={() => { setPollQuestion(tpl.label + "?"); setPollOptions([...tpl.options]); }}
                          className="text-[9px] text-gs-faint bg-transparent border border-[#222] rounded px-1.5 py-0.5 cursor-pointer hover:text-gs-muted"
                        >
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    value={pollQuestion}
                    onChange={e => setPollQuestion(e.target.value)}
                    placeholder="Ask a question..."
                    className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-[12px] text-gs-text outline-none mb-2"
                  />
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex gap-1.5 mb-1.5">
                      <input
                        value={opt}
                        onChange={e => updatePollOption(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-[12px] text-gs-text outline-none"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          onClick={() => removePollOption(i)}
                          className="bg-[#111] border border-[#222] rounded-md w-7 h-7 text-gs-faint cursor-pointer text-sm flex items-center justify-center hover:text-red-400"
                        >
                          x
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between mt-2">
                    <button
                      onClick={addPollOption}
                      disabled={pollOptions.length >= 6}
                      className={`text-[11px] font-semibold bg-transparent border-none cursor-pointer p-0 ${
                        pollOptions.length >= 6 ? 'text-gs-faint cursor-default' : 'text-gs-accent'
                      }`}
                    >
                      + Add option {pollOptions.length >= 6 && "(max 6)"}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gs-dim">Duration:</span>
                      <select
                        value={pollDuration}
                        onChange={e => setPollDuration(e.target.value)}
                        className="bg-[#111] border border-[#222] rounded-md px-2 py-1 text-[11px] text-gs-text outline-none cursor-pointer"
                      >
                        <option value="1">1 hour</option>
                        <option value="6">6 hours</option>
                        <option value="24">24 hours</option>
                        <option value="72">3 days</option>
                        <option value="168">7 days</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* [Improvement #26] AI Caption Suggestions */}
              <div className="mb-3">
                <button
                  onClick={() => {
                    const suggestions = [
                      `Just added this gem to the rotation ${taggedRecord ? `-- "${taggedRecord.album}" by ${taggedRecord.artist}` : ''}. The sound quality is incredible! #nowspinning #vinyl`,
                      `There's nothing like the warmth of vinyl on a ${new Date().toLocaleDateString('en-US', { weekday: 'long' })} evening. What are you spinning tonight? #vinylcommunity`,
                      `Another day, another crate dig. Found some absolute treasures today! Who else is out hunting this weekend? #cratedigger #vinylrecords`,
                      `The pressing quality on this one is next level. Every pop and crackle tells a story. #audiophile #hifi #vinyloftheday`,
                    ];
                    setCaption(suggestions[Math.floor(Math.random() * suggestions.length)]);
                  }}
                  className="w-full py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-300 text-[11px] font-semibold cursor-pointer hover:bg-purple-500/15 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>{'\u2728'}</span> AI Suggest Caption
                </button>
              </div>

              {/* [Improvement #27] Post Performance Prediction */}
              {caption.trim().length > 10 && (
                <div className="mb-3 px-3 py-2 bg-[#111] rounded-lg border border-[#1a1a1a]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gs-dim font-mono">PREDICTED PERFORMANCE</span>
                  </div>
                  {(() => {
                    let score = 20;
                    if (caption.length > 50) score += 15;
                    if (caption.length > 100) score += 10;
                    if (caption.includes('#')) score += 15;
                    if (caption.includes('@')) score += 10;
                    if (taggedRecord) score += 15;
                    if (uploadedImage) score += 15;
                    if (pollMode) score += 10;
                    if (recMode) score += 5;
                    score = Math.min(score, 99);
                    const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${score}%`, backgroundColor: color }} />
                          </div>
                          <span className="text-[10px] font-bold" style={{ color }}>{score}%</span>
                        </div>
                        <div className="flex gap-2 mt-1.5 text-[9px] text-gs-faint">
                          {!caption.includes('#') && <span>+ Add hashtags</span>}
                          {!taggedRecord && <span>+ Tag a record</span>}
                          {!uploadedImage && <span>+ Add image</span>}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* [Improvement #28] Audience Targeting Options */}
              <div className="mb-3">
                <div className="text-[10px] text-gs-dim font-mono mb-1.5">AUDIENCE</div>
                <div className="flex gap-1.5">
                  {[
                    { label: 'Everyone', icon: '\uD83C\uDF0D', desc: 'All users' },
                    { label: 'Followers', icon: '\uD83D\uDC65', desc: 'Your followers only' },
                    { label: 'Genre Fans', icon: '\uD83C\uDFB5', desc: 'Matching genre interests' },
                    { label: 'Local', icon: '\uD83D\uDCCD', desc: 'Nearby collectors' },
                  ].map((audience, i) => (
                    <button
                      key={audience.label}
                      className={`flex-1 py-1.5 px-1 rounded-lg border text-center cursor-pointer transition-colors ${
                        i === 0 ? 'bg-gs-accent/10 border-gs-accent/30 text-gs-accent' : 'bg-[#0d0d0d] border-[#1a1a1a] text-gs-dim hover:text-gs-muted'
                      }`}
                    >
                      <div className="text-sm">{audience.icon}</div>
                      <div className="text-[9px] font-semibold">{audience.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption with auto-complete */}
              <div className="relative">
                <textarea
                  ref={captionRef}
                  value={caption}
                  onChange={handleCaptionChange}
                  placeholder={
                    pollMode ? "Add context to your poll..."
                    : recMode ? "Why do you recommend this record?"
                    : milestoneMode ? "Share your milestone story..."
                    : collabMode ? "What are you collaborating on?"
                    : "What's spinning? Share what you're listening to..."
                  }
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
            {pollMode && pollOptions.filter(o => o.trim()).length > 0 && ` \u00b7 Poll: ${pollOptions.filter(o => o.trim()).length} options`}
            {recMode && recCategory && ` \u00b7 ${recCategory.label}`}
            {milestoneMode && selectedMilestone && ` \u00b7 ${selectedMilestone.icon} ${selectedMilestone.label}`}
            {collabMode && collabUser && ` \u00b7 with @${collabUser}`}
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
              {isSubmitting ? 'Posting...' : pollMode ? 'Post Poll' : recMode ? 'Post Rec' : milestoneMode ? 'Share Milestone' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
