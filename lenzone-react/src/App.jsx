import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { Trophy, Swords, Megaphone, RefreshCw, X, Activity, ListOrdered, Users, Calendar, Search, Home, GitBranch, Copy, Check } from 'lucide-react';
import AnimatedLogo from './components/AnimatedLogo';
import { CONF_STYLES } from './lib/theme';
import {
  fetchSleeperLeague, fetchFullSeasonData, fetchWeekMatchups, fetchPlayersDB, fetchSeasonTransactions, fetchWeekTransactions, fetchDraftPicks, fetchAllWeekProjections, fetchWeekProjections, fetchNflState, fetchNflSchedule
} from './lib/sleeperApi';
import { fetchWeekKickoffInfo, fetchWeekBigPlays, fetchNflHeadlines, fetchNflPlayerNotes, filterPlayerNotesForPlayers, filterHeadlinesForPlayers } from './lib/espnApi';
import {
  computeStats, buildHistory, simulateCombinedPlayoffOdds, computeCrossRecords, computeCrossWeekRecord,
  computeWeeklyAwards, buildConferenceList, rankConference, winProbability, roughWinProbability, computePointsAgainst, computeInConfRecord,
  computeCrossPointsAgainst, computeIntraGamesPlayed, computeInterGamesPlayed, buildStandingsHistory,
  buildWeeklyPfPaHistory, 
  buildPostseasonSeeds
} from './lib/statsMath';
const RosterTab = lazy(() => import('./components/RosterTab'));
const ActivityTab = lazy(() => import('./components/ActivityTab'));
const DraftBoardTab = lazy(() => import('./components/DraftBoardTab'));
const PlayersTab = lazy(() => import('./components/PlayersTab'));
import RosterModal from './components/RosterModal';
import TeamDepthChartModal from './components/TeamDepthChartModal';
import { TeamDepthChartProvider } from './context/TeamDepthChartContext';
import TeamName from './components/TeamName';
const SeasonGridTab = lazy(() => import('./components/SeasonGridTab'));
import PlayoffsTab, { PLAYOFF_WEEKS } from './components/PlayoffsTab';
import HomeView from './components/HomeView';
import NewsTicker from './components/NewsTicker';
import WeeklyScoresBarChart from './components/WeeklyScoresBarChart';
import CurrentWeekView from './components/CurrentWeekView';
import CommandPalette from './components/CommandPalette';
import GrabbableFootball from './components/GrabbableFootball';
import DancingStickmen from './components/DancingStickmen';
import SettingsMenu, { ModeToggle } from './components/SettingsMenu';
import TeamMiniLogo from './components/TeamMiniLogo';
import { RosterModalProvider } from './context/RosterModalContext';
import { MatchupPreviewProvider } from './context/MatchupPreviewContext';
import MatchupPreviewModal from './components/MatchupPreviewModal';
import { PlayerModalProvider } from './context/PlayerModalContext';
import PlayerModal from './components/PlayerModal';
import { TeamColorProvider } from './context/TeamColorContext';
import { MyTeamProvider } from './context/MyTeamContext';
import { resolveEasterEggSoundUrl } from './lib/genericSounds';
import { ImageLightboxProvider } from './context/ImageLightboxContext';
import { TeamLogoProvider } from './context/TeamLogoContext';
import { PlayerPhotoProvider } from './context/PlayerPhotoContext';
import { NameDisplayProvider, useNameDisplay } from './context/NameDisplayContext';
import { buildConferenceColorMap, buildConferenceHexColorMap, getDraftSlotMap } from './lib/teamColors';
const StandingsTrendChart = lazy(() => import('./components/StandingsTrendChart'));
import StandingsBarChart from './components/StandingsBarChart';
import { getRealName } from './lib/realNames';
import { scoringFieldFor, computeRosterProjection, computeBlendedRosterScore, buildOwnerMap, buildAcquisitionHistory, computeMoveCounts, playerLabel, projectedPoints, computeWaiverWireMvp } from './lib/players';
import { Button, TeamPicker, useEscapeKey, SkeletonRows } from './components/shared';
import { copyTextToClipboard } from './lib/clipboard';
import { defaultBrowseWeek, sleeperCurrentWeek } from './lib/weekSelection';
import { startPolling } from './lib/polling';
import { buildWeeklyRecapForWeek } from './lib/recapText';

// LENZONE 2026 is a fixed dual-conference league. These IDs should not change season to season.
const AFC_LEAGUE_ID = "1394069274644979712";
const NFC_LEAGUE_ID = "1394062614505463808";
const SEASON_WEEKS = 14;
const SEASON_YEAR = "2026";
const EMPTY_OBJECT = Object.freeze({});

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
        {error && <p className="text-xs text-[var(--neg)] mb-2">{error}</p>}
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

function playoffPulse(pct) {
  if (pct == null) return { label: 'Waiting', color: 'text-[var(--muted)]' };
  if (pct >= 80) return { label: 'Cruising', color: 'text-[var(--pos)]' };
  if (pct >= 65) return { label: 'Looking Good', color: 'text-[var(--pos)]' };
  if (pct >= 45) return { label: 'Bubble', color: 'text-[var(--live)]' };
  if (pct >= 25) return { label: 'Needs a Run', color: 'text-[var(--live)]' };
  return { label: 'Needs Chaos', color: 'text-[var(--neg)]' };
}

const STANDINGS_SORT_ACCESSORS = {
  rank: item => item.rank,
  manager: item => item.manager.toLowerCase(),
  totalPts: item => item.totalPts,
  overall: item => item.overallWins ?? 0,
  inConfRecord: item => parseRecordWins(item.inConfRecord),
  interConfRecord: item => parseRecordWins(item.interConfRecord),
  pf: item => item.pfAvg,
  pa: item => item.paAvg,
  playoffPct: item => item.playoffPct ?? -1,
  faab: item => parseFaab(item.faab),
  moves: item => item.moves
};

function SortHeader({ label, sortKey, activeKey, dir, onClick, title }) {
  const active = sortKey === activeKey;
  return (
    <th className="py-2 px-2 whitespace-nowrap" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        title={title}
        className="inline-flex items-center gap-1 whitespace-nowrap font-semibold hover:text-[var(--text)] transition-colors duration-150"
      >
        {label}
        <span className={`text-[10px] ${active ? "text-[var(--text2)]" : "text-[var(--muted)]"}`}>{active && dir === 'desc' ? "▼" : "▲"}</span>
      </button>
    </th>
  );
}

const SEED_PILL = {
  BYE: { label: 'Bye', className: 'bg-[var(--pos)]/12 text-[var(--pos)] border-[var(--pos)]/30' },
  PLAYOFF: { label: 'Playoff', className: 'bg-[var(--accent)]/12 text-[var(--accent)] border-[var(--accent)]/30' },
  WILDCARD: { label: 'Wild Card', className: 'bg-[var(--live)]/15 text-[var(--live)] border-[var(--live)] border-dashed' },
  TOILET_BOWL: { label: 'Toilet Bowl', className: 'bg-[var(--surface2)] text-[var(--muted)] border-[var(--border)]' }
};

function SeedPill({ postseason }) {
  if (!postseason) return null;
  const pill = SEED_PILL[postseason.status] || SEED_PILL.TOILET_BOWL;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${pill.className}`}
      title={postseason.status === 'WILDCARD' ? 'Wild card: the 6th seed goes to the highest-PF team outside the top 5' : undefined}
    >
      #{postseason.seed} {pill.label}
    </span>
  );
}

function StandingsTable({ conf, rows, afcData, nfcData, latestCompletedWeek }) {
  const style = CONF_STYLES[conf];
  const { mode: nameDisplayMode } = useNameDisplay();
  const [sortKey, setSortKey] = useState('rank');
  const [sortDir, setSortDir] = useState('asc');
  const postseasonByManager = new Map(buildPostseasonSeeds(rows, conf).map(team => [team.manager, team]));
  const secondaryName = (manager) => (nameDisplayMode === 'teams' ? getRealName(afcData, nfcData, manager, conf) : manager);

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'rank' || key === 'manager' ? 'asc' : 'desc');
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const av = STANDINGS_SORT_ACCESSORS[sortKey](a);
    const bv = STANDINGS_SORT_ACCESSORS[sortKey](b);
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>{conf}</span>
          <span className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)]">Conference Standings</span>
        </div>
        <span className="text-xs font-semibold text-[var(--muted)]">
          {latestCompletedWeek >= 14 ? 'Final regular season' : `Through Week ${latestCompletedWeek}`} · Playoff odds update after each completed week
        </span>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs font-medium text-[var(--text)]">
          <thead className="bg-[var(--surface2)] text-[11px] text-[var(--text2)] border-b border-[var(--border)]">
            <tr>
              <SortHeader label="#" sortKey="rank" activeKey={sortKey} dir={sortDir} onClick={handleSort} title="Rank" />
              <SortHeader label={nameDisplayMode === 'teams' ? 'Team' : 'Manager'} sortKey="manager" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="League Pts" sortKey="totalPts" activeKey={sortKey} dir={sortDir} onClick={handleSort} title="2 per in-conference win, 1 per cross-conference win" />
              <SortHeader label="Record" sortKey="overall" activeKey={sortKey} dir={sortDir} onClick={handleSort} title="Overall W-L-T, with in-conference and cross-conference records underneath" />
              <SortHeader label="PF / gm" sortKey="pf" activeKey={sortKey} dir={sortDir} onClick={handleSort} title="Points scored per game, with points against underneath" />
              <SortHeader label="Playoff %" sortKey="playoffPct" activeKey={sortKey} dir={sortDir} onClick={handleSort} title="Estimated from 2,500 simulations; frozen until the next completed week" />
              <th className="py-2 px-2 whitespace-nowrap font-semibold">{latestCompletedWeek >= 14 ? 'Postseason' : 'Proj. Seed'}</th>
              <SortHeader label="FAAB" sortKey="faab" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
              <SortHeader label="Moves" sortKey="moves" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]/70">
            {sortedRows.map((item) => {
              const pulse = playoffPulse(item.playoffPct);
              const postseason = postseasonByManager.get(item.manager);
              const other = secondaryName(item.manager);
              return (
              <tr key={item.manager} className={`hover:bg-[var(--surface2)]/50 transition-colors duration-150 ${postseason?.seed <= 6 ? 'standings-playoff-team' : ''}`}>
                <td className="py-2 px-2 font-bold text-[var(--text2)]">{item.rank}</td>
                <td className="py-2 px-2">
                  <TeamName manager={item.manager} conf={conf} className="font-semibold" />
                  {other && <div className="text-[11px] font-normal text-[var(--muted)]">{other}</div>}
                </td>
                <td className={`py-2 px-2 font-bold ${style.text}`}>{item.totalPts.toFixed(1)}</td>
                <td className="py-2 px-2 whitespace-nowrap">
                  <div className="font-semibold">{item.overallRecord}</div>
                  <div className="text-[11px] text-[var(--muted)]">In {item.inConfRecord} · Cross {item.interConfRecord}</div>
                </td>
                <td className="py-2 px-2 whitespace-nowrap">
                  <div>{item.pfAvg.toFixed(2)}</div>
                  <div className="text-[11px] text-[var(--muted)]">PA {item.paAvg.toFixed(2)}</div>
                </td>
                <td className="py-2 px-2">
                  <div className={`font-extrabold ${pulse.color}`}>{item.playoffPct != null ? `${Math.round(item.playoffPct)}%` : '—'}</div>
                  <div className={`text-[11px] font-bold whitespace-nowrap ${pulse.color}`}>{pulse.label}</div>
                </td>
                <td className="py-2 px-2"><SeedPill postseason={postseason} /></td>
                <td className="py-2 px-2">{item.faab}</td>
                <td className="py-2 px-2 text-[var(--muted)]">{item.moves}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-[var(--border)]/70">
        {sortedRows.map((item) => {
          const pulse = playoffPulse(item.playoffPct);
          const postseason = postseasonByManager.get(item.manager);
          const other = secondaryName(item.manager);
          return (
          <div key={item.manager} className={`p-4 border-l-2 ${style.border} ${postseason?.seed <= 6 ? 'standings-playoff-team' : ''}`}>
            <div className="flex justify-between items-start gap-3 mb-3">
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-[var(--muted)] font-bold text-sm pt-0.5">#{item.rank}</span>
                <div className="min-w-0">
                  <TeamName manager={item.manager} conf={conf} className="font-bold" />
                  {other && <div className="text-xs text-[var(--muted)] truncate">{other}</div>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-lg font-extrabold tabular-nums leading-none ${style.text}`}>{item.totalPts.toFixed(1)}</div>
                <div className="text-[11px] font-semibold text-[var(--muted)]">League Pts</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <SeedPill postseason={postseason} />
              <span className="text-xs font-semibold text-[var(--text)]">{item.overallRecord}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-[11px] uppercase font-semibold text-[var(--muted)]">In-Conf</p>
                <p className="text-[var(--text)] font-semibold">{item.inConfRecord}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase font-semibold text-[var(--muted)]">Cross-Conf</p>
                <p className="text-[var(--text)] font-semibold">{item.interConfRecord}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase font-semibold text-[var(--muted)]">Playoff %</p>
                <p className={`font-extrabold ${pulse.color}`}>{item.playoffPct != null ? `${Math.round(item.playoffPct)}%` : '—'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase font-semibold text-[var(--muted)]">PF / gm</p>
                <p className="text-[var(--text)]">{item.pfAvg.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase font-semibold text-[var(--muted)]">PA / gm</p>
                <p className="text-[var(--text2)]">{item.paAvg.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase font-semibold text-[var(--muted)]">FAAB</p>
                <p className="text-[var(--text2)]">{item.faab}</p>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// Shared logic for both intra/cross-conference matchup info: figures out the Final/Live/Projected
// state for a matchup and (when live/projected) blends real per-player stats with projections.
function buildMatchupInfo({
  manager, opponent, week, latestCompletedWeek,
  myConfSeason, oppConfSeason, myConfData, oppConfData, myStats, oppStats, weekProjections,
  playersDB, byTeamWeek
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

  const myRoster = myConfData.rosters.find(r => r.manager === manager);
  const oppRoster = oppConfData.rosters.find(r => r.manager === opponent);
  const gameContext = { playersDB, byTeamWeek, week };
  const myBlended = computeBlendedRosterScore(mySnapshot, weekProjections, myConfData.scoringSettings, myFallbackField, gameContext);
  const oppBlended = computeBlendedRosterScore(oppSnapshot, weekProjections, oppConfData.scoringSettings, oppFallbackField, gameContext);
  const myProjected = myBlended?.total ?? computeRosterProjection(myRoster, weekProjections, myConfData.scoringSettings, myFallbackField);
  const oppProjected = oppBlended?.total ?? computeRosterProjection(oppRoster, weekProjections, oppConfData.scoringSettings, oppFallbackField);
  // Bench/IR player ids for the expanded roster comparison view -- sourced from each manager's
  // CURRENT roster (Sleeper's per-week matchup payload only ever includes starters, not bench), so
  // this is an approximation of "who was benched/on IR" for past weeks rather than a historical
  // fact, same caveat as elsewhere in the app that leans on the live roster for weekly context.
  const myIrIds = myRoster?.reserve || [];
  const oppIrIds = oppRoster?.reserve || [];
  const myBenchIds = (myRoster?.players || []).filter(id => !(mySnapshot?.starters || []).includes(id) && !myIrIds.includes(id));
  const oppBenchIds = (oppRoster?.players || []).filter(id => !(oppSnapshot?.starters || []).includes(id) && !oppIrIds.includes(id));

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
    // Pregame team projections must stay anchored to Sleeper's weekly player projection feed.
    // Historical scoring averages are useful context for variance/odds, but substituting them as
    // the displayed "Proj" total made Matchups disagree with the canonical This Week total.
    myFinalScore = myProjected;
    oppFinalScore = oppProjected;
    myWinPct = roughWinProbability(myProjected, oppProjected);
    winPctIsRough = myWinPct !== null;
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
    myBenchIds, oppBenchIds, myIrIds, oppIrIds,
    myScoringSettings: myConfData.scoringSettings, myFallbackField,
    oppScoringSettings: oppConfData.scoringSettings, oppFallbackField
  };
}

function getIntraInfo(manager, season, stats, week, confData, weekProjections, latestCompletedWeek, playersDB, byTeamWeek) {
  const pair = (season.scheduleByWeek[week] || []).find(([a, b]) => a === manager || b === manager);
  if (!pair) return null;
  const opponent = pair[0] === manager ? pair[1] : pair[0];
  return buildMatchupInfo({
    manager, opponent, week, latestCompletedWeek,
    myConfSeason: season, oppConfSeason: season, myConfData: confData, oppConfData: confData,
    myStats: stats[manager], oppStats: stats[opponent], weekProjections, playersDB, byTeamWeek
  });
}

function getInterInfo(manager, myConf, weekCrossPairs, afcSeason, nfcSeason, allStats, week, afcData, nfcData, weekProjections, latestCompletedWeek, playersDB, byTeamWeek) {
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
      myStats: allStats[manager], oppStats: allStats[opponent], weekProjections, playersDB, byTeamWeek
    })
  };
}

// Best known score for a team this week -- uses the SAME per-player blended real+projected total
// as the matchup pills (computeBlendedRosterScore), so the "Week Total Points" figure here always
// matches what the individual matchup cards add up to. The separate pregame value remains the
// league-scored starter total before real game results factor in, for the weekly chart's baseline.
function estimateTeamScore(manager, confData, season, week, weekProjections, latestCompletedWeek, playersDB, byTeamWeek, frozenPlayerProjections = null) {
  const isFinal = week <= latestCompletedWeek;
  const fallbackField = scoringFieldFor(confData.receptionPoints || 0);
  const snapshot = season.rosterSnapshotByWeek[week]?.[manager];
  const roster = confData.rosters.find(r => r.manager === manager);
  // Prefer that week's actual starter snapshot whenever it exists. That preserves the lineup
  // that generated the live/final score instead of substituting today's roster for a past week.
  const pregame = computeRosterProjection(snapshot || roster, weekProjections, confData.scoringSettings, fallbackField, frozenPlayerProjections);
  if (isFinal) return { value: season.scoreByWeek[week]?.[manager] || 0, pregame, isFinal: true };
  const blended = computeBlendedRosterScore(
    snapshot, weekProjections, confData.scoringSettings, fallbackField,
    { playersDB, byTeamWeek, week }
  );
  if (blended) return { value: blended.total, pregame, isFinal: false };
  return { value: pregame, pregame, isFinal: false };
}

// Merge one freshly fetched Sleeper matchup week into the existing season object. This lets the
// live refresh update real team/player points without re-downloading all 14 weeks every minute.
function mergeMatchupWeek(previous, week, pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) return previous;
  const scores = {};
  const schedule = [];
  const snapshots = {};
  pairs.forEach(([a, b]) => {
    scores[a.manager] = a.points;
    scores[b.manager] = b.points;
    schedule.push([a.manager, b.manager]);
    snapshots[a.manager] = { starters: a.starters, startersPoints: a.startersPoints, playersPoints: a.playersPoints };
    snapshots[b.manager] = { starters: b.starters, startersPoints: b.startersPoints, playersPoints: b.playersPoints };
  });
  return {
    ...previous,
    scoreByWeek: { ...previous.scoreByWeek, [week]: scores },
    scheduleByWeek: { ...previous.scheduleByWeek, [week]: schedule },
    rosterSnapshotByWeek: { ...previous.rosterSnapshotByWeek, [week]: snapshots }
  };
}

const VALID_TABS = new Set(["home", "currentWeek", "standings", "matchups", "players", "activity", "teams", "charter"]);
// Old bookmarked hashes keep landing somewhere sensible after the navigation consolidation.
const LEGACY_TAB_PARENTS = {
  playoffs: "standings",
  trends: "standings",
  grid: "matchups",
  season: "matchups",
  league: "players",
  news: "currentWeek"
};

// The hash can carry a "?week=N" suffix (e.g. "#matchups?week=3") so a shared link -- see
// WeeklyScoresBarChart's "Copy Link" -- lands directly on the right week, not just the right tab.
function tabFromHash() {
  const id = window.location.hash.slice(1).split('?')[0];
  return VALID_TABS.has(id) ? id : (LEGACY_TAB_PARENTS[id] || null);
}
function rawTabFromHash() {
  return window.location.hash.slice(1).split('?')[0];
}
function weekFromHash() {
  const query = window.location.hash.slice(1).split('?')[1];
  const week = query ? Number(new URLSearchParams(query).get('week')) : null;
  return Number.isInteger(week) && week >= 1 ? week : null;
}

export default function App() {
  const [afcLeagueId, setAfcLeagueId] = useState(() => localStorage.getItem('lenzone_afc_league_id') || AFC_LEAGUE_ID);
  const [nfcLeagueId, setNfcLeagueId] = useState(() => localStorage.getItem('lenzone_nfc_league_id') || NFC_LEAGUE_ID);
  // Deep-linkable: the current tab lives in the URL hash (shareable/bookmarkable, and survives a
  // reload) rather than only in memory. A bare visit to the root URL (no hash at all) always lands
  // on Home -- it used to fall back to whatever tab localStorage remembered from your last visit,
  // which meant the bare domain silently stopped going Home once you'd ever navigated anywhere else.
  // A returning visitor who has already picked their team skips the picker and lands on My Week.
  const [activeTab, setActiveTabState] = useState(() => {
    const fromHash = tabFromHash();
    if (fromHash) return fromHash;
    try { return localStorage.getItem('lenzone_my_team') ? "currentWeek" : "home"; } catch { return "home"; }
  });
  const setActiveTab = (id) => {
    setActiveTabState(id);
    window.history.pushState(null, '', `#${id}`);
  };
  // Switching tabs always lands at the top of the new page, never wherever the previous tab
  // happened to be scrolled to.
  useEffect(() => { window.scrollTo(0, 0); }, [activeTab]);
  // The playoff bracket is a mode of the Standings page (#playoffs deep-links straight to it).
  const [standingsView, setStandingsView] = useState(() => rawTabFromHash() === "playoffs" ? "playoffs" : "overview");
  // Back/forward browser navigation updates both the page and the bracket mode.
  useEffect(() => {
    const handler = () => {
      const id = tabFromHash();
      if (id) setActiveTabState(id);
      setStandingsView(rawTabFromHash() === "playoffs" ? "playoffs" : "overview");
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  // Deliberately resets to fantasy-team names on every fresh page load. The toggle is a viewing
  // preference for the current visit, not a sticky setting that can surprise someone next time.
  const [nameDisplayMode, setNameDisplayMode] = useState('teams');
  const [selectedWeek, setSelectedWeek] = useState(() => weekFromHash() || 1);
  // Per-week, per-conference player projections. Unstarted players keep refreshing with Sleeper;
  // their individual number locks once their own NFL game has begun.
  const [pregamePlayerSnapshots, setPregamePlayerSnapshots] = useState({});
  // A shared "Copy Link" URL (see WeeklyScoresBarChart) carries the week in the hash too --
  // back/forward navigation should honor it the same way it already does for the tab.
  useEffect(() => {
    const handler = () => {
      const w = weekFromHash();
      if (w) setSelectedWeek(w);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  const [myTeamManager, setMyTeamManager] = useState(() => localStorage.getItem('lenzone_my_team') || null);
  // Starts true (not false) -- the very first render happens BEFORE loadData's effect has even
  // fired, so a reload landing directly on a deep tab (via a bookmarked #hash URL) would otherwise
  // render that tab's real content against still-empty afcData/nfcData for one frame. Tracked
  // separately from the general `loading` flag below (which also flips true on every later
  // re-fetch) via hasLoadedOnce -- only the FIRST load should gate the page; a background refresh
  // afterward shouldn't blank an already-showing tab.
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('lenzone_admin') === 'true');
  // A deep link to the admin-only broadcast tab from a non-admin session lands on Home instead of
  // a blank page.
  useEffect(() => { if (activeTab === "teams" && !isAdmin) setActiveTab("home"); }, [activeTab, isAdmin]);
  // Keeps the URL in sync even on first load (so the address bar always reflects real state,
  // ready to copy/share/bookmark).
  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', `#${activeTab}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [charterText, setCharterText] = useState(() => localStorage.getItem('lenzone_charter') || DEFAULT_CHARTER);
  const [charterDraft, setCharterDraft] = useState(charterText);

  const [broadcastCopyState, setBroadcastCopyState] = useState('idle');

  const [afcData, setAfcData] = useState({ name: "AFC Conference", rosters: [], rosterIdMap: {} });
  const [nfcData, setNfcData] = useState({ name: "NFC Conference", rosters: [], rosterIdMap: {} });

  // Easter egg: picking ANY team plays a random clip from the shared public/sounds/generic/ pool,
  // plus a confetti burst.
  const [teamBurst, setTeamBurst] = useState(null);
  // Sounds and fun animations are both off unless someone turns them on in settings.
  const [soundMuted, setSoundMuted] = useState(() => { try { return localStorage.getItem('lenzone_sound_muted') !== 'false'; } catch { return true; } });
  // "Fun animations" (dancing stickmen + grabbable football). On by default; settings menu toggle.
  const [funEnabled, setFunEnabled] = useState(() => {
    try { return localStorage.getItem('lenzone_fun_enabled') === 'true'; } catch { return false; }
  });
  const toggleFunEnabled = () => {
    setFunEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('lenzone_fun_enabled', String(next)); } catch {}
      return next;
    });
  };
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
  const headerRowRef = useRef(null);
  const BASE_SOUND_VOLUME = 0.6; // 40% quieter than the source clip -- a light touch, not a jump-scare
  const rebalanceVolumes = () => {
    const n = activeAudiosRef.current.length;
    const level = n > 0 ? BASE_SOUND_VOLUME / n : BASE_SOUND_VOLUME;
    activeAudiosRef.current.forEach(a => { a.volume = level; });
  };
  // Resolving is async (a HEAD check for that manager's exclusive file) -- fine to fire and forget,
  // it just plays whenever the check resolves a moment later.
  const playTeamSound = (manager) => {
    if (soundMuted) return;
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
  const triggerTeamEasterEgg = (manager) => {
    setTeamBurst({ nonce: Date.now() });
    playTeamSound(manager);
  };
  // Plays the remembered team's welcome sound every time you land on the Home tab -- a fresh page
  // load (which starts on Home by default), and also every subsequent trip back to Home within the
  // same session -- not just once ever, so a team that was already selected before still greets you
  // each time you're back on the landing page. Browsers flatly block audio.play() before the page
  // has seen ANY user gesture (click/key/touch) -- navigator.userActivation.hasBeenActive (Chrome/
  // Edge) tells us whether that's already happened; where it's unsupported (Firefox/Safari) we just
  // assume it hasn't and wait for one, which costs at most one extra click before the sound is
  // heard rather than being silently swallowed forever like a bare on-mount call was.
  // Keyed on activeTab ONLY (myTeamManager read from a ref, not a dependency) -- actively picking a
  // team already plays its own sound via chooseMyTeam/triggerTeamEasterEgg, and that pick updates
  // myTeamManager; if this effect also depended on myTeamManager it would re-fire a SECOND sound for
  // that same click (the gesture-check branch fires immediately since a gesture just happened),
  // doubling up. Landing on Home is the only thing that should trigger this one.
  const myTeamManagerRef = useRef(myTeamManager);
  useEffect(() => { myTeamManagerRef.current = myTeamManager; }, [myTeamManager]);
  useEffect(() => {
    if (activeTab !== "home") return;
    const manager = myTeamManagerRef.current;
    if (!manager) return;
    if (typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive) {
      playTeamSound(manager);
      return;
    }
    const events = ['pointerdown', 'keydown', 'touchstart'];
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      playTeamSound(myTeamManagerRef.current);
      events.forEach(e => window.removeEventListener(e, fire, true));
    };
    events.forEach(e => window.addEventListener(e, fire, true));
    return () => events.forEach(e => window.removeEventListener(e, fire, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const [afcSeason, setAfcSeason] = useState({ scoreByWeek: {}, scheduleByWeek: {}, rosterSnapshotByWeek: {}, latestCompletedWeek: 0 });
  const [nfcSeason, setNfcSeason] = useState({ scoreByWeek: {}, scheduleByWeek: {}, rosterSnapshotByWeek: {}, latestCompletedWeek: 0 });
  const [afcPostseason, setAfcPostseason] = useState({});
  const [nfcPostseason, setNfcPostseason] = useState({});

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
  const currentSleeperWeek = sleeperCurrentWeek(nflState.week, SEASON_WEEKS);
  const defaultSelectedWeek = defaultBrowseWeek(nflState.week, SEASON_WEEKS);

  // The weekly pages are actions, not just tab labels: they reset to the useful default
  // week instead of preserving an older week the viewer browsed. On Tuesdays that is the just-
  // completed week; Sleeper's newer week remains the official current-week ID everywhere else.
  const navigateToTab = (id) => {
    if (id === 'playoffs') {
      setStandingsView('playoffs');
      setActiveTabState('standings');
      window.history.pushState(null, '', '#playoffs');
      return;
    }
    if (id === 'standings') setStandingsView('overview');
    if (LEGACY_TAB_PARENTS[id]) id = LEGACY_TAB_PARENTS[id];
    if (id === 'currentWeek' || id === 'matchups' || id === 'teams') {
      setSelectedWeek(defaultSelectedWeek);
      setActiveTabState(id);
      window.history.pushState(null, '', `#${id}?week=${defaultSelectedWeek}`);
      return;
    }
    setActiveTab(id);
  };

  // The weekly views default to Sleeper's current week, except on Tuesday when recap work defaults
  // to the just-completed week. Only does this ONCE (the ref guard), so it
  // doesn't yank the viewer back to the current week if they've already navigated to a different
  // one and this effect re-fires from an unrelated nflState update (e.g. a background refresh).
  // A week deep-linked via the URL hash (see weekFromHash/"Copy Link") wins over the "default to
  // the normal day-aware behavior below -- seeding the guard ref as already-fired skips it
  // entirely instead of yanking a shared link back to whatever week it happens to be right now.
  const didSetInitialWeek = useRef(weekFromHash() != null);
  // Waits for the first real load -- the initial placeholder nflState ({ week: 1 }) used to lock
  // the guard on Week 1 before Sleeper's actual current week arrived.
  useEffect(() => {
    if (didSetInitialWeek.current || !hasLoadedOnce || !nflState.week) return;
    didSetInitialWeek.current = true;
    setSelectedWeek(defaultBrowseWeek(nflState.week, SEASON_WEEKS));
  }, [nflState.week, hasLoadedOnce]);

  // Sleeper failures used to be swallowed silently (empty tabs, no explanation). Track them so a
  // visible banner can say so and offer a retry, plus a "last updated" time.
  const [loadError, setLoadError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
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
    setLoadError(!afcRes || !nfcRes);
    if (afcRes && nfcRes) setLastUpdated(new Date());
    setLoading(false);
    setHasLoadedOnce(true);
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

  // LENZONE's custom standings decide the playoff field, then the commissioners manually enter
  // those pairings in Sleeper. While the bracket view is open inside Standings, pull Weeks 15-17 so it becomes a
  // live scoreboard after that handoff without mixing postseason scores into regular-season PF.
  useEffect(() => {
    if (activeTab !== 'standings' || standingsView !== 'playoffs') return;
    const hasAfcMap = Object.keys(afcData.rosterIdMap).length > 0;
    const hasNfcMap = Object.keys(nfcData.rosterIdMap).length > 0;
    if (!hasAfcMap || !hasNfcMap) return;
    let cancelled = false;
    const refreshPostseason = async () => {
      const [afcWeeks, nfcWeeks] = await Promise.all([
        Promise.all(PLAYOFF_WEEKS.map(async week => [week, await fetchWeekMatchups(afcLeagueId, week, afcData.rosterIdMap)])),
        Promise.all(PLAYOFF_WEEKS.map(async week => [week, await fetchWeekMatchups(nfcLeagueId, week, nfcData.rosterIdMap)]))
      ]);
      if (cancelled) return;
      setAfcPostseason(Object.fromEntries(afcWeeks));
      setNfcPostseason(Object.fromEntries(nfcWeeks));
    };
    const stopPolling = startPolling(refreshPostseason, 60 * 1000);
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [activeTab, standingsView, afcLeagueId, nfcLeagueId, afcData.rosterIdMap, nfcData.rosterIdMap]);

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

  // Keep the activity crawl current without repeatedly downloading every week of transaction
  // history. The full season loads once above; only Sleeper's current week is refreshed here.
  useEffect(() => {
    const currentWeek = Math.min(18, Math.max(1, nflState.week || 1));
    let cancelled = false;
    const mergeTransactions = (previous, latest) => {
      const merged = new Map((previous || []).map(transaction => [transaction.transaction_id, transaction]));
      (latest || []).forEach(transaction => merged.set(transaction.transaction_id, transaction));
      return [...merged.values()];
    };
    const refreshCurrentActivity = async () => {
      const [afcLatest, nfcLatest] = await Promise.all([
        fetchWeekTransactions(afcLeagueId, currentWeek),
        fetchWeekTransactions(nfcLeagueId, currentWeek)
      ]);
      if (cancelled) return;
      setAfcTransactions(previous => mergeTransactions(previous, afcLatest));
      setNfcTransactions(previous => mergeTransactions(previous, nfcLatest));
    };
    const stopPolling = startPolling(refreshCurrentActivity, 2 * 60 * 1000);
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [afcLeagueId, nfcLeagueId, nflState.week]);

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

  // Real per-week fantasy projections (RotoWire, via Sleeper) for the WHOLE season -- powers the
  // matchup/roster views and the player modal's full-season weekly table.
  useEffect(() => {
    fetchAllWeekProjections(SEASON_YEAR, SEASON_WEEKS).then(setWeekProjectionsByWeek);
  }, []);
  // Sleeper can revise projections and live scores throughout the week. Refresh the selected
  // week's projection feed AND both leagues' matchup payloads together so every player/team Proj
  // surface is rebuilt from the same current Sleeper snapshot.
  useEffect(() => {
    let cancelled = false;
    const refreshSelectedWeek = async () => {
      const hasAfcMap = Object.keys(afcData.rosterIdMap).length > 0;
      const hasNfcMap = Object.keys(nfcData.rosterIdMap).length > 0;
      const [latestProjections, afcPairs, nfcPairs] = await Promise.all([
        fetchWeekProjections(SEASON_YEAR, selectedWeek),
        hasAfcMap ? fetchWeekMatchups(afcLeagueId, selectedWeek, afcData.rosterIdMap) : Promise.resolve(null),
        hasNfcMap ? fetchWeekMatchups(nfcLeagueId, selectedWeek, nfcData.rosterIdMap) : Promise.resolve(null)
      ]);
      if (cancelled) return;
      if (Object.keys(latestProjections).length > 0) {
        setWeekProjectionsByWeek(previous => ({ ...previous, [selectedWeek]: latestProjections }));
      }
      if (afcPairs?.length) setAfcSeason(previous => mergeMatchupWeek(previous, selectedWeek, afcPairs));
      if (nfcPairs?.length) setNfcSeason(previous => mergeMatchupWeek(previous, selectedWeek, nfcPairs));
    };
    const stopPolling = startPolling(refreshSelectedWeek, 60 * 1000);
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [selectedWeek, afcLeagueId, nfcLeagueId, afcData.rosterIdMap, nfcData.rosterIdMap]);
  const weekProjections = weekProjectionsByWeek[selectedWeek] || EMPTY_OBJECT;

  // Real NFL schedule (which teams play, the date, and real game status) -- powers the "game day"
  // indicator on rosters/players and the Home tab's This Week's Games panel.
  const [nflSchedule, setNflSchedule] = useState({ byTeamWeek: {}, games: [] });
  useEffect(() => {
    fetchNflSchedule(SEASON_YEAR).then(setNflSchedule);
  }, []);

  // Real kickoff time + live status/clock for the currently viewed week, from ESPN's public
  // scoreboard (Sleeper's own schedule feed has no game clock). During games, refresh it on the
  // same one-minute cadence as Sleeper stats so the Sleeper-matched live projection curve moves.
  const [weekKickoffInfo, setWeekKickoffInfo] = useState({});
  useEffect(() => {
    let cancelled = false;
    const refreshKickoffInfo = async () => {
      const latest = await fetchWeekKickoffInfo(selectedWeek, SEASON_YEAR);
      if (!cancelled) setWeekKickoffInfo(latest);
    };
    const stopPolling = startPolling(refreshKickoffInfo, 60 * 1000);
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [selectedWeek]);

  // Real league-wide "big plays" (longest pass/run/field goal) for the viewed week, from ESPN's
  // real play-by-play -- only fetched once that week is actually done (selectedWeek <=
  // latestCompletedWeek), since a mid-week fetch would just be an incomplete, still-changing
  // partial answer to "longest of the week". One request per game in the week, so this is cached
  // per week (not refetched on unrelated re-renders) via the effect's own dependency array.
  const [weekBigPlays, setWeekBigPlays] = useState(null);
  useEffect(() => {
    if (selectedWeek > latestCompletedWeek) { setWeekBigPlays(null); return; }
    let cancelled = false;
    fetchWeekBigPlays(selectedWeek, SEASON_YEAR).then(result => { if (!cancelled) setWeekBigPlays(result); });
    return () => { cancelled = true; };
  }, [selectedWeek, latestCompletedWeek]);

  // Real, live current NFL headlines (ESPN's own public news feed), refetched every 10 minutes.
  // "Your Player News" on My Week cross-references this against your roster, so a wider pull
  // gives that a real chance of finding a match.
  const [nflHeadlines, setNflHeadlines] = useState([]);
  const refreshHeadlines = () => fetchNflHeadlines(30).then(setNflHeadlines);
  useEffect(() => startPolling(refreshHeadlines, 10 * 60 * 1000), []);

  // Real per-player fantasy notes, league-wide, one request (see lib/espnApi.js
  // fetchNflPlayerNotes) -- cross-referenced against whichever roster is currently selected to
  // build "Your Player News" below.
  const [nflPlayerNotes, setNflPlayerNotes] = useState({});
  const refreshPlayerNotes = () => fetchNflPlayerNotes().then(setNflPlayerNotes);
  useEffect(() => startPolling(refreshPlayerNotes, 10 * 60 * 1000), []);

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

  const afcManagers = afcData.rosters.length > 0 ? afcData.rosters.map(r => r.manager) : AFC_DEFAULT;
  const nfcManagers = nfcData.rosters.length > 0 ? nfcData.rosters.map(r => r.manager) : NFC_DEFAULT;
  const myTeamConf = myTeamManager && afcManagers.includes(myTeamManager) ? "AFC" : myTeamManager && nfcManagers.includes(myTeamManager) ? "NFC" : null;
  const resolvedMyTeamManager = myTeamConf ? myTeamManager : null;

  // Sleeper team names can change while an older name remains in localStorage. Once both real
  // league rosters have loaded, discard a selection that no longer resolves instead of passing a
  // truthy manager with a null conference into matchup cards (which expect a valid CONF_STYLES
  // entry). The viewer can then choose the team's current name from the picker.
  useEffect(() => {
    const hasRealRosters = afcData.rosters.length > 0 && nfcData.rosters.length > 0;
    if (!hasRealRosters || !myTeamManager || myTeamConf) return;
    setMyTeamManager(null);
    localStorage.removeItem('lenzone_my_team');
  }, [afcData.rosters.length, nfcData.rosters.length, myTeamManager, myTeamConf]);

  // Jumping to a specific manager's matchup (e.g. from Home) must clear the conference filter to
  // ALL first -- otherwise, if that manager is in the conference NOT currently filtered to (a
  // cross-conference opponent while your own conference is selected), their matchup card is
  // filtered out of view entirely and the tab appears to do nothing.
  const goToMatchup = (manager, week) => {
    // Your own matchup is always pinned at the top of the Matchups tab now, so jumping to your
    // OWN card (e.g. "Full Matchups Tab ->" from Home/This Week) shouldn't also filter the full
    // list down to just you -- that filter is only useful when the click was actually pointing at
    // someone else (a trophy card, a grid cell, a matchup preview) that isn't shown up top already.
    if (week != null) setSelectedWeek(week);
    setActiveTab("matchups");
  };

  const chooseMyTeam = (manager) => {
    setMyTeamManager(manager);
    if (manager) localStorage.setItem('lenzone_my_team', manager);
    else localStorage.removeItem('lenzone_my_team');
    if (manager) triggerTeamEasterEgg(manager);
    // Only the conference filter focuses on your own side -- the Matchups "Filter Manager" dropdown
    // resets to "All Managers" (never to your own team) every time "I am" changes, so a manual
    // filter pick from a PREVIOUS identity doesn't linger and quietly scope the matchup list to
    // someone you're no longer looking at things as.
    // Players > Player Search keeps its own internal filter state and doesn't otherwise know "I am"
    // changed -- remounting it (via a key tied to myTeamManager, see the Players tab render) is what
    // actually resets it back to All/All instead of leaving a stale manager/position filter behind.
  };

  // Standings/Matchups conference filter defaults to "ALL" and stays there regardless of which
  // "I am" team is picked -- it used to auto-narrow to your own conference the moment a team was
  // remembered, which meant the Matchups tab silently hid the other conference's matchups without
  // ever being asked to. The Matchups tab instead just orders your own conference's section first
  // (see myTeamConf-based ordering below) -- everyone's still shown unless the viewer manually
  // picks a conference from the filter themselves.

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
  // Real names of every player on the currently-selected ("I am") roster -- used to cross-reference
  // the real ESPN player-notes/headlines feeds above into "Your Player News", scoped to whichever
  // team is picked. Real Sleeper player data via playerLabel, never guessed.
  const myTeamPlayerNames = useMemo(
    () => (myTeamRoster?.players || []).map(pid => playerLabel(playersDB, pid).name).filter(Boolean),
    [myTeamRoster, playersDB]
  );
  // Real Sleeper team-abbreviation/position/jersey-number for each of "my" players, keyed by name
  // so it can be merged onto the ESPN-sourced notes below (ESPN's own note only carries a full
  // team NAME, not the short "CIN #5 RB"-style tag the rest of this app already uses everywhere
  // else -- Sleeper's roster data already has that, just needs attaching here).
  const myTeamPlayerInfoByName = useMemo(() => {
    const map = {};
    (myTeamRoster?.players || []).forEach(pid => {
      const p = playerLabel(playersDB, pid);
      if (p?.name) map[p.name] = { nflTeam: p.team, position: p.position, number: p.number };
    });
    return map;
  }, [myTeamRoster, playersDB]);
  const myPlayerNotes = useMemo(
    () => filterPlayerNotesForPlayers(nflPlayerNotes, myTeamPlayerNames)
      .map(n => ({ ...n, ...myTeamPlayerInfoByName[n.player] })),
    [nflPlayerNotes, myTeamPlayerNames, myTeamPlayerInfoByName]
  );
  const myPlayerHeadlines = useMemo(
    () => filterHeadlinesForPlayers(nflHeadlines, myTeamPlayerNames),
    [nflHeadlines, myTeamPlayerNames]
  );

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

  // Real calendar span of each NFL week (first to last game date), from Sleeper's schedule --
  // shown under each week in the schedule grid. Weeks with no schedule data simply show no date.
  const weekDateLabels = useMemo(() => {
    const byWeek = {};
    (nflSchedule.games || []).forEach(g => {
      if (!g.week || !g.date) return;
      const d = new Date(`${g.date}T12:00:00`);
      if (Number.isNaN(d.getTime())) return;
      const span = byWeek[g.week] || (byWeek[g.week] = { start: d, end: d });
      if (d < span.start) span.start = d;
      if (d > span.end) span.end = d;
    });
    const fmt = (d, withMonth) => d.toLocaleDateString(undefined, withMonth ? { month: 'short', day: 'numeric' } : { day: 'numeric' });
    const labels = {};
    Object.entries(byWeek).forEach(([week, { start, end }]) => {
      labels[week] = start.getTime() === end.getTime()
        ? fmt(start, true)
        : `${fmt(start, true)}–${fmt(end, start.getMonth() !== end.getMonth())}`;
    });
    return labels;
  }, [nflSchedule.games]);

  const enrichedNflGames = useMemo(() => {
    return (nflSchedule.games || []).map(g => {
      const info = weekKickoffInfo[g.home] || weekKickoffInfo[g.away];
      return info ? { ...g, ...info } : g;
    });
  }, [nflSchedule.games, weekKickoffInfo]);

  // Live games are always highlighted on the Matchups tab too, even with nothing manually
  // selected -- a game actually in progress right now is worth calling out on its own.
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

  // Do not publish a temporary odds table while the league shells have loaded but their full
  // season schedules have not. That transient state otherwise seeds simulations with no games
  // and can briefly show arbitrary manager-order-based odds before the real standings arrive.
  const hasStandingsData = afcData.rosters.length > 0 && nfcData.rosters.length > 0
    && Object.keys(afcSeason.scheduleByWeek).length > 0
    && Object.keys(nfcSeason.scheduleByWeek).length > 0;

  const { afcStandings, nfcStandings, allStats } = useMemo(() => {
    const crossRecords = computeCrossRecords(schedule, afcSeason, nfcSeason, latestCompletedWeek);
    const afcPA = computePointsAgainst(afcManagers, afcSeason, latestCompletedWeek);
    const nfcPA = computePointsAgainst(nfcManagers, nfcSeason, latestCompletedWeek);
    const afcInConf = computeInConfRecord(afcManagers, afcSeason, latestCompletedWeek);
    const nfcInConf = computeInConfRecord(nfcManagers, nfcSeason, latestCompletedWeek);
    const afcCrossPA = computeCrossPointsAgainst(afcManagers, schedule, afcSeason, nfcSeason, latestCompletedWeek);
    const nfcCrossPA = computeCrossPointsAgainst(nfcManagers, schedule, afcSeason, nfcSeason, latestCompletedWeek);
    const afcIntraGames = {}; afcManagers.forEach(m => { afcIntraGames[m] = computeIntraGamesPlayed(m, afcSeason, latestCompletedWeek); });
    const nfcIntraGames = {}; nfcManagers.forEach(m => { nfcIntraGames[m] = computeIntraGamesPlayed(m, nfcSeason, latestCompletedWeek); });
    const afcInterGames = {}; afcManagers.forEach(m => { afcInterGames[m] = computeInterGamesPlayed(m, schedule, afcSeason, nfcSeason, latestCompletedWeek); });
    const nfcInterGames = {}; nfcManagers.forEach(m => { nfcInterGames[m] = computeInterGamesPlayed(m, schedule, afcSeason, nfcSeason, latestCompletedWeek); });
    const afcBaseList = buildConferenceList(afcManagers, afcData, crossRecords, afcPA, afcInConf, afcCrossPA, afcIntraGames, afcInterGames);
    const nfcBaseList = buildConferenceList(nfcManagers, nfcData, crossRecords, nfcPA, nfcInConf, nfcCrossPA, nfcIntraGames, nfcInterGames);

    const afcStats = computeStats(buildHistory(afcSeason.scoreByWeek, latestCompletedWeek), afcManagers);
    const nfcStats = computeStats(buildHistory(nfcSeason.scoreByWeek, latestCompletedWeek), nfcManagers);

    const { afcOdds, nfcOdds } = hasStandingsData
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
  }, [afcData, nfcData, afcSeason, nfcSeason, schedule, latestCompletedWeek, afcTransactions, nfcTransactions, hasStandingsData, afcManagers, nfcManagers]);


  const isSelectedWeekFinal = selectedWeek <= latestCompletedWeek;
  const weekCrossPairs = schedule.filter(m => m.week === selectedWeek);

  // My team's own matchups this week (same buildMatchupInfo pipeline as the Matchups tab cards),
  // used to power the "Playing ___" section on Home.
  const myTeamIntra = myTeamManager && myTeamConf
    ? getIntraInfo(myTeamManager, myTeamConf === "AFC" ? afcSeason : nfcSeason, allStats, selectedWeek, myTeamConfData, weekProjections, latestCompletedWeek, playersDB, enrichedByTeamWeek)
    : null;
  const myTeamInter = myTeamManager && myTeamConf
    ? getInterInfo(myTeamManager, myTeamConf, weekCrossPairs, afcSeason, nfcSeason, allStats, selectedWeek, afcData, nfcData, weekProjections, latestCompletedWeek, playersDB, enrichedByTeamWeek)
    : null;

  // Best projected finish per manager for this week. A live roster snapshot yields the blended
  // real+projected finish; a future week without a snapshot falls back to that manager's current
  // starters and the selected week's projections. Pregame totals use player-level freezes, so a
  // Monday starter can still receive an updated forecast after the Sunday games are underway.
  const frozenPregamePlayers = pregamePlayerSnapshots[selectedWeek] || { AFC: {}, NFC: {} };
  const projectedScoreByManager = {};
  const pregameScoreByManager = {};
  const collectTeamScores = (managers, confData, season, frozenPlayerProjections) => {
    managers.forEach(m => {
      const estimate = estimateTeamScore(m, confData, season, selectedWeek, weekProjections, latestCompletedWeek, playersDB, enrichedByTeamWeek, frozenPlayerProjections);
      if (!isSelectedWeekFinal && estimate.value != null) projectedScoreByManager[m] = estimate.value;
      if (estimate.pregame != null) pregameScoreByManager[m] = estimate.pregame;
    });
  };

  collectTeamScores(afcManagers, afcData, afcSeason, frozenPregamePlayers.AFC);
  collectTeamScores(nfcManagers, nfcData, nfcSeason, frozenPregamePlayers.NFC);
  const pregameSnapshotKey = `lenzone_pregame_player_projections_${SEASON_YEAR}_${selectedWeek}`;
  // Track the real current slate at the player level. While a player's NFL game is still pregame,
  // refresh their number (and honor any lineup change). When their game is in/post, retain the
  // last value we observed; first visits mid-game fall back to Sleeper's then-current baseline.
  useEffect(() => {
    let stored = null;
    try {
      const raw = localStorage.getItem(pregameSnapshotKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') stored = parsed;
    } catch {}
    const next = { AFC: { ...(stored?.AFC || {}) }, NFC: { ...(stored?.NFC || {}) } };
    const shouldTrackLivePlayers = !isSelectedWeekFinal && selectedWeek === nflState.week;
    let changed = false;
    if (shouldTrackLivePlayers) {
      const collectPlayers = (conf, managers, confData, season) => {
        const fallbackField = scoringFieldFor(confData.receptionPoints || 0);
        managers.forEach(manager => {
          const snapshot = season.rosterSnapshotByWeek[selectedWeek]?.[manager];
          const roster = confData.rosters.find(r => r.manager === manager);
          (snapshot?.starters || roster?.starters || []).forEach(id => {
            if (!id || id === '0') return;
            const projection = projectedPoints(weekProjections, id, confData.scoringSettings, fallbackField);
            if (!Number.isFinite(projection)) return;
            const nflTeam = playersDB?.[id]?.team;
            const game = nflTeam ? enrichedByTeamWeek?.[nflTeam]?.[selectedWeek] : null;
            const hasStarted = game?.state === 'in' || game?.state === 'post';
            // Refresh before kickoff; at/after kickoff only seed a missing value as a graceful
            // fallback for someone who first opens the site while that game is already underway.
            if (!hasStarted || !Number.isFinite(next[conf][id])) {
              if (next[conf][id] !== projection) { next[conf][id] = projection; changed = true; }
            }
          });
        });
      };
      collectPlayers('AFC', afcManagers, afcData, afcSeason);
      collectPlayers('NFC', nfcManagers, nfcData, nfcSeason);
    }
    const nextFingerprint = JSON.stringify(next);
    if (changed) {
      try { localStorage.setItem(pregameSnapshotKey, nextFingerprint); } catch {}
    }
    if (Object.keys(next.AFC).length || Object.keys(next.NFC).length) {
      setPregamePlayerSnapshots(previous => (
        JSON.stringify(previous[selectedWeek] || {}) === nextFingerprint
          ? previous
          : { ...previous, [selectedWeek]: next }
      ));
    }
  }, [pregameSnapshotKey, selectedWeek, isSelectedWeekFinal, nflState.week, weekProjections, playersDB, enrichedByTeamWeek, afcManagers, nfcManagers, afcData, nfcData, afcSeason, nfcSeason]);
  const weeklyAwards = computeWeeklyAwards(afcSeason, nfcSeason, selectedWeek, isSelectedWeekFinal ? null : projectedScoreByManager);
  // Real league-wide "Waiver Wire MVP" -- whoever's waiver/FA pickup (still on the roster that
  // added them) scored the most this week. See lib/players.js computeWaiverWireMvp.
  const waiverWireMvp = useMemo(
    () => computeWaiverWireMvp(afcData, nfcData, afcSeason, nfcSeason, afcTransactions, nfcTransactions, selectedWeek),
    [afcData, nfcData, afcSeason, nfcSeason, afcTransactions, nfcTransactions, selectedWeek]
  );
  // Both conferences' Sleeper transactions tagged with their conference, for the recap's trade list.
  const recapTransactions = useMemo(() => [
    ...afcTransactions.map(tx => ({ tx, conf: 'AFC', rosterIdMap: afcData.rosterIdMap })),
    ...nfcTransactions.map(tx => ({ tx, conf: 'NFC', rosterIdMap: nfcData.rosterIdMap }))
  ], [afcTransactions, nfcTransactions, afcData.rosterIdMap, nfcData.rosterIdMap]);
  const broadcastText = activeTab === 'teams' ? buildWeeklyRecapForWeek({
    week: selectedWeek,
    weeklyAwards,
    afcData,
    nfcData,
    afcSeason,
    nfcSeason,
    weekProjections,
    playersDB,
    waiverWireMvp,
    transactions: recapTransactions
  }) : '';
  const copyBroadcast = async () => {
    setBroadcastCopyState('copying');
    try {
      await copyTextToClipboard(broadcastText);
      setBroadcastCopyState('copied');
    } catch {
      setBroadcastCopyState('error');
    }
    setTimeout(() => setBroadcastCopyState('idle'), 2200);
  };
  const weekRecord = isSelectedWeekFinal
    ? computeCrossWeekRecord(weekCrossPairs, afcSeason.scoreByWeek[selectedWeek] || {}, nfcSeason.scoreByWeek[selectedWeek] || {})
    : { afcWins: 0, nfcWins: 0, ties: 0, counted: 0 };
  const crossRecordsForSeason = computeCrossRecords(schedule, afcSeason, nfcSeason, latestCompletedWeek);
  const seasonRecord = {
    afcWins: afcManagers.reduce((sum, m) => sum + (crossRecordsForSeason[m]?.wins || 0), 0),
    nfcWins: nfcManagers.reduce((sum, m) => sum + (crossRecordsForSeason[m]?.wins || 0), 0),
    ties: afcManagers.reduce((sum, m) => sum + (crossRecordsForSeason[m]?.ties || 0), 0)
  };
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

  // Hex twin of teamColorMap -- same colors, same order, just usable as an SVG stroke (the
  // Standings Trends chart's lines) instead of a Tailwind text-color class.
  const teamHexColorMap = useMemo(
    () => ({
      ...buildConferenceHexColorMap(afcManagers, afcDraft, afcData.rosterIdMap),
      ...buildConferenceHexColorMap(nfcManagers, nfcDraft, nfcData.rosterIdMap)
    }),
    [afcManagers.join('|'), nfcManagers.join('|'), afcDraft, nfcDraft, afcData.rosterIdMap, nfcData.rosterIdMap]
  );

  const standingsHistory = useMemo(
    () => buildStandingsHistory(afcManagers, nfcManagers, afcData, nfcData, afcSeason, nfcSeason, schedule, latestCompletedWeek),
    [afcManagers, nfcManagers, afcData, nfcData, afcSeason, nfcSeason, schedule, latestCompletedWeek]
  );

  const weeklyPfPaHistory = useMemo(
    () => buildWeeklyPfPaHistory(afcManagers, nfcManagers, afcData, nfcData, afcSeason, nfcSeason, schedule, latestCompletedWeek),
    [afcManagers, nfcManagers, afcData, nfcData, afcSeason, nfcSeason, schedule, latestCompletedWeek]
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

  // Home isn't listed as a desktop nav tab -- the header logo links there. The mobile bottom nav
  // adds it explicitly since the logo isn't an obvious button on a phone.
  const tabs = [
    { id: "currentWeek", label: "My Week", shortLabel: "My Week", icon: Calendar },
    { id: "matchups", label: "Matchups", shortLabel: "Matchups", icon: Swords },
    { id: "standings", label: "Standings", shortLabel: "Standings", icon: Trophy },
    { id: "players", label: "Players", shortLabel: "Players", icon: Users },
    { id: "activity", label: "Activity", shortLabel: "Activity", icon: Activity },
    ...(isAdmin ? [{ id: "teams", label: "MS Teams Broadcast", shortLabel: "Broadcast", icon: Megaphone }] : [])
  ];

  const settingsMenu = (
    <SettingsMenu
      soundMuted={soundMuted} onToggleSoundMuted={toggleSoundMuted}
      funEnabled={funEnabled} onToggleFun={toggleFunEnabled}
      afcLeagueId={afcLeagueId} nfcLeagueId={nfcLeagueId}
      onOpenCharter={() => setActiveTab("charter")}
      isAdmin={isAdmin} onAdminClick={() => (isAdmin ? handleLogout() : setShowLoginModal(true))}
      onRefresh={loadData} refreshing={loading} lastUpdated={lastUpdated}
    />
  );

  return (
    <ImageLightboxProvider>
    <MyTeamProvider manager={resolvedMyTeamManager}>
    <NameDisplayProvider mode={nameDisplayMode} onModeChange={setNameDisplayMode} afcData={afcData} nfcData={nfcData}>
    <TeamColorProvider colorMap={teamColorMap}>
    <TeamLogoProvider logoMap={teamLogoMap}>
    <PlayerPhotoProvider>
    <PlayerModalProvider>
    <RosterModalProvider onOpen={playTeamSound}>
    <TeamDepthChartProvider>
    <MatchupPreviewProvider>
    <div className={`min-h-screen sand-bg text-[var(--text)] p-4 md:p-8 ${activeTab === "home" ? "pb-8" : "pb-[calc(10rem+env(safe-area-inset-bottom))] md:pb-24"}`}>
      {showLoginModal && (
        <AdminLoginModal onClose={() => setShowLoginModal(false)} onSuccess={handleLoginSuccess} />
      )}
      <CommandPalette
        tabs={tabs} onSelect={navigateToTab} open={commandPaletteOpen} setOpen={setCommandPaletteOpen}
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
      <MatchupPreviewModal
        computeIntra={(manager, conf, week) => getIntraInfo(
          manager, conf === "AFC" ? afcSeason : nfcSeason, allStats, week,
          conf === "AFC" ? afcData : nfcData, weekProjections, latestCompletedWeek, playersDB, enrichedByTeamWeek
        )}
        computeInter={(manager, conf, week) => getInterInfo(
          manager, conf, schedule.filter(m => m.week === week), afcSeason, nfcSeason, allStats, week,
          afcData, nfcData, weekProjections, latestCompletedWeek, playersDB, enrichedByTeamWeek
        )}
        afcSlots={afcData.startingSlots || []} nfcSlots={nfcData.startingSlots || []}
        playersDB={playersDB} weekProjections={weekProjections} byTeamWeek={enrichedByTeamWeek}
        onOpenFullMatchup={goToMatchup}
      />

      {/* Header Banner -- hidden on Home, which is deliberately just the "I am" picker + radial menu */}
      {activeTab !== "home" && (
        <header className="relative z-40 max-w-7xl mx-auto bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-2xl px-5 py-3 mb-8 shadow-xl">
          <div ref={headerRowRef} className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="group flex items-center gap-2.5 shrink-0">
              <AnimatedLogo sizeClass="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem]" onClick={() => setActiveTab("home")} />
              <button type="button" onClick={() => setActiveTab("home")} className="text-left">
                <h1 className="lenzone-title font-display text-2xl sm:text-[1.75rem] font-extrabold tracking-tight bg-clip-text text-transparent">
                  LENZONE 2026
                </h1>
              </button>
            </div>
            {isAdmin && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/25 uppercase tracking-wider shrink-0">
                Admin
              </span>
            )}

            {/* Header is just: logo, "I am" picker, search, settings. Everything else lives in the
                settings menu so this stays one row on a phone. */}
            <div className="flex items-center gap-2 ml-auto min-w-0">
              {resolvedMyTeamManager && <TeamMiniLogo manager={resolvedMyTeamManager} size={36} ringColor="var(--accent)" className="hidden sm:inline-block" />}
              <div className="hidden sm:block min-w-0">
                <TeamPicker afcManagers={afcManagers} nfcManagers={nfcManagers} value={myTeamManager} onChange={chooseMyTeam} />
              </div>
              <button
                type="button" onClick={() => setCommandPaletteOpen(true)}
                aria-label="Search pages, teams, and players" title="Search"
                className="grid place-items-center w-10 h-10 rounded-lg bg-[var(--surface2)] text-[var(--text2)] hover:text-[var(--text)] transition-colors duration-150 shrink-0"
              >
                <Search className="w-5 h-5" />
              </button>
              <ModeToggle />
              {settingsMenu}
            </div>
            <div className="sm:hidden w-full">
              <TeamPicker afcManagers={afcManagers} nfcManagers={nfcManagers} value={myTeamManager} onChange={chooseMyTeam} />
            </div>
          </div>
        </header>
      )}
      <GrabbableFootball targetRef={headerRowRef} enabled={funEnabled && activeTab !== "home"} />
      <DancingStickmen enabled={funEnabled && activeTab !== "home"} />
      {/* One slim league-activity crawl along the bottom; hidden on Home. */}
      {activeTab !== "home" && (
        <NewsTicker
          afcTransactions={afcTransactions} nfcTransactions={nfcTransactions}
          afcRosterIdMap={afcData.rosterIdMap} nfcRosterIdMap={nfcData.rosterIdMap}
          playersDB={playersDB}
          onOpenActivity={() => navigateToTab("activity")}
        />
      )}

      {loadError && activeTab !== "home" && (
        <div role="alert" className="max-w-7xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--neg)]/40 bg-[var(--neg)]/10 px-4 py-3 text-sm">
          <span className="font-semibold text-[var(--text)]">
            Couldn't reach Sleeper.{lastUpdated ? ` Showing data from ${lastUpdated.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.` : ''}
          </span>
          <button
            type="button" onClick={loadData} disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Retry
          </button>
        </div>
      )}

      <main className="max-w-7xl mx-auto">
        {/* Desktop Navigation Tabs -- also hidden on Home; the radial menu is its navigation */}
        {activeTab !== "home" && (
          <div className="hidden md:flex flex-wrap border-b border-[var(--border)]/80 mb-6 gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => navigateToTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all duration-200 ${
                  activeTab === tab.id ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]/40" : "border-transparent text-[var(--text2)] hover:text-[var(--text)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* A deep-linked reload landing directly on a non-Home tab (e.g. a bookmarked #standings
            URL) would otherwise try to render that tab's real content against the still-empty
            afcData/nfcData that exist for the one render before loadData's effect has even fired
            -- gate everything except Home behind having loaded at least once instead, with an
            explicit way back to the one tab that never needs league data to render. */}
        {activeTab !== "home" && !hasLoadedOnce ? (
          <div className="space-y-4" aria-busy="true">
            <p className="text-sm text-[var(--muted)]">Loading league data&hellip;</p>
            <SkeletonRows rows={5} />
          </div>
        ) : (
        <Suspense fallback={<SkeletonRows rows={5} />}>
        {/* TAB: HOME */}
        {activeTab === "home" && (
          <HomeView
            afcManagers={afcManagers} nfcManagers={nfcManagers} myTeamManager={resolvedMyTeamManager}
            afcStandings={hasStandingsData ? afcStandings : null} nfcStandings={hasStandingsData ? nfcStandings : null}
            onChooseMyTeam={(manager) => {
              chooseMyTeam(manager);
              // Let the confetti play for a beat, then go straight to My Week.
              window.setTimeout(() => navigateToTab('currentWeek'), 650);
            }}
            teamBurst={teamBurst} settingsMenu={settingsMenu}
          />
        )}

        {/* TAB: CURRENT WEEK */}
        {activeTab === "currentWeek" && (
          <CurrentWeekView
            onGoToMatchup={goToMatchup} selectedWeek={selectedWeek} onSelectWeek={setSelectedWeek}
            currentNflWeek={currentSleeperWeek} seasonWeeks={SEASON_WEEKS} isWeekFinal={isSelectedWeekFinal}
            weeklyAwards={weeklyAwards} nflGames={enrichedNflGames}
            myTeamNflTeams={myTeamNflTeams} myTeamManager={resolvedMyTeamManager}
            myTeamIntra={myTeamIntra} myTeamInter={myTeamInter} myTeamConf={myTeamConf}
            myTeamRoster={myTeamRoster} myTeamConfData={myTeamConfData} myTeamFallbackField={myTeamFallbackField}
            myTeamPlayersPoints={myTeamPlayersPoints} playersDB={playersDB} weekProjections={weekProjections}
            byTeamWeek={enrichedByTeamWeek}
            afcSlots={afcData.startingSlots || []} nfcSlots={nfcData.startingSlots || []}
            afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason}
            afcManagers={afcManagers} nfcManagers={nfcManagers} schedule={schedule} logoMap={teamLogoMap} hexColorMap={teamHexColorMap}
            projectedScoreByManager={projectedScoreByManager} pregameScoreByManager={pregameScoreByManager}
            weekBigPlays={weekBigPlays} waiverWireMvp={waiverWireMvp}
            myPlayerNotes={myPlayerNotes} myPlayerHeadlines={myPlayerHeadlines}
            onRefreshPlayerNews={() => Promise.all([refreshHeadlines(), refreshPlayerNotes()])}
          />
        )}

        {/* TAB: STANDINGS -- chart, tables, then trends at the bottom. The playoff bracket is a
            separate mode of this page. */}
        {activeTab === "standings" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <p className="text-sm font-bold">
                  <span className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)] mr-2">Season series</span>
                  <span className={CONF_STYLES.AFC.text}>AFC {seasonRecord.afcWins}</span>
                  <span className="text-[var(--muted)] mx-1.5">-</span>
                  <span className={CONF_STYLES.NFC.text}>{seasonRecord.nfcWins} NFC</span>
                  {seasonRecord.ties > 0 && <span className="text-[var(--muted)] text-xs ml-2">({seasonRecord.ties} tie{seasonRecord.ties > 1 ? "s" : ""})</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigateToTab(standingsView === "playoffs" ? "standings" : "playoffs")}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-extrabold transition-all ${
                  standingsView === "playoffs"
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]"
                    : "border-[var(--border2)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                }`}
              >
                <GitBranch className="w-4 h-4" /> {standingsView === "playoffs" ? "Back to Standings" : "Playoff Bracket"}
              </button>
            </div>

            {standingsView !== "playoffs" && (
              <>
                {/* Both conferences, always -- each gets its own chart with its table right under it. */}
                {["AFC", "NFC"].map(conf => (
                  <section key={conf} className="space-y-4">
                    <StandingsBarChart
                      afcStandings={afcStandings} nfcStandings={nfcStandings} confFilter={conf}
                      logoMap={teamLogoMap} mode="segregated"
                    />
                    <StandingsTable conf={conf} rows={conf === "AFC" ? afcStandings : nfcStandings} afcData={afcData} nfcData={nfcData} latestCompletedWeek={latestCompletedWeek} />
                  </section>
                ))}
                <StandingsTrendChart
                  history={standingsHistory} weeklyHistory={weeklyPfPaHistory}
                  afcManagers={afcManagers} nfcManagers={nfcManagers}
                  hexColorMap={teamHexColorMap} latestCompletedWeek={latestCompletedWeek}
                />
              </>
            )}

            {standingsView === "playoffs" && (
              <div className="max-w-7xl mx-auto w-full">
                {!hasStandingsData ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                    <RefreshCw className="w-7 h-7 animate-spin text-[var(--accent)]" />
                    <p className="text-sm text-[var(--muted)]">Building the bracket from LENZONE standings&hellip;</p>
                  </div>
                ) : (
                  <PlayoffsTab
                    afcStandings={afcStandings} nfcStandings={nfcStandings}
                    afcPostseason={afcPostseason} nfcPostseason={nfcPostseason}
                    currentWeek={nflState.week || 1} latestCompletedWeek={latestCompletedWeek}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: MATCHUPS -- the week's scores chart on top (tap a bar for that matchup), then the
            full-season schedule grid, one per conference. */}
        {activeTab === "matchups" && (
          <div className="space-y-8 max-w-7xl mx-auto w-full">
            <div className="flex flex-wrap items-end gap-4 bg-[var(--surface)]/60 border border-[var(--border)]/80 p-4 rounded-xl">
              <div>
                <label htmlFor="matchups-week" className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)] block mb-1">Week</label>
                <select
                  id="matchups-week"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm rounded-lg px-3 py-2 text-[var(--text)]"
                >
                  {Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1).map(w => (
                    <option key={w} value={w}>Week {w}{w === currentSleeperWeek ? " (current)" : ""}</option>
                  ))}
                </select>
              </div>
              {isSelectedWeekFinal && weekRecord.counted > 0 && (
                <div className="ml-auto">
                  <span className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)] block mb-1">Week {selectedWeek} AFC vs NFC</span>
                  <p className="text-lg font-extrabold">
                    <span className={CONF_STYLES.AFC.text}>AFC {weekRecord.afcWins}</span>
                    <span className="text-[var(--muted)] mx-2">-</span>
                    <span className={CONF_STYLES.NFC.text}>{weekRecord.nfcWins} NFC</span>
                    {weekRecord.ties > 0 && <span className="text-[var(--muted)] text-xs ml-2">({weekRecord.ties} tie{weekRecord.ties > 1 ? "s" : ""})</span>}
                  </p>
                </div>
              )}
            </div>

            <WeeklyScoresBarChart
              afcManagers={afcManagers} nfcManagers={nfcManagers} afcSeason={afcSeason} nfcSeason={nfcSeason}
              afcData={afcData} nfcData={nfcData} playersDB={playersDB}
              schedule={schedule} week={selectedWeek} logoMap={teamLogoMap}
              projectedScores={projectedScoreByManager} pregameScores={pregameScoreByManager} isWeekFinal={isSelectedWeekFinal}
            />

            {["AFC", "NFC"].map(conf => (
              <SeasonGridTab
                key={conf}
                conference={conf}
                afcSeason={afcSeason} nfcSeason={nfcSeason} crossSchedule={schedule}
                afcManagers={afcManagers} nfcManagers={nfcManagers}
                seasonWeeks={SEASON_WEEKS} currentWeek={nflState.week}
                latestCompletedWeek={latestCompletedWeek}
                logoMap={teamLogoMap} weekDateLabels={weekDateLabels} focusWeek={selectedWeek}
              />
            ))}
          </div>
        )}

        {/* TAB: PLAYERS -- player search, rosters, and the draft board. */}
        {activeTab === "players" && (
          <div className="space-y-6">
              <div className="space-y-6">
                <div className="inline-flex bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-1 gap-1 flex-wrap">
                  {[["search", "Player Search", Search], ["rosters", "Rosters", Users], ["draft", "Draft Board", ListOrdered]].map(([key, label, Icon]) => (
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
                  <PlayersTab
                    key={resolvedMyTeamManager}
                    afcData={afcData} nfcData={nfcData}
                    afcDraft={afcDraft} nfcDraft={nfcDraft}
                    afcTransactions={afcTransactions} nfcTransactions={nfcTransactions}
                    afcManagers={afcManagers} nfcManagers={nfcManagers}
                    playersDB={playersDB} playersLoading={playersLoading}
                    focusManager={null} focusConf={null}
                  />
                )}
                {playersSubTab === "rosters" && (
                  <RosterTab
                    afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason} playersDB={playersDB} playersLoading={playersLoading}
                    weekProjections={weekProjections} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} seasonWeeks={SEASON_WEEKS}
                    byTeamWeek={enrichedByTeamWeek}
                  />
                )}
                {playersSubTab === "draft" && (
                  <DraftBoardTab
                    afcDraft={afcDraft} nfcDraft={nfcDraft}
                    afcRosterIdMap={afcData.rosterIdMap} nfcRosterIdMap={nfcData.rosterIdMap}
                    loading={draftLoading} playersDB={playersDB} focusConf={myTeamConf}
                  />
                )}
              </div>
          </div>
        )}

        {/* TAB: ACTIVITY -- trades, waiver claims, and free-agent moves. */}
        {activeTab === "activity" && (
          <ActivityTab
            afcTransactions={afcTransactions} nfcTransactions={nfcTransactions}
            afcRosterIdMap={afcData.rosterIdMap} nfcRosterIdMap={nfcData.rosterIdMap}
            playersDB={playersDB} loading={transactionsLoading} focusConf={myTeamConf}
          />
        )}

        {/* TAB: MS TEAMS RECAP (admin only) */}
        {activeTab === "teams" && isAdmin && (
          <div className="space-y-6">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="afc-league-id" className="block text-xs uppercase tracking-wider font-semibold text-[var(--muted)] mb-1">AFC Sleeper league ID</label>
              <input
                id="afc-league-id" type="text" value={afcLeagueId}
                onChange={(e) => handleLeagueIdChange("AFC", e.target.value)}
                className="bg-[var(--bg)] border border-[var(--border)] text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--accent)] w-56"
              />
            </div>
            <div>
              <label htmlFor="nfc-league-id" className="block text-xs uppercase tracking-wider font-semibold text-[var(--muted)] mb-1">NFC Sleeper league ID</label>
              <input
                id="nfc-league-id" type="text" value={nfcLeagueId}
                onChange={(e) => handleLeagueIdChange("NFC", e.target.value)}
                className="bg-[var(--bg)] border border-[var(--border)] text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--accent)] w-56"
              />
            </div>
          </div>
          <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-2 text-[var(--text)]">MS Teams Weekly Broadcast Generator</h2>
              <p className="text-sm text-[var(--text2)]">A Teams-ready recap built from the selected week's real results: awards, top players, player trophies, and trades since last Wednesday. Paste the two charts in where marked.</p>
            </div>

            <div className="flex items-center gap-2">
              <label className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">Recap Week</label>
              <select
                value={selectedWeek}
                onChange={(event) => setSelectedWeek(Number(event.target.value))}
                className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm font-bold rounded-lg px-2 py-1 text-[var(--text)]"
              >
                {Array.from({ length: SEASON_WEEKS }, (_, index) => index + 1).map(week => (
                  <option key={week} value={week}>Week {week}{week === currentSleeperWeek ? " (current)" : ""}</option>
                ))}
              </select>
            </div>

            {/* Visual reference for whoever's writing the recap -- same "All Teams" chart as the
                Matchups tab, not part of the copyable markdown text below (Teams chat can't render
                a live SVG from pasted markdown). */}
            <WeeklyScoresBarChart afcManagers={afcManagers} nfcManagers={nfcManagers} afcSeason={afcSeason} nfcSeason={nfcSeason} afcData={afcData} nfcData={nfcData} playersDB={playersDB} schedule={schedule} week={selectedWeek} logoMap={teamLogoMap} projectedScores={projectedScoreByManager} pregameScores={pregameScoreByManager} isWeekFinal={isSelectedWeekFinal} />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={copyBroadcast}
                disabled={broadcastCopyState === 'copying'}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--border)]/80 bg-[var(--surface2)] text-[var(--text2)] hover:text-[var(--text)] hover:border-[var(--border2)] transition-all duration-200 disabled:opacity-60"
              >
                {broadcastCopyState === 'copied' ? <Check className="w-3.5 h-3.5 text-[var(--pos)]" /> : broadcastCopyState === 'error' ? <X className="w-3.5 h-3.5 text-[var(--neg)]" /> : <Copy className="w-3.5 h-3.5" />}
                {broadcastCopyState === 'copying' ? 'Copying…' : broadcastCopyState === 'copied' ? 'Copied!' : broadcastCopyState === 'error' ? "Couldn't copy" : 'Copy for MS Teams'}
              </button>
            </div>
            <pre className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--border)]/80 text-xs font-mono text-[var(--text)] whitespace-pre-wrap select-all">{broadcastText}</pre>
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
        </Suspense>
        )}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar -- hidden on Home too */}
      {activeTab !== "home" && (
      <nav data-bottom-chrome className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--border)] flex justify-around pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] overflow-x-auto">
        {[{ id: "home", shortLabel: "Home", icon: Home }, ...tabs].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateToTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 min-w-[3.25rem] text-[11px] font-semibold transition-colors duration-200 shrink-0 px-1.5 py-1 ${
                activeTab === tab.id ? "text-[var(--accent)]" : "text-[var(--text2)]"
              }`}
            >
              <Icon className="w-5 h-5" />
              {tab.shortLabel}
            </button>
          );
        })}
      </nav>
      )}
    </div>
    </MatchupPreviewProvider>
    </TeamDepthChartProvider>
    </RosterModalProvider>
    </PlayerModalProvider>
    </PlayerPhotoProvider>
    </TeamLogoProvider>
    </TeamColorProvider>
    </NameDisplayProvider>
    </MyTeamProvider>
    </ImageLightboxProvider>
  );
}
