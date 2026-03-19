// Empty-state placeholder shown when a list has no items.
// Shows a large icon, a message, and an optional action button (e.g., "Add First Record" in CollectionScreen).
export default function Empty({ icon, text, action, actionLabel }) {
  return (
    <div style={{ textAlign: "center", padding: "70px 0", color: "#444" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14, marginBottom: action ? 20 : 0 }}>{text}</div>
      {action && (
        <button
          onClick={action}
          style={{ padding: "10px 22px", background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
