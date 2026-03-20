// Slide-in notification panel from the right side — opened by clicking the bell icon in Sidebar.
// Generates a simulated list of recent activity: new followers, likes on the user's records, and comments.
// Notifications are derived from live state (following array + user's records) rather than stored.
// Clicking any notification opens that user's profile and closes the panel.
// The outer full-screen div captures outside clicks to close; stopPropagation on the panel itself prevents that.
import Avatar from '../ui/Avatar';

// Maps notification type to an emoji icon for visual context
const NOTIF_ICONS = { follow: "👤", like: "❤️", comment: "💬", offer: "💰", trade: "🔄", combo: "🤝" };

export default function NotificationsPanel({ open, onClose, following, records, currentUser, offers, onViewUser }) {
  if (!open) return null;

  const myRecords = records.filter(r => r.user === currentUser);
  // Build up to 14 notifications: follows first, then likes and comments on the user's own records
  const notifs = [
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
      return { id: `o${o.id}`, type: icon, user: o.from, text, time: o.time || "just now" };
    }),
  ].slice(0, 14);

  return (
    <div className="fixed inset-0 z-[999]" onClick={onClose}>
      <div
        className="absolute top-0 right-0 w-80 h-screen bg-gs-surface border-l border-gs-border flex flex-col shadow-[-16px_0_48px_rgba(0,0,0,0.7)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-5 py-[18px] border-b border-gs-border">
          <span className="text-[15px] font-bold text-gs-text">Notifications</span>
          <button onClick={onClose} className="bg-gs-border border-none rounded-md w-7 h-7 cursor-pointer text-gs-muted text-lg flex items-center justify-center hover:text-gs-text">×</button>
        </div>
        <div className="overflow-y-auto flex-1">
          {notifs.length === 0 && <div className="p-10 text-center text-gs-faint text-[13px]">No notifications yet.</div>}
          {notifs.map(n => (
            <div
              key={n.id}
              className="flex gap-3 px-5 py-3.5 border-b border-[#111] cursor-pointer transition-colors duration-[120ms] hover:bg-[#111]"
              onClick={() => { onViewUser(n.user); onClose(); }}
            >
              <Avatar username={n.user} size={36} />
              <div className="flex-1">
                <div className="text-xs text-[#ddd] leading-normal">
                  <span className="font-bold text-gs-text">@{n.user}</span> {n.text}
                </div>
                <div className="text-[11px] text-gs-faint font-mono mt-0.5">{n.time}</div>
              </div>
              <span className="text-base">{NOTIF_ICONS[n.type]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
