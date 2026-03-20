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
      <div className="gs-card-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {visible.map(r => <Card key={r.id} r={r} {...handlers} />)}
      </div>
      {hasMore && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            onClick={() => setPage(p => p + 1)}
            style={{ padding: "10px 28px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, color: "#aaa", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Load more · {records.length - visible.length} remaining
          </button>
        </div>
      )}
      {!hasMore && records.length > PAGE_SIZE && (
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#444" }}>
          All {records.length} records shown
        </div>
      )}
    </div>
  );
}
