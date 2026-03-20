// Reusable search bar with icon, clear button, keyboard shortcut hint, suggestions dropdown,
// recent searches (localStorage), debounced input, filter chips, and loading spinner.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'gs-recent-searches';
const MAX_RECENT = 8;

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').slice(0, MAX_RECENT);
  } catch { return []; }
}

function saveRecentSearch(term) {
  if (!term.trim()) return;
  const recent = getRecentSearches().filter(s => s !== term.trim());
  recent.unshift(term.trim());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function clearRecentSearches() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function SearchBar({
  value = '',
  onChange,
  placeholder = 'Search...',
  suggestions = [],
  onSelect,
  className = '',
  autoFocus = false,
  loading = false,             // Improvement 25: Loading spinner
  filters = [],                // Improvement 24: Filter chips config - array of { key, label, options?, active? }
  activeFilters = {},          // Current active filter values - { [key]: value }
  onFilterChange,              // Callback when a filter changes - (key, value) => void
}) {
  const [focused, setFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState(getRecentSearches);
  const [debounced, setDebounced] = useState(value);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Debounce input — calls onChange after 250ms idle
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebounced(value);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  // Keyboard shortcut: Cmd+K / Ctrl+K to focus
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = useCallback((e) => {
    onChange(e.target.value);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  const handleSelect = useCallback((term) => {
    onChange(term);
    saveRecentSearch(term);
    setRecentSearches(getRecentSearches());
    setFocused(false);
    onSelect?.(term);
  }, [onChange, onSelect]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && value.trim()) {
      saveRecentSearch(value.trim());
      setRecentSearches(getRecentSearches());
      setFocused(false);
      onSelect?.(value.trim());
    }
    if (e.key === 'Escape') {
      setFocused(false);
      inputRef.current?.blur();
    }
  }, [value, onSelect]);

  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  // Improvement 24: Toggle a filter chip
  const handleFilterToggle = useCallback((filterKey, filterValue) => {
    if (!onFilterChange) return;
    const current = activeFilters[filterKey];
    // Toggle off if same value, otherwise set
    onFilterChange(filterKey, current === filterValue ? null : filterValue);
  }, [activeFilters, onFilterChange]);

  // Filter suggestions based on debounced value
  const filteredSuggestions = useMemo(() => {
    if (!debounced.trim()) return [];
    const q = debounced.toLowerCase();
    return suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 6);
  }, [debounced, suggestions]);

  const showDropdown = focused && (filteredSuggestions.length > 0 || (recentSearches.length > 0 && !value));

  // Count active filters
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Input container */}
      <div className="relative flex items-center">
        {/* Improvement 25: Search icon or loading spinner */}
        {loading ? (
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-dim pointer-events-none animate-spin"
            width="14" height="14" viewBox="0 0 24 24" fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
          </svg>
        ) : (
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-dim pointer-events-none"
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        )}

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full bg-gs-card border border-gs-border rounded-[10px] py-2.5 pl-9 pr-20 text-[#f0f0f0] text-[13px] outline-none font-sans transition-all duration-150 focus:border-gs-accent/30 focus:ring-1 focus:ring-gs-accent/20 placeholder:text-gs-faint"
          aria-label="Search"
        />

        {/* Right side: clear button or keyboard hint */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {value ? (
            <button
              onClick={handleClear}
              className="w-5 h-5 rounded-full bg-[#222] border-none cursor-pointer text-gs-muted text-xs flex items-center justify-center hover:bg-[#333] hover:text-gs-text transition-colors"
              aria-label="Clear search"
            >
              &times;
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#111] border border-[#222] text-[10px] text-gs-faint font-mono">
              &#8984;K
            </kbd>
          )}
        </div>
      </div>

      {/* Improvement 24: Filter chips row */}
      {filters.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                if (onFilterChange) {
                  filters.forEach(f => onFilterChange(f.key, null));
                }
              }}
              className="text-[10px] text-gs-faint hover:text-gs-muted bg-transparent border-none cursor-pointer font-mono px-1 transition-colors"
              aria-label="Clear all filters"
            >
              Clear
            </button>
          )}
          {filters.map(filter => {
            // Simple toggle chip (no sub-options)
            if (!filter.options) {
              const isActive = activeFilters[filter.key];
              return (
                <button
                  key={filter.key}
                  onClick={() => handleFilterToggle(filter.key, !isActive ? true : null)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent'
                      : 'bg-transparent border-gs-border text-gs-dim hover:border-gs-border-hover hover:text-gs-muted'
                  }`}
                >
                  {filter.icon && <span className="flex items-center">{filter.icon}</span>}
                  {filter.label}
                </button>
              );
            }

            // Chip with options (renders multiple sub-chips)
            return filter.options.map(opt => {
              const isActive = activeFilters[filter.key] === opt.value;
              return (
                <button
                  key={`${filter.key}-${opt.value}`}
                  onClick={() => handleFilterToggle(filter.key, opt.value)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent'
                      : 'bg-transparent border-gs-border text-gs-dim hover:border-gs-border-hover hover:text-gs-muted'
                  }`}
                >
                  {opt.label}
                </button>
              );
            });
          })}
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-gs-card border border-gs-border rounded-xl shadow-xl shadow-black/30 z-50 overflow-hidden animate-fade-in">
          {/* Suggestions from prop (when typing) */}
          {filteredSuggestions.length > 0 && (
            <div className="py-1.5">
              <div className="px-3 py-1.5 text-[10px] text-gs-dim font-mono uppercase tracking-wider">
                Suggestions
              </div>
              {filteredSuggestions.map((s, i) => (
                <button
                  key={`s-${i}`}
                  onClick={() => handleSelect(s)}
                  className="w-full text-left px-3 py-2 bg-transparent border-none cursor-pointer text-[13px] text-gs-muted hover:bg-[#111] hover:text-gs-text transition-colors flex items-center gap-2.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gs-dim shrink-0">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
          )}

          {/* Recent searches (when input is empty) */}
          {!value && recentSearches.length > 0 && (
            <div className="py-1.5">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] text-gs-dim font-mono uppercase tracking-wider">Recent</span>
                <button
                  onClick={handleClearRecent}
                  className="bg-transparent border-none text-[10px] text-gs-faint cursor-pointer hover:text-gs-muted transition-colors p-0"
                >
                  Clear all
                </button>
              </div>
              {recentSearches.map((s, i) => (
                <button
                  key={`r-${i}`}
                  onClick={() => handleSelect(s)}
                  className="w-full text-left px-3 py-2 bg-transparent border-none cursor-pointer text-[13px] text-gs-muted hover:bg-[#111] hover:text-gs-text transition-colors flex items-center gap-2.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gs-faint shrink-0">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
