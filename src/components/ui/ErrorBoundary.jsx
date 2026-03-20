// Error boundary — catches React render errors and shows a friendly fallback message.
// Wrap around any subtree to prevent the entire app from crashing.
// Improvements: retry countdown timer, error report submission, dev-mode full stack trace.
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      countdown: 0,
      reportStatus: null,
    };
    this.countdownTimer = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
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
          return { hasError: false, error: null, errorInfo: null, countdown: 0, reportStatus: null };
        }
        return { countdown: next };
      });
    }, 1000);
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, reportStatus: null });
  };

  handleReportError = () => {
    this.setState({ reportStatus: 'sending' });
    const errorReport = {
      message: this.state.error?.toString() || 'Unknown error',
      stack: this.state.error?.stack || '',
      componentStack: this.state.errorInfo?.componentStack || '',
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

  render() {
    if (this.state.hasError) {
      const { countdown, reportStatus } = this.state;
      const isDev = process.env.NODE_ENV === 'development';

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-[15px] font-bold text-gs-text mb-1">Something went wrong</h2>
          <p className="text-[13px] text-gs-muted mb-4 max-w-xs">
            An unexpected error occurred. Try refreshing the page or click below to retry.
          </p>
          <div className="flex gap-2 mb-3">
            {countdown > 0 ? (
              <button
                disabled
                className="gs-btn-gradient px-4 py-2 rounded-lg text-[13px] font-semibold opacity-70 cursor-not-allowed"
              >
                Retrying in {countdown}s...
              </button>
            ) : (
              <>
                <button
                  onClick={this.handleRetry}
                  className="gs-btn-gradient px-4 py-2 rounded-lg text-[13px] font-semibold"
                >
                  Try Again
                </button>
                <button
                  onClick={this.handleRetryWithCountdown}
                  className="gs-btn-secondary px-4 py-2 rounded-lg text-[13px] font-semibold"
                >
                  Auto-Retry (5s)
                </button>
              </>
            )}
            <button
              onClick={() => window.location.reload()}
              className="gs-btn-secondary px-4 py-2 rounded-lg text-[13px] font-semibold"
            >
              Refresh Page
            </button>
          </div>

          {/* Error report submission */}
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

          {/* Development-mode full stack trace */}
          {isDev && this.state.error && (
            <div className="mt-2 w-full max-w-lg">
              <pre className="text-[10px] text-red-400/70 bg-red-500/5 border border-red-500/10 rounded-lg p-3 overflow-auto text-left whitespace-pre-wrap">
                <span className="font-bold text-red-400">{this.state.error.toString()}</span>
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
