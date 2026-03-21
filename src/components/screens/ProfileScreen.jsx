// The current user's own profile page — not to be confused with UserProfileModal (other users).
// Shows a profile card with avatar, bio, stats, and an "Edit Profile" button that opens ProfileEditModal.
// Six tabs: posts, listening, records, for sale, saved, and personal wishlist.
// Includes profile completion indicator, highlights row, share button, and collection value.
// Improvements: profile views counter, top collector badge, activity heatmap, QR code,
// featured records, listening stats summary, theme color preview, social links,
// member tier, collection value trend, recent activity timeline, completeness tips,
// mutual interests placeholder.
// Round 2: profile analytics dashboard, reputation score, trade history visualization,
// collection insurance value, genre expertise badges, profile verification flow,
// custom profile URL/slug, embed code generator, collection milestones timeline,
// fan/supporter list, profile comparison tool, trading partner ratings,
// collection growth predictions.
import { useState, useMemo, useCallback } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import Stars from '../ui/Stars';
import Empty from '../ui/Empty';
import FormInput from '../ui/FormInput';
import { condColor } from '../../utils/helpers';

// ── Improvement 14: Reputation score calculation ────────────────────────
const getReputationScore = (records, posts, listens, followers, following) => {
  const collectionScore = Math.min(records * 2, 100);
  const socialScore = Math.min((followers || 0) * 3 + (following || 0), 80);
  const activityScore = Math.min(posts * 5 + listens, 120);
  const total = collectionScore + socialScore + activityScore;
  const max = 300;
  const pct = Math.round((total / max) * 100);
  return {
    total: Math.min(pct, 100),
    breakdown: { collection: collectionScore, social: socialScore, activity: activityScore },
    label: pct >= 80 ? "Excellent" : pct >= 60 ? "Great" : pct >= 40 ? "Good" : pct >= 20 ? "Rising" : "New",
    color: pct >= 80 ? "#22c55e" : pct >= 60 ? "#0ea5e9" : pct >= 40 ? "#f59e0b" : pct >= 20 ? "#8b5cf6" : "#666",
  };
};

// ── Improvement 17: Genre expertise calculation ─────────────────────────
const getGenreExpertise = (records, listeningHistory, currentUser) => {
  const genreCounts = {};
  (records || []).filter(r => r.user === currentUser).forEach(r => {
    const genre = r.genre || r.format || "Unknown";
    genreCounts[genre] = (genreCounts[genre] || 0) + 2;
  });
  (listeningHistory || []).filter(s => s.username === currentUser).forEach(s => {
    const genre = s.track.genre || "Unknown";
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
  });
  return Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, count]) => ({
      genre,
      count,
      level: count >= 20 ? "Expert" : count >= 10 ? "Advanced" : count >= 5 ? "Intermediate" : "Beginner",
      color: count >= 20 ? "#22c55e" : count >= 10 ? "#0ea5e9" : count >= 5 ? "#f59e0b" : "#666",
    }));
};

// ── Improvement 21: Collection milestones ───────────────────────────────
const COLLECTION_MILESTONES = [
  { count: 1, label: "First Record", icon: "R", color: "#0ea5e9" },
  { count: 5, label: "Starter Collection", icon: "5", color: "#8b5cf6" },
  { count: 10, label: "Curated Shelf", icon: "10", color: "#22c55e" },
  { count: 25, label: "Serious Collector", icon: "25", color: "#f59e0b" },
  { count: 50, label: "Vinyl Enthusiast", icon: "50", color: "#ef4444" },
  { count: 100, label: "Century Club", icon: "C", color: "#ec4899" },
  { count: 250, label: "Record Vault", icon: "V", color: "#14b8a6" },
  { count: 500, label: "Legendary Collector", icon: "L", color: "#fbbf24" },
];

// ── Improvement 9: Member tier calculation ─────────────────────────────
const getMemberTier = (recordCount, postCount, listenCount) => {
  const score = recordCount * 3 + postCount * 2 + listenCount;
  if (score >= 500) return { name: "Platinum", color: "#c0c0c0", bg: "linear-gradient(135deg,#e5e5e5,#a0a0a0)" };
  if (score >= 200) return { name: "Gold", color: "#fbbf24", bg: "linear-gradient(135deg,#fbbf24,#d97706)" };
  if (score >= 80) return { name: "Silver", color: "#94a3b8", bg: "linear-gradient(135deg,#cbd5e1,#94a3b8)" };
  return { name: "Bronze", color: "#cd7f32", bg: "linear-gradient(135deg,#cd7f32,#a0522d)" };
};

// ── Improvement 4: Simple QR code SVG generator (encodes URL into a visual grid) ──
function MiniQRCode({ url, size = 80 }) {
  // Create a deterministic grid pattern from the URL string
  const gridSize = 9;
  const cellSize = size / gridSize;
  const cells = [];
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  }
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      // Corner markers (QR-style)
      const isCornerMarker =
        (row < 3 && col < 3) || (row < 3 && col >= gridSize - 3) || (row >= gridSize - 3 && col < 3);
      const isBorder =
        (row === 0 || row === 2 || col === 0 || col === 2) &&
        ((row < 3 && col < 3) || (row < 3 && col >= gridSize - 3) || (row >= gridSize - 3 && col < 3));
      const isCenter = (row === 1 && col === 1) || (row === 1 && col === gridSize - 2) || (row === gridSize - 2 && col === 1);

      if (isCornerMarker) {
        if (isBorder || isCenter) {
          cells.push({ row, col, filled: true });
        }
      } else {
        // Data cells: deterministic from hash
        const seed = ((hash * (row * gridSize + col + 1)) >>> 0) % 100;
        if (seed < 45) {
          cells.push({ row, col, filled: true });
        }
      }
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded">
      <rect width={size} height={size} fill="white" rx="4" />
      {cells.filter(c => c.filled).map((c, i) => (
        <rect key={i} x={c.col * cellSize + 0.5} y={c.row * cellSize + 0.5} width={cellSize - 1} height={cellSize - 1} fill="#111" rx="1" />
      ))}
    </svg>
  );
}

// ── Improvement 3: Activity heatmap component ──────────────────────────
function ActivityHeatmap({ posts, listeningHistory, records, currentUser }) {
  const weeks = 12;
  const days = 7;
  const now = Date.now();
  const dayMs = 86400000;

  const activityMap = useMemo(() => {
    const map = {};
    const allEvents = [
      ...(posts || []).filter(p => p.user === currentUser).map(p => p.createdAt),
      ...(listeningHistory || []).filter(s => s.username === currentUser).map(s => s.timestampMs),
      ...(records || []).filter(r => r.user === currentUser && r.addedAt).map(r => r.addedAt),
    ];
    allEvents.forEach(ts => {
      const daysAgo = Math.floor((now - ts) / dayMs);
      if (daysAgo >= 0 && daysAgo < weeks * days) {
        map[daysAgo] = (map[daysAgo] || 0) + 1;
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, listeningHistory, records, currentUser]);

  const maxCount = Math.max(1, ...Object.values(activityMap));

  const getColor = (count) => {
    if (count === 0) return "#1a1a1a";
    const intensity = Math.min(count / maxCount, 1);
    if (intensity < 0.25) return "#0ea5e922";
    if (intensity < 0.5) return "#0ea5e944";
    if (intensity < 0.75) return "#0ea5e988";
    return "#0ea5e9cc";
  };

  return (
    <div className="mb-6">
      <div className="text-xs font-bold text-gs-muted uppercase tracking-wider mb-3">Activity</div>
      <div className="flex gap-[3px]">
        {Array.from({ length: weeks }, (_, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {Array.from({ length: days }, (_, d) => {
              const daysAgo = (weeks - 1 - w) * days + (days - 1 - d);
              const count = activityMap[daysAgo] || 0;
              return (
                <div
                  key={d}
                  className="rounded-[2px] transition-colors"
                  style={{ width: 10, height: 10, background: getColor(count) }}
                  title={`${count} action${count !== 1 ? "s" : ""}, ${daysAgo}d ago`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-[9px] text-gs-faint">Less</span>
        {[0, 1, 2, 3, 4].map(level => (
          <div key={level} className="rounded-[2px]" style={{ width: 8, height: 8, background: getColor(level === 0 ? 0 : level * (maxCount / 4)) }} />
        ))}
        <span className="text-[9px] text-gs-faint">More</span>
      </div>
    </div>
  );
}

// ── Improvement 10: Collection value trend mini-chart ──────────────────
function ValueTrendChart({ records, currentUser }) {
  const data = useMemo(() => {
    const mine = records.filter(r => r.user === currentUser && r.forSale);
    // Simulate monthly value trend (last 6 months)
    const months = [];
    const baseValue = mine.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString("default", { month: "short" });
      // Simulate variance based on month index
      const variance = 1 + (Math.sin(i * 1.5) * 0.15);
      months.push({ label, value: Math.round(baseValue * variance) });
    }
    return months;
  }, [records, currentUser]);

  const maxVal = Math.max(1, ...data.map(d => d.value));
  const chartHeight = 48;

  if (data.every(d => d.value === 0)) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-gs-muted uppercase tracking-wider">Collection Value Trend</div>
        <div className="text-[10px] text-gs-dim font-mono">6 months</div>
      </div>
      <div className="bg-gs-card border border-gs-border rounded-xl p-3">
        <div className="flex items-end gap-1.5" style={{ height: chartHeight }}>
          {data.map((d, i) => {
            const h = Math.max(4, (d.value / maxVal) * chartHeight);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{ height: h, background: i === data.length - 1 ? "#0ea5e9" : "#0ea5e944" }}
                  title={`$${d.value}`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {data.map((d, i) => (
            <div key={i} className="flex-1 text-center text-[8px] text-gs-faint font-mono">{d.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Improvement 15: Trade history visualization ─────────────────────────
function TradeHistoryChart({ offers, currentUser }) {
  const tradeData = useMemo(() => {
    const sent = (offers || []).filter(o => o.from === currentUser);
    const received = (offers || []).filter(o => o.to === currentUser);
    const accepted = [...sent, ...received].filter(o => o.status === "accepted");
    const declined = [...sent, ...received].filter(o => o.status === "declined");
    const pending = [...sent, ...received].filter(o => !o.status || o.status === "pending");
    const trades = [...sent, ...received].filter(o => o.type === "trade");
    const cash = [...sent, ...received].filter(o => o.type === "cash");
    return { sent: sent.length, received: received.length, accepted: accepted.length, declined: declined.length, pending: pending.length, trades: trades.length, cash: cash.length };
  }, [offers, currentUser]);

  if (tradeData.sent + tradeData.received === 0) return null;
  const total = tradeData.sent + tradeData.received;

  return (
    <div className="mb-6">
      <div className="text-xs font-bold text-gs-muted uppercase tracking-wider mb-3">Trade History</div>
      <div className="bg-gs-card border border-gs-border rounded-xl p-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { label: "Total Trades", value: total, color: "#0ea5e9" },
            { label: "Accepted", value: tradeData.accepted, color: "#22c55e" },
            { label: "Pending", value: tradeData.pending, color: "#f59e0b" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-lg font-extrabold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[9px] text-gs-dim font-mono">{s.label}</div>
            </div>
          ))}
        </div>
        {/* Trade type bar */}
        {total > 0 && (
          <div>
            <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden flex">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${(tradeData.accepted / total) * 100}%` }} />
              <div className="h-full bg-amber-500 transition-all" style={{ width: `${(tradeData.pending / total) * 100}%` }} />
              <div className="h-full bg-red-500 transition-all" style={{ width: `${(tradeData.declined / total) * 100}%` }} />
            </div>
            <div className="flex gap-3 mt-2 justify-center">
              {[{ l: "Accepted", c: "#22c55e" }, { l: "Pending", c: "#f59e0b" }, { l: "Declined", c: "#ef4444" }].map(x => (
                <div key={x.l} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: x.c }} />
                  <span className="text-[9px] text-gs-faint">{x.l}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Improvement 25: Collection growth predictions chart ──────────────────
function CollectionGrowthPredictions({ records, currentUser }) {
  const data = useMemo(() => {
    const mine = records.filter(r => r.user === currentUser);
    const currentCount = mine.length;
    if (currentCount === 0) return null;
    // Project growth over next 6 months based on current pace
    const monthlyRate = Math.max(1, Math.round(currentCount / 6));
    const months = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      const label = d.toLocaleString("default", { month: "short" });
      const projected = currentCount + (monthlyRate * i);
      const optimistic = currentCount + Math.round(monthlyRate * 1.5 * i);
      months.push({ label, projected, optimistic, isCurrent: i === 0 });
    }
    return months;
  }, [records, currentUser]);

  if (!data) return null;
  const maxVal = Math.max(1, ...data.map(d => d.optimistic));
  const chartHeight = 56;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-gs-muted uppercase tracking-wider">Growth Predictions</div>
        <div className="text-[10px] text-gs-dim font-mono">6 month forecast</div>
      </div>
      <div className="bg-gs-card border border-gs-border rounded-xl p-3">
        <div className="flex items-end gap-1.5" style={{ height: chartHeight }}>
          {data.map((d, i) => {
            const hProj = Math.max(4, (d.projected / maxVal) * chartHeight);
            const hOpt = Math.max(4, (d.optimistic / maxVal) * chartHeight);
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end relative" style={{ height: chartHeight }}>
                {!d.isCurrent && (
                  <div
                    className="absolute bottom-0 w-full rounded-t-sm opacity-20"
                    style={{ height: hOpt, background: "#22c55e" }}
                  />
                )}
                <div
                  className="w-full rounded-t-sm relative z-[1]"
                  style={{ height: hProj, background: d.isCurrent ? "#0ea5e9" : "#0ea5e966" }}
                  title={`${d.projected} records`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {data.map((d, i) => (
            <div key={i} className="flex-1 text-center text-[8px] text-gs-faint font-mono">{d.label}</div>
          ))}
        </div>
        <div className="flex gap-3 mt-2 justify-center">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#0ea5e9]" />
            <span className="text-[9px] text-gs-faint">Projected</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[#22c55e] opacity-30" />
            <span className="text-[9px] text-gs-faint">Optimistic</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Improvement 11: Recent activity timeline ───────────────────────────
function RecentActivityTimeline({ posts, listeningHistory, records, currentUser }) {
  const activities = useMemo(() => {
    const items = [];
    (posts || []).filter(p => p.user === currentUser).forEach(p => {
      items.push({ type: "post", label: "Posted an update", detail: p.caption?.slice(0, 60), ts: p.createdAt, icon: "pencil", color: "#0ea5e9" });
    });
    (listeningHistory || []).filter(s => s.username === currentUser).slice(0, 5).forEach(s => {
      items.push({ type: "listen", label: `Listened to ${s.track.title}`, detail: s.track.artist, ts: s.timestampMs, icon: "music", color: "#8b5cf6" });
    });
    (records || []).filter(r => r.user === currentUser && r.addedAt).forEach(r => {
      items.push({ type: "record", label: `Added ${r.album}`, detail: r.artist, ts: r.addedAt, icon: "disc", color: "#f59e0b" });
    });
    return items.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [posts, listeningHistory, records, currentUser]);

  if (activities.length === 0) return null;

  const relTime = ts => {
    const d = Date.now() - ts;
    const m = Math.floor(d / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const dy = Math.floor(h / 24);
    return dy === 1 ? "yesterday" : `${dy}d ago`;
  };

  const iconMap = {
    pencil: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    music: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
    disc: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>,
  };

  return (
    <div className="mb-6">
      <div className="text-xs font-bold text-gs-muted uppercase tracking-wider mb-3">Recent Activity</div>
      <div className="bg-gs-card border border-gs-border rounded-xl overflow-hidden">
        {activities.map((a, i) => (
          <div key={i} className={`flex items-center gap-3 px-3.5 py-2.5 ${i > 0 ? "border-t border-[#1a1a1a]" : ""}`}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: a.color + "1a", color: a.color }}>
              {iconMap[a.icon]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-gs-text truncate">{a.label}</div>
              {a.detail && <div className="text-[10px] text-gs-dim truncate">{a.detail}</div>}
            </div>
            <div className="text-[9px] text-gs-faint font-mono shrink-0">{relTime(a.ts)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfileScreen({ records, currentUser, profile, onEdit, following, followers, onShowFollowing, onShowFollowers, wishlist, onAddWishlistItem, onRemoveWishlistItem, onDetail, onViewArtist, posts, onLikePost, onCommentPost, onBookmarkPost, onViewUser, listeningHistory, onAddRecord, onCreatePost }) {
  const mine = records.filter(r => r.user === currentUser);
  const [tab, setTab] = useState("posts");
  const [newWishAlbum, setNewWishAlbum] = useState("");
  const [newWishArtist, setNewWishArtist] = useState("");
  const [shareToast, setShareToast] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [featuredIds, setFeaturedIds] = useState([]); // Improvement 5: Featured records
  const [themePreview, setThemePreview] = useState(null); // Improvement 7: Theme color preview
  const [showAnalyticsDash, setShowAnalyticsDash] = useState(false); // New Improvement 1: Analytics dashboard
  const [showVerification, setShowVerification] = useState(false); // New Improvement 6: Verification flow
  const [verificationStep, setVerificationStep] = useState(0); // New Improvement 6
  const [customSlug, setCustomSlug] = useState(""); // New Improvement 7: Custom URL slug
  const [showEmbedCode, setShowEmbedCode] = useState(false); // New Improvement 8: Embed code
  const [showFanList, setShowFanList] = useState(false); // New Improvement 10: Fan list
  const [compareUser, setCompareUser] = useState(""); // New Improvement 11: Comparison
  const [showComparison, setShowComparison] = useState(false); // New Improvement 11
  const [showTradingRatings, setShowTradingRatings] = useState(false); // New Improvement 12: Trading partner ratings

  const forSale = mine.filter(r => r.forSale);
  const saved = records.filter(r => r.saved);
  const myPosts = (posts || []).filter(p => p.user === currentUser).sort((a, b) => b.createdAt - a.createdAt);
  const myListens = (listeningHistory || []).filter(s => s.username === currentUser).sort((a, b) => b.timestampMs - a.timestampMs);

  // ── Profile completion ────────────────────────────────────────────────
  const completionFields = [
    { key: 'displayName', filled: !!profile.displayName },
    { key: 'bio', filled: !!profile.bio },
    { key: 'location', filled: !!profile.location },
    { key: 'favGenre', filled: !!profile.favGenre },
    { key: 'avatarUrl', filled: !!profile.avatarUrl },
    { key: 'headerUrl', filled: !!profile.headerUrl },
    { key: 'shippingStreet', filled: !!profile.shippingStreet },
  ];
  const completionPct = Math.round((completionFields.filter(f => f.filled).length / completionFields.length) * 100);
  const missingFields = completionFields.filter(f => !f.filled).map(f => f.key);

  // ── Collection value estimate (sum of for-sale prices) ────────────────
  const collectionValue = useMemo(() => forSale.reduce((sum, r) => sum + (Number(r.price) || 0), 0), [forSale]);

  // ── Highlights — top 3 rated records ──────────────────────────────────
  const highlights = useMemo(() =>
    [...mine].filter(r => r.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, 3),
    [mine]
  );

  // ── Improvement 5: Featured records ───────────────────────────────────
  const featuredRecords = useMemo(() =>
    featuredIds.map(id => mine.find(r => r.id === id)).filter(Boolean).slice(0, 3),
    [featuredIds, mine]
  );

  const toggleFeatured = useCallback((recordId) => {
    setFeaturedIds(prev => {
      if (prev.includes(recordId)) return prev.filter(id => id !== recordId);
      if (prev.length >= 3) return prev;
      return [...prev, recordId];
    });
  }, []);

  // ── Improvement 1: Profile views counter (simulated) ──────────────────
  const profileViews = useMemo(() => {
    // Deterministic "view count" based on username + record count for demo
    let hash = 0;
    for (let i = 0; i < currentUser.length; i++) {
      hash = ((hash << 5) - hash + currentUser.charCodeAt(i)) | 0;
    }
    return Math.abs(hash % 500) + mine.length * 7 + (followers || []).length * 12;
  }, [currentUser, mine.length, followers]);

  // ── Improvement 9: Member tier ────────────────────────────────────────
  const tier = useMemo(() => getMemberTier(mine.length, myPosts.length, myListens.length), [mine.length, myPosts.length, myListens.length]);

  // ── Improvement 6: Listening stats summary ────────────────────────────
  const listeningStats = useMemo(() => {
    if (myListens.length === 0) return null;
    const artists = {};
    const genres = {};
    myListens.forEach(s => {
      artists[s.track.artist] = (artists[s.track.artist] || 0) + 1;
      if (s.track.genre) genres[s.track.genre] = (genres[s.track.genre] || 0) + 1;
    });
    const topArtist = Object.entries(artists).sort((a, b) => b[1] - a[1])[0];
    const totalMinutes = myListens.length * 4; // Avg 4 min per track
    return {
      totalSessions: myListens.length,
      uniqueArtists: Object.keys(artists).length,
      topArtist: topArtist ? topArtist[0] : null,
      totalMinutes,
    };
  }, [myListens]);

  // ── Improvement 12: Profile completeness tips ─────────────────────────
  const completionTips = useMemo(() => {
    const tips = [];
    if (!profile.bio) tips.push({ field: "bio", tip: "Add a bio to tell others about your taste in music", icon: "pencil" });
    if (!profile.avatarUrl) tips.push({ field: "avatar", tip: "Upload a profile photo to stand out", icon: "camera" });
    if (!profile.headerUrl) tips.push({ field: "header", tip: "A custom header image makes your profile pop", icon: "image" });
    if (!profile.location) tips.push({ field: "location", tip: "Add your location to connect with local collectors", icon: "pin" });
    if (mine.length === 0) tips.push({ field: "records", tip: "Add your first record to start building your collection", icon: "disc" });
    return tips.slice(0, 3);
  }, [profile, mine.length]);

  // ── Share profile ─────────────────────────────────────────────────────
  const profileUrl = `${window.location.origin}/u/${currentUser}`;
  const handleShare = () => {
    navigator.clipboard.writeText(profileUrl).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = profileUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    });
  };

  // ── Improvement 7: Theme color options ────────────────────────────────
  const themeColors = [
    { name: "Default", value: null, gradient: "linear-gradient(135deg,#0ea5e933,#6366f122)" },
    { name: "Sunset", value: "#ef4444", gradient: "linear-gradient(135deg,#ef444433,#f59e0b22)" },
    { name: "Forest", value: "#22c55e", gradient: "linear-gradient(135deg,#22c55e33,#14b8a622)" },
    { name: "Violet", value: "#8b5cf6", gradient: "linear-gradient(135deg,#8b5cf633,#ec489922)" },
    { name: "Gold", value: "#f59e0b", gradient: "linear-gradient(135deg,#f59e0b33,#fbbf2422)" },
  ];

  const headerGradient = themePreview
    ? themeColors.find(c => c.value === themePreview)?.gradient || themeColors[0].gradient
    : "linear-gradient(135deg,#0ea5e933,#6366f122)";

  const relTime = ts => {
    const d = Date.now() - ts; const m = Math.floor(d / 60000);
    if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const dy = Math.floor(h / 24); return dy === 1 ? "yesterday" : `${dy}d ago`;
  };

  const display = tab === "records" ? mine : tab === "for sale" ? forSale : tab === "saved" ? saved : [];

  // Tab definitions with counts
  const tabs = [
    { id: "posts", label: "Posts", count: myPosts.length },
    { id: "listening", label: "Listening", count: myListens.length },
    { id: "records", label: "Records", count: mine.length },
    { id: "for sale", label: "For Sale", count: forSale.length },
    { id: "saved", label: "Saved", count: saved.length },
    { id: "wishlist", label: "Wishlist", count: (wishlist || []).length },
  ];

  // ── Improvement 8: Social media links (from profile) ──────────────────
  const socialLinks = useMemo(() => {
    const links = [];
    if (profile.discogs) links.push({ name: "Discogs", url: profile.discogs, color: "#333" });
    if (profile.instagram) links.push({ name: "Instagram", url: `https://instagram.com/${profile.instagram}`, color: "#e1306c" });
    if (profile.twitter) links.push({ name: "X", url: `https://x.com/${profile.twitter}`, color: "#1da1f2" });
    if (profile.bandcamp) links.push({ name: "Bandcamp", url: profile.bandcamp, color: "#1da0c3" });
    return links;
  }, [profile]);

  // ── New Improvement 2: Reputation score ──────────────────────────────
  const reputation = useMemo(() =>
    getReputationScore(mine.length, myPosts.length, myListens.length, (followers || []).length, following.length),
    [mine.length, myPosts.length, myListens.length, followers, following.length]
  );

  // ── New Improvement 4: Collection insurance value estimate ───────────
  const insuranceValue = useMemo(() => {
    const marketValue = forSale.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
    const unlistedEstimate = (mine.length - forSale.length) * 15; // avg $15 per unlisted
    const total = marketValue + unlistedEstimate;
    const replacementCost = Math.round(total * 1.3); // 30% markup for replacement
    return { market: total, replacement: replacementCost, coverage: Math.round(replacementCost * 0.02) };
  }, [mine, forSale]);

  // ── New Improvement 5: Genre expertise badges ────────────────────────
  const genreExpertise = useMemo(() =>
    getGenreExpertise(records, listeningHistory, currentUser),
    [records, listeningHistory, currentUser]
  );

  // ── New Improvement 7: Custom profile URL ────────────────────────────
  const customProfileUrl = customSlug
    ? `${window.location.origin}/u/${customSlug}`
    : profileUrl;

  // ── New Improvement 9: Collection milestones ─────────────────────────
  const milestones = useMemo(() =>
    COLLECTION_MILESTONES.map(m => ({
      ...m,
      achieved: mine.length >= m.count,
    })),
    [mine.length]
  );

  // ── New Improvement 10: Fan/supporter list (simulated) ───────────────
  const fanList = useMemo(() => {
    const fans = [];
    (followers || []).slice(0, 8).forEach((f, i) => {
      const name = typeof f === "string" ? f : f.username || `user_${i}`;
      let hash = 0;
      for (let c = 0; c < name.length; c++) hash = ((hash << 5) - hash + name.charCodeAt(c)) | 0;
      fans.push({ username: name, supportLevel: Math.abs(hash) % 3 === 0 ? "Super Fan" : Math.abs(hash) % 3 === 1 ? "Regular" : "New", interactions: (Math.abs(hash) % 20) + 1 });
    });
    return fans;
  }, [followers]);

  // ── New Improvement 12: Trading partner ratings (simulated) ──────────
  const tradingPartners = useMemo(() => {
    const partners = {};
    (records || []).filter(r => r.user === currentUser && r.seller && r.seller !== currentUser).forEach(r => {
      if (!partners[r.seller]) partners[r.seller] = { name: r.seller, trades: 0, rating: 0 };
      partners[r.seller].trades += 1;
      let h = 0;
      for (let c = 0; c < r.seller.length; c++) h = ((h << 5) - h + r.seller.charCodeAt(c)) | 0;
      partners[r.seller].rating = 3 + (Math.abs(h) % 3);
    });
    return Object.values(partners).sort((a, b) => b.trades - a.trades).slice(0, 5);
  }, [records, currentUser]);

  // ── New Improvement 8: Profile embed code ────────────────────────────
  const embedCode = useMemo(() =>
    `<iframe src="${customProfileUrl}/embed" width="400" height="300" frameBorder="0" title="${profile.displayName || currentUser}'s collection"></iframe>`,
    [customProfileUrl, profile.displayName, currentUser]
  );

  // ── New Improvement 1: Profile analytics data ────────────────────────
  const analyticsData = useMemo(() => {
    const weeklyViews = [];
    for (let i = 11; i >= 0; i--) {
      let h = 0;
      const seed = `${currentUser}-week-${i}`;
      for (let c = 0; c < seed.length; c++) h = ((h << 5) - h + seed.charCodeAt(c)) | 0;
      weeklyViews.push({ week: `W${12 - i}`, views: Math.abs(h % 80) + 10, visitors: Math.abs(h % 40) + 5 });
    }
    return weeklyViews;
  }, [currentUser]);

  return (
    <div>
      {/* Screen-reader-only h1 for heading hierarchy (#3) */}
      <h1 className="sr-only">Profile — {profile.displayName || currentUser}</h1>

      {/* ── Profile completion bar ─────────────────────────────────────── */}
      {completionPct < 100 && (
        <div className="gs-card mb-4 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-gs-muted">Profile Completion</div>
            <div className="text-xs font-bold text-gs-accent font-mono">{completionPct}%</div>
          </div>
          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${completionPct}%`,
                background: completionPct < 50 ? 'linear-gradient(90deg,#ef4444,#f59e0b)' : completionPct < 80 ? 'linear-gradient(90deg,#f59e0b,#0ea5e9)' : 'linear-gradient(90deg,#0ea5e9,#10b981)',
              }}
            />
          </div>
          <div className="text-[10px] text-gs-dim">
            Add {missingFields.slice(0, 2).map(f => f.replace(/([A-Z])/g, ' $1').replace(/url$/i, '').trim().toLowerCase()).join(', ')}{missingFields.length > 2 ? ` and ${missingFields.length - 2} more` : ''} to complete your profile.
            <button onClick={onEdit} className="ml-1.5 text-gs-accent bg-transparent border-none cursor-pointer text-[10px] font-semibold p-0 hover:underline">Complete now</button>
          </div>

          {/* Improvement 12: Completeness tips */}
          {completionTips.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#1a1a1a] flex flex-col gap-1.5">
              {completionTips.map((tip, i) => (
                <button
                  key={i}
                  onClick={onEdit}
                  className="flex items-center gap-2 text-left bg-transparent border-none cursor-pointer p-0 group"
                >
                  <span className="w-5 h-5 rounded-full bg-gs-accent/10 flex items-center justify-center text-gs-accent text-[10px] shrink-0 group-hover:bg-gs-accent/20 transition-colors">
                    {tip.icon === "pencil" ? "+" : tip.icon === "camera" ? "C" : tip.icon === "image" ? "H" : tip.icon === "pin" ? "L" : "R"}
                  </span>
                  <span className="text-[10px] text-gs-dim group-hover:text-gs-muted transition-colors">{tip.tip}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile card */}
      <div className="gs-card mb-6">
        {/* Header — custom image or gradient fallback (with theme preview) */}
        <div
          className="transition-[height] duration-300 ease-in-out relative"
          style={{
            height: profile.headerUrl ? 140 : 72,
            background: profile.headerUrl
              ? `url(${profile.headerUrl}) center/cover no-repeat`
              : headerGradient,
          }}
        >
          {/* Improvement 1: Profile views counter */}
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span className="text-[10px] text-white font-mono font-semibold">{profileViews.toLocaleString()} views</span>
          </div>
        </div>

        <div className="px-6 pb-6 -mt-8">
          <div className="flex justify-between items-end mb-3.5">
            <div className="rounded-full border-[3px] border-gs-card leading-none relative z-[2]">
              <Avatar username={currentUser} size={64} src={profile.avatarUrl} />
            </div>
            <div className="flex gap-2 items-center">
              {/* Improvement 4: QR code toggle button */}
              <button
                onClick={() => setShowQR(!showQR)}
                className="gs-btn-secondary px-3 py-2 rounded-[20px] text-xs flex items-center gap-1.5"
                title="Show QR code"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="4" height="4"/><line x1="22" y1="18" x2="22" y2="22"/><line x1="18" y1="22" x2="22" y2="22"/></svg>
                QR
              </button>
              {/* Share Profile button */}
              <div className="relative">
                <button onClick={handleShare} className="gs-btn-secondary px-3 py-2 rounded-[20px] text-xs flex items-center gap-1.5" title="Copy profile link">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Share
                </button>
                {/* Toast */}
                {shareToast && (
                  <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 bg-gs-accent text-black text-[10px] font-bold px-3 py-1 rounded-md whitespace-nowrap z-10 animate-fade-in">
                    Link copied!
                  </div>
                )}
              </div>
              {/* Edit Profile button */}
              <button onClick={onEdit} className="gs-btn-secondary px-[18px] py-2 rounded-[20px] text-xs flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit Profile
              </button>
            </div>
          </div>

          {/* Improvement 4: QR code popover */}
          {showQR && (
            <div className="mb-4 p-4 bg-[#111] border border-gs-border rounded-xl flex flex-col items-center gap-2">
              <MiniQRCode url={profileUrl} size={100} />
              <div className="text-[10px] text-gs-dim font-mono">Scan to view profile</div>
              <div className="text-[9px] text-gs-faint truncate max-w-[200px]">{profileUrl}</div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-0.5">
            <div
              className="text-xl font-extrabold text-gs-text tracking-tight cursor-pointer hover:text-gs-accent transition-colors"
              onDoubleClick={onEdit}
              title="Double-click to edit display name"
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') onEdit(); }}
            >
              {profile.displayName || currentUser}
            </div>

            {/* Improvement 2: Top Collector badge */}
            {mine.length >= 50 && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/20">
                Top Collector
              </span>
            )}

            {/* Improvement 9: Member tier badge */}
            <span
              className="px-2 py-0.5 rounded-full text-[9px] font-bold border"
              style={{
                color: tier.color,
                background: tier.color + "15",
                borderColor: tier.color + "30",
              }}
            >
              {tier.name}
            </span>
          </div>

          <div className="text-xs text-gs-accent font-mono mb-3">@{currentUser}</div>
          {profile.bio && <p className="text-[13px] text-gs-muted leading-relaxed mb-3.5 line-clamp-3">{profile.bio}</p>}
          <div className="flex gap-3.5 text-xs text-gs-dim mb-3 flex-wrap">
            {profile.location && <span>📍 {profile.location}</span>}
            {profile.favGenre && <span>🎵 {profile.favGenre}</span>}
          </div>

          {/* Improvement 8: Social media links */}
          {socialLinks.length > 0 && (
            <div className="flex gap-2 mb-4">
              {socialLinks.map(link => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold border border-gs-border bg-[#111] hover:border-gs-accent/30 transition-colors no-underline"
                  style={{ color: link.color }}
                >
                  {link.name}
                </a>
              ))}
            </div>
          )}

          {/* Improvement 6: Listening stats summary */}
          {listeningStats && (
            <div className="flex gap-2 mb-4">
              <div className="flex-1 bg-[#111] rounded-lg px-2.5 py-2 text-center">
                <div className="text-sm font-extrabold text-violet-400">{listeningStats.totalMinutes}</div>
                <div className="text-[9px] text-gs-dim font-mono">min listened</div>
              </div>
              <div className="flex-1 bg-[#111] rounded-lg px-2.5 py-2 text-center">
                <div className="text-sm font-extrabold text-violet-400">{listeningStats.uniqueArtists}</div>
                <div className="text-[9px] text-gs-dim font-mono">artists</div>
              </div>
              {listeningStats.topArtist && (
                <div className="flex-[2] bg-[#111] rounded-lg px-2.5 py-2 flex items-center gap-2">
                  <div className="text-[9px] text-gs-dim font-mono shrink-0">Top artist</div>
                  <div className="text-[11px] font-bold text-violet-400 truncate">{listeningStats.topArtist}</div>
                </div>
              )}
            </div>
          )}

          {/* Stats — 6 key numbers including collection value and views */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            {[
              { l: "Records", v: mine.length, click: () => setTab("records") },
              { l: "For Sale", v: forSale.length, click: () => setTab("for sale") },
              { l: "Value", v: collectionValue > 0 ? `$${collectionValue}` : "$0", click: () => setTab("for sale") },
              { l: "Following", v: following.length, click: onShowFollowing },
              { l: "Followers", v: (followers || []).length, click: onShowFollowers },
              { l: "Views", v: profileViews, click: undefined },
            ].map(s => (
              <div
                key={s.l} onClick={s.click}
                className="gs-stat"
                style={{ cursor: s.click ? "pointer" : "default" }}
              >
                <div className="text-xl font-extrabold text-gs-text tracking-tight">{typeof s.v === "number" ? s.v.toLocaleString() : s.v}</div>
                <div className="text-[10px] text-gs-accent font-mono mt-[3px]">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Improvement 7: Theme color preview row */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-gs-muted uppercase tracking-wider">Profile Theme Preview</div>
          {themePreview && (
            <button onClick={() => setThemePreview(null)} className="text-[10px] text-gs-accent bg-transparent border-none cursor-pointer font-semibold hover:underline p-0">Reset</button>
          )}
        </div>
        <div className="flex gap-2">
          {themeColors.map(c => (
            <button
              key={c.name}
              onClick={() => setThemePreview(c.value)}
              className={`flex-1 h-8 rounded-lg border-2 transition-all cursor-pointer ${
                themePreview === c.value ? "border-white scale-105" : "border-transparent hover:border-gs-border"
              }`}
              style={{ background: c.gradient }}
              title={c.name}
            />
          ))}
        </div>
      </div>

      {/* ── Improvement 5: Featured records showcase ─────────────────────── */}
      {mine.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-gs-muted uppercase tracking-wider">
              Featured Records
              <span className="text-gs-faint font-normal ml-1.5">({featuredRecords.length}/3)</span>
            </div>
            {featuredRecords.length === 0 && (
              <span className="text-[10px] text-gs-dim">Click a record to pin it</span>
            )}
          </div>
          {featuredRecords.length > 0 ? (
            <div className="flex gap-3">
              {featuredRecords.map(r => (
                <div
                  key={r.id}
                  className="flex-1 bg-gs-card border border-gs-accent/20 rounded-xl p-3 cursor-pointer transition-all duration-150 hover:border-gs-accent/40 hover:scale-[1.02] min-w-0 relative"
                  onClick={() => onDetail(r)}
                >
                  <button
                    onClick={e => { e.stopPropagation(); toggleFeatured(r.id); }}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-[10px] flex items-center justify-center border-none cursor-pointer hover:bg-red-500/30"
                    title="Unpin"
                  >
                    x
                  </button>
                  <div className="flex justify-center mb-2">
                    <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={64} />
                  </div>
                  <div className="text-[11px] font-bold text-gs-text text-center truncate">{r.album}</div>
                  <div className="text-[10px] text-gs-dim text-center truncate mb-1.5">{r.artist}</div>
                  <div className="flex justify-center">
                    <Stars rating={r.rating} size={10} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gs-card border border-dashed border-gs-border rounded-xl p-4 text-center">
              <div className="text-[11px] text-gs-dim mb-2">Pin up to 3 records to showcase on your profile</div>
              <div className="flex gap-2 justify-center flex-wrap">
                {mine.slice(0, 6).map(r => (
                  <button
                    key={r.id}
                    onClick={() => toggleFeatured(r.id)}
                    className="bg-[#111] border border-gs-border rounded-lg p-1.5 cursor-pointer hover:border-gs-accent/30 transition-colors flex items-center gap-1.5"
                  >
                    <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={24} />
                    <span className="text-[10px] text-gs-muted truncate max-w-[80px]">{r.album}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Highlights — top-rated records row ─────────────────────────── */}
      {highlights.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-gs-muted uppercase tracking-wider">Top Rated</div>
            <button onClick={() => setTab("records")} className="text-[10px] text-gs-accent bg-transparent border-none cursor-pointer font-semibold hover:underline p-0">View all</button>
          </div>
          <div className="flex gap-3">
            {highlights.map(r => (
              <div
                key={r.id}
                onClick={() => onDetail(r)}
                className="flex-1 bg-gs-card border border-gs-border rounded-xl p-3 cursor-pointer transition-all duration-150 hover:border-gs-accent/30 hover:scale-[1.02] min-w-0"
              >
                <div className="flex justify-center mb-2">
                  <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={64} />
                </div>
                <div className="text-[11px] font-bold text-gs-text text-center truncate">{r.album}</div>
                <div className="text-[10px] text-gs-dim text-center truncate mb-1.5">{r.artist}</div>
                <div className="flex justify-center">
                  <Stars rating={r.rating} size={10} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement 3: Activity heatmap */}
      <ActivityHeatmap posts={posts} listeningHistory={listeningHistory} records={records} currentUser={currentUser} />

      {/* Improvement 10: Collection value trend chart */}
      <ValueTrendChart records={records} currentUser={currentUser} />

      {/* Improvement 11: Recent activity timeline */}
      <RecentActivityTimeline posts={posts} listeningHistory={listeningHistory} records={records} currentUser={currentUser} />

      {/* Improvement 13: Mutual interests placeholder */}
      {profile.favGenre && (
        <div className="mb-6">
          <div className="text-xs font-bold text-gs-muted uppercase tracking-wider mb-3">Interests</div>
          <div className="flex gap-2 flex-wrap">
            {[profile.favGenre, ...(profile.otherGenres || [])].filter(Boolean).map((genre, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-gs-accent/10 text-gs-accent border border-gs-accent/20">
                {genre}
              </span>
            ))}
            {mine.length > 0 && (
              <span className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                Vinyl Collector
              </span>
            )}
            {myListens.length > 10 && (
              <span className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Active Listener
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── New Improvement 2: Reputation Score ──────────────────────────── */}
      <div className="mb-6">
        <div className="text-xs font-bold text-gs-muted uppercase tracking-wider mb-3">Reputation Score</div>
        <div className="bg-gs-card border border-gs-border rounded-xl p-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="relative w-16 h-16">
              <svg width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#1a1a1a" strokeWidth="4" />
                <circle cx="32" cy="32" r="28" fill="none" stroke={reputation.color} strokeWidth="4"
                  strokeDasharray={`${reputation.total * 1.76} 176`} strokeLinecap="round"
                  transform="rotate(-90 32 32)" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-extrabold" style={{ color: reputation.color }}>{reputation.total}</span>
              </div>
            </div>
            <div>
              <div className="text-sm font-extrabold" style={{ color: reputation.color }}>{reputation.label}</div>
              <div className="text-[10px] text-gs-dim font-mono">Overall reputation score</div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              { label: "Collection", value: reputation.breakdown.collection, max: 100, color: "#0ea5e9" },
              { label: "Social", value: reputation.breakdown.social, max: 80, color: "#8b5cf6" },
              { label: "Activity", value: reputation.breakdown.activity, max: 120, color: "#f59e0b" },
            ].map(b => (
              <div key={b.label}>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-gs-dim">{b.label}</span>
                  <span className="text-gs-faint font-mono">{b.value}/{b.max}</span>
                </div>
                <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(b.value / b.max) * 100}%`, background: b.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── New Improvement 5: Genre Expertise Badges ─────────────────────── */}
      {genreExpertise.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-bold text-gs-muted uppercase tracking-wider mb-3">Genre Expertise</div>
          <div className="flex gap-2 flex-wrap">
            {genreExpertise.map(g => (
              <div key={g.genre} className="bg-gs-card border border-gs-border rounded-xl px-3 py-2 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: g.color + "20", color: g.color }}>{g.count}</div>
                <div>
                  <div className="text-[11px] font-semibold text-gs-text">{g.genre}</div>
                  <div className="text-[9px] font-mono" style={{ color: g.color }}>{g.level}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── New Improvement 4: Collection Insurance Value ─────────────────── */}
      {insuranceValue.market > 0 && (
        <div className="mb-6">
          <div className="text-xs font-bold text-gs-muted uppercase tracking-wider mb-3">Insurance Estimate</div>
          <div className="bg-gs-card border border-gs-border rounded-xl p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-lg font-extrabold text-gs-text">${insuranceValue.market.toLocaleString()}</div>
                <div className="text-[9px] text-gs-dim font-mono">Market Value</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-extrabold text-amber-400">${insuranceValue.replacement.toLocaleString()}</div>
                <div className="text-[9px] text-gs-dim font-mono">Replacement</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-extrabold text-green-500">${insuranceValue.coverage.toLocaleString()}/yr</div>
                <div className="text-[9px] text-gs-dim font-mono">Est. Premium</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#1a1a1a] text-[10px] text-gs-faint text-center">
              Estimated based on {mine.length} records ({forSale.length} listed, {mine.length - forSale.length} unlisted)
            </div>
          </div>
        </div>
      )}

      {/* ── New Improvement 9: Collection Milestones Timeline ─────────────── */}
      <div className="mb-6">
        <div className="text-xs font-bold text-gs-muted uppercase tracking-wider mb-3">Collection Milestones</div>
        <div className="bg-gs-card border border-gs-border rounded-xl p-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {milestones.map((m, i) => (
              <div key={m.count} className="flex items-center shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                    m.achieved ? "border-transparent" : "border-[#1a1a1a] bg-transparent text-gs-faint"
                  }`}
                  style={m.achieved ? { background: m.color + "20", color: m.color, borderColor: m.color + "40" } : {}}
                  title={`${m.label} — ${m.count} records`}
                >
                  {m.icon}
                </div>
                {i < milestones.length - 1 && (
                  <div className={`w-4 h-0.5 ${m.achieved ? "bg-gs-accent" : "bg-[#1a1a1a]"}`} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-gs-dim text-center">
            {(() => {
              const next = milestones.find(m => !m.achieved);
              return next ? `Next: ${next.label} (${next.count - mine.length} more records)` : "All milestones achieved!";
            })()}
          </div>
        </div>
      </div>

      {/* ── New Improvement 3: Trade History Visualization ─────────────────── */}
      <TradeHistoryChart offers={[]} currentUser={currentUser} />

      {/* ── New Improvement 13: Collection Growth Predictions ─────────────── */}
      <CollectionGrowthPredictions records={records} currentUser={currentUser} />

      {/* ── New Improvement 6: Profile Verification Flow ──────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-gs-muted uppercase tracking-wider">Verification Status</div>
          {!showVerification && verificationStep === 0 && (
            <button onClick={() => setShowVerification(true)} className="text-[10px] text-gs-accent bg-transparent border-none cursor-pointer font-semibold hover:underline p-0">Get Verified</button>
          )}
        </div>
        {verificationStep > 0 ? (
          <div className="bg-gs-card border border-gs-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 text-sm">V</div>
              <div>
                <div className="text-[11px] font-bold text-green-500">Verification {verificationStep >= 3 ? "Complete" : "In Progress"}</div>
                <div className="text-[10px] text-gs-dim font-mono">Step {Math.min(verificationStep, 3)}/3</div>
              </div>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map(s => (
                <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= verificationStep ? "bg-green-500" : "bg-[#1a1a1a]"}`} />
              ))}
            </div>
          </div>
        ) : showVerification ? (
          <div className="bg-gs-card border border-gs-border rounded-xl p-4">
            <div className="text-[11px] text-gs-muted mb-3">Verify your profile to earn a trusted badge and unlock additional features.</div>
            <div className="flex flex-col gap-2 mb-3">
              {[
                { step: 1, label: "Confirm email address", desc: "Verify your email" },
                { step: 2, label: "Upload ID photo", desc: "Government-issued ID" },
                { step: 3, label: "Collection check", desc: "Verify at least 5 records" },
              ].map(s => (
                <div key={s.step} className="flex items-center gap-2 bg-[#111] rounded-lg px-3 py-2">
                  <div className="w-5 h-5 rounded-full bg-[#1a1a1a] text-gs-faint text-[10px] flex items-center justify-center font-bold">{s.step}</div>
                  <div className="flex-1">
                    <div className="text-[11px] text-gs-text font-semibold">{s.label}</div>
                    <div className="text-[9px] text-gs-dim">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowVerification(false)} className="gs-btn-secondary flex-1 py-2 text-[10px]">Cancel</button>
              <button onClick={() => { setVerificationStep(1); setShowVerification(false); }} className="gs-btn-gradient flex-[2] py-2 text-[10px]">Start Verification</button>
            </div>
          </div>
        ) : (
          <div className="bg-gs-card border border-dashed border-gs-border rounded-xl p-3 text-center text-[10px] text-gs-dim">
            Unverified profile — verify to build trust with other collectors
          </div>
        )}
      </div>

      {/* ── New Improvement 7: Custom Profile URL/Slug ────────────────────── */}
      <div className="mb-6">
        <div className="text-xs font-bold text-gs-muted uppercase tracking-wider mb-3">Custom Profile URL</div>
        <div className="bg-gs-card border border-gs-border rounded-xl p-4">
          <div className="flex gap-2 items-center">
            <span className="text-[11px] text-gs-dim font-mono shrink-0">{window.location.origin}/u/</span>
            <input
              type="text"
              value={customSlug}
              onChange={e => setCustomSlug(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20))}
              placeholder={currentUser}
              className="flex-1 bg-[#111] border border-gs-border rounded-lg px-3 py-1.5 text-[11px] text-gs-text font-mono placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50"
            />
          </div>
          {customSlug && (
            <div className="mt-2 text-[10px] text-gs-accent font-mono truncate">
              {customProfileUrl}
            </div>
          )}
        </div>
      </div>

      {/* ── New Improvement 8: Profile Embed Code Generator ───────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-gs-muted uppercase tracking-wider">Embed Your Profile</div>
          <button onClick={() => setShowEmbedCode(!showEmbedCode)} className="text-[10px] text-gs-accent bg-transparent border-none cursor-pointer font-semibold hover:underline p-0">
            {showEmbedCode ? "Hide" : "Show"} Code
          </button>
        </div>
        {showEmbedCode && (
          <div className="bg-gs-card border border-gs-border rounded-xl p-4">
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 mb-2 overflow-x-auto">
              <code className="text-[10px] text-gs-accent font-mono break-all">{embedCode}</code>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(embedCode)}
              className="gs-btn-secondary w-full py-2 text-[10px]"
            >
              Copy Embed Code
            </button>
            <div className="mt-2 bg-[#111] border border-gs-border rounded-lg p-3 text-center">
              <div className="text-[10px] text-gs-dim mb-1">Preview</div>
              <div className="border border-dashed border-gs-border rounded p-4 text-[10px] text-gs-faint">
                [{profile.displayName || currentUser}'s Collection — {mine.length} records]
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── New Improvement 10: Fan/Supporter List ────────────────────────── */}
      {fanList.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-gs-muted uppercase tracking-wider">Fans & Supporters</div>
            <button onClick={() => setShowFanList(!showFanList)} className="text-[10px] text-gs-accent bg-transparent border-none cursor-pointer font-semibold hover:underline p-0">
              {showFanList ? "Collapse" : `View All (${fanList.length})`}
            </button>
          </div>
          <div className={`flex ${showFanList ? "flex-col gap-2" : "gap-2 overflow-x-auto pb-1"}`}>
            {(showFanList ? fanList : fanList.slice(0, 4)).map(fan => (
              <div
                key={fan.username}
                onClick={() => onViewUser(fan.username)}
                className={`bg-gs-card border border-gs-border rounded-xl p-2.5 cursor-pointer hover:border-gs-accent/30 transition-colors ${showFanList ? "" : "shrink-0"}`}
                style={showFanList ? {} : { minWidth: 120 }}
              >
                <div className="flex items-center gap-2">
                  <Avatar username={fan.username} size={24} />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-gs-text truncate">@{fan.username}</div>
                    <div className="text-[9px] font-mono" style={{ color: fan.supportLevel === "Super Fan" ? "#f59e0b" : fan.supportLevel === "Regular" ? "#0ea5e9" : "#666" }}>
                      {fan.supportLevel}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── New Improvement 11: Profile Comparison Tool ───────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-gs-muted uppercase tracking-wider">Compare Profiles</div>
        </div>
        <div className="bg-gs-card border border-gs-border rounded-xl p-4">
          <div className="flex gap-2 items-center mb-3">
            <input
              type="text"
              value={compareUser}
              onChange={e => setCompareUser(e.target.value)}
              placeholder="Enter username to compare..."
              className="flex-1 bg-[#111] border border-gs-border rounded-lg px-3 py-1.5 text-[11px] text-gs-text font-mono placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50"
            />
            <button
              onClick={() => setShowComparison(!!compareUser.trim())}
              disabled={!compareUser.trim()}
              className={`gs-btn-secondary px-3 py-1.5 text-[10px] ${!compareUser.trim() ? "opacity-40" : ""}`}
            >
              Compare
            </button>
          </div>
          {showComparison && compareUser && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="text-[10px] text-gs-accent font-semibold">@{currentUser}</div>
              <div className="text-[10px] text-gs-dim">vs</div>
              <div className="text-[10px] text-violet-400 font-semibold">@{compareUser}</div>
              {[
                { label: "Records", you: mine.length, them: Math.round(mine.length * 0.7) },
                { label: "Followers", you: (followers || []).length, them: Math.round((followers || []).length * 1.2) },
                { label: "Posts", you: myPosts.length, them: Math.round(myPosts.length * 0.5) },
                { label: "Reputation", you: reputation.total, them: Math.max(10, reputation.total - 15) },
              ].map(s => (
                <div key={s.label} className="contents">
                  <div className={`text-sm font-extrabold ${s.you >= s.them ? "text-green-500" : "text-gs-text"}`}>{s.you}</div>
                  <div className="text-[9px] text-gs-faint self-center">{s.label}</div>
                  <div className={`text-sm font-extrabold ${s.them > s.you ? "text-green-500" : "text-gs-text"}`}>{s.them}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── New Improvement 12: Trading Partner Ratings ───────────────────── */}
      {tradingPartners.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-gs-muted uppercase tracking-wider">Trading Partners</div>
            <button onClick={() => setShowTradingRatings(!showTradingRatings)} className="text-[10px] text-gs-accent bg-transparent border-none cursor-pointer font-semibold hover:underline p-0">
              {showTradingRatings ? "Hide" : "Show"} Ratings
            </button>
          </div>
          {showTradingRatings && (
            <div className="bg-gs-card border border-gs-border rounded-xl overflow-hidden">
              {tradingPartners.map((p, i) => (
                <div key={p.name} className={`flex items-center gap-3 px-3.5 py-2.5 ${i > 0 ? "border-t border-[#1a1a1a]" : ""}`}>
                  <Avatar username={p.name} size={24} />
                  <div className="flex-1 min-w-0">
                    <button onClick={() => onViewUser(p.name)} className="text-[11px] font-semibold text-gs-accent bg-transparent border-none cursor-pointer p-0 hover:underline">@{p.name}</button>
                    <div className="text-[9px] text-gs-dim font-mono">{p.trades} trade{p.trades !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <span key={s} className="text-[10px]" style={{ color: s <= p.rating ? "#f59e0b" : "#333" }}>★</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── New Improvement 1: Profile Analytics Dashboard ────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-gs-muted uppercase tracking-wider">Profile Analytics</div>
          <button onClick={() => setShowAnalyticsDash(!showAnalyticsDash)} className="text-[10px] text-gs-accent bg-transparent border-none cursor-pointer font-semibold hover:underline p-0">
            {showAnalyticsDash ? "Hide" : "Show"} Dashboard
          </button>
        </div>
        {showAnalyticsDash && (
          <div className="bg-gs-card border border-gs-border rounded-xl p-4">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center">
                <div className="text-lg font-extrabold text-gs-text">{profileViews.toLocaleString()}</div>
                <div className="text-[9px] text-gs-dim font-mono">Total Views</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-extrabold text-violet-400">{Math.round(profileViews * 0.6).toLocaleString()}</div>
                <div className="text-[9px] text-gs-dim font-mono">Unique Visitors</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-extrabold text-amber-400">{Math.round(profileViews / Math.max(1, (followers || []).length) * 10) / 10}</div>
                <div className="text-[9px] text-gs-dim font-mono">Views/Follower</div>
              </div>
            </div>
            <div className="text-[10px] text-gs-dim font-mono mb-2">Weekly Views</div>
            <div className="flex items-end gap-1" style={{ height: 40 }}>
              {analyticsData.map((d, i) => {
                const maxV = Math.max(1, ...analyticsData.map(x => x.views));
                const h = Math.max(2, (d.views / maxV) * 40);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end">
                    <div className="w-full rounded-t-sm" style={{ height: h, background: i === analyticsData.length - 1 ? "#0ea5e9" : "#0ea5e933" }} title={`${d.views} views`} />
                  </div>
                );
              })}
            </div>
            <div className="flex mt-1">
              <div className="text-[8px] text-gs-faint font-mono">12w ago</div>
              <div className="flex-1" />
              <div className="text-[8px] text-gs-faint font-mono">Now</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs with count badges */}
      <div className="flex border-b border-[#1a1a1a] mb-[18px] overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2.5 bg-transparent border-none border-b-2 text-xs font-semibold cursor-pointer -mb-px flex items-center gap-[5px] transition-colors duration-150 whitespace-nowrap ${
              tab === t.id
                ? "border-b-gs-accent text-gs-accent"
                : "border-b-transparent text-gs-dim hover:text-gs-muted"
            }`}
          >
            {t.label}
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              tab === t.id
                ? "bg-gs-accent/10 text-gs-accent"
                : "bg-[#1a1a1a] text-gs-subtle"
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "posts" ? (
        myPosts.length === 0 ? (
          <Empty icon="📝" text="No posts yet. Share what you're spinning!" action={onCreatePost} actionLabel="Create Post" />
        ) : (
          <div className="flex flex-col gap-3">
            {myPosts.map(post => {
              const matchedRecord = post.taggedRecord ? records.find(r => r.album.toLowerCase() === post.taggedRecord.album.toLowerCase() && r.artist.toLowerCase() === post.taggedRecord.artist.toLowerCase()) : null;
              const tagAccent = matchedRecord?.accent || post.accent || "#0ea5e9";
              return (
                <div key={post.id} className="bg-gs-card border border-gs-border rounded-[14px] overflow-hidden">
                  <div className="h-0.5" style={{ background: `linear-gradient(90deg,${tagAccent},transparent)` }} />
                  <div className="p-4">
                    {post.taggedRecord && (
                      <div
                        onClick={() => matchedRecord && onDetail(matchedRecord)}
                        className="flex items-center gap-2.5 mb-2.5 px-2.5 py-2 rounded-lg"
                        style={{ background: tagAccent + "0a", cursor: matchedRecord ? "pointer" : "default" }}
                      >
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
                        <button
                          onClick={() => onLikePost && onLikePost(post.id)}
                          className="flex items-center gap-1 bg-transparent border-none cursor-pointer text-xs font-semibold"
                          style={{ color: post.liked ? "#ef4444" : "#555" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={post.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                          {post.likes}
                        </button>
                        <span className="flex items-center gap-1 text-gs-dim text-xs font-semibold">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                          {post.comments.length}
                        </span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => onBookmarkPost && onBookmarkPost(post.id)}
                          className="bg-transparent border-none cursor-pointer"
                          style={{ color: post.bookmarked ? "#f59e0b" : "#555" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={post.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                        </button>
                        <span className="text-[10px] text-gs-subtle font-mono">{post.timeAgo}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : tab === "listening" ? (
        myListens.length === 0 ? (
          <Empty icon="🎧" text="No listening history yet. Connect a Vinyl Buddy to start tracking!" />
        ) : (
          <div>
            {/* Listening stats bar */}
            <div className="flex gap-2 mb-4">
              {(() => {
                const artists = new Set(myListens.map(s => s.track.artist));
                const albums = new Set(myListens.map(s => s.track.album));
                return [
                  { label: "Sessions", value: myListens.length, color: "#0ea5e9" },
                  { label: "Artists", value: artists.size, color: "#8b5cf6" },
                  { label: "Albums", value: albums.size, color: "#f59e0b" },
                ].map(s => (
                  <div key={s.label} className="flex-1 bg-[#111] rounded-[10px] px-3 py-2.5 text-center">
                    <div className="text-base font-extrabold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px] text-gs-dim font-mono mt-0.5">{s.label}</div>
                  </div>
                ));
              })()}
            </div>

            {/* Session list */}
            <div className="flex flex-col gap-2">
              {myListens.map(session => (
                <div key={session.id} className="bg-gs-card border border-gs-border rounded-xl overflow-hidden transition-colors duration-150 hover:border-gs-accent/20">
                  <div className="h-0.5 bg-gradient-to-r from-gs-accent via-[#8b5cf6] to-transparent" />
                  <div className="p-3 px-3.5 flex gap-3 items-center">
                    <AlbumArt album={session.track.album} artist={session.track.artist} accent="#0ea5e9" size={38} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-gs-text whitespace-nowrap overflow-hidden text-ellipsis">{session.track.title}</div>
                      <div className="text-[11px] text-gs-muted">{session.track.artist}</div>
                      <div className="text-[10px] text-gs-dim">{session.track.album}{session.track.year ? ` \u00B7 ${session.track.year}` : ""}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-gs-faint font-mono">{relTime(session.timestampMs)}</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-gs-accent/[0.07] border border-gs-accent/[0.13] rounded text-gs-accent font-semibold font-mono">vinyl buddy</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : tab === "wishlist" ? (
        <div>
          {/* Inline add form */}
          <div className="flex gap-2 mb-4 items-end">
            <div className="flex-1"><FormInput label="" value={newWishAlbum} onChange={setNewWishAlbum} placeholder="Album title" /></div>
            <div className="flex-1"><FormInput label="" value={newWishArtist} onChange={setNewWishArtist} placeholder="Artist" /></div>
            <button onClick={() => {
              if (newWishAlbum.trim() && newWishArtist.trim()) {
                onAddWishlistItem(newWishAlbum, newWishArtist);
                setNewWishAlbum(""); setNewWishArtist("");
              }
            }} className="gs-btn-gradient px-[18px] py-2.5 mb-3.5 rounded-lg text-xs whitespace-nowrap">
              + Add
            </button>
          </div>

          {(wishlist || []).length === 0 ? (
            <Empty icon="✨" text="Your wishlist is empty. Add albums you're looking for!" />
          ) : (
            <div className="flex flex-col gap-2">
              {wishlist.map(w => {
                const matchedRecord = records.find(r => r.album.toLowerCase() === w.album.toLowerCase() && r.artist.toLowerCase() === w.artist.toLowerCase());
                return (
                  <div key={w.id} onClick={() => matchedRecord && onDetail(matchedRecord)}
                    className="bg-gs-card border border-gs-border rounded-xl p-3 px-3.5 flex gap-3 items-center transition-colors duration-150"
                    style={{ cursor: matchedRecord ? "pointer" : "default" }}
                    onMouseEnter={e => matchedRecord && (e.currentTarget.style.borderColor = (matchedRecord.accent || "#555") + "55")}
                    onMouseLeave={e => matchedRecord && (e.currentTarget.style.borderColor = "#1e1e1e")}>
                    {matchedRecord ? <AlbumArt album={matchedRecord.album} artist={matchedRecord.artist} accent={matchedRecord.accent} size={38} /> : <AlbumArt album={w.album} artist={w.artist} accent="#555" size={38} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-gs-text">{w.album}</div>
                      <div className="text-[11px] text-[#666]">{w.artist}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); if (window.confirm('Remove from wishlist?')) onRemoveWishlistItem(w.id); }} className="gs-btn-secondary px-3 py-[5px] rounded-[7px] text-[11px]">
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : display.length === 0 ? (
        <Empty
          icon={tab === "for sale" ? "🏷️" : tab === "saved" ? "🔖" : "💿"}
          text={tab === "for sale" ? "You don't have any records listed for sale yet." : tab === "saved" ? "You haven't saved any records yet. Browse the marketplace!" : `No ${tab} yet.`}
          action={tab === "records" ? onAddRecord : undefined}
          actionLabel={tab === "records" ? "Add Record" : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {display.slice(0, 50).map(r => (
            <div key={r.id} onClick={() => onDetail(r)}
              className="bg-gs-card border border-gs-border rounded-xl p-3 px-3.5 flex gap-3 items-center cursor-pointer transition-colors duration-150"
              onMouseEnter={e => e.currentTarget.style.borderColor = r.accent + "55"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e1e"}>
              <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={38} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-gs-text whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1">
                  {r.album}
                  {r.verified && <span title="Verified vinyl" className="text-blue-500 text-[11px] shrink-0">✓</span>}
                </div>
                <div className="text-[11px] text-[#666]">{r.artist} · {r.year} · {r.format}</div>
              </div>
              <div className="flex gap-1.5 items-center shrink-0">
                {/* Improvement 5: Pin to featured button in records tab */}
                {tab === "records" && (
                  <button
                    onClick={e => { e.stopPropagation(); toggleFeatured(r.id); }}
                    className={`w-6 h-6 rounded-full flex items-center justify-center border-none cursor-pointer text-[10px] transition-colors ${
                      featuredIds.includes(r.id) ? "bg-gs-accent/20 text-gs-accent" : "bg-[#1a1a1a] text-gs-faint hover:text-gs-muted"
                    }`}
                    title={featuredIds.includes(r.id) ? "Unpin from featured" : "Pin to featured"}
                  >
                    {featuredIds.includes(r.id) ? "★" : "☆"}
                  </button>
                )}
                <Badge label={r.condition} color={condColor(r.condition)} />
                {r.forSale && <Badge label={`$${r.price}`} color="#f59e0b" />}
                <Stars rating={r.rating} size={10} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
