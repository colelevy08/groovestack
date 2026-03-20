// Inline @handle text link that opens a user's profile on click.
// Animated underline on hover. Stops event propagation so parent card clicks don't also fire.
export default function UserLink({ username, onViewUser, className = "", verified = false }) {
  return (
    <span
      onClick={e => { e.stopPropagation(); onViewUser(username); }}
      className={`text-gs-accent font-semibold cursor-pointer text-xs relative inline-flex items-center gap-1 group/link ${className}`}
    >
      {/* #20 — Hover underline animation */}
      <span className="relative">
        @{username}
        <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-gs-accent transition-all duration-300 group-hover/link:w-full" />
      </span>
      {/* #21 — Verified badge for verified users */}
      {verified && (
        <span title="Verified user" className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500 shrink-0">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
      )}
    </span>
  );
}
