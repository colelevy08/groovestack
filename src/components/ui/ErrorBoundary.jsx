// Error boundary — catches React render errors and shows a friendly fallback message.
// Wrap around any subtree to prevent the entire app from crashing.
// Improvements: retry countdown timer, error report submission, dev-mode full stack trace,
// error categorization (network, render, data), suggested recovery actions per error type,
// and error frequency tracking.
import { Component } from 'react';

// --- Error categorization ---
const ERROR_CATEGORIES = {
  network: {
    label: 'Network Error',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 1l22 22" />
        <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
        <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0122.56 9" />
        <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
        <path d="M8.53 16.11a6 6 0 016.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    ),
    description: 'A network request failed. This usually means the server is unreachable or your connection dropped.',
    recoveryActions: [
      { label: 'Check your internet connection', type: 'info' },
      { label: 'Retry', type: 'retry' },
      { label: 'Work Offline', type: 'dismiss' },
    ],
  },
  render: {
    label: 'Render Error',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    description: 'A UI component failed to render. This is likely a bug.',
    recoveryActions: [
      { label: 'Try Again', type: 'retry' },
      { label: 'Refresh Page', type: 'reload' },
      { label: 'Report Error', type: 'report' },
    ],
  },
  data: {
    label: 'Data Error',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        <line x1="9" y1="10" x2="15" y2="16" />
        <line x1="15" y1="10" x2="9" y2="16" />
      </svg>
    ),
    description: 'The app received unexpected or malformed data. This may resolve on its own.',
    recoveryActions: [
      { label: 'Retry', type: 'retry' },
      { label: 'Clear Cache & Retry', type: 'clearCache' },
      { label: 'Refresh Page', type: 'reload' },
    ],
  },
};

function categorizeError(error) {
  if (!error) return 'render';
  const msg = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';

  // Network errors
  if (
    name === 'typeerror' && (msg.includes('fetch') || msg.includes('network')) ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('abort') ||
    msg.includes('cors') ||
    msg.includes('failed to fetch') ||
    msg.includes('net::') ||
    name === 'networkerror'
  ) {
    return 'network';
  }

  // Data errors
  if (
    msg.includes('json') ||
    msg.includes('unexpected token') ||
    msg.includes('undefined is not') ||
    msg.includes('null is not') ||
    msg.includes('cannot read prop') ||
    msg.includes('is not a function') ||
    name === 'syntaxerror' ||
    name === 'typeerror'
  ) {
    return 'data';
  }

  return 'render';
}

// --- Error frequency tracking ---
const ERROR_FREQUENCY_KEY = 'gs_error_frequency';

function trackErrorFrequency(error) {
  try {
    const raw = localStorage.getItem(ERROR_FREQUENCY_KEY);
    const freq = raw ? JSON.parse(raw) : {};
    const key = error?.message?.slice(0, 100) || 'unknown';
    if (!freq[key]) {
      freq[key] = { count: 0, firstSeen: new Date().toISOString(), lastSeen: null };
    }
    freq[key].count += 1;
    freq[key].lastSeen = new Date().toISOString();
    // Keep only the top 50 errors
    const entries = Object.entries(freq).sort((a, b) => b[1].count - a[1].count).slice(0, 50);
    localStorage.setItem(ERROR_FREQUENCY_KEY, JSON.stringify(Object.fromEntries(entries)));
    return freq[key];
  } catch {
    return { count: 1, firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString() };
  }
}

function getErrorFrequency(error) {
  try {
    const raw = localStorage.getItem(ERROR_FREQUENCY_KEY);
    const freq = raw ? JSON.parse(raw) : {};
    const key = error?.message?.slice(0, 100) || 'unknown';
    return freq[key] || null;
  } catch {
    return null;
  }
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      countdown: 0,
      reportStatus: null,
      errorCategory: 'render',
      errorFreq: null,
    };
    this.countdownTimer = null;
  }

  static getDerivedStateFromError(error) {
    const category = categorizeError(error);
    const freq = trackErrorFrequency(error);
    return { hasError: true, error, errorCategory: category, errorFreq: freq };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  componentWillUnmount() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  handleRetryWithCountdown = () => {
    this.setState({ countdown: 5 });
    this.countdownTimer = setInterval(() => {
      this.setState(prev => {
        const next = prev.countdown - 1;
        if (next <= 0) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
          return { hasError: false, error: null, errorInfo: null, countdown: 0, reportStatus: null, errorFreq: null };
        }
        return { countdown: next };
      });
    }, 1000);
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, reportStatus: null, errorFreq: null });
  };

  handleClearCacheAndRetry = () => {
    try {
      // Clear relevant caches
      localStorage.removeItem('gs_cache');
      sessionStorage.clear();
    } catch { /* ignore */ }
    this.handleRetry();
  };

  handleReportError = () => {
    this.setState({ reportStatus: 'sending' });
    const errorReport = {
      message: this.state.error?.toString() || 'Unknown error',
      stack: this.state.error?.stack || '',
      componentStack: this.state.errorInfo?.componentStack || '',
      category: this.state.errorCategory,
      frequency: this.state.errorFreq,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };
    // Store error report locally for later submission
    try {
      const reports = JSON.parse(localStorage.getItem('gs_error_reports') || '[]');
      reports.push(errorReport);
      localStorage.setItem('gs_error_reports', JSON.stringify(reports.slice(-20)));
      this.setState({ reportStatus: 'sent' });
    } catch {
      this.setState({ reportStatus: 'failed' });
    }
  };

  handleRecoveryAction = (actionType) => {
    switch (actionType) {
      case 'retry':
        this.handleRetry();
        break;
      case 'reload':
        window.location.reload();
        break;
      case 'report':
        this.handleReportError();
        break;
      case 'clearCache':
        this.handleClearCacheAndRetry();
        break;
      case 'dismiss':
        this.handleRetry();
        break;
      default:
        break;
    }
  };

  render() {
    if (this.state.hasError) {
      const { countdown, reportStatus, errorCategory, errorFreq } = this.state;
      const isDev = process.env.NODE_ENV === 'development';
      const categoryInfo = ERROR_CATEGORIES[errorCategory] || ERROR_CATEGORIES.render;

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          {/* Category-specific icon */}
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            {categoryInfo.icon}
          </div>

          {/* Category label */}
          <span className="text-[10px] uppercase tracking-widest text-red-400/70 font-bold mb-2">
            {categoryInfo.label}
          </span>

          <h2 className="text-[15px] font-bold text-gs-text mb-1">Something went wrong</h2>
          <p className="text-[13px] text-gs-muted mb-2 max-w-xs">
            {categoryInfo.description}
          </p>

          {/* Error frequency badge */}
          {errorFreq && errorFreq.count > 1 && (
            <p className="text-[11px] text-amber-400/80 bg-amber-500/10 border border-amber-500/15 rounded-md px-2 py-1 mb-3">
              This error has occurred {errorFreq.count} times
              {errorFreq.firstSeen && ` since ${new Date(errorFreq.firstSeen).toLocaleDateString()}`}
            </p>
          )}

          {/* Suggested recovery actions based on error category */}
          <div className="flex flex-wrap gap-2 mb-3 justify-center">
            {countdown > 0 ? (
              <button
                disabled
                className="gs-btn-gradient px-4 py-2 rounded-lg text-[13px] font-semibold opacity-70 cursor-not-allowed"
              >
                Retrying in {countdown}s...
              </button>
            ) : (
              categoryInfo.recoveryActions.map((action, i) => {
                if (action.type === 'info') {
                  return (
                    <span key={i} className="text-[12px] text-gs-muted bg-gs-card border border-gs-border px-3 py-2 rounded-lg">
                      {action.label}
                    </span>
                  );
                }
                if (action.type === 'report') {
                  return (
                    <button
                      key={i}
                      onClick={() => this.handleRecoveryAction('report')}
                      disabled={reportStatus === 'sending' || reportStatus === 'sent'}
                      className="gs-btn-secondary px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reportStatus === 'sent' ? 'Reported' : action.label}
                    </button>
                  );
                }
                return (
                  <button
                    key={i}
                    onClick={() => this.handleRecoveryAction(action.type)}
                    className={i === 0 ? 'gs-btn-gradient px-4 py-2 rounded-lg text-[13px] font-semibold' : 'gs-btn-secondary px-4 py-2 rounded-lg text-[13px] font-semibold'}
                  >
                    {action.label}
                  </button>
                );
              })
            )}
          </div>

          {/* Fallback actions */}
          <div className="flex gap-2 mb-3">
            {countdown <= 0 && (
              <button
                onClick={this.handleRetryWithCountdown}
                className="text-[11px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer transition-colors"
              >
                Auto-Retry (5s)
              </button>
            )}
          </div>

          {/* Error report link (if not already shown in recovery actions) */}
          {!categoryInfo.recoveryActions.find(a => a.type === 'report') && (
            <button
              onClick={this.handleReportError}
              disabled={reportStatus === 'sending' || reportStatus === 'sent'}
              className="text-[11px] text-gs-dim hover:text-gs-muted transition-colors bg-transparent border-none cursor-pointer mb-3 disabled:cursor-not-allowed"
            >
              {reportStatus === 'sending' && 'Submitting report...'}
              {reportStatus === 'sent' && 'Report saved -- thank you!'}
              {reportStatus === 'failed' && 'Report failed. Click to retry.'}
              {!reportStatus && 'Report this error'}
            </button>
          )}

          {/* Development-mode full stack trace */}
          {isDev && this.state.error && (
            <div className="mt-2 w-full max-w-lg">
              <pre className="text-[10px] text-red-400/70 bg-red-500/5 border border-red-500/10 rounded-lg p-3 overflow-auto text-left whitespace-pre-wrap">
                <span className="font-bold text-red-400">{this.state.error.toString()}</span>
                {'\n'}
                <span className="text-[9px] text-red-400/50">Category: {errorCategory}</span>
                {this.state.error.stack && (
                  <>
                    {'\n\n--- Stack Trace ---\n'}
                    {this.state.error.stack}
                  </>
                )}
                {this.state.errorInfo?.componentStack && (
                  <>
                    {'\n\n--- Component Stack ---'}
                    {this.state.errorInfo.componentStack}
                  </>
                )}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
