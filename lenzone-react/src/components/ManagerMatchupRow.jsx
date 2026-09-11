import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CONF_STYLES, SCORE_COLOR, scoreState } from '../lib/theme';
import { projectedPoints } from '../lib/players';
import { PositionBadge, InjuryBadge, GameBadge, NflTeamTag } from './shared';
import { playerLabel } from '../lib/players';
import PlayerAvatar from './PlayerAvatar';
import PlayerNameButton from './PlayerNameButton';
import TeamName from './TeamName';

// Fixed-width columns (avatar / # / name / position / team / injury / score) so every row in a
// side lines up vertically regardless of how long a name or how many digits a score is -- a plain
// flex row with an ml-auto score only pins the LAST item to the edge, it doesn't align the ones in
// between. Also drops the old plain-text slot label ("QB") that duplicated the colored position
// tag sitting right next to it -- the tag alone is enough now.
const ROSTER_ROW_GRID = "grid grid-cols-[20px_26px_minmax(0,1fr)_34px_40px_46px] items-center gap-1.5";

function RosterCompareRow({ label, myId, oppId, myPts, oppPts, myProj, oppProj, playersDB, byTeamWeek, week, highlightTeams }) {
  const my = myId && myId !== '0' ? playerLabel(playersDB, myId) : null;
  const opp = oppId && oppId !== '0' ? playerLabel(playersDB, oppId) : null;
  const myIsActual = myPts > 0;
  const oppIsActual = oppPts > 0;
  const myDisplayPts = myIsActual ? myPts : myProj;
  const oppDisplayPts = oppIsActual ? oppPts : oppProj;
  const myLive = my && byTeamWeek?.[my.team]?.[week]?.state === 'in';
  const oppLive = opp && byTeamWeek?.[opp.team]?.[week]?.state === 'in';
  const myColor = SCORE_COLOR[scoreState({ hasActual: myIsActual, isLive: myLive })];
  const oppColor = SCORE_COLOR[scoreState({ hasActual: oppIsActual, isLive: oppLive })];
  const myHighlighted = my && highlightTeams?.has(my.team);
  const oppHighlighted = opp && highlightTeams?.has(opp.team);
  return (
    <div className="grid grid-cols-2 gap-4 text-xs py-1.5">
      <div className={`${ROSTER_ROW_GRID} min-w-0 rounded ${myHighlighted ? "bg-amber-400/10 ring-1 ring-amber-400/50" : ""}`}>
        {my ? (
          <>
            <PlayerAvatar playerId={myId} position={my.position} className="w-5 h-5" />
            <span className="text-[9px] font-mono text-[var(--muted)] text-center">{my.number != null ? `#${my.number}` : ""}</span>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <PlayerNameButton playerId={myId} name={my.name} position={my.position} className="text-[var(--text2)] truncate" />
                <InjuryBadge status={my.injuryStatus} />
              </div>
              <GameBadge nflTeam={my.team} week={week} byTeamWeek={byTeamWeek} />
            </div>
            <div className="flex justify-center"><PositionBadge position={my.position} /></div>
            <div className="flex justify-center"><NflTeamTag team={my.team} /></div>
            {myDisplayPts != null && <span className={`font-mono font-bold text-sm text-right ${myColor}`}>{myDisplayPts.toFixed(2)}</span>}
          </>
        ) : <span className="text-[var(--muted)] italic col-span-5">Empty</span>}
      </div>
      <div className={`${ROSTER_ROW_GRID} min-w-0 rounded ${oppHighlighted ? "bg-amber-400/10 ring-1 ring-amber-400/50" : ""}`}>
        {opp ? (
          <>
            <PlayerAvatar playerId={oppId} position={opp.position} className="w-5 h-5" />
            <span className="text-[9px] font-mono text-[var(--muted)] text-center">{opp.number != null ? `#${opp.number}` : ""}</span>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <PlayerNameButton playerId={oppId} name={opp.name} position={opp.position} className="text-[var(--text2)] truncate" />
                <InjuryBadge status={opp.injuryStatus} />
              </div>
              <GameBadge nflTeam={opp.team} week={week} byTeamWeek={byTeamWeek} />
            </div>
            <div className="flex justify-center"><PositionBadge position={opp.position} /></div>
            <div className="flex justify-center"><NflTeamTag team={opp.team} /></div>
            {oppDisplayPts != null && <span className={`font-mono font-bold text-sm text-right ${oppColor}`}>{oppDisplayPts.toFixed(2)}</span>}
          </>
        ) : <span className="text-[var(--muted)] italic col-span-5">Empty</span>}
      </div>
    </div>
  );
}

function MatchupRosterComparison({ mySlots, oppSlots, mySnapshot, oppSnapshot, playersDB, weekProjections, myScoringSettings, myFallbackField, oppScoringSettings, oppFallbackField, byTeamWeek, week, highlightTeams }) {
  if (!mySnapshot && !oppSnapshot) {
    return <p className="text-xs text-[var(--muted)] italic mt-2">No roster data available for this matchup yet.</p>;
  }
  const rows = Math.max(mySlots.length, oppSlots.length, mySnapshot?.starters?.length || 0, oppSnapshot?.starters?.length || 0);
  return (
    <div className="mt-3 pt-3 border-t border-[var(--border)]/60 divide-y divide-[var(--border)]/40">
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
            playersDB={playersDB} byTeamWeek={byTeamWeek} week={week} highlightTeams={highlightTeams}
          />
        );
      })}
    </div>
  );
}

function MatchupPill({ label, myTeam, myConf, oppConf, info, accentBorder, mySlots = [], oppSlots = [], playersDB, weekProjections, byTeamWeek, week, highlightTeams }) {
  if (!info) {
    return (
      <div className={`flex-1 min-w-[220px] bg-[var(--bg)]/60 border ${accentBorder} rounded-lg p-3 flex items-center justify-center`}>
        <span className="text-xs text-[var(--muted)] italic">No {label.toLowerCase()} matchup this week</span>
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
  const bigColor = SCORE_COLOR[scoreState({ hasActual: isFinal || isLive, isLive })];
  const showCaption = isLive && showScores;
  const [showRosters, setShowRosters] = useState(false);
  return (
    <div className={`bg-[var(--bg)]/60 border ${accentBorder} rounded-lg p-3`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">{label}</span>
        {isFinal && <span className="text-[10px] font-semibold text-[var(--pos)]">Final</span>}
        {isLive && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--live)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--live)] animate-pulse" />
            Live
          </span>
        )}
        {!isFinal && !isLive && showScores && <span className="text-[10px] font-semibold text-[var(--proj)]">Projected</span>}
      </div>

      {/* Below sm, each side gets the FULL card width on its own row instead of squeezing into a
          half-width column next to the other team -- that's what was truncating names like
          "TheRealHousehusbandsOfIB" down to a couple of characters on a phone. */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
        <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-start gap-2 sm:gap-0.5 min-w-0 flex-1">
          <TeamName manager={myTeam} conf={myConf} className="font-semibold truncate sm:w-full sm:justify-end" />
          <span className={`font-mono text-lg font-bold leading-none shrink-0 ${showScores ? bigColor : "text-[var(--muted)]"}`}>
            {showScores && bigMy != null ? bigMy.toFixed(1) : "--"}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:contents">
          <div className="flex-1 h-px bg-[var(--border)]/60 sm:hidden" />
          <span className="text-xs font-bold text-[var(--muted)] bg-[var(--surface)] px-2 py-1 rounded shrink-0">VS</span>
          <div className="flex-1 h-px bg-[var(--border)]/60 sm:hidden" />
        </div>
        <div className="flex items-center justify-between sm:flex-col sm:items-start sm:justify-start gap-2 sm:gap-0.5 min-w-0 flex-1">
          <TeamName manager={opponent} conf={oppConf} className="font-semibold truncate sm:w-full" />
          <span className={`font-mono text-lg font-bold leading-none shrink-0 ${showScores ? bigColor : "text-[var(--muted)]"}`}>
            {showScores && bigOpp != null ? bigOpp.toFixed(1) : "--"}
          </span>
        </div>
      </div>
      {showCaption && (
        <div className="flex items-center gap-2 mt-1">
          <span className="flex-1 text-right font-mono text-sm text-[var(--proj)]">{myScore != null ? `${myScore.toFixed(1)} proj` : ""}</span>
          <span className="w-7 shrink-0" />
          <span className="flex-1 text-left font-mono text-sm text-[var(--proj)]">{oppScore != null ? `${oppScore.toFixed(1)} proj` : ""}</span>
        </div>
      )}

      {showWinPct && (
        <div className="flex items-center gap-2 mt-1.5" title={winPctIsRough ? "Rough estimate -- limited data so far this week" : undefined}>
          <div className="flex-1 h-1.5 rounded-full bg-[var(--surface2)] overflow-hidden flex">
            <div className="h-full bg-[var(--accent)]" style={{ width: `${(myWinPct * 100).toFixed(0)}%` }} />
          </div>
          <span className="text-xs text-[var(--muted)] font-mono shrink-0">{(myWinPct * 100).toFixed(0)}% win</span>
        </div>
      )}
      {!isFinal && !showScores && (
        <div className="text-xs text-[var(--muted)] italic mt-1">
          No scores logged yet this season -- projections appear once Week 1 results post to Sleeper.
        </div>
      )}

      {(mySnapshot || oppSnapshot) && (
        <button
          type="button"
          onClick={() => setShowRosters(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[var(--text2)] hover:text-white bg-[var(--surface)]/80 hover:bg-[var(--surface2)] border border-[var(--border)]/80 rounded-md py-1 mt-2 uppercase tracking-wider transition-all duration-200"
        >
          {showRosters ? "Hide Rosters" : "Expand Rosters"}
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showRosters ? "rotate-180" : ""}`} />
        </button>
      )}
      {/* Force-expanded (regardless of the manual toggle) whenever a game is highlighted from the
          NFL games panel -- clicking a game should actually surface who plays in it across the
          league, not just leave every roster collapsed until manually opened one by one. */}
      {(showRosters || !!highlightTeams?.size) && (
        <MatchupRosterComparison
          mySlots={mySlots} oppSlots={oppSlots} mySnapshot={mySnapshot} oppSnapshot={oppSnapshot}
          playersDB={playersDB} weekProjections={weekProjections}
          myScoringSettings={myScoringSettings} myFallbackField={myFallbackField}
          oppScoringSettings={oppScoringSettings} oppFallbackField={oppFallbackField}
          byTeamWeek={byTeamWeek} week={week} highlightTeams={highlightTeams}
        />
      )}
    </div>
  );
}

export default function ManagerMatchupRow({ manager, conf, intra, inter, afcSlots, nfcSlots, playersDB, weekProjections, byTeamWeek, week, hideHeader, highlightTeams }) {
  const style = CONF_STYLES[conf];
  const interAccent = inter ? CONF_STYLES[inter.oppConf].border : style.border;
  const slotsFor = (c) => (c === "AFC" ? afcSlots : nfcSlots);
  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4 hover:border-[var(--border2)] transition-all duration-200">
      {/* Skipped on your own "Your Matchups" card (Home / This Week) -- that context already makes
          clear whose matchups these are (plus the big team logo above it), so repeating your own
          name/conference badge right above it again is just noise. The Matchups tab's list of
          EVERY manager still needs it, since there it's the only thing identifying each card. */}
      {!hideHeader && (
        <div className="flex items-center gap-2 mb-3 min-w-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge} shrink-0`}>{conf}</span>
          <TeamName manager={manager} conf={conf} className="font-bold min-w-0" />
        </div>
      )}
      <div className="flex flex-col gap-3">
        <MatchupPill
          label="In-Conference" myTeam={manager} myConf={conf} oppConf={conf}
          accentBorder={style.border} info={intra}
          mySlots={slotsFor(conf)} oppSlots={slotsFor(conf)} playersDB={playersDB}
          weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={week} highlightTeams={highlightTeams}
        />
        <MatchupPill
          label="Cross-Conference" myTeam={manager} myConf={conf} oppConf={inter?.oppConf}
          accentBorder={interAccent} info={inter}
          mySlots={slotsFor(conf)} oppSlots={slotsFor(inter?.oppConf)} playersDB={playersDB}
          weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={week} highlightTeams={highlightTeams}
        />
      </div>
    </div>
  );
}
