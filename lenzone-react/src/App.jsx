import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Swords, Megaphone, Scroll, ExternalLink, RefreshCw, Award, Lock, Unlock, X, TrendingDown, Zap, Flame, Activity, ListOrdered, Users, Calendar, ChevronDown, Search, Image, ImageOff, Home } from 'lucide-react';
import lenzoneLogo from './assets/LENZone-option-H-vertical-bold-no-text.png';
import { CONF_STYLES } from './lib/theme';
import { ConfFilterToggle } from './components/shared';
import {
  fetchSleeperLeague, fetchFullSeasonData, fetchPlayersDB, fetchSeasonTransactions, fetchDraftPicks, fetchAllWeekProjections, fetchNflState, fetchNflSchedule
} from './lib/sleeperApi';
import {
  computeStats, buildHistory, simulateCombinedPlayoffOdds, computeCrossRecords, computeCrossWeekRecord,
  computeWeeklyAwards, buildConferenceList, rankConference, winProbability, roughWinProbability, computePointsAgainst, computeInConfRecord
} from './lib/statsMath';
import RosterTab from './components/RosterTab';
import ActivityTab from './components/ActivityTab';
import DraftBoardTab from './components/DraftBoardTab';
import PlayersTab from './components/PlayersTab';
import RosterModal from './components/RosterModal';
import TeamName from './components/TeamName';
import ScheduleTab from './components/ScheduleTab';
import HomeView from './components/HomeView';
import { RosterModalProvider } from './context/RosterModalContext';
import { PlayerModalProvider } from './context/PlayerModalContext';
import PlayerModal from './components/PlayerModal';
import PlayerNameButton from './components/PlayerNameButton';
import { TeamColorProvider } from './context/TeamColorContext';
import { TeamLogoProvider } from './context/TeamLogoContext';
import { PlayerPhotoProvider, usePlayerPhotos } from './context/PlayerPhotoContext';
import { buildConferenceColorMap, getDraftSlotMap } from './lib/teamColors';
import { playerLabel, scoringFieldFor, projectedPoints, computeRosterProjection, computeBlendedRosterScore, buildOwnerMap, buildAcquisitionHistory, computeMoveCounts } from './lib/players';
import { PositionBadge, InjuryBadge, GameBadge, Button } from './components/shared';
import PlayerAvatar from './components/PlayerAvatar';

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
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-slate-900/95 border border-slate-800/80 rounded-xl p-6 w-full max-w-xs shadow-2xl relative">
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-slate-500 hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-bold text-slate-100 mb-1">Admin Login</h2>
        <p className="text-xs text-slate-500 mb-4">Unlocks charter editing, broadcast fields, and league ID overrides.</p>
        <input
          type="password"
          autoFocus
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          placeholder="Password"
          className="w-full bg-slate-950 border border-slate-800/80 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 mb-2"
        />
        {error && <p className="text-xs text-rose-400 mb-2">{error}</p>}
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-all duration-200">
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
      className="py-3 px-4 cursor-pointer select-none hover:text-slate-200 transition-colors duration-150"
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[9px] ${active ? "text-slate-300" : "text-slate-700"}`}>{active && dir === 'desc' ? "▼" : "▲"}</span>
      </span>
    </th>
  );
}

function PhotoToggleButton() {
  const { enabled, toggle } = usePlayerPhotos();
  return (
    <Button variant="icon" onClick={toggle} title={enabled ? "Hide player photos" : "Show player photos"}>
      {enabled ? <Image className="w-4 h-4" /> : <ImageOff className="w-4 h-4" />}
    </Button>
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
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
      <div className="px-4 py-3 border-b border-slate-800/80 flex items-center gap-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>{conf}</span>
        <span className="tracking-wider text-xs uppercase font-semibold text-slate-400">Conference Standings</span>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/80 tracking-wider text-xs uppercase font-semibold text-slate-400 border-b border-slate-800/80">
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
          <tbody className="divide-y divide-slate-800/60">
            {sortedRows.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-800/30 transition-all duration-200">
                <td className="py-3 px-4 font-bold text-slate-400">{item.rank}</td>
                <td className="py-3 px-4 font-bold text-slate-100">
                  <div className="flex items-center gap-2">
                    <TeamName manager={item.manager} conf={conf} className="font-bold" />
                    {item.rank === 1 && <Award className="w-4 h-4 text-emerald-400" />}
                  </div>
                </td>
                <td className="py-3 px-4">{item.inConfRecord}</td>
                <td className="py-3 px-4">{item.interConfRecord}</td>
                <td className={`py-3 px-4 font-extrabold ${style.text}`}>{item.totalPts.toFixed(1)}</td>
                <td className="py-3 px-4 font-mono">{item.pf.toFixed(2)}</td>
                <td className="py-3 px-4 font-mono text-slate-400">{item.pa.toFixed(2)}</td>
                <td className="py-3 px-4 font-mono">{item.playoffPct === null || item.playoffPct === undefined ? "--" : `${item.playoffPct.toFixed(0)}%`}</td>
                <td className="py-3 px-4 text-emerald-400">{item.faab}</td>
                <td className="py-3 px-4 font-mono text-slate-400">{item.moves}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-slate-800/60">
        {sortedRows.map((item, idx) => (
          <div key={idx} className={`p-4 border-l-2 ${style.border} hover:bg-slate-800/30 transition-all duration-200`}>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold text-sm">#{item.rank}</span>
                <TeamName manager={item.manager} conf={conf} className="font-bold" />
                {item.rank === 1 && <Award className="w-4 h-4 text-emerald-400" />}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">Intra-Conf</p>
                <p className="text-slate-200 font-semibold text-sm">{item.inConfRecord}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">Inter-Conf</p>
                <p className="text-slate-200 font-semibold text-sm">{item.interConfRecord}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">Pts</p>
                <p className={`font-extrabold text-sm ${style.text}`}>{item.totalPts.toFixed(1)}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">PF</p>
                <p className="text-slate-200 font-mono text-sm">{item.pf.toFixed(2)}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">PA</p>
                <p className="text-slate-400 font-mono text-sm">{item.pa.toFixed(2)}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">Playoff %</p>
                <p className="text-slate-200 font-mono text-sm">{item.playoffPct === null || item.playoffPct === undefined ? "--" : `${item.playoffPct.toFixed(0)}%`}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">FAAB</p>
                <p className="text-emerald-400 font-semibold text-sm">{item.faab}</p>
              </div>
              <div>
                <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">Moves</p>
                <p className="text-slate-400 font-mono text-sm">{item.moves}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HighlightCard({ icon: Icon, label, name, value, accent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 hover:border-slate-700 hover:scale-[1.01] transition-all duration-200 w-full"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">{label}</span>
      </div>
      <p className="font-bold text-slate-100 text-sm truncate">{name}</p>
      <p className={`text-xs font-mono ${accent}`}>{value}</p>
    </button>
  );
}

// While the week is still live/in-progress, every card is explicitly labeled "Projected" and driven
// by the blended projected-final numbers (not a partial leaderboard of whoever's ahead right now) --
// so it's clear these aren't real trophies yet. Once the week is fully complete, they flip to the
// real Trophy icon and the actual final numbers. Clicking a card jumps the matchup grid to that manager.
function WeeklyHighlights({ awards, week, isWeekFinal, onSelectManager }) {
  if (!awards) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 text-sm text-slate-500 italic">
        No live scores yet for Week {week}. Highlights populate once Sleeper reports scores.
      </div>
    );
  }
  // Each card's name AND value must come from the SAME record -- previously the name was taken
  // from the real (mostly-empty pre-kickoff) closest/blowout while the margin was taken from the
  // separate projected one, so a card could show one matchup's name next to a different matchup's
  // margin. Swap the whole record together, never just the number.
  const high = isWeekFinal ? awards.highScore : (awards.projectedHighScore || awards.highScore);
  const low = isWeekFinal ? awards.lowScore : (awards.projectedLowScore || awards.lowScore);
  const closest = isWeekFinal ? awards.closest : (awards.projectedClosest || awards.closest);
  const blowout = isWeekFinal ? awards.blowout : (awards.projectedBlowout || awards.blowout);
  const prefix = isWeekFinal ? "" : "Projected ";
  const icon = isWeekFinal ? Trophy : Award;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <HighlightCard
        icon={icon} label={`${prefix}High Score`} name={high.manager} value={`${high.points.toFixed(1)} pts`} accent="text-amber-400"
        onClick={() => onSelectManager(high.manager)}
      />
      <HighlightCard
        icon={TrendingDown} label={`${prefix}Low Score`} name={low.manager} value={`${low.points.toFixed(1)} pts`} accent="text-rose-400"
        onClick={() => onSelectManager(low.manager)}
      />
      {closest && (
        <HighlightCard
          icon={Zap} label={`${prefix}Closest Game`} name={`${closest.a} vs ${closest.b}`}
          value={`${closest.margin.toFixed(1)} pt margin`} accent="text-blue-400"
          onClick={() => onSelectManager(closest.a)}
        />
      )}
      {blowout && (
        <HighlightCard
          icon={Flame} label={`${prefix}Biggest Blowout`} name={`${blowout.a} vs ${blowout.b}`}
          value={`${blowout.margin.toFixed(1)} pt margin`} accent="text-orange-400"
          onClick={() => onSelectManager(blowout.a)}
        />
      )}
    </div>
  );
}

// "Live" here is a blend of real posted points + projections for anyone who hasn't played yet
// (same blended figure the matchup pills show) -- not a pure real-only sum -- so the badge says so.
const WEEK_POINTS_STATUS_LABEL = { projected: "Projected", live: "Live (blended w/ projections)", final: "Final" };

function ConferenceWarPanel({ weekRecord, seasonRecord, weekPoints, week, isWeekFinal }) {
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">Week {week} Total Points</p>
            {weekPoints.status && (
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                weekPoints.status === 'final' ? 'bg-emerald-500/10 text-emerald-400' : weekPoints.status === 'live' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'
              }`}>
                {WEEK_POINTS_STATUS_LABEL[weekPoints.status]}
              </span>
            )}
          </div>
          {weekPoints.afcTotal != null ? (
            <p className="text-lg font-extrabold">
              <span className={CONF_STYLES.AFC.text}>AFC {weekPoints.afcTotal.toFixed(1)}</span>
              <span className="text-slate-600 mx-2">-</span>
              <span className={CONF_STYLES.NFC.text}>{weekPoints.nfcTotal.toFixed(1)} NFC</span>
            </p>
          ) : (
            <p className="text-sm text-slate-500 italic">No data yet</p>
          )}
        </div>
        <div>
          <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 mb-1">Week {week} Matchup Record (Non-Cumulative)</p>
          {!isWeekFinal ? (
            <p className="text-sm text-slate-500 italic">Pending &mdash; finalizes once Week {week} is complete</p>
          ) : weekRecord.counted > 0 ? (
            <p className="text-lg font-extrabold">
              <span className={CONF_STYLES.AFC.text}>AFC {weekRecord.afcWins}</span>
              <span className="text-slate-600 mx-2">-</span>
              <span className={CONF_STYLES.NFC.text}>{weekRecord.nfcWins} NFC</span>
              {weekRecord.ties > 0 && <span className="text-slate-500 text-xs ml-2">({weekRecord.ties} tie{weekRecord.ties > 1 ? "s" : ""})</span>}
            </p>
          ) : (
            <p className="text-sm text-slate-500 italic">No scores yet</p>
          )}
        </div>
        <div>
          <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 mb-1">Season Series (Cumulative)</p>
          <p className="text-lg font-extrabold">
            <span className={CONF_STYLES.AFC.text}>AFC {seasonRecord.afcWins}</span>
            <span className="text-slate-600 mx-2">-</span>
            <span className={CONF_STYLES.NFC.text}>{seasonRecord.nfcWins} NFC</span>
            {seasonRecord.ties > 0 && <span className="text-slate-500 text-xs ml-2">({seasonRecord.ties} tie{seasonRecord.ties > 1 ? "s" : ""})</span>}
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

function RosterCompareRow({ label, myId, oppId, myPts, oppPts, myProj, oppProj, playersDB, byTeamWeek, week }) {
  const my = myId && myId !== '0' ? playerLabel(playersDB, myId) : null;
  const opp = oppId && oppId !== '0' ? playerLabel(playersDB, oppId) : null;
  const myIsActual = myPts > 0;
  const oppIsActual = oppPts > 0;
  const myDisplayPts = myIsActual ? myPts : myProj;
  const oppDisplayPts = oppIsActual ? oppPts : oppProj;
  return (
    <div className="grid grid-cols-2 gap-4 text-xs py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[9px] font-mono text-slate-600 w-9 shrink-0">{label}</span>
        {my ? (
          <>
            <PlayerAvatar playerId={myId} position={my.position} className="w-5 h-5" />
            <div className="flex flex-col min-w-0">
              <PlayerNameButton playerId={myId} name={my.name} position={my.position} className="text-slate-300 truncate" />
              <GameBadge nflTeam={my.team} week={week} byTeamWeek={byTeamWeek} />
            </div>
            <PositionBadge position={my.position} />
            <InjuryBadge status={my.injuryStatus} />
            {myDisplayPts != null && <span className={`font-mono shrink-0 ml-auto ${myIsActual ? "text-emerald-400" : "text-blue-300"}`}>{myDisplayPts.toFixed(2)}</span>}
          </>
        ) : <span className="text-slate-700 italic">Empty</span>}
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[9px] font-mono text-slate-600 w-9 shrink-0">{label}</span>
        {opp ? (
          <>
            <PlayerAvatar playerId={oppId} position={opp.position} className="w-5 h-5" />
            <div className="flex flex-col min-w-0">
              <PlayerNameButton playerId={oppId} name={opp.name} position={opp.position} className="text-slate-300 truncate" />
              <GameBadge nflTeam={opp.team} week={week} byTeamWeek={byTeamWeek} />
            </div>
            <PositionBadge position={opp.position} />
            <InjuryBadge status={opp.injuryStatus} />
            {oppDisplayPts != null && <span className={`font-mono shrink-0 ml-auto ${oppIsActual ? "text-emerald-400" : "text-blue-300"}`}>{oppDisplayPts.toFixed(2)}</span>}
          </>
        ) : <span className="text-slate-700 italic">Empty</span>}
      </div>
    </div>
  );
}

function MatchupRosterComparison({ mySlots, oppSlots, mySnapshot, oppSnapshot, playersDB, weekProjections, myScoringSettings, myFallbackField, oppScoringSettings, oppFallbackField, byTeamWeek, week }) {
  if (!mySnapshot && !oppSnapshot) {
    return <p className="text-xs text-slate-600 italic mt-2">No roster data available for this matchup yet.</p>;
  }
  const rows = Math.max(mySlots.length, oppSlots.length, mySnapshot?.starters?.length || 0, oppSnapshot?.starters?.length || 0);
  return (
    <div className="mt-3 pt-3 border-t border-slate-800/60 divide-y divide-slate-800/40">
      {Array.from({ length: rows }).map((_, i) => {
        const myId = mySnapshot?.starters?.[i];
        const oppId = oppSnapshot?.starters?.[i];
        return (
          <RosterCompareRow
            key={i}
            label={mySlots[i] || oppSlots[i] || "FLEX"}
            myId={myId}
            oppId={oppId}
            myPts={mySnapshot?.startersPoints?.[i]}
            oppPts={oppSnapshot?.startersPoints?.[i]}
            myProj={projectedPoints(weekProjections, myId, myScoringSettings, myFallbackField)}
            oppProj={projectedPoints(weekProjections, oppId, oppScoringSettings, oppFallbackField)}
            playersDB={playersDB} byTeamWeek={byTeamWeek} week={week}
          />
        );
      })}
    </div>
  );
}

function MatchupPill({ label, myTeam, myConf, oppConf, info, accentBorder, mySlots = [], oppSlots = [], playersDB, weekProjections, byTeamWeek, week }) {
  if (!info) {
    return (
      <div className={`flex-1 min-w-[220px] bg-slate-950/60 border ${accentBorder} rounded-lg p-3 flex items-center justify-center`}>
        <span className="text-xs text-slate-600 italic">No {label.toLowerCase()} matchup this week</span>
      </div>
    );
  }
  const {
    opponent, myScore, oppScore, myLiveScore, oppLiveScore, isFinal, isLive, myWinPct, winPctIsRough, myHasData, oppHasData, mySnapshot, oppSnapshot,
    myScoringSettings, myFallbackField, oppScoringSettings, oppFallbackField
  } = info;
  const showWinPct = !isFinal && myWinPct !== null;
  const showScores = isFinal || myHasData || oppHasData;
  // Sleeper's own convention: the big number is always the best REAL number available right now
  // (final score, or the live score while a game is in progress); the projected final is a small
  // secondary caption underneath, only while there's still uncertainty left (live or pregame).
  const bigMy = isFinal ? myScore : isLive ? (myLiveScore ?? 0) : myScore;
  const bigOpp = isFinal ? oppScore : isLive ? (oppLiveScore ?? 0) : oppScore;
  const bigColor = isFinal ? "text-emerald-400" : isLive ? "text-slate-100" : "text-blue-300";
  const showCaption = isLive && showScores;
  const [showRosters, setShowRosters] = useState(false);
  return (
    <div className={`bg-slate-950/60 border ${accentBorder} rounded-lg p-3`}>
      <div className="flex items-center justify-between mb-3">
        <span className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">{label}</span>
        {isFinal && <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Final</span>}
        {isLive && <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Live</span>}
        {!isFinal && !isLive && showScores && <span className="text-[9px] font-bold text-blue-300 uppercase tracking-wider">Projected</span>}
      </div>

      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 flex flex-col items-end gap-1 min-w-0">
          <TeamName manager={myTeam} conf={myConf} className="font-semibold truncate" />
          <span className={`font-mono text-lg font-bold leading-none ${showScores ? bigColor : "text-slate-600"}`}>
            {showScores && bigMy != null ? bigMy.toFixed(1) : "--"}
          </span>
        </div>
        <span className="text-[10px] font-bold text-slate-600 bg-slate-900 px-2 py-1 rounded shrink-0">VS</span>
        <div className="flex-1 flex flex-col items-start gap-1 min-w-0">
          <TeamName manager={opponent} conf={oppConf} className="font-semibold truncate" />
          <span className={`font-mono text-lg font-bold leading-none ${showScores ? bigColor : "text-slate-600"}`}>
            {showScores && bigOpp != null ? bigOpp.toFixed(1) : "--"}
          </span>
        </div>
      </div>
      {showCaption && (
        <div className="flex items-center gap-2 mb-2">
          <span className="flex-1 text-right font-mono text-[10px] text-blue-300">{myScore != null ? `${myScore.toFixed(1)} proj` : ""}</span>
          <span className="w-7 shrink-0" />
          <span className="flex-1 text-left font-mono text-[10px] text-blue-300">{oppScore != null ? `${oppScore.toFixed(1)} proj` : ""}</span>
        </div>
      )}

      {showWinPct && (
        <>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden flex mt-2">
            <div className="h-full bg-blue-500" style={{ width: `${(myWinPct * 100).toFixed(0)}%` }} />
          </div>
          <div className="text-right text-[10px] text-slate-500 mt-1">
            {(myWinPct * 100).toFixed(0)}% to win{winPctIsRough ? " (rough est.)" : ""}
          </div>
        </>
      )}
      {!isFinal && !showScores && (
        <div className="text-[10px] text-slate-600 italic">
          No scores logged yet this season -- projections appear once Week 1 results post to Sleeper.
        </div>
      )}

      {(mySnapshot || oppSnapshot) && (
        <button
          type="button"
          onClick={() => setShowRosters(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 rounded-md py-1.5 mt-3 uppercase tracking-wider transition-all duration-200"
        >
          {showRosters ? "Hide Rosters" : "Expand Rosters"}
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showRosters ? "rotate-180" : ""}`} />
        </button>
      )}
      {showRosters && (
        <MatchupRosterComparison
          mySlots={mySlots} oppSlots={oppSlots} mySnapshot={mySnapshot} oppSnapshot={oppSnapshot}
          playersDB={playersDB} weekProjections={weekProjections}
          myScoringSettings={myScoringSettings} myFallbackField={myFallbackField}
          oppScoringSettings={oppScoringSettings} oppFallbackField={oppFallbackField}
          byTeamWeek={byTeamWeek} week={week}
        />
      )}
    </div>
  );
}

function ManagerMatchupRow({ manager, conf, intra, inter, afcSlots, nfcSlots, playersDB, weekProjections, byTeamWeek, week }) {
  const style = CONF_STYLES[conf];
  const interAccent = inter ? CONF_STYLES[inter.oppConf].border : style.border;
  const slotsFor = (c) => (c === "AFC" ? afcSlots : nfcSlots);
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 hover:border-slate-700 transition-all duration-200">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>{conf}</span>
        <TeamName manager={manager} conf={conf} className="font-bold" />
      </div>
      <div className="flex flex-col gap-3">
        <MatchupPill
          label="In-Conference" myTeam={manager} myConf={conf} oppConf={conf}
          accentBorder={style.border} info={intra}
          mySlots={slotsFor(conf)} oppSlots={slotsFor(conf)} playersDB={playersDB}
          weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={week}
        />
        <MatchupPill
          label="Cross-Conference" myTeam={manager} myConf={conf} oppConf={inter?.oppConf}
          accentBorder={interAccent} info={inter}
          mySlots={slotsFor(conf)} oppSlots={slotsFor(inter?.oppConf)} playersDB={playersDB}
          weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={week}
        />
      </div>
    </div>
  );
}

export default function App() {
  const [afcLeagueId, setAfcLeagueId] = useState(() => localStorage.getItem('lenzone_afc_league_id') || AFC_LEAGUE_ID);
  const [nfcLeagueId, setNfcLeagueId] = useState(() => localStorage.getItem('lenzone_nfc_league_id') || NFC_LEAGUE_ID);
  const [activeTab, setActiveTab] = useState("home");
  const [confFilter, setConfFilter] = useState("ALL");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedManager, setSelectedManager] = useState("ALL");
  const [loading, setLoading] = useState(false);

  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('lenzone_admin') === 'true');
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [charterText, setCharterText] = useState(() => localStorage.getItem('lenzone_charter') || DEFAULT_CHARTER);
  const [charterDraft, setCharterDraft] = useState(charterText);

  const [broadcastFields, setBroadcastFields] = useState(() => {
    const saved = localStorage.getItem('lenzone_broadcast_fields');
    return saved ? JSON.parse(saved) : { highScoreWinner: "TBD", afcWildcardLeader: "TBD", nfcWildcardLeader: "TBD" };
  });

  const [afcData, setAfcData] = useState({ name: "AFC Conference", rosters: [], rosterIdMap: {} });
  const [nfcData, setNfcData] = useState({ name: "NFC Conference", rosters: [], rosterIdMap: {} });

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

  const tabs = [
    { id: "home", label: "Home", shortLabel: "Home", icon: Home },
    { id: "standings", label: "Standings", shortLabel: "Standings", icon: Trophy },
    { id: "schedule", label: "Schedule", shortLabel: "Schedule", icon: Calendar },
    { id: "matchups", label: "Weekly Matchups", shortLabel: "Matchups", icon: Swords },
    { id: "rosters", label: "Rosters", shortLabel: "Rosters", icon: Users },
    { id: "activity", label: "Activity", shortLabel: "Activity", icon: Activity },
    { id: "players", label: "Players", shortLabel: "Players", icon: Search },
    ...(isAdmin ? [{ id: "teams", label: "MS Teams Broadcast", shortLabel: "Broadcast", icon: Megaphone }] : [])
  ];

  return (
    <TeamColorProvider colorMap={teamColorMap}>
    <TeamLogoProvider logoMap={teamLogoMap}>
    <PlayerPhotoProvider>
    <PlayerModalProvider>
    <RosterModalProvider>
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 pb-24 md:pb-8">
      {showLoginModal && (
        <AdminLoginModal onClose={() => setShowLoginModal(false)} onSuccess={handleLoginSuccess} />
      )}
      <RosterModal
        afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason} playersDB={playersDB}
        weekProjections={weekProjections} selectedWeek={selectedWeek} byTeamWeek={nflSchedule.byTeamWeek}
      />
      <PlayerModal
        playersDB={playersDB} afcOwners={afcOwners} nfcOwners={nfcOwners} afcHistory={afcHistory} nfcHistory={nfcHistory}
        selectedWeek={selectedWeek} weekProjectionsByWeek={weekProjectionsByWeek} seasonWeeks={SEASON_WEEKS} latestCompletedWeek={latestCompletedWeek}
        afcSeason={afcSeason} nfcSeason={nfcSeason} afcData={afcData} nfcData={nfcData}
      />

      {/* Header Banner */}
      <header className="max-w-7xl mx-auto bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 mb-8 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setActiveTab("home")} className="flex items-center gap-3">
              <img src={lenzoneLogo} alt="LENZONE" className="w-10 h-10 rounded-full object-cover" />
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-rose-400 bg-clip-text text-transparent">
                LENZONE 2026
              </h1>
            </button>
            {isAdmin && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                Admin Mode
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a href={`https://sleeper.com/leagues/${afcLeagueId}/team`} target="_blank" rel="noreferrer" className={`flex items-center gap-2 ${CONF_STYLES.AFC.button} text-white px-4 py-2 rounded-lg font-semibold text-xs transition-all duration-200`}>
            <span>AFC League</span> <ExternalLink className="w-3 h-3" />
          </a>
          <a href={`https://sleeper.com/leagues/${nfcLeagueId}/team`} target="_blank" rel="noreferrer" className={`flex items-center gap-2 ${CONF_STYLES.NFC.button} text-white px-4 py-2 rounded-lg font-semibold text-xs transition-all duration-200`}>
            <span>NFC League</span> <ExternalLink className="w-3 h-3" />
          </a>
          <Button
            variant="icon"
            onClick={() => setActiveTab("charter")}
            title="League Charter"
            className={activeTab === "charter" ? "bg-blue-600 text-white hover:bg-blue-500" : ""}
          >
            <Scroll className="w-4 h-4" />
          </Button>
          <Button variant="icon" onClick={() => isAdmin ? handleLogout() : setShowLoginModal(true)} title={isAdmin ? "Log out of admin mode" : "Admin login"}>
            {isAdmin ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </Button>
          <PhotoToggleButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {/* Desktop Navigation Tabs */}
        <div className="hidden md:flex flex-wrap border-b border-slate-800/80 mb-6 gap-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all duration-200 ${
                  activeTab === tab.id ? "border-blue-500 text-blue-400 bg-slate-900/40" : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB: HOME */}
        {activeTab === "home" && (
          <HomeView
            setActiveTab={setActiveTab} selectedWeek={selectedWeek} isWeekFinal={isSelectedWeekFinal}
            weeklyAwards={weeklyAwards} weekPoints={weekPoints} seasonRecord={seasonRecord} nflGames={nflSchedule.games}
          />
        )}

        {/* TAB: STANDINGS */}
        {activeTab === "standings" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-4 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="tracking-wider text-xs uppercase font-semibold text-slate-400">Filter View:</span>
                <ConfFilterToggle value={confFilter} onChange={setConfFilter} />
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="AFC Sleeper League ID"
                    value={afcLeagueId}
                    onChange={(e) => handleLeagueIdChange("AFC", e.target.value)}
                    className="bg-slate-950 border border-slate-800/80 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-500 w-full sm:w-44"
                  />
                  <input
                    type="text"
                    placeholder="NFC Sleeper League ID"
                    value={nfcLeagueId}
                    onChange={(e) => handleLeagueIdChange("NFC", e.target.value)}
                    className="bg-slate-950 border border-slate-800/80 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-rose-500 w-full sm:w-44"
                  />
                  <Button variant="icon" onClick={loadData}>
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
              <span className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">Season Series (AFC vs NFC)</span>
              <p className="text-lg font-extrabold">
                <span className={CONF_STYLES.AFC.text}>AFC {seasonRecord.afcWins}</span>
                <span className="text-slate-600 mx-2">-</span>
                <span className={CONF_STYLES.NFC.text}>{seasonRecord.nfcWins} NFC</span>
                {seasonRecord.ties > 0 && <span className="text-slate-500 text-xs ml-2">({seasonRecord.ties} tie{seasonRecord.ties > 1 ? "s" : ""})</span>}
              </p>
            </div>

            {showAfc && <StandingsTable conf="AFC" rows={afcStandings} />}
            {showNfc && <StandingsTable conf="NFC" rows={nfcStandings} />}
          </div>
        )}

        {/* TAB: SCHEDULE */}
        {activeTab === "schedule" && (
          <ScheduleTab
            afcSeason={afcSeason} nfcSeason={nfcSeason} crossSchedule={schedule}
            afcManagers={afcManagers} nfcManagers={nfcManagers}
            afcTradeDeadlineWeek={afcData.tradeDeadlineWeek} nfcTradeDeadlineWeek={nfcData.tradeDeadlineWeek}
          />
        )}

        {/* TAB: MATCHUPS */}
        {activeTab === "matchups" && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-4 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-4 rounded-xl">
              <div>
                <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">Conference</label>
                <ConfFilterToggle value={confFilter} onChange={setConfFilter} />
              </div>
              <div>
                <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">NFL Week</label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800/80 text-sm rounded-lg px-3 py-1.5 text-slate-200"
                >
                  {Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1).map(w => (
                    <option key={w} value={w}>Week {w}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">Filter Manager</label>
                <select
                  value={selectedManager}
                  onChange={(e) => setSelectedManager(e.target.value)}
                  className="bg-slate-950 border border-slate-800/80 text-sm rounded-lg px-3 py-1.5 text-slate-200"
                >
                  <option value="ALL">All Managers</option>
                  {[...afcManagers, ...nfcManagers].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <WeeklyHighlights awards={weeklyAwards} week={selectedWeek} isWeekFinal={isSelectedWeekFinal} onSelectManager={setSelectedManager} />
            <ConferenceWarPanel weekRecord={weekRecord} seasonRecord={seasonRecord} weekPoints={weekPoints} week={selectedWeek} isWeekFinal={isSelectedWeekFinal} />

            {showAfc && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-slate-400" />
                  <h2 className="tracking-wider text-xs uppercase font-semibold text-slate-400">AFC Matchups &mdash; Week {selectedWeek}</h2>
                </div>
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
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
                      byTeamWeek={nflSchedule.byTeamWeek} week={selectedWeek}
                    />
                  ))}
                </div>
              </div>
            )}

            {showNfc && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-slate-400" />
                  <h2 className="tracking-wider text-xs uppercase font-semibold text-slate-400">NFC Matchups &mdash; Week {selectedWeek}</h2>
                </div>
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
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
                      byTeamWeek={nflSchedule.byTeamWeek} week={selectedWeek}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: ROSTERS */}
        {activeTab === "rosters" && (
          <RosterTab
            afcData={afcData} nfcData={nfcData} afcSeason={afcSeason} nfcSeason={nfcSeason} playersDB={playersDB} playersLoading={playersLoading}
            weekProjections={weekProjections} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} seasonWeeks={SEASON_WEEKS}
            byTeamWeek={nflSchedule.byTeamWeek}
          />
        )}

        {/* TAB: ACTIVITY */}
        {activeTab === "activity" && (
          <ActivityTab
            afcTransactions={afcTransactions}
            nfcTransactions={nfcTransactions}
            afcRosterIdMap={afcData.rosterIdMap}
            nfcRosterIdMap={nfcData.rosterIdMap}
            playersDB={playersDB}
            loading={transactionsLoading}
          />
        )}

        {/* TAB: PLAYERS (with Player Search / Draft Board sub-pages) */}
        {activeTab === "players" && (
          <div className="space-y-6">
            <div className="inline-flex bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-1 gap-1">
              {[["search", "Player Search", Search], ["draft", "Draft Board", ListOrdered]].map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setPlayersSubTab(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                    playersSubTab === key ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {playersSubTab === "search" && (
              <PlayersTab
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
              />
            )}
            {playersSubTab === "draft" && (
              <DraftBoardTab
                afcDraft={afcDraft}
                nfcDraft={nfcDraft}
                afcRosterIdMap={afcData.rosterIdMap}
                nfcRosterIdMap={nfcData.rosterIdMap}
                loading={draftLoading}
              />
            )}
          </div>
        )}

        {/* TAB: MS TEAMS RECAP (admin only) */}
        {activeTab === "teams" && isAdmin && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold mb-2 text-slate-100">MS Teams Weekly Broadcast Generator</h2>
              <p className="text-sm text-slate-400">Copy and paste this markdown recap directly into your MS Teams channel every Tuesday morning.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 block mb-1">High Score Winner</label>
                <input
                  type="text"
                  value={broadcastFields.highScoreWinner}
                  onChange={(e) => updateBroadcastField("highScoreWinner", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/80 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 block mb-1">AFC Wildcard Leader</label>
                <input
                  type="text"
                  value={broadcastFields.afcWildcardLeader}
                  onChange={(e) => updateBroadcastField("afcWildcardLeader", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/80 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 block mb-1">NFC Wildcard Leader</label>
                <input
                  type="text"
                  value={broadcastFields.nfcWildcardLeader}
                  onChange={(e) => updateBroadcastField("nfcWildcardLeader", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/80 text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <pre className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 text-xs font-mono text-emerald-400 whitespace-pre-wrap select-all">
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
        )}

        {/* TAB: CHARTER */}
        {activeTab === "charter" && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 space-y-4 text-slate-300 text-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-100">Official LENZONE 2026 Charter</h2>
              {isAdmin && (
                <Button onClick={saveCharter}>Save</Button>
              )}
            </div>

            {isAdmin ? (
              <textarea
                value={charterDraft}
                onChange={(e) => setCharterDraft(e.target.value)}
                rows={10}
                className="w-full bg-slate-950 border border-slate-800/80 rounded-lg p-4 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
              />
            ) : (
              <div className="whitespace-pre-wrap p-4 bg-slate-950 rounded-lg border-l-4 border-blue-500">
                {charterText}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-slate-900/70 backdrop-blur-md border-t border-slate-800/80 flex justify-around py-2.5 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-all duration-200 shrink-0 px-2 ${
                activeTab === tab.id ? "text-blue-400" : "text-slate-400"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
    </RosterModalProvider>
    </PlayerModalProvider>
    </PlayerPhotoProvider>
    </TeamLogoProvider>
    </TeamColorProvider>
  );
}
