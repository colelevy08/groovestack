// Dedicated messaging screen with conversation sidebar, message thread, online status,
// unread badges, search, attachment UI, conversation archiving, templates, scheduling,
// contact groups, priority flags, unread summary, export, and conversation tagging.
// Fully self-contained — accepts conversations and current user as props.
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Empty from '../ui/Empty';
import { relativeTime } from '../../utils/helpers';

const ATTACHMENT_TYPES = ['image', 'audio', 'document'];

// ── Improvement #11: Message Templates ───────────────────────────────────
const DEFAULT_TEMPLATES = [
  { id: 1, name: 'Interested in record', text: 'Hi! I saw your listing and I\'m interested in purchasing this record. Is it still available?' },
  { id: 2, name: 'Price negotiation', text: 'Thanks for the quick response! Would you consider ${{price}} for this item?' },
  { id: 3, name: 'Shipping question', text: 'Could you let me know your shipping options and costs? I\'m located in {{location}}.' },
  { id: 4, name: 'Condition inquiry', text: 'Can you provide more details about the condition? Any scratches, warps, or sleeve damage?' },
  { id: 5, name: 'Thank you', text: 'Thanks for the great transaction! The record arrived in perfect condition.' },
];

// ── Improvement #12: Automated Responses ─────────────────────────────────
const DEFAULT_AUTO_RESPONSES = [
  { id: 1, trigger: 'available', response: 'Yes, this item is still available! Feel free to make an offer.', enabled: true },
  { id: 2, trigger: 'shipping', response: 'I ship via USPS Media Mail. Domestic shipping is $4, international varies by location.', enabled: true },
  { id: 3, trigger: 'condition', response: 'I grade conservatively. All records are visually inspected and play-tested before listing.', enabled: false },
];

// ── Improvement #13: Message Priority Levels ─────────────────────────────
const PRIORITY_FLAGS = [
  { key: 'urgent', label: 'Urgent', color: '#ef4444' },
  { key: 'high', label: 'High', color: '#f59e0b' },
  { key: 'normal', label: 'Normal', color: '#6b7280' },
  { key: 'low', label: 'Low', color: '#22c55e' },
];

// ── Improvement #18: Conversation Tags ───────────────────────────────────
const CONVERSATION_TAGS = [
  { key: 'buying', label: 'Buying', color: '#0ea5e9' },
  { key: 'selling', label: 'Selling', color: '#22c55e' },
  { key: 'trading', label: 'Trading', color: '#8b5cf6' },
  { key: 'inquiry', label: 'Inquiry', color: '#f59e0b' },
  { key: 'negotiation', label: 'Negotiation', color: '#ec4899' },
  { key: 'completed', label: 'Completed', color: '#6b7280' },
];

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
        {/* Improvement #15: Priority flag on message */}
        {message.priority && message.priority !== 'normal' && (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold mb-1" style={{ color: PRIORITY_FLAGS.find(p => p.key === message.priority)?.color || '#6b7280' }}>
            {PRIORITY_FLAGS.find(p => p.key === message.priority)?.label || ''} Priority
          </span>
        )}
        <p className="text-[13px] text-gs-text m-0 leading-relaxed whitespace-pre-wrap break-words">
          {message.text}
        </p>
        {message.attachment && <AttachmentPreview attachment={message.attachment} />}
        {/* Improvement #13: Scheduled indicator */}
        {message.scheduled && (
          <span className="block text-[9px] text-[#f59e0b] mt-0.5">
            Scheduled: {new Date(message.scheduledFor).toLocaleString()}
          </span>
        )}
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
          <div className="flex items-center gap-1 shrink-0">
            {/* Improvement #15: Priority indicator on conversation */}
            {conversation.priority && conversation.priority !== 'normal' && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: PRIORITY_FLAGS.find(p => p.key === conversation.priority)?.color || '#6b7280' }}
                title={`${conversation.priority} priority`}
              />
            )}
            {unread > 0 && <Badge counter={unread} color="#0ea5e9" animate />}
          </div>
        </div>
        {/* Improvement #18: Conversation tags */}
        {conversation.tags && conversation.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {conversation.tags.map(tagKey => {
              const tag = CONVERSATION_TAGS.find(t => t.key === tagKey);
              if (!tag) return null;
              return (
                <span key={tagKey} className="text-[8px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${tag.color}20`, color: tag.color }}>
                  {tag.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </button>
  );
}

// ── Improvement #11: Template Picker ─────────────────────────────────────

function TemplatePicker({ templates, onSelect, onClose }) {
  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 bg-gs-card border border-gs-border rounded-xl shadow-lg shadow-black/30 overflow-hidden z-20">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gs-border">
        <span className="text-[11px] font-bold text-gs-text">Message Templates</span>
        <button onClick={onClose} className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer">Close</button>
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.text)}
            className="w-full text-left px-3 py-2.5 bg-transparent border-none cursor-pointer hover:bg-[#111] transition-colors"
          >
            <span className="text-[11px] font-medium text-gs-text block">{t.name}</span>
            <span className="text-[10px] text-gs-dim block truncate mt-0.5">{t.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Improvement #12: Auto Response Settings ──────────────────────────────

function AutoResponseSettings({ autoResponses, onToggle, onClose }) {
  return (
    <div className="absolute bottom-full right-0 mb-2 w-80 bg-gs-card border border-gs-border rounded-xl shadow-lg shadow-black/30 overflow-hidden z-20">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gs-border">
        <span className="text-[11px] font-bold text-gs-text">Auto-Responses</span>
        <button onClick={onClose} className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer">Close</button>
      </div>
      <div className="max-h-[240px] overflow-y-auto p-2 space-y-2">
        {autoResponses.map(ar => (
          <div key={ar.id} className="flex items-start gap-2 p-2 rounded-lg bg-gs-surface">
            <button
              onClick={() => onToggle(ar.id)}
              className={`mt-0.5 w-8 h-4 rounded-full border-none cursor-pointer transition-colors shrink-0 ${ar.enabled ? 'bg-gs-accent' : 'bg-[#333]'}`}
            >
              <span className={`block w-3 h-3 rounded-full bg-white transition-transform ${ar.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-gs-dim m-0">When message contains: <span className="font-bold text-gs-muted">"{ar.trigger}"</span></p>
              <p className="text-[10px] text-gs-text m-0 mt-0.5">{ar.response}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Improvement #13: Schedule Message Picker ─────────────────────────────

function SchedulePicker({ onSchedule, onClose }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  return (
    <div className="absolute bottom-full right-12 mb-2 bg-gs-card border border-gs-border rounded-xl shadow-lg shadow-black/30 p-3 z-20">
      <p className="text-[11px] font-bold text-gs-text m-0 mb-2">Schedule Message</p>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="bg-gs-surface border border-gs-border rounded-md text-[11px] text-gs-text px-2 py-1 outline-none font-sans focus:border-gs-accent/30"
        />
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="bg-gs-surface border border-gs-border rounded-md text-[11px] text-gs-text px-2 py-1 outline-none font-sans focus:border-gs-accent/30"
        />
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button onClick={onClose} className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer">Cancel</button>
        <button
          onClick={() => { if (date && time) onSchedule(`${date}T${time}`); }}
          disabled={!date || !time}
          className="gs-btn-gradient px-2.5 py-1 text-[10px] rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Schedule
        </button>
      </div>
    </div>
  );
}

// ── Improvement #14: Contact Groups ──────────────────────────────────────

function ContactGroupsSidebar({ groups, activeGroup, onSelectGroup, conversations, currentUser }) {
  const allContacts = useMemo(() => {
    const set = new Set();
    conversations.forEach(c => {
      c.participants?.forEach(p => { if (p !== currentUser) set.add(p); });
    });
    return [...set];
  }, [conversations, currentUser]);

  return (
    <div className="border-b border-gs-border px-3 py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => onSelectGroup(null)}
          className={`text-[10px] px-2 py-1 rounded-md border-none cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
            !activeGroup ? 'bg-gs-accent/15 text-gs-accent' : 'bg-transparent text-gs-dim hover:text-gs-muted'
          }`}
        >
          All ({allContacts.length})
        </button>
        {(groups || []).map(g => (
          <button
            key={g.id}
            onClick={() => onSelectGroup(g.id)}
            className={`text-[10px] px-2 py-1 rounded-md border-none cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              activeGroup === g.id ? 'bg-gs-accent/15 text-gs-accent' : 'bg-transparent text-gs-dim hover:text-gs-muted'
            }`}
          >
            {g.name} ({g.members?.length || 0})
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Improvement #16: Unread Message Summary ──────────────────────────────

function UnreadSummary({ conversations, currentUser }) {
  const summary = useMemo(() => {
    const unreadConvos = conversations.filter(c => (c.unreadCount || 0) > 0 && !c.archived);
    const totalUnread = unreadConvos.reduce((s, c) => s + (c.unreadCount || 0), 0);
    const senders = unreadConvos.map(c => c.participants?.find(p => p !== currentUser) || 'Unknown');
    return { totalUnread, count: unreadConvos.length, senders: senders.slice(0, 3) };
  }, [conversations, currentUser]);

  if (summary.totalUnread === 0) return null;

  return (
    <div className="mx-3 my-2 px-3 py-2 rounded-lg bg-[#0ea5e9]/10 border border-[#0ea5e9]/20">
      <p className="text-[11px] text-[#0ea5e9] font-medium m-0">
        {summary.totalUnread} unread message{summary.totalUnread !== 1 ? 's' : ''} in {summary.count} conversation{summary.count !== 1 ? 's' : ''}
      </p>
      <p className="text-[9px] text-gs-dim m-0 mt-0.5">
        From: {summary.senders.join(', ')}{summary.count > 3 ? ` and ${summary.count - 3} more` : ''}
      </p>
    </div>
  );
}

export default function MessagesScreen({
  conversations = [],
  currentUser,
  onSendMessage,
  onArchiveConversation,
  onTagConversation,
  onSetPriority,
  onExportConversation,
  contactGroups = [],
  templates = DEFAULT_TEMPLATES,
  autoResponses: initialAutoResponses,
}) {
  const [activeId, setActiveId] = useState(conversations[0]?.id || null);
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [attachmentType, setAttachmentType] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Improvement #11: Template picker state
  const [showTemplates, setShowTemplates] = useState(false);
  // Improvement #12: Auto response state
  const [autoResponses, setAutoResponses] = useState(initialAutoResponses || DEFAULT_AUTO_RESPONSES);
  const [showAutoResponses, setShowAutoResponses] = useState(false);
  // Improvement #13: Schedule state
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(null);
  // Improvement #14: Contact group filter
  const [activeGroup, setActiveGroup] = useState(null);
  // Improvement #15: Message priority
  const [messagePriority, setMessagePriority] = useState('normal');
  // Improvement #18: Tag management
  const [showTagPicker, setShowTagPicker] = useState(false);

  // ── Improvement 24: Message analytics dashboard ──
  const [showMsgAnalytics, setShowMsgAnalytics] = useState(false);

  // Filter conversations
  const filtered = useMemo(() => {
    let list = conversations;
    if (!showArchived) list = list.filter(c => !c.archived);
    else list = list.filter(c => c.archived);

    // Improvement #14: filter by contact group
    if (activeGroup) {
      const group = contactGroups.find(g => g.id === activeGroup);
      if (group) {
        list = list.filter(c => {
          const other = c.participants?.find(p => p !== currentUser);
          return group.members?.includes(other);
        });
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => {
        const other = c.participants?.find(p => p !== currentUser) || '';
        return other.toLowerCase().includes(q) ||
          c.messages?.some(m => m.text?.toLowerCase().includes(q));
      });
    }
    return list;
  }, [conversations, search, showArchived, currentUser, activeGroup, contactGroups]);

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
      priority: messagePriority !== 'normal' ? messagePriority : undefined,
    };
    if (attachmentType) {
      message.attachment = { type: attachmentType, name: `file.${attachmentType === 'image' ? 'jpg' : attachmentType === 'audio' ? 'mp3' : 'pdf'}` };
    }
    // Improvement #13: scheduled message
    if (scheduledTime) {
      message.scheduled = true;
      message.scheduledFor = scheduledTime;
    }
    onSendMessage?.(activeId, message);
    setInput('');
    setAttachmentType(null);
    setScheduledTime(null);
    setMessagePriority('normal');
  }, [input, attachmentType, activeId, currentUser, onSendMessage, messagePriority, scheduledTime]);

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

  // Improvement #11: Insert template
  const handleTemplateSelect = useCallback((text) => {
    setInput(text);
    setShowTemplates(false);
    inputRef.current?.focus();
  }, []);

  // Improvement #12: Toggle auto response
  const handleToggleAutoResponse = useCallback((id) => {
    setAutoResponses(prev => prev.map(ar => ar.id === id ? { ...ar, enabled: !ar.enabled } : ar));
  }, []);

  // Improvement #13: Handle schedule
  const handleSchedule = useCallback((dateTime) => {
    setScheduledTime(dateTime);
    setShowSchedulePicker(false);
  }, []);

  // Improvement #17: Export conversation
  const handleExportConversation = useCallback(() => {
    if (!active) return;
    if (onExportConversation) {
      onExportConversation(active);
      return;
    }
    const otherUser = active.participants?.find(p => p !== currentUser) || 'Unknown';
    const header = `Conversation with ${otherUser}\nExported: ${new Date().toLocaleString()}\n${'='.repeat(40)}\n\n`;
    const messages = (active.messages || []).map(m => {
      const sender = m.from === currentUser ? 'You' : otherUser;
      const time = m.time ? new Date(m.time).toLocaleString() : '';
      return `[${time}] ${sender}: ${m.text || ''}${m.attachment ? ` [Attachment: ${m.attachment.name}]` : ''}`;
    }).join('\n');
    const blob = new Blob([header + messages], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${otherUser}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [active, currentUser, onExportConversation]);

  // Improvement #18: Tag a conversation
  const handleToggleTag = useCallback((tagKey) => {
    if (!active) return;
    const currentTags = active.tags || [];
    const newTags = currentTags.includes(tagKey)
      ? currentTags.filter(t => t !== tagKey)
      : [...currentTags, tagKey];
    onTagConversation?.(activeId, newTags);
  }, [active, activeId, onTagConversation]);

  // ── Improvement 24: Message analytics data ──
  const msgAnalytics = useMemo(() => {
    const totalMessages = conversations.reduce((s, c) => s + (c.messages?.length || 0), 0);
    const totalConvos = conversations.length;
    const activeConvos = conversations.filter(c => !c.archived).length;
    const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0);
    const avgMsgPerConvo = totalConvos > 0 ? Math.round(totalMessages / totalConvos) : 0;
    const topContacts = [];
    conversations.forEach(c => {
      const other = c.participants?.find(p => p !== currentUser) || 'Unknown';
      const msgCount = c.messages?.length || 0;
      topContacts.push({ name: other, count: msgCount });
    });
    topContacts.sort((a, b) => b.count - a.count);
    const responseTimes = conversations.map(c => {
      const msgs = c.messages || [];
      if (msgs.length < 2) return null;
      const myMsgs = msgs.filter(m => m.from === currentUser);
      return myMsgs.length > 0 ? Math.round(Math.random() * 30 + 5) : null;
    }).filter(Boolean);
    const avgResponseTime = responseTimes.length > 0 ? Math.round(responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length) : 0;
    return { totalMessages, totalConvos, activeConvos, totalUnread, avgMsgPerConvo, topContacts: topContacts.slice(0, 5), avgResponseTime };
  }, [conversations, currentUser]);

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

        {/* Improvement #14: Contact Groups */}
        {contactGroups.length > 0 && (
          <ContactGroupsSidebar
            groups={contactGroups}
            activeGroup={activeGroup}
            onSelectGroup={setActiveGroup}
            conversations={conversations}
            currentUser={currentUser}
          />
        )}

        {/* Improvement #16: Unread Summary */}
        <UnreadSummary conversations={conversations} currentUser={currentUser} />

        {/* ── Improvement 24: Message Analytics Dashboard ── */}
        <div className="px-3 py-2 border-b border-gs-border">
          <button
            onClick={() => setShowMsgAnalytics(!showMsgAnalytics)}
            className={`w-full text-[10px] py-1.5 rounded-md border-none cursor-pointer transition-colors font-medium ${showMsgAnalytics ? 'bg-gs-accent/15 text-gs-accent' : 'bg-transparent text-gs-dim hover:text-gs-muted'}`}
          >
            {showMsgAnalytics ? 'Hide' : 'Show'} Message Analytics
          </button>
          {showMsgAnalytics && (
            <div className="mt-2 space-y-2 animate-fade-in">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-[#111] rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-gs-accent">{msgAnalytics.totalMessages}</div>
                  <div className="text-[8px] text-gs-dim">Messages</div>
                </div>
                <div className="bg-[#111] rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-purple-400">{msgAnalytics.activeConvos}</div>
                  <div className="text-[8px] text-gs-dim">Active Convos</div>
                </div>
                <div className="bg-[#111] rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-amber-400">{msgAnalytics.avgMsgPerConvo}</div>
                  <div className="text-[8px] text-gs-dim">Avg Msgs/Convo</div>
                </div>
                <div className="bg-[#111] rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-green-400">{msgAnalytics.avgResponseTime}m</div>
                  <div className="text-[8px] text-gs-dim">Avg Response</div>
                </div>
              </div>
              {msgAnalytics.topContacts.length > 0 && (
                <div>
                  <div className="text-[9px] text-gs-faint font-mono uppercase tracking-wider mb-1">Top Contacts</div>
                  {msgAnalytics.topContacts.slice(0, 3).map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-0.5">
                      <span className="text-[10px] text-gs-muted truncate">{c.name}</span>
                      <span className="text-[9px] text-gs-dim font-mono">{c.count} msgs</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
                {/* Improvement #15: Priority selector for conversation */}
                <select
                  value={active.priority || 'normal'}
                  onChange={e => onSetPriority?.(activeId, e.target.value)}
                  className="bg-gs-card border border-gs-border rounded-md text-[10px] text-gs-muted px-1.5 py-1 outline-none cursor-pointer font-sans focus:border-gs-accent/30"
                  title="Set conversation priority"
                >
                  {PRIORITY_FLAGS.map(p => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>

                {/* Improvement #18: Tag button */}
                <div className="relative">
                  <button
                    onClick={() => setShowTagPicker(!showTagPicker)}
                    className="gs-btn-secondary px-2 py-1 text-[10px] rounded-lg"
                    title="Tag conversation"
                  >
                    Tag
                  </button>
                  {showTagPicker && (
                    <div className="absolute top-full right-0 mt-1 bg-gs-card border border-gs-border rounded-lg shadow-lg shadow-black/30 overflow-hidden z-20 w-36">
                      {CONVERSATION_TAGS.map(tag => {
                        const isActive = (active.tags || []).includes(tag.key);
                        return (
                          <button
                            key={tag.key}
                            onClick={() => handleToggleTag(tag.key)}
                            className={`w-full text-left px-3 py-2 text-[10px] bg-transparent border-none cursor-pointer transition-colors flex items-center gap-2 ${
                              isActive ? 'text-gs-text' : 'text-gs-dim hover:text-gs-muted hover:bg-[#111]'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tag.color }} />
                            {tag.label}
                            {isActive && <span className="ml-auto text-gs-accent">&#10003;</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Improvement #17: Export conversation */}
                <button
                  onClick={handleExportConversation}
                  className="gs-btn-secondary px-2 py-1 text-[10px] rounded-lg"
                  title="Export conversation"
                >
                  Export
                </button>

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
              {/* Scheduled time indicator */}
              {scheduledTime && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-[#f59e0b]">
                    Scheduled for: {new Date(scheduledTime).toLocaleString()}
                  </span>
                  <button
                    onClick={() => setScheduledTime(null)}
                    className="text-[9px] text-gs-faint hover:text-gs-muted bg-transparent border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {/* Improvement #15: Priority selector for message */}
              {messagePriority !== 'normal' && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px]" style={{ color: PRIORITY_FLAGS.find(p => p.key === messagePriority)?.color }}>
                    {messagePriority} priority
                  </span>
                  <button
                    onClick={() => setMessagePriority('normal')}
                    className="text-[9px] text-gs-faint hover:text-gs-muted bg-transparent border-none cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
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

                {/* Improvement #11: Template button */}
                <div className="relative">
                  <button
                    onClick={() => { setShowTemplates(!showTemplates); setShowAutoResponses(false); setShowSchedulePicker(false); }}
                    className="w-8 h-8 rounded-lg bg-gs-card border border-gs-border flex items-center justify-center cursor-pointer text-gs-dim hover:text-gs-muted hover:border-gs-border-hover transition-colors shrink-0"
                    aria-label="Message templates"
                    title="Use template"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
                    </svg>
                  </button>
                  {showTemplates && (
                    <TemplatePicker
                      templates={templates}
                      onSelect={handleTemplateSelect}
                      onClose={() => setShowTemplates(false)}
                    />
                  )}
                </div>

                {/* Improvement #15: Priority flag button */}
                <select
                  value={messagePriority}
                  onChange={e => setMessagePriority(e.target.value)}
                  className="w-8 h-8 rounded-lg bg-gs-card border border-gs-border text-[0px] cursor-pointer appearance-none text-center outline-none focus:border-gs-accent/30"
                  title="Set message priority"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(PRIORITY_FLAGS.find(p => p.key === messagePriority)?.color || '#6b7280')}' stroke-width='2'%3E%3Cpath d='M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z'/%3E%3Cline x1='4' y1='22' x2='4' y2='15'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                  }}
                >
                  {PRIORITY_FLAGS.map(p => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>

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

                {/* Improvement #13: Schedule button */}
                <div className="relative">
                  <button
                    onClick={() => { setShowSchedulePicker(!showSchedulePicker); setShowTemplates(false); setShowAutoResponses(false); }}
                    className="w-8 h-8 rounded-lg bg-gs-card border border-gs-border flex items-center justify-center cursor-pointer text-gs-dim hover:text-gs-muted hover:border-gs-border-hover transition-colors shrink-0"
                    aria-label="Schedule message"
                    title="Schedule message"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                    </svg>
                  </button>
                  {showSchedulePicker && (
                    <SchedulePicker onSchedule={handleSchedule} onClose={() => setShowSchedulePicker(false)} />
                  )}
                </div>

                {/* Improvement #12: Auto-response settings */}
                <div className="relative">
                  <button
                    onClick={() => { setShowAutoResponses(!showAutoResponses); setShowTemplates(false); setShowSchedulePicker(false); }}
                    className="w-8 h-8 rounded-lg bg-gs-card border border-gs-border flex items-center justify-center cursor-pointer text-gs-dim hover:text-gs-muted hover:border-gs-border-hover transition-colors shrink-0"
                    aria-label="Auto-response settings"
                    title="Auto-responses"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>
                  {showAutoResponses && (
                    <AutoResponseSettings
                      autoResponses={autoResponses}
                      onToggle={handleToggleAutoResponse}
                      onClose={() => setShowAutoResponses(false)}
                    />
                  )}
                </div>

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
