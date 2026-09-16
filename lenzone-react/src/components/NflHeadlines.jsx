import React, { useState } from 'react';
import { Newspaper, RefreshCw, ExternalLink } from 'lucide-react';

function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// "(ESPN — Byline, 2h ago)" / "(ESPN, 2h ago)" if no byline / "(ESPN)" if no timestamp either --
// every headline is from ESPN's own feed, so that part's always real; byline/time are only shown
// when ESPN actually provided them, never guessed.
function sourceLabel(byline, published) {
  const parts = [byline ? `ESPN — ${byline}` : 'ESPN'];
  const time = timeAgo(published);
  return time ? `(${parts[0]}, ${time})` : `(${parts[0]})`;
}

// Real, live current NFL headlines from ESPN's own public news feed (lib/espnApi.js
// fetchNflHeadlines) -- every headline and link is exactly what ESPN's API returns right now,
// never invented or reworded. `onRefresh` re-fetches (App.jsx also refetches on an interval so
// this stays current on its own, but a manual refresh doesn't hurt).
export default function NflHeadlines({ headlines, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  if (!headlines || headlines.length === 0) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh?.();
    setRefreshing(false);
  };

  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Newspaper className="w-4 h-4 text-[var(--accent)] shrink-0" />
        <span className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">NFL Headlines</span>
        <button
          type="button"
          onClick={handleRefresh}
          title="Refresh headlines"
          aria-label="Refresh NFL headlines"
          className="ml-auto shrink-0 p-1 rounded-full text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-colors duration-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="flex flex-col gap-1.5 max-h-[28rem] overflow-y-auto scroll-thin pr-1">
        {headlines.slice(0, 30).map((h, i) => (
          <a
            key={i}
            href={h.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 text-xs font-semibold text-[var(--text2)] hover:text-[var(--accent)] transition-colors duration-150 max-w-full py-0.5"
          >
            <span className="truncate">{h.headline}</span>
            <span className="text-[10px] text-[var(--muted)] shrink-0 font-normal ml-auto">{sourceLabel(h.byline, h.published)}</span>
            <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
          </a>
        ))}
      </div>
    </div>
  );
}
