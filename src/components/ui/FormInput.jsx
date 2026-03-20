// Reusable styled text input with optional uppercase label.
// Focus ring uses the accent color. Calls onChange with raw string value.
// Supports error/success states, character count, prefix/suffix icons, clear button,
// password visibility toggle, copy-to-clipboard button, and loading state.
import { useState, useCallback } from 'react';

export default function FormInput({
  label, value, onChange, placeholder, type = "text", style = {},
  error, success, maxLength, showCount, prefix, suffix, clearable,
  copyable,      // Improvement 16: Copy button for the input value
  loading,       // Improvement 17: Loading state with spinner
}) {
  const id = label ? label.toLowerCase().replace(/\s+/g, '-') : undefined;
  const hasValue = value != null && value !== '';

  // Improvement 15: Password visibility toggle
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && showPassword ? 'text' : type;

  // Improvement 16: Copy state feedback
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  const borderClass = error
    ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/20'
    : success
    ? 'border-emerald-500/60 focus:border-emerald-500/80 focus:ring-emerald-500/20'
    : 'border-[#222] focus:border-gs-accent/40 focus:ring-gs-accent/20';

  // Calculate right padding based on what icons are shown
  const hasRightIcon = isPassword || copyable || clearable || suffix; // eslint-disable-line no-unused-vars

  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={id} className="gs-label block mb-1.5">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {/* Improvement 17: Loading spinner prefix */}
        {loading && (
          <span className="absolute left-3 flex items-center pointer-events-none">
            <svg className="animate-spin text-gs-dim" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
            </svg>
          </span>
        )}
        {!loading && prefix && (
          <span className="absolute left-3 text-gs-dim flex items-center pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={resolvedType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={loading}
          className={`w-full bg-gs-card border rounded-lg py-2.5 text-neutral-100 text-[13px] outline-none font-sans placeholder:text-gs-faint focus:ring-1 transition-all duration-150 ${borderClass} ${(prefix || loading) ? 'pl-9' : 'px-3'} ${hasRightIcon ? 'pr-12' : 'pr-3'} ${loading ? 'opacity-60 cursor-wait' : ''}`}
          style={style}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && typeof error === 'string' ? `${id}-error` : undefined}
        />

        {/* Right-side action icons */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {/* Improvement 15: Password visibility toggle */}
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              className="w-5 h-5 rounded bg-transparent border-none cursor-pointer text-gs-dim flex items-center justify-center hover:text-gs-muted transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          )}

          {/* Improvement 16: Copy button */}
          {copyable && !isPassword && hasValue && (
            <button
              type="button"
              onClick={handleCopy}
              className="w-5 h-5 rounded bg-transparent border-none cursor-pointer text-gs-dim flex items-center justify-center hover:text-gs-muted transition-colors"
              aria-label={copied ? 'Copied' : 'Copy to clipboard'}
              tabIndex={-1}
            >
              {copied ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          )}

          {/* Clear button */}
          {clearable && hasValue && !isPassword && !copyable && (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Clear"
              className="w-5 h-5 rounded-full bg-[#222] border-none cursor-pointer text-gs-muted text-xs flex items-center justify-center hover:bg-[#333] hover:text-gs-text transition-colors"
            >
              ×
            </button>
          )}

          {/* Suffix (only when no action buttons) */}
          {suffix && !isPassword && !copyable && !(clearable && hasValue) && (
            <span className="text-gs-dim flex items-center pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
      </div>
      <div className="flex justify-between items-start mt-1 min-h-0">
        {error && typeof error === 'string' && (
          <span id={id ? `${id}-error` : undefined} className="text-red-400 text-[11px] font-medium" role="alert">{error}</span>
        )}
        {!error && success && typeof success === 'string' && (
          <span className="text-emerald-400 text-[11px] font-medium">{success}</span>
        )}
        {showCount && maxLength && (
          <span className={`text-[11px] font-mono ml-auto ${(value?.length || 0) >= maxLength ? 'text-red-400' : 'text-gs-faint'}`}>
            {value?.length || 0}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
