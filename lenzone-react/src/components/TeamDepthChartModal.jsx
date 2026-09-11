import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useTeamDepthChart } from '../context/TeamDepthChartContext';
import { usePlayerModal } from '../context/PlayerModalContext';
import { useRosterModal } from '../context/RosterModalContext';
import { nflTeamName, nflTeamLogoUrl } from '../lib/nflTeams';
import { projectedPoints } from '../lib/players';
import { CONF_STYLES } from '../lib/theme';
import { PositionBadge, InjuryBadge, useEscapeKey } from './shared';
import { Zoomable } from '../context/ImageLightboxContext';
import { nextModalZ } from '../lib/modalStack';

const POSITION_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF"];

// Only positions this league can actually draft/roster (verified against the real Sleeper league
// settings: roster_positions is QB/RB/RB/WR/WR/TE/FLEX/FLEX/K/DEF/BN -- FLEX is RB/WR/TE
// eligibility, not its own position) -- individual O-line/defensive players aren't rosterable
// here, so they're just noise in this view.
const DRAFTABLE_POSITIONS = new Set(POSITION_ORDER);

// Sleeper's real depth_chart_position values split WRs by formation side (LWR/RWR/SWR) instead of
// a plain "WR" -- left as three separate groups they'd all sort to the bottom (alphabetically
// after QB/RB/WR/TE/K), pushing every WR out of view. They're still all just "WR" for fantasy
// purposes, so fold them into one WR group and let depth_chart_order (which is independent per
// side) interleave the starters from all three sides ahead of the backups.
const NORMALIZE_POSITION = { LWR: "WR", RWR: "WR", SWR: "WR" };

// Groups this team's roster by Sleeper's own depth_chart_position field (falling back to their
// listed position when that's missing) and sorts each group by depth_chart_order. That field is
// real but SPARSELY populated by Sleeper -- especially for offensive line and defense -- so a
// group with no order data at all just falls back to alphabetical rather than inventing a depth
// order that isn't actually known.
function buildDepthChart(playersDB, abbr) {
  const groups = {};
  for (const id in playersDB) {
    const p = playersDB[id];
    if (p.team !== abbr || !p.position) continue;
    const rawPosKey = p.depth_chart_position || p.position;
    const posKey = NORMALIZE_POSITION[rawPosKey] || rawPosKey;
    if (!DRAFTABLE_POSITIONS.has(posKey)) continue;
    if (!groups[posKey]) groups[posKey] = [];
    groups[posKey].push({ id, ...p });
  }
  Object.values(groups).forEach(list => {
    list.sort((a, b) => {
      const ao = a.depth_chart_order, bo = b.depth_chart_order;
      if (ao != null && bo != null && ao !== bo) return ao - bo;
      if (ao != null && bo == null) return -1;
      if (ao == null && bo != null) return 1;
      return (a.last_name || '').localeCompare(b.last_name || '');
    });
  });
  const orderedKeys = Object.keys(groups).sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a), bi = POSITION_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return orderedKeys.map(key => ({ position: key, players: groups[key] }));
}

export default function TeamDepthChartModal({ playersDB, afcOwners, nfcOwners, weekProjections, selectedWeek }) {
  const { target, closeTeamDepthChart } = useTeamDepthChart();
  const { openPlayer } = usePlayerModal();
  const { openRoster } = useRosterModal();
  useEscapeKey(closeTeamDepthChart);

  const groups = useMemo(() => (target && playersDB ? buildDepthChart(playersDB, target) : []), [target, playersDB]);

  // Claims a fresh top-of-stack z-index each time this modal opens, so it always renders above
  // whatever else was already open (e.g. opened from inside a player card) rather than the two
  // fighting over the same fixed z-index by DOM order alone.
  const [z, setZ] = useState(60);
  useEffect(() => { if (target) setZ(nextModalZ()); }, [target]);

  if (!target) return null;

  return (
    <div className="fixed inset-0 bg-[var(--bg)]/80 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: z }} onClick={closeTeamDepthChart}>
      <div
        className="bg-[var(--surface)]/95 border border-[var(--border)]/80 rounded-xl p-6 w-full max-w-lg shadow-2xl relative max-h-[80vh] overflow-y-auto scroll-thin"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${nflTeamName(target)} depth chart`}
      >
        <button onClick={closeTeamDepthChart} aria-label="Close" className="absolute top-3 right-3 text-[var(--muted)] hover:text-[var(--text)]">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <Zoomable src={nflTeamLogoUrl(target)} alt={target} className="w-14 h-14 object-contain shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-[var(--text)] truncate">{nflTeamName(target)}</h2>
            <p className="text-[10px] text-[var(--muted)]">Depth chart &middot; Week {selectedWeek} projections</p>
          </div>
        </div>

        <p className="text-[10px] text-[var(--muted)] italic mb-3">
          Only positions this league actually drafts (QB/RB/WR/TE/K/DEF). Depth order comes straight from Sleeper -- some players don't have one on file, so those are just listed alphabetically instead of a guessed order.
        </p>

        <div className="space-y-4">
          {groups.map(({ position, players }) => (
            <div key={position}>
              <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] mb-1.5">{position}</p>
              <div className="space-y-1">
                {players.map((p, i) => {
                  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.id;
                  const afcOwner = afcOwners?.[p.id] || null;
                  const nfcOwner = nfcOwners?.[p.id] || null;
                  const proj = projectedPoints(weekProjections, p.id, null, null);
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-[var(--border)]/40 last:border-0">
                      <span className="text-[10px] font-mono text-[var(--muted)] w-4 shrink-0">{p.depth_chart_order || i + 1}</span>
                      <button
                        type="button"
                        onClick={() => openPlayer(p.id, p.position)}
                        className="font-semibold text-[var(--accent)] hover:text-[var(--accent-ink)] truncate min-w-0 text-left"
                      >
                        {name}
                      </button>
                      <PositionBadge position={p.position} />
                      <InjuryBadge status={p.injury_status} />
                      <div className="ml-auto flex flex-col items-end gap-0.5 shrink-0 max-w-[45%]">
                        {afcOwner ? (
                          <button
                            type="button"
                            onClick={() => openRoster(afcOwner, 'AFC')}
                            className={`text-[10px] font-semibold truncate max-w-full hover:brightness-125 ${CONF_STYLES.AFC.text}`}
                            title={`${afcOwner} (AFC)`}
                          >
                            AFC &middot; {afcOwner}
                          </button>
                        ) : (
                          <span className="text-[10px] text-[var(--muted)] italic">AFC &middot; Unowned</span>
                        )}
                        {nfcOwner ? (
                          <button
                            type="button"
                            onClick={() => openRoster(nfcOwner, 'NFC')}
                            className={`text-[10px] font-semibold truncate max-w-full hover:brightness-125 ${CONF_STYLES.NFC.text}`}
                            title={`${nfcOwner} (NFC)`}
                          >
                            NFC &middot; {nfcOwner}
                          </button>
                        ) : (
                          <span className="text-[10px] text-[var(--muted)] italic">NFC &middot; Unowned</span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-[var(--proj)] shrink-0 w-12 text-right">
                        {proj != null ? `${proj.toFixed(1)}` : "--"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="text-sm text-[var(--muted)] italic">No roster data available for this team.</p>
          )}
        </div>
      </div>
    </div>
  );
}
