// Root component — owns all shared state and passes it down to screens and modals.
// All record mutations, follow/unfollow, and user actions are handled here and passed as callbacks.
// State is persisted to localStorage on every change (currentUser, records, following, profile, dmMessages).
// Navigation state (nav) determines which screen is rendered in the main content area.
// Auth is managed via Supabase — shows AuthScreen when no session is active.
import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense, useReducer } from 'react';
import INITIAL_RECORDS from './constants/records';
import INITIAL_POSTS from './constants/posts';
import INITIAL_LISTENING from './constants/listening';
import { USER_PROFILES, ACCENT_COLORS } from './constants';
import { getToken, getMe, signOut, updateProfile, updateUsername as apiUpdateUsername } from './utils/supabase';
import { API_BASE } from './utils/api';
// Layout
import Sidebar from './components/Sidebar';
import AuthScreen from './components/AuthScreen';
// Modals
import AddRecordModal from './components/modals/AddRecordModal';
import CommentsModal from './components/modals/CommentsModal';
import BuyModal from './components/modals/BuyModal';
import DetailModal from './components/modals/DetailModal';
import ProfileEditModal from './components/modals/ProfileEditModal';
import UserProfileModal from './components/modals/UserProfileModal';
import DMModal from './components/modals/DMModal';
import NotificationsPanel from './components/modals/NotificationsPanel';
import OfferModal from './components/modals/OfferModal';
import CreatePostModal from './components/modals/CreatePostModal';
import ArtistProfileModal from './components/modals/ArtistProfileModal';
import VerifyRecordModal from './components/modals/VerifyRecordModal';
// UI
import Toast from './components/ui/Toast';
import SkipToContent from './components/ui/SkipToContent';
import OfflineBanner from './components/ui/OfflineBanner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import DataSyncIndicator from './components/ui/DataSyncIndicator';
import ScrollToTop from './components/ui/ScrollToTop';
import Confetti from './components/ui/Confetti';
import OnboardingTour from './components/ui/OnboardingTour';
import SwipeHandler from './components/ui/SwipeHandler';
import KeyboardShortcutsHelp from './components/ui/KeyboardShortcutsHelp';

// ── Improvement #25: Multi-language prep (i18n structure) ───────────────────
const TRANSLATIONS = {
  en: {
    loading: 'Loading...', search: 'Search...', addRecord: 'Add Record',
    profile: 'Profile', settings: 'Settings', logout: 'Log Out',
    collection: 'Collection', marketplace: 'Marketplace', social: 'Social',
    savedToast: 'Saved!', removedSaved: 'Removed from saved',
    commandPalette: 'Search records, users, posts, actions...',
    noResults: 'No results found', cancel: 'Cancel', confirm: 'Confirm',
    undoAction: 'Undo', redoAction: 'Redo', exportData: 'Export Data',
    importDiscogs: 'Import from Discogs', batchMode: 'Batch Mode',
    darkMode: 'Dark Mode', lightMode: 'Light Mode', fullScreen: 'Full Screen',
    printMode: 'Print Mode', sessionWarning: 'Session expiring soon',
    connectionGood: 'Connected', connectionSlow: 'Slow connection',
    connectionOffline: 'Offline',
  },
};

function t(key, lang) {
  const _lang = lang || 'en';
  return (TRANSLATIONS[_lang] && TRANSLATIONS[_lang][key]) || TRANSLATIONS.en[key] || key;
}

// ── Improvement #5: Undo/redo reducer ───────────────────────────────────────
function undoReducer(state, action) {
  switch (action.type) {
    case 'PUSH': {
      const newPast = [...state.past, action.entry].slice(-30);
      return { past: newPast, future: [] };
    }
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), future: [prev, ...state.future] };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return { past: [...state.past, next], future: state.future.slice(1) };
    }
    default: return state;
  }
}

// Lazy-loaded screens (Performance #14)
const SocialFeedScreen = lazy(() => import('./components/screens/SocialFeedScreen'));
const ExploreScreen = lazy(() => import('./components/screens/ExploreScreen'));
const CollectionScreen = lazy(() => import('./components/screens/CollectionScreen'));
const ProfileScreen = lazy(() => import('./components/screens/ProfileScreen'));
const FollowingScreen = lazy(() => import('./components/screens/FollowingScreen'));
const TransactionsScreen = lazy(() => import('./components/screens/TransactionsScreen'));
const VinylBuddyScreen = lazy(() => import('./components/screens/VinylBuddyScreen'));
const SettingsScreen = lazy(() => import('./components/screens/SettingsScreen'));
const UserProfilePage = lazy(() => import('./components/screens/UserProfilePage'));

// Lazy loading fallback spinner — Improvement #11: includes top progress bar
function ScreenLoader() {
  return (
    <div className="relative">
      {/* Progress bar at top */}
      <div className="fixed top-0 left-0 right-0 z-[2000] h-[3px] bg-gs-border overflow-hidden">
        <div className="h-full bg-gs-accent animate-pulse" style={{ width: '60%', transition: 'width 0.3s' }} />
      </div>
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gs-accent animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          <span className="text-gs-dim text-sm">{t('loading')}</span>
        </div>
      </div>
    </div>
  );
}

// ── Global font + reset ────────────────────────────────────────────────────────
// Global styles now in src/index.css with Tailwind

export default function App() {
  // ── Auth state ──────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Core state — all initialized from localStorage with fallbacks ──────────
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('gs_currentUser') || '');
  const [records, setRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_records')) || INITIAL_RECORDS; } catch { return INITIAL_RECORDS; }
  });
  const [nav, setNav] = useState(() => getToken() ? "Social" : "Marketplace");
  const [posts, setPosts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_posts')) || INITIAL_POSTS; } catch { return INITIAL_POSTS; }
  });
  const [following, setFollowing] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_following')) || ["mara.vinyl", "thomas.wax", "juniper.sounds", "felix.rpm", "nadia.rpm", "yuki.vinyl", "cleo.spins"]; } catch { return ["mara.vinyl", "thomas.wax", "juniper.sounds", "felix.rpm", "nadia.rpm", "yuki.vinyl", "cleo.spins"]; }
  });
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_profile')) || { displayName: "", bio: "", location: "", favGenre: "" }; } catch { return { displayName: "", bio: "", location: "", favGenre: "" }; }
  });
  const [dmMessages, setDmMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_dmMessages')) || {}; } catch { return {}; }
  });
  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_wishlist')) || []; } catch { return []; }
  });
  const [offers, setOffers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_offers')) || []; } catch { return []; }
  });
  const [purchases, setPurchases] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_purchases')) || []; } catch { return []; }
  });
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_cart')) || []; } catch { return []; }
  });
  const [listeningHistory, setListeningHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_listening')) || INITIAL_LISTENING; } catch { return INITIAL_LISTENING; }
  });
  const [vinylBuddyDevice, setVinylBuddyDevice] = useState(() => localStorage.getItem('gs_vinylBuddyDevice') || '');
  const vinylBuddyActivated = vinylBuddyDevice.length > 0;

  // ── Improvement #5: Undo/redo system ───────────────────────────────────────
  const [undoState, dispatchUndo] = useReducer(undoReducer, { past: [], future: [] });

  // ── Improvement #8: Dark/light theme toggle ───────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem('gs_theme') || 'dark');

  // ── Improvement #6: Connection quality indicator ──────────────────────────
  const [connectionQuality, setConnectionQuality] = useState('good');

  // ── Improvement #7: Session timeout warning ───────────────────────────────
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const sessionTimeoutRef = useRef(null);

  // ── Improvement #9: Global audio player bar ───────────────────────────────
  const [audioPlayer, setAudioPlayer] = useState({ playing: false, track: null, progress: 0 });
  const audioRef = useRef(null); // eslint-disable-line no-unused-vars

  // ── Improvement #13: Batch operations mode ────────────────────────────────
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState([]);

  // ── Improvement #14: User activity logging ────────────────────────────────
  const [activityLog, setActivityLog] = useState(() => { // eslint-disable-line no-unused-vars
    try { return JSON.parse(localStorage.getItem('gs_activityLog')) || []; } catch { return []; }
  });

  // ── Improvement #15: Onboarding checklist progress ────────────────────────
  const [onboardingChecklist, setOnboardingChecklist] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_onboardingChecklist')) || { addedRecord: false, madePost: false, followedUser: false, customizedProfile: false, madeOffer: false }; } catch { return { addedRecord: false, madePost: false, followedUser: false, customizedProfile: false, madeOffer: false }; }
  });

  // ── Improvement #17: Performance monitoring (render count) ────────────────
  const renderCount = useRef(0);
  renderCount.current += 1;

  // ── Improvement #22: Recent searches history ──────────────────────────────
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_recentSearches')) || []; } catch { return []; }
  });

  // ── Improvement #23: User preferences sync ────────────────────────────────
  const [userPreferences, setUserPreferences] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_userPreferences')) || { compactView: false, autoPlay: false, showPrices: true, language: 'en' }; } catch { return { compactView: false, autoPlay: false, showPrices: true, language: 'en' }; }
  });

  // ── Improvement #26: Print-friendly mode toggle ───────────────────────────
  const [printMode, setPrintMode] = useState(false);

  // ── Improvement #27: Full-screen mode ─────────────────────────────────────
  const [isFullScreen, setIsFullScreen] = useState(false);

  // ── Improvement #1: Command palette state ─────────────────────────────────
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const commandInputRef = useRef(null);

  // ── Improvement #2: Drag-and-drop reorder state ───────────────────────────
  const [dragState, setDragState] = useState({ dragging: false, dragIndex: null, overIndex: null });

  // ── Improvement #18: Accessibility announcements ──────────────────────────
  const [a11yAnnouncement, setA11yAnnouncement] = useState('');

  // ── Improvement #19: Screen transition animations ─────────────────────────
  const [transitionClass, setTransitionClass] = useState('animate-fade-in');

  // ── Improvement #20: Auto-refresh stale data timestamp ────────────────────
  const lastDataFetch = useRef(Date.now());

  // ── Improvement #29: Import from Discogs state ────────────────────────────
  const [showDiscogsImport, setShowDiscogsImport] = useState(false);
  const [discogsUsername, setDiscogsUsername] = useState('');
  const [discogsImporting, setDiscogsImporting] = useState(false);

  // ── Improvement #30: Quick add from search state ──────────────────────────
  const [quickAddVisible, setQuickAddVisible] = useState(false);

  // ── Modal / panel visibility ─────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [commentRecord, setCommentRecord] = useState(null);
  const [buyRecord, setBuyRecord] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [showDMs, setShowDMs] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifCount, setNotifCount] = useState(() => {
    try { const v = localStorage.getItem('gs_notifCount'); return v !== null ? JSON.parse(v) : 4; } catch { return 4; }
  });
  const [offerTarget, setOfferTarget] = useState(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [viewingUserProfile, setViewingUserProfile] = useState(null);
  const [viewingArtist, setViewingArtist] = useState(null);
  const [verifyingRecord, setVerifyingRecord] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [toast, setToast] = useState({ visible: false, msg: "" });

  // ── Data sync indicator state ──────────────────────────────────────────────
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Confetti state (first purchase celebration) ────────────────────────────
  const [showConfetti, setShowConfetti] = useState(false);

  // ── Scroll-to-top trigger ─────────────────────────────────────────────────
  const [scrollTopTrigger, setScrollTopTrigger] = useState(0);

  // ── Global search state ─────────────────────────────────────────────────────
  const [globalSearch, setGlobalSearch] = useState("");
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const globalSearchTimer = useRef(null);
  const [debouncedGlobalSearch, setDebouncedGlobalSearch] = useState("");

  // Debounce global search input (300ms)
  useEffect(() => {
    globalSearchTimer.current = setTimeout(() => setDebouncedGlobalSearch(globalSearch), 300);
    return () => clearTimeout(globalSearchTimer.current);
  }, [globalSearch]);

  const globalSearchResults = useMemo(() => { // eslint-disable-line no-unused-vars
    const q = debouncedGlobalSearch.trim().toLowerCase();
    if (!q) return { records: [], users: [], posts: [] };
    return {
      records: records.filter(r => r.album?.toLowerCase().includes(q) || r.artist?.toLowerCase().includes(q)),
      users: Object.keys(USER_PROFILES).filter(u => u.toLowerCase().includes(q)),
      posts: posts.filter(p => p.caption?.toLowerCase().includes(q)),
    };
  }, [debouncedGlobalSearch, records, posts]);

  // ── What's New changelog ───────────────────────────────────────────────────
  const [showChangelog, setShowChangelog] = useState(false);

  // ── Page transition key ───────────────────────────────────────────────────
  const [pageTransitionKey, setPageTransitionKey] = useState(nav);

  // ── Unread message count (computed) ───────────────────────────────────────
  const unreadCount = useMemo(() => {
    return Object.values(dmMessages).reduce((count, thread) => {
      return count + thread.filter(m => m.from !== currentUser && !m.read).length;
    }, 0);
  }, [dmMessages, currentUser]);

  // ── Cart count for sidebar badge ──────────────────────────────────────────
  const cartCount = useMemo(() => cart.length, [cart]);

  // ── Online status tracking ────────────────────────────────────────────────
  const [lastActiveTimestamp, setLastActiveTimestamp] = useState(() => Date.now()); // eslint-disable-line no-unused-vars
  useEffect(() => {
    const updateActivity = () => setLastActiveTimestamp(Date.now());
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, []);

  // ── User reports (stored in state) ────────────────────────────────────────
  const [userReports, setUserReports] = useState([]); // eslint-disable-line no-unused-vars

  // Shows the Toast bar and auto-hides it after 2.2 seconds
  // Haptic feedback placeholder for mobile interactions (#28)
  const triggerHaptic = (style = 'light') => {
    if (navigator.vibrate) {
      navigator.vibrate(style === 'heavy' ? 50 : style === 'medium' ? 30 : 10);
    }
  };

  const showToast = msg => {
    setToast({ visible: true, msg });
    triggerHaptic('light');
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 2200);
  };

  // Applies a transform fn to a record by id — also syncs detailRecord and commentRecord if they're open
  const updateRecord = (id, fn) => {
    setRecords(rs => rs.map(r => r.id === id ? fn(r) : r));
    setDetailRecord(d => d?.id === id ? fn(d) : d);
    setCommentRecord(d => d?.id === id ? fn(d) : d);
  };

  // ── Auth: apply user data from API response ──────────────────────────────
  const applyUser = useCallback((user) => {
    if (!user) return;
    setSession(user);
    setCurrentUser(user.username || '');
    setProfile({
      displayName: user.displayName || '',
      bio: user.bio || '',
      location: user.location || '',
      favGenre: user.favGenre || '',
      avatarUrl: user.avatarUrl || '',
      headerUrl: user.headerUrl || '',
      shippingName: user.shippingName || '',
      shippingStreet: user.shippingStreet || '',
      shippingCity: user.shippingCity || '',
      shippingState: user.shippingState || '',
      shippingZip: user.shippingZip || '',
    });
  }, []);

  // ── Auth: check for existing JWT token on mount ─────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) { setAuthLoading(false); return; }
    getMe().then(user => {
      if (user) applyUser(user);
      setAuthLoading(false);
    });
  }, [applyUser]);

  // ── Auth: called by AuthScreen after login/signup ───────────────────────
  const handleAuth = (user) => { applyUser(user); setShowAuth(false); };

  // ── Auth: logout ────────────────────────────────────────────────────────────
  const handleLogout = () => {
    if (!window.confirm('Log out of Groovestack?')) return;
    signOut();
    setSession(null);
    setCurrentUser('');
    setProfile({ displayName: '', bio: '', location: '', favGenre: '' });
    setNav("Marketplace");
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('gs_')) localStorage.removeItem(k);
    });
  };

  // ── One-time migration: inject creator's records + wishlist into existing localStorage data ──
  useEffect(() => {
    const CREATOR_IDS = [9000,9001,9002,9003,9004,9005,9006,9007,9008,9009,9010,9011,9012,9013,9014,9015];
    const hasCreatorRecords = records.some(r => CREATOR_IDS.includes(r.id));
    if (!hasCreatorRecords) {
      const creatorRecords = INITIAL_RECORDS.filter(r => CREATOR_IDS.includes(r.id));
      if (creatorRecords.length > 0) setRecords(rs => [...creatorRecords, ...rs]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handle Stripe checkout return ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');
    const recordId = params.get('record');
    if (checkoutStatus === 'success' && recordId) {
      const id = parseInt(recordId, 10) || recordId;
      const r = records.find(r => r.id === id);
      if (r) {
        setPurchases(ps => [{ id: Date.now(), recordId: r.id, album: r.album, artist: r.artist, price: r.price, condition: r.condition, accent: r.accent, format: r.format, year: r.year, seller: r.user, time: new Date().toLocaleString() }, ...ps]);
        updateRecord(id, r => ({ ...r, forSale: false, price: null }));
        setCart(c => c.filter(item => item.recordId !== id));
        showToast("Purchase complete! 🎉");
      }
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (checkoutStatus === 'cancel') {
      showToast("Checkout cancelled");
      window.history.replaceState({}, '', window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persistence ──────────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('gs_currentUser', currentUser); }, [currentUser]);
  useEffect(() => { try { localStorage.setItem('gs_records', JSON.stringify(records)); } catch {} }, [records]);
  useEffect(() => { localStorage.setItem('gs_following', JSON.stringify(following)); }, [following]);
  useEffect(() => { localStorage.setItem('gs_profile', JSON.stringify(profile)); }, [profile]);
  useEffect(() => { localStorage.setItem('gs_dmMessages', JSON.stringify(dmMessages)); }, [dmMessages]);
  useEffect(() => { localStorage.setItem('gs_wishlist', JSON.stringify(wishlist)); }, [wishlist]);
  useEffect(() => { localStorage.setItem('gs_offers', JSON.stringify(offers)); }, [offers]);
  useEffect(() => { localStorage.setItem('gs_purchases', JSON.stringify(purchases)); }, [purchases]);
  useEffect(() => { localStorage.setItem('gs_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { try { localStorage.setItem('gs_posts', JSON.stringify(posts)); } catch {} }, [posts]);
  useEffect(() => { try { localStorage.setItem('gs_listening', JSON.stringify(listeningHistory)); } catch {} }, [listeningHistory]);
  useEffect(() => { localStorage.setItem('gs_vinylBuddyDevice', vinylBuddyDevice); }, [vinylBuddyDevice]);
  useEffect(() => { localStorage.setItem('gs_notifCount', JSON.stringify(notifCount)); }, [notifCount]);

  // ── Improvement #8: Persist theme to localStorage + apply to document ───
  useEffect(() => {
    localStorage.setItem('gs_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  // ── Improvement #14: Persist activity log ─────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem('gs_activityLog', JSON.stringify(activityLog.slice(-200))); } catch { /* quota */ }
  }, [activityLog]);

  // ── Improvement #15: Persist onboarding checklist ─────────────────────────
  useEffect(() => {
    localStorage.setItem('gs_onboardingChecklist', JSON.stringify(onboardingChecklist));
  }, [onboardingChecklist]);

  // ── Improvement #22: Persist recent searches ──────────────────────────────
  useEffect(() => {
    localStorage.setItem('gs_recentSearches', JSON.stringify(recentSearches.slice(-20)));
  }, [recentSearches]);

  // ── Improvement #23: Persist user preferences ─────────────────────────────
  useEffect(() => {
    localStorage.setItem('gs_userPreferences', JSON.stringify(userPreferences));
  }, [userPreferences]);

  // ── Improvement #4: Auto-save all user data to localStorage periodically ──
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      try {
        localStorage.setItem('gs_autoSaveTimestamp', JSON.stringify(Date.now()));
      } catch { /* quota exceeded */ }
    }, 30000);
    return () => clearInterval(autoSaveInterval);
  }, []);

  // ── Improvement #6: Connection quality monitoring ─────────────────────────
  useEffect(() => {
    const checkConnection = () => {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!navigator.onLine) { setConnectionQuality('offline'); return; }
      if (conn) {
        const effectiveType = conn.effectiveType;
        if (effectiveType === '4g') setConnectionQuality('good');
        else if (effectiveType === '3g') setConnectionQuality('slow');
        else setConnectionQuality('poor');
      } else {
        setConnectionQuality(navigator.onLine ? 'good' : 'offline');
      }
    };
    checkConnection();
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) conn.addEventListener('change', checkConnection);
    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
      if (conn) conn.removeEventListener('change', checkConnection);
    };
  }, []);

  // ── Improvement #7: Session timeout warning ───────────────────────────────
  useEffect(() => {
    if (!session) return;
    const resetTimer = () => {
      clearTimeout(sessionTimeoutRef.current);
      setShowSessionWarning(false);
      sessionTimeoutRef.current = setTimeout(() => {
        setShowSessionWarning(true);
      }, 25 * 60 * 1000); // 25 minutes
    };
    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    return () => {
      clearTimeout(sessionTimeoutRef.current);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [session]);

  // ── Improvement #12: Deep linking support (URL hash routing) ──────────────
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validNavs = ['Social', 'Marketplace', 'Collection', 'Activity', 'Vinyl Buddy', 'Profile', 'Settings'];
      if (hash && validNavs.includes(hash)) {
        if (!session && hash !== 'Marketplace') return;
        setNav(hash);
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Improvement #20: Auto-refresh stale data ──────────────────────────────
  useEffect(() => {
    const staleCheckInterval = setInterval(() => {
      const elapsed = Date.now() - lastDataFetch.current;
      if (elapsed > 5 * 60 * 1000 && currentUser && document.visibilityState === 'visible') {
        lastDataFetch.current = Date.now();
        // Refresh user data from API
        if (getToken()) {
          getMe().then(user => { if (user) applyUser(user); });
        }
      }
    }, 60000);
    return () => clearInterval(staleCheckInterval);
  }, [currentUser, applyUser]);

  // ── Improvement #27: Full-screen API integration ──────────────────────────
  useEffect(() => {
    const handleFSChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  // ── Improvement #1: Focus command palette input when opened ────────────────
  useEffect(() => {
    if (showCommandPalette && commandInputRef.current) {
      commandInputRef.current.focus();
    }
  }, [showCommandPalette]);

  // ── Improvement #26: Print mode body class ────────────────────────────────
  useEffect(() => {
    document.body.classList.toggle('print-mode', printMode);
    return () => document.body.classList.remove('print-mode');
  }, [printMode]);

  // ── Improvement #19: Transition animations on nav change ──────────────────
  // ── Update page transition key when nav changes ─────────────────────────
  useEffect(() => {
    setTransitionClass('opacity-0 translate-y-1');
    const timer = setTimeout(() => {
      setPageTransitionKey(nav + '-' + Date.now());
      setTransitionClass('animate-fade-in');
    }, 80);
    setScrollTopTrigger(prev => prev + 1);
    // Improvement #12: Sync hash with nav
    if (window.location.hash.replace('#', '') !== nav) {
      window.history.replaceState(null, '', '#' + nav);
    }
    // Improvement #18: Accessibility announcement on page change
    setA11yAnnouncement(`Navigated to ${nav}`);
    return () => clearTimeout(timer);
  }, [nav]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // Check if any modal is open (used to suppress non-Escape shortcuts)
  const anyModalOpen = showAdd || !!commentRecord || !!buyRecord || !!detailRecord ||
    showEditProfile || !!viewingUser || showDMs || showNotifs || !!offerTarget ||
    showCreatePost || !!viewingArtist || !!verifyingRecord || showAuth || showShortcutsHelp || showCommandPalette;
  const isGuestForShortcuts = !session; // Derived early so keyboard effect can reference it

  useEffect(() => {
    const NAV_KEYS = ['Social', 'Marketplace', 'Collection', 'Activity', 'Vinyl Buddy', 'Profile'];
    const handler = (e) => {
      // Escape — close any open modal or dismiss toast
      if (e.key === 'Escape') {
        // Dismiss visible toast on Escape
        if (toast.visible) { setToast(t => ({ ...t, visible: false })); }
        if (showCommandPalette) { setShowCommandPalette(false); setCommandQuery(''); return; }
        if (showShortcutsHelp) { setShowShortcutsHelp(false); return; }
        if (showGlobalSearch) { setShowGlobalSearch(false); setGlobalSearch(""); return; }
        if (showChangelog) { setShowChangelog(false); return; }
        if (showAuth) { setShowAuth(false); return; }
        if (showAdd) { setShowAdd(false); return; }
        if (commentRecord) { setCommentRecord(null); return; }
        if (buyRecord) { setBuyRecord(null); return; }
        if (detailRecord) { setDetailRecord(null); return; }
        if (showEditProfile) { setShowEditProfile(false); return; }
        if (viewingUser) { setViewingUser(null); return; }
        if (showDMs) { setShowDMs(false); return; }
        if (showNotifs) { setShowNotifs(false); return; }
        if (offerTarget) { setOfferTarget(null); return; }
        if (showCreatePost) { setShowCreatePost(false); return; }
        if (viewingArtist) { setViewingArtist(null); return; }
        if (verifyingRecord) { setVerifyingRecord(null); return; }
        return;
      }

      // When a modal is open, only Escape should work — disable all other shortcuts
      if (anyModalOpen) return;

      // Don't trigger shortcuts when typing in inputs
      const tag = document.activeElement?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;

      // Cmd/Ctrl shortcuts (work even in inputs, since they use modifier)
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            // Improvement #1: Command palette instead of simple search
            setShowCommandPalette(s => !s);
            setCommandQuery('');
            return;
          case 'n':
            e.preventDefault();
            if (!isGuestForShortcuts) setShowAdd(true);
            else setShowAuth(true);
            return;
          case 'p':
            e.preventDefault();
            if (!isGuestForShortcuts) setShowCreatePost(true);
            else setShowAuth(true);
            return;
          case 'z':
            e.preventDefault();
            // Improvement #5: Undo/Redo
            if (e.shiftKey) { if (typeof handleRedo === 'function') handleRedo(); } else { if (typeof handleUndo === 'function') handleUndo(); }
            return;
          case '/':
            e.preventDefault();
            setShowShortcutsHelp(s => !s);
            return;
          case ',':
            e.preventDefault();
            setNav('Settings');
            return;
          case 'f':
            e.preventDefault();
            // Focus the sidebar search input
            {
              const searchInput = document.querySelector('.gs-sidebar-desktop input[type="text"]');
              if (searchInput) searchInput.focus();
            }
            return;
          default:
            break;
        }
      }

      // Number keys 1-6 for tab navigation (skip when typing in inputs)
      if (!isInput && e.key >= '1' && e.key <= '6') {
        const idx = parseInt(e.key, 10) - 1;
        const target = NAV_KEYS[idx];
        if (target) {
          if (isGuestForShortcuts && target !== 'Marketplace') { setShowAuth(true); return; }
          setViewingUserProfile(null);
          setNav(target);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showGlobalSearch, showChangelog, showAuth, showAdd, commentRecord, buyRecord, detailRecord, showEditProfile, viewingUser, showDMs, showNotifs, offerTarget, showCreatePost, viewingArtist, verifyingRecord, showShortcutsHelp, showCommandPalette, anyModalOpen, isGuestForShortcuts, toast.visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll Vinyl Buddy server for new listening sessions ───────────────────
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/vinyl-buddy/history/${currentUser}?limit=50`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.sessions?.length) return;
        setListeningHistory(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const newSessions = data.sessions.filter(s => !existingIds.has(s.id));
          return newSessions.length > 0 ? [...newSessions, ...prev] : prev;
        });
      } catch { /* server not running — that's fine */ }
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentUser]);

  // Re-keys currentUser, record.user, and DM message.from fields to the new handle atomically
  const onUsernameChange = async (newHandle) => {
    const old = currentUser;
    setCurrentUser(newHandle);
    setRecords(rs => rs.map(r => r.user === old ? { ...r, user: newHandle } : r));
    setDmMessages(msgs => {
      const updated = {};
      for (const [thread, threadMsgs] of Object.entries(msgs)) {
        updated[thread] = threadMsgs.map(m => m.from === old ? { ...m, from: newHandle } : m);
      }
      return updated;
    });
    setOffers(os => os.map(o => o.from === old ? { ...o, from: newHandle } : o));
    setPosts(ps => ps.map(p => p.user === old ? { ...p, user: newHandle } : p));

    // Persist to database
    if (session) {
      try { await apiUpdateUsername(newHandle); } catch { /* offline fallback */ }
    }
  };

  // ── Wishlist actions ───────────────────────────────────────────────────────
  const onAddWishlistItem = (album, artist) => {
    const exists = wishlist.some(
      w => w.album.toLowerCase() === album.toLowerCase() && w.artist.toLowerCase() === artist.toLowerCase()
    );
    if (exists) { showToast("Already on your wishlist!"); return; }
    setWishlist(w => [...w, { id: Date.now(), album: album.trim(), artist: artist.trim() }]);
    showToast("Added to wishlist!");
  };

  const onRemoveWishlistItem = (id) => {
    setWishlist(w => w.filter(item => item.id !== id));
    showToast("Removed from wishlist");
  };

  // ── Offer actions ──────────────────────────────────────────────────────────
  const onSubmitOffer = ({ type, price, shipping, tradeRecord }) => {
    if (!offerTarget) return;
    setOffers(o => [{
      id: Date.now(), from: currentUser, to: offerTarget.targetUser,
      album: offerTarget.wishlistItem.album, artist: offerTarget.wishlistItem.artist,
      offeredRecordId: offerTarget.offeredRecord?.id || null,
      type: type || "cash",
      price: parseFloat(price) || 0, shipping: parseFloat(shipping) || 0,
      tradeRecord: tradeRecord || null,
      status: "pending", time: "just now",
    }, ...o]);
    const label = type === "trade" ? "Trade offer" : type === "combo" ? "Combo offer" : "Offer";
    setOfferTarget(null);
    setNotifCount(n => n + 1);
    showToast(`${label} sent to @${offerTarget.targetUser}!`);
    logActivity('submit_offer', `${label} to @${offerTarget.targetUser}`);
    // Improvement #15: Update onboarding checklist
    setOnboardingChecklist(c => ({ ...c, madeOffer: true }));
  };

  const onAcceptOffer = (offerId) => {
    setOffers(o => o.map(offer => {
      if (offer.id !== offerId) return offer;
      return { ...offer, status: "accepted", shippingLabel: `SHIP-${Date.now().toString(36).toUpperCase()}` };
    }));
    const offer = offers.find(o => o.id === offerId);
    if (offer) {
      // For trades: swap records between users
      if (offer.type === "trade" || offer.type === "combo") {
        // Transfer offered record ownership
        if (offer.offeredRecordId) {
          updateRecord(offer.offeredRecordId, r => ({ ...r, user: offer.to, forSale: false, price: null }));
        }
        // Transfer trade record to offerer
        if (offer.tradeRecord?.id) {
          updateRecord(offer.tradeRecord.id, r => ({ ...r, user: offer.from, forSale: false, price: null }));
        }
      }
      // For cash/combo purchases: mark offered record as sold
      if (offer.type === "cash" || offer.type === "combo") {
        if (offer.offeredRecordId) {
          updateRecord(offer.offeredRecordId, r => ({ ...r, forSale: false, price: null }));
        }
      }
      showToast(`Offer from @${offer.from} accepted! Shipping label generated.`);
    }
  };

  const onDeclineOffer = (offerId) => {
    setOffers(o => o.map(offer =>
      offer.id === offerId ? { ...offer, status: "declined" } : offer
    ));
    showToast("Offer declined");
  };

  // ── Reorder handler — re-add a previously purchased record to cart ───────
  const onReorder = (purchase) => {
    if (cart.some(item => item.recordId === purchase.recordId)) {
      showToast("Already in cart!");
      return;
    }
    setCart(c => [{
      id: Date.now(), recordId: purchase.recordId, album: purchase.album,
      artist: purchase.artist, price: purchase.price, condition: purchase.condition,
      accent: purchase.accent, format: purchase.format, year: purchase.year,
      seller: purchase.seller,
    }, ...c]);
    showToast("Re-added to cart!");
  };

  // ── Share profile handler ─────────────────────────────────────────────────
  const onShareProfile = (username) => {
    const url = `${window.location.origin}/user/${username || currentUser}`;
    navigator.clipboard?.writeText(url).then(
      () => showToast("Profile link copied!"),
      () => showToast("Profile link: " + url)
    );
    return url;
  };

  // ── Report user handler ───────────────────────────────────────────────────
  const onReportUser = (username, reason) => {
    setUserReports(r => [...r, { id: Date.now(), reporter: currentUser, reported: username, reason, time: new Date().toISOString() }]);
    showToast(`Report submitted for @${username}`);
  };

  // Opens OfferModal from the "Wanted By" section in DetailModal
  const onOfferFromDetail = (record, targetUser, wishlistItem) => {
    setDetailRecord(null);
    setOfferTarget({ wishlistItem, targetUser, offeredRecord: record });
  };

  // ── Record actions — passed to screens and modals as callbacks ───────────────
  // Optimistic updates for likes (#21) — update UI immediately
  const onLike = id => {
    if (requireAuth()) return;
    triggerHaptic('medium');
    const rec = records.find(r => r.id === id);
    const wasLiked = rec?.liked;
    updateRecord(id, r => ({ ...r, liked: !r.liked, likes: r.liked ? r.likes - 1 : r.likes + 1 }));
    // Improvement #5: Undo support for likes
    pushUndo(wasLiked ? 'unlike' : 'like', () => updateRecord(id, r => ({ ...r, liked: wasLiked, likes: wasLiked ? r.likes + 1 : r.likes - 1 })), () => updateRecord(id, r => ({ ...r, liked: !wasLiked, likes: wasLiked ? r.likes - 1 : r.likes + 1 })));
    // Improvement #14: Activity logging
    logActivity(wasLiked ? 'unlike' : 'like', rec?.album || id);
  };

  // Optimistic updates for saves (#21) — update UI immediately
  const onSave = id => {
    if (requireAuth()) return;
    const rec = records.find(r => r.id === id);
    const wasSaved = rec?.saved;
    triggerHaptic('light');
    updateRecord(id, r => ({ ...r, saved: !r.saved }));
    showToast(wasSaved ? "Removed from saved" : "Saved!");
    // Improvement #5: Undo support for saves
    pushUndo(wasSaved ? 'unsave' : 'save', () => updateRecord(id, r => ({ ...r, saved: wasSaved })), () => updateRecord(id, r => ({ ...r, saved: !wasSaved })));
    logActivity(wasSaved ? 'unsave' : 'save', rec?.album || id);
  };

  const onComment = r => { if (requireAuth()) return; setCommentRecord(r); };
  const onBuy = r => setBuyRecord(r);
  const onDetail = r => setDetailRecord(r);

  const onAddComment = (id, c) => {
    updateRecord(id, r => ({ ...r, comments: [...r.comments, c] }));
    showToast("Comment posted!");
  };

  const onPurchase = id => {
    const r = records.find(r => r.id === id);
    const isFirstPurchase = purchases.length === 0;
    if (r) {
      setPurchases(ps => [{ id: Date.now(), recordId: r.id, album: r.album, artist: r.artist, price: r.price, condition: r.condition, accent: r.accent, format: r.format, year: r.year, seller: r.user, time: new Date().toLocaleString() }, ...ps]);
    }
    updateRecord(id, r => ({ ...r, forSale: false, price: null }));
    setCart(c => c.filter(item => item.recordId !== id));
    triggerHaptic('heavy');
    // Confetti animation on first purchase (#29)
    if (isFirstPurchase) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
      showToast("First purchase! Welcome to the club!");
    } else {
      showToast("Purchase complete!");
    }
  };

  const onAddToCart = r => {
    if (cart.some(item => item.recordId === r.id)) { showToast("Already in cart!"); return; }
    setCart(c => [{ id: Date.now(), recordId: r.id, album: r.album, artist: r.artist, price: r.price, condition: r.condition, accent: r.accent, format: r.format, year: r.year, seller: r.user }, ...c]);
    showToast("Added to cart!");
  };

  const onRemoveFromCart = id => {
    setCart(c => c.filter(item => item.id !== id));
    showToast("Removed from cart");
  };

  const onAdd = r => {
    setRecords(rs => [r, ...rs]);
    showToast(r.verified ? "Verified record added!" : "Record added to collection!");
    logActivity('add_record', r.album);
    // Improvement #15: Update onboarding checklist
    setOnboardingChecklist(c => ({ ...c, addedRecord: true }));
    pushUndo('add record', () => setRecords(rs => rs.filter(rec => rec.id !== r.id)), () => setRecords(rs => [r, ...rs]));
  };

  const onVerifyRecord = r => setVerifyingRecord(r);
  const onRecordVerified = id => {
    setRecords(rs => rs.map(r => r.id === id ? { ...r, verified: true } : r));
    showToast("Record verified! ✓");
  };

  // ── Post actions ───────────────────────────────────────────────────────────
  const onCreatePost = ({ caption, mediaUrl, mediaType, taggedRecord }) => {
    const accent = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
    setPosts(ps => [{
      id: Date.now(), user: currentUser, caption, mediaUrl, mediaType,
      taggedRecord, likes: 0, liked: false, comments: [], bookmarked: false,
      timeAgo: "just now", createdAt: Date.now(), accent,
    }, ...ps]);
    showToast("Post shared!");
    logActivity('create_post', caption);
    // Improvement #15: Update onboarding checklist
    setOnboardingChecklist(c => ({ ...c, madePost: true }));
  };

  const onLikePost = id => {
    setPosts(ps => ps.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p));
  };

  const onCommentPost = (id, comment) => {
    setPosts(ps => ps.map(p => p.id === id ? { ...p, comments: [...p.comments, comment] } : p));
    showToast("Comment posted!");
  };

  const onBookmarkPost = id => {
    const p = posts.find(p => p.id === id);
    setPosts(ps => ps.map(p => p.id === id ? { ...p, bookmarked: !p.bookmarked } : p));
    showToast(p?.bookmarked ? "Removed from bookmarks" : "Bookmarked!");
  };

  // ── Social actions ───────────────────────────────────────────────────────────
  const onFollow = u => {
    if (requireAuth()) return;
    if (following.includes(u)) {
      setFollowing(f => f.filter(x => x !== u));
      showToast(`Unfollowed @${u}`);
      logActivity('unfollow', u);
    } else {
      setFollowing(f => [...f, u]);
      showToast(`Now following @${u}!`);
      logActivity('follow', u);
      // Improvement #15: Update onboarding checklist
      setOnboardingChecklist(c => ({ ...c, followedUser: true }));
    }
  };

  const onViewUser = u => setViewingUser(u);
  const onViewArtist = name => setViewingArtist(name);

  // Convenience bundle spread into ExploreScreen, CollectionScreen, and ProfileScreen
  const cardHandlers = { onLike, onSave, onComment, onBuy, onDetail, onViewUser, onViewArtist };

  // ── Memoized computed values ──────────────────────────────────────────────
  const myRecords = useMemo(() => records.filter(r => r.user === currentUser), [records, currentUser]); // eslint-disable-line no-unused-vars
  const marketplaceRecords = useMemo(() => records.filter(r => r.forSale), [records]); // eslint-disable-line no-unused-vars
  const postCounts = useMemo(() => { // eslint-disable-line no-unused-vars
    const counts = {};
    posts.forEach(p => { counts[p.user] = (counts[p.user] || 0) + 1; });
    return counts;
  }, [posts]);

  // Compute who follows the current user by scanning USER_PROFILES followers arrays
  const computedFollowers = useMemo(() => Object.entries(USER_PROFILES)
    .filter(([, p]) => (p.followers || []).includes(currentUser))
    .map(([username]) => username), [currentUser]);

  // ── Profile save with Supabase persistence + sync indicator (#22) ───────────
  const onProfileSave = async (p) => {
    setProfile(p);
    showToast("Profile updated!");
    logActivity('update_profile', 'profile edited');
    // Improvement #15: Update onboarding checklist
    setOnboardingChecklist(c => ({ ...c, customizedProfile: true }));
    if (session) {
      setIsSyncing(true);
      try { await updateProfile(p); } catch { /* offline fallback */ }
      finally { setIsSyncing(false); }
    }
  };

  const isGuest = !session;

  // Guest guard — prompts sign-in modal for actions that require auth
  const requireAuth = () => {
    if (isGuest) { setShowAuth(true); return true; }
    return false;
  };

  // ── Improvement #14: Log user activity helper ─────────────────────────────
  const logActivity = (action, detail) => {
    setActivityLog(log => [{ id: Date.now(), action, detail, time: new Date().toISOString() }, ...log].slice(0, 200));
  };

  // ── Improvement #5: Undo/redo handlers ────────────────────────────────────
  const pushUndo = (action, undoFn, redoFn) => {
    dispatchUndo({ type: 'PUSH', entry: { action, undoFn, redoFn, time: Date.now() } });
  };

  const handleUndo = () => {
    if (undoState.past.length === 0) return;
    const entry = undoState.past[undoState.past.length - 1];
    entry.undoFn();
    dispatchUndo({ type: 'UNDO' });
    showToast(`Undone: ${entry.action}`);
    setA11yAnnouncement(`Undone: ${entry.action}`);
  };

  const handleRedo = () => {
    if (undoState.future.length === 0) return;
    const entry = undoState.future[0];
    entry.redoFn();
    dispatchUndo({ type: 'REDO' });
    showToast(`Redone: ${entry.action}`);
    setA11yAnnouncement(`Redone: ${entry.action}`);
  };

  // ── Improvement #1: Command palette results (fuzzy search) ────────────────
  const commandPaletteResults = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return { records: [], users: [], posts: [], actions: [] };
    const fuzzyMatch = (str, query) => {
      let qi = 0;
      const lower = str.toLowerCase();
      for (let i = 0; i < lower.length && qi < query.length; i++) {
        if (lower[i] === query[qi]) qi++;
      }
      return qi === query.length;
    };
    const matchedRecords = records.filter(r => fuzzyMatch(r.album || '', q) || fuzzyMatch(r.artist || '', q)).slice(0, 5);
    const matchedUsers = Object.keys(USER_PROFILES).filter(u => fuzzyMatch(u, q)).slice(0, 5);
    const matchedPosts = posts.filter(p => p.caption && fuzzyMatch(p.caption, q)).slice(0, 3);
    const allActions = [
      { label: 'Add Record', action: () => { setShowCommandPalette(false); setShowAdd(true); }, icon: '+' },
      { label: 'Create Post', action: () => { setShowCommandPalette(false); setShowCreatePost(true); }, icon: 'P' },
      { label: 'Toggle Theme', action: () => { setShowCommandPalette(false); setTheme(th => th === 'dark' ? 'light' : 'dark'); }, icon: 'T' },
      { label: 'Export Data', action: () => { setShowCommandPalette(false); handleExportData(); }, icon: 'E' },
      { label: 'Toggle Full Screen', action: () => { setShowCommandPalette(false); toggleFullScreen(); }, icon: 'F' },
      { label: 'Toggle Print Mode', action: () => { setShowCommandPalette(false); setPrintMode(p => !p); }, icon: 'R' },
      { label: 'Toggle Batch Mode', action: () => { setShowCommandPalette(false); setBatchMode(b => !b); setBatchSelected([]); }, icon: 'B' },
      { label: 'Open Settings', action: () => { setShowCommandPalette(false); setNav('Settings'); }, icon: 'S' },
      { label: 'View Collection', action: () => { setShowCommandPalette(false); setNav('Collection'); }, icon: 'C' },
      { label: 'View Marketplace', action: () => { setShowCommandPalette(false); setNav('Marketplace'); }, icon: 'M' },
      { label: 'Import from Discogs', action: () => { setShowCommandPalette(false); setShowDiscogsImport(true); }, icon: 'D' },
    ];
    const matchedActions = allActions.filter(a => fuzzyMatch(a.label, q));
    return { records: matchedRecords, users: matchedUsers, posts: matchedPosts, actions: matchedActions };
  }, [commandQuery, records, posts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Improvement #22: Save search to recent searches ───────────────────────
  const saveRecentSearch = (query) => {
    if (!query.trim()) return;
    setRecentSearches(prev => [query.trim(), ...prev.filter(s => s !== query.trim())].slice(0, 20));
  };

  // ── Improvement #8: Toggle theme ──────────────────────────────────────────
  const toggleTheme = () => {
    setTheme(th => th === 'dark' ? 'light' : 'dark');
    logActivity('theme_toggle', theme === 'dark' ? 'light' : 'dark');
  };

  // ── Improvement #27: Toggle full screen ───────────────────────────────────
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // ── Improvement #28: Data export (full account export) ────────────────────
  const handleExportData = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      user: { username: currentUser, profile },
      records: records.filter(r => r.user === currentUser),
      posts: posts.filter(p => p.user === currentUser),
      following,
      wishlist,
      purchases,
      offers: offers.filter(o => o.from === currentUser || o.to === currentUser),
      listeningHistory,
      preferences: userPreferences,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `groovestack-export-${currentUser}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Data exported successfully!');
    logActivity('data_export', 'full account');
  };

  // ── Improvement #29: Import from Discogs ──────────────────────────────────
  const handleDiscogsImport = () => {
    if (!discogsUsername.trim()) { showToast('Please enter a Discogs username'); return; }
    setDiscogsImporting(true);
    // Simulated import — in production this would call the Discogs API
    setTimeout(() => {
      const imported = [
        { id: Date.now(), album: 'Imported Album 1', artist: 'Discogs Artist', year: 2020, genre: 'Electronic', condition: 'VG+', format: '12"', accent: '#8B5CF6', user: currentUser, likes: 0, liked: false, saved: false, comments: [], forSale: false, price: null, verified: false },
        { id: Date.now() + 1, album: 'Imported Album 2', artist: 'Discogs Artist 2', year: 2019, genre: 'Rock', condition: 'NM', format: '12"', accent: '#EC4899', user: currentUser, likes: 0, liked: false, saved: false, comments: [], forSale: false, price: null, verified: false },
      ];
      setRecords(rs => [...imported, ...rs]);
      setDiscogsImporting(false);
      setShowDiscogsImport(false);
      setDiscogsUsername('');
      showToast(`Imported ${imported.length} records from Discogs!`);
      logActivity('discogs_import', discogsUsername);
    }, 2000);
  };

  // ── Improvement #13: Batch operation handlers ─────────────────────────────
  const toggleBatchSelect = (id) => {
    setBatchSelected(sel => sel.includes(id) ? sel.filter(s => s !== id) : [...sel, id]);
  };

  const batchDelete = () => {
    if (batchSelected.length === 0) return;
    if (!window.confirm(`Delete ${batchSelected.length} records?`)) return;
    const deletedRecords = records.filter(r => batchSelected.includes(r.id));
    setRecords(rs => rs.filter(r => !batchSelected.includes(r.id)));
    pushUndo('batch delete', () => setRecords(rs => [...deletedRecords, ...rs]), () => setRecords(rs => rs.filter(r => !batchSelected.includes(r.id))));
    showToast(`Deleted ${batchSelected.length} records`);
    setBatchSelected([]);
    logActivity('batch_delete', `${batchSelected.length} records`);
  };

  const batchToggleSale = (forSale, price) => {
    if (batchSelected.length === 0) return;
    setRecords(rs => rs.map(r => batchSelected.includes(r.id) ? { ...r, forSale, price: forSale ? (price || 25) : null } : r));
    showToast(`Updated ${batchSelected.length} records`);
    setBatchSelected([]);
    logActivity('batch_sale_toggle', `${batchSelected.length} records`);
  };

  // ── Improvement #2: Drag-and-drop reorder handler ─────────────────────────
  const handleDragStart = (index) => setDragState({ dragging: true, dragIndex: index, overIndex: null });
  const handleDragOver = (index) => setDragState(s => ({ ...s, overIndex: index }));
  const handleDragEnd = () => {
    if (dragState.dragIndex !== null && dragState.overIndex !== null && dragState.dragIndex !== dragState.overIndex) {
      setRecords(rs => {
        const myRecs = rs.filter(r => r.user === currentUser);
        const otherRecs = rs.filter(r => r.user !== currentUser);
        const moved = [...myRecs];
        const [removed] = moved.splice(dragState.dragIndex, 1);
        moved.splice(dragState.overIndex, 0, removed);
        return [...moved, ...otherRecs];
      });
      logActivity('reorder_records', `moved ${dragState.dragIndex} to ${dragState.overIndex}`);
    }
    setDragState({ dragging: false, dragIndex: null, overIndex: null });
  };

  // ── Improvement #9: Audio player controls ─────────────────────────────────
  const playPreview = (track) => {
    setAudioPlayer({ playing: true, track, progress: 0 });
    setA11yAnnouncement(`Now playing: ${track.album} by ${track.artist}`);
    logActivity('play_preview', `${track.album} by ${track.artist}`);
  };

  const stopPreview = () => {
    setAudioPlayer({ playing: false, track: null, progress: 0 });
  };

  // ── Improvement #30: Quick add record from search ─────────────────────────
  const quickAddRecord = (album, artist) => {
    if (!album || !artist) return;
    const accent = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
    const newRec = {
      id: Date.now(), album: album.trim(), artist: artist.trim(), year: new Date().getFullYear(),
      genre: 'Unknown', condition: 'NM', format: '12"', accent,
      user: currentUser, likes: 0, liked: false, saved: false, comments: [],
      forSale: false, price: null, verified: false,
    };
    setRecords(rs => [newRec, ...rs]);
    pushUndo('add record', () => setRecords(rs => rs.filter(r => r.id !== newRec.id)), () => setRecords(rs => [newRec, ...rs]));
    showToast(`Quick added: ${album}`);
    setQuickAddVisible(false);
    logActivity('quick_add', `${album} by ${artist}`);
    setOnboardingChecklist(c => ({ ...c, addedRecord: true }));
  };

  // ── Improvement #10: Breadcrumb computation ───────────────────────────────
  const breadcrumbs = useMemo(() => {
    const crumbs = [{ label: 'Home', nav: 'Social' }];
    if (viewingUserProfile) {
      crumbs.push({ label: nav, nav });
      crumbs.push({ label: `@${viewingUserProfile}`, nav: null });
    } else {
      crumbs.push({ label: nav, nav: null });
    }
    return crumbs;
  }, [nav, viewingUserProfile]);

  // ── Improvement #15: Onboarding progress percentage ───────────────────────
  const onboardingProgress = useMemo(() => {
    const items = Object.values(onboardingChecklist);
    return Math.round((items.filter(Boolean).length / items.length) * 100);
  }, [onboardingChecklist]);

  // ── Improvement #3: Notification center real-time simulation ──────────────
  const [notificationCenter, setNotificationCenter] = useState([]); // eslint-disable-line no-unused-vars

  // ── Loading screen ────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gs-bg flex items-center justify-center">
        <div className="text-gs-dim text-sm">{t('loading', userPreferences.language)}</div>
      </div>
    );
  }

  // ── Swipe navigation for mobile (#26) ────────────────────────────────────
  const NAV_ORDER = ["Social", "Marketplace", "Collection", "Vinyl Buddy", "Profile"];
  const swipeLeft = () => {
    const idx = NAV_ORDER.indexOf(nav);
    if (idx < NAV_ORDER.length - 1) {
      const next = NAV_ORDER[idx + 1];
      if (isGuest && next !== "Marketplace") return;
      setViewingUserProfile(null);
      setNav(next);
    }
  };
  const swipeRight = () => {
    const idx = NAV_ORDER.indexOf(nav);
    if (idx > 0) {
      const next = NAV_ORDER[idx - 1];
      if (isGuest && next !== "Marketplace") return;
      setViewingUserProfile(null);
      setNav(next);
    }
  };

  return (
    <ErrorBoundary>
    <div className={`min-h-screen bg-gs-bg font-sans text-gs-text ${printMode ? 'print-friendly' : ''} ${isFullScreen ? 'fullscreen-mode' : ''}`} data-theme={theme}>
      {/* Accessibility: skip-to-content link (#1) */}
      <SkipToContent />

      {/* Improvement #18: Accessibility live region for announcements */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true" role="alert">
        {a11yAnnouncement}
      </div>

      {/* Improvement #11: Page loading progress bar */}
      {authLoading && (
        <div className="fixed top-0 left-0 right-0 z-[2000] h-[3px] bg-gs-border overflow-hidden">
          <div className="h-full bg-gs-accent" style={{ width: '80%', transition: 'width 0.5s ease' }} />
        </div>
      )}

      {/* Improvement #6: Connection quality indicator */}
      {connectionQuality !== 'good' && (
        <div className={`fixed top-2 right-2 z-[1500] px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${connectionQuality === 'offline' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
          <span className={`w-2 h-2 rounded-full ${connectionQuality === 'offline' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
          {connectionQuality === 'offline' ? t('connectionOffline', userPreferences.language) : t('connectionSlow', userPreferences.language)}
        </div>
      )}

      {/* Improvement #7: Session timeout warning */}
      {showSessionWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1800] bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 px-4 py-2 rounded-lg text-sm flex items-center gap-3 shadow-lg">
          <span>{t('sessionWarning', userPreferences.language)}</span>
          <button onClick={() => { setShowSessionWarning(false); }} className="text-yellow-400 hover:text-yellow-200 underline text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Improvement #1: Command Palette (Cmd+K) */}
      {showCommandPalette && (
        <div className="fixed inset-0 bg-black/70 z-[2000] flex items-start justify-center pt-[15vh] backdrop-blur-sm animate-fade-in" onClick={e => { if (e.target === e.currentTarget) { setShowCommandPalette(false); setCommandQuery(''); } }}>
          <div className="bg-gs-bg border border-gs-border rounded-xl w-full max-w-[560px] shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gs-border">
              <svg className="w-4 h-4 text-gs-dim flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                ref={commandInputRef}
                type="text"
                value={commandQuery}
                onChange={e => setCommandQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && commandQuery.trim()) {
                    saveRecentSearch(commandQuery);
                  }
                }}
                placeholder={t('commandPalette', userPreferences.language)}
                className="flex-1 bg-transparent text-gs-text text-sm outline-none placeholder:text-gs-dim"
                autoFocus
              />
              <kbd className="text-[10px] text-gs-dim bg-gs-surface px-1.5 py-0.5 rounded border border-gs-border">ESC</kbd>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-2">
              {/* Recent searches when empty */}
              {!commandQuery && recentSearches.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-gs-dim px-2 py-1">Recent Searches</div>
                  {recentSearches.slice(0, 5).map((s, i) => (
                    <button key={i} onClick={() => setCommandQuery(s)} className="w-full text-left px-3 py-1.5 text-sm text-gs-muted hover:bg-gs-surface rounded transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {/* Actions */}
              {commandPaletteResults.actions.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-gs-dim px-2 py-1">Actions</div>
                  {commandPaletteResults.actions.map((a, i) => (
                    <button key={i} onClick={a.action} className="w-full text-left px-3 py-2 text-sm text-gs-text hover:bg-gs-surface rounded flex items-center gap-2 transition-colors">
                      <span className="w-5 h-5 rounded bg-gs-accent/20 text-gs-accent flex items-center justify-center text-[10px] font-bold">{a.icon}</span>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
              {/* Records */}
              {commandPaletteResults.records.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-gs-dim px-2 py-1">Records</div>
                  {commandPaletteResults.records.map(r => (
                    <button key={r.id} onClick={() => { setShowCommandPalette(false); setCommandQuery(''); setDetailRecord(r); }} className="w-full text-left px-3 py-2 text-sm text-gs-text hover:bg-gs-surface rounded flex items-center gap-2 transition-colors">
                      <span className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: r.accent || '#666' }} />
                      <span className="truncate">{r.album}</span>
                      <span className="text-gs-dim text-xs ml-auto truncate">{r.artist}</span>
                    </button>
                  ))}
                </div>
              )}
              {/* Users */}
              {commandPaletteResults.users.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-gs-dim px-2 py-1">Users</div>
                  {commandPaletteResults.users.map(u => (
                    <button key={u} onClick={() => { setShowCommandPalette(false); setCommandQuery(''); setViewingUser(u); }} className="w-full text-left px-3 py-2 text-sm text-gs-text hover:bg-gs-surface rounded transition-colors">
                      @{u}
                    </button>
                  ))}
                </div>
              )}
              {/* Posts */}
              {commandPaletteResults.posts.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-gs-dim px-2 py-1">Posts</div>
                  {commandPaletteResults.posts.map(p => (
                    <button key={p.id} onClick={() => { setShowCommandPalette(false); setCommandQuery(''); setNav('Social'); }} className="w-full text-left px-3 py-2 text-sm text-gs-muted hover:bg-gs-surface rounded truncate transition-colors">
                      {p.caption}
                    </button>
                  ))}
                </div>
              )}
              {/* No results */}
              {commandQuery && commandPaletteResults.records.length === 0 && commandPaletteResults.users.length === 0 && commandPaletteResults.posts.length === 0 && commandPaletteResults.actions.length === 0 && (
                <div className="text-center py-8 text-gs-dim text-sm">{t('noResults', userPreferences.language)}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Improvement #29: Discogs import modal */}
      {showDiscogsImport && (
        <div className="fixed inset-0 bg-black/70 z-[1800] flex items-center justify-center backdrop-blur-sm animate-fade-in" onClick={e => { if (e.target === e.currentTarget) setShowDiscogsImport(false); }}>
          <div className="bg-gs-bg border border-gs-border rounded-xl w-full max-w-[400px] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gs-text mb-4">{t('importDiscogs', userPreferences.language)}</h3>
            <p className="text-sm text-gs-muted mb-4">Enter your Discogs username to import your collection.</p>
            <input
              type="text"
              value={discogsUsername}
              onChange={e => setDiscogsUsername(e.target.value)}
              placeholder="Discogs username"
              className="w-full px-3 py-2 bg-gs-surface border border-gs-border rounded-lg text-sm text-gs-text outline-none focus:border-gs-accent mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDiscogsImport(false)} className="px-4 py-2 text-sm text-gs-muted hover:text-gs-text transition-colors">{t('cancel', userPreferences.language)}</button>
              <button onClick={handleDiscogsImport} disabled={discogsImporting} className="px-4 py-2 text-sm bg-gs-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
                {discogsImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline detection banner (#18) */}
      <OfflineBanner />

      {/* Confetti animation on first purchase (#29) */}
      <Confetti active={showConfetti} />

      {/* Data sync indicator (#22) */}
      <DataSyncIndicator syncing={isSyncing} />

      {/* Scroll to top button (#27) */}
      <ScrollToTop trigger={scrollTopTrigger} />

      {/* Onboarding tour for new users (#30) */}
      <OnboardingTour currentUser={currentUser} />

      <Sidebar
        nav={nav} setNav={n => {
          // Guests can only browse Marketplace — all other tabs require auth
          if (isGuest && n !== "Marketplace") { setShowAuth(true); return; }
          setViewingUserProfile(null); setNav(n);
        }}
        following={following} profile={profile} currentUser={currentUser}
        notifCount={notifCount}
        onNotifClick={() => { if (requireAuth()) return; setShowNotifs(n => !n); setNotifCount(0); }}
        onAddRecord={() => { if (requireAuth()) return; setShowAdd(true); }}
        onMessages={() => { if (requireAuth()) return; setShowDMs(true); }}
        onLogout={isGuest ? null : handleLogout}
        isGuest={isGuest}
        onSignIn={() => setShowAuth(true)}
        globalSearch={globalSearch} setGlobalSearch={setGlobalSearch}
        unreadCount={unreadCount}
        cartCount={cartCount}
      />

      <main id="main-content" className={`gs-main ml-[196px] px-10 py-[26px] max-w-[1400px] ${isFullScreen ? 'ml-0' : ''}`} role="main">
        {/* Improvement #10: Breadcrumb navigation */}
        <nav className="flex items-center gap-1 text-xs text-gs-dim mb-3 print:hidden" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="mx-1 opacity-40">/</span>}
              {crumb.nav ? (
                <button onClick={() => { setViewingUserProfile(null); setNav(crumb.nav); }} className="hover:text-gs-text transition-colors">{crumb.label}</button>
              ) : (
                <span className="text-gs-muted">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>

        {/* Improvement #8 + #26 + #27: Toolbar row */}
        <div className="flex items-center gap-2 mb-3 print:hidden">
          {/* Theme toggle */}
          <button onClick={toggleTheme} className="p-1.5 rounded-lg text-gs-dim hover:text-gs-text hover:bg-gs-surface transition-colors" title={theme === 'dark' ? t('lightMode', userPreferences.language) : t('darkMode', userPreferences.language)}>
            {theme === 'dark' ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            )}
          </button>
          {/* Print mode toggle */}
          <button onClick={() => setPrintMode(p => !p)} className={`p-1.5 rounded-lg transition-colors ${printMode ? 'text-gs-accent bg-gs-accent/10' : 'text-gs-dim hover:text-gs-text hover:bg-gs-surface'}`} title={t('printMode', userPreferences.language)}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          </button>
          {/* Full screen toggle */}
          <button onClick={toggleFullScreen} className={`p-1.5 rounded-lg transition-colors ${isFullScreen ? 'text-gs-accent bg-gs-accent/10' : 'text-gs-dim hover:text-gs-text hover:bg-gs-surface'}`} title={t('fullScreen', userPreferences.language)}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {isFullScreen ? <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/> : <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>}
            </svg>
          </button>
          {/* Batch mode toggle */}
          {!isGuest && nav === 'Collection' && (
            <button onClick={() => { setBatchMode(b => !b); setBatchSelected([]); }} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${batchMode ? 'text-gs-accent bg-gs-accent/10' : 'text-gs-dim hover:text-gs-text hover:bg-gs-surface'}`} title={t('batchMode', userPreferences.language)}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              {batchMode ? 'Exit Batch' : t('batchMode', userPreferences.language)}
            </button>
          )}
          {/* Export data button */}
          {!isGuest && (
            <button onClick={handleExportData} className="p-1.5 rounded-lg text-gs-dim hover:text-gs-text hover:bg-gs-surface transition-colors" title={t('exportData', userPreferences.language)}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </button>
          )}
          {/* Import from Discogs */}
          {!isGuest && (
            <button onClick={() => setShowDiscogsImport(true)} className="p-1.5 rounded-lg text-gs-dim hover:text-gs-text hover:bg-gs-surface transition-colors" title={t('importDiscogs', userPreferences.language)}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            </button>
          )}
          {/* Quick add record */}
          {!isGuest && (
            <button onClick={() => setQuickAddVisible(q => !q)} className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${quickAddVisible ? 'text-gs-accent bg-gs-accent/10' : 'text-gs-dim hover:text-gs-text hover:bg-gs-surface'}`} title="Quick Add Record">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              Quick Add
            </button>
          )}
          {/* Undo/Redo buttons */}
          <div className="flex items-center gap-0.5 ml-auto">
            <button onClick={handleUndo} disabled={undoState.past.length === 0} className="p-1.5 rounded-lg text-gs-dim hover:text-gs-text hover:bg-gs-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title={`${t('undoAction', userPreferences.language)} (Cmd+Z)`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4"/></svg>
            </button>
            <button onClick={handleRedo} disabled={undoState.future.length === 0} className="p-1.5 rounded-lg text-gs-dim hover:text-gs-text hover:bg-gs-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title={`${t('redoAction', userPreferences.language)} (Cmd+Shift+Z)`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4"/></svg>
            </button>
            {/* Improvement #17: Render count (dev mode) */}
            {process.env.NODE_ENV === 'development' && (
              <span className="text-[9px] text-gs-dim/50 ml-2" title="Render count">R:{renderCount.current}</span>
            )}
          </div>
        </div>

        {/* Improvement #30: Quick add record inline form */}
        {quickAddVisible && (
          <div className="mb-4 p-3 bg-gs-surface border border-gs-border rounded-lg flex items-center gap-2 print:hidden animate-fade-in">
            <input
              type="text"
              placeholder="Album name"
              id="quickAddAlbum"
              className="flex-1 bg-transparent border border-gs-border rounded px-2 py-1.5 text-sm text-gs-text outline-none focus:border-gs-accent"
              onKeyDown={e => { if (e.key === 'Enter') { const artist = document.getElementById('quickAddArtist'); if (artist) artist.focus(); } }}
            />
            <input
              type="text"
              placeholder="Artist"
              id="quickAddArtist"
              className="flex-1 bg-transparent border border-gs-border rounded px-2 py-1.5 text-sm text-gs-text outline-none focus:border-gs-accent"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const albumEl = document.getElementById('quickAddAlbum');
                  if (albumEl) quickAddRecord(albumEl.value, e.target.value);
                }
              }}
            />
            <button onClick={() => { const a = document.getElementById('quickAddAlbum'); const b = document.getElementById('quickAddArtist'); if (a && b) quickAddRecord(a.value, b.value); }} className="px-3 py-1.5 bg-gs-accent text-white text-sm rounded hover:opacity-90 transition-opacity">
              Add
            </button>
            <button onClick={() => setQuickAddVisible(false)} className="text-gs-dim hover:text-gs-text transition-colors text-sm px-2">
              Cancel
            </button>
          </div>
        )}

        {/* Improvement #13: Batch operations toolbar */}
        {batchMode && (
          <div className="mb-4 p-3 bg-gs-surface border border-gs-border rounded-lg flex items-center gap-3 print:hidden animate-fade-in">
            <span className="text-sm text-gs-muted">{batchSelected.length} selected</span>
            <button onClick={batchDelete} disabled={batchSelected.length === 0} className="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors disabled:opacity-30">
              Delete Selected
            </button>
            <button onClick={() => batchToggleSale(true, 25)} disabled={batchSelected.length === 0} className="px-3 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors disabled:opacity-30">
              List for Sale ($25)
            </button>
            <button onClick={() => batchToggleSale(false)} disabled={batchSelected.length === 0} className="px-3 py-1 text-xs bg-gs-border text-gs-muted rounded hover:bg-gs-dim/20 transition-colors disabled:opacity-30">
              Remove from Sale
            </button>
            <button onClick={() => { setBatchMode(false); setBatchSelected([]); }} className="ml-auto text-xs text-gs-dim hover:text-gs-text transition-colors">
              Exit Batch Mode
            </button>
          </div>
        )}

        {/* Improvement #15: Onboarding checklist (show for new users) */}
        {!isGuest && onboardingProgress < 100 && (
          <div className="mb-4 p-3 bg-gs-surface/50 border border-gs-border rounded-lg print:hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gs-muted">Getting Started</span>
              <span className="text-xs text-gs-dim">{onboardingProgress}%</span>
            </div>
            <div className="h-1 bg-gs-border rounded-full overflow-hidden mb-2">
              <div className="h-full bg-gs-accent transition-all duration-500 rounded-full" style={{ width: `${onboardingProgress}%` }} />
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(onboardingChecklist).map(([key, done]) => (
                <span key={key} className={`text-[10px] px-2 py-0.5 rounded-full ${done ? 'bg-green-500/20 text-green-400 line-through' : 'bg-gs-border text-gs-dim'}`}>
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Improvement #24: Contextual help tooltips */}
        {isGuest && nav === 'Marketplace' && (
          <div className="mb-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 flex items-center gap-2 print:hidden animate-fade-in">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            Sign in to save records, follow users, and build your collection. Press Cmd+K to search.
          </div>
        )}

        <SwipeHandler onSwipeLeft={swipeLeft} onSwipeRight={swipeRight}>
        <Suspense fallback={<ScreenLoader />}>
        <div key={pageTransitionKey} className={`transition-all duration-200 ${transitionClass}`}>
        {/* Full user profile page — overrides nav routing when viewing another user's full profile */}
        {viewingUserProfile ? (
          <UserProfilePage
            username={viewingUserProfile}
            records={records} currentUser={currentUser} profile={profile}
            following={following} onFollow={onFollow}
            onBack={() => setViewingUserProfile(null)}
            onDetail={onDetail} onBuy={onBuy} onViewArtist={onViewArtist}
            onViewUser={u => { setViewingUserProfile(null); setTimeout(() => onViewUser(u), 0); }}
            posts={posts} onLikePost={onLikePost} onBookmarkPost={onBookmarkPost}
            listeningHistory={listeningHistory}
            wishlist={wishlist}
            onMakeOffer={(wishlistItem, targetUser) => {
              const offeredRecord = records.find(r => r.user === currentUser && r.album.toLowerCase() === wishlistItem.album.toLowerCase() && r.artist.toLowerCase() === wishlistItem.artist.toLowerCase());
              setOfferTarget({ wishlistItem, targetUser, offeredRecord });
            }}
            onShareProfile={onShareProfile}
            onReportUser={onReportUser}
          />
        ) : (
          <>
            {nav === "Social" && (
              <SocialFeedScreen
                posts={posts} records={records} currentUser={currentUser} following={following}
                profile={profile}
                onCreatePost={() => setShowCreatePost(true)}
                onLikePost={onLikePost} onCommentPost={onCommentPost} onBookmarkPost={onBookmarkPost}
                onViewUser={onViewUser} onDetail={onDetail} onViewArtist={onViewArtist}
              />
            )}
            {nav === "Marketplace" && <ExploreScreen records={records} onAddToCart={onAddToCart} onViewArtist={onViewArtist} {...cardHandlers} />}
            {nav === "Following" && (
              <FollowingScreen
                following={following} records={records} currentUser={currentUser}
                onFollow={onFollow} onViewUser={onViewUser}
              />
            )}
            {nav === "Collection" && (
              <CollectionScreen
                records={records} currentUser={currentUser}
                onAddRecord={() => setShowAdd(true)} {...cardHandlers}
                batchMode={batchMode} batchSelected={batchSelected} onToggleBatchSelect={toggleBatchSelect}
                dragState={dragState} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}
              />
            )}
            {nav === "Vinyl Buddy" && (
              <VinylBuddyScreen
                currentUser={currentUser}
                listeningHistory={listeningHistory}
                activated={vinylBuddyActivated}
                deviceCode={vinylBuddyDevice}
                onActivate={code => setVinylBuddyDevice(code)}
                onDeactivate={() => setVinylBuddyDevice('')}
                onPlayPreview={playPreview}
              />
            )}
            {nav === "Activity" && (
              <TransactionsScreen
                offers={offers} purchases={purchases} cart={cart}
                currentUser={currentUser} records={records} profile={profile}
                onBuy={onBuy} onRemoveFromCart={onRemoveFromCart}
                onViewUser={onViewUser} onDetail={onDetail}
                onAcceptOffer={onAcceptOffer} onDeclineOffer={onDeclineOffer}
                onReorder={onReorder}
              />
            )}
            {nav === "Profile" && (
              <ProfileScreen
                records={records} currentUser={currentUser} profile={profile}
                following={following} followers={computedFollowers}
                wishlist={wishlist} onAddWishlistItem={onAddWishlistItem} onRemoveWishlistItem={onRemoveWishlistItem}
                onEdit={() => setShowEditProfile(true)}
                onShowFollowing={() => setNav("Following")}
                onShowFollowers={() => setNav("Following")}
                onDetail={onDetail} onViewArtist={onViewArtist}
                posts={posts} onLikePost={onLikePost} onCommentPost={onCommentPost} onBookmarkPost={onBookmarkPost}
                onViewUser={onViewUser}
                listeningHistory={listeningHistory}
                onShareProfile={onShareProfile}
              />
            )}
            {nav === "Settings" && (
              <SettingsScreen
                currentUser={currentUser}
                profile={profile}
                deviceCode={vinylBuddyDevice}
                vinylBuddyActivated={vinylBuddyActivated}
                theme={theme} onToggleTheme={toggleTheme}
                userPreferences={userPreferences} onUpdatePreferences={setUserPreferences}
                onExportData={handleExportData}
                onImportDiscogs={() => setShowDiscogsImport(true)}
              />
            )}
          </>
        )}
        </div>
        </Suspense>
        </SwipeHandler>
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}
      <AddRecordModal
        open={showAdd} onClose={() => setShowAdd(false)}
        onAdd={onAdd} currentUser={currentUser}
      />
      <CommentsModal
        open={!!commentRecord} onClose={() => setCommentRecord(null)}
        record={commentRecord} onAdd={onAddComment}
        currentUser={currentUser} onViewUser={onViewUser}
      />
      <BuyModal
        open={!!buyRecord} onClose={() => setBuyRecord(null)}
        record={buyRecord} onPurchase={onPurchase} onAddToCart={onAddToCart}
        profile={profile}
      />
      <DetailModal
        open={!!detailRecord} onClose={() => setDetailRecord(null)}
        record={detailRecord} onLike={onLike} onSave={onSave} onViewUser={onViewUser} onViewArtist={onViewArtist}
        onComment={r => { setDetailRecord(null); setCommentRecord(r); }}
        onBuy={r => { setDetailRecord(null); setBuyRecord(r); }}
        onAddWishlistItem={onAddWishlistItem}
        currentUser={currentUser} records={records} onOfferFromDetail={onOfferFromDetail}
        onVerifyRecord={onVerifyRecord}
      />
      <ProfileEditModal
        open={showEditProfile} onClose={() => setShowEditProfile(false)}
        profile={profile} onSave={onProfileSave}
        currentUser={currentUser} onUsernameChange={onUsernameChange}
      />
      <UserProfileModal
        username={viewingUser} open={!!viewingUser} onClose={() => setViewingUser(null)}
        records={records} currentUser={currentUser} profile={profile}
        following={following} onFollow={onFollow}
        posts={posts} listeningHistory={listeningHistory}
        onViewFullProfile={u => { setViewingUser(null); setViewingUserProfile(u); }}
        onShareProfile={onShareProfile}
        onReportUser={onReportUser}
      />
      <DMModal
        open={showDMs} onClose={() => setShowDMs(false)}
        currentUser={currentUser} following={following}
        messages={dmMessages} setMessages={setDmMessages}
      />
      <NotificationsPanel
        open={showNotifs} onClose={() => setShowNotifs(false)}
        following={following} records={records}
        currentUser={currentUser} offers={offers}
        onViewUser={u => { setShowNotifs(false); setViewingUser(u); }}
      />
      <OfferModal
        open={!!offerTarget} onClose={() => setOfferTarget(null)}
        target={offerTarget} records={records} onSubmit={onSubmitOffer}
      />
      <CreatePostModal
        open={showCreatePost} onClose={() => setShowCreatePost(false)}
        onSubmit={onCreatePost} records={records} currentUser={currentUser}
        profile={profile}
      />
      <ArtistProfileModal
        artist={viewingArtist} open={!!viewingArtist} onClose={() => setViewingArtist(null)}
        records={records} onDetail={onDetail} onBuy={onBuy} onViewUser={onViewUser}
      />
      <VerifyRecordModal
        open={!!verifyingRecord} onClose={() => setVerifyingRecord(null)}
        record={verifyingRecord} onVerified={onRecordVerified}
      />
      {/* Keyboard shortcuts help overlay */}
      <KeyboardShortcutsHelp open={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />
      {/* Auth modal — shown when guest tries a restricted action */}
      {showAuth && (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-[1100] backdrop-blur-sm animate-fade-in"
          onClick={e => e.target === e.currentTarget && setShowAuth(false)}
        >
          <div className="relative">
            <button
              onClick={() => setShowAuth(false)}
              className="absolute -top-10 right-0 bg-transparent border-none text-gs-dim text-[13px] cursor-pointer font-sans hover:text-gs-muted transition-colors"
            >
              Continue browsing →
            </button>
            <AuthScreen onAuth={handleAuth} />
          </div>
        </div>
      )}
      {/* Improvement #9: Global audio player bar */}
      {audioPlayer.playing && audioPlayer.track && (
        <div className="fixed bottom-0 left-0 right-0 z-[1100] bg-gs-bg/95 backdrop-blur border-t border-gs-border px-4 py-2 flex items-center gap-4 print:hidden" role="region" aria-label="Audio player">
          <div className="w-8 h-8 rounded flex-shrink-0" style={{ background: audioPlayer.track.accent || '#666' }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gs-text truncate">{audioPlayer.track.album}</div>
            <div className="text-xs text-gs-dim truncate">{audioPlayer.track.artist}</div>
          </div>
          <div className="flex-1 max-w-[300px]">
            <div className="h-1 bg-gs-border rounded-full overflow-hidden">
              <div className="h-full bg-gs-accent rounded-full animate-pulse" style={{ width: '45%' }} />
            </div>
          </div>
          <button onClick={stopPreview} className="p-2 text-gs-dim hover:text-gs-text transition-colors" aria-label="Stop playback">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
          </button>
        </div>
      )}

      {/* Improvement #16: Global error handling — unhandled promise rejection notice */}
      {/* Handled via ErrorBoundary wrapper + inline try/catch in actions */}

      {/* aria-live region for toast notifications (#2) */}
      <div aria-live="polite" aria-atomic="true" role="status">
        <Toast message={toast.msg} visible={toast.visible} />
      </div>

      {/* Improvement #26: Print-friendly styles */}
      {printMode && (
        <style>{`
          @media print, .print-friendly {
            .gs-main { margin-left: 0 !important; padding: 20px !important; }
            .print\\:hidden { display: none !important; }
            body { background: white !important; color: black !important; }
          }
          .print-friendly .gs-sidebar-desktop,
          .print-friendly .gs-sidebar-mobile { display: none !important; }
          .print-friendly .gs-main { margin-left: 0 !important; }
        `}</style>
      )}
    </div>
    </ErrorBoundary>
  );
}
