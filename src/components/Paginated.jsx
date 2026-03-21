// Renders a grid of Card components with pagination controls.
// Shows configurable records per page with page indicators, jump-to-page, and grid column selector.
// Used by ExploreScreen and CollectionScreen.
// handlers is the cardHandlers object spread from App.js (onLike, onSave, onComment, onBuy, onDetail, onViewUser).
// Includes: #11 Virtual scrolling, #12 Card size toggle, #13 List view, #14 Sort direction arrows,
// #15 Saved sort preferences, #16 Filter result count badge, #17 Bulk action toolbar, #18 Progressive image loading.
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Card, { CardSkeleton } from './Card';

const PAGE_SIZE_OPTIONS = [12, 24, 48];
const COLUMN_OPTIONS = [2, 3, 4];
const CARD_SIZE_OPTIONS = ['compact', 'normal', 'expanded']; // #12
const PAGE_SIZE_STORAGE_KEY = 'gs-page-size';
const COLUMNS_STORAGE_KEY = 'gs-columns';
const CARD_SIZE_STORAGE_KEY = 'gs-card-size'; // #12
const SORT_PREF_STORAGE_KEY = 'gs-sort-pref'; // #15
const VIEW_TYPE_STORAGE_KEY = 'gs-view-type'; // #13
const VIRTUAL_SCROLL_OVERSCAN = 5; // #11
const VIRTUAL_ITEM_HEIGHT = 220; // #11 approximate card height

// #13 — List view row component
function ListRow({ r, handlers }) {
  return (
    <div
      className="flex items-center gap-4 px-4 py-2.5 bg-gs-surface border border-gs-border rounded-lg hover:border-gs-border-hover transition-colors cursor-pointer"
      onClick={() => handlers.onDetail(r)}
    >
      <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] shrink-0 overflow-hidden flex items-center justify-center text-[10px] text-gs-faint font-bold" style={{ background: `linear-gradient(135deg, ${r.accent}22, transparent)` }}>
        {r.album?.slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gs-text truncate">{r.album}</div>
        <div className="text-[11px] text-gs-muted truncate">{r.artist} · {r.year}</div>
      </div>
      <div className="text-[11px] text-gs-dim font-mono shrink-0">{r.condition}</div>
      <div className="text-[11px] text-gs-dim font-mono shrink-0">{r.rating}/5</div>
      {r.forSale && <div className="text-sm font-bold text-gs-text shrink-0">${r.price}</div>}
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={e => { e.stopPropagation(); handlers.onLike(r.id); }} className="bg-transparent border-none text-gs-dim text-xs cursor-pointer hover:text-gs-muted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill={r.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <span className="text-[10px] text-gs-dim">{r.likes}</span>
        <button onClick={e => { e.stopPropagation(); handlers.onSave(r.id); }} className="bg-transparent border-none text-gs-dim text-xs cursor-pointer hover:text-gs-muted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill={r.saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>
    </div>
  );
}

// #18 — Progressive image loading placeholder (used internally)
function ProgressiveImg({ src, alt, className }) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.src = src;
  }, [src]);

  return (
    <div className={`relative ${className || ''}`}>
      {!loaded && <div className="absolute inset-0 bg-[#1a1a1a] animate-pulse rounded-xl" />}
      {src && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={`w-full h-full object-cover rounded-xl transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

// NEW: Empty state illustration
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-24 h-24 mb-6 relative">
        <svg viewBox="0 0 96 96" fill="none" className="w-full h-full">
          <circle cx="48" cy="48" r="40" stroke="#222" strokeWidth="2" />
          <circle cx="48" cy="48" r="28" stroke="#1a1a1a" strokeWidth="1" />
          <circle cx="48" cy="48" r="16" stroke="#222" strokeWidth="1" />
          <circle cx="48" cy="48" r="6" fill="#222" />
          <path d="M48 8 C52 8 56 12 56 16" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-gs-muted text-sm font-semibold mb-1">No records found</div>
      <div className="text-gs-faint text-xs max-w-[240px]">
        Try adjusting your filters or search to discover more vinyl in the marketplace.
      </div>
    </div>
  );
}

export default function Paginated({ records, handlers, loading, sortField, sortDirection, totalUnfiltered, onBulkAction }) {
  // All hooks declared before any conditional returns
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    try {
      const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
      const parsed = parseInt(stored, 10);
      return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : 24;
    } catch {
      return 24;
    }
  });
  const [columns, setColumns] = useState(() => {
    try {
      const stored = localStorage.getItem(COLUMNS_STORAGE_KEY);
      const parsed = parseInt(stored, 10);
      return COLUMN_OPTIONS.includes(parsed) ? parsed : 2;
    } catch {
      return 2;
    }
  });
  // #12 — Card size toggle
  const [cardSize, setCardSize] = useState(() => {
    try {
      const stored = localStorage.getItem(CARD_SIZE_STORAGE_KEY);
      return CARD_SIZE_OPTIONS.includes(stored) ? stored : 'normal';
    } catch {
      return 'normal';
    }
  });
  // #13 — View type: grid, list, or loadmore
  const [viewType, setViewType] = useState(() => {
    try {
      const stored = localStorage.getItem(VIEW_TYPE_STORAGE_KEY);
      return ['grid', 'list'].includes(stored) ? stored : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [jumpInput, setJumpInput] = useState('');
  const [showJump, setShowJump] = useState(false);
  const [viewMode, setViewMode] = useState('paginated'); // 'paginated' or 'loadmore'
  const [loadMoreCount, setLoadMoreCount] = useState(24);
  const [pageTransition, setPageTransition] = useState(false);
  // #17 — Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkBar, setShowBulkBar] = useState(false);
  // #11 — Virtual scroll state
  const [virtualScrollTop, setVirtualScrollTop] = useState(0);
  const topRef = useRef(null);
  const virtualContainerRef = useRef(null);

  const totalPages = Math.ceil(records.length / pageSize);
  const start = (page - 1) * pageSize;
  const visible = viewMode === 'paginated'
    ? records.slice(start, start + pageSize)
    : records.slice(0, loadMoreCount);

  // NEW: Save pageSize to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
    } catch { /* noop */ }
  }, [pageSize]);

  // NEW: Save columns to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(COLUMNS_STORAGE_KEY, String(columns));
    } catch { /* noop */ }
  }, [columns]);

  // #12 — Save card size to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CARD_SIZE_STORAGE_KEY, cardSize);
    } catch { /* noop */ }
  }, [cardSize]);

  // #13 — Save view type to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_TYPE_STORAGE_KEY, viewType);
    } catch { /* noop */ }
  }, [viewType]);

  // #15 — Save sort preferences
  useEffect(() => {
    if (sortField) {
      try {
        localStorage.setItem(SORT_PREF_STORAGE_KEY, JSON.stringify({ field: sortField, direction: sortDirection }));
      } catch { /* noop */ }
    }
  }, [sortField, sortDirection]);

  // #17 — Show/hide bulk action bar
  useEffect(() => {
    setShowBulkBar(selectedIds.size > 0);
  }, [selectedIds]);

  // #11 — Virtual scroll handler
  useEffect(() => {
    const container = virtualContainerRef.current;
    if (!container || viewMode !== 'loadmore' || records.length < 200) return;
    const handleScroll = () => {
      setVirtualScrollTop(container.scrollTop);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [viewMode, records.length]);

  // #11 — Virtual scroll computed values
  const useVirtualScroll = viewMode === 'loadmore' && records.length >= 200;
  const virtualVisibleCount = useVirtualScroll ? Math.ceil(600 / VIRTUAL_ITEM_HEIGHT) + VIRTUAL_SCROLL_OVERSCAN * 2 : 0;
  const virtualStartIdx = useVirtualScroll ? Math.max(0, Math.floor(virtualScrollTop / VIRTUAL_ITEM_HEIGHT) - VIRTUAL_SCROLL_OVERSCAN) : 0;
  const virtualEndIdx = useVirtualScroll ? Math.min(records.length, virtualStartIdx + virtualVisibleCount) : 0;
  const virtualTotalHeight = useVirtualScroll ? records.length * VIRTUAL_ITEM_HEIGHT : 0;

  // #17 — Bulk action handlers
  const handleBulkSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkSelectAll = useCallback(() => {
    if (selectedIds.size === visible.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visible.map(r => r.id)));
    }
  }, [visible, selectedIds]);

  const handleBulkAction = useCallback((action) => {
    onBulkAction?.(action, Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, onBulkAction]);

  // #16 — Filter result count
  const filterCountBadge = useMemo(() => {
    if (!totalUnfiltered || totalUnfiltered === records.length) return null;
    return { shown: records.length, total: totalUnfiltered };
  }, [records.length, totalUnfiltered]);

  // NEW: URL sync for current page
  useEffect(() => {
    if (viewMode !== 'paginated') return;
    const url = new URL(window.location.href);
    if (page > 1) {
      url.searchParams.set('page', String(page));
    } else {
      url.searchParams.delete('page');
    }
    window.history.replaceState({}, '', url.toString());
  }, [page, viewMode]);

  // Read initial page from URL on mount
  useEffect(() => {
    const url = new URL(window.location.href);
    const urlPage = parseInt(url.searchParams.get('page'), 10);
    if (urlPage >= 1 && urlPage <= totalPages) {
      setPage(urlPage);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // NEW: Animated page transitions
  const changePage = useCallback((newPage) => {
    const clamped = Math.max(1, Math.min(newPage, totalPages));
    if (clamped === page) return;
    setPageTransition(true);
    setTimeout(() => {
      setPage(clamped);
      setPageTransition(false);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [totalPages, page]);

  // Reset page when pageSize changes
  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  // NEW: Keyboard navigation (left/right arrows for pagination)
  useEffect(() => {
    if (viewMode !== 'paginated') return;
    const handleKeyDown = (e) => {
      // Don't capture when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' && page > 1) {
        e.preventDefault();
        changePage(page - 1);
      } else if (e.key === 'ArrowRight' && page < totalPages) {
        e.preventDefault();
        changePage(page + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [page, totalPages, changePage, viewMode]);

  // Jump to page handler
  const handleJump = (e) => {
    e.preventDefault();
    const num = parseInt(jumpInput, 10);
    if (num >= 1 && num <= totalPages) {
      changePage(num);
      setShowJump(false);
      setJumpInput('');
    }
  };

  // NEW: Load more handler
  const handleLoadMore = () => {
    setLoadMoreCount(prev => Math.min(prev + pageSize, records.length));
  };

  const hasMore = loadMoreCount < records.length;

  // Grid column class — NEW: responsive auto-sizing
  const gridColsClass = useMemo(() => {
    const base = {
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    };
    return base[columns] || 'grid-cols-1 sm:grid-cols-2';
  }, [columns]);

  // #14 — Sort direction indicator with animated arrows
  const sortLabel = sortField ? (
    <span className="flex items-center gap-1 text-[10px] text-gs-accent font-mono bg-gs-accent/5 border border-gs-accent/15 rounded-md px-1.5 py-0.5">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform duration-200" style={{ transform: sortDirection === 'asc' ? 'rotate(0deg)' : 'rotate(180deg)' }}>
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      {sortField}
      <span className="text-[8px] text-gs-faint ml-0.5">({sortDirection === 'asc' ? 'A-Z' : 'Z-A'})</span>
    </span>
  ) : null;

  // Loading state
  if (loading) {
    return (
      <div ref={topRef}>
        <div className="flex items-center justify-between mb-3.5">
          <div className="h-4 w-32 bg-[#1a1a1a] rounded animate-pulse" />
          <div className="h-7 w-48 bg-[#1a1a1a] rounded animate-pulse" />
        </div>
        <div className={`gs-card-grid grid ${gridColsClass} gap-3.5`}>
          {Array.from({ length: pageSize > 12 ? 12 : pageSize }, (_, i) => (
            <CardSkeleton key={i} size={cardSize} />
          ))}
        </div>
      </div>
    );
  }

  // NEW: Empty state
  if (records.length === 0) {
    return (
      <div ref={topRef}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div ref={topRef}>
      {/* Top controls bar */}
      <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
        {/* Page indicator with sort label */}
        <div className="text-xs text-gs-muted font-mono flex items-center gap-2">
          {viewMode === 'paginated' ? (
            <>
              Page {page} of {totalPages}
              <span className="text-gs-faint">({records.length} records)</span>
            </>
          ) : (
            <>
              Showing {Math.min(loadMoreCount, records.length)} of {records.length}
            </>
          )}
          {/* NEW: Sort indicator */}
          {sortLabel}
          {/* #16 — Filter result count badge */}
          {filterCountBadge && (
            <span className="text-[10px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full px-2 py-0.5">
              {filterCountBadge.shown}/{filterCountBadge.total} filtered
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* #13 — Grid/List view toggle */}
          <div className="flex items-center gap-1 bg-[#111] border border-gs-border rounded-lg p-0.5">
            <button
              onClick={() => setViewType('grid')}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer border-none transition-colors ${
                viewType === 'grid' ? 'bg-gs-accent/10 text-gs-accent' : 'bg-transparent text-gs-dim hover:text-gs-muted'
              }`}
              aria-label="Grid view"
              title="Grid view"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
            <button
              onClick={() => setViewType('list')}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer border-none transition-colors ${
                viewType === 'list' ? 'bg-gs-accent/10 text-gs-accent' : 'bg-transparent text-gs-dim hover:text-gs-muted'
              }`}
              aria-label="List view"
              title="List view with details"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>

          {/* #12 — Card size toggle */}
          {viewType === 'grid' && (
            <div className="flex items-center gap-1 bg-[#111] border border-gs-border rounded-lg p-0.5">
              {CARD_SIZE_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setCardSize(s)}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer border-none transition-colors capitalize ${
                    cardSize === s ? 'bg-gs-accent/10 text-gs-accent' : 'bg-transparent text-gs-dim hover:text-gs-muted'
                  }`}
                  title={`${s} cards`}
                >
                  {s === 'compact' ? 'S' : s === 'normal' ? 'M' : 'L'}
                </button>
              ))}
            </div>
          )}

          {/* NEW: View mode toggle (paginated vs load more) */}
          <div className="flex items-center gap-1 bg-[#111] border border-gs-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('paginated')}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer border-none transition-colors ${
                viewMode === 'paginated'
                  ? 'bg-gs-accent/10 text-gs-accent'
                  : 'bg-transparent text-gs-dim hover:text-gs-muted'
              }`}
              aria-label="Paginated view"
              title="Paginated view"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="15" x2="21" y2="15" />
              </svg>
            </button>
            <button
              onClick={() => { setViewMode('loadmore'); setLoadMoreCount(pageSize); }}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer border-none transition-colors ${
                viewMode === 'loadmore'
                  ? 'bg-gs-accent/10 text-gs-accent'
                  : 'bg-transparent text-gs-dim hover:text-gs-muted'
              }`}
              aria-label="Load more view"
              title="Infinite scroll / Load more"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </button>
          </div>

          {/* Grid column count selector */}
          <div className="flex items-center gap-1 bg-[#111] border border-gs-border rounded-lg p-0.5">
            {COLUMN_OPTIONS.map(c => (
              <button
                key={c}
                onClick={() => setColumns(c)}
                className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer border-none transition-colors ${
                  columns === c
                    ? 'bg-gs-accent/10 text-gs-accent'
                    : 'bg-transparent text-gs-dim hover:text-gs-muted'
                }`}
                aria-label={`${c} columns`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {c === 2 && <><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></>}
                  {c === 3 && <><rect x="2" y="3" width="5" height="18" rx="1"/><rect x="9.5" y="3" width="5" height="18" rx="1"/><rect x="17" y="3" width="5" height="18" rx="1"/></>}
                  {c === 4 && <><rect x="1" y="3" width="4" height="18" rx="1"/><rect x="7" y="3" width="4" height="18" rx="1"/><rect x="13" y="3" width="4" height="18" rx="1"/><rect x="19" y="3" width="4" height="18" rx="1"/></>}
                </svg>
              </button>
            ))}
          </div>

          {/* Items per page selector */}
          <div className="flex items-center gap-1 bg-[#111] border border-gs-border rounded-lg p-0.5">
            {PAGE_SIZE_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setPageSize(s)}
                className={`px-2 py-1 rounded-md text-[10px] font-semibold cursor-pointer border-none transition-colors ${
                  pageSize === s
                    ? 'bg-gs-accent/10 text-gs-accent'
                    : 'bg-transparent text-gs-dim hover:text-gs-muted'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* NEW: Keyboard navigation hint */}
      {viewMode === 'paginated' && totalPages > 1 && (
        <div className="text-[9px] text-gs-faint mb-2 hidden md:block">
          Use left/right arrow keys to navigate pages
        </div>
      )}

      {/* #17 — Bulk action toolbar */}
      {showBulkBar && (
        <div className="flex items-center gap-3 mb-3 p-2.5 bg-gs-accent/5 border border-gs-accent/20 rounded-lg animate-fade-in">
          <span className="text-[11px] font-semibold text-gs-accent">{selectedIds.size} selected</span>
          <button onClick={handleBulkSelectAll} className="text-[10px] text-gs-muted bg-transparent border border-gs-border rounded px-2 py-1 cursor-pointer hover:text-gs-text transition-colors">
            {selectedIds.size === visible.length ? 'Deselect All' : 'Select All'}
          </button>
          <button onClick={() => handleBulkAction('like')} className="text-[10px] text-gs-muted bg-transparent border border-gs-border rounded px-2 py-1 cursor-pointer hover:text-gs-text transition-colors">
            Like All
          </button>
          <button onClick={() => handleBulkAction('save')} className="text-[10px] text-gs-muted bg-transparent border border-gs-border rounded px-2 py-1 cursor-pointer hover:text-gs-text transition-colors">
            Save All
          </button>
          <button onClick={() => handleBulkAction('addToPlaylist')} className="text-[10px] text-gs-muted bg-transparent border border-gs-border rounded px-2 py-1 cursor-pointer hover:text-gs-text transition-colors">
            Add to Playlist
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-[10px] text-gs-dim bg-transparent border-none cursor-pointer hover:text-gs-muted ml-auto">
            Clear
          </button>
        </div>
      )}

      {/* #13 — List view */}
      {viewType === 'list' ? (
        <div className={`flex flex-col gap-2 transition-opacity duration-150 ${pageTransition ? 'opacity-0' : 'opacity-100'}`}>
          {/* List header */}
          <div className="flex items-center gap-4 px-4 py-1.5 text-[10px] text-gs-faint font-mono uppercase tracking-wider">
            <div className="w-10 shrink-0">Art</div>
            <div className="flex-1">Title / Artist</div>
            <div className="shrink-0 w-12">Cond.</div>
            <div className="shrink-0 w-12">Rating</div>
            <div className="shrink-0 w-14">Price</div>
            <div className="shrink-0 w-20">Actions</div>
          </div>
          {visible.map(r => <ListRow key={r.id} r={r} handlers={handlers} />)}
        </div>
      ) : useVirtualScroll ? (
        /* #11 — Virtual scrolling for large lists */
        <div
          ref={virtualContainerRef}
          className="overflow-auto"
          style={{ height: '600px' }}
        >
          <div style={{ height: virtualTotalHeight, position: 'relative' }}>
            <div
              className={`gs-card-grid grid ${gridColsClass} gap-3.5 absolute w-full`}
              style={{ top: virtualStartIdx * VIRTUAL_ITEM_HEIGHT }}
            >
              {records.slice(virtualStartIdx, virtualEndIdx).map(r => (
                <Card key={r.id} r={r} {...handlers} size={cardSize} onCompareToggle={handleBulkSelect} isCompareSelected={selectedIds.has(r.id)} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Card grid with animated page transitions */
        <div
          className={`gs-card-grid grid ${gridColsClass} gap-3.5 transition-opacity duration-150 ${
            pageTransition ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {visible.map(r => <Card key={r.id} r={r} {...handlers} size={cardSize} onCompareToggle={onBulkAction ? handleBulkSelect : undefined} isCompareSelected={selectedIds.has(r.id)} />)}
        </div>
      )}

      {/* NEW: Load more button (alternative to pagination) */}
      {viewMode === 'loadmore' && hasMore && (
        <div className="flex flex-col items-center mt-6 gap-2">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2.5 rounded-lg text-xs font-semibold border border-gs-border bg-[#111] text-gs-muted hover:border-gs-border-hover hover:text-gs-text cursor-pointer transition-colors"
          >
            Load More ({records.length - loadMoreCount} remaining)
          </button>
          <div className="w-48 h-1 bg-[#111] rounded-full overflow-hidden">
            <div
              className="h-full bg-gs-accent/30 rounded-full transition-all duration-300"
              style={{ width: `${(loadMoreCount / records.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Pagination controls (only in paginated mode) */}
      {viewMode === 'paginated' && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          {/* First page */}
          <button
            onClick={() => changePage(1)}
            disabled={page <= 1}
            className={`px-2 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
              page <= 1
                ? 'bg-[#111] border-gs-border text-gs-dim cursor-default opacity-40'
                : 'bg-[#111] border-gs-border text-gs-muted hover:border-gs-border-hover'
            }`}
            aria-label="First page"
          >
            &laquo;
          </button>

          {/* Previous */}
          <button
            onClick={() => changePage(page - 1)}
            disabled={page <= 1}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
              page <= 1
                ? 'bg-[#111] border-gs-border text-gs-dim cursor-default opacity-40'
                : 'bg-[#111] border-gs-border text-gs-muted hover:border-gs-border-hover'
            }`}
          >
            Prev
          </button>

          {/* Page number buttons */}
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum;
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (page <= 4) {
              pageNum = i + 1;
            } else if (page >= totalPages - 3) {
              pageNum = totalPages - 6 + i;
            } else {
              pageNum = page - 3 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => changePage(pageNum)}
                aria-current={page === pageNum ? 'page' : undefined}
                className={`w-8 h-8 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                  page === pageNum
                    ? 'bg-gs-accent/10 border-gs-accent/25 text-gs-accent'
                    : 'bg-[#111] border-gs-border text-gs-dim hover:border-gs-border-hover hover:text-gs-muted'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          {/* Next */}
          <button
            onClick={() => changePage(page + 1)}
            disabled={page >= totalPages}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
              page >= totalPages
                ? 'bg-[#111] border-gs-border text-gs-dim cursor-default opacity-40'
                : 'bg-[#111] border-gs-border text-gs-muted hover:border-gs-border-hover'
            }`}
          >
            Next
          </button>

          {/* Last page */}
          <button
            onClick={() => changePage(totalPages)}
            disabled={page >= totalPages}
            className={`px-2 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
              page >= totalPages
                ? 'bg-[#111] border-gs-border text-gs-dim cursor-default opacity-40'
                : 'bg-[#111] border-gs-border text-gs-muted hover:border-gs-border-hover'
            }`}
            aria-label="Last page"
          >
            &raquo;
          </button>

          {/* Jump to page */}
          <div className="relative ml-2">
            <button
              onClick={() => setShowJump(s => !s)}
              className="px-2.5 py-2 rounded-lg text-[10px] font-semibold border bg-[#111] border-gs-border text-gs-dim hover:text-gs-muted cursor-pointer transition-colors"
            >
              Go to...
            </button>
            {showJump && (
              <form
                onSubmit={handleJump}
                className="absolute bottom-full mb-1 left-0 bg-gs-surface border border-gs-border rounded-lg p-2 shadow-xl z-10 flex gap-1.5 animate-fade-in"
              >
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpInput}
                  onChange={e => setJumpInput(e.target.value)}
                  placeholder={`1-${totalPages}`}
                  className="w-16 bg-[#111] border border-gs-border rounded-md px-2 py-1.5 text-xs text-gs-text outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-md text-xs font-semibold gs-btn-gradient border-none text-white cursor-pointer"
                >
                  Go
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* End indicator */}
      {viewMode === 'paginated' && totalPages <= 1 && records.length > 0 && (
        <div className="text-center mt-5 text-xs text-gs-faint">
          All {records.length} records shown
        </div>
      )}
      {viewMode === 'loadmore' && !hasMore && records.length > 0 && (
        <div className="text-center mt-5 text-xs text-gs-faint">
          All {records.length} records loaded
        </div>
      )}
    </div>
  );
}
