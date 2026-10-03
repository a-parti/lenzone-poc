import React, { useMemo, useState } from 'react';
import { playerLabel, projectedPoints } from '../lib/players';
import { useTeamLogo } from '../context/TeamLogoContext';
import { Zoomable } from '../context/ImageLightboxContext';
import WeeklyHighlights from './WeeklyHighlights';
import PlayerHighlights from './PlayerHighlights';
import MyPlayerHighlights from './MyPlayerHighlights';
import ManagerMatchupRow from './ManagerMatchupRow';
import NflGamesPanel from './NflGamesPanel';
import CopyRecapButton from './CopyRecapButton';
import WeeklyScoresBarChart from './WeeklyScoresBarChart';
import YourPlayerNews from './YourPlayerNews';

function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">{children}</h2>
      {right}
    </div>
  );
}

// My Week, top to bottom: your matchup, your player news, player trophies (yours or the league's),
// the league's weekly highlights, the whole-league scores chart, and the NFL games with your
// players in them.
export default function CurrentWeekView({
  onGoToMatchup, selectedWeek, onSelectWeek, currentNflWeek, seasonWeeks, isWeekFinal, weeklyAwards, nflGames, myTeamNflTeams,
  myTeamManager, myTeamIntra, myTeamInter, myTeamConf, myTeamRoster, myTeamConfData, myTeamFallbackField, myTeamPlayersPoints,
  playersDB, weekProjections, byTeamWeek, afcSlots, nfcSlots, afcData, nfcData, afcSeason, nfcSeason,
  afcManagers, nfcManagers, schedule, logoMap, hexColorMap,
  projectedScoreByManager, pregameScoreByManager,
  weekBigPlays, waiverWireMvp, transactions,
  myPlayerNotes, myPlayerHeadlines, onRefreshPlayerNews
}) {
  const logoUrl = useTeamLogo(myTeamManager);
  const [trophyScope, setTrophyScope] = useState(myTeamManager ? 'me' : 'league');
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
  const scope = myTeamManager ? trophyScope : 'league';

  return (
    <div className="space-y-10 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label htmlFor="my-week-select" className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">Week</label>
          <select
            id="my-week-select"
            value={selectedWeek}
            onChange={(e) => onSelectWeek(Number(e.target.value))}
            className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm font-bold rounded-lg px-3 py-2 text-[var(--text)]"
          >
            {Array.from({ length: seasonWeeks }, (_, i) => i + 1).map(w => (
              <option key={w} value={w}>Week {w}{w === currentNflWeek ? " (current)" : ""}</option>
            ))}
          </select>
        </div>
        <CopyRecapButton
          week={selectedWeek} weeklyAwards={weeklyAwards}
          afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason}
          weekProjections={weekProjections} playersDB={playersDB}
          waiverWireMvp={waiverWireMvp} transactions={transactions}
        />
      </div>

      {!myTeamManager && (
        <div className="bg-[var(--surface)]/60 border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--text2)]">
          Pick your team at the top of the page to see your matchup here.
        </div>
      )}

      {myTeamManager && (
        <section className="space-y-3 w-full">
          <SectionTitle
            right={(
              <button
                type="button"
                onClick={() => onGoToMatchup(myTeamManager)}
                className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-ink)] shrink-0"
              >
                All matchups &rarr;
              </button>
            )}
          >
            <span className="inline-flex items-center gap-3" style={{ perspective: '500px' }}>
              {logoUrl && (
                <Zoomable key={myTeamManager} src={logoUrl} alt={myTeamManager} className="coin-flip w-12 h-12 rounded-full object-cover border-2 border-[var(--accent)]/60 shrink-0" />
              )}
              Your Matchup
            </span>
          </SectionTitle>
          <ManagerMatchupRow
            manager={myTeamManager} conf={myTeamConf} intra={myTeamIntra} inter={myTeamInter}
            afcSlots={afcSlots} nfcSlots={nfcSlots} playersDB={playersDB}
            weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={selectedWeek}
            hideHeader
          />
          <YourPlayerNews
            manager={myTeamManager} notes={myPlayerNotes} headlines={myPlayerHeadlines} onRefresh={onRefreshPlayerNews}
          />
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle
          right={myTeamManager && (
            <div className="inline-flex rounded-lg bg-[var(--bg)] p-1 border border-[var(--border)]" role="group" aria-label="Player trophies scope">
              {[['me', 'Mine'], ['league', 'League']].map(([id, label]) => (
                <button
                  key={id} type="button" onClick={() => setTrophyScope(id)} aria-pressed={scope === id}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors duration-150 ${
                    scope === id ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'text-[var(--text2)] hover:text-[var(--text)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        >
          Player Trophies
        </SectionTitle>
        {scope === 'me' ? (
          <MyPlayerHighlights
            myTeamRoster={myTeamRoster} myTeamPlayersPoints={myTeamPlayersPoints} weekProjections={weekProjections}
            myTeamConfData={myTeamConfData} myTeamFallbackField={myTeamFallbackField} playersDB={playersDB}
            nflGames={nflGames} week={selectedWeek} myPlayersByNflTeam={myPlayersByNflTeam}
            weekBigPlays={weekBigPlays}
          />
        ) : (
          <PlayerHighlights
            afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason}
            week={selectedWeek} weekProjections={weekProjections} playersDB={playersDB}
            waiverWireMvp={waiverWireMvp}
          />
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>League Highlights</SectionTitle>
        <WeeklyHighlights
          awards={weeklyAwards} week={selectedWeek} isWeekFinal={isWeekFinal}
          afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason} playersDB={playersDB}
        />
      </section>

      <WeeklyScoresBarChart
        afcManagers={afcManagers} nfcManagers={nfcManagers} afcSeason={afcSeason} nfcSeason={nfcSeason}
        schedule={schedule} week={selectedWeek} logoMap={logoMap} hexColorMap={hexColorMap}
        afcData={afcData} nfcData={nfcData} playersDB={playersDB}
        projectedScores={projectedScoreByManager} pregameScores={pregameScoreByManager} isWeekFinal={isWeekFinal}
        focusManager={myTeamManager}
        focusOpponents={[myTeamIntra?.opponent, myTeamInter?.opponent].filter(Boolean)}
      />

      <NflGamesPanel
        games={nflGames} week={selectedWeek} myTeamNflTeams={myTeamNflTeams} myPlayersByNflTeam={myPlayersByNflTeam}
      />
    </div>
  );
}
