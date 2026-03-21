// Shows only the current user's own records in a paginated grid.
// Filters the shared records array by r.user === currentUser.
// The "Add Record" button (header and empty state) both open AddRecordModal via onAddRecord.
// Features: statistics header, sort/filter/search, select mode, grouping, CSV export, "For Sale" badges.
// Improvements: shelf view, timeline, duplicate finder, collection goals, print catalog, share link,
// batch condition update, record notes, decade breakdown, avg condition, condition chart, missing suggestions, price sort.
import { useState, useMemo, useCallback } from 'react';
import Paginated from '../Paginated';
import Empty from '../ui/Empty';
import { CONDITIONS, FORMATS } from '../../constants';

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
  { key: "priceDesc", label: "Price (Highest)" },
  { key: "priceAsc", label: "Price (Lowest)" },
];

const COND_ORDER = ["M","NM","VG+","VG","G+","G","F","P"];

const GENRE_LIST = ["Rock","Jazz","Electronic","Hip-Hop","Metal","Pop","Punk","R&B","Soul","Folk","Classical","Funk","Alternative","Country","Reggae","Blues","World","Experimental"];

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
    case "priceDesc": return sorted.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
    case "priceAsc": return sorted.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
    default: return sorted; // dateDesc — default order
  }
}

// Improvement 1: Shelf/crate view - a visual shelf row component
function ShelfRow({ records, handlers, selectMode, toggleSelect, selected, appBatchMode, onToggleBatchSelect, appBatchSelected }) {
  return (
    <div className="bg-gradient-to-b from-[#1a1410] to-[#0d0a07] border border-[#2a2215] rounded-xl p-4 mb-3">
      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide" style={{ minHeight: 120 }}>
        {records.map((r) => {
          const isSelected = selectMode ? selected.has(r.id) : appBatchMode ? (appBatchSelected || []).includes(r.id) : false;
          return (
            <div
              key={r.id}
              className={`relative shrink-0 cursor-pointer transition-transform hover:-translate-y-1 ${isSelected ? 'ring-2 ring-gs-accent' : ''}`}
              style={{ width: 28, height: 110 }}
              onClick={() => {
                if (selectMode) toggleSelect(r.id);
                else if (appBatchMode) onToggleBatchSelect?.(r.id);
                else handlers.onDetail?.(r);
              }}
              title={`${r.album} - ${r.artist}`}
            >
              <div
                className="w-full h-full rounded-sm"
                style={{
                  background: `linear-gradient(180deg, ${r.accent || '#333'}cc, ${r.accent || '#333'}66)`,
                  borderLeft: '1px solid rgba(255,255,255,0.1)',
                  borderRight: '1px solid rgba(0,0,0,0.3)',
                }}
              />
              {r.forSale && (
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
              )}
            </div>
          );
        })}
      </div>
      <div className="h-1 bg-gradient-to-r from-[#3a2a15] via-[#5a4025] to-[#3a2a15] rounded-full mt-1" />
    </div>
  );
}

// Improvement 2: Collection Timeline mini-chart
function CollectionTimeline({ records }) {
  const monthData = useMemo(() => {
    const months = {};
    records.forEach(r => {
      if (r.createdAt) {
        const d = new Date(r.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months[key] = (months[key] || 0) + 1;
      }
    });
    const entries = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
    return entries;
  }, [records]);

  if (monthData.length < 2) return null;
  const maxCount = Math.max(...monthData.map(e => e[1]));

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="text-[10px] font-mono text-gs-dim mb-2 tracking-wider uppercase">Collection Growth (Last 12 Months)</div>
      <div className="flex items-end gap-1 h-12">
        {monthData.map(([month, count]) => (
          <div key={month} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full bg-gs-accent/40 rounded-t-sm transition-all"
              style={{ height: `${Math.max(4, (count / maxCount) * 48)}px` }}
              title={`${month}: ${count} records`}
            />
            <span className="text-[7px] text-gs-faint font-mono">{month.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Improvement 3: Duplicate finder panel
function DuplicateFinder({ records, onDetail }) {
  const duplicates = useMemo(() => {
    const seen = {};
    const dupes = [];
    records.forEach(r => {
      const key = `${(r.album || '').toLowerCase()}|||${(r.artist || '').toLowerCase()}`;
      if (seen[key]) {
        if (!dupes.find(d => d.key === key)) {
          dupes.push({ key, records: [seen[key]] });
        }
        dupes.find(d => d.key === key).records.push(r);
      } else {
        seen[key] = r;
      }
    });
    return dupes;
  }, [records]);

  if (duplicates.length === 0) {
    return (
      <div className="text-center py-6 text-gs-dim text-xs">
        No duplicate records found. Your collection is clean!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono text-gs-dim mb-2 tracking-wider uppercase">
        {duplicates.length} Potential Duplicate{duplicates.length !== 1 ? 's' : ''}
      </div>
      {duplicates.map(d => (
        <div key={d.key} className="bg-[#111] border border-[#2a1a1a] rounded-lg p-3">
          <div className="text-xs font-bold text-gs-text mb-1">{d.records[0].album}</div>
          <div className="text-[11px] text-gs-dim mb-2">by {d.records[0].artist}</div>
          <div className="flex gap-2 flex-wrap">
            {d.records.map(r => (
              <button
                key={r.id}
                onClick={() => onDetail?.(r)}
                className="text-[10px] px-2 py-1 rounded bg-[#1a1a1a] border border-gs-border text-gs-muted cursor-pointer hover:border-gs-accent/50"
              >
                {r.format} / {r.condition} {r.year ? `(${r.year})` : ''}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Improvement 4: Collection Goals panel
function CollectionGoals({ records }) {
  const [goals, setGoals] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gs_collection_goals') || '[]');
    } catch { return []; }
  });
  const [newGoal, setNewGoal] = useState('');

  const saveGoals = useCallback((updated) => {
    setGoals(updated);
    localStorage.setItem('gs_collection_goals', JSON.stringify(updated));
  }, []);

  const addGoal = () => {
    if (!newGoal.trim()) return;
    const updated = [...goals, { id: Date.now(), text: newGoal.trim(), completed: false }];
    saveGoals(updated);
    setNewGoal('');
  };

  const toggleGoal = (id) => {
    saveGoals(goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  };

  const removeGoal = (id) => {
    saveGoals(goals.filter(g => g.id !== id));
  };

  const completedCount = goals.filter(g => g.completed).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-mono text-gs-dim tracking-wider uppercase">
          Collection Goals {goals.length > 0 && `(${completedCount}/${goals.length})`}
        </div>
      </div>
      {goals.length > 0 && (
        <div className="w-full bg-[#111] rounded-full h-1.5 mb-2">
          <div
            className="bg-gs-accent rounded-full h-1.5 transition-all"
            style={{ width: `${goals.length > 0 ? (completedCount / goals.length) * 100 : 0}%` }}
          />
        </div>
      )}
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        {goals.map(g => (
          <div key={g.id} className="flex items-center gap-2 group">
            <button
              onClick={() => toggleGoal(g.id)}
              className={`w-4 h-4 rounded border shrink-0 cursor-pointer flex items-center justify-center text-[10px] ${g.completed ? 'bg-gs-accent/20 border-gs-accent text-gs-accent' : 'bg-transparent border-gs-border text-transparent'}`}
            >
              {g.completed ? '\u2713' : ''}
            </button>
            <span className={`text-xs flex-1 ${g.completed ? 'line-through text-gs-faint' : 'text-gs-muted'}`}>{g.text}</span>
            <button
              onClick={() => removeGoal(g.id)}
              className="text-gs-faint text-[10px] bg-transparent border-0 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            >
              x
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-2">
        <input
          value={newGoal}
          onChange={e => setNewGoal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addGoal()}
          placeholder="e.g., Collect all Beatles albums"
          className="flex-1 bg-[#0a0a0a] border border-gs-border rounded px-2 py-1.5 text-[11px] text-gs-muted focus:outline-none focus:border-gs-accent/50"
        />
        <button
          onClick={addGoal}
          disabled={!newGoal.trim()}
          className={`px-2.5 py-1.5 rounded text-[10px] font-semibold border ${newGoal.trim() ? 'gs-btn-gradient text-white cursor-pointer' : 'bg-[#111] border-gs-border text-gs-faint cursor-default'}`}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// Improvement 5: Record Notes panel
function RecordNotes({ recordId }) {
  const storageKey = `gs_record_note_${recordId}`;
  const [note, setNote] = useState(() => {
    try { return localStorage.getItem(storageKey) || ''; } catch { return ''; }
  });
  const [editing, setEditing] = useState(false);

  const save = () => {
    localStorage.setItem(storageKey, note);
    setEditing(false);
  };

  if (!editing && !note) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-[10px] text-gs-dim bg-transparent border border-dashed border-gs-border rounded px-2 py-1 cursor-pointer hover:border-gs-accent/30 hover:text-gs-muted"
      >
        + Add note
      </button>
    );
  }

  if (editing) {
    return (
      <div className="flex gap-1 items-start mt-1">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          className="flex-1 bg-[#0a0a0a] border border-gs-border rounded px-2 py-1.5 text-[10px] text-gs-muted resize-none focus:outline-none focus:border-gs-accent/50"
          placeholder="Add notes about this record..."
          autoFocus
        />
        <button onClick={save} className="text-[10px] px-2 py-1 gs-btn-gradient text-white rounded cursor-pointer">Save</button>
        <button onClick={() => setEditing(false)} className="text-[10px] px-2 py-1 text-gs-dim bg-transparent border border-gs-border rounded cursor-pointer">Cancel</button>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="text-[10px] text-gs-dim italic mt-1 cursor-pointer hover:text-gs-muted bg-[#0a0a0a] rounded px-2 py-1 border border-gs-border/50"
      title="Click to edit note"
    >
      {note}
    </div>
  );
}

// Improvement 6: Missing records suggestions
function MissingSuggestions({ records }) {
  const suggestions = useMemo(() => {
    const artistCounts = {};
    records.forEach(r => {
      if (r.artist) {
        if (!artistCounts[r.artist]) artistCounts[r.artist] = [];
        artistCounts[r.artist].push(r.album);
      }
    });
    // Suggest artists with 2+ records — they might want more
    return Object.entries(artistCounts)
      .filter(([, albums]) => albums.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)
      .map(([artist, albums]) => ({ artist, count: albums.length }));
  }, [records]);

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="text-[10px] font-mono text-gs-dim mb-2 tracking-wider uppercase">Artists You Collect Most</div>
      <div className="space-y-1.5">
        {suggestions.map(s => (
          <div key={s.artist} className="flex items-center justify-between">
            <span className="text-xs text-gs-muted">{s.artist}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gs-accent/10 text-gs-accent font-mono">{s.count} albums</span>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-gs-faint mt-2 italic">Explore more from these artists to grow your collection.</div>
    </div>
  );
}

// Improvement v3-14: Collection visualization (bubble chart by genre)
function GenreBubbleChart({ records }) {
  const genreData = useMemo(() => {
    const genres = {};
    records.forEach(r => {
      (r.tags || []).forEach(t => {
        if (GENRE_LIST.includes(t)) {
          genres[t] = (genres[t] || 0) + 1;
        }
      });
    });
    return Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [records]);

  if (genreData.length === 0) return null;
  const maxCount = Math.max(...genreData.map(g => g[1]));
  const colors = ['#0ea5e9', '#8b5cf6', '#ef4444', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="text-[10px] font-mono text-gs-dim mb-3 tracking-wider uppercase">Genre Bubble Chart</div>
      <div className="flex flex-wrap gap-2 justify-center items-center min-h-[100px]">
        {genreData.map(([genre, count], i) => {
          const size = Math.max(40, Math.round((count / maxCount) * 80));
          return (
            <div
              key={genre}
              className="rounded-full flex items-center justify-center text-center transition-transform hover:scale-110 cursor-default"
              style={{
                width: size, height: size,
                background: `${colors[i % colors.length]}22`,
                border: `2px solid ${colors[i % colors.length]}44`,
              }}
              title={`${genre}: ${count} records`}
            >
              <div>
                <div className="text-[8px] font-bold" style={{ color: colors[i % colors.length] }}>{genre}</div>
                <div className="text-[7px] font-mono text-gs-faint">{count}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Improvement v3-15: Import from CSV
function CSVImporter({ onImport, onClose }) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState([]);

  const handleParse = () => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
    const parsed = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const record = {};
      headers.forEach((h, i) => { record[h] = values[i] || ''; });
      return record;
    }).filter(r => r.album || r.artist);
    setPreview(parsed.slice(0, 5));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setCsvText(ev.target?.result || ''); };
    reader.readAsText(file);
  };

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold font-mono text-gs-dim tracking-wider uppercase">Import from CSV</span>
        <button onClick={onClose} className="text-gs-dim text-xs bg-transparent border-none cursor-pointer">&times;</button>
      </div>
      <div className="mb-3">
        <input type="file" accept=".csv" onChange={handleFileUpload} className="text-[10px] text-gs-muted mb-2" />
        <textarea
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          placeholder="Or paste CSV data here (Album,Artist,Year,Format,Condition)..."
          className="w-full bg-[#0a0a0a] border border-gs-border rounded px-2 py-2 text-[10px] text-gs-muted font-mono resize-none focus:outline-none focus:border-gs-accent/50"
          rows={4}
        />
      </div>
      <div className="flex gap-2 mb-3">
        <button onClick={handleParse} disabled={!csvText.trim()} className={`px-3 py-1.5 rounded text-[10px] font-semibold ${csvText.trim() ? 'gs-btn-gradient text-white cursor-pointer' : 'bg-[#111] border border-gs-border text-gs-faint cursor-default'}`}>
          Preview
        </button>
        {preview.length > 0 && (
          <button onClick={() => { onImport?.(preview); onClose(); }} className="px-3 py-1.5 rounded text-[10px] font-semibold bg-green-500/10 border border-green-500/30 text-green-400 cursor-pointer hover:bg-green-500/20">
            Import {preview.length} Records
          </button>
        )}
      </div>
      {preview.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] text-gs-faint font-mono uppercase">Preview (first 5):</div>
          {preview.map((r, i) => (
            <div key={i} className="text-[10px] text-gs-muted bg-[#0a0a0a] rounded px-2 py-1 border border-gs-border/50">
              {r.album || r.Album || '?'} - {r.artist || r.Artist || '?'} ({r.year || r.Year || 'N/A'})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Improvement v3-16: Collection lending tracker
function LendingTracker({ records, onClose }) {
  const [lentRecords, setLentRecords] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs_lent_records') || '[]'); } catch { return []; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState('');
  const [lentTo, setLentTo] = useState('');

  const saveLent = useCallback((updated) => {
    setLentRecords(updated);
    localStorage.setItem('gs_lent_records', JSON.stringify(updated));
  }, []);

  const addLending = () => {
    if (!selectedRecord || !lentTo.trim()) return;
    saveLent([...lentRecords, { recordId: selectedRecord, lentTo: lentTo.trim(), date: Date.now(), returned: false }]);
    setSelectedRecord('');
    setLentTo('');
    setShowAdd(false);
  };

  const markReturned = (idx) => {
    const updated = lentRecords.map((l, i) => i === idx ? { ...l, returned: true, returnDate: Date.now() } : l);
    saveLent(updated);
  };

  const activeLendings = lentRecords.filter(l => !l.returned);

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-gs-dim tracking-wider uppercase">Lending Tracker ({activeLendings.length} out)</span>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(!showAdd)} className="text-[10px] text-gs-accent bg-transparent border border-gs-accent/30 rounded px-2 py-0.5 cursor-pointer hover:bg-gs-accent/10">+ Lend</button>
          <button onClick={onClose} className="text-gs-dim text-xs bg-transparent border-none cursor-pointer">&times;</button>
        </div>
      </div>
      {showAdd && (
        <div className="bg-[#111] rounded-lg p-2.5 mb-2 border border-gs-border space-y-2">
          <select value={selectedRecord} onChange={e => setSelectedRecord(e.target.value)} className="w-full bg-[#0a0a0a] border border-gs-border rounded px-2 py-1.5 text-[10px] text-gs-muted outline-none">
            <option value="">Select record...</option>
            {records.map(r => <option key={r.id} value={r.id}>{r.album} - {r.artist}</option>)}
          </select>
          <input value={lentTo} onChange={e => setLentTo(e.target.value)} placeholder="Lent to..." className="w-full bg-[#0a0a0a] border border-gs-border rounded px-2 py-1.5 text-[10px] text-gs-muted outline-none" />
          <button onClick={addLending} disabled={!selectedRecord || !lentTo.trim()} className={`px-3 py-1 rounded text-[10px] ${selectedRecord && lentTo.trim() ? 'gs-btn-gradient text-white cursor-pointer' : 'bg-[#111] text-gs-faint cursor-default'}`}>Add</button>
        </div>
      )}
      {activeLendings.length > 0 && (
        <div className="space-y-1.5">
          {activeLendings.map((l, i) => {
            const rec = records.find(r => r.id === l.recordId);
            return (
              <div key={i} className="flex items-center justify-between p-2 bg-[#111] rounded-lg border border-[#1a1a1a]">
                <div>
                  <div className="text-[10px] text-gs-muted">{rec ? `${rec.album} - ${rec.artist}` : 'Unknown'}</div>
                  <div className="text-[9px] text-gs-faint font-mono">Lent to {l.lentTo} on {new Date(l.date).toLocaleDateString()}</div>
                </div>
                <button onClick={() => markReturned(i)} className="text-[9px] text-green-400 bg-green-500/10 border border-green-500/20 rounded px-2 py-0.5 cursor-pointer">Returned</button>
              </div>
            );
          })}
        </div>
      )}
      {activeLendings.length === 0 && !showAdd && (
        <div className="text-[10px] text-gs-faint text-center py-2">No records currently lent out.</div>
      )}
    </div>
  );
}

// Improvement v3-17: Condition upgrade tracker
function ConditionUpgradeTracker({ records }) {
  const upgrades = useMemo(() => {
    const candidates = records
      .filter(r => r.condition && COND_ORDER.indexOf(r.condition) > 2) // G+ or worse
      .sort((a, b) => COND_ORDER.indexOf(b.condition) - COND_ORDER.indexOf(a.condition));
    return candidates.slice(0, 5).map(r => ({
      ...r,
      currentIdx: COND_ORDER.indexOf(r.condition),
      targetCondition: COND_ORDER[Math.max(0, COND_ORDER.indexOf(r.condition) - 2)],
      estimatedSavings: estimateValue(COND_ORDER[Math.max(0, COND_ORDER.indexOf(r.condition) - 2)], r.year) - estimateValue(r.condition, r.year),
    }));
  }, [records]);

  if (upgrades.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="text-[10px] font-mono text-gs-dim mb-2 tracking-wider uppercase">Upgrade Candidates</div>
      <div className="space-y-1.5">
        {upgrades.map(r => (
          <div key={r.id} className="flex items-center justify-between p-2 bg-[#111] rounded-lg border border-[#1a1a1a]">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-gs-text truncate">{r.album}</div>
              <div className="text-[9px] text-gs-dim">{r.artist}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono text-red-400">{r.condition}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              <span className="text-[10px] font-mono text-green-400">{r.targetCondition}</span>
              <span className="text-[8px] font-mono text-amber-400">(+${r.estimatedSavings})</span>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[9px] text-gs-faint mt-2 italic">Upgrading condition increases collection value.</div>
    </div>
  );
}

// Improvement v3-18: Collection completion percentage per artist
function ArtistCompletionTracker({ records }) {
  const completionData = useMemo(() => {
    const artistAlbums = {};
    records.forEach(r => {
      if (r.artist) {
        if (!artistAlbums[r.artist]) artistAlbums[r.artist] = [];
        artistAlbums[r.artist].push(r.album);
      }
    });
    const knownDiscographies = {
      'Pink Floyd': 15, 'Led Zeppelin': 9, 'The Beatles': 13, 'Queen': 15,
      'David Bowie': 25, 'Radiohead': 9, 'Fleetwood Mac': 17, 'The Rolling Stones': 23,
      'Nirvana': 3, 'The Doors': 6, 'Jimi Hendrix': 4, 'Bob Dylan': 38,
    };
    return Object.entries(artistAlbums)
      .filter(([, albums]) => albums.length >= 2)
      .map(([artist, albums]) => {
        const known = knownDiscographies[artist];
        const total = known || Math.max(albums.length + 2, Math.round(albums.length * 1.5));
        return { artist, owned: albums.length, total, pct: Math.round((albums.length / total) * 100) };
      })
      .sort((a, b) => b.owned - a.owned)
      .slice(0, 6);
  }, [records]);

  if (completionData.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="text-[10px] font-mono text-gs-dim mb-2 tracking-wider uppercase">Artist Completion</div>
      <div className="space-y-2">
        {completionData.map(a => (
          <div key={a.artist}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-gs-muted">{a.artist}</span>
              <span className="text-[9px] font-mono text-gs-accent">{a.owned}/{a.total} ({a.pct}%)</span>
            </div>
            <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full bg-gs-accent/60 rounded-full transition-all" style={{ width: `${a.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Improvement v3-19: Smart sorting (AI-suggested order)
function SmartSortSuggestion({ records, onApplySort }) {
  const suggestion = useMemo(() => {
    const hasHighValue = records.some(r => estimateValue(r.condition, r.year) > 30);
    const hasOldRecords = records.some(r => r.year && r.year < 1975);
    const mostGenres = {};
    records.forEach(r => (r.tags || []).forEach(t => { if (GENRE_LIST.includes(t)) mostGenres[t] = (mostGenres[t] || 0) + 1; }));
    const topGenre = Object.entries(mostGenres).sort((a, b) => b[1] - a[1])[0];

    if (hasOldRecords) return { label: 'Chronological Journey', key: 'yearAsc', reason: 'You have vintage records - explore them chronologically' };
    if (hasHighValue) return { label: 'Value Showcase', key: 'priceDesc', reason: 'Highlight your most valuable pieces first' };
    if (topGenre) return { label: `${topGenre[0]} First`, key: 'artistAZ', reason: `Your top genre is ${topGenre[0]} - group by artist for easy browsing` };
    return { label: 'Recently Added', key: 'dateDesc', reason: 'See your latest additions first' };
  }, [records]);

  return (
    <div className="bg-gradient-to-r from-violet-500/5 to-transparent border border-violet-500/20 rounded-xl p-2.5 mb-3 flex items-center gap-3">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M12 2a7 7 0 017 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 017-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-violet-400">Smart Sort: {suggestion.label}</div>
        <div className="text-[9px] text-gs-dim">{suggestion.reason}</div>
      </div>
      <button onClick={() => onApplySort(suggestion.key)} className="text-[9px] px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-400 cursor-pointer hover:bg-violet-500/20 whitespace-nowrap">
        Apply
      </button>
    </div>
  );
}

// Improvement v3-20: Collection insurance calculator
function InsuranceCalculator({ records }) {
  const calc = useMemo(() => {
    const totalEstValue = records.reduce((s, r) => s + estimateValue(r.condition, r.year), 0);
    const premiumLow = Math.round(totalEstValue * 0.012);  // 1.2% annual
    const premiumHigh = Math.round(totalEstValue * 0.025); // 2.5% annual
    const highValueItems = records.filter(r => estimateValue(r.condition, r.year) >= 30).length;
    return { totalEstValue, premiumLow, premiumHigh, highValueItems };
  }, [records]);

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="text-[10px] font-mono text-gs-dim mb-2 tracking-wider uppercase">Insurance Estimate</div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-[#111] rounded-lg p-2 text-center">
          <div className="text-sm font-extrabold text-emerald-400">${calc.totalEstValue}</div>
          <div className="text-[8px] text-gs-faint font-mono">Total Value</div>
        </div>
        <div className="bg-[#111] rounded-lg p-2 text-center">
          <div className="text-sm font-extrabold text-amber-400">${calc.premiumLow}-${calc.premiumHigh}</div>
          <div className="text-[8px] text-gs-faint font-mono">Annual Premium Est.</div>
        </div>
      </div>
      <div className="text-[9px] text-gs-faint font-mono">{calc.highValueItems} high-value items ($30+). Consider specialty vinyl insurance.</div>
    </div>
  );
}

// Improvement v3-21: Want vs Have counter per genre
function WantVsHaveCounter({ records }) {
  const data = useMemo(() => {
    const genreHave = {};
    records.forEach(r => {
      (r.tags || []).forEach(t => {
        if (GENRE_LIST.includes(t)) {
          if (!genreHave[t]) genreHave[t] = { have: 0, want: 0 };
          genreHave[t].have++;
          if (r.wantMore) genreHave[t].want++;
        }
      });
    });
    // Estimate "want" based on collection size (artists with few records)
    const artistByGenre = {};
    records.forEach(r => {
      (r.tags || []).forEach(t => {
        if (GENRE_LIST.includes(t)) {
          if (!artistByGenre[t]) artistByGenre[t] = new Set();
          artistByGenre[t].add(r.artist);
        }
      });
    });
    Object.entries(genreHave).forEach(([genre, data]) => {
      const artistCount = artistByGenre[genre]?.size || 0;
      data.want = Math.max(data.want, Math.round(artistCount * 0.6));
    });
    return Object.entries(genreHave).sort((a, b) => b[1].have - a[1].have).slice(0, 6);
  }, [records]);

  if (data.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="text-[10px] font-mono text-gs-dim mb-2 tracking-wider uppercase">Want vs Have</div>
      <div className="space-y-1.5">
        {data.map(([genre, { have, want }]) => (
          <div key={genre} className="flex items-center gap-2">
            <span className="text-[10px] text-gs-muted w-20 truncate">{genre}</span>
            <div className="flex-1 flex gap-0.5">
              <div className="h-3 bg-green-500/30 rounded-l" style={{ width: `${Math.round((have / (have + want)) * 100)}%` }} title={`Have: ${have}`} />
              <div className="h-3 bg-red-500/20 rounded-r" style={{ width: `${Math.round((want / (have + want)) * 100)}%` }} title={`Want: ${want}`} />
            </div>
            <span className="text-[8px] font-mono text-green-400 w-6 text-right">{have}</span>
            <span className="text-[8px] font-mono text-red-400 w-6 text-right">{want}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-[8px] text-gs-faint font-mono">
        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500/30 rounded" /> Have</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500/20 rounded" /> Want</span>
      </div>
    </div>
  );
}

// Improvement v3-22: Collection year distribution chart
function YearDistributionChart({ records }) {
  const yearData = useMemo(() => {
    const years = {};
    records.forEach(r => {
      if (r.year) {
        const decade = Math.floor(r.year / 10) * 10;
        years[decade] = (years[decade] || 0) + 1;
      }
    });
    return Object.entries(years).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  }, [records]);

  if (yearData.length < 2) return null;
  const maxCount = Math.max(...yearData.map(d => d[1]));

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="text-[10px] font-mono text-gs-dim mb-2 tracking-wider uppercase">Year Distribution</div>
      <div className="flex items-end gap-1 h-16">
        {yearData.map(([decade, count]) => (
          <div key={decade} className="flex-1 flex flex-col items-center gap-0.5">
            <span className="text-[7px] font-mono text-gs-faint">{count}</span>
            <div
              className="w-full bg-gradient-to-t from-gs-accent/60 to-gs-accent/20 rounded-t-sm transition-all"
              style={{ height: `${Math.max(4, (count / maxCount) * 56)}px` }}
              title={`${decade}s: ${count} records`}
            />
            <span className="text-[7px] text-gs-faint font-mono">{decade}s</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Improvement v3-23: Pressing quality indicator
function PressingQualityIndicator({ record }) {
  const quality = useMemo(() => {
    let score = 50;
    if (record.year && record.year < 1975) score += 20;
    else if (record.year && record.year < 1990) score += 10;
    if (record.format === 'Vinyl' || record.format === '12"') score += 10;
    if (record.condition === 'M' || record.condition === 'NM') score += 15;
    else if (record.condition === 'VG+') score += 10;
    if (record.label && ['Blue Note', 'Motown', 'Columbia', 'Atlantic', 'Decca', 'Prestige'].some(l => record.label.includes(l))) score += 10;
    score = Math.min(100, score);
    const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Standard' : 'Basic';
    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#888' : '#ef4444';
    return { score, label, color };
  }, [record]);

  return (
    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full border" style={{ color: quality.color, borderColor: quality.color + '30', background: quality.color + '10' }} title={`Pressing quality: ${quality.score}/100`}>
      {quality.label}
    </span>
  );
}

// Improvement v3-24: Collection labels breakdown
function LabelsBreakdown({ records }) {
  const labelData = useMemo(() => {
    const labels = {};
    records.forEach(r => {
      if (r.label) {
        labels[r.label] = (labels[r.label] || 0) + 1;
      }
    });
    return Object.entries(labels).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [records]);

  if (labelData.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
      <div className="text-[10px] font-mono text-gs-dim mb-2 tracking-wider uppercase">Labels in Collection</div>
      <div className="space-y-1">
        {labelData.map(([label, count]) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-[10px] text-gs-muted truncate flex-1">{label}</span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#111] text-gs-faint font-mono border border-gs-border">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Improvement v3-25: First pressing identifier
function FirstPressingBadge({ record }) {
  const isFirstPressing = useMemo(() => {
    if (!record.year) return false;
    // Heuristic: if year is before 1985 and condition is good, likely original
    // Also check if pressing info mentions "1st" or "original"
    const notesHint = (record.notes || '').toLowerCase();
    if (notesHint.includes('first pressing') || notesHint.includes('1st pressing') || notesHint.includes('original pressing')) return true;
    if (record.year < 1975 && (record.condition === 'M' || record.condition === 'NM' || record.condition === 'VG+' || record.condition === 'VG')) return true;
    if (record.year < 1960) return true;
    return false;
  }, [record]);

  if (!isFirstPressing) return null;

  return (
    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400" title="Likely first or early pressing">
      1st Pressing
    </span>
  );
}

// Fix: explicitly destructure batch/drag props that App.js passes, plus onDelete for bulk actions
export default function CollectionScreen({ records, currentUser, onAddRecord, onDelete, batchMode: appBatchMode, batchSelected: appBatchSelected, onToggleBatchSelect, dragState, onDragStart, onDragOver, onDragEnd, ...handlers }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("dateDesc");
  const [filterFormat, setFilterFormat] = useState("All");
  const [filterCondition, setFilterCondition] = useState("All");
  const [groupBy, setGroupBy] = useState("none"); // none | genre | artist | decade
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // grid | shelf
  const [showTimeline, setShowTimeline] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [activeGenreFilter, setActiveGenreFilter] = useState(null);
  const [batchCondition, setBatchCondition] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  // v3 feature toggles
  const [showBubbleChart, setShowBubbleChart] = useState(false);
  const [showCSVImporter, setShowCSVImporter] = useState(false);
  const [showLendingTracker, setShowLendingTracker] = useState(false);
  const [showUpgradeTracker, setShowUpgradeTracker] = useState(false);
  const [showArtistCompletion, setShowArtistCompletion] = useState(false);
  const [showSmartSort, setShowSmartSort] = useState(false);
  const [showInsurance, setShowInsurance] = useState(false);
  const [showWantVsHave, setShowWantVsHave] = useState(false);
  const [showYearDist, setShowYearDist] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  // Memoize the user's records to avoid re-filtering on every render (#15)
  const mine = useMemo(() => records.filter(r => r.user === currentUser), [records, currentUser]);

  // Apply search, format filter, condition filter, genre pill filter — memoized (#15)
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
    // Improvement 7: quick-filter by clicking genre pills
    if (activeGenreFilter) {
      list = list.filter(r => (r.tags || []).includes(activeGenreFilter));
    }
    return sortRecords(list, sortKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, search, filterFormat, filterCondition, sortKey, activeGenreFilter]);

  // Statistics — Improvement 8: avg condition + condition distribution + decade breakdown
  const stats = useMemo(() => {
    const totalValue = mine.reduce((sum, r) => sum + (r.forSale && r.price ? parseFloat(r.price) : 0), 0);
    // Estimated collection value based on condition + year heuristic
    const estCollectionValue = mine.reduce((sum, r) => sum + estimateValue(r.condition, r.year), 0);
    const genreMap = {};
    mine.forEach(r => {
      (r.tags || []).forEach(t => {
        if (GENRE_LIST.includes(t)) {
          genreMap[t] = (genreMap[t] || 0) + 1;
        }
      });
    });
    const genres = Object.entries(genreMap).sort((a, b) => b[1] - a[1]);
    const forSaleCount = mine.filter(r => r.forSale).length;

    // Average condition
    const condValues = mine.map(r => COND_ORDER.indexOf(r.condition)).filter(i => i >= 0);
    const avgCondIdx = condValues.length > 0 ? Math.round(condValues.reduce((a, b) => a + b, 0) / condValues.length) : -1;
    const avgCondition = avgCondIdx >= 0 ? COND_ORDER[avgCondIdx] : "N/A";

    // Condition distribution
    const condDist = {};
    COND_ORDER.forEach(c => { condDist[c] = 0; });
    mine.forEach(r => {
      if (r.condition && condDist[r.condition] !== undefined) condDist[r.condition]++;
    });

    // Decade breakdown
    const decadeMap = {};
    mine.forEach(r => {
      if (r.year) {
        const decade = `${Math.floor(r.year / 10) * 10}s`;
        decadeMap[decade] = (decadeMap[decade] || 0) + 1;
      }
    });
    const decades = Object.entries(decadeMap).sort((a, b) => a[0].localeCompare(b[0]));

    // Records not listed for sale (candidates for "List yours for sale" CTA)
    const unlistedCount = mine.filter(r => !r.forSale).length;

    return { totalValue, estCollectionValue, genres, forSaleCount, avgCondition, condDist, decades, unlistedCount };
  }, [mine]);

  // Grouped records for visual grouping mode — Improvement 9: group by decade
  const groupedRecords = useMemo(() => {
    if (groupBy === "none") return null;
    const groups = {};
    filtered.forEach(r => {
      let key;
      if (groupBy === "artist") {
        key = r.artist || "Unknown";
      } else if (groupBy === "decade") {
        key = r.year ? `${Math.floor(r.year / 10) * 10}s` : "Unknown";
      } else {
        // genre — take first genre tag
        key = (r.tags || []).find(t => GENRE_LIST.includes(t)) || "Other";
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  // Micro-improvement 5: Collection health score (diversity, completeness)
  const healthScore = useMemo(() => {
    if (mine.length === 0) return { score: 0, diversity: 0, completeness: 0, label: 'Empty' };
    const genreSet = new Set();
    const decadeSet = new Set();
    const condSet = new Set();
    mine.forEach(r => {
      (r.tags || []).forEach(t => genreSet.add(t));
      if (r.year) decadeSet.add(Math.floor(r.year / 10) * 10);
      if (r.condition) condSet.add(r.condition);
    });
    const diversity = Math.min(100, Math.round((genreSet.size * 8) + (decadeSet.size * 10)));
    const completeness = Math.min(100, Math.round((mine.length / 50) * 60 + (mine.filter(r => r.rating > 0).length / Math.max(mine.length, 1)) * 40));
    const score = Math.round((diversity + completeness) / 2);
    const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Great' : score >= 40 ? 'Good' : score >= 20 ? 'Growing' : 'Starting';
    return { score, diversity, completeness, label };
  }, [mine]);

  // Micro-improvement 6: "Random record" button
  const [randomRecord, setRandomRecord] = useState(null);
  const pickRandomRecord = useCallback(() => {
    if (mine.length === 0) return;
    const idx = Math.floor(Math.random() * mine.length);
    setRandomRecord(mine[idx]);
  }, [mine]);

  // Micro-improvement 7: Collection comparison share link
  const [compShareCopied, setCompShareCopied] = useState(false);
  const shareComparisonLink = useCallback(() => {
    const genres = [...new Set(mine.flatMap(r => r.tags || []))].slice(0, 5).join(',');
    const url = `${window.location.origin}?compare=${currentUser}&records=${mine.length}&genres=${encodeURIComponent(genres)}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCompShareCopied(true);
    setTimeout(() => setCompShareCopied(false), 2000);
  }, [mine, currentUser]);

  // Micro-improvement 8: Missing album detector per artist
  const missingAlbums = useMemo(() => {
    const artistAlbums = {};
    mine.forEach(r => {
      if (!artistAlbums[r.artist]) artistAlbums[r.artist] = [];
      artistAlbums[r.artist].push(r.album);
    });
    const suggestions = [];
    const knownDiscographies = {
      'Pink Floyd': ['The Dark Side of the Moon', 'Wish You Were Here', 'The Wall', 'Animals', 'Meddle'],
      'Led Zeppelin': ['Led Zeppelin I', 'Led Zeppelin II', 'Led Zeppelin III', 'Led Zeppelin IV', 'Houses of the Holy', 'Physical Graffiti'],
      'The Beatles': ["Sgt. Pepper's", 'Abbey Road', 'Revolver', 'Rubber Soul', 'Let It Be', 'The White Album'],
      'Queen': ['A Night at the Opera', 'News of the World', 'A Day at the Races', 'Jazz', 'Sheer Heart Attack'],
    };
    Object.entries(artistAlbums).forEach(([artist, owned]) => {
      const known = knownDiscographies[artist];
      if (known) {
        const missing = known.filter(a => !owned.some(o => o.toLowerCase().includes(a.toLowerCase())));
        if (missing.length > 0) suggestions.push({ artist, missing: missing.slice(0, 3) });
      }
    });
    return suggestions;
  }, [mine]);

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

  // Improvement 10: Print collection catalog
  const printCatalog = useCallback(() => {
    const printContent = mine.map(r =>
      `${r.album} - ${r.artist} (${r.year || 'N/A'}) [${r.format || 'N/A'}] Condition: ${r.condition || 'N/A'}${r.forSale ? ` - FOR SALE $${r.price}` : ''}`
    ).join('\n');
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<html><head><title>My Vinyl Collection</title><style>body{font-family:monospace;font-size:12px;padding:20px;line-height:1.8;}h1{font-size:18px;margin-bottom:10px;}p{margin:0;}</style></head><body><h1>My Vinyl Collection (${mine.length} records)</h1><pre>${printContent}</pre></body></html>`);
      printWindow.document.close();
      printWindow.print();
    }
  }, [mine]);

  // Improvement 11: Share collection link
  const handleShareCollection = useCallback(() => {
    const url = `${window.location.origin}?collection=${currentUser}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }, [currentUser]);

  // Improvement 12: Batch condition update
  const handleBatchConditionUpdate = useCallback(() => {
    if (selected.size === 0 || !batchCondition) return;
    // In a real app this would call an update handler for each record
    window.alert(`Would update ${selected.size} record(s) to condition: ${batchCondition}. (Handler not connected yet)`);
    setBatchCondition("");
  }, [selected, batchCondition]);

  // Bulk actions
  // Fix: use the explicitly destructured onDelete prop instead of handlers.onDelete
  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    if (window.confirm(`Remove ${selected.size} record(s) from your collection?`)) {
      selected.forEach(id => onDelete?.(id));
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
          <p className="text-xs text-gs-dim">{mine.length} record{mine.length !== 1 ? "s" : ""}{stats.forSaleCount > 0 && ` \u00b7 ${stats.forSaleCount} for sale`}</p>
        </div>
        <div className="flex gap-2">
          {mine.length > 0 && (
            <>
              {/* Improvement 11: Share button */}
              <button onClick={handleShareCollection} className="gs-btn-secondary px-3 py-[9px] text-xs relative" title="Share Collection">
                {shareCopied ? 'Copied!' : 'Share'}
              </button>
              {/* Improvement 10: Print button */}
              <button onClick={printCatalog} className="gs-btn-secondary px-3 py-[9px] text-xs" title="Print Catalog">
                Print
              </button>
              <button onClick={exportCSV} className="gs-btn-secondary px-3 py-[9px] text-xs" title="Export CSV">
                Export
              </button>
            </>
          )}
          <button onClick={onAddRecord} className="gs-btn-gradient px-[18px] py-[9px] text-xs">
            + Add Record
          </button>
        </div>
      </div>

      {/* Statistics bar — expanded with estimated collection value */}
      {mine.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-2.5 mb-2.5">
            <div className="bg-gs-card border border-gs-border rounded-xl py-3 px-3 text-center">
              <div className="text-lg font-extrabold tracking-tight text-gs-accent">{mine.length}</div>
              <div className="text-[10px] text-gs-dim font-mono mt-0.5">Records</div>
            </div>
            <div className="bg-gs-card border border-gs-border rounded-xl py-3 px-3 text-center">
              <div className="text-lg font-extrabold tracking-tight text-emerald-400">~${stats.estCollectionValue.toLocaleString()}</div>
              <div className="text-[10px] text-gs-dim font-mono mt-0.5">Est. Value</div>
            </div>
            <div className="bg-gs-card border border-gs-border rounded-xl py-3 px-3 text-center">
              <div className="text-lg font-extrabold tracking-tight text-violet-500">{stats.genres.length}</div>
              <div className="text-[10px] text-gs-dim font-mono mt-0.5">Genres</div>
            </div>
            <div className="bg-gs-card border border-gs-border rounded-xl py-3 px-3 text-center">
              <div className="text-lg font-extrabold tracking-tight text-amber-500">{stats.avgCondition}</div>
              <div className="text-[10px] text-gs-dim font-mono mt-0.5">Avg Cond.</div>
            </div>
          </div>
          {/* Listed value and list-for-sale CTA */}
          <div className="flex items-center justify-between bg-gs-card border border-gs-border rounded-xl py-2.5 px-3.5 mb-4">
            <div className="flex items-center gap-4">
              {stats.forSaleCount > 0 && (
                <div className="text-[11px] text-gs-dim font-mono">
                  <span className="text-green-500 font-bold">${stats.totalValue.toFixed(0)}</span> listed for sale
                </div>
              )}
              <div className="text-[9px] text-gs-faint font-mono">
                Est. values based on condition + year. Not actual market data.
              </div>
            </div>
            {stats.unlistedCount > 0 && (
              <button
                onClick={onAddRecord}
                className="text-[10px] font-semibold px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 cursor-pointer hover:bg-amber-500/20 transition-colors whitespace-nowrap"
              >
                List {stats.unlistedCount} unlisted for sale
              </button>
            )}
          </div>
        </>
      )}

      {/* Condition distribution chart — Improvement 8 */}
      {mine.length > 0 && (
        <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
          <div className="text-[10px] font-mono text-gs-dim mb-2 tracking-wider uppercase">Condition Distribution</div>
          <div className="flex items-end gap-1 h-10">
            {COND_ORDER.map(c => {
              const count = stats.condDist[c] || 0;
              const maxCond = Math.max(...Object.values(stats.condDist), 1);
              return (
                <div key={c} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: `${Math.max(2, (count / maxCond) * 40)}px`,
                      background: count > 0 ? (COND_ORDER.indexOf(c) <= 2 ? '#22c55e' : COND_ORDER.indexOf(c) <= 4 ? '#f59e0b' : '#ef4444') : '#1a1a1a',
                    }}
                    title={`${c}: ${count}`}
                  />
                  <span className="text-[7px] text-gs-faint font-mono">{c}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Micro-improvement 5: Collection health score */}
      {mine.length > 0 && (
        <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono text-gs-dim tracking-wider uppercase">Collection Health</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold" style={{ color: healthScore.score >= 60 ? '#22c55e' : healthScore.score >= 40 ? '#f59e0b' : '#ef4444' }}>{healthScore.label}</span>
              <span className="text-xs font-extrabold" style={{ color: healthScore.score >= 60 ? '#22c55e' : healthScore.score >= 40 ? '#f59e0b' : '#ef4444' }}>{healthScore.score}%</span>
            </div>
          </div>
          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-2">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${healthScore.score}%`, background: healthScore.score >= 60 ? '#22c55e' : healthScore.score >= 40 ? '#f59e0b' : '#ef4444' }} />
          </div>
          <div className="flex gap-4 text-[9px] text-gs-faint font-mono">
            <span>Diversity: {healthScore.diversity}%</span>
            <span>Completeness: {healthScore.completeness}%</span>
          </div>
        </div>
      )}

      {/* Micro-improvement 6: Random record + Micro-improvement 7: Compare link */}
      {mine.length > 0 && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={pickRandomRecord}
            className="flex-1 text-[10px] py-2 rounded-lg border border-gs-border bg-gs-card text-gs-muted cursor-pointer hover:text-gs-accent hover:border-gs-accent/30 transition-colors font-mono"
          >
            Surprise Me (Random Record)
          </button>
          <button
            onClick={shareComparisonLink}
            className="flex-1 text-[10px] py-2 rounded-lg border border-gs-border bg-gs-card text-gs-muted cursor-pointer hover:text-gs-accent hover:border-gs-accent/30 transition-colors font-mono"
          >
            {compShareCopied ? 'Link Copied!' : 'Share Comparison Link'}
          </button>
        </div>
      )}

      {/* Micro-improvement 6: Random record display */}
      {randomRecord && (
        <div className="bg-gradient-to-r from-gs-accent/10 to-transparent border border-gs-accent/20 rounded-xl p-3 mb-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0" style={{ background: randomRecord.accent || '#333' }} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-gs-accent font-mono uppercase tracking-wider mb-0.5">Random Pick</div>
            <div className="text-xs font-bold text-gs-text truncate">{randomRecord.album}</div>
            <div className="text-[10px] text-gs-dim truncate">{randomRecord.artist} ({randomRecord.year})</div>
          </div>
          <button onClick={() => { handlers.onDetail?.(randomRecord); }} className="text-[10px] px-3 py-1.5 rounded-lg bg-gs-accent/15 text-gs-accent border border-gs-accent/30 cursor-pointer hover:bg-gs-accent/25 transition-colors">View</button>
          <button onClick={() => setRandomRecord(null)} className="text-gs-faint hover:text-gs-text bg-transparent border-none cursor-pointer text-xs p-1">&times;</button>
        </div>
      )}

      {/* Micro-improvement 8: Missing album detector */}
      {missingAlbums.length > 0 && (
        <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
          <div className="text-[10px] font-mono text-gs-dim tracking-wider uppercase mb-2">Missing Albums Detector</div>
          {missingAlbums.map(({ artist, missing }) => (
            <div key={artist} className="mb-1.5 last:mb-0">
              <span className="text-[10px] font-bold text-gs-text">{artist}:</span>
              <span className="text-[10px] text-gs-faint ml-1.5">{missing.join(', ')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Decade breakdown pills */}
      {mine.length > 0 && stats.decades.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-[10px] font-mono text-gs-dim self-center mr-1">Decades:</span>
          {stats.decades.map(([decade, count]) => (
            <span key={decade} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-gs-dim border border-gs-border-hover font-mono">
              {decade} <span className="text-gs-faint">({count})</span>
            </span>
          ))}
        </div>
      )}

      {/* Genre breakdown pills — Improvement 7: clickable for quick-filter */}
      {mine.length > 0 && stats.genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {activeGenreFilter && (
            <button
              onClick={() => setActiveGenreFilter(null)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-gs-accent/15 text-gs-accent border border-gs-accent/30 font-mono cursor-pointer"
            >
              Clear filter
            </button>
          )}
          {stats.genres.slice(0, 8).map(([genre, count]) => (
            <button
              key={genre}
              onClick={() => setActiveGenreFilter(activeGenreFilter === genre ? null : genre)}
              className={`text-[10px] px-2 py-0.5 rounded-full border font-mono cursor-pointer transition-colors ${
                activeGenreFilter === genre
                  ? 'bg-gs-accent/15 text-gs-accent border-gs-accent/40'
                  : 'bg-[#1a1a1a] text-gs-dim border-gs-border-hover hover:border-gs-accent/30'
              }`}
            >
              {genre} <span className="text-gs-faint">({count})</span>
            </button>
          ))}
          {stats.genres.length > 8 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-gs-faint border border-gs-border-hover font-mono">
              +{stats.genres.length - 8} more
            </span>
          )}
        </div>
      )}

      {/* Improvement 2: Collection Timeline */}
      {mine.length > 0 && showTimeline && (
        <CollectionTimeline records={mine} />
      )}

      {/* Improvement 6: Missing records suggestions */}
      {mine.length > 0 && showMissing && (
        <MissingSuggestions records={mine} />
      )}

      {/* v3-14: Genre Bubble Chart */}
      {mine.length > 0 && showBubbleChart && (
        <GenreBubbleChart records={mine} />
      )}

      {/* v3-15: CSV Importer */}
      {showCSVImporter && (
        <CSVImporter onImport={(imported) => { imported.forEach(r => onAddRecord?.(r)); }} onClose={() => setShowCSVImporter(false)} />
      )}

      {/* v3-16: Lending Tracker */}
      {showLendingTracker && (
        <LendingTracker records={mine} onClose={() => setShowLendingTracker(false)} />
      )}

      {/* v3-17: Condition Upgrade Tracker */}
      {mine.length > 0 && showUpgradeTracker && (
        <ConditionUpgradeTracker records={mine} />
      )}

      {/* v3-18: Artist Completion Tracker */}
      {mine.length > 0 && showArtistCompletion && (
        <ArtistCompletionTracker records={mine} />
      )}

      {/* v3-19: Smart Sort Suggestion */}
      {mine.length > 0 && showSmartSort && (
        <SmartSortSuggestion records={mine} onApplySort={(key) => { setSortKey(key); setShowSmartSort(false); }} />
      )}

      {/* v3-20: Insurance Calculator */}
      {mine.length > 0 && showInsurance && (
        <InsuranceCalculator records={mine} />
      )}

      {/* v3-21: Want vs Have Counter */}
      {mine.length > 0 && showWantVsHave && (
        <WantVsHaveCounter records={mine} />
      )}

      {/* v3-22: Year Distribution Chart */}
      {mine.length > 0 && showYearDist && (
        <YearDistributionChart records={mine} />
      )}

      {/* v3-24: Labels Breakdown */}
      {mine.length > 0 && showLabels && (
        <LabelsBreakdown records={mine} />
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
                &#x2715;
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
              Filters {(filterFormat !== "All" || filterCondition !== "All") && "\u00b7"}
            </button>

            {/* Group by — Improvement 9: added decade */}
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value)}
              className="bg-[#111] border border-gs-border rounded-lg px-2.5 py-2 text-[11px] text-gs-muted focus:outline-none focus:border-gs-accent/50 cursor-pointer"
            >
              <option value="none">No Grouping</option>
              <option value="genre">Group by Genre</option>
              <option value="artist">Group by Artist</option>
              <option value="decade">Group by Decade</option>
            </select>

            {/* View mode toggle — Improvement 1 */}
            <div className="flex border border-gs-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-2.5 py-2 text-[11px] border-0 cursor-pointer ${viewMode === 'grid' ? 'bg-gs-accent/15 text-gs-accent' : 'bg-transparent text-gs-dim'}`}
                title="Grid view"
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode("shelf")}
                className={`px-2.5 py-2 text-[11px] border-0 border-l border-gs-border cursor-pointer ${viewMode === 'shelf' ? 'bg-gs-accent/15 text-gs-accent' : 'bg-transparent text-gs-dim'}`}
                title="Shelf view"
              >
                Shelf
              </button>
            </div>

            {/* Select mode toggle */}
            <button
              onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
              className={`gs-btn-secondary px-3 py-2 text-[11px] ml-auto ${selectMode ? 'border-gs-accent/50 text-gs-accent' : ''}`}
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
          </div>

          {/* Tools row — Improvement toggles for Timeline, Duplicates, Goals, Missing */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => { setShowTimeline(!showTimeline); setShowDuplicates(false); setShowGoals(false); setShowMissing(false); }}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showTimeline ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Timeline
            </button>
            <button
              onClick={() => { setShowDuplicates(!showDuplicates); setShowTimeline(false); setShowGoals(false); setShowMissing(false); }}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showDuplicates ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Duplicates
            </button>
            <button
              onClick={() => { setShowGoals(!showGoals); setShowTimeline(false); setShowDuplicates(false); setShowMissing(false); }}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showGoals ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Goals
            </button>
            <button
              onClick={() => { setShowMissing(!showMissing); setShowTimeline(false); setShowDuplicates(false); setShowGoals(false); }}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showMissing ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Suggestions
            </button>
            {/* Improvement 13: Notes toggle */}
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showNotes ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Notes
            </button>
            {/* v3 feature toggles */}
            <button
              onClick={() => setShowBubbleChart(!showBubbleChart)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showBubbleChart ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Genres
            </button>
            <button
              onClick={() => setShowCSVImporter(!showCSVImporter)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showCSVImporter ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Import CSV
            </button>
            <button
              onClick={() => setShowLendingTracker(!showLendingTracker)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showLendingTracker ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Lending
            </button>
            <button
              onClick={() => setShowUpgradeTracker(!showUpgradeTracker)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showUpgradeTracker ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Upgrades
            </button>
            <button
              onClick={() => setShowArtistCompletion(!showArtistCompletion)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showArtistCompletion ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Completion
            </button>
            <button
              onClick={() => setShowSmartSort(!showSmartSort)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showSmartSort ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Smart Sort
            </button>
            <button
              onClick={() => setShowInsurance(!showInsurance)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showInsurance ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Insurance
            </button>
            <button
              onClick={() => setShowWantVsHave(!showWantVsHave)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showWantVsHave ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Want/Have
            </button>
            <button
              onClick={() => setShowYearDist(!showYearDist)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showYearDist ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Years
            </button>
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono border cursor-pointer transition-colors ${showLabels ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-transparent border-gs-border text-gs-dim hover:border-[#333]'}`}
            >
              Labels
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
          {(search || filterFormat !== "All" || filterCondition !== "All" || activeGenreFilter) && (
            <div className="text-[11px] text-gs-dim">
              Showing {filtered.length} of {mine.length} records
              {filterFormat !== "All" && <span> &middot; Format: <span className="text-gs-muted">{filterFormat}</span></span>}
              {filterCondition !== "All" && <span> &middot; Condition: <span className="text-gs-muted">{filterCondition}</span></span>}
              {activeGenreFilter && <span> &middot; Genre: <span className="text-gs-muted">{activeGenreFilter}</span></span>}
            </div>
          )}

          {/* Duplicate finder panel — Improvement 3 */}
          {showDuplicates && (
            <div className="bg-[#111] border border-gs-border rounded-lg px-3.5 py-3">
              <DuplicateFinder records={mine} onDetail={handlers.onDetail} />
            </div>
          )}

          {/* Goals panel — Improvement 4 */}
          {showGoals && (
            <div className="bg-[#111] border border-gs-border rounded-lg px-3.5 py-3">
              <CollectionGoals records={mine} />
            </div>
          )}

          {/* Select mode bulk actions — Improvement 12: batch condition update */}
          {selectMode && (
            <div className="flex gap-2 items-center bg-[#111] border border-gs-border rounded-lg px-3.5 py-2.5 flex-wrap">
              <span className="text-[11px] text-gs-dim font-mono">{selected.size} selected</span>
              <div className="ml-auto flex gap-2 items-center flex-wrap">
                <button
                  onClick={() => { if (filtered.length > 0) setSelected(new Set(filtered.map(r => r.id))); }}
                  className="gs-btn-secondary px-3 py-1.5 text-[10px]"
                >
                  Select All
                </button>
                {/* Batch condition update */}
                <select
                  value={batchCondition}
                  onChange={e => setBatchCondition(e.target.value)}
                  disabled={selected.size === 0}
                  className="bg-[#0a0a0a] border border-gs-border rounded px-2 py-1.5 text-[10px] text-gs-muted focus:outline-none cursor-pointer"
                >
                  <option value="">Batch Condition...</option>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {batchCondition && selected.size > 0 && (
                  <button
                    onClick={handleBatchConditionUpdate}
                    className="px-3 py-1.5 text-[10px] rounded-lg border font-semibold bg-gs-accent/10 border-gs-accent/30 text-gs-accent cursor-pointer"
                  >
                    Apply ({selected.size})
                  </button>
                )}
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
      ) : viewMode === "shelf" ? (
        // Improvement 1: Shelf view mode
        <div className="space-y-1">
          <div className="text-[10px] font-mono text-gs-dim mb-2">Showing {filtered.length} records on the shelf</div>
          {(() => {
            const shelfSize = 20;
            const shelves = [];
            for (let i = 0; i < filtered.length; i += shelfSize) {
              shelves.push(filtered.slice(i, i + shelfSize));
            }
            return shelves.map((shelf, idx) => (
              <ShelfRow
                key={idx}
                records={shelf}
                handlers={handlers}
                selectMode={selectMode}
                toggleSelect={toggleSelect}
                selected={selected}
                appBatchMode={appBatchMode}
                onToggleBatchSelect={onToggleBatchSelect}
                appBatchSelected={appBatchSelected}
              />
            ));
          })()}
        </div>
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
              {/* Fix: connect App-level batch mode to card selection when active */}
              <Paginated
                records={groupRecords}
                handlers={{
                  ...handlers,
                  ...(selectMode ? { onSelect: toggleSelect, selected } : {}),
                  ...(appBatchMode ? { onSelect: onToggleBatchSelect, selected: new Set(appBatchSelected) } : {}),
                }}
              />
              {/* Improvement 13: Show notes per record if notes mode is active */}
              {showNotes && (
                <div className="mt-2 space-y-1 pl-2">
                  {groupRecords.map(r => (
                    <div key={r.id} className="flex items-start gap-2">
                      <span className="text-[10px] text-gs-dim shrink-0 w-32 truncate">{r.album}:</span>
                      <RecordNotes recordId={r.id} />
                      <PressingQualityIndicator record={r} />
                      <FirstPressingBadge record={r} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
          <Paginated
            records={filtered}
            handlers={{
              ...handlers,
              ...(selectMode ? { onSelect: toggleSelect, selected } : {}),
              ...(appBatchMode ? { onSelect: onToggleBatchSelect, selected: new Set(appBatchSelected) } : {}),
            }}
          />
          {/* Improvement 13: Show notes per record if notes mode is active */}
          {showNotes && (
            <div className="mt-4 space-y-1.5 bg-[#111] border border-gs-border rounded-lg p-3">
              <div className="text-[10px] font-mono text-gs-dim mb-2 tracking-wider uppercase">Record Notes</div>
              {filtered.map(r => (
                <div key={r.id} className="flex items-start gap-2">
                  <span className="text-[10px] text-gs-dim shrink-0 w-40 truncate" title={`${r.album} - ${r.artist}`}>{r.album}:</span>
                  <RecordNotes recordId={r.id} />
                  <PressingQualityIndicator record={r} />
                  <FirstPressingBadge record={r} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
