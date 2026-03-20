// Quick-preview card for another user's profile — triggered by clicking avatars/handles.
// Matches the ProfileScreen design language: header banner, overlapping avatar, clean stat grid.
// "View Full Profile" navigates to their full profile page in the main content area.
// Includes: online status, verified seller badge, quick message, mutual followers preview,
// member-since tenure badge, top record showcase, and profile similarity hint.
import { useState, useMemo } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';
import { getProfile, formatCompact } from '../../utils/helpers';

export default function UserProfileModal({ username, open, onClose, records, currentUser, following, onFollow, onViewFullProfile, posts, listeningHistory, profile, onMessage }) {
  // Improvement 20: Follow animation in modal
  const [followAnimating, setFollowAnimating] = useState(false);
  // Improvement 21: Quick message from modal
  const [quickMsg, setQuickMsg] = useState('');
  const [msgSent, setMsgSent] = useState(false);

  const isOwn = username ? username === currentUser : false;
  const p = username
    ? isOwn
      ? { ...getProfile(username), displayName: profile?.displayName || getProfile(username).displayName, bio: profile?.bio || getProfile(username).bio, location: profile?.location || getProfile(username).location, favGenre: profile?.favGenre || getProfile(username).favGenre }
      : getProfile(username)
    : {};
  const userRecords = (records || []).filter(r => r.user === username);
  const forSale = userRecords.filter(r => r.forSale);
  const isFollowing = username ? following.includes(username) : false;
  const followerCount = (p.followers || []).length + (isFollowing && !(p.followers || []).includes(currentUser) ? 1 : 0);
  const userPosts = (posts || []).filter(pp => pp.user === username);

  // Improvement 24: Mutual followers preview in modal
  const mutualFollowers = useMemo(() => {
    if (isOwn || !username) return [];
    const theirFollowers = p.followers || [];
    return following.filter(f => f !== username && theirFollowers.includes(f));
  }, [isOwn, p.followers, following, username]);

  // Improvement 25: Member-since derived from earliest activity
  const memberSince = useMemo(() => {
    if (!username) return null;
    const userListens = (listeningHistory || []).filter(s => s.username === username);
    const timestamps = [
      ...(userPosts || []).map(pp => pp.createdAt),
      ...(userListens || []).map(s => s.timestampMs),
    ].filter(Boolean);
    if (timestamps.length === 0) return null;
    const earliest = Math.min(...timestamps);
    const d = new Date(earliest);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [userPosts, listeningHistory, username]);

  if (!open || !username) return null;

  // Improvement 22: Online status derivation (deterministic for demo)
  const isOnline = username.charCodeAt(0) % 3 !== 0;
  const lastSeenMin = (username.charCodeAt(username.length - 1) % 120) + 5;

  // Improvement 23: Verified seller badge logic
  const isVerifiedSeller = forSale.length >= 3 && followerCount >= 2;

  // Top 3 records for showcase
  const topRecords = [...userRecords].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);

  // Collection value
  const totalValue = userRecords.reduce((sum, r) => sum + (r.price || 0), 0);

  // Follow with animation
  const handleFollow = () => {
    setFollowAnimating(true);
    onFollow(username);
    setTimeout(() => setFollowAnimating(false), 400);
  };

  // Quick message handler
  const handleSendQuickMsg = () => {
    if (!quickMsg.trim()) return;
    if (onMessage) onMessage(username, quickMsg.trim());
    setQuickMsg('');
    setMsgSent(true);
    setTimeout(() => setMsgSent(false), 2000);
  };

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
              {/* Online status dot on avatar */}
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gs-surface ${
                  isOnline ? 'bg-emerald-500' : 'bg-gray-500'
                }`}
              />
            </div>
            {!isOwn && (
              <button
                onClick={handleFollow}
                className={`py-2 px-5 rounded-[20px] border-none text-xs font-bold cursor-pointer transition-all duration-300 ${
                  isFollowing
                    ? "border border-gs-border-hover bg-[#1a1a1a] text-gs-muted"
                    : "gs-btn-gradient text-white"
                }`}
                style={{
                  transform: followAnimating ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                {followAnimating && !isFollowing ? '❤️ Followed!' : isFollowing ? "Following ✓" : "Follow"}
              </button>
            )}
          </div>

          {/* Name + verified badge */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xl font-extrabold text-gs-text tracking-[-0.03em]">{p.displayName}</span>
            {isVerifiedSeller && (
              <span
                title="Verified Seller"
                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-1.5 py-px"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
                Verified
              </span>
            )}
          </div>

          {/* Username + online status */}
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-xs font-mono" style={{ color: p.accent || "#0ea5e9" }}>@{username}</span>
            <span className="flex items-center gap-1 text-[9px]">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-500'}`} />
              <span className={isOnline ? 'text-emerald-400' : 'text-gs-faint'}>
                {isOnline ? 'Online' : `${lastSeenMin}m ago`}
              </span>
            </span>
          </div>

          {p.bio && <p className="text-[13px] text-gs-muted leading-relaxed mb-3 line-clamp-2">{p.bio}</p>}

          {/* Location, genre, member since */}
          <div className="flex gap-3 text-xs text-gs-dim mb-3 flex-wrap items-center">
            {memberSince && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                Since {memberSince}
              </span>
            )}
            {p.location && <span>📍 {p.location}</span>}
            {p.favGenre && <span>🎵 {p.favGenre}</span>}
          </div>

          {/* Mutual followers preview */}
          {mutualFollowers.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3 text-[10px] text-gs-dim">
              <div className="flex -space-x-1">
                {mutualFollowers.slice(0, 3).map(f => (
                  <div key={f} className="rounded-full border border-gs-surface">
                    <Avatar username={f} size={14} />
                  </div>
                ))}
              </div>
              <span>
                {mutualFollowers.length} mutual follow{mutualFollowers.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Top records showcase (mini) */}
          {topRecords.length > 0 && (
            <div className="mb-3">
              <div className="text-[9px] font-bold text-gs-dim uppercase tracking-wider mb-1.5">Top Records</div>
              <div className="flex gap-1.5">
                {topRecords.map(r => (
                  <div key={r.id} className="rounded-lg overflow-hidden border border-gs-border" title={`${r.album} — ${r.artist}`}>
                    <AlbumArt album={r.album} artist={r.artist} accent={r.accent || p.accent} size={42} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats — 5 clean boxes */}
          <div className="grid grid-cols-5 gap-1.5 mb-4">
            {[
              { l: "Records", v: userRecords.length },
              { l: "For Sale", v: forSale.length },
              { l: "Followers", v: followerCount },
              { l: "Posts", v: userPosts.length },
              { l: "Value", v: totalValue > 0 ? `$${formatCompact(totalValue)}` : '—' },
            ].map(s => (
              <div key={s.l} className="gs-stat bg-[#111] rounded-[10px] py-2 px-1 text-center">
                <div className="text-sm font-extrabold text-gs-text tracking-[-0.02em]">{s.v}</div>
                <div className="text-[9px] font-mono mt-0.5" style={{ color: p.accent || "#0ea5e9" }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Quick message input */}
          {!isOwn && (
            <div className="mb-3">
              {msgSent ? (
                <div className="text-center text-[11px] text-emerald-400 font-semibold py-2">Message sent!</div>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={quickMsg}
                    onChange={e => setQuickMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendQuickMsg()}
                    placeholder={`Quick message to @${username}...`}
                    className="flex-1 bg-[#111] border border-gs-border rounded-lg px-3 py-2 text-[11px] text-gs-text placeholder:text-gs-faint outline-none focus:border-gs-accent/40"
                    maxLength={280}
                  />
                  <button
                    onClick={handleSendQuickMsg}
                    disabled={!quickMsg.trim()}
                    className="bg-gs-accent/20 border border-gs-accent/30 rounded-lg px-3 py-2 text-[11px] text-gs-accent font-semibold cursor-pointer disabled:opacity-30 disabled:cursor-default hover:bg-gs-accent/30 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
              )}
            </div>
          )}

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
