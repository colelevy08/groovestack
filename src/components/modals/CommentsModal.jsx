// Modal for reading and posting comments on a specific record.
// Auto-scrolls to the newest comment whenever comments change or the modal opens.
// Submitting calls onAdd in App.js, which appends the comment to the record's comments array.
// Clicking a commenter's avatar or @handle closes the modal and opens their profile.
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';

const QUICK_EMOJIS = ["\uD83D\uDD25", "\u2764\uFE0F", "\uD83C\uDFB6", "\uD83D\uDCBF", "\uD83E\uDD18", "\uD83D\uDC4F", "\uD83D\uDE0D", "\uD83D\uDCAF"];

// Improvement 7: Character limit
const CHAR_LIMIT = 500;

// Improvement 2: Sort options
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "liked", label: "Most Liked" },
];

// Improvement 4: Simulated GIF results
const GIF_RESULTS = [
  { id: 1, label: "vinyl spin", url: "\uD83C\uDFB5" },
  { id: 2, label: "headbang", url: "\uD83C\uDFB8" },
  { id: 3, label: "dance", url: "\uD83D\uDC83" },
  { id: 4, label: "fire", url: "\uD83D\uDD25" },
  { id: 5, label: "applause", url: "\uD83D\uDC4F" },
  { id: 6, label: "mind blown", url: "\uD83E\uDD2F" },
];

// Improvement 17 (new): Sentiment emoji suggestions based on keywords
const SENTIMENT_MAP = [
  { keywords: ["love", "amazing", "beautiful", "perfect", "best", "incredible", "fantastic"], emojis: ["\u2764\uFE0F", "\uD83D\uDE0D", "\uD83D\uDCAF"] },
  { keywords: ["fire", "hot", "sick", "insane", "crazy", "wild"], emojis: ["\uD83D\uDD25", "\uD83E\uDD2F", "\uD83D\uDE31"] },
  { keywords: ["classic", "vintage", "old school", "legendary", "timeless"], emojis: ["\uD83D\uDCBF", "\uD83C\uDFB6", "\uD83D\uDC51"] },
  { keywords: ["sad", "miss", "cry", "emotional", "heartbreak"], emojis: ["\uD83D\uDE22", "\uD83D\uDC94", "\uD83E\uDD7A"] },
  { keywords: ["funny", "lol", "haha", "hilarious", "joke"], emojis: ["\uD83D\uDE02", "\uD83D\uDE06", "\uD83E\uDD23"] },
  { keywords: ["rock", "metal", "punk", "guitar", "riff"], emojis: ["\uD83E\uDD18", "\uD83C\uDFB8", "\uD83D\uDCA5"] },
  { keywords: ["jazz", "smooth", "chill", "mellow", "groove"], emojis: ["\uD83C\uDFB7", "\uD83C\uDFB6", "\uD83D\uDE0E"] },
];

// Improvement 3: Parse rich text (bold/italic) for display
function renderRichText(text) {
  // Handle **bold** and *italic* patterns
  const parts = [];
  let key = 0;
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    if (match[2]) {
      // bold
      parts.push(<strong key={key++} className="font-bold text-gs-text">{match[2]}</strong>);
    } else if (match[3]) {
      // italic
      parts.push(<em key={key++} className="italic">{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : text;
}

// Improvement 5: Highlight @mentions in comment text
function highlightMentions(content) {
  if (typeof content === 'string') {
    const mentionRegex = /(@\w+)/g;
    const parts = content.split(mentionRegex);
    return parts.map((part, i) => {
      if (mentionRegex.test(part)) {
        mentionRegex.lastIndex = 0;
        return <span key={i} className="text-gs-accent font-semibold cursor-pointer hover:underline">{part}</span>;
      }
      return part;
    });
  }
  // For rich text (array of elements), return as-is
  return content;
}

// Improvement 8: Initial visible count for load-more
const INITIAL_VISIBLE = 10;

export default function CommentsModal({ open, onClose, record, onAdd, currentUser, onViewUser }) {
  const [text, setText] = useState("");
  const [likedComments, setLikedComments] = useState({});
  // Improvement 1: Threaded replies
  const [replyTo, setReplyTo] = useState(null);
  // Improvement 2: Sort mode
  const [sortMode, setSortMode] = useState("newest");
  // Improvement 4: GIF picker
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  // Improvement 6: Edit/delete
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [deletedIds, setDeletedIds] = useState(new Set());
  // Improvement 7: Pin top comment
  const [pinnedCommentId, setPinnedCommentId] = useState(null);
  // Improvement 8: Load more
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  // Improvement 3: Formatting toolbar
  const [showFormatHelp, setShowFormatHelp] = useState(false);

  // Improvement 14 (new): Comment voting (upvote/downvote)
  const [votes, setVotes] = useState({}); // { [commentId]: { up: number, down: number, userVote: 'up'|'down'|null } }
  // Improvement 15 (new): Best comment highlight
  const [bestCommentId, setBestCommentId] = useState(null);
  // Improvement 16 (new): Translation placeholder
  const [translatingId, setTranslatingId] = useState(null);
  const [translatedTexts, setTranslatedTexts] = useState({});
  // Improvement 17 (new): Sentiment emoji auto-suggest
  const [suggestedEmojis, setSuggestedEmojis] = useState([]);

  // [Improvement #20] Comment appreciation badges
  const [appreciationBadges, setAppreciationBadges] = useState({}); // { [commentId]: badge }
  // [Improvement #21] Featured comment by record owner
  const [featuredCommentId, setFeaturedCommentId] = useState(null);
  // [Improvement #22] Comment moderation tools
  const [reportedComments, setReportedComments] = useState(new Set());
  const [mutedUsers, setMutedUsers] = useState(new Set());

  // endRef is attached to an invisible div at the bottom of the list; used for scroll-to-bottom
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to latest comment whenever the list grows or the modal opens
  useEffect(() => {
    if (open) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [record?.comments?.length, open]);

  // Reset visible count when modal opens
  useEffect(() => {
    if (open) setVisibleCount(INITIAL_VISIBLE);
  }, [open]);

  // Improvement 17: Auto-suggest emojis based on text sentiment
  useEffect(() => {
    if (!text.trim()) { setSuggestedEmojis([]); return; }
    const lower = text.toLowerCase();
    const matched = [];
    for (const sentiment of SENTIMENT_MAP) {
      if (sentiment.keywords.some(kw => lower.includes(kw))) {
        matched.push(...sentiment.emojis);
      }
    }
    setSuggestedEmojis([...new Set(matched)].slice(0, 4));
  }, [text]);

  // Improvement 2: Sorted and filtered comments
  const sortedComments = useMemo(() => {
    if (!record) return [];
    const comments = record.comments.filter(c => !deletedIds.has(c.id));
    const sorted = [...comments];
    if (sortMode === "newest") {
      sorted.reverse();
    } else if (sortMode === "liked") {
      sorted.sort((a, b) => {
        const aScore = (votes[a.id]?.up || 0) - (votes[a.id]?.down || 0);
        const bScore = (votes[b.id]?.up || 0) - (votes[b.id]?.down || 0);
        return bScore - aScore;
      });
    }
    // oldest is default order
    return sorted;
  }, [record, sortMode, deletedIds, votes]);

  // Improvement 7: Pinned comment
  const pinnedComment = useMemo(() => {
    if (!pinnedCommentId || !record) return null;
    return record.comments.find(c => c.id === pinnedCommentId) || null;
  }, [pinnedCommentId, record]);

  // Improvement 15 (new): Best comment detection (highest net votes)
  const bestComment = useMemo(() => {
    if (!record || record.comments.length < 3) return null;
    let best = null;
    let bestScore = 0;
    for (const c of record.comments) {
      const score = (votes[c.id]?.up || 0) - (votes[c.id]?.down || 0);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return bestScore >= 2 ? best : (bestCommentId ? record.comments.find(c => c.id === bestCommentId) : null);
  }, [record, votes, bestCommentId]);

  // Improvement 1: Get replies for a comment
  const getReplies = useCallback((commentId) => {
    if (!record) return [];
    return record.comments.filter(c => c.replyTo === commentId && !deletedIds.has(c.id));
  }, [record, deletedIds]);

  // Improvement 14 (new): Vote on a comment
  const handleVote = (commentId, direction) => {
    setVotes(prev => {
      const current = prev[commentId] || { up: 0, down: 0, userVote: null };
      if (current.userVote === direction) {
        // Undo vote
        return {
          ...prev,
          [commentId]: {
            up: direction === 'up' ? current.up - 1 : current.up,
            down: direction === 'down' ? current.down - 1 : current.down,
            userVote: null,
          },
        };
      }
      // Change or new vote
      let newUp = current.up;
      let newDown = current.down;
      if (current.userVote === 'up') newUp--;
      if (current.userVote === 'down') newDown--;
      if (direction === 'up') newUp++;
      if (direction === 'down') newDown++;
      return {
        ...prev,
        [commentId]: { up: newUp, down: newDown, userVote: direction },
      };
    });
  };

  // Improvement 16 (new): Simulate translation
  const handleTranslate = (commentId, text) => {
    setTranslatingId(commentId);
    // Simulate translation delay
    setTimeout(() => {
      setTranslatedTexts(prev => ({
        ...prev,
        [commentId]: `[Translated] ${text}`,
      }));
      setTranslatingId(null);
    }, 800);
  };

  // Build a new comment object with a timestamp-based id and post it via onAdd
  const submit = () => {
    if (!text.trim()) return;
    if (text.length > CHAR_LIMIT) return;
    const comment = {
      id: Date.now(),
      user: currentUser,
      text: text.trim(),
      time: "just now",
    };
    // Improvement 1: Attach reply reference
    if (replyTo) {
      comment.replyTo = replyTo;
    }
    onAdd(record.id, comment);
    setText("");
    setReplyTo(null);
    setSuggestedEmojis([]);
  };

  const toggleLike = (commentId) => {
    setLikedComments(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  // Improvement 6: Save edit
  const saveEdit = (commentId) => {
    if (!editText.trim()) return;
    // We simulate editing by using a local override — in a real app this would update state
    // For now, we just close the editor. The comment text is managed by parent state.
    setEditingId(null);
    setEditText("");
  };

  // Improvement 6: Delete comment (local only)
  const deleteComment = (commentId) => {
    setDeletedIds(prev => new Set([...prev, commentId]));
  };

  // Format relative time from comment time strings
  const formatTime = (time) => {
    if (!time || time === "just now") return "just now";
    return time;
  };

  // Improvement 4: Filtered GIF results
  const filteredGifs = useMemo(() => {
    if (!gifSearch.trim()) return GIF_RESULTS;
    return GIF_RESULTS.filter(g => g.label.toLowerCase().includes(gifSearch.toLowerCase()));
  }, [gifSearch]);

  if (!record) return null;

  // Improvement 8: Visible comments slice
  const visibleComments = sortedComments.slice(0, visibleCount);
  const hasMore = sortedComments.length > visibleCount;

  // Character count for limit display
  const charCount = text.length;
  const isOverLimit = charCount > CHAR_LIMIT;

  return (
    <Modal open={open} onClose={onClose} title={`Comments \u00b7 ${record.album}`} width="460px">
      {/* Improvement 2: Sort controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] text-gs-dim">{sortedComments.length} comment{sortedComments.length !== 1 ? 's' : ''}</div>
        <div className="flex gap-1">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSortMode(opt.value)}
              className={`text-[10px] px-2 py-1 rounded-md border-none cursor-pointer font-semibold ${
                sortMode === opt.value ? 'bg-gs-accent/15 text-gs-accent' : 'bg-[#111] text-gs-dim hover:text-gs-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[340px] overflow-y-auto mb-4">
        {/* Improvement 7: Pinned comment display */}
        {pinnedComment && (
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px]">{"\uD83D\uDCCC"}</span>
              <span className="text-[10px] text-gs-dim font-mono">PINNED COMMENT</span>
              <button
                onClick={() => setPinnedCommentId(null)}
                className="ml-auto text-[10px] text-gs-faint bg-transparent border-none cursor-pointer hover:text-gs-muted"
              >
                Unpin
              </button>
            </div>
            <div className="flex gap-2 items-start">
              <Avatar username={pinnedComment.user} size={24} />
              <div>
                <span className="text-[11px] font-bold text-gs-text">@{pinnedComment.user}</span>
                <p className="text-[12px] text-[#aaa] leading-normal mt-0.5">{highlightMentions(renderRichText(pinnedComment.text))}</p>
              </div>
            </div>
          </div>
        )}

        {/* [Improvement #21] Featured comment by record owner */}
        {featuredCommentId && (() => {
          const fc = record.comments.find(c => c.id === featuredCommentId);
          if (!fc || fc.id === pinnedCommentId) return null;
          return (
            <div className="bg-gs-accent/[0.04] border border-gs-accent/15 rounded-lg p-3 mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px]">{"\u{1F451}"}</span>
                <span className="text-[10px] text-gs-accent font-mono">FEATURED BY OWNER</span>
                <button
                  onClick={() => setFeaturedCommentId(null)}
                  className="ml-auto text-[10px] text-gs-faint bg-transparent border-none cursor-pointer hover:text-gs-muted"
                >
                  Remove
                </button>
              </div>
              <div className="flex gap-2 items-start">
                <Avatar username={fc.user} size={24} />
                <div>
                  <span className="text-[11px] font-bold text-gs-text">@{fc.user}</span>
                  {appreciationBadges[fc.id] && (
                    <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{appreciationBadges[fc.id]}</span>
                  )}
                  <p className="text-[12px] text-[#aaa] leading-normal mt-0.5">{highlightMentions(renderRichText(fc.text))}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* [Improvement #22] Comment moderation tools */}
        {record.user === currentUser && (
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-[10px] text-gs-dim font-mono">MODERATION</span>
            {mutedUsers.size > 0 && (
              <span className="text-[10px] text-amber-400">{mutedUsers.size} muted</span>
            )}
            {reportedComments.size > 0 && (
              <span className="text-[10px] text-red-400">{reportedComments.size} reported</span>
            )}
          </div>
        )}

        {/* Improvement 15 (new): Best comment highlight */}
        {bestComment && bestComment.id !== pinnedCommentId && (
          <div className="bg-amber-500/[0.04] border border-amber-500/15 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px]">{"\u2B50"}</span>
              <span className="text-[10px] text-amber-400 font-mono">BEST COMMENT</span>
            </div>
            <div className="flex gap-2 items-start">
              <Avatar username={bestComment.user} size={24} />
              <div>
                <span className="text-[11px] font-bold text-gs-text">@{bestComment.user}</span>
                <p className="text-[12px] text-[#aaa] leading-normal mt-0.5">{highlightMentions(renderRichText(bestComment.text))}</p>
                <div className="text-[10px] text-amber-400 mt-1">
                  {(votes[bestComment.id]?.up || 0)} upvotes
                </div>
              </div>
            </div>
          </div>
        )}

        {record.comments.length === 0 && (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">{"\uD83D\uDCAC"}</div>
            <div className="text-gs-muted text-[13px] font-semibold mb-1">No comments yet</div>
            <div className="text-gs-faint text-[12px]">Be the first to share your thoughts on this record!</div>
          </div>
        )}
        {visibleComments.map(c => {
          const isOwn = c.user === currentUser;
          const replies = getReplies(c.id);
          const isPinned = pinnedCommentId === c.id;
          const isBest = bestComment?.id === c.id;
          const commentVotes = votes[c.id] || { up: 0, down: 0, userVote: null };
          const netVotes = commentVotes.up - commentVotes.down;
          const hasTranslation = translatedTexts[c.id];
          const isTranslating = translatingId === c.id;

          return (
            <div key={c.id} className={`mb-4 ${isBest ? 'bg-amber-500/[0.02] rounded-lg p-1' : ''}`}>
              <div className="flex gap-2.5 group">
                <Avatar username={c.user} size={32} onClick={() => { onClose(); onViewUser(c.user); }} />
                <div className="flex-1">
                  <div className="flex gap-2 items-baseline mb-[3px]">
                    <button onClick={() => { onClose(); onViewUser(c.user); }} className="bg-transparent border-none cursor-pointer text-xs font-bold text-[#e0e0e0] p-0">@{c.user}</button>
                    <span className="text-[10px] text-gs-faint font-mono">{formatTime(c.time)}</span>
                    {/* Improvement 1: Reply indicator */}
                    {c.replyTo && (
                      <span className="text-[10px] text-gs-accent/60">replying</span>
                    )}
                    {/* Improvement 15: Best badge */}
                    {isBest && (
                      <span className="text-[10px] text-amber-400 font-semibold">{"\u2B50"} Best</span>
                    )}
                  </div>

                  {/* Improvement 6: Edit mode */}
                  {editingId === c.id ? (
                    <div className="flex gap-1.5 items-center">
                      <input
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="flex-1 bg-[#111] border border-[#222] rounded-md px-2 py-1.5 text-[12px] text-gs-text outline-none"
                        autoFocus
                        onKeyDown={e => e.key === "Enter" && saveEdit(c.id)}
                      />
                      <button onClick={() => saveEdit(c.id)} className="text-[10px] text-gs-accent bg-transparent border-none cursor-pointer font-semibold">Save</button>
                      <button onClick={() => { setEditingId(null); setEditText(""); }} className="text-[10px] text-gs-dim bg-transparent border-none cursor-pointer">Cancel</button>
                    </div>
                  ) : (
                    <>
                      {/* Improvement 3 + 5: Rich text + @mention highlighting */}
                      <p className="text-[13px] text-[#aaa] leading-normal mb-1">{highlightMentions(renderRichText(c.text))}</p>

                      {/* Improvement 16 (new): Translation display */}
                      {hasTranslation && (
                        <p className="text-[12px] text-gs-accent/70 leading-normal mb-1 italic">{translatedTexts[c.id]}</p>
                      )}
                    </>
                  )}

                  <div className="flex items-center gap-2">
                    {/* Improvement 14 (new): Upvote/downvote buttons */}
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleVote(c.id, 'up')}
                        className={`bg-transparent border-none cursor-pointer text-[11px] p-0 transition-colors ${
                          commentVotes.userVote === 'up' ? 'text-emerald-400' : 'text-gs-faint hover:text-emerald-400 opacity-0 group-hover:opacity-100'
                        }`}
                        title="Upvote"
                      >
                        {"\u25B2"}
                      </button>
                      <span className={`text-[10px] min-w-[16px] text-center font-mono ${
                        netVotes > 0 ? 'text-emerald-400' : netVotes < 0 ? 'text-red-400' : 'text-gs-faint'
                      }`}>
                        {netVotes !== 0 ? (netVotes > 0 ? `+${netVotes}` : netVotes) : '0'}
                      </span>
                      <button
                        onClick={() => handleVote(c.id, 'down')}
                        className={`bg-transparent border-none cursor-pointer text-[11px] p-0 transition-colors ${
                          commentVotes.userVote === 'down' ? 'text-red-400' : 'text-gs-faint hover:text-red-400 opacity-0 group-hover:opacity-100'
                        }`}
                        title="Downvote"
                      >
                        {"\u25BC"}
                      </button>
                    </div>

                    <button
                      onClick={() => toggleLike(c.id)}
                      className={`bg-transparent border-none cursor-pointer text-[11px] p-0 transition-colors ${
                        likedComments[c.id] ? 'text-red-400' : 'text-gs-faint hover:text-gs-muted opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {likedComments[c.id] ? "\u2764 Liked" : "\u2661 Like"}
                    </button>

                    {/* Improvement 1: Reply button */}
                    <button
                      onClick={() => { setReplyTo(c.id); inputRef.current?.focus(); }}
                      className="bg-transparent border-none cursor-pointer text-[11px] text-gs-faint hover:text-gs-muted p-0 opacity-0 group-hover:opacity-100 transition-colors"
                    >
                      Reply
                    </button>

                    {/* Improvement 16 (new): Translate button */}
                    {!hasTranslation && (
                      <button
                        onClick={() => handleTranslate(c.id, c.text)}
                        className="bg-transparent border-none cursor-pointer text-[11px] text-gs-faint hover:text-gs-muted p-0 opacity-0 group-hover:opacity-100 transition-colors"
                        disabled={isTranslating}
                      >
                        {isTranslating ? "Translating..." : "Translate"}
                      </button>
                    )}

                    {/* Improvement 6: Edit/Delete for own comments */}
                    {isOwn && editingId !== c.id && (
                      <>
                        <button
                          onClick={() => { setEditingId(c.id); setEditText(c.text); }}
                          className="bg-transparent border-none cursor-pointer text-[11px] text-gs-faint hover:text-gs-muted p-0 opacity-0 group-hover:opacity-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="bg-transparent border-none cursor-pointer text-[11px] text-gs-faint hover:text-red-400 p-0 opacity-0 group-hover:opacity-100 transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    )}

                    {/* Improvement 7: Pin button */}
                    <button
                      onClick={() => setPinnedCommentId(isPinned ? null : c.id)}
                      className={`bg-transparent border-none cursor-pointer text-[11px] p-0 transition-colors ${
                        isPinned ? 'text-gs-accent' : 'text-gs-faint hover:text-gs-muted opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isPinned ? "Unpin" : "Pin"}
                    </button>

                    {/* Improvement 15 (new): Mark as best */}
                    {!isBest && isOwn && (
                      <button
                        onClick={() => setBestCommentId(c.id)}
                        className="bg-transparent border-none cursor-pointer text-[11px] text-gs-faint hover:text-amber-400 p-0 opacity-0 group-hover:opacity-100 transition-colors"
                      >
                        {"\u2B50"} Best
                      </button>
                    )}

                    {/* [Improvement #20] Comment appreciation badges */}
                    {!isOwn && !appreciationBadges[c.id] && (
                      <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            const badges = ['\u{1F3B5} Music Expert', '\u{1F4A1} Insightful', '\u{2764}\u{FE0F} Helpful', '\u{1F31F} Great Taste'];
                            const badge = badges[Math.floor(Math.random() * badges.length)];
                            setAppreciationBadges(prev => ({ ...prev, [c.id]: badge }));
                          }}
                          className="bg-transparent border-none cursor-pointer text-[11px] text-gs-faint hover:text-amber-400 p-0"
                        >
                          Award
                        </button>
                      </div>
                    )}
                    {appreciationBadges[c.id] && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{appreciationBadges[c.id]}</span>
                    )}

                    {/* [Improvement #21] Feature comment (owner only) */}
                    {record.user === currentUser && !isOwn && featuredCommentId !== c.id && (
                      <button
                        onClick={() => setFeaturedCommentId(c.id)}
                        className="bg-transparent border-none cursor-pointer text-[11px] text-gs-faint hover:text-gs-accent p-0 opacity-0 group-hover:opacity-100 transition-colors"
                      >
                        Feature
                      </button>
                    )}

                    {/* [Improvement #22] Moderation tools (owner only) */}
                    {record.user === currentUser && !isOwn && (
                      <>
                        <button
                          onClick={() => setReportedComments(prev => new Set([...prev, c.id]))}
                          className={`bg-transparent border-none cursor-pointer text-[11px] p-0 transition-colors ${
                            reportedComments.has(c.id) ? 'text-red-400' : 'text-gs-faint hover:text-red-400 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {reportedComments.has(c.id) ? 'Reported' : 'Report'}
                        </button>
                        <button
                          onClick={() => setMutedUsers(prev => {
                            const next = new Set(prev);
                            if (next.has(c.user)) next.delete(c.user);
                            else next.add(c.user);
                            return next;
                          })}
                          className={`bg-transparent border-none cursor-pointer text-[11px] p-0 transition-colors ${
                            mutedUsers.has(c.user) ? 'text-amber-400' : 'text-gs-faint hover:text-amber-400 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {mutedUsers.has(c.user) ? 'Unmute' : 'Mute'}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Improvement 1: Threaded replies */}
                  {replies.length > 0 && (
                    <div className="mt-2 ml-2 pl-3 border-l border-[#1a1a1a]">
                      {replies.map(reply => (
                        <div key={reply.id} className="flex gap-2 mb-2 group">
                          <Avatar username={reply.user} size={24} onClick={() => { onClose(); onViewUser(reply.user); }} />
                          <div className="flex-1">
                            <div className="flex gap-2 items-baseline mb-[2px]">
                              <button onClick={() => { onClose(); onViewUser(reply.user); }} className="bg-transparent border-none cursor-pointer text-[11px] font-bold text-[#e0e0e0] p-0">@{reply.user}</button>
                              <span className="text-[9px] text-gs-faint font-mono">{formatTime(reply.time)}</span>
                            </div>
                            <p className="text-[12px] text-[#999] leading-normal">{highlightMentions(renderRichText(reply.text))}</p>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => toggleLike(reply.id)}
                                className={`bg-transparent border-none cursor-pointer text-[10px] p-0 mt-0.5 transition-colors ${
                                  likedComments[reply.id] ? 'text-red-400' : 'text-gs-faint hover:text-gs-muted opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                {likedComments[reply.id] ? "\u2764" : "\u2661"}
                              </button>
                              {/* Improvement 14: Reply voting */}
                              <button
                                onClick={() => handleVote(reply.id, 'up')}
                                className={`bg-transparent border-none cursor-pointer text-[9px] p-0 mt-0.5 ${
                                  (votes[reply.id]?.userVote === 'up') ? 'text-emerald-400' : 'text-gs-faint opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                {"\u25B2"}
                              </button>
                              <button
                                onClick={() => handleVote(reply.id, 'down')}
                                className={`bg-transparent border-none cursor-pointer text-[9px] p-0 mt-0.5 ${
                                  (votes[reply.id]?.userVote === 'down') ? 'text-red-400' : 'text-gs-faint opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                {"\u25BC"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Improvement 8: Load more button */}
        {hasMore && (
          <div className="text-center py-2">
            <button
              onClick={() => setVisibleCount(v => v + INITIAL_VISIBLE)}
              className="text-[11px] text-gs-accent bg-transparent border border-gs-accent/20 rounded-lg px-4 py-2 cursor-pointer font-semibold hover:bg-gs-accent/10"
            >
              Load more ({sortedComments.length - visibleCount} remaining)
            </button>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Improvement 1: Reply indicator */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-[10px] text-gs-accent">Replying to comment</span>
          <button
            onClick={() => setReplyTo(null)}
            className="text-[10px] text-gs-dim bg-transparent border-none cursor-pointer hover:text-gs-muted"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Improvement 17 (new): Sentiment emoji auto-suggest */}
      {suggestedEmojis.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <span className="text-[10px] text-gs-dim">Suggested:</span>
          {suggestedEmojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => setText(prev => prev + emoji)}
              className="w-7 h-7 flex items-center justify-center rounded-md bg-gs-accent/10 border border-gs-accent/20 cursor-pointer text-sm hover:bg-gs-accent/20 transition-colors animate-fade-in"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Improvement 4: GIF picker */}
      {showGifPicker && (
        <div className="mb-2 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-2.5">
          <input
            value={gifSearch}
            onChange={e => setGifSearch(e.target.value)}
            placeholder="Search GIFs..."
            className="w-full bg-[#111] border border-[#222] rounded-md px-2.5 py-1.5 text-[11px] text-gs-text outline-none mb-2"
          />
          <div className="grid grid-cols-6 gap-1.5">
            {filteredGifs.map(gif => (
              <button
                key={gif.id}
                onClick={() => {
                  setText(prev => prev + ` [GIF: ${gif.label}] `);
                  setShowGifPicker(false);
                  setGifSearch("");
                }}
                className="w-full aspect-square bg-[#1a1a1a] border border-[#222] rounded-md flex items-center justify-center text-lg cursor-pointer hover:bg-[#222] hover:border-[#333]"
                title={gif.label}
              >
                {gif.url}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Emoji quick-select */}
      <div className="flex gap-1 mb-2">
        {QUICK_EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => setText(prev => prev + emoji)}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-[#111] border border-[#1a1a1a] cursor-pointer text-sm hover:bg-[#1a1a1a] hover:border-[#333] transition-colors"
          >
            {emoji}
          </button>
        ))}
        {/* Improvement 4: GIF toggle */}
        <button
          onClick={() => setShowGifPicker(v => !v)}
          className={`w-8 h-8 flex items-center justify-center rounded-md border cursor-pointer text-[10px] font-bold transition-colors ${
            showGifPicker ? 'bg-gs-accent/15 border-gs-accent/30 text-gs-accent' : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:text-gs-muted'
          }`}
        >
          GIF
        </button>
      </div>

      {/* Improvement 3: Format help */}
      <div className="flex items-center gap-2 mb-1.5">
        <button
          onClick={() => setShowFormatHelp(v => !v)}
          className="text-[10px] text-gs-faint bg-transparent border-none cursor-pointer hover:text-gs-muted p-0"
        >
          {showFormatHelp ? "Hide formatting" : "Formatting tips"}
        </button>
        {/* Improvement 7: Character count */}
        <span className={`text-[10px] ml-auto ${isOverLimit ? 'text-red-400 font-bold' : charCount > CHAR_LIMIT * 0.8 ? 'text-amber-400' : 'text-gs-faint'}`}>
          {charCount}/{CHAR_LIMIT}
        </span>
      </div>
      {showFormatHelp && (
        <div className="mb-2 text-[10px] text-gs-dim bg-[#0d0d0d] border border-[#1a1a1a] rounded-md px-2.5 py-2">
          <span className="font-mono">**bold**</span> for <strong>bold</strong> {"\u00b7"} <span className="font-mono">*italic*</span> for <em>italic</em> {"\u00b7"} <span className="font-mono">@username</span> to mention
        </div>
      )}

      <div className="flex gap-2 border-t border-gs-border-subtle pt-3.5">
        <input
          ref={inputRef}
          value={text} onChange={e => setText(e.target.value)}
          placeholder={replyTo ? "Write a reply..." : "Add a comment..."}
          onKeyDown={e => e.key === "Enter" && submit()}
          className={`flex-1 bg-[#111] border rounded-lg px-3 py-2.5 text-gs-text text-[13px] outline-none font-sans focus:border-gs-accent/30 ${isOverLimit ? 'border-red-500/50' : 'border-gs-subtle'}`}
        />
        <button
          onClick={submit}
          disabled={isOverLimit || !text.trim()}
          className={`px-4 py-2.5 border-none rounded-lg font-bold text-xs cursor-pointer ${
            isOverLimit || !text.trim() ? 'bg-[#1a1a1a] text-gs-dim cursor-not-allowed' : 'bg-gs-accent text-black'
          }`}
        >
          {replyTo ? "Reply" : "Post"}
        </button>
      </div>
    </Modal>
  );
}
