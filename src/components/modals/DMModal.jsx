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
      className="gs-overlay fixed inset-0 flex items-center justify-center z-[1000]"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gs-surface border border-gs-border rounded-[18px] w-[620px] max-w-[95vw] h-[540px] flex overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.85)]">
        {/* Contact list */}
        <div className="w-[190px] border-r border-[#1a1a1a] flex flex-col">
          <div className="px-3.5 py-4 border-b border-[#1a1a1a]">
            <div className="text-sm font-bold text-gs-text">Messages</div>
          </div>
          <div className="overflow-y-auto flex-1">
            {contacts.map(u => {
              const up = getProfile(u);
              const t = messages[u] || [];
              const last = t[t.length - 1];
              return (
                <button
                  key={u}
                  onClick={() => setActiveThread(u)}
                  className={`flex gap-2.5 px-3.5 py-3 w-full border-none border-b border-[#111] cursor-pointer text-left items-center ${activeThread === u ? 'bg-[#111]' : 'bg-transparent'}`}
                >
                  <Avatar username={u} size={34} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold ${activeThread === u ? 'text-gs-text' : 'text-[#ccc]'}`}>{up.displayName}</div>
                    {last
                      ? <div className="text-[11px] text-gs-dim overflow-hidden text-ellipsis whitespace-nowrap">{last.text}</div>
                      : <div className="text-[11px] text-gs-faint">Start a conversation</div>}
                  </div>
                </button>
              );
            })}
            {contacts.length === 0 && <div className="p-5 text-gs-faint text-xs text-center">Follow someone to message them.</div>}
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center px-[18px] py-3.5 border-b border-[#1a1a1a]">
            {p
              ? <div className="flex gap-2.5 items-center">
                  <Avatar username={activeThread} size={28} />
                  <div>
                    <div className="text-[13px] font-bold text-gs-text">{p.displayName}</div>
                    <div className="text-[11px] text-gs-dim font-mono">@{activeThread}</div>
                  </div>
                </div>
              : <span className="text-[13px] text-gs-dim">Select a conversation</span>}
            <button onClick={onClose} className="bg-[#1a1a1a] border-none rounded-md w-7 h-7 cursor-pointer text-gs-muted text-lg flex items-center justify-center">×</button>
          </div>

          <div className="flex-1 overflow-y-auto px-[18px] py-3.5 flex flex-col gap-2.5">
            {!activeThread && <div className="flex-1 flex items-center justify-center text-gs-subtle text-[13px]">Select a conversation →</div>}
            {activeThread && thread.length === 0 && <div className="text-gs-faint text-[13px] text-center mt-10">No messages yet. Say hello! 👋</div>}
            {thread.map(msg => {
              const isMine = msg.from === currentUser;
              return (
                <div key={msg.id} className={`flex gap-2 items-end ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMine && <Avatar username={msg.from} size={26} />}
                  <div
                    className={`max-w-[72%] px-[13px] py-[9px] text-[13px] leading-normal ${isMine ? 'rounded-[14px_14px_4px_14px] gs-btn-gradient text-white' : 'rounded-[14px_14px_14px_4px] bg-[#1a1a1a] text-[#ddd]'}`}
                  >
                    {msg.text}
                    <div className={`text-[10px] mt-1 ${isMine ? 'text-white/[.47] text-right' : 'text-gs-dim text-left'}`}>{msg.time}</div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {activeThread && (
            <div className="px-[18px] py-3 border-t border-[#1a1a1a] flex gap-2">
              <input
                value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()}
                placeholder="Message..."
                className="flex-1 bg-[#111] border border-[#222] rounded-[10px] px-[13px] py-[9px] text-[#f0f0f0] text-[13px] outline-none font-sans focus:border-gs-accent/30"
              />
              <button onClick={send} className="gs-btn-gradient px-4 py-[9px] border-none rounded-[10px] text-white font-bold text-xs cursor-pointer">Send</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
