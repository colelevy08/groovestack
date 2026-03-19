// Reusable styled dropdown with an optional uppercase label.
// options is a plain string array; each item becomes both the value and the display text.
// Used for FORMAT and CONDITION in AddRecordModal, and FAVORITE GENRE in ProfileEditModal.
export default function FormSelect({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#666", letterSpacing: "0.08em", marginBottom: 6, fontFamily: "'DM Mono',monospace" }}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: "100%", background: "#0f0f0f", border: "1px solid #222", borderRadius: 8, padding: "10px 12px", color: "#f0f0f0", fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif", cursor: "pointer" }}
        onFocus={e => e.target.style.borderColor = "#0ea5e955"}
        onBlur={e => e.target.style.borderColor = "#222"}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
