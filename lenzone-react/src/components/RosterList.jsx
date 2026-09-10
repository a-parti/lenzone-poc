import React from 'react';
import { playerLabel, projectedPoints, computeTeamWeeklyTotals } from '../lib/players';
import { PositionBadge, InjuryBadge, GameBadge } from './shared';
import PlayerAvatar from './PlayerAvatar';
import PlayerNameButton from './PlayerNameButton';

// Once a player has a real posted score for the week, show it alongside their pregame projection
// and a clear +/- delta (beat/missed projection) -- both numbers captured, not just one or the other.
// Before that, just the projection (blue).
function ProjectedPts({ id, weekProjections, scoringSettings, fallbackField, playersPoints }) {
  const real = playersPoints?.[id];
  const hasReal = real > 0;
  const proj = weekProjections ? projectedPoints(weekProjections, id, scoringSettings, fallbackField) : null;

  if (hasReal) {
    const diff = proj != null ? real - proj : null;
    return (
      <div className="flex flex-col items-end shrink-0 leading-none gap-0.5">
        <span className="font-mono text-[11px] text-emerald-400">{real.toFixed(1)}</span>
        {diff != null && (
          <span className={`font-mono text-[9px] ${diff >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {diff >= 0 ? "+" : ""}{diff.toFixed(1)} vs {proj.toFixed(1)} proj
          </span>
        )}
      </div>
    );
  }
  if (proj === null) return null;
  return <span className="text-[11px] font-mono text-blue-300 shrink-0">{proj.toFixed(1)} proj</span>;
}

// Team-level rollup of the same actual/projected/delta treatment as each player row: full squad
// projected total, actual total for whichever starters have posted a real score so far, and the
// +/- delta against just those same starters' projections (a fair, apples-to-apples comparison).
function TeamTotal({ starters, weekProjections, scoringSettings, fallbackField, playersPoints }) {
  const { projectedAll, actualPosted, projectedPosted } = computeTeamWeeklyTotals(starters, weekProjections, scoringSettings, fallbackField, playersPoints);
  const anyProj = projectedAll != null;
  const anyPosted = actualPosted != null;
  if (!anyProj && !anyPosted) return null;
  const diff = anyPosted ? actualPosted - projectedPosted : null;
  return (
    <div className="bg-slate-950/60 border border-slate-800/60 rounded-lg px-3 py-2 mb-3 text-sm space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">Team Projected Total</span>
        <span className="font-mono text-blue-300">{anyProj ? projectedAll.toFixed(1) : "--"}</span>
      </div>
      {anyPosted && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 shrink-0">Posted So Far</span>
          <span className="font-mono text-right">
            <span className="text-emerald-400 font-bold">{actualPosted.toFixed(1)}</span>
            {diff != null && (
              <span className={`ml-1.5 text-[10px] block sm:inline ${diff >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                ({diff >= 0 ? "+" : ""}{diff.toFixed(1)} vs {projectedPosted.toFixed(1)} proj)
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

// Renders every starting slot (showing "Empty" for unfilled ones) plus bench, given the league's
// real starting-slot order -- never hides or fabricates a roster spot.
export default function RosterList({ roster, startingSlots, irSlotCount = 0, playersDB, weekProjections, scoringSettings, fallbackField, playersPoints, byTeamWeek, week }) {
  const reserve = roster.reserve || [];
  const bench = roster.players.filter(id => !roster.starters.includes(id) && !reserve.includes(id));

  return (
    <>
      <TeamTotal starters={roster.starters} weekProjections={weekProjections} scoringSettings={scoringSettings} fallbackField={fallbackField} playersPoints={playersPoints} />
      <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 mb-1">Starters</p>
      <div className="space-y-1 mb-3">
        {startingSlots.map((slot, i) => {
          const id = roster.starters[i];
          const isEmpty = !id || id === '0';
          if (isEmpty) {
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-[10px] font-mono text-slate-600 w-9 shrink-0">{slot}</span>
                <span className="text-slate-700 italic">Empty</span>
              </div>
            );
          }
          const { name, position, injuryStatus, team } = playerLabel(playersDB, id);
          return (
            <div key={i} className="flex items-center justify-between text-sm gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono text-slate-600 w-9 shrink-0">{slot}</span>
                <PlayerAvatar playerId={id} position={position} />
                <div className="flex flex-col min-w-0">
                  <PlayerNameButton playerId={id} name={name} position={position} className="text-slate-200 truncate" />
                  <GameBadge nflTeam={team} week={week} byTeamWeek={byTeamWeek} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ProjectedPts id={id} weekProjections={weekProjections} scoringSettings={scoringSettings} fallbackField={fallbackField} playersPoints={playersPoints} />
                <PositionBadge position={position} />
                <InjuryBadge status={injuryStatus} />
              </div>
            </div>
          );
        })}
      </div>

      {irSlotCount > 0 && (
        <>
          <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 mb-1">IR</p>
          <div className="space-y-1 mb-3">
            {Array.from({ length: irSlotCount }).map((_, i) => {
              const id = reserve[i];
              if (!id) {
                return <p key={i} className="text-slate-700 italic text-sm">Empty</p>;
              }
              const { name, position, injuryStatus, team } = playerLabel(playersDB, id);
              return (
                <div key={id} className="flex items-center justify-between text-sm gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <PlayerAvatar playerId={id} position={position} />
                    <div className="flex flex-col min-w-0">
                      <PlayerNameButton playerId={id} name={name} position={position} className="text-slate-400 truncate" />
                      <GameBadge nflTeam={team} week={week} byTeamWeek={byTeamWeek} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ProjectedPts id={id} weekProjections={weekProjections} scoringSettings={scoringSettings} fallbackField={fallbackField} playersPoints={playersPoints} />
                    <PositionBadge position={position} />
                    <InjuryBadge status={injuryStatus} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 mb-1">Bench</p>
      <div className="space-y-1">
        {bench.length === 0 && <p className="text-slate-700 italic text-sm">Empty</p>}
        {bench.map(id => {
          const { name, position, injuryStatus, team } = playerLabel(playersDB, id);
          return (
            <div key={id} className="flex items-center justify-between text-sm gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <PlayerAvatar playerId={id} position={position} />
                <div className="flex flex-col min-w-0">
                  <PlayerNameButton playerId={id} name={name} position={position} className="text-slate-400 truncate" />
                  <GameBadge nflTeam={team} week={week} byTeamWeek={byTeamWeek} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <ProjectedPts id={id} weekProjections={weekProjections} scoringSettings={scoringSettings} fallbackField={fallbackField} playersPoints={playersPoints} />
                <PositionBadge position={position} />
                <InjuryBadge status={injuryStatus} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
