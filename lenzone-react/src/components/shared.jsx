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
