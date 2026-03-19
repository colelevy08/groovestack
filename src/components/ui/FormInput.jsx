// Reusable styled text input with an optional uppercase label above it.
// Border highlights blue on focus. Calls onChange with the raw string value (not the event).
// Used throughout all modals that have forms (AddRecordModal, BuyModal, ProfileEditModal, etc.).
export default function FormInput({ label, value, onChange, placeholder, type = "text", style = {} }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#666", letterSpacing: "0.08em", marginBottom: 6, fontFamily: "'DM Mono',monospace" }}>
          {label}
        </label>
      )}
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", background: "#0f0f0f", border: "1px solid #222", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif", ...style }}
        onFocus={e => e.target.style.borderColor = "#0ea5e955"}
        onBlur={e => e.target.style.borderColor = "#222"}
      />
    </div>
  );
}
