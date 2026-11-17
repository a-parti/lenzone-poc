import { computeOptimalLineupPoints, projectedPoints, scoringFieldFor } from './players';

// Shared math for the "fun" visuals (Luck of the Week, Boom or Bust, Luck Meter, Season Heat Map,
// and the trade / waiver / draft / sit-start meters).
// Everything comes from real posted Sleeper scores; a team with no posted score that week is left
// out rather than guessed.

function intraOpponent(season, week, manager) {
  const pair = (season.scheduleByWeek?.[week] || []).find(([a, b]) => a === manager || b === manager);
  return pair ? (pair[0] === manager ? pair[1] : pair[0]) : null;
}

function crossOpponent(schedule, week, manager, conf) {
  const match = (schedule || []).find(m => m.week === week && (conf === 'AFC' ? m.afcTeam === manager : m.nfcTeam === manager));
  return match ? (conf === 'AFC' ? match.nfcTeam : match.afcTeam) : null;
}

const posted = (v) => (Number.isFinite(v) && v > 0 ? v : null);

// One row per team that has a posted score this week, with both opponents' scores.
export function weekTeamResults(week, afcSeason, nfcSeason, schedule, afcManagers, nfcManagers) {
  const rows = [];
  const add = (managers, conf, season, oppSeason) => managers.forEach(m => {
    const score = posted(season.scoreByWeek?.[week]?.[m]);
    if (score == null) return;
    const io = intraOpponent(season, week, m);
    const co = crossOpponent(schedule, week, m, conf);
    rows.push({
      manager: m, conf, score,
      intraOpp: io, intraOppScore: io ? posted(season.scoreByWeek?.[week]?.[io]) : null,
      crossOpp: co, crossOppScore: co ? posted(oppSeason.scoreByWeek?.[week]?.[co]) : null
    });
  });
  add(afcManagers, 'AFC', afcSeason, nfcSeason);
  add(nfcManagers, 'NFC', nfcSeason, afcSeason);
  return rows;
}

const outcome = (mine, theirs) => (theirs == null ? null : mine > theirs ? 1 : mine < theirs ? 0 : 0.5);

// Luck Meter, in standings points: actual points earned (in-conference win = 2, cross-conference
// win = 1, ties = half) vs. all-play expected points. Each game is compared against the pool its
// opponent came from: the in-conference game against everyone else in your conference, the
// cross-conference game against everyone in the other conference.
export function allPlayLuck(latestCompletedWeek, afcSeason, nfcSeason, schedule, afcManagers, nfcManagers) {
  const totals = {};
  for (let w = 1; w <= latestCompletedWeek; w++) {
    const rows = weekTeamResults(w, afcSeason, nfcSeason, schedule, afcManagers, nfcManagers);
    rows.forEach(r => {
      const shareBeaten = (pool) => (pool.length
        ? pool.reduce((s, o) => s + (r.score > o.score ? 1 : r.score === o.score ? 0.5 : 0), 0) / pool.length
        : null);
      const inConf = shareBeaten(rows.filter(o => o.conf === r.conf && o.manager !== r.manager));
      const crossConf = shareBeaten(rows.filter(o => o.conf !== r.conf));
      const t = totals[r.manager] || (totals[r.manager] = { manager: r.manager, conf: r.conf, wins: 0, games: 0, expected: 0 });
      [[outcome(r.score, r.intraOppScore), 2, inConf], [outcome(r.score, r.crossOppScore), 1, crossConf]].forEach(([result, weight, beat]) => {
        if (result == null || beat == null) return;
        t.wins += result * weight;
        t.games += 1;
        t.expected += beat * weight;
      });
    });
  }
  return Object.values(totals)
    .filter(t => t.games > 0)
    .map(t => ({ ...t, luck: t.wins - t.expected }))
    .sort((a, b) => b.luck - a.luck);
}

// Season Heat Map: each team's score every completed week, plus where it ranked across the whole
// league that week (0 = lowest, 1 = highest).
export function seasonHeat(latestCompletedWeek, afcSeason, nfcSeason, schedule, afcManagers, nfcManagers) {
  const byManager = {};
  [...afcManagers.map(m => [m, 'AFC']), ...nfcManagers.map(m => [m, 'NFC'])].forEach(([m, conf]) => {
    byManager[m] = { manager: m, conf, weeks: {} };
  });
  for (let w = 1; w <= latestCompletedWeek; w++) {
    const rows = weekTeamResults(w, afcSeason, nfcSeason, schedule, afcManagers, nfcManagers);
    const scores = rows.map(r => r.score).sort((a, b) => a - b);
    rows.forEach(r => {
      const below = scores.filter(s => s < r.score).length;
      const ties = scores.filter(s => s === r.score).length - 1;
      const pct = scores.length > 1 ? (below + ties / 2) / (scores.length - 1) : 0.5;
      byManager[r.manager].weeks[w] = {
        score: r.score, pct,
        intraWin: outcome(r.score, r.intraOppScore), crossWin: outcome(r.score, r.crossOppScore)
      };
    });
  }
  return byManager;
}


const confEntries = (afcData, nfcData, afcSeason, nfcSeason) => [
  { conf: 'AFC', data: afcData, season: afcSeason },
  { conf: 'NFC', data: nfcData, season: nfcSeason }
];

// Sit/Start accuracy: per team, points left on the bench vs. the best lineup that team's roster that
// week could have started (the roster is that week's real roster, from Sleeper's weekly snapshot).
export function sitStartAccuracy(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, playersDB) {
  if (!playersDB || !Object.keys(playersDB).length) return [];
  const rows = [];
  confEntries(afcData, nfcData, afcSeason, nfcSeason).forEach(({ conf, data, season }) => {
    (data?.rosters || []).forEach(r => {
      const t = { manager: r.manager, conf, left: 0, actual: 0, optimal: 0, weeks: 0, worst: null };
      for (let w = 1; w <= latestCompletedWeek; w++) {
        const snap = season?.rosterSnapshotByWeek?.[w]?.[r.manager];
        if (!snap?.playersPoints) continue;
        const actual = (snap.starters || []).reduce((sum, id) => sum + (snap.playersPoints[id] > 0 ? snap.playersPoints[id] : 0), 0);
        const bestPossible = computeOptimalLineupPoints(data.startingSlots, Object.keys(snap.playersPoints), snap.playersPoints, playersDB);
        if (bestPossible <= 0) continue;
        const optimal = Math.max(bestPossible, actual);
        t.actual += actual;
        t.optimal += optimal;
        t.left += optimal - actual;
        t.weeks += 1;
        if (!t.worst || optimal - actual > t.worst.left) t.worst = { week: w, left: optimal - actual };
      }
      if (t.weeks > 0) rows.push({ ...t, pct: (t.actual / t.optimal) * 100 });
    });
  });
  return rows.sort((a, b) => a.left - b.left);
}


// Points each team left on its bench, per completed week, keyed "<CONF>:<manager>" -- the same
// best-possible-lineup comparison the Sit/Start meter uses, week by week. Feeds the 🎯 perfect
// lineup and 🪑 bench blunder badges.
export function weeklyBenchPoints(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, playersDB) {
  const byWeek = {};
  if (!playersDB || !Object.keys(playersDB).length) return byWeek;
  confEntries(afcData, nfcData, afcSeason, nfcSeason).forEach(({ conf, data, season }) => {
    (data?.rosters || []).forEach(r => {
      for (let w = 1; w <= latestCompletedWeek; w++) {
        const snap = season?.rosterSnapshotByWeek?.[w]?.[r.manager];
        if (!snap?.playersPoints) continue;
        const actual = (snap.starters || []).reduce((sum, id) => sum + (snap.playersPoints[id] > 0 ? snap.playersPoints[id] : 0), 0);
        const best = computeOptimalLineupPoints(data.startingSlots, Object.keys(snap.playersPoints), snap.playersPoints, playersDB);
        if (best <= 0) continue;
        (byWeek[w] || (byWeek[w] = {}))[`${conf}:${r.manager}`] = Math.max(0, best - actual);
      }
    });
  });
  return byWeek;
}

// Season Boom or Bust: the weekly Boom or Bust card added up over the season. Each completed week,
// a team's actual score minus its pregame projection (the sum of its starters' Sleeper projections,
// scored with the league's rules). `total` = season sum; `beat` / `missed` = weeks above / below.
export function seasonVsProjection(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, projectionsByWeek) {
  const rows = [];
  confEntries(afcData, nfcData, afcSeason, nfcSeason).forEach(({ conf, data, season }) => {
    const fallback = scoringFieldFor(data?.receptionPoints);
    (data?.rosters || []).forEach(r => {
      const t = { manager: r.manager, conf, total: 0, weeks: 0, beat: 0, missed: 0, best: null, worst: null };
      for (let w = 1; w <= latestCompletedWeek; w++) {
        const snap = season?.rosterSnapshotByWeek?.[w]?.[r.manager];
        const actual = season?.scoreByWeek?.[w]?.[r.manager];
        if (!snap?.starters?.length || !(actual > 0) || !projectionsByWeek?.[w]) continue;
        let projected = 0, counted = 0;
        snap.starters.forEach(id => {
          if (!id || id === '0') return;
          const p = projectedPoints(projectionsByWeek[w], id, data.scoringSettings, fallback);
          if (Number.isFinite(p)) { projected += p; counted += 1; }
        });
        if (!counted) continue;
        const delta = actual - projected;
        t.total += delta;
        t.weeks += 1;
        if (delta >= 0) t.beat += 1; else t.missed += 1;
        if (!t.best || delta > t.best.delta) t.best = { week: w, delta };
        if (!t.worst || delta < t.worst.delta) t.worst = { week: w, delta };
      }
      if (t.weeks > 0) rows.push(t);
    });
  });
  return rows.sort((a, b) => b.total - a.total);
}

// Team Boom/Bust: a boom week is a top-25% score across the whole league that week (all 24 teams),
// a bust week a bottom-25% score -- the same "share of weeks above / below a line" idea as
// FantasyPros' boom/bust rates, applied to teams instead of players. Uses seasonHeat's percentile
// (0 = lowest score that week, 1 = highest; ties split).
export const BOOM_PCT = 0.75;
export const BUST_PCT = 0.25;
export function teamBoomBust(latestCompletedWeek, afcSeason, nfcSeason, schedule, afcManagers, nfcManagers) {
  const heat = seasonHeat(latestCompletedWeek, afcSeason, nfcSeason, schedule, afcManagers, nfcManagers);
  return Object.values(heat).map(t => {
    const weeks = Object.entries(t.weeks);
    const boomWeeks = weeks.filter(([, c]) => c.pct >= BOOM_PCT).map(([w]) => Number(w));
    const bustWeeks = weeks.filter(([, c]) => c.pct <= BUST_PCT).map(([w]) => Number(w));
    return { manager: t.manager, conf: t.conf, weeks: weeks.length, boom: boomWeeks.length, bust: bustWeeks.length, boomWeeks, bustWeeks, net: boomWeeks.length - bustWeeks.length };
  }).filter(t => t.weeks > 0).sort((a, b) => b.net - a.net || b.boom - a.boom);
}

// Shared by the trade, waiver and draft meters: points over REPLACEMENT LEVEL -- the standard
// "value over replacement" baseline trade-value tools use, where a player just outside starting
// range is worth zero. Replacement level for a position, in one conference, in one week = the score
// of the best rostered player at that position who would NOT make the cut if every team started
// its top guys: if the conference started N players at the position that week (flex usage
// included), it's the (N+1)th-best score among all rostered players there. Players who didn't play
// (0 or no score) are left out of the ranking. A replacement-level player is worth ~0, so an extra
// body thrown into a trade no longer counts against the team that receives him. Kickers and
// defenses are the exception (see STREAMED_POSITIONS): measured against that week's average starter.
const STREAMED_POSITIONS = new Set(['K', 'DEF']);
function valueTools(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, playersDB) {
  const entries = confEntries(afcData, nfcData, afcSeason, nfcSeason);
  const position = (id) => playersDB?.[id]?.position || null;
  const replacementCache = new Map();
  const replacementLevel = (season, week, pos) => {
    let byPos = replacementCache.get(season)?.[week];
    if (!byPos) {
      const started = {}, scores = {};
      Object.values(season?.rosterSnapshotByWeek?.[week] || {}).forEach(snap => {
        const starters = new Set(snap.starters || []);
        Object.entries(snap.playersPoints || {}).forEach(([id, p]) => {
          const ps = position(id);
          if (!ps) return;
          if (starters.has(id)) started[ps] = (started[ps] || 0) + 1;
          if (p > 0) (scores[ps] || (scores[ps] = [])).push(p);
        });
      });
      byPos = {};
      Object.keys(scores).forEach(ps => {
        if (STREAMED_POSITIONS.has(ps)) {
          // Nobody rosters a backup kicker/defense, so there's no (N+1)th to rank; these are
          // streamed off waivers every week, so an average starter is the freely available level.
          const startedScores = [];
          Object.values(season?.rosterSnapshotByWeek?.[week] || {}).forEach(snap => (snap.starters || []).forEach(id => {
            const p = snap.playersPoints?.[id];
            if (position(id) === ps && Number.isFinite(p)) startedScores.push(p);
          }));
          byPos[ps] = startedScores.length ? startedScores.reduce((a, b) => a + b, 0) / startedScores.length : 0;
          return;
        }
        const sorted = scores[ps].sort((a, b) => b - a);
        const n = started[ps] || 0;
        byPos[ps] = sorted.length > n ? sorted[n] : 0;
      });
      const forSeason = replacementCache.get(season) || {};
      forSeason[week] = byPos;
      replacementCache.set(season, forSeason);
    }
    return byPos[pos] ?? 0;
  };
  const nameOf = (id) => {
    const p = playersDB?.[id];
    return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || id : id;
  };

  // Points over replacement for one player on one roster, from startWeek on, counting only the
  // weeks that team STARTED him (bench points never helped anyone).
  const valueOn = (season, startWeek, id, manager) => {
    let value = 0, weeks = 0;
    for (let w = startWeek; w <= latestCompletedWeek; w++) {
      const snap = season?.rosterSnapshotByWeek?.[w]?.[manager];
      if (!snap?.starters?.includes(id)) continue;
      const pts = snap?.playersPoints?.[id];
      if (!Number.isFinite(pts)) continue;
      value += pts - replacementLevel(season, w, position(id));
      weeks += 1;
    }
    return { value, weeks };
  };
  return { entries, position, replacementLevel, nameOf, valueOn };
}

// Trade grades ("who actually won the trade?"). Few sites grade trades after the fact; the common
// tools judge a deal up front from rest-of-season values. This does both, in plain fantasy points
// anyone can check in Sleeper:
//   Lineup points since the trade -- the points the players you received scored in weeks YOU
//     STARTED them, vs. the points the players you gave up scored in weeks their new team started
//     them. Byes, injuries and duds count naturally (0 is 0); a throw-in who sits on your bench adds
//     nothing, because he didn't help you. This is the headline number and the grade.
//   Rest-of-season outlook -- Sleeper's projected points through Week 17 (fantasy playoffs
//     included, scored with your league's rules) for the received players still on your roster.
//     Shown for context; for a trade under MIN_GRADED_WEEKS old it's the only signal, so the grade
//     reads "Too early".
// Grade = the winning side's share of the lineup points both sides got from the trade.
export const TRADE_GRADES = [
  { min: 0.8, label: 'Fleece' },
  { min: 0.65, label: 'Clear win' },
  { min: 0.55, label: 'Slight edge' },
  { min: 0, label: 'Even' }
];
export const LAST_PROJECTED_WEEK = 17;
const MIN_GRADED_WEEKS = 3;
const MIN_GRADED_TRADE_POINTS = 15;
export function tradeFleece(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, afcTransactions, nfcTransactions, playersDB, projectionsByWeek = {}) {
  const entries = confEntries(afcData, nfcData, afcSeason, nfcSeason);
  const position = (id) => playersDB?.[id]?.position || null;
  const nameOf = (id) => {
    const p = playersDB?.[id];
    return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || id : id;
  };

  // Points a player scored in the weeks `manager` started him, from startWeek on.
  const startedPoints = (season, startWeek, id, manager) => {
    let points = 0, starts = 0;
    for (let w = startWeek; w <= latestCompletedWeek; w++) {
      const snap = season?.rosterSnapshotByWeek?.[w]?.[manager];
      if (!snap?.starters?.includes(id)) continue;
      const pts = snap.playersPoints?.[id];
      if (Number.isFinite(pts)) points += pts;
      starts += 1;
    }
    return { points, starts };
  };
  // Every completed week's points for a player, whoever had him (null = not on any roster in this
  // league that week), and who that was -- for the "since the trade" chart.
  const weeklyLine = (season, id) => {
    const line = [];
    for (let w = 1; w <= latestCompletedWeek; w++) {
      let entry = { week: w, points: null, manager: null, started: false };
      Object.entries(season?.rosterSnapshotByWeek?.[w] || {}).some(([manager, snap]) => {
        if (!(id in (snap.playersPoints || {}))) return false;
        entry = { week: w, points: snap.playersPoints[id] ?? 0, manager, started: (snap.starters || []).includes(id) };
        return true;
      });
      line.push(entry);
    }
    return line;
  };
  // Projected points for the rest of the season, if he's still on that roster.
  const projectedFor = (data, id, manager) => {
    const roster = (data?.rosters || []).find(r => r.manager === manager);
    if (!roster?.players?.includes(id)) return 0;
    const fallback = scoringFieldFor(data?.receptionPoints);
    let total = 0;
    for (let w = Math.max(1, latestCompletedWeek + 1); w <= LAST_PROJECTED_WEEK; w++) {
      const proj = projectedPoints(projectionsByWeek?.[w], id, data?.scoringSettings, fallback);
      if (Number.isFinite(proj)) total += proj;
    }
    return total;
  };

  const trades = [];
  entries.forEach(({ conf, data, season }, i) => {
    const transactions = i === 0 ? afcTransactions : nfcTransactions;
    (transactions || []).filter(t => t.type === 'trade' && t.status === 'complete').forEach(t => {
      const managerOf = (rid) => data.rosterIdMap?.[rid];
      const startWeek = t.leg || 1;
      const sides = (t.roster_ids || []).map(rid => {
        const manager = managerOf(rid);
        const got = Object.entries(t.adds || {}).filter(([, to]) => to === rid).map(([id]) => {
          const { points, starts } = startedPoints(season, startWeek, id, manager);
          return { id, name: nameOf(id), pos: position(id), points, starts, projected: projectedFor(data, id, manager), line: weeklyLine(season, id) };
        });
        const faab = (t.waiver_budget || []).reduce((sum, b) => sum + (b.receiver === rid ? b.amount : b.sender === rid ? -b.amount : 0), 0);
        return {
          rosterId: rid, manager, conf, got, faab,
          points: got.reduce((s, p) => s + p.points, 0),
          projected: got.reduce((s, p) => s + p.projected, 0)
        };
      }).filter(s => s.manager);
      if (sides.length < 2) return;

      const weeks = Math.max(0, latestCompletedWeek - startWeek + 1);
      const totalPoints = sides.reduce((s, x) => s + x.points, 0);
      const totalProjected = sides.reduce((s, x) => s + x.projected, 0);
      sides.forEach(s => {
        const others = sides.filter(o => o !== s);
        const avgOther = (key) => others.reduce((sum, o) => sum + o[key], 0) / others.length;
        s.net = s.points - avgOther('points');
        s.projectedNet = s.projected - avgOther('projected');
        s.share = totalPoints > 0 ? s.points / totalPoints : 1 / sides.length;
      });
      const leader = [...sides].sort((a, b) => b.points - a.points)[0];
      const share = totalPoints > 0 ? leader.points / totalPoints : 0.5;
      const projLeader = [...sides].sort((a, b) => b.projected - a.projected)[0];
      const projShare = totalProjected > 0 ? projLeader.projected / totalProjected : 0.5;
      let grade;
      if (weeks < MIN_GRADED_WEEKS) grade = 'Too early';
      else if (totalPoints < MIN_GRADED_TRADE_POINTS) grade = 'Even';
      else grade = (TRADE_GRADES.find(g => share >= g.min) || TRADE_GRADES[TRADE_GRADES.length - 1]).label;
      const winner = grade === 'Too early' || grade === 'Even' ? null : leader.manager;
      trades.push({
        id: t.transaction_id, week: startWeek, conf, created: t.created || 0, weeks, sides,
        grade, winner, share, projectedLeader: projShare >= 0.55 ? projLeader.manager : null, projShare
      });
    });
  });

  // Meter: net lineup points from trades old enough to grade.
  const byManager = {};
  trades.forEach(tr => tr.sides.forEach(s => {
    const row = byManager[s.manager] || (byManager[s.manager] = { manager: s.manager, conf: s.conf, net: 0, trades: 0, won: 0, lost: 0, early: 0 });
    row.trades += 1;
    if (tr.grade === 'Too early') { row.early += 1; return; }
    row.net += s.net;
    if (tr.winner === s.manager) row.won += 1;
    else if (tr.winner) row.lost += 1;
  }));
  return {
    byTeam: Object.values(byManager).sort((a, b) => b.net - a.net),
    trades: trades.sort((a, b) => b.created - a.created),
    latestCompletedWeek
  };
}

// Waiver Wire meter: points over replacement that each team's waiver / free-agent pickups produced
// in the weeks they were in that team's starting lineup (bench weeks and weeks on another roster
// don't count), plus FAAB spent. `perDollar` = value from the pickups you PAID for, per FAAB dollar
// (free pickups excluded, since they cost nothing); null when no FAAB has been spent.
export function waiverWire(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, afcTransactions, nfcTransactions, playersDB) {
  const { entries, position, nameOf, valueOn } = valueTools(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, playersDB);
  const byManager = {};
  [[entries[0], afcTransactions], [entries[1], nfcTransactions]].forEach(([{ conf, data, season }, transactions]) => {
    (transactions || []).filter(t => (t.type === 'waiver' || t.type === 'free_agent') && t.status === 'complete').forEach(t => {
      const bid = t.settings?.waiver_bid || 0;
      Object.entries(t.adds || {}).forEach(([id, rid]) => {
        const manager = data.rosterIdMap?.[rid];
        if (!manager) return;
        const { value, weeks } = valueOn(season, t.leg || 1, id, manager);
        const row = byManager[manager] || (byManager[manager] = { manager, conf, net: 0, faab: 0, paidValue: 0, pickups: 0, best: null });
        row.net += value;
        row.faab += bid;
        if (bid > 0) row.paidValue += value;
        row.pickups += 1;
        if (weeks > 0 && (!row.best || value > row.best.value)) row.best = { name: nameOf(id), pos: position(id), value, bid };
      });
    });
  });
  return Object.values(byManager)
    .map(r => ({ ...r, perDollar: r.faab > 0 ? r.paidValue / r.faab : null }))
    .sort((a, b) => b.net - a.net);
}

// Draft Value meter: did each pick beat what its DRAFT SLOT usually returns? A pick's raw value is
// its points over replacement in the weeks the drafting team started him (never started = 0). The
// slot's expected value is the average raw value of the picks made within DRAFT_SLOT_WINDOW picks
// of that overall pick number in BOTH leagues' drafts (so pick 3 is judged against picks 1-9, not
// against the whole first round). A pick's score is raw value minus that expectation: a 3rd overall
// pick who plays like a 3rd overall pick scores ~0, and a late-round hit scores high.
const DRAFT_SLOT_WINDOW = 6;
export function draftValue(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, afcDraft, nfcDraft, playersDB) {
  const { entries, position, nameOf, valueOn } = valueTools(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, playersDB);
  const raw = [];
  [[entries[0], afcDraft], [entries[1], nfcDraft]].forEach(([{ conf, data, season }, draft]) => {
    (draft?.picks || []).forEach(pk => {
      const manager = data.rosterIdMap?.[pk.roster_id];
      if (!manager || !pk.player_id) return;
      const { value, weeks } = valueOn(season, 1, pk.player_id, manager);
      raw.push({ manager, conf, round: pk.round, pickNo: pk.pick_no, playerId: pk.player_id, name: nameOf(pk.player_id), pos: position(pk.player_id), raw: value, weeks });
    });
  });
  const expectedAt = (pickNo) => {
    const near = raw.filter(p => Math.abs(p.pickNo - pickNo) <= DRAFT_SLOT_WINDOW);
    return near.length ? near.reduce((s, p) => s + p.raw, 0) / near.length : 0;
  };
  const picks = raw.map(p => { const expected = expectedAt(p.pickNo); return { ...p, expected, value: p.raw - expected }; });

  const byManager = {};
  picks.forEach(pick => {
    const row = byManager[pick.manager] || (byManager[pick.manager] = { manager: pick.manager, conf: pick.conf, net: 0, picks: 0, best: null });
    row.net += pick.value;
    row.picks += 1;
    if (!row.best || pick.value > row.best.value) row.best = pick;
  });
  // The same player can be drafted once in each conference; list him once with every drafter
  // (his value is the better of his two picks, since each drafter's result can differ).
  const byPlayer = {};
  picks.forEach(pk => {
    const row = byPlayer[pk.playerId] || (byPlayer[pk.playerId] = { playerId: pk.playerId, name: pk.name, pos: pk.pos, value: -Infinity, drafters: [] });
    row.value = Math.max(row.value, pk.value);
    row.drafters.push({ manager: pk.manager, conf: pk.conf, round: pk.round, pickNo: pk.pickNo, value: pk.value });
  });
  const sorted = Object.values(byPlayer).sort((a, b) => b.value - a.value);
  return {
    byTeam: Object.values(byManager).sort((a, b) => b.net - a.net),
    best: sorted.slice(0, 5),
    worst: sorted.slice(-5).reverse()
  };
}
