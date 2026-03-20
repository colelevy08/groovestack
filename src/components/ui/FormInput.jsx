// Reusable styled text input with optional uppercase label.
// Focus ring uses the accent color. Calls onChange with raw string value.
export default function FormInput({ label, value, onChange, placeholder, type = "text", style = {} }) {
  const id = label ? label.toLowerCase().replace(/\s+/g, '-') : undefined;
  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={id} className="gs-label block mb-1.5">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gs-card border border-[#222] rounded-lg px-3 py-2.5 text-neutral-100 text-[13px] outline-none font-sans placeholder:text-gs-faint focus:border-gs-accent/40 focus:ring-1 focus:ring-gs-accent/20 transition-all duration-150"
        style={style}
      />
    </div>
  );
}
