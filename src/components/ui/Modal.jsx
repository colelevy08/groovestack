// Generic centered overlay modal used by CommentsModal, BuyModal, DetailModal, AddRecordModal, and ProfileEditModal.
// Clicking the blurred backdrop (outside the modal box) triggers onClose.
// The header with title and × button is sticky so it stays visible when content scrolls.
export default function Modal({ open, onClose, title, children, width = "480px" }) {
  if (!open) return null;
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="gs-modal" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 16, width, maxWidth: "94vw", maxHeight: "88vh", overflow: "auto", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}>
        {/* Sticky header stays visible as modal content scrolls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: "1px solid #1a1a1a", position: "sticky", top: 0, background: "#0d0d0d", zIndex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color: "#f5f5f5" }}>{title}</span>
          <button onClick={onClose} style={{ background: "#1a1a1a", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", color: "#888", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <div className="gs-modal-body" style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}
