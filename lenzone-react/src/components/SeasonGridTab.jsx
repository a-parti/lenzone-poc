import React from 'react';
import { CONF_STYLES } from '../lib/theme';

function findOpponent(pairs, manager) {
  const pair = (pairs || []).find(([a, b]) => a === manager || b === manager);
  if (!pair) return null;
  return pair[0] === manager ? pair[1] : pair[0];
}

// One big grid: every manager (rows) × every week (columns), so the whole league's schedule is
// visible at a glance instead of one team at a time. Each cell shows that manager's in-conference
// opponent (bold) and cross-conference opponent (smaller, muted) for that week -- the same two
// matchups ScheduleTab already computes per-team, just laid out for everyone at once. Sticky first
// column (manager) and header row (week) since this is wide/tall enough to need scrolling either way.
export default function SeasonGridTab({ afcSeason, nfcSeason, crossSchedule, afcManagers, nfcManagers, seasonWeeks, currentWeek, onGoToMatchup }) {
  const weeks = Array.from({ length: seasonWeeks }, (_, i) => i + 1);
  const rows = [
    ...afcManagers.map(m => ({ manager: m, conf: 'AFC' })),
    ...nfcManagers.map(m => ({ manager: m, conf: 'NFC' }))
  ];

  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl overflow-auto scroll-thin max-h-[75vh]">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-20 bg-[var(--surface)] border-b border-r border-[var(--border)]/80 px-3 py-2 text-left tracking-wider uppercase font-semibold text-[var(--muted)]">
              Manager
            </th>
            {weeks.map(w => (
              <th
                key={w}
                className={`sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--border)]/80 px-2 py-2 font-semibold whitespace-nowrap ${
                  w === currentWeek ? "text-[var(--accent)]" : "text-[var(--muted)]"
                }`}
              >
                Wk {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ manager, conf }) => {
            const season = conf === 'AFC' ? afcSeason : nfcSeason;
            return (
              <tr key={`${conf}-${manager}`} className="hover:bg-[var(--surface2)]/40">
                <td className={`sticky left-0 z-10 bg-[var(--surface)] border-r border-b border-[var(--border)]/60 px-3 py-1.5 whitespace-nowrap`}>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full mr-1.5 ${CONF_STYLES[conf].badge}`}>{conf}</span>
                  <span className="font-semibold">{manager}</span>
                </td>
                {weeks.map(w => {
                  const intraOpponent = findOpponent(season.scheduleByWeek[w], manager);
                  const crossMatch = crossSchedule.find(m => m.week === w && (m.afcTeam === manager || m.nfcTeam === manager));
                  const interOpponent = crossMatch ? (crossMatch.afcTeam === manager ? crossMatch.nfcTeam : crossMatch.afcTeam) : null;
                  return (
                    <td
                      key={w}
                      className={`border-b border-[var(--border)]/40 px-2 py-1.5 text-center cursor-pointer hover:bg-[var(--surface2)]/60 ${w === currentWeek ? "bg-[var(--accent)]/5" : ""}`}
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
          })}
        </tbody>
      </table>
    </div>
  );
}
