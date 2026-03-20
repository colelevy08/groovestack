// Responsive navigation: fixed left sidebar on desktop, bottom tab bar on mobile.
// Desktop sidebar: logo, nav links, action buttons, user profile.
// Mobile bar: 5 tab icons at the bottom of the screen.
// All state and callbacks come from App.js.

import Avatar from './ui/Avatar';

// Each nav item maps to a screen name and an SVG icon path.
const NAV_ITEMS = [
  { id: "Social",     path: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" },
  { id: "Marketplace", path: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" },
  { id: "Collection", path: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { id: "Activity",   path: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { id: "Vinyl Buddy", path: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" },
  { id: "Profile",    path: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
];

// Mobile bottom bar shows these 5 tabs (condensed from 6)
const MOBILE_TABS = [
  { id: "Social",     label: "Feed",   path: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" },
  { id: "Marketplace", label: "Shop",  path: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" },
  { id: "Collection",  label: "Crate", path: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { id: "Vinyl Buddy", label: "Buddy", path: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" },
  { id: "Profile",     label: "Me",    path: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
];

export default function Sidebar({ nav, setNav, following, profile, currentUser, notifCount, onNotifClick, onAddRecord, onMessages, onLogout, isGuest, onSignIn }) {
  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────────────────────── */}
      <div className="gs-sidebar-desktop" style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 196, background: "#0a0a0a", borderRight: "1px solid #161616", display: "flex", flexDirection: "column", padding: "22px 0", zIndex: 100 }}>
        {/* Logo + notifications */}
        <div style={{ padding: "0 18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
            </div>
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.04em" }}>groove<span style={{ color: "#0ea5e9" }}>stack</span></span>
          </div>
          <button onClick={onNotifClick} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: "#555", padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifCount > 0 && (
              <div style={{ position: "absolute", top: -2, right: -2, width: 14, height: 14, borderRadius: "50%", background: "#ef4444", fontSize: 8, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {notifCount}
              </div>
            )}
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: "0 8px" }}>
          {NAV_ITEMS.map(({ id, path }) => {
            const active = nav === id;
            const guestAllowed = ["Marketplace", "Collection"].includes(id);
            const dimmed = isGuest && !guestAllowed;
            return (
              <button
                key={id}
                onClick={() => setNav(id)}
                style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 12px", borderRadius: 9, background: active ? "#0ea5e911" : "none", border: active ? "1px solid #0ea5e922" : "1px solid transparent", color: active ? "#0ea5e9" : dimmed ? "#333" : "#555", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 500, marginBottom: 2, textAlign: "left", transition: "all 0.15s", opacity: dimmed ? 0.5 : 1 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={path} />
                </svg>
                {id}
                {dimmed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: "auto", opacity: 0.4 }}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions — hidden for guests */}
        {!isGuest && (
          <div style={{ padding: "0 8px 8px" }}>
            <button onClick={onAddRecord} style={{ width: "100%", padding: 10, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", borderRadius: 9, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 6 }}>
              + Add Record
            </button>
            <button onClick={onMessages} style={{ width: "100%", padding: 9, background: "#111", border: "1px solid #1e1e1e", borderRadius: 9, color: "#888", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Messages
            </button>
          </div>
        )}

        {/* Current user / guest sign-in */}
        <div style={{ padding: "10px 8px 0", borderTop: "1px solid #161616", margin: "0 8px" }}>
          {isGuest ? (
            <>
              <button
                onClick={onSignIn}
                style={{ width: "100%", padding: 11, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", borderRadius: 9, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", marginBottom: 6 }}
              >
                Create Profile
              </button>
              <button
                onClick={onSignIn}
                style={{ width: "100%", padding: 9, background: "#111", border: "1px solid #1e1e1e", borderRadius: 9, color: "#888", fontWeight: 600, fontSize: 11, cursor: "pointer", textAlign: "center" }}
              >
                Log in
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setNav("Profile")}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", width: "100%", background: "none", border: "none", cursor: "pointer", borderRadius: 8 }}
                onMouseEnter={e => e.currentTarget.style.background = "#111"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <Avatar username={currentUser} size={30} src={profile.avatarUrl} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e0" }}>{profile.displayName}</div>
                  <div style={{ fontSize: "10px", color: "#444", fontFamily: "'DM Mono',monospace" }}>@{currentUser}</div>
                </div>
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  style={{ width: '100%', padding: '8px 10px', background: 'none', border: 'none', color: '#444', fontSize: 11, fontWeight: 500, cursor: 'pointer', marginTop: 4, fontFamily: "'DM Mono',monospace", textAlign: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = '#444'}
                >
                  Log out
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Mobile bottom tab bar ──────────────────────────────────────── */}
      <div className="gs-mobile-bar" style={{
        display: "none", /* shown via media query */
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#0a0a0a", borderTop: "1px solid #161616",
        justifyContent: "space-around", alignItems: "center",
        padding: "6px 0 env(safe-area-inset-bottom, 6px)",
        zIndex: 100,
      }}>
        {MOBILE_TABS.map(({ id, label, path }) => {
          const active = nav === id;
          const guestLocked = isGuest && !["Marketplace", "Collection"].includes(id);
          // For guests, Profile tab becomes Sign In
          const isGuestProfile = isGuest && id === "Profile";
          return (
            <button
              key={id}
              onClick={() => isGuestProfile ? onSignIn() : setNav(id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                background: "none", border: "none", cursor: "pointer",
                color: active ? "#0ea5e9" : guestLocked ? "#333" : "#555",
                opacity: guestLocked && !isGuestProfile ? 0.4 : 1,
                padding: "4px 0", minWidth: 52,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={path} />
              </svg>
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, fontFamily: "'DM Sans',sans-serif" }}>
                {isGuestProfile ? "Sign In" : label}
              </span>
              {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#0ea5e9", marginTop: 1 }} />}
            </button>
          );
        })}
      </div>
    </>
  );
}
