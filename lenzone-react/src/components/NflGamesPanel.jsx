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
        const ptsColor = hasActual ? SCORE_COLOR[scoreState({ hasActual: true, isLive, actual: p.realPts, projected: p.projPts })] : "text-[var(--proj)]";
        return (
          <React.Fragment key={p.playerId}>
            <span className={`inline-flex items-center gap-1 ${p.isBench ? "opacity-60" : ""}`}>
              {p.isBench && (
                <span className="text-[9px] font-bold uppercase px-1 rounded bg-[var(--surface2)] text-[var(--muted)] border border-[var(--border)]">Bench</span>
              )}
              <PlayerNameButton playerId={p.playerId} name={p.name} position={p.position} className={`font-medium ${p.isBench ? "text-[var(--text2)]" : "text-[var(--accent)]"}`} />
              <span className="text-[var(--muted)]">({p.position}{p.number != null ? ` - #${p.number}` : ""} - </span>
              {(hasActual || p.projPts != null) && (
                <span className={`font-semibold ${ptsColor}`}>{hasActual ? p.realPts.toFixed(2) : `${p.projPts.toFixed(2)} proj`}</span>
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

// How many STARTING lineup spots (both conferences combined, bench excluded) belong to each real
// NFL team this week -- a bench-inclusive count was confusing (a number with no visible meaning
// next to a team logo); "how many starters are in this game" is the number that's actually
// actionable -- it tells you how many fantasy lineups this game can swing right now.
function countStartersByTeam(playersDB, afcData, nfcData) {
  const counts = {};
  if (!playersDB) return counts;
  const starterIds = [
    ...(afcData?.rosters || []).flatMap(r => r.starters || []),
    ...(nfcData?.rosters || []).flatMap(r => r.starters || [])
  ];
  starterIds.forEach(pid => {
    if (!pid || pid === '0') return;
    const team = playersDB[pid]?.team;
    if (!team) return;
    counts[team] = (counts[team] || 0) + 1;
  });
  return counts;
}

// All real NFL games for the selected week, including ones already final -- a played game can
// still be clicked to highlight its players (e.g. reviewing who's in a Thursday-night game after
// the fact), so hiding it once it's over would remove exactly the games someone might want to
// select. Kickoff time + live state come from ESPN's public scoreboard where available (Sleeper's
// own schedule feed only has a date); otherwise falls back to the date, never a fabricated time.
// Shared by the Home "This Week" landing page and the Matchups tab's own "This Week" view so the
// two never drift into showing different things for the same week.
export default function NflGamesPanel({ games, week, myTeamNflTeams, myPlayersByNflTeam, playersDB, afcData, nfcData, selectedGames, onToggleGame, onClearGames }) {
  const starterCounts = useMemo(() => countStartersByTeam(playersDB, afcData, nfcData), [playersDB, afcData, nfcData]);
  const weekGames = (games || [])
    .filter(g => g.week === week && g.home && g.away)
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
  const nextIdx = liveIdx >= 0 ? liveIdx : weekGames.findIndex(g => {
    if (g.state === 'post' || g.status === 'complete') return false;
    return !g.kickoff || new Date(g.kickoff).getTime() >= now;
  });
  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">NFL Games &middot; Week {week}</p>
        {selectedGames?.length > 0 && (
          <button type="button" onClick={() => onClearGames?.()} className="text-[10px] font-semibold text-[var(--accent)] hover:text-[var(--accent-ink)]">
            Clear Highlight{selectedGames.length > 1 ? ` (${selectedGames.length})` : ""}
          </button>
        )}
      </div>
      <p className="text-[10px] text-[var(--muted)] mb-3">Small numbers = fantasy starters league-wide on that team this week.</p>
      <div ref={scrollRef} className="space-y-2 max-h-[28rem] overflow-y-auto scroll-thin pr-1">
        {weekGames.map((g, idx) => {
          const involvesMyTeam = myTeamNflTeams?.has(g.home) || myTeamNflTeams?.has(g.away);
          const isLive = g.state === 'in';
          const isFinal = g.state === 'post' || g.status === 'complete';
          const isSelected = selectedGames?.some(sg => sg.home === g.home && sg.away === g.away);
          const kickoffLabel = g.kickoff
            ? new Date(g.kickoff).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
            : g.date
              ? new Date(`${g.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
              : '';
          const awayPlayers = myPlayersByNflTeam?.get(g.away);
          const homePlayers = myPlayersByNflTeam?.get(g.home);
          const awayCount = starterCounts[g.away] || 0;
          const homeCount = starterCounts[g.home] || 0;
          return (
            <div
              key={g.game_id}
              ref={idx === nextIdx ? focusRowRef : null}
              role={onToggleGame ? "button" : undefined}
              tabIndex={onToggleGame ? 0 : undefined}
              onClick={onToggleGame ? () => onToggleGame({ home: g.home, away: g.away }) : undefined}
              onKeyDown={onToggleGame ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleGame({ home: g.home, away: g.away }); } } : undefined}
              className={`rounded-xl px-4 py-3 border transition-all duration-150 ${onToggleGame ? "cursor-pointer" : ""} ${
                // A game with one of your players gets a different color per status -- amber while
                // it's actually live (most urgent), accent while it just hasn't kicked off yet, a
                // plain neutral surface once it's final (nothing left to watch there) -- so glancing
                // at the list alone tells you which of your players' games still need watching.
                // Games with none of your players stay neutral throughout. A clicked-to-highlight
                // game gets its own ring regardless of status.
                isSelected
                  ? "bg-[var(--accent)]/15 border-[var(--accent)] ring-1 ring-[var(--accent)]"
                  : involvesMyTeam && !isFinal
                    ? isLive
                      ? "bg-amber-400/10 border-amber-400/60"
                      : "bg-[var(--accent)]/10 border-[var(--accent)]/60"
                    : "bg-[var(--surface2)]/50 border-transparent"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
                <div className="flex items-center gap-1 min-w-0 flex-wrap" onClick={(e) => e.stopPropagation()} title="Fantasy starters league-wide on this team this week">
                  <NflTeamLogo team={g.away} />
                  {awayCount > 0 && <span className="text-[9px] font-mono text-[var(--muted)] bg-[var(--surface2)]/70 rounded-full px-1.5 shrink-0">{awayCount}</span>}
                  <span className="text-[var(--muted)] shrink-0 text-xs">@</span>
                  <NflTeamLogo team={g.home} />
                  {homeCount > 0 && <span className="text-[9px] font-mono text-[var(--muted)] bg-[var(--surface2)]/70 rounded-full px-1.5 shrink-0">{homeCount}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  {(isLive || isFinal) && g.awayScore != null && g.homeScore != null && (
                    <span className="font-mono tabular-nums font-bold text-[var(--text)]">{g.awayScore} - {g.homeScore}</span>
                  )}
                  {isLive ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Live Q{g.period} {g.displayClock}
                    </span>
                  ) : (
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      isFinal ? 'text-emerald-400' : g.status === 'canceled' ? 'text-red-400' : 'text-[var(--muted)]'
                    }`}>
                      {isFinal ? 'Final' : g.status === 'canceled' ? 'Canceled' : kickoffLabel}
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
