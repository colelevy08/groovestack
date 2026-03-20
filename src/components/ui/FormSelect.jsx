// Reusable styled dropdown with optional uppercase label.
// Supports searchable options, multi-select, and consistent styling with other form elements.
import { useState, useRef, useEffect } from 'react';

export default function FormSelect({ label, value, onChange, options, searchable, multi }) {
  // Normalize options to { value, label } objects
  const normalizedOptions = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  );

  // For simple (non-searchable, non-multi) mode, use native select (backwards compatible)
  if (!searchable && !multi) {
    return (
      <div className="mb-4">
        {label && <label className="gs-label block mb-1.5">{label}</label>}
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-gs-card border border-[#222] rounded-lg px-3 py-2.5 text-neutral-100 text-[13px] outline-none font-sans cursor-pointer focus:border-gs-accent/40 focus:ring-1 focus:ring-gs-accent/20 transition-all duration-150"
        >
          {normalizedOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  // Custom dropdown for searchable / multi-select
  return (
    <CustomSelect
      label={label}
      value={value}
      onChange={onChange}
      options={normalizedOptions}
      searchable={searchable}
      multi={multi}
    />
  );
}

function CustomSelect({ label, value, onChange, options, searchable, multi }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // For multi-select, value is an array
  const selected = multi ? (Array.isArray(value) ? value : []) : value;

  const filtered = options.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

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

  const removeTag = (val, e) => {
    e.stopPropagation();
    onChange(selected.filter(v => v !== val));
  };

  const displayLabel = multi
    ? (selected.length === 0 ? 'Select...' : null)
    : (options.find(o => o.value === value)?.label || 'Select...');

  return (
    <div className="mb-4" ref={containerRef}>
      {label && <label className="gs-label block mb-1.5">{label}</label>}
      <div
        className={`w-full bg-gs-card border rounded-lg px-3 py-2 text-neutral-100 text-[13px] font-sans cursor-pointer transition-all duration-150 flex items-center flex-wrap gap-1 min-h-[40px] ${
          isOpen ? 'border-gs-accent/40 ring-1 ring-gs-accent/20' : 'border-[#222]'
        }`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && searchable) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        {multi && selected.map(v => {
          const opt = options.find(o => o.value === v);
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
        <svg className="ml-auto w-3.5 h-3.5 text-gs-dim shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
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
                  placeholder="Search..."
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2.5 py-1.5 text-neutral-100 text-[12px] outline-none placeholder:text-gs-faint focus:border-gs-accent/40 transition-colors"
                  onClick={e => e.stopPropagation()}
                />
              </div>
            )}
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-gs-faint text-[12px]">No results</div>
              )}
              {filtered.map(o => {
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
                    {multi && (
                      <span className={`inline-block w-3.5 h-3.5 rounded border mr-2 align-middle text-center text-[10px] leading-[14px] ${
                        isSelected ? 'bg-gs-accent border-gs-accent text-black' : 'border-gs-dim'
                      }`}>
                        {isSelected ? '✓' : ''}
                      </span>
                    )}
                    {o.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
