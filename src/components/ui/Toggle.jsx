// Sliding on/off toggle switch with a text label.
// Used in AddRecordModal to toggle the "List for sale" option.
export default function Toggle({ on, onToggle, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <div
        onClick={onToggle}
        style={{ width: 36, height: 20, borderRadius: 10, background: on ? "#0ea5e9" : "#2a2a2a", position: "relative", transition: "background 0.2s", cursor: "pointer" }}
      >
        {/* Knob slides right when on=true */}
        <div style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>{label}</span>
    </label>
  );
}
