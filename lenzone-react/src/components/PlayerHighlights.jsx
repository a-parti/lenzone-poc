import React from 'react';
import { playerLabel } from '../lib/players';
import { PositionBadge, NflTeamTag } from './shared';
import PlayerAvatar from './PlayerAvatar';

// On a phone a run of trophy cards becomes one sideways-swipe row instead of a long stack of
// full-width cards; from sm up it is the usual grid. -mx-4/px-4 lets the row run to the screen edge
// past the page gutter.
export const SWIPE_ROW = "-mx-4 px-4 scroll-px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none [scrollbar-width:none] pb-1 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:overflow-visible";
export const SWIPE_ITEM = "w-[15rem] shrink-0 snap-start sm:w-full";

// Explicit sign rather than a hardcoded "+" prefix -- a hardcoded prefix reads as "+-2.97" for a
// negative value, which is exactly the kind of value this shows for a miss.
export function signed(n) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

// Renders the actual score big, with its own pregame projection as a small caption underneath --
// same "actual is the real number, projection is a reference point" convention already used in
// ManagerMatchupRow/MatchupPill, so a riser/bust/top-score card shows what actually happened AND
// what was expected in one glance, not just the computed diff.
export function ActualVsProjected({ actual, projected, accent }) {
  return (
    <span className="flex flex-col leading-tight">
      {actual != null && <span className={`text-sm font-mono font-bold ${accent}`}>{actual.toFixed(2)} pts</span>}
      {projected != null && <span className="text-[10px] font-mono text-[var(--proj)]">{projected.toFixed(2)} proj</span>}
    </span>
  );
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
      className={`text-left bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4 hover:border-[var(--border2)] hover:scale-[1.01] transition-all duration-200 ${SWIPE_ITEM} cursor-pointer`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">{label}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <PlayerAvatar playerId={entry.id} position={position} className="w-12 h-12" />
        <div className="min-w-0">
          {/* line-clamp-2 (not truncate) -- long player names shouldn't get chopped off with an
              ellipsis; wrapping to a second line reads better than losing part of the name. */}
          <p className="font-bold text-sm text-[var(--text)] leading-snug line-clamp-2">{name}</p>
          <div className="flex items-center gap-1.5 mt-1 mb-1">
            <PositionBadge position={position} />
            {team && <NflTeamTag team={team} number={number} />}
          </div>
          {typeof value === 'string' ? <p className={`text-xs font-mono ${accent}`}>{value}</p> : value}
        </div>
      </div>
    </div>
  );
}

