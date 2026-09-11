import React from 'react';
import { playerLabel, projectedPoints, computeTeamWeeklyTotals } from '../lib/players';
import { PositionBadge, InjuryBadge, GameBadge, NflTeamTag } from './shared';
import { SCORE_COLOR, scoreState } from '../lib/theme';
import PlayerAvatar from './PlayerAvatar';
import PlayerNameButton from './PlayerNameButton';

// Once a player has a real posted score for the week, show it alongside their pregame projection
// -- both numbers already say everything a +/- delta would (it's just their difference), so the
// delta is left out rather than showing the same information three ways in a few square inches.
// Before a real score exists, just the projection (blue).
function ProjectedPts({ id, weekProjections, scoringSettings, fallbackField, playersPoints, isLive, gameFinal }) {
  const real = playersPoints?.[id];
  // A real 0 is indistinguishable from "hasn't played yet" by the number alone (Sleeper's live
  // points default to 0 before kickoff too) -- but once the game is confirmed final, any 0 on the
  // board IS the real final score, not a placeholder.
  const hasReal = real > 0 || (gameFinal && real != null);
  const proj = weekProjections ? projectedPoints(weekProjections, id, scoringSettings, fallbackField) : null;

  if (hasReal) {
    const color = SCORE_COLOR[scoreState({ hasActual: true, isLive, actual: real, projected: proj })];
    return (
      <span className="font-mono text-right shrink-0 whitespace-nowrap">
        <span className={`font-bold text-sm ${color}`}>{real.toFixed(2)}</span>
        {proj != null && <span className="text-xs text-[var(--proj)] ml-1">({proj.toFixed(2)})</span>}
      </span>
    );
  }
  if (proj === null) return null;
  return <span className="text-sm font-mono font-semibold text-[var(--proj)] shrink-0">{proj.toFixed(2)}</span>;
}

// Team-level rollup of the same actual/projected/delta treatment as each player row: full squad
// projected total, actual total for whichever starters have posted a real score so far, and the
// +/- delta against just those same starters' projections (a fair, apples-to-apples comparison).
function TeamTotal({ starters, weekProjections, scoringSettings, fallbackField, playersPoints, playersDB, byTeamWeek, week }) {
  const { projectedAll, actualPosted, projectedPosted } = computeTeamWeeklyTotals(starters, weekProjections, scoringSettings, fallbackField, playersPoints);
  const anyProj = projectedAll != null;
  const anyPosted = actualPosted != null;
  if (!anyProj && !anyPosted) return null;
  // The total is still "live" (moving) as long as any starter who's posted points is mid-game --
  // only once every one of those games is final does the total stop changing.
  const anyStarterLive = (starters || []).some(id => id && id !== '0' && isLiveGame(byTeamWeek, playerLabel(playersDB, id)?.team, week));
  const postedColor = SCORE_COLOR[scoreState({ hasActual: anyPosted, isLive: anyStarterLive, actual: actualPosted, projected: projectedPosted })];
  return (
    <div className="bg-[var(--bg)]/60 border border-[var(--border)]/60 rounded-lg px-3 py-2 mb-3 text-sm space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Team Projected Total</span>
        <span className="font-mono font-bold text-base text-[var(--proj)]">{anyProj ? projectedAll.toFixed(2) : "--"}</span>
      </div>
      {anyPosted && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] shrink-0">Posted So Far</span>
          <span className="font-mono text-right">
            <span className={`font-bold text-base ${postedColor}`}>{actualPosted.toFixed(2)}</span>
            <span className="ml-1.5 text-xs text-[var(--proj)]">({projectedPosted.toFixed(2)})</span>
          </span>
        </div>
      )}
    </div>
  );
}

// Renders every starting slot (showing "Empty" for unfilled ones) plus bench, given the league's
// real starting-slot order -- never hides or fabricates a roster spot.
function isLiveGame(byTeamWeek, team, week) {
  return byTeamWeek?.[team]?.[week]?.state === 'in';
}
// Amber, deliberately not red/accent -- a live game and "this game involves your roster" (which
// often IS accent-red/orange, depending on the color scheme) need to read as two different things
// at a glance, not blend into the same tint.
const LIVE_ROW_CLASS = "bg-amber-400/10 -mx-1.5 px-1.5 rounded border-l-2 border-amber-400";

// Fixed-width columns (avatar / position / name+health / score / team+number) so every row lines up
// vertically regardless of name length -- a plain flex row only pins the LAST item to the edge, not
// the ones before it. Health status sits right next to the name itself (not off in its own column
// at the far end of the row) since it's a fact about that specific player, not a roster-wide stat
// like the columns after it. Jersey number folds into the team tag ("MIA #2") instead of its own
// column, freeing width for the name.
const ROW_GRID = "grid grid-cols-[20px_34px_minmax(0,1fr)_76px_56px] items-center gap-1.5";

export default function RosterList({ roster, startingSlots, irSlotCount = 0, playersDB, weekProjections, scoringSettings, fallbackField, playersPoints, byTeamWeek, week }) {
  const reserve = roster.reserve || [];
  const bench = roster.players.filter(id => !roster.starters.includes(id) && !reserve.includes(id));

  return (
    <>
      <TeamTotal starters={roster.starters} weekProjections={weekProjections} scoringSettings={scoringSettings} fallbackField={fallbackField} playersPoints={playersPoints} playersDB={playersDB} byTeamWeek={byTeamWeek} week={week} />
      <div className="flex items-center justify-between mb-1">
        <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Starters</p>
        <p className="text-[10px] text-[var(--muted)]">
          <span className="text-[var(--proj)] font-semibold">proj</span> &middot; <span className="text-[var(--live)] font-semibold">live</span> &middot; <span className="text-[var(--pos)] font-semibold">final</span>
        </p>
      </div>
      <div className="space-y-1 mb-3">
        {startingSlots.map((slot, i) => {
          const id = roster.starters[i];
          const isEmpty = !id || id === '0';
          if (isEmpty) {
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-[10px] font-mono text-[var(--muted)] w-9 shrink-0">{slot}</span>
                <span className="text-[var(--muted)] italic">Empty</span>
              </div>
            );
          }
          const { name, position, injuryStatus, team, number } = playerLabel(playersDB, id);
          const live = isLiveGame(byTeamWeek, team, week);
          const final = byTeamWeek?.[team]?.[week]?.state === 'post';
          return (
            <div key={i} className={`${ROW_GRID} text-sm py-0.5 ${live ? LIVE_ROW_CLASS : ""}`}>
              <PlayerAvatar playerId={id} position={position} />
              <div className="flex justify-center"><PositionBadge position={position} /></div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <PlayerNameButton playerId={id} name={name} position={position} className="text-[var(--text)] truncate" />
                  <InjuryBadge status={injuryStatus} />
                </div>
                <GameBadge nflTeam={team} week={week} byTeamWeek={byTeamWeek} />
              </div>
              <ProjectedPts id={id} weekProjections={weekProjections} scoringSettings={scoringSettings} fallbackField={fallbackField} playersPoints={playersPoints} isLive={live} gameFinal={final} />
              <div className="flex justify-center"><NflTeamTag team={team} number={number} /></div>
            </div>
          );
        })}
      </div>

      {irSlotCount > 0 && (
        <>
          <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">IR</p>
          <div className="space-y-1 mb-3">
            {Array.from({ length: irSlotCount }).map((_, i) => {
              const id = reserve[i];
              if (!id) {
                return <p key={i} className="text-[var(--muted)] italic text-sm">Empty</p>;
              }
              const { name, position, injuryStatus, team, number } = playerLabel(playersDB, id);
              const live = isLiveGame(byTeamWeek, team, week);
              const final = byTeamWeek?.[team]?.[week]?.state === 'post';
              return (
                <div key={id} className={`${ROW_GRID} text-sm py-0.5 ${live ? LIVE_ROW_CLASS : ""}`}>
                  <PlayerAvatar playerId={id} position={position} />
                  <div className="flex justify-center"><PositionBadge position={position} /></div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <PlayerNameButton playerId={id} name={name} position={position} className="text-[var(--text2)] truncate" />
                      <InjuryBadge status={injuryStatus} />
                    </div>
                    <GameBadge nflTeam={team} week={week} byTeamWeek={byTeamWeek} />
                  </div>
                  <ProjectedPts id={id} weekProjections={weekProjections} scoringSettings={scoringSettings} fallbackField={fallbackField} playersPoints={playersPoints} isLive={live} gameFinal={final} />
                  <div className="flex justify-center"><NflTeamTag team={team} number={number} /></div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] mb-1">Bench</p>
      <div className="space-y-1">
        {bench.length === 0 && <p className="text-[var(--muted)] italic text-sm">Empty</p>}
        {bench.map(id => {
          const { name, position, injuryStatus, team, number } = playerLabel(playersDB, id);
          const live = isLiveGame(byTeamWeek, team, week);
          const final = byTeamWeek?.[team]?.[week]?.state === 'post';
          return (
            <div key={id} className={`${ROW_GRID} text-sm py-0.5 ${live ? LIVE_ROW_CLASS : ""}`}>
              <PlayerAvatar playerId={id} position={position} />
              <div className="flex justify-center"><PositionBadge position={position} /></div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <PlayerNameButton playerId={id} name={name} position={position} className="text-[var(--text2)] truncate" />
                  <InjuryBadge status={injuryStatus} />
                </div>
                <GameBadge nflTeam={team} week={week} byTeamWeek={byTeamWeek} />
              </div>
              <ProjectedPts id={id} weekProjections={weekProjections} scoringSettings={scoringSettings} fallbackField={fallbackField} playersPoints={playersPoints} isLive={live} gameFinal={final} />
              <div className="flex justify-center"><NflTeamTag team={team} number={number} /></div>
            </div>
          );
        })}
      </div>
    </>
  );
}
