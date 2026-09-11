import React, { useMemo } from 'react';
import { TrendingUp, Rocket, Skull, Target } from 'lucide-react';
import { computePlayerHighlights, playerLabel } from '../lib/players';
import { usePlayerModal } from '../context/PlayerModalContext';
import { PositionBadge, NflTeamTag } from './shared';
import PlayerAvatar from './PlayerAvatar';

// Explicit sign rather than a hardcoded "+" prefix -- a hardcoded prefix reads as "+-2.97" for a
// negative value, which is exactly the kind of value this shows for a miss.
export function signed(n) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

export function PlayerCard({ icon: Icon, label, entry, playersDB, value, accent, onClick }) {
  if (!entry) return null;
  const { name, position, team, number } = playerLabel(playersDB, entry.id);
  return (
    // A real <button>, not a div -- but the avatar inside (PlayerAvatar -> Zoomable) renders its
    // OWN <button> for click-to-enlarge, and a <button> can't legally contain another <button>
    // (breaks hydration). role="button" on a div gives the same clickability/keyboard semantics
    // without that HTML nesting violation; Zoomable's own click handler already stops propagation,
    // so clicking the avatar opens the lightbox instead of also firing this card's onClick.
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      className="text-left bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4 hover:border-[var(--border2)] hover:scale-[1.01] transition-all duration-200 w-full cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">{label}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <PlayerAvatar playerId={entry.id} position={position} className="w-12 h-12" />
        <div className="min-w-0">
          <p className="font-bold text-sm text-[var(--text)] truncate">{name}</p>
          <div className="flex items-center gap-1.5 mt-1 mb-1">
            <PositionBadge position={position} />
            {team && <NflTeamTag team={team} number={number} />}
          </div>
          <p className={`text-xs font-mono ${accent}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

// Player-level "trophies" alongside the team-level WeeklyHighlights -- highest pregame projection,
// highest actual once posted, and the biggest beat/miss vs projection (a real player's own
// over/underperformance, not a fantasy team total). Shared by Home "This Week" and the Matchups
// tab's "This Week" view, same as WeeklyHighlights, so the two never drift.
export default function PlayerHighlights({ afcData, nfcData, afcSeason, nfcSeason, week, weekProjections, playersDB }) {
  const { openPlayer } = usePlayerModal();
  const highlights = useMemo(
    () => computePlayerHighlights(afcData, nfcData, afcSeason, nfcSeason, week, weekProjections),
    [afcData, nfcData, afcSeason, nfcSeason, week, weekProjections]
  );
  const { highestProjected, highestActual, biggestRiser, biggestBust } = highlights;
  if (!highestProjected && !highestActual && !biggestRiser && !biggestBust) return null;

  const openFor = (entry) => {
    const { position } = playerLabel(playersDB, entry.id);
    openPlayer(entry.id, position);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <PlayerCard
        icon={Target} label="Highest Projected" entry={highestProjected} playersDB={playersDB}
        value={highestProjected ? `${highestProjected.projected.toFixed(2)} proj` : ""}
        accent="text-[var(--proj)]" onClick={() => openFor(highestProjected)}
      />
      <PlayerCard
        icon={TrendingUp} label="Top Actual Score" entry={highestActual} playersDB={playersDB}
        value={highestActual ? `${highestActual.actual.toFixed(2)} pts` : ""}
        accent="text-[var(--pos)]" onClick={() => openFor(highestActual)}
      />
      <PlayerCard
        icon={Rocket} label="Biggest Riser" entry={biggestRiser} playersDB={playersDB}
        value={biggestRiser ? `${signed(biggestRiser.actual - biggestRiser.projected)} vs proj` : ""}
        accent="text-[var(--pos)]" onClick={() => openFor(biggestRiser)}
      />
      <PlayerCard
        icon={Skull} label="Biggest Bust" entry={biggestBust} playersDB={playersDB}
        value={biggestBust ? `${signed(biggestBust.actual - biggestBust.projected)} vs proj` : ""}
        accent="text-[var(--neg)]" onClick={() => openFor(biggestBust)}
      />
    </div>
  );
}
