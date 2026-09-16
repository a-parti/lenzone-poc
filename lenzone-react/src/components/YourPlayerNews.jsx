import React, { useState } from 'react';
import { UserRoundSearch, RefreshCw, ExternalLink } from 'lucide-react';

function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// "(RotoWire, 2h ago)" / "(RotoWire)" if no timestamp -- only shown when ESPN actually attached a
// source/date to the note, never guessed.
function sourceLabel(source, date) {
  if (!source && !date) return null;
  const time = timeAgo(date);
  return time ? `(${source || 'ESPN'}, ${time})` : `(${source || 'ESPN'})`;
}

// Real news/notes about the players on whichever roster is currently selected ("I am") --
// cross-referenced from two real ESPN feeds (lib/espnApi.js): per-player analyst notes (usually
// RotoWire-credited, e.g. "recorded five tackles... in Sunday's win") and general headlines
// ESPN itself tagged as being about that specific player. Nothing here is guessed -- if a
// roster's players don't show up in either real feed right now, this renders nothing rather than
// a placeholder, same as the other "bonus" cards in this app.
export default function YourPlayerNews({ manager, notes, headlines, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  if (!manager) return null;
  if ((!notes || notes.length === 0) && (!headlines || headlines.length === 0)) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh?.();
    setRefreshing(false);
  };

  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <UserRoundSearch className="w-4 h-4 text-[var(--accent)] shrink-0" />
        {/* Wraps to two short lines instead of one wide one -- frees up horizontal room in this
            row (icon + label + refresh button) rather than pushing everything else out. */}
        <span className="tracking-wider text-[9px] leading-tight uppercase font-semibold text-[var(--muted)] max-w-[64px]">(Your News)</span>
        <button
          type="button"
          onClick={handleRefresh}
          title="Refresh player news"
          aria-label="Refresh your player news"
          className="ml-auto shrink-0 p-1 rounded-full text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-colors duration-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="space-y-1.5 max-h-[28rem] overflow-y-auto scroll-thin pr-1">
        {(notes || []).slice(0, 20).map((n, i) => {
          const label = sourceLabel(n.source, n.date);
          const tag = n.nflTeam && n.position ? `${n.nflTeam}${n.number ? ` #${n.number}` : ''} ${n.position}` : null;
          const content = (
            <>
              <span className="font-bold text-[var(--text)]">{n.player}</span>
              {tag && <span className="text-[10px] font-semibold text-[var(--muted)]"> ({tag})</span>}
              <span className="font-bold text-[var(--text)]">:</span> {n.headline}
              {label && <span className="text-[10px] text-[var(--muted)]"> {label}</span>}
            </>
          );
          // Only wrapped in a link when ESPN actually gave this player a real page to link to --
          // otherwise it's just plain text, never a link to nowhere/guessed URL.
          return n.link ? (
            <a
              key={`note-${i}`} href={n.link} target="_blank" rel="noopener noreferrer"
              className="group flex items-start gap-1 text-xs leading-snug text-[var(--text2)] hover:text-[var(--accent)] transition-colors duration-150"
            >
              <span className="flex-1">{content}</span>
              <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 mt-0.5" />
            </a>
          ) : (
            <p key={`note-${i}`} className="text-xs text-[var(--text2)] leading-snug">{content}</p>
          );
        })}
        {(headlines || []).slice(0, 10).map((h, i) => (
          <a
            key={`headline-${i}`}
            href={h.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 text-xs font-semibold text-[var(--text2)] hover:text-[var(--accent)] transition-colors duration-150"
          >
            <span className="truncate">{h.headline}</span>
            <span className="text-[10px] text-[var(--muted)] shrink-0 font-normal">{sourceLabel(h.byline ? `ESPN — ${h.byline}` : 'ESPN', h.published)}</span>
            <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
          </a>
        ))}
      </div>
    </div>
  );
}
