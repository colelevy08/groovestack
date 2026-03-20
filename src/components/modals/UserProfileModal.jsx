// Quick-preview card for another user's profile — triggered by clicking avatars/handles.
// Matches the ProfileScreen design language: header banner, overlapping avatar, clean stat grid.
// "View Full Profile" navigates to their full profile page in the main content area.
import Avatar from '../ui/Avatar';
import { getProfile } from '../../utils/helpers';

export default function UserProfileModal({ username, open, onClose, records, currentUser, following, onFollow, onViewFullProfile, posts, listeningHistory, profile }) {
  if (!open || !username) return null;

  const isOwn = username === currentUser;
  const p = isOwn ? { ...getProfile(username), displayName: profile?.displayName || getProfile(username).displayName, bio: profile?.bio || getProfile(username).bio, location: profile?.location || getProfile(username).location, favGenre: profile?.favGenre || getProfile(username).favGenre } : getProfile(username);
  const userRecords = records.filter(r => r.user === username);
  const forSale = userRecords.filter(r => r.forSale);
  const isFollowing = following.includes(username);
  const followerCount = (p.followers || []).length + (isFollowing && !(p.followers || []).includes(currentUser) ? 1 : 0);
  const userPosts = (posts || []).filter(pp => pp.user === username);

  return (
    <div
      className="gs-overlay fixed inset-0 flex items-center justify-center z-[1000] backdrop-blur-[6px]"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gs-surface border border-gs-border rounded-[18px] w-[420px] max-w-[94vw] overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.85)]">
        {/* Header banner */}
        <div
          className="h-20 relative"
          style={p.headerUrl
            ? { background: `url(${p.headerUrl}) center/cover` }
            : { background: `linear-gradient(135deg,${p.accent || "#0ea5e9"}33,#6366f122)` }}
        >
          <button onClick={onClose} className="absolute top-2.5 right-2.5 bg-black/50 border-none rounded-md w-7 h-7 cursor-pointer text-[#aaa] text-lg flex items-center justify-center backdrop-blur-[4px]">×</button>
        </div>

        {/* Profile info */}
        <div className="px-6 pb-6 -mt-8">
          <div className="flex justify-between items-end mb-3.5">
            <div className="rounded-full border-[3px] border-gs-surface leading-none relative z-[2]">
              <Avatar username={username} size={64} src={isOwn ? profile?.avatarUrl : undefined} />
            </div>
            {!isOwn && (
              <button
                onClick={() => onFollow(username)}
                className={isFollowing
                  ? "py-2 px-5 rounded-[20px] border border-gs-border-hover bg-[#1a1a1a] text-gs-muted text-xs font-bold cursor-pointer"
                  : "gs-btn-gradient py-2 px-5 rounded-[20px] border-none text-white text-xs font-bold cursor-pointer"
                }
              >
                {isFollowing ? "Following ✓" : "Follow"}
              </button>
            )}
          </div>

          <div className="text-xl font-extrabold text-gs-text tracking-[-0.03em] mb-0.5">{p.displayName}</div>
          <div className="text-xs font-mono mb-2.5" style={{ color: p.accent || "#0ea5e9" }}>@{username}</div>
          {p.bio && <p className="text-[13px] text-gs-muted leading-relaxed mb-3 line-clamp-2">{p.bio}</p>}

          <div className="flex gap-3 text-xs text-gs-dim mb-[18px] flex-wrap">
            {p.location && <span>📍 {p.location}</span>}
            {p.favGenre && <span>🎵 {p.favGenre}</span>}
          </div>

          {/* Stats — 4 clean boxes */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {[
              { l: "Records", v: userRecords.length },
              { l: "For Sale", v: forSale.length },
              { l: "Followers", v: followerCount },
              { l: "Posts", v: userPosts.length },
            ].map(s => (
              <div key={s.l} className="gs-stat bg-[#111] rounded-[10px] py-2.5 px-1.5 text-center">
                <div className="text-lg font-extrabold text-gs-text tracking-[-0.02em]">{s.v}</div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: p.accent || "#0ea5e9" }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* View Full Profile button */}
          <button
            onClick={() => { onClose(); onViewFullProfile(username); }}
            className="gs-btn-gradient w-full p-3 border-none rounded-[10px] text-white text-[13px] font-bold cursor-pointer mb-2"
          >
            View Full Profile
          </button>
          <button
            onClick={onClose}
            className="gs-btn-secondary w-full p-2.5 bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-[#666] text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
