// Inline @handle text link that opens a user's profile on click.
// Underlines on hover. Stops event propagation so parent card clicks don't also fire.
export default function UserLink({ username, onViewUser, className = "" }) {
  return (
    <span
      onClick={e => { e.stopPropagation(); onViewUser(username); }}
      className={`text-gs-accent font-semibold cursor-pointer text-xs hover:underline ${className}`}
    >
      @{username}
    </span>
  );
}
