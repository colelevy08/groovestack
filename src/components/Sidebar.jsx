// Responsive navigation: fixed left sidebar on desktop, bottom tab bar on mobile.
// All state and callbacks come from App.js.

import { useState, useCallback, useEffect, useRef } from 'react';
import Avatar from './ui/Avatar';

const APP_VERSION = '1.4.0';

/* ── Nav item definitions with section grouping ──────────── */
const NAV_ITEMS = [
  // Browse section
  { id: "Marketplace", label: "Shop",      section: "Browse", path: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z", shortcut: "1" },
  { id: "Social",      label: "Feed",      section: "Browse", path: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z", shortcut: "2" },
  { id: "Vinyl Buddy", label: "Buddy",     section: "Browse", path: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z", shortcut: "3" },
  // My Stuff section
  { id: "Collection",  label: "Crate",     section: "My Stuff", path: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", shortcut: "4" },
  { id: "wishlist",    label: "Wishlist",   section: "My Stuff", path: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z", shortcut: "9" },
  { id: "messages",    label: "Messages",   section: "My Stuff", path: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", shortcut: "8" },
  { id: "analytics",   label: "Analytics",  section: "My Stuff", path: "M18 20V10M12 20V4M6 20v-6", shortcut: "7" },
  { id: "Activity",    label: "Activity",   section: "My Stuff", path: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01", shortcut: "5" },
  // Account section
  { id: "Profile",     label: "Me",        section: "Account", path: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", shortcut: "6" },
  { id: "Settings",    label: "Settings",  section: "Account", path: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z", shortcut: "\u2318," },
];

const SECTIONS = ["Browse", "My Stuff", "Account"];

const MOBILE_TABS = NAV_ITEMS.filter(n => ["Social", "Marketplace", "Collection", "messages", "Profile"].includes(n.id));

const SIDEBAR_ORDER_KEY = 'gs-sidebar-nav-order';
const SIDEBAR_WIDTH_KEY = 'gs-sidebar-width';

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
  const total = 5;
  if (profile.displayName) filled++;
  if (profile.avatarUrl) filled++;
  if (profile.bio) filled++;
  if (profile.location) filled++;
  if (profile.favoriteGenre) filled++;
  return Math.round((filled / total) * 100);
}

/* ── Load saved nav order from localStorage ───────────────── */
function loadNavOrder() {
  try {
    const saved = localStorage.getItem(SIDEBAR_ORDER_KEY);
    if (saved) {
      const order = JSON.parse(saved);
      if (Array.isArray(order) && order.length === NAV_ITEMS.length) {
        const reordered = order.map(id => NAV_ITEMS.find(n => n.id === id)).filter(Boolean);
        if (reordered.length === NAV_ITEMS.length) return reordered;
      }
    }
  } catch { /* ignore */ }
  return NAV_ITEMS;
}

/* ── Load saved sidebar width from localStorage ───────────── */
function loadSavedWidth() {
  try {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (saved) {
      const w = parseInt(saved, 10);
      if (w >= 140 && w <= 320) return w;
    }
  } catch { /* ignore */ }
  return null;
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
  /* Props for 15 new improvements */
  messagesUnreadCount = 0,
  wishlistCount = 0,
  hasNewAnalyticsData = false,
  recordsCount = 0,
  followersCount = 0,
  /* Props for 8 new Sidebar improvements (#13–#20) */
  audioPlayer = { playing: false, track: null, progress: 0 },
  onStopPreview,
  salesCount = 0,
  recentSearches: recentSearchesProp = [],
  onSelectRecentSearch,
  seasonalTheme = 'winter',
  streakCount = 0,
  onShowTutorials,
  onShareApp,
  batterySaverMode = false,
  onToggleBatterySaver,
  autoThemeEnabled = false,
  onToggleAutoTheme,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);

  /* Improvement: Status selector dropdown */
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef(null);

  /* Improvement: Recently viewed records expanded */
  const [recentExpanded, setRecentExpanded] = useState(false);

  /* Improvement 15: Sidebar width persistence to localStorage */
  const [customWidth, setCustomWidth] = useState(() => loadSavedWidth());
  const resizeRef = useRef(null);
  const isDragging = useRef(false);

  /* Improvement 6: Nav item reordering (drag to customize sidebar order) */
  const [navItems, setNavItems] = useState(() => loadNavOrder());
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  /* NEW #16: Sidebar customization — show/hide nav items */
  const [hiddenNavItems, setHiddenNavItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs-sidebar-hidden')) || []; } catch { return []; }
  });
  const [showSidebarSettings, setShowSidebarSettings] = useState(false);

  /* NEW #17: Notifications preview in sidebar */
  const [notifPreviewExpanded, setNotifPreviewExpanded] = useState(false);

  /* NEW #19: App version update check */
  const [updateAvailable, setUpdateAvailable] = useState(false);

  /* NEW #20: Keyboard shortcut legend toggle */
  const [showShortcutLegend, setShowShortcutLegend] = useState(false);

  /* NEW #15: Recent searches expanded state */
  const [recentSearchesExpanded, setRecentSearchesExpanded] = useState(false);

  /* ── Improvement 9: Collapsible section groups ── */
  const [collapsedSections, setCollapsedSections] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs-sidebar-collapsed-sections')) || {}; } catch { return {}; }
  });

  /* ── Improvement 10: Quick create menu ── */
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  /* ── Improvement 11: Recently visited pages list ── */
  const [recentPages, setRecentPages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs-sidebar-recent-pages')) || []; } catch { return []; }
  });

  /* ── Improvement 12: Sidebar accessibility mode ── */
  const [accessibilityMode, setAccessibilityMode] = useState(false);

  /* ── Improvement 13: Sidebar overlay mode for mobile ── */
  const [overlayOpen, setOverlayOpen] = useState(false);

  /* Improvement 14: Smooth scroll to active nav item on mobile */
  const mobileBarRef = useRef(null);
  const activeTabRef = useRef(null);

  useEffect(() => {
    if (activeTabRef.current && mobileBarRef.current) {
      activeTabRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [nav]);

  /* Persist sidebar width changes */
  useEffect(() => {
    if (customWidth !== null) {
      try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(customWidth)); } catch { /* ignore */ }
    } else {
      try { localStorage.removeItem(SIDEBAR_WIDTH_KEY); } catch { /* ignore */ }
    }
  }, [customWidth]);

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

  /* NEW #16: Persist hidden nav items */
  useEffect(() => {
    try { localStorage.setItem('gs-sidebar-hidden', JSON.stringify(hiddenNavItems)); } catch { /* ignore */ }
  }, [hiddenNavItems]);

  /* ── Improvement 9: Persist collapsed section state ── */
  useEffect(() => {
    try { localStorage.setItem('gs-sidebar-collapsed-sections', JSON.stringify(collapsedSections)); } catch { /* ignore */ }
  }, [collapsedSections]);

  /* ── Improvement 11: Track recently visited pages ── */
  useEffect(() => {
    if (nav) {
      setRecentPages(prev => {
        const filtered = prev.filter(p => p !== nav);
        const updated = [nav, ...filtered].slice(0, 8);
        try { localStorage.setItem('gs-sidebar-recent-pages', JSON.stringify(updated)); } catch { /* ignore */ }
        return updated;
      });
    }
  }, [nav]);

  /* NEW #19: Simulate update check on mount */
  useEffect(() => {
    const timer = setTimeout(() => {
      // Simulated version check — in production would call an API
      const latestVersion = '1.5.0';
      if (latestVersion !== APP_VERSION) setUpdateAvailable(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

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

  /* Improvement 6: Drag reorder handlers */
  const handleDragStart = useCallback((idx) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((idx) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    setNavItems(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIdx, 1);
      updated.splice(idx, 0, moved);
      try { localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(updated.map(n => n.id))); } catch { /* ignore */ }
      return updated;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
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

  /* Improvement 13: Theme-aware sidebar background */
  const sidebarBg = darkMode ? 'bg-gs-sidebar' : 'bg-white';
  const sidebarBorder = darkMode ? 'border-gs-border-subtle' : 'border-gray-200';
  const sidebarText = darkMode ? 'text-gs-dim' : 'text-gray-600';
  const sidebarHoverBg = darkMode ? 'hover:bg-[#111]' : 'hover:bg-gray-100';
  const sidebarHoverText = darkMode ? 'hover:text-gs-muted' : 'hover:text-gray-900';
  const sectionLabelColor = darkMode ? 'text-gs-faint' : 'text-gray-400';
  const sidebarSurfaceBg = darkMode ? 'bg-gs-surface' : 'bg-gray-50';

  /* Group nav items by section for rendering — NEW #16: respect hidden items */
  const groupedNav = SECTIONS.map(section => ({
    section,
    items: navItems.filter(item => item.section === section && !hiddenNavItems.includes(item.id)),
  }));

  /* Helper to get badge for a nav item */
  const renderBadge = (id) => {
    if (id === "Marketplace" && cartCount > 0) {
      return (
        <span className="ml-auto bg-amber-500/15 text-amber-400 border border-amber-500/25 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
          {cartCount}
        </span>
      );
    }
    if (id === "Social" && unreadCount > 0) {
      return (
        <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-red-500 text-[9px] font-extrabold text-white flex items-center justify-center px-1 animate-pulse">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      );
    }
    if (id === "messages" && messagesUnreadCount > 0) {
      return (
        <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-red-500 text-[9px] font-extrabold text-white flex items-center justify-center px-1 animate-pulse">
          {messagesUnreadCount > 99 ? '99+' : messagesUnreadCount}
        </span>
      );
    }
    if (id === "wishlist" && wishlistCount > 0) {
      return (
        <span className="ml-auto bg-pink-500/15 text-pink-400 border border-pink-500/25 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
          {wishlistCount}
        </span>
      );
    }
    if (id === "analytics" && hasNewAnalyticsData) {
      return (
        <span className="ml-auto w-2 h-2 rounded-full bg-gs-accent shrink-0 animate-pulse" />
      );
    }
    return null;
  };

  /* Helper: collapsed-mode badge dots */
  const renderCollapsedBadge = (id) => {
    if (id === "messages" && messagesUnreadCount > 0) {
      return (
        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-red-500 text-[8px] font-extrabold text-white flex items-center justify-center px-0.5">
          {messagesUnreadCount > 99 ? '99+' : messagesUnreadCount}
        </span>
      );
    }
    if (id === "wishlist" && wishlistCount > 0) {
      return (
        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-pink-500 text-[8px] font-extrabold text-white flex items-center justify-center px-0.5">
          {wishlistCount}
        </span>
      );
    }
    if (id === "analytics" && hasNewAnalyticsData) {
      return (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gs-accent animate-pulse" />
      );
    }
    if (id === "Social" && unreadCount > 0) {
      return (
        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-red-500 text-[8px] font-extrabold text-white flex items-center justify-center px-0.5">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      );
    }
    if (id === "Marketplace" && cartCount > 0) {
      return (
        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-amber-500 text-[8px] font-extrabold text-white flex items-center justify-center px-0.5">
          {cartCount}
        </span>
      );
    }
    return null;
  };

  /* Get tooltip label for collapsed nav items (Improvement 9) */
  const getTooltipLabel = (item) => {
    let label = item.id;
    if (item.id === "messages") label = "Messages";
    if (item.id === "wishlist") label = "Wishlist";
    if (item.id === "analytics") label = "Analytics";
    return label;
  };

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────── */}
      {/* Improvement 13: Theme-aware styling with smooth collapse animation */}
      <nav
        aria-label="Main navigation"
        className={`gs-sidebar-desktop fixed left-0 top-0 bottom-0 ${sidebarW} ${sidebarBg} border-r ${sidebarBorder} flex flex-col py-5 z-[100] transition-[width,background-color,border-color] duration-300 ease-in-out`}
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
            {/* Notification bell visible in collapsed mode too */}
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
                className={`w-full ${darkMode ? 'bg-gs-card border-[#222] text-neutral-100 focus:border-gs-accent/40 focus:ring-gs-accent/20' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-400 focus:ring-indigo-200'} border rounded-lg py-1.5 pl-8 pr-8 text-[12px] outline-none font-sans placeholder:text-gs-faint focus:ring-1 transition-all`}
              />
              {/* Cmd+K trigger */}
              {onCommandPalette ? (
                <button
                  onClick={onCommandPalette}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 ${darkMode ? 'bg-[#1a1a1a] border-gs-border' : 'bg-white border-gray-200'} border rounded px-1 py-0.5 text-gs-faint text-[10px] font-mono cursor-pointer hover:text-gs-muted hover:border-gs-border-hover transition-colors`}
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

        {/* Improvement 12 + NEW #14: Quick stats counter (records/followers/sales) */}
        {!collapsed && !isGuest && (recordsCount > 0 || followersCount > 0) && (
          <div className={`mx-3 mb-3 px-3 py-2 rounded-lg ${darkMode ? 'bg-[#111] border border-gs-border-subtle' : 'bg-gray-50 border border-gray-200'} flex items-center gap-3`}>
            <div className="text-center flex-1">
              <div className={`text-sm font-bold ${darkMode ? 'text-neutral-200' : 'text-gray-900'}`}>{recordsCount}</div>
              <div className={`text-[9px] font-medium uppercase tracking-wider ${sectionLabelColor}`}>Records</div>
            </div>
            <div className={`w-px h-6 ${darkMode ? 'bg-gs-border-subtle' : 'bg-gray-200'}`} />
            <div className="text-center flex-1">
              <div className={`text-sm font-bold ${darkMode ? 'text-neutral-200' : 'text-gray-900'}`}>{followersCount}</div>
              <div className={`text-[9px] font-medium uppercase tracking-wider ${sectionLabelColor}`}>Followers</div>
            </div>
            <div className={`w-px h-6 ${darkMode ? 'bg-gs-border-subtle' : 'bg-gray-200'}`} />
            <div className="text-center flex-1">
              <div className={`text-sm font-bold ${darkMode ? 'text-neutral-200' : 'text-gray-900'}`}>{salesCount}</div>
              <div className={`text-[9px] font-medium uppercase tracking-wider ${sectionLabelColor}`}>Sales</div>
            </div>
          </div>
        )}

        {/* Improvement 11: Quick Add button */}
        {!collapsed && !isGuest && onAddRecord && (
          <div className="px-3 pb-3">
            <button
              onClick={onAddRecord}
              className="gs-btn-gradient w-full py-2 text-xs flex items-center justify-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Quick Add
            </button>
          </div>
        )}

        {/* ── Improvement 10: Quick create menu ── */}
        {!collapsed && !isGuest && showQuickCreate && (
          <div className={`mx-3 mb-2 p-2 rounded-lg ${darkMode ? 'bg-[#111] border border-gs-border-subtle' : 'bg-gray-50 border border-gray-200'} animate-fade-in`}>
            <div className={`text-[9px] font-semibold uppercase tracking-wider ${sectionLabelColor} mb-1.5`}>Quick Create</div>
            <div className="space-y-0.5">
              {[
                { label: 'New Record', action: onAddRecord, icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
                { label: 'New Post', action: () => { setShowQuickCreate(false); setNav('Social'); }, icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
                { label: 'New Message', action: () => { setShowQuickCreate(false); if (onMessages) onMessages(); }, icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => { setShowQuickCreate(false); if (item.action) item.action(); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border-none cursor-pointer ${sidebarText} text-[11px] rounded-md ${sidebarHoverBg} ${sidebarHoverText} transition-colors text-left`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 opacity-60"><path d={item.icon} /></svg>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nav links — grouped by section with dividers (Improvements 4, 5) */}
        <nav className={`flex-1 ${collapsed ? 'px-1' : 'px-2'} overflow-y-auto transition-[padding] duration-300 relative`} role={accessibilityMode ? 'navigation' : undefined} aria-label={accessibilityMode ? 'Main sidebar navigation' : undefined}>
          {groupedNav.map(({ section, items }, sectionIdx) => {
            if (items.length === 0) return null;
            const isSectionCollapsed = collapsedSections[section] === true;
            return (
              <div key={section}>
                {/* Improvement 5 + 9: Section divider with label — now collapsible */}
                {!collapsed && (
                  <button
                    onClick={() => setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }))}
                    className={`w-full flex items-center gap-2 px-2.5 ${sectionIdx === 0 ? 'pt-0 pb-1.5' : 'pt-3 pb-1.5'} bg-transparent border-none cursor-pointer`}
                    aria-expanded={!isSectionCollapsed}
                    aria-controls={`sidebar-section-${section.replace(/\s/g, '-')}`}
                  >
                    <span className={`text-[9px] font-semibold uppercase tracking-widest ${sectionLabelColor} whitespace-nowrap`}>{section}</span>
                    <div className={`flex-1 h-px ${darkMode ? 'bg-gs-border-subtle' : 'bg-gray-200'}`} />
                    <svg
                      width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className={`transition-transform duration-200 ${sectionLabelColor} ${isSectionCollapsed ? '-rotate-90' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                )}
                {collapsed && sectionIdx > 0 && (
                  <div className={`mx-2 my-2 h-px ${darkMode ? 'bg-gs-border-subtle' : 'bg-gray-200'}`} />
                )}
                <div id={`sidebar-section-${section.replace(/\s/g, '-')}`} className={`space-y-0.5 ${!collapsed && isSectionCollapsed ? 'hidden' : ''}`}>
                  {items.map((item) => {
                    const { id, path, shortcut } = item;
                    const globalIdx = navItems.indexOf(item);
                    const active = nav === id;
                    const guestAllowed = id === "Marketplace";
                    const dimmed = isGuest && !guestAllowed;
                    const isHovered = hoveredNav === id;
                    const badge = renderBadge(id);
                    const hasBadge = badge !== null;
                    return (
                      <button
                        key={id}
                        draggable={!collapsed}
                        onDragStart={() => handleDragStart(globalIdx)}
                        onDragOver={(e) => handleDragOver(e, globalIdx)}
                        onDrop={() => handleDrop(globalIdx)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setNav(id)}
                        onMouseEnter={() => setHoveredNav(id)}
                        onMouseLeave={() => setHoveredNav(null)}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? getTooltipLabel(item) : undefined}
                        data-tooltip={collapsed ? getTooltipLabel(item) : undefined}
                        className={`gs-nav-item group relative ${active ? 'gs-nav-item-active' : ''} ${dimmed ? `opacity-40 text-gs-subtle` : `${sidebarText} ${sidebarHoverText} ${sidebarHoverBg} hover:translate-x-0.5`} ${collapsed ? 'justify-center px-0 gs-tooltip' : ''} ${dragOverIdx === globalIdx ? 'ring-1 ring-gs-accent/40' : ''} transition-all duration-200 ease-out`}
                      >
                        {/* Sliding active indicator bar */}
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-gs-accent transition-all duration-300 ease-out" />
                        )}
                        <div className="relative shrink-0">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform duration-150 group-hover:scale-110">
                            <path d={path} />
                          </svg>
                          {/* Collapsed-mode badges */}
                          {collapsed && renderCollapsedBadge(id)}
                        </div>
                        {!collapsed && (
                          <>
                            <span className="gs-sidebar-label">{item.label}</span>
                            {/* Badges */}
                            {badge}
                            {dimmed && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ml-auto opacity-40">
                                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                              </svg>
                            )}
                            {/* Improvement 8: Keyboard shortcut badge — visible on hover */}
                            {shortcut && !dimmed && !hasBadge && (
                              <span className={`gs-kbd ml-auto transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>{shortcut}</span>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* NEW #15: Recent searches in sidebar */}
          {!collapsed && recentSearchesProp.length > 0 && (
            <div className={`mt-3 pt-3 border-t ${sidebarBorder}`}>
              <button
                onClick={() => setRecentSearchesExpanded(prev => !prev)}
                className={`w-full flex items-center justify-between px-2.5 py-1 bg-transparent border-none cursor-pointer ${sectionLabelColor} text-[10px] font-semibold uppercase tracking-wider hover:text-gs-dim transition-colors`}
              >
                <span className="flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  Recent Searches
                </span>
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`transition-transform duration-200 ${recentSearchesExpanded ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {recentSearchesExpanded && (
                <div className="mt-1 space-y-0.5 animate-fade-in">
                  {recentSearchesProp.slice(0, 5).map((query, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectRecentSearch && onSelectRecentSearch(query)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border-none cursor-pointer ${sidebarText} text-[11px] rounded-md ${sidebarHoverBg} ${sidebarHoverText} transition-colors text-left`}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 opacity-40">
                        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                      </svg>
                      <span className="truncate">{query}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NEW #17: Notifications preview in sidebar */}
          {!collapsed && !isGuest && notifCount > 0 && (
            <div className={`mt-3 pt-3 border-t ${sidebarBorder}`}>
              <button
                onClick={() => setNotifPreviewExpanded(prev => !prev)}
                className={`w-full flex items-center justify-between px-2.5 py-1 bg-transparent border-none cursor-pointer ${sectionLabelColor} text-[10px] font-semibold uppercase tracking-wider hover:text-gs-dim transition-colors`}
              >
                <span className="flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  Notifications
                  <span className="ml-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-[8px] font-extrabold text-white flex items-center justify-center px-0.5">{notifCount}</span>
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${notifPreviewExpanded ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {notifPreviewExpanded && (
                <div className="mt-1 space-y-0.5 animate-fade-in">
                  <button
                    onClick={onNotifClick}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 bg-transparent border-none cursor-pointer ${sidebarText} text-[11px] rounded-md ${sidebarHoverBg} ${sidebarHoverText} transition-colors text-left`}
                  >
                    <span className="w-2 h-2 rounded-full bg-gs-accent flex-shrink-0" />
                    <span className="truncate">You have {notifCount} new notification{notifCount !== 1 ? 's' : ''}</span>
                  </button>
                  <button
                    onClick={onNotifClick}
                    className={`w-full text-center py-1 bg-transparent border-none cursor-pointer text-[10px] text-gs-accent hover:underline transition-colors`}
                  >
                    View all notifications
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Improvement 11: Recently visited pages ── */}
          {!collapsed && recentPages.length > 1 && (
            <div className={`mt-3 pt-3 border-t ${sidebarBorder}`}>
              <div className={`px-2.5 py-1 ${sectionLabelColor} text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                Recent Pages
              </div>
              <div className="mt-1 space-y-0.5">
                {recentPages.filter(p => p !== nav).slice(0, 4).map((page) => (
                  <button
                    key={page}
                    onClick={() => setNav(page)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border-none cursor-pointer ${sidebarText} text-[11px] rounded-md ${sidebarHoverBg} ${sidebarHoverText} transition-colors text-left`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gs-accent/30 flex-shrink-0" />
                    <span className="truncate">{page}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recently viewed records */}
          {!collapsed && recentRecords.length > 0 && (
            <div className={`mt-3 pt-3 border-t ${sidebarBorder}`}>
              <button
                onClick={() => setRecentExpanded(prev => !prev)}
                className={`w-full flex items-center justify-between px-2.5 py-1 bg-transparent border-none cursor-pointer ${sectionLabelColor} text-[10px] font-semibold uppercase tracking-wider hover:text-gs-dim transition-colors`}
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
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 bg-transparent border-none cursor-pointer ${sidebarText} text-[11px] rounded-md ${sidebarHoverBg} ${sidebarHoverText} transition-colors text-left`}
                    >
                      <div className={`w-6 h-6 rounded ${darkMode ? 'bg-[#1a1a1a] border-gs-border-subtle' : 'bg-gray-100 border-gray-200'} border flex items-center justify-center shrink-0 overflow-hidden`}>
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
                        <div className={`text-[9px] ${sectionLabelColor} truncate`}>{record.artist || ''}</div>
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
            {collapsed && (
              <>
                <button onClick={onAddRecord} className="gs-btn-gradient gs-tooltip w-full py-2 flex items-center justify-center" title="Quick Add" data-tooltip="Quick Add" aria-label="Quick Add Record">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </button>
              </>
            )}

            {/* Notification sound toggle */}
            {!collapsed && onToggleNotifSound && (
              <button
                onClick={onToggleNotifSound}
                className={`w-full py-1.5 px-2.5 bg-transparent border-none ${sectionLabelColor} text-[10px] font-medium cursor-pointer font-mono text-left flex items-center gap-1.5 hover:text-gs-dim transition-colors`}
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

            {/* Storage usage indicator */}
            {!collapsed && storageUsedMB > 0 && (
              <div className="px-2.5 py-1.5">
                <div className={`flex items-center justify-between text-[9px] ${sectionLabelColor} mb-1`}>
                  <span>Storage</span>
                  <span>{storageUsedMB}MB / {storageLimitMB}MB</span>
                </div>
                <div className={`h-1 ${darkMode ? 'bg-[#1a1a1a]' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${storageBarColor}`}
                    style={{ width: `${storagePercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Theme toggle */}
            {!collapsed && onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className={`w-full py-1.5 px-2.5 bg-transparent border-none ${sectionLabelColor} text-[10px] font-medium cursor-pointer font-mono text-left flex items-center gap-1.5 hover:text-gs-dim transition-colors`}
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

        {/* NEW #13: Mini player in sidebar footer */}
        {!collapsed && audioPlayer.playing && audioPlayer.track && (
          <div className={`mx-3 mb-2 px-2.5 py-2 rounded-lg ${darkMode ? 'bg-[#111] border border-gs-border-subtle' : 'bg-gray-50 border border-gray-200'} animate-fade-in`}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded flex-shrink-0" style={{ background: audioPlayer.track.accent || '#666' }}>
                <div className="w-full h-full flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-white/80 animate-pulse"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[10px] font-medium ${darkMode ? 'text-neutral-200' : 'text-gray-900'} truncate`}>{audioPlayer.track.album}</div>
                <div className={`text-[9px] ${sectionLabelColor} truncate`}>{audioPlayer.track.artist}</div>
              </div>
              {onStopPreview && (
                <button onClick={onStopPreview} className="p-0.5 text-gs-dim hover:text-gs-text transition-colors flex-shrink-0" title="Stop">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                </button>
              )}
            </div>
            <div className={`mt-1.5 h-0.5 ${darkMode ? 'bg-[#1a1a1a]' : 'bg-gray-200'} rounded-full overflow-hidden`}>
              <div className="h-full bg-gs-accent rounded-full animate-pulse" style={{ width: '45%' }} />
            </div>
          </div>
        )}

        {/* NEW #18: Help/support quick access */}
        {!collapsed && !isGuest && (
          <div className={`px-3 mb-1 flex items-center gap-1`}>
            {onShowTutorials && (
              <button
                onClick={onShowTutorials}
                className={`flex-1 py-1.5 bg-transparent border-none ${sectionLabelColor} text-[10px] font-medium cursor-pointer text-center flex items-center justify-center gap-1 hover:text-gs-dim transition-colors rounded ${sidebarHoverBg}`}
                title="Tutorials & Guides"
                type="button"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r="0.5"/></svg>
                Help
              </button>
            )}
            {onShareApp && (
              <button
                onClick={onShareApp}
                className={`flex-1 py-1.5 bg-transparent border-none ${sectionLabelColor} text-[10px] font-medium cursor-pointer text-center flex items-center justify-center gap-1 hover:text-gs-dim transition-colors rounded ${sidebarHoverBg}`}
                title="Invite Friends"
                type="button"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                Invite
              </button>
            )}
          </div>
        )}

        {/* NEW #16: Sidebar customization toggle */}
        {!collapsed && !isGuest && (
          <div className="px-3 mb-1">
            <button
              onClick={() => setShowSidebarSettings(prev => !prev)}
              className={`w-full py-1 bg-transparent border-none ${sectionLabelColor} text-[9px] font-medium cursor-pointer text-center flex items-center justify-center gap-1 hover:text-gs-dim transition-colors`}
              type="button"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15"/></svg>
              Customize Sidebar
            </button>
            {showSidebarSettings && (
              <div className={`mt-1 p-2 rounded-lg ${sidebarSurfaceBg} border ${sidebarBorder} animate-fade-in`}>
                <div className={`text-[9px] font-semibold uppercase tracking-wider ${sectionLabelColor} mb-1.5`}>Show/Hide Items</div>
                {NAV_ITEMS.map(item => (
                  <label key={item.id} className={`flex items-center gap-2 py-0.5 text-[10px] ${sidebarText} cursor-pointer`}>
                    <input
                      type="checkbox"
                      checked={!hiddenNavItems.includes(item.id)}
                      onChange={() => setHiddenNavItems(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id])}
                      className="accent-[var(--gs-accent)] w-3 h-3"
                    />
                    {item.label}
                  </label>
                ))}
                <button
                  onClick={() => setHiddenNavItems([])}
                  className="mt-1 w-full text-[9px] text-gs-accent hover:underline bg-transparent border-none cursor-pointer"
                  type="button"
                >
                  Show All
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Improvement 10: Quick create menu toggle ── */}
        {!collapsed && !isGuest && (
          <div className="px-3 mb-1">
            <button
              onClick={() => setShowQuickCreate(prev => !prev)}
              className={`w-full py-1.5 bg-transparent border-none text-[10px] font-medium cursor-pointer text-center flex items-center justify-center gap-1 transition-colors rounded ${showQuickCreate ? 'text-gs-accent' : `${sectionLabelColor} hover:text-gs-dim ${sidebarHoverBg}`}`}
              type="button"
              aria-expanded={showQuickCreate}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Quick Create
            </button>
          </div>
        )}

        {/* ── Improvement 12: Sidebar accessibility mode toggle ── */}
        {!collapsed && (
          <div className="px-3 mb-1">
            <button
              onClick={() => setAccessibilityMode(prev => !prev)}
              className={`w-full py-1 bg-transparent border-none text-[9px] font-medium cursor-pointer text-center flex items-center justify-center gap-1 transition-colors ${accessibilityMode ? 'text-gs-accent' : `${sectionLabelColor} hover:text-gs-dim`}`}
              type="button"
              aria-pressed={accessibilityMode}
              title="Toggle accessibility mode for enhanced screen reader support"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="8" r="2"/><path d="M12 10v6M9 20l3-4 3 4"/></svg>
              {accessibilityMode ? 'Accessibility: On' : 'Accessibility'}
            </button>
          </div>
        )}

        {/* NEW #20: Keyboard shortcut legend */}
        {!collapsed && (
          <div className="px-3 mb-1">
            <button
              onClick={() => setShowShortcutLegend(prev => !prev)}
              className={`w-full py-1 bg-transparent border-none ${sectionLabelColor} text-[9px] font-medium cursor-pointer text-center flex items-center justify-center gap-1 hover:text-gs-dim transition-colors`}
              type="button"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/><line x1="14" y1="8" x2="14.01" y2="8"/><line x1="18" y1="8" x2="18.01" y2="8"/><line x1="8" y1="12" x2="8.01" y2="12"/><line x1="12" y1="12" x2="12.01" y2="12"/><line x1="16" y1="12" x2="16.01" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/></svg>
              Keyboard Shortcuts
            </button>
            {showShortcutLegend && (
              <div className={`mt-1 p-2 rounded-lg ${sidebarSurfaceBg} border ${sidebarBorder} animate-fade-in space-y-1`}>
                {[
                  ['\u2318K', 'Command Palette'],
                  ['\u2318N', 'Add Record'],
                  ['\u2318P', 'Create Post'],
                  ['\u2318Z', 'Undo'],
                  ['\u21e7\u2318Z', 'Redo'],
                  ['\u2318/', 'Shortcuts Help'],
                  ['\u2318,', 'Settings'],
                  ['\u2318F', 'Focus Search'],
                  ['1-9', 'Navigate Tabs'],
                  ['Esc', 'Close Modal'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className={`text-[10px] ${sidebarText}`}>{desc}</span>
                    <span className="gs-kbd text-[9px]">{key}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Improvement 7 + NEW #19: Sidebar footer with app version and update check */}
        <div className={`${collapsed ? 'px-1' : 'px-3'} py-2 border-t ${sidebarBorder} transition-[padding] duration-300`}>
          {!collapsed ? (
            <div className="flex items-center justify-between">
              <span className={`text-[9px] font-mono ${sectionLabelColor} flex items-center gap-1`}>
                v{APP_VERSION}
                {updateAvailable && (
                  <span className="px-1 py-0.5 rounded text-[8px] bg-green-500/20 text-green-400 font-sans font-medium">Update</span>
                )}
              </span>
              <button
                onClick={() => alert('Changelog — coming soon!')}
                className={`text-[10px] font-medium ${sectionLabelColor} hover:text-gs-accent bg-transparent border-none cursor-pointer transition-colors flex items-center gap-1`}
                type="button"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
                What&apos;s New
                {hasNewUpdates && (
                  <span className="w-1.5 h-1.5 rounded-full bg-gs-accent shrink-0 animate-pulse" />
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => alert('Changelog — coming soon!')}
              className="gs-tooltip w-full flex items-center justify-center bg-transparent border-none cursor-pointer text-gs-faint hover:text-gs-accent p-1 transition-colors relative"
              title={`v${APP_VERSION}${updateAvailable ? ' (update available)' : ''} — What's New`}
              data-tooltip={`v${APP_VERSION}`}
              type="button"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              {(hasNewUpdates || updateAvailable) && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gs-accent animate-pulse" />
              )}
            </button>
          )}
        </div>

        {/* User / guest section */}
        <div className={`${collapsed ? 'px-1' : 'px-2'} pt-3 mx-2 border-t ${sidebarBorder} transition-[padding] duration-300`}>
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
                  className={`flex items-center gap-2.5 py-2 w-full bg-transparent border-none cursor-pointer rounded-lg ${sidebarHoverBg} transition-colors ${collapsed ? 'px-0 justify-center' : 'px-2.5'}`}
                >
                  {/* Online status dot on avatar */}
                  <div className="relative shrink-0">
                    <Avatar username={currentUser} size={collapsed ? 28 : 30} src={profile.avatarUrl} />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${darkMode ? 'border-gs-sidebar' : 'border-white'} ${currentStatus.color} transition-colors duration-200`} />
                  </div>
                  {!collapsed && (
                    <div className="text-left min-w-0 flex-1">
                      <div className={`text-xs font-semibold ${darkMode ? 'text-neutral-200' : 'text-gray-900'} truncate`}>{profile.displayName}</div>
                      <div className={`text-[10px] ${sectionLabelColor} font-mono truncate`}>@{currentUser}</div>
                      {/* User status message */}
                      {statusMessage && (
                        <div className={`text-[9px] ${sidebarText} truncate mt-0.5 italic`}>{statusMessage}</div>
                      )}
                    </div>
                  )}
                </button>

                {/* Status selector */}
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
                  <div className={`absolute bottom-full left-0 right-0 mb-1 ${sidebarSurfaceBg} border ${sidebarBorder} rounded-lg shadow-xl overflow-hidden z-50 animate-fade-in`}>
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => { onStatusChange(opt.id); setStatusOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 bg-transparent border-none cursor-pointer text-[11px] font-medium text-left ${sidebarHoverBg} transition-colors ${userStatus === opt.id ? (darkMode ? 'text-gs-text' : 'text-gray-900') : sidebarText}`}
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

              {/* Profile completion percentage */}
              {!collapsed && profileCompletion < 100 && (
                <div className="px-2.5 py-1.5">
                  <button
                    onClick={() => setNav("Profile")}
                    className="w-full bg-transparent border-none cursor-pointer p-0 text-left"
                    type="button"
                  >
                    <div className={`flex items-center justify-between text-[9px] ${sectionLabelColor} mb-1`}>
                      <span>Profile</span>
                      <span className="text-gs-accent">{profileCompletion}%</span>
                    </div>
                    <div className={`h-1 ${darkMode ? 'bg-[#1a1a1a]' : 'bg-gray-200'} rounded-full overflow-hidden`}>
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
                  className={`w-full py-2 px-2.5 bg-transparent border-none ${sectionLabelColor} text-[11px] font-medium cursor-pointer mt-1 font-mono text-center hover:text-red-400 transition-colors`}
                >
                  Log out
                </button>
              )}
            </>
          )}
        </div>

        {/* Sidebar resize handle (Improvement 15: persists width to localStorage) */}
        {!collapsed && (
          <div
            ref={resizeRef}
            onMouseDown={handleResizeStart}
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-gs-accent/30 transition-colors z-[101]"
            title="Drag to resize"
          />
        )}
      </nav>

      {/* ── Improvement 13: Sidebar overlay mode for mobile ── */}
      {overlayOpen && (
        <div className="gs-mobile-overlay fixed inset-0 z-[150] hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOverlayOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[260px] bg-gs-sidebar border-r border-gs-border-subtle overflow-y-auto animate-fade-in py-5 px-3">
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-[15px] font-extrabold tracking-tight">
                groove<span className="text-gs-accent">stack</span>
              </span>
              <button onClick={() => setOverlayOpen(false)} className="p-1 text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="space-y-0.5">
              {navItems.filter(item => !hiddenNavItems.includes(item.id)).map(item => {
                const active = nav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setNav(item.id); setOverlayOpen(false); }}
                    className={`gs-nav-item w-full ${active ? 'gs-nav-item-active text-gs-accent' : 'text-gs-dim hover:text-gs-muted hover:bg-[#111]'} transition-colors`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.path} /></svg>
                    <span className="gs-sidebar-label">{item.label}</span>
                    {renderBadge(item.id)}
                  </button>
                );
              })}
            </div>
            {!isGuest && onLogout && (
              <button onClick={() => { setOverlayOpen(false); onLogout(); }} className="w-full py-2.5 px-2.5 bg-transparent border-none text-gs-dim text-[11px] font-medium cursor-pointer mt-4 font-mono text-center hover:text-red-400 transition-colors">
                Log out
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile bottom tab bar (Improvement 14: smooth scroll to active) ── */}
      <nav
        ref={mobileBarRef}
        aria-label="Mobile navigation"
        className="gs-mobile-bar hidden fixed bottom-0 left-0 right-0 bg-gs-sidebar border-t border-gs-border-subtle justify-around items-center z-[100] px-1 pt-1.5 pb-[env(safe-area-inset-bottom,6px)] overflow-x-auto"
      >
        {MOBILE_TABS.map(({ id, label, path }) => {
          const active = nav === id;
          const guestLocked = isGuest && id !== "Marketplace";
          const isGuestProfile = isGuest && id === "Profile";
          return (
            <button
              key={id}
              ref={active ? activeTabRef : undefined}
              onClick={() => isGuestProfile ? onSignIn() : setNav(id)}
              className={`flex flex-col items-center gap-0.5 bg-transparent border-none cursor-pointer min-w-[56px] py-1.5 transition-all duration-200 ease-out relative ${active ? 'text-gs-accent scale-105' : guestLocked && !isGuestProfile ? 'text-gs-subtle opacity-40' : 'text-gs-dim'}`}
            >
              <div className="relative">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={path} />
                </svg>
                {/* Unread badge on Social */}
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
                {/* Messages badge on mobile */}
                {id === "messages" && messagesUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] rounded-full bg-red-500 text-[7px] font-extrabold text-white flex items-center justify-center px-0.5">
                    {messagesUnreadCount > 99 ? '99+' : messagesUnreadCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-sans leading-tight ${active ? "font-bold" : "font-medium"}`}>
                {isGuestProfile ? "Sign In" : label}
              </span>
              {/* Active indicator dot */}
              {active && <div className="w-1 h-1 rounded-full bg-gs-accent transition-all duration-300" />}
            </button>
          );
        })}
      </nav>
    </>
  );
}
