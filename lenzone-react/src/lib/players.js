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

// Live-blended team total for a week in progress: per starter, use the real live stat Sleeper has
// already posted for them if nonzero, else fall back to their pregame projection -- same per-player
// fallback already used in the roster-compare expander, just summed to a team total. Also returns
// lockedFraction: the share of the blended total that's already "real" (game started/finished for
// that player), used to shrink win-probability variance as the week plays out.
export function computeBlendedRosterScore(snapshot, weekProjections, scoringSettings, fallbackField) {
  if (!snapshot || !snapshot.starters) return null;
  let total = 0;
  let lockedTotal = 0;
  let any = false;
  snapshot.starters.forEach((id, i) => {
    if (!id || id === '0') return;
    const real = snapshot.startersPoints?.[i];
    const proj = projectedPoints(weekProjections, id, scoringSettings, fallbackField);
    if (real > 0) {
      total += real;
      lockedTotal += real;
      any = true;
    } else if (proj !== null) {
      total += proj;
      any = true;
    }
  });
  if (!any) return null;
  return { total, lockedFraction: total > 0 ? lockedTotal / total : 0 };
}

// Team-level rollup used by both the Rosters tab card (per-team total) and its sort control:
// full-squad pregame projected total, plus the real posted total for whichever starters already
// have one (and that same subset's projection, for a fair posted-vs-projected delta).
export function computeTeamWeeklyTotals(starters, weekProjections, scoringSettings, fallbackField, playersPoints) {
  const validStarters = (starters || []).filter(id => id && id !== '0');
  let projectedAll = 0, anyProj = false;
  let actualPosted = 0, projectedPosted = 0, anyPosted = false;
  validStarters.forEach(id => {
    const proj = weekProjections ? projectedPoints(weekProjections, id, scoringSettings, fallbackField) : null;
    if (proj !== null) { projectedAll += proj; anyProj = true; }
    const real = playersPoints?.[id];
    if (real > 0) {
      actualPosted += real;
      if (proj !== null) projectedPosted += proj;
      anyPosted = true;
    }
  });
  return {
    projectedAll: anyProj ? projectedAll : null,
    actualPosted: anyPosted ? actualPosted : null,
    projectedPosted
  };
}

// Real move count per manager: one count per completed transaction they're party to (waiver claim,
// free-agent add, drop, or trade) -- sourced directly from Sleeper's transaction log, not inferred.
function computeMoveCounts(transactions, rosterIdMap) {
  const counts = {};
  transactions.filter(t => t.status === 'complete').forEach(t => {
    const rosterIds = new Set([...Object.values(t.adds || {}), ...Object.values(t.drops || {})]);
    rosterIds.forEach(rosterId => {
      const manager = rosterIdMap[rosterId];
      if (!manager) return;
      counts[manager] = (counts[manager] || 0) + 1;
    });
  });
  return counts;
}

function buildOwnerMap(rosters) {
  const map = {};
  rosters.forEach(r => {
    r.players.forEach(id => { map[id] = r.manager; });
  });
  return map;
}

// Draft record for every drafted player, keyed by player_id -- includes which manager drafted them.
function buildDraftMap(draft, rosterIdMap) {
  const map = {};
  (draft?.picks || []).forEach(p => {
    if (p.player_id) map[p.player_id] = {
      round: p.round, pickInRound: p.pick_no - (p.round - 1) * 12, overall: p.pick_no,
      manager: rosterIdMap[p.roster_id]
    };
  });
  return map;
}

// Full chronological movement history for every player: draft pick, every subsequent waiver/FA/
// trade add, and every drop -- all real Sleeper transaction data, not just the latest event.
// Each event names the manager who made that specific move (the CURRENT owner is tracked
// separately via buildOwnerMap -- this is the move log, not a claim about who owns them now).
function buildAcquisitionHistory(draft, transactions, rosterIdMap) {
  const history = {};
  const push = (id, event) => { if (!history[id]) history[id] = []; history[id].push(event); };

  const draftMap = buildDraftMap(draft, rosterIdMap);
  Object.entries(draftMap).forEach(([id, d]) => {
    const who = d.manager ? ` — ${d.manager}` : '';
    push(id, { label: `Draft #${d.overall} (${d.round}.${d.pickInRound})${who}`, sortValue: d.overall, timestamp: -1 });
  });

  const sorted = [...transactions].filter(t => t.status === 'complete').sort((a, b) => (a.created || 0) - (b.created || 0));
  sorted.forEach(t => {
    const dateStr = t.created ? new Date(t.created).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : '';
    const sortValue = 1000 + (t.created || 0) / 1e10;
    if (t.adds) {
      Object.entries(t.adds).forEach(([playerId, rosterId]) => {
        const manager = rosterIdMap[rosterId];
        if (!manager) return;
        const label = t.type === 'trade' ? `Trade (${dateStr}) — ${manager}`
          : t.type === 'waiver' ? `Waiver (${dateStr}, $${t.settings?.waiver_bid ?? 0}) — ${manager}`
          : `FA Add (${dateStr}, $${t.settings?.waiver_bid ?? 0}) — ${manager}`;
        push(playerId, { label, sortValue, timestamp: t.created || 0 });
      });
    }
    if (t.drops) {
      Object.entries(t.drops).forEach(([playerId, rosterId]) => {
        const manager = rosterIdMap[rosterId];
        if (!manager) return;
        push(playerId, { label: `Dropped (${dateStr}) — ${manager}`, sortValue, timestamp: t.created || 0 });
      });
    }
  });

  Object.values(history).forEach(events => events.sort((a, b) => a.timestamp - b.timestamp));
  return history;
}

export { buildOwnerMap, buildAcquisitionHistory, computeMoveCounts };
