// Reusable search bar with icon, clear button, keyboard shortcut hint, suggestions dropdown,
// recent searches (localStorage), debounced input, filter chips, loading spinner,
// voice search integration, and search history with clear all.
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
  loading = false,
  filters = [],
  activeFilters = {},
  onFilterChange,
  enableVoiceSearch = false, // Improvement 21: Voice search integration
  onVoiceResult,             // Callback with voice transcript
  showHistory = true,        // Improvement 22: Show search history section
}) {
  const [focused, setFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState(getRecentSearches);
  const [debounced, setDebounced] = useState(value);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);
  const recognitionRef = useRef(null);

  // Check for voice search support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRecognition && enableVoiceSearch);
  }, [enableVoiceSearch]);

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

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
    };
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

  // Remove a single recent search
  const handleRemoveRecent = useCallback((term, e) => {
    e.stopPropagation();
    const updated = getRecentSearches().filter(s => s !== term);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setRecentSearches(updated);
  }, []);

  // Voice search
  const startVoiceSearch = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      onChange(transcript);
      if (event.results[0]?.isFinal) {
        onVoiceResult?.(transcript);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onChange, onVoiceResult]);

  const stopVoiceSearch = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    setIsListening(false);
  }, []);

  // Toggle a filter chip
  const handleFilterToggle = useCallback((filterKey, filterValue) => {
    if (!onFilterChange) return;
    const current = activeFilters[filterKey];
    onFilterChange(filterKey, current === filterValue ? null : filterValue);
  }, [activeFilters, onFilterChange]);

  // Filter suggestions based on debounced value
  const filteredSuggestions = useMemo(() => {
    if (!debounced.trim()) return [];
    const q = debounced.toLowerCase();
    return suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 6);
  }, [debounced, suggestions]);

  const showDropdown = focused && (
    filteredSuggestions.length > 0 ||
    (showHistory && recentSearches.length > 0 && !value)
  );

  // Count active filters
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Input container */}
      <div className="relative flex items-center">
        {/* Search icon or loading spinner */}
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
          placeholder={isListening ? 'Listening...' : placeholder}
          autoFocus={autoFocus}
          className={`w-full bg-gs-card border border-gs-border rounded-[10px] py-2.5 pl-9 pr-20 text-[#f0f0f0] text-[13px] outline-none font-sans transition-all duration-150 focus:border-gs-accent/30 focus:ring-1 focus:ring-gs-accent/20 placeholder:text-gs-faint ${
            isListening ? 'border-red-400/50 ring-1 ring-red-400/20' : ''
          }`}
          aria-label="Search"
        />

        {/* Right side: voice button, clear button, or keyboard hint */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Voice search button */}
          {voiceSupported && !value && (
            <button
              onClick={isListening ? stopVoiceSearch : startVoiceSearch}
              className={`w-6 h-6 rounded-full border-none cursor-pointer flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-500/20 text-red-400 animate-pulse'
                  : 'bg-transparent text-gs-dim hover:text-gs-muted'
              }`}
              aria-label={isListening ? 'Stop voice search' : 'Voice search'}
              title={isListening ? 'Stop listening' : 'Search by voice'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          )}

          {value ? (
            <button
              onClick={handleClear}
              className="w-5 h-5 rounded-full bg-[#222] border-none cursor-pointer text-gs-muted text-xs flex items-center justify-center hover:bg-[#333] hover:text-gs-text transition-colors"
              aria-label="Clear search"
            >
              &times;
            </button>
          ) : !voiceSupported ? (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#111] border border-[#222] text-[10px] text-gs-faint font-mono">
              &#8984;K
            </kbd>
          ) : null}
        </div>
      </div>

      {/* Voice listening indicator */}
      {isListening && (
        <div className="flex items-center gap-2 mt-1.5 px-1">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[11px] text-red-400 font-medium">Listening... speak now</span>
          <button
            onClick={stopVoiceSearch}
            className="text-[10px] text-gs-dim bg-transparent border-none cursor-pointer hover:text-gs-muted ml-auto"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Filter chips row */}
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
          {showHistory && !value && recentSearches.length > 0 && (
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
                <div
                  key={`r-${i}`}
                  className="flex items-center group"
                >
                  <button
                    onClick={() => handleSelect(s)}
                    className="flex-1 text-left px-3 py-2 bg-transparent border-none cursor-pointer text-[13px] text-gs-muted hover:bg-[#111] hover:text-gs-text transition-colors flex items-center gap-2.5"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gs-faint shrink-0">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="truncate">{s}</span>
                  </button>
                  {/* Per-item remove button */}
                  <button
                    onClick={(e) => handleRemoveRecent(s, e)}
                    className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-transparent border-none cursor-pointer text-gs-faint text-xs flex items-center justify-center hover:text-gs-muted hover:bg-[#1a1a1a] transition-all mr-2 shrink-0"
                    aria-label={`Remove "${s}" from history`}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
