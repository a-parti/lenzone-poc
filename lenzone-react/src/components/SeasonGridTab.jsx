import React, { useState } from 'react';
import { CONF_STYLES } from '../lib/theme';
import { useIsMyTeam } from '../context/MyTeamContext';
import TeamName from './TeamName';

const TEAM_COL_WIDTH = 176; // px -- fixed so the current-week column can freeze right after it

function findOpponent(pairs, manager) {
  const pair = (pairs || []).find(([a, b]) => a === manager || b === manager);
  if (!pair) return null;
  return pair[0] === manager ? pair[1] : pair[0];
}

// One big grid: every manager (rows) x every week (columns), so the whole league's schedule is
// visible at a glance instead of one team at a time. Each cell shows that manager's in-conference
// opponent (bold) and cross-conference opponent (smaller, muted) for that week -- the same two
// matchups ScheduleTab already computes per-team, just laid out for everyone at once. Sticky first
// column (team) and header row (week) since this is wide/tall enough to need scrolling either way.
// The current week's column is ALSO sticky -- frozen right after the team column -- so it stays in
// view as a constant reference point no matter how far right you scroll into later weeks, the same
// way the team column stays in view no matter how far down you scroll. Frozen cells use the same
// translucent-surface + backdrop-blur look the rest of the app already uses for glass panels, so
// content scrolling underneath them reads as intentionally blurred rather than showing through.
export default function SeasonGridTab({ afcSeason, nfcSeason, crossSchedule, afcManagers, nfcManagers, seasonWeeks, currentWeek, onGoToMatchup }) {
  const [highlightWeek, setHighlightWeek] = useState(null);
  const weeks = Array.from({ length: seasonWeeks }, (_, i) => i + 1);
  const rows = [
    ...afcManagers.map(m => ({ manager: m, conf: 'AFC' })),
    ...nfcManagers.map(m => ({ manager: m, conf: 'NFC' }))
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <label className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)]">Highlight Week</label>
        <select
          value={highlightWeek ?? ""}
          onChange={(e) => setHighlightWeek(e.target.value ? Number(e.target.value) : null)}
          className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm rounded-lg px-3 py-1.5 text-[var(--text)]"
        >
          <option value="">None</option>
          {weeks.map(w => <option key={w} value={w}>Week {w}{w === currentWeek ? " (current)" : ""}</option>)}
        </select>
        {highlightWeek != null && (
          <button type="button" onClick={() => setHighlightWeek(null)} className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]">
            Clear
          </button>
        )}
      </div>

      <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl overflow-auto scroll-thin max-h-[75vh]">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th
                style={{ width: TEAM_COL_WIDTH, maxWidth: TEAM_COL_WIDTH }}
                className="sticky top-0 left-0 z-30 bg-[var(--surface)] border-b border-r border-[var(--border)]/80 px-3 py-2 text-left tracking-wider uppercase font-semibold text-[var(--muted)] overflow-hidden"
              >
                Team
              </th>
              {weeks.map(w => {
                const isCurrent = w === currentWeek;
                const isHighlighted = w === highlightWeek;
                return (
                  <th
                    key={w}
                    style={isCurrent ? { left: TEAM_COL_WIDTH } : undefined}
                    className={`sticky top-0 bg-[var(--surface)] border-b border-[var(--border)]/80 px-2 py-2 font-semibold whitespace-nowrap ${
                      isCurrent ? "z-20 border-r border-[var(--border)]/80 shadow-[2px_0_4px_rgba(0,0,0,0.08)] text-[var(--accent)]" : isHighlighted ? "text-violet-400" : "text-[var(--muted)]"
                    }`}
                  >
                    Wk {w}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ manager, conf }) => {
              const season = conf === 'AFC' ? afcSeason : nfcSeason;
              return (
                <GridRow
                  key={`${conf}-${manager}`}
                  manager={manager} conf={conf} season={season} weeks={weeks}
                  crossSchedule={crossSchedule} currentWeek={currentWeek} highlightWeek={highlightWeek}
                  onGoToMatchup={onGoToMatchup}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// A sticky/frozen cell MUST have a fully opaque background -- unlike a normal in-flow cell, other
// columns' content scrolls right underneath it, and any translucency (even a light Tailwind /10
// tint) lets that scrolled content visibly ghost through blended with the frozen cell's own text.
// color-mix produces a genuinely opaque solid (no alpha channel) regardless of how faint the tint
// looks, which a Tailwind `bg-color/opacity` utility can't guarantee here.
function opaqueTint(pct) {
  return pct > 0 ? { backgroundColor: `color-mix(in srgb, var(--accent) ${pct}%, var(--surface))` } : { backgroundColor: 'var(--surface)' };
}

function GridRow({ manager, conf, season, weeks, crossSchedule, currentWeek, highlightWeek, onGoToMatchup }) {
  const isMe = useIsMyTeam(manager);
  return (
    <tr className={isMe ? "bg-[var(--accent)]/10" : "hover:bg-[var(--surface2)]/40"}>
      {/* width/maxWidth pinned via inline style AND overflow-hidden -- a plain `width` on a <td>
          is only a hint in the browser's auto table-layout; a long team name would otherwise grow
          this column past TEAM_COL_WIDTH, which would then no longer line up with the `left`
          offset the frozen current-week column below assumes, and the two would visibly overlap. */}
      <td
        style={{ width: TEAM_COL_WIDTH, maxWidth: TEAM_COL_WIDTH, ...opaqueTint(isMe ? 15 : 0) }}
        className="sticky left-0 z-10 border-r border-b border-[var(--border)]/60 px-3 py-1.5 overflow-hidden"
      >
        <div className="flex items-center gap-1 min-w-0">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${CONF_STYLES[conf].badge}`}>{conf}</span>
          <TeamName manager={manager} conf={conf} className="font-semibold min-w-0" />
        </div>
      </td>
      {weeks.map(w => {
        const isCurrent = w === currentWeek;
        const isHighlighted = w === highlightWeek;
        const intraOpponent = findOpponent(season.scheduleByWeek[w], manager);
        const crossMatch = crossSchedule.find(m => m.week === w && (m.afcTeam === manager || m.nfcTeam === manager));
        const interOpponent = crossMatch ? (crossMatch.afcTeam === manager ? crossMatch.nfcTeam : crossMatch.afcTeam) : null;
        // Normal (non-frozen) cells can use a plain translucent Tailwind tint fine -- nothing
        // scrolls underneath them. The frozen current-week cell needs the opaque color-mix instead.
        const bgClass = !isCurrent && isHighlighted ? "bg-violet-400/15" : "";
        return (
          <td
            key={w}
            style={{
              ...(isCurrent ? { left: TEAM_COL_WIDTH } : {}),
              ...(isCurrent ? opaqueTint(isHighlighted ? 0 : isMe ? 15 : 5) : {}),
              ...(isCurrent && isHighlighted ? { backgroundColor: 'color-mix(in srgb, #a78bfa 15%, var(--surface))' } : {})
            }}
            className={`border-b border-[var(--border)]/40 px-2 py-1.5 text-center cursor-pointer hover:bg-[var(--surface2)]/60 ${bgClass} ${
              isCurrent ? "sticky z-10 border-r border-[var(--border)]/60 shadow-[2px_0_4px_rgba(0,0,0,0.08)]" : ""
            }`}
            onClick={() => onGoToMatchup?.(manager, w)}
            title={`${manager} -- Week ${w}`}
          >
            <div className="truncate max-w-[7rem] font-semibold">{intraOpponent || "--"}</div>
            <div className="truncate max-w-[7rem] text-[var(--muted)]">{interOpponent || "--"}</div>
          </td>
        );
      })}
    </tr>
  );
}
