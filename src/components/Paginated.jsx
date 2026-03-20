// Renders a 2-column grid of Card components with "Load more" pagination.
// Shows 24 records per page; each click appends another 24.
// Used by ExploreScreen and CollectionScreen.
// handlers is the cardHandlers object spread from App.js (onLike, onSave, onComment, onBuy, onDetail, onViewUser).
import { useState } from 'react';
import Card from './Card';

const PAGE_SIZE = 24;

export default function Paginated({ records, handlers }) {
  const [page, setPage] = useState(1);
  const visible = records.slice(0, page * PAGE_SIZE);
  const hasMore = page < Math.ceil(records.length / PAGE_SIZE);

  return (
    <div>
      <div className="gs-card-grid grid grid-cols-2 gap-3.5">
        {visible.map(r => <Card key={r.id} r={r} {...handlers} />)}
      </div>
      {hasMore && (
        <div className="text-center mt-6">
          <button
            onClick={() => setPage(p => p + 1)}
            aria-label={`Load more, ${records.length - visible.length} remaining`}
            className="gs-btn-secondary px-7 py-2.5 text-[13px]"
          >
            Load more · {records.length - visible.length} remaining
          </button>
        </div>
      )}
      {!hasMore && records.length > PAGE_SIZE && (
        <div className="text-center mt-5 text-xs text-gs-faint">
          All {records.length} records shown
        </div>
      )}
    </div>
  );
}
