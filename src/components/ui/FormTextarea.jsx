// Reusable styled textarea with optional uppercase label.
// Supports character count with max length, auto-resize, markdown preview toggle,
// word count display, undo support via history stack, and tab indent support.
import { useState, useRef, useEffect, useCallback } from 'react';

export default function FormTextarea({
  label, value, onChange, placeholder, rows = 3,
  maxLength, showCount, autoResize, markdownPreview,
  showWordCount,   // Improvement 21: Word count display
  enableTabIndent, // Improvement 22: Tab indent support
  enableUndo,      // Improvement 23: Undo/redo support via history stack
}) {
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef(null);

  // Improvement 23: Undo/redo history stack
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

  const handleChange = (e) => {
    const newValue = e.target.value;
    // Push to undo history if not an undo/redo action
    if (enableUndo && !isUndoRedoRef.current) {
      historyRef.current.past.push(value || '');
      historyRef.current.future = [];
      // Limit history depth
      if (historyRef.current.past.length > 100) {
        historyRef.current.past.shift();
      }
    }
    isUndoRedoRef.current = false;
    onChange(newValue);
  };

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

  // Improvement 22: Tab indent and Improvement 23: Undo/redo keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    // Tab indent support
    if (enableTabIndent && e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (e.shiftKey) {
        // Outdent: remove leading tab or 2 spaces from current line
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
        // Indent: insert two spaces
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

    // Improvement 23: Undo/redo keyboard shortcuts
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
  }, [value, onChange, enableTabIndent, enableUndo, handleUndo, handleRedo]);

  const charCount = value?.length || 0;
  const overLimit = maxLength && charCount >= maxLength;

  // Improvement 21: Word count calculation
  const wordCount = value ? value.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="mb-4">
      {(label || markdownPreview) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <label className="gs-label">{label}</label>}
          <div className="flex items-center gap-3">
            {/* Improvement 23: Undo/redo buttons */}
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

      {(showCount || maxLength || showWordCount) && (
        <div className="flex justify-between mt-1">
          {/* Improvement 21: Word count */}
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
  // Process inline markdown: **bold**, *italic*, `code`, [links](url)
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Italic
    const italicMatch = remaining.match(/\*(.+?)\*/);
    // Code
    const codeMatch = remaining.match(/`(.+?)`/);
    // Link
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
