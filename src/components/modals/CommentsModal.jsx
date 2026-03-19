// Modal for reading and posting comments on a specific record.
// Auto-scrolls to the newest comment whenever comments change or the modal opens.
// Submitting calls onAdd in App.js, which appends the comment to the record's comments array.
// Clicking a commenter's avatar or @handle closes the modal and opens their profile.
import { useState, useRef, useEffect } from 'react';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';

export default function CommentsModal({ open, onClose, record, onAdd, currentUser, onViewUser }) {
  const [text, setText] = useState("");
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

  if (!record) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Comments · ${record.album}`} width="460px">
      <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
        {record.comments.length === 0 && (
          <div style={{ textAlign: "center", color: "#444", fontSize: 13, padding: "32px 0" }}>No comments yet — be the first!</div>
        )}
        {record.comments.map(c => (
          <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <Avatar username={c.user} size={30} onClick={() => { onClose(); onViewUser(c.user); }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 3 }}>
                <button onClick={() => { onClose(); onViewUser(c.user); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#e0e0e0", padding: 0 }}>@{c.user}</button>
                <span style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono',monospace" }}>{c.time}</span>
              </div>
              <p style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>{c.text}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8, borderTop: "1px solid #1a1a1a", paddingTop: 14 }}>
        <input
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Add a comment..." onKeyDown={e => e.key === "Enter" && submit()}
          style={{ flex: 1, background: "#111", border: "1px solid #222", borderRadius: 8, padding: "9px 12px", color: "#f0f0f0", fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif" }}
          onFocus={e => e.target.style.borderColor = "#0ea5e955"}
          onBlur={e => e.target.style.borderColor = "#222"}
        />
        <button onClick={submit} style={{ padding: "9px 16px", background: "#0ea5e9", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Post</button>
      </div>
    </Modal>
  );
}
