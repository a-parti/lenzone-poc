import React from 'react';
import { useTeamLogo } from '../context/TeamLogoContext';
import { Zoomable } from '../context/ImageLightboxContext';
import MyMatchups from './MyMatchups';
import YourPlayerNews from './YourPlayerNews';
import { STANDINGS_PTS } from '../lib/terms';

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

// My Week is just you: your two games (scoreboards and head-to-head lineups), with news on your
// players folded away underneath. League-wide awards and charts live on Matchups and Standings.
export default function CurrentWeekView({
  onGoToMatchup, selectedWeek, onSelectWeek, currentNflWeek, seasonWeeks,
  myTeamManager, myTeamIntra, myTeamInter, myTeamConf,
  playersDB, weekProjections, byTeamWeek, afcSlots, nfcSlots, standingByManager,
  myPlayerNotes, myPlayerHeadlines, onRefreshPlayerNews
}) {
  const logoUrl = useTeamLogo(myTeamManager);
  const weekResult = summarizeWeek(myTeamIntra, myTeamInter);

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full">
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
          <MyMatchups
            manager={myTeamManager} conf={myTeamConf} intra={myTeamIntra} inter={myTeamInter}
            afcSlots={afcSlots} nfcSlots={nfcSlots} standings={standingByManager} playersDB={playersDB}
            weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={selectedWeek}
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
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-bold shadow-sm">
              News on your players
              <span className="text-xs font-semibold text-[var(--muted)] group-open:hidden">Show</span>
              <span className="text-xs font-semibold text-[var(--muted)] hidden group-open:inline">Hide</span>
            </summary>
            <div className="mt-3">
              <YourPlayerNews
                manager={myTeamManager} notes={myPlayerNotes} headlines={myPlayerHeadlines} onRefresh={onRefreshPlayerNews}
              />
            </div>
          </details>
        </>
      ) : (
        <div className="bg-[var(--surface)]/60 border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--text2)]">
          Pick your team at the top of the page to see your matchups here.
        </div>
      )}
    </div>
  );
}
