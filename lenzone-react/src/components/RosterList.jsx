import React from 'react';
import { playerLabel } from '../lib/players';
import { PositionBadge, InjuryBadge } from './shared';
import PlayerAvatar from './PlayerAvatar';
import PlayerNameButton from './PlayerNameButton';

// Renders every starting slot (showing "Empty" for unfilled ones) plus bench, given the league's
// real starting-slot order -- never hides or fabricates a roster spot.
export default function RosterList({ roster, startingSlots, irSlotCount = 0, playersDB }) {
  const reserve = roster.reserve || [];
  const bench = roster.players.filter(id => !roster.starters.includes(id) && !reserve.includes(id));

  return (
    <>
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
          const { name, position, injuryStatus } = playerLabel(playersDB, id);
          return (
            <div key={i} className="flex items-center justify-between text-sm gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono text-slate-600 w-9 shrink-0">{slot}</span>
                <PlayerAvatar playerId={id} position={position} />
                <PlayerNameButton playerId={id} name={name} position={position} className="text-slate-200 truncate" />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
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
              const { name, position, injuryStatus } = playerLabel(playersDB, id);
              return (
                <div key={id} className="flex items-center justify-between text-sm gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <PlayerAvatar playerId={id} position={position} />
                    <PlayerNameButton playerId={id} name={name} position={position} className="text-slate-400 truncate" />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
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
          const { name, position, injuryStatus } = playerLabel(playersDB, id);
          return (
            <div key={id} className="flex items-center justify-between text-sm gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <PlayerAvatar playerId={id} position={position} />
                <PlayerNameButton playerId={id} name={name} position={position} className="text-slate-400 truncate" />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
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
