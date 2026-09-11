import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { usePlayerModal } from '../context/PlayerModalContext';
import { useTeamDepthChart } from '../context/TeamDepthChartContext';
import { playerLabel, projectedPoints, scoringFieldFor } from '../lib/players';
import { nflTeamName, nflTeamLogoUrl } from '../lib/nflTeams';
import { PositionBadge, InjuryBadge, GameBadge, NflTeamTag, useEscapeKey } from './shared';
import { Zoomable } from '../context/ImageLightboxContext';
import { CONF_STYLES, SCORE_COLOR, scoreState } from '../lib/theme';
import TeamName from './TeamName';
import { nextModalZ } from '../lib/modalStack';

function ConferenceHistory({ label, badgeClass, owner, history }) {
  return (
    <div className="bg-[var(--bg)]/60 border border-[var(--border)]/60 rounded-lg p-3 text-left">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>{label}</span>
        {owner ? <TeamName manager={owner} conf={label} className="text-sm font-semibold truncate" /> : <span className="text-sm font-semibold text-[var(--text)] truncate">Unrostered</span>}
      </div>
      {history && history.length > 0 ? (
        <div className="space-y-0.5 font-mono text-xs text-[var(--text2)]">
          {history.map((e, i) => <p key={i}>{e.label}</p>)}
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)] italic">Undrafted / FA</p>
      )}
    </div>
  );
}

// AFC and NFC use the exact same real Sleeper scoring_settings in this league (verified: every
// offensive scoring category matches; only unused IDP categories differ, both 0-weighted), so a
// player's projected and actual points are the same real number regardless of which conference's
// roster they're on -- one shared table, not a duplicated one per conference.
function WeeklyScoringTable({ afcOwner, nfcOwner, afcSeason, nfcSeason, confData, weekProjectionsByWeek, seasonWeeks, playerId, team, byTeamWeek }) {
  if (!afcOwner && !nfcOwner) return null;
  const fallbackField = scoringFieldFor(confData?.receptionPoints || 0);
  const weeks = Array.from({ length: seasonWeeks }, (_, i) => i + 1);
  return (
    <div className="bg-[var(--bg)]/60 border border-[var(--border)]/60 rounded-lg p-3 text-left">
      <div className="max-h-40 overflow-y-auto scroll-thin">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="text-left font-semibold pb-1">Week</th>
              <th className="text-left font-semibold pb-1">Opp</th>
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
              const game = team ? byTeamWeek?.[team]?.[w] : null;
              const isLive = game?.state === 'in';
              const actualColor = hasActual ? SCORE_COLOR[scoreState({ hasActual: true, isLive })] : "text-[var(--muted)]";
              return (
                <tr key={w} className="border-t border-[var(--border)]/40">
                  <td className="py-1 text-[var(--muted)] font-mono">{w}</td>
                  <td className="py-1 text-[var(--muted)] font-mono">{game ? `${game.isHome ? "vs" : "@"} ${game.opponent}` : "--"}</td>
                  <td className="py-1 text-right font-mono font-semibold text-[var(--proj)]">{projected != null ? projected.toFixed(1) : "--"}</td>
                  <td className={`py-1 text-right font-mono font-semibold ${actualColor}`}>{hasActual ? actual.toFixed(1) : "--"}</td>
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
  const { openTeamDepthChart } = useTeamDepthChart();
  useEscapeKey(closePlayer);
  // Claims a fresh top-of-stack z-index each time this opens, so it renders above whatever else
  // was already open (e.g. opened from inside a depth chart or roster card) instead of the two
  // fighting over a shared fixed z-index by DOM order alone.
  const [z, setZ] = useState(60);
  useEffect(() => { if (target) setZ(nextModalZ()); }, [target]);
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
    <div className="fixed inset-0 bg-[var(--bg)]/80 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: z }} onClick={closePlayer}>
      <div
        className="bg-[var(--surface)]/95 border border-[var(--border)]/80 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto scroll-thin shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={name}
      >
        <button onClick={closePlayer} aria-label="Close" className="absolute top-3 right-3 text-[var(--muted)] hover:text-[var(--text)]">
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <Zoomable
            src={bigPhotoUrl}
            alt={name}
            className={`w-40 h-40 object-cover bg-[var(--surface2)] mb-4 ${isDefense ? "rounded-xl object-contain p-4" : "rounded-full"}`}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h2 className="text-xl font-bold text-[var(--text)]">{name}</h2>
          {number != null && !isDefense && <p className="text-[var(--muted)] text-sm mb-2">#{number}</p>}

          <div className="flex items-center gap-2 mt-2 mb-3">
            <PositionBadge position={position} />
            {team && <NflTeamTag team={team} />}
            {depthChart && (
              <span className="text-[10px] font-mono text-[var(--muted)] bg-[var(--surface2)]/60 px-1.5 py-0.5 rounded">{depthChart}</span>
            )}
            <InjuryBadge status={injuryStatus} />
          </div>
          {team && <GameBadge nflTeam={team} week={selectedWeek} byTeamWeek={byTeamWeek} />}

          {team && (
            <button
              type="button"
              onClick={() => openTeamDepthChart(team)}
              title={`View ${team} depth chart`}
              className="group flex items-center gap-2 bg-[var(--bg)]/60 hover:bg-[var(--surface2)]/80 border border-[var(--border)]/60 rounded-lg px-3 py-2 mb-4 transition-colors duration-150"
            >
              <img src={nflTeamLogoUrl(team)} alt={team} className="w-6 h-6 object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
              <span className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] group-hover:underline">{nflTeamName(team)}</span>
            </button>
          )}

          {(afcOwners || nfcOwners) && (
            <div className="w-full space-y-2 mb-4">
              <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] text-left">LENZONE History</p>
              <ConferenceHistory label="AFC" badgeClass={CONF_STYLES.AFC.badge} owner={afcOwner} history={afcHistory?.[playerId]} />
              <ConferenceHistory label="NFC" badgeClass={CONF_STYLES.NFC.badge} owner={nfcOwner} history={nfcHistory?.[playerId]} />
            </div>
          )}

          {(afcOwner || nfcOwner) && (
            <div className="w-full space-y-2">
              <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] text-left">Weekly Scoring</p>
              <WeeklyScoringTable
                afcOwner={afcOwner} nfcOwner={nfcOwner} afcSeason={afcSeason} nfcSeason={nfcSeason}
                confData={afcData || nfcData} weekProjectionsByWeek={weekProjectionsByWeek} seasonWeeks={seasonWeeks} playerId={playerId}
                team={team} byTeamWeek={byTeamWeek}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
