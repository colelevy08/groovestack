// Dedicated messaging screen with conversation sidebar, message thread, online status,
// unread badges, search, attachment UI, and conversation archiving.
// Fully self-contained — accepts conversations and current user as props.
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Empty from '../ui/Empty';
import { relativeTime } from '../../utils/helpers';

const ATTACHMENT_TYPES = ['image', 'audio', 'document'];

function AttachmentPreview({ attachment }) {
  if (!attachment) return null;
  const iconMap = {
    image: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
      </svg>
    ),
    audio: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </svg>
    ),
    document: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" />
      </svg>
    ),
  };
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gs-surface border border-gs-border text-[11px] text-gs-muted mt-1 max-w-[200px]">
      <span className="shrink-0 text-gs-dim">{iconMap[attachment.type] || iconMap.document}</span>
      <span className="truncate">{attachment.name || 'Attachment'}</span>
    </div>
  );
}

function OnlineIndicator({ online }) {
  return (
    <span
      className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gs-card"
      style={{ background: online ? '#22c55e' : '#555' }}
      aria-label={online ? 'Online' : 'Offline'}
    />
  );
}

function MessageBubble({ message, isOwn }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] sm:max-w-[60%] rounded-2xl px-3.5 py-2.5 ${
          isOwn
            ? 'bg-gs-accent/15 border border-gs-accent/30 rounded-br-md'
            : 'bg-gs-surface border border-gs-border rounded-bl-md'
        }`}
      >
        <p className="text-[13px] text-gs-text m-0 leading-relaxed whitespace-pre-wrap break-words">
          {message.text}
        </p>
        {message.attachment && <AttachmentPreview attachment={message.attachment} />}
        <span className={`block text-[9px] mt-1 ${isOwn ? 'text-gs-accent/50 text-right' : 'text-gs-faint'}`}>
          {message.time ? relativeTime(new Date(message.time)) : ''}
          {isOwn && message.read && ' \u2713\u2713'}
          {isOwn && !message.read && ' \u2713'}
        </span>
      </div>
    </div>
  );
}

function ConversationItem({ conversation, isActive, onClick, currentUser }) {
  const other = conversation.participants?.find(p => p !== currentUser) || 'Unknown';
  const lastMsg = conversation.messages?.[conversation.messages.length - 1];
  const unread = conversation.unreadCount || 0;
  const online = conversation.online ?? false;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-3 py-3 border-none cursor-pointer transition-colors duration-150 ${
        isActive ? 'bg-gs-accent/10' : 'bg-transparent hover:bg-[#111]'
      }`}
    >
      <div className="relative shrink-0">
        <Avatar username={other} size={38} />
        <OnlineIndicator online={online} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[13px] truncate ${unread > 0 ? 'font-bold text-gs-text' : 'font-medium text-gs-muted'}`}>
            {other}
          </span>
          {lastMsg?.time && (
            <span className="text-[9px] text-gs-faint shrink-0">{relativeTime(new Date(lastMsg.time))}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className={`text-[11px] truncate ${unread > 0 ? 'text-gs-muted' : 'text-gs-dim'}`}>
            {lastMsg?.text || 'No messages yet'}
          </span>
          {unread > 0 && <Badge counter={unread} color="#0ea5e9" animate />}
        </div>
      </div>
    </button>
  );
}

export default function MessagesScreen({
  conversations = [],
  currentUser,
  onSendMessage,
  onArchiveConversation,
}) {
  const [activeId, setActiveId] = useState(conversations[0]?.id || null);
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [attachmentType, setAttachmentType] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Filter conversations
  const filtered = useMemo(() => {
    let list = conversations;
    if (!showArchived) list = list.filter(c => !c.archived);
    else list = list.filter(c => c.archived);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => {
        const other = c.participants?.find(p => p !== currentUser) || '';
        return other.toLowerCase().includes(q) ||
          c.messages?.some(m => m.text?.toLowerCase().includes(q));
      });
    }
    return list;
  }, [conversations, search, showArchived, currentUser]);

  const active = useMemo(() => conversations.find(c => c.id === activeId), [conversations, activeId]);

  // Scroll to bottom when active conversation changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeId, active?.messages?.length]);

  const handleSend = useCallback(() => {
    if (!input.trim() && !attachmentType) return;
    const message = {
      id: Date.now(),
      from: currentUser,
      text: input.trim(),
      time: new Date().toISOString(),
      read: false,
    };
    if (attachmentType) {
      message.attachment = { type: attachmentType, name: `file.${attachmentType === 'image' ? 'jpg' : attachmentType === 'audio' ? 'mp3' : 'pdf'}` };
    }
    onSendMessage?.(activeId, message);
    setInput('');
    setAttachmentType(null);
  }, [input, attachmentType, activeId, currentUser, onSendMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleArchive = useCallback(() => {
    if (active) {
      onArchiveConversation?.(activeId);
    }
  }, [active, activeId, onArchiveConversation]);

  const otherUser = active?.participants?.find(p => p !== currentUser) || 'Unknown';

  return (
    <div className="flex h-full min-h-[500px] max-h-[calc(100vh-120px)] bg-gs-bg rounded-xl border border-gs-border overflow-hidden">
      {/* Sidebar */}
      <div className="w-[280px] sm:w-[320px] border-r border-gs-border flex flex-col shrink-0">
        {/* Sidebar header */}
        <div className="px-3 py-3 border-b border-gs-border">
          <h2 className="text-[15px] font-bold text-gs-text m-0 mb-2">Messages</h2>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gs-dim pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-gs-card border border-gs-border rounded-lg py-2 pl-8 pr-3 text-[12px] text-gs-text outline-none font-sans placeholder:text-gs-faint focus:border-gs-accent/30"
            />
          </div>
          {/* Archive toggle */}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setShowArchived(false)}
              className={`text-[11px] font-medium px-2 py-1 rounded-md border-none cursor-pointer transition-colors ${
                !showArchived ? 'bg-gs-accent/15 text-gs-accent' : 'bg-transparent text-gs-dim hover:text-gs-muted'
              }`}
            >
              Inbox
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={`text-[11px] font-medium px-2 py-1 rounded-md border-none cursor-pointer transition-colors ${
                showArchived ? 'bg-gs-accent/15 text-gs-accent' : 'bg-transparent text-gs-dim hover:text-gs-muted'
              }`}
            >
              Archived
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gs-faint text-[12px]">
              {search ? 'No matching conversations' : showArchived ? 'No archived conversations' : 'No conversations yet'}
            </div>
          ) : (
            filtered.map(c => (
              <ConversationItem
                key={c.id}
                conversation={c}
                isActive={c.id === activeId}
                onClick={() => setActiveId(c.id)}
                currentUser={currentUser}
              />
            ))
          )}
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {active ? (
          <>
            {/* Thread header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gs-border shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <Avatar username={otherUser} size={32} />
                  <OnlineIndicator online={active.online ?? false} />
                </div>
                <div className="min-w-0">
                  <span className="text-[13px] font-bold text-gs-text block truncate">{otherUser}</span>
                  <span className="text-[10px] text-gs-dim">
                    {active.online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleArchive}
                  className="gs-btn-secondary px-2.5 py-1.5 text-[10px] rounded-lg"
                  title={active.archived ? 'Unarchive' : 'Archive'}
                >
                  {active.archived ? 'Unarchive' : 'Archive'}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {(!active.messages || active.messages.length === 0) ? (
                <div className="text-center py-10 text-gs-faint text-[12px]">
                  Start a conversation with {otherUser}
                </div>
              ) : (
                active.messages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id || i}
                    message={msg}
                    isOwn={msg.from === currentUser}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-gs-border px-4 py-3 shrink-0">
              {/* Attachment type selector */}
              {attachmentType && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-gs-dim">Attach:</span>
                  <Badge
                    label={attachmentType}
                    color="#0ea5e9"
                    size="sm"
                    onDismiss={() => setAttachmentType(null)}
                  />
                </div>
              )}
              <div className="flex items-end gap-2">
                {/* Attachment button */}
                <div className="relative group">
                  <button
                    className="w-8 h-8 rounded-lg bg-gs-card border border-gs-border flex items-center justify-center cursor-pointer text-gs-dim hover:text-gs-muted hover:border-gs-border-hover transition-colors shrink-0"
                    aria-label="Attach file"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <div className="absolute bottom-full left-0 mb-1 hidden group-hover:flex flex-col bg-gs-card border border-gs-border rounded-lg shadow-lg shadow-black/30 overflow-hidden z-10">
                    {ATTACHMENT_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => setAttachmentType(type)}
                        className="px-3 py-2 text-[11px] text-gs-muted hover:bg-[#111] hover:text-gs-text bg-transparent border-none cursor-pointer text-left capitalize transition-colors whitespace-nowrap"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 bg-gs-card border border-gs-border rounded-xl py-2.5 px-3.5 text-[13px] text-gs-text outline-none font-sans resize-none placeholder:text-gs-faint focus:border-gs-accent/30 min-h-[38px] max-h-[120px]"
                  style={{ fieldSizing: 'content' }}
                />

                <button
                  onClick={handleSend}
                  disabled={!input.trim() && !attachmentType}
                  className="gs-btn-gradient w-8 h-8 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <Empty
              icon="\u{1F4AC}"
              text="Select a conversation to start messaging"
            />
          </div>
        )}
      </div>
    </div>
  );
}
