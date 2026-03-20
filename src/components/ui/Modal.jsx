// Generic centered overlay modal — used by all modal components.
// Clicking the backdrop triggers onClose. Header is sticky for scrolling content.
export default function Modal({ open, onClose, title, children, width = "480px" }) {
  if (!open) return null;
  return (
    <div
      className="gs-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="gs-modal-box" style={{ width }}>
        {/* Sticky header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gs-border sticky top-0 bg-gs-surface z-[1]">
          <span className="text-[15px] font-bold tracking-tight text-gs-text">{title}</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md bg-[#1a1a1a] border-none cursor-pointer text-gs-muted text-lg flex items-center justify-center hover:bg-[#222] hover:text-gs-text transition-colors"
          >
            ×
          </button>
        </div>
        <div className="gs-modal-body p-5">{children}</div>
      </div>
    </div>
  );
}
