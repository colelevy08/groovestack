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
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-gs-text mb-0.5">My Collection</h1>
          <p className="text-xs text-gs-dim">{mine.length} record{mine.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={onAddRecord} className="gs-btn-gradient px-[18px] py-[9px] text-xs">
          + Add Record
        </button>
      </div>
      {mine.length === 0
        ? <Empty icon="💿" text="Your collection is empty — start adding records!" action={onAddRecord} actionLabel="+ Add First Record" />
        : <Paginated records={mine} handlers={handlers} />}
    </div>
  );
}
