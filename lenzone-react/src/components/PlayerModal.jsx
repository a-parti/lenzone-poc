import React from 'react';
import { X } from 'lucide-react';
import { usePlayerModal } from '../context/PlayerModalContext';
import { playerLabel, projectedPoints, scoringFieldFor } from '../lib/players';
import { nflTeamName, nflTeamLogoUrl } from '../lib/nflTeams';
import { PositionBadge, InjuryBadge, GameBadge } from './shared';
import TeamName from './TeamName';

function ConferenceHistory({ label, badgeClass, owner, history }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-3 text-left">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>{label}</span>
        {owner ? <TeamName manager={owner} conf={label} className="text-sm font-semibold truncate" /> : <span className="text-sm font-semibold text-slate-200 truncate">Unrostered</span>}
      </div>
      {history && history.length > 0 ? (
        <div className="space-y-0.5 font-mono text-xs text-slate-400">
          {history.map((e, i) => <p key={i}>{e.label}</p>)}
        </div>
      ) : (
        <p className="text-xs text-slate-600 italic">Undrafted / FA</p>
      )}
    </div>
  );
}

// AFC and NFC use the exact same real Sleeper scoring_settings in this league (verified: every
// offensive scoring category matches; only unused IDP categories differ, both 0-weighted), so a
// player's projected and actual points are the same real number regardless of which conference's
// roster they're on -- one shared table, not a duplicated one per conference.
function WeeklyScoringTable({ afcOwner, nfcOwner, afcSeason, nfcSeason, confData, weekProjectionsByWeek, seasonWeeks, playerId }) {
  if (!afcOwner && !nfcOwner) return null;
  const fallbackField = scoringFieldFor(confData?.receptionPoints || 0);
  const weeks = Array.from({ length: seasonWeeks }, (_, i) => i + 1);
  return (
    <div className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-3 text-left">
      <div className="max-h-40 overflow-y-auto scroll-thin">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left font-semibold pb-1">Week</th>
              <th className="text-right font-semibold pb-1">Projected</th>
              <th className="text-right font-semibold pb-1">Actual</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map(w => {
              const afcSnap = afcOwner ? afcSeason?.rosterSnapshotByWeek?.[w]?.[afcOwner] : null;
              const nfcSnap = nfcOwner ? nfcSeason?.rosterSnapshotByWeek?.[w]?.[nfcOwner] : null;
              const actual = afcSnap?.playersPoints?.[playerId] ?? nfcSnap?.playersPoints?.[playerId];
              const hasActual = actual > 0;
              const projected = projectedPoints(weekProjectionsByWeek?.[w], playerId, confData?.scoringSettings, fallbackField);
              return (
                <tr key={w} className="border-t border-slate-800/40">
                  <td className="py-1 text-slate-500 font-mono">{w}</td>
                  <td className="py-1 text-right font-mono text-blue-300">{projected != null ? projected.toFixed(1) : "--"}</td>
                  <td className={`py-1 text-right font-mono ${hasActual ? "text-emerald-400" : "text-slate-600"}`}>{hasActual ? actual.toFixed(1) : "--"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PlayerModal({
  playersDB, afcOwners, nfcOwners, afcHistory, nfcHistory,
  selectedWeek, weekProjectionsByWeek, seasonWeeks, latestCompletedWeek, afcSeason, nfcSeason, afcData, nfcData, byTeamWeek
}) {
  const { target, closePlayer } = usePlayerModal();
  if (!target) return null;

  const { playerId, position } = target;
  const { name, team, injuryStatus, depthChart, number } = playerLabel(playersDB, playerId);
  const isDefense = position === 'DEF';

  const afcOwner = afcOwners?.[playerId];
  const nfcOwner = nfcOwners?.[playerId];

  const bigPhotoUrl = isDefense
    ? nflTeamLogoUrl(playerId)
    : `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={closePlayer}>
      <div
        className="bg-slate-900/95 border border-slate-800/80 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto scroll-thin shadow-2xl relative"
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
          {team && <GameBadge nflTeam={team} week={selectedWeek} byTeamWeek={byTeamWeek} />}

          {team && (
            <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/60 rounded-lg px-3 py-2 mb-4">
              <img src={nflTeamLogoUrl(team)} alt="" className="w-6 h-6 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
              <span className="text-sm font-semibold text-slate-200">{nflTeamName(team)}</span>
            </div>
          )}

          {(afcOwners || nfcOwners) && (
            <div className="w-full space-y-2 mb-4">
              <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 text-left">LENZONE History</p>
              <ConferenceHistory label="AFC" badgeClass="bg-blue-500/10 text-blue-400" owner={afcOwner} history={afcHistory?.[playerId]} />
              <ConferenceHistory label="NFC" badgeClass="bg-rose-500/10 text-rose-400" owner={nfcOwner} history={nfcHistory?.[playerId]} />
            </div>
          )}

          {(afcOwner || nfcOwner) && (
            <div className="w-full space-y-2">
              <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 text-left">Weekly Scoring</p>
              <WeeklyScoringTable
                afcOwner={afcOwner} nfcOwner={nfcOwner} afcSeason={afcSeason} nfcSeason={nfcSeason}
                confData={afcData || nfcData} weekProjectionsByWeek={weekProjectionsByWeek} seasonWeeks={seasonWeeks} playerId={playerId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
