import React from 'react';

// Without this, an uncaught render error ANYWHERE in the tree unmounts the whole app and leaves a
// blank page with nothing a real visitor can do about it -- most likely to actually happen when
// landing directly on a deep tab (via a bookmarked/shared #hash URL) before league data has
// finished loading, since a tab built assuming real roster/standings data exists can throw on the
// still-empty shape that exists for one brief render before that data arrives. Catches it instead
// and offers a real way out: reload, or head back to the always-safe Home screen.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught render error:', error, info);
  }

  goHome = () => {
    window.location.hash = '#home';
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-[var(--bg)] text-[var(--text)]">
        <p className="text-lg font-bold">Something went wrong loading this page.</p>
        <p className="text-sm text-[var(--muted)] max-w-md">
          This can happen when a page loads before your league data is ready. Try going back to the homepage.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={this.goHome}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-text)] font-semibold text-sm hover:brightness-110"
          >
            Go to Homepage
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-semibold hover:bg-[var(--surface)]"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
