// Root component — owns all shared state and passes it down to screens and modals.
// All record mutations, follow/unfollow, and user actions are handled here and passed as callbacks.
// State is persisted to localStorage on every change (currentUser, records, following, profile, dmMessages).
// Navigation state (nav) determines which screen is rendered in the main content area.
// Auth is managed via Supabase — shows AuthScreen when no session is active.
import { useState, useEffect, useCallback } from 'react';
import INITIAL_RECORDS from './constants/records';
import INITIAL_POSTS from './constants/posts';
import INITIAL_LISTENING from './constants/listening';
import { USER_PROFILES, ACCENT_COLORS } from './constants';
import { getToken, getMe, signOut, updateProfile, updateUsername as apiUpdateUsername } from './utils/supabase';
import { API_BASE } from './utils/api';

// Layout
import Sidebar from './components/Sidebar';
import AuthScreen from './components/AuthScreen';

// Screens
import SocialFeedScreen from './components/screens/SocialFeedScreen';
import ExploreScreen from './components/screens/ExploreScreen';
import CollectionScreen from './components/screens/CollectionScreen';
import ProfileScreen from './components/screens/ProfileScreen';
import FollowingScreen from './components/screens/FollowingScreen';
import TransactionsScreen from './components/screens/TransactionsScreen';
import VinylBuddyScreen from './components/screens/VinylBuddyScreen';
import UserProfilePage from './components/screens/UserProfilePage';

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
  const [toast, setToast] = useState({ visible: false, msg: "" });

  // Shows the Toast bar and auto-hides it after 2.2 seconds
  const showToast = msg => {
    setToast({ visible: true, msg });
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
  };

  // Opens OfferModal from the "Wanted By" section in DetailModal
  const onOfferFromDetail = (record, targetUser, wishlistItem) => {
    setDetailRecord(null);
    setOfferTarget({ wishlistItem, targetUser, offeredRecord: record });
  };

  // ── Record actions — passed to screens and modals as callbacks ───────────────
  const onLike = id => { if (requireAuth()) return; updateRecord(id, r => ({ ...r, liked: !r.liked, likes: r.liked ? r.likes - 1 : r.likes + 1 })); };

  const onSave = id => {
    if (requireAuth()) return;
    const r = records.find(r => r.id === id);
    updateRecord(id, r => ({ ...r, saved: !r.saved }));
    showToast(r?.saved ? "Removed from saved" : "Saved!");
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
    if (r) {
      setPurchases(ps => [{ id: Date.now(), recordId: r.id, album: r.album, artist: r.artist, price: r.price, condition: r.condition, accent: r.accent, format: r.format, year: r.year, seller: r.user, time: new Date().toLocaleString() }, ...ps]);
    }
    updateRecord(id, r => ({ ...r, forSale: false, price: null }));
    setCart(c => c.filter(item => item.recordId !== id));
    showToast("Purchase complete!");
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
    } else {
      setFollowing(f => [...f, u]);
      showToast(`Now following @${u}!`);
    }
  };

  const onViewUser = u => setViewingUser(u);
  const onViewArtist = name => setViewingArtist(name);

  // Convenience bundle spread into ExploreScreen, CollectionScreen, and ProfileScreen
  const cardHandlers = { onLike, onSave, onComment, onBuy, onDetail, onViewUser, onViewArtist };

  // Compute who follows the current user by scanning USER_PROFILES followers arrays
  const computedFollowers = Object.entries(USER_PROFILES)
    .filter(([, p]) => (p.followers || []).includes(currentUser))
    .map(([username]) => username);

  // ── Profile save with Supabase persistence ──────────────────────────────────
  const onProfileSave = async (p) => {
    setProfile(p);
    showToast("Profile updated!");
    if (session) {
      try { await updateProfile(p); } catch { /* offline fallback */ }
    }
  };

  const isGuest = !session;

  // Guest guard — prompts sign-in modal for actions that require auth
  const requireAuth = (action) => {
    if (isGuest) { setShowAuth(true); return true; }
    return false;
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gs-bg flex items-center justify-center">
        <div className="text-gs-dim text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gs-bg font-sans text-gs-text">

      <Sidebar
        nav={nav} setNav={n => {
          // Guest can browse Marketplace and Collection, but other tabs require auth
          if (isGuest && !["Marketplace", "Collection"].includes(n)) { setShowAuth(true); return; }
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
      />

      <main className="gs-main ml-[196px] px-10 py-[26px] max-w-[1400px]">
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
              />
            )}
            {nav === "Activity" && (
              <TransactionsScreen
                offers={offers} purchases={purchases} cart={cart}
                currentUser={currentUser} records={records}
                onBuy={onBuy} onRemoveFromCart={onRemoveFromCart}
                onViewUser={onViewUser} onDetail={onDetail}
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
              />
            )}
          </>
        )}
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
      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
}
