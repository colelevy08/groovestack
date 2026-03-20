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
      className="bg-transparent border-none cursor-pointer p-0 flex items-center gap-1.5 hover:bg-[#111] rounded-lg transition-colors"
    >
      <Avatar username={username} size={30} />
      <div className="text-left">
        <div className="text-xs font-semibold text-[#e5e5e5] leading-tight">
          {p.displayName || username}
        </div>
        <div className="text-[10px] text-gs-dim font-mono">@{username}</div>
      </div>
    </button>
  );
}
