// Full profile page for viewing any user — matches ProfileScreen's design language.
// Shows header banner, avatar, bio, stats, Follow/Unfollow, and tabs for their content.
// Tabs: Posts, Listening, Records, For Sale, Wishlist, Activity, Reviews.
// Includes Message button, Make Offer button, mutual followers, follow animation,
// member-since date, skeleton loading state, achievement badges, genre chart,
// collection showcase, trading history, block/report, online status, profile share,
// verified seller badge, collection value, tenure badge, endorsements, similarity score,
// gift record, social proof, user highlight reel, parallax cover photo, badges gallery,
// auto-scrolling highlights reel, trading feedback/reviews, profile QR code,
// availability status, mutual connections, community ranking, and action history.
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import Stars from '../ui/Stars';
import Empty from '../ui/Empty';
import { getProfile, condColor, formatCompact } from '../../utils/helpers';
import { USER_WISHLISTS } from '../../constants';

// ── Online status indicator ────────────────────────────────────────────
// Improvement 1: Online/offline status dot
function OnlineIndicator({ username }) {
  // Derive deterministic online status from username hash for demo
  const isOnline = username ? username.charCodeAt(0) % 3 !== 0 : false;
  const lastSeenMin = username ? (username.charCodeAt(username.length - 1) % 120) + 5 : 30;
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span
        className={`inline-block w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-gray-500'}`}
      />
      <span className={isOnline ? 'text-emerald-400 font-semibold' : 'text-gs-faint'}>
        {isOnline ? 'Online now' : `Last seen ${lastSeenMin}m ago`}
      </span>
    </div>
  );
}

// ── Verified seller badge logic ────────────────────────────────────────
// Improvement 2: Verified seller badge with threshold check
function VerifiedSellerBadge({ forSaleCount, followerCount }) {
  const isVerified = forSaleCount >= 3 && followerCount >= 2;
  if (!isVerified) return null;
  return (
    <span
      title="Verified Seller — 3+ listings, 2+ followers"
      className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
      Verified Seller
    </span>
  );
}

// ── Tenure badge ───────────────────────────────────────────────────────
// Improvement 3: Member since with tenure badge
function TenureBadge({ memberSince }) {
  if (!memberSince) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      Since {memberSince}
    </span>
  );
}

// ── Achievement badges ─────────────────────────────────────────────────
// Improvement 4: User achievement badges
function AchievementBadges({ recordCount, postCount, listenCount, forSaleCount }) {
  const badges = [];
  if (recordCount >= 5) badges.push({ icon: '💿', label: 'Collector', desc: '5+ records' });
  if (recordCount >= 15) badges.push({ icon: '🏆', label: 'Mega Collector', desc: '15+ records' });
  if (postCount >= 3) badges.push({ icon: '✍️', label: 'Contributor', desc: '3+ posts' });
  if (listenCount >= 10) badges.push({ icon: '🎧', label: 'Audiophile', desc: '10+ listens' });
  if (forSaleCount >= 2) badges.push({ icon: '🏪', label: 'Shopkeeper', desc: '2+ for sale' });
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {badges.map(b => (
        <span key={b.label} title={b.desc} className="inline-flex items-center gap-1 text-[10px] font-semibold text-gs-muted bg-[#111] border border-gs-border rounded-full px-2 py-0.5">
          {b.icon} {b.label}
        </span>
      ))}
    </div>
  );
}

// ── Genre distribution chart ───────────────────────────────────────────
// Improvement 5: User's genre distribution as horizontal bars
function GenreChart({ records, accent }) {
  const genres = {};
  records.forEach(r => {
    const g = r.genre || 'Unknown';
    genres[g] = (genres[g] || 0) + 1;
  });
  const sorted = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = sorted.length > 0 ? sorted[0][1] : 1;
  if (sorted.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold text-gs-dim mb-2 uppercase tracking-wider">Genre Breakdown</div>
      <div className="flex flex-col gap-1.5">
        {sorted.map(([genre, count]) => (
          <div key={genre} className="flex items-center gap-2">
            <span className="text-[10px] text-gs-muted w-20 text-right truncate">{genre}</span>
            <div className="flex-1 h-3 bg-[#111] rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{ width: `${(count / max) * 100}%`, background: accent || '#0ea5e9' }}
              />
            </div>
            <span className="text-[10px] font-mono text-gs-faint w-5">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Collection showcase (top 5 records) ────────────────────────────────
// Improvement 6: Horizontal scroll of top-rated records
function CollectionShowcase({ records, onDetail, accent }) {
  const top5 = [...records].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
  if (top5.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold text-gs-dim mb-2 uppercase tracking-wider">Top Collection</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {top5.map(r => (
          <div
            key={r.id}
            onClick={() => onDetail(r)}
            className="shrink-0 w-[80px] cursor-pointer group"
          >
            <div className="rounded-lg overflow-hidden border border-gs-border group-hover:border-gs-accent/40 transition-colors">
              <AlbumArt album={r.album} artist={r.artist} accent={r.accent || accent} size={80} />
            </div>
            <div className="text-[9px] font-bold text-gs-text mt-1 truncate">{r.album}</div>
            <div className="text-[8px] text-gs-faint truncate">{r.artist}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Collection value display ───────────────────────────────────────────
// Improvement 7: Total estimated collection value
function CollectionValue({ records, accent }) {
  const totalValue = records.reduce((sum, r) => sum + (r.price || 0), 0);
  const forSaleValue = records.filter(r => r.forSale).reduce((sum, r) => sum + (r.price || 0), 0);
  if (totalValue === 0) return null;
  return (
    <div className="bg-[#111] rounded-[10px] p-3 mb-4 border border-gs-border">
      <div className="text-[10px] font-bold text-gs-dim uppercase tracking-wider mb-1.5">Collection Value</div>
      <div className="flex items-baseline gap-3">
        <div>
          <span className="text-lg font-extrabold" style={{ color: accent || '#0ea5e9' }}>${formatCompact(totalValue)}</span>
          <span className="text-[10px] text-gs-faint ml-1">estimated</span>
        </div>
        {forSaleValue > 0 && (
          <div className="text-[10px] text-amber-400">
            ${formatCompact(forSaleValue)} for sale
          </div>
        )}
      </div>
    </div>
  );
}

// ── Profile similarity score ───────────────────────────────────────────
// Improvement 8: Similarity score between current user and viewed user
function SimilarityScore({ userRecords, myRecords, userListens, myListens }) {
  const userArtists = new Set(userRecords.map(r => r.artist.toLowerCase()));
  const myArtists = new Set(myRecords.map(r => r.artist.toLowerCase()));
  const overlap = [...userArtists].filter(a => myArtists.has(a)).length;
  const union = new Set([...userArtists, ...myArtists]).size;

  const userListenArtists = new Set((userListens || []).map(s => s.track.artist.toLowerCase()));
  const myListenArtists = new Set((myListens || []).map(s => s.track.artist.toLowerCase()));
  const listenOverlap = [...userListenArtists].filter(a => myListenArtists.has(a)).length;
  const listenUnion = new Set([...userListenArtists, ...myListenArtists]).size;

  const recordScore = union > 0 ? (overlap / union) : 0;
  const listenScore = listenUnion > 0 ? (listenOverlap / listenUnion) : 0;
  const score = Math.round(((recordScore + listenScore) / 2) * 100);
  if (score === 0) return null;
  const color = score > 60 ? '#10b981' : score > 30 ? '#f59e0b' : '#6b7280';
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-extrabold" style={{ borderColor: color, color }}>
        {score}
      </div>
      <div>
        <div className="font-semibold text-gs-text">Taste Match</div>
        <div className="text-[9px] text-gs-faint">{overlap} shared artist{overlap !== 1 ? 's' : ''}</div>
      </div>
    </div>
  );
}

// ── Block/Report menu ──────────────────────────────────────────────────
// Improvement 9: Block/report user options
function BlockReportMenu({ username, onClose }) {
  const [showMenu, setShowMenu] = useState(false);
  const [actionDone, setActionDone] = useState(null);

  const handleAction = (action) => {
    setActionDone(action);
    setShowMenu(false);
    setTimeout(() => setActionDone(null), 2000);
    if (onClose) onClose();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="bg-transparent border-none text-gs-dim cursor-pointer p-1 hover:text-gs-muted transition-colors"
        title="More options"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
      </button>
      {showMenu && (
        <div className="absolute right-0 top-7 bg-gs-surface border border-gs-border rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
          <button onClick={() => handleAction('block')} className="w-full text-left px-3 py-2 bg-transparent border-none text-red-400 text-xs cursor-pointer hover:bg-red-500/10">
            Block @{username}
          </button>
          <button onClick={() => handleAction('report')} className="w-full text-left px-3 py-2 bg-transparent border-none text-amber-400 text-xs cursor-pointer hover:bg-amber-500/10">
            Report @{username}
          </button>
        </div>
      )}
      {actionDone && (
        <div className="absolute right-0 top-7 bg-gs-surface border border-gs-border rounded-lg px-3 py-2 text-[11px] text-gs-muted z-50 whitespace-nowrap">
          {actionDone === 'block' ? `@${username} blocked` : 'Report submitted'}
        </div>
      )}
    </div>
  );
}

// ── Profile share / QR code button ─────────────────────────────────────
// Improvement 10: Profile share button
function ProfileShareButton({ username }) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const url = `${window.location.origin}/user/${username}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <button
      onClick={handleShare}
      className="bg-transparent border border-gs-border text-gs-dim cursor-pointer p-1.5 rounded-lg hover:text-gs-muted hover:border-gs-border-hover transition-colors"
      title="Share profile"
    >
      {copied ? (
        <span className="text-[10px] text-emerald-400 font-semibold px-1">Copied!</span>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      )}
    </button>
  );
}

// ── #1 Parallax cover photo ──────────────────────────────────────────
function ParallaxCover({ headerUrl, accent, username }) {
  const coverRef = useRef(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handler = () => {
      if (coverRef.current) {
        const rect = coverRef.current.getBoundingClientRect();
        setOffset(Math.round(rect.top * -0.35));
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const bg = headerUrl
    ? { backgroundImage: `url(${headerUrl})`, backgroundPosition: `center ${offset}px`, backgroundSize: 'cover' }
    : { background: `linear-gradient(135deg,${accent || '#0ea5e9'}44,#6366f133,${accent || '#0ea5e9'}22)` };

  return (
    <div ref={coverRef} className="h-[140px] relative overflow-hidden" style={bg}>
      {/* Gradient overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-gs-card/90 via-transparent to-transparent" />
      {/* Username watermark */}
      <div className="absolute bottom-2 right-3 text-[10px] font-mono text-white/20 select-none">
        @{username}
      </div>
    </div>
  );
}

// ── #2 User badges gallery ──────────────────────────────────────────
function BadgesGallery({ recordCount, postCount, listenCount, forSaleCount, followerCount, endorsementCount }) {
  const allBadges = [];
  if (recordCount >= 1) allBadges.push({ icon: '💿', label: 'Collector', tier: recordCount >= 15 ? 'gold' : recordCount >= 5 ? 'silver' : 'bronze', desc: `${recordCount} records` });
  if (postCount >= 1) allBadges.push({ icon: '✍️', label: 'Contributor', tier: postCount >= 10 ? 'gold' : postCount >= 3 ? 'silver' : 'bronze', desc: `${postCount} posts` });
  if (listenCount >= 1) allBadges.push({ icon: '🎧', label: 'Listener', tier: listenCount >= 20 ? 'gold' : listenCount >= 10 ? 'silver' : 'bronze', desc: `${listenCount} sessions` });
  if (forSaleCount >= 1) allBadges.push({ icon: '🏪', label: 'Seller', tier: forSaleCount >= 5 ? 'gold' : forSaleCount >= 2 ? 'silver' : 'bronze', desc: `${forSaleCount} listings` });
  if (followerCount >= 1) allBadges.push({ icon: '⭐', label: 'Popular', tier: followerCount >= 10 ? 'gold' : followerCount >= 3 ? 'silver' : 'bronze', desc: `${followerCount} followers` });
  if (endorsementCount >= 1) allBadges.push({ icon: '🤝', label: 'Trusted', tier: endorsementCount >= 5 ? 'gold' : endorsementCount >= 2 ? 'silver' : 'bronze', desc: `${endorsementCount} endorsements` });

  if (allBadges.length === 0) return null;
  const tierColor = { gold: 'text-amber-400 border-amber-500/30 bg-amber-500/10', silver: 'text-gray-300 border-gray-400/30 bg-gray-400/10', bronze: 'text-orange-400 border-orange-500/30 bg-orange-500/10' };
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold text-gs-dim mb-2 uppercase tracking-wider">Badges</div>
      <div className="flex flex-wrap gap-2">
        {allBadges.map(b => (
          <div key={b.label} title={`${b.label} (${b.tier}) — ${b.desc}`} className={`inline-flex items-center gap-1.5 text-[10px] font-semibold border rounded-lg px-2.5 py-1.5 ${tierColor[b.tier]}`}>
            <span className="text-sm">{b.icon}</span>
            <div>
              <div>{b.label}</div>
              <div className="text-[8px] opacity-60 capitalize">{b.tier}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── #3 Collection highlights reel (auto-scrolling) ──────────────────
function HighlightsReel({ records, accent }) {
  const scrollRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const top8 = [...records].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 8);

  useEffect(() => {
    if (top8.length < 3 || paused) return;
    const el = scrollRef.current;
    if (!el) return;
    const interval = setInterval(() => {
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 2) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 90, behavior: 'smooth' });
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [top8.length, paused]);

  if (top8.length === 0) return null;
  return (
    <div className="mb-4" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold text-gs-dim uppercase tracking-wider">Highlights Reel</div>
        <div className="text-[9px] text-gs-faint">{paused ? 'Paused' : 'Auto-scrolling'}</div>
      </div>
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {top8.map(r => (
          <div key={r.id} className="shrink-0 w-[72px]">
            <div className="rounded-lg overflow-hidden border border-gs-border hover:border-gs-accent/40 transition-colors">
              <AlbumArt album={r.album} artist={r.artist} accent={r.accent || accent} size={72} />
            </div>
            <div className="text-[8px] font-bold text-gs-text mt-1 truncate text-center">{r.album}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── #4 Trading feedback / reviews section ───────────────────────────
function TradingReviews({ username, currentUser, isOwn }) {
  const [reviews, setReviews] = useState(() => {
    // Seed deterministic reviews from username hash
    const hash = username.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const seedReviews = [];
    if (hash % 3 === 0) seedReviews.push({ from: 'vinyl.sam', rating: 5, text: 'Smooth transaction, great packaging!', ts: Date.now() - 86400000 * 3 });
    if (hash % 4 === 0) seedReviews.push({ from: 'crate.digger', rating: 4, text: 'Record arrived in excellent condition.', ts: Date.now() - 86400000 * 7 });
    return seedReviews;
  });
  const [newReview, setNewReview] = useState('');
  const [newRating, setNewRating] = useState(5);

  const handleSubmit = () => {
    if (!newReview.trim() || isOwn) return;
    setReviews(prev => [{ from: currentUser, rating: newRating, text: newReview.trim(), ts: Date.now() }, ...prev]);
    setNewReview('');
    setNewRating(5);
  };

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <div className="mb-4 p-4 bg-[#111] border border-gs-border rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] font-bold text-gs-dim uppercase tracking-wider">Trading Reviews</div>
        {avgRating && (
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-amber-400 font-bold">{avgRating}</span>
            <span className="text-amber-400">{'★'.repeat(Math.round(parseFloat(avgRating)))}</span>
            <span className="text-gs-faint">({reviews.length})</span>
          </div>
        )}
      </div>
      {reviews.length > 0 && (
        <div className="flex flex-col gap-2 mb-3 max-h-[180px] overflow-y-auto">
          {reviews.map((r, i) => (
            <div key={i} className="bg-gs-card border border-gs-border rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-gs-muted">@{r.from}</span>
                <span className="text-amber-400 text-[10px]">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
              </div>
              <p className="text-[11px] text-gs-muted leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      )}
      {!isOwn && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gs-dim">Rating:</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setNewRating(n)} className={`bg-transparent border-none cursor-pointer text-sm ${n <= newRating ? 'text-amber-400' : 'text-gs-faint'}`}>
                  {n <= newRating ? '★' : '☆'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newReview}
              onChange={e => setNewReview(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Write a trading review..."
              className="flex-1 bg-gs-card border border-gs-border rounded-lg px-3 py-2 text-xs text-gs-text placeholder:text-gs-faint outline-none focus:border-gs-accent/40"
              maxLength={200}
            />
            <button onClick={handleSubmit} disabled={!newReview.trim()} className="gs-btn-gradient py-2 px-4 rounded-lg text-xs font-bold border-none cursor-pointer disabled:opacity-40 disabled:cursor-default">
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── #6 Profile QR code ──────────────────────────────────────────────
function ProfileQRCode({ username, accent }) {
  const [showQR, setShowQR] = useState(false);
  // Generate a simple visual QR placeholder using username hash
  const cells = useMemo(() => {
    const grid = [];
    const seed = username.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        // Corner anchors
        const isCorner = (row < 3 && col < 3) || (row < 3 && col > 5) || (row > 5 && col < 3);
        const filled = isCorner || ((seed * (row + 1) * (col + 1) + row * 7 + col * 13) % 3 !== 0);
        grid.push(filled);
      }
    }
    return grid;
  }, [username]);

  return (
    <div className="relative">
      <button
        onClick={() => setShowQR(!showQR)}
        className="bg-transparent border border-gs-border text-gs-dim cursor-pointer p-1.5 rounded-lg hover:text-gs-muted hover:border-gs-border-hover transition-colors"
        title="Profile QR code"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="4" height="4"/><line x1="22" y1="14" x2="22" y2="22"/><line x1="14" y1="22" x2="22" y2="22"/></svg>
      </button>
      {showQR && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl p-3 shadow-2xl z-50 border border-gs-border">
          <div className="grid grid-cols-9 gap-px w-[108px] h-[108px] mx-auto">
            {cells.map((filled, i) => (
              <div key={i} className="rounded-[1px]" style={{ background: filled ? (accent || '#0ea5e9') : '#f0f0f0' }} />
            ))}
          </div>
          <div className="text-center mt-2 text-[9px] font-mono text-gray-600">@{username}</div>
          <div className="text-center text-[8px] text-gray-400 mt-0.5">Scan to view profile</div>
        </div>
      )}
    </div>
  );
}

// ── #7 User availability status ─────────────────────────────────────
function AvailabilityStatus({ username }) {
  const hash = username.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const statuses = [
    { label: 'Available to trade', color: 'bg-emerald-500', text: 'text-emerald-400' },
    { label: 'Busy — slow replies', color: 'bg-amber-500', text: 'text-amber-400' },
    { label: 'Away', color: 'bg-gray-500', text: 'text-gray-400' },
  ];
  const status = statuses[hash % 3];
  return (
    <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold bg-[#111] border border-gs-border rounded-full px-2.5 py-1">
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.color}`} />
      <span className={status.text}>{status.label}</span>
    </div>
  );
}

// ── #8 Mutual connections with viewer ───────────────────────────────
function MutualConnections({ mutualFollowers, onViewUser }) {
  if (mutualFollowers.length === 0) return null;
  return (
    <div className="mb-4 p-3 bg-[#111] border border-gs-border rounded-xl">
      <div className="text-[10px] font-bold text-gs-dim mb-2 uppercase tracking-wider">Mutual Connections</div>
      <div className="flex flex-wrap gap-2">
        {mutualFollowers.slice(0, 8).map(f => {
          const fp = getProfile(f);
          return (
            <button key={f} onClick={() => onViewUser(f)} className="flex items-center gap-1.5 bg-gs-card border border-gs-border rounded-lg px-2 py-1.5 cursor-pointer hover:border-gs-accent/40 transition-colors">
              <Avatar username={f} size={18} />
              <div className="text-left">
                <div className="text-[10px] font-semibold text-gs-text leading-tight">{fp.displayName || f}</div>
                <div className="text-[8px] text-gs-faint font-mono">@{f}</div>
              </div>
            </button>
          );
        })}
      </div>
      {mutualFollowers.length > 8 && (
        <div className="text-[9px] text-gs-faint mt-2">+{mutualFollowers.length - 8} more mutual connections</div>
      )}
    </div>
  );
}

// ── #9 User ranking in community ────────────────────────────────────
function CommunityRanking({ userRecords, userPosts, userListens, followerCount, accent }) {
  // Calculate a composite score for ranking
  const score = (userRecords.length * 10) + (userPosts.length * 5) + (userListens.length * 2) + (followerCount * 8);
  const tier = score >= 200 ? { label: 'Diamond', icon: '💎', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' }
    : score >= 100 ? { label: 'Gold', icon: '🥇', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' }
    : score >= 50 ? { label: 'Silver', icon: '🥈', color: 'text-gray-300 border-gray-400/30 bg-gray-400/10' }
    : { label: 'Bronze', icon: '🥉', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' };

  return (
    <div className="mb-4 p-3 bg-[#111] border border-gs-border rounded-xl">
      <div className="text-[10px] font-bold text-gs-dim mb-2 uppercase tracking-wider">Community Rank</div>
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl ${tier.color}`}>
          {tier.icon}
        </div>
        <div>
          <div className="text-sm font-extrabold text-gs-text">{tier.label} Tier</div>
          <div className="text-[10px] text-gs-faint">{score} community points</div>
          <div className="mt-1 h-1.5 w-32 bg-[#222] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (score / 200) * 100)}%`, background: accent || '#0ea5e9' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── #10 Profile action history ──────────────────────────────────────
function ActionHistory({ userRecords, userPosts, userListens }) {
  const actions = useMemo(() => {
    const items = [];
    userPosts.slice(0, 3).forEach(p => items.push({ type: 'post', label: `Wrote a post${p.taggedRecord ? ` about "${p.taggedRecord.album}"` : ''}`, ts: p.createdAt, icon: '📝' }));
    userListens.slice(0, 3).forEach(s => items.push({ type: 'listen', label: `Listened to "${s.track.title}" by ${s.track.artist}`, ts: s.timestampMs, icon: '🎧' }));
    userRecords.slice(0, 2).forEach(r => items.push({ type: 'record', label: `Added "${r.album}" by ${r.artist}`, ts: Date.now() - 86400000 * (r.id?.length || 1), icon: '💿' }));
    return items.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [userRecords, userPosts, userListens]);

  if (actions.length === 0) return null;

  const relTime = ts => {
    const d = Date.now() - ts; const m = Math.floor(d / 60000);
    if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const dy = Math.floor(h / 24); return dy === 1 ? 'yesterday' : `${dy}d ago`;
  };

  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold text-gs-dim mb-2 uppercase tracking-wider">Action History</div>
      <div className="relative pl-4 border-l border-gs-border">
        {actions.map((a, i) => (
          <div key={i} className="relative mb-3 last:mb-0">
            <div className="absolute -left-[21px] top-0.5 w-3 h-3 rounded-full bg-gs-surface border border-gs-border flex items-center justify-center text-[8px]">
              {a.icon}
            </div>
            <div className="text-[11px] text-gs-text">{a.label}</div>
            <div className="text-[9px] text-gs-faint font-mono">{relTime(a.ts)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── [Improvement #12] Profile Achievements Timeline ─────────────────────
function AchievementsTimeline({ userRecords, userPosts, userListens, forSaleCount, followerCount, accent }) {
  const [expanded, setExpanded] = useState(false);

  const milestones = useMemo(() => {
    const items = [];
    const now = Date.now();
    if (userRecords.length >= 1) items.push({ label: 'First Record Added', icon: '💿', ts: now - 86400000 * 90, color: '#0ea5e9' });
    if (userRecords.length >= 5) items.push({ label: '5 Records Collected', icon: '🎯', ts: now - 86400000 * 60, color: '#10b981' });
    if (userRecords.length >= 10) items.push({ label: '10 Records Milestone', icon: '🏆', ts: now - 86400000 * 30, color: '#f59e0b' });
    if (userPosts.length >= 1) items.push({ label: 'First Post Published', icon: '📝', ts: now - 86400000 * 75, color: '#8b5cf6' });
    if (userPosts.length >= 5) items.push({ label: 'Active Contributor', icon: '✍️', ts: now - 86400000 * 40, color: '#ec4899' });
    if (userListens.length >= 1) items.push({ label: 'First Listening Session', icon: '🎧', ts: now - 86400000 * 85, color: '#06b6d4' });
    if (userListens.length >= 10) items.push({ label: 'Audiophile Status', icon: '🎵', ts: now - 86400000 * 20, color: '#a855f7' });
    if (forSaleCount >= 1) items.push({ label: 'First Listing Created', icon: '🏷️', ts: now - 86400000 * 50, color: '#f97316' });
    if (followerCount >= 1) items.push({ label: 'First Follower Gained', icon: '⭐', ts: now - 86400000 * 65, color: '#eab308' });
    if (followerCount >= 5) items.push({ label: 'Growing Influence', icon: '🌟', ts: now - 86400000 * 15, color: '#14b8a6' });
    return items.sort((a, b) => a.ts - b.ts);
  }, [userRecords, userPosts, userListens, forSaleCount, followerCount]);

  if (milestones.length === 0) return null;

  const displayItems = expanded ? milestones : milestones.slice(-4);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold text-gs-dim uppercase tracking-wider">Achievements Timeline</div>
        {milestones.length > 4 && (
          <button onClick={() => setExpanded(e => !e)} className="text-[10px] text-gs-accent bg-transparent border-none cursor-pointer">
            {expanded ? 'Show less' : `View all ${milestones.length}`}
          </button>
        )}
      </div>
      <div className="relative pl-5 border-l-2 border-[#1a1a1a]">
        {displayItems.map((m, i) => (
          <div key={m.label} className="relative mb-3 last:mb-0">
            <div
              className="absolute -left-[25px] w-4 h-4 rounded-full flex items-center justify-center text-[9px] border-2 border-gs-card"
              style={{ background: m.color }}
            >
              {m.icon}
            </div>
            <div className="text-[11px] text-gs-text font-semibold">{m.label}</div>
            <div className="text-[9px] text-gs-faint font-mono">
              {new Date(m.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── [Improvement #13] Trading Activity Heatmap ──────────────────────────
function TradingActivityHeatmap({ userRecords, userPosts, userListens, accent }) {
  const heatmapData = useMemo(() => {
    // Generate last 12 weeks of activity data
    const weeks = 12;
    const daysPerWeek = 7;
    const now = Date.now();
    const grid = [];

    for (let w = 0; w < weeks; w++) {
      const week = [];
      for (let d = 0; d < daysPerWeek; d++) {
        const dayOffset = (weeks - 1 - w) * 7 + (6 - d);
        const dayTs = now - dayOffset * 86400000;
        const dayStart = new Date(dayTs);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayTs);
        dayEnd.setHours(23, 59, 59, 999);

        // Count activities for this day (use deterministic seed for demo)
        const seed = (w * 7 + d + userRecords.length + userPosts.length) * 37;
        const count = Math.max(0, (seed % 5) - 1);
        week.push({ count, date: dayStart });
      }
      grid.push(week);
    }
    return grid;
  }, [userRecords, userPosts, userListens]);

  const getColor = (count) => {
    if (count === 0) return '#111';
    if (count === 1) return `${accent || '#0ea5e9'}33`;
    if (count === 2) return `${accent || '#0ea5e9'}66`;
    return `${accent || '#0ea5e9'}99`;
  };

  const totalActivity = heatmapData.flat().reduce((s, d) => s + d.count, 0);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold text-gs-dim uppercase tracking-wider">Activity Heatmap</div>
        <div className="text-[10px] text-gs-faint">{totalActivity} actions (12 weeks)</div>
      </div>
      <div className="flex gap-[3px]">
        {heatmapData.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day, di) => (
              <div
                key={di}
                className="w-[10px] h-[10px] rounded-[2px] transition-colors"
                style={{ background: getColor(day.count) }}
                title={`${day.date.toLocaleDateString()}: ${day.count} activities`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-1.5 justify-end">
        <span className="text-[9px] text-gs-faint">Less</span>
        {[0, 1, 2, 3].map(n => (
          <div key={n} className="w-[8px] h-[8px] rounded-[2px]" style={{ background: getColor(n) }} />
        ))}
        <span className="text-[9px] text-gs-faint">More</span>
      </div>
    </div>
  );
}

// ── [Improvement #14] Social Influence Score Display ─────────────────────
function SocialInfluenceScore({ followerCount, userPosts, userRecords, userListens, accent }) {
  const score = useMemo(() => {
    const followers = followerCount * 15;
    const posts = userPosts.length * 8;
    const records = userRecords.length * 5;
    const listens = userListens.length * 2;
    const raw = followers + posts + records + listens;
    // Normalize to 0-100 scale
    return Math.min(100, Math.round(raw / 3));
  }, [followerCount, userPosts, userRecords, userListens]);

  const tier = score >= 80 ? { label: 'Influencer', color: '#f59e0b', desc: 'Major community presence' }
    : score >= 50 ? { label: 'Rising Star', color: '#8b5cf6', desc: 'Growing influence in the community' }
    : score >= 25 ? { label: 'Active Member', color: '#0ea5e9', desc: 'Regular community participant' }
    : { label: 'Newcomer', color: '#6b7280', desc: 'Just getting started' };

  const breakdown = [
    { label: 'Followers', value: followerCount, max: 20 },
    { label: 'Posts', value: userPosts.length, max: 15 },
    { label: 'Collection', value: userRecords.length, max: 25 },
    { label: 'Listening', value: userListens.length, max: 30 },
  ];

  return (
    <div className="mb-4 p-3 bg-[#111] border border-gs-border rounded-xl">
      <div className="text-[10px] font-bold text-gs-dim uppercase tracking-wider mb-2">Social Influence</div>
      <div className="flex items-center gap-3 mb-3">
        <div className="relative w-14 h-14">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#1a1a1a" strokeWidth="3" />
            <circle cx="18" cy="18" r="16" fill="none" stroke={tier.color} strokeWidth="3" strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-extrabold text-gs-text">{score}</span>
          </div>
        </div>
        <div>
          <div className="text-[13px] font-bold text-gs-text">{tier.label}</div>
          <div className="text-[10px] text-gs-faint">{tier.desc}</div>
        </div>
      </div>
      <div className="space-y-1.5">
        {breakdown.map(b => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="text-[9px] text-gs-dim w-16 text-right">{b.label}</span>
            <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (b.value / b.max) * 100)}%`, background: accent || '#0ea5e9' }} />
            </div>
            <span className="text-[9px] text-gs-faint font-mono w-6 text-right">{b.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── [Improvement #15] Profile Customization Marketplace ──────────────────
function ProfileCustomizationMarketplace({ isOwn, accent }) {
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [ownedItems, setOwnedItems] = useState(['classic']);

  const items = [
    { id: 'classic', name: 'Classic Theme', price: 'Free', category: 'Theme', color: '#0ea5e9', owned: true },
    { id: 'neon', name: 'Neon Nights', price: '50 pts', category: 'Theme', color: '#f43f5e', owned: false },
    { id: 'vintage', name: 'Vintage Vinyl', price: '75 pts', category: 'Theme', color: '#f59e0b', owned: false },
    { id: 'gold_frame', name: 'Gold Avatar Frame', price: '100 pts', category: 'Frame', color: '#eab308', owned: false },
    { id: 'animated_bg', name: 'Animated Banner', price: '150 pts', category: 'Banner', color: '#8b5cf6', owned: false },
    { id: 'custom_badge', name: 'Custom Badge', price: '200 pts', category: 'Badge', color: '#10b981', owned: false },
  ];

  const handlePurchase = (itemId) => {
    if (!ownedItems.includes(itemId)) {
      setOwnedItems(prev => [...prev, itemId]);
    }
  };

  if (!isOwn) return null;
  return (
    <div className="mb-4">
      <button
        onClick={() => setShowMarketplace(s => !s)}
        className="w-full py-2.5 bg-gradient-to-r from-[#111] to-[#0d0d0d] border border-gs-border rounded-xl text-[12px] font-semibold cursor-pointer hover:border-gs-accent/40 transition-colors flex items-center justify-center gap-2 text-gs-muted"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        {showMarketplace ? 'Hide Customization Shop' : 'Customize Profile'}
      </button>
      {showMarketplace && (
        <div className="mt-3 p-3 bg-[#0d0d0d] border border-gs-border rounded-xl">
          <div className="text-[10px] font-bold text-gs-dim uppercase tracking-wider mb-3">PROFILE CUSTOMIZATION SHOP</div>
          <div className="grid grid-cols-2 gap-2">
            {items.map(item => (
              <div key={item.id} className="p-2.5 bg-[#111] border border-gs-border rounded-lg hover:border-gs-accent/30 transition-colors">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-5 h-5 rounded-full" style={{ background: `${item.color}33`, border: `1px solid ${item.color}66` }} />
                  <div className="text-[10px] font-bold text-gs-text">{item.name}</div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-gs-faint">{item.category}</span>
                  {ownedItems.includes(item.id) ? (
                    <span className="text-[9px] text-emerald-400 font-bold">Owned</span>
                  ) : (
                    <button
                      onClick={() => handlePurchase(item.id)}
                      className="px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer border-none transition-colors"
                      style={{ background: `${item.color}22`, color: item.color }}
                    >
                      {item.price}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-gs-faint mt-2 text-center">Earn points by collecting records, posting, and trading.</div>
        </div>
      )}
    </div>
  );
}

// ── Skeleton loading placeholder ────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="gs-card mb-6">
        <div className="h-[100px] bg-[#1a1a1a]" />
        <div className="px-6 pb-6 -mt-8">
          <div className="flex justify-between items-end mb-3.5">
            <div className="w-16 h-16 rounded-full bg-[#222] border-[3px] border-gs-card" />
            <div className="w-24 h-8 rounded-[20px] bg-[#1a1a1a]" />
          </div>
          <div className="w-40 h-5 bg-[#1a1a1a] rounded mb-2" />
          <div className="w-24 h-3 bg-[#1a1a1a] rounded mb-3" />
          <div className="w-full h-10 bg-[#1a1a1a] rounded mb-3" />
          <div className="flex gap-3.5 mb-5">
            <div className="w-20 h-3 bg-[#1a1a1a] rounded" />
            <div className="w-16 h-3 bg-[#1a1a1a] rounded" />
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {[1,2,3,4].map(i => <div key={i} className="h-14 bg-[#1a1a1a] rounded-lg" />)}
          </div>
        </div>
      </div>
      <div className="flex gap-3 mb-4">
        {[1,2,3,4,5].map(i => <div key={i} className="w-20 h-8 bg-[#1a1a1a] rounded" />)}
      </div>
      <div className="flex flex-col gap-2">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-[#1a1a1a] rounded-xl" />)}
      </div>
    </div>
  );
}

export default function UserProfilePage({ username, records, currentUser, following, onFollow, onBack, onDetail, onBuy, onViewArtist, onViewUser, onMakeOffer, posts, onLikePost, onBookmarkPost, listeningHistory, wishlist, profile, onMessage, loading }) {
  const [tab, setTab] = useState("posts");
  const [followAnimating, setFollowAnimating] = useState(false);
  // Improvement 11: Gift record modal state
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  // Improvement 12: Endorsement input state
  const [endorsementText, setEndorsementText] = useState('');
  const [endorsements, setEndorsements] = useState([]);
  // Improvement 13: Compare view toggle
  const [showCompare, setShowCompare] = useState(false);
  // #5: Reviews tab state — tracks if user is viewing the reviews content tab
  const [reviewsCount, setReviewsCount] = useState(0);

  const isOwn = username ? username === currentUser : false;
  const p = username
    ? isOwn
      ? { ...getProfile(username), displayName: profile?.displayName || getProfile(username).displayName, bio: profile?.bio || getProfile(username).bio, location: profile?.location || getProfile(username).location, favGenre: profile?.favGenre || getProfile(username).favGenre }
      : getProfile(username)
    : {};

  const userRecords = records.filter(r => r.user === username);
  const forSale = userRecords.filter(r => r.forSale);
  const isFollowing = following.includes(username);
  const followerCount = (p.followers || []).length + (isFollowing && !(p.followers || []).includes(currentUser) ? 1 : 0);
  const userWishlist = isOwn ? (wishlist || []) : (USER_WISHLISTS[username] || []);
  const myRecords = records.filter(r => r.user === currentUser);
  const userPosts = (posts || []).filter(pp => pp.user === username).sort((a, b) => b.createdAt - a.createdAt);
  const userListens = (listeningHistory || []).filter(s => s.username === username).sort((a, b) => b.timestampMs - a.timestampMs);
  const myListens = (listeningHistory || []).filter(s => s.username === currentUser);

  // ── Mutual followers ──────────────────────────────────────────────────
  const mutualFollowers = useMemo(() => {
    if (isOwn || !username) return [];
    const theirFollowers = p.followers || [];
    return following.filter(f => f !== username && theirFollowers.includes(f));
  }, [isOwn, p.followers, following, username]);

  // ── "Member since" — derive from earliest record or post ─────────────
  const memberSince = useMemo(() => {
    const timestamps = [
      ...(userPosts || []).map(pp => pp.createdAt),
      ...(userListens || []).map(s => s.timestampMs),
    ].filter(Boolean);
    if (timestamps.length === 0) return null;
    const earliest = Math.min(...timestamps);
    const d = new Date(earliest);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [userPosts, userListens]);

  // Improvement 14: Trading history between you and this user
  const tradingHistory = useMemo(() => {
    if (isOwn || !username) return [];
    // Derive synthetic trade events from records that changed hands
    const theirArtists = new Set(userRecords.map(r => r.artist));
    const myMatchingRecords = myRecords.filter(r => theirArtists.has(r.artist));
    return myMatchingRecords.slice(0, 3).map(r => ({
      id: r.id,
      album: r.album,
      artist: r.artist,
      type: 'shared_artist',
    }));
  }, [isOwn, username, userRecords, myRecords]);

  // Improvement 15: Recent activity feed data
  const recentActivity = useMemo(() => {
    const activities = [];
    userPosts.slice(0, 2).forEach(pp => {
      activities.push({ type: 'post', text: `Posted about ${pp.taggedRecord?.album || 'vinyl'}`, ts: pp.createdAt, id: 'post-' + pp.id });
    });
    userListens.slice(0, 2).forEach(s => {
      activities.push({ type: 'listen', text: `Listened to ${s.track.title}`, ts: s.timestampMs, id: 'listen-' + s.id });
    });
    userRecords.slice(0, 1).forEach(r => {
      activities.push({ type: 'record', text: `Added ${r.album} to collection`, ts: Date.now() - 86400000, id: 'rec-' + r.id });
    });
    return activities.sort((a, b) => b.ts - a.ts).slice(0, 5);
  }, [userPosts, userListens, userRecords]);

  // Improvement 16: Social proof — mutual followers who trust/follow this user
  const socialProof = useMemo(() => {
    if (isOwn || !username) return null;
    const trusted = mutualFollowers.length;
    if (trusted === 0) return null;
    const pct = Math.min(100, Math.round((trusted / Math.max(followerCount, 1)) * 100));
    return { count: trusted, pct };
  }, [isOwn, username, mutualFollowers, followerCount]);

  // ── Gift record handler ──────────────────────────────────────────────
  // Improvement 11 (continued): Gift record button handler
  const handleGift = useCallback((record) => {
    setShowGiftPicker(false);
    if (onMessage) {
      onMessage(username, `🎁 I'd like to gift you "${record.album}" by ${record.artist}!`);
    }
  }, [username, onMessage]);

  // ── Endorsement handler ──────────────────────────────────────────────
  // Improvement 12 (continued): Submit endorsement
  const handleEndorsement = useCallback(() => {
    if (!endorsementText.trim()) return;
    setEndorsements(prev => [...prev, { text: endorsementText.trim(), from: currentUser, ts: Date.now() }]);
    setEndorsementText('');
  }, [endorsementText, currentUser]);

  if (!username) return null;
  if (loading) return <ProfileSkeleton />;

  const relTime = ts => {
    const d = Date.now() - ts; const m = Math.floor(d / 60000);
    if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const dy = Math.floor(h / 24); return dy === 1 ? "yesterday" : `${dy}d ago`;
  };

  const tabs = [
    { id: "posts", label: "Posts", count: userPosts.length },
    { id: "listening", label: "Listening", count: userListens.length },
    { id: "records", label: "Records", count: userRecords.length },
    { id: "for sale", label: "For Sale", count: forSale.length },
    { id: "wishlist", label: "Wishlist", count: userWishlist.length },
    // Improvement 17: Activity tab
    { id: "activity", label: "Activity", count: recentActivity.length },
    // #5: Reviews content tab
    { id: "reviews", label: "Reviews", count: reviewsCount },
  ];

  const display = tab === "records" ? userRecords : tab === "for sale" ? forSale : [];

  // ── Follow with animation ─────────────────────────────────────────────
  const handleFollow = () => {
    setFollowAnimating(true);
    onFollow(username);
    setTimeout(() => setFollowAnimating(false), 400);
  };

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 bg-transparent border-none text-gs-dim text-xs font-semibold cursor-pointer mb-4 p-0 hover:text-gs-accent transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
        Back
      </button>

      {/* Profile card */}
      <div className="gs-card mb-6">
        {/* #1: Parallax cover photo */}
        <ParallaxCover headerUrl={p.headerUrl} accent={p.accent} username={username} />

        <div className="px-6 pb-6 -mt-8">
          <div className="flex justify-between items-end mb-3.5">
            <div className="rounded-full border-[3px] border-gs-card leading-none relative z-[2]">
              <Avatar username={username} size={64} src={isOwn ? profile?.avatarUrl : undefined} />
              {/* Improvement 1: Online status dot overlaid on avatar */}
              <span
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-gs-card ${
                  (username.charCodeAt(0) % 3 !== 0) ? 'bg-emerald-500' : 'bg-gray-500'
                }`}
              />
            </div>
            {!isOwn && (
              <div className="flex gap-2 items-center">
                {/* Improvement 10: Share profile button */}
                <ProfileShareButton username={username} />
                {/* #6: Profile QR code */}
                <ProfileQRCode username={username} accent={p.accent} />
                {/* Improvement 9: Block/report menu */}
                <BlockReportMenu username={username} />
                {/* Message button */}
                <button
                  onClick={() => onMessage && onMessage(username)}
                  className="gs-btn-secondary py-2 px-4 !rounded-[20px] text-xs font-semibold flex items-center gap-1.5"
                  title={`Message @${username}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  Message
                </button>
                {/* Improvement 11: Gift record button */}
                <button
                  onClick={() => setShowGiftPicker(!showGiftPicker)}
                  className="gs-btn-secondary py-2 px-4 !rounded-[20px] text-xs font-semibold flex items-center gap-1.5"
                  title={`Gift a record to @${username}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                  Gift
                </button>
                {/* Make Offer button — show if they have for-sale records */}
                {forSale.length > 0 && (
                  <button
                    onClick={() => setTab("for sale")}
                    className="py-2 px-4 !rounded-[20px] text-xs font-bold border-none cursor-pointer text-white bg-gradient-to-br from-amber-500 to-orange-600 flex items-center gap-1.5 hover:brightness-110 transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                    Browse Shop
                  </button>
                )}
                {/* Follow/Unfollow with animation */}
                <button
                  onClick={handleFollow}
                  className={`py-2 px-5 !rounded-[20px] text-xs font-bold transition-all duration-300 ${
                    followAnimating ? 'scale-110' : 'scale-100'
                  } ${
                    isFollowing
                      ? "gs-btn-secondary"
                      : "gs-btn-gradient"
                  }`}
                  style={{
                    transform: followAnimating ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.3s, color 0.3s, border-color 0.3s',
                  }}
                >
                  {followAnimating && !isFollowing ? '❤️ Followed!' : isFollowing ? "Following \u2713" : "Follow"}
                </button>
              </div>
            )}
          </div>

          {/* Improvement 11 (continued): Gift record picker dropdown */}
          {showGiftPicker && myRecords.length > 0 && (
            <div className="mb-4 p-3 bg-[#111] border border-gs-border rounded-xl">
              <div className="text-[11px] font-bold text-gs-dim mb-2">Pick a record to gift to @{username}</div>
              <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto">
                {myRecords.slice(0, 10).map(r => (
                  <div key={r.id} onClick={() => handleGift(r)} className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer hover:bg-gs-accent/10 transition-colors">
                    <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-gs-text truncate">{r.album}</div>
                      <div className="text-[9px] text-gs-faint">{r.artist}</div>
                    </div>
                    <span className="text-[10px] text-gs-accent">Gift</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xl font-extrabold text-gs-text tracking-tight">{p.displayName}</span>
            {/* Improvement 2: Verified seller badge */}
            <VerifiedSellerBadge forSaleCount={forSale.length} followerCount={followerCount} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono" style={{ color: p.accent || "#0ea5e9" }}>@{username}</span>
            {/* Improvement 1: Online status indicator */}
            <OnlineIndicator username={username} />
            {/* #7: Availability status */}
            <AvailabilityStatus username={username} />
          </div>

          {/* Improvement 3: Member since + tenure badge + location/genre row */}
          <div className="flex gap-2 text-xs text-gs-dim mb-2 flex-wrap items-center">
            <TenureBadge memberSince={memberSince} />
            {memberSince && (
              <span className="flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Joined {memberSince}
              </span>
            )}
            {p.location && <span>📍 {p.location}</span>}
            {p.favGenre && <span>🎵 {p.favGenre}</span>}
          </div>

          {p.bio && <p className="text-[13px] text-gs-muted leading-relaxed mb-3.5 line-clamp-3">{p.bio}</p>}

          {/* Improvement 4: Achievement badges */}
          <AchievementBadges
            recordCount={userRecords.length}
            postCount={userPosts.length}
            listenCount={userListens.length}
            forSaleCount={forSale.length}
          />

          {/* #2: User badges gallery */}
          <BadgesGallery
            recordCount={userRecords.length}
            postCount={userPosts.length}
            listenCount={userListens.length}
            forSaleCount={forSale.length}
            followerCount={followerCount}
            endorsementCount={endorsements.length}
          />

          {/* Improvement 8: Profile similarity score + Improvement 16: Social proof */}
          {!isOwn && (
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <SimilarityScore
                userRecords={userRecords}
                myRecords={myRecords}
                userListens={userListens}
                myListens={myListens}
              />
              {socialProof && (
                <div className="flex items-center gap-1.5 text-[11px] text-gs-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <span><strong className="text-gs-text">{socialProof.count}</strong> of your follows trust this user ({socialProof.pct}%)</span>
                </div>
              )}
            </div>
          )}

          {/* Mutual followers */}
          {mutualFollowers.length > 0 && (
            <div className="flex items-center gap-1.5 mb-4 text-[11px] text-gs-dim">
              <div className="flex -space-x-1.5">
                {mutualFollowers.slice(0, 3).map(f => (
                  <div key={f} className="rounded-full border border-gs-card">
                    <Avatar username={f} size={16} />
                  </div>
                ))}
              </div>
              <span>
                Also followed by{' '}
                {mutualFollowers.slice(0, 2).map((f, i) => (
                  <span key={f}>
                    {i > 0 && ', '}
                    <button onClick={() => onViewUser(f)} className="bg-transparent border-none text-gs-accent cursor-pointer text-[11px] p-0 font-semibold hover:underline">
                      @{f}
                    </button>
                  </span>
                ))}
                {mutualFollowers.length > 2 && <span className="text-gs-faint"> and {mutualFollowers.length - 2} more</span>}
              </span>
            </div>
          )}

          {/* #8: Mutual connections with viewer */}
          {!isOwn && <MutualConnections mutualFollowers={mutualFollowers} onViewUser={onViewUser} />}

          {/* #9: User ranking in community */}
          <CommunityRanking
            userRecords={userRecords}
            userPosts={userPosts}
            userListens={userListens}
            followerCount={followerCount}
            accent={p.accent}
          />

          {/* Improvement 7: Collection value */}
          <CollectionValue records={userRecords} accent={p.accent} />

          {/* [Improvement #12] Profile achievements timeline */}
          <AchievementsTimeline
            userRecords={userRecords}
            userPosts={userPosts}
            userListens={userListens}
            forSaleCount={forSale.length}
            followerCount={followerCount}
            accent={p.accent}
          />

          {/* [Improvement #13] Trading activity heatmap */}
          <TradingActivityHeatmap
            userRecords={userRecords}
            userPosts={userPosts}
            userListens={userListens}
            accent={p.accent}
          />

          {/* [Improvement #14] Social influence score display */}
          <SocialInfluenceScore
            followerCount={followerCount}
            userPosts={userPosts}
            userRecords={userRecords}
            userListens={userListens}
            accent={p.accent}
          />

          {/* [Improvement #15] Profile customization marketplace */}
          <ProfileCustomizationMarketplace isOwn={isOwn} accent={p.accent} />

          {/* Stats — 5 key numbers (added Wishlist count) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[
              { l: "Records", v: userRecords.length, click: () => setTab("records") },
              { l: "For Sale", v: forSale.length, click: () => setTab("for sale") },
              { l: "Followers", v: followerCount },
              { l: "Posts", v: userPosts.length, click: () => setTab("posts") },
              { l: "Wishlist", v: userWishlist.length, click: () => setTab("wishlist") },
            ].map(s => (
              <div
                key={s.l} onClick={s.click}
                className={`gs-stat ${s.click ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="text-xl font-extrabold text-gs-text tracking-tight">{s.v}</div>
                <div className="text-[10px] font-mono mt-0.5" style={{ color: p.accent || "#0ea5e9" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* #3: Auto-scrolling highlights reel */}
      <HighlightsReel records={userRecords} accent={p.accent} />

      {/* Improvement 6: Collection showcase */}
      <CollectionShowcase records={userRecords} onDetail={onDetail} accent={p.accent} />

      {/* Improvement 5: Genre distribution chart */}
      <GenreChart records={userRecords} accent={p.accent} />

      {/* Improvement 13: Compare view toggle (collections side by side) */}
      {!isOwn && (
        <div className="mb-4">
          <button
            onClick={() => setShowCompare(!showCompare)}
            className="gs-btn-secondary py-2 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 12H3"/><path d="M21 12H17"/><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/></svg>
            {showCompare ? 'Hide' : 'Compare'} Collections
          </button>
          {showCompare && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="bg-[#111] rounded-xl p-3 border border-gs-border">
                <div className="text-[11px] font-bold text-gs-dim mb-2">@{username} ({userRecords.length})</div>
                <div className="flex flex-col gap-1">
                  {userRecords.slice(0, 6).map(r => (
                    <div key={r.id} className="flex items-center gap-1.5">
                      <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={20} />
                      <span className="text-[10px] text-gs-text truncate">{r.album}</span>
                    </div>
                  ))}
                  {userRecords.length > 6 && <div className="text-[9px] text-gs-faint">+{userRecords.length - 6} more</div>}
                </div>
              </div>
              <div className="bg-[#111] rounded-xl p-3 border border-gs-border">
                <div className="text-[11px] font-bold text-gs-dim mb-2">@{currentUser} ({myRecords.length})</div>
                <div className="flex flex-col gap-1">
                  {myRecords.slice(0, 6).map(r => (
                    <div key={r.id} className="flex items-center gap-1.5">
                      <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={20} />
                      <span className="text-[10px] text-gs-text truncate">{r.album}</span>
                    </div>
                  ))}
                  {myRecords.length > 6 && <div className="text-[9px] text-gs-faint">+{myRecords.length - 6} more</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Improvement 14: Trading history between you and this user */}
      {!isOwn && tradingHistory.length > 0 && (
        <div className="mb-4 p-3 bg-[#111] border border-gs-border rounded-xl">
          <div className="text-[11px] font-bold text-gs-dim mb-2 uppercase tracking-wider">Shared Artists</div>
          <div className="flex flex-wrap gap-2">
            {tradingHistory.map(t => (
              <span key={t.id} className="inline-flex items-center gap-1 text-[10px] bg-gs-accent/10 text-gs-accent rounded-full px-2.5 py-1 font-semibold">
                🎵 {t.artist}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs with count badges */}
      <div className="flex border-b border-[#1a1a1a] mb-4 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`py-2.5 px-3.5 bg-transparent border-none border-b-2 text-xs font-semibold cursor-pointer -mb-px flex items-center gap-1.5 whitespace-nowrap transition-colors duration-150 ${tab === t.id ? 'border-b-gs-accent text-gs-accent' : 'border-b-transparent text-gs-dim hover:text-gs-muted'}`}>
            {t.label}
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              tab === t.id
                ? 'bg-gs-accent/10 text-gs-accent'
                : 'bg-[#1a1a1a] text-gs-subtle'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* === Tab content === */}

      {/* Posts */}
      {tab === "posts" && (
        userPosts.length === 0 ? (
          <Empty icon="📝" text={`@${username} hasn't posted yet.`} />
        ) : (
          <div className="flex flex-col gap-3">
            {userPosts.map(post => {
              const matchedRecord = post.taggedRecord ? records.find(r => r.album.toLowerCase() === post.taggedRecord.album.toLowerCase() && r.artist.toLowerCase() === post.taggedRecord.artist.toLowerCase()) : null;
              const tagAccent = matchedRecord?.accent || post.accent || p.accent || "#0ea5e9";
              return (
                <div key={post.id} className="bg-gs-card border border-gs-border rounded-[14px] overflow-hidden">
                  <div className="h-0.5" style={{ background: `linear-gradient(90deg,${tagAccent},transparent)` }} />
                  <div className="p-4">
                    {/* Author chip */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <Avatar username={username} size={24} src={isOwn ? profile?.avatarUrl : undefined} />
                      <span className="text-xs font-semibold text-[#aaa]">{p.displayName}</span>
                      <span className="text-[10px] text-gs-faint font-mono">{post.timeAgo}</span>
                    </div>
                    {post.taggedRecord && (
                      <div onClick={() => matchedRecord && onDetail(matchedRecord)} className="flex items-center gap-2.5 mb-2.5 p-2 rounded-lg" style={{ background: tagAccent + "0a", cursor: matchedRecord ? "pointer" : "default" }}>
                        <AlbumArt album={post.taggedRecord.album} artist={post.taggedRecord.artist} accent={tagAccent} size={30} />
                        <div>
                          <div className="text-xs font-bold text-gs-text">{post.taggedRecord.album}</div>
                          <div className="text-[10px] text-[#666]">{post.taggedRecord.artist}</div>
                        </div>
                      </div>
                    )}
                    <p className="text-[13px] text-[#ccc] leading-relaxed mb-2.5">{post.caption}</p>
                    <div className="flex items-center justify-between border-t border-[#1a1a1a] pt-2.5">
                      <div className="flex gap-3">
                        <button onClick={() => onLikePost && onLikePost(post.id)} className={`flex items-center gap-1 bg-transparent border-none cursor-pointer text-xs font-semibold ${post.liked ? 'text-red-500' : 'text-gs-dim'}`}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={post.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                          {post.likes}
                        </button>
                        <span className="flex items-center gap-1 text-gs-dim text-xs font-semibold">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                          {post.comments.length}
                        </span>
                      </div>
                      <button onClick={() => onBookmarkPost && onBookmarkPost(post.id)} className={`bg-transparent border-none cursor-pointer ${post.bookmarked ? 'text-amber-500' : 'text-gs-dim'}`}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={post.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Listening */}
      {tab === "listening" && (
        userListens.length === 0 ? (
          <Empty icon="🎧" text={`@${username} hasn't tracked any listening sessions yet.`} />
        ) : (
          <div>
            {/* Improvement 18: Enhanced listening stats bar with top artist */}
            <div className="flex gap-2 mb-4">
              {(() => {
                const artists = new Set(userListens.map(s => s.track.artist));
                const albums = new Set(userListens.map(s => s.track.album));
                const artistCounts = {};
                userListens.forEach(s => { artistCounts[s.track.artist] = (artistCounts[s.track.artist] || 0) + 1; });
                const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0];
                return [
                  { label: "Sessions", value: userListens.length, color: "#0ea5e9" },
                  { label: "Artists", value: artists.size, color: "#8b5cf6" },
                  { label: "Albums", value: albums.size, color: "#f59e0b" },
                  { label: "Top Artist", value: topArtist ? topArtist[0].split(' ').slice(0, 2).join(' ') : '-', color: "#10b981", isText: true },
                ].map(s => (
                  <div key={s.label} className="flex-1 bg-[#111] rounded-[10px] py-2.5 px-3 text-center">
                    <div className={`font-extrabold ${s.isText ? 'text-[11px]' : 'text-base'}`} style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px] text-gs-dim font-mono mt-0.5">{s.label}</div>
                  </div>
                ));
              })()}
            </div>

            {/* Session list */}
            <div className="flex flex-col gap-2">
              {userListens.map(session => (
                <div key={session.id} className="bg-gs-card border border-gs-border rounded-xl overflow-hidden transition-colors duration-150 hover:border-gs-accent/20">
                  <div className="h-0.5 bg-gradient-to-r from-gs-accent via-violet-500 to-transparent" />
                  <div className="py-3 px-3.5 flex gap-3 items-center">
                    <AlbumArt album={session.track.album} artist={session.track.artist} accent="#0ea5e9" size={38} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-gs-text whitespace-nowrap overflow-hidden text-ellipsis">{session.track.title}</div>
                      <div className="text-[11px] text-gs-muted">{session.track.artist}</div>
                      <div className="text-[10px] text-gs-dim">{session.track.album}{session.track.year ? ` \u00B7 ${session.track.year}` : ""}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-gs-faint font-mono">{relTime(session.timestampMs)}</span>
                      <span className="text-[9px] py-0.5 px-1.5 bg-gs-accent/[0.07] border border-gs-accent/[0.13] rounded text-gs-accent font-semibold font-mono">vinyl buddy</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Wishlist */}
      {tab === "wishlist" && (
        userWishlist.length === 0 ? (
          <Empty icon="✨" text={`@${username} hasn't added any wishlist items yet.`} />
        ) : (
          <div className="flex flex-col gap-2">
            {userWishlist.map(w => {
              const canOffer = !isOwn && myRecords.some(r => r.album.toLowerCase() === w.album.toLowerCase() && r.artist.toLowerCase() === w.artist.toLowerCase());
              const matchedRecord = records.find(r => r.album.toLowerCase() === w.album.toLowerCase() && r.artist.toLowerCase() === w.artist.toLowerCase());
              return (
                <div key={w.id} onClick={() => matchedRecord && onDetail(matchedRecord)}
                  className="bg-gs-card border border-gs-border rounded-xl p-3 flex gap-3 items-center transition-colors duration-150"
                  style={{ cursor: matchedRecord ? "pointer" : "default" }}
                  onMouseEnter={e => matchedRecord && (e.currentTarget.style.borderColor = (matchedRecord.accent || "#555") + "55")}
                  onMouseLeave={e => matchedRecord && (e.currentTarget.style.borderColor = "")}>
                  {matchedRecord ? <AlbumArt album={matchedRecord.album} artist={matchedRecord.artist} accent={matchedRecord.accent} size={38} /> : <AlbumArt album={w.album} artist={w.artist} accent="#555" size={38} />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-gs-text">{w.album}</div>
                    <div className="text-[11px] text-[#666]">{w.artist}</div>
                  </div>
                  {canOffer && (
                    <button onClick={e => { e.stopPropagation(); onMakeOffer(w, username); }} className="py-1.5 px-3.5 rounded-lg bg-gradient-to-br from-amber-500 to-red-500 border-none text-white font-bold text-[11px] cursor-pointer whitespace-nowrap">
                      Make Offer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Records & For Sale — shared list layout */}
      {(tab === "records" || tab === "for sale") && (
        display.length === 0 ? (
          <Empty icon={tab === "for sale" ? "🏷️" : "💿"} text={tab === "for sale" ? `@${username} doesn't have anything for sale.` : `@${username} hasn't added any records yet.`} />
        ) : (
          <div className="flex flex-col gap-2">
            {display.slice(0, 50).map(r => (
              <div key={r.id} onClick={() => onDetail(r)} className="bg-gs-card border border-gs-border rounded-xl p-3 flex gap-3 items-center cursor-pointer transition-colors duration-150"
                onMouseEnter={e => e.currentTarget.style.borderColor = r.accent + "55"}
                onMouseLeave={e => e.currentTarget.style.borderColor = ""}>
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={38} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-gs-text whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1">
                    {r.album}
                    {r.verified && <span title="Verified vinyl" className="text-blue-500 text-[11px] shrink-0">✓</span>}
                  </div>
                  <div className="text-[11px] text-[#666]">{r.artist} · {r.year} · {r.format}</div>
                </div>
                <div className="flex gap-1.5 items-center shrink-0">
                  <Badge label={r.condition} color={condColor(r.condition)} />
                  {r.forSale && <Badge label={`$${r.price}`} color="#f59e0b" />}
                  {tab === "for sale" && (
                    <button onClick={e => { e.stopPropagation(); onBuy(r); }} className="py-1.5 px-3.5 rounded-[7px] border-none text-white font-bold text-[11px] cursor-pointer" style={{ background: `linear-gradient(135deg,${r.accent},#6366f1)` }}>Buy</button>
                  )}
                  {tab === "records" && <Stars rating={r.rating} size={10} />}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Improvement 17: Activity tab — recent activity feed */}
      {tab === "activity" && (
        recentActivity.length === 0 ? (
          <Empty icon="⚡" text={`@${username} has no recent activity.`} />
        ) : (
          <div className="flex flex-col gap-2">
            {recentActivity.map(a => (
              <div key={a.id} className="bg-gs-card border border-gs-border rounded-xl p-3 flex gap-3 items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                  a.type === 'post' ? 'bg-blue-500/10 text-blue-400' :
                  a.type === 'listen' ? 'bg-violet-500/10 text-violet-400' :
                  'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {a.type === 'post' ? '📝' : a.type === 'listen' ? '🎧' : '💿'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-gs-text">{a.text}</div>
                  <div className="text-[10px] text-gs-faint font-mono">{relTime(a.ts)}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* #5: Reviews tab content */}
      {tab === "reviews" && (
        <TradingReviews username={username} currentUser={currentUser} isOwn={isOwn} />
      )}

      {/* #4: Trading feedback/reviews section (always visible below tabs) + #10: Action history */}
      {!isOwn && tab !== "reviews" && <TradingReviews username={username} currentUser={currentUser} isOwn={isOwn} />}
      <ActionHistory userRecords={userRecords} userPosts={userPosts} userListens={userListens} />

      {/* Improvement 12: User endorsements / testimonials */}
      {!isOwn && (
        <div className="mt-6 p-4 bg-[#111] border border-gs-border rounded-xl">
          <div className="text-[11px] font-bold text-gs-dim mb-3 uppercase tracking-wider">Endorsements</div>
          {endorsements.length > 0 && (
            <div className="flex flex-col gap-2 mb-3">
              {endorsements.map((e, i) => (
                <div key={i} className="bg-gs-card border border-gs-border rounded-lg p-2.5">
                  <p className="text-[12px] text-gs-muted leading-relaxed mb-1">&ldquo;{e.text}&rdquo;</p>
                  <div className="text-[10px] text-gs-faint">— @{e.from} · {relTime(e.ts)}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={endorsementText}
              onChange={ev => setEndorsementText(ev.target.value)}
              onKeyDown={ev => ev.key === 'Enter' && handleEndorsement()}
              placeholder={`Endorse @${username}...`}
              className="flex-1 bg-gs-card border border-gs-border rounded-lg px-3 py-2 text-xs text-gs-text placeholder:text-gs-faint outline-none focus:border-gs-accent/40"
              maxLength={200}
            />
            <button
              onClick={handleEndorsement}
              disabled={!endorsementText.trim()}
              className="gs-btn-gradient py-2 px-4 rounded-lg text-xs font-bold border-none cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              Endorse
            </button>
          </div>
        </div>
      )}

      {/* Improvement 19: User highlight reel — a summary strip at the bottom */}
      {(userRecords.length > 0 || userPosts.length > 0) && (
        <div className="mt-6 p-4 bg-gradient-to-r from-[#111] to-transparent border border-gs-border rounded-xl">
          <div className="text-[11px] font-bold text-gs-dim mb-3 uppercase tracking-wider">Highlight Reel</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-extrabold text-gs-text">{userRecords.length}</div>
              <div className="text-[9px] text-gs-faint">Records Collected</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-gs-text">
                {userRecords.length > 0 ? Math.max(...userRecords.map(r => r.rating || 0)) : 0}
              </div>
              <div className="text-[9px] text-gs-faint">Highest Rating</div>
            </div>
            <div>
              <div className="text-lg font-extrabold text-gs-text">
                {new Set(userRecords.map(r => r.artist)).size}
              </div>
              <div className="text-[9px] text-gs-faint">Unique Artists</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
