// Renders a grid of Card components with pagination controls.
// Shows configurable records per page with page indicators, jump-to-page, and grid column selector.
// Used by ExploreScreen and CollectionScreen.
// handlers is the cardHandlers object spread from App.js (onLike, onSave, onComment, onBuy, onDetail, onViewUser).
import { useState, useRef, useCallback, useEffect } from 'react';
import Card from './Card';

const PAGE_SIZE_OPTIONS = [12, 24, 48];
const COLUMN_OPTIONS = [2, 3, 4];

export default function Paginated({ records, handlers }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [columns, setColumns] = useState(2);
  const [jumpInput, setJumpInput] = useState('');
  const [showJump, setShowJump] = useState(false);
  const topRef = useRef(null);

  const totalPages = Math.ceil(records.length / pageSize);
  const start = (page - 1) * pageSize;
  const visible = records.slice(start, start + pageSize);

  // #14 — Smooth scroll to top on page change
  const changePage = useCallback((newPage) => {
    const clamped = Math.max(1, Math.min(newPage, totalPages));
    setPage(clamped);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [totalPages]);

  // Reset page when pageSize changes
  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  // #12 — Jump to page handler
  const handleJump = (e) => {
    e.preventDefault();
    const num = parseInt(jumpInput, 10);
    if (num >= 1 && num <= totalPages) {
      changePage(num);
      setShowJump(false);
      setJumpInput('');
    }
  };

  // #15 — Grid column class
  const gridColsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns] || 'grid-cols-2';

  return (
    <div ref={topRef}>
      {/* Top controls bar */}
      <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
        {/* #11 — Page indicator */}
        <div className="text-xs text-gs-muted font-mono">
          Page {page} of {totalPages}
          <span className="text-gs-faint ml-2">({records.length} records)</span>
        </div>

        <div className="flex items-center gap-2">
          {/* #15 — Grid column count selector */}
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

          {/* #13 — Items per page selector */}
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

      {/* Card grid with configurable columns */}
      <div className={`gs-card-grid grid ${gridColsClass} gap-3.5`}>
        {visible.map(r => <Card key={r.id} r={r} {...handlers} />)}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
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

          {/* #12 — Jump to page */}
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
      {totalPages <= 1 && records.length > 0 && (
        <div className="text-center mt-5 text-xs text-gs-faint">
          All {records.length} records shown
        </div>
      )}
    </div>
  );
}
