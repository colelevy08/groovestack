// Social screen with two sections: users you already follow (with Unfollow), and suggested collectors to follow.
// onFollow toggles follow/unfollow in App.js — the same handler is used for both following and unfollowing.
// Suggestions are every USER_PROFILES entry the current user isn't already following.
// Features: search/filter, suggestions based on shared genres, recent adds, unfollow confirmation,
// follower/following counts, grid/list toggle, online status indicators,
// activity feed, follow categories, batch operations, export, discovery mode,
// mutual collections, follow recommendations, notification prefs, timeline, mutual friends.
import { useState, useMemo, useCallback } from 'react';
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

// Improvement 16: Simulated activity feed events per user
const generateActivityFeed = (username, records) => {
  const userRecords = records.filter(r => r.user === username);
  const events = [];
  userRecords.slice(0, 3).forEach((r, i) => {
    events.push({
      id: `${username}-add-${r.id}`,
      type: 'added',
      user: username,
      record: r,
      timeAgo: `${i + 1}d ago`,
    });
  });
  // Simulated listing event
  const forSale = userRecords.filter(r => r.forSale);
  if (forSale.length > 0) {
    events.push({
      id: `${username}-list-${forSale[0].id}`,
      type: 'listed',
      user: username,
      record: forSale[0],
      timeAgo: '2d ago',
    });
  }
  return events;
};

// Improvement 19: Follow categories/lists localStorage
const FOLLOW_CATEGORIES_KEY = 'gs-follow-categories';
const loadFollowCategories = () => {
  try {
    const raw = localStorage.getItem(FOLLOW_CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const persistFollowCategories = (cats) => {
  try {
    localStorage.setItem(FOLLOW_CATEGORIES_KEY, JSON.stringify(cats));
  } catch {
    // localStorage full or unavailable
  }
};

// Improvement 21: Notification preferences per user localStorage
const NOTIFICATION_PREFS_KEY = 'gs-follow-notification-prefs';
const loadNotificationPrefs = () => {
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const persistNotificationPrefs = (prefs) => {
  try {
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage full or unavailable
  }
};

export default function FollowingScreen({ following, records, currentUser, onFollow, onViewUser }) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list"); // list | grid
  const [unfollowConfirm, setUnfollowConfirm] = useState(null);

  // Improvement 16: Activity feed tab
  const [activeTab, setActiveTab] = useState("following"); // "following" | "activity" | "discover"

  // Improvement 18: Batch follow/unfollow mode
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState(new Set());

  // Improvement 19: Follow categories/lists
  const [followCategories, setFollowCategories] = useState(loadFollowCategories);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [filterByCategory, setFilterByCategory] = useState(null);

  // Improvement 21: Notification prefs per user
  const [notificationPrefs, setNotificationPrefs] = useState(loadNotificationPrefs);
  const [showNotifPrefsFor, setShowNotifPrefsFor] = useState(null);

  // Improvement 23: Discovery mode
  const [discoveryUser, setDiscoveryUser] = useState(null);

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

  // Improvement 17: Follow recommendations based on genre overlap (enhanced scoring)
  const scoredSuggestions = useMemo(() => {
    return suggestions.map(u => {
      const p = getProfile(u);
      const userRecs = records.filter(r => r.user === u);
      const userGenres = new Set();
      userRecs.forEach(r => (r.tags || []).forEach(t => userGenres.add(t)));

      let score = 0;
      const sharedGenre = p.favGenre && myGenres.has(p.favGenre);
      if (sharedGenre) score += 3;

      // Count total genre overlap
      let genreOverlap = 0;
      myGenres.forEach(g => { if (userGenres.has(g)) genreOverlap++; });
      score += genreOverlap;

      // Boost users with more records
      if (userRecs.length > 5) score += 1;

      // Improvement 24: "Friends who also follow" — boost users followed by people you follow
      const followedByFriends = following.filter(f => {
        const fp = getProfile(f);
        return (fp.followers || []).includes(u);
      });

      return {
        username: u,
        profile: p,
        sharedGenre,
        genreOverlap,
        score,
        recordCount: userRecs.length,
        followedByFriends,
      };
    }).sort((a, b) => b.score - a.score);
  }, [suggestions, myGenres, records, following]);

  // Filter following list by search and category
  const filteredFollowing = useMemo(() => {
    let result = following;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u => {
        const p = getProfile(u);
        return u.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q) || (p.favGenre || "").toLowerCase().includes(q);
      });
    }
    // Improvement 19: Filter by category
    if (filterByCategory) {
      const categoryUsers = followCategories[filterByCategory] || [];
      result = result.filter(u => categoryUsers.includes(u));
    }
    return result;
  }, [following, search, filterByCategory, followCategories]);

  // Improvement 16: Activity feed from followed users
  const activityFeed = useMemo(() => {
    const events = [];
    following.forEach(u => {
      events.push(...generateActivityFeed(u, records));
    });
    return events.sort((a, b) => {
      const aNum = parseInt(a.timeAgo) || 0;
      const bNum = parseInt(b.timeAgo) || 0;
      return aNum - bNum;
    }).slice(0, 30);
  }, [following, records]);

  // Improvement 22: Mutual collections comparison
  const getMutualRecords = useCallback((username) => {
    const myAlbums = records.filter(r => r.user === currentUser).map(r => `${r.artist}::${r.album}`);
    const mySet = new Set(myAlbums);
    const theirRecords = records.filter(r => r.user === username);
    return theirRecords.filter(r => mySet.has(`${r.artist}::${r.album}`));
  }, [records, currentUser]);

  // Get recently added records for a user (up to 3)
  const getRecentRecords = (username) => {
    return records.filter(r => r.user === username).slice(0, 3);
  };

  // Get follower/following counts for a user
  const getUserCounts = (username) => {
    const p = getProfile(username);
    const followerCount = (p.followers || []).length;
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
      setTimeout(() => setUnfollowConfirm(null), 3000);
    }
  };

  // Improvement 18: Batch operations
  const toggleBatchSelect = (username) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
  };

  const batchUnfollow = () => {
    batchSelected.forEach(u => {
      if (following.includes(u)) onFollow(u);
    });
    setBatchSelected(new Set());
    setBatchMode(false);
  };

  const batchFollow = () => {
    batchSelected.forEach(u => {
      if (!following.includes(u)) onFollow(u);
    });
    setBatchSelected(new Set());
    setBatchMode(false);
  };

  // Improvement 19: Category management
  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    const updated = { ...followCategories, [newCategoryName.trim()]: [] };
    setFollowCategories(updated);
    persistFollowCategories(updated);
    setNewCategoryName("");
  };

  const removeCategory = (name) => {
    const updated = { ...followCategories };
    delete updated[name];
    setFollowCategories(updated);
    persistFollowCategories(updated);
    if (filterByCategory === name) setFilterByCategory(null);
  };

  const toggleUserInCategory = (username, category) => {
    const users = followCategories[category] || [];
    const updated = {
      ...followCategories,
      [category]: users.includes(username) ? users.filter(u => u !== username) : [...users, username],
    };
    setFollowCategories(updated);
    persistFollowCategories(updated);
  };

  // Improvement 20: Export following list
  const exportFollowingList = () => {
    const data = following.map(u => {
      const p = getProfile(u);
      const recs = records.filter(r => r.user === u);
      return `${p.displayName} (@${u}) — ${recs.length} records — ${p.favGenre || 'No genre'} — ${p.location || 'Unknown location'}`;
    }).join('\n');
    const blob = new Blob([`Following List (${following.length} collectors)\n${'='.repeat(40)}\n\n${data}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'groovestack-following.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Improvement 21: Notification preference toggling
  const toggleNotifPref = (username, pref) => {
    const current = notificationPrefs[username] || { newRecords: true, listings: true, activity: true };
    const updated = { ...notificationPrefs, [username]: { ...current, [pref]: !current[pref] } };
    setNotificationPrefs(updated);
    persistNotificationPrefs(updated);
  };

  const getNotifPrefs = (username) => notificationPrefs[username] || { newRecords: true, listings: true, activity: true };

  // Improvement 23: Discovery mode — random user
  const discoverRandomUser = () => {
    const pool = allUsers.filter(u => u !== discoveryUser);
    if (pool.length === 0) return;
    setDiscoveryUser(pool[Math.floor(Math.random() * pool.length)]);
    setActiveTab("discover");
  };

  // All category names
  const categoryNames = Object.keys(followCategories);

  // Shared user card for both list and grid layouts
  const UserCard = ({ u, isFollowed, showRecentAdds = false }) => {
    const p = getProfile(u);
    const uRecs = records.filter(r => r.user === u);
    const online = isOnline(u);
    const counts = getUserCounts(u);
    const recentRecs = showRecentAdds ? getRecentRecords(u) : [];
    const sharedInfo = scoredSuggestions.find(s => s.username === u);
    const mutualRecs = isFollowed ? getMutualRecords(u) : [];

    if (viewMode === "grid" && !isFollowed) {
      // Grid card for suggestions
      return (
        <div key={u} className="bg-gs-card border border-gs-border rounded-xl p-4 flex flex-col items-center text-center">
          {/* Improvement 18: Batch checkbox */}
          {batchMode && (
            <input
              type="checkbox"
              checked={batchSelected.has(u)}
              onChange={() => toggleBatchSelect(u)}
              className="accent-gs-accent w-3.5 h-3.5 self-start cursor-pointer mb-1"
            />
          )}
          <div className="relative mb-2">
            <Avatar username={u} size={56} onClick={() => onViewUser(u)} />
            {online && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-gs-card" />}
          </div>
          <div className="text-sm font-bold text-gs-text cursor-pointer" onClick={() => onViewUser(u)}>{p.displayName}</div>
          <div className="text-[10px] text-gs-dim font-mono mb-1">@{u}</div>
          {sharedInfo?.sharedGenre && (
            <span className="text-[9px] px-1.5 py-px rounded-full bg-gs-accent/10 text-gs-accent border border-gs-accent/20 mb-1">
              Also loves {p.favGenre}
            </span>
          )}
          {/* Improvement 17: Genre overlap count */}
          {sharedInfo?.genreOverlap > 1 && (
            <span className="text-[9px] px-1.5 py-px rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-1">
              {sharedInfo.genreOverlap} shared genres
            </span>
          )}
          {/* Improvement 24: Friends who also follow */}
          {sharedInfo?.followedByFriends?.length > 0 && (
            <span className="text-[9px] px-1.5 py-px rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-1">
              {sharedInfo.followedByFriends.length} friend{sharedInfo.followedByFriends.length !== 1 ? 's' : ''} follow
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
          {/* Improvement 18: Batch checkbox */}
          {batchMode && (
            <input
              type="checkbox"
              checked={batchSelected.has(u)}
              onChange={() => toggleBatchSelect(u)}
              className="accent-gs-accent w-3.5 h-3.5 shrink-0 cursor-pointer"
            />
          )}
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
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {sharedInfo?.sharedGenre && (
                  <span className="text-[10px] px-1.5 py-px rounded-full bg-gs-accent/10 text-gs-accent border border-gs-accent/20">
                    Also loves {p.favGenre}
                  </span>
                )}
                {p.favGenre && !sharedInfo?.sharedGenre && (
                  <span className="text-[10px] px-1.5 py-px rounded-full bg-[#1a1a1a] text-gs-dim border border-gs-border-hover">{p.favGenre}</span>
                )}
                <span className="text-[10px] px-1.5 py-px rounded-full bg-[#1a1a1a] text-gs-dim border border-gs-border-hover">{uRecs.length} records</span>
                {/* Improvement 17: Genre overlap badge */}
                {sharedInfo?.genreOverlap > 1 && (
                  <span className="text-[10px] px-1.5 py-px rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {sharedInfo.genreOverlap} shared genres
                  </span>
                )}
                {/* Improvement 24: Friends who also follow */}
                {sharedInfo?.followedByFriends?.length > 0 && (
                  <span className="text-[10px] px-1.5 py-px rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {sharedInfo.followedByFriends.length} friend{sharedInfo.followedByFriends.length !== 1 ? 's' : ''} follow
                  </span>
                )}
              </div>
            )}
            {isFollowed && (
              <div className="flex gap-3 mt-1 text-[10px] text-gs-faint font-mono">
                <span>{counts.followers} followers</span>
                <span>{counts.following} following</span>
                <span>{uRecs.length} records</span>
                {/* Improvement 22: Mutual collection count */}
                {mutualRecs.length > 0 && (
                  <span className="text-green-400">{mutualRecs.length} in common</span>
                )}
              </div>
            )}
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-1">
            {isFollowed ? (
              <>
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
                {/* Improvement 21: Notification prefs toggle */}
                <button
                  onClick={() => setShowNotifPrefsFor(showNotifPrefsFor === u ? null : u)}
                  className="bg-transparent border-none text-gs-faint hover:text-gs-accent cursor-pointer p-0 text-[10px]"
                  title="Notification preferences"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                </button>
              </>
            ) : (
              <button onClick={() => onFollow(u)} className="gs-btn-gradient px-4 py-2 rounded-lg text-white text-xs font-bold cursor-pointer shrink-0">
                Follow
              </button>
            )}
          </div>
        </div>

        {/* Improvement 21: Notification preferences panel */}
        {isFollowed && showNotifPrefsFor === u && (
          <div className="mt-2.5 pt-2.5 border-t border-[#1a1a1a]">
            <div className="text-[10px] text-gs-faint font-mono mb-2">NOTIFICATION PREFERENCES</div>
            <div className="flex gap-3">
              {[
                { key: 'newRecords', label: 'New Records' },
                { key: 'listings', label: 'Listings' },
                { key: 'activity', label: 'Activity' },
              ].map(({ key, label }) => {
                const prefs = getNotifPrefs(u);
                return (
                  <label key={key} className="flex items-center gap-1.5 text-[10px] text-gs-dim cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={prefs[key]}
                      onChange={() => toggleNotifPref(u, key)}
                      className="accent-gs-accent w-3 h-3"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Improvement 19: Category assignment */}
        {isFollowed && categoryNames.length > 0 && (
          <div className="mt-2 flex gap-1 flex-wrap">
            {categoryNames.map(cat => {
              const inCat = (followCategories[cat] || []).includes(u);
              return (
                <button
                  key={cat}
                  onClick={() => toggleUserInCategory(u, cat)}
                  className={`text-[9px] px-1.5 py-0.5 rounded-full border cursor-pointer transition-colors ${
                    inCat
                      ? 'bg-gs-accent/15 text-gs-accent border-gs-accent/30'
                      : 'bg-transparent text-gs-faint border-gs-border hover:border-gs-accent/20'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {/* Improvement 22: Mutual collections preview */}
        {isFollowed && mutualRecs.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-[#1a1a1a]">
            <div className="text-[10px] text-gs-faint font-mono mb-2">RECORDS IN COMMON ({mutualRecs.length})</div>
            <div className="flex gap-1.5 overflow-x-auto">
              {mutualRecs.slice(0, 5).map(r => (
                <div key={r.id} className="shrink-0" title={`${r.album} by ${r.artist}`}>
                  <AlbumArt album={r.album} artist={r.artist} accent={r.accent || "#555"} size={28} />
                </div>
              ))}
              {mutualRecs.length > 5 && (
                <span className="text-[10px] text-gs-faint self-center ml-1">+{mutualRecs.length - 5} more</span>
              )}
            </div>
          </div>
        )}

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
        <div className="flex items-center gap-2">
          {/* Improvement 20: Export button */}
          {following.length > 0 && (
            <button
              onClick={exportFollowingList}
              className="px-2.5 py-1.5 text-[10px] border border-gs-border bg-gs-card text-gs-faint rounded-lg cursor-pointer hover:text-gs-text hover:border-gs-accent/30 transition-colors"
              title="Export following list"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block mr-1"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
          )}
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
      </div>
      <p className="text-xs text-gs-dim mb-3">Following {following.length} collector{following.length !== 1 ? "s" : ""}</p>

      {/* Improvement 16 & 23: Tab navigation (Following / Activity / Discover) */}
      <div className="flex gap-1 bg-gs-card border border-gs-border rounded-[10px] p-[3px] mb-4">
        {[
          ["following", "Following"],
          ["activity", "Activity"],
          ["discover", "Discover"],
        ].map(([val, label]) => (
          <button
            key={val}
            onClick={() => { setActiveTab(val); if (val === "discover" && !discoveryUser) discoverRandomUser(); }}
            className={`flex-1 px-3 py-1.5 rounded-lg border-none text-xs font-semibold cursor-pointer transition-all duration-150 ${
              activeTab === val
                ? "bg-gradient-to-br from-gs-accent to-gs-indigo text-white"
                : "bg-transparent text-gs-dim"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Improvement 16: Activity feed tab */}
      {activeTab === "activity" && (
        <div className="mb-6">
          <div className="text-[11px] font-bold text-gs-dim tracking-widest font-mono mb-3">RECENT ACTIVITY</div>
          {activityFeed.length === 0 ? (
            <div className="text-center py-8 text-gs-faint text-xs">No recent activity from people you follow.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {activityFeed.map(event => {
                const p = getProfile(event.user);
                return (
                  <div key={event.id} className="bg-gs-card border border-gs-border rounded-xl px-4 py-3">
                    <div className="flex gap-3 items-center">
                      <Avatar username={event.user} size={36} onClick={() => onViewUser(event.user)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gs-text">
                          <span className="font-bold cursor-pointer hover:text-gs-accent" onClick={() => onViewUser(event.user)}>{p.displayName}</span>
                          {' '}
                          <span className="text-gs-dim">
                            {event.type === 'added' ? 'added to collection' : 'listed for sale'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <AlbumArt album={event.record.album} artist={event.record.artist} accent={event.record.accent || "#555"} size={32} />
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-gs-muted truncate">{event.record.album}</div>
                            <div className="text-[10px] text-gs-faint truncate">{event.record.artist}</div>
                          </div>
                          {event.record.forSale && (
                            <span className="text-[11px] font-bold text-amber-400 shrink-0 ml-auto">${event.record.price}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-gs-faint font-mono shrink-0">{event.timeAgo}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Improvement 23: Discovery mode tab */}
      {activeTab === "discover" && discoveryUser && (
        <div className="mb-6">
          <div className="text-[11px] font-bold text-gs-dim tracking-widest font-mono mb-3">DISCOVER A COLLECTOR</div>
          {(() => {
            const p = getProfile(discoveryUser);
            const userRecs = records.filter(r => r.user === discoveryUser);
            const online = isOnline(discoveryUser);
            const counts = getUserCounts(discoveryUser);
            const isFollowed = following.includes(discoveryUser);
            const mutualRecs = getMutualRecords(discoveryUser);
            return (
              <div className="bg-gs-card border border-gs-border rounded-xl p-5">
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="relative mb-3">
                    <Avatar username={discoveryUser} size={72} onClick={() => onViewUser(discoveryUser)} />
                    {online && <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-500 border-2 border-gs-card" />}
                  </div>
                  <div className="text-lg font-bold text-gs-text cursor-pointer" onClick={() => onViewUser(discoveryUser)}>{p.displayName}</div>
                  <div className="text-[11px] text-gs-dim font-mono mb-1">@{discoveryUser}</div>
                  {p.bio && <div className="text-xs text-[#777] mt-1 max-w-[300px]">{p.bio}</div>}
                  {p.location && <div className="text-[10px] text-gs-faint mt-1">{p.location}</div>}
                </div>
                <div className="flex justify-center gap-6 text-[11px] text-gs-faint font-mono mb-4">
                  <span>{counts.followers} followers</span>
                  <span>{counts.following} following</span>
                  <span>{userRecs.length} records</span>
                  {mutualRecs.length > 0 && <span className="text-green-400">{mutualRecs.length} in common</span>}
                </div>
                {p.favGenre && (
                  <div className="flex justify-center mb-4">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gs-accent/10 text-gs-accent border border-gs-accent/20">{p.favGenre}</span>
                  </div>
                )}
                {userRecs.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[10px] text-gs-faint font-mono mb-2 text-center">THEIR COLLECTION</div>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {userRecs.slice(0, 6).map(r => (
                        <div key={r.id} className="shrink-0" title={`${r.album} by ${r.artist}`}>
                          <AlbumArt album={r.album} artist={r.artist} accent={r.accent || "#555"} size={48} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => onFollow(discoveryUser)}
                    className={`px-5 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                      isFollowed
                        ? 'border border-gs-border-hover bg-[#1a1a1a] text-gs-muted'
                        : 'gs-btn-gradient text-white border-none'
                    }`}
                  >
                    {isFollowed ? 'Following' : 'Follow'}
                  </button>
                  <button
                    onClick={discoverRandomUser}
                    className="px-5 py-2 rounded-lg border border-gs-border bg-gs-card text-gs-dim text-xs font-semibold cursor-pointer hover:border-gs-accent/30 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Following tab content */}
      {activeTab === "following" && (
        <>
          {/* Search bar */}
          <div className="relative mb-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search people..."
              className="w-full bg-[#111] border border-gs-border rounded-lg px-3.5 py-2.5 pl-9 text-xs text-gs-text placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-faint text-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </span>
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gs-faint text-xs bg-transparent border-0 cursor-pointer hover:text-gs-text">
                ×
              </button>
            )}
          </div>

          {/* Improvement 19: Category filter pills */}
          {categoryNames.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-3 items-center">
              <button
                onClick={() => setFilterByCategory(null)}
                className={`text-[10px] px-2 py-1 rounded-full border cursor-pointer transition-colors ${
                  !filterByCategory
                    ? 'bg-gs-accent/15 text-gs-accent border-gs-accent/30'
                    : 'bg-transparent text-gs-faint border-gs-border'
                }`}
              >
                All
              </button>
              {categoryNames.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterByCategory(filterByCategory === cat ? null : cat)}
                  className={`text-[10px] px-2 py-1 rounded-full border cursor-pointer transition-colors ${
                    filterByCategory === cat
                      ? 'bg-gs-accent/15 text-gs-accent border-gs-accent/30'
                      : 'bg-transparent text-gs-faint border-gs-border'
                  }`}
                >
                  {cat} ({(followCategories[cat] || []).filter(u => following.includes(u)).length})
                </button>
              ))}
              <button
                onClick={() => setShowCategoryManager(!showCategoryManager)}
                className="text-[10px] px-1.5 py-1 rounded-full border border-dashed border-gs-border text-gs-faint cursor-pointer hover:text-gs-accent hover:border-gs-accent/30 transition-colors"
              >
                +
              </button>
            </div>
          )}

          {/* Improvement 19: Category manager */}
          {(showCategoryManager || categoryNames.length === 0) && following.length > 0 && (
            <div className="mb-3 p-3 bg-gs-card border border-gs-border rounded-xl">
              <div className="text-[10px] font-bold text-gs-dim tracking-widest font-mono mb-2">
                {categoryNames.length === 0 ? 'CREATE A LIST' : 'MANAGE LISTS'}
              </div>
              <div className="flex gap-2 items-center mb-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCategory()}
                  placeholder="New list name..."
                  className="flex-1 bg-[#111] border border-gs-border rounded-lg px-3 py-1.5 text-xs text-gs-text placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50"
                />
                <button
                  onClick={addCategory}
                  className="px-3 py-1.5 rounded-lg border-none bg-gs-accent/20 text-gs-accent text-xs font-semibold cursor-pointer"
                >
                  Add
                </button>
              </div>
              {categoryNames.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {categoryNames.map(cat => (
                    <span key={cat} className="text-[10px] px-2 py-1 rounded-full bg-[#111] text-gs-dim border border-gs-border flex items-center gap-1">
                      {cat}
                      <button
                        onClick={() => removeCategory(cat)}
                        className="bg-transparent border-none text-gs-faint hover:text-red-400 cursor-pointer p-0 text-[10px] leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Improvement 18: Batch mode controls */}
          <div className="flex items-center gap-2 mb-3">
            {following.length > 1 && (
              <button
                onClick={() => { setBatchMode(!batchMode); setBatchSelected(new Set()); }}
                className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold cursor-pointer transition-colors ${
                  batchMode
                    ? 'border-gs-accent/40 bg-gs-accent/10 text-gs-accent'
                    : 'border-gs-border bg-gs-card text-gs-faint'
                }`}
              >
                {batchMode ? 'Cancel' : 'Select Multiple'}
              </button>
            )}
            {batchMode && batchSelected.size > 0 && (
              <button
                onClick={batchUnfollow}
                className="px-2.5 py-1 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-semibold cursor-pointer"
              >
                Unfollow {batchSelected.size}
              </button>
            )}
            {/* Improvement 23: Discovery mode shortcut */}
            <button
              onClick={discoverRandomUser}
              className="px-2.5 py-1 rounded-lg border border-gs-border bg-gs-card text-gs-faint text-[10px] font-semibold cursor-pointer hover:text-gs-accent hover:border-gs-accent/30 transition-colors ml-auto"
            >
              Discover Someone
            </button>
          </div>

          {/* Following section */}
          {following.length > 0 && (
            <>
              <div className="text-[11px] font-bold text-gs-dim tracking-widest font-mono mb-2.5">
                PEOPLE YOU FOLLOW {search && `(${filteredFollowing.length})`}
                {filterByCategory && ` / ${filterByCategory}`}
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

          {/* Improvement 17: Enhanced suggestions — shared genres first with better scoring */}
          {scoredSuggestions.some(s => s.sharedGenre) && (
            <>
              <div className="text-[11px] font-bold text-gs-dim tracking-widest font-mono mb-2.5">SUGGESTED FOR YOU</div>
              <p className="text-[10px] text-gs-faint mb-2.5">Collectors who share your taste</p>
              {/* Improvement 18: Batch follow for suggestions */}
              {batchMode && batchSelected.size > 0 && (
                <div className="mb-2">
                  <button
                    onClick={batchFollow}
                    className="px-3 py-1.5 rounded-lg border-none bg-gradient-to-br from-gs-accent to-gs-indigo text-white text-xs font-bold cursor-pointer"
                  >
                    Follow {batchSelected.size} selected
                  </button>
                </div>
              )}
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
        </>
      )}
    </div>
  );
}
