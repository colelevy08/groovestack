// Reusable styled dropdown with optional uppercase label.
export default function FormSelect({ label, value, onChange, options }) {
  return (
    <div className="mb-4">
      {label && <label className="gs-label block mb-1.5">{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gs-card border border-[#222] rounded-lg px-3 py-2.5 text-neutral-100 text-[13px] outline-none font-sans cursor-pointer focus:border-gs-accent/40 focus:ring-1 focus:ring-gs-accent/20 transition-all duration-150"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
