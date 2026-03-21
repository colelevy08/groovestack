// Marketplace screen — unified discovery + shopping.
// "Browse" mode shows all records in a Card grid; "Shop" mode shows for-sale records in a marketplace list.
// Both modes share the search bar and genre filtering.
// When a genre is selected, subgenre pills appear for finer filtering.
// When no search or genre filter is active (in browse mode), shows a "Collectors to Discover" row.
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import Paginated from '../Paginated';
import Empty from '../ui/Empty';
import { GENRES, GENRE_MAP, CONDITIONS, USER_PROFILES, USER_WISHLISTS } from '../../constants';
import { getProfile, condColor } from '../../utils/helpers';

// Improvement A1: Simulated record weight/pressing info based on format + year
const getPressingInfo = (record) => {
  const format = (record.format || '').toLowerCase();
  let weight = '140g';
  let pressing = 'Standard';
  if (format.includes('180') || (record.year && record.year >= 2010)) weight = '180g';
  if (record.year && record.year < 1975) { pressing = 'Original pressing'; weight = '120g'; }
  else if (record.year && record.year < 1990) pressing = 'Early pressing';
  else if (record.year && record.year >= 2015) pressing = 'Reissue';
  return { weight, pressing };
};

// Improvement A4: Auction countdown timer helper
const getAuctionCountdown = (record) => {
  if (!record.forSale) return null;
  // Simulate auction end times deterministically based on record id
  const hoursLeft = (record.id * 7 + 3) % 72;
  if (hoursLeft > 48) return null; // Only some records have auctions
  const h = Math.floor(hoursLeft);
  const m = (record.id * 13) % 60;
  return { hours: h, minutes: m, urgent: h < 6 };
};

// Improvement A3: Seller trust score (deterministic from username)
const getSellerTrustScore = (username) => {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = ((hash << 5) - hash + username.charCodeAt(i)) | 0;
  return 70 + (Math.abs(hash) % 30); // 70-99
};

// Improvement A9: Shipping speed estimates
const getShippingEstimate = (record) => {
  const score = getSellerTrustScore(record.user || '');
  if (score >= 95) return { label: '1-2 days', speed: 'fast' };
  if (score >= 85) return { label: '2-4 days', speed: 'medium' };
  return { label: '5-7 days', speed: 'slow' };
};

// Improvement A10: Price drop notification localStorage
const PRICE_DROP_ALERTS_KEY = 'gs-price-drop-alerts';
const loadPriceDropAlerts = () => {
  try {
    const raw = localStorage.getItem(PRICE_DROP_ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
const persistPriceDropAlerts = (ids) => {
  try { localStorage.setItem(PRICE_DROP_ALERTS_KEY, JSON.stringify(ids)); }
  catch { /* localStorage full or unavailable */ }
};

// Estimate heuristic: base price by condition with year multiplier
function estimateValue(condition, year) {
  const basePrices = { M: 40, NM: 30, 'VG+': 22, VG: 15, 'G+': 10, G: 7, F: 5, P: 3 };
  const base = basePrices[condition] || 15;
  let yearMult = 1.0;
  if (year && year < 1970) yearMult = 1.6;
  else if (year && year < 1980) yearMult = 1.4;
  else if (year && year < 1990) yearMult = 1.2;
  else if (year && year < 2000) yearMult = 1.0;
  else if (year) yearMult = 0.9;
  return Math.round(base * yearMult);
}

// Count how many users have this record on their wishlist
function getWantCount(record) {
  if (!record) return 0;
  return Object.values(USER_WISHLISTS).filter(items =>
    items.some(w => w.album.toLowerCase() === record.album.toLowerCase() && w.artist.toLowerCase() === record.artist.toLowerCase())
  ).length;
}

const COND_RANK = { M: 8, NM: 7, "VG+": 6, VG: 5, "G+": 4, G: 3, F: 2, P: 1 };

// Improvement 1: "New this week" helper — records added within last 7 days (simulated via id threshold)
const isNewThisWeek = (record, allRecords) => {
  const maxId = Math.max(...allRecords.map(r => r.id));
  return record.id > maxId - Math.ceil(allRecords.length * 0.15);
};

// Improvement 2: Record of the Day — deterministic daily pick based on date
const getRecordOfTheDay = (records) => {
  if (records.length === 0) return null;
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return records[seed % records.length];
};

// ── Improvement B1: Seller location data (simulated) ─────────────────
const SELLER_LOCATIONS = {
  'New York': { lat: 40.7, lng: -74.0 }, 'Los Angeles': { lat: 34.1, lng: -118.2 },
  'Chicago': { lat: 41.9, lng: -87.6 }, 'Nashville': { lat: 36.2, lng: -86.8 },
  'Austin': { lat: 30.3, lng: -97.7 }, 'Portland': { lat: 45.5, lng: -122.7 },
  'Seattle': { lat: 47.6, lng: -122.3 }, 'London': { lat: 51.5, lng: -0.1 },
  'Tokyo': { lat: 35.7, lng: 139.7 }, 'Berlin': { lat: 52.5, lng: 13.4 },
};
const CITY_NAMES = Object.keys(SELLER_LOCATIONS);
const getSellerCity = (username) => {
  let h = 0;
  for (let i = 0; i < (username || '').length; i++) h = ((h << 5) - h + username.charCodeAt(i)) | 0;
  return CITY_NAMES[Math.abs(h) % CITY_NAMES.length];
};

// ── Improvement B2: Record rarity scoring algorithm ──────────────────
const computeRarityScore = (record, allRecords) => {
  let score = 0;
  // Fewer copies = rarer
  const copies = allRecords.filter(r => r.album === record.album && r.artist === record.artist).length;
  if (copies === 1) score += 40;
  else if (copies <= 3) score += 25;
  else score += 10;
  // Age bonus
  if (record.year && record.year < 1970) score += 30;
  else if (record.year && record.year < 1985) score += 20;
  else if (record.year && record.year < 2000) score += 10;
  // Condition bonus for high-grade old records
  const cRank = COND_RANK[record.condition] || 0;
  if (record.year && record.year < 1980 && cRank >= 6) score += 15;
  // Format bonus
  const fmt = (record.format || '').toLowerCase();
  if (fmt.includes('limited') || fmt.includes('picture disc') || fmt.includes('colored')) score += 15;
  return Math.min(score, 100);
};
const rarityLabel = (score) => {
  if (score >= 80) return { text: 'Ultra Rare', color: '#ef4444' };
  if (score >= 60) return { text: 'Rare', color: '#f59e0b' };
  if (score >= 40) return { text: 'Uncommon', color: '#8b5cf6' };
  return { text: 'Common', color: '#6b7280' };
};

// ── Improvement B3: Price trend mini chart data (simulated) ──────────
const generatePriceTrend = (record) => {
  const basePrice = record.price || 15;
  const points = [];
  let h = 0;
  const s = String(record.id);
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  for (let i = 0; i < 6; i++) {
    const variance = ((h * (i + 1)) % 20) - 10;
    points.push(Math.max(1, basePrice + variance));
  }
  points.push(basePrice); // current price last
  return points;
};

// ── Improvement B4: Seller response rate badge ───────────────────────
const getSellerResponseRate = (username) => {
  let h = 0;
  for (let i = 0; i < (username || '').length; i++) h = ((h << 5) - h + username.charCodeAt(i)) | 0;
  const rate = 60 + (Math.abs(h) % 40); // 60-99%
  const avgHrs = 1 + (Math.abs(h * 3) % 24);
  return { rate, avgHrs, fast: avgHrs <= 4 };
};

// ── Improvement B5: Bundle deal suggestions ──────────────────────────
const findBundleDeals = (records) => {
  const sellerGroups = {};
  records.filter(r => r.forSale).forEach(r => {
    if (!sellerGroups[r.user]) sellerGroups[r.user] = [];
    sellerGroups[r.user].push(r);
  });
  return Object.entries(sellerGroups)
    .filter(([, recs]) => recs.length >= 2)
    .map(([seller, recs]) => {
      const bundleRecs = recs.slice(0, 3);
      const total = bundleRecs.reduce((s, r) => s + (r.price || 0), 0);
      const discount = Math.round(total * 0.1);
      return { seller, records: bundleRecs, total, discount, bundlePrice: total - discount };
    })
    .sort((a, b) => b.discount - a.discount)
    .slice(0, 3);
};

// ── Improvement B6: Time-limited deals helper ────────────────────────
const getTimeLimitedDeals = (records) => {
  const now = new Date();
  const seed = now.getHours() * 60 + now.getMinutes();
  return records
    .filter(r => r.forSale)
    .sort((a, b) => ((a.id * seed) % 47) - ((b.id * seed) % 47))
    .slice(0, 4)
    .map(r => {
      const minutesLeft = 30 + ((r.id * 11) % 90);
      const discountPct = 10 + ((r.id * 7) % 20);
      return { ...r, minutesLeft, discountPct, salePrice: Math.round(r.price * (1 - discountPct / 100)) };
    });
};

// ── Improvement B7: Verified condition badge ─────────────────────────
const isConditionVerified = (record) => {
  const trust = getSellerTrustScore(record.user || '');
  return trust >= 90 && (COND_RANK[record.condition] || 0) >= 5;
};

// ── Improvement B9: Matrix number display (simulated) ────────────────
const getMatrixNumber = (record) => {
  let h = 0;
  const s = `${record.artist}${record.album}${record.year}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  const prefix = record.artist ? record.artist.slice(0, 2).toUpperCase() : 'XX';
  return `${prefix}-${Math.abs(h).toString(36).toUpperCase().slice(0, 6)}`;
};

// ── Improvement B10: Catalog number (simulated) ──────────────────────
const getCatalogNumber = (record) => {
  let h = 0;
  const s = String(record.id) + (record.album || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  const labels = ['COL', 'ATL', 'DEF', 'SUB', 'WAR', 'VRV', 'CAP', 'MCA'];
  const label = labels[Math.abs(h) % labels.length];
  return `${label}-${Math.abs(h % 99999).toString().padStart(5, '0')}`;
};

// ── Improvement B11: Label data (simulated) ──────────────────────────
const LABELS = ['Columbia', 'Atlantic', 'Def Jam', 'Sub Pop', 'Warner Bros', 'Verve', 'Capitol', 'MCA', 'Blue Note', 'Motown', 'Island', 'Rough Trade'];
const getRecordLabel = (record) => {
  let h = 0;
  const s = String(record.id);
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return LABELS[Math.abs(h) % LABELS.length];
};

// ── Improvement B12: Decade helpers ──────────────────────────────────
const DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const getDecade = (year) => {
  if (!year) return null;
  const d = Math.floor(year / 10) * 10;
  return `${d}s`;
};

// ── Improvement B13: Format list ─────────────────────────────────────
const FORMAT_SECTIONS = ['12" Vinyl', '7" Vinyl', '10" Vinyl', 'LP', 'EP', 'CD', 'Cassette'];

// ── PriceTrendMiniChart component ────────────────────────────────────
function PriceTrendMiniChart({ points }) {
  if (!points || points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const w = 60;
  const h = 20;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const trending = points[points.length - 1] > points[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <path d={path} fill="none" stroke={trending ? '#22c55e' : '#ef4444'} strokeWidth="1.5" />
      <circle cx={w} cy={h - ((points[points.length - 1] - min) / range) * h} r="2" fill={trending ? '#22c55e' : '#ef4444'} />
    </svg>
  );
}

// Improvement 3: Saved search filters with localStorage
const SAVED_FILTERS_KEY = 'gs-saved-search-filters';
const loadSavedFilters = () => {
  try {
    const raw = localStorage.getItem(SAVED_FILTERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const persistSavedFilters = (filters) => {
  try {
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    // localStorage full or unavailable
  }
};

// Improvement 4: Recently viewed trail with localStorage
const RECENTLY_VIEWED_KEY = 'gs-recently-viewed';
const loadRecentlyViewed = () => {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const persistRecentlyViewed = (ids) => {
  try {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(ids.slice(0, 20)));
  } catch {
    // localStorage full or unavailable
  }
};

// #7 — Skeleton loading placeholders
function SkeletonCard() {
  return (
    <div className="gs-card">
      <div className="h-0.5 gs-skeleton" />
      <div className="p-4">
        <div className="flex gap-2 mb-3 items-center">
          <div className="w-[30px] h-[30px] rounded-full gs-skeleton" />
          <div className="flex-1">
            <div className="h-3 w-24 gs-skeleton mb-1" />
            <div className="h-2.5 w-16 gs-skeleton" />
          </div>
        </div>
        <div className="flex gap-3 mb-3">
          <div className="w-[68px] h-[68px] rounded-xl gs-skeleton shrink-0" />
          <div className="flex-1">
            <div className="h-4 w-3/4 gs-skeleton mb-2" />
            <div className="h-3 w-1/2 gs-skeleton mb-2" />
            <div className="h-2.5 w-2/3 gs-skeleton" />
          </div>
        </div>
        <div className="flex gap-1.5 mb-2.5">
          <div className="h-5 w-12 rounded-full gs-skeleton" />
          <div className="h-5 w-16 rounded-full gs-skeleton" />
          <div className="h-5 w-10 rounded-full gs-skeleton" />
        </div>
        <div className="border-t border-gs-border pt-2.5 flex justify-between">
          <div className="flex gap-3">
            <div className="h-4 w-10 gs-skeleton" />
            <div className="h-4 w-10 gs-skeleton" />
          </div>
          <div className="h-4 w-4 gs-skeleton" />
        </div>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-2.5">
      {[1,2,3,4].map(i => (
        <div key={i} className="gs-card p-4 flex gap-3.5 items-center">
          <div className="w-[52px] h-[52px] rounded-xl gs-skeleton shrink-0" />
          <div className="flex-1">
            <div className="h-4 w-40 gs-skeleton mb-2" />
            <div className="h-3 w-28 gs-skeleton mb-2" />
            <div className="h-2.5 w-32 gs-skeleton" />
          </div>
          <div className="text-right">
            <div className="h-7 w-14 gs-skeleton mb-2" />
            <div className="flex gap-1.5">
              <div className="h-8 w-16 rounded-lg gs-skeleton" />
              <div className="h-8 w-20 rounded-lg gs-skeleton" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Improvement 5: Price histogram visualization component
function PriceHistogram({ records }) {
  const buckets = useMemo(() => {
    const ranges = [
      { label: '<$10', min: 0, max: 10 },
      { label: '$10-25', min: 10, max: 25 },
      { label: '$25-50', min: 25, max: 50 },
      { label: '$50-100', min: 50, max: 100 },
      { label: '$100+', min: 100, max: Infinity },
    ];
    const counts = ranges.map(r => ({
      ...r,
      count: records.filter(rec => rec.price >= r.min && rec.price < r.max).length,
    }));
    const max = Math.max(...counts.map(c => c.count), 1);
    return counts.map(c => ({ ...c, pct: (c.count / max) * 100 }));
  }, [records]);

  return (
    <div className="flex items-end gap-1 h-10">
      {buckets.map(b => (
        <div key={b.label} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full bg-gs-accent/30 rounded-t-sm transition-all duration-300"
            style={{ height: `${Math.max(b.pct, 4)}%` }}
            title={`${b.label}: ${b.count} records`}
          />
          <span className="text-[8px] text-gs-faint font-mono">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

// Fix: destructure all used callbacks explicitly instead of relying on ...handlers spread
// which caused onBuy/onViewUser/onViewArtist to appear in both explicit params and handlers
// Fix: accept currentUser so OWNED badge works for the actual logged-in user
export default function ExploreScreen({ records, currentUser, onViewUser, onBuy, onAddToCart, onViewArtist, onLike, onSave, onComment, onDetail, onDelete, ...handlers }) {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("All");
  const [subgenre, setSubgenre] = useState(null);
  const [mode, setMode] = useState("browse"); // "browse" | "shop"
  const [sort, setSort] = useState("newest");
  const [viewMode, setViewMode] = useState("grid"); // #1 — grid | list | masonry toggle
  const [priceMin, setPriceMin] = useState(0); // #2 — price range filter
  const [priceMax, setPriceMax] = useState(500);
  const [condFilter, setCondFilter] = useState("All"); // #3 — condition filter
  const [isLoading] = useState(false); // #7 — loading state (skeleton)

  // Improvement 1: "New this week" filter badge
  const [newThisWeekOnly, setNewThisWeekOnly] = useState(false);

  // Improvement 3: Saved search filters
  const [savedFilters, setSavedFilters] = useState(loadSavedFilters);
  const [showSavedFilters, setShowSavedFilters] = useState(false);

  // Improvement 6: Bulk add to cart
  const [selectedForCart, setSelectedForCart] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Improvement 7: Show similar records
  const [similarTo, setSimilarTo] = useState(null);

  // Improvement 8: Infinite scroll option
  const [useInfiniteScroll, setUseInfiniteScroll] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const scrollSentinelRef = useRef(null);

  // Improvement 4: Recently viewed trail
  const [recentlyViewedIds, setRecentlyViewedIds] = useState(loadRecentlyViewed);

  // Improvement 9: Price comparison tooltip
  const [hoveredRecordId, setHoveredRecordId] = useState(null);

  // Improvement A1: AR record preview placeholder
  const [arPreviewRecord, setArPreviewRecord] = useState(null);

  // Improvement A5: Flash sale banner state
  const [flashSaleDismissed, setFlashSaleDismissed] = useState(false);

  // Improvement A10: Price drop notification toggle per record
  const [priceDropAlerts, setPriceDropAlerts] = useState(loadPriceDropAlerts);

  // Improvement A15: Quick compare tool — select 2 records to compare side by side
  const [compareList, setCompareList] = useState([]);
  const [showComparePanel, setShowComparePanel] = useState(false);

  // Improvement A14: Similar taste users section
  const [showSimilarTasteUsers, setShowSimilarTasteUsers] = useState(false);

  // Improvement A12: Sound sample preview placeholder
  const [soundPreviewRecordId, setSoundPreviewRecordId] = useState(null);

  // ── Improvement B1: Map view of sellers by location ────────────────
  const [showSellerMap, setShowSellerMap] = useState(false);

  // ── Improvement B5: Bundle deal suggestions toggle ─────────────────
  const [showBundleDeals, setShowBundleDeals] = useState(false);

  // ── Improvement B6: Time-limited deals section ─────────────────────
  const [showTimeLimitedDeals, setShowTimeLimitedDeals] = useState(true);

  // ── Improvement B10: Catalog number search ─────────────────────────
  const [catalogSearch, setCatalogSearch] = useState("");

  // ── Improvement B11: Label filter dropdown ─────────────────────────
  const [labelFilter, setLabelFilter] = useState("All");

  // ── Improvement B12: Decade filter with visual decade bar ──────────
  const [decadeFilter, setDecadeFilter] = useState("All");

  // ── Improvement B13: Format-specific browse sections toggle ────────
  const [showFormatSections, setShowFormatSections] = useState(false);

  // Micro-improvement 1: Lazy image loading with blur-up effect
  const [loadedImages, setLoadedImages] = useState(new Set());
  const markImageLoaded = useCallback((recordId) => {
    setLoadedImages(prev => { const next = new Set(prev); next.add(recordId); return next; });
  }, []);

  // Micro-improvement 2: Record card skeleton while loading (per-card basis)
  const [cardLoading, setCardLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setCardLoading(false), 400);
    return () => clearTimeout(timer);
  }, [q, genre, subgenre, condFilter]);

  // Micro-improvement 3: "Back to top" floating button
  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Micro-improvement 4: Grid animation key on filter change
  const [gridAnimKey, setGridAnimKey] = useState(0);
  useEffect(() => {
    setGridAnimKey(prev => prev + 1);
  }, [genre, subgenre, condFilter, sort, q, newThisWeekOnly]);

  // Improvement 10: Color-coded condition indicators (using condColor from helpers)
  // Already available via condColor, but we enhance usage in grid view

  // Improvement 11: Masonry layout option
  // Added as viewMode === "masonry"

  // Record of the Day
  const recordOfTheDay = useMemo(() => getRecordOfTheDay(records.filter(r => r.forSale)), [records]);

  // Track recently viewed
  const trackView = useCallback((record) => {
    setRecentlyViewedIds(prev => {
      const next = [record.id, ...prev.filter(id => id !== record.id)].slice(0, 20);
      persistRecentlyViewed(next);
      return next;
    });
    // Fix: use explicitly destructured onDetail instead of handlers.onDetail
    onDetail?.(record);
  }, [onDetail]);

  // Infinite scroll observer
  useEffect(() => {
    if (!useInfiniteScroll || mode !== "browse") return;
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleCount(prev => prev + 20);
      }
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [useInfiniteScroll, mode]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(20);
  }, [q, genre, subgenre, sort, newThisWeekOnly, catalogSearch, labelFilter, decadeFilter]);

  // Only show genre pills for genres that exist in the current records data
  const activeGenres = ["All", ...GENRES.filter(g => records.some(r => r.tags?.includes(g)))];

  // Subgenres for the selected genre (if any)
  const subgenres = genre !== "All" && GENRE_MAP[genre] ? GENRE_MAP[genre] : [];
  // Only show subgenres that have matching records
  const activeSubgenres = subgenres.filter(sg => records.some(r => r.tags?.includes(sg)));

  // Improvement 12: Advanced search with boolean operators
  const matchesAdvancedSearch = useCallback((record, query) => {
    if (!query) return true;
    const lower = query.toLowerCase();

    // Support OR operator
    if (lower.includes(' or ')) {
      const terms = lower.split(' or ').map(t => t.trim()).filter(Boolean);
      return terms.some(term => matchesSingleTerm(record, term));
    }
    // Support AND operator (default for space-separated terms)
    if (lower.includes(' and ')) {
      const terms = lower.split(' and ').map(t => t.trim()).filter(Boolean);
      return terms.every(term => matchesSingleTerm(record, term));
    }
    // Support NOT operator with minus prefix
    if (lower.startsWith('-')) {
      return !matchesSingleTerm(record, lower.slice(1).trim());
    }

    return matchesSingleTerm(record, lower);
  }, []);

  const matchesSingleTerm = (record, term) => {
    if (!term) return true;
    const isNegated = term.startsWith('-');
    const cleanTerm = isNegated ? term.slice(1).trim() : term;
    if (!cleanTerm) return true;
    const matches = (
      record.album.toLowerCase().includes(cleanTerm) ||
      record.artist.toLowerCase().includes(cleanTerm) ||
      (record.user || "").toLowerCase().includes(cleanTerm) ||
      record.tags?.some(t => t.toLowerCase().includes(cleanTerm))
    );
    return isNegated ? !matches : matches;
  };

  // Base filter: text search + genre + subgenre + new this week + label + decade + catalog (shared by both modes)
  const baseFiltered = useMemo(() => records.filter(r => {
    // B10: Catalog number search
    if (catalogSearch) {
      const cat = getCatalogNumber(r).toLowerCase();
      if (!cat.includes(catalogSearch.toLowerCase())) return false;
    }
    // B11: Label filter
    if (labelFilter !== "All") {
      if (getRecordLabel(r) !== labelFilter) return false;
    }
    // B12: Decade filter
    if (decadeFilter !== "All") {
      if (getDecade(r.year) !== decadeFilter) return false;
    }
    return (
      matchesAdvancedSearch(r, q) &&
      (genre === "All" || r.tags?.includes(genre)) &&
      (!subgenre || r.tags?.includes(subgenre)) &&
      (!newThisWeekOnly || isNewThisWeek(r, records))
    );
  }), [records, q, genre, subgenre, newThisWeekOnly, matchesAdvancedSearch, catalogSearch, labelFilter, decadeFilter]);

  // Improvement 7: Similar records logic
  const similarRecords = useMemo(() => {
    if (!similarTo) return [];
    const source = records.find(r => r.id === similarTo);
    if (!source) return [];
    return records
      .filter(r => r.id !== source.id)
      .map(r => {
        let score = 0;
        if (r.artist === source.artist) score += 5;
        if (r.tags && source.tags) {
          const shared = r.tags.filter(t => source.tags.includes(t));
          score += shared.length * 2;
        }
        if (r.year && source.year && Math.abs(r.year - source.year) <= 5) score += 1;
        if (r.format === source.format) score += 1;
        return { ...r, similarityScore: score };
      })
      .filter(r => r.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 8);
  }, [similarTo, records]);

  // #4 — Extended sort options: Newest, Price Low/High, Most Liked, Best Condition
  // Shop mode: further filter to for-sale only + price range + condition, then sort
  const shopRecords = useMemo(() => {
    let filtered = baseFiltered.filter(r => r.forSale);
    // #2 — Price range filter
    filtered = filtered.filter(r => r.price >= priceMin && r.price <= priceMax);
    // #3 — Condition filter
    if (condFilter !== "All") {
      filtered = filtered.filter(r => r.condition === condFilter);
    }
    return [...filtered].sort((a, b) =>
      sort === "price-asc" ? a.price - b.price :
      sort === "price-desc" ? b.price - a.price :
      sort === "likes" ? (b.likes || 0) - (a.likes || 0) :
      sort === "condition" ? (COND_RANK[b.condition] || 0) - (COND_RANK[a.condition] || 0) :
      b.id - a.id
    );
  }, [baseFiltered, sort, priceMin, priceMax, condFilter]);

  // Browse mode sort
  const browseSorted = useMemo(() => {
    if (sort === "newest" || mode !== "browse") return baseFiltered;
    return [...baseFiltered].sort((a, b) =>
      sort === "price-asc" ? (a.price || 0) - (b.price || 0) :
      sort === "price-desc" ? (b.price || 0) - (a.price || 0) :
      sort === "likes" ? (b.likes || 0) - (a.likes || 0) :
      sort === "condition" ? (COND_RANK[b.condition] || 0) - (COND_RANK[a.condition] || 0) :
      b.id - a.id
    );
  }, [baseFiltered, sort, mode]);

  // Fix: filter out current user instead of hardcoded "yourhandle" for suggested collectors
  const suggestedUsers = Object.keys(USER_PROFILES).filter(u => u !== currentUser).slice(0, 10);

  // When changing genre, clear subgenre
  const selectGenre = g => {
    setGenre(g);
    setSubgenre(null);
  };

  // Display records based on mode
  const displayRecords = mode === "shop" ? shopRecords : browseSorted;
  const totalRecords = mode === "shop" ? baseFiltered.filter(r => r.forSale).length : baseFiltered.length;

  // Improvement 9: Price comparison — average price for same album
  const getPriceComparison = useCallback((record) => {
    const sameAlbum = records.filter(r => r.album === record.album && r.forSale && r.id !== record.id);
    if (sameAlbum.length === 0) return null;
    const avg = sameAlbum.reduce((sum, r) => sum + r.price, 0) / sameAlbum.length;
    const diff = record.price - avg;
    return { avg: avg.toFixed(0), count: sameAlbum.length, diff };
  }, [records]);

  // Improvement 3: Save current filter state
  const saveCurrentFilter = () => {
    const filter = {
      id: Date.now(),
      label: q || `${genre}${subgenre ? ' / ' + subgenre : ''}`,
      q,
      genre,
      subgenre,
      sort,
      condFilter,
      priceMin,
      priceMax,
      newThisWeekOnly,
    };
    const updated = [filter, ...savedFilters].slice(0, 10);
    setSavedFilters(updated);
    persistSavedFilters(updated);
  };

  const applySavedFilter = (filter) => {
    setQ(filter.q || "");
    setGenre(filter.genre || "All");
    setSubgenre(filter.subgenre || null);
    setSort(filter.sort || "newest");
    setCondFilter(filter.condFilter || "All");
    setPriceMin(filter.priceMin ?? 0);
    setPriceMax(filter.priceMax ?? 500);
    setNewThisWeekOnly(filter.newThisWeekOnly || false);
    setShowSavedFilters(false);
  };

  const removeSavedFilter = (filterId) => {
    const updated = savedFilters.filter(f => f.id !== filterId);
    setSavedFilters(updated);
    persistSavedFilters(updated);
  };

  // Improvement 6: Bulk cart operations
  const toggleSelectForCart = (recordId) => {
    setSelectedForCart(prev => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const bulkAddToCart = () => {
    const toAdd = shopRecords.filter(r => selectedForCart.has(r.id));
    toAdd.forEach(r => onAddToCart(r));
    setSelectedForCart(new Set());
    setBulkMode(false);
  };

  // Improvement 4: Recently viewed records
  const recentlyViewedRecords = useMemo(() => {
    return recentlyViewedIds
      .map(id => records.find(r => r.id === id))
      .filter(Boolean)
      .slice(0, 6);
  }, [recentlyViewedIds, records]);

  // Improvement 13: Collection overlap indicator
  // Fix: use currentUser instead of hardcoded "yourhandle" so OWNED badges reflect actual user
  const myRecordAlbums = useMemo(() => {
    const myRecs = records.filter(r => r.user === currentUser);
    return new Set(myRecs.map(r => `${r.artist}::${r.album}`));
  }, [records, currentUser]);

  const isInMyCollection = useCallback((record) => {
    return myRecordAlbums.has(`${record.artist}::${record.album}`);
  }, [myRecordAlbums]);

  // New this week count for badge
  const newThisWeekCount = useMemo(() => {
    return records.filter(r => isNewThisWeek(r, records)).length;
  }, [records]);

  // Improvement A2: Record authenticity verification badges helper
  const getAuthBadge = useCallback((record) => {
    if (record.verified) return { label: 'Verified', color: '#3b82f6' };
    const trust = getSellerTrustScore(record.user || '');
    if (trust >= 95) return { label: 'Trusted Seller', color: '#22c55e' };
    return null;
  }, []);

  // Improvement A5: Flash sale records (top 3 cheapest for-sale below estimate)
  const flashSaleRecords = useMemo(() => {
    return records
      .filter(r => r.forSale && r.price <= estimateValue(r.condition, r.year) * 0.8)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3);
  }, [records]);

  // Improvement A6: Curated staff picks (deterministic selection of highly-rated records)
  const staffPicks = useMemo(() => {
    const candidates = records.filter(r => (r.likes || 0) >= 2 && r.forSale);
    const today = new Date();
    const seed = today.getFullYear() * 100 + today.getMonth();
    return candidates
      .sort((a, b) => ((a.id * seed) % 97) - ((b.id * seed) % 97))
      .slice(0, 4);
  }, [records]);

  // ── Improvement B1: Sellers by location data ────────────────────────
  const sellersByCity = useMemo(() => {
    const cityMap = {};
    const sellers = [...new Set(records.filter(r => r.forSale).map(r => r.user))];
    sellers.forEach(u => {
      const city = getSellerCity(u);
      if (!cityMap[city]) cityMap[city] = { city, coords: SELLER_LOCATIONS[city], sellers: [], recordCount: 0 };
      cityMap[city].sellers.push(u);
      cityMap[city].recordCount += records.filter(r => r.user === u && r.forSale).length;
    });
    return Object.values(cityMap).sort((a, b) => b.recordCount - a.recordCount);
  }, [records]);

  // ── Improvement B5: Bundle deal suggestions ────────────────────────
  const bundleDeals = useMemo(() => findBundleDeals(records), [records]);

  // ── Improvement B6: Time-limited deals ─────────────────────────────
  const timeLimitedDeals = useMemo(() => getTimeLimitedDeals(records), [records]);

  // ── Improvement B12: Decade distribution for visual bar ────────────
  const decadeDistribution = useMemo(() => {
    const counts = {};
    DECADES.forEach(d => { counts[d] = 0; });
    records.forEach(r => {
      const d = getDecade(r.year);
      if (d && counts[d] !== undefined) counts[d]++;
    });
    const max = Math.max(1, ...Object.values(counts));
    return DECADES.map(d => ({ decade: d, count: counts[d] || 0, pct: ((counts[d] || 0) / max) * 100 }));
  }, [records]);

  // ── Improvement B13: Records grouped by format ─────────────────────
  const recordsByFormat = useMemo(() => {
    const groups = {};
    records.forEach(r => {
      const fmt = r.format || 'Other';
      if (!groups[fmt]) groups[fmt] = [];
      groups[fmt].push(r);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [records]);

  // Improvement A7: "New Arrivals" auto-section
  const newArrivals = useMemo(() => {
    return records
      .filter(r => isNewThisWeek(r, records))
      .sort((a, b) => b.id - a.id)
      .slice(0, 8);
  }, [records]);

  // Improvement A10: Toggle price drop alert
  const togglePriceDropAlert = useCallback((recordId) => {
    setPriceDropAlerts(prev => {
      const next = prev.includes(recordId)
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId];
      persistPriceDropAlerts(next);
      return next;
    });
  }, []);

  // Improvement A11: Collector's edition detection
  const isCollectorsEdition = useCallback((record) => {
    const fmt = (record.format || '').toLowerCase();
    const album = (record.album || '').toLowerCase();
    return fmt.includes('limited') || fmt.includes('deluxe') || fmt.includes('collector') ||
           fmt.includes('colored') || fmt.includes('picture disc') ||
           album.includes('deluxe') || album.includes('collector') || album.includes('limited');
  }, []);

  // Improvement A14: Similar taste users based on collection overlap
  const similarTasteUsers = useMemo(() => {
    const myAlbums = new Set(records.filter(r => r.user === currentUser).map(r => `${r.artist}::${r.album}`));
    if (myAlbums.size === 0) return [];
    const userScores = {};
    records.forEach(r => {
      if (r.user === currentUser) return;
      const key = `${r.artist}::${r.album}`;
      if (myAlbums.has(key)) {
        userScores[r.user] = (userScores[r.user] || 0) + 1;
      }
    });
    return Object.entries(userScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([user, overlap]) => ({ user, overlap, profile: getProfile(user) }));
  }, [records, currentUser]);

  // Improvement A15: Compare helpers
  const toggleCompare = useCallback((record) => {
    setCompareList(prev => {
      if (prev.find(r => r.id === record.id)) return prev.filter(r => r.id !== record.id);
      if (prev.length >= 2) return [prev[1], record]; // Replace oldest
      return [...prev, record];
    });
  }, []);

  return (
    <div className="gs-page-transition">
      {/* Header with mode toggle */}
      <div className="flex justify-between items-start mb-3.5">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-[-0.04em] text-gs-text mb-0.5">Marketplace</h1>
          {/* #6 — Record count */}
          <p className="text-xs text-gs-dim">
            Showing {displayRecords.length} of {totalRecords} {mode === "shop" ? "for-sale records" : "records"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* #1 — View mode toggle (grid/list/masonry) */}
          {mode === "browse" && (
            <div className="flex gap-0.5 bg-gs-card border border-gs-border rounded-lg p-[2px]">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md border-none cursor-pointer transition-all duration-150 ${viewMode === "grid" ? "bg-gs-accent/15 text-gs-accent" : "bg-transparent text-gs-dim"}`}
                title="Grid view"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md border-none cursor-pointer transition-all duration-150 ${viewMode === "list" ? "bg-gs-accent/15 text-gs-accent" : "bg-transparent text-gs-dim"}`}
                title="List view"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
              {/* Improvement 11: Masonry view toggle */}
              <button
                onClick={() => setViewMode("masonry")}
                className={`p-1.5 rounded-md border-none cursor-pointer transition-all duration-150 ${viewMode === "masonry" ? "bg-gs-accent/15 text-gs-accent" : "bg-transparent text-gs-dim"}`}
                title="Masonry view"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="10"/><rect x="14" y="3" width="7" height="6"/><rect x="3" y="16" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/></svg>
              </button>
            </div>
          )}
          <div className="flex gap-1 bg-gs-card border border-gs-border rounded-[10px] p-[3px]">
            {[["browse", "Browse"], ["shop", "Shop"]].map(([val, label]) => (
              <button key={val} onClick={() => setMode(val)}
                className={`px-4 py-1.5 rounded-lg border-none text-xs font-semibold cursor-pointer transition-all duration-150 ${
                  mode === val
                    ? "bg-gradient-to-br from-gs-accent to-gs-indigo text-white"
                    : "bg-transparent text-gs-dim"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Improvement 14: Record of the Day highlight */}
      {mode === "shop" && recordOfTheDay && (
        <div
          className="mb-4 p-4 rounded-xl border border-gs-accent/30 bg-gradient-to-r from-gs-accent/5 to-gs-indigo/5 cursor-pointer"
          onClick={() => trackView(recordOfTheDay)}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-bold tracking-widest text-gs-accent font-mono">RECORD OF THE DAY</span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gs-accent animate-pulse" />
          </div>
          <div className="flex gap-3 items-center">
            <AlbumArt album={recordOfTheDay.album} artist={recordOfTheDay.artist} accent={recordOfTheDay.accent} size={56} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-gs-text truncate">{recordOfTheDay.album}</div>
              <div className="text-xs text-[#777]">{recordOfTheDay.artist} - {recordOfTheDay.year}</div>
              <div className="flex gap-1.5 items-center mt-1">
                <Badge label={recordOfTheDay.condition} color={condColor(recordOfTheDay.condition)} />
                <span className="text-[11px] text-gs-dim font-mono">{recordOfTheDay.format}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl font-extrabold text-gs-text">${recordOfTheDay.price}</div>
              <button
                onClick={e => { e.stopPropagation(); onAddToCart(recordOfTheDay); }}
                className="gs-btn-secondary py-1.5 px-3 text-[10px] font-bold rounded-lg mt-1"
              >
                + Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Improvement A5: Flash sale banner */}
      {mode === "shop" && !flashSaleDismissed && flashSaleRecords.length > 0 && (
        <div className="mb-4 p-3.5 rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-amber-500/10 relative">
          <button
            onClick={() => setFlashSaleDismissed(true)}
            className="absolute top-2 right-2 bg-transparent border-none text-gs-faint hover:text-gs-text cursor-pointer text-sm"
          >×</button>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-bold tracking-widest text-red-400 font-mono">FLASH SALE</span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {flashSaleRecords.map(r => (
              <div key={r.id} onClick={() => trackView(r)} className="shrink-0 flex gap-2 items-center bg-[#111] rounded-lg px-3 py-2 cursor-pointer hover:bg-[#1a1a1a] transition-colors">
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={36} />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-gs-text truncate max-w-[100px]">{r.album}</div>
                  <div className="text-[10px] text-gs-faint truncate max-w-[100px]">{r.artist}</div>
                  <div className="flex gap-1.5 items-center mt-0.5">
                    <span className="text-xs font-bold text-red-400">${r.price}</span>
                    <span className="text-[9px] text-gs-faint line-through">~${estimateValue(r.condition, r.year)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement A1: AR Record Preview Modal */}
      {arPreviewRecord && (
        <div className="mb-4 p-4 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold tracking-widest text-purple-400 font-mono">AR PREVIEW</span>
            <button onClick={() => setArPreviewRecord(null)} className="bg-transparent border-none text-gs-faint hover:text-gs-text cursor-pointer text-sm">×</button>
          </div>
          <div className="flex gap-4 items-center">
            <div className="w-[120px] h-[120px] rounded-xl border-2 border-dashed border-purple-500/30 flex items-center justify-center bg-[#111]">
              <div className="text-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="1.5" className="mx-auto mb-1"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M2 2l4 4M22 2l-4 4M2 22l4-4M22 22l-4-4"/></svg>
                <div className="text-[9px] text-purple-400 font-mono">Camera required</div>
              </div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-gs-text">{arPreviewRecord.album}</div>
              <div className="text-xs text-gs-dim mb-2">{arPreviewRecord.artist}</div>
              <div className="text-[10px] text-purple-300">Point your camera at a flat surface to preview this record in your space. AR preview coming soon.</div>
            </div>
          </div>
        </div>
      )}

      {/* Improvement A15: Compare panel */}
      {compareList.length > 0 && (
        <div className="mb-4 p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold tracking-widest text-cyan-400 font-mono">
              COMPARE {compareList.length === 1 ? '(select 1 more)' : ''}
            </span>
            <button onClick={() => { setCompareList([]); setShowComparePanel(false); }} className="bg-transparent border-none text-gs-faint hover:text-gs-text cursor-pointer text-xs">Clear</button>
          </div>
          {compareList.length === 2 && (
            <button
              onClick={() => setShowComparePanel(!showComparePanel)}
              className="text-[10px] px-3 py-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 cursor-pointer font-semibold mb-2"
            >
              {showComparePanel ? 'Hide Comparison' : 'Compare Side by Side'}
            </button>
          )}
          <div className="flex gap-3">
            {compareList.map(r => (
              <div key={r.id} className="flex-1 flex gap-2 items-center bg-[#111] rounded-lg px-2 py-1.5">
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-gs-text truncate">{r.album}</div>
                  <div className="text-[9px] text-gs-faint truncate">{r.artist}</div>
                </div>
                <button onClick={() => toggleCompare(r)} className="bg-transparent border-none text-gs-faint hover:text-red-400 cursor-pointer text-xs p-0">×</button>
              </div>
            ))}
          </div>
          {showComparePanel && compareList.length === 2 && (
            <div className="mt-3 pt-3 border-t border-cyan-500/20">
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                {compareList.map(r => {
                  const pressing = getPressingInfo(r);
                  const shipping = getShippingEstimate(r);
                  return (
                    <div key={r.id} className="space-y-1.5">
                      <div className="text-gs-text font-bold text-xs">{r.album}</div>
                      <div className="text-gs-dim">{r.artist} ({r.year})</div>
                      <div className="flex items-center gap-1"><span className="text-gs-faint">Condition:</span> <span style={{color: condColor(r.condition)}}>{r.condition}</span></div>
                      <div><span className="text-gs-faint">Format:</span> <span className="text-gs-muted">{r.format}</span></div>
                      <div><span className="text-gs-faint">Weight:</span> <span className="text-gs-muted">{pressing.weight}</span></div>
                      <div><span className="text-gs-faint">Pressing:</span> <span className="text-gs-muted">{pressing.pressing}</span></div>
                      {r.forSale && <div><span className="text-gs-faint">Price:</span> <span className="text-amber-400 font-bold">${r.price}</span></div>}
                      {r.forSale && <div><span className="text-gs-faint">Shipping:</span> <span className="text-gs-muted">{shipping.label}</span></div>}
                      <div><span className="text-gs-faint">Likes:</span> <span className="text-gs-muted">{r.likes || 0}</span></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-2">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-dim" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          aria-label="Search records"
          placeholder={mode === "shop" ? "Search for-sale records... (use AND, OR, -exclude)" : "Search albums, artists, users, genres... (use AND, OR, -exclude)"}
          className="w-full bg-gs-card border border-gs-border rounded-[10px] py-2.5 pr-20 pl-9 text-[#f0f0f0] text-[13px] outline-none font-sans focus:border-gs-accent/30"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Improvement 3: Save filter button */}
          {(q || genre !== "All" || condFilter !== "All" || newThisWeekOnly) && (
            <button
              onClick={saveCurrentFilter}
              className="bg-transparent border-none text-gs-faint hover:text-gs-accent cursor-pointer p-1 text-xs leading-none"
              title="Save this search"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          )}
          {/* Improvement 3: Saved filters toggle */}
          {savedFilters.length > 0 && (
            <button
              onClick={() => setShowSavedFilters(!showSavedFilters)}
              className={`bg-transparent border-none cursor-pointer p-1 text-xs leading-none ${showSavedFilters ? 'text-gs-accent' : 'text-gs-faint hover:text-gs-muted'}`}
              title="Saved searches"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          )}
          {q && (
            <button
              onClick={() => setQ("")}
              className="bg-transparent border-none text-gs-faint hover:text-gs-muted cursor-pointer p-0 text-sm leading-none"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Improvement 3: Saved filters dropdown */}
      {showSavedFilters && savedFilters.length > 0 && (
        <div className="mb-3 bg-gs-card border border-gs-border rounded-xl p-3 transition-all duration-200">
          <div className="text-[10px] font-bold text-gs-dim tracking-widest font-mono mb-2">SAVED SEARCHES</div>
          <div className="flex flex-col gap-1.5">
            {savedFilters.map(f => (
              <div key={f.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => applySavedFilter(f)}
                  className="flex-1 text-left bg-[#111] border border-gs-border rounded-lg px-3 py-2 text-xs text-gs-muted cursor-pointer hover:border-gs-accent/30 hover:text-gs-text transition-colors"
                >
                  {f.label || 'All records'}
                  {f.condFilter !== "All" && <span className="text-gs-faint ml-1.5">({f.condFilter})</span>}
                </button>
                <button
                  onClick={() => removeSavedFilter(f.id)}
                  className="bg-transparent border-none text-gs-faint hover:text-red-400 cursor-pointer text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Genre pills + sort + filter badges */}
      <div className={`flex justify-between items-center gap-3 ${activeSubgenres.length > 0 ? "mb-2" : "mb-[18px]"}`}>
        <div className="flex gap-1.5 flex-wrap flex-1 items-center">
          {activeGenres.map(g => (
            <button key={g} onClick={() => selectGenre(g)}
              className={`gs-pill text-[11px] font-semibold cursor-pointer ${
                genre === g ? "gs-pill-active" : ""
              }`}>
              {g}
            </button>
          ))}
          {/* Improvement 1: "New this week" filter badge */}
          <button
            onClick={() => setNewThisWeekOnly(!newThisWeekOnly)}
            className={`gs-pill text-[11px] font-semibold cursor-pointer flex items-center gap-1 ${
              newThisWeekOnly ? "gs-pill-active" : ""
            }`}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
            New ({newThisWeekCount})
          </button>
        </div>
        {/* #4 — Extended sort options for both modes */}
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="bg-gs-card border border-[#222] rounded-lg py-[7px] px-3 text-[#aaa] text-xs outline-none cursor-pointer shrink-0">
          <option value="newest">Newest</option>
          {mode === "shop" && <option value="price-asc">Price: Low to High</option>}
          {mode === "shop" && <option value="price-desc">Price: High to Low</option>}
          <option value="likes">Most Liked</option>
          <option value="condition">Best Condition</option>
        </select>
      </div>

      {/* Subgenre pills — shown when a parent genre is selected */}
      {activeSubgenres.length > 0 && (
        <div className="flex gap-[5px] flex-wrap mb-[18px]">
          <button
            onClick={() => setSubgenre(null)}
            className={`px-2.5 py-1 rounded-2xl border text-[10px] font-semibold cursor-pointer transition-colors ${
              !subgenre
                ? "bg-gs-indigo border-gs-indigo text-white"
                : "bg-gs-card border-[#1a1a1a] text-gs-dim"
            }`}
          >
            All {genre}
          </button>
          {activeSubgenres.map(sg => (
            <button key={sg} onClick={() => setSubgenre(sg)}
              className={`px-2.5 py-1 rounded-2xl border text-[10px] font-semibold cursor-pointer transition-colors ${
                subgenre === sg
                  ? "bg-gs-indigo border-gs-indigo text-white"
                  : "bg-gs-card border-[#1a1a1a] text-gs-dim"
              }`}>
              {sg}
            </button>
          ))}
        </div>
      )}

      {/* ── Improvement B11: Label filter dropdown ──────────────────────── */}
      <div className="flex gap-2 items-center mb-3 flex-wrap">
        <div>
          <span className="text-[10px] text-gs-dim font-mono mr-1.5">LABEL:</span>
          <select value={labelFilter} onChange={e => setLabelFilter(e.target.value)}
            className="bg-gs-card border border-[#222] rounded-lg py-[5px] px-2.5 text-[#aaa] text-[11px] outline-none cursor-pointer">
            <option value="All">All Labels</option>
            {LABELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        {/* ── Improvement B10: Catalog number search ───────────────────── */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gs-dim font-mono">CAT#:</span>
          <input
            type="text"
            value={catalogSearch}
            onChange={e => setCatalogSearch(e.target.value)}
            placeholder="Search catalog #..."
            className="bg-gs-card border border-[#222] rounded-lg py-[5px] px-2.5 text-[#aaa] text-[11px] outline-none w-[130px] placeholder:text-gs-faint focus:border-gs-accent/30"
          />
          {catalogSearch && (
            <button onClick={() => setCatalogSearch("")} className="bg-transparent border-none text-gs-faint hover:text-gs-text cursor-pointer text-xs p-0">x</button>
          )}
        </div>
      </div>

      {/* ── Improvement B12: Decade filter with visual decade bar ──────── */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-gs-dim font-mono">DECADE:</span>
          <button
            onClick={() => setDecadeFilter("All")}
            className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${decadeFilter === "All" ? "border-gs-accent bg-gs-accent/10 text-gs-accent" : "border-gs-border bg-transparent text-gs-dim"}`}
          >All</button>
        </div>
        <div className="flex gap-1 items-end h-10">
          {decadeDistribution.map(d => (
            <button
              key={d.decade}
              onClick={() => setDecadeFilter(decadeFilter === d.decade ? "All" : d.decade)}
              className={`flex-1 flex flex-col items-center gap-0.5 cursor-pointer bg-transparent border-none p-0 group`}
              title={`${d.decade}: ${d.count} records`}
            >
              <div
                className="w-full rounded-t-sm transition-all duration-300"
                style={{
                  height: `${Math.max(d.pct, 8)}%`,
                  background: decadeFilter === d.decade ? '#0ea5e9' : d.count > 0 ? '#0ea5e944' : '#1a1a1a',
                }}
              />
              <span className={`text-[8px] font-mono ${decadeFilter === d.decade ? 'text-gs-accent font-bold' : 'text-gs-faint'}`}>{d.decade.slice(2)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Improvement B1: Seller map view toggle ─────────────────────── */}
      {mode === "shop" && (
        <div className="mb-4">
          <button
            onClick={() => setShowSellerMap(!showSellerMap)}
            className={`gs-btn-secondary px-3.5 py-2 text-[11px] flex items-center gap-1.5 mb-2 ${showSellerMap ? 'text-gs-accent' : ''}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {showSellerMap ? 'Hide' : 'Show'} Seller Map
          </button>
          {showSellerMap && (
            <div className="bg-gs-card border border-gs-border rounded-xl p-3 overflow-hidden">
              <div className="text-[10px] text-gs-dim font-mono mb-2">SELLERS BY LOCATION</div>
              <svg width="100%" height="160" viewBox="0 0 400 160">
                <rect width="400" height="160" fill="#0a0a0a" rx="8" />
                {/* Simplified world outline */}
                <ellipse cx="200" cy="80" rx="180" ry="65" fill="none" stroke="#1a1a1a" strokeWidth="1" />
                <path d="M40,60 L80,40 L140,35 L200,30 L260,35 L320,45 L360,60 L350,90 L300,110 L240,120 L180,118 L120,108 L70,95 L45,80 Z" fill="#111" stroke="#222" strokeWidth="0.5" />
                {sellersByCity.map((c, i) => {
                  const x = 200 + (c.coords.lng / 180) * 170;
                  const y = 80 - (c.coords.lat / 90) * 60;
                  const r = Math.min(8, 3 + c.recordCount);
                  return (
                    <g key={c.city}>
                      <circle cx={x} cy={y} r={r} fill="#0ea5e9" opacity={0.5 + (c.recordCount / 20)}>
                        <animate attributeName="opacity" values={`${0.3 + i * 0.05};${0.7 + i * 0.03};${0.3 + i * 0.05}`} dur="3s" repeatCount="indefinite" />
                      </circle>
                      <text x={x} y={y - r - 3} fill="#0ea5e9" fontSize="7" textAnchor="middle" fontFamily="monospace">{c.city}</text>
                      <text x={x} y={y + r + 8} fill="#555" fontSize="6" textAnchor="middle" fontFamily="monospace">{c.recordCount} records</text>
                    </g>
                  );
                })}
              </svg>
              <div className="flex gap-2 flex-wrap mt-2">
                {sellersByCity.slice(0, 5).map(c => (
                  <span key={c.city} className="text-[9px] px-2 py-0.5 rounded-full bg-[#111] border border-gs-border text-gs-dim font-mono">
                    {c.city}: {c.sellers.length} seller{c.sellers.length !== 1 ? 's' : ''}, {c.recordCount} records
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Improvement B6: Time-limited deals section ─────────────────── */}
      {mode === "shop" && showTimeLimitedDeals && timeLimitedDeals.length > 0 && (
        <div className="mb-4 p-3.5 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-red-500/5 relative">
          <button onClick={() => setShowTimeLimitedDeals(false)} className="absolute top-2 right-2 bg-transparent border-none text-gs-faint hover:text-gs-text cursor-pointer text-sm">x</button>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-bold tracking-widest text-amber-400 font-mono">LIMITED TIME DEALS</span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {timeLimitedDeals.map(r => (
              <div key={r.id} onClick={() => trackView(r)} className="shrink-0 flex gap-2 items-center bg-[#111] rounded-lg px-3 py-2 cursor-pointer hover:bg-[#1a1a1a] transition-colors min-w-[180px]">
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={36} />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-gs-text truncate max-w-[100px]">{r.album}</div>
                  <div className="text-[10px] text-gs-faint truncate max-w-[100px]">{r.artist}</div>
                  <div className="flex gap-1.5 items-center mt-0.5">
                    <span className="text-xs font-bold text-amber-400">${r.salePrice}</span>
                    <span className="text-[9px] text-gs-faint line-through">${r.price}</span>
                    <span className="text-[8px] px-1 py-px rounded bg-red-500/20 text-red-400 font-bold">-{r.discountPct}%</span>
                  </div>
                  <div className="text-[8px] text-amber-400/70 font-mono mt-0.5">{r.minutesLeft}m left</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Improvement B5: Bundle deal suggestions ────────────────────── */}
      {mode === "shop" && (
        <div className="mb-4">
          <button
            onClick={() => setShowBundleDeals(!showBundleDeals)}
            className={`gs-btn-secondary px-3.5 py-2 text-[11px] flex items-center gap-1.5 mb-2 ${showBundleDeals ? 'text-green-400' : ''}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>
            {showBundleDeals ? 'Hide' : 'Show'} Bundle Deals ({bundleDeals.length})
          </button>
          {showBundleDeals && bundleDeals.length > 0 && (
            <div className="flex flex-col gap-2">
              {bundleDeals.map((bundle, bi) => (
                <div key={bi} className="bg-gs-card border border-green-500/20 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-gs-dim">Bundle from <button onClick={() => onViewUser(bundle.seller)} className="bg-transparent border-none text-gs-accent cursor-pointer text-[10px] p-0 font-mono">@{bundle.seller}</button></span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-bold">Save ${bundle.discount}</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {bundle.records.map(r => (
                      <div key={r.id} className="shrink-0 flex gap-2 items-center bg-[#111] rounded-lg px-2 py-1.5">
                        <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={28} />
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-gs-text truncate max-w-[80px]">{r.album}</div>
                          <div className="text-[9px] text-gs-faint">${r.price}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1a1a1a]">
                    <div className="text-[10px] text-gs-dim">
                      <span className="line-through mr-1.5">${bundle.total}</span>
                      <span className="text-green-400 font-bold">${bundle.bundlePrice}</span>
                    </div>
                    <button onClick={() => bundle.records.forEach(r => onAddToCart(r))} className="gs-btn-gradient px-3 py-1 text-[10px]">Add Bundle to Cart</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Improvement B13: Format-specific browse sections ───────────── */}
      {mode === "browse" && !q && (
        <div className="mb-4">
          <button
            onClick={() => setShowFormatSections(!showFormatSections)}
            className={`gs-btn-secondary px-3.5 py-2 text-[11px] flex items-center gap-1.5 mb-2 ${showFormatSections ? 'text-gs-accent' : ''}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            {showFormatSections ? 'Hide' : 'Browse by'} Format
          </button>
          {showFormatSections && (
            <div className="flex flex-col gap-3">
              {recordsByFormat.slice(0, 5).map(([fmt, recs]) => (
                <div key={fmt}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-gs-dim font-mono tracking-wider">{fmt.toUpperCase()} ({recs.length})</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {recs.slice(0, 8).map(r => (
                      <div key={r.id} onClick={() => trackView(r)} className="shrink-0 flex gap-2 items-center bg-gs-card border border-gs-border rounded-lg px-2.5 py-2 cursor-pointer hover:border-gs-accent/30 transition-colors">
                        <AlbumArt album={r.album} artist={r.artist} accent={r.accent || "#555"} size={32} />
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold text-gs-muted truncate max-w-[90px]">{r.album}</div>
                          <div className="text-[9px] text-gs-faint truncate max-w-[90px]">{r.artist}</div>
                          {r.forSale && <span className="text-[9px] text-amber-400 font-bold">${r.price}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* #2 — Price range filter + #3 — Condition filter (Shop mode) */}
      {mode === "shop" && (
        <div className="flex gap-4 items-end mb-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="text-[10px] text-gs-dim font-mono mb-1.5 flex justify-between">
              <span>PRICE RANGE</span>
              <span className="text-gs-muted">${priceMin} — ${priceMax}</span>
            </div>
            <div className="flex gap-2 items-center">
              <input type="range" min="0" max="500" step="5" value={priceMin}
                onChange={e => setPriceMin(Math.min(Number(e.target.value), priceMax - 5))}
                className="gs-range-slider flex-1" />
              <input type="range" min="0" max="500" step="5" value={priceMax}
                onChange={e => setPriceMax(Math.max(Number(e.target.value), priceMin + 5))}
                className="gs-range-slider flex-1" />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gs-dim font-mono mb-1.5">CONDITION</div>
            <select value={condFilter} onChange={e => setCondFilter(e.target.value)}
              className="bg-gs-card border border-[#222] rounded-lg py-[7px] px-3 text-[#aaa] text-xs outline-none cursor-pointer">
              <option value="All">All Conditions</option>
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {/* Improvement 6: Bulk mode toggle */}
          <button
            onClick={() => { setBulkMode(!bulkMode); setSelectedForCart(new Set()); }}
            className={`px-3 py-[7px] rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
              bulkMode
                ? 'border-gs-accent/40 bg-gs-accent/10 text-gs-accent'
                : 'border-[#222] bg-gs-card text-[#aaa]'
            }`}
          >
            {bulkMode ? 'Cancel Bulk' : 'Bulk Select'}
          </button>
        </div>
      )}

      {/* Improvement 5: Price histogram for shop mode */}
      {mode === "shop" && shopRecords.length > 3 && (
        <div className="mb-4 p-3 bg-gs-card border border-gs-border rounded-xl">
          <div className="text-[10px] text-gs-dim font-mono mb-2">PRICE DISTRIBUTION</div>
          <PriceHistogram records={shopRecords} />
        </div>
      )}

      {/* Improvement 6: Bulk action bar */}
      {bulkMode && selectedForCart.size > 0 && (
        <div className="mb-3 p-3 bg-gs-accent/10 border border-gs-accent/30 rounded-xl flex items-center justify-between">
          <span className="text-xs text-gs-accent font-semibold">
            {selectedForCart.size} record{selectedForCart.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedForCart(new Set())}
              className="px-3 py-1.5 rounded-lg border border-gs-border bg-gs-card text-xs text-gs-dim cursor-pointer"
            >
              Clear
            </button>
            <button
              onClick={bulkAddToCart}
              className="px-4 py-1.5 rounded-lg border-none bg-gradient-to-br from-gs-accent to-gs-indigo text-white text-xs font-bold cursor-pointer"
            >
              Add All to Cart
            </button>
          </div>
        </div>
      )}

      {/* Improvement 7: Similar records panel */}
      {similarTo && similarRecords.length > 0 && (
        <div className="mb-4 p-3.5 bg-gs-card border border-gs-border rounded-xl">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-[10px] font-bold text-gs-dim tracking-widest font-mono">
              SIMILAR RECORDS
            </span>
            <button
              onClick={() => setSimilarTo(null)}
              className="bg-transparent border-none text-gs-faint hover:text-gs-text cursor-pointer text-xs p-0"
            >
              ×
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {similarRecords.map(r => (
              <div
                key={r.id}
                onClick={() => trackView(r)}
                className="shrink-0 w-[120px] cursor-pointer group"
              >
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={120} />
                <div className="text-[11px] font-semibold text-gs-text mt-1.5 truncate group-hover:text-gs-accent transition-colors">{r.album}</div>
                <div className="text-[10px] text-gs-faint truncate">{r.artist}</div>
                {r.forSale && <span className="text-[10px] font-bold text-amber-400">${r.price}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement 4: Recently viewed trail */}
      {mode === "browse" && !q && recentlyViewedRecords.length > 0 && (
        <div className="mb-5">
          <h2 className="gs-label mb-2">RECENTLY VIEWED</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {recentlyViewedRecords.map(r => (
              <div
                key={r.id}
                onClick={() => trackView(r)}
                className="shrink-0 flex gap-2 items-center bg-gs-card border border-gs-border rounded-lg px-3 py-2 cursor-pointer hover:border-gs-accent/30 transition-colors"
              >
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent || "#555"} size={32} />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-gs-muted truncate max-w-[100px]">{r.album}</div>
                  <div className="text-[9px] text-gs-faint truncate max-w-[100px]">{r.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement A6: Curated Staff Picks section */}
      {mode === "browse" && !q && staffPicks.length > 0 && (
        <div className="mb-5">
          <h2 className="gs-label mb-2">STAFF PICKS</h2>
          <div className="flex gap-2.5 overflow-x-auto pb-2">
            {staffPicks.map(r => (
              <div key={r.id} onClick={() => trackView(r)} className="shrink-0 w-[130px] cursor-pointer group">
                <div className="relative">
                  <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={130} />
                  <div className="absolute top-1 left-1 text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/90 text-black font-bold">PICK</div>
                </div>
                <div className="text-[11px] font-bold text-gs-text mt-1.5 truncate group-hover:text-gs-accent transition-colors">{r.album}</div>
                <div className="text-[10px] text-gs-faint truncate">{r.artist}</div>
                {r.forSale && <span className="text-[10px] font-bold text-amber-400">${r.price}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement A7: New Arrivals auto-section */}
      {mode === "browse" && !q && newArrivals.length > 0 && (
        <div className="mb-5">
          <h2 className="gs-label mb-2">NEW ARRIVALS</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {newArrivals.map(r => (
              <div key={r.id} onClick={() => trackView(r)} className="shrink-0 flex gap-2 items-center bg-gs-card border border-gs-border rounded-lg px-3 py-2 cursor-pointer hover:border-gs-accent/30 transition-colors">
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent || "#555"} size={36} />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-gs-muted truncate max-w-[100px]">{r.album}</div>
                  <div className="text-[9px] text-gs-faint truncate max-w-[100px]">{r.artist}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[8px] px-1 py-px rounded bg-green-500/15 text-green-400 font-bold">NEW</span>
                    {r.forSale && <span className="text-[9px] text-amber-400 font-bold">${r.price}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement A14: Similar Taste Users */}
      {mode === "browse" && !q && similarTasteUsers.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="gs-label">COLLECTORS WITH SIMILAR TASTE</h2>
            <button
              onClick={() => setShowSimilarTasteUsers(!showSimilarTasteUsers)}
              className="text-[10px] text-gs-faint hover:text-gs-accent bg-transparent border-none cursor-pointer"
            >
              {showSimilarTasteUsers ? 'Hide' : 'Show'}
            </button>
          </div>
          {showSimilarTasteUsers && (
            <div className="flex gap-2.5 overflow-x-auto pb-2">
              {similarTasteUsers.map(({ user, overlap, profile: p }) => (
                <div key={user} onClick={() => onViewUser(user)} className="shrink-0 bg-gs-card border border-gs-border rounded-xl p-3 min-w-[130px] cursor-pointer hover:border-gs-accent/30 transition-colors text-center">
                  <Avatar username={user} size={40} />
                  <div className="text-[11px] font-bold text-gs-text mt-2">{p.displayName}</div>
                  <div className="text-[9px] text-gs-dim font-mono">@{user}</div>
                  <div className="text-[9px] text-green-400 mt-1">{overlap} records in common</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collector suggestions (only in browse mode, no search active) */}
      {mode === "browse" && !q && genre === "All" && (
        <div className="mb-6">
          <h2 className="gs-label mb-3">COLLECTORS TO DISCOVER</h2>
          <div className="flex gap-2.5 overflow-x-auto pb-2">
            {suggestedUsers.map(u => {
              const p = getProfile(u);
              const userRecords = records.filter(r => r.user === u);
              return (
                <div key={u} onClick={() => onViewUser(u)}
                  className="gs-card p-3.5 px-4 min-w-[150px] cursor-pointer shrink-0"
                  onMouseEnter={e => { e.currentTarget.style.borderColor = p.accent + "55"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = ""; }}>
                  <Avatar username={u} size={42} />
                  <div className="text-[13px] font-bold text-gs-text mt-2.5 mb-0.5">{p.displayName}</div>
                  <div className="text-[10px] text-gs-dim font-mono mb-1.5">@{u}</div>
                  <div className="text-[11px] text-[#666]">{userRecords.length} records · {p.favGenre}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Improvement 8: Infinite scroll toggle */}
      {mode === "browse" && viewMode === "grid" && displayRecords.length > 20 && (
        <div className="flex justify-end mb-2">
          <label className="flex items-center gap-1.5 text-[10px] text-gs-faint cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useInfiniteScroll}
              onChange={e => { setUseInfiniteScroll(e.target.checked); setVisibleCount(20); }}
              className="accent-gs-accent w-3 h-3"
            />
            Infinite scroll
          </label>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        /* #7 — Skeleton loading */
        mode === "browse" ? (
          <div className="gs-card-grid grid grid-cols-2 gap-3.5">
            {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <SkeletonList />
        )
      ) : mode === "browse" ? (
        /* Browse mode — Card grid, list, or masonry */
        displayRecords.length === 0
          ? <Empty icon="&#128269;" text={q ? `No results for "${q}"` : "No records found."} />
          : viewMode === "grid" ? (
            useInfiniteScroll ? (
              /* Improvement 8: Infinite scroll grid */
              <div>
                <div key={gridAnimKey} className="gs-card-grid grid grid-cols-2 gap-3.5" style={{ animation: 'fadeInGrid 0.3s ease-out' }}>
                  {displayRecords.slice(0, visibleCount).map(r => (
                    <div key={r.id} className="gs-card cursor-pointer relative" onClick={() => trackView(r)}>
                      <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${r.accent}, transparent)` }} />
                      <div className="p-4">
                        <div className="flex gap-2 mb-3 items-center">
                          <Avatar username={r.user} size={30} onClick={e => { e.stopPropagation(); onViewUser(r.user); }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gs-text truncate">{r.user}</div>
                          </div>
                          {/* Improvement 13: Collection overlap */}
                          {isInMyCollection(r) && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 font-mono">OWNED</span>
                          )}
                          {/* Improvement 1: New badge */}
                          {isNewThisWeek(r, records) && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gs-accent/15 text-gs-accent border border-gs-accent/20 font-bold">NEW</span>
                          )}
                        </div>
                        <div className="flex gap-3 mb-3">
                          {/* Micro-improvement 1: Blur-up lazy loading wrapper */}
                          <div
                            className="shrink-0 transition-all duration-500"
                            style={{
                              filter: loadedImages.has(r.id) ? 'blur(0)' : 'blur(4px)',
                              opacity: loadedImages.has(r.id) ? 1 : 0.6,
                            }}
                            onLoad={() => markImageLoaded(r.id)}
                            ref={(el) => { if (el && !loadedImages.has(r.id)) { setTimeout(() => markImageLoaded(r.id), 150); } }}
                          >
                            <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={68} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-gs-text mb-0.5 truncate">{r.album}</div>
                            <div className="text-xs text-[#777] mb-1 truncate">{r.artist}</div>
                            <div className="text-[11px] text-gs-dim">{r.year} · {r.format}</div>
                            {/* Improvement 10: Color-coded condition bar */}
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: condColor(r.condition) }} />
                              <span className="text-[10px] font-mono" style={{ color: condColor(r.condition) }}>{r.condition}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 mb-2.5 flex-wrap">
                          {r.tags?.slice(0, 3).map(t => (
                            <span key={t} className="gs-pill text-[10px]">#{t}</span>
                          ))}
                        </div>
                        <div className="border-t border-gs-border pt-2.5 flex justify-between items-center">
                          <div className="flex gap-3 text-[11px] text-gs-dim">
                            <span>{r.likes || 0} likes</span>
                            {r.forSale && <span className="text-amber-400 font-bold">${r.price}</span>}
                          </div>
                          {/* Improvement 7: Show similar button */}
                          <button
                            onClick={e => { e.stopPropagation(); setSimilarTo(r.id); }}
                            className="bg-transparent border-none text-gs-faint hover:text-gs-accent cursor-pointer p-0 text-[10px]"
                            title="Show similar records"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {visibleCount < displayRecords.length && (
                  <div ref={scrollSentinelRef} className="flex justify-center py-6">
                    <div className="text-xs text-gs-faint">Loading more...</div>
                  </div>
                )}
              </div>
            ) : (
              <Paginated records={displayRecords} handlers={{ onLike, onSave, onComment, onBuy, onDetail: trackView, onViewUser, onViewArtist }} />
            )
          ) : viewMode === "masonry" ? (
            /* Improvement 11: Masonry layout */
            <div className="columns-2 gap-3.5 space-y-3.5">
              {displayRecords.slice(0, 50).map((r, idx) => (
                <div
                  key={r.id}
                  onClick={() => trackView(r)}
                  className="gs-card cursor-pointer break-inside-avoid"
                  onMouseEnter={e => { e.currentTarget.style.borderColor = r.accent + "55"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = ""; }}
                >
                  <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${r.accent}, transparent)` }} />
                  <div className="p-4">
                    <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={idx % 3 === 0 ? 140 : 100} />
                    <div className="mt-2.5">
                      <div className="text-[13px] font-bold text-gs-text mb-0.5 truncate flex items-center gap-1.5">
                        {r.album}
                        {r.verified && (
                          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500 shrink-0">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#777] mb-1.5">{r.artist} · {r.year}</div>
                      {/* Improvement 10: Condition color indicator */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="h-1 flex-1 rounded-full bg-[#1a1a1a] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${(COND_RANK[r.condition] || 0) / 8 * 100}%`,
                              backgroundColor: condColor(r.condition),
                            }}
                          />
                        </div>
                        <span className="text-[9px] font-mono" style={{ color: condColor(r.condition) }}>{r.condition}</span>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {r.tags?.slice(0, 2).map(t => (
                          <span key={t} className="gs-pill text-[9px]">#{t}</span>
                        ))}
                      </div>
                      {/* Improvement 13: Collection overlap */}
                      {isInMyCollection(r) && (
                        <div className="mt-1.5 text-[9px] text-green-400 font-mono">In your collection</div>
                      )}
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gs-border">
                        <span className="text-[10px] text-gs-dim">{r.likes || 0} likes</span>
                        {r.forSale && <span className="text-xs font-bold text-amber-400">${r.price}</span>}
                        <button
                          onClick={e => { e.stopPropagation(); setSimilarTo(r.id); }}
                          className="bg-transparent border-none text-gs-faint hover:text-gs-accent cursor-pointer p-0"
                          title="Show similar"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* #1 — Compact list view */
            <div className="flex flex-col gap-2">
              {displayRecords.slice(0, 50).map(r => (
                <div key={r.id} onClick={() => trackView(r)}
                  className="gs-card p-3 px-3.5 flex gap-3 items-center cursor-pointer"
                  onMouseEnter={e => { e.currentTarget.style.borderColor = r.accent + "55"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = ""; }}>
                  <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-gs-text truncate flex items-center gap-1.5">
                      {r.album}
                      {r.verified && (
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500 shrink-0">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                      )}
                      {r.rating >= 4.5 && <span className="gs-badge-featured ml-0.5">FEATURED</span>}
                      {/* Improvement 1: New badge in list */}
                      {isNewThisWeek(r, records) && (
                        <span className="text-[8px] px-1 py-px rounded bg-gs-accent/15 text-gs-accent font-bold ml-0.5">NEW</span>
                      )}
                      {/* Improvement 13: Owned badge in list */}
                      {isInMyCollection(r) && (
                        <span className="text-[8px] px-1 py-px rounded bg-green-500/15 text-green-400 font-mono ml-0.5">OWNED</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#666]">{r.artist} · {r.year} · {r.format}</div>
                  </div>
                  <div className="flex gap-1.5 items-center shrink-0">
                    {/* Improvement 10: Color dot for condition */}
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: condColor(r.condition) }} />
                    <Badge label={r.condition} color={condColor(r.condition)} />
                    {r.forSale && <Badge label={`$${r.price}`} color="#f59e0b" />}
                    <span className="text-gs-dim text-[10px]">{r.likes || 0} likes</span>
                    {/* Improvement 7: Show similar in list */}
                    <button
                      onClick={e => { e.stopPropagation(); setSimilarTo(r.id); }}
                      className="bg-transparent border-none text-gs-faint hover:text-gs-accent cursor-pointer p-0 ml-1"
                      title="Show similar"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
      ) : (
        /* Shop mode — Marketplace list */
        shopRecords.length === 0 ? (
          <Empty icon="&#127991;&#65039;" text={q ? `No for-sale results for "${q}"` : "No records for sale right now."} />
        ) : (
          <div className="flex flex-col gap-2.5">
            {shopRecords.map(r => (
              <div key={r.id} onClick={() => trackView(r)}
                className={`gs-card p-4 flex gap-3.5 items-center cursor-pointer transition-all duration-150 ${
                  bulkMode && selectedForCart.has(r.id) ? 'border-gs-accent/50 bg-gs-accent/5' : ''
                }`}
                onMouseEnter={e => { e.currentTarget.style.borderColor = bulkMode && selectedForCart.has(r.id) ? '' : r.accent + "55"; setHoveredRecordId(r.id); }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = ""; setHoveredRecordId(null); }}>
                {/* Improvement 6: Bulk select checkbox */}
                {bulkMode && (
                  <input
                    type="checkbox"
                    checked={selectedForCart.has(r.id)}
                    onChange={e => { e.stopPropagation(); toggleSelectForCart(r.id); }}
                    className="accent-gs-accent w-4 h-4 shrink-0 cursor-pointer"
                    onClick={e => e.stopPropagation()}
                  />
                )}
                <div className="relative shrink-0">
                  <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={52} />
                  {/* #5 — Featured badge on album art */}
                  {r.rating >= 4.5 && (
                    <div className="absolute -top-1 -right-1 gs-badge-featured text-[8px] px-1">&#9733;</div>
                  )}
                  {/* Improvement 13: Owned overlay */}
                  {isInMyCollection(r) && (
                    <div className="absolute -bottom-1 -left-1 text-[7px] px-1 py-px rounded bg-green-500/90 text-black font-bold">OWNED</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gs-text mb-0.5 flex items-center gap-1.5">
                    {r.album}
                    {r.verified && (
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500 shrink-0">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>
                    )}
                    {/* Improvement 1: New badge in shop */}
                    {isNewThisWeek(r, records) && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gs-accent/15 text-gs-accent border border-gs-accent/20 font-bold">NEW</span>
                    )}
                  </div>
                  <div className="text-xs text-[#777] mb-1.5 flex items-center gap-1.5">
                    <button onClick={e => { e.stopPropagation(); onViewArtist?.(r.artist); }}
                      className="bg-transparent border-none cursor-pointer text-[#ccc] text-xs p-0 font-medium">{r.artist}</button>
                    ·
                    <button onClick={e => { e.stopPropagation(); onViewUser(r.user); }}
                      className="bg-transparent border-none cursor-pointer text-gs-accent text-xs p-0">@{r.user}</button>
                  </div>
                  <div className="flex gap-1.5 items-center flex-wrap">
                    {/* Improvement 10: Enhanced condition badge with color dot */}
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: condColor(r.condition) }} />
                      <Badge label={r.condition} color={condColor(r.condition)} />
                    </div>
                    <span className="text-[11px] text-gs-dim font-mono">{r.format} · {r.year}</span>
                    {r.tags?.slice(0, 2).map(t => (
                      <span key={t} className="gs-pill">#{t}</span>
                    ))}
                  </div>
                  {/* Improvement A2: Authenticity verification badge */}
                  {(() => {
                    const auth = getAuthBadge(r);
                    if (!auth) return null;
                    return (
                      <div className="flex items-center gap-1 mt-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={auth.color} strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        <span className="text-[9px] font-semibold" style={{ color: auth.color }}>{auth.label}</span>
                      </div>
                    );
                  })()}
                  {/* Improvement A3: Seller trust score */}
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] text-gs-faint">Trust:</span>
                    <div className="h-1 w-12 rounded-full bg-[#1a1a1a] overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${getSellerTrustScore(r.user)}%`,
                        backgroundColor: getSellerTrustScore(r.user) >= 90 ? '#22c55e' : getSellerTrustScore(r.user) >= 80 ? '#eab308' : '#ef4444'
                      }} />
                    </div>
                    <span className="text-[9px] font-mono text-gs-faint">{getSellerTrustScore(r.user)}</span>
                  </div>
                  {/* Improvement A8: Record weight/pressing info */}
                  {(() => {
                    const info = getPressingInfo(r);
                    return (
                      <div className="text-[9px] text-gs-faint mt-0.5">
                        {info.weight} · {info.pressing}
                      </div>
                    );
                  })()}
                  {/* Improvement A11: Collector's edition highlighting */}
                  {isCollectorsEdition(r) && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20 font-bold mt-1 inline-block">COLLECTOR&apos;S EDITION</span>
                  )}
                  {/* ── B2: Rarity scoring badge ─────────────────────── */}
                  {(() => {
                    const score = computeRarityScore(r, records);
                    const rl = rarityLabel(score);
                    return (
                      <div className="flex items-center gap-1 mt-1">
                        <div className="h-1 w-10 rounded-full bg-[#1a1a1a] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: rl.color }} />
                        </div>
                        <span className="text-[8px] font-bold" style={{ color: rl.color }}>{rl.text}</span>
                      </div>
                    );
                  })()}
                  {/* ── B4: Seller response rate badge ───────────────── */}
                  {(() => {
                    const resp = getSellerResponseRate(r.user);
                    return (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[8px] text-gs-faint">Response:</span>
                        <span className={`text-[8px] font-bold ${resp.fast ? 'text-green-400' : 'text-gs-dim'}`}>{resp.rate}%</span>
                        {resp.fast && <span className="text-[7px] px-1 py-px rounded bg-green-500/15 text-green-400 font-bold">FAST</span>}
                        <span className="text-[8px] text-gs-faint">~{resp.avgHrs}h</span>
                      </div>
                    );
                  })()}
                  {/* ── B7: Verified condition badge ─────────────────── */}
                  {isConditionVerified(r) && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 font-bold mt-0.5 inline-flex items-center gap-0.5">
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      VERIFIED CONDITION
                    </span>
                  )}
                  {/* ── B8: Pressing plant info ──────────────────────── */}
                  {(() => {
                    const info = getPressingInfo(r);
                    const plants = ['United Records', 'Rainbo Records', 'Sterling Sound', 'GZ Media', 'Optimal Media'];
                    let h2 = 0;
                    const s2 = String(r.id);
                    for (let i = 0; i < s2.length; i++) h2 = ((h2 << 5) - h2 + s2.charCodeAt(i)) | 0;
                    const plant = plants[Math.abs(h2) % plants.length];
                    return (
                      <div className="text-[8px] text-gs-faint mt-0.5">
                        Plant: {plant} ({info.pressing})
                      </div>
                    );
                  })()}
                  {/* ── B9: Matrix number display ────────────────────── */}
                  <div className="text-[8px] text-gs-faint font-mono mt-0.5">
                    Matrix: {getMatrixNumber(r)}
                  </div>
                  {/* ── B10: Catalog number display ──────────────────── */}
                  <div className="text-[8px] text-gs-faint font-mono">
                    Cat#: {getCatalogNumber(r)} | Label: {getRecordLabel(r)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="relative">
                    <div className="text-2xl font-extrabold text-gs-text tracking-[-0.03em] mb-0.5">${r.price}</div>
                    {/* ── B3: Price trend mini chart ──────────────────── */}
                    <div className="flex items-center gap-1 mb-0.5 justify-end">
                      <PriceTrendMiniChart points={generatePriceTrend(r)} />
                    </div>
                    {/* Estimate below listing price */}
                    <div className="text-[9px] mb-1" style={{ color: '#6b7280' }}>
                      Est. ~${estimateValue(r.condition, r.year)}
                    </div>
                    {/* Price fairness badge */}
                    {(() => {
                      const est = estimateValue(r.condition, r.year);
                      const p = parseFloat(r.price);
                      if (p <= est * 0.85) return <div className="text-[9px] font-bold text-green-400 mb-1">Below estimate</div>;
                      if (p <= est * 1.15) return <div className="text-[9px] font-bold text-blue-400 mb-1">Fair price</div>;
                      return null;
                    })()}
                    {/* Want count */}
                    {(() => {
                      const wc = getWantCount(r);
                      if (wc > 0) return <div className="text-[9px] text-amber-400 mb-1">{wc} {wc === 1 ? 'person wants' : 'people want'} this</div>;
                      return null;
                    })()}
                    {/* Popular badge */}
                    {(r.likes || 0) >= 3 && (
                      <div className="text-[9px] font-bold text-pink-400 mb-1">Popular</div>
                    )}
                    {/* Improvement 9: Price comparison tooltip on hover */}
                    {hoveredRecordId === r.id && (() => {
                      const comp = getPriceComparison(r);
                      if (!comp) return null;
                      return (
                        <div className="absolute -top-8 right-0 bg-[#1a1a1a] border border-gs-border rounded-lg px-2.5 py-1.5 text-[10px] whitespace-nowrap z-10 shadow-lg">
                          <span className="text-gs-faint">Avg: ${comp.avg}</span>
                          <span className={`ml-1.5 font-bold ${comp.diff < 0 ? 'text-green-400' : comp.diff > 0 ? 'text-red-400' : 'text-gs-dim'}`}>
                            {comp.diff < 0 ? `$${Math.abs(comp.diff).toFixed(0)} below` : comp.diff > 0 ? `$${comp.diff.toFixed(0)} above` : 'at avg'}
                          </span>
                          <span className="text-gs-faint ml-1">({comp.count} other{comp.count !== 1 ? 's' : ''})</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {!bulkMode && (
                      <>
                        <button onClick={e => { e.stopPropagation(); onBuy(r); }}
                          className="py-2 px-3 rounded-lg border-none text-white font-bold text-[11px] cursor-pointer"
                          style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>Make an Offer</button>
                        <button onClick={e => { e.stopPropagation(); onAddToCart(r); }}
                          className="gs-btn-secondary py-2 px-3 text-[11px] font-bold rounded-lg">+ Cart</button>
                      </>
                    )}
                  </div>
                  {/* Improvement A4: Auction countdown timer */}
                  {(() => {
                    const auction = getAuctionCountdown(r);
                    if (!auction) return null;
                    return (
                      <div className={`text-[9px] font-mono mt-1 ${auction.urgent ? 'text-red-400' : 'text-amber-400'}`}>
                        {auction.urgent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse mr-1" />}
                        Auction ends: {auction.hours}h {auction.minutes}m
                      </div>
                    );
                  })()}
                  {/* Improvement A9: Shipping speed estimate */}
                  {(() => {
                    const ship = getShippingEstimate(r);
                    return (
                      <div className="text-[9px] text-gs-faint mt-0.5 flex items-center gap-1">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                        <span className={ship.speed === 'fast' ? 'text-green-400' : ship.speed === 'medium' ? 'text-amber-400' : 'text-gs-faint'}>{ship.label}</span>
                      </div>
                    );
                  })()}
                  {/* Improvement A10: Price drop notification toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); togglePriceDropAlert(r.id); }}
                    className={`text-[9px] mt-1 bg-transparent border-none cursor-pointer p-0 flex items-center gap-0.5 ${priceDropAlerts.includes(r.id) ? 'text-amber-400' : 'text-gs-faint hover:text-amber-400'}`}
                    title={priceDropAlerts.includes(r.id) ? 'Price alert on' : 'Notify me of price drops'}
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill={priceDropAlerts.includes(r.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    {priceDropAlerts.includes(r.id) ? 'Alert on' : 'Price alert'}
                  </button>
                  {/* Action row: Similar, Sound, AR, Provenance, Compare */}
                  <div className="flex gap-2 mt-1.5 flex-wrap justify-end">
                    {/* Improvement 7: Show similar in shop */}
                    <button
                      onClick={e => { e.stopPropagation(); setSimilarTo(r.id); }}
                      className="bg-transparent border-none text-gs-faint hover:text-gs-accent cursor-pointer p-0 text-[10px]"
                      title="Show similar records"
                    >
                      Similar
                    </button>
                    {/* Improvement A12: Sound sample preview button placeholder */}
                    <button
                      onClick={e => { e.stopPropagation(); setSoundPreviewRecordId(soundPreviewRecordId === r.id ? null : r.id); }}
                      className={`bg-transparent border-none cursor-pointer p-0 text-[10px] ${soundPreviewRecordId === r.id ? 'text-gs-accent' : 'text-gs-faint hover:text-gs-accent'}`}
                      title="Preview sound sample"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill={soundPreviewRecordId === r.id ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                    {/* Improvement A1: AR preview button */}
                    <button
                      onClick={e => { e.stopPropagation(); setArPreviewRecord(r); }}
                      className="bg-transparent border-none text-gs-faint hover:text-purple-400 cursor-pointer p-0 text-[10px]"
                      title="AR Preview"
                    >
                      AR
                    </button>
                    {/* Improvement A13: Provenance/ownership history link */}
                    <button
                      onClick={e => { e.stopPropagation(); }}
                      className="bg-transparent border-none text-gs-faint hover:text-gs-accent cursor-pointer p-0 text-[10px]"
                      title="View ownership history"
                    >
                      History
                    </button>
                    {/* Improvement A15: Compare toggle */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleCompare(r); }}
                      className={`bg-transparent border-none cursor-pointer p-0 text-[10px] ${compareList.find(c => c.id === r.id) ? 'text-cyan-400' : 'text-gs-faint hover:text-cyan-400'}`}
                      title="Add to compare"
                    >
                      Compare
                    </button>
                  </div>
                  {/* Improvement A12: Sound preview placeholder when active */}
                  {soundPreviewRecordId === r.id && (
                    <div className="mt-1.5 p-2 rounded-lg bg-[#111] border border-gs-border">
                      <div className="flex items-center gap-2">
                        <div className="w-full h-4 bg-[#1a1a1a] rounded overflow-hidden flex items-center">
                          {[...Array(20)].map((_, i) => (
                            <div key={i} className="flex-1 mx-px bg-gs-accent/40 rounded-full" style={{ height: `${4 + (i * r.id) % 12}px` }} />
                          ))}
                        </div>
                      </div>
                      <div className="text-[8px] text-gs-faint mt-1 text-center">Sound preview coming soon</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Improvement 15: Animated filter transitions — active filter summary bar */}
      {(genre !== "All" || condFilter !== "All" || newThisWeekOnly || q || subgenre || labelFilter !== "All" || decadeFilter !== "All" || catalogSearch) && (
        <div className="mt-4 flex gap-1.5 flex-wrap items-center transition-all duration-300">
          <span className="text-[10px] text-gs-faint font-mono mr-1">Active filters:</span>
          {genre !== "All" && (
            <button
              onClick={() => selectGenre("All")}
              className="text-[10px] px-2 py-0.5 rounded-full bg-gs-accent/10 text-gs-accent border border-gs-accent/20 cursor-pointer flex items-center gap-1 transition-all duration-200 hover:bg-gs-accent/20"
            >
              {genre} <span className="text-gs-faint">×</span>
            </button>
          )}
          {subgenre && (
            <button
              onClick={() => setSubgenre(null)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-gs-indigo/10 text-gs-indigo border border-gs-indigo/20 cursor-pointer flex items-center gap-1 transition-all duration-200 hover:bg-gs-indigo/20"
            >
              {subgenre} <span className="text-gs-faint">×</span>
            </button>
          )}
          {condFilter !== "All" && (
            <button
              onClick={() => setCondFilter("All")}
              className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-pointer flex items-center gap-1 transition-all duration-200 hover:bg-amber-500/20"
            >
              {condFilter} <span className="text-gs-faint">×</span>
            </button>
          )}
          {newThisWeekOnly && (
            <button
              onClick={() => setNewThisWeekOnly(false)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 cursor-pointer flex items-center gap-1 transition-all duration-200 hover:bg-green-500/20"
            >
              New this week <span className="text-gs-faint">×</span>
            </button>
          )}
          {q && (
            <button
              onClick={() => setQ("")}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-gs-muted border border-gs-border cursor-pointer flex items-center gap-1 transition-all duration-200 hover:bg-[#222]"
            >
              &quot;{q}&quot; <span className="text-gs-faint">×</span>
            </button>
          )}
          {labelFilter !== "All" && (
            <button
              onClick={() => setLabelFilter("All")}
              className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 cursor-pointer flex items-center gap-1 transition-all duration-200 hover:bg-violet-500/20"
            >
              Label: {labelFilter} <span className="text-gs-faint">x</span>
            </button>
          )}
          {decadeFilter !== "All" && (
            <button
              onClick={() => setDecadeFilter("All")}
              className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 cursor-pointer flex items-center gap-1 transition-all duration-200 hover:bg-cyan-500/20"
            >
              {decadeFilter} <span className="text-gs-faint">x</span>
            </button>
          )}
          {catalogSearch && (
            <button
              onClick={() => setCatalogSearch("")}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-gs-muted border border-gs-border cursor-pointer flex items-center gap-1 transition-all duration-200 hover:bg-[#222]"
            >
              Cat# &quot;{catalogSearch}&quot; <span className="text-gs-faint">x</span>
            </button>
          )}
          <button
            onClick={() => { setGenre("All"); setSubgenre(null); setCondFilter("All"); setNewThisWeekOnly(false); setQ(""); setLabelFilter("All"); setDecadeFilter("All"); setCatalogSearch(""); }}
            className="text-[10px] text-gs-faint hover:text-red-400 bg-transparent border-none cursor-pointer ml-1 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Micro-improvement 3: Back to top floating button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-5 w-10 h-10 rounded-full bg-gs-accent/90 text-white border-none cursor-pointer shadow-lg shadow-gs-accent/30 z-[80] flex items-center justify-center transition-all duration-300 hover:bg-gs-accent"
          aria-label="Back to top"
          style={{ animation: 'fadeInGrid 0.3s ease-out' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
      )}

      {/* Micro-improvement 4: Grid animation keyframes */}
      <style>{`@keyframes fadeInGrid { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
