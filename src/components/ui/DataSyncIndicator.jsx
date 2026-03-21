// Data sync indicator — shows sync status with queue count, timestamp, and manual sync.
// Improvements: sync queue count, last sync timestamp, manual sync button,
// conflict resolution UI, sync history log, and selective sync toggle.
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

// --- Conflict Resolution UI ---
// Shows when there are data conflicts that need user input to resolve.
export function ConflictResolutionPanel({
  conflicts = [], // Array of { id, field, localValue, remoteValue, timestamp }
  onResolve, // (conflictId, resolution: 'local' | 'remote') => void
  onResolveAll, // (resolution: 'local' | 'remote') => void
}) {
  const [expanded, setExpanded] = useState(false);

  if (conflicts.length === 0) return null;

  return (
    <div className="fixed bottom-16 right-4 z-[1500] bg-gs-card border border-amber-500/30 rounded-lg shadow-xl animate-fade-in max-w-sm w-[320px]">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-transparent border-none cursor-pointer text-left"
      >
        <svg className="w-4 h-4 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="text-[12px] font-bold text-amber-400 flex-1">
          {conflicts.length} Sync Conflict{conflicts.length !== 1 ? 's' : ''}
        </span>
        <svg
          className={`w-3 h-3 text-gs-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gs-border">
          {/* Resolve all buttons */}
          {onResolveAll && conflicts.length > 1 && (
            <div className="flex gap-2 px-3 py-2 border-b border-gs-border">
              <button
                onClick={() => onResolveAll('local')}
                className="flex-1 text-[10px] font-bold px-2 py-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 cursor-pointer hover:bg-sky-500/20 transition-colors"
              >
                Keep All Local
              </button>
              <button
                onClick={() => onResolveAll('remote')}
                className="flex-1 text-[10px] font-bold px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/20 transition-colors"
              >
                Keep All Remote
              </button>
            </div>
          )}

          {/* Individual conflicts */}
          <div className="max-h-[200px] overflow-y-auto">
            {conflicts.map((conflict) => (
              <div key={conflict.id} className="px-3 py-2 border-b border-gs-border last:border-b-0">
                <p className="text-[11px] font-semibold text-gs-text mb-1">{conflict.field}</p>
                <div className="flex gap-2 mb-1.5">
                  <div className="flex-1 text-[10px] text-sky-400 bg-sky-500/5 rounded px-1.5 py-0.5 truncate">
                    Local: {String(conflict.localValue)}
                  </div>
                  <div className="flex-1 text-[10px] text-indigo-400 bg-indigo-500/5 rounded px-1.5 py-0.5 truncate">
                    Remote: {String(conflict.remoteValue)}
                  </div>
                </div>
                {onResolve && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => onResolve(conflict.id, 'local')}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border-none cursor-pointer hover:bg-sky-500/20 transition-colors"
                    >
                      Keep Local
                    </button>
                    <button
                      onClick={() => onResolve(conflict.id, 'remote')}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border-none cursor-pointer hover:bg-indigo-500/20 transition-colors"
                    >
                      Keep Remote
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sync History Log ---
// Shows a log of recent sync events.
export function SyncHistoryLog({ history = [], onClose }) {
  // history: Array of { id, timestamp, action, status, details }

  if (!history || history.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-[12px] text-gs-dim">No sync history yet.</p>
      </div>
    );
  }

  const statusColors = {
    success: 'text-emerald-500',
    error: 'text-red-500',
    warning: 'text-amber-500',
    pending: 'text-sky-500',
  };

  return (
    <div className="max-h-[300px] overflow-y-auto">
      {onClose && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-gs-border sticky top-0 bg-gs-card">
          <span className="text-[12px] font-bold text-gs-text">Sync History</span>
          <button
            onClick={onClose}
            className="w-5 h-5 rounded bg-transparent border-none cursor-pointer text-gs-muted hover:text-gs-text transition-colors flex items-center justify-center"
            aria-label="Close"
          >
            x
          </button>
        </div>
      )}
      {history.map((entry) => (
        <div key={entry.id} className="px-3 py-2 border-b border-gs-border last:border-b-0 flex items-start gap-2">
          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
            entry.status === 'success' ? 'bg-emerald-500' :
            entry.status === 'error' ? 'bg-red-500' :
            entry.status === 'warning' ? 'bg-amber-500' : 'bg-sky-500'
          }`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-semibold ${statusColors[entry.status] || 'text-gs-muted'}`}>
                {entry.action}
              </span>
              <span className="text-[10px] text-gs-dim flex-shrink-0">
                {formatTimestamp(entry.timestamp)}
              </span>
            </div>
            {entry.details && (
              <p className="text-[10px] text-gs-dim mt-0.5 truncate">{entry.details}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Selective Sync Toggle ---
// Allows users to enable/disable sync for specific data categories.
export function SelectiveSyncPanel({
  categories = [], // Array of { key, label, enabled, description? }
  onToggle, // (categoryKey, enabled) => void
}) {
  if (categories.length === 0) return null;

  return (
    <div className="py-1">
      {categories.map((cat) => (
        <div key={cat.key} className="flex items-center justify-between px-3 py-2">
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-[11px] font-semibold text-gs-text">{cat.label}</p>
            {cat.description && (
              <p className="text-[10px] text-gs-dim mt-0.5">{cat.description}</p>
            )}
          </div>
          <button
            onClick={() => onToggle && onToggle(cat.key, !cat.enabled)}
            className={`relative w-8 h-[18px] rounded-full border-none cursor-pointer transition-colors flex-shrink-0 ${
              cat.enabled ? 'bg-gs-accent' : 'bg-gs-border-hover'
            }`}
            role="switch"
            aria-checked={cat.enabled}
            aria-label={`Toggle sync for ${cat.label}`}
          >
            <div
              className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform shadow-sm ${
                cat.enabled ? 'translate-x-[16px]' : 'translate-x-[2px]'
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}

// --- Main DataSyncIndicator Component ---
export default function DataSyncIndicator({
  syncing,
  queueCount = 0,
  lastSyncTime,
  onManualSync,
  conflicts = [],
  onResolveConflict,
  onResolveAllConflicts,
  syncHistory = [],
  syncCategories = [],
  onToggleSyncCategory,
}) {
  const [displayTime, setDisplayTime] = useState(() => formatTimestamp(lastSyncTime));
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('status'); // 'status' | 'history' | 'settings'

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

  const hasConflicts = conflicts.length > 0;
  const hasHistory = syncHistory.length > 0;
  const hasCategories = syncCategories.length > 0;
  const showExpandButton = hasHistory || hasCategories;

  return (
    <>
      {/* Conflict resolution panel (shown above the main indicator) */}
      {hasConflicts && (
        <ConflictResolutionPanel
          conflicts={conflicts}
          onResolve={onResolveConflict}
          onResolveAll={onResolveAllConflicts}
        />
      )}

      {/* Expanded panel */}
      {panelOpen && (
        <div className="fixed bottom-14 right-4 z-[1500] bg-gs-card border border-gs-border rounded-lg shadow-xl animate-fade-in w-[280px]">
          {/* Tab bar */}
          <div className="flex border-b border-gs-border">
            {hasHistory && (
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 text-[11px] font-semibold py-2 border-none cursor-pointer transition-colors ${
                  activeTab === 'history' ? 'text-gs-accent bg-gs-accent/5' : 'text-gs-muted bg-transparent hover:text-gs-text'
                }`}
              >
                History
              </button>
            )}
            {hasCategories && (
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 text-[11px] font-semibold py-2 border-none cursor-pointer transition-colors ${
                  activeTab === 'settings' ? 'text-gs-accent bg-gs-accent/5' : 'text-gs-muted bg-transparent hover:text-gs-text'
                }`}
              >
                Settings
              </button>
            )}
          </div>

          {/* Tab content */}
          {activeTab === 'history' && hasHistory && (
            <SyncHistoryLog history={syncHistory} onClose={() => setPanelOpen(false)} />
          )}
          {activeTab === 'settings' && hasCategories && (
            <SelectiveSyncPanel categories={syncCategories} onToggle={onToggleSyncCategory} />
          )}
        </div>
      )}

      {/* Main indicator bar */}
      <div
        className="fixed bottom-4 right-4 z-[1500] flex items-center gap-2.5 bg-gs-card border border-gs-border rounded-lg px-3 py-2 shadow-lg animate-fade-in"
        role="status"
        aria-live="polite"
      >
        {syncing ? (
          <svg className="w-3.5 h-3.5 text-gs-accent animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        ) : hasConflicts ? (
          <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}

        <div className="flex flex-col">
          <span className="text-[11px] text-gs-muted font-medium leading-tight">
            {syncing ? 'Syncing...' : hasConflicts ? 'Conflicts' : 'Synced'}
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

        {/* Expand panel button */}
        {showExpandButton && (
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="ml-1 p-1 rounded bg-transparent border border-gs-border hover:border-gs-accent text-gs-dim hover:text-gs-accent transition-colors cursor-pointer"
            aria-label={panelOpen ? 'Close sync panel' : 'Open sync panel'}
          >
            <svg
              className={`w-3 h-3 transition-transform ${panelOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}

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
    </>
  );
}
