import React, { useState } from 'react';
import { CONF_STYLES } from '../lib/theme';
import { useIsMyTeam } from '../context/MyTeamContext';
import { useMatchupPreview } from '../context/MatchupPreviewContext';
import TeamName from './TeamName';

const TEAM_COL_WIDTH = 232; // px -- fixed so the sticky team column has a stable width

function findOpponent(pairs, manager) {
  const pair = (pairs || []).find(([a, b]) => a === manager || b === manager);
  if (!pair) return null;
  return pair[0] === manager ? pair[1] : pair[0];
}

// One big grid: every manager (rows) x every week (columns), so the whole league's schedule is
// visible at a glance instead of one team at a time. Each cell shows that manager's in-conference
// opponent (bold) and cross-conference opponent (smaller, muted) for that week -- the same two
// matchups ScheduleTab already computes per-team, just laid out for everyone at once. Sticky first
// column (team) and header row (week) since this is wide/tall enough to need scrolling either way
// -- just the team column, though; the current week is only called out with color/tint, not
// frozen in place, so scrolling right doesn't leave two separate frozen columns competing for
// attention.
export default function SeasonGridTab({ afcSeason, nfcSeason, crossSchedule, afcManagers, nfcManagers, seasonWeeks, currentWeek, latestCompletedWeek }) {
  // Clicking a week's own header toggles highlighting it -- click the same week again (or a
  // different one) to change/clear it, no separate dropdown control needed.
  const [highlightWeek, setHighlightWeek] = useState(null);
  const toggleHighlight = (w) => setHighlightWeek(prev => (prev === w ? null : w));
  const weeks = Array.from({ length: seasonWeeks }, (_, i) => i + 1);
  const rows = [
    ...afcManagers.map(m => ({ manager: m, conf: 'AFC' })),
    ...nfcManagers.map(m => ({ manager: m, conf: 'NFC' }))
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted)]">Click a week's header to highlight it{highlightWeek != null ? ` -- Week ${highlightWeek} highlighted` : ""}.</p>

      <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl overflow-auto scroll-thin max-h-[75vh] flex items-start">
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
                    onClick={() => toggleHighlight(w)}
                    className={`sticky top-0 bg-[var(--surface)] border-b border-[var(--border)]/80 px-2 py-2 font-semibold whitespace-nowrap cursor-pointer hover:text-[var(--text)] select-none ${
                      isCurrent ? "text-[var(--accent)]" : isHighlighted ? "text-violet-400" : "text-[var(--muted)]"
                    }`}
                    title={`Click to ${isHighlighted ? "clear" : "highlight"} Week ${w}`}
                  >
                    Wk {w}{isCurrent ? " •" : ""}{isHighlighted ? " ●" : ""}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ manager, conf }) => {
              const season = conf === 'AFC' ? afcSeason : nfcSeason;
              const oppSeason = conf === 'AFC' ? nfcSeason : afcSeason;
              return (
                <GridRow
                  key={`${conf}-${manager}`}
                  manager={manager} conf={conf} season={season} oppSeason={oppSeason} weeks={weeks}
                  crossSchedule={crossSchedule} currentWeek={currentWeek} highlightWeek={highlightWeek}
                  latestCompletedWeek={latestCompletedWeek}
                />
              );
            })}
          </tbody>
        </table>
        {/* Trailing spacer so ANY week column -- including the last -- can be scrolled well clear
            of the container's right edge, not just barely past it, giving plenty of room to pull a
            single week into isolated view. */}
        <div className="shrink-0" style={{ width: '60vw', minWidth: 320 }} aria-hidden="true" />
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

// W/L/T for `manager` in a given week against a given real opponent score, from that side's own
// season.scoreByWeek -- real posted scores only (no games played yet just reads as no result).
function resultFor(myScore, oppScore) {
  if (!(myScore > 0 && oppScore > 0)) return null;
  return myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
}
const RESULT_TEXT = { W: 'text-[var(--pos)]', L: 'text-[var(--neg)]', T: 'text-[var(--muted)]' };
const RESULT_BG = { W: 'bg-[var(--pos)]/10', L: 'bg-[var(--neg)]/10', T: '' };

function GridRow({ manager, conf, season, oppSeason, weeks, crossSchedule, currentWeek, highlightWeek, latestCompletedWeek }) {
  const isMe = useIsMyTeam(manager);
  const { openPreview } = useMatchupPreview();
  return (
    <tr className={isMe ? "bg-[var(--accent)]/10" : "hover:bg-[var(--surface2)]/40"}>
      {/* width/maxWidth pinned via inline style AND overflow-hidden -- a plain `width` on a <td>
          is only a hint in the browser's auto table-layout; a long team name would otherwise grow
          this column past TEAM_COL_WIDTH. */}
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
        const isCompleted = latestCompletedWeek != null && w <= latestCompletedWeek;
        const intraResult = isCompleted ? resultFor(season.scoreByWeek[w]?.[manager], season.scoreByWeek[w]?.[intraOpponent]) : null;
        const interResult = isCompleted ? resultFor(season.scoreByWeek[w]?.[manager], oppSeason?.scoreByWeek[w]?.[interOpponent]) : null;
        // A completed week's W/L tint takes priority visually over the plain highlight-week tint,
        // but only when there isn't already a highlight -- highlighting a week is a deliberate user
        // action ("show me week X specifically"), so it should still read clearly on top. The
        // current week gets a light accent tint of its own (not frozen/sticky -- just a normal
        // translucent tint, since nothing scrolls underneath a non-sticky cell).
        const resultBg = !isHighlighted && intraResult ? RESULT_BG[intraResult] : "";
        const currentBg = isCurrent && !isHighlighted && !resultBg ? "bg-[var(--accent)]/10" : "";
        const bgClass = `${isHighlighted ? "bg-violet-400/15" : ""} ${currentBg} ${resultBg}`;
        return (
          <td
            key={w}
            className={`border-b border-[var(--border)]/40 px-2 py-1.5 text-center cursor-pointer hover:bg-[var(--surface2)]/60 ${bgClass}`}
            onClick={() => openPreview(manager, conf, w)}
            title={`${manager} -- Week ${w}`}
          >
            <div className="truncate max-w-[7rem] font-semibold flex items-center justify-center gap-1">
              {intraResult && <span className={`text-xs font-black ${RESULT_TEXT[intraResult]}`}>{intraResult}</span>}
              <span className="truncate">{intraOpponent || "--"}</span>
            </div>
            <div className="truncate max-w-[7rem] text-[var(--muted)] flex items-center justify-center gap-1">
              {interResult && <span className={`text-xs font-black ${RESULT_TEXT[interResult]}`}>{interResult}</span>}
              <span className="truncate">{interOpponent || "--"}</span>
            </div>
          </td>
        );
      })}
    </tr>
  );
}
