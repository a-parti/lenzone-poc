import React, { useMemo } from 'react';
import { playerLabel, projectedPoints } from '../lib/players';
import { InjuryBadge, NflTeamLogo } from './shared';
import { SCORE_COLOR, scoreState } from '../lib/theme';
import WeeklyHighlights from './WeeklyHighlights';
import PlayerNameButton from './PlayerNameButton';
import ManagerMatchupRow from './ManagerMatchupRow';

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

// Real NFL games for the selected week. Kickoff time + live state come from ESPN's public
// scoreboard where available (Sleeper's own schedule feed only has a date); otherwise falls back
// to the date, never a fabricated time.
function GamesThisWeek({ games, week, myTeamNflTeams, myPlayersByNflTeam }) {
  const weekGames = (games || [])
    .filter(g => g.week === week && g.home && g.away)
    .sort((a, b) => (a.kickoff || a.date || "").localeCompare(b.kickoff || b.date || ""));
  const scrollRef = React.useRef(null);
  const focusRowRef = React.useRef(null);
  // Default scroll position: the live game if one is in progress, else the next upcoming game.
  // Scrolls only this card's own internal list -- never the page (scrollIntoView would also drag
  // the whole window down to reveal a row buried near the bottom of the page).
  React.useEffect(() => {
    const container = scrollRef.current;
    const row = focusRowRef.current;
    if (!container || !row) return;
    container.scrollTop = row.offsetTop - container.offsetTop;
  }, [weekGames.length]);
  if (weekGames.length === 0) return null;
  const now = Date.now();
  const liveIdx = weekGames.findIndex(g => g.state === 'in');
  const nextIdx = liveIdx >= 0 ? liveIdx : weekGames.findIndex(g => {
    const isFinal = g.state === 'post' || g.status === 'complete';
    if (isFinal) return false;
    return !g.kickoff || new Date(g.kickoff).getTime() >= now;
  });
  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)] rounded-2xl p-6">
      <p className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)] mb-4">NFL Games &middot; Week {week}</p>
      <div ref={scrollRef} className="space-y-2 max-h-[28rem] overflow-y-auto scroll-thin pr-1">
        {weekGames.map((g, idx) => {
          const involvesMyTeam = myTeamNflTeams?.has(g.home) || myTeamNflTeams?.has(g.away);
          const isLive = g.state === 'in';
          const isFinal = g.state === 'post' || g.status === 'complete';
          const kickoffLabel = g.kickoff
            ? new Date(g.kickoff).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
            : g.date
              ? new Date(`${g.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
              : '';
          const awayPlayers = myPlayersByNflTeam?.get(g.away);
          const homePlayers = myPlayersByNflTeam?.get(g.home);
          return (
            <div
              key={g.game_id}
              ref={idx === nextIdx ? focusRowRef : null}
              className={`rounded-xl px-4 py-3 border ${
                // A game with one of your players gets a different color per status -- amber while
                // it's actually live (most urgent), green once it's done (--pos, "this is locked
                // in"), accent while it just hasn't kicked off yet -- so glancing at the list alone
                // tells you which of your players' games still need watching. Games with none of
                // your players stay neutral regardless of status.
                involvesMyTeam
                  ? isLive
                    ? "bg-amber-400/10 border-amber-400/60"
                    : isFinal
                      ? "bg-[var(--pos)]/10 border-[var(--pos)]/60"
                      : "bg-[var(--accent)]/10 border-[var(--accent)]/60"
                  : "bg-[var(--surface2)]/50 border-transparent"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                  <NflTeamLogo team={g.away} />
                  <span className="text-[var(--muted)] shrink-0 text-xs">@</span>
                  <NflTeamLogo team={g.home} />
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
                <div className="mt-1.5 pl-11 space-y-0.5">
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

export default function CurrentWeekView({
  onGoToMatchup, selectedWeek, isWeekFinal, weeklyAwards, nflGames, myTeamNflTeams,
  myTeamManager, myTeamIntra, myTeamInter, myTeamConf, myTeamRoster, myTeamConfData, myTeamFallbackField, myTeamPlayersPoints,
  playersDB, weekProjections, byTeamWeek, afcSlots, nfcSlots
}) {
  const goToManagerMatchup = (manager) => onGoToMatchup(manager);
  const myPlayersByNflTeam = useMemo(() => {
    const map = new Map();
    (myTeamRoster?.players || []).forEach(pid => {
      const p = playerLabel(playersDB, pid);
      if (!p?.team) return;
      const real = myTeamPlayersPoints?.[pid];
      const proj = myTeamConfData ? projectedPoints(weekProjections, pid, myTeamConfData.scoringSettings, myTeamFallbackField) : null;
      if (!map.has(p.team)) map.set(p.team, []);
      map.get(p.team).push({
        playerId: pid, name: p.name, position: p.position, number: p.number,
        realPts: real > 0 ? real : null, projPts: proj,
        isBench: !(myTeamRoster.starters || []).includes(pid),
        injuryStatus: p.injuryStatus
      });
    });
    return map;
  }, [myTeamRoster, playersDB, myTeamPlayersPoints, weekProjections, myTeamConfData, myTeamFallbackField]);

  return (
    <div className="space-y-10 max-w-7xl mx-auto w-full">
      <div className="space-y-3">
        <p className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">This Week (Week {selectedWeek})</p>
        <WeeklyHighlights
          awards={weeklyAwards} week={selectedWeek} isWeekFinal={isWeekFinal}
          onSelectManager={goToManagerMatchup}
        />
      </div>

      {myTeamManager && (
        <div className="space-y-3 w-full">
          <div className="flex items-center justify-between">
            <p className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">Your Matchups</p>
            <button
              type="button"
              onClick={() => goToManagerMatchup(myTeamManager)}
              className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-ink)]"
            >
              Full Matchups Tab &rarr;
            </button>
          </div>
          {/* Same component as the Matchups tab -- identical scores, win%, and "Expand Rosters"
              (both sides' full lineups) so nothing here can drift from what that tab shows. */}
          <ManagerMatchupRow
            manager={myTeamManager} conf={myTeamConf} intra={myTeamIntra} inter={myTeamInter}
            afcSlots={afcSlots} nfcSlots={nfcSlots} playersDB={playersDB}
            weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={selectedWeek}
          />
        </div>
      )}

      <GamesThisWeek games={nflGames} week={selectedWeek} myTeamNflTeams={myTeamNflTeams} myPlayersByNflTeam={myPlayersByNflTeam} />
    </div>
  );
}
