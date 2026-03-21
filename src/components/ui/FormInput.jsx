// Reusable styled text input with optional uppercase label.
// Focus ring uses the accent color. Calls onChange with raw string value.
// Supports error/success states, character count, prefix/suffix icons, clear button,
// password visibility toggle, copy-to-clipboard button, loading state,
// auto-format for phone numbers, credit card number formatting, and input mask support.
import { useState, useCallback, useRef, useEffect } from 'react';

// --- Phone number formatting ---
function formatPhoneNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function unformatPhoneNumber(value) {
  return value.replace(/\D/g, '').slice(0, 10);
}

// --- Credit card number formatting ---
function formatCreditCard(value) {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  const groups = [];
  for (let i = 0; i < digits.length; i += 4) {
    groups.push(digits.slice(i, i + 4));
  }
  return groups.join(' ');
}

function unformatCreditCard(value) {
  return value.replace(/\D/g, '').slice(0, 16);
}

// --- Input mask support ---
// Mask characters: 9 = digit, a = letter, * = any alphanumeric
// Example masks: "999-999-9999" (phone), "99/99/9999" (date), "AAA-9999" (plate)
function applyMask(value, mask) {
  if (!mask) return value;
  let result = '';
  let valueIndex = 0;

  for (let i = 0; i < mask.length && valueIndex < value.length; i++) {
    const maskChar = mask[i];
    const inputChar = value[valueIndex];

    if (maskChar === '9') {
      if (/\d/.test(inputChar)) {
        result += inputChar;
        valueIndex++;
      } else {
        valueIndex++;
        i--; // retry this mask position
      }
    } else if (maskChar === 'a' || maskChar === 'A') {
      if (/[a-zA-Z]/.test(inputChar)) {
        result += maskChar === 'A' ? inputChar.toUpperCase() : inputChar;
        valueIndex++;
      } else {
        valueIndex++;
        i--;
      }
    } else if (maskChar === '*') {
      if (/[a-zA-Z0-9]/.test(inputChar)) {
        result += inputChar;
        valueIndex++;
      } else {
        valueIndex++;
        i--;
      }
    } else {
      // Literal character in mask
      result += maskChar;
      if (inputChar === maskChar) {
        valueIndex++;
      }
    }
  }

  return result;
}

function stripMaskLiterals(value, mask) {
  if (!mask) return value;
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const maskChar = mask[i];
    if (maskChar === '9' || maskChar === 'a' || maskChar === 'A' || maskChar === '*') {
      result += value[i];
    }
  }
  return result;
}

export default function FormInput({
  label, value, onChange, placeholder, type = "text", style = {},
  error, success, maxLength, showCount, prefix, suffix, clearable,
  copyable,
  loading,
  phoneFormat,     // Improvement 7: Auto-format phone numbers
  creditCardFormat, // Improvement 8: Credit card number formatting
  mask,            // Improvement 9: Input mask pattern (e.g. "999-999-9999")
  maskPlaceholder = '_', // Placeholder char shown in mask
}) {
  const id = label ? label.toLowerCase().replace(/\s+/g, '-') : undefined;
  const hasValue = value != null && value !== '';
  const inputRef = useRef(null);

  // Password visibility toggle
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && showPassword ? 'text' : type;

  // Copy state feedback
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  // Formatted display value and change handler
  const getDisplayValue = useCallback(() => {
    if (phoneFormat) return formatPhoneNumber(value || '');
    if (creditCardFormat) return formatCreditCard(value || '');
    if (mask) return applyMask(value || '', mask);
    return value;
  }, [value, phoneFormat, creditCardFormat, mask]);

  const handleChange = useCallback((rawInput) => {
    if (phoneFormat) {
      const digits = unformatPhoneNumber(rawInput);
      onChange(digits);
      return;
    }
    if (creditCardFormat) {
      const digits = unformatCreditCard(rawInput);
      onChange(digits);
      return;
    }
    if (mask) {
      // Strip literal chars and store raw value
      const masked = applyMask(rawInput.replace(/[^a-zA-Z0-9]/g, ''), mask);
      const raw = stripMaskLiterals(masked, mask);
      onChange(raw);
      return;
    }
    onChange(rawInput);
  }, [onChange, phoneFormat, creditCardFormat, mask]);

  // Determine mask placeholder display
  const maskHint = mask ? mask
    .replace(/9/g, maskPlaceholder)
    .replace(/[aA]/g, maskPlaceholder)
    .replace(/\*/g, maskPlaceholder) : null;

  const borderClass = error
    ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/20'
    : success
    ? 'border-emerald-500/60 focus:border-emerald-500/80 focus:ring-emerald-500/20'
    : 'border-[#222] focus:border-gs-accent/40 focus:ring-gs-accent/20';

  // Calculate right padding based on what icons are shown
  const hasRightIcon = isPassword || copyable || clearable || suffix; // eslint-disable-line no-unused-vars

  // Determine input type for formatted fields
  const actualType = (phoneFormat || creditCardFormat || mask) ? 'text' : resolvedType;
  const actualInputMode = phoneFormat ? 'tel' : creditCardFormat ? 'numeric' : undefined;

  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={id} className="gs-label block mb-1.5">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {/* Loading spinner prefix */}
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
        {/* Phone icon prefix */}
        {!loading && !prefix && phoneFormat && (
          <span className="absolute left-3 text-gs-dim flex items-center pointer-events-none">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
            </svg>
          </span>
        )}
        {/* Credit card icon prefix */}
        {!loading && !prefix && creditCardFormat && (
          <span className="absolute left-3 text-gs-dim flex items-center pointer-events-none">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          type={actualType}
          inputMode={actualInputMode}
          value={getDisplayValue()}
          onChange={e => handleChange(e.target.value)}
          placeholder={maskHint || placeholder}
          maxLength={maxLength || (phoneFormat ? 14 : creditCardFormat ? 19 : mask ? mask.length : undefined)}
          disabled={loading}
          className={`w-full bg-gs-card border rounded-lg py-2.5 text-neutral-100 text-[13px] outline-none font-sans placeholder:text-gs-faint focus:ring-1 transition-all duration-150 ${borderClass} ${(prefix || loading || phoneFormat || creditCardFormat) ? 'pl-9' : mask ? 'pl-3' : 'px-3'} ${hasRightIcon ? 'pr-12' : 'pr-3'} ${loading ? 'opacity-60 cursor-wait' : ''} ${creditCardFormat ? 'font-mono tracking-wider' : ''}`}
          style={style}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && typeof error === 'string' ? `${id}-error` : undefined}
        />

        {/* Right-side action icons */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {/* Password visibility toggle */}
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

          {/* Copy button */}
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
