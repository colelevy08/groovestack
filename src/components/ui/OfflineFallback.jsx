// PWA offline fallback message — shown when the app cannot load content due to no network.
export default function OfflineFallback() {
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
      <h2 className="text-lg font-bold text-gs-text mb-2">You're offline</h2>
      <p className="text-[13px] text-gs-muted max-w-xs mb-6 leading-relaxed">
        It looks like you've lost your internet connection. Your collection data is saved locally, but some features need a connection.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="gs-btn-gradient px-5 py-2.5 rounded-lg text-[13px] font-bold"
      >
        Try Again
      </button>
    </div>
  );
}
