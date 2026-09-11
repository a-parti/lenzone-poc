import React, { useEffect, useRef } from 'react';
import { Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react';
import { positionStyle } from '../lib/theme';
import { nflTeamColor, readableTextOn } from '../lib/nflTeams';
import { ALL_SCHEMES, useTheme } from '../context/ThemeContext';

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
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${INJURY_STYLES[status] || "bg-slate-500/10 text-[var(--text2)] border border-slate-500/20"}`}>
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

// Real NFL schedule data for this player's team that week. Sleeper's own schedule feed only has a
// date (no kickoff time-of-day), so `kickoff`/`state` -- when present -- come from ESPN's public
// scoreboard (merged in App.jsx for the currently viewed week only); never a fabricated time.
export function GameBadge({ nflTeam, week, byTeamWeek }) {
  const g = byTeamWeek?.[nflTeam]?.[week];
  if (!g) return null;
  const isLive = g.state === 'in';
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-400 min-w-0 max-w-full">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
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
// to a PositionBadge -- e.g. "QB" + "MIA" in Miami's teal.
export function NflTeamTag({ team }) {
  if (!team) return null;
  const c = nflTeamColor(team);
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
      style={c ? { color: readableTextOn(c.primary), backgroundColor: c.primary, borderColor: c.secondary } : undefined}
    >
      {team}
    </span>
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

// Fits ~5.5 swatches (28px + 6px gap each) so a couple more peek in at each edge as a scroll
// affordance -- the rest of the 37 (5 curated + 32 team) schemes are reached by scrolling, not by
// growing the strip to fit them all.
const SWATCH_STRIP_WIDTH = 190;

export function ThemeToggle() {
  const { scheme, setScheme, mode, setMode } = useTheme();
  const stripRef = useRef(null);

  // Whenever the active scheme changes -- picked here, forced by a manager selection, or the
  // random Home-page default -- bring its swatch into view instead of leaving the strip scrolled
  // wherever it happened to be, so the ring around the active color is never scrolled off-screen.
  useEffect(() => {
    const el = stripRef.current?.querySelector(`[data-scheme-id="${scheme}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [scheme]);

  // A horizontal strip doesn't respond to a normal (vertical) mouse wheel by default -- redirect
  // vertical wheel delta into horizontal scroll so it can be browsed without a horizontal scrollbar/drag.
  const onWheel = (e) => {
    if (e.deltaY === 0) return;
    e.preventDefault();
    e.currentTarget.scrollLeft += e.deltaY;
  };

  // Wheel-scrolling isn't discoverable on its own (and doesn't exist at all on touch) -- these
  // arrows page the strip by roughly 3 swatches at a time as an explicit, obvious way to browse it.
  const scrollByPage = (dir) => {
    stripRef.current?.scrollBy({ left: dir * 102, behavior: 'smooth' });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => scrollByPage(-1)}
        title="Previous colors"
        aria-label="Scroll color scheme options left"
        className="p-1 rounded-full text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-colors duration-200 shrink-0"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="relative" style={{ width: SWATCH_STRIP_WIDTH }}>
        <div
          ref={stripRef}
          onWheel={onWheel}
          className="flex items-center gap-1.5 rounded-full bg-[var(--surface2)] border border-[var(--border)] px-2 py-1.5 overflow-x-auto scroll-smooth scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {ALL_SCHEMES.map(s => (
            <button
              key={s.id}
              type="button"
              title={s.label}
              data-scheme-id={s.id}
              aria-label={`Switch to ${s.label} color scheme`}
              aria-pressed={scheme === s.id}
              onClick={() => setScheme(s.id)}
              className={`w-5 h-5 rounded-full shrink-0 transition-all duration-200 ${scheme === s.id ? "ring-2 ring-offset-2 ring-offset-[var(--surface2)] ring-[var(--text)] scale-110" : "opacity-70 hover:opacity-100"}`}
              style={{ backgroundColor: s.swatch }}
            />
          ))}
        </div>
        {/* Edge fades hint that the strip scrolls -- match the strip's own background so they blend
            in rather than reading as a border. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-4 rounded-l-full bg-gradient-to-r from-[var(--surface2)] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-4 rounded-r-full bg-gradient-to-l from-[var(--surface2)] to-transparent" />
      </div>
      <button
        type="button"
        onClick={() => scrollByPage(1)}
        title="More colors"
        aria-label="Scroll color scheme options right"
        className="p-1 rounded-full text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-colors duration-200 shrink-0"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
        title={mode === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={mode === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
        className="p-2 rounded-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] transition-colors duration-200"
      >
        {mode === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>
    </div>
  );
}

// The closed <select> box is styled fine with Tailwind classes, but the opened native options
// popup ignores them everywhere except Chromium (background-color/color on <option> itself) --
// without this it renders as a plain white browser-default list regardless of the active scheme.
const optionStyle = { backgroundColor: 'var(--surface2)', color: 'var(--text)' };

export function TeamPicker({ afcManagers, nfcManagers, value, onChange, prefix = "I am", variant = "compact" }) {
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
          <option value="" style={optionStyle}>choose your team&hellip;</option>
          <optgroup label="AFC" style={optionStyle}>
            {(afcManagers || []).map(m => <option key={m} value={m} style={optionStyle}>{m}</option>)}
          </optgroup>
          <optgroup label="NFC" style={optionStyle}>
            {(nfcManagers || []).map(m => <option key={m} value={m} style={optionStyle}>{m}</option>)}
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
    <div className="inline-flex rounded-lg bg-[var(--bg)] p-1 border border-[var(--border)]/80">
      {["ALL", "AFC", "NFC"].map(conf => (
        <button
          key={conf}
          onClick={() => onChange(conf)}
          className={`px-3 py-1 rounded-md text-xs font-bold transition-all duration-200 ${
            value === conf ? "bg-[var(--accent)] text-[var(--accent-text)]" : "text-[var(--text2)] hover:text-[var(--text)]"
          }`}
        >
          {conf}
        </button>
      ))}
    </div>
  );
}
