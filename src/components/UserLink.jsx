// Inline @handle text link that opens a user's profile on click.
// Underlines on hover. Stops event propagation so parent card clicks don't also fire.
export default function UserLink({ username, onViewUser, style = {} }) {
  return (
    <span
      onClick={e => { e.stopPropagation(); onViewUser(username); }}
      style={{ color: "#0ea5e9", fontWeight: 600, cursor: "pointer", fontSize: 12, ...style }}
      onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
      onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
    >
      @{username}
    </span>
  );
}
