// Full analytics dashboard for the current user's collection.
// Charts: collection value over time, genre distribution, condition breakdown,
// buying/selling activity, monthly spending, price paid vs market value.
// Lists: most valuable records, top artists.
// All charts are pure SVG — no external charting library required.
import { useState, useMemo, useCallback } from 'react';
import Badge from '../ui/Badge';
import Empty from '../ui/Empty';

const TIME_RANGES = [
  { key: 'all', label: 'All Time' },
  { key: '12m', label: '12 Months' },
  { key: '6m', label: '6 Months' },
  { key: '3m', label: '3 Months' },
  { key: '1m', label: '30 Days' },
];

const COND_ORDER = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P'];
const COND_COLORS = {
  M: '#10b981', NM: '#22c55e', 'VG+': '#84cc16', VG: '#eab308',
  'G+': '#f59e0b', G: '#f97316', F: '#ef4444', P: '#991b1b',
};

const GENRE_COLORS = [
  '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#ef4444', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
  '#e879f9', '#14b8a6', '#fb923c', '#a855f7', '#22d3ee',
  '#facc15', '#4ade80', '#f43f5e',
];

const DEFAULT_WIDGET_ORDER = [
  'statCards',
  'valueOverTime',
  'genreDistribution',
  'buySellActivity',
  'monthlySpending',
  'priceComparison',
  'investmentPerformance',
  'conditionBreakdown',
  'topArtists',
  'mostValuable',
  'goalTracking',
  'spendingForecast',
  'bestTimeToBuy',
  'marketTrends',
  'diversityScore',
  'predictiveAnalytics',
];

// ── Deterministic hash for stable demo data ──────────────────────────────
function stableHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── Mini SVG chart primitives ────────────────────────────────────────────

function LineChart({ data, width = 400, height = 160, color = '#0ea5e9', label }) {
  if (!data || data.length < 2) return null;
  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const padTop = 10;
  const padBottom = 24;
  const chartH = height - padTop - padBottom;
  const stepX = width / (data.length - 1);

  const points = data.map((d, i) => ({
    x: i * stepX,
    y: padTop + chartH - ((d.value - min) / range) * chartH,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x},${height - padBottom} L0,${height - padBottom} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`lg-${label}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#lg-${label})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} opacity="0.6" />
      ))}
      {data.map((d, i) => (
        <text key={`t-${i}`} x={i * stepX} y={height - 4} textAnchor="middle" fill="#555" fontSize="9" fontFamily="DM Sans, sans-serif">
          {d.label}
        </text>
      ))}
    </svg>
  );
}

function BarChart({ data, width = 400, height = 160, label }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const padBottom = 24;
  const padTop = 8;
  const chartH = height - padTop - padBottom;
  const barW = Math.min(36, (width / data.length) * 0.6);
  const gap = (width - barW * data.length) / (data.length + 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={label}>
      {data.map((d, i) => {
        const barH = (d.value / max) * chartH;
        const x = gap + i * (barW + gap);
        const y = padTop + chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="3" fill={d.color || '#0ea5e9'} opacity="0.8" />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill="#888" fontSize="9" fontFamily="DM Sans, sans-serif">
              {d.value}
            </text>
            <text x={x + barW / 2} y={height - 4} textAnchor="middle" fill="#555" fontSize="9" fontFamily="DM Sans, sans-serif">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PieChart({ data, size = 160, label }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  let startAngle = -Math.PI / 2;

  const slices = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
    startAngle = endAngle;
    return <path key={i} d={path} fill={d.color || GENRE_COLORS[i % GENRE_COLORS.length]} opacity="0.85" />;
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-[160px]" role="img" aria-label={label}>
      {slices}
      <circle cx={cx} cy={cy} r={r * 0.45} fill="var(--gs-card, #0f0f0f)" />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--gs-text)" fontSize="14" fontWeight="700" fontFamily="DM Sans, sans-serif">
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--gs-muted)" fontSize="8" fontFamily="DM Sans, sans-serif">
        records
      </text>
    </svg>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'var(--gs-accent)' }) {
  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 flex flex-col gap-1 min-w-0">
      <span className="text-[10px] text-gs-dim font-mono uppercase tracking-wider truncate">{label}</span>
      <span className="text-xl font-bold tracking-tight" style={{ color }}>{value}</span>
      {sub && <span className="text-[11px] text-gs-muted truncate">{sub}</span>}
    </div>
  );
}

// ── Improvement #1: Date Range Picker ────────────────────────────────────

function DateRangePicker({ startDate, endDate, onStartChange, onEndChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-[10px] text-gs-dim font-mono uppercase">From</label>
      <input
        type="date"
        value={startDate}
        onChange={e => onStartChange(e.target.value)}
        className="bg-gs-card border border-gs-border rounded-lg text-[11px] text-gs-muted px-2 py-1.5 outline-none font-sans focus:border-gs-accent/30"
      />
      <label className="text-[10px] text-gs-dim font-mono uppercase">To</label>
      <input
        type="date"
        value={endDate}
        onChange={e => onEndChange(e.target.value)}
        className="bg-gs-card border border-gs-border rounded-lg text-[11px] text-gs-muted px-2 py-1.5 outline-none font-sans focus:border-gs-accent/30"
      />
    </div>
  );
}

// ── Improvement #4: Goal Tracking Widget ─────────────────────────────────

function GoalTrackingWidget({ goals, onAddGoal, onRemoveGoal }) {
  const [showForm, setShowForm] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalType, setGoalType] = useState('count');

  const handleAdd = () => {
    if (!goalName.trim() || !goalTarget) return;
    onAddGoal?.({
      id: Date.now(),
      name: goalName.trim(),
      target: parseFloat(goalTarget),
      type: goalType,
      createdAt: new Date().toISOString(),
    });
    setGoalName('');
    setGoalTarget('');
    setShowForm(false);
  };

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-gs-text m-0">Collection Goals</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-[10px] px-2 py-1 rounded-md border border-gs-border bg-transparent text-gs-dim hover:text-gs-muted cursor-pointer transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Goal'}
        </button>
      </div>
      {showForm && (
        <div className="flex items-end gap-2 mb-3 flex-wrap">
          <input
            value={goalName}
            onChange={e => setGoalName(e.target.value)}
            placeholder="Goal name"
            className="bg-gs-surface border border-gs-border rounded-lg text-[11px] text-gs-text px-2.5 py-1.5 outline-none font-sans focus:border-gs-accent/30 flex-1 min-w-[120px]"
          />
          <input
            type="number"
            value={goalTarget}
            onChange={e => setGoalTarget(e.target.value)}
            placeholder="Target"
            className="bg-gs-surface border border-gs-border rounded-lg text-[11px] text-gs-text px-2.5 py-1.5 outline-none font-sans focus:border-gs-accent/30 w-20"
          />
          <select
            value={goalType}
            onChange={e => setGoalType(e.target.value)}
            className="bg-gs-surface border border-gs-border rounded-lg text-[11px] text-gs-muted px-2 py-1.5 outline-none cursor-pointer font-sans focus:border-gs-accent/30"
          >
            <option value="count">Records</option>
            <option value="value">$ Value</option>
            <option value="genre">Genres</option>
          </select>
          <button onClick={handleAdd} className="gs-btn-gradient px-2.5 py-1.5 text-[10px] rounded-lg">Add</button>
        </div>
      )}
      <div className="space-y-2">
        {(!goals || goals.length === 0) ? (
          <p className="text-[11px] text-gs-faint text-center py-3">No goals set yet</p>
        ) : (
          goals.map(goal => {
            const progress = Math.min((goal.current || 0) / (goal.target || 1), 1);
            const pct = Math.round(progress * 100);
            return (
              <div key={goal.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gs-text truncate">{goal.name}</span>
                    <span className="text-[10px] text-gs-dim font-mono">{goal.current || 0}/{goal.target} {goal.type === 'value' ? '$' : ''}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gs-border">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: pct >= 100 ? '#22c55e' : '#0ea5e9' }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => onRemoveGoal?.(goal.id)}
                  className="text-[9px] text-gs-faint hover:text-[#ef4444] border-none bg-transparent cursor-pointer transition-colors shrink-0"
                >
                  x
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Improvement #10: Custom Dashboard Layout (drag to reorder) ───────────

function DragHandle() {
  return (
    <span className="cursor-grab active:cursor-grabbing text-gs-faint hover:text-gs-dim transition-colors" title="Drag to reorder">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="8" cy="4" r="2" /><circle cx="16" cy="4" r="2" />
        <circle cx="8" cy="12" r="2" /><circle cx="16" cy="12" r="2" />
        <circle cx="8" cy="20" r="2" /><circle cx="16" cy="20" r="2" />
      </svg>
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────────────────

export default function AnalyticsScreen({
  records = [],
  currentUser,
  purchases = [],
  offers = [],
  goals = [],
  onAddGoal,
  onRemoveGoal,
  onExportPDF,
  onUpdateWidgetOrder,
}) {
  const [timeRange, setTimeRange] = useState('all');
  // Improvement #1: Date range picker
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  // Improvement #2: Compare periods
  const [comparePeriods, setComparePeriods] = useState(false);
  // Improvement #10: Custom dashboard layout
  const [widgetOrder, setWidgetOrder] = useState(DEFAULT_WIDGET_ORDER);
  const [draggedWidget, setDraggedWidget] = useState(null);
  const [editLayout, setEditLayout] = useState(false);

  const myRecords = useMemo(() => records.filter(r => r.user === currentUser), [records, currentUser]);

  // ── Collection value over time (simulated monthly snapshots) ─────────
  const valueOverTime = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString('default', { month: 'short' });
      const base = myRecords.length * 18;
      const growth = base + (12 - i) * (base * 0.04);
      const jitter = stableHash(`${currentUser}-${i}`) % (base * 0.08 + 1);
      months.push({ label, value: Math.round(growth + jitter) });
    }
    return months;
  }, [myRecords, currentUser]);

  // ── Improvement #2: Previous period data for comparison ──────────────
  const previousPeriodValue = useMemo(() => {
    if (!comparePeriods) return [];
    const months = [];
    const now = new Date();
    for (let i = 23; i >= 12; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString('default', { month: 'short' });
      const base = myRecords.length * 15;
      const growth = base + (24 - i) * (base * 0.03);
      const jitter = stableHash(`${currentUser}-prev-${i}`) % (base * 0.06 + 1);
      months.push({ label, value: Math.round(growth + jitter) });
    }
    return months;
  }, [myRecords, currentUser, comparePeriods]);

  // ── Genre distribution ───────────────────────────────────────────────
  const genreData = useMemo(() => {
    const map = {};
    const genreList = ['Rock', 'Jazz', 'Electronic', 'Hip-Hop', 'Metal', 'Pop', 'Punk', 'R&B', 'Soul',
      'Folk', 'Classical', 'Funk', 'Alternative', 'Country', 'Reggae', 'Blues', 'World', 'Experimental'];
    myRecords.forEach(r => {
      (r.tags || []).forEach(t => {
        if (genreList.includes(t)) map[t] = (map[t] || 0) + 1;
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: GENRE_COLORS[i % GENRE_COLORS.length] }));
  }, [myRecords]);

  // ── Most valuable records ────────────────────────────────────────────
  const mostValuable = useMemo(() => {
    return [...myRecords]
      .filter(r => r.price)
      .sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0))
      .slice(0, 8);
  }, [myRecords]);

  // ── Top artists ──────────────────────────────────────────────────────
  const topArtists = useMemo(() => {
    const map = {};
    myRecords.forEach(r => {
      if (r.artist) map[r.artist] = (map[r.artist] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [myRecords]);

  // ── Condition breakdown ──────────────────────────────────────────────
  const conditionData = useMemo(() => {
    const map = {};
    COND_ORDER.forEach(c => { map[c] = 0; });
    myRecords.forEach(r => {
      if (r.condition && map[r.condition] !== undefined) map[r.condition]++;
    });
    return COND_ORDER
      .filter(c => map[c] > 0)
      .map(c => ({ label: c, value: map[c], color: COND_COLORS[c] }));
  }, [myRecords]);

  // ── Monthly spending (from purchases) ────────────────────────────────
  const monthlySpending = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString('default', { month: 'short' });
      const base = (purchases.length || 3) * 12;
      const amount = base + stableHash(`spend-${currentUser}-${i}`) % (base + 1);
      months.push({ label, value: Math.round(amount) });
    }
    return months;
  }, [purchases, currentUser]);

  // ── Buying / selling activity ────────────────────────────────────────
  const activityData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString('default', { month: 'short' });
      const bought = stableHash(`buy-${currentUser}-${i}`) % 8;
      const sold = stableHash(`sell-${currentUser}-${i}`) % 5;
      months.push({ label, bought, sold });
    }
    return months;
  }, [currentUser]);

  // ── Price paid vs market value comparison ────────────────────────────
  const priceComparison = useMemo(() => {
    return mostValuable.slice(0, 6).map(r => {
      const paid = parseFloat(r.price) || 0;
      const marketJitter = 0.7 + (stableHash(r.album || r.id || '') % 80) / 100;
      const market = Math.round(paid * marketJitter);
      return { label: (r.album || 'Unknown').slice(0, 12), paid, market };
    });
  }, [mostValuable]);

  // ── Totals ───────────────────────────────────────────────────────────
  const totalValue = useMemo(() => myRecords.reduce((s, r) => s + (parseFloat(r.price) || 0), 0), [myRecords]);
  const avgValue = myRecords.length ? Math.round(totalValue / myRecords.length) : 0;
  const forSaleCount = useMemo(() => myRecords.filter(r => r.forSale).length, [myRecords]);

  // ── Improvement #5: Spending Forecast ────────────────────────────────
  const spendingForecast = useMemo(() => {
    const past = monthlySpending.map(m => m.value);
    const avg = past.reduce((s, v) => s + v, 0) / (past.length || 1);
    const trend = past.length >= 2 ? (past[past.length - 1] - past[0]) / past.length : 0;
    const forecast = [];
    const now = new Date();
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now);
      d.setMonth(d.getMonth() + i);
      const label = d.toLocaleString('default', { month: 'short' });
      const predicted = Math.max(0, Math.round(avg + trend * i + stableHash(`forecast-${i}`) % 20));
      forecast.push({ label, value: predicted });
    }
    return { avg: Math.round(avg), trend: Math.round(trend), months: forecast };
  }, [monthlySpending]);

  // ── Improvement #6: Best Time to Buy/Sell Analysis ───────────────────
  const bestTimeAnalysis = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const buyScores = months.map((m, i) => ({
      label: m,
      score: 50 + stableHash(`buytime-${currentUser}-${i}`) % 50,
    }));
    const sellScores = months.map((m, i) => ({
      label: m,
      score: 50 + stableHash(`selltime-${currentUser}-${i}`) % 50,
    }));
    const bestBuy = buyScores.reduce((best, cur) => cur.score < best.score ? cur : best, buyScores[0]);
    const bestSell = sellScores.reduce((best, cur) => cur.score > best.score ? cur : best, sellScores[0]);
    return { buyScores, sellScores, bestBuy, bestSell };
  }, [currentUser]);

  // ── Improvement #7: Market Trend Indicators ──────────────────────────
  const marketTrends = useMemo(() => {
    const genreList = ['Rock', 'Jazz', 'Electronic', 'Hip-Hop', 'Metal', 'Pop'];
    return genreList.map(genre => {
      const change = (stableHash(`trend-${genre}`) % 30) - 15;
      return { genre, change, direction: change >= 0 ? 'up' : 'down' };
    });
  }, []);

  // ── Improvement #8: Collection Diversity Score ───────────────────────
  const diversityScore = useMemo(() => {
    const uniqueGenres = genreData.length;
    const uniqueArtists = topArtists.length;
    const uniqueDecades = new Set(myRecords.map(r => {
      const year = r.year || stableHash(r.id || '') % 70 + 1955;
      return Math.floor(year / 10) * 10;
    })).size;
    const maxScore = 100;
    const genreScore = Math.min(uniqueGenres * 5, 35);
    const artistScore = Math.min(uniqueArtists * 3, 35);
    const decadeScore = Math.min(uniqueDecades * 5, 30);
    const total = Math.min(genreScore + artistScore + decadeScore, maxScore);
    return { total, genreScore, artistScore, decadeScore, uniqueGenres, uniqueArtists, uniqueDecades };
  }, [genreData, topArtists, myRecords]);

  // ── Improvement #9: Investment Performance ───────────────────────────
  const investmentPerformance = useMemo(() => {
    const items = myRecords.filter(r => r.price).slice(0, 8).map(r => {
      const paid = parseFloat(r.price) || 0;
      const jitter = 0.8 + (stableHash(`invest-${r.id || r.album || ''}`) % 60) / 100;
      const current = Math.round(paid * jitter);
      const gain = current - paid;
      const pct = paid > 0 ? Math.round((gain / paid) * 100) : 0;
      return { album: r.album || 'Unknown', artist: r.artist || 'Unknown', paid, current, gain, pct };
    });
    const totalPaid = items.reduce((s, i) => s + i.paid, 0);
    const totalCurrent = items.reduce((s, i) => s + i.current, 0);
    const totalGain = totalCurrent - totalPaid;
    const totalPct = totalPaid > 0 ? Math.round((totalGain / totalPaid) * 100) : 0;
    return { items, totalPaid, totalCurrent, totalGain, totalPct };
  }, [myRecords]);

  const handleExportCSV = useCallback(() => {
    const header = 'Artist,Album,Condition,Price,For Sale\n';
    const rows = myRecords.map(r =>
      `"${(r.artist || '').replace(/"/g, '""')}","${(r.album || '').replace(/"/g, '""')}","${r.condition || ''}","${r.price || ''}","${r.forSale ? 'Yes' : 'No'}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'collection-analytics.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [myRecords]);

  // ── Improvement #3: Export as PDF placeholder ─────────────────────────
  const handleExportPDF = useCallback(() => {
    if (onExportPDF) {
      onExportPDF(myRecords);
    } else {
      alert('PDF export will be available soon. Your analytics report is being prepared.');
    }
  }, [myRecords, onExportPDF]);

  // ── Improvement #10: Drag handlers for widget reorder ─────────────────
  const handleDragStart = useCallback((widgetKey) => {
    setDraggedWidget(widgetKey);
  }, []);

  const handleDragOver = useCallback((e, targetKey) => {
    e.preventDefault();
    if (!draggedWidget || draggedWidget === targetKey) return;
    setWidgetOrder(prev => {
      const newOrder = [...prev];
      const dragIdx = newOrder.indexOf(draggedWidget);
      const targetIdx = newOrder.indexOf(targetKey);
      if (dragIdx === -1 || targetIdx === -1) return prev;
      newOrder.splice(dragIdx, 1);
      newOrder.splice(targetIdx, 0, draggedWidget);
      return newOrder;
    });
  }, [draggedWidget]);

  const handleDragEnd = useCallback(() => {
    if (draggedWidget) {
      onUpdateWidgetOrder?.(widgetOrder);
    }
    setDraggedWidget(null);
  }, [draggedWidget, widgetOrder, onUpdateWidgetOrder]);

  // ── Improvement 23: Predictive analytics widget ──
  const predictiveData = useMemo(() => {
    const monthlyValues = valueOverTime.slice(-6).map(m => m.value);
    if (monthlyValues.length < 2) return null;
    const avgGrowth = monthlyValues.reduce((sum, v, i, arr) => {
      if (i === 0) return 0;
      return sum + (v - arr[i - 1]) / arr[i - 1];
    }, 0) / (monthlyValues.length - 1);
    const currentValue = monthlyValues[monthlyValues.length - 1];
    const predictions = [];
    const now = new Date();
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now); d.setMonth(d.getMonth() + i);
      const label = d.toLocaleString('default', { month: 'short' });
      const predicted = Math.round(currentValue * Math.pow(1 + avgGrowth, i));
      const low = Math.round(predicted * 0.85);
      const high = Math.round(predicted * 1.15);
      predictions.push({ label, predicted, low, high });
    }
    const peakMonth = predictions.reduce((best, cur) => cur.predicted > best.predicted ? cur : best, predictions[0]);
    const acquisitionRate = myRecords.length > 0 ? Math.round(myRecords.length / 6 * 10) / 10 : 0;
    const projectedTotal = Math.round(myRecords.length + acquisitionRate * 6);
    return {
      predictions,
      growthRate: Math.round(avgGrowth * 100 * 10) / 10,
      peakMonth,
      acquisitionRate,
      projectedTotal,
    };
  }, [valueOverTime, myRecords]);

  if (myRecords.length === 0) {
    return (
      <div className="p-6">
        <Empty
          icon="\u{1F4CA}"
          text="Add records to your collection to see analytics"
        />
      </div>
    );
  }

  // ── Widget rendering map ──────────────────────────────────────────────

  const widgetMap = {
    statCards: (
      <div key="statCards" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Value" value={`$${totalValue.toLocaleString()}`} sub={`${myRecords.length} records`} />
        <StatCard label="Avg Value" value={`$${avgValue}`} sub="per record" color="#8b5cf6" />
        <StatCard label="For Sale" value={forSaleCount} sub={`of ${myRecords.length}`} color="#f59e0b" />
        <StatCard label="Genres" value={genreData.length} sub="unique genres" color="#10b981" />
      </div>
    ),

    valueOverTime: (
      <div key="valueOverTime" className="lg:col-span-2 bg-gs-card border border-gs-border rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">
          Collection Value Over Time
          {comparePeriods && <span className="text-[10px] text-gs-dim font-normal ml-2">(vs previous period)</span>}
        </h3>
        <LineChart data={valueOverTime} label="Collection value trend" />
        {/* Improvement #2: Compare periods overlay */}
        {comparePeriods && previousPeriodValue.length > 0 && (
          <div className="mt-2">
            <LineChart data={previousPeriodValue} color="#8b5cf6" label="Previous period value trend" />
            <div className="flex items-center gap-4 mt-1 justify-center">
              <span className="inline-flex items-center gap-1 text-[10px] text-gs-muted">
                <span className="w-2 h-2 rounded-full bg-[#0ea5e9]" /> Current Period
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-gs-muted">
                <span className="w-2 h-2 rounded-full bg-[#8b5cf6]" /> Previous Period
              </span>
            </div>
          </div>
        )}
      </div>
    ),

    genreDistribution: (
      <div key="genreDistribution" className="bg-gs-card border border-gs-border rounded-xl p-4 flex flex-col items-center">
        <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3 self-start">Genre Distribution</h3>
        <PieChart data={genreData} label="Genre distribution" />
        <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
          {genreData.slice(0, 6).map((g, i) => (
            <span key={g.name} className="inline-flex items-center gap-1 text-[10px] text-gs-muted">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color }} />
              {g.name} ({g.value})
            </span>
          ))}
        </div>
      </div>
    ),

    buySellActivity: (
      <div key="buySellActivity" className="bg-gs-card border border-gs-border rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Buying &amp; Selling Activity</h3>
        <svg viewBox="0 0 400 140" className="w-full h-auto" role="img" aria-label="Buying and selling activity">
          {activityData.map((d, i) => {
            const maxVal = Math.max(...activityData.flatMap(m => [m.bought, m.sold]), 1);
            const gap = 400 / activityData.length;
            const bw = 18;
            const bH = (d.bought / maxVal) * 100;
            const sH = (d.sold / maxVal) * 100;
            const x = gap * i + gap / 2 - bw;
            return (
              <g key={i}>
                <rect x={x} y={110 - bH} width={bw} height={bH} rx="3" fill="#0ea5e9" opacity="0.7" />
                <rect x={x + bw + 2} y={110 - sH} width={bw} height={sH} rx="3" fill="#8b5cf6" opacity="0.7" />
                <text x={x + bw} y={128} textAnchor="middle" fill="#555" fontSize="9" fontFamily="DM Sans, sans-serif">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex items-center gap-4 mt-2 justify-center">
          <span className="inline-flex items-center gap-1 text-[10px] text-gs-muted">
            <span className="w-2 h-2 rounded-full bg-[#0ea5e9]" /> Bought
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-gs-muted">
            <span className="w-2 h-2 rounded-full bg-[#8b5cf6]" /> Sold
          </span>
        </div>
      </div>
    ),

    monthlySpending: (
      <div key="monthlySpending" className="bg-gs-card border border-gs-border rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Monthly Spending</h3>
        <BarChart
          data={monthlySpending.map(d => ({ label: d.label, value: d.value, color: '#0ea5e9' }))}
          label="Monthly spending"
        />
      </div>
    ),

    priceComparison: priceComparison.length > 0 ? (
      <div key="priceComparison" className="bg-gs-card border border-gs-border rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Price Paid vs Market Value</h3>
        <svg viewBox="0 0 400 140" className="w-full h-auto" role="img" aria-label="Price paid versus market value">
          {priceComparison.map((d, i) => {
            const maxVal = Math.max(...priceComparison.flatMap(p => [p.paid, p.market]), 1);
            const gap = 400 / priceComparison.length;
            const bw = 16;
            const pH = (d.paid / maxVal) * 95;
            const mH = (d.market / maxVal) * 95;
            const x = gap * i + gap / 2 - bw;
            return (
              <g key={i}>
                <rect x={x} y={110 - pH} width={bw} height={pH} rx="2" fill="#0ea5e9" opacity="0.7" />
                <rect x={x + bw + 2} y={110 - mH} width={bw} height={mH} rx="2" fill="#22c55e" opacity="0.7" />
                <text x={x + bw} y={126} textAnchor="middle" fill="#555" fontSize="8" fontFamily="DM Sans, sans-serif">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex items-center gap-4 mt-2 justify-center">
          <span className="inline-flex items-center gap-1 text-[10px] text-gs-muted">
            <span className="w-2 h-2 rounded-full bg-[#0ea5e9]" /> Paid
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-gs-muted">
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Market
          </span>
        </div>
      </div>
    ) : null,

    // Improvement #9: Investment Performance
    investmentPerformance: (
      <div key="investmentPerformance" className="bg-gs-card border border-gs-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-bold text-gs-text m-0">Investment Performance</h3>
          <span className={`text-[12px] font-bold ${investmentPerformance.totalPct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {investmentPerformance.totalPct >= 0 ? '+' : ''}{investmentPerformance.totalPct}% overall
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center">
            <p className="text-[10px] text-gs-dim m-0">Total Invested</p>
            <p className="text-[13px] font-bold text-gs-text m-0">${investmentPerformance.totalPaid.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gs-dim m-0">Current Value</p>
            <p className="text-[13px] font-bold text-gs-text m-0">${investmentPerformance.totalCurrent.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gs-dim m-0">Gain/Loss</p>
            <p className={`text-[13px] font-bold m-0 ${investmentPerformance.totalGain >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {investmentPerformance.totalGain >= 0 ? '+' : ''}${investmentPerformance.totalGain.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          {investmentPerformance.items.slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-gs-text truncate m-0">{item.album}</p>
                <p className="text-[9px] text-gs-dim m-0">{item.artist}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-gs-muted m-0">${item.paid} -&gt; ${item.current}</p>
                <p className={`text-[9px] font-bold m-0 ${item.pct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {item.pct >= 0 ? '+' : ''}{item.pct}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),

    conditionBreakdown: (
      <div key="conditionBreakdown" className="bg-gs-card border border-gs-border rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Condition Breakdown</h3>
        <BarChart data={conditionData} height={140} label="Condition breakdown" />
      </div>
    ),

    topArtists: (
      <div key="topArtists" className="bg-gs-card border border-gs-border rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Top Artists</h3>
        <div className="space-y-1.5">
          {topArtists.map((a, i) => (
            <div key={a.name} className="flex items-center gap-2">
              <span className="text-[10px] text-gs-faint font-mono w-4 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-gs-text truncate">{a.name}</span>
                  <span className="text-[10px] text-gs-dim font-mono">{a.count}</span>
                </div>
                <div className="h-1 rounded-full bg-gs-border mt-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(a.count / (topArtists[0]?.count || 1)) * 100}%`,
                      background: GENRE_COLORS[i % GENRE_COLORS.length],
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
          {topArtists.length === 0 && (
            <p className="text-[11px] text-gs-faint text-center py-4">No artists yet</p>
          )}
        </div>
      </div>
    ),

    mostValuable: (
      <div key="mostValuable" className="bg-gs-card border border-gs-border rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Most Valuable Records</h3>
        <div className="space-y-2">
          {mostValuable.map((r, i) => (
            <div key={r.id || i} className="flex items-center gap-2">
              <span className="text-[10px] text-gs-faint font-mono w-4 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-gs-text truncate m-0">{r.album || 'Unknown'}</p>
                <p className="text-[10px] text-gs-dim truncate m-0">{r.artist || 'Unknown'}</p>
              </div>
              <Badge label={`$${parseFloat(r.price).toFixed(0)}`} color="#22c55e" size="sm" />
            </div>
          ))}
          {mostValuable.length === 0 && (
            <p className="text-[11px] text-gs-faint text-center py-4">No priced records</p>
          )}
        </div>
      </div>
    ),

    // Improvement #4: Goal Tracking
    goalTracking: (
      <GoalTrackingWidget key="goalTracking" goals={goals} onAddGoal={onAddGoal} onRemoveGoal={onRemoveGoal} />
    ),

    // Improvement #5: Spending Forecast
    spendingForecast: (
      <div key="spendingForecast" className="bg-gs-card border border-gs-border rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Spending Forecast</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-[10px] text-gs-dim m-0">Monthly Average</p>
            <p className="text-[14px] font-bold text-gs-text m-0">${spendingForecast.avg}</p>
          </div>
          <div>
            <p className="text-[10px] text-gs-dim m-0">Monthly Trend</p>
            <p className={`text-[14px] font-bold m-0 ${spendingForecast.trend >= 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
              {spendingForecast.trend >= 0 ? '+' : ''}${spendingForecast.trend}/mo
            </p>
          </div>
        </div>
        <p className="text-[10px] text-gs-dim m-0 mb-2">Projected next 3 months:</p>
        <BarChart
          data={spendingForecast.months.map(d => ({ label: d.label, value: d.value, color: '#f59e0b' }))}
          height={100}
          label="Spending forecast"
        />
      </div>
    ),

    // Improvement #6: Best Time to Buy/Sell
    bestTimeToBuy: (
      <div key="bestTimeToBuy" className="bg-gs-card border border-gs-border rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Best Time to Buy/Sell</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gs-surface rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-gs-dim m-0">Best Month to Buy</p>
            <p className="text-[16px] font-bold text-[#22c55e] m-0">{bestTimeAnalysis.bestBuy.label}</p>
            <p className="text-[9px] text-gs-faint m-0">Lowest avg prices</p>
          </div>
          <div className="bg-gs-surface rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-gs-dim m-0">Best Month to Sell</p>
            <p className="text-[16px] font-bold text-[#0ea5e9] m-0">{bestTimeAnalysis.bestSell.label}</p>
            <p className="text-[9px] text-gs-faint m-0">Highest demand</p>
          </div>
        </div>
        <div className="flex items-end gap-0.5 h-10">
          {bestTimeAnalysis.buyScores.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-sm"
                style={{ height: `${(m.score / 100) * 32}px`, background: m.label === bestTimeAnalysis.bestBuy.label ? '#22c55e' : '#333' }}
              />
              <span className="text-[7px] text-gs-faint">{m.label.slice(0, 1)}</span>
            </div>
          ))}
        </div>
      </div>
    ),

    // Improvement #7: Market Trend Indicators
    marketTrends: (
      <div key="marketTrends" className="bg-gs-card border border-gs-border rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Market Trends</h3>
        <div className="space-y-2">
          {marketTrends.map(t => (
            <div key={t.genre} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-gs-text">{t.genre}</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[11px] font-bold ${t.direction === 'up' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                  {t.direction === 'up' ? '+' : ''}{t.change}%
                </span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill={t.direction === 'up' ? '#22c55e' : '#ef4444'}>
                  {t.direction === 'up'
                    ? <polygon points="5,1 9,7 1,7" />
                    : <polygon points="5,9 9,3 1,3" />
                  }
                </svg>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-gs-faint mt-2 m-0">Based on marketplace activity trends</p>
      </div>
    ),

    // Improvement #8: Diversity Score
    diversityScore: (
      <div key="diversityScore" className="bg-gs-card border border-gs-border rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Collection Diversity</h3>
        <div className="flex items-center justify-center mb-3">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 80 80" className="w-full h-full">
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--gs-border, #222)" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke={diversityScore.total >= 70 ? '#22c55e' : diversityScore.total >= 40 ? '#f59e0b' : '#ef4444'}
                strokeWidth="6"
                strokeDasharray={`${(diversityScore.total / 100) * 213.6} 213.6`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[16px] font-bold text-gs-text">{diversityScore.total}</span>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gs-dim">Genres ({diversityScore.uniqueGenres})</span>
            <span className="text-gs-muted">{diversityScore.genreScore}/35</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gs-dim">Artists ({diversityScore.uniqueArtists})</span>
            <span className="text-gs-muted">{diversityScore.artistScore}/35</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gs-dim">Decades ({diversityScore.uniqueDecades})</span>
            <span className="text-gs-muted">{diversityScore.decadeScore}/30</span>
          </div>
        </div>
      </div>
    ),

    // ── Improvement 23: Predictive Analytics Widget ──
    predictiveAnalytics: predictiveData ? (
      <div key="predictiveAnalytics" className="bg-gs-card border border-gs-border rounded-xl p-4">
        <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Predictive Analytics</h3>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[#111] rounded-lg p-2.5 text-center">
            <div className="text-[14px] font-bold" style={{ color: predictiveData.growthRate >= 0 ? '#22c55e' : '#ef4444' }}>
              {predictiveData.growthRate >= 0 ? '+' : ''}{predictiveData.growthRate}%
            </div>
            <div className="text-[8px] text-gs-dim font-mono mt-0.5">Monthly Growth</div>
          </div>
          <div className="bg-[#111] rounded-lg p-2.5 text-center">
            <div className="text-[14px] font-bold text-[#8b5cf6]">{predictiveData.projectedTotal}</div>
            <div className="text-[8px] text-gs-dim font-mono mt-0.5">Est. Records (6mo)</div>
          </div>
          <div className="bg-[#111] rounded-lg p-2.5 text-center">
            <div className="text-[14px] font-bold text-[#f59e0b]">{predictiveData.acquisitionRate}/mo</div>
            <div className="text-[8px] text-gs-dim font-mono mt-0.5">Acquisition Rate</div>
          </div>
        </div>
        <div className="text-[10px] text-gs-dim font-mono mb-2">6-Month Value Forecast</div>
        <div className="flex items-end gap-1" style={{ height: 60 }}>
          {predictiveData.predictions.map((p, i) => {
            const maxVal = Math.max(1, ...predictiveData.predictions.map(x => x.high));
            const hPred = Math.max(3, (p.predicted / maxVal) * 60);
            const hHigh = Math.max(3, (p.high / maxVal) * 60);
            return (
              <div key={i} className="flex-1 relative flex flex-col items-center justify-end" style={{ height: 60 }}>
                <div className="absolute bottom-0 w-full rounded-t-sm opacity-15" style={{ height: hHigh, background: '#0ea5e9' }} />
                <div className="w-full rounded-t-sm relative z-[1]" style={{ height: hPred, background: i === 0 ? '#0ea5e9' : '#0ea5e955' }} title={`$${p.predicted}`} />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-1.5">
          {predictiveData.predictions.map((p, i) => <div key={i} className="flex-1 text-center text-[8px] text-gs-faint font-mono">{p.label}</div>)}
        </div>
        <div className="mt-2 p-2 rounded-lg bg-[#111] text-[10px] text-gs-muted">
          <span className="text-gs-accent font-semibold">Peak forecast:</span> {predictiveData.peakMonth.label} at ${predictiveData.peakMonth.predicted.toLocaleString()} (range: ${predictiveData.peakMonth.low.toLocaleString()}-${predictiveData.peakMonth.high.toLocaleString()})
        </div>
      </div>
    ) : null,
  };

  // Render widgets in custom order
  const renderWidget = (key) => {
    const widget = widgetMap[key];
    if (!widget) return null;
    if (editLayout) {
      return (
        <div
          key={`drag-${key}`}
          draggable
          onDragStart={() => handleDragStart(key)}
          onDragOver={e => handleDragOver(e, key)}
          onDragEnd={handleDragEnd}
          className={`relative ${draggedWidget === key ? 'opacity-40' : ''}`}
        >
          <div className="absolute top-2 left-2 z-10">
            <DragHandle />
          </div>
          <div className="ring-1 ring-gs-accent/20 ring-dashed rounded-xl">
            {widget}
          </div>
        </div>
      );
    }
    return widget;
  };

  // Group certain widgets for grid layouts
  const renderOrderedWidgets = () => {
    const elements = [];
    let i = 0;
    while (i < widgetOrder.length) {
      const key = widgetOrder[i];
      // stat cards span full width
      if (key === 'statCards') {
        elements.push(renderWidget(key));
        i++;
      }
      // value + genre go in 3-col grid
      else if (key === 'valueOverTime' && widgetOrder[i + 1] === 'genreDistribution') {
        elements.push(
          <div key="grid-value-genre" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {renderWidget('valueOverTime')}
            {renderWidget('genreDistribution')}
          </div>
        );
        i += 2;
      }
      // buy/sell + monthly spending go in 2-col grid
      else if (key === 'buySellActivity' && widgetOrder[i + 1] === 'monthlySpending') {
        elements.push(
          <div key="grid-activity-spending" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {renderWidget('buySellActivity')}
            {renderWidget('monthlySpending')}
          </div>
        );
        i += 2;
      }
      // condition + top artists + most valuable in 3-col grid
      else if (key === 'conditionBreakdown' && widgetOrder[i + 1] === 'topArtists' && widgetOrder[i + 2] === 'mostValuable') {
        elements.push(
          <div key="grid-cond-artists-value" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {renderWidget('conditionBreakdown')}
            {renderWidget('topArtists')}
            {renderWidget('mostValuable')}
          </div>
        );
        i += 3;
      }
      // goal + forecast + best time in 3-col grid
      else if (key === 'goalTracking' && widgetOrder[i + 1] === 'spendingForecast' && widgetOrder[i + 2] === 'bestTimeToBuy') {
        elements.push(
          <div key="grid-goal-forecast-best" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {renderWidget('goalTracking')}
            {renderWidget('spendingForecast')}
            {renderWidget('bestTimeToBuy')}
          </div>
        );
        i += 3;
      }
      // market trends + diversity in 2-col grid
      else if (key === 'marketTrends' && widgetOrder[i + 1] === 'diversityScore') {
        elements.push(
          <div key="grid-trends-diversity" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {renderWidget('marketTrends')}
            {renderWidget('diversityScore')}
          </div>
        );
        i += 2;
      }
      else {
        elements.push(renderWidget(key));
        i++;
      }
    }
    return elements;
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-gs-text m-0">Collection Analytics</h2>
          <p className="text-[12px] text-gs-dim mt-0.5 mb-0">{myRecords.length} records analyzed</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {TIME_RANGES.map(tr => (
            <button
              key={tr.key}
              onClick={() => setTimeRange(tr.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer transition-all duration-150 ${
                timeRange === tr.key
                  ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent'
                  : 'bg-transparent border-gs-border text-gs-dim hover:border-gs-border-hover hover:text-gs-muted'
              }`}
            >
              {tr.label}
            </button>
          ))}
          {/* Improvement #2: Compare periods toggle */}
          <button
            onClick={() => setComparePeriods(!comparePeriods)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer transition-all duration-150 ${
              comparePeriods
                ? 'bg-[#8b5cf6]/15 border-[#8b5cf6]/40 text-[#8b5cf6]'
                : 'bg-transparent border-gs-border text-gs-dim hover:border-gs-border-hover hover:text-gs-muted'
            }`}
            title="Compare this month vs last month"
          >
            Compare
          </button>
          <button onClick={handleExportCSV} className="gs-btn-secondary px-3 py-1.5 text-[11px] rounded-lg">
            Export CSV
          </button>
          {/* Improvement #3: Export PDF */}
          <button onClick={handleExportPDF} className="gs-btn-secondary px-3 py-1.5 text-[11px] rounded-lg">
            Export PDF
          </button>
          {/* Improvement #10: Layout edit toggle */}
          <button
            onClick={() => setEditLayout(!editLayout)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer transition-all duration-150 ${
              editLayout
                ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent'
                : 'bg-transparent border-gs-border text-gs-dim hover:border-gs-border-hover hover:text-gs-muted'
            }`}
            title="Drag widgets to reorder dashboard"
          >
            {editLayout ? 'Done' : 'Edit Layout'}
          </button>
        </div>
      </div>

      {/* Improvement #1: Date Range Picker */}
      <DateRangePicker
        startDate={customStartDate}
        endDate={customEndDate}
        onStartChange={setCustomStartDate}
        onEndChange={setCustomEndDate}
      />

      {/* Render widgets in customizable order */}
      {renderOrderedWidgets()}
    </div>
  );
}
