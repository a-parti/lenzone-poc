import React, { useMemo, useRef, useEffect } from 'react';
import { InjuryBadge, NflTeamLogo } from './shared';
import { SCORE_COLOR, scoreState } from '../lib/theme';
import PlayerNameButton from './PlayerNameButton';

function MyPlayersLine({ team, players, isLive }) {
  return (
    <div className="text-xs flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="font-bold text-[var(--text2)]">{team}:</span>
      {players.map((p, i) => {
        const hasActual = p.realPts != null;
        const ptsColor = hasActual ? SCORE_COLOR[scoreState({ hasActual: true, isLive })] : "text-[var(--proj)]";
        return (
          <React.Fragment key={p.playerId}>
            <span className={`inline-flex items-center gap-1 ${p.isBench ? "opacity-60" : ""}`}>
              {p.isBench && (
                <span className="text-[9px] font-bold uppercase px-1 rounded bg-[var(--surface2)] text-[var(--muted)] border border-[var(--border)]">Bench</span>
              )}
              <PlayerNameButton playerId={p.playerId} name={p.name} position={p.position} className={`font-medium ${p.isBench ? "text-[var(--text2)]" : "text-[var(--accent)]"}`} />
              <span className="text-[var(--muted)]">({p.position}{p.number != null ? ` - #${p.number}` : ""} - </span>
              {(hasActual || p.projPts != null) && (
                <span className={`font-semibold ${ptsColor}`}>{hasActual ? p.realPts.toFixed(1) : `${p.projPts.toFixed(1)} proj`}</span>
              )}
              <span className="text-[var(--muted)]">)</span>
              <InjuryBadge status={p.injuryStatus} />
            </span>
            {i < players.length - 1 && <span className="text-[var(--muted)]">&middot;</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// How many players ROSTERED ANYWHERE in the league (both conferences combined, not just your own
// team) belong to each real NFL team -- lets a game with none of YOUR players still surface "6
// rostered" so it's obvious there's league-relevant action worth clicking into.
function countRosteredByTeam(playersDB, afcOwners, nfcOwners) {
  const counts = {};
  if (!playersDB) return counts;
  const ids = new Set([...Object.keys(afcOwners || {}), ...Object.keys(nfcOwners || {})]);
  ids.forEach(pid => {
    const team = playersDB[pid]?.team;
    if (!team) return;
    const n = (afcOwners?.[pid] ? 1 : 0) + (nfcOwners?.[pid] ? 1 : 0);
    counts[team] = (counts[team] || 0) + n;
  });
  return counts;
}

// Real NFL games for the selected week, current/upcoming only (a finished game has nothing left to
// watch). Kickoff time + live state come from ESPN's public scoreboard where available (Sleeper's
// own schedule feed only has a date); otherwise falls back to the date, never a fabricated time.
// Shared by the Home "This Week" landing page and the Matchups tab's own "This Week" view so the
// two never drift into showing different things for the same week.
export default function NflGamesPanel({ games, week, myTeamNflTeams, myPlayersByNflTeam, playersDB, afcOwners, nfcOwners, selectedGame, onSelectGame }) {
  const rosteredCounts = useMemo(() => countRosteredByTeam(playersDB, afcOwners, nfcOwners), [playersDB, afcOwners, nfcOwners]);
  const weekGames = (games || [])
    .filter(g => g.week === week && g.home && g.away && g.state !== 'post' && g.status !== 'complete')
    .sort((a, b) => (a.kickoff || a.date || "").localeCompare(b.kickoff || b.date || ""));
  const scrollRef = useRef(null);
  const focusRowRef = useRef(null);
  // Default scroll position: the live game if one is in progress, else the next upcoming game.
  // Scrolls only this card's own internal list -- never the page (scrollIntoView would also drag
  // the whole window down to reveal a row buried near the bottom of the page).
  useEffect(() => {
    const container = scrollRef.current;
    const row = focusRowRef.current;
    if (!container || !row) return;
    container.scrollTop = row.offsetTop - container.offsetTop;
  }, [weekGames.length]);
  if (weekGames.length === 0) return null;
  const now = Date.now();
  const liveIdx = weekGames.findIndex(g => g.state === 'in');
  const nextIdx = liveIdx >= 0 ? liveIdx : weekGames.findIndex(g => !g.kickoff || new Date(g.kickoff).getTime() >= now);
  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">NFL Games &middot; Week {week}</p>
        {selectedGame && (
          <button type="button" onClick={() => onSelectGame?.(null)} className="text-[10px] font-semibold text-[var(--accent)] hover:text-[var(--accent-ink)]">
            Clear Highlight
          </button>
        )}
      </div>
      <div ref={scrollRef} className="space-y-2 max-h-[28rem] overflow-y-auto scroll-thin pr-1">
        {weekGames.map((g, idx) => {
          const involvesMyTeam = myTeamNflTeams?.has(g.home) || myTeamNflTeams?.has(g.away);
          const isLive = g.state === 'in';
          const isSelected = selectedGame && selectedGame.home === g.home && selectedGame.away === g.away;
          const kickoffLabel = g.kickoff
            ? new Date(g.kickoff).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
            : g.date
              ? new Date(`${g.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
              : '';
          const awayPlayers = myPlayersByNflTeam?.get(g.away);
          const homePlayers = myPlayersByNflTeam?.get(g.home);
          const awayCount = rosteredCounts[g.away] || 0;
          const homeCount = rosteredCounts[g.home] || 0;
          return (
            <div
              key={g.game_id}
              ref={idx === nextIdx ? focusRowRef : null}
              role={onSelectGame ? "button" : undefined}
              tabIndex={onSelectGame ? 0 : undefined}
              onClick={onSelectGame ? () => onSelectGame(isSelected ? null : { home: g.home, away: g.away }) : undefined}
              onKeyDown={onSelectGame ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectGame(isSelected ? null : { home: g.home, away: g.away }); } } : undefined}
              className={`rounded-xl px-4 py-3 border transition-all duration-150 ${onSelectGame ? "cursor-pointer" : ""} ${
                // A game with one of your players gets a different color per status -- amber while
                // it's actually live (most urgent), accent while it just hasn't kicked off yet --
                // so glancing at the list alone tells you which of your players' games still need
                // watching. Games with none of your players stay neutral. Only live/upcoming games
                // ever reach this row (finals are filtered out above), so there's no "final" state
                // to color here. A clicked-to-highlight game gets its own ring regardless.
                isSelected
                  ? "bg-[var(--accent)]/15 border-[var(--accent)] ring-1 ring-[var(--accent)]"
                  : involvesMyTeam
                    ? isLive
                      ? "bg-amber-400/10 border-amber-400/60"
                      : "bg-[var(--accent)]/10 border-[var(--accent)]/60"
                    : "bg-[var(--surface2)]/50 border-transparent"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
                <div className="flex items-center gap-1 min-w-0 flex-wrap" onClick={(e) => e.stopPropagation()} title="Players rostered somewhere in the league">
                  <NflTeamLogo team={g.away} />
                  {awayCount > 0 && <span className="text-[9px] font-mono text-[var(--muted)] bg-[var(--surface2)]/70 rounded-full px-1.5 shrink-0">{awayCount}</span>}
                  <span className="text-[var(--muted)] shrink-0 text-xs">@</span>
                  <NflTeamLogo team={g.home} />
                  {homeCount > 0 && <span className="text-[9px] font-mono text-[var(--muted)] bg-[var(--surface2)]/70 rounded-full px-1.5 shrink-0">{homeCount}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  {isLive && g.awayScore != null && g.homeScore != null && (
                    <span className="font-mono tabular-nums font-bold text-[var(--text)]">{g.awayScore} - {g.homeScore}</span>
                  )}
                  {isLive ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Live Q{g.period} {g.displayClock}
                    </span>
                  ) : (
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      g.status === 'canceled' ? 'text-red-400' : 'text-[var(--muted)]'
                    }`}>
                      {g.status === 'canceled' ? 'Canceled' : kickoffLabel}
                    </span>
                  )}
                </div>
              </div>
              {(awayPlayers?.length > 0 || homePlayers?.length > 0) && (
                <div className="mt-1.5 pl-11 space-y-0.5" onClick={(e) => e.stopPropagation()}>
                  {awayPlayers?.length > 0 && <MyPlayersLine team={g.away} players={awayPlayers} isLive={isLive} />}
                  {homePlayers?.length > 0 && <MyPlayersLine team={g.home} players={homePlayers} isLive={isLive} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
