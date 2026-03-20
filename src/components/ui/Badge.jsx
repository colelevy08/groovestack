// Small colored pill — used for condition grades, prices, etc.
// Supports size variants, prepend icon, and clickable/dismissable mode.
const SIZE_CLASSES = {
  sm: 'text-[9px] px-1.5 py-0.5',
  md: 'text-[10px] px-2 py-0.5',
  lg: 'text-[12px] px-2.5 py-1',
};

export default function Badge({ label, color, size, icon, onClick, onDismiss }) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const isClickable = onClick || onDismiss;

  return (
    <span
      className={`${sizeClass} font-bold tracking-wide rounded font-mono transition-colors duration-150 inline-flex items-center gap-1 ${
        isClickable ? 'cursor-pointer hover:opacity-80' : ''
      }`}
      style={{ background: color + "22", color, border: `1px solid ${color}44` }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
    >
      {icon && <span className="flex items-center shrink-0" style={{ fontSize: 'inherit' }}>{icon}</span>}
      {label}
      {onDismiss && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(e); }}
          className="ml-0.5 border-none bg-transparent cursor-pointer p-0 leading-none hover:opacity-100 transition-opacity"
          style={{ color: color + '99', fontSize: 'inherit' }}
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
