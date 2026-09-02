export function playerLabel(playersDB, id) {
  const p = playersDB[id];
  if (!p) return { name: `Player ${id}`, position: null, team: null, injuryStatus: null, depthChart: null, number: null };
  const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || id;
  return {
    name,
    position: p.position || null,
    team: p.team || null,
    // Sleeper's real injury_status field: "Questionable", "Doubtful", "Out", "IR", "PUP", "Suspended", or null (no listed issue)
    injuryStatus: p.injury_status || null,
    // Sleeper's real depth_chart_position/depth_chart_order fields, e.g. "RB" + 2 -> "RB2"
    depthChart: (p.depth_chart_position && p.depth_chart_order) ? `${p.depth_chart_position}${p.depth_chart_order}` : null,
    number: p.number ?? null
  };
}

// Sleeper's roster_positions includes each starting slot in order, plus "BN"/"IR" entries.
// Zipping the starters array against just the starting slots (in order) gives each starter's slot label.
export function getStartingSlots(rosterPositions) {
  return (rosterPositions || []).filter(p => p !== 'BN' && p !== 'IR');
}

// Which Sleeper projection stat field matches this league's actual reception scoring
// (fallback only -- used when a custom per-stat computation below isn't possible).
export function scoringFieldFor(receptionPoints) {
  if (receptionPoints >= 1) return 'pts_ppr';
  if (receptionPoints > 0) return 'pts_half_ppr';
  return 'pts_std';
}

// Sleeper's projections include real per-category stat projections (pass_yd, rec, rush_td, etc,
// including probability-weighted bonus_* fields). Dot-producting those against this league's own
// scoring_settings gives a projection tuned to this league's exact rules, not a generic PPR bucket.
export function computeCustomProjectedPoints(stats, scoringSettings) {
  if (!stats || !scoringSettings) return null;
  let total = 0;
  let matched = false;
  Object.entries(scoringSettings).forEach(([key, weight]) => {
    if (typeof weight !== 'number') return;
    const statVal = stats[key];
    if (typeof statVal === 'number') {
      total += statVal * weight;
      matched = true;
    }
  });
  return matched ? total : null;
}

export function projectedPoints(weekProjections, id, scoringSettings, fallbackField) {
  const stats = weekProjections?.[id];
  if (!stats) return null;
  const custom = computeCustomProjectedPoints(stats, scoringSettings);
  if (custom !== null) return custom;
  const val = stats[fallbackField] ?? stats.pts_ppr ?? stats.pts_half_ppr ?? stats.pts_std;
  return typeof val === 'number' ? val : null;
}

// Sums a roster's real starter-slot projections for a given week -- the pregame team total,
// computed with this league's own scoring rules, used before any real scoring history exists.
export function computeRosterProjection(roster, weekProjections, scoringSettings, fallbackField) {
  if (!roster) return null;
  const starters = roster.starters.filter(id => id && id !== '0');
  if (starters.length === 0) return null;
  let total = 0;
  let any = false;
  starters.forEach(id => {
    const val = projectedPoints(weekProjections, id, scoringSettings, fallbackField);
    if (val !== null) { total += val; any = true; }
  });
  return any ? total : null;
}
