import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CONF_STYLES, SCORE_COLOR, scoreState } from '../lib/theme';
import { projectedPoints } from '../lib/players';
import { PositionBadge, InjuryBadge, GameBadge, NflTeamTag } from './shared';
import { playerLabel } from '../lib/players';
import PlayerAvatar from './PlayerAvatar';
import PlayerNameButton from './PlayerNameButton';
import TeamName from './TeamName';

// A CSS grid with the name column as a flexible 1fr track looks aligned in theory, but a 1fr
// TRACK always claims the full leftover width regardless of how short its content is -- so a short
// name like "Malik Willis" leaves a big dead gap between the name and the position/team tags that
// follow, instead of the tags sitting right next to it. A flex row with a capped (not rigidly
// fixed) name width avoids that: names normally sit at a consistent width so tags/score line up,
// but the column can still SHRINK below that cap under real width pressure -- a rigid fixed width
// with everything else shrink-0 has nowhere to give, so it silently overflows the half-card and
// pushes the score off past the visible edge instead of just truncating the name. Also drops the
// old plain-text slot label ("QB") that duplicated the colored position tag sitting right next to it.
const ROSTER_ROW_FLEX = "flex items-center gap-1.5";
const ROSTER_NAME_WIDTH = "flex-1 min-w-0 max-w-[168px]";

// Clicking anywhere on a player's side of the row (but not the name or team-tag buttons, which
// already have their own destinations -- player card / depth chart) highlights that player's real
// NFL game and everyone else in it, the same way clicking a game in the NFL games panel does.
// e.target.closest('button') lets a click that started on one of those two nested buttons fall
// through to its own handler instead of also triggering this.
function gameFor(team, week, byTeamWeek) {
  const g = team && byTeamWeek?.[team]?.[week];
  if (!g || !g.opponent) return null;
  return { home: g.isHome ? team : g.opponent, away: g.isHome ? g.opponent : team };
}

function RosterCompareRow({ label, myId, oppId, myPts, oppPts, myProj, oppProj, playersDB, byTeamWeek, week, highlightTeams, onSelectGame }) {
  const my = myId && myId !== '0' ? playerLabel(playersDB, myId) : null;
  const opp = oppId && oppId !== '0' ? playerLabel(playersDB, oppId) : null;
  const handleRowClick = (team) => (e) => {
    if (e.target.closest('button')) return;
    const g = gameFor(team, week, byTeamWeek);
    if (g) onSelectGame?.(g);
  };
  // A real 0 is indistinguishable from "hasn't played yet" by the number alone (Sleeper's live
  // points default to 0 before kickoff too) -- but once that player's own game is confirmed final,
  // any 0 on the board IS their real final score, not a placeholder. Without this, a player who
  // legitimately scored zero in an already-final game showed as if still projected.
  const myGameFinal = my && byTeamWeek?.[my.team]?.[week]?.state === 'post';
  const oppGameFinal = opp && byTeamWeek?.[opp.team]?.[week]?.state === 'post';
  const myIsActual = myPts > 0 || (myGameFinal && myPts != null);
  const oppIsActual = oppPts > 0 || (oppGameFinal && oppPts != null);
  const myDisplayPts = myIsActual ? myPts : myProj;
  const oppDisplayPts = oppIsActual ? oppPts : oppProj;
  const myLive = my && byTeamWeek?.[my.team]?.[week]?.state === 'in';
  const oppLive = opp && byTeamWeek?.[opp.team]?.[week]?.state === 'in';
  const myColor = SCORE_COLOR[scoreState({ hasActual: myIsActual, isLive: myLive, actual: myPts, projected: myProj })];
  const oppColor = SCORE_COLOR[scoreState({ hasActual: oppIsActual, isLive: oppLive, actual: oppPts, projected: oppProj })];
  const myHighlighted = my && highlightTeams?.has(my.team);
  const oppHighlighted = opp && highlightTeams?.has(opp.team);
  return (
    <div className="grid grid-cols-2 gap-4 text-xs py-1.5">
      <div
        className={`${ROSTER_ROW_FLEX} min-w-0 rounded ${onSelectGame && my ? "cursor-pointer" : ""} ${myHighlighted ? "bg-amber-400/10 ring-1 ring-amber-400/50" : ""}`}
        onClick={my ? handleRowClick(my.team) : undefined}
      >
        {my ? (
          <>
            <PlayerAvatar playerId={myId} position={my.position} className="w-5 h-5 shrink-0" />
            <div className="w-9 shrink-0 flex justify-center"><PositionBadge position={my.position} /></div>
            <div className={`flex flex-col ${ROSTER_NAME_WIDTH}`}>
              <div className="flex items-center gap-1 min-w-0">
                <PlayerNameButton playerId={myId} name={my.name} position={my.position} className="text-[var(--text2)] truncate" />
                <InjuryBadge status={my.injuryStatus} />
              </div>
              <GameBadge nflTeam={my.team} week={week} byTeamWeek={byTeamWeek} />
            </div>
            <div className="ml-1 shrink-0"><NflTeamTag team={my.team} number={my.number} /></div>
            {myDisplayPts != null && (
              <span className="font-mono text-right ml-auto shrink-0 whitespace-nowrap">
                <span className={`font-bold text-base ${myColor}`}>{myDisplayPts.toFixed(2)}</span>
                {myIsActual && myProj != null && <span className="text-xs text-[var(--proj)] ml-1">({myProj.toFixed(2)})</span>}
              </span>
            )}
          </>
        ) : <span className="text-[var(--muted)] italic">Empty</span>}
      </div>
      <div
        className={`${ROSTER_ROW_FLEX} min-w-0 rounded ${onSelectGame && opp ? "cursor-pointer" : ""} ${oppHighlighted ? "bg-amber-400/10 ring-1 ring-amber-400/50" : ""}`}
        onClick={opp ? handleRowClick(opp.team) : undefined}
      >
        {opp ? (
          <>
            <PlayerAvatar playerId={oppId} position={opp.position} className="w-5 h-5 shrink-0" />
            <div className="w-9 shrink-0 flex justify-center"><PositionBadge position={opp.position} /></div>
            <div className={`flex flex-col ${ROSTER_NAME_WIDTH}`}>
              <div className="flex items-center gap-1 min-w-0">
                <PlayerNameButton playerId={oppId} name={opp.name} position={opp.position} className="text-[var(--text2)] truncate" />
                <InjuryBadge status={opp.injuryStatus} />
              </div>
              <GameBadge nflTeam={opp.team} week={week} byTeamWeek={byTeamWeek} />
            </div>
            <div className="ml-1 shrink-0"><NflTeamTag team={opp.team} number={opp.number} /></div>
            {oppDisplayPts != null && (
              <span className="font-mono text-right ml-auto shrink-0 whitespace-nowrap">
                <span className={`font-bold text-base ${oppColor}`}>{oppDisplayPts.toFixed(2)}</span>
                {oppIsActual && oppProj != null && <span className="text-xs text-[var(--proj)] ml-1">({oppProj.toFixed(2)})</span>}
              </span>
            )}
          </>
        ) : <span className="text-[var(--muted)] italic">Empty</span>}
      </div>
    </div>
  );
}

function MatchupRosterComparison({ mySlots, oppSlots, mySnapshot, oppSnapshot, playersDB, weekProjections, myScoringSettings, myFallbackField, oppScoringSettings, oppFallbackField, byTeamWeek, week, highlightTeams, onSelectGame }) {
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
            playersDB={playersDB} byTeamWeek={byTeamWeek} week={week} highlightTeams={highlightTeams} onSelectGame={onSelectGame}
          />
        );
      })}
    </div>
  );
}

function MatchupPill({ label, myTeam, myConf, oppConf, info, accentBorder, mySlots = [], oppSlots = [], playersDB, weekProjections, byTeamWeek, week, highlightTeams, onSelectGame }) {
  if (!info) {
    return (
      <div className={`flex-1 min-w-[220px] bg-[var(--bg)]/60 border ${accentBorder} rounded-lg p-3 flex items-center justify-center`}>
        <span className="text-xs text-[var(--muted)] italic">No {label.toLowerCase()} matchup this week</span>
      </div>
    );
  }
  const {
    opponent, myScore, oppScore, myLiveScore, oppLiveScore, isFinal, isLive, myWinPct, winPctIsRough, myHasData, oppHasData, mySnapshot, oppSnapshot,
    myScoringSettings, myFallbackField, oppScoringSettings, oppFallbackField, myProjected, oppProjected
  } = info;
  const showWinPct = !isFinal && myWinPct !== null;
  const showScores = isFinal || myHasData || oppHasData;
  // Sleeper's own convention: the big number is always the best REAL number available right now
  // (final score, or the live score while a game is in progress); the projected final is a small
  // secondary caption underneath, only while there's still uncertainty left (live or pregame).
  const bigMy = isFinal ? myScore : isLive ? (myLiveScore ?? 0) : myScore;
  const bigOpp = isFinal ? oppScore : isLive ? (oppLiveScore ?? 0) : oppScore;
  // Each side's final score is colored by whether IT beat ITS OWN pregame projection -- not a flat
  // "final = green" -- so a final score can read red if that team came in under its projection.
  const myBigColor = SCORE_COLOR[scoreState({ hasActual: isFinal || isLive, isLive, actual: isFinal ? myScore : null, projected: myProjected })];
  const oppBigColor = SCORE_COLOR[scoreState({ hasActual: isFinal || isLive, isLive, actual: isFinal ? oppScore : null, projected: oppProjected })];
  const showCaption = isLive && showScores;
  const [showRosters, setShowRosters] = useState(false);
  return (
    <div className={`bg-[var(--bg)]/60 border ${accentBorder} rounded-lg p-3`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">{label}</span>
        {isFinal && <span className="text-[10px] font-semibold text-[var(--pos)]">Final</span>}
        {!isFinal && !isLive && showScores && <span className="text-[10px] font-semibold text-[var(--proj)]">Projected</span>}
      </div>

      {/* Below sm, each side gets the FULL card width on its own row instead of squeezing into a
          half-width column next to the other team -- that's what was truncating names like
          "TheRealHousehusbandsOfIB" down to a couple of characters on a phone. */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
        <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-start gap-2 sm:gap-0.5 min-w-0 flex-1">
          <TeamName manager={myTeam} conf={myConf} className="font-semibold truncate sm:w-full sm:justify-end" />
          <span className="font-mono leading-none shrink-0 whitespace-nowrap">
            <span className={`text-lg font-bold ${showScores ? myBigColor : "text-[var(--muted)]"}`}>
              {showScores && bigMy != null ? bigMy.toFixed(2) : "--"}
            </span>
            {showCaption && myScore != null && (
              <span className="text-xs text-[var(--proj)] ml-1">({myScore.toFixed(2)} proj)</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:contents">
          <div className="flex-1 h-px bg-[var(--border)]/60 sm:hidden" />
          <span className="text-xs font-bold text-[var(--muted)] bg-[var(--surface)] px-2 py-1 rounded shrink-0">VS</span>
          <div className="flex-1 h-px bg-[var(--border)]/60 sm:hidden" />
        </div>
        <div className="flex items-center justify-between sm:flex-col sm:items-start sm:justify-start gap-2 sm:gap-0.5 min-w-0 flex-1">
          <TeamName manager={opponent} conf={oppConf} className="font-semibold truncate sm:w-full" />
          <span className="font-mono leading-none shrink-0 whitespace-nowrap">
            <span className={`text-lg font-bold ${showScores ? oppBigColor : "text-[var(--muted)]"}`}>
              {showScores && bigOpp != null ? bigOpp.toFixed(2) : "--"}
            </span>
            {showCaption && oppScore != null && (
              <span className="text-xs text-[var(--proj)] ml-1">({oppScore.toFixed(2)} proj)</span>
            )}
          </span>
        </div>
      </div>

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
          byTeamWeek={byTeamWeek} week={week} highlightTeams={highlightTeams} onSelectGame={onSelectGame}
        />
      )}
    </div>
  );
}

export default function ManagerMatchupRow({ manager, conf, intra, inter, afcSlots, nfcSlots, playersDB, weekProjections, byTeamWeek, week, hideHeader, highlightTeams, onSelectGame }) {
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
          weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={week} highlightTeams={highlightTeams} onSelectGame={onSelectGame}
        />
        <MatchupPill
          label="Cross-Conference" myTeam={manager} myConf={conf} oppConf={inter?.oppConf}
          accentBorder={interAccent} info={inter}
          mySlots={slotsFor(conf)} oppSlots={slotsFor(inter?.oppConf)} playersDB={playersDB}
          weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={week} highlightTeams={highlightTeams} onSelectGame={onSelectGame}
        />
      </div>
    </div>
  );
}
