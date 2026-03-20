// Responsive navigation: fixed left sidebar on desktop, bottom tab bar on mobile.
// All state and callbacks come from App.js.

import { useState, useCallback, useEffect, useRef } from 'react';
import Avatar from './ui/Avatar';

const NAV_ITEMS = [
  { id: "Social",      label: "Feed",     path: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z", shortcut: "1" },
  { id: "Marketplace", label: "Shop",     path: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z", shortcut: "2" },
  { id: "Collection",  label: "Crate",    path: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", shortcut: "3" },
  { id: "Activity",    label: "Activity", path: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01", shortcut: "4" },
  { id: "Vinyl Buddy", label: "Buddy",    path: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z", shortcut: "5" },
  { id: "Profile",     label: "Me",       path: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", shortcut: "6" },
  { id: "Settings",    label: "Settings", path: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z", shortcut: "\u2318," },
];

const MOBILE_TABS = NAV_ITEMS.filter(n => ["Social", "Marketplace", "Collection", "Vinyl Buddy", "Profile"].includes(n.id));

/* ── Status options ────────────────────────────────────────── */
const STATUS_OPTIONS = [
  { id: 'online',    label: 'Online',    color: 'bg-emerald-500' },
  { id: 'away',      label: 'Away',      color: 'bg-amber-500' },
  { id: 'busy',      label: 'Busy',      color: 'bg-red-500' },
  { id: 'invisible', label: 'Invisible', color: 'bg-gray-500' },
];

/* ── Profile completion calculator ─────────────────────────── */
function getProfileCompletion(profile) {
  if (!profile) return 0;
  let filled = 0;
  let total = 5;
  if (profile.displayName) filled++;
  if (profile.avatarUrl) filled++;
  if (profile.bio) filled++;
  if (profile.location) filled++;
  if (profile.favoriteGenre) filled++;
  return Math.round((filled / total) * 100);
}

export default function Sidebar({
  nav, setNav, following, profile, currentUser,
  notifCount, onNotifClick, onAddRecord, onMessages, onLogout,
  isGuest, onSignIn,
  /* New props */
  unreadCount = 0,
  cartCount = 0,
  globalSearch = '',
  setGlobalSearch,
  hasNewUpdates = false,
  statusMessage = '',
  notifSoundEnabled = true,
  onToggleNotifSound,
  /* Additional props for new features */
  recentRecords = [],
  storageUsedMB = 0,
  storageLimitMB = 500,
  darkMode = true,
  onToggleTheme,
  userStatus = 'online',
  onStatusChange,
  onCommandPalette,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);

  /* Improvement: Status selector dropdown */
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef(null);

  /* Improvement: Recently viewed records expanded */
  const [recentExpanded, setRecentExpanded] = useState(false);

  /* Improvement: Sidebar resize handle */
  const [customWidth, setCustomWidth] = useState(null);
  const resizeRef = useRef(null);
  const isDragging = useRef(false);

  /* Close status dropdown on outside click */
  useEffect(() => {
    if (!statusOpen) return;
    const handleClick = (e) => {
      if (statusRef.current && !statusRef.current.contains(e.target)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [statusOpen]);

  /* Improvement: Sidebar resize drag handler */
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startW = resizeRef.current?.parentElement?.offsetWidth || 196;

    const onMove = (ev) => {
      if (!isDragging.current) return;
      const newW = Math.min(320, Math.max(140, startW + (ev.clientX - startX)));
      setCustomWidth(newW);
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const sidebarW = collapsed ? 'w-[56px]' : (customWidth ? '' : 'w-[196px]');
  const sidebarStyle = (!collapsed && customWidth) ? { width: `${customWidth}px` } : {};

  /* Improvement: Current status info */
  const currentStatus = STATUS_OPTIONS.find(s => s.id === userStatus) || STATUS_OPTIONS[0];

  /* Improvement: Storage usage calculation */
  const storagePercent = storageLimitMB > 0 ? Math.min(100, Math.round((storageUsedMB / storageLimitMB) * 100)) : 0;
  const storageBarColor = storagePercent > 90 ? 'bg-red-500' : storagePercent > 70 ? 'bg-amber-500' : 'bg-gs-accent';

  /* Improvement: Profile completion */
  const profileCompletion = getProfileCompletion(profile);

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────── */}
      {/* Improvement: Smooth collapse animation with transition */}
      <nav
        aria-label="Main navigation"
        className={`gs-sidebar-desktop fixed left-0 top-0 bottom-0 ${sidebarW} bg-gs-sidebar border-r border-gs-border-subtle flex flex-col py-5 z-[100] transition-[width] duration-300 ease-in-out`}
        style={sidebarStyle}
      >
        {/* Logo + notifications + collapse toggle */}
        <div className={`${collapsed ? 'px-2' : 'px-4'} pb-4 flex items-center justify-between transition-[padding] duration-300`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-[9px] bg-gradient-to-br from-gs-accent to-gs-indigo flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
            </div>
            {!collapsed && (
              <span className="text-[17px] font-extrabold tracking-tight whitespace-nowrap gs-sidebar-label">
                groove<span className="text-gs-accent">stack</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Improvement: Notification bell visible in collapsed mode too */}
            <button onClick={onNotifClick} aria-label="Notifications" data-tooltip="Notifications" className="gs-tooltip relative bg-transparent border-none cursor-pointer text-gs-dim p-1 hover:text-gs-muted transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notifCount > 0 && (
                <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-[8px] font-extrabold text-white flex items-center justify-center animate-pulse">
                  {notifCount}
                </div>
              )}
            </button>
            {/* Collapse toggle */}
            <button
              onClick={() => { setCollapsed(c => !c); setCustomWidth(null); }}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="bg-transparent border-none cursor-pointer text-gs-faint p-1 hover:text-gs-muted transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {collapsed
                  ? <polyline points="9 18 15 12 9 6" />
                  : <polyline points="15 18 9 12 15 6" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Search input */}
        {!collapsed && setGlobalSearch && (
          <div className="px-3 pb-3 relative group">
            <div className="relative">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gs-faint pointer-events-none">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-gs-card border border-[#222] rounded-lg py-1.5 pl-8 pr-8 text-neutral-100 text-[12px] outline-none font-sans placeholder:text-gs-faint focus:border-gs-accent/40 focus:ring-1 focus:ring-gs-accent/20 transition-all"
              />
              {/* Improvement: More prominent Cmd+K trigger */}
              {onCommandPalette ? (
                <button
                  onClick={onCommandPalette}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#1a1a1a] border border-gs-border rounded px-1 py-0.5 text-gs-faint text-[10px] font-mono cursor-pointer hover:text-gs-muted hover:border-gs-border-hover transition-colors"
                  title="Open command palette"
                  type="button"
                >
                  {"\u2318"}K
                </button>
              ) : (
                <span className="gs-kbd absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {"\u2318"}K
                </span>
              )}
            </div>
          </div>
        )}

        {/* Nav links */}
        {/* Improvement: Active tab indicator with sliding animation */}
        <nav className={`flex-1 ${collapsed ? 'px-1' : 'px-2'} space-y-0.5 overflow-y-auto transition-[padding] duration-300 relative`}>
          {NAV_ITEMS.map(({ id, path, shortcut }) => {
            const active = nav === id;
            const guestAllowed = id === "Marketplace";
            const dimmed = isGuest && !guestAllowed;
            const isHovered = hoveredNav === id;
            return (
              <button
                key={id}
                onClick={() => setNav(id)}
                onMouseEnter={() => setHoveredNav(id)}
                onMouseLeave={() => setHoveredNav(null)}
                aria-current={active ? "page" : undefined}
                className={`gs-nav-item group relative ${active ? 'gs-nav-item-active' : ''} ${dimmed ? 'opacity-40 text-gs-subtle' : 'text-gs-dim hover:text-gs-muted hover:bg-[#111] hover:translate-x-0.5'} ${collapsed ? 'justify-center px-0' : ''} transition-all duration-200 ease-out`}
              >
                {/* Improvement: Sliding active indicator bar */}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-gs-accent transition-all duration-300 ease-out" />
                )}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform duration-150 group-hover:scale-110">
                  <path d={path} />
                </svg>
                {!collapsed && (
                  <>
                    <span className="gs-sidebar-label">{id}</span>
                    {/* Cart badge on Marketplace */}
                    {id === "Marketplace" && cartCount > 0 && (
                      <span className="ml-auto bg-amber-500/15 text-amber-400 border border-amber-500/25 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        {cartCount}
                      </span>
                    )}
                    {/* Unread badge on Social */}
                    {id === "Social" && unreadCount > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-red-500 text-[9px] font-extrabold text-white flex items-center justify-center px-1 animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    {dimmed && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ml-auto opacity-40">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                    )}
                    {/* Keyboard shortcut badge — visible on hover */}
                    {shortcut && !dimmed && id !== "Marketplace" && id !== "Social" && cartCount === 0 && (
                      <span className={`gs-kbd ml-auto transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>{shortcut}</span>
                    )}
                  </>
                )}
              </button>
            );
          })}

          {/* "What's New" link */}
          {!collapsed && (
            <button
              onClick={() => alert('What\'s New — coming soon!')}
              className="gs-nav-item text-gs-dim hover:text-gs-muted hover:bg-[#111] hover:translate-x-0.5 transition-all duration-150 group"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform duration-150 group-hover:scale-110">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <span className="gs-sidebar-label">What&apos;s New</span>
              {hasNewUpdates && (
                <span className="w-2 h-2 rounded-full bg-gs-accent ml-auto shrink-0 animate-pulse" />
              )}
            </button>
          )}

          {/* Improvement: Recently viewed records */}
          {!collapsed && recentRecords.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gs-border-subtle">
              <button
                onClick={() => setRecentExpanded(prev => !prev)}
                className="w-full flex items-center justify-between px-2.5 py-1 bg-transparent border-none cursor-pointer text-gs-faint text-[10px] font-semibold uppercase tracking-wider hover:text-gs-dim transition-colors"
              >
                <span>Recently Viewed</span>
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`transition-transform duration-200 ${recentExpanded ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {recentExpanded && (
                <div className="mt-1 space-y-0.5 animate-fade-in">
                  {recentRecords.slice(0, 5).map((record, idx) => (
                    <button
                      key={record.id || idx}
                      onClick={() => setNav("Collection")}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border-none cursor-pointer text-gs-dim text-[11px] rounded-md hover:bg-[#111] hover:text-gs-muted transition-colors text-left"
                    >
                      <div className="w-6 h-6 rounded bg-[#1a1a1a] border border-gs-border-subtle flex items-center justify-center shrink-0 overflow-hidden">
                        {record.coverUrl ? (
                          <img src={record.coverUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{record.title || 'Unknown'}</div>
                        <div className="text-[9px] text-gs-faint truncate">{record.artist || ''}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Bottom actions — hidden for guests */}
        {!isGuest && (
          <div className={`${collapsed ? 'px-1' : 'px-2'} pb-2 space-y-1.5 transition-[padding] duration-300`}>
            {!collapsed ? (
              <>
                <button onClick={onAddRecord} className="gs-btn-gradient w-full py-2.5 text-xs">
                  + Add Record
                </button>
                <button onClick={onMessages} className="gs-btn-secondary w-full py-2 text-xs flex items-center justify-center gap-1.5 relative">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  Messages
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-[9px] font-extrabold text-white flex items-center justify-center px-1 animate-pulse">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </>
            ) : (
              <>
                <button onClick={onAddRecord} className="gs-btn-gradient gs-tooltip w-full py-2 flex items-center justify-center" title="Add Record" data-tooltip="Add Record" aria-label="Add Record">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </button>
                <button onClick={onMessages} className="gs-btn-secondary gs-tooltip w-full py-2 flex items-center justify-center relative" title="Messages" data-tooltip="Messages" aria-label="Messages">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-[8px] font-extrabold text-white flex items-center justify-center px-0.5">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </>
            )}

            {/* Notification sound toggle */}
            {!collapsed && onToggleNotifSound && (
              <button
                onClick={onToggleNotifSound}
                className="w-full py-1.5 px-2.5 bg-transparent border-none text-gs-faint text-[10px] font-medium cursor-pointer font-mono text-left flex items-center gap-1.5 hover:text-gs-dim transition-colors"
                title={notifSoundEnabled ? "Mute notification sounds" : "Unmute notification sounds"}
              >
                {notifSoundEnabled ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                )}
                {notifSoundEnabled ? 'Sound on' : 'Sound off'}
              </button>
            )}

            {/* Improvement: Storage usage indicator */}
            {!collapsed && storageUsedMB > 0 && (
              <div className="px-2.5 py-1.5">
                <div className="flex items-center justify-between text-[9px] text-gs-faint mb-1">
                  <span>Storage</span>
                  <span>{storageUsedMB}MB / {storageLimitMB}MB</span>
                </div>
                <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${storageBarColor}`}
                    style={{ width: `${storagePercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Improvement: Theme toggle */}
            {!collapsed && onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="w-full py-1.5 px-2.5 bg-transparent border-none text-gs-faint text-[10px] font-medium cursor-pointer font-mono text-left flex items-center gap-1.5 hover:text-gs-dim transition-colors"
                title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {darkMode ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
                {darkMode ? 'Light mode' : 'Dark mode'}
              </button>
            )}
          </div>
        )}

        {/* User / guest section */}
        <div className={`${collapsed ? 'px-1' : 'px-2'} pt-3 mx-2 border-t border-gs-border-subtle transition-[padding] duration-300`}>
          {isGuest ? (
            <div className="space-y-1.5">
              {!collapsed ? (
                <>
                  <button onClick={onSignIn} className="gs-btn-gradient w-full py-2.5 text-xs">
                    Create Profile
                  </button>
                  <button onClick={onSignIn} className="gs-btn-secondary w-full py-2 text-[11px] text-center">
                    Log in
                  </button>
                </>
              ) : (
                <button onClick={onSignIn} className="gs-btn-gradient w-full py-2 flex items-center justify-center" title="Sign in">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="relative" ref={statusRef}>
                <button
                  onClick={() => setNav("Profile")}
                  className={`flex items-center gap-2.5 py-2 w-full bg-transparent border-none cursor-pointer rounded-lg hover:bg-[#111] transition-colors ${collapsed ? 'px-0 justify-center' : 'px-2.5'}`}
                >
                  {/* Improvement: Online status dot on avatar */}
                  <div className="relative shrink-0">
                    <Avatar username={currentUser} size={collapsed ? 28 : 30} src={profile.avatarUrl} />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gs-sidebar ${currentStatus.color} transition-colors duration-200`} />
                  </div>
                  {!collapsed && (
                    <div className="text-left min-w-0 flex-1">
                      <div className="text-xs font-semibold text-neutral-200 truncate">{profile.displayName}</div>
                      <div className="text-[10px] text-gs-faint font-mono truncate">@{currentUser}</div>
                      {/* User status message */}
                      {statusMessage && (
                        <div className="text-[9px] text-gs-dim truncate mt-0.5 italic">{statusMessage}</div>
                      )}
                    </div>
                  )}
                </button>

                {/* Improvement: Status selector */}
                {!collapsed && onStatusChange && (
                  <button
                    onClick={() => setStatusOpen(prev => !prev)}
                    className="absolute right-1 top-1 bg-transparent border-none cursor-pointer text-gs-faint p-1 hover:text-gs-dim transition-colors rounded"
                    title="Change status"
                    type="button"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                )}

                {/* Status dropdown */}
                {statusOpen && onStatusChange && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-gs-surface border border-gs-border rounded-lg shadow-xl overflow-hidden z-50 animate-fade-in">
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => { onStatusChange(opt.id); setStatusOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 bg-transparent border-none cursor-pointer text-[11px] font-medium text-left hover:bg-[#111] transition-colors ${userStatus === opt.id ? 'text-gs-text' : 'text-gs-dim'}`}
                      >
                        <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                        {opt.label}
                        {userStatus === opt.id && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="ml-auto">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Improvement: Profile completion percentage */}
              {!collapsed && profileCompletion < 100 && (
                <div className="px-2.5 py-1.5">
                  <button
                    onClick={() => setNav("Profile")}
                    className="w-full bg-transparent border-none cursor-pointer p-0 text-left"
                    type="button"
                  >
                    <div className="flex items-center justify-between text-[9px] text-gs-faint mb-1">
                      <span>Profile</span>
                      <span className="text-gs-accent">{profileCompletion}%</span>
                    </div>
                    <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gs-accent transition-all duration-500"
                        style={{ width: `${profileCompletion}%` }}
                      />
                    </div>
                  </button>
                </div>
              )}

              {!collapsed && onLogout && (
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

        {/* Improvement: Sidebar resize handle */}
        {!collapsed && (
          <div
            ref={resizeRef}
            onMouseDown={handleResizeStart}
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gs-accent/30 transition-colors z-[101]"
            title="Drag to resize"
          />
        )}
      </nav>

      {/* ── Mobile bottom tab bar ────────────────────────────── */}
      <nav aria-label="Mobile navigation" className="gs-mobile-bar hidden fixed bottom-0 left-0 right-0 bg-gs-sidebar border-t border-gs-border-subtle justify-around items-center z-[100] px-1 pt-1.5 pb-[env(safe-area-inset-bottom,6px)]">
        {MOBILE_TABS.map(({ id, label, path }) => {
          const active = nav === id;
          const guestLocked = isGuest && id !== "Marketplace";
          const isGuestProfile = isGuest && id === "Profile";
          return (
            <button
              key={id}
              onClick={() => isGuestProfile ? onSignIn() : setNav(id)}
              className={`flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer min-w-[56px] py-1.5 transition-all duration-200 ease-out relative ${active ? 'text-gs-accent scale-105' : guestLocked && !isGuestProfile ? 'text-gs-subtle opacity-40' : 'text-gs-dim'}`}
            >
              <div className="relative">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={path} />
                </svg>
                {/* Unread badge on Social (messages related) */}
                {id === "Social" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] rounded-full bg-red-500 text-[7px] font-extrabold text-white flex items-center justify-center px-0.5">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {/* Cart badge on Marketplace */}
                {id === "Marketplace" && cartCount > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] rounded-full bg-amber-500 text-[7px] font-extrabold text-white flex items-center justify-center px-0.5">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-sans leading-tight ${active ? "font-bold" : "font-medium"}`}>
                {isGuestProfile ? "Sign In" : label}
              </span>
              {/* Improvement: Active indicator dot with transition */}
              {active && <div className="w-1 h-1 rounded-full bg-gs-accent transition-all duration-300" />}
            </button>
          );
        })}
      </nav>
    </>
  );
}
