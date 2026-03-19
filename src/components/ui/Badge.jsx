// Small colored pill label — used for record condition grades (M, NM, VG+, etc.) and prices.
// The color prop sets the text, border, and tinted background simultaneously.
export default function Badge({ label, color }) {
  return (
    <span style={{
      fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
      padding: "2px 7px", borderRadius: 4,
      background: color + "22", color,
      border: `1px solid ${color}44`,
      fontFamily: "'DM Mono',monospace",
    }}>
      {label}
    </span>
  );
}
