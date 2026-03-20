// Small colored pill — used for condition grades, prices, etc.
export default function Badge({ label, color }) {
  return (
    <span
      className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded font-mono transition-colors duration-150"
      style={{ background: color + "22", color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  );
}
