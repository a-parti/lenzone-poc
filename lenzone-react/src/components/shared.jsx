import React from 'react';
import { positionStyle } from '../lib/theme';

export function PositionBadge({ position }) {
  if (!position) return null;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${positionStyle(position)}`}>
      {position}
    </span>
  );
}

const INJURY_STYLES = {
  Questionable: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  Doubtful: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  Out: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  IR: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  PUP: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  Suspended: "bg-rose-500/10 text-rose-400 border border-rose-500/20"
};

// Reflects Sleeper's real injury_status field. No listed status is shown as "Healthy" (a real
// signal -- Sleeper lists nothing wrong -- not an invented one).
export function InjuryBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${INJURY_STYLES[status] || "bg-slate-500/10 text-slate-400 border border-slate-500/20"}`}>
      {status}
    </span>
  );
}

export function StatusBadge({ type }) {
  const styles = {
    BYE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    WILDCARD: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    TOILET_BOWL: "bg-rose-500/10 text-rose-400 border border-rose-500/20"
  };
  const labels = { BYE: "Bye", WILDCARD: "Wildcard", TOILET_BOWL: "Toilet Bowl" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

// Real NFL schedule data (date + status) for this player's team that week -- Sleeper's schedule
// feed gives a date but no kickoff time-of-day, so that's all we show; never invent a specific time.
export function GameBadge({ nflTeam, week, byTeamWeek }) {
  const g = byTeamWeek?.[nflTeam]?.[week];
  if (!g) return null;
  const dateLabel = g.date
    ? new Date(`${g.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })
    : '';
  const label = g.status === 'complete' ? `Final vs ${g.opponent}` : g.status === 'canceled' ? 'Canceled' : `${g.isHome ? 'vs' : '@'} ${g.opponent} ${dateLabel}`;
  return <span className="text-[9px] font-mono text-slate-500 shrink-0 whitespace-nowrap">{label}</span>;
}

// Shared button styling so ad-hoc buttons across tabs don't drift in size/weight. Padding lives
// per-variant (icon buttons are square, primary/ghost are label buttons) so a caller's className
// never has to fight the base classes for the same property.
const BUTTON_VARIANTS = {
  primary: "px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white",
  icon: "p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300",
  ghost: "px-4 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800/80"
};
export function Button({ variant = "primary", className = "", children, ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg font-semibold text-xs transition-all duration-200 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Pulsing placeholder block, used instead of italic "Loading..." text while real data is in flight.
export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-slate-800/60 rounded ${className}`} />;
}

export function SkeletonRows({ rows = 3, className = "" }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConfFilterToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800/80">
      {["ALL", "AFC", "NFC"].map(conf => (
        <button
          key={conf}
          onClick={() => onChange(conf)}
          className={`px-3 py-1 rounded-md text-xs font-bold transition-all duration-200 ${
            value === conf ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {conf}
        </button>
      ))}
    </div>
  );
}
