import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { playerLabel, projectedPoints } from '../lib/players';
import { useTeamLogo } from '../context/TeamLogoContext';
import { Zoomable } from '../context/ImageLightboxContext';
import WeeklyHighlights from './WeeklyHighlights';
import PlayerHighlights from './PlayerHighlights';
import TopByPositionHighlights from './TopByPositionHighlights';
import MyPlayerHighlights from './MyPlayerHighlights';
import ManagerMatchupRow from './ManagerMatchupRow';
import NflGamesPanel from './NflGamesPanel';
import CopyRecapButton from './CopyRecapButton';
import NflBigPlaysHighlights from './NflBigPlaysHighlights';
import WeeklyScoresBarChart from './WeeklyScoresBarChart';

export default function CurrentWeekView({
  onGoToMatchup, selectedWeek, onSelectWeek, currentNflWeek, seasonWeeks, isWeekFinal, weeklyAwards, nflGames, myTeamNflTeams,
  myTeamManager, myTeamIntra, myTeamInter, myTeamConf, myTeamRoster, myTeamConfData, myTeamFallbackField, myTeamPlayersPoints,
  playersDB, weekProjections, byTeamWeek, afcSlots, nfcSlots, afcData, nfcData, afcSeason, nfcSeason,
  afcManagers, nfcManagers, schedule, logoMap, hexColorMap,
  projectedScoreByManager, pregameScoreByManager,
  afcStandings, nfcStandings, weekBigPlays, seasonResultsByTeam, managerStreaks, waiverWireMvp
}) {
  const goToManagerMatchup = (manager) => onGoToMatchup(manager);
  const logoUrl = useTeamLogo(myTeamManager);
  // Clicking a game in the NFL games panel below highlights any players from it, in your own
  // matchups card above -- multiple games can be selected at once. A Set for O(1) lookup against
  // each player's real NFL team.
  const [selectedGames, setSelectedGames] = React.useState([]);
  // Top-by-Position and NFL Big Plays are the two sections that most made this page feel busy --
  // collapsed behind a manual toggle by default so the page reads as three sections (your matchup,
  // your trophies, This Week's league-wide trophies) instead of five, while everything's still one
  // click away rather than removed.
  const [showMore, setShowMore] = useState(false);
  const toggleGame = (game) => setSelectedGames(prev => {
    const exists = prev.some(g => g.home === game.home && g.away === game.away);
    return exists ? prev.filter(g => !(g.home === game.home && g.away === game.away)) : [...prev, game];
  });
  // Live games are always highlighted, even with nothing manually selected -- a game actually in
  // progress right now is worth calling out on its own, not just something you have to think to
  // go click.
  const liveTeams = useMemo(() => {
    const teams = new Set();
    (nflGames || []).forEach(g => {
      if (g.week === selectedWeek && g.state === 'in' && g.home && g.away) { teams.add(g.home); teams.add(g.away); }
    });
    return teams;
  }, [nflGames, selectedWeek]);
  const highlightTeams = (selectedGames.length > 0 || liveTeams.size > 0)
    ? new Set([...selectedGames.flatMap(g => [g.home, g.away]), ...liveTeams])
    : null;
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
      {/* Week selector is the very first thing on the page -- it drives EVERYTHING below it
          (Your Matchups included), so it needs to sit above all of that, not buried inside the
          league-wide trophies section further down. Defaults to the real current NFL week (see
          App.jsx's one-time didSetInitialWeek effect), always called out as "(current)" here so
          it's obvious once you've browsed to a different week. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">Week</label>
          <select
            value={selectedWeek}
            onChange={(e) => onSelectWeek(Number(e.target.value))}
            className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm font-bold rounded-lg px-2 py-1 text-[var(--text)]"
          >
            {Array.from({ length: seasonWeeks }, (_, i) => i + 1).map(w => (
              <option key={w} value={w}>Week {w}{w === currentNflWeek ? " (current)" : ""}</option>
            ))}
          </select>
        </div>
        <CopyRecapButton
          week={selectedWeek} weeklyAwards={weeklyAwards} isWeekFinal={isWeekFinal}
          afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason}
          weekProjections={weekProjections} playersDB={playersDB}
          afcStandings={afcStandings} nfcStandings={nfcStandings} weekBigPlays={weekBigPlays}
          managerStreaks={managerStreaks} waiverWireMvp={waiverWireMvp}
        />
      </div>

      {myTeamManager && (
        <WeeklyScoresBarChart
          afcManagers={afcManagers} nfcManagers={nfcManagers} afcSeason={afcSeason} nfcSeason={nfcSeason}
          schedule={schedule} week={selectedWeek} logoMap={logoMap} hexColorMap={hexColorMap}
          afcData={afcData} nfcData={nfcData}
          projectedScores={projectedScoreByManager} pregameScores={pregameScoreByManager} isWeekFinal={isWeekFinal}
          focusManager={myTeamManager}
          focusOpponents={[myTeamIntra?.opponent, myTeamInter?.opponent].filter(Boolean)}
        />
      )}

      {/* "Your Matchups"/"Your Player Trophies" comes next -- this is the one section that's
          actually about you, not the whole league, so it shouldn't require scrolling past three
          league-wide sections to reach it. */}
      {myTeamManager && (
        <div className="space-y-3 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0" style={{ perspective: '500px' }}>
              {logoUrl && (
                <Zoomable key={myTeamManager} src={logoUrl} alt={myTeamManager} className="coin-flip w-14 h-14 rounded-full object-cover border-2 border-[var(--accent)]/60 shrink-0" />
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
              this is -- the Matchups tab (which lists every manager) still shows it. The actual
              matchup card comes first, your player trophies right after -- "your matchup" is the
              thing this section is named for, so it shouldn't sit below anything else here. */}
          <ManagerMatchupRow
            manager={myTeamManager} conf={myTeamConf} intra={myTeamIntra} inter={myTeamInter}
            afcSlots={afcSlots} nfcSlots={nfcSlots} playersDB={playersDB}
            weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={selectedWeek}
            hideHeader highlightTeams={highlightTeams} onSelectGame={toggleGame}
          />
          <MyPlayerHighlights
            myTeamRoster={myTeamRoster} myTeamPlayersPoints={myTeamPlayersPoints} weekProjections={weekProjections}
            myTeamConfData={myTeamConfData} myTeamFallbackField={myTeamFallbackField} playersDB={playersDB}
            nflGames={nflGames} week={selectedWeek} myPlayersByNflTeam={myPlayersByNflTeam}
            onSelectGame={toggleGame} weekBigPlays={weekBigPlays}
          />
        </div>
      )}

      <div className="space-y-3">
        <p className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">This Week (Week {selectedWeek})</p>
        <WeeklyHighlights
          awards={weeklyAwards} week={selectedWeek} isWeekFinal={isWeekFinal}
          afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason} playersDB={playersDB}
          managerStreaks={managerStreaks}
        />
        <PlayerHighlights
          afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason}
          week={selectedWeek} weekProjections={weekProjections} playersDB={playersDB}
          waiverWireMvp={waiverWireMvp}
        />
        <button
          type="button"
          onClick={() => setShowMore(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--text2)] hover:text-white bg-[var(--surface)]/60 hover:bg-[var(--surface2)] border border-[var(--border)]/80 rounded-lg py-2 uppercase tracking-wider transition-all duration-200"
        >
          {showMore ? "Show Less" : "Show More (Top Performers, Big Plays)"}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showMore ? "rotate-180" : ""}`} />
        </button>
        {showMore && (
          <>
            <TopByPositionHighlights
              afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason}
              week={selectedWeek} playersDB={playersDB}
            />
            <NflBigPlaysHighlights bigPlays={weekBigPlays} />
          </>
        )}
      </div>

      <NflGamesPanel
        games={nflGames} week={selectedWeek} myTeamNflTeams={myTeamNflTeams} myPlayersByNflTeam={myPlayersByNflTeam}
        selectedGames={selectedGames} onToggleGame={toggleGame} onClearGames={() => setSelectedGames([])}
      />
    </div>
  );
}
