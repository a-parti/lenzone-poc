import React, { useMemo, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { NFL_TEAM_NAMES, nflTeamLogoUrl } from '../lib/nflTeams';

// This app has no concept of a manager's "favorite real NFL team" (only fantasy team ownership),
// so rather than guess or invent one, this always picks a genuinely random real team and labels
// it plainly as that. Every fact is computed from real ESPN season results
// (lib/espnApi.js fetchSeasonResultsByTeam) -- there's no free, verified NFL trivia/facts API to
// pull "historic" flavor from (checked live: Open Trivia DB's Sports category is soccer/Olympics/
// NHL trivia, nothing NFL-specific), and this app won't hardcode trivia from memory and present it
// as fact -- training-data recall of specific stats/records/dates isn't reliable enough for that.
// So instead, the pool of possible facts is wide (streaks, records, real scores, biggest win/loss
// margins, season point totals) and BOTH the team and which fact about them gets picked are
// re-rolled together every refresh, so it stays varied without ever inventing anything.

function oppName(abbr) {
  return NFL_TEAM_NAMES[abbr] || abbr;
}

// Builds every fact that's actually true for this team right now, from their real per-game
// results (each carries a real W/L/T, opponent, and final score) -- a fact is only included if
// its real precondition holds (e.g. a "biggest blowout win" fact needs an actual win with a
// double-digit margin to exist at all).
function buildFacts(results) {
  if (!results?.length) return [];
  const facts = [];
  const last = results[results.length - 1];

  let streakCount = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].result !== last.result) break;
    streakCount++;
  }
  if (last.result === 'W' && streakCount >= 2) facts.push(`are riding a ${streakCount}-game win streak`);
  if (last.result === 'L' && streakCount >= 2) facts.push(`have dropped ${streakCount} straight`);
  if (last.result === 'T') facts.push(`tied their most recent game, ${last.pointsFor}-${last.pointsAgainst} against the ${oppName(last.opponent)}`);
  if (last.result === 'W') facts.push(`beat the ${oppName(last.opponent)} ${last.pointsFor}-${last.pointsAgainst} in their most recent game`);
  if (last.result === 'L') facts.push(`lost to the ${oppName(last.opponent)} ${last.pointsAgainst}-${last.pointsFor} in their most recent game`);

  const wins = results.filter(r => r.result === 'W');
  const losses = results.filter(r => r.result === 'L');
  const ties = results.filter(r => r.result === 'T');
  facts.push(`are ${wins.length}-${losses.length}${ties.length ? `-${ties.length}` : ''} this season`);

  const pf = results.reduce((s, r) => s + (r.pointsFor || 0), 0);
  const pa = results.reduce((s, r) => s + (r.pointsAgainst || 0), 0);
  facts.push(`have scored ${pf} points and allowed ${pa} this season`);

  if (wins.length) {
    const biggest = wins.reduce((a, b) => (b.pointsFor - b.pointsAgainst) > (a.pointsFor - a.pointsAgainst) ? b : a);
    const margin = biggest.pointsFor - biggest.pointsAgainst;
    if (margin >= 14) facts.push(`blew out the ${oppName(biggest.opponent)} ${biggest.pointsFor}-${biggest.pointsAgainst} in Week ${biggest.week}`);
  }
  if (losses.length) {
    const worst = losses.reduce((a, b) => (b.pointsAgainst - b.pointsFor) > (a.pointsAgainst - a.pointsFor) ? b : a);
    const margin = worst.pointsAgainst - worst.pointsFor;
    if (margin >= 14) facts.push(`got blown out by the ${oppName(worst.opponent)} ${worst.pointsAgainst}-${worst.pointsFor} in Week ${worst.week}`);
  }
  if (wins.length === 0) facts.push(`are still looking for their first win this season`);

  return facts;
}

// seed: change this (e.g. the viewed week) to roll a new team+fact; refreshNonce (internal) lets
// the refresh button roll again without needing a new seed from the parent.
export default function NflFunFact({ resultsByTeam }) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const teams = Object.keys(resultsByTeam || {});

  const pick = useMemo(() => {
    if (teams.length === 0) return null;
    const teamIdx = Math.floor(Math.random() * teams.length);
    const team = teams[teamIdx];
    const facts = buildFacts(resultsByTeam[team]);
    if (facts.length === 0) return null;
    const fact = facts[Math.floor(Math.random() * facts.length)];
    return { team, fact };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.join('|'), refreshNonce]);

  if (!pick) return null;
  const teamName = NFL_TEAM_NAMES[pick.team] || pick.team;
  const logoUrl = nflTeamLogoUrl(pick.team);

  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl px-4 py-3 flex items-center gap-3">
      <Sparkles className="w-4 h-4 text-[var(--accent)] shrink-0" />
      {logoUrl && <img src={logoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Random NFL Fact</p>
        <p className="text-sm font-semibold text-[var(--text)]">The {teamName} {pick.fact}.</p>
      </div>
      <button
        type="button"
        onClick={() => setRefreshNonce(n => n + 1)}
        title="Show a different fact"
        aria-label="Show a different NFL fact"
        className="shrink-0 p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-colors duration-200"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
