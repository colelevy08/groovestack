// Dedicated wishlist management screen with priority levels, price alerts,
// matching listings notifications, share feature, Discogs import, filtering,
// price range preferences, sharing with specific users, price tracking history,
// categories/folders, auto-remove on purchase, friend comparison, analytics,
// and notification preferences per item.
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

// ── Improvement #25: Notification preferences ────────────────────────────
const NOTIFICATION_OPTIONS = [
  { key: 'price_drop', label: 'Price Drop' },
  { key: 'new_listing', label: 'New Listing' },
  { key: 'condition_match', label: 'Condition Match' },
  { key: 'seller_restock', label: 'Seller Restock' },
];

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

// ── Improvement #20: Price History Mini Chart ────────────────────────────

function PriceHistoryChart({ priceHistory }) {
  if (!priceHistory || priceHistory.length < 2) return null;
  const values = priceHistory.map(p => p.price);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 120;
  const h = 32;
  const pad = 2;
  const chartH = h - pad * 2;
  const stepX = w / (values.length - 1);

  const points = values.map((v, i) => ({
    x: i * stepX,
    y: pad + chartH - ((v - min) / range) * chartH,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const lastPrice = values[values.length - 1];
  const firstPrice = values[0];
  const color = lastPrice <= firstPrice ? '#22c55e' : '#ef4444';

  return (
    <div className="inline-flex items-center gap-1.5">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-[80px] h-[24px]" role="img" aria-label="Price history">
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`text-[9px] font-bold ${lastPrice <= firstPrice ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
        {lastPrice <= firstPrice ? '-' : '+'}${Math.abs(lastPrice - firstPrice).toFixed(0)}
      </span>
    </div>
  );
}

// ── Wishlist item card ───────────────────────────────────────────────────

function WishlistItem({
  item,
  onRemove,
  onToggleAlert,
  onUpdatePriority,
  matchingCount,
  onUpdateNotificationPrefs,
  categoryName,
}) {
  const [showNotifPrefs, setShowNotifPrefs] = useState(false);
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
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge label={priorityInfo.label} color={priorityInfo.color} size="sm" />
            {/* Improvement #21: Category badge */}
            {categoryName && <Badge label={categoryName} color="#06b6d4" size="sm" />}
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {item.genre && <Badge label={item.genre} color="#8b5cf6" size="sm" />}
          {item.decade && <Badge label={item.decade} color="#06b6d4" size="sm" />}
          {item.maxPrice && <Badge label={`Max $${item.maxPrice}`} color="#22c55e" size="sm" />}
          {item.minCondition && <Badge label={`${item.minCondition}+`} color="#f59e0b" size="sm" />}
        </div>

        {/* Improvement #20: Price tracking history */}
        {item.priceHistory && item.priceHistory.length >= 2 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[9px] text-gs-dim">Price trend:</span>
            <PriceHistoryChart priceHistory={item.priceHistory} />
          </div>
        )}

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

          {/* Improvement #25: Notification preferences */}
          <div className="relative">
            <button
              onClick={() => setShowNotifPrefs(!showNotifPrefs)}
              className="text-[10px] px-2 py-1 rounded-md border border-gs-border bg-transparent text-gs-dim hover:text-gs-muted cursor-pointer transition-colors"
            >
              Notifs
            </button>
            {showNotifPrefs && (
              <div className="absolute bottom-full left-0 mb-1 bg-gs-card border border-gs-border rounded-lg shadow-lg shadow-black/30 p-2 z-20 w-44">
                <p className="text-[9px] text-gs-dim font-bold m-0 mb-1.5 uppercase tracking-wider">Notify me about:</p>
                {NOTIFICATION_OPTIONS.map(opt => {
                  const enabled = (item.notificationPrefs || ['price_drop', 'new_listing']).includes(opt.key);
                  return (
                    <label key={opt.key} className="flex items-center gap-2 py-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => {
                          const current = item.notificationPrefs || ['price_drop', 'new_listing'];
                          const updated = enabled ? current.filter(k => k !== opt.key) : [...current, opt.key];
                          onUpdateNotificationPrefs?.(item.id, updated);
                        }}
                        className="w-3 h-3 accent-gs-accent cursor-pointer"
                      />
                      <span className="text-[10px] text-gs-muted">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

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

function AddWishlistForm({ onAdd, onClose, categories }) {
  const [form, setForm] = useState({
    album: '', artist: '', genre: '', decade: '',
    priority: 'medium', maxPrice: '', minCondition: '', notes: '',
    category: '',
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
      notificationPrefs: ['price_drop', 'new_listing'],
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
        {/* Improvement #21: Category selector */}
        {categories && categories.length > 0 && (
          <FormSelect
            label="Category"
            value={form.category}
            onChange={e => updateField('category', e.target.value)}
            options={[{ value: '', label: 'None' }, ...categories.map(c => ({ value: c.id.toString(), label: c.name }))]}
          />
        )}
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
        notificationPrefs: ['price_drop', 'new_listing'],
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

// ── Improvement #19: Share Wishlist with Specific Users ───────────────────

function ShareWithUsersPanel({ onShare, onClose, friends }) {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [shareMessage, setShareMessage] = useState('');

  const toggleUser = (user) => {
    setSelectedUsers(prev =>
      prev.includes(user) ? prev.filter(u => u !== user) : [...prev, user]
    );
  };

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 space-y-3">
      <h3 className="text-[13px] font-bold text-gs-text m-0">Share Wishlist</h3>
      <p className="text-[11px] text-gs-dim m-0">Select users to share your wishlist with:</p>
      <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto">
        {(friends || []).map(friend => (
          <button
            key={friend}
            onClick={() => toggleUser(friend)}
            className={`text-[11px] px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
              selectedUsers.includes(friend)
                ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent'
                : 'bg-transparent border-gs-border text-gs-dim hover:text-gs-muted'
            }`}
          >
            {friend}
          </button>
        ))}
        {(!friends || friends.length === 0) && (
          <p className="text-[11px] text-gs-faint m-0">No friends to share with yet</p>
        )}
      </div>
      <textarea
        value={shareMessage}
        onChange={e => setShareMessage(e.target.value)}
        placeholder="Add a message (optional)..."
        rows={2}
        className="w-full bg-gs-surface border border-gs-border rounded-lg py-2 px-3 text-[12px] text-gs-text font-sans outline-none resize-none placeholder:text-gs-faint focus:border-gs-accent/30"
      />
      <div className="flex items-center gap-2 justify-end">
        <button onClick={onClose} className="gs-btn-secondary px-3.5 py-2 text-[12px] rounded-lg">Cancel</button>
        <button
          onClick={() => { onShare?.(selectedUsers, shareMessage); onClose?.(); }}
          disabled={selectedUsers.length === 0}
          className="gs-btn-gradient px-3.5 py-2 text-[12px] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Share with {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

// ── Improvement #21: Category/Folder Manager ─────────────────────────────

function CategoryManager({ categories, onAddCategory, onRemoveCategory, onClose }) {
  const [newName, setNewName] = useState('');

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-gs-text m-0">Categories / Folders</h3>
        <button onClick={onClose} className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer">Close</button>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New category name..."
          className="flex-1 bg-gs-surface border border-gs-border rounded-lg text-[11px] text-gs-text px-2.5 py-1.5 outline-none font-sans focus:border-gs-accent/30"
        />
        <button
          onClick={() => {
            if (newName.trim()) {
              onAddCategory?.({ id: Date.now(), name: newName.trim() });
              setNewName('');
            }
          }}
          className="gs-btn-gradient px-2.5 py-1.5 text-[10px] rounded-lg"
        >
          Add
        </button>
      </div>
      <div className="space-y-1.5">
        {(!categories || categories.length === 0) ? (
          <p className="text-[11px] text-gs-faint text-center py-2">No categories yet</p>
        ) : (
          categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-gs-surface">
              <span className="text-[11px] text-gs-text">{cat.name}</span>
              <button
                onClick={() => onRemoveCategory?.(cat.id)}
                className="text-[9px] text-gs-faint hover:text-[#ef4444] bg-transparent border-none cursor-pointer transition-colors"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Improvement #23: Wishlist Comparison with Friends ────────────────────

function FriendComparisonPanel({ wishlistItems, friendWishlists, onClose }) {
  const overlaps = useMemo(() => {
    if (!friendWishlists || friendWishlists.length === 0) return [];
    const myAlbums = new Set(wishlistItems.map(i => `${i.artist}-${i.album}`.toLowerCase()));
    return friendWishlists.map(fw => {
      const friendAlbums = (fw.items || []).map(i => `${i.artist}-${i.album}`.toLowerCase());
      const shared = friendAlbums.filter(a => myAlbums.has(a));
      return { friend: fw.username, total: fw.items?.length || 0, shared: shared.length };
    });
  }, [wishlistItems, friendWishlists]);

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-gs-text m-0">Wishlist Comparison</h3>
        <button onClick={onClose} className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer">Close</button>
      </div>
      {overlaps.length === 0 ? (
        <p className="text-[11px] text-gs-faint text-center py-3">No friend wishlists to compare</p>
      ) : (
        <div className="space-y-2">
          {overlaps.map(o => (
            <div key={o.friend} className="flex items-center justify-between gap-3 px-2 py-2 rounded-lg bg-gs-surface">
              <div>
                <span className="text-[12px] text-gs-text font-medium">{o.friend}</span>
                <span className="text-[10px] text-gs-dim ml-2">{o.total} items</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-gs-accent font-bold">{o.shared} shared</span>
                <span className="text-[9px] text-gs-faint block">items in common</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Improvement #24: Wishlist Analytics (Most Wanted Genres) ─────────────

function WishlistAnalytics({ wishlistItems }) {
  const genreStats = useMemo(() => {
    const map = {};
    wishlistItems.forEach(item => {
      if (item.genre) map[item.genre] = (map[item.genre] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([genre, count]) => ({ genre, count }));
  }, [wishlistItems]);

  const decadeStats = useMemo(() => {
    const map = {};
    wishlistItems.forEach(item => {
      if (item.decade) map[item.decade] = (map[item.decade] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([decade, count]) => ({ decade, count }));
  }, [wishlistItems]);

  const priorityStats = useMemo(() => {
    const map = { high: 0, medium: 0, low: 0 };
    wishlistItems.forEach(item => {
      if (item.priority) map[item.priority]++;
    });
    return map;
  }, [wishlistItems]);

  const avgMaxPrice = useMemo(() => {
    const priced = wishlistItems.filter(i => i.maxPrice);
    return priced.length > 0
      ? Math.round(priced.reduce((s, i) => s + i.maxPrice, 0) / priced.length)
      : 0;
  }, [wishlistItems]);

  if (wishlistItems.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4">
      <h3 className="text-[13px] font-bold text-gs-text m-0 mb-3">Wishlist Analytics</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="text-center">
          <p className="text-[10px] text-gs-dim m-0">Total Items</p>
          <p className="text-[16px] font-bold text-gs-text m-0">{wishlistItems.length}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gs-dim m-0">Avg Max Price</p>
          <p className="text-[16px] font-bold text-[#22c55e] m-0">${avgMaxPrice}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gs-dim m-0">High Priority</p>
          <p className="text-[16px] font-bold text-[#ef4444] m-0">{priorityStats.high}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gs-dim m-0">Genres</p>
          <p className="text-[16px] font-bold text-[#8b5cf6] m-0">{genreStats.length}</p>
        </div>
      </div>
      {genreStats.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] text-gs-dim m-0 mb-1.5 font-bold uppercase tracking-wider">Most Wanted Genres</p>
          <div className="space-y-1">
            {genreStats.slice(0, 5).map(g => (
              <div key={g.genre} className="flex items-center gap-2">
                <span className="text-[11px] text-gs-text w-24 truncate">{g.genre}</span>
                <div className="flex-1 h-1.5 rounded-full bg-gs-border">
                  <div
                    className="h-full rounded-full bg-[#8b5cf6]"
                    style={{ width: `${(g.count / (genreStats[0]?.count || 1)) * 100}%`, opacity: 0.7 }}
                  />
                </div>
                <span className="text-[10px] text-gs-dim font-mono w-6 text-right">{g.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {decadeStats.length > 0 && (
        <div>
          <p className="text-[10px] text-gs-dim m-0 mb-1.5 font-bold uppercase tracking-wider">Wanted Decades</p>
          <div className="flex flex-wrap gap-1.5">
            {decadeStats.map(d => (
              <span key={d.decade} className="text-[10px] px-2 py-0.5 rounded-full bg-[#06b6d4]/10 text-[#06b6d4] font-medium">
                {d.decade} ({d.count})
              </span>
            ))}
          </div>
        </div>
      )}
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
  onShareWithUsers,
  onAutoRemoveOnPurchase,
  onUpdateNotificationPrefs,
  onAddCategory,
  onRemoveCategory,
  categories = [],
  friends = [],
  friendWishlists = [],
  purchasedIds = [],
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('dateDesc');
  const [filterGenre, setFilterGenre] = useState('All');
  const [filterDecade, setFilterDecade] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // Improvement #19: Share with specific users panel
  const [showSharePanel, setShowSharePanel] = useState(false);
  // Improvement #21: Category manager
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [filterCategory, setFilterCategory] = useState('All');
  // Improvement #23: Friend comparison
  const [showComparison, setShowComparison] = useState(false);
  // Improvement #24: Analytics toggle
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Improvement #22: Auto-remove purchased items
  const effectiveItems = useMemo(() => {
    if (!purchasedIds || purchasedIds.length === 0) return wishlistItems;
    const purchased = wishlistItems.filter(item => purchasedIds.includes(item.id));
    if (purchased.length > 0 && onAutoRemoveOnPurchase) {
      // Notify parent about purchased items that should be removed
      purchased.forEach(item => onAutoRemoveOnPurchase(item.id));
    }
    return wishlistItems.filter(item => !purchasedIds.includes(item.id));
  }, [wishlistItems, purchasedIds, onAutoRemoveOnPurchase]);

  // Compute matching listings for each wishlist item
  const matchingCounts = useMemo(() => {
    const counts = {};
    effectiveItems.forEach(item => {
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
  }, [effectiveItems, records]);

  // Build category lookup
  const categoryMap = useMemo(() => {
    const map = {};
    (categories || []).forEach(c => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = effectiveItems;
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
    // Improvement #21: Category filter
    if (filterCategory !== 'All') list = list.filter(item => String(item.category) === filterCategory);
    return sortItems(list, sortKey);
  }, [effectiveItems, search, filterGenre, filterDecade, filterPriority, filterCategory, sortKey]);

  // Stats
  const alertCount = effectiveItems.filter(i => i.alertEnabled).length;
  const totalMatches = Object.values(matchingCounts).reduce((s, c) => s + c, 0);
  const activeGenres = useMemo(() => [...new Set(effectiveItems.map(i => i.genre).filter(Boolean))], [effectiveItems]);
  const activeDecades = useMemo(() => [...new Set(effectiveItems.map(i => i.decade).filter(Boolean))], [effectiveItems]);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-gs-text m-0">Wishlist</h2>
          <p className="text-[12px] text-gs-dim mt-0.5 mb-0">
            {effectiveItems.length} item{effectiveItems.length !== 1 ? 's' : ''}
            {alertCount > 0 && <span className="text-gs-accent ml-1.5">{alertCount} alert{alertCount !== 1 ? 's' : ''} active</span>}
            {totalMatches > 0 && <span className="text-[#22c55e] ml-1.5">{totalMatches} match{totalMatches !== 1 ? 'es' : ''} found</span>}
            {/* Improvement #22: Show auto-removed count */}
            {purchasedIds && purchasedIds.length > 0 && (
              <span className="text-[#8b5cf6] ml-1.5">{purchasedIds.length} purchased (auto-removed)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setShowAddForm(true); setShowImport(false); setShowSharePanel(false); setShowCategoryManager(false); setShowComparison(false); }}
            className="gs-btn-gradient px-3.5 py-2 text-[12px] rounded-lg"
          >
            + Add Item
          </button>
          <button
            onClick={() => { setShowImport(true); setShowAddForm(false); setShowSharePanel(false); setShowCategoryManager(false); setShowComparison(false); }}
            className="gs-btn-secondary px-3.5 py-2 text-[12px] rounded-lg"
          >
            Import Discogs
          </button>
          {/* Improvement #21: Category manager button */}
          <button
            onClick={() => { setShowCategoryManager(!showCategoryManager); setShowAddForm(false); setShowImport(false); setShowSharePanel(false); setShowComparison(false); }}
            className="gs-btn-secondary px-3.5 py-2 text-[12px] rounded-lg"
          >
            Categories
          </button>
          {/* Improvement #19: Share with specific users */}
          <button
            onClick={() => { setShowSharePanel(!showSharePanel); setShowAddForm(false); setShowImport(false); setShowCategoryManager(false); setShowComparison(false); }}
            className="gs-btn-secondary px-3.5 py-2 text-[12px] rounded-lg"
            title="Share wishlist with specific users"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
            </svg>
            Share
          </button>
          {/* Improvement #23: Friend comparison */}
          <button
            onClick={() => { setShowComparison(!showComparison); setShowAddForm(false); setShowImport(false); setShowSharePanel(false); setShowCategoryManager(false); }}
            className="gs-btn-secondary px-3.5 py-2 text-[12px] rounded-lg"
          >
            Compare
          </button>
          {/* Improvement #24: Analytics toggle */}
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`px-3.5 py-2 text-[12px] rounded-lg border cursor-pointer transition-all duration-150 ${
              showAnalytics
                ? 'bg-[#8b5cf6]/15 border-[#8b5cf6]/40 text-[#8b5cf6]'
                : 'bg-transparent border-gs-border text-gs-dim hover:border-gs-border-hover hover:text-gs-muted'
            }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Add form / Import / Share / Categories / Comparison panels */}
      {showAddForm && (
        <AddWishlistForm onAdd={onAddItem} onClose={() => setShowAddForm(false)} categories={categories} />
      )}
      {showImport && (
        <DiscogsImport onImport={onImportItems} onClose={() => setShowImport(false)} />
      )}
      {/* Improvement #19 */}
      {showSharePanel && (
        <ShareWithUsersPanel onShare={onShareWithUsers} onClose={() => setShowSharePanel(false)} friends={friends} />
      )}
      {/* Improvement #21 */}
      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          onAddCategory={onAddCategory}
          onRemoveCategory={onRemoveCategory}
          onClose={() => setShowCategoryManager(false)}
        />
      )}
      {/* Improvement #23 */}
      {showComparison && (
        <FriendComparisonPanel
          wishlistItems={effectiveItems}
          friendWishlists={friendWishlists}
          onClose={() => setShowComparison(false)}
        />
      )}
      {/* Improvement #24 */}
      {showAnalytics && (
        <WishlistAnalytics wishlistItems={effectiveItems} />
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

        {/* Improvement #21: Category filter */}
        {categories.length > 0 && (
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="bg-gs-card border border-gs-border rounded-lg text-[11px] text-gs-muted px-2.5 py-2 outline-none cursor-pointer font-sans focus:border-gs-accent/30"
          >
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
          </select>
        )}

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
          text={search || filterGenre !== 'All' || filterDecade !== 'All' || filterPriority !== 'All' || filterCategory !== 'All'
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
              onUpdateNotificationPrefs={onUpdateNotificationPrefs}
              categoryName={item.category ? categoryMap[item.category] : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
