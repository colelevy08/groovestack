// Reusable styled textarea with optional uppercase label.
// Supports character count with max length, auto-resize, and markdown preview toggle.
import { useState, useRef, useEffect, useCallback } from 'react';

export default function FormTextarea({
  label, value, onChange, placeholder, rows = 3,
  maxLength, showCount, autoResize, markdownPreview,
}) {
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef(null);

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
    onChange(e.target.value);
  };

  const charCount = value?.length || 0;
  const overLimit = maxLength && charCount >= maxLength;

  return (
    <div className="mb-4">
      {(label || markdownPreview) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <label className="gs-label">{label}</label>}
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
          placeholder={placeholder}
          rows={autoResize ? 1 : rows}
          maxLength={maxLength}
          className={`w-full bg-gs-card border border-[#222] rounded-lg px-3 py-2.5 text-neutral-100 text-[13px] outline-none font-sans placeholder:text-gs-faint focus:border-gs-accent/40 focus:ring-1 focus:ring-gs-accent/20 transition-all duration-150 ${autoResize ? 'resize-none overflow-hidden' : 'resize-y'}`}
        />
      )}

      {(showCount || maxLength) && (
        <div className="flex justify-end mt-1">
          <span className={`text-[11px] font-mono ${overLimit ? 'text-red-400' : 'text-gs-faint'}`}>
            {charCount}{maxLength ? `/${maxLength}` : ''}
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
