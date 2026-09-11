import React, { useMemo } from 'react';
import { playerLabel, projectedPoints } from '../lib/players';
import { useTeamLogo } from '../context/TeamLogoContext';
import { Zoomable } from '../context/ImageLightboxContext';
import WeeklyHighlights from './WeeklyHighlights';
import PlayerHighlights from './PlayerHighlights';
import ManagerMatchupRow from './ManagerMatchupRow';
import NflGamesPanel from './NflGamesPanel';

export default function CurrentWeekView({
  onGoToMatchup, selectedWeek, isWeekFinal, weeklyAwards, nflGames, myTeamNflTeams,
  myTeamManager, myTeamIntra, myTeamInter, myTeamConf, myTeamRoster, myTeamConfData, myTeamFallbackField, myTeamPlayersPoints,
  playersDB, weekProjections, byTeamWeek, afcSlots, nfcSlots, afcData, nfcData, afcSeason, nfcSeason
}) {
  const goToManagerMatchup = (manager) => onGoToMatchup(manager);
  const logoUrl = useTeamLogo(myTeamManager);
  // Clicking a game in the NFL games panel below highlights any players from it, in your own
  // matchups card above -- multiple games can be selected at once. A Set for O(1) lookup against
  // each player's real NFL team.
  const [selectedGames, setSelectedGames] = React.useState([]);
  const toggleGame = (game) => setSelectedGames(prev => {
    const exists = prev.some(g => g.home === game.home && g.away === game.away);
    return exists ? prev.filter(g => !(g.home === game.home && g.away === game.away)) : [...prev, game];
  });
  const highlightTeams = selectedGames.length > 0 ? new Set(selectedGames.flatMap(g => [g.home, g.away])) : null;
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
        <PlayerHighlights
          afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason}
          week={selectedWeek} weekProjections={weekProjections} playersDB={playersDB}
        />
      </div>

      {myTeamManager && (
        <div className="space-y-3 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {logoUrl && (
                <Zoomable src={logoUrl} alt={myTeamManager} className="w-14 h-14 rounded-full object-cover border-2 border-[var(--accent)]/60 shrink-0" />
              )}
              <p className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">Your Matchups</p>
            </div>
            <button
              type="button"
              onClick={() => goToManagerMatchup(myTeamManager)}
              className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-ink)] shrink-0"
            >
              Full Matchups Tab &rarr;
            </button>
          </div>
          {/* Same component as the Matchups tab -- identical scores, win%, and "Expand Rosters"
              (both sides' full lineups) so nothing here can drift from what that tab shows. Header
              hidden here since the logo+"Your Matchups" label above already identify whose card
              this is -- the Matchups tab (which lists every manager) still shows it. */}
          <ManagerMatchupRow
            manager={myTeamManager} conf={myTeamConf} intra={myTeamIntra} inter={myTeamInter}
            afcSlots={afcSlots} nfcSlots={nfcSlots} playersDB={playersDB}
            weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={selectedWeek}
            hideHeader highlightTeams={highlightTeams}
          />
        </div>
      )}

      <NflGamesPanel
        games={nflGames} week={selectedWeek} myTeamNflTeams={myTeamNflTeams} myPlayersByNflTeam={myPlayersByNflTeam}
        playersDB={playersDB} afcData={afcData} nfcData={nfcData}
        selectedGames={selectedGames} onToggleGame={toggleGame} onClearGames={() => setSelectedGames([])}
      />
    </div>
  );
}
