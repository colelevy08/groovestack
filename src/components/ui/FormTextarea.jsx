// Reusable styled textarea with optional uppercase label.
// Supports character count with max length, auto-resize, markdown preview toggle,
// word count display, undo support via history stack, tab indent support,
// mention auto-complete (@users), and emoji shortcode replacement.
import { useState, useRef, useEffect, useCallback } from 'react';

// --- Emoji shortcode map ---
const EMOJI_MAP = {
  ':smile:': '\u{1F604}', ':laugh:': '\u{1F602}', ':heart:': '\u2764\uFE0F', ':thumbsup:': '\u{1F44D}',
  ':thumbsdown:': '\u{1F44E}', ':fire:': '\u{1F525}', ':star:': '\u2B50', ':check:': '\u2705',
  ':x:': '\u274C', ':wave:': '\u{1F44B}', ':clap:': '\u{1F44F}', ':rocket:': '\u{1F680}',
  ':eyes:': '\u{1F440}', ':thinking:': '\u{1F914}', ':100:': '\u{1F4AF}', ':party:': '\u{1F389}',
  ':cry:': '\u{1F622}', ':sunglasses:': '\u{1F60E}', ':ok:': '\u{1F44C}', ':pray:': '\u{1F64F}',
  ':muscle:': '\u{1F4AA}', ':sparkles:': '\u2728', ':warning:': '\u26A0\uFE0F', ':bulb:': '\u{1F4A1}',
  ':music:': '\u{1F3B5}', ':vinyl:': '\u{1F4BF}', ':headphones:': '\u{1F3A7}', ':mic:': '\u{1F3A4}',
};

const EMOJI_SHORTCODES = Object.keys(EMOJI_MAP);

export default function FormTextarea({
  label, value, onChange, placeholder, rows = 3,
  maxLength, showCount, autoResize, markdownPreview,
  showWordCount,
  enableTabIndent,
  enableUndo,
  // Improvement 12: Mention auto-complete
  enableMentions,     // Enable @mention support
  mentionUsers = [],  // Array of { username, displayName?, avatarUrl? }
  onMention,          // Callback when a user is mentioned
  // Improvement 13: Emoji shortcode replacement
  enableEmoji = false, // Enable :shortcode: auto-replacement
}) {
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef(null);

  // Mention state
  const [mentionQuery, setMentionQuery] = useState(null); // null = not active, string = search query
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const mentionStartRef = useRef(null); // cursor position of the @ character

  // Emoji suggestion state
  const [emojiQuery, setEmojiQuery] = useState(null);
  const [emojiIndex, setEmojiIndex] = useState(0);

  // Undo/redo history stack
  const historyRef = useRef({ past: [], future: [] });
  const isUndoRedoRef = useRef(false);

  const handleAutoResize = useCallback(() => {
    if (autoResize && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [autoResize]);

  useEffect(() => {
    handleAutoResize();
  }, [value, handleAutoResize]);

  // Filter mention users based on query
  const filteredMentions = mentionQuery != null
    ? mentionUsers.filter(u => {
        const q = mentionQuery.toLowerCase();
        const name = (u.displayName || u.username || '').toLowerCase();
        const uname = (u.username || '').toLowerCase();
        return name.includes(q) || uname.includes(q);
      }).slice(0, 6)
    : [];

  // Filter emoji shortcodes based on query
  const filteredEmojis = emojiQuery != null
    ? EMOJI_SHORTCODES.filter(code => code.slice(1, -1).includes(emojiQuery.toLowerCase())).slice(0, 6)
    : [];

  const handleChange = (e) => {
    let newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    // Push to undo history if not an undo/redo action
    if (enableUndo && !isUndoRedoRef.current) {
      historyRef.current.past.push(value || '');
      historyRef.current.future = [];
      if (historyRef.current.past.length > 100) {
        historyRef.current.past.shift();
      }
    }
    isUndoRedoRef.current = false;

    // Emoji shortcode replacement
    if (enableEmoji) {
      const textBefore = newValue.slice(0, cursorPos);
      const emojiMatch = textBefore.match(/(:[a-z0-9_]+:)$/);
      if (emojiMatch && EMOJI_MAP[emojiMatch[1]]) {
        const emoji = EMOJI_MAP[emojiMatch[1]];
        const start = cursorPos - emojiMatch[1].length;
        newValue = newValue.slice(0, start) + emoji + newValue.slice(cursorPos);
        onChange(newValue);
        // Move cursor after the emoji
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            const newPos = start + emoji.length;
            textareaRef.current.selectionStart = newPos;
            textareaRef.current.selectionEnd = newPos;
          }
        });
        setEmojiQuery(null);
        return;
      }

      // Check for in-progress emoji shortcode
      const partialEmoji = textBefore.match(/:([a-z0-9_]{1,})$/);
      if (partialEmoji) {
        setEmojiQuery(partialEmoji[1]);
        setEmojiIndex(0);
      } else {
        setEmojiQuery(null);
      }
    }

    // Mention detection
    if (enableMentions) {
      const textBefore = newValue.slice(0, cursorPos);
      const mentionMatch = textBefore.match(/@(\w*)$/);
      if (mentionMatch) {
        setMentionQuery(mentionMatch[1]);
        setMentionIndex(0);
        mentionStartRef.current = cursorPos - mentionMatch[0].length;
      } else {
        setMentionQuery(null);
        mentionStartRef.current = null;
      }
    }

    onChange(newValue);
  };

  const insertMention = useCallback((user) => {
    const start = mentionStartRef.current;
    if (start == null) return;
    const textarea = textareaRef.current;
    const cursorPos = textarea ? textarea.selectionStart : (value || '').length;
    const username = user.username || user;
    const newValue = (value || '').slice(0, start) + `@${username} ` + (value || '').slice(cursorPos);

    if (enableUndo) {
      historyRef.current.past.push(value || '');
      historyRef.current.future = [];
    }

    onChange(newValue);
    setMentionQuery(null);
    mentionStartRef.current = null;
    onMention?.(user);

    requestAnimationFrame(() => {
      if (textarea) {
        const newPos = start + username.length + 2; // @username + space
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
        textarea.focus();
      }
    });
  }, [value, onChange, enableUndo, onMention]);

  const insertEmoji = useCallback((shortcode) => {
    const textarea = textareaRef.current;
    const cursorPos = textarea ? textarea.selectionStart : (value || '').length;
    const textBefore = (value || '').slice(0, cursorPos);
    const colonStart = textBefore.lastIndexOf(':');
    if (colonStart === -1) return;

    const emoji = EMOJI_MAP[shortcode];
    if (!emoji) return;

    const newValue = (value || '').slice(0, colonStart) + emoji + (value || '').slice(cursorPos);

    if (enableUndo) {
      historyRef.current.past.push(value || '');
      historyRef.current.future = [];
    }

    onChange(newValue);
    setEmojiQuery(null);

    requestAnimationFrame(() => {
      if (textarea) {
        const newPos = colonStart + emoji.length;
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
        textarea.focus();
      }
    });
  }, [value, onChange, enableUndo]);

  const handleUndo = useCallback(() => {
    const { past, future } = historyRef.current;
    if (past.length === 0) return;
    const previous = past.pop();
    future.push(value || '');
    isUndoRedoRef.current = true;
    onChange(previous);
  }, [value, onChange]);

  const handleRedo = useCallback(() => {
    const { future } = historyRef.current;
    if (future.length === 0) return;
    const next = future.pop();
    historyRef.current.past.push(value || '');
    isUndoRedoRef.current = true;
    onChange(next);
  }, [value, onChange]);

  const handleKeyDown = useCallback((e) => {
    // Mention dropdown keyboard navigation
    if (mentionQuery != null && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredMentions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredMentions.length) % filteredMentions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentions[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    // Emoji dropdown keyboard navigation
    if (emojiQuery != null && filteredEmojis.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setEmojiIndex(prev => (prev + 1) % filteredEmojis.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setEmojiIndex(prev => (prev - 1 + filteredEmojis.length) % filteredEmojis.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertEmoji(filteredEmojis[emojiIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setEmojiQuery(null);
        return;
      }
    }

    // Tab indent support
    if (enableTabIndent && e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (e.shiftKey) {
        const beforeCursor = value.slice(0, start);
        const lineStart = beforeCursor.lastIndexOf('\n') + 1;
        const linePrefix = value.slice(lineStart, start);
        if (linePrefix.startsWith('\t')) {
          const newValue = value.slice(0, lineStart) + value.slice(lineStart + 1);
          if (enableUndo) {
            historyRef.current.past.push(value);
            historyRef.current.future = [];
          }
          onChange(newValue);
          requestAnimationFrame(() => {
            textarea.selectionStart = Math.max(lineStart, start - 1);
            textarea.selectionEnd = Math.max(lineStart, end - 1);
          });
        } else if (linePrefix.startsWith('  ')) {
          const newValue = value.slice(0, lineStart) + value.slice(lineStart + 2);
          if (enableUndo) {
            historyRef.current.past.push(value);
            historyRef.current.future = [];
          }
          onChange(newValue);
          requestAnimationFrame(() => {
            textarea.selectionStart = Math.max(lineStart, start - 2);
            textarea.selectionEnd = Math.max(lineStart, end - 2);
          });
        }
      } else {
        const newValue = value.slice(0, start) + '  ' + value.slice(end);
        if (enableUndo) {
          historyRef.current.past.push(value);
          historyRef.current.future = [];
        }
        onChange(newValue);
        requestAnimationFrame(() => {
          textarea.selectionStart = start + 2;
          textarea.selectionEnd = start + 2;
        });
      }
      return;
    }

    // Undo/redo keyboard shortcuts
    if (enableUndo && (e.metaKey || e.ctrlKey)) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
    }
  }, [value, onChange, enableTabIndent, enableUndo, handleUndo, handleRedo, mentionQuery, filteredMentions, mentionIndex, insertMention, emojiQuery, filteredEmojis, emojiIndex, insertEmoji]);

  const charCount = value?.length || 0;
  const overLimit = maxLength && charCount >= maxLength;

  const wordCount = value ? value.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="mb-4">
      {(label || markdownPreview) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <label className="gs-label">{label}</label>}
          <div className="flex items-center gap-3">
            {/* Undo/redo buttons */}
            {enableUndo && !showPreview && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyRef.current.past.length === 0}
                  className="text-gs-dim hover:text-gs-accent bg-transparent border-none cursor-pointer p-0.5 transition-colors disabled:opacity-30 disabled:cursor-default"
                  aria-label="Undo"
                  title="Undo"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={historyRef.current.future.length === 0}
                  className="text-gs-dim hover:text-gs-accent bg-transparent border-none cursor-pointer p-0.5 transition-colors disabled:opacity-30 disabled:cursor-default"
                  aria-label="Redo"
                  title="Redo"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
                  </svg>
                </button>
              </div>
            )}
            {/* Emoji hint */}
            {enableEmoji && !showPreview && (
              <span className="text-[10px] text-gs-faint font-mono" title="Type :shortcode: for emoji">
                :emoji:
              </span>
            )}
            {markdownPreview && (
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-[10px] font-semibold tracking-wide text-gs-dim hover:text-gs-accent bg-transparent border-none cursor-pointer font-mono transition-colors"
              >
                {showPreview ? 'EDIT' : 'PREVIEW'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        {showPreview ? (
          <div
            className="w-full bg-gs-card border border-[#222] rounded-lg px-3 py-2.5 text-neutral-100 text-[13px] font-sans min-h-[80px] overflow-auto prose-invert"
            style={{ minHeight: rows * 24 }}
          >
            <MarkdownRenderer text={value || ''} />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={autoResize ? 1 : rows}
            maxLength={maxLength}
            className={`w-full bg-gs-card border border-[#222] rounded-lg px-3 py-2.5 text-neutral-100 text-[13px] outline-none font-sans placeholder:text-gs-faint focus:border-gs-accent/40 focus:ring-1 focus:ring-gs-accent/20 transition-all duration-150 ${autoResize ? 'resize-none overflow-hidden' : 'resize-y'}`}
          />
        )}

        {/* Mention autocomplete dropdown */}
        {mentionQuery != null && filteredMentions.length > 0 && !showPreview && (
          <div className="absolute bottom-full left-0 mb-1 bg-gs-card border border-gs-border rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in min-w-[200px] max-w-[300px]">
            <div className="px-2.5 py-1.5 text-[10px] text-gs-dim font-mono uppercase tracking-wider border-b border-gs-border">
              Mention a user
            </div>
            {filteredMentions.map((user, i) => (
              <div
                key={user.username}
                onClick={() => insertMention(user)}
                className={`px-3 py-2 text-[13px] cursor-pointer transition-colors duration-100 flex items-center gap-2 ${
                  i === mentionIndex ? 'bg-gs-accent/10 text-gs-accent' : 'text-neutral-100 hover:bg-[#1a1a1a]'
                }`}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[10px] font-bold text-gs-muted shrink-0">
                    {(user.displayName || user.username || '?')[0].toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold truncate">{user.displayName || user.username}</div>
                  <div className="text-[10px] text-gs-faint truncate">@{user.username}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Emoji shortcode autocomplete dropdown */}
        {emojiQuery != null && filteredEmojis.length > 0 && !showPreview && (
          <div className="absolute bottom-full left-0 mb-1 bg-gs-card border border-gs-border rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in min-w-[180px]">
            <div className="px-2.5 py-1.5 text-[10px] text-gs-dim font-mono uppercase tracking-wider border-b border-gs-border">
              Emoji
            </div>
            {filteredEmojis.map((code, i) => (
              <div
                key={code}
                onClick={() => insertEmoji(code)}
                className={`px-3 py-1.5 text-[13px] cursor-pointer transition-colors duration-100 flex items-center gap-2 ${
                  i === emojiIndex ? 'bg-gs-accent/10 text-gs-accent' : 'text-neutral-100 hover:bg-[#1a1a1a]'
                }`}
              >
                <span className="text-base">{EMOJI_MAP[code]}</span>
                <span className="text-[11px] text-gs-faint font-mono">{code}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {(showCount || maxLength || showWordCount) && (
        <div className="flex justify-between mt-1">
          {/* Word count */}
          {showWordCount && (
            <span className="text-[11px] font-mono text-gs-faint">
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
          )}
          <span className={`text-[11px] font-mono ml-auto ${overLimit ? 'text-red-400' : 'text-gs-faint'}`}>
            {(showCount || maxLength) ? `${charCount}${maxLength ? `/${maxLength}` : ''}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

// Simple markdown renderer — handles bold, italic, inline code, links, and line breaks.
function MarkdownRenderer({ text }) {
  const lines = text.split('\n');
  return (
    <div className="text-[13px] leading-relaxed">
      {lines.map((line, i) => (
        <p key={i} className={`m-0 ${line.trim() === '' ? 'h-3' : ''}`}>
          <MarkdownLine text={line} />
        </p>
      ))}
    </div>
  );
}

function MarkdownLine({ text }) {
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/\*(.+?)\*/);
    const codeMatch = remaining.match(/`(.+?)`/);
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);

    const matches = [
      boldMatch && { type: 'bold', match: boldMatch },
      italicMatch && { type: 'italic', match: italicMatch },
      codeMatch && { type: 'code', match: codeMatch },
      linkMatch && { type: 'link', match: linkMatch },
    ].filter(Boolean).sort((a, b) => a.match.index - b.match.index);

    if (matches.length === 0) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    const first = matches[0];
    const before = remaining.slice(0, first.match.index);
    if (before) parts.push(<span key={key++}>{before}</span>);

    if (first.type === 'bold') {
      parts.push(<strong key={key++} className="font-bold">{first.match[1]}</strong>);
    } else if (first.type === 'italic') {
      parts.push(<em key={key++}>{first.match[1]}</em>);
    } else if (first.type === 'code') {
      parts.push(<code key={key++} className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-gs-accent text-[12px] font-mono">{first.match[1]}</code>);
    } else if (first.type === 'link') {
      parts.push(<a key={key++} href={first.match[2]} className="text-gs-accent hover:underline" target="_blank" rel="noopener noreferrer">{first.match[1]}</a>);
    }

    remaining = remaining.slice(first.match.index + first.match[0].length);
  }

  return <>{parts}</>;
}
