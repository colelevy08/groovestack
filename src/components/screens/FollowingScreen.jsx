// Social screen with two sections: users you already follow (with Unfollow), and suggested collectors to follow.
// onFollow toggles follow/unfollow in App.js — the same handler is used for both following and unfollowing.
// Suggestions are every USER_PROFILES entry the current user isn't already following.
import Avatar from '../ui/Avatar';
import { USER_PROFILES } from '../../constants';
import { getProfile } from '../../utils/helpers';

export default function FollowingScreen({ following, records, currentUser, onFollow, onViewUser }) {
  // Exclude the current user from the full user list
  const allUsers = Object.keys(USER_PROFILES).filter(u => u !== currentUser);
  // Suggestions are all users not already being followed
  const suggestions = allUsers.filter(u => !following.includes(u));

  return (
    <div>
      <h1 className="text-[22px] font-extrabold tracking-tight text-gs-text mb-1.5">Following</h1>
      <p className="text-xs text-gs-dim mb-5">Following {following.length} collectors</p>

      {following.length > 0 && (
        <>
          <div className="text-[11px] font-bold text-gs-dim tracking-widest font-mono mb-2.5">PEOPLE YOU FOLLOW</div>
          <div className="flex flex-col gap-2 mb-8">
            {following.map(u => {
              const p = getProfile(u);
              const uRecs = records.filter(r => r.user === u);
              return (
                <div key={u} className="bg-gs-card border border-gs-border rounded-xl px-4 py-3.5 flex gap-3 items-center">
                  <Avatar username={u} size={44} onClick={() => onViewUser(u)} />
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewUser(u)}>
                    <div className="text-sm font-bold text-gs-text">{p.displayName}</div>
                    <div className="text-[11px] text-gs-dim font-mono">@{u}</div>
                    {p.bio && <div className="text-xs text-[#777] mt-0.5 line-clamp-2">{p.bio}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-gs-dim mb-2">{uRecs.length} records</div>
                    <button onClick={() => onFollow(u)} className="px-3.5 py-1.5 rounded-lg border border-gs-border-hover bg-[#1a1a1a] text-gs-muted text-[11px] font-semibold cursor-pointer">Unfollow</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="text-[11px] font-bold text-gs-dim tracking-widest font-mono mb-2.5">SUGGESTED COLLECTORS</div>
      <div className="flex flex-col gap-2">
        {suggestions.map(u => {
          const p = getProfile(u);
          const uRecs = records.filter(r => r.user === u);
          return (
            <div key={u} className="bg-gs-card border border-gs-border rounded-xl px-4 py-3.5 flex gap-3 items-center">
              <Avatar username={u} size={44} onClick={() => onViewUser(u)} />
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewUser(u)}>
                <div className="text-sm font-bold text-gs-text">{p.displayName}</div>
                <div className="text-[11px] text-gs-dim font-mono">@{u}</div>
                {p.bio && <div className="text-xs text-[#777] mt-0.5 line-clamp-2">{p.bio}</div>}
                <div className="flex gap-1.5 mt-1">
                  {p.favGenre && <span className="text-[10px] px-1.5 py-px rounded-full bg-[#1a1a1a] text-gs-dim border border-gs-border-hover">{p.favGenre}</span>}
                  <span className="text-[10px] px-1.5 py-px rounded-full bg-[#1a1a1a] text-gs-dim border border-gs-border-hover">{uRecs.length} records</span>
                </div>
              </div>
              <button onClick={() => onFollow(u)} className="gs-btn-gradient px-4 py-2 rounded-lg text-white text-xs font-bold cursor-pointer shrink-0">
                Follow
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
