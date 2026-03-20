// Shows only the current user's own records in a paginated grid.
// Filters the shared records array by r.user === currentUser.
// The "Add Record" button (header and empty state) both open AddRecordModal via onAddRecord.
// Features: statistics header, sort/filter/search, select mode, grouping, CSV export, "For Sale" badges.
import { useState, useMemo, useCallback } from 'react';
import Paginated from '../Paginated';
import Empty from '../ui/Empty';
import { CONDITIONS, FORMATS } from '../../constants';

const SORT_OPTIONS = [
  { key: "dateDesc", label: "Date Added (Newest)" },
  { key: "dateAsc", label: "Date Added (Oldest)" },
  { key: "artistAZ", label: "Artist A-Z" },
  { key: "artistZA", label: "Artist Z-A" },
  { key: "yearDesc", label: "Year (Newest)" },
  { key: "yearAsc", label: "Year (Oldest)" },
  { key: "condDesc", label: "Condition (Best)" },
  { key: "condAsc", label: "Condition (Worst)" },
  { key: "ratingDesc", label: "Rating (Highest)" },
];

const COND_ORDER = ["M","NM","VG+","VG","G+","G","F","P"];

function sortRecords(records, sortKey) {
  const sorted = [...records];
  switch (sortKey) {
    case "dateAsc": return sorted.reverse();
    case "artistAZ": return sorted.sort((a, b) => (a.artist || "").localeCompare(b.artist || ""));
    case "artistZA": return sorted.sort((a, b) => (b.artist || "").localeCompare(a.artist || ""));
    case "yearDesc": return sorted.sort((a, b) => (b.year || 0) - (a.year || 0));
    case "yearAsc": return sorted.sort((a, b) => (a.year || 0) - (b.year || 0));
    case "condDesc": return sorted.sort((a, b) => COND_ORDER.indexOf(a.condition) - COND_ORDER.indexOf(b.condition));
    case "condAsc": return sorted.sort((a, b) => COND_ORDER.indexOf(b.condition) - COND_ORDER.indexOf(a.condition));
    case "ratingDesc": return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    default: return sorted; // dateDesc — default order
  }
}

export default function CollectionScreen({ records, currentUser, onAddRecord, ...handlers }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("dateDesc");
  const [filterFormat, setFilterFormat] = useState("All");
  const [filterCondition, setFilterCondition] = useState("All");
  const [groupBy, setGroupBy] = useState("none"); // none | genre | artist
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Memoize the user's records to avoid re-filtering on every render (#15)
  const mine = useMemo(() => records.filter(r => r.user === currentUser), [records, currentUser]);

  // Apply search, format filter, condition filter — memoized (#15)
  const filtered = useMemo(() => {
    let list = mine;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.album || "").toLowerCase().includes(q) ||
        (r.artist || "").toLowerCase().includes(q) ||
        (r.label || "").toLowerCase().includes(q) ||
        (r.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    if (filterFormat !== "All") list = list.filter(r => r.format === filterFormat);
    if (filterCondition !== "All") list = list.filter(r => r.condition === filterCondition);
    return sortRecords(list, sortKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, search, filterFormat, filterCondition, sortKey]);

  // Statistics
  const stats = useMemo(() => {
    const totalValue = mine.reduce((sum, r) => sum + (r.forSale && r.price ? parseFloat(r.price) : 0), 0);
    const genreMap = {};
    mine.forEach(r => {
      (r.tags || []).forEach(t => {
        // Count parent genre tags only (skip "For Sale", "Mint", "Classic", etc.)
        if (["Rock","Jazz","Electronic","Hip-Hop","Metal","Pop","Punk","R&B","Soul","Folk","Classical","Funk","Alternative","Country","Reggae","Blues","World","Experimental"].includes(t)) {
          genreMap[t] = (genreMap[t] || 0) + 1;
        }
      });
    });
    const genres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]);
    const forSaleCount = mine.filter(r => r.forSale).length;
    return { totalValue, genres, forSaleCount };
  }, [mine]);

  // Grouped records for visual grouping mode
  const groupedRecords = useMemo(() => {
    if (groupBy === "none") return null;
    const groups = {};
    filtered.forEach(r => {
      let key;
      if (groupBy === "artist") {
        key = r.artist || "Unknown";
      } else {
        // genre — take first genre tag
        key = (r.tags || []).find(t =>
          ["Rock","Jazz","Electronic","Hip-Hop","Metal","Pop","Punk","R&B","Soul","Folk","Classical","Funk","Alternative","Country","Reggae","Blues","World","Experimental"].includes(t)
        ) || "Other";
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  // Toggle selection
  const toggleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // CSV export
  const exportCSV = useCallback(() => {
    const headers = ["Album","Artist","Year","Format","Label","Condition","Rating","For Sale","Price","Tags"];
    const rows = mine.map(r => [
      `"${(r.album || "").replace(/"/g, '""')}"`,
      `"${(r.artist || "").replace(/"/g, '""')}"`,
      r.year || "",
      r.format || "",
      `"${(r.label || "").replace(/"/g, '""')}"`,
      r.condition || "",
      r.rating || "",
      r.forSale ? "Yes" : "No",
      r.price || "",
      `"${(r.tags || []).join(", ")}"`,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "collection.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [mine]);

  // Bulk actions
  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    if (window.confirm(`Remove ${selected.size} record(s) from your collection?`)) {
      // Trigger delete for each selected record via handlers if available
      selected.forEach(id => handlers.onDelete?.(id));
      setSelected(new Set());
      setSelectMode(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-gs-text mb-0.5">My Collection</h1>
          <p className="text-xs text-gs-dim">{mine.length} record{mine.length !== 1 ? "s" : ""}{stats.forSaleCount > 0 && ` · ${stats.forSaleCount} for sale`}</p>
        </div>
        <div className="flex gap-2">
          {mine.length > 0 && (
            <button onClick={exportCSV} className="gs-btn-secondary px-3 py-[9px] text-xs" title="Export CSV">
              Export
            </button>
          )}
          <button onClick={onAddRecord} className="gs-btn-gradient px-[18px] py-[9px] text-xs">
            + Add Record
          </button>
        </div>
      </div>

      {/* Statistics bar */}
      {mine.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <div className="bg-gs-card border border-gs-border rounded-xl py-3 px-3 text-center">
            <div className="text-lg font-extrabold tracking-tight text-gs-accent">{mine.length}</div>
            <div className="text-[10px] text-gs-dim font-mono mt-0.5">Records</div>
          </div>
          <div className="bg-gs-card border border-gs-border rounded-xl py-3 px-3 text-center">
            <div className="text-lg font-extrabold tracking-tight text-green-500">${stats.totalValue.toFixed(0)}</div>
            <div className="text-[10px] text-gs-dim font-mono mt-0.5">Listed Value</div>
          </div>
          <div className="bg-gs-card border border-gs-border rounded-xl py-3 px-3 text-center">
            <div className="text-lg font-extrabold tracking-tight text-violet-500">{stats.genres.length}</div>
            <div className="text-[10px] text-gs-dim font-mono mt-0.5">Genres</div>
          </div>
        </div>
      )}

      {/* Genre breakdown pills */}
      {mine.length > 0 && stats.genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {stats.genres.slice(0, 8).map(([genre, count]) => (
            <span key={genre} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-gs-dim border border-gs-border-hover font-mono">
              {genre} <span className="text-gs-faint">({count})</span>
            </span>
          ))}
          {stats.genres.length > 8 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-gs-faint border border-gs-border-hover font-mono">
              +{stats.genres.length - 8} more
            </span>
          )}
        </div>
      )}

      {/* Search + filter toolbar */}
      {mine.length > 0 && (
        <div className="mb-4 space-y-2.5">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search your collection..."
              className="w-full bg-[#111] border border-gs-border rounded-lg px-3.5 py-2.5 pl-9 text-xs text-gs-text placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-faint text-sm">&#x1F50D;</span>
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gs-faint text-xs bg-transparent border-0 cursor-pointer hover:text-gs-text">
                ✕
              </button>
            )}
          </div>

          {/* Sort + filter row */}
          <div className="flex gap-2 items-center flex-wrap">
            {/* Sort */}
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value)}
              className="bg-[#111] border border-gs-border rounded-lg px-2.5 py-2 text-[11px] text-gs-muted focus:outline-none focus:border-gs-accent/50 cursor-pointer"
            >
              {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>

            {/* Toggle filter panel */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`gs-btn-secondary px-3 py-2 text-[11px] ${showFilters ? 'border-gs-accent/50 text-gs-accent' : ''}`}
            >
              Filters {(filterFormat !== "All" || filterCondition !== "All") && "·"}
            </button>

            {/* Group by */}
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value)}
              className="bg-[#111] border border-gs-border rounded-lg px-2.5 py-2 text-[11px] text-gs-muted focus:outline-none focus:border-gs-accent/50 cursor-pointer"
            >
              <option value="none">No Grouping</option>
              <option value="genre">Group by Genre</option>
              <option value="artist">Group by Artist</option>
            </select>

            {/* Select mode toggle */}
            <button
              onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
              className={`gs-btn-secondary px-3 py-2 text-[11px] ml-auto ${selectMode ? 'border-gs-accent/50 text-gs-accent' : ''}`}
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
          </div>

          {/* Expanded filter panel */}
          {showFilters && (
            <div className="bg-[#111] border border-gs-border rounded-lg px-3.5 py-3 flex gap-3 flex-wrap items-center">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-gs-dim font-mono">FORMAT</label>
                <select
                  value={filterFormat}
                  onChange={e => setFilterFormat(e.target.value)}
                  className="bg-[#0a0a0a] border border-gs-border rounded px-2 py-1.5 text-[11px] text-gs-muted focus:outline-none cursor-pointer"
                >
                  <option value="All">All Formats</option>
                  {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-gs-dim font-mono">CONDITION</label>
                <select
                  value={filterCondition}
                  onChange={e => setFilterCondition(e.target.value)}
                  className="bg-[#0a0a0a] border border-gs-border rounded px-2 py-1.5 text-[11px] text-gs-muted focus:outline-none cursor-pointer"
                >
                  <option value="All">All Conditions</option>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {(filterFormat !== "All" || filterCondition !== "All") && (
                <button
                  onClick={() => { setFilterFormat("All"); setFilterCondition("All"); }}
                  className="text-[11px] text-gs-accent bg-transparent border-0 cursor-pointer ml-auto hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Active filter summary */}
          {(search || filterFormat !== "All" || filterCondition !== "All") && (
            <div className="text-[11px] text-gs-dim">
              Showing {filtered.length} of {mine.length} records
              {filterFormat !== "All" && <span> · Format: <span className="text-gs-muted">{filterFormat}</span></span>}
              {filterCondition !== "All" && <span> · Condition: <span className="text-gs-muted">{filterCondition}</span></span>}
            </div>
          )}

          {/* Select mode bulk actions */}
          {selectMode && (
            <div className="flex gap-2 items-center bg-[#111] border border-gs-border rounded-lg px-3.5 py-2.5">
              <span className="text-[11px] text-gs-dim font-mono">{selected.size} selected</span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => { if (filtered.length > 0) setSelected(new Set(filtered.map(r => r.id))); }}
                  className="gs-btn-secondary px-3 py-1.5 text-[10px]"
                >
                  Select All
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selected.size === 0}
                  className={`px-3 py-1.5 text-[10px] rounded-lg border font-semibold ${selected.size > 0 ? 'bg-red-500/10 border-red-500/30 text-red-400 cursor-pointer' : 'bg-[#111] border-gs-border text-gs-faint cursor-not-allowed'}`}
                >
                  Delete ({selected.size})
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Records display */}
      {mine.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">&#x1F4BF;</div>
          <h2 className="text-lg font-bold text-gs-text mb-2">Start Your Collection</h2>
          <p className="text-sm text-gs-dim mb-1 max-w-xs mx-auto">Add your first record to begin tracking your vinyl, CDs, and more.</p>
          <p className="text-xs text-gs-faint mb-6 max-w-xs mx-auto">Search by album name, scan a barcode, or enter details manually.</p>
          <button onClick={onAddRecord} className="gs-btn-gradient px-7 py-3 text-sm hover:scale-105 transition-transform">
            + Add Your First Record
          </button>
          <div className="flex justify-center gap-6 mt-8 text-gs-faint">
            <div className="text-center">
              <div className="text-2xl mb-1">&#x1F4CA;</div>
              <div className="text-[10px] font-mono">Track value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">&#x1F4E6;</div>
              <div className="text-[10px] font-mono">List for sale</div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">&#x1F504;</div>
              <div className="text-[10px] font-mono">Trade with others</div>
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <Empty icon="&#x1F50D;" text="No records match your search or filters." />
      ) : groupBy !== "none" && groupedRecords ? (
        // Grouped view
        <div className="space-y-6">
          {groupedRecords.map(([groupName, groupRecords]) => (
            <div key={groupName}>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="text-[11px] font-bold text-gs-dim tracking-widest font-mono uppercase">{groupName}</div>
                <span className="text-[10px] text-gs-faint font-mono">({groupRecords.length})</span>
                <div className="flex-1 h-px bg-gs-border ml-2" />
              </div>
              <Paginated
                records={groupRecords}
                handlers={{
                  ...handlers,
                  ...(selectMode ? { onSelect: toggleSelect, selected } : {}),
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <Paginated
          records={filtered}
          handlers={{
            ...handlers,
            ...(selectMode ? { onSelect: toggleSelect, selected } : {}),
          }}
        />
      )}
    </div>
  );
}
