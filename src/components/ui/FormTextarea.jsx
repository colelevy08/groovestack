// Reusable styled textarea with an optional uppercase label.
// Vertically resizable. Used for bio text in ProfileEditModal and review/notes in AddRecordModal.
export default function FormTextarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#666", letterSpacing: "0.08em", marginBottom: 6, fontFamily: "'DM Mono',monospace" }}>
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{ width: "100%", background: "#0f0f0f", border: "1px solid #222", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif", resize: "vertical" }}
        onFocus={e => e.target.style.borderColor = "#0ea5e955"}
        onBlur={e => e.target.style.borderColor = "#222"}
      />
    </div>
  );
}
