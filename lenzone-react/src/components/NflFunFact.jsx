import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { NFL_TEAM_NAMES, nflTeamLogoUrl } from '../lib/nflTeams';

// This app has no concept of a manager's "favorite real NFL team" (only fantasy team ownership),
// so rather than guess or invent one, this always picks a genuinely random real team and labels
// it plainly as that -- every number shown is real, computed from actual ESPN results
// (lib/espnApi.js fetchSeasonResultsByTeam), never fabricated.
function computeStreak(results) {
  if (!results?.length) return null;
  const last = results[results.length - 1];
  let count = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].result !== last.result) break;
    count++;
  }
  const lastWin = [...results].reverse().find(r => r.result === 'W');
  const daysSinceLastWin = lastWin?.date ? Math.floor((Date.now() - new Date(lastWin.date).getTime()) / 86400000) : null;
  return { streakResult: last.result, streakCount: count, lastWin, daysSinceLastWin };
}

export default function NflFunFact({ resultsByTeam, seed }) {
  const teams = Object.keys(resultsByTeam || {});
  const pick = useMemo(() => {
    if (teams.length === 0) return null;
    // Stable for a given seed (e.g. the viewed week) so it doesn't re-roll on every unrelated
    // re-render, but still changes from week to week.
    const idx = Math.abs((seed || 0) * 2654435761 % teams.length);
    const team = teams[idx];
    const streak = computeStreak(resultsByTeam[team]);
    return streak ? { team, ...streak } : null;
  }, [teams.join('|'), seed]);

  if (!pick) return null;
  const teamName = NFL_TEAM_NAMES[pick.team] || pick.team;
  const logoUrl = nflTeamLogoUrl(pick.team);

  let fact;
  if (pick.streakResult === 'W' && pick.streakCount >= 2) {
    fact = `The ${teamName} are riding a ${pick.streakCount}-game win streak.`;
  } else if (pick.streakResult === 'L' && pick.streakCount >= 2) {
    fact = `The ${teamName} have dropped ${pick.streakCount} straight.`;
  } else if (pick.streakResult === 'L' && pick.daysSinceLastWin != null) {
    fact = `The ${teamName} haven't won in ${pick.daysSinceLastWin} day${pick.daysSinceLastWin === 1 ? '' : 's'} (last win: Week ${pick.lastWin.week} vs ${pick.lastWin.opponent}).`;
  } else if (pick.streakResult === 'W') {
    fact = `The ${teamName} won their most recent game.`;
  } else {
    fact = `The ${teamName} tied their most recent game. That still happens, apparently.`;
  }

  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4 flex items-center gap-3">
      <Sparkles className="w-4 h-4 text-[var(--accent)] shrink-0" />
      {logoUrl && <img src={logoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />}
      <div className="min-w-0">
        <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Random NFL Fact</p>
        <p className="text-sm font-semibold text-[var(--text)]">{fact}</p>
      </div>
    </div>
  );
}
