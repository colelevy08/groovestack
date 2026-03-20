// Reusable styled text input with optional uppercase label.
// Focus ring uses the accent color. Calls onChange with raw string value.
// Supports error/success states, character count, prefix/suffix icons, and clear button.
export default function FormInput({
  label, value, onChange, placeholder, type = "text", style = {},
  error, success, maxLength, showCount, prefix, suffix, clearable,
}) {
  const id = label ? label.toLowerCase().replace(/\s+/g, '-') : undefined;
  const hasValue = value != null && value !== '';

  const borderClass = error
    ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/20'
    : success
    ? 'border-emerald-500/60 focus:border-emerald-500/80 focus:ring-emerald-500/20'
    : 'border-[#222] focus:border-gs-accent/40 focus:ring-gs-accent/20';

  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={id} className="gs-label block mb-1.5">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-gs-dim flex items-center pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`w-full bg-gs-card border rounded-lg py-2.5 text-neutral-100 text-[13px] outline-none font-sans placeholder:text-gs-faint focus:ring-1 transition-all duration-150 ${borderClass} ${prefix ? 'pl-9' : 'px-3'} ${(suffix || clearable) ? 'pr-9' : 'pr-3'}`}
          style={style}
        />
        {clearable && hasValue && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear"
            className="absolute right-3 w-5 h-5 rounded-full bg-[#222] border-none cursor-pointer text-gs-muted text-xs flex items-center justify-center hover:bg-[#333] hover:text-gs-text transition-colors"
          >
            ×
          </button>
        )}
        {suffix && !(clearable && hasValue) && (
          <span className="absolute right-3 text-gs-dim flex items-center pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      <div className="flex justify-between items-start mt-1 min-h-0">
        {error && typeof error === 'string' && (
          <span className="text-red-400 text-[11px] font-medium">{error}</span>
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
