// Standalone command palette with fuzzy search, recent commands, category grouping,
// keyboard navigation, and action shortcut display.
// Opens with Cmd+K / Ctrl+K. Fully self-contained overlay component.
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'gs-recent-commands';
const MAX_RECENT = 5;

function getRecentCommands() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').slice(0, MAX_RECENT);
  } catch { return []; }
}

function saveRecentCommand(commandId) {
  if (!commandId) return;
  const recent = getRecentCommands().filter(id => id !== commandId);
  recent.unshift(commandId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

// Simple fuzzy match — returns a score (higher = better) or -1 for no match
function fuzzyScore(query, text) {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  // Exact substring match gets highest priority
  if (t.includes(q)) return 100 + (q.length / t.length) * 50;
  // Fuzzy character-by-character match
  let qi = 0;
  let score = 0;
  let lastMatchIdx = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Bonus for consecutive matches
      score += lastMatchIdx === ti - 1 ? 10 : 1;
      lastMatchIdx = ti;
      qi++;
    }
  }
  return qi === q.length ? score : -1;
}

// Category icon map
function CategoryIcon({ category }) {
  const icons = {
    records: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
      </svg>
    ),
    users: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
    actions: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    navigation: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
    ),
  };
  return <span className="text-gs-dim shrink-0 flex items-center">{icons[category] || icons.actions}</span>;
}

function ShortcutKeys({ shortcut }) {
  if (!shortcut) return null;
  const parts = shortcut.split('+');
  return (
    <span className="flex items-center gap-0.5 shrink-0">
      {parts.map((key, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded bg-[#111] border border-[#222] text-[10px] text-gs-faint font-mono"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

export default function CommandPalette({
  commands = [],
  open = false,
  onClose,
  onSelect,
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState(getRecentCommands);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef({});

  // Build grouped, filtered results
  const results = useMemo(() => {
    if (!query.trim()) {
      // Show recent commands first, then all grouped by category
      const recentCommands = recentIds
        .map(id => commands.find(c => c.id === id))
        .filter(Boolean);

      const groups = [];
      if (recentCommands.length > 0) {
        groups.push({ category: 'recent', label: 'Recent', items: recentCommands });
      }

      // Group remaining by category
      const categoryMap = {};
      commands.forEach(cmd => {
        if (recentCommands.some(r => r.id === cmd.id)) return;
        const cat = cmd.category || 'actions';
        if (!categoryMap[cat]) categoryMap[cat] = [];
        categoryMap[cat].push(cmd);
      });
      Object.entries(categoryMap).forEach(([cat, items]) => {
        groups.push({ category: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1), items });
      });
      return groups;
    }

    // Fuzzy search across all commands
    const scored = commands
      .map(cmd => {
        const nameScore = fuzzyScore(query, cmd.label || '');
        const descScore = fuzzyScore(query, cmd.description || '') * 0.5;
        const catScore = fuzzyScore(query, cmd.category || '') * 0.3;
        const best = Math.max(nameScore, descScore, catScore);
        return { cmd, score: best };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return [];
    return [{ category: 'results', label: 'Results', items: scored.map(s => s.cmd) }];
  }, [query, commands, recentIds]);

  // Flat list of all visible items for keyboard navigation
  const flatItems = useMemo(() => results.flatMap(g => g.items), [results]);

  // Reset active index when results change
  useEffect(() => { setActiveIndex(0); }, [query]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setRecentIds(getRecentCommands());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Global keyboard shortcut to open
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) {
          onClose?.();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeIndex]);

  const handleSelect = useCallback((cmd) => {
    if (!cmd) return;
    saveRecentCommand(cmd.id);
    setRecentIds(getRecentCommands());
    onSelect?.(cmd);
    onClose?.();
  }, [onSelect, onClose]);

  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % Math.max(flatItems.length, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + flatItems.length) % Math.max(flatItems.length, 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatItems[activeIndex]) handleSelect(flatItems[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        onClose?.();
        break;
      default:
        break;
    }
  }, [flatItems, activeIndex, handleSelect, onClose]);

  if (!open) return null;

  let itemCounter = 0;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-start justify-center pt-[15vh] z-[2000] backdrop-blur-sm animate-overlay-in"
      onClick={e => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="w-full max-w-[520px] bg-gs-card border border-gs-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-modal-in"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gs-border">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gs-dim shrink-0">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent border-none text-[14px] text-gs-text outline-none font-sans placeholder:text-gs-faint"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-[#111] border border-[#222] text-[10px] text-gs-faint font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-1.5" role="listbox">
          {results.length === 0 && query.trim() ? (
            <div className="text-center py-8 text-gs-faint text-[12px]">
              No commands found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map(group => {
              const groupItems = group.items.map(cmd => {
                const idx = itemCounter++;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={cmd.id}
                    ref={el => { itemRefs.current[idx] = el; }}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(cmd)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-none cursor-pointer transition-colors duration-75 ${
                      isActive ? 'bg-gs-accent/10 text-gs-text' : 'bg-transparent text-gs-muted hover:bg-[#111]'
                    }`}
                  >
                    <CategoryIcon category={cmd.category} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium block truncate">{cmd.label}</span>
                      {cmd.description && (
                        <span className="text-[10px] text-gs-dim block truncate">{cmd.description}</span>
                      )}
                    </div>
                    <ShortcutKeys shortcut={cmd.shortcut} />
                  </button>
                );
              });

              return (
                <div key={group.category}>
                  <div className="px-4 py-1.5 text-[10px] text-gs-dim font-mono uppercase tracking-wider">
                    {group.label}
                  </div>
                  {groupItems}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gs-border">
          <span className="flex items-center gap-1 text-[10px] text-gs-faint">
            <kbd className="px-1 py-0.5 rounded bg-[#111] border border-[#222] text-[9px] font-mono">&uarr;&darr;</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1 text-[10px] text-gs-faint">
            <kbd className="px-1 py-0.5 rounded bg-[#111] border border-[#222] text-[9px] font-mono">&crarr;</kbd>
            Select
          </span>
          <span className="flex items-center gap-1 text-[10px] text-gs-faint">
            <kbd className="px-1 py-0.5 rounded bg-[#111] border border-[#222] text-[9px] font-mono">ESC</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
