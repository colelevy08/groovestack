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
    <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={onClose}>
      <div
        style={{ position: "absolute", top: 0, right: 0, width: 320, height: "100vh", background: "#0d0d0d", borderLeft: "1px solid #1a1a1a", display: "flex", flexDirection: "column", boxShadow: "-16px 0 48px rgba(0,0,0,0.7)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid #1a1a1a" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f5" }}>Notifications</span>
          <button onClick={onClose} style={{ background: "#1a1a1a", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", color: "#888", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {notifs.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#444", fontSize: 13 }}>No notifications yet.</div>}
          {notifs.map(n => (
            <div
              key={n.id}
              style={{ display: "flex", gap: 12, padding: "14px 20px", borderBottom: "1px solid #111", cursor: "pointer", transition: "background 0.12s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#111"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
              onClick={() => { onViewUser(n.user); onClose(); }}
            >
              <Avatar username={n.user} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#ddd", lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700, color: "#f5f5f5" }}>@{n.user}</span> {n.text}
                </div>
                <div style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono',monospace", marginTop: 3 }}>{n.time}</div>
              </div>
              <span style={{ fontSize: 16 }}>{NOTIF_ICONS[n.type]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
