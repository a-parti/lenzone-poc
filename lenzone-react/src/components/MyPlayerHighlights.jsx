import React, { useMemo } from 'react';
import { TrendingUp, Rocket, Skull, Target, Users, Zap, Footprints, Goal } from 'lucide-react';
import { computeMyPlayerHighlights, playerLabel, findMyBigPlay } from '../lib/players';
import { usePlayerModal } from '../context/PlayerModalContext';
import { PlayerCard, signed, ActualVsProjected } from './PlayerHighlights';

function MyBigPlayCard({ icon: Icon, label, play, accent, onClick }) {
  if (!play) return null;
  return (
    <div
      role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      className="text-left bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4 hover:border-[var(--border2)] hover:scale-[1.01] transition-all duration-200 w-full cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">{label}</span>
      </div>
      <p className={`font-mono font-bold text-lg ${accent}`}>{play.yards} yds</p>
      <p className="font-bold text-sm text-[var(--text)] truncate">{play.playerName}</p>
      <p className="text-[10px] text-[var(--muted)] leading-snug line-clamp-2 mt-1">{play.text}</p>
    </div>
  );
}

// Which single real NFL game has the most of the viewer's own starters in it -- e.g. two of your
// starters both playing in the same SEA @ ARI game. Uses the same myPlayersByNflTeam map the NFL
// games panel already builds (one player list per real NFL team), so this never disagrees with
// what that panel shows.
function findBusiestGame(nflGames, week, myPlayersByNflTeam) {
  if (!myPlayersByNflTeam) return null;
  let best = null;
  (nflGames || []).filter(g => g.week === week && g.home && g.away).forEach(g => {
    const count = (myPlayersByNflTeam.get(g.away)?.length || 0) + (myPlayersByNflTeam.get(g.home)?.length || 0);
    if (count > 0 && (!best || count > best.count)) best = { game: g, count };
  });
  return best;
}

// The same player "trophies" as the league-wide PlayerHighlights, but scoped to just the "I am"
// team's own starters -- your own highest projected, biggest riser/bust, plus which single game
// has the most of your players in it (worth clearing your schedule for).
export default function MyPlayerHighlights({
  myTeamRoster, myTeamPlayersPoints, weekProjections, myTeamConfData, myTeamFallbackField, playersDB, nflGames, week,
  myPlayersByNflTeam, onSelectGame, weekBigPlays
}) {
  const { openPlayer } = usePlayerModal();
  const highlights = useMemo(
    () => computeMyPlayerHighlights(myTeamRoster, myTeamPlayersPoints, weekProjections, myTeamConfData?.scoringSettings, myTeamFallbackField),
    [myTeamRoster, myTeamPlayersPoints, weekProjections, myTeamConfData, myTeamFallbackField]
  );
  const busiest = useMemo(() => findBusiestGame(nflGames, week, myPlayersByNflTeam), [nflGames, week, myPlayersByNflTeam]);
  // "Your" version of the league-wide NFL Big Plays cards -- same real ESPN play data, filtered
  // down to whichever of those plays is actually attributable to one of YOUR rostered players
  // (see findMyBigPlay's real-name-match heuristic).
  const myLongestPass = useMemo(() => findMyBigPlay(weekBigPlays?.passPlays, myPlayersByNflTeam), [weekBigPlays, myPlayersByNflTeam]);
  const myLongestRun = useMemo(() => findMyBigPlay(weekBigPlays?.runPlays, myPlayersByNflTeam), [weekBigPlays, myPlayersByNflTeam]);
  const myLongestFg = useMemo(() => findMyBigPlay(weekBigPlays?.fgPlays, myPlayersByNflTeam), [weekBigPlays, myPlayersByNflTeam]);
  const { highestProjected, highestActual, biggestRiser, biggestBust } = highlights;
  if (!highestProjected && !highestActual && !biggestRiser && !biggestBust && !busiest && !myLongestPass && !myLongestRun && !myLongestFg) return null;

  const openFor = (entry) => {
    const { position } = playerLabel(playersDB, entry.id);
    openPlayer(entry.id, position);
  };
  const kickoffLabel = (g) => g.kickoff
    ? new Date(g.kickoff).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : g.date
      ? new Date(`${g.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      : '';

  return (
    <div className="space-y-3">
      <p className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">Your Player Trophies</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <PlayerCard
          icon={Target} label="Highest Projected" entry={highestProjected} playersDB={playersDB}
          value={highestProjected ? `${highestProjected.projected.toFixed(2)} proj` : ""}
          accent="text-[var(--proj)]" onClick={() => openFor(highestProjected)}
        />
        <PlayerCard
          icon={TrendingUp} label="Top Actual Score" entry={highestActual} playersDB={playersDB}
          value={highestActual ? <ActualVsProjected actual={highestActual.actual} projected={highestActual.projected} accent="text-[var(--pos)]" /> : ""}
          accent="text-[var(--pos)]" onClick={() => openFor(highestActual)}
        />
        <PlayerCard
          icon={Rocket} label="Biggest Riser" entry={biggestRiser} playersDB={playersDB}
          value={biggestRiser ? (
            <div className="flex flex-col leading-tight">
              <ActualVsProjected actual={biggestRiser.actual} projected={biggestRiser.projected} accent="text-[var(--pos)]" />
              <span className="text-xs font-mono text-[var(--pos)]">{signed(biggestRiser.actual - biggestRiser.projected)} vs proj</span>
            </div>
          ) : ""}
          accent="text-[var(--pos)]" onClick={() => openFor(biggestRiser)}
        />
        <PlayerCard
          icon={Skull} label="Biggest Bust" entry={biggestBust} playersDB={playersDB}
          value={biggestBust ? (
            <div className="flex flex-col leading-tight">
              <ActualVsProjected actual={biggestBust.actual} projected={biggestBust.projected} accent="text-[var(--neg)]" />
              <span className="text-xs font-mono text-[var(--neg)]">{signed(biggestBust.actual - biggestBust.projected)} vs proj</span>
            </div>
          ) : ""}
          accent="text-[var(--neg)]" onClick={() => openFor(biggestBust)}
        />
        {busiest && (
          <button
            type="button"
            onClick={() => onSelectGame?.({ home: busiest.game.home, away: busiest.game.away })}
            className="text-left bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4 hover:border-[var(--border2)] hover:scale-[1.01] transition-all duration-200 w-full"
          >
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[var(--accent)]" />
              <span className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Game With Most Players</span>
            </div>
            <p className="font-bold text-sm text-[var(--text)]">{busiest.game.away} @ {busiest.game.home}</p>
            <p className="text-xs font-mono text-[var(--accent)] mt-1">{busiest.count} of yours &middot; {kickoffLabel(busiest.game)}</p>
          </button>
        )}
        {myLongestPass && (
          <MyBigPlayCard
            icon={Zap} label="Your Longest Pass" play={myLongestPass} accent="text-sky-400"
            onClick={() => openPlayer(myLongestPass.playerId, myLongestPass.position)}
          />
        )}
        {myLongestRun && (
          <MyBigPlayCard
            icon={Footprints} label="Your Longest Run" play={myLongestRun} accent="text-emerald-400"
            onClick={() => openPlayer(myLongestRun.playerId, myLongestRun.position)}
          />
        )}
        {myLongestFg && (
          <MyBigPlayCard
            icon={Goal} label="Your Longest FG" play={myLongestFg} accent="text-amber-400"
            onClick={() => openPlayer(myLongestFg.playerId, myLongestFg.position)}
          />
        )}
      </div>
    </div>
  );
}
