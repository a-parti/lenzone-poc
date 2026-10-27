import { computeOptimalLineupPoints, projectedPoints, scoringFieldFor } from './players';

// Shared math for the "fun" visuals (Luck of the Week, Boom or Bust, Luck Meter, Season Heat Map).
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

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

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


// Boom/Bust for started players: each started player-week's actual points minus Sleeper's projection
// (scored with the league's own rules). Boom pts = total points above projection, bust pts = total below.
export function playerBoomBust(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, projectionsByWeek) {
  const rows = [];
  confEntries(afcData, nfcData, afcSeason, nfcSeason).forEach(({ conf, data, season }) => {
    const fallback = scoringFieldFor(data?.receptionPoints);
    (data?.rosters || []).forEach(r => {
      const t = { manager: r.manager, conf, n: 0, sum: 0, boomPts: 0, bustPts: 0 };
      for (let w = 1; w <= latestCompletedWeek; w++) {
        const snap = season?.rosterSnapshotByWeek?.[w]?.[r.manager];
        if (!snap?.playersPoints) continue;
        (snap.starters || []).forEach(id => {
          if (!id || id === '0') return;
          const proj = projectedPoints(projectionsByWeek?.[w], id, data.scoringSettings, fallback);
          const actual = snap.playersPoints[id];
          if (proj == null || proj <= 0 || !Number.isFinite(actual)) return;
          const delta = actual - proj;
          t.n += 1;
          t.sum += delta;
          if (delta > 0) t.boomPts += delta;
          else t.bustPts += delta;
        });
      }
      if (t.n > 0) rows.push({ ...t, avg: t.sum / t.n });
    });
  });
  return rows.sort((a, b) => b.avg - a.avg);
}

// Shared by the trade, waiver and draft meters: points over the weekly position median.
function valueTools(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, playersDB) {
  const entries = confEntries(afcData, nfcData, afcSeason, nfcSeason);
  const position = (id) => playersDB?.[id]?.position || null;
  const medianCache = {};
  const positionMedian = (week, pos) => {
    const key = `${week}|${pos}`;
    if (key in medianCache) return medianCache[key];
    const pts = [];
    entries.forEach(({ season }) => Object.values(season?.rosterSnapshotByWeek?.[week] || {}).forEach(snap => {
      Object.entries(snap.playersPoints || {}).forEach(([id, p]) => { if (p > 0 && position(id) === pos) pts.push(p); });
    }));
    return (medianCache[key] = median(pts));
  };
  const nameOf = (id) => {
    const p = playersDB?.[id];
    return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || id : id;
  };

  // Points over the position median for one player on one roster across the weeks he was there.
  const valueOn = (season, startWeek, id, manager, startedOnly = false) => {
    let value = 0, weeks = 0;
    for (let w = startWeek; w <= latestCompletedWeek; w++) {
      const snap = season?.rosterSnapshotByWeek?.[w]?.[manager];
      if (startedOnly && !snap?.starters?.includes(id)) continue;
      const pts = snap?.playersPoints?.[id];
      if (!Number.isFinite(pts)) continue;
      value += pts - positionMedian(w, position(id));
      weeks += 1;
    }
    return { value, weeks };
  };
  return { entries, position, positionMedian, nameOf, valueOn };
}

// Fleece meter: for every completed trade, the points each side got from the players it received
// (while those players sat on its roster, from the trade week on) minus what the players it gave up
// produced for their new teams, both measured against that week's median score for the player's
// position among all rostered players. Redraft league: players only, no picks.
export function tradeFleece(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, afcTransactions, nfcTransactions, playersDB) {
  const { entries, position, nameOf, valueOn } = valueTools(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, playersDB);

  // What a FAAB dollar is worth in this league: points over the position median that winning waiver
  // claims produced, per dollar bid. Never below zero, so FAAB can't count as a gain just because
  // pickups have so far underperformed the median.
  let claimValue = 0, claimBid = 0;
  [[entries[0], afcTransactions], [entries[1], nfcTransactions]].forEach(([{ data, season }, transactions]) => {
    (transactions || []).filter(t => t.type === 'waiver' && t.status === 'complete').forEach(t => {
      const bid = t.settings?.waiver_bid || 0;
      if (bid <= 0) return;
      Object.entries(t.adds || {}).forEach(([id, rid]) => {
        const manager = data.rosterIdMap?.[rid];
        if (!manager) return;
        claimBid += bid;
        claimValue += valueOn(season, t.leg || 1, id, manager).value;
      });
    });
  });
  const faabRate = claimBid > 0 ? Math.max(0, claimValue / claimBid) : 0;
  const trades = [];
  [[entries[0], afcTransactions], [entries[1], nfcTransactions]].forEach(([{ conf, data, season }, transactions]) => {
    (transactions || []).filter(t => t.type === 'trade' && t.status === 'complete').forEach(t => {
      const rosterIds = t.roster_ids || [];
      const managerOf = (rid) => data.rosterIdMap?.[rid];
      const startWeek = t.leg || 1;
      const valueOnRoster = (id, manager) => valueOn(season, startWeek, id, manager);
      const sides = rosterIds.map(rid => {
        const manager = managerOf(rid);
        const got = Object.entries(t.adds || {}).filter(([, to]) => to === rid).map(([id]) => ({ id, name: nameOf(id), pos: position(id), ...valueOnRoster(id, manager) }));
        const gave = Object.entries(t.drops || {}).filter(([, from]) => from === rid).map(([id]) => {
          const newOwner = managerOf((t.adds || {})[id]);
          return { id, name: nameOf(id), pos: position(id), ...(newOwner ? valueOnRoster(id, newOwner) : { value: 0, weeks: 0 }) };
        });
        const faab = (t.waiver_budget || []).reduce((sum, b) => sum + (b.receiver === rid ? b.amount : b.sender === rid ? -b.amount : 0), 0);
        const gotValue = got.reduce((s, p) => s + p.value, 0);
        const gaveValue = gave.reduce((s, p) => s + p.value, 0);
        const faabValue = faab * faabRate;
        return { rosterId: rid, manager, conf, got, gave, faab, faabValue, gotValue, gaveValue, net: gotValue - gaveValue + faabValue };
      }).filter(s => s.manager);
      if (sides.length < 2) return;
      const weeks = Math.max(0, ...sides.flatMap(s => [...s.got, ...s.gave].map(p => p.weeks)));
      trades.push({ id: t.transaction_id, week: startWeek, conf, created: t.created || 0, weeks, sides });
    });
  });

  const byManager = {};
  trades.forEach(tr => tr.sides.forEach(s => {
    const row = byManager[s.manager] || (byManager[s.manager] = { manager: s.manager, conf: s.conf, net: 0, trades: 0, weeks: 0 });
    row.net += s.net;
    row.trades += 1;
    row.weeks += tr.weeks;
  }));
  return {
    byTeam: Object.values(byManager).sort((a, b) => b.net - a.net),
    trades: trades.sort((a, b) => b.created - a.created),
    faabRate,
    claimBid,
    claimValue
  };
}

// Waiver Wire meter: points over the position median that each team's waiver / free-agent pickups
// produced in the weeks they were in that team's starting lineup (bench weeks and weeks on another
// roster don't count), plus FAAB spent.
export function waiverWire(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, afcTransactions, nfcTransactions, playersDB) {
  const { entries, position, nameOf, valueOn } = valueTools(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, playersDB);
  const byManager = {};
  [[entries[0], afcTransactions], [entries[1], nfcTransactions]].forEach(([{ conf, data, season }, transactions]) => {
    (transactions || []).filter(t => (t.type === 'waiver' || t.type === 'free_agent') && t.status === 'complete').forEach(t => {
      const bid = t.settings?.waiver_bid || 0;
      Object.entries(t.adds || {}).forEach(([id, rid]) => {
        const manager = data.rosterIdMap?.[rid];
        if (!manager) return;
        const { value, weeks } = valueOn(season, t.leg || 1, id, manager, true);
        const row = byManager[manager] || (byManager[manager] = { manager, conf, net: 0, faab: 0, pickups: 0, best: null });
        row.net += value;
        row.faab += bid;
        row.pickups += 1;
        if (weeks > 0 && (!row.best || value > row.best.value)) row.best = { name: nameOf(id), pos: position(id), value };
      });
    });
  });
  return Object.values(byManager).sort((a, b) => b.net - a.net);
}

// Draft Value meter: each pick's points over the position median in the weeks the drafting team
// started him (bench weeks and weeks on another roster don't count).
export function draftValue(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, afcDraft, nfcDraft, playersDB) {
  const { entries, position, positionMedian, nameOf } = valueTools(latestCompletedWeek, afcData, nfcData, afcSeason, nfcSeason, playersDB);
  const byManager = {};
  const picks = [];
  [[entries[0], afcDraft], [entries[1], nfcDraft]].forEach(([{ conf, data, season }, draft]) => {
    (draft?.picks || []).forEach(pk => {
      const manager = data.rosterIdMap?.[pk.roster_id];
      if (!manager || !pk.player_id) return;
      let value = 0, weeks = 0;
      for (let w = 1; w <= latestCompletedWeek; w++) {
        const snap = season?.rosterSnapshotByWeek?.[w]?.[manager];
        const pts = snap?.playersPoints?.[pk.player_id];
        if (!snap?.starters?.includes(pk.player_id) || !Number.isFinite(pts)) continue;
        value += pts - positionMedian(w, position(pk.player_id));
        weeks += 1;
      }
      if (!weeks) return;
      const pick = { manager, conf, round: pk.round, pickNo: pk.pick_no, playerId: pk.player_id, name: nameOf(pk.player_id), pos: position(pk.player_id), value };
      picks.push(pick);
      const row = byManager[manager] || (byManager[manager] = { manager, conf, net: 0, picks: 0, best: null });
      row.net += value;
      row.picks += 1;
      if (!row.best || value > row.best.value) row.best = pick;
    });
  });
  // The same player can be drafted once in each conference; list him once with every drafter.
  const byPlayer = {};
  picks.forEach(pk => {
    const row = byPlayer[pk.playerId] || (byPlayer[pk.playerId] = { playerId: pk.playerId, name: pk.name, pos: pk.pos, value: pk.value, drafters: [] });
    row.drafters.push({ manager: pk.manager, conf: pk.conf, round: pk.round, pickNo: pk.pickNo });
  });
  const sorted = Object.values(byPlayer).sort((a, b) => b.value - a.value);
  return {
    byTeam: Object.values(byManager).sort((a, b) => b.net - a.net),
    best: sorted.slice(0, 5),
    worst: sorted.slice(-5).reverse()
  };
}
