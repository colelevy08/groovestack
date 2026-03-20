// Reusable styled textarea with optional uppercase label.
export default function FormTextarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="mb-4">
      {label && <label className="gs-label block mb-1.5">{label}</label>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-gs-card border border-[#222] rounded-lg px-3 py-2.5 text-neutral-100 text-[13px] outline-none font-sans resize-y placeholder:text-gs-faint focus:border-gs-accent/40 focus:ring-1 focus:ring-gs-accent/20 transition-all duration-150"
      />
    </div>
  );
}
