// PWA offline fallback message — shown when the app cannot load content due to no network.
// Improvements: cached content display, offline mode features list, sync queue indicator.
import { useState, useEffect } from 'react';

const OFFLINE_FEATURES = [
  { label: 'Browse your collection', available: true },
  { label: 'View saved records', available: true },
  { label: 'Queue changes for sync', available: true },
  { label: 'Search marketplace', available: false },
  { label: 'Send messages', available: false },
  { label: 'Complete purchases', available: false },
];

export default function OfflineFallback() {
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [cachedRecords, setCachedRecords] = useState(0);

  useEffect(() => {
    try {
      const queue = JSON.parse(localStorage.getItem('gs_sync_queue') || '[]');
      setSyncQueueCount(queue.length);
    } catch {
      setSyncQueueCount(0);
    }
    try {
      const collection = JSON.parse(localStorage.getItem('gs_collection_cache') || '[]');
      setCachedRecords(Array.isArray(collection) ? collection.length : 0);
    } catch {
      setCachedRecords(0);
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-gs-accent/10 border border-gs-accent/20 flex items-center justify-center mb-5">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gs-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
          <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0122.56 9" />
          <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
          <path d="M8.53 16.11a6 6 0 016.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-gs-text mb-2">You&apos;re offline</h2>
      <p className="text-[13px] text-gs-muted max-w-xs mb-4 leading-relaxed">
        It looks like you&apos;ve lost your internet connection. Your collection data is saved locally, but some features need a connection.
      </p>

      {/* Cached content indicator */}
      {cachedRecords > 0 && (
        <div className="bg-gs-accent/10 border border-gs-accent/20 rounded-lg px-4 py-2 mb-4 text-[12px] text-gs-accent font-medium">
          {cachedRecords} record{cachedRecords !== 1 ? 's' : ''} available offline
        </div>
      )}

      {/* Sync queue indicator */}
      {syncQueueCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2 mb-4 text-[12px] text-amber-500 font-medium flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
          {syncQueueCount} pending change{syncQueueCount !== 1 ? 's' : ''} will sync when online
        </div>
      )}

      {/* Feature availability list */}
      <div className="bg-gs-card border border-gs-border rounded-xl p-4 mb-6 w-full max-w-xs">
        <h3 className="text-[12px] font-bold text-gs-text mb-3 text-left">Offline availability</h3>
        <ul className="space-y-2">
          {OFFLINE_FEATURES.map(feature => (
            <li key={feature.label} className="flex items-center gap-2 text-[12px]">
              {feature.available ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              <span className={feature.available ? 'text-gs-text' : 'text-gs-dim'}>
                {feature.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="gs-btn-gradient px-5 py-2.5 rounded-lg text-[13px] font-bold"
      >
        Try Again
      </button>
    </div>
  );
}
