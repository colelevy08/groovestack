// Reusable styled dropdown with optional uppercase label.
// Supports searchable options, multi-select, consistent styling with other form elements,
// grouped options, create new option, loading state, option descriptions,
// async option loading, and option previews (image/icon per option).
import { useState, useRef, useEffect, useCallback } from 'react';

export default function FormSelect({
  label,
  value,
  onChange,
  options,
  searchable,
  multi,
  grouped,
  creatable,
  onCreateOption,
  loading,
  asyncLoadOptions,  // Improvement 10: Async function that returns options
  optionPreviews,    // Improvement 11: Enable image/icon previews per option
}) {
  // Async option loading state
  const [asyncOptions, setAsyncOptions] = useState(null);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [asyncError, setAsyncError] = useState(null);
  const asyncLoadedRef = useRef(false);

  // Load async options on mount or when asyncLoadOptions changes
  useEffect(() => {
    if (!asyncLoadOptions) return;
    let cancelled = false;
    setAsyncLoading(true);
    setAsyncError(null);
    asyncLoadOptions()
      .then(result => {
        if (!cancelled) {
          setAsyncOptions(result);
          setAsyncLoading(false);
          asyncLoadedRef.current = true;
        }
      })
      .catch(err => {
        if (!cancelled) {
          setAsyncError(err?.message || 'Failed to load options');
          setAsyncLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [asyncLoadOptions]);

  const retryAsync = useCallback(() => {
    if (!asyncLoadOptions) return;
    setAsyncLoading(true);
    setAsyncError(null);
    asyncLoadOptions()
      .then(result => {
        setAsyncOptions(result);
        setAsyncLoading(false);
      })
      .catch(err => {
        setAsyncError(err?.message || 'Failed to load options');
        setAsyncLoading(false);
      });
  }, [asyncLoadOptions]);

  // Resolve options: use async results if available, otherwise use prop
  const resolvedOptions = asyncLoadOptions ? (asyncOptions || []) : (options || []);
  const isLoading = loading || asyncLoading;

  // Normalize options to { value, label, description?, image?, icon? } objects
  const normalizedOptions = grouped
    ? resolvedOptions // grouped options are pre-structured
    : resolvedOptions.map(o =>
        typeof o === 'string' ? { value: o, label: o } : o
      );

  // For simple (non-searchable, non-multi, non-grouped) mode, use native select (backwards compatible)
  if (!searchable && !multi && !grouped && !creatable && !optionPreviews && !asyncLoadOptions) {
    return (
      <div className="mb-4">
        {label && <label className="gs-label block mb-1.5">{label}</label>}
        <div className="relative">
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={isLoading}
            className={`w-full bg-gs-card border border-[#222] rounded-lg px-3 py-2.5 text-neutral-100 text-[13px] outline-none font-sans cursor-pointer focus:border-gs-accent/40 focus:ring-1 focus:ring-gs-accent/20 transition-all duration-150 ${isLoading ? 'opacity-60 cursor-wait' : ''}`}
          >
            {normalizedOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {isLoading && (
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

  // Custom dropdown for searchable / multi-select / grouped / creatable / async / previews
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
      loading={isLoading}
      asyncError={asyncError}
      onRetryAsync={retryAsync}
      optionPreviews={optionPreviews}
    />
  );
}

function CustomSelect({ label, value, onChange, options, searchable, multi, grouped, creatable, onCreateOption, loading, asyncError, onRetryAsync, optionPreviews }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // For multi-select, value is an array
  const selected = multi ? (Array.isArray(value) ? value : []) : value;

  // Flatten grouped options for filtering
  const flatOptions = grouped
    ? options.flatMap(g => (g.options || []).map(o => ({
        ...o,
        _group: g.group,
      })))
    : options;

  const filtered = flatOptions.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  // Check if search term matches no existing option (for creatable)
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

  // Group filtered options back into groups for rendering
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
          {/* Option preview: image or icon */}
          {optionPreviews && o.image && (
            <img
              src={o.image}
              alt=""
              className="w-5 h-5 rounded object-cover mr-2 shrink-0 border border-gs-border"
            />
          )}
          {optionPreviews && o.icon && !o.image && (
            <span className="w-5 h-5 flex items-center justify-center mr-2 shrink-0 text-gs-dim">
              {o.icon}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="truncate">{o.label}</div>
            {/* Option descriptions */}
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
              {/* Preview in selected tag */}
              {optionPreviews && opt?.image && (
                <img src={opt.image} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />
              )}
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
        {displayLabel && (
          <span className={multi && selected.length === 0 ? 'text-gs-faint' : 'flex items-center gap-2'}>
            {/* Show selected option preview in trigger */}
            {optionPreviews && !multi && value && (() => {
              const selectedOpt = flatOptions.find(o => o.value === value);
              if (selectedOpt?.image) return <img src={selectedOpt.image} alt="" className="w-4 h-4 rounded-sm object-cover inline" />;
              if (selectedOpt?.icon) return <span className="inline-flex items-center text-gs-dim">{selectedOpt.icon}</span>;
              return null;
            })()}
            {displayLabel}
          </span>
        )}
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

            {/* Async error state */}
            {asyncError && (
              <div className="px-3 py-3 text-center">
                <p className="text-red-400 text-[12px] mb-2">{asyncError}</p>
                {onRetryAsync && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRetryAsync(); }}
                    className="text-[11px] text-gs-accent bg-transparent border border-gs-accent/30 rounded px-2 py-1 cursor-pointer hover:bg-gs-accent/10 transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            <div className="max-h-48 overflow-y-auto">
              {/* Render grouped options */}
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
                  {filtered.length === 0 && !canCreate && !asyncError && (
                    <div className="px-3 py-2 text-gs-faint text-[12px]">
                      {loading ? 'Loading options...' : 'No results'}
                    </div>
                  )}
                  {filtered.map(renderOption)}
                </>
              )}

              {/* Create new option button */}
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
