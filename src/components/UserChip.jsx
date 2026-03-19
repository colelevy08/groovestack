// Compact inline user widget showing an Avatar + display name + @handle.
// Clicking it opens that user's profile via onViewUser (stops event propagation to avoid triggering parent clicks).
// Used in Card.jsx as the author header on each record post.
import Avatar from './ui/Avatar';
import { getProfile } from '../utils/helpers';

export default function UserChip({ username, onViewUser }) {
  const p = getProfile(username);
  return (
    <button
      onClick={e => { e.stopPropagation(); onViewUser(username); }}
      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}
    >
      <Avatar username={username} size={30} />
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e5e5", lineHeight: 1.2 }}>
          {p.displayName || username}
        </div>
        <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono',monospace" }}>@{username}</div>
      </div>
    </button>
  );
}
