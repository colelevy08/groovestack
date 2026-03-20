// Data sync indicator — shows a subtle spinner/checkmark when data is being saved to the server.
// Usage: <DataSyncIndicator syncing={true} />
export default function DataSyncIndicator({ syncing }) {
  if (!syncing) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[1500] flex items-center gap-2 bg-gs-card border border-gs-border rounded-lg px-3 py-2 shadow-lg animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <svg className="w-3.5 h-3.5 text-gs-accent animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
      <span className="text-[11px] text-gs-muted font-medium">Saving...</span>
    </div>
  );
}
