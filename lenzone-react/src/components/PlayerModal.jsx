import React from 'react';
import { X } from 'lucide-react';
import { usePlayerModal } from '../context/PlayerModalContext';
import { playerLabel } from '../lib/players';
import { nflTeamName, nflTeamLogoUrl } from '../lib/nflTeams';
import { PositionBadge, InjuryBadge } from './shared';

export default function PlayerModal({ playersDB }) {
  const { target, closePlayer } = usePlayerModal();
  if (!target) return null;

  const { playerId, position } = target;
  const { name, team, injuryStatus, depthChart, number } = playerLabel(playersDB, playerId);
  const isDefense = position === 'DEF';

  const bigPhotoUrl = isDefense
    ? nflTeamLogoUrl(playerId)
    : `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={closePlayer}>
      <div
        className="bg-slate-900/95 border border-slate-800/80 rounded-xl p-6 w-full max-w-sm shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={closePlayer} className="absolute top-3 right-3 text-slate-500 hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <img
            src={bigPhotoUrl}
            alt=""
            className={`w-40 h-40 object-cover bg-slate-800 mb-4 ${isDefense ? "rounded-xl object-contain p-4" : "rounded-full"}`}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h2 className="text-xl font-bold text-slate-100">{name}</h2>
          {number != null && !isDefense && <p className="text-slate-500 text-sm mb-2">#{number}</p>}

          <div className="flex items-center gap-2 mt-2 mb-3">
            <PositionBadge position={position} />
            {depthChart && (
              <span className="text-[10px] font-mono text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">{depthChart}</span>
            )}
            <InjuryBadge status={injuryStatus} />
          </div>

          {team && (
            <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/60 rounded-lg px-3 py-2">
              <img src={nflTeamLogoUrl(team)} alt="" className="w-6 h-6 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
              <span className="text-sm font-semibold text-slate-200">{nflTeamName(team)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
