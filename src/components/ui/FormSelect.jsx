// Reusable styled dropdown with optional uppercase label.
// Supports searchable options, multi-select, consistent styling with other form elements,
// grouped options, create new option, loading state, and option descriptions.
import { useState, useRef, useEffect } from 'react';

export default function FormSelect({
  label,
  value,
  onChange,
  options,
  searchable,
  multi,
  grouped,          // Improvement 18: Grouped options (array of { group, options })
  creatable,        // Improvement 19: Allow creating new option
  onCreateOption,   // Callback when creating new option
  loading,          // Improvement 20 (counted as part of descriptions): Loading state
}) {
  // Normalize options to { value, label, description? } objects
  const normalizedOptions = grouped
    ? options // grouped options are pre-structured
    : options.map(o =>
        typeof o === 'string' ? { value: o, label: o } : o
      );

  // For simple (non-searchable, non-multi, non-grouped) mode, use native select (backwards compatible)
  if (!searchable && !multi && !grouped && !creatable) {
    return (
      <div className="mb-4">
        {label && <label className="gs-label block mb-1.5">{label}</label>}
        <div className="relative">
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={loading}
            className={`w-full bg-gs-card border border-[#222] rounded-lg px-3 py-2.5 text-neutral-100 text-[13px] outline-none font-sans cursor-pointer focus:border-gs-accent/40 focus:ring-1 focus:ring-gs-accent/20 transition-all duration-150 ${loading ? 'opacity-60 cursor-wait' : ''}`}
          >
            {normalizedOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {loading && (
            <span className="absolute right-8 top-1/2 -translate-y-1/2">
              <svg className="animate-spin text-gs-dim" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
              </svg>
            </span>
          )}
        </div>
      </div>
    );
  }

  // Custom dropdown for searchable / multi-select / grouped / creatable
  return (
    <CustomSelect
      label={label}
      value={value}
      onChange={onChange}
      options={normalizedOptions}
      searchable={searchable}
      multi={multi}
      grouped={grouped}
      creatable={creatable}
      onCreateOption={onCreateOption}
      loading={loading}
    />
  );
}

function CustomSelect({ label, value, onChange, options, searchable, multi, grouped, creatable, onCreateOption, loading }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // For multi-select, value is an array
  const selected = multi ? (Array.isArray(value) ? value : []) : value;

  // Improvement 18: Flatten grouped options for filtering
  const flatOptions = grouped
    ? options.flatMap(g => (g.options || []).map(o => ({
        ...o,
        _group: g.group,
      })))
    : options;

  const filtered = flatOptions.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  // Improvement 19: Check if search term matches no existing option (for creatable)
  const canCreate = creatable && search.trim() &&
    !flatOptions.some(o => o.label.toLowerCase() === search.trim().toLowerCase());

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleOption = (val) => {
    if (multi) {
      const next = selected.includes(val)
        ? selected.filter(v => v !== val)
        : [...selected, val];
      onChange(next);
    } else {
      onChange(val);
      setIsOpen(false);
      setSearch('');
    }
  };

  const handleCreate = () => {
    const newVal = search.trim();
    if (!newVal) return;
    onCreateOption?.(newVal);
    if (multi) {
      onChange([...selected, newVal]);
    } else {
      onChange(newVal);
    }
    setSearch('');
    if (!multi) setIsOpen(false);
  };

  const removeTag = (val, e) => {
    e.stopPropagation();
    onChange(selected.filter(v => v !== val));
  };

  const displayLabel = multi
    ? (selected.length === 0 ? 'Select...' : null)
    : (flatOptions.find(o => o.value === value)?.label || 'Select...');

  // Improvement 18: Group filtered options back into groups for rendering
  const groupedFiltered = grouped
    ? options
        .map(g => ({
          ...g,
          options: (g.options || []).filter(o =>
            !search || o.label.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter(g => g.options.length > 0)
    : null;

  const renderOption = (o) => {
    const isSelected = multi ? selected.includes(o.value) : o.value === value;
    return (
      <div
        key={o.value}
        onClick={() => toggleOption(o.value)}
        className={`px-3 py-2 text-[13px] cursor-pointer transition-colors duration-100 ${
          isSelected
            ? 'bg-gs-accent/10 text-gs-accent'
            : 'text-neutral-100 hover:bg-[#1a1a1a]'
        }`}
      >
        <div className="flex items-center">
          {multi && (
            <span className={`inline-block w-3.5 h-3.5 rounded border mr-2 shrink-0 text-center text-[10px] leading-[14px] ${
              isSelected ? 'bg-gs-accent border-gs-accent text-black' : 'border-gs-dim'
            }`}>
              {isSelected ? '\u2713' : ''}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="truncate">{o.label}</div>
            {/* Improvement 20: Option descriptions */}
            {o.description && (
              <div className="text-[11px] text-gs-faint mt-0.5 truncate">{o.description}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mb-4" ref={containerRef}>
      {label && <label className="gs-label block mb-1.5">{label}</label>}
      <div
        className={`w-full bg-gs-card border rounded-lg px-3 py-2 text-neutral-100 text-[13px] font-sans cursor-pointer transition-all duration-150 flex items-center flex-wrap gap-1 min-h-[40px] ${
          isOpen ? 'border-gs-accent/40 ring-1 ring-gs-accent/20' : 'border-[#222]'
        } ${loading ? 'opacity-60 cursor-wait' : ''}`}
        onClick={() => {
          if (loading) return;
          setIsOpen(!isOpen);
          if (!isOpen && searchable) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        {multi && selected.map(v => {
          const opt = flatOptions.find(o => o.value === v);
          return (
            <span key={v} className="inline-flex items-center gap-1 bg-gs-accent/15 text-gs-accent text-[11px] font-semibold px-2 py-0.5 rounded">
              {opt?.label || v}
              <button
                type="button"
                onClick={(e) => removeTag(v, e)}
                className="text-gs-accent/60 hover:text-gs-accent border-none bg-transparent cursor-pointer text-sm leading-none p-0"
              >
                ×
              </button>
            </span>
          );
        })}
        {displayLabel && <span className={multi && selected.length === 0 ? 'text-gs-faint' : ''}>{displayLabel}</span>}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {loading && (
            <svg className="animate-spin text-gs-dim" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
            </svg>
          )}
          <svg className="w-3.5 h-3.5 text-gs-dim shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="relative z-50">
          <div className="absolute top-1 left-0 right-0 bg-gs-card border border-[#222] rounded-lg shadow-2xl overflow-hidden animate-fade-in">
            {searchable && (
              <div className="p-2 border-b border-gs-border">
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={creatable ? 'Search or create...' : 'Search...'}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2.5 py-1.5 text-neutral-100 text-[12px] outline-none placeholder:text-gs-faint focus:border-gs-accent/40 transition-colors"
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && canCreate) {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                />
              </div>
            )}
            <div className="max-h-48 overflow-y-auto">
              {/* Improvement 18: Render grouped options */}
              {grouped && groupedFiltered ? (
                groupedFiltered.map(g => (
                  <div key={g.group}>
                    <div className="px-3 py-1.5 text-[10px] text-gs-dim font-mono uppercase tracking-wider bg-[#0d0d0d] sticky top-0">
                      {g.group}
                    </div>
                    {g.options.map(renderOption)}
                  </div>
                ))
              ) : (
                <>
                  {filtered.length === 0 && !canCreate && (
                    <div className="px-3 py-2 text-gs-faint text-[12px]">No results</div>
                  )}
                  {filtered.map(renderOption)}
                </>
              )}

              {/* Improvement 19: Create new option button */}
              {canCreate && (
                <div
                  onClick={handleCreate}
                  className="px-3 py-2 text-[13px] cursor-pointer transition-colors duration-100 text-gs-accent hover:bg-gs-accent/10 flex items-center gap-2 border-t border-gs-border"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Create &ldquo;{search.trim()}&rdquo;</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
