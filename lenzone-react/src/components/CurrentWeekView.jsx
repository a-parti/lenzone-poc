import React, { useMemo, useState } from 'react';
import { playerLabel, projectedPoints } from '../lib/players';
import { useTeamLogo } from '../context/TeamLogoContext';
import { Zoomable } from '../context/ImageLightboxContext';
import WeeklyHighlights from './WeeklyHighlights';
import PlayerHighlights from './PlayerHighlights';
import MyPlayerHighlights from './MyPlayerHighlights';
import ManagerMatchupRow from './ManagerMatchupRow';
import NflGamesPanel from './NflGamesPanel';
import YourPlayerNews from './YourPlayerNews';
import { STANDINGS_PTS } from '../lib/terms';

function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">{children}</h2>
      {right}
    </div>
  );
}

// "Won both · +3 LP" once both of your games are final; nothing while either is still to be decided.
// An in-conference game is worth 2 LP, a cross-conference game 1 (half for a tie).
function summarizeWeek(intra, inter) {
  const games = [[intra, 2], [inter, 1]].filter(([g]) => g);
  if (!games.length || games.some(([g]) => !g.isFinal || g.myScore == null || g.oppScore == null)) return null;
  let wins = 0, losses = 0, lp = 0;
  games.forEach(([g, worth]) => {
    if (g.myScore > g.oppScore) { wins++; lp += worth; }
    else if (g.myScore < g.oppScore) losses++;
    else lp += worth / 2;
  });
  const both = games.length === 2;
  const record = both && wins === 2 ? "Won both" : both && losses === 2 ? "Lost both" : `${wins}-${losses}${wins + losses < games.length ? "-1" : ""}`;
  return `${record} · +${lp} ${STANDINGS_PTS.short}`;
}

// My Week, top to bottom: your two matchups and your player news, player
// trophies (yours or the league's), the league's weekly highlights, and the NFL games with your
// players in them.
export default function CurrentWeekView({
  onGoToMatchup, selectedWeek, onSelectWeek, currentNflWeek, seasonWeeks, isWeekFinal, weeklyAwards, nflGames, myTeamNflTeams,
  myTeamManager, myTeamIntra, myTeamInter, myTeamConf, myTeamRoster, myTeamConfData, myTeamFallbackField, myTeamPlayersPoints,
  playersDB, weekProjections, byTeamWeek, afcSlots, nfcSlots, afcData, nfcData, afcSeason, nfcSeason,
  weekBigPlays, waiverWireMvp,
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
  const weekResult = summarizeWeek(myTeamIntra, myTeamInter);

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full">
      {/* Your own two games come first, under one header that also holds the week picker. */}
      <section className="space-y-3 w-full">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0" style={{ perspective: '500px' }}>
            {myTeamManager && logoUrl && (
              <Zoomable key={myTeamManager} src={logoUrl} alt={myTeamManager} className="coin-flip w-12 h-12 rounded-full object-cover border-2 border-[var(--accent)]/60 shrink-0" />
            )}
            <div className="min-w-0">
              <h2 className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">Your Matchups</h2>
              {weekResult && <p className="text-sm font-bold text-[var(--text)] whitespace-nowrap">{weekResult}</p>}
            </div>
          </div>
          <select
            id="my-week-select"
            aria-label="Week"
            value={selectedWeek}
            onChange={(e) => onSelectWeek(Number(e.target.value))}
            className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm font-bold rounded-lg px-3 py-2 text-[var(--text)] shrink-0"
          >
            {Array.from({ length: seasonWeeks }, (_, i) => i + 1).map(w => (
              <option key={w} value={w}>Week {w}{w === currentNflWeek ? " (now)" : ""}</option>
            ))}
          </select>
        </div>

        {myTeamManager ? (
          <>
            <ManagerMatchupRow
              manager={myTeamManager} conf={myTeamConf} intra={myTeamIntra} inter={myTeamInter}
              afcSlots={afcSlots} nfcSlots={nfcSlots} playersDB={playersDB}
              weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={selectedWeek}
              hideHeader
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onGoToMatchup(myTeamManager)}
                className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-ink)]"
              >
                See every matchup &rarr;
              </button>
            </div>
            <YourPlayerNews
              manager={myTeamManager} notes={myPlayerNotes} headlines={myPlayerHeadlines} onRefresh={onRefreshPlayerNews}
            />
          </>
        ) : (
          <div className="bg-[var(--surface)]/60 border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--text2)]">
            Pick your team at the top of the page to see your matchups here.
          </div>
        )}
      </section>

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


      <NflGamesPanel
        games={nflGames} week={selectedWeek} myTeamNflTeams={myTeamNflTeams} myPlayersByNflTeam={myPlayersByNflTeam}
      />
    </div>
  );
}
