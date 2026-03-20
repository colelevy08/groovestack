// Sliding on/off toggle switch with a text label.
export default function Toggle({ on, onToggle, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <div
        onClick={onToggle}
        className={`w-9 h-5 rounded-full relative transition-colors duration-200 cursor-pointer ${on ? 'bg-gs-accent' : 'bg-gs-border-hover'}`}
      >
        <div className={`absolute top-[3px] w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 ${on ? 'left-[19px]' : 'left-[3px]'}`} />
      </div>
      <span className="text-[13px] font-semibold text-neutral-300">{label}</span>
    </label>
  );
}
