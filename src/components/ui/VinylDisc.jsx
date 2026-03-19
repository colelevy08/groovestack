// Decorative vinyl disc graphic used on record cards and modals.
// Renders concentric groove rings via conic-gradient; the center label glows in the record's accent color.
export default function VinylDisc({ accent, size = 72 }) {
  // Build alternating dark groove segments to simulate vinyl grooves
  const grooves = Array.from({ length: 18 }, (_, i) => {
    const start = i * 20;
    return `#${i % 2 === 0 ? "1a1a1a" : "242424"} ${start}deg,#${i % 2 === 0 ? "1a1a1a" : "242424"} ${start + 10}deg`;
  }).join(",");

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `conic-gradient(from 0deg,${grooves})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 0 0 1px #333, 0 4px 20px ${accent}22`,
    }}>
      {/* Center label circle glows in the record's accent color */}
      <div style={{
        width: size * 0.3, height: size * 0.3, borderRadius: "50%",
        background: `radial-gradient(circle,${accent}cc,${accent}44)`,
        boxShadow: `0 0 8px ${accent}88`,
      }} />
    </div>
  );
}
