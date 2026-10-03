import React, { useEffect } from 'react';
import { positionStyle } from '../lib/theme';
import { nflTeamColor, readableTextOn, nflTeamLogoUrl } from '../lib/nflTeams';
import { useTeamDepthChart } from '../context/TeamDepthChartContext';
import { useNameDisplay } from '../context/NameDisplayContext';

// Shared across every full-screen modal so Escape always closes whichever one is open, without
// each modal component re-implementing its own key listener.
export function useEscapeKey(onEscape) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onEscape(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape]);
}

export function PositionBadge({ position }) {
  if (!position) return null;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${positionStyle(position)}`}>
      {position}
    </span>
  );
}

const INJURY_WARN = "bg-[var(--live)]/10 text-[var(--live)] border border-[var(--live)]/25";
const INJURY_OUT = "bg-[var(--neg)]/10 text-[var(--neg)] border border-[var(--neg)]/25";
const INJURY_STYLES = {
  Questionable: INJURY_WARN,
  Doubtful: INJURY_WARN,
  Out: INJURY_OUT,
  IR: INJURY_OUT,
  PUP: INJURY_OUT,
  Suspended: INJURY_OUT
};

// Standard fantasy-football shorthand for Sleeper's real injury_status values -- IR/PUP are
// already this short natively. Anything else (a status not in this list) is shown unabbreviated
// since there's no established shorthand for it to borrow.
const INJURY_ABBREV = {
  Questionable: "Q",
  Doubtful: "D",
  Out: "O",
  Suspended: "SUS"
};

// Reflects Sleeper's real injury_status field. No listed status is shown as "Healthy" (a real
// signal -- Sleeper lists nothing wrong -- not an invented one).
export function InjuryBadge({ status }) {
  if (!status) return null;
  return (
    <span
      title={status}
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${INJURY_STYLES[status] || "bg-[var(--surface2)] text-[var(--text2)] border border-[var(--border)]"}`}
    >
      {INJURY_ABBREV[status] || status}
    </span>
  );
}

export function StatusBadge({ type }) {
  const styles = {
    BYE: "bg-[var(--pos)]/10 text-[var(--pos)] border border-[var(--pos)]/25",
    WILDCARD: "bg-[var(--coral)]/10 text-[var(--coral)] border border-[var(--coral)]/30",
    TOILET_BOWL: "bg-[var(--surface2)] text-[var(--muted)] border border-[var(--border)]"
  };
  const labels = { BYE: "Bye", WILDCARD: "Wild Card", TOILET_BOWL: "Toilet Bowl" };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

// Real NFL schedule data for this player's team that week. Sleeper's own schedule feed only has a
// date (no kickoff time-of-day), so `kickoff`/`state` -- when present -- come from ESPN's public
// scoreboard (merged in App.jsx for the currently viewed week only); never a fabricated time.
export function GameBadge({ nflTeam, week, byTeamWeek }) {
  const g = byTeamWeek?.[nflTeam]?.[week];
  if (!g) return null;
  const isLive = g.state === 'in';
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--neg)] min-w-0 max-w-full">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--neg)] animate-pulse shrink-0" />
        <span className="truncate">LIVE Q{g.period} {g.displayClock} vs {g.opponent}</span>
      </span>
    );
  }
  const kickoffLabel = g.kickoff
    ? new Date(g.kickoff).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : g.date
      ? new Date(`${g.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })
      : '';
  const isFinal = g.state === 'post' || g.status === 'complete';
  const label = isFinal ? `Final vs ${g.opponent}` : g.status === 'canceled' ? 'Canceled' : `${g.isHome ? 'vs' : '@'} ${g.opponent} ${kickoffLabel}`;
  return <span className="text-xs font-mono text-[var(--muted)] block truncate min-w-0 max-w-full">{label}</span>;
}

// Small colored 3-letter NFL team tag (real team brand colors from nflTeams.js), meant to sit next
// to a PositionBadge -- e.g. "QB" + "MIA" in Miami's teal. An optional jersey number folds into the
// same tag ("MIA #2") for rows tight on columns, instead of giving the number its own column.
export function NflTeamTag({ team, number }) {
  const { openTeamDepthChart } = useTeamDepthChart();
  if (!team) return null;
  const c = nflTeamColor(team);
  return (
    <button
      type="button"
      onClick={() => openTeamDepthChart(team)}
      title={`View ${team} depth chart`}
      className="text-[10px] font-bold px-1.5 py-0.5 rounded border hover:brightness-110 transition-all duration-150 whitespace-nowrap"
      style={c ? { color: readableTextOn(c.primary), backgroundColor: c.primary, borderColor: c.secondary } : undefined}
    >
      {team}{number != null ? ` #${number}` : ""}
    </button>
  );
}

// Same click-through-to-depth-chart behavior as NflTeamTag, but for the logo+name presentation
// used where a team is shown as a bigger identity block rather than an inline badge -- the whole
// thing is one button so it's obvious (hover underline/highlight) that clicking it does something,
// not just decorative.
export function NflTeamLogo({ team, logoSize = "w-9 h-9", textClassName = "text-[var(--text)] font-semibold", onError }) {
  const { openTeamDepthChart } = useTeamDepthChart();
  if (!team) return null;
  return (
    <button
      type="button"
      onClick={() => openTeamDepthChart(team)}
      title={`View ${team} depth chart`}
      className="group flex items-center gap-2 shrink-0 rounded-lg px-1 -mx-1 py-0.5 hover:bg-[var(--surface2)]/80 transition-colors duration-150"
    >
      <img
        src={nflTeamLogoUrl(team)}
        alt={team}
        className={`${logoSize} object-contain shrink-0`}
        onError={onError || ((e) => { e.target.style.display = 'none'; })}
      />
      <span className={`${textClassName} group-hover:text-[var(--accent)] group-hover:underline truncate`}>{team}</span>
    </button>
  );
}

// Shared button styling so ad-hoc buttons across tabs don't drift in size/weight. Padding lives
// per-variant (icon buttons are square, primary/ghost are label buttons) so a caller's className
// never has to fight the base classes for the same property.
const BUTTON_VARIANTS = {
  primary: "px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-ink)] text-[var(--accent-text)]",
  icon: "p-2 bg-[var(--surface2)]/80 hover:bg-[var(--surface2)] text-[var(--text2)]",
  ghost: "px-4 py-2 bg-[var(--surface)]/80 hover:bg-[var(--surface2)] text-[var(--text2)] border border-[var(--border)]/80"
};
export function Button({ variant = "primary", className = "", children, title, ...props }) {
  return (
    <button
      title={title}
      // Icon-only buttons have no visible text for a screen reader to announce -- fall back to
      // the tooltip text as the accessible name unless one was explicitly given.
      aria-label={props['aria-label'] || title}
      className={`inline-flex items-center gap-2 rounded-lg font-semibold text-xs transition-all duration-200 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Pulsing placeholder block, used instead of italic "Loading..." text while real data is in flight.
export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-[var(--surface2)]/60 rounded ${className}`} />;
}

export function SkeletonRows({ rows = 3, className = "" }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-[var(--surface)]/60 border border-[var(--border)]/80 rounded-xl p-4 flex items-center gap-3">
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

// The closed <select> box is styled fine with Tailwind classes, but the opened native options
// popup ignores them everywhere except Chromium (background-color/color on <option> itself) --
// without this it renders as a plain white browser-default list regardless of the active scheme.
const optionStyle = { backgroundColor: 'var(--surface2)', color: 'var(--text)' };

export function TeamPicker({ afcManagers, nfcManagers, value, onChange, prefix = "I am", variant = "compact" }) {
  const { displayName } = useNameDisplay();
  if (!(afcManagers?.length > 0 || nfcManagers?.length > 0)) return null;
  const isBlend = variant === "blend";
  return (
    <div className={`inline-flex items-center ${isBlend ? "gap-3" : "gap-2"}`}>
      {prefix && (
        <span className={isBlend ? "font-display text-base sm:text-lg text-[var(--text2)] whitespace-nowrap" : "text-[var(--text2)] whitespace-nowrap"}>
          {prefix}
        </span>
      )}
      <div className={isBlend ? "relative inline-block" : "contents"}>
        <select
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value || null)}
          className={
            isBlend
              ? "bg-transparent border-0 border-b-2 border-transparent rounded-none px-1 py-0.5 font-display font-bold text-[var(--accent)] text-base sm:text-lg focus:outline-none max-w-[calc(100vw-140px)] sm:max-w-none"
              : "bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-3 py-1.5 font-semibold text-[var(--text)] text-sm focus:outline-none focus:border-[var(--accent)] w-full max-w-[22rem]"
          }
        >
          <option value="" style={optionStyle}>Pick your team&hellip;</option>
          <optgroup label="AFC" style={optionStyle}>
            {(afcManagers || []).map(m => <option key={m} value={m} style={optionStyle}>{displayName(m, 'AFC')}</option>)}
          </optgroup>
          <optgroup label="NFC" style={optionStyle}>
            {(nfcManagers || []).map(m => <option key={m} value={m} style={optionStyle}>{displayName(m, 'NFC')}</option>)}
          </optgroup>
        </select>
        {/* A continuously looping shimmer underline instead of a static border -- reliable
            cross-browser, unlike trying to gradient-fill the text of a native <select>. Runs
            before AND after picking a team, not just on hover, so it draws the eye either way. */}
        {isBlend && <span className="picker-glow-bar" aria-hidden="true" />}
      </div>
    </div>
  );
}

export function ConfFilterToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-[var(--bg)] p-1 border border-[var(--border)]/80" role="group" aria-label="Conference">
      {[["ALL", "Both"], ["AFC", "AFC"], ["NFC", "NFC"]].map(([conf, label]) => (
        <button
          key={conf}
          type="button"
          onClick={() => onChange(conf)}
          aria-pressed={value === conf}
          className={`px-3.5 py-2 rounded-md text-xs font-bold transition-all duration-200 ${
            value === conf ? "bg-[var(--accent)] text-[var(--accent-text)]" : "text-[var(--text2)] hover:text-[var(--text)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
