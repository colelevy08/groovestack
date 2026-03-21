// Direct messaging modal — a two-panel layout: contact list on the left, active thread on the right.
// Contact list is populated from the following array; falls back to the first 6 users if following nobody.
// messages state is a record keyed by username: { [username]: [{id, from, text, time}] }.
// Auto-replies simulate responses from the other user ~900ms–1700ms after sending a message.
import { useState, useRef, useEffect, useMemo } from 'react';
import Avatar from '../ui/Avatar';
import { getProfile } from '../../utils/helpers';
import { USER_PROFILES } from '../../constants';

// Simulated replies sent by the other user after a short delay to make the chat feel alive
const AUTO_REPLIES = [
  "That's a killer pressing! Where did you find it?",
  "Agreed \u2014 the dynamics on that one are insane.",
  "I've been hunting that one for ages. Is it still available?",
  "Wow nice score. What's the pressing matrix?",
  "I have the same one! Original or reissue?",
  "Definitely adding that to my want list.",
  "The sleeve condition matters so much on that one.",
  "I paid way too much for mine. Worth every penny though.",
];

const REACTION_EMOJIS = ["\u2764\uFE0F", "\uD83D\uDE02", "\uD83D\uDD25", "\uD83D\uDC4D", "\uD83C\uDFB6", "\uD83D\uDCBF"];

// Improvement 19 (new): Quick response templates
const QUICK_RESPONSES = [
  { label: "Interested", text: "Hey, I'm interested! Is this still available?" },
  { label: "Price?", text: "What's the best price you can do on this?" },
  { label: "Condition?", text: "Can you tell me more about the condition? Any scratches or warps?" },
  { label: "Trade?", text: "Would you be open to a trade? I have some records you might like." },
  { label: "Thanks!", text: "Thanks so much! Really appreciate it." },
  { label: "Shipping?", text: "How much would shipping be to my area?" },
];

// Improvement 18 (new): Translation placeholder languages
const TRANSLATION_LANGS = [
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "pt", label: "Portuguese" },
];

export default function DMModal({ open, onClose, currentUser, following, messages, setMessages }) {
  const [activeThread, setActiveThread] = useState(null);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  // Improvement 1: Message search within conversation
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  // Improvement 2: Message reactions
  const [reactions, setReactions] = useState({});
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
  // Improvement 3: Pinned messages
  const [pinnedMessages, setPinnedMessages] = useState({});
  const [showPinned, setShowPinned] = useState(false);
  // Improvement 5: Voice message placeholder
  const [showVoiceUI, setShowVoiceUI] = useState(false);
  // Improvement 6: Message scheduling
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  // Improvement 7: Auto-reply setting
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplyText, setAutoReplyText] = useState("Hey! I'll get back to you soon.");
  const [showAutoReplySettings, setShowAutoReplySettings] = useState(false);
  // Improvement 8: Conversation archive
  const [archivedThreads, setArchivedThreads] = useState([]);
  // Improvement 9: Attachment sharing
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Improvement 18 (new): Message translation
  const [translatedMessages, setTranslatedMessages] = useState({});
  const [translatingMsgId, setTranslatingMsgId] = useState(null);
  const [translateLang, setTranslateLang] = useState("es");
  const [showTranslateMenu, setShowTranslateMenu] = useState(null);
  // Improvement 19 (new): Quick responses
  const [showQuickResponses, setShowQuickResponses] = useState(false);
  // Improvement 20 (new): Message expiration timer
  const [expiringMessages, setExpiringMessages] = useState({});
  const [selfDestructMode, setSelfDestructMode] = useState(false);
  const [selfDestructTimer, setSelfDestructTimer] = useState("30");
  // Improvement 21 (new): Read receipt toggle
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true);

  const endRef = useRef(null);

  useEffect(() => {
    if (open && endRef.current) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messages, activeThread, open]);

  // Improvement 20: Expire messages countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setExpiringMessages(prev => {
        const updated = { ...prev };
        let changed = false;
        for (const [msgId, expiresAt] of Object.entries(updated)) {
          if (now >= expiresAt) {
            delete updated[msgId];
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const allUsers = Object.keys(USER_PROFILES);
  // Show followed users as contacts; fall back to first 6 users if the following list is empty
  const contacts = following.length > 0 ? following : allUsers.slice(0, 6);
  const visibleContacts = contacts.filter(u => !archivedThreads.includes(u));

  // Check if a conversation has unread messages (last message is from the other user)
  const hasUnread = (username) => {
    const thread = messages[username] || [];
    if (thread.length === 0) return false;
    return thread[thread.length - 1].from !== currentUser;
  };

  // Improvement 4: Simulated online status
  const onlineUsers = useMemo(() => {
    const online = {};
    contacts.forEach(u => {
      online[u] = Math.random() > 0.4; // ~60% chance online
    });
    return online;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts.join(",")]);

  // Improvement 1: Filtered messages by search
  const thread = useMemo(() => messages[activeThread] || [], [messages, activeThread]);
  const filteredThread = useMemo(() => {
    if (!searchQuery.trim()) return thread;
    const q = searchQuery.toLowerCase();
    return thread.filter(m => m.text.toLowerCase().includes(q));
  }, [thread, searchQuery]);

  // Improvement 3: Pinned messages for active thread
  const threadPinned = useMemo(() => {
    const pinSet = pinnedMessages[activeThread] || new Set();
    return thread.filter(m => pinSet.has(m.id));
  }, [thread, pinnedMessages, activeThread]);

  const togglePin = (msgId) => {
    setPinnedMessages(prev => {
      const threadPins = new Set(prev[activeThread] || []);
      if (threadPins.has(msgId)) {
        threadPins.delete(msgId);
      } else {
        threadPins.add(msgId);
      }
      return { ...prev, [activeThread]: threadPins };
    });
  };

  // Improvement 2: Add reaction to a message
  const addReaction = (msgId, emoji) => {
    setReactions(prev => {
      const msgReactions = { ...(prev[msgId] || {}) };
      if (msgReactions[emoji]) {
        delete msgReactions[emoji];
      } else {
        msgReactions[emoji] = currentUser;
      }
      return { ...prev, [msgId]: msgReactions };
    });
    setReactionPickerMsgId(null);
  };

  // Improvement 18 (new): Simulate message translation
  const handleTranslateMsg = (msgId, text, lang) => {
    setTranslatingMsgId(msgId);
    setShowTranslateMenu(null);
    setTimeout(() => {
      const langLabel = TRANSLATION_LANGS.find(l => l.code === lang)?.label || lang;
      setTranslatedMessages(prev => ({
        ...prev,
        [msgId]: `[${langLabel}] ${text}`,
      }));
      setTranslatingMsgId(null);
    }, 600);
  };

  // Appends the message to the active thread and schedules a random auto-reply
  const send = () => {
    if (!draft.trim() || !activeThread) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    // Improvement 6: Scheduled message
    if (scheduleMode && scheduleTime) {
      const msg = { id: Date.now(), from: currentUser, text: draft.trim(), time: timeStr, status: "scheduled", scheduledFor: scheduleTime };
      setMessages(m => ({ ...m, [activeThread]: [...(m[activeThread] || []), msg] }));
      setDraft("");
      setScheduleMode(false);
      setScheduleTime("");
      return;
    }

    const msg = { id: Date.now(), from: currentUser, text: draft.trim(), time: timeStr, status: "sent" };
    setMessages(m => ({ ...m, [activeThread]: [...(m[activeThread] || []), msg] }));

    // Improvement 20: Set expiration if self-destruct mode is on
    if (selfDestructMode) {
      const expiresAt = Date.now() + parseInt(selfDestructTimer) * 1000;
      setExpiringMessages(prev => ({ ...prev, [msg.id]: expiresAt }));
    }

    setDraft("");

    // Mark as read after a short delay
    if (readReceiptsEnabled) {
      setTimeout(() => {
        setMessages(m => {
          const t = m[activeThread] || [];
          return {
            ...m,
            [activeThread]: t.map(msg2 => msg2.id === msg.id ? { ...msg2, status: "read" } : msg2),
          };
        });
      }, 400);
    }

    // Show typing indicator, then send auto-reply
    const replyDelay = 900 + Math.random() * 800;
    setIsTyping(true);
    const replyTime = new Date(now.getTime() + replyDelay);
    const replyTimeStr = replyTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const reply = { id: Date.now() + 1, from: activeThread, text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)], time: replyTimeStr, status: "read" };
    setTimeout(() => {
      setIsTyping(false);
      setMessages(m => ({ ...m, [activeThread]: [...(m[activeThread] || []), reply] }));
    }, replyDelay);
  };

  const p = activeThread ? getProfile(activeThread) : null;

  if (!open) return null;

  // Improvement 20: Filter out expired messages
  const displayThread = (searchQuery ? filteredThread : thread).filter(
    msg => !expiringMessages[msg.id] || Date.now() < expiringMessages[msg.id]
  );

  return (
    <div
      className="gs-overlay fixed inset-0 flex items-center justify-center z-[1000]"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gs-surface border border-gs-border rounded-[18px] w-full max-w-[min(620px,95vw)] h-[540px] flex overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.85)]">
        {/* Contact list sidebar */}
        <div className="w-[190px] border-r border-[#1a1a1a] flex flex-col">
          <div className="px-3.5 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
            <div className="text-sm font-bold text-gs-text">Messages</div>
            {/* Improvement 7: Auto-reply settings toggle */}
            <button
              onClick={() => setShowAutoReplySettings(v => !v)}
              title="Auto-reply settings"
              className="bg-transparent border-none cursor-pointer text-gs-dim hover:text-gs-muted text-sm p-0"
            >
              {"\u2699"}
            </button>
          </div>

          {/* Improvement 7: Auto-reply settings panel */}
          {showAutoReplySettings && (
            <div className="px-3 py-2.5 border-b border-[#1a1a1a] bg-[#0d0d0d]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-gs-dim font-mono">AUTO-REPLY</span>
                <button
                  onClick={() => setAutoReplyEnabled(v => !v)}
                  className={`w-8 h-4 rounded-full border-none cursor-pointer relative transition-colors ${autoReplyEnabled ? 'bg-gs-accent' : 'bg-[#333]'}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${autoReplyEnabled ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>
              <input
                value={autoReplyText}
                onChange={e => setAutoReplyText(e.target.value)}
                className="w-full bg-[#111] border border-[#222] rounded-md px-2 py-1.5 text-[11px] text-gs-text outline-none"
                placeholder="Auto-reply message..."
              />

              {/* Improvement 21 (new): Read receipt toggle */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gs-dim font-mono">READ RECEIPTS</span>
                <button
                  onClick={() => setReadReceiptsEnabled(v => !v)}
                  className={`w-8 h-4 rounded-full border-none cursor-pointer relative transition-colors ${readReceiptsEnabled ? 'bg-gs-accent' : 'bg-[#333]'}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${readReceiptsEnabled ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="text-[9px] text-gs-faint mt-0.5">
                {readReceiptsEnabled ? "Others can see when you read messages" : "Read receipts are off"}
              </div>
            </div>
          )}

          <div className="overflow-y-auto flex-1">
            {visibleContacts.map(u => {
              const up = getProfile(u);
              const t = messages[u] || [];
              const last = t[t.length - 1];
              const unread = hasUnread(u) && activeThread !== u;
              return (
                <button
                  key={u}
                  onClick={() => setActiveThread(u)}
                  className={`flex gap-2.5 px-3.5 py-3 w-full border-none border-b border-[#111] cursor-pointer text-left items-center ${activeThread === u ? 'bg-[#111]' : 'bg-transparent'}`}
                >
                  <div className="relative shrink-0">
                    <Avatar username={u} size={34} />
                    {unread && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-gs-accent rounded-full border-2 border-gs-surface" />
                    )}
                    {/* Improvement 4: Online status dot */}
                    {onlineUsers[u] && !unread && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-gs-surface" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold ${unread ? 'text-gs-text' : activeThread === u ? 'text-gs-text' : 'text-[#ccc]'}`}>{up.displayName}</div>
                    {last
                      ? <div className={`text-[11px] overflow-hidden text-ellipsis whitespace-nowrap ${unread ? 'text-gs-muted font-semibold' : 'text-gs-dim'}`}>{last.text}</div>
                      : <div className="text-[11px] text-gs-faint">Start a conversation</div>}
                  </div>
                </button>
              );
            })}

            {/* Improvement 8: Archived conversations section */}
            {archivedThreads.length > 0 && (
              <div className="px-3.5 py-2 border-t border-[#1a1a1a]">
                <div className="text-[10px] text-gs-faint font-mono mb-1">ARCHIVED ({archivedThreads.length})</div>
                {archivedThreads.map(u => {
                  const up = getProfile(u);
                  return (
                    <button
                      key={u}
                      onClick={() => {
                        setArchivedThreads(prev => prev.filter(a => a !== u));
                        setActiveThread(u);
                      }}
                      className="flex gap-2 px-1 py-1.5 w-full bg-transparent border-none cursor-pointer text-left items-center opacity-50 hover:opacity-80"
                    >
                      <Avatar username={u} size={24} />
                      <span className="text-[11px] text-gs-dim">{up.displayName}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {contacts.length === 0 && (
              <div className="p-8 text-center">
                <div className="text-2xl mb-2">{"\uD83D\uDCAC"}</div>
                <div className="text-gs-faint text-xs">Follow someone to start a conversation.</div>
              </div>
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="flex-1 flex flex-col">
          {/* Thread header with avatar */}
          <div className="flex justify-between items-center px-[18px] py-3.5 border-b border-[#1a1a1a]">
            {p
              ? <div className="flex gap-2.5 items-center">
                  <div className="relative">
                    <Avatar username={activeThread} size={30} />
                    {/* Improvement 4: Online status in header */}
                    {onlineUsers[activeThread] && (
                      <div className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full border border-gs-surface" />
                    )}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-gs-text">{p.displayName}</div>
                    <div className="text-[11px] text-gs-dim font-mono flex items-center gap-1.5">
                      @{activeThread}
                      {onlineUsers[activeThread] && <span className="text-emerald-400 text-[10px] font-sans">online</span>}
                    </div>
                  </div>
                </div>
              : <span className="text-[13px] text-gs-dim">Select a conversation</span>}
            <div className="flex items-center gap-1.5">
              {/* Improvement 1: Search toggle */}
              {activeThread && (
                <button
                  onClick={() => { setSearchOpen(v => !v); setSearchQuery(""); }}
                  title="Search messages"
                  className="bg-[#1a1a1a] border-none rounded-md w-7 h-7 cursor-pointer text-gs-muted text-sm flex items-center justify-center hover:text-gs-text"
                >
                  {"\uD83D\uDD0D"}
                </button>
              )}
              {/* Improvement 3: Show pinned messages */}
              {activeThread && threadPinned.length > 0 && (
                <button
                  onClick={() => setShowPinned(v => !v)}
                  title="Pinned messages"
                  className="bg-[#1a1a1a] border-none rounded-md w-7 h-7 cursor-pointer text-gs-muted text-sm flex items-center justify-center hover:text-gs-text"
                >
                  {"\uD83D\uDCCC"}
                </button>
              )}
              {/* Improvement 8: Archive conversation */}
              {activeThread && (
                <button
                  onClick={() => {
                    setArchivedThreads(prev => [...prev, activeThread]);
                    setActiveThread(null);
                  }}
                  title="Archive conversation"
                  className="bg-[#1a1a1a] border-none rounded-md w-7 h-7 cursor-pointer text-gs-muted text-sm flex items-center justify-center hover:text-gs-text"
                >
                  {"\uD83D\uDCE5"}
                </button>
              )}
              <button onClick={onClose} className="bg-[#1a1a1a] border-none rounded-md w-7 h-7 cursor-pointer text-gs-muted text-lg flex items-center justify-center">{"\u00d7"}</button>
            </div>
          </div>

          {/* Improvement 1: Search bar */}
          {searchOpen && activeThread && (
            <div className="px-[18px] py-2 border-b border-[#1a1a1a] bg-[#0d0d0d]">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                autoFocus
                className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-[12px] text-gs-text outline-none font-sans"
              />
              {searchQuery && (
                <div className="text-[10px] text-gs-dim mt-1">{filteredThread.length} result{filteredThread.length !== 1 ? 's' : ''} found</div>
              )}
            </div>
          )}

          {/* Improvement 3: Pinned messages panel */}
          {showPinned && threadPinned.length > 0 && (
            <div className="px-[18px] py-2 border-b border-[#1a1a1a] bg-[#0a0a0a] max-h-[100px] overflow-y-auto">
              <div className="text-[10px] text-gs-dim font-mono mb-1.5">PINNED MESSAGES</div>
              {threadPinned.map(m => (
                <div key={m.id} className="text-[11px] text-gs-muted mb-1 flex items-center gap-1.5">
                  <span>{"\uD83D\uDCCC"}</span>
                  <span className="font-bold text-gs-text">{m.from === currentUser ? 'You' : m.from}:</span>
                  <span className="truncate">{m.text}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-[18px] py-3.5 flex flex-col gap-2.5">
            {/* Empty state — no conversation selected */}
            {!activeThread && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="text-4xl mb-3">{"\uD83D\uDCE8"}</div>
                <div className="text-gs-muted text-[14px] font-semibold mb-1">Your messages</div>
                <div className="text-gs-faint text-[12px]">Select a conversation from the sidebar to start chatting.</div>
              </div>
            )}
            {/* Empty state — conversation selected but no messages */}
            {activeThread && thread.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center mt-6">
                <Avatar username={activeThread} size={48} />
                <div className="text-gs-muted text-[13px] font-semibold mt-3">{p?.displayName}</div>
                <div className="text-gs-faint text-[12px] mt-1">Start the conversation \u2014 say hello!</div>
              </div>
            )}
            {displayThread.map(msg => {
              const isMine = msg.from === currentUser;
              const msgReactions = reactions[msg.id] || {};
              const isPinned = (pinnedMessages[activeThread] || new Set()).has(msg.id);
              const reactionEntries = Object.entries(msgReactions);
              const hasTranslation = translatedMessages[msg.id];
              const isTranslating = translatingMsgId === msg.id;
              const isExpiring = expiringMessages[msg.id];
              const timeLeft = isExpiring ? Math.max(0, Math.ceil((expiringMessages[msg.id] - Date.now()) / 1000)) : null;

              return (
                <div key={msg.id} className={`flex gap-2 items-end group ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMine && <Avatar username={msg.from} size={26} />}
                  <div className="relative max-w-[72%]">
                    {/* Improvement 3: Pin indicator */}
                    {isPinned && (
                      <div className={`text-[9px] text-gs-dim mb-0.5 ${isMine ? 'text-right' : 'text-left'}`}>{"\uD83D\uDCCC"} Pinned</div>
                    )}
                    {/* Improvement 20: Expiration countdown */}
                    {isExpiring && timeLeft !== null && (
                      <div className={`text-[9px] text-red-400 mb-0.5 ${isMine ? 'text-right' : 'text-left'}`}>
                        {"\u23F3"} Expires in {timeLeft}s
                      </div>
                    )}
                    <div
                      className={`px-[13px] py-[9px] text-[13px] leading-normal ${
                        msg.status === "scheduled"
                          ? 'rounded-[14px] bg-[#1a1a1a] border border-dashed border-[#333] text-[#888]'
                          : isExpiring
                            ? `${isMine ? 'rounded-[14px_14px_4px_14px]' : 'rounded-[14px_14px_14px_4px]'} bg-red-500/10 border border-red-500/20 text-[#ddd]`
                            : isMine
                              ? 'rounded-[14px_14px_4px_14px] gs-btn-gradient text-white'
                              : 'rounded-[14px_14px_14px_4px] bg-[#1a1a1a] text-[#ddd]'
                      }`}
                    >
                      {msg.text}

                      {/* Improvement 18 (new): Translation display */}
                      {hasTranslation && (
                        <div className="text-[11px] mt-1 pt-1 border-t border-white/10 opacity-70 italic">{translatedMessages[msg.id]}</div>
                      )}

                      <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        {/* Improvement 6: Scheduled indicator */}
                        {msg.status === "scheduled" && (
                          <span className="text-[10px] text-amber-400/70 mr-1">{"\u23F0"} {msg.scheduledFor}</span>
                        )}
                        <span className={`text-[10px] ${isMine ? 'text-white/[.47]' : 'text-gs-dim'}`}>{msg.time}</span>
                        {/* Improvement 21 (new): Read receipts (conditional) */}
                        {isMine && msg.status !== "scheduled" && readReceiptsEnabled && (
                          <span className={`text-[10px] ${msg.status === "read" ? 'text-blue-400' : 'text-white/[.35]'}`}>
                            {msg.status === "read" ? "\u2713\u2713" : "\u2713"}
                          </span>
                        )}
                        {isMine && msg.status !== "scheduled" && !readReceiptsEnabled && (
                          <span className="text-[10px] text-white/[.25]">{"\u2713"}</span>
                        )}
                      </div>
                    </div>

                    {/* Improvement 2: Reaction display */}
                    {reactionEntries.length > 0 && (
                      <div className={`flex gap-0.5 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        {reactionEntries.map(([emoji]) => (
                          <span key={emoji} className="text-[12px] bg-[#1a1a1a] rounded-full px-1.5 py-0.5 border border-[#222] cursor-pointer hover:bg-[#222]" onClick={() => addReaction(msg.id, emoji)}>
                            {emoji}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Hover actions: react, pin, translate */}
                    <div className={`absolute top-0 ${isMine ? '-left-20' : '-right-20'} hidden group-hover:flex items-center gap-0.5`}>
                      <button
                        onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)}
                        className="bg-[#1a1a1a] border border-[#222] rounded-md w-6 h-6 text-[11px] cursor-pointer flex items-center justify-center hover:bg-[#222]"
                        title="React"
                      >
                        {"\uD83D\uDE0A"}
                      </button>
                      <button
                        onClick={() => togglePin(msg.id)}
                        className="bg-[#1a1a1a] border border-[#222] rounded-md w-6 h-6 text-[11px] cursor-pointer flex items-center justify-center hover:bg-[#222]"
                        title={isPinned ? "Unpin" : "Pin"}
                      >
                        {"\uD83D\uDCCC"}
                      </button>
                      {/* Improvement 18 (new): Translate button */}
                      <button
                        onClick={() => setShowTranslateMenu(showTranslateMenu === msg.id ? null : msg.id)}
                        className="bg-[#1a1a1a] border border-[#222] rounded-md w-6 h-6 text-[9px] cursor-pointer flex items-center justify-center hover:bg-[#222] font-bold"
                        title="Translate"
                      >
                        {isTranslating ? "..." : "Aa"}
                      </button>
                    </div>

                    {/* Improvement 18 (new): Translation language picker */}
                    {showTranslateMenu === msg.id && (
                      <div className={`absolute ${isMine ? 'right-0' : 'left-0'} -top-10 flex gap-0.5 bg-[#1a1a1a] border border-[#333] rounded-lg px-1.5 py-1 z-10 shadow-lg`}>
                        {TRANSLATION_LANGS.map(lang => (
                          <button
                            key={lang.code}
                            onClick={() => handleTranslateMsg(msg.id, msg.text, lang.code)}
                            className="bg-transparent border-none cursor-pointer text-[10px] px-1.5 py-0.5 text-gs-muted hover:text-gs-text hover:bg-[#222] rounded"
                            title={lang.label}
                          >
                            {lang.label.slice(0, 2)}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Improvement 2: Reaction picker */}
                    {reactionPickerMsgId === msg.id && (
                      <div className={`absolute ${isMine ? 'right-0' : 'left-0'} -top-8 flex gap-0.5 bg-[#1a1a1a] border border-[#333] rounded-lg px-1.5 py-1 z-10 shadow-lg`}>
                        {REACTION_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => addReaction(msg.id, emoji)}
                            className="bg-transparent border-none cursor-pointer text-sm p-0.5 hover:scale-125 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Typing indicator */}
            {isTyping && activeThread && (
              <div className="flex gap-2 items-end">
                <Avatar username={activeThread} size={26} />
                <div className="rounded-[14px_14px_14px_4px] bg-[#1a1a1a] px-[13px] py-[10px]">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-gs-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-gs-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-gs-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Improvement 5: Voice message placeholder */}
          {showVoiceUI && activeThread && (
            <div className="px-[18px] py-2.5 border-t border-[#1a1a1a] bg-[#0d0d0d] flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <div className="flex-1">
                <div className="text-[12px] text-gs-muted font-semibold">Recording voice message...</div>
                <div className="text-[10px] text-gs-dim">Feature coming soon</div>
              </div>
              <button
                onClick={() => setShowVoiceUI(false)}
                className="bg-[#1a1a1a] border border-[#222] rounded-md px-3 py-1.5 text-[11px] text-gs-muted cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Improvement 19 (new): Quick response templates */}
          {showQuickResponses && activeThread && (
            <div className="px-[18px] py-2 border-t border-[#1a1a1a] bg-[#0d0d0d]">
              <div className="text-[10px] text-gs-dim font-mono mb-1.5">QUICK RESPONSES</div>
              <div className="flex flex-wrap gap-1">
                {QUICK_RESPONSES.map(qr => (
                  <button
                    key={qr.label}
                    onClick={() => { setDraft(qr.text); setShowQuickResponses(false); }}
                    className="bg-[#1a1a1a] border border-[#222] rounded-lg px-2.5 py-1.5 text-[11px] text-gs-muted cursor-pointer hover:bg-[#222] hover:text-gs-text transition-colors"
                  >
                    {qr.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeThread && (
            <div className="px-[18px] py-3 border-t border-[#1a1a1a]">
              {/* Improvement 6: Schedule mode indicator */}
              {scheduleMode && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-amber-400 font-mono">SCHEDULED SEND</span>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                    className="bg-[#111] border border-[#222] rounded-md px-2 py-1 text-[11px] text-gs-text outline-none"
                  />
                  <button onClick={() => { setScheduleMode(false); setScheduleTime(""); }} className="text-[10px] text-gs-dim bg-transparent border-none cursor-pointer hover:text-gs-muted">Cancel</button>
                </div>
              )}

              {/* Improvement 20 (new): Self-destruct mode indicator */}
              {selfDestructMode && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-red-400 font-mono">{"\u23F3"} SELF-DESTRUCT MODE</span>
                  <select
                    value={selfDestructTimer}
                    onChange={e => setSelfDestructTimer(e.target.value)}
                    className="bg-[#111] border border-[#222] rounded-md px-2 py-1 text-[11px] text-gs-text outline-none cursor-pointer"
                  >
                    <option value="10">10 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                    <option value="300">5 minutes</option>
                  </select>
                  <button onClick={() => setSelfDestructMode(false)} className="text-[10px] text-gs-dim bg-transparent border-none cursor-pointer hover:text-gs-muted">Cancel</button>
                </div>
              )}

              <div className="flex gap-2">
                {/* Improvement 9: Attachment menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowAttachMenu(v => !v)}
                    title="Attach file"
                    className="bg-[#1a1a1a] border border-[#222] rounded-[10px] w-9 h-9 cursor-pointer text-gs-muted text-base flex items-center justify-center hover:text-gs-text hover:border-[#333]"
                  >
                    +
                  </button>
                  {showAttachMenu && (
                    <div className="absolute bottom-full left-0 mb-1 bg-[#1a1a1a] border border-[#333] rounded-lg p-1.5 shadow-lg z-10 min-w-[120px]">
                      <button
                        onClick={() => setShowAttachMenu(false)}
                        className="flex items-center gap-2 w-full bg-transparent border-none cursor-pointer text-[11px] text-gs-muted px-2 py-1.5 rounded-md hover:bg-[#222] text-left"
                      >
                        {"\uD83D\uDDBC"} Photo
                      </button>
                      <button
                        onClick={() => { setShowAttachMenu(false); setShowVoiceUI(true); }}
                        className="flex items-center gap-2 w-full bg-transparent border-none cursor-pointer text-[11px] text-gs-muted px-2 py-1.5 rounded-md hover:bg-[#222] text-left"
                      >
                        {"\uD83C\uDFA4"} Voice
                      </button>
                      <button
                        onClick={() => setShowAttachMenu(false)}
                        className="flex items-center gap-2 w-full bg-transparent border-none cursor-pointer text-[11px] text-gs-muted px-2 py-1.5 rounded-md hover:bg-[#222] text-left"
                      >
                        {"\uD83D\uDCCE"} File
                      </button>
                    </div>
                  )}
                </div>
                <input
                  value={draft} onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && send()}
                  placeholder={scheduleMode ? "Type a scheduled message..." : selfDestructMode ? "This message will self-destruct..." : "Message..."}
                  className="flex-1 bg-[#111] border border-[#222] rounded-[10px] px-[13px] py-[9px] text-[#f0f0f0] text-[13px] outline-none font-sans focus:border-gs-accent/30"
                />
                {/* Improvement 19 (new): Quick responses toggle */}
                <button
                  onClick={() => setShowQuickResponses(v => !v)}
                  title="Quick responses"
                  className={`border rounded-[10px] w-9 h-9 cursor-pointer text-sm flex items-center justify-center ${
                    showQuickResponses ? 'bg-gs-accent/20 border-gs-accent/30 text-gs-accent' : 'bg-[#1a1a1a] border-[#222] text-gs-muted hover:text-gs-text'
                  }`}
                >
                  {"\u26A1"}
                </button>
                {/* Improvement 20 (new): Self-destruct toggle */}
                <button
                  onClick={() => setSelfDestructMode(v => !v)}
                  title="Self-destruct message"
                  className={`border rounded-[10px] w-9 h-9 cursor-pointer text-sm flex items-center justify-center ${
                    selfDestructMode ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-[#1a1a1a] border-[#222] text-gs-muted hover:text-gs-text'
                  }`}
                >
                  {"\u23F3"}
                </button>
                {/* Improvement 6: Schedule button */}
                <button
                  onClick={() => setScheduleMode(v => !v)}
                  title="Schedule message"
                  className={`border-none rounded-[10px] w-9 h-9 cursor-pointer text-sm flex items-center justify-center ${scheduleMode ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-[#1a1a1a] border border-[#222] text-gs-muted hover:text-gs-text'}`}
                >
                  {"\u23F0"}
                </button>
                <button onClick={send} className="gs-btn-gradient px-4 py-[9px] border-none rounded-[10px] text-white font-bold text-xs cursor-pointer">
                  {scheduleMode ? "Schedule" : "Send"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
