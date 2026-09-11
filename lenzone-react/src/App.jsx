import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trophy, Swords, Megaphone, Scroll, ExternalLink, RefreshCw, Award, Lock, Unlock, X, Activity, ListOrdered, Users, Calendar, Search, Volume2, VolumeX } from 'lucide-react';
import lenzoneLogoRing from './assets/lenzone-logo-ring.png';
import lenzoneLogoBall from './assets/lenzone-logo-ball.png';
import { CONF_STYLES } from './lib/theme';
import { ConfFilterToggle } from './components/shared';
import {
  fetchSleeperLeague, fetchFullSeasonData, fetchPlayersDB, fetchSeasonTransactions, fetchDraftPicks, fetchAllWeekProjections, fetchNflState, fetchNflSchedule
} from './lib/sleeperApi';
import { fetchWeekKickoffInfo } from './lib/espnApi';
import {
  computeStats, buildHistory, simulateCombinedPlayoffOdds, computeCrossRecords, computeCrossWeekRecord,
  computeWeeklyAwards, computeProjectedTrophies, buildConferenceList, rankConference, winProbability, roughWinProbability, computePointsAgainst, computeInConfRecord
} from './lib/statsMath';
import RosterTab from './components/RosterTab';
import ActivityTab from './components/ActivityTab';
import DraftBoardTab from './components/DraftBoardTab';
import PlayersTab from './components/PlayersTab';
import RosterModal from './components/RosterModal';
import TeamDepthChartModal from './components/TeamDepthChartModal';
import { TeamDepthChartProvider } from './context/TeamDepthChartContext';
import TeamName from './components/TeamName';
import ScheduleTab from './components/ScheduleTab';
import HomeView from './components/HomeView';
import CurrentWeekView from './components/CurrentWeekView';
import CommandPalette from './components/CommandPalette';
import ManagerMatchupRow from './components/ManagerMatchupRow';
import NflGamesPanel from './components/NflGamesPanel';
import WeeklyHighlights from './components/WeeklyHighlights';
import PlayerHighlights from './components/PlayerHighlights';
import { RosterModalProvider } from './context/RosterModalContext';
import { PlayerModalProvider } from './context/PlayerModalContext';
import PlayerModal from './components/PlayerModal';
import { TeamColorProvider } from './context/TeamColorContext';
import { MyTeamProvider } from './context/MyTeamContext';
import { useTheme, ALL_SCHEMES } from './context/ThemeContext';
import { getEffectiveOverrides, managerSchemeKey } from './lib/teamDefaults';
import { resolveEasterEggSoundUrl } from './lib/genericSounds';
import TeamDefaultsAdmin from './components/TeamDefaultsAdmin';
import { ImageLightboxProvider, Zoomable } from './context/ImageLightboxContext';
import { TeamLogoProvider } from './context/TeamLogoContext';
import { PlayerPhotoProvider } from './context/PlayerPhotoContext';
import { buildConferenceColorMap, getDraftSlotMap } from './lib/teamColors';
import { scoringFieldFor, computeRosterProjection, computeBlendedRosterScore, buildOwnerMap, buildAcquisitionHistory, computeMoveCounts, playerLabel, projectedPoints } from './lib/players';
import { Button, ThemeToggle, TeamPicker, useEscapeKey } from './components/shared';

// LENZONE 2026 is a fixed dual-conference league. These IDs should not change season to season.
const AFC_LEAGUE_ID = "1394069274644979712";
const NFC_LEAGUE_ID = "1394062614505463808";
const SEASON_WEEKS = 14;
const SEASON_YEAR = "2026";

// Fallback rosters, only used if the Sleeper API is unreachable
const AFC_DEFAULT = ["Kenny", "Grant", "Rob", "Tim", "Ted", "Nikko", "Dan", "Maggie", "Arjun", "Mina", "Mike", "Jaime + Kelsee"];
const NFC_DEFAULT = ["Alanna", "Kruti", "Mario", "Ahmad", "Melody", "Kris + Mahtab", "David C", "Eric", "Sam", "Jeremy", "Chris", "Melissa"];

const DEFAULT_CHARTER = `Standings
In-Conference Win = 2.0 Standings Pts | Cross-Conference Win = 1.0 Standings Pt | Ties = 50% value.
Tiebreaker: Points For (PF) -- whoever has scored more total points wins the tiebreak.

Playoff Qualification (Per Conference)
Each 12-team conference sends 6 teams to the playoffs. Seeds 1-5 are locked by total Standings Points (in-conference + cross-conference). Seed 6 (the Wildcard) goes to whichever of the remaining 7 teams in that same conference has the highest Points For (PF). AFC and NFC seed independently of each other.

Prizes
Conference Champion (AFC and NFC): $300 each
Overall Champion: +$150 on top of their conference prize
Weekly High Score: $15/week x 14 weeks
Trophy Budget: $40
Toilet Bowl: TBD

Season Calendar
Regular season: Weeks 1-14. Playoffs begin Week 15.
Trade deadline: Week 11.

Waivers
FAAB budget: $100 per team for the season.`;

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

function AdminLoginModal({ onClose, onSuccess }) {
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState("");
  useEscapeKey(onClose);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!ADMIN_PASSWORD) {
      setError("No admin password configured for this build.");
      return;
    }
    if (passwordInput === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      setError("Incorrect password.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[var(--bg)]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-[var(--surface)]/95 border border-[var(--border)]/80 rounded-xl p-6 w-full max-w-xs shadow-2xl relative" role="dialog" aria-modal="true" aria-label="Admin Login">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 text-[var(--muted)] hover:text-[var(--text)]">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-bold text-[var(--text)] mb-1">Admin Login</h2>
        <p className="text-xs text-[var(--muted)] mb-4">Unlocks charter editing, broadcast fields, and league ID overrides.</p>
        <input
          type="password"
          autoFocus
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          placeholder="Password"
          className="w-full bg-[var(--bg)] border border-[var(--border)]/80 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--accent)] mb-2"
        />
        {error && <p className="text-xs text-rose-400 mb-2">{error}</p>}
        <button type="submit" className="w-full bg-[var(--accent)] hover:bg-[var(--accent-ink)] text-[var(--accent-text)] text-sm font-semibold px-3 py-2 rounded-lg transition-all duration-200">
          Unlock
        </button>
      </form>
    </div>
  );
}

function parseRecordWins(record) {
  const n = parseInt(record, 10);
  return isNaN(n) ? 0 : n;
}
function parseFaab(faab) {
  const n = parseInt(String(faab).replace('$', ''), 10);
  return isNaN(n) ? 0 : n;
}

const STANDINGS_SORT_ACCESSORS = {
  rank: item => item.rank,
  manager: item => item.manager.toLowerCase(),
  inConfRecord: item => parseRecordWins(item.inConfRecord),
  interConfRecord: item => parseRecordWins(item.interConfRecord),
  totalPts: item => item.totalPts,
  pf: item => item.pf,
  pa: item => item.pa,
  playoffPct: item => item.playoffPct ?? -1,
  faab: item => parseFaab(item.faab),
  moves: item => item.moves
};

function SortHeader({ label, sortKey, activeKey, dir, onClick }) {
  const active = sortKey === activeKey;
  return (
    <th
      className="py-3 px-4 cursor-pointer select-none hover:text-[var(--text)] transition-colors duration-150"
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[9px] ${active ? "text-[var(--text2)]" : "text-[var(--muted)]"}`}>{active && dir === 'desc' ? "▼" : "▲"}</span>
      </span>
    </th>
  );
}

function StandingsTable({ conf, rows }) {
  const style = CONF_STYLES[conf];
  const [sortKey, setSortKey] = useState('rank');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'rank' ? 'asc' : 'desc');
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const av = STANDINGS_SORT_ACCESSORS[sortKey](a);
    const bv = STANDINGS_SORT_ACCESSORS[sortKey](b);
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl overflow-hidden shadow-xl">
      <div className="px-4 py-3 border-b border-[var(--border)]/80 flex items-center gap-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>{conf}</span>
        <span className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)]">Conference Standings</span>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm text-[var(--text2)]">
          <thead className="bg-[var(--bg)]/80 tracking-wider text-xs uppercase font-semibold text-[var(--text2)] border-b border-[var(--border)]/80">
            <tr>
              <SortHeader label="Rank" sortKey="rank" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="Manager" sortKey="manager" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="Intra-Conf" sortKey="inConfRecord" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="Inter-Conf" sortKey="interConfRecord" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="Standings Pts" sortKey="totalPts" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="PF" sortKey="pf" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="PA" sortKey="pa" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="Playoff %" sortKey="playoffPct" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="FAAB" sortKey="faab" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="Moves" sortKey="moves" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]/60">
            {sortedRows.map((item, idx) => (
              <tr key={idx} className="hover:bg-[var(--surface2)]/30 transition-all duration-200">
                <td className="py-3 px-4 font-bold text-[var(--text2)]">{item.rank}</td>
                <td className="py-3 px-4 font-bold text-[var(--text)]">
                  <div className="flex items-center gap-2">
                    <TeamName manager={item.manager} conf={conf} className="font-bold" />
                  </div>
                </td>
                <td className="py-3 px-4">{item.inConfRecord}</td>
                <td className="py-3 px-4">{item.interConfRecord}</td>
                <td className={`py-3 px-4 font-extrabold ${style.text}`}>{item.totalPts.toFixed(2)}</td>
                <td className="py-3 px-4 font-mono">{item.pf.toFixed(2)}</td>
                <td className="py-3 px-4 font-mono text-[var(--text2)]">{item.pa.toFixed(2)}</td>
                <td className="py-3 px-4 font-mono">{item.playoffPct === null || item.playoffPct === undefined ? "--" : `${item.playoffPct.toFixed(0)}%`}</td>
                <td className="py-3 px-4 text-emerald-400">{item.faab}</td>
                <td className="py-3 px-4 font-mono text-[var(--text2)]">{item.moves}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-[var(--border)]/60">
        {sortedRows.map((item, idx) => (
          <div key={idx} className={`p-4 border-l-2 ${style.border} hover:bg-[var(--surface2)]/30 transition-all duration-200`}>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[var(--muted)] font-bold text-sm">#{item.rank}</span>
                <TeamName manager={item.manager} conf={conf} className="font-bold" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Intra-Conf</p>
                <p className="text-[var(--text)] font-semibold text-sm">{item.inConfRecord}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Inter-Conf</p>
                <p className="text-[var(--text)] font-semibold text-sm">{item.interConfRecord}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Pts</p>
                <p className={`font-extrabold text-sm ${style.text}`}>{item.totalPts.toFixed(2)}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">PF</p>
                <p className="text-[var(--text)] font-mono text-sm">{item.pf.toFixed(2)}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">PA</p>
                <p className="text-[var(--text2)] font-mono text-sm">{item.pa.toFixed(2)}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Playoff %</p>
                <p className="text-[var(--text)] font-mono text-sm">{item.playoffPct === null || item.playoffPct === undefined ? "--" : `${item.playoffPct.toFixed(0)}%`}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">FAAB</p>
                <p className="text-emerald-400 font-semibold text-sm">{item.faab}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Moves</p>
                <p className="text-[var(--text2)] font-mono text-sm">{item.moves}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// "Live" here is a blend of real posted points + projections for anyone who hasn't played yet
// (same blended figure the matchup pills show) -- not a pure real-only sum -- so the badge says so.
const WEEK_POINTS_STATUS_LABEL = { projected: "Projected", live: "Live (blended w/ projections)", final: "Final" };

function ConferenceWarPanel({ weekRecord, seasonRecord, weekPoints, week, isWeekFinal, projectedTrophies }) {
  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap">
        <div>
          <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">
            {isWeekFinal ? "Week " + week + " Trophies" : "Projected Trophies"}
          </p>
          <p className="text-lg font-extrabold tabular-nums">
            <span className={CONF_STYLES.AFC.text}>AFC {projectedTrophies.afc}</span>
            <span className="text-[var(--muted)] mx-2">-</span>
            <span className={CONF_STYLES.NFC.text}>{projectedTrophies.nfc} NFC</span>
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Week {week} Total Points</p>
            {weekPoints.status && (
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                weekPoints.status === 'final' ? 'bg-emerald-500/10 text-emerald-400' : weekPoints.status === 'live' ? 'bg-amber-500/10 text-amber-400' : 'bg-[var(--surface2)] text-[var(--text2)]'
              }`}>
                {WEEK_POINTS_STATUS_LABEL[weekPoints.status]}
              </span>
            )}
          </div>
          {weekPoints.afcTotal != null ? (
            <p className="text-lg font-extrabold">
              <span className={CONF_STYLES.AFC.text}>AFC {weekPoints.afcTotal.toFixed(2)}</span>
              <span className="text-[var(--muted)] mx-2">-</span>
              <span className={CONF_STYLES.NFC.text}>{weekPoints.nfcTotal.toFixed(2)} NFC</span>
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)] italic">No data yet</p>
          )}
        </div>
        <div>
          <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">Week {week} Matchup Record (Non-Cumulative)</p>
          {!isWeekFinal ? (
            <p className="text-sm text-[var(--muted)] italic">Pending &mdash; finalizes once Week {week} is complete</p>
          ) : weekRecord.counted > 0 ? (
            <p className="text-lg font-extrabold">
              <span className={CONF_STYLES.AFC.text}>AFC {weekRecord.afcWins}</span>
              <span className="text-[var(--muted)] mx-2">-</span>
              <span className={CONF_STYLES.NFC.text}>{weekRecord.nfcWins} NFC</span>
              {weekRecord.ties > 0 && <span className="text-[var(--muted)] text-xs ml-2">({weekRecord.ties} tie{weekRecord.ties > 1 ? "s" : ""})</span>}
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)] italic">No scores yet</p>
          )}
        </div>
        <div>
          <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">Season Series (Cumulative)</p>
          <p className="text-lg font-extrabold">
            <span className={CONF_STYLES.AFC.text}>AFC {seasonRecord.afcWins}</span>
            <span className="text-[var(--muted)] mx-2">-</span>
            <span className={CONF_STYLES.NFC.text}>{seasonRecord.nfcWins} NFC</span>
            {seasonRecord.ties > 0 && <span className="text-[var(--muted)] text-xs ml-2">({seasonRecord.ties} tie{seasonRecord.ties > 1 ? "s" : ""})</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

// Shared logic for both intra/cross-conference matchup info: figures out the Final/Live/Projected
// state for a matchup and (when live/projected) blends real per-player stats with projections.
function buildMatchupInfo({
  manager, opponent, week, latestCompletedWeek,
  myConfSeason, oppConfSeason, myConfData, oppConfData, myStats, oppStats, weekProjections
}) {
  const realMy = myConfSeason.scoreByWeek[week]?.[manager] || 0;
  const realOpp = oppConfSeason.scoreByWeek[week]?.[opponent] || 0;
  const isFinal = week <= latestCompletedWeek;
  const isLive = !isFinal && (realMy > 0 || realOpp > 0);
  const myHasData = !!(myStats && myStats.gamesPlayed > 0);
  const oppHasData = !!(oppStats && oppStats.gamesPlayed > 0);
  const myFallbackField = scoringFieldFor(myConfData.receptionPoints || 0);
  const oppFallbackField = scoringFieldFor(oppConfData.receptionPoints || 0);
  const mySnapshot = myConfSeason.rosterSnapshotByWeek[week]?.[manager];
  const oppSnapshot = oppConfSeason.rosterSnapshotByWeek[week]?.[opponent];

  const myBlended = computeBlendedRosterScore(mySnapshot, weekProjections, myConfData.scoringSettings, myFallbackField);
  const oppBlended = computeBlendedRosterScore(oppSnapshot, weekProjections, oppConfData.scoringSettings, oppFallbackField);
  const myProjected = myBlended?.total ?? computeRosterProjection(myConfData.rosters.find(r => r.manager === manager), weekProjections, myConfData.scoringSettings, myFallbackField);
  const oppProjected = oppBlended?.total ?? computeRosterProjection(oppConfData.rosters.find(r => r.manager === opponent), weekProjections, oppConfData.scoringSettings, oppFallbackField);

  let myFinalScore, oppFinalScore, myWinPct, winPctIsRough;
  if (isFinal) {
    myFinalScore = realMy;
    oppFinalScore = realOpp;
    myWinPct = null;
    winPctIsRough = false;
  } else if (isLive) {
    // Live: show the blended projected-final, and shrink win-prob variance by how much of each
    // roster's points are already "locked in" real stats -- our own approximation, not Sleeper's
    // (undisclosed/unverifiable) formula.
    myFinalScore = myProjected;
    oppFinalScore = oppProjected;
    const myLocked = myBlended?.lockedFraction ?? 0;
    const oppLocked = oppBlended?.lockedFraction ?? 0;
    if (myHasData && oppHasData) {
      const myStd = myStats.std * Math.sqrt(Math.max(1 - myLocked, 0.05));
      const oppStd = oppStats.std * Math.sqrt(Math.max(1 - oppLocked, 0.05));
      myWinPct = winProbability(myFinalScore ?? myStats.mean, myStd, oppFinalScore ?? oppStats.mean, oppStd);
      winPctIsRough = true;
    } else {
      myWinPct = roughWinProbability(myFinalScore, oppFinalScore);
      winPctIsRough = true;
    }
  } else {
    myFinalScore = myHasData ? myStats.mean : myProjected;
    oppFinalScore = oppHasData ? oppStats.mean : oppProjected;
    const statsWinPct = (myHasData && oppHasData) ? winProbability(myStats.mean, myStats.std, oppStats.mean, oppStats.std) : null;
    const roughWinPct = statsWinPct === null ? roughWinProbability(myFinalScore, oppFinalScore) : null;
    myWinPct = statsWinPct ?? roughWinPct;
    winPctIsRough = statsWinPct === null && roughWinPct !== null;
  }

  return {
    opponent,
    myScore: myFinalScore,
    oppScore: oppFinalScore,
    myLiveScore: isLive ? realMy : null,
    oppLiveScore: isLive ? realOpp : null,
    isFinal,
    isLive,
    myWinPct,
    winPctIsRough,
    myHasData: myHasData || myProjected != null, oppHasData: oppHasData || oppProjected != null,
    myProjected, oppProjected,
    mySnapshot, oppSnapshot,
    myScoringSettings: myConfData.scoringSettings, myFallbackField,
    oppScoringSettings: oppConfData.scoringSettings, oppFallbackField
  };
}

function getIntraInfo(manager, season, stats, week, confData, weekProjections, latestCompletedWeek) {
  const pair = (season.scheduleByWeek[week] || []).find(([a, b]) => a === manager || b === manager);
  if (!pair) return null;
  const opponent = pair[0] === manager ? pair[1] : pair[0];
  return buildMatchupInfo({
    manager, opponent, week, latestCompletedWeek,
    myConfSeason: season, oppConfSeason: season, myConfData: confData, oppConfData: confData,
    myStats: stats[manager], oppStats: stats[opponent], weekProjections
  });
}

function getInterInfo(manager, myConf, weekCrossPairs, afcSeason, nfcSeason, allStats, week, afcData, nfcData, weekProjections, latestCompletedWeek) {
  const pair = weekCrossPairs.find(m => m.afcTeam === manager || m.nfcTeam === manager);
  if (!pair) return null;
  const opponent = pair.afcTeam === manager ? pair.nfcTeam : pair.afcTeam;
  const oppConf = myConf === "AFC" ? "NFC" : "AFC";
  const myConfSeason = myConf === "AFC" ? afcSeason : nfcSeason;
  const oppConfSeason = oppConf === "AFC" ? afcSeason : nfcSeason;
  const myConfData = myConf === "AFC" ? afcData : nfcData;
  const oppConfData = oppConf === "AFC" ? afcData : nfcData;
  return {
    oppConf,
    ...buildMatchupInfo({
      manager, opponent, week, latestCompletedWeek,
      myConfSeason, oppConfSeason, myConfData, oppConfData,
      myStats: allStats[manager], oppStats: allStats[opponent], weekProjections
    })
  };
}

// Best known score for a team this week -- uses the SAME per-player blended real+projected total
// as the matchup pills (computeBlendedRosterScore), so the "Week Total Points" figure here always
// matches what the individual matchup cards add up to. Real final score once the week is over.
function estimateTeamScore(manager, confData, season, week, weekProjections, latestCompletedWeek) {
  const isFinal = week <= latestCompletedWeek;
  if (isFinal) return { value: season.scoreByWeek[week]?.[manager] || 0, isFinal: true };
  const fallbackField = scoringFieldFor(confData.receptionPoints || 0);
  const snapshot = season.rosterSnapshotByWeek[week]?.[manager];
  const blended = computeBlendedRosterScore(snapshot, weekProjections, confData.scoringSettings, fallbackField);
  if (blended) return { value: blended.total, isFinal: false };
  const proj = computeRosterProjection(confData.rosters.find(r => r.manager === manager), weekProjections, confData.scoringSettings, fallbackField);
  return { value: proj, isFinal: false };
}

const VALID_TABS = new Set(["home", "currentWeek", "standings", "matchups", "players", "teams", "charter"]);

function tabFromHash() {
  const id = window.location.hash.slice(1);
  return VALID_TABS.has(id) ? id : null;
}

export default function App() {
  const [afcLeagueId, setAfcLeagueId] = useState(() => localStorage.getItem('lenzone_afc_league_id') || AFC_LEAGUE_ID);
  const [nfcLeagueId, setNfcLeagueId] = useState(() => localStorage.getItem('lenzone_nfc_league_id') || NFC_LEAGUE_ID);
  // Deep-linkable: the current tab lives in the URL hash (shareable/bookmarkable, and survives a
  // reload) rather than only in memory. A bare visit to the root URL (no hash at all) always lands
  // on Home -- it used to fall back to whatever tab localStorage remembered from your last visit,
  // which meant the bare domain silently stopped going Home once you'd ever navigated anywhere else.
  const [activeTab, setActiveTabState] = useState(() => tabFromHash() || "home");
  const setActiveTab = (id) => {
    setActiveTabState(id);
    window.history.pushState(null, '', `#${id}`);
  };
  // Back/forward browser navigation.
  useEffect(() => {
    const handler = () => {
      const id = tabFromHash();
      if (id) setActiveTabState(id);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  // Switching tabs always lands at the top of the new page, never wherever the previous tab
  // happened to be scrolled to.
  useEffect(() => { window.scrollTo(0, 0); }, [activeTab]);
  const [confFilter, setConfFilter] = useState("ALL");
  // Matchups tab has two pivots on the same underlying schedule/score data: "week" (everyone's
  // matchup for one week -- the old Weekly Matchups tab) and "season" (one team's full schedule --
  // the old Schedule tab), merged into a single tab with a toggle instead of two separate tabs.
  const [matchupsView, setMatchupsView] = useState("week");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedManager, setSelectedManager] = useState("ALL");
  // Clicking a game in the Matchups tab's NFL games panel highlights any players from it across
  // every matchup card on the page -- multiple games can be selected at once. A Set for O(1)
  // lookup against a player's real team.
  const [matchupsHighlightGames, setMatchupsHighlightGames] = useState([]);
  const toggleMatchupsHighlightGame = (game) => setMatchupsHighlightGames(prev => {
    const exists = prev.some(g => g.home === game.home && g.away === game.away);
    return exists ? prev.filter(g => !(g.home === game.home && g.away === game.away)) : [...prev, game];
  });
  const matchupsHighlightTeams = matchupsHighlightGames.length > 0 ? new Set(matchupsHighlightGames.flatMap(g => [g.home, g.away])) : null;
  const [myTeamManager, setMyTeamManager] = useState(() => localStorage.getItem('lenzone_my_team') || null);
  const [loading, setLoading] = useState(false);

  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('lenzone_admin') === 'true');
  // A deep link to the admin-only broadcast tab from a non-admin session lands on Home instead of
  // a blank page.
  useEffect(() => { if (activeTab === "teams" && !isAdmin) setActiveTab("home"); }, [activeTab, isAdmin]);
  // Every trip back to the landing page re-rolls a fresh random team color palette (unless the
  // viewer has explicitly picked a scheme, which always wins -- see rerollScheme in ThemeContext).
  const { rerollScheme, setScheme, pickRandomScheme } = useTheme();
  useEffect(() => { if (activeTab === "home") rerollScheme(); }, [activeTab]);
  // Keeps the URL in sync even on first load (so the address bar always reflects real state,
  // ready to copy/share/bookmark).
  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', `#${activeTab}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [charterText, setCharterText] = useState(() => localStorage.getItem('lenzone_charter') || DEFAULT_CHARTER);
  const [charterDraft, setCharterDraft] = useState(charterText);

  const [broadcastFields, setBroadcastFields] = useState(() => {
    const saved = localStorage.getItem('lenzone_broadcast_fields');
    return saved ? JSON.parse(saved) : { highScoreWinner: "TBD", afcWildcardLeader: "TBD", nfcWildcardLeader: "TBD" };
  });

  const [afcData, setAfcData] = useState({ name: "AFC Conference", rosters: [], rosterIdMap: {} });
  const [nfcData, setNfcData] = useState({ name: "NFC Conference", rosters: [], rosterIdMap: {} });

  // A manager with an admin-configured default (lib/teamDefaults.js) always lands on that scheme
  // when picked -- re-applied on cold load too, in case myTeamManager was restored from localStorage
  // before the roster data (and therefore the owner-id lookup) had finished loading.
  useEffect(() => {
    const key = managerSchemeKey(afcData, nfcData, myTeamManager);
    if (!key) return;
    const override = getEffectiveOverrides()[key];
    if (override?.scheme) setScheme(override.scheme);
  }, [myTeamManager, afcData, nfcData]);
  // Easter egg: picking ANY team plays a random clip from the shared public/sounds/generic/ pool
  // (not tied to who was picked -- that per-manager mapping was scrapped in favor of one shared,
  // pre-trimmed/normalized pool), plus a confetti burst in that team's real brand colors for
  // managers with a configured color default. Managers without a configured color just get the
  // sound, no burst.
  const [teamBurst, setTeamBurst] = useState(null);
  const [soundMuted, setSoundMuted] = useState(() => localStorage.getItem('lenzone_sound_muted') === 'true');
  const toggleSoundMuted = () => {
    setSoundMuted(prev => {
      const next = !prev;
      localStorage.setItem('lenzone_sound_muted', String(next));
      // Muting only used to block FUTURE plays -- anything already mid-playback when you hit mute
      // just kept going to the end of its clip. Stop those immediately too.
      if (next) activeAudiosRef.current.forEach(a => a.pause());
      return next;
    });
  };
  // Holds every currently-playing easter-egg Audio element -- doubles as (a) what keeps each one
  // alive against GC (a bare `new Audio(url).play()` with no reference anywhere can get reclaimed
  // mid-load before playback starts, silently dropping the sound) and (b) the list rebalanceVolumes
  // ducks when more than one clip overlaps, so picking teams in quick succession doesn't stack their
  // volumes on top of each other.
  const activeAudiosRef = useRef([]);
  const BASE_SOUND_VOLUME = 0.6; // 40% quieter than the source clip -- a light touch, not a jump-scare
  const rebalanceVolumes = () => {
    const n = activeAudiosRef.current.length;
    const level = n > 0 ? BASE_SOUND_VOLUME / n : BASE_SOUND_VOLUME;
    activeAudiosRef.current.forEach(a => { a.volume = level; });
  };
  const triggerTeamEasterEgg = (manager, swatch) => {
    if (swatch) setTeamBurst({ nonce: Date.now(), color: swatch });
    if (soundMuted) return;
    // Resolving is async (a HEAD check for that manager's exclusive file) -- fine here since nothing
    // else is waiting on it, it just plays whenever the check resolves a moment later.
    resolveEasterEggSoundUrl(manager).then((soundUrl) => {
      if (!soundUrl || soundMuted) return;
      try {
        const audio = new Audio(soundUrl);
        activeAudiosRef.current.push(audio);
        rebalanceVolumes();
        audio.addEventListener('ended', () => {
          activeAudiosRef.current = activeAudiosRef.current.filter(a => a !== audio);
          rebalanceVolumes();
        });
        audio.play().catch(() => {});
      } catch {}
    });
  };

  const [afcSeason, setAfcSeason] = useState({ scoreByWeek: {}, scheduleByWeek: {}, rosterSnapshotByWeek: {}, latestCompletedWeek: 0 });
  const [nfcSeason, setNfcSeason] = useState({ scoreByWeek: {}, scheduleByWeek: {}, rosterSnapshotByWeek: {}, latestCompletedWeek: 0 });

  const [playersDB, setPlayersDB] = useState({});
  const [playersLoading, setPlayersLoading] = useState(true);

  const [afcTransactions, setAfcTransactions] = useState([]);
  const [nfcTransactions, setNfcTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  const [afcDraft, setAfcDraft] = useState({ picks: [], rounds: 0 });
  const [nfcDraft, setNfcDraft] = useState({ picks: [], rounds: 0 });
  const [draftLoading, setDraftLoading] = useState(true);

  const [weekProjectionsByWeek, setWeekProjectionsByWeek] = useState({});

  // Sleeper's own current-week signal: it only advances once a week's games are fully done, so
  // (week - 1) is the latest FULLY COMPLETED week -- the freeze point for standings/records/odds.
  const [nflState, setNflState] = useState({ week: 1, seasonType: null });
  const latestCompletedWeek = Math.max(0, Math.min(SEASON_WEEKS, (nflState.week || 1) - 1));

  // The Matchups "Weekly" view's week dropdown defaults to whatever real current NFL week Sleeper
  // reports, once that loads -- not always week 1. Only does this ONCE (the ref guard), so it
  // doesn't yank the viewer back to the current week if they've already navigated to a different
  // one and this effect re-fires from an unrelated nflState update (e.g. a background refresh).
  const didSetInitialWeek = useRef(false);
  useEffect(() => {
    if (didSetInitialWeek.current || !nflState.week) return;
    didSetInitialWeek.current = true;
    setSelectedWeek(Math.min(SEASON_WEEKS, Math.max(1, nflState.week)));
  }, [nflState.week]);

  const loadData = async () => {
    setLoading(true);
    const [afcRes, nfcRes, stateRes] = await Promise.all([
      fetchSleeperLeague(afcLeagueId),
      fetchSleeperLeague(nfcLeagueId),
      fetchNflState()
    ]);
    if (afcRes) setAfcData(afcRes);
    if (nfcRes) setNfcData(nfcRes);
    setNflState(stateRes);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [afcLeagueId, nfcLeagueId]);

  // Gated on a populated rosterIdMap so we never fetch (and briefly render) placeholder "Roster N"
  // names before fetchSleeperLeague has resolved -- each league's season data loads independently.
  useEffect(() => {
    if (Object.keys(afcData.rosterIdMap).length === 0) return;
    fetchFullSeasonData(afcLeagueId, afcData.rosterIdMap, SEASON_WEEKS).then(setAfcSeason);
  }, [afcLeagueId, afcData.rosterIdMap]);

  useEffect(() => {
    if (Object.keys(nfcData.rosterIdMap).length === 0) return;
    fetchFullSeasonData(nfcLeagueId, nfcData.rosterIdMap, SEASON_WEEKS).then(setNfcSeason);
  }, [nfcLeagueId, nfcData.rosterIdMap]);

  useEffect(() => {
    fetchPlayersDB().then(db => { setPlayersDB(db); setPlayersLoading(false); });
  }, []);

  useEffect(() => {
    setTransactionsLoading(true);
    Promise.all([
      fetchSeasonTransactions(afcLeagueId, 18),
      fetchSeasonTransactions(nfcLeagueId, 18)
    ]).then(([afcT, nfcT]) => {
      setAfcTransactions(afcT);
      setNfcTransactions(nfcT);
      setTransactionsLoading(false);
    });
  }, [afcLeagueId, nfcLeagueId]);

  useEffect(() => {
    setDraftLoading(true);
    Promise.all([
      fetchDraftPicks(afcLeagueId),
      fetchDraftPicks(nfcLeagueId)
    ]).then(([afcD, nfcD]) => {
      setAfcDraft(afcD);
      setNfcDraft(nfcD);
      setDraftLoading(false);
    });
  }, [afcLeagueId, nfcLeagueId]);

  // Real per-week fantasy projections (RotoWire, via Sleeper) for the WHOLE season, fetched once --
  // powers the current-week matchup/roster views and the player modal's full-season weekly table.
  useEffect(() => {
    fetchAllWeekProjections(SEASON_YEAR, SEASON_WEEKS).then(setWeekProjectionsByWeek);
  }, []);
  const weekProjections = weekProjectionsByWeek[selectedWeek] || {};

  // Real NFL schedule (which teams play, the date, and real game status) -- powers the "game day"
  // indicator on rosters/players and the Home tab's This Week's Games panel.
  const [nflSchedule, setNflSchedule] = useState({ byTeamWeek: {}, games: [] });
  useEffect(() => {
    fetchNflSchedule(SEASON_YEAR).then(setNflSchedule);
  }, []);

  // Real kickoff time + live status for the currently viewed week, from ESPN's public scoreboard
  // (Sleeper's own schedule feed has no time-of-day). Refetches whenever the viewed week changes.
  const [weekKickoffInfo, setWeekKickoffInfo] = useState({});
  useEffect(() => {
    fetchWeekKickoffInfo(selectedWeek, SEASON_YEAR).then(setWeekKickoffInfo);
  }, [selectedWeek]);

  const handleLeagueIdChange = (conf, value) => {
    if (conf === "AFC") {
      setAfcLeagueId(value);
      localStorage.setItem('lenzone_afc_league_id', value);
    } else {
      setNfcLeagueId(value);
      localStorage.setItem('lenzone_nfc_league_id', value);
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('lenzone_admin');
  };

  const handleLoginSuccess = () => {
    setIsAdmin(true);
    localStorage.setItem('lenzone_admin', 'true');
    setShowLoginModal(false);
  };

  const saveCharter = () => {
    setCharterText(charterDraft);
    localStorage.setItem('lenzone_charter', charterDraft);
  };

  const updateBroadcastField = (field, value) => {
    const next = { ...broadcastFields, [field]: value };
    setBroadcastFields(next);
    localStorage.setItem('lenzone_broadcast_fields', JSON.stringify(next));
  };

  const afcManagers = afcData.rosters.length > 0 ? afcData.rosters.map(r => r.manager) : AFC_DEFAULT;
  const nfcManagers = nfcData.rosters.length > 0 ? nfcData.rosters.map(r => r.manager) : NFC_DEFAULT;
  const myTeamConf = myTeamManager && afcManagers.includes(myTeamManager) ? "AFC" : myTeamManager && nfcManagers.includes(myTeamManager) ? "NFC" : null;

  // Jumping to a specific manager's matchup (e.g. from Home) must clear the conference filter to
  // ALL first -- otherwise, if that manager is in the conference NOT currently filtered to (a
  // cross-conference opponent while your own conference is selected), their matchup card is
  // filtered out of view entirely and the tab appears to do nothing.
  const goToMatchup = (manager, week) => {
    setConfFilter("ALL");
    setSelectedManager(manager);
    if (week != null) setSelectedWeek(week);
    setMatchupsView("week");
    setActiveTab("matchups");
  };

  const chooseMyTeam = (manager) => {
    setMyTeamManager(manager);
    if (manager) localStorage.setItem('lenzone_my_team', manager);
    else localStorage.removeItem('lenzone_my_team');
    if (manager) {
      // Picking a team always lands on a fresh random color -- UNLESS that specific manager has an
      // admin-configured default (the effect above applies that one instead once myTeamManager
      // updates). This intentionally overrides even a previously self-picked scheme, so choosing
      // "who you are" always feels like a new roll rather than keeping whatever was showing before.
      const key = managerSchemeKey(afcData, nfcData, manager);
      const override = key && getEffectiveOverrides()[key];
      // The burst plays for every manager now (not just the ones with an admin-configured
      // default), colored by whichever scheme they actually end up with this pick.
      let swatch;
      if (override?.scheme) {
        swatch = ALL_SCHEMES.find(s => s.id === override.scheme)?.swatch;
      } else {
        const pickedId = pickRandomScheme();
        swatch = ALL_SCHEMES.find(s => s.id === pickedId)?.swatch;
      }
      triggerTeamEasterEgg(manager, swatch);
    }
    const conf = afcManagers.includes(manager) ? "AFC" : nfcManagers.includes(manager) ? "NFC" : null;
    // Only the conference filter focuses on your own side -- the Matchups "Filter Manager" dropdown
    // resets to "All Managers" (never to your own team) every time "I am" changes, so a manual
    // filter pick from a PREVIOUS identity doesn't linger and quietly scope the matchup list to
    // someone you're no longer looking at things as.
    if (manager && conf) {
      setConfFilter(conf);
    }
    setSelectedManager("ALL");
    // Players > Player Search keeps its own internal filter state and doesn't otherwise know "I am"
    // changed -- remounting it (via a key tied to myTeamManager, see the Players tab render) is what
    // actually resets it back to All/All instead of leaving a stale manager/position filter behind.
  };

  // Once real roster data has loaded, focus the Standings/Matchups conference filter on the
  // remembered team (picked via "I am ___" on Home) exactly once -- afterward the user's own filter
  // choices win. Deliberately does NOT touch selectedManager -- see chooseMyTeam above.
  const appliedRememberedTeamRef = useRef(false);
  useEffect(() => {
    if (appliedRememberedTeamRef.current) return;
    if (!myTeamManager || !myTeamConf) return;
    if (afcData.rosters.length === 0 && nfcData.rosters.length === 0) return;
    appliedRememberedTeamRef.current = true;
    setConfFilter(myTeamConf);
  }, [myTeamManager, myTeamConf, afcData.rosters.length, nfcData.rosters.length]);

  const myTeamConfData = myTeamConf === "AFC" ? afcData : myTeamConf === "NFC" ? nfcData : null;
  const myTeamSeason = myTeamConf === "AFC" ? afcSeason : myTeamConf === "NFC" ? nfcSeason : null;
  const myTeamRoster = myTeamConfData?.rosters.find(r => r.manager === myTeamManager) || null;
  const myTeamFallbackField = myTeamConfData ? scoringFieldFor(myTeamConfData.receptionPoints || 0) : null;
  const myTeamPlayersPoints = myTeamSeason?.rosterSnapshotByWeek?.[selectedWeek]?.[myTeamManager]?.playersPoints;
  const myTeamNflTeams = useMemo(() => {
    if (!myTeamRoster) return new Set();
    const teams = new Set();
    (myTeamRoster.players || []).forEach(pid => {
      const team = playersDB[pid]?.team;
      if (team) teams.add(team);
    });
    return teams;
  }, [myTeamRoster, playersDB]);
  // Same shape CurrentWeekView builds for its own NFL games panel -- lifted up here so the
  // Matchups tab's copy of that panel can show the same "(N of yours)" counts instead of nothing.
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
        isBench: !(myTeamRoster?.starters || []).includes(pid),
        injuryStatus: p.injuryStatus
      });
    });
    return map;
  }, [myTeamRoster, playersDB, myTeamPlayersPoints, weekProjections, myTeamConfData, myTeamFallbackField]);

  // Real per-team kickoff time + live status (from ESPN) merged onto the currently viewed week's
  // entry only -- everything else passes through Sleeper's own schedule data untouched.
  const enrichedByTeamWeek = useMemo(() => {
    const merged = {};
    Object.keys(nflSchedule.byTeamWeek).forEach(team => {
      merged[team] = { ...nflSchedule.byTeamWeek[team] };
      const info = weekKickoffInfo[team];
      if (info && merged[team][selectedWeek]) {
        merged[team][selectedWeek] = { ...merged[team][selectedWeek], ...info };
      }
    });
    return merged;
  }, [nflSchedule.byTeamWeek, weekKickoffInfo, selectedWeek]);

  const enrichedNflGames = useMemo(() => {
    return (nflSchedule.games || []).map(g => {
      const info = weekKickoffInfo[g.home] || weekKickoffInfo[g.away];
      return info ? { ...g, ...info } : g;
    });
  }, [nflSchedule.games, weekKickoffInfo]);

  const afcDraftSlots = getDraftSlotMap(afcDraft, afcData.rosterIdMap);
  const nfcDraftSlots = getDraftSlotMap(nfcDraft, nfcData.rosterIdMap);

  // Ordered by real draft position (falls back to roster order pre-draft) so Week 1 pairs each
  // team against its draft-position counterpart in the other conference, per the league's design.
  const afcByDraft = useMemo(
    () => [...afcManagers].sort((a, b) => (afcDraftSlots[a] || 99) - (afcDraftSlots[b] || 99)),
    [afcManagers.join('|'), JSON.stringify(afcDraftSlots)]
  );
  const nfcByDraft = useMemo(
    () => [...nfcManagers].sort((a, b) => (nfcDraftSlots[a] || 99) - (nfcDraftSlots[b] || 99)),
    [nfcManagers.join('|'), JSON.stringify(nfcDraftSlots)]
  );

  // 14-Week Inter-Conference Schedule Generator (this app's own bracket, not a real Sleeper schedule)
  const schedule = useMemo(() => {
    const s = [];
    for (let week = 1; week <= SEASON_WEEKS; week++) {
      const shift = (week - 1) % 12;
      const shiftedNfc = [...nfcByDraft.slice(shift), ...nfcByDraft.slice(0, shift)];
      for (let i = 0; i < 12; i++) {
        s.push({ week, afcTeam: afcByDraft[i] || `AFC Team ${i + 1}`, nfcTeam: shiftedNfc[i] || `NFC Team ${i + 1}` });
      }
    }
    return s;
  }, [afcByDraft.join('|'), nfcByDraft.join('|')]);

  const hasLiveData = afcData.rosters.length > 0 || nfcData.rosters.length > 0;

  const { afcStandings, nfcStandings, allStats } = useMemo(() => {
    const crossRecords = computeCrossRecords(schedule, afcSeason, nfcSeason, latestCompletedWeek);
    const afcPA = computePointsAgainst(afcManagers, afcSeason, latestCompletedWeek);
    const nfcPA = computePointsAgainst(nfcManagers, nfcSeason, latestCompletedWeek);
    const afcInConf = computeInConfRecord(afcManagers, afcSeason, latestCompletedWeek);
    const nfcInConf = computeInConfRecord(nfcManagers, nfcSeason, latestCompletedWeek);
    const afcBaseList = buildConferenceList(afcManagers, afcData, crossRecords, afcPA, afcInConf);
    const nfcBaseList = buildConferenceList(nfcManagers, nfcData, crossRecords, nfcPA, nfcInConf);

    const afcStats = computeStats(buildHistory(afcSeason.scoreByWeek, latestCompletedWeek), afcManagers);
    const nfcStats = computeStats(buildHistory(nfcSeason.scoreByWeek, latestCompletedWeek), nfcManagers);

    const { afcOdds, nfcOdds } = hasLiveData
      ? simulateCombinedPlayoffOdds(
          afcManagers, nfcManagers, afcBaseList, nfcBaseList, afcStats, nfcStats,
          afcSeason.scheduleByWeek, nfcSeason.scheduleByWeek, schedule, latestCompletedWeek, SEASON_WEEKS
        )
      : { afcOdds: null, nfcOdds: null };

    const afcMoveCounts = computeMoveCounts(afcTransactions, afcData.rosterIdMap);
    const nfcMoveCounts = computeMoveCounts(nfcTransactions, nfcData.rosterIdMap);
    const withMoves = (list, moveCounts) => list.map(t => ({ ...t, moves: moveCounts[t.manager] || 0 }));

    return {
      afcStandings: withMoves(rankConference(afcBaseList, "AFC", afcOdds), afcMoveCounts),
      nfcStandings: withMoves(rankConference(nfcBaseList, "NFC", nfcOdds), nfcMoveCounts),
      allStats: { ...afcStats, ...nfcStats }
    };
  }, [afcData, nfcData, afcSeason, nfcSeason, schedule, latestCompletedWeek, afcTransactions, nfcTransactions]);

  const showAfc = confFilter !== "NFC";
  const showNfc = confFilter !== "AFC";

  const isSelectedWeekFinal = selectedWeek <= latestCompletedWeek;
  const weekCrossPairs = schedule.filter(m => m.week === selectedWeek);

  // My team's own matchups this week (same buildMatchupInfo pipeline as the Matchups tab cards),
  // used to power the "Playing ___" section on Home.
  const myTeamIntra = myTeamManager && myTeamConf
    ? getIntraInfo(myTeamManager, myTeamConf === "AFC" ? afcSeason : nfcSeason, allStats, selectedWeek, myTeamConfData, weekProjections, latestCompletedWeek)
    : null;
  const myTeamInter = myTeamManager && myTeamConf
    ? getInterInfo(myTeamManager, myTeamConf, weekCrossPairs, afcSeason, nfcSeason, allStats, selectedWeek, afcData, nfcData, weekProjections, latestCompletedWeek)
    : null;

  // Blended projected-final per manager for this week, used to surface a "projected margin" on
  // the closest/blowout awards while the week is still live (not yet fully completed).
  const projectedScoreByManager = {};
  if (!isSelectedWeekFinal) {
    afcManagers.forEach(m => {
      const snap = afcSeason.rosterSnapshotByWeek[selectedWeek]?.[m];
      const fallbackField = scoringFieldFor(afcData.receptionPoints || 0);
      const blended = computeBlendedRosterScore(snap, weekProjections, afcData.scoringSettings, fallbackField);
      if (blended) projectedScoreByManager[m] = blended.total;
    });
    nfcManagers.forEach(m => {
      const snap = nfcSeason.rosterSnapshotByWeek[selectedWeek]?.[m];
      const fallbackField = scoringFieldFor(nfcData.receptionPoints || 0);
      const blended = computeBlendedRosterScore(snap, weekProjections, nfcData.scoringSettings, fallbackField);
      if (blended) projectedScoreByManager[m] = blended.total;
    });
  }
  const weeklyAwards = computeWeeklyAwards(afcSeason, nfcSeason, selectedWeek, isSelectedWeekFinal ? null : projectedScoreByManager);
  const weekRecord = isSelectedWeekFinal
    ? computeCrossWeekRecord(weekCrossPairs, afcSeason.scoreByWeek[selectedWeek] || {}, nfcSeason.scoreByWeek[selectedWeek] || {})
    : { afcWins: 0, nfcWins: 0, ties: 0, counted: 0 };

  // Same blended per-manager projections powering the matchup pills, used here so the projected
  // cross-conference win tally (fed into "Projected Trophies") updates live instead of sitting at
  // zero all week the way the real, final-only weekRecord does.
  const projectedMatchupRecord = isSelectedWeekFinal
    ? weekRecord
    : computeCrossWeekRecord(weekCrossPairs, projectedScoreByManager, projectedScoreByManager);
  const projectedTrophies = computeProjectedTrophies(weeklyAwards, projectedMatchupRecord, afcManagers);

  const afcWeekEstimates = afcManagers.map(m => estimateTeamScore(m, afcData, afcSeason, selectedWeek, weekProjections, latestCompletedWeek));
  const nfcWeekEstimates = nfcManagers.map(m => estimateTeamScore(m, nfcData, nfcSeason, selectedWeek, weekProjections, latestCompletedWeek));
  const hasAnyAfcEstimate = afcWeekEstimates.some(e => e.value != null);
  const hasAnyNfcEstimate = nfcWeekEstimates.some(e => e.value != null);
  const anyRealScorePosted = Object.values(afcSeason.scoreByWeek[selectedWeek] || {}).some(v => v > 0)
    || Object.values(nfcSeason.scoreByWeek[selectedWeek] || {}).some(v => v > 0);
  const weekPoints = {
    afcTotal: hasAnyAfcEstimate ? afcWeekEstimates.reduce((s, e) => s + (e.value || 0), 0) : null,
    nfcTotal: hasAnyNfcEstimate ? nfcWeekEstimates.reduce((s, e) => s + (e.value || 0), 0) : null,
    status: (!hasAnyAfcEstimate && !hasAnyNfcEstimate) ? null : (isSelectedWeekFinal ? 'final' : (anyRealScorePosted ? 'live' : 'projected'))
  };
  const crossRecordsForSeason = computeCrossRecords(schedule, afcSeason, nfcSeason, latestCompletedWeek);
  const seasonRecord = {
    afcWins: afcManagers.reduce((sum, m) => sum + (crossRecordsForSeason[m]?.wins || 0), 0),
    nfcWins: nfcManagers.reduce((sum, m) => sum + (crossRecordsForSeason[m]?.wins || 0), 0),
    ties: afcManagers.reduce((sum, m) => sum + (crossRecordsForSeason[m]?.ties || 0), 0)
  };

  const afcManagerRows = afcManagers.filter(m => selectedManager === "ALL" || m === selectedManager);
  const nfcManagerRows = nfcManagers.filter(m => selectedManager === "ALL" || m === selectedManager);

  const teamColorMap = useMemo(
    () => ({
      ...buildConferenceColorMap(afcManagers, afcDraft, afcData.rosterIdMap),
      ...buildConferenceColorMap(nfcManagers, nfcDraft, nfcData.rosterIdMap)
    }),
    [afcManagers.join('|'), nfcManagers.join('|'), afcDraft, nfcDraft, afcData.rosterIdMap, nfcData.rosterIdMap]
  );

  const teamLogoMap = useMemo(
    () => ({ ...(afcData.logoMap || {}), ...(nfcData.logoMap || {}) }),
    [afcData.logoMap, nfcData.logoMap]
  );

  const afcOwners = useMemo(() => buildOwnerMap(afcData.rosters), [afcData.rosters]);
  const nfcOwners = useMemo(() => buildOwnerMap(nfcData.rosters), [nfcData.rosters]);
  const afcHistory = useMemo(
    () => buildAcquisitionHistory(afcDraft, afcTransactions, afcData.rosterIdMap),
    [afcDraft, afcTransactions, afcData.rosterIdMap]
  );
  const nfcHistory = useMemo(
    () => buildAcquisitionHistory(nfcDraft, nfcTransactions, nfcData.rosterIdMap),
    [nfcDraft, nfcTransactions, nfcData.rosterIdMap]
  );

  const [playersSubTab, setPlayersSubTab] = useState("search");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Home isn't listed as a nav tab -- the header logo already links there, so it's not one more
  // click to hold a spot in the bar too.
  const tabs = [
    { id: "currentWeek", label: `This Week (${selectedWeek})`, shortLabel: `This Week (${selectedWeek})`, icon: Calendar },
    { id: "standings", label: "Standings", shortLabel: "Standings", icon: Trophy },
    { id: "matchups", label: "Matchups", shortLabel: "Matchups", icon: Swords },
    { id: "players", label: "Players", shortLabel: "Players", icon: Search },
    ...(isAdmin ? [{ id: "teams", label: "MS Teams Broadcast", shortLabel: "Broadcast", icon: Megaphone }] : [])
  ];

  return (
    <ImageLightboxProvider>
    <MyTeamProvider manager={myTeamManager}>
    <TeamColorProvider colorMap={teamColorMap}>
    <TeamLogoProvider logoMap={teamLogoMap}>
    <PlayerPhotoProvider>
    <PlayerModalProvider>
    <RosterModalProvider>
    <TeamDepthChartProvider>
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 md:p-8 pb-24 md:pb-8">
      {showLoginModal && (
        <AdminLoginModal onClose={() => setShowLoginModal(false)} onSuccess={handleLoginSuccess} />
      )}
      <CommandPalette
        tabs={tabs} onSelect={setActiveTab} open={commandPaletteOpen} setOpen={setCommandPaletteOpen}
        playersDB={playersDB} afcManagers={afcManagers} nfcManagers={nfcManagers}
      />
      <RosterModal
        afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason} playersDB={playersDB}
        weekProjections={weekProjections} selectedWeek={selectedWeek} byTeamWeek={enrichedByTeamWeek}
      />
      <PlayerModal
        playersDB={playersDB} afcOwners={afcOwners} nfcOwners={nfcOwners} afcHistory={afcHistory} nfcHistory={nfcHistory}
        selectedWeek={selectedWeek} weekProjectionsByWeek={weekProjectionsByWeek} seasonWeeks={SEASON_WEEKS} latestCompletedWeek={latestCompletedWeek}
        afcSeason={afcSeason} nfcSeason={nfcSeason} afcData={afcData} nfcData={nfcData} byTeamWeek={enrichedByTeamWeek}
      />
      <TeamDepthChartModal
        playersDB={playersDB} afcOwners={afcOwners} nfcOwners={nfcOwners}
        weekProjections={weekProjections} selectedWeek={selectedWeek}
      />

      {/* Header Banner -- hidden on Home, which is deliberately just the "I am" picker + radial menu */}
      {activeTab !== "home" && (
        <header className="max-w-7xl mx-auto bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-2xl px-5 py-3 mb-8 shadow-xl">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" onClick={() => setActiveTab("home")} className="flex items-center gap-2.5 group shrink-0">
              {/* Two layered images (split from the original single PNG) so only the football
                  spins on hover, not the whole ring -- the ring stays put and just scales up. */}
              <span className="relative w-14 h-14 shrink-0 transition-transform duration-500 group-hover:scale-125">
                <img src={lenzoneLogoRing} alt="LENZONE" className="absolute inset-0 w-full h-full" />
                <img src={lenzoneLogoBall} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full logo-ball" />
              </span>
              <h1 className="lenzone-title font-display text-xl font-extrabold tracking-tight bg-clip-text text-transparent">
                LENZONE 2026
              </h1>
            </button>
            {isAdmin && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider shrink-0">
                Admin
              </span>
            )}

            {/* Secondary utility actions -- deliberately small/icon-first so they read as
                secondary to the "I am" picker and don't compete for attention with it. */}
            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={`https://sleeper.com/leagues/${afcLeagueId}/team`} target="_blank" rel="noreferrer"
                title="Open AFC league in Sleeper"
                className="flex items-center gap-1 bg-red-700/70 hover:bg-red-600/80 text-white px-2 py-1.5 rounded-lg font-bold text-[10px] transition-all duration-200"
              >
                AFC <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a
                href={`https://sleeper.com/leagues/${nfcLeagueId}/team`} target="_blank" rel="noreferrer"
                title="Open NFC league in Sleeper"
                className="flex items-center gap-1 bg-blue-700/70 hover:bg-blue-600/80 text-white px-2 py-1.5 rounded-lg font-bold text-[10px] transition-all duration-200"
              >
                NFC <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <Button
                variant="icon"
                onClick={() => setActiveTab("charter")}
                title="League Charter"
                className={activeTab === "charter" ? "bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-ink)]" : ""}
              >
                <Scroll className="w-4 h-4" />
              </Button>
              <Button variant="icon" onClick={() => isAdmin ? handleLogout() : setShowLoginModal(true)} title={isAdmin ? "Log out of admin mode" : "Admin login"}>
                {isAdmin ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </Button>
              <Button variant="icon" onClick={() => setCommandPaletteOpen(true)} title="Search pages, teams, and players (Ctrl+K)">
                <Search className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 ml-auto">
              <TeamPicker afcManagers={afcManagers} nfcManagers={nfcManagers} value={myTeamManager} onChange={chooseMyTeam} />
              {/* Mode toggle (inside ThemeToggle, its last button) sits immediately left of mute,
                  which is now the far-right-most control -- same pairing/order as the Home page's
                  mute + mode buttons, instead of mute living off with the other utility icons. */}
              <ThemeToggle />
              <Button variant="icon" onClick={toggleSoundMuted} title={soundMuted ? "Unmute team easter-egg sounds" : "Mute team easter-egg sounds"}>
                {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </header>
      )}

      <main className="max-w-7xl mx-auto">
        {/* Desktop Navigation Tabs -- also hidden on Home; the radial menu is its navigation */}
        {activeTab !== "home" && (
          <div className="hidden md:flex flex-wrap border-b border-[var(--border)]/80 mb-6 gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all duration-200 ${
                  activeTab === tab.id ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]/40" : "border-transparent text-[var(--text2)] hover:text-[var(--text)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* TAB: HOME */}
        {activeTab === "home" && (
          <HomeView
            setActiveTab={setActiveTab} selectedWeek={selectedWeek}
            afcManagers={afcManagers} nfcManagers={nfcManagers} myTeamManager={myTeamManager} onChooseMyTeam={chooseMyTeam}
            teamBurst={teamBurst} soundMuted={soundMuted} onToggleSoundMuted={toggleSoundMuted}
          />
        )}

        {/* TAB: CURRENT WEEK */}
        {activeTab === "currentWeek" && (
          <CurrentWeekView
            onGoToMatchup={goToMatchup} selectedWeek={selectedWeek} isWeekFinal={isSelectedWeekFinal}
            weeklyAwards={weeklyAwards} nflGames={enrichedNflGames}
            myTeamNflTeams={myTeamNflTeams} myTeamManager={myTeamManager}
            myTeamIntra={myTeamIntra} myTeamInter={myTeamInter} myTeamConf={myTeamConf}
            myTeamRoster={myTeamRoster} myTeamConfData={myTeamConfData} myTeamFallbackField={myTeamFallbackField}
            myTeamPlayersPoints={myTeamPlayersPoints} playersDB={playersDB} weekProjections={weekProjections}
            byTeamWeek={enrichedByTeamWeek}
            afcSlots={afcData.startingSlots || []} nfcSlots={nfcData.startingSlots || []}
            afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason}
          />
        )}

        {/* TAB: STANDINGS */}
        {activeTab === "standings" && (
          <div className="space-y-6">
            <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)]">Filter View:</span>
                <ConfFilterToggle value={confFilter} onChange={setConfFilter} />
              </div>

              <div className="flex items-center gap-2">
                <span className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Season Series:</span>
                <p className="text-lg font-extrabold">
                  <span className={CONF_STYLES.AFC.text}>AFC {seasonRecord.afcWins}</span>
                  <span className="text-[var(--muted)] mx-2">-</span>
                  <span className={CONF_STYLES.NFC.text}>{seasonRecord.nfcWins} NFC</span>
                  {seasonRecord.ties > 0 && <span className="text-[var(--muted)] text-xs ml-2">({seasonRecord.ties} tie{seasonRecord.ties > 1 ? "s" : ""})</span>}
                </p>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="AFC Sleeper League ID"
                    value={afcLeagueId}
                    onChange={(e) => handleLeagueIdChange("AFC", e.target.value)}
                    className="bg-[var(--bg)] border border-[var(--border)]/80 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-red-500 w-full sm:w-44"
                  />
                  <input
                    type="text"
                    placeholder="NFC Sleeper League ID"
                    value={nfcLeagueId}
                    onChange={(e) => handleLeagueIdChange("NFC", e.target.value)}
                    className="bg-[var(--bg)] border border-[var(--border)]/80 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-500 w-full sm:w-44"
                  />
                  <Button variant="icon" onClick={loadData}>
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              )}
            </div>

            {showAfc && <StandingsTable conf="AFC" rows={afcStandings} />}
            {showNfc && <StandingsTable conf="NFC" rows={nfcStandings} />}
          </div>
        )}

        {/* TAB: MATCHUPS (merged Weekly Matchups + Schedule -- same schedule/score data, two pivots) */}
        {activeTab === "matchups" && (
          <div className="space-y-8 max-w-7xl mx-auto w-full">
            <div className="inline-flex rounded-full bg-[var(--surface2)] border border-[var(--border)] p-1 gap-1">
              {[["week", "Weekly"], ["season", "Full Season"]].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMatchupsView(id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-200 ${
                    matchupsView === id ? "bg-[var(--accent)] text-[var(--accent-text)]" : "text-[var(--text2)] hover:text-[var(--text)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {matchupsView === "season" && (
              <ScheduleTab
                afcSeason={afcSeason} nfcSeason={nfcSeason} crossSchedule={schedule}
                afcManagers={afcManagers} nfcManagers={nfcManagers}
                afcData={afcData} nfcData={nfcData} weekProjectionsByWeek={weekProjectionsByWeek}
                afcTradeDeadlineWeek={afcData.tradeDeadlineWeek} nfcTradeDeadlineWeek={nfcData.tradeDeadlineWeek}
                focusManager={myTeamManager} focusConf={myTeamConf} currentWeek={nflState.week}
                latestCompletedWeek={latestCompletedWeek}
                playersDB={playersDB} byTeamWeek={enrichedByTeamWeek}
                onGoToMatchup={(week, manager) => goToMatchup(manager, week)}
              />
            )}

            {matchupsView === "week" && (
              <>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
            <div className="space-y-8 min-w-0">
            <div className="flex flex-wrap items-center gap-4 bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 p-4 rounded-xl">
              <div>
                <label className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)] block mb-1">Conference</label>
                <ConfFilterToggle value={confFilter} onChange={setConfFilter} />
              </div>
              <div>
                <label className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)] block mb-1">NFL Week</label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm rounded-lg px-3 py-1.5 text-[var(--text)]"
                >
                  {Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1).map(w => (
                    <option key={w} value={w}>Week {w}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)] block mb-1">Filter Manager</label>
                <select
                  value={selectedManager}
                  onChange={(e) => setSelectedManager(e.target.value)}
                  className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm rounded-lg px-3 py-1.5 text-[var(--text)]"
                >
                  <option value="ALL">All Managers</option>
                  {[...afcManagers, ...nfcManagers].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* goToMatchup (not setSelectedManager alone) resets the conference filter to ALL first --
                otherwise clicking a trophy for a manager outside the currently-filtered conference
                just silently does nothing, since their card is filtered out of view. */}
            <WeeklyHighlights awards={weeklyAwards} week={selectedWeek} isWeekFinal={isSelectedWeekFinal} onSelectManager={goToMatchup} />
            <PlayerHighlights
              afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason}
              week={selectedWeek} weekProjections={weekProjections} playersDB={playersDB}
            />

            {showAfc && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)]">AFC Matchups &mdash; Week {selectedWeek}</h2>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {afcManagerRows.map(m => (
                    <ManagerMatchupRow
                      key={m}
                      manager={m}
                      conf="AFC"
                      intra={getIntraInfo(m, afcSeason, allStats, selectedWeek, afcData, weekProjections, latestCompletedWeek)}
                      inter={getInterInfo(m, "AFC", weekCrossPairs, afcSeason, nfcSeason, allStats, selectedWeek, afcData, nfcData, weekProjections, latestCompletedWeek)}
                      afcSlots={afcData.startingSlots || []}
                      nfcSlots={nfcData.startingSlots || []}
                      playersDB={playersDB}
                      weekProjections={weekProjections}
                      byTeamWeek={enrichedByTeamWeek} week={selectedWeek}
                      highlightTeams={matchupsHighlightTeams} onSelectGame={toggleMatchupsHighlightGame}
                    />
                  ))}
                </div>
              </div>
            )}

            {showNfc && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)]">NFC Matchups &mdash; Week {selectedWeek}</h2>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {nfcManagerRows.map(m => (
                    <ManagerMatchupRow
                      key={m}
                      manager={m}
                      conf="NFC"
                      intra={getIntraInfo(m, nfcSeason, allStats, selectedWeek, nfcData, weekProjections, latestCompletedWeek)}
                      inter={getInterInfo(m, "NFC", weekCrossPairs, afcSeason, nfcSeason, allStats, selectedWeek, afcData, nfcData, weekProjections, latestCompletedWeek)}
                      afcSlots={afcData.startingSlots || []}
                      nfcSlots={nfcData.startingSlots || []}
                      playersDB={playersDB}
                      weekProjections={weekProjections}
                      byTeamWeek={enrichedByTeamWeek} week={selectedWeek}
                      highlightTeams={matchupsHighlightTeams} onSelectGame={toggleMatchupsHighlightGame}
                    />
                  ))}
                </div>
              </div>
            )}
            </div>
            <div className="lg:sticky lg:top-4">
              <NflGamesPanel
                games={enrichedNflGames} week={selectedWeek} myTeamNflTeams={myTeamNflTeams}
                myPlayersByNflTeam={myPlayersByNflTeam} compactCounts
                selectedGames={matchupsHighlightGames} onToggleGame={toggleMatchupsHighlightGame}
                onClearGames={() => setMatchupsHighlightGames([])}
              />
            </div>
            </div>
              </>
            )}
          </div>
        )}

        {/* TAB: PLAYERS (merged Player Search + Rosters + Activity + Draft Board -- all views onto
             the same player pool, just sliced differently) */}
        {activeTab === "players" && (
          <div className="space-y-6">
            <div className="inline-flex bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-1 gap-1 flex-wrap">
              {[["search", "Player Search", Search], ["rosters", "Rosters", Users], ["activity", "Activity", Activity], ["draft", "Draft Board", ListOrdered]].map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setPlayersSubTab(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                    playersSubTab === key ? "bg-[var(--accent)] text-[var(--accent-text)]" : "text-[var(--text2)] hover:text-[var(--text)]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {playersSubTab === "search" && (
              // Player Search deliberately defaults to All/All rather than your own team -- unlike
              // Rosters/Activity below, browsing players isn't "your team" scoped by default.
              // key={myTeamManager} force-remounts (and so resets its own internal filter state)
              // every time "I am" changes, rather than leaving a manually-picked team/position
              // filter from a PREVIOUS identity lingering in memory.
              <PlayersTab
                key={myTeamManager}
                afcData={afcData}
                nfcData={nfcData}
                afcDraft={afcDraft}
                nfcDraft={nfcDraft}
                afcTransactions={afcTransactions}
                nfcTransactions={nfcTransactions}
                afcManagers={afcManagers}
                nfcManagers={nfcManagers}
                playersDB={playersDB}
                playersLoading={playersLoading}
                focusManager={null} focusConf={null}
              />
            )}
            {playersSubTab === "rosters" && (
              <RosterTab
                afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason} playersDB={playersDB} playersLoading={playersLoading}
                weekProjections={weekProjections} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} seasonWeeks={SEASON_WEEKS}
                byTeamWeek={enrichedByTeamWeek}
                focusManager={myTeamManager} focusConf={myTeamConf}
              />
            )}
            {playersSubTab === "activity" && (
              <ActivityTab
                afcTransactions={afcTransactions}
                nfcTransactions={nfcTransactions}
                afcRosterIdMap={afcData.rosterIdMap}
                nfcRosterIdMap={nfcData.rosterIdMap}
                playersDB={playersDB}
                loading={transactionsLoading}
                focusConf={myTeamConf}
              />
            )}
            {playersSubTab === "draft" && (
              <DraftBoardTab
                afcDraft={afcDraft}
                nfcDraft={nfcDraft}
                afcRosterIdMap={afcData.rosterIdMap}
                nfcRosterIdMap={nfcData.rosterIdMap}
                loading={draftLoading}
                playersDB={playersDB}
              />
            )}
          </div>
        )}

        {/* TAB: MS TEAMS RECAP (admin only) */}
        {activeTab === "teams" && isAdmin && (
          <div className="space-y-6">
          <TeamDefaultsAdmin afcData={afcData} nfcData={nfcData} afcManagers={afcManagers} nfcManagers={nfcManagers} />
          <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-2 text-[var(--text)]">MS Teams Weekly Broadcast Generator</h2>
              <p className="text-sm text-[var(--text2)]">Copy and paste this markdown recap directly into your MS Teams channel every Tuesday morning.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] block mb-1">High Score Winner</label>
                <input
                  type="text"
                  value={broadcastFields.highScoreWinner}
                  onChange={(e) => updateBroadcastField("highScoreWinner", e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)]/80 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] block mb-1">AFC Wildcard Leader</label>
                <input
                  type="text"
                  value={broadcastFields.afcWildcardLeader}
                  onChange={(e) => updateBroadcastField("afcWildcardLeader", e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)]/80 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] block mb-1">NFC Wildcard Leader</label>
                <input
                  type="text"
                  value={broadcastFields.nfcWildcardLeader}
                  onChange={(e) => updateBroadcastField("nfcWildcardLeader", e.target.value)}
                  className="w-full bg-[var(--bg)] border border-[var(--border)]/80 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <pre className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--border)]/80 text-xs font-mono text-emerald-400 whitespace-pre-wrap select-all">
{`========================================
LENZONE WEEKLY RECAP: WEEK ${selectedWeek}
========================================
- Cross-League Battles: Week ${selectedWeek} scoring is finalized!
- $15 High Score Winner: ${broadcastFields.highScoreWinner}
- Seed 6 Wildcard Race (Points For):
  - AFC Leader: ${broadcastFields.afcWildcardLeader}
  - NFC Leader: ${broadcastFields.nfcWildcardLeader}

Full Standings & Scoreboard: https://lenzone.vercel.app`}
            </pre>
          </div>
          </div>
        )}

        {/* TAB: CHARTER */}
        {activeTab === "charter" && (
          <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-6 space-y-4 text-[var(--text2)] text-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--text)]">Official LENZONE 2026 Charter</h2>
              {isAdmin && (
                <Button onClick={saveCharter}>Save</Button>
              )}
            </div>

            {isAdmin ? (
              <textarea
                value={charterDraft}
                onChange={(e) => setCharterDraft(e.target.value)}
                rows={10}
                className="w-full bg-[var(--bg)] border border-[var(--border)]/80 rounded-lg p-4 text-sm text-[var(--text2)] focus:outline-none focus:border-[var(--accent)]"
              />
            ) : (
              <div className="whitespace-pre-wrap p-4 bg-[var(--bg)] rounded-lg border-l-4 border-[var(--accent)]">
                {charterText}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar -- hidden on Home too */}
      {activeTab !== "home" && (
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[var(--surface)]/70 backdrop-blur-md border-t border-[var(--border)]/80 flex justify-around py-2.5 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`text-[11px] font-semibold transition-all duration-200 shrink-0 px-2 py-1 ${
              activeTab === tab.id ? "text-[var(--accent)]" : "text-[var(--text2)]"
            }`}
          >
            {tab.shortLabel}
          </button>
        ))}
      </nav>
      )}
    </div>
    </TeamDepthChartProvider>
    </RosterModalProvider>
    </PlayerModalProvider>
    </PlayerPhotoProvider>
    </TeamLogoProvider>
    </TeamColorProvider>
    </MyTeamProvider>
    </ImageLightboxProvider>
  );
}
