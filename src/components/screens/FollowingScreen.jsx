// Social screen with two sections: users you already follow (with Unfollow), and suggested collectors to follow.
// onFollow toggles follow/unfollow in App.js — the same handler is used for both following and unfollowing.
// Suggestions are every USER_PROFILES entry the current user isn't already following.
// Features: search/filter, suggestions based on shared genres, recent adds, unfollow confirmation,
// follower/following counts, grid/list toggle, online status indicators.
import { useState, useMemo } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';
import { USER_PROFILES } from '../../constants';
import { getProfile } from '../../utils/helpers';

// Simulated online status — deterministic per username so it stays consistent
const isOnline = (username) => {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = ((hash << 5) - hash + username.charCodeAt(i)) | 0;
  return Math.abs(hash) % 3 === 0; // ~33% of users appear online
};

// Simulated last active time for offline users
const lastActive = (username) => {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = ((hash << 5) - hash + username.charCodeAt(i)) | 0;
  const mins = (Math.abs(hash) % 720) + 5;
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};

export default function FollowingScreen({ following, records, currentUser, onFollow, onViewUser }) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list"); // list | grid
  const [unfollowConfirm, setUnfollowConfirm] = useState(null);

  // Exclude the current user from the full user list
  const allUsers = Object.keys(USER_PROFILES).filter(u => u !== currentUser);
  // Suggestions are all users not already being followed
  const suggestions = allUsers.filter(u => !following.includes(u));

  // Get current user's genres for "suggested for you"
  const myGenres = useMemo(() => {
    const genreSet = new Set();
    records.filter(r => r.user === currentUser).forEach(r => {
      (r.tags || []).forEach(t => {
        if (["Rock","Jazz","Electronic","Hip-Hop","Metal","Pop","Punk","R&B","Soul","Folk","Classical","Funk","Alternative","Country","Reggae","Blues","World","Experimental"].includes(t)) {
          genreSet.add(t);
        }
      });
    });
    return genreSet;
  }, [records, currentUser]);

  // Score suggestions by shared genres
  const scoredSuggestions = useMemo(() => {
    return suggestions.map(u => {
      const p = getProfile(u);
      const sharedGenre = p.favGenre && myGenres.has(p.favGenre);
      return { username: u, profile: p, sharedGenre, score: sharedGenre ? 1 : 0 };
    }).sort((a, b) => b.score - a.score);
  }, [suggestions, myGenres]);

  // Filter following list by search
  const filteredFollowing = useMemo(() => {
    if (!search.trim()) return following;
    const q = search.toLowerCase();
    return following.filter(u => {
      const p = getProfile(u);
      return u.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q) || (p.favGenre || "").toLowerCase().includes(q);
    });
  }, [following, search]);

  // Get recently added records for a user (up to 3)
  const getRecentRecords = (username) => {
    return records.filter(r => r.user === username).slice(0, 3);
  };

  // Get follower/following counts for a user
  const getUserCounts = (username) => {
    const p = getProfile(username);
    const followerCount = (p.followers || []).length;
    // Count how many users this person follows (simulated — check who has them as a follower)
    const followingCount = allUsers.filter(u => {
      const up = getProfile(u);
      return (up.followers || []).includes(username);
    }).length;
    return { followers: followerCount, following: followingCount };
  };

  const handleUnfollow = (username) => {
    if (unfollowConfirm === username) {
      onFollow(username);
      setUnfollowConfirm(null);
    } else {
      setUnfollowConfirm(username);
      setTimeout(() => setUnfollowConfirm(null), 3000); // Auto-dismiss after 3s
    }
  };

  // Shared user card for both list and grid layouts
  const UserCard = ({ u, isFollowed, showRecentAdds = false }) => {
    const p = getProfile(u);
    const uRecs = records.filter(r => r.user === u);
    const online = isOnline(u);
    const counts = getUserCounts(u);
    const recentRecs = showRecentAdds ? getRecentRecords(u) : [];
    const sharedInfo = scoredSuggestions.find(s => s.username === u);

    if (viewMode === "grid" && !isFollowed) {
      // Grid card for suggestions
      return (
        <div key={u} className="bg-gs-card border border-gs-border rounded-xl p-4 flex flex-col items-center text-center">
          <div className="relative mb-2">
            <Avatar username={u} size={56} onClick={() => onViewUser(u)} />
            {online && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-gs-card" />}
          </div>
          <div className="text-sm font-bold text-gs-text cursor-pointer" onClick={() => onViewUser(u)}>{p.displayName}</div>
          <div className="text-[10px] text-gs-dim font-mono mb-1">@{u}</div>
          {sharedInfo?.sharedGenre && (
            <span className="text-[9px] px-1.5 py-px rounded-full bg-gs-accent/10 text-gs-accent border border-gs-accent/20 mb-1.5">
              Also loves {p.favGenre}
            </span>
          )}
          <div className="flex gap-3 text-[10px] text-gs-faint font-mono mb-2">
            <span>{counts.followers} followers</span>
            <span>{uRecs.length} records</span>
          </div>
          <button onClick={() => onFollow(u)} className="gs-btn-gradient px-4 py-2 rounded-lg text-white text-xs font-bold cursor-pointer w-full">
            Follow
          </button>
        </div>
      );
    }

    // List card (default for both followed and suggestions)
    return (
      <div key={u} className="bg-gs-card border border-gs-border rounded-xl px-4 py-3.5">
        <div className="flex gap-3 items-center">
          <div className="relative shrink-0">
            <Avatar username={u} size={44} onClick={() => onViewUser(u)} />
            {online && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-gs-card" />}
          </div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewUser(u)}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-gs-text">{p.displayName}</span>
              {online && <span className="text-[9px] text-green-500 font-mono">online</span>}
              {!online && <span className="text-[9px] text-gs-faint font-mono">{lastActive(u)}</span>}
            </div>
            <div className="text-[11px] text-gs-dim font-mono">@{u}</div>
            {p.bio && <div className="text-xs text-[#777] mt-0.5 line-clamp-2">{p.bio}</div>}
            {!isFollowed && (
              <div className="flex gap-1.5 mt-1">
                {sharedInfo?.sharedGenre && (
                  <span className="text-[10px] px-1.5 py-px rounded-full bg-gs-accent/10 text-gs-accent border border-gs-accent/20">
                    Also loves {p.favGenre}
                  </span>
                )}
                {p.favGenre && !sharedInfo?.sharedGenre && (
                  <span className="text-[10px] px-1.5 py-px rounded-full bg-[#1a1a1a] text-gs-dim border border-gs-border-hover">{p.favGenre}</span>
                )}
                <span className="text-[10px] px-1.5 py-px rounded-full bg-[#1a1a1a] text-gs-dim border border-gs-border-hover">{uRecs.length} records</span>
              </div>
            )}
            {isFollowed && (
              <div className="flex gap-3 mt-1 text-[10px] text-gs-faint font-mono">
                <span>{counts.followers} followers</span>
                <span>{counts.following} following</span>
                <span>{uRecs.length} records</span>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            {isFollowed ? (
              <button
                onClick={() => handleUnfollow(u)}
                className={`px-3.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                  unfollowConfirm === u
                    ? 'border-red-500/40 bg-red-500/10 text-red-400'
                    : 'border-gs-border-hover bg-[#1a1a1a] text-gs-muted'
                }`}
              >
                {unfollowConfirm === u ? "Confirm?" : "Unfollow"}
              </button>
            ) : (
              <button onClick={() => onFollow(u)} className="gs-btn-gradient px-4 py-2 rounded-lg text-white text-xs font-bold cursor-pointer shrink-0">
                Follow
              </button>
            )}
          </div>
        </div>

        {/* Recently added records */}
        {isFollowed && showRecentAdds && recentRecs.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
            <div className="text-[10px] text-gs-faint font-mono mb-2">RECENTLY ADDED</div>
            <div className="flex gap-2">
              {recentRecs.map(r => (
                <div key={r.id} className="flex gap-2 items-center bg-[#111] rounded-lg px-2 py-1.5 flex-1 min-w-0">
                  <AlbumArt album={r.album} artist={r.artist} accent={r.accent || "#555"} size={28} />
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-gs-muted truncate">{r.album}</div>
                    <div className="text-[9px] text-gs-faint truncate">{r.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <h1 className="text-[22px] font-extrabold tracking-tight text-gs-text">Following</h1>
        {/* Grid/List toggle */}
        <div className="flex bg-[#111] rounded-lg border border-gs-border overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 text-[11px] border-0 cursor-pointer ${viewMode === "list" ? "bg-gs-accent/20 text-gs-accent" : "bg-transparent text-gs-faint"}`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1.5 text-[11px] border-0 cursor-pointer ${viewMode === "grid" ? "bg-gs-accent/20 text-gs-accent" : "bg-transparent text-gs-faint"}`}
          >
            Grid
          </button>
        </div>
      </div>
      <p className="text-xs text-gs-dim mb-4">Following {following.length} collector{following.length !== 1 ? "s" : ""}</p>

      {/* Search bar */}
      <div className="relative mb-5">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search people..."
          className="w-full bg-[#111] border border-gs-border rounded-lg px-3.5 py-2.5 pl-9 text-xs text-gs-text placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-faint text-sm">&#x1F50D;</span>
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gs-faint text-xs bg-transparent border-0 cursor-pointer hover:text-gs-text">
            ✕
          </button>
        )}
      </div>

      {/* Following section */}
      {following.length > 0 && (
        <>
          <div className="text-[11px] font-bold text-gs-dim tracking-widest font-mono mb-2.5">
            PEOPLE YOU FOLLOW {search && `(${filteredFollowing.length})`}
          </div>
          {filteredFollowing.length === 0 ? (
            <div className="text-center py-8 text-gs-faint text-xs mb-8">No followed users match your search.</div>
          ) : (
            <div className="flex flex-col gap-2 mb-8">
              {filteredFollowing.map(u => (
                <UserCard key={u} u={u} isFollowed showRecentAdds />
              ))}
            </div>
          )}
        </>
      )}

      {/* Suggested for you — shared genres first */}
      {scoredSuggestions.some(s => s.sharedGenre) && (
        <>
          <div className="text-[11px] font-bold text-gs-dim tracking-widest font-mono mb-2.5">SUGGESTED FOR YOU</div>
          <p className="text-[10px] text-gs-faint mb-2.5">Collectors who share your taste</p>
          <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-8" : "flex flex-col gap-2 mb-8"}>
            {scoredSuggestions.filter(s => s.sharedGenre).map(s => (
              <UserCard key={s.username} u={s.username} isFollowed={false} />
            ))}
          </div>
        </>
      )}

      {/* All other suggestions */}
      <div className="text-[11px] font-bold text-gs-dim tracking-widest font-mono mb-2.5">
        {scoredSuggestions.some(s => s.sharedGenre) ? "MORE COLLECTORS" : "SUGGESTED COLLECTORS"}
      </div>
      <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 gap-2.5" : "flex flex-col gap-2"}>
        {(scoredSuggestions.some(s => s.sharedGenre)
          ? scoredSuggestions.filter(s => !s.sharedGenre)
          : scoredSuggestions
        ).map(s => (
          <UserCard key={s.username} u={s.username} isFollowed={false} />
        ))}
      </div>
    </div>
  );
}
