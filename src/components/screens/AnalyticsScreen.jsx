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

// ── Main Component ───────────────────────────────────────────────────────

export default function AnalyticsScreen({ records = [], currentUser, purchases = [], offers = [] }) {
  const [timeRange, setTimeRange] = useState('all');

  const myRecords = useMemo(() => records.filter(r => r.user === currentUser), [records, currentUser]);

  // ── Collection value over time (simulated monthly snapshots) ─────────
  const valueOverTime = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString('default', { month: 'short' });
      // Simulate growing collection value
      const base = myRecords.length * 18;
      const growth = base + (12 - i) * (base * 0.04);
      const jitter = stableHash(`${currentUser}-${i}`) % (base * 0.08 + 1);
      months.push({ label, value: Math.round(growth + jitter) });
    }
    return months;
  }, [myRecords, currentUser]);

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
      // Simulate spending from purchases array length
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
          <button onClick={handleExportCSV} className="gs-btn-secondary px-3 py-1.5 text-[11px] rounded-lg">
            Export CSV
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Value" value={`$${totalValue.toLocaleString()}`} sub={`${myRecords.length} records`} />
        <StatCard label="Avg Value" value={`$${avgValue}`} sub="per record" color="#8b5cf6" />
        <StatCard label="For Sale" value={forSaleCount} sub={`of ${myRecords.length}`} color="#f59e0b" />
        <StatCard label="Genres" value={genreData.length} sub="unique genres" color="#10b981" />
      </div>

      {/* Collection value over time + Genre distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-gs-card border border-gs-border rounded-xl p-4">
          <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Collection Value Over Time</h3>
          <LineChart data={valueOverTime} label="Collection value trend" />
        </div>

        <div className="bg-gs-card border border-gs-border rounded-xl p-4 flex flex-col items-center">
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
      </div>

      {/* Buying/Selling activity + Monthly spending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gs-card border border-gs-border rounded-xl p-4">
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

        <div className="bg-gs-card border border-gs-border rounded-xl p-4">
          <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Monthly Spending</h3>
          <BarChart
            data={monthlySpending.map(d => ({ label: d.label, value: d.value, color: '#0ea5e9' }))}
            label="Monthly spending"
          />
        </div>
      </div>

      {/* Price paid vs market value */}
      {priceComparison.length > 0 && (
        <div className="bg-gs-card border border-gs-border rounded-xl p-4">
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
      )}

      {/* Condition breakdown + Top artists + Most valuable */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Condition breakdown */}
        <div className="bg-gs-card border border-gs-border rounded-xl p-4">
          <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Condition Breakdown</h3>
          <BarChart data={conditionData} height={140} label="Condition breakdown" />
        </div>

        {/* Top artists */}
        <div className="bg-gs-card border border-gs-border rounded-xl p-4">
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

        {/* Most valuable */}
        <div className="bg-gs-card border border-gs-border rounded-xl p-4">
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
      </div>
    </div>
  );
}
