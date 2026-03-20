// Slide-in notification panel from the right side — opened by clicking the bell icon in Sidebar.
// Generates a simulated list of recent activity: new followers, likes on the user's records, and comments.
// Notifications are derived from live state (following array + user's records) rather than stored.
// Clicking any notification opens that user's profile and closes the panel.
// The outer full-screen div captures outside clicks to close; stopPropagation on the panel itself prevents that.
import { useState, useMemo, useCallback, useRef } from 'react';
import Avatar from '../ui/Avatar';

// Maps notification type to an emoji icon for visual context
const NOTIF_ICONS = { follow: "👤", like: "❤️", comment: "💬", offer: "💰", trade: "🔄", combo: "🤝" };

// Group labels and order
const GROUP_ORDER = [
  { key: "offer", label: "Offers & Trades", types: ["offer", "trade", "combo"] },
  { key: "follow", label: "New Followers", types: ["follow"] },
  { key: "engagement", label: "Likes & Comments", types: ["like", "comment"] },
];

// NEW: Category tabs for filtering
const CATEGORY_TABS = [
  { key: 'all', label: 'All' },
  { key: 'offers', label: 'Offers', types: ['offer', 'trade', 'combo'] },
  { key: 'social', label: 'Social', types: ['follow'] },
  { key: 'engagement', label: 'Activity', types: ['like', 'comment'] },
];

// NEW: Priority level helper
function getPriority(n) {
  if (n.type === 'offer' || n.type === 'combo' || n.type === 'trade') return 'urgent';
  if (n.type === 'comment') return 'normal';
  return 'low';
}

const PRIORITY_COLORS = {
  urgent: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', text: '#ef4444', label: 'Urgent' },
  normal: { bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)', text: '#60a5fa', label: 'Normal' },
  low: { bg: 'transparent', border: 'transparent', text: '#6b7280', label: 'Low' },
};

export default function NotificationsPanel({ open, onClose, following, records, currentUser, offers, onViewUser, onOpenOffer }) {
  const [readIds, setReadIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('all');
  const [readFilter, setReadFilter] = useState('all'); // 'all', 'unread', 'read'
  const [searchQuery, setSearchQuery] = useState('');
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({
    offers: true,
    follows: true,
    likes: true,
    comments: true,
  });
  const swipeRefs = useRef({});

  const myRecords = records.filter(r => r.user === currentUser);

  // Build notifications
  const notifs = useMemo(() => {
    const all = [
      ...following.map((u, i) => ({ id: `f${i}`, type: "follow", user: u, text: "started following you", time: ["2m ago", "15m ago", "1h ago", "3h ago"][i % 4] })),
      ...myRecords.slice(0, 3).map((r, i) => ({ id: `l${i}`, type: "like", user: ["mara.vinyl", "thomas.wax", "juniper.sounds"][i % 3], text: `liked your post of ${r.album}`, time: ["5m ago", "22m ago", "2h ago"][i % 3] })),
      ...myRecords.slice(0, 2).map((r, i) => ({ id: `c${i}`, type: "comment", user: ["felix.rpm", "cleo.spins"][i % 2], text: `commented on ${r.album}`, time: ["8m ago", "45m ago"][i % 2] })),
      ...(offers || []).filter(o => o.to === currentUser).map(o => {
        let text, icon;
        if (o.type === "trade") {
          text = `wants to trade for ${o.album} (offering their ${o.tradeRecord?.album || "record"})`;
          icon = "trade";
        } else if (o.type === "combo") {
          text = `combo offer for ${o.album}: their ${o.tradeRecord?.album || "record"} + $${o.price}`;
          icon = "combo";
        } else {
          text = `offered $${o.price} for ${o.album}`;
          icon = "offer";
        }
        return { id: `o${o.id}`, type: icon, user: o.from, text, time: o.time || "just now", offer: o };
      }),
    ].slice(0, 14);
    // Filter out dismissed
    return all.filter(n => !dismissedIds.has(n.id));
  }, [following, myRecords, offers, currentUser, dismissedIds]);

  // NEW: Filtered notifications by category tab
  const filteredNotifs = useMemo(() => {
    let result = notifs;

    // Filter by category tab
    if (activeTab !== 'all') {
      const tab = CATEGORY_TABS.find(t => t.key === activeTab);
      if (tab && tab.types) {
        result = result.filter(n => tab.types.includes(n.type));
      }
    }

    // NEW: Filter by read/unread status
    if (readFilter === 'unread') {
      result = result.filter(n => !readIds.has(n.id));
    } else if (readFilter === 'read') {
      result = result.filter(n => readIds.has(n.id));
    }

    // NEW: Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n =>
        n.user.toLowerCase().includes(q) ||
        n.text.toLowerCase().includes(q)
      );
    }

    // Filter by notification preferences
    result = result.filter(n => {
      if ((n.type === 'offer' || n.type === 'trade' || n.type === 'combo') && !notifPrefs.offers) return false;
      if (n.type === 'follow' && !notifPrefs.follows) return false;
      if (n.type === 'like' && !notifPrefs.likes) return false;
      if (n.type === 'comment' && !notifPrefs.comments) return false;
      return true;
    });

    return result;
  }, [notifs, activeTab, readFilter, searchQuery, readIds, notifPrefs]);

  // Group filtered notifications by type
  const grouped = useMemo(() => {
    return GROUP_ORDER
      .map(group => ({
        ...group,
        items: filteredNotifs.filter(n => group.types.includes(n.type)),
      }))
      .filter(group => group.items.length > 0);
  }, [filteredNotifs]);

  // NEW: Notification count by category
  const categoryCounts = useMemo(() => {
    const counts = { all: notifs.length };
    CATEGORY_TABS.forEach(tab => {
      if (tab.key !== 'all' && tab.types) {
        counts[tab.key] = notifs.filter(n => tab.types.includes(n.type)).length;
      }
    });
    return counts;
  }, [notifs]);

  const unreadCount = notifs.filter(n => !readIds.has(n.id)).length;

  const markAllRead = () => {
    setReadIds(new Set(notifs.map(n => n.id)));
  };

  const handleNotifClick = (n) => {
    setReadIds(prev => new Set([...prev, n.id]));
    if (n.offer && onOpenOffer) {
      onOpenOffer(n.offer);
      onClose();
    } else {
      onViewUser(n.user);
      onClose();
    }
  };

  // NEW: Swipe to dismiss handling
  const handleTouchStart = useCallback((id, e) => {
    const touch = e.touches[0];
    swipeRefs.current[id] = { startX: touch.clientX, currentX: touch.clientX };
  }, []);

  const handleTouchMove = useCallback((id, e) => {
    if (!swipeRefs.current[id]) return;
    const touch = e.touches[0];
    swipeRefs.current[id].currentX = touch.clientX;
    const dx = touch.clientX - swipeRefs.current[id].startX;
    // Only allow swiping left (dismiss)
    if (dx < 0) {
      const el = e.currentTarget;
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(Math.max(0.3, 1 + dx / 200));
    }
  }, []);

  const handleTouchEnd = useCallback((id, e) => {
    if (!swipeRefs.current[id]) return;
    const dx = swipeRefs.current[id].currentX - swipeRefs.current[id].startX;
    const el = e.currentTarget;
    if (dx < -100) {
      // Dismiss
      el.style.transform = 'translateX(-100%)';
      el.style.opacity = '0';
      setTimeout(() => {
        setDismissedIds(prev => new Set([...prev, id]));
      }, 200);
    } else {
      // Reset
      el.style.transform = 'translateX(0)';
      el.style.opacity = '1';
    }
    delete swipeRefs.current[id];
  }, []);

  // NEW: Toggle notification preference
  const togglePref = useCallback((key) => {
    setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999]" onClick={onClose}>
      <div
        className="absolute top-0 right-0 w-80 h-screen bg-gs-surface border-l border-gs-border flex flex-col shadow-[-16px_0_48px_rgba(0,0,0,0.7)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-[18px] border-b border-gs-border">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-gs-text">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold bg-gs-accent text-black px-1.5 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* NEW: Preferences toggle */}
            <button
              onClick={() => setPrefsOpen(p => !p)}
              className="bg-transparent border-none text-gs-dim cursor-pointer hover:text-gs-muted transition-colors p-0"
              aria-label="Notification preferences"
              title="Preferences"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="bg-transparent border-none text-[11px] text-gs-accent cursor-pointer hover:text-gs-text transition-colors p-0"
              >
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="bg-gs-border border-none rounded-md w-7 h-7 cursor-pointer text-gs-muted text-lg flex items-center justify-center hover:text-gs-text">
              x
            </button>
          </div>
        </div>

        {/* NEW: Notification preferences inline panel */}
        {prefsOpen && (
          <div className="px-5 py-3 border-b border-gs-border bg-[#0a0a0a] animate-fade-in">
            <div className="text-[10px] text-gs-dim font-mono tracking-widest mb-2">NOTIFICATION PREFERENCES</div>
            {[
              { key: 'offers', label: 'Offers & Trades' },
              { key: 'follows', label: 'New Followers' },
              { key: 'likes', label: 'Likes' },
              { key: 'comments', label: 'Comments' },
            ].map(pref => (
              <label key={pref.key} className="flex items-center justify-between py-1.5 cursor-pointer">
                <span className="text-xs text-gs-muted">{pref.label}</span>
                <button
                  onClick={() => togglePref(pref.key)}
                  className={`w-8 h-[18px] rounded-full border-none cursor-pointer transition-colors relative ${
                    notifPrefs[pref.key] ? 'bg-gs-accent' : 'bg-[#333]'
                  }`}
                  role="switch"
                  aria-checked={notifPrefs[pref.key]}
                  aria-label={`Toggle ${pref.label}`}
                >
                  <span
                    className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
                      notifPrefs[pref.key] ? 'left-[17px]' : 'left-[2px]'
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        )}

        {/* NEW: Search bar */}
        <div className="px-5 pt-3 pb-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gs-dim" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#111] border border-gs-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-gs-text outline-none placeholder:text-gs-dim focus:border-gs-accent/30 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none text-gs-dim cursor-pointer hover:text-gs-muted p-0 text-xs"
                aria-label="Clear search"
              >
                x
              </button>
            )}
          </div>
        </div>

        {/* NEW: Category tabs with counts */}
        <div className="flex items-center gap-1 px-5 pb-2 overflow-x-auto">
          {CATEGORY_TABS.map(tab => {
            const count = categoryCounts[tab.key] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border-none cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-gs-accent/10 text-gs-accent'
                    : 'bg-transparent text-gs-dim hover:text-gs-muted'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-[9px] px-1 py-0 rounded-full ${
                    activeTab === tab.key ? 'bg-gs-accent/20 text-gs-accent' : 'bg-[#222] text-gs-faint'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* NEW: Read/unread filter */}
        <div className="flex items-center gap-1 px-5 pb-2">
          {['all', 'unread', 'read'].map(f => (
            <button
              key={f}
              onClick={() => setReadFilter(f)}
              className={`px-2 py-0.5 rounded text-[9px] font-semibold border-none cursor-pointer transition-colors ${
                readFilter === f
                  ? 'bg-[#1a1a1a] text-gs-muted'
                  : 'bg-transparent text-gs-dim hover:text-gs-muted'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Empty state */}
          {filteredNotifs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="text-4xl mb-3">
                {searchQuery ? '🔍' : '🔔'}
              </div>
              <div className="text-gs-muted text-[14px] font-semibold mb-1">
                {searchQuery ? 'No matching notifications' : 'All caught up!'}
              </div>
              <div className="text-gs-faint text-[12px]">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'When someone likes, comments, or makes an offer on your records, it will show up here.'}
              </div>
            </div>
          )}

          {/* Grouped notifications */}
          {grouped.map(group => (
            <div key={group.key}>
              <div className="px-5 pt-4 pb-1.5">
                <div className="text-[10px] text-gs-dim font-mono tracking-widest">{group.label.toUpperCase()}</div>
              </div>
              {group.items.map(n => {
                const isRead = readIds.has(n.id);
                const priority = getPriority(n);
                const prioStyle = PRIORITY_COLORS[priority];
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-5 py-3.5 border-b border-[#111] cursor-pointer transition-all duration-[120ms] hover:bg-[#111] ${!isRead ? 'bg-[#0a0a0a]' : ''}`}
                    style={{ touchAction: 'pan-y' }}
                    onClick={() => handleNotifClick(n)}
                    onTouchStart={(e) => handleTouchStart(n.id, e)}
                    onTouchMove={(e) => handleTouchMove(n.id, e)}
                    onTouchEnd={(e) => handleTouchEnd(n.id, e)}
                  >
                    <div className="relative shrink-0">
                      <Avatar username={n.user} size={36} />
                      {!isRead && (
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-gs-accent rounded-full border-2 border-gs-surface" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[#ddd] leading-normal">
                        <span className="font-bold text-gs-text">@{n.user}</span> {n.text}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gs-faint font-mono">{n.time}</span>
                        {/* NEW: Priority level badge */}
                        {priority === 'urgent' && (
                          <span
                            className="text-[8px] font-bold px-1 py-0 rounded"
                            style={{ background: prioStyle.bg, color: prioStyle.text, border: `1px solid ${prioStyle.border}` }}
                          >
                            URGENT
                          </span>
                        )}
                      </div>
                      {/* NEW: Inline action buttons */}
                      {n.offer && (
                        <div className="flex gap-1.5 mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenOffer) {
                                onOpenOffer(n.offer);
                                onClose();
                              }
                            }}
                            className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-gs-accent/10 text-gs-accent border border-gs-accent/20 cursor-pointer hover:bg-gs-accent/20 transition-colors"
                          >
                            View Offer
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotifClick(n);
                            }}
                            className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-[#111] text-gs-muted border border-gs-border cursor-pointer hover:border-gs-border-hover transition-colors"
                          >
                            View Profile
                          </button>
                        </div>
                      )}
                      {!n.offer && n.type === 'like' && (
                        <div className="flex gap-1.5 mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewUser(n.user);
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-[#111] text-gs-muted border border-gs-border cursor-pointer hover:border-gs-border-hover transition-colors"
                          >
                            View Record
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-base shrink-0">{NOTIF_ICONS[n.type]}</span>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Swipe hint for mobile */}
          {filteredNotifs.length > 0 && (
            <div className="text-[8px] text-gs-faint text-center py-3 sm:hidden">
              Swipe left to dismiss
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
