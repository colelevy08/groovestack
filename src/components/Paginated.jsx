// Renders a grid of Card components with pagination controls.
// Shows configurable records per page with page indicators, jump-to-page, and grid column selector.
// Used by ExploreScreen and CollectionScreen.
// handlers is the cardHandlers object spread from App.js (onLike, onSave, onComment, onBuy, onDetail, onViewUser).
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Card from './Card';

const PAGE_SIZE_OPTIONS = [12, 24, 48];
const COLUMN_OPTIONS = [2, 3, 4];
const PAGE_SIZE_STORAGE_KEY = 'gs-page-size';
const COLUMNS_STORAGE_KEY = 'gs-columns';

// NEW: Loading skeleton component
function SkeletonCard() {
  return (
    <div className="gs-card animate-pulse">
      <div className="h-0.5 bg-[#1a1a1a]" />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-[#1a1a1a]" />
          <div className="h-3 w-20 bg-[#1a1a1a] rounded" />
        </div>
        <div className="flex gap-3 mb-3">
          <div className="w-[68px] h-[68px] rounded-xl bg-[#1a1a1a] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-[#1a1a1a] rounded" />
            <div className="h-3 w-1/2 bg-[#1a1a1a] rounded" />
            <div className="h-3 w-2/3 bg-[#1a1a1a] rounded" />
          </div>
        </div>
        <div className="flex gap-1.5 mb-2.5">
          <div className="h-5 w-12 bg-[#1a1a1a] rounded-full" />
          <div className="h-5 w-14 bg-[#1a1a1a] rounded-full" />
        </div>
        <div className="border-t border-gs-border pt-2.5 flex justify-between">
          <div className="flex gap-3">
            <div className="h-4 w-8 bg-[#1a1a1a] rounded" />
            <div className="h-4 w-8 bg-[#1a1a1a] rounded" />
          </div>
          <div className="h-4 w-4 bg-[#1a1a1a] rounded" />
        </div>
      </div>
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

export default function Paginated({ records, handlers, loading, sortField, sortDirection }) {
  // NEW: Persist page size and columns to localStorage
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
  const [jumpInput, setJumpInput] = useState('');
  const [showJump, setShowJump] = useState(false);
  const [viewMode, setViewMode] = useState('paginated'); // 'paginated' or 'loadmore'
  const [loadMoreCount, setLoadMoreCount] = useState(24);
  const [pageTransition, setPageTransition] = useState(false);
  const topRef = useRef(null);

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

  // NEW: Sort indicator helper
  const sortLabel = sortField ? (
    <span className="flex items-center gap-1 text-[10px] text-gs-accent font-mono">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {sortDirection === 'asc' ? (
          <path d="M12 19V5M5 12l7-7 7 7" />
        ) : (
          <path d="M12 5v14M19 12l-7 7-7-7" />
        )}
      </svg>
      {sortField}
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
            <SkeletonCard key={i} />
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
        </div>

        <div className="flex items-center gap-2">
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

      {/* Card grid with animated page transitions */}
      <div
        className={`gs-card-grid grid ${gridColsClass} gap-3.5 transition-opacity duration-150 ${
          pageTransition ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {visible.map(r => <Card key={r.id} r={r} {...handlers} />)}
      </div>

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
