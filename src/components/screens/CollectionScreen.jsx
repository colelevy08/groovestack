// Shows only the current user's own records in a paginated grid.
// Filters the shared records array by r.user === currentUser.
// The "Add Record" button (header and empty state) both open AddRecordModal via onAddRecord.
import Paginated from '../Paginated';
import Empty from '../ui/Empty';

export default function CollectionScreen({ records, currentUser, onAddRecord, ...handlers }) {
  // Filter records down to only those belonging to the logged-in user
  const mine = records.filter(r => r.user === currentUser);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: "#f5f5f5", marginBottom: 2 }}>My Collection</h1>
          <p style={{ fontSize: 12, color: "#555" }}>{mine.length} record{mine.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={onAddRecord} style={{ padding: "9px 18px", background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          + Add Record
        </button>
      </div>
      {mine.length === 0
        ? <Empty icon="💿" text="Your collection is empty — start adding records!" action={onAddRecord} actionLabel="+ Add First Record" />
        : <Paginated records={mine} handlers={handlers} />}
    </div>
  );
}
