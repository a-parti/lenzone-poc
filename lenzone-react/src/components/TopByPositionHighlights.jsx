import React, { useMemo } from 'react';
import { computeTopByPosition, playerLabel } from '../lib/players';
import { usePlayerModal } from '../context/PlayerModalContext';
import { PositionBadge, NflTeamTag } from './shared';
import PlayerAvatar from './PlayerAvatar';

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

// One card per position, each holding its own top-5 leaderboard for the week -- same card chrome
// as WeeklyHighlights/PlayerHighlights, but a list inside instead of a single entry. Real points
// only (computeTopByPosition already filters to players who've actually posted a score), across
// every ROSTERED player in the league regardless of whether they were started -- a positional
// leaderboard is about who actually balled out at that position, not who helped a fantasy team.
export default function TopByPositionHighlights({ afcData, nfcData, afcSeason, nfcSeason, week, playersDB }) {
  const { openPlayer } = usePlayerModal();
  const byPosition = useMemo(
    () => computeTopByPosition(afcData, nfcData, afcSeason, nfcSeason, week, playersDB),
    [afcData, nfcData, afcSeason, nfcSeason, week, playersDB]
  );
  const activePositions = POSITION_ORDER.filter(pos => byPosition[pos]?.length > 0);
  if (activePositions.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">Top Performers by Position</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {activePositions.map(pos => (
          <div key={pos} className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <PositionBadge position={pos} />
              <span className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Top {byPosition[pos].length} {pos}</span>
              {byPosition[pos].length > 5 && (
                <span className="text-[9px] text-[var(--muted)] italic ml-auto">scroll for more</span>
              )}
            </div>
            {/* Card shows ~5 rows at a time -- the other 5 (of up to 10) are a scroll away inside
                the card instead of growing every card's height to fit the longest list. */}
            <div className="space-y-1 max-h-[15.5rem] overflow-y-auto scroll-thin pr-1">
              {byPosition[pos].map((entry, i) => {
                const { name, team, number } = playerLabel(playersDB, entry.id);
                return (
                  // A real <div role="button">, not <button> -- PlayerAvatar renders its own
                  // <button> (Zoomable's click-to-enlarge), which can't legally nest inside
                  // another <button> (breaks hydration). Zoomable's click handler already stops
                  // propagation, so clicking the avatar opens the lightbox, not the player modal.
                  <div
                    key={entry.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openPlayer(entry.id, pos)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlayer(entry.id, pos); } }}
                    className="w-full flex items-center gap-2 text-left hover:bg-[var(--surface2)]/40 rounded-lg p-1 -mx-1 transition-all duration-150 cursor-pointer"
                  >
                    <span className="text-xs font-mono text-[var(--muted)] w-4 shrink-0 text-center">{i + 1}</span>
                    <PlayerAvatar playerId={entry.id} position={pos} className="w-9 h-9 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-[var(--text)] leading-snug line-clamp-2">{name}</p>
                      {team && <NflTeamTag team={team} number={number} />}
                    </div>
                    <span className="text-sm font-mono font-bold text-[var(--pos)] shrink-0">{entry.points.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
