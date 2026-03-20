// Error boundary — catches React render errors and shows a friendly fallback message.
// Wrap around any subtree to prevent the entire app from crashing.
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
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
          <div className="flex gap-2">
            <button
              onClick={this.handleRetry}
              className="gs-btn-gradient px-4 py-2 rounded-lg text-[13px] font-semibold"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="gs-btn-secondary px-4 py-2 rounded-lg text-[13px] font-semibold"
            >
              Refresh Page
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="mt-4 text-[10px] text-red-400/70 bg-red-500/5 border border-red-500/10 rounded-lg p-3 max-w-md overflow-auto text-left">
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
