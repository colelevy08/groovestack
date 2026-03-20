// Slide-in notification panel from the right side — opened by clicking the bell icon in Sidebar.
// Generates a simulated list of recent activity: new followers, likes on the user's records, and comments.
// Notifications are derived from live state (following array + user's records) rather than stored.
// Clicking any notification opens that user's profile and closes the panel.
// The outer full-screen div captures outside clicks to close; stopPropagation on the panel itself prevents that.
import { useState, useMemo } from 'react';
import Avatar from '../ui/Avatar';

// Maps notification type to an emoji icon for visual context
const NOTIF_ICONS = { follow: "👤", like: "❤️", comment: "💬", offer: "💰", trade: "🔄", combo: "🤝" };

// Group labels and order
const GROUP_ORDER = [
  { key: "offer", label: "Offers & Trades", types: ["offer", "trade", "combo"] },
  { key: "follow", label: "New Followers", types: ["follow"] },
  { key: "engagement", label: "Likes & Comments", types: ["like", "comment"] },
];

export default function NotificationsPanel({ open, onClose, following, records, currentUser, offers, onViewUser, onOpenOffer }) {
  const [readIds, setReadIds] = useState(new Set());

  const myRecords = records.filter(r => r.user === currentUser);
  // Build up to 14 notifications: follows first, then likes and comments on the user's own records
  const notifs = useMemo(() => [
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
  ].slice(0, 14), [following, myRecords, offers, currentUser]);

  // Group notifications by type
  const grouped = useMemo(() => {
    return GROUP_ORDER
      .map(group => ({
        ...group,
        items: notifs.filter(n => group.types.includes(n.type)),
      }))
      .filter(group => group.items.length > 0);
  }, [notifs]);

  const unreadCount = notifs.filter(n => !readIds.has(n.id)).length;

  const markAllRead = () => {
    setReadIds(new Set(notifs.map(n => n.id)));
  };

  const handleNotifClick = (n) => {
    setReadIds(prev => new Set([...prev, n.id]));
    // If it's an offer notification and we have an offer handler, open the offer
    if (n.offer && onOpenOffer) {
      onOpenOffer(n.offer);
      onClose();
    } else {
      onViewUser(n.user);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999]" onClick={onClose}>
      <div
        className="absolute top-0 right-0 w-80 h-screen bg-gs-surface border-l border-gs-border flex flex-col shadow-[-16px_0_48px_rgba(0,0,0,0.7)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with mark all read */}
        <div className="flex justify-between items-center px-5 py-[18px] border-b border-gs-border">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-gs-text">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold bg-gs-accent text-black px-1.5 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="bg-transparent border-none text-[11px] text-gs-accent cursor-pointer hover:text-gs-text transition-colors p-0"
              >
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="bg-gs-border border-none rounded-md w-7 h-7 cursor-pointer text-gs-muted text-lg flex items-center justify-center hover:text-gs-text">×</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Empty state */}
          {notifs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="text-4xl mb-3">🔔</div>
              <div className="text-gs-muted text-[14px] font-semibold mb-1">All caught up!</div>
              <div className="text-gs-faint text-[12px]">When someone likes, comments, or makes an offer on your records, it will show up here.</div>
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
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-5 py-3.5 border-b border-[#111] cursor-pointer transition-colors duration-[120ms] hover:bg-[#111] ${!isRead ? 'bg-[#0a0a0a]' : ''}`}
                    onClick={() => handleNotifClick(n)}
                  >
                    <div className="relative shrink-0">
                      <Avatar username={n.user} size={36} />
                      {!isRead && (
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-gs-accent rounded-full border-2 border-gs-surface" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-[#ddd] leading-normal">
                        <span className="font-bold text-gs-text">@{n.user}</span> {n.text}
                      </div>
                      <div className="text-[10px] text-gs-faint font-mono mt-1">{n.time}</div>
                    </div>
                    <span className="text-base shrink-0">{NOTIF_ICONS[n.type]}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
