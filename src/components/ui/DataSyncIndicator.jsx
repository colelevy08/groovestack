// Data sync indicator — shows sync status with queue count, timestamp, and manual sync.
// Improvements: sync queue count, last sync timestamp, manual sync button.
import { useState, useEffect, useCallback } from 'react';

function formatTimestamp(ts) {
  if (!ts) return 'Never';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

export default function DataSyncIndicator({ syncing, queueCount = 0, lastSyncTime, onManualSync }) {
  const [displayTime, setDisplayTime] = useState(() => formatTimestamp(lastSyncTime));

  // Update displayed relative time every 30s
  useEffect(() => {
    setDisplayTime(formatTimestamp(lastSyncTime));
    const interval = setInterval(() => {
      setDisplayTime(formatTimestamp(lastSyncTime));
    }, 30000);
    return () => clearInterval(interval);
  }, [lastSyncTime]);

  const handleManualSync = useCallback(() => {
    if (onManualSync && !syncing) {
      onManualSync();
    }
  }, [onManualSync, syncing]);

  // Always show when there are queued items or actively syncing
  const shouldShow = syncing || queueCount > 0 || lastSyncTime;
  if (!shouldShow) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[1500] flex items-center gap-2.5 bg-gs-card border border-gs-border rounded-lg px-3 py-2 shadow-lg animate-fade-in"
      role="status"
      aria-live="polite"
    >
      {syncing ? (
        <svg className="w-3.5 h-3.5 text-gs-accent animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}

      <div className="flex flex-col">
        <span className="text-[11px] text-gs-muted font-medium leading-tight">
          {syncing ? 'Syncing...' : 'Synced'}
          {queueCount > 0 && (
            <span className="ml-1 bg-gs-accent/15 text-gs-accent text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {queueCount} pending
            </span>
          )}
        </span>
        {lastSyncTime && (
          <span className="text-[10px] text-gs-dim leading-tight">
            Last sync: {displayTime}
          </span>
        )}
      </div>

      {onManualSync && (
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="ml-1 p-1 rounded bg-transparent border border-gs-border hover:border-gs-accent text-gs-dim hover:text-gs-accent transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Sync now"
          title="Sync now"
        >
          <svg
            className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
        </button>
      )}
    </div>
  );
}
