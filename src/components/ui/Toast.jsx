// Brief notification bar at bottom center. Auto-hides after 2.2s.
export default function Toast({ message, visible }) {
  return (
    <div
      className={`fixed bottom-7 left-1/2 -translate-x-1/2 bg-gs-accent text-black px-5 py-2.5 rounded-[10px] text-[13px] font-bold z-[2000] pointer-events-none transition-all duration-300 shadow-lg shadow-gs-accent/30 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      {message}
    </div>
  );
}
