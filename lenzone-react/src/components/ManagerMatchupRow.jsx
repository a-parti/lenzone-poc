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
  // Sleeper's own convention, applied per-player: the big number is always the best REAL number
  // available right now -- live (mid-game, real 0s included) or final -- never the projection once
  // a player's actual game has started. Only "hasn't played yet at all" falls back to a dash, with
  // the projection always shown underneath, smaller, as the reference point either way.
  const myGameFinal = my && byTeamWeek?.[my.team]?.[week]?.state === 'post';
  const oppGameFinal = opp && byTeamWeek?.[opp.team]?.[week]?.state === 'post';
  const myLive = my && byTeamWeek?.[my.team]?.[week]?.state === 'in';
  const oppLive = opp && byTeamWeek?.[opp.team]?.[week]?.state === 'in';
  const myIsActual = myLive || myGameFinal || myPts > 0;
  const oppIsActual = oppLive || oppGameFinal || oppPts > 0;
  const myActualVal = myIsActual ? (myPts ?? 0) : null;
  const oppActualVal = oppIsActual ? (oppPts ?? 0) : null;
  const myColor = SCORE_COLOR[scoreState({ hasActual: myIsActual, isLive: myLive, actual: myActualVal, projected: myProj })];
  const oppColor = SCORE_COLOR[scoreState({ hasActual: oppIsActual, isLive: oppLive, actual: oppActualVal, projected: oppProj })];
  const myHighlighted = my && highlightTeams?.has(my.team);
  const oppHighlighted = opp && highlightTeams?.has(opp.team);
  return (
    // Always kept side-by-side, even on phones -- stacking each side full-width on its own row
    // read as one long vertical list of unrelated players instead of a matchup comparison. The
    // enclosing MatchupRosterComparison wraps this in a horizontally-scrollable, min-width
    // container instead, so both columns keep their shape and a phone just scrolls sideways to
    // see the rest, the same way the standings/grid tables already do.
    <div className="grid grid-cols-2 gap-4 text-xs py-1.5">
      <div
        className={`${ROSTER_ROW_FLEX} min-w-0 rounded ${onSelectGame && my ? "cursor-pointer" : ""} ${myHighlighted ? "bg-violet-400/20 ring-2 ring-violet-400/70" : ""}`}
        onClick={my ? handleRowClick(my.team) : undefined}
      >
        {my ? (
          <>
            <PlayerAvatar playerId={myId} position={my.position} className="w-7 h-7 sm:w-10 sm:h-10 shrink-0" />
            <div className="w-9 shrink-0 flex justify-center"><PositionBadge position={my.position} /></div>
            <div className={`flex flex-col ${ROSTER_NAME_WIDTH}`}>
              <div className="flex items-center gap-1 min-w-0">
                <PlayerNameButton playerId={myId} name={my.name} position={my.position} className="font-bold text-[var(--text2)] truncate" />
                <InjuryBadge status={my.injuryStatus} />
              </div>
              <GameBadge nflTeam={my.team} week={week} byTeamWeek={byTeamWeek} />
            </div>
            <div className="ml-1 shrink-0"><NflTeamTag team={my.team} number={my.number} /></div>
            {(myActualVal != null || myProj != null) && (
              <span className="font-mono text-right ml-auto shrink-0 whitespace-nowrap flex flex-col items-end leading-tight">
                <span className={`font-bold text-base ${myIsActual ? myColor : "text-[var(--muted)]"}`}>
                  {myIsActual ? myActualVal.toFixed(2) : "--"}
                </span>
                {myProj != null && <span className="text-[10px] text-[var(--proj)]">{myProj.toFixed(2)}</span>}
              </span>
            )}
          </>
        ) : <span className="text-[var(--muted)] italic">Empty</span>}
      </div>
      {/* Mirrored (flex-row-reverse) so this side reads right-to-left: avatar/position hug the
          outer edge, score sits closest to the VS divider -- both teams' scores converge toward
          the middle, matching the header's own left/right layout above. */}
      <div
        className={`${ROSTER_ROW_FLEX} flex-row-reverse min-w-0 rounded ${onSelectGame && opp ? "cursor-pointer" : ""} ${oppHighlighted ? "bg-violet-400/20 ring-2 ring-violet-400/70" : ""}`}
        onClick={opp ? handleRowClick(opp.team) : undefined}
      >
        {opp ? (
          <>
            <PlayerAvatar playerId={oppId} position={opp.position} className="w-7 h-7 sm:w-10 sm:h-10 shrink-0" />
            <div className="w-9 shrink-0 flex justify-center"><PositionBadge position={opp.position} /></div>
            <div className={`flex flex-col items-end text-right ${ROSTER_NAME_WIDTH}`}>
              <div className="flex items-center gap-1 min-w-0">
                <InjuryBadge status={opp.injuryStatus} />
                <PlayerNameButton playerId={oppId} name={opp.name} position={opp.position} className="font-bold text-[var(--text2)] truncate" />
              </div>
              <GameBadge nflTeam={opp.team} week={week} byTeamWeek={byTeamWeek} />
            </div>
            <div className="shrink-0"><NflTeamTag team={opp.team} number={opp.number} /></div>
            {(oppActualVal != null || oppProj != null) && (
              <span className="font-mono text-left mr-auto shrink-0 whitespace-nowrap flex flex-col items-start leading-tight">
                <span className={`font-bold text-base ${oppIsActual ? oppColor : "text-[var(--muted)]"}`}>
                  {oppIsActual ? oppActualVal.toFixed(2) : "--"}
                </span>
                {oppProj != null && <span className="text-[10px] text-[var(--proj)]">{oppProj.toFixed(2)}</span>}
              </span>
            )}
          </>
        ) : <span className="text-[var(--muted)] italic">Empty</span>}
      </div>
    </div>
  );
}

// A faded, thin-divided sub-section (Bench / IR) below the starters -- same row component, just
// visually dimmed and set off by a labeled divider so it reads as "these guys aren't scoring for
// you" without hiding them entirely.
function RosterSubSection({ title, rows, rowProps }) {
  if (rows === 0) return null;
  return (
    <div className="pt-2">
      <div className="flex items-center gap-2 pt-1 pb-1">
        <div className="flex-1 h-px bg-[var(--border2)]" />
        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted)] shrink-0">{title}</span>
        <div className="flex-1 h-px bg-[var(--border2)]" />
      </div>
      <div className="opacity-55 divide-y divide-[var(--border)]/40">
        {Array.from({ length: rows }).map((_, i) => <RosterCompareRow key={i} {...rowProps(i)} />)}
      </div>
    </div>
  );
}

function MatchupRosterComparison({
  mySlots, oppSlots, mySnapshot, oppSnapshot, playersDB, weekProjections, myScoringSettings, myFallbackField,
  oppScoringSettings, oppFallbackField, byTeamWeek, week, highlightTeams, onSelectGame,
  myBenchIds = [], oppBenchIds = [], myIrIds = [], oppIrIds = []
}) {
  if (!mySnapshot && !oppSnapshot) {
    return <p className="text-xs text-[var(--muted)] italic mt-2">No roster data available for this matchup yet.</p>;
  }
  const starterRows = Math.max(mySlots.length, oppSlots.length, mySnapshot?.starters?.length || 0, oppSnapshot?.starters?.length || 0);
  const benchRows = Math.max(myBenchIds.length, oppBenchIds.length);
  const irRows = Math.max(myIrIds.length, oppIrIds.length);
  const shared = { playersDB, byTeamWeek, week, highlightTeams, onSelectGame };
  return (
    // Horizontally scrollable on narrow screens instead of collapsing the two-team comparison
    // into one long vertical list -- min-w keeps both columns their full intended width so a
    // phone scrolls sideways to see the rest of a row, the same way the grid/standings tables do,
    // rather than every player wrapping onto its own line.
    <div className="mt-3 pt-3 border-t border-[var(--border)]/60 overflow-x-auto scroll-thin">
    <div className="min-w-[480px] divide-y divide-[var(--border)]/40">
      {Array.from({ length: starterRows }).map((_, i) => {
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
            {...shared}
          />
        );
      })}
      <RosterSubSection
        title="Bench"
        rows={benchRows}
        rowProps={(i) => {
          const myId = myBenchIds[i];
          const oppId = oppBenchIds[i];
          return {
            myId, oppId,
            myPts: myId ? mySnapshot?.playersPoints?.[myId] : undefined,
            oppPts: oppId ? oppSnapshot?.playersPoints?.[oppId] : undefined,
            myProj: projectedPoints(weekProjections, myId, myScoringSettings, myFallbackField),
            oppProj: projectedPoints(weekProjections, oppId, oppScoringSettings, oppFallbackField),
            ...shared
          };
        }}
      />
      <RosterSubSection
        title="IR"
        rows={irRows}
        rowProps={(i) => {
          const myId = myIrIds[i];
          const oppId = oppIrIds[i];
          return {
            myId, oppId,
            myPts: myId ? mySnapshot?.playersPoints?.[myId] : undefined,
            oppPts: oppId ? oppSnapshot?.playersPoints?.[oppId] : undefined,
            myProj: projectedPoints(weekProjections, myId, myScoringSettings, myFallbackField),
            oppProj: projectedPoints(weekProjections, oppId, oppScoringSettings, oppFallbackField),
            ...shared
          };
        }}
      />
    </div>
    </div>
  );
}

function MatchupPill({ label, myTeam, myConf, oppConf, info, accentBorder, mySlots = [], oppSlots = [], playersDB, weekProjections, byTeamWeek, week, highlightTeams, onSelectGame }) {
  // A manager can have matchup data in one selected week and none in another. Keep this hook ahead
  // of the empty-matchup return so week navigation never changes the component's hook order.
  const [showRosters, setShowRosters] = useState(false);
  if (!info) {
    return (
      <div className={`flex-1 min-w-[220px] bg-[var(--bg)]/60 border ${accentBorder} rounded-lg p-3 flex items-center justify-center`}>
        <span className="text-xs text-[var(--muted)] italic">No {label.toLowerCase()} matchup this week</span>
      </div>
    );
  }
  const {
    opponent, myScore, oppScore, myLiveScore, oppLiveScore, isFinal, isLive, myWinPct, winPctIsRough, myHasData, oppHasData, mySnapshot, oppSnapshot,
    myScoringSettings, myFallbackField, oppScoringSettings, oppFallbackField, myProjected, oppProjected,
    myBenchIds, oppBenchIds, myIrIds, oppIrIds
  } = info;
  const showWinPct = !isFinal && myWinPct !== null;
  const showScores = isFinal || myHasData || oppHasData;
  // Sleeper's own convention: the big number is always the best REAL number available right now
  // (final score, or the live score while a game is in progress); the projected final is a small
  // secondary caption underneath, only while there's still uncertainty left (live or pregame).
  const bigMy = isFinal ? myScore : isLive ? (myLiveScore ?? 0) : myScore;
  const bigOpp = isFinal ? oppScore : isLive ? (oppLiveScore ?? 0) : oppScore;
  // Team-level scores (both the big actual number and the small projected caption) deliberately
  // stay a single plain color, live/final/pregame alike -- green/red here (whether tied to
  // beat-your-own-projection or win/loss) made it hard to tell who actually won at a glance,
  // especially once both sides could show the same color. The W/L badge is the one true win/loss
  // signal at this level. Per-PLAYER rows (RosterCompareRow above) are a different, deliberate
  // case -- that green/red (beat/missed THAT player's own projection) stays, since there's no
  // separate win/loss badge at the player level to already carry that signal.
  const myBigColor = isLive ? "text-[var(--live)]" : "text-[var(--text)]";
  const oppBigColor = isLive ? "text-[var(--live)]" : "text-[var(--text)]";
  const myProjColor = "text-[var(--proj)]";
  const oppProjColor = "text-[var(--proj)]";
  // Shown post-final too (not just live/pregame) -- "what was it projected to be" stays a useful
  // reference point even once the real result is known, not just while the outcome's in doubt.
  const showCaption = showScores && (isLive || isFinal);
  const result = isFinal && myScore != null && oppScore != null
    ? (myScore > oppScore ? "W" : myScore < oppScore ? "L" : "T")
    : null;
  // Real Standings Pts this specific matchup is worth (see buildConferenceList in statsMath.js):
  // an in-conference win is worth 2.0 Standings Pts (1.0 for a tie), a cross-conference win only
  // 1.0 (0.5 for a tie) -- shown next to the W/L badge so it's clear at a glance how much this
  // particular result actually moves the real standings, not just who "won" the game.
  const isInConf = label === "In-Conference";
  const myStandingsPts = result === "W" ? (isInConf ? 2 : 1) : result === "T" ? (isInConf ? 1 : 0.5) : 0;
  const RESULT_STYLE = { W: "bg-[var(--pos)]/20 text-[var(--pos)]", L: "bg-[var(--neg)]/20 text-[var(--neg)]", T: "bg-[var(--muted)]/20 text-[var(--muted)]" };
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
        <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-start gap-2 sm:gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full sm:justify-end">
            {result && (
              <span className={`text-sm font-black px-2 py-0.5 rounded shrink-0 whitespace-nowrap ${RESULT_STYLE[result]}`}>
                {result} +{myStandingsPts}
              </span>
            )}
            <TeamName manager={myTeam} conf={myConf} className="font-semibold truncate" />
          </div>
          <span className="font-mono leading-tight shrink-0 whitespace-nowrap flex flex-col sm:items-end">
            <span className={`text-lg font-bold ${showScores ? myBigColor : "text-[var(--muted)]"}`}>
              {showScores && bigMy != null ? bigMy.toFixed(2) : "--"}
              {!isFinal && !isLive && showScores && bigMy != null && (
                <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-[var(--proj)]">Proj</span>
              )}
            </span>
            {/* Live: myScore itself IS the blended projected-final (bigMy shows the live-partial
                actual instead). Final: myScore now equals the real final, so the pregame
                myProjected is the only meaningful "what was it projected to be" left to show. */}
            {showCaption && isLive && myScore != null && (
              <span className="text-[10px] text-[var(--proj)]">{myScore.toFixed(2)} proj</span>
            )}
            {showCaption && isFinal && myProjected != null && (
              <span className={`text-[10px] ${myProjColor}`}>{myProjected.toFixed(2)} proj</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:contents">
          <div className="flex-1 h-px bg-[var(--border)]/60 sm:hidden" />
          <span className="text-xs font-bold text-[var(--muted)] bg-[var(--surface)] px-2 py-1 rounded shrink-0">VS</span>
          <div className="flex-1 h-px bg-[var(--border)]/60 sm:hidden" />
        </div>
        <div className="flex items-center justify-between sm:flex-col sm:items-start sm:justify-start gap-2 sm:gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0 sm:w-full">
            <TeamName manager={opponent} conf={oppConf} className="font-semibold truncate" />
            {result && (() => {
              const oppResult = result === "W" ? "L" : result === "L" ? "W" : "T";
              const oppStandingsPts = oppResult === "W" ? (isInConf ? 2 : 1) : oppResult === "T" ? (isInConf ? 1 : 0.5) : 0;
              return (
                <span className={`text-sm font-black px-2 py-0.5 rounded shrink-0 whitespace-nowrap ${RESULT_STYLE[oppResult]}`}>
                  {oppResult} +{oppStandingsPts}
                </span>
              );
            })()}
          </div>
          <span className="font-mono leading-tight shrink-0 whitespace-nowrap flex flex-col">
            <span className={`text-lg font-bold ${showScores ? oppBigColor : "text-[var(--muted)]"}`}>
              {showScores && bigOpp != null ? bigOpp.toFixed(2) : "--"}
              {!isFinal && !isLive && showScores && bigOpp != null && (
                <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-[var(--proj)]">Proj</span>
              )}
            </span>
            {showCaption && isLive && oppScore != null && (
              <span className="text-[10px] text-[var(--proj)]">{oppScore.toFixed(2)} proj</span>
            )}
            {showCaption && isFinal && oppProjected != null && (
              <span className={`text-[10px] ${oppProjColor}`}>{oppProjected.toFixed(2)} proj</span>
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
          myBenchIds={myBenchIds} oppBenchIds={oppBenchIds} myIrIds={myIrIds} oppIrIds={oppIrIds}
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
