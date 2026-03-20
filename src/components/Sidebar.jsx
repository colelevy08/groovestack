// Responsive navigation: fixed left sidebar on desktop, bottom tab bar on mobile.
// All state and callbacks come from App.js.

import Avatar from './ui/Avatar';

const NAV_ITEMS = [
  { id: "Social",      label: "Feed",   path: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" },
  { id: "Marketplace", label: "Shop",   path: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" },
  { id: "Collection",  label: "Crate",  path: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { id: "Activity",    label: "Activity", path: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { id: "Vinyl Buddy", label: "Buddy",  path: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" },
  { id: "Profile",     label: "Me",     path: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
];

const MOBILE_TABS = NAV_ITEMS.filter(n => ["Social", "Marketplace", "Collection", "Vinyl Buddy", "Profile"].includes(n.id));

export default function Sidebar({ nav, setNav, following, profile, currentUser, notifCount, onNotifClick, onAddRecord, onMessages, onLogout, isGuest, onSignIn }) {
  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────── */}
      <div className="gs-sidebar-desktop fixed left-0 top-0 bottom-0 w-[196px] bg-gs-sidebar border-r border-gs-border-subtle flex flex-col py-5 z-[100]">
        {/* Logo + notifications */}
        <div className="px-4 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[9px] bg-gradient-to-br from-gs-accent to-gs-indigo flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
            </div>
            <span className="text-[17px] font-extrabold tracking-tight">
              groove<span className="text-gs-accent">stack</span>
            </span>
          </div>
          <button onClick={onNotifClick} className="relative bg-transparent border-none cursor-pointer text-gs-dim p-1 hover:text-gs-muted transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifCount > 0 && (
              <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-[8px] font-extrabold text-white flex items-center justify-center">
                {notifCount}
              </div>
            )}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ id, path }) => {
            const active = nav === id;
            const guestAllowed = ["Marketplace", "Collection"].includes(id);
            const dimmed = isGuest && !guestAllowed;
            return (
              <button
                key={id}
                onClick={() => setNav(id)}
                className={`gs-nav-item ${active ? 'gs-nav-item-active' : ''} ${dimmed ? 'opacity-40 text-gs-subtle' : 'text-gs-dim hover:text-gs-muted'}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={path} />
                </svg>
                {id}
                {dimmed && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ml-auto opacity-40">
                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions — hidden for guests */}
        {!isGuest && (
          <div className="px-2 pb-2 space-y-1.5">
            <button onClick={onAddRecord} className="gs-btn-gradient w-full py-2.5 text-xs">
              + Add Record
            </button>
            <button onClick={onMessages} className="gs-btn-secondary w-full py-2 text-xs flex items-center justify-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Messages
            </button>
          </div>
        )}

        {/* User / guest section */}
        <div className="px-2 pt-3 mx-2 border-t border-gs-border-subtle">
          {isGuest ? (
            <div className="space-y-1.5">
              <button onClick={onSignIn} className="gs-btn-gradient w-full py-2.5 text-xs">
                Create Profile
              </button>
              <button onClick={onSignIn} className="gs-btn-secondary w-full py-2 text-[11px] text-center">
                Log in
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setNav("Profile")}
                className="flex items-center gap-2.5 py-2 px-2.5 w-full bg-transparent border-none cursor-pointer rounded-lg hover:bg-[#111] transition-colors"
              >
                <Avatar username={currentUser} size={30} src={profile.avatarUrl} />
                <div className="text-left">
                  <div className="text-xs font-semibold text-neutral-200">{profile.displayName}</div>
                  <div className="text-[10px] text-gs-faint font-mono">@{currentUser}</div>
                </div>
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="w-full py-2 px-2.5 bg-transparent border-none text-gs-faint text-[11px] font-medium cursor-pointer mt-1 font-mono text-center hover:text-red-400 transition-colors"
                >
                  Log out
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Mobile bottom tab bar ────────────────────────────── */}
      <div className="gs-mobile-bar hidden fixed bottom-0 left-0 right-0 bg-gs-sidebar border-t border-gs-border-subtle justify-around items-center z-[100] px-0 pt-1.5 pb-[env(safe-area-inset-bottom,6px)]">
        {MOBILE_TABS.map(({ id, label, path }) => {
          const active = nav === id;
          const guestLocked = isGuest && !["Marketplace", "Collection"].includes(id);
          const isGuestProfile = isGuest && id === "Profile";
          return (
            <button
              key={id}
              onClick={() => isGuestProfile ? onSignIn() : setNav(id)}
              className={`flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer min-w-[52px] py-1 transition-colors ${active ? 'text-gs-accent' : guestLocked && !isGuestProfile ? 'text-gs-subtle opacity-40' : 'text-gs-dim'}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={path} />
              </svg>
              <span className={`text-[9px] font-sans ${active ? "font-bold" : "font-medium"}`}>
                {isGuestProfile ? "Sign In" : label}
              </span>
              {active && <div className="w-1 h-1 rounded-full bg-gs-accent mt-0.5" />}
            </button>
          );
        })}
      </div>
    </>
  );
}
