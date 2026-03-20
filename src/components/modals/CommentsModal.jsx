// Modal for reading and posting comments on a specific record.
// Auto-scrolls to the newest comment whenever comments change or the modal opens.
// Submitting calls onAdd in App.js, which appends the comment to the record's comments array.
// Clicking a commenter's avatar or @handle closes the modal and opens their profile.
import { useState, useRef, useEffect } from 'react';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';

const QUICK_EMOJIS = ["🔥", "❤️", "🎶", "💿", "🤘", "👏", "😍", "💯"];

export default function CommentsModal({ open, onClose, record, onAdd, currentUser, onViewUser }) {
  const [text, setText] = useState("");
  const [likedComments, setLikedComments] = useState({});
  // endRef is attached to an invisible div at the bottom of the list; used for scroll-to-bottom
  const endRef = useRef(null);

  // Scroll to latest comment whenever the list grows or the modal opens
  useEffect(() => {
    if (open) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [record?.comments?.length, open]);

  // Build a new comment object with a timestamp-based id and post it via onAdd
  const submit = () => {
    if (!text.trim()) return;
    onAdd(record.id, { id: Date.now(), user: currentUser, text: text.trim(), time: "just now" });
    setText("");
  };

  const toggleLike = (commentId) => {
    setLikedComments(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  // Format relative time from comment time strings
  const formatTime = (time) => {
    if (!time || time === "just now") return "just now";
    // Already formatted times like "2h ago" pass through
    return time;
  };

  if (!record) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Comments · ${record.album}`} width="460px">
      <div className="max-h-[340px] overflow-y-auto mb-4">
        {record.comments.length === 0 && (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">💬</div>
            <div className="text-gs-muted text-[13px] font-semibold mb-1">No comments yet</div>
            <div className="text-gs-faint text-[12px]">Be the first to share your thoughts on this record!</div>
          </div>
        )}
        {record.comments.map(c => (
          <div key={c.id} className="flex gap-2.5 mb-4 group">
            <Avatar username={c.user} size={32} onClick={() => { onClose(); onViewUser(c.user); }} />
            <div className="flex-1">
              <div className="flex gap-2 items-baseline mb-[3px]">
                <button onClick={() => { onClose(); onViewUser(c.user); }} className="bg-transparent border-none cursor-pointer text-xs font-bold text-[#e0e0e0] p-0">@{c.user}</button>
                <span className="text-[10px] text-gs-faint font-mono">{formatTime(c.time)}</span>
              </div>
              <p className="text-[13px] text-[#aaa] leading-normal mb-1">{c.text}</p>
              <button
                onClick={() => toggleLike(c.id)}
                className={`bg-transparent border-none cursor-pointer text-[11px] p-0 transition-colors ${
                  likedComments[c.id] ? 'text-red-400' : 'text-gs-faint hover:text-gs-muted opacity-0 group-hover:opacity-100'
                }`}
              >
                {likedComments[c.id] ? "❤ Liked" : "♡ Like"}
              </button>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

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
      </div>

      <div className="flex gap-2 border-t border-gs-border-subtle pt-3.5">
        <input
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Add a comment..." onKeyDown={e => e.key === "Enter" && submit()}
          className="flex-1 bg-[#111] border border-gs-subtle rounded-lg px-3 py-2.5 text-gs-text text-[13px] outline-none font-sans focus:border-gs-accent/30"
        />
        <button onClick={submit} className="px-4 py-2.5 bg-gs-accent border-none rounded-lg text-black font-bold text-xs cursor-pointer">Post</button>
      </div>
    </Modal>
  );
}
