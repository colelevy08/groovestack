// Direct messaging modal — a two-panel layout: contact list on the left, active thread on the right.
// Contact list is populated from the following array; falls back to the first 6 users if following nobody.
// messages state is a record keyed by username: { [username]: [{id, from, text, time}] }.
// Auto-replies simulate responses from the other user ~900ms–1700ms after sending a message.
import { useState, useRef, useEffect } from 'react';
import Avatar from '../ui/Avatar';
import { getProfile } from '../../utils/helpers';
import { USER_PROFILES } from '../../constants';

// Simulated replies sent by the other user after a short delay to make the chat feel alive
const AUTO_REPLIES = [
  "That's a killer pressing! Where did you find it?",
  "Agreed — the dynamics on that one are insane.",
  "I've been hunting that one for ages. Is it still available?",
  "Wow nice score. What's the pressing matrix?",
  "I have the same one! Original or reissue?",
  "Definitely adding that to my want list.",
  "The sleeve condition matters so much on that one.",
  "I paid way too much for mine. Worth every penny though.",
];

export default function DMModal({ open, onClose, currentUser, following, messages, setMessages }) {
  const [activeThread, setActiveThread] = useState(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    if (open && endRef.current) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messages, activeThread, open]);

  const allUsers = Object.keys(USER_PROFILES);
  // Show followed users as contacts; fall back to first 6 users if the following list is empty
  const contacts = following.length > 0 ? following : allUsers.slice(0, 6);

  // Appends the message to the active thread and schedules a random auto-reply
  const send = () => {
    if (!draft.trim() || !activeThread) return;
    const msg = { id: Date.now(), from: currentUser, text: draft.trim(), time: "just now" };
    setMessages(m => ({ ...m, [activeThread]: [...(m[activeThread] || []), msg] }));
    setDraft("");
    const reply = { id: Date.now() + 1, from: activeThread, text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)], time: "just now" };
    setTimeout(() => {
      setMessages(m => ({ ...m, [activeThread]: [...(m[activeThread] || []), reply] }));
    }, 900 + Math.random() * 800);
  };

  const thread = messages[activeThread] || [];
  const p = activeThread ? getProfile(activeThread) : null;

  if (!open) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 18, width: 620, maxWidth: "95vw", height: 540, display: "flex", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.85)" }}>
        {/* Contact list */}
        <div style={{ width: 190, borderRight: "1px solid #1a1a1a", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 14px", borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>Messages</div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {contacts.map(u => {
              const up = getProfile(u);
              const t = messages[u] || [];
              const last = t[t.length - 1];
              return (
                <button key={u} onClick={() => setActiveThread(u)} style={{ display: "flex", gap: 10, padding: "12px 14px", width: "100%", background: activeThread === u ? "#111" : "none", border: "none", borderBottom: "1px solid #111", cursor: "pointer", textAlign: "left", alignItems: "center" }}>
                  <Avatar username={u} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: activeThread === u ? "#f5f5f5" : "#ccc" }}>{up.displayName}</div>
                    {last
                      ? <div style={{ fontSize: 11, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last.text}</div>
                      : <div style={{ fontSize: 11, color: "#444" }}>Start a conversation</div>}
                  </div>
                </button>
              );
            })}
            {contacts.length === 0 && <div style={{ padding: 20, color: "#444", fontSize: 12, textAlign: "center" }}>Follow someone to message them.</div>}
          </div>
        </div>

        {/* Thread */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #1a1a1a" }}>
            {p
              ? <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Avatar username={activeThread} size={28} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5" }}>{p.displayName}</div>
                    <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace" }}>@{activeThread}</div>
                  </div>
                </div>
              : <span style={{ fontSize: 13, color: "#555" }}>Select a conversation</span>}
            <button onClick={onClose} style={{ background: "#1a1a1a", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", color: "#888", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            {!activeThread && <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 13 }}>Select a conversation →</div>}
            {activeThread && thread.length === 0 && <div style={{ color: "#444", fontSize: 13, textAlign: "center", marginTop: 40 }}>No messages yet. Say hello! 👋</div>}
            {thread.map(msg => {
              const isMine = msg.from === currentUser;
              return (
                <div key={msg.id} style={{ display: "flex", gap: 8, flexDirection: isMine ? "row-reverse" : "row", alignItems: "flex-end" }}>
                  {!isMine && <Avatar username={msg.from} size={26} />}
                  <div style={{ maxWidth: "72%", padding: "9px 13px", borderRadius: isMine ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: isMine ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "#1a1a1a", color: isMine ? "#fff" : "#ddd", fontSize: 13, lineHeight: 1.5 }}>
                    {msg.text}
                    <div style={{ fontSize: 10, color: isMine ? "#ffffff77" : "#555", marginTop: 4, textAlign: isMine ? "right" : "left" }}>{msg.time}</div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {activeThread && (
            <div style={{ padding: "12px 18px", borderTop: "1px solid #1a1a1a", display: "flex", gap: 8 }}>
              <input
                value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()}
                placeholder="Message..."
                style={{ flex: 1, background: "#111", border: "1px solid #222", borderRadius: 10, padding: "9px 13px", color: "#f0f0f0", fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif" }}
                onFocus={e => e.target.style.borderColor = "#0ea5e955"}
                onBlur={e => e.target.style.borderColor = "#222"}
              />
              <button onClick={send} style={{ padding: "9px 16px", background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Send</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
