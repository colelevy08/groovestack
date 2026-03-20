// Dedicated wishlist management screen with priority levels, price alerts,
// matching listings notifications, share feature, Discogs import, filtering,
// and price range preferences.
import { useState, useMemo, useCallback } from 'react';
import Badge from '../ui/Badge';
import Empty from '../ui/Empty';
import FormInput from '../ui/FormInput';
import FormSelect from '../ui/FormSelect';
import { GENRES } from '../../constants';

const PRIORITIES = [
  { key: 'high', label: 'High', color: '#ef4444' },
  { key: 'medium', label: 'Medium', color: '#f59e0b' },
  { key: 'low', label: 'Low', color: '#22c55e' },
];

const DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];

const SORT_OPTIONS = [
  { key: 'dateDesc', label: 'Date Added (Newest)' },
  { key: 'dateAsc', label: 'Date Added (Oldest)' },
  { key: 'priorityHigh', label: 'Priority (Highest)' },
  { key: 'priceAsc', label: 'Max Price (Lowest)' },
  { key: 'priceDesc', label: 'Max Price (Highest)' },
  { key: 'artistAZ', label: 'Artist A-Z' },
];

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function sortItems(items, sortKey) {
  const sorted = [...items];
  switch (sortKey) {
    case 'dateAsc': return sorted.reverse();
    case 'priorityHigh': return sorted.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));
    case 'priceAsc': return sorted.sort((a, b) => (a.maxPrice || Infinity) - (b.maxPrice || Infinity));
    case 'priceDesc': return sorted.sort((a, b) => (b.maxPrice || 0) - (a.maxPrice || 0));
    case 'artistAZ': return sorted.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
    default: return sorted;
  }
}

// ── Wishlist item card ───────────────────────────────────────────────────

function WishlistItem({ item, onRemove, onToggleAlert, onUpdatePriority, matchingCount }) {
  const priorityInfo = PRIORITIES.find(p => p.key === item.priority) || PRIORITIES[1];

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 flex flex-col sm:flex-row gap-3 group hover:border-gs-border-hover transition-colors">
      {/* Album art placeholder */}
      <div className="w-14 h-14 rounded-lg bg-gs-surface border border-gs-border flex items-center justify-center shrink-0 text-gs-faint text-xl">
        {item.coverEmoji || '\u{1F3B5}'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-[13px] font-bold text-gs-text m-0 truncate">{item.album || 'Unknown Album'}</h4>
            <p className="text-[11px] text-gs-muted m-0 truncate">{item.artist || 'Unknown Artist'}</p>
          </div>
          <Badge label={priorityInfo.label} color={priorityInfo.color} size="sm" />
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {item.genre && <Badge label={item.genre} color="#8b5cf6" size="sm" />}
          {item.decade && <Badge label={item.decade} color="#06b6d4" size="sm" />}
          {item.maxPrice && <Badge label={`Max $${item.maxPrice}`} color="#22c55e" size="sm" />}
          {item.minCondition && <Badge label={`${item.minCondition}+`} color="#f59e0b" size="sm" />}
        </div>

        {/* Matching listings notification */}
        {matchingCount > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gs-accent animate-pulse" />
            <span className="text-[11px] text-gs-accent font-medium">
              {matchingCount} matching listing{matchingCount > 1 ? 's' : ''} available
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Priority cycle */}
          <select
            value={item.priority || 'medium'}
            onChange={e => onUpdatePriority?.(item.id, e.target.value)}
            className="bg-gs-surface border border-gs-border rounded-md text-[10px] text-gs-muted px-1.5 py-1 outline-none cursor-pointer font-sans focus:border-gs-accent/30"
          >
            {PRIORITIES.map(p => (
              <option key={p.key} value={p.key}>{p.label} Priority</option>
            ))}
          </select>

          <button
            onClick={() => onToggleAlert?.(item.id)}
            className={`text-[10px] px-2 py-1 rounded-md border cursor-pointer transition-colors ${
              item.alertEnabled
                ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent'
                : 'bg-transparent border-gs-border text-gs-dim hover:text-gs-muted'
            }`}
          >
            {item.alertEnabled ? 'Alert On' : 'Alert Off'}
          </button>

          <button
            onClick={() => onRemove?.(item.id)}
            className="text-[10px] px-2 py-1 rounded-md border border-gs-border bg-transparent text-gs-dim hover:text-[#ef4444] hover:border-[#ef4444]/40 cursor-pointer transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add to wishlist form ─────────────────────────────────────────────────

function AddWishlistForm({ onAdd, onClose }) {
  const [form, setForm] = useState({
    album: '', artist: '', genre: '', decade: '',
    priority: 'medium', maxPrice: '', minCondition: '', notes: '',
  });

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!form.album.trim() && !form.artist.trim()) return;
    onAdd?.({
      ...form,
      id: Date.now(),
      maxPrice: form.maxPrice ? parseFloat(form.maxPrice) : null,
      alertEnabled: true,
      addedAt: new Date().toISOString(),
    });
    onClose?.();
  }, [form, onAdd, onClose]);

  const updateField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <form onSubmit={handleSubmit} className="bg-gs-card border border-gs-border rounded-xl p-4 space-y-3">
      <h3 className="text-[13px] font-bold text-gs-text m-0">Add to Wishlist</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormInput label="Album" value={form.album} onChange={e => updateField('album', e.target.value)} placeholder="Album title" />
        <FormInput label="Artist" value={form.artist} onChange={e => updateField('artist', e.target.value)} placeholder="Artist name" />
        <FormSelect label="Genre" value={form.genre} onChange={e => updateField('genre', e.target.value)} options={[{ value: '', label: 'Any' }, ...GENRES.map(g => ({ value: g, label: g }))]} />
        <FormSelect label="Decade" value={form.decade} onChange={e => updateField('decade', e.target.value)} options={[{ value: '', label: 'Any' }, ...DECADES.map(d => ({ value: d, label: d }))]} />
        <FormSelect label="Priority" value={form.priority} onChange={e => updateField('priority', e.target.value)} options={PRIORITIES.map(p => ({ value: p.key, label: p.label }))} />
        <FormInput label="Max Price" value={form.maxPrice} onChange={e => updateField('maxPrice', e.target.value)} placeholder="$" type="number" min="0" />
      </div>
      <div className="flex items-center gap-2 justify-end pt-1">
        <button type="button" onClick={onClose} className="gs-btn-secondary px-3.5 py-2 text-[12px] rounded-lg">Cancel</button>
        <button type="submit" className="gs-btn-gradient px-3.5 py-2 text-[12px] rounded-lg">Add</button>
      </div>
    </form>
  );
}

// ── Import from Discogs ──────────────────────────────────────────────────

function DiscogsImport({ onImport, onClose }) {
  const [text, setText] = useState('');

  const handleImport = useCallback(() => {
    // Parse lines in format: "Artist - Album"
    const lines = text.split('\n').filter(l => l.trim());
    const items = lines.map((line, i) => {
      const parts = line.split(' - ');
      return {
        id: Date.now() + i,
        artist: (parts[0] || '').trim(),
        album: (parts[1] || parts[0] || '').trim(),
        priority: 'medium',
        alertEnabled: true,
        addedAt: new Date().toISOString(),
      };
    });
    onImport?.(items);
    onClose?.();
  }, [text, onImport, onClose]);

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 space-y-3">
      <h3 className="text-[13px] font-bold text-gs-text m-0">Import from Discogs Wantlist</h3>
      <p className="text-[11px] text-gs-dim m-0">Paste your wantlist items, one per line. Format: Artist - Album</p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={6}
        placeholder={"Miles Davis - Kind of Blue\nRadiohead - OK Computer\nMF DOOM - Mm.. Food"}
        className="w-full bg-gs-surface border border-gs-border rounded-lg py-2.5 px-3 text-[12px] text-gs-text font-sans outline-none resize-y placeholder:text-gs-faint focus:border-gs-accent/30"
      />
      <div className="flex items-center gap-2 justify-end">
        <button onClick={onClose} className="gs-btn-secondary px-3.5 py-2 text-[12px] rounded-lg">Cancel</button>
        <button onClick={handleImport} disabled={!text.trim()} className="gs-btn-gradient px-3.5 py-2 text-[12px] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
          Import
        </button>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────

export default function WishlistScreen({
  wishlistItems = [],
  records = [],
  onAddItem,
  onRemoveItem,
  onToggleAlert,
  onUpdatePriority,
  onImportItems,
  onShareWishlist,
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('dateDesc');
  const [filterGenre, setFilterGenre] = useState('All');
  const [filterDecade, setFilterDecade] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Compute matching listings for each wishlist item
  const matchingCounts = useMemo(() => {
    const counts = {};
    wishlistItems.forEach(item => {
      const matches = records.filter(r => {
        if (!r.forSale) return false;
        const artistMatch = !item.artist || (r.artist || '').toLowerCase().includes(item.artist.toLowerCase());
        const albumMatch = !item.album || (r.album || '').toLowerCase().includes(item.album.toLowerCase());
        const priceMatch = !item.maxPrice || (parseFloat(r.price) || 0) <= item.maxPrice;
        return artistMatch && albumMatch && priceMatch;
      });
      counts[item.id] = matches.length;
    });
    return counts;
  }, [wishlistItems, records]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = wishlistItems;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(item =>
        (item.album || '').toLowerCase().includes(q) ||
        (item.artist || '').toLowerCase().includes(q)
      );
    }
    if (filterGenre !== 'All') list = list.filter(item => item.genre === filterGenre);
    if (filterDecade !== 'All') list = list.filter(item => item.decade === filterDecade);
    if (filterPriority !== 'All') list = list.filter(item => item.priority === filterPriority);
    return sortItems(list, sortKey);
  }, [wishlistItems, search, filterGenre, filterDecade, filterPriority, sortKey]);

  // Stats
  const alertCount = wishlistItems.filter(i => i.alertEnabled).length;
  const totalMatches = Object.values(matchingCounts).reduce((s, c) => s + c, 0);
  const activeGenres = useMemo(() => [...new Set(wishlistItems.map(i => i.genre).filter(Boolean))], [wishlistItems]);
  const activeDecades = useMemo(() => [...new Set(wishlistItems.map(i => i.decade).filter(Boolean))], [wishlistItems]);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-gs-text m-0">Wishlist</h2>
          <p className="text-[12px] text-gs-dim mt-0.5 mb-0">
            {wishlistItems.length} item{wishlistItems.length !== 1 ? 's' : ''}
            {alertCount > 0 && <span className="text-gs-accent ml-1.5">{alertCount} alert{alertCount !== 1 ? 's' : ''} active</span>}
            {totalMatches > 0 && <span className="text-[#22c55e] ml-1.5">{totalMatches} match{totalMatches !== 1 ? 'es' : ''} found</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setShowAddForm(true); setShowImport(false); }}
            className="gs-btn-gradient px-3.5 py-2 text-[12px] rounded-lg"
          >
            + Add Item
          </button>
          <button
            onClick={() => { setShowImport(true); setShowAddForm(false); }}
            className="gs-btn-secondary px-3.5 py-2 text-[12px] rounded-lg"
          >
            Import Discogs
          </button>
          <button
            onClick={onShareWishlist}
            className="gs-btn-secondary px-3.5 py-2 text-[12px] rounded-lg"
            title="Share wishlist"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
            </svg>
            Share
          </button>
        </div>
      </div>

      {/* Add form / Import */}
      {showAddForm && (
        <AddWishlistForm onAdd={onAddItem} onClose={() => setShowAddForm(false)} />
      )}
      {showImport && (
        <DiscogsImport onImport={onImportItems} onClose={() => setShowImport(false)} />
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gs-dim pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search wishlist..."
            className="w-full bg-gs-card border border-gs-border rounded-lg py-2 pl-8 pr-3 text-[12px] text-gs-text outline-none font-sans placeholder:text-gs-faint focus:border-gs-accent/30"
          />
        </div>

        <select
          value={filterGenre}
          onChange={e => setFilterGenre(e.target.value)}
          className="bg-gs-card border border-gs-border rounded-lg text-[11px] text-gs-muted px-2.5 py-2 outline-none cursor-pointer font-sans focus:border-gs-accent/30"
        >
          <option value="All">All Genres</option>
          {activeGenres.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <select
          value={filterDecade}
          onChange={e => setFilterDecade(e.target.value)}
          className="bg-gs-card border border-gs-border rounded-lg text-[11px] text-gs-muted px-2.5 py-2 outline-none cursor-pointer font-sans focus:border-gs-accent/30"
        >
          <option value="All">All Decades</option>
          {activeDecades.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="bg-gs-card border border-gs-border rounded-lg text-[11px] text-gs-muted px-2.5 py-2 outline-none cursor-pointer font-sans focus:border-gs-accent/30"
        >
          <option value="All">All Priorities</option>
          {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>

        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value)}
          className="bg-gs-card border border-gs-border rounded-lg text-[11px] text-gs-muted px-2.5 py-2 outline-none cursor-pointer font-sans focus:border-gs-accent/30"
        >
          {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {/* Wishlist items */}
      {filtered.length === 0 ? (
        <Empty
          icon="\u{2B50}"
          text={search || filterGenre !== 'All' || filterDecade !== 'All' || filterPriority !== 'All'
            ? 'No items match your filters'
            : 'Your wishlist is empty'
          }
          action={() => setShowAddForm(true)}
          actionLabel="Add Your First Item"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <WishlistItem
              key={item.id}
              item={item}
              onRemove={onRemoveItem}
              onToggleAlert={onToggleAlert}
              onUpdatePriority={onUpdatePriority}
              matchingCount={matchingCounts[item.id] || 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
