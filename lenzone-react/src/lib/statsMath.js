// All numbers here are computed from real Sleeper scores. Where real data doesn't exist yet
// (a team with zero games logged), we fall back to a league-average prior for simulation
// purposes only -- never displayed as if it were a verified fact.

export const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
export const stdev = (arr, mean) => Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

// Probability team A (mean/std) outscores team B (mean/std), via normal approximation
export function winProbability(meanA, stdA, meanB, stdB) {
  const diffMean = meanA - meanB;
  const diffStd = Math.sqrt(stdA * stdA + stdB * stdB) || 1;
  const z = diffMean / (diffStd * Math.SQRT2);
  return 0.5 * (1 + erf(z));
}

// Pregame win % from that week's two projected totals alone, before any real scoring history
// exists to measure a team's actual variance. Sleeper/ESPN/etc model win% as P(TeamA > TeamB)
// from each team's projected mean *and* variance; we don't have a real variance figure from the
// RotoWire projection feed pre-season, so this assumes a fixed 25% coefficient of variation as a
// stand-in -- a reasonable rough estimate, not a precise or sourced number. Once real weekly
// scores exist, winProbability() above (using each team's own measured std) takes over instead.
const ROUGH_PROJECTION_CV = 0.25;
export function roughWinProbability(myProjected, oppProjected) {
  if (myProjected == null || oppProjected == null) return null;
  const myStd = Math.max(myProjected * ROUGH_PROJECTION_CV, 1);
  const oppStd = Math.max(oppProjected * ROUGH_PROJECTION_CV, 1);
  return winProbability(myProjected, myStd, oppProjected, oppStd);
}

// Seeded PRNG (mulberry32) so a given seed always reproduces the same simulated sequence --
// needed so playoff % is identical for every viewer and only changes when the seed (completed week) does.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianRandom(mean, std, rng = Math.random) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(0, mean + z * std);
}

// maxWeek must be the latest FULLY COMPLETED week -- otherwise a manager's in-progress live score
// this week gets counted as a "finished game" whose mean equals that partial score, badly skewing
// every downstream stat (win %, Monte Carlo playoff odds baseline) toward whoever's ahead right now.
export function buildHistory(scoreByWeek, maxWeek) {
  const history = {};
  Object.entries(scoreByWeek).forEach(([week, weekMap]) => {
    if (Number(week) > maxWeek) return;
    Object.entries(weekMap).forEach(([mgr, pts]) => {
      if (pts > 0) {
        if (!history[mgr]) history[mgr] = [];
        history[mgr].push(pts);
      }
    });
  });
  return history;
}

export function computeStats(history, managers) {
  const allScores = Object.values(history).flat();
  const leagueMean = allScores.length ? avg(allScores) : 100;
  const leagueStd = allScores.length ? (stdev(allScores, leagueMean) || 20) : 20;
  const stats = {};
  managers.forEach(m => {
    const scores = history[m] || [];
    const gamesPlayed = scores.length;
    const mean = gamesPlayed > 0 ? avg(scores) : leagueMean;
    const std = gamesPlayed > 1 ? (stdev(scores, mean) || leagueStd) : leagueStd;
    stats[m] = { mean, std, gamesPlayed };
  });
  return stats;
}

// Locks seeds 1-5 by total Standings Pts, then awards seed 6 to the highest-PF team among the
// remaining 7 -- the same rule as seedConference()/rankConference(), applied to simulated end-states.
function tallyPlayoffTeams(managers, state, counts) {
  const sorted = managers
    .map(m => ({ manager: m, pts: state[m].pts, pf: state[m].pf }))
    .sort((a, b) => b.pts - a.pts || b.pf - a.pf);
  const locked = sorted.slice(0, 5);
  const remaining = sorted.slice(5);
  const wildcard = [...remaining].sort((a, b) => b.pf - a.pf)[0];
  [...locked, ...(wildcard ? [wildcard] : [])].forEach(t => counts[t.manager]++);
}

// Monte Carlo playoff odds for BOTH conferences at once. Each remaining week's intra-conference
// games AND that same week's interconference games are resolved from the SAME simulated weekly
// score per team (exactly like the real scoring: one real weekly score decides both matchups) --
// so a team's simulated interconference wins (+1.0 pt) are counted, not just intra wins (+2.0 pt).
export function simulateCombinedPlayoffOdds(
  afcManagers, nfcManagers, afcBaseList, nfcBaseList, afcStats, nfcStats,
  afcScheduleByWeek, nfcScheduleByWeek, crossSchedule, latestCompletedWeek, seasonWeeks, simulations = 1500
) {
  // Seeded on latestCompletedWeek alone -- identical for every viewer, and only moves when a week finishes.
  const rng = mulberry32(latestCompletedWeek + 1);
  const remainingWeeks = [];
  for (let w = latestCompletedWeek + 1; w <= seasonWeeks; w++) {
    remainingWeeks.push({
      afcPairs: afcScheduleByWeek[w] || [],
      nfcPairs: nfcScheduleByWeek[w] || [],
      crossPairs: crossSchedule.filter(m => m.week === w)
    });
  }

  const afcCounts = {}; afcManagers.forEach(m => afcCounts[m] = 0);
  const nfcCounts = {}; nfcManagers.forEach(m => nfcCounts[m] = 0);

  for (let sim = 0; sim < simulations; sim++) {
    const state = {};
    afcBaseList.forEach(t => state[t.manager] = { pts: t.totalPts, pf: t.pf });
    nfcBaseList.forEach(t => state[t.manager] = { pts: t.totalPts, pf: t.pf });

    remainingWeeks.forEach(({ afcPairs, nfcPairs, crossPairs }) => {
      const weekScores = {};
      const resolveIntra = (pairs, stats) => {
        pairs.forEach(([mA, mB]) => {
          if (!state[mA] || !state[mB]) return;
          const sA = stats[mA] || { mean: 100, std: 20 };
          const sB = stats[mB] || { mean: 100, std: 20 };
          const scoreA = gaussianRandom(sA.mean, sA.std, rng);
          const scoreB = gaussianRandom(sB.mean, sB.std, rng);
          weekScores[mA] = scoreA;
          weekScores[mB] = scoreB;
          state[mA].pf += scoreA;
          state[mB].pf += scoreB;
          if (scoreA > scoreB) state[mA].pts += 2.0;
          else if (scoreB > scoreA) state[mB].pts += 2.0;
          else { state[mA].pts += 1.0; state[mB].pts += 1.0; }
        });
      };
      resolveIntra(afcPairs, afcStats);
      resolveIntra(nfcPairs, nfcStats);

      crossPairs.forEach(m => {
        const a = weekScores[m.afcTeam];
        const n = weekScores[m.nfcTeam];
        if (a == null || n == null || !state[m.afcTeam] || !state[m.nfcTeam]) return;
        if (a > n) state[m.afcTeam].pts += 1.0;
        else if (n > a) state[m.nfcTeam].pts += 1.0;
        else { state[m.afcTeam].pts += 0.5; state[m.nfcTeam].pts += 0.5; }
      });
    });

    tallyPlayoffTeams(afcManagers, state, afcCounts);
    tallyPlayoffTeams(nfcManagers, state, nfcCounts);
  }

  const afcOdds = {}; afcManagers.forEach(m => afcOdds[m] = (afcCounts[m] / simulations) * 100);
  const nfcOdds = {}; nfcManagers.forEach(m => nfcOdds[m] = (nfcCounts[m] / simulations) * 100);
  return { afcOdds, nfcOdds };
}

// Real cross-conference results: compares each pairing's actual weekly Sleeper scores.
// `maxWeek` should be the latest FULLY COMPLETED week (not seasonWeeks) wherever this feeds
// standings/records that must not move mid-week from live in-progress scores.
export function computeCrossRecords(schedule, afcSeason, nfcSeason, maxWeek) {
  const records = {};
  const bump = (m) => { if (!records[m]) records[m] = { wins: 0, losses: 0, ties: 0, pts: 0 }; return records[m]; };
  for (let w = 1; w <= maxWeek; w++) {
    const afcWeek = afcSeason.scoreByWeek[w] || {};
    const nfcWeek = nfcSeason.scoreByWeek[w] || {};
    schedule.filter(m => m.week === w).forEach(m => {
      const aScore = afcWeek[m.afcTeam];
      const nScore = nfcWeek[m.nfcTeam];
      if (!(aScore > 0 && nScore > 0)) return;
      const a = bump(m.afcTeam);
      const n = bump(m.nfcTeam);
      if (aScore > nScore) { a.wins++; a.pts += 1.0; n.losses++; }
      else if (nScore > aScore) { n.wins++; n.pts += 1.0; a.losses++; }
      else { a.ties++; n.ties++; a.pts += 0.5; n.pts += 0.5; }
    });
  }
  return records;
}

// Points Against: for each real intra-conference week played, sum the opponent's actual score.
// Sleeper's own roster settings don't reliably expose this field, so it's computed directly from
// the same real weekly matchup data used everywhere else. `maxWeek` caps this to fully-completed weeks.
export function computePointsAgainst(managers, season, maxWeek) {
  const pa = {};
  managers.forEach(m => pa[m] = 0);
  Object.entries(season.scheduleByWeek).forEach(([week, pairs]) => {
    if (Number(week) > maxWeek) return;
    pairs.forEach(([a, b]) => {
      const scoreA = season.scoreByWeek[week]?.[a] || 0;
      const scoreB = season.scoreByWeek[week]?.[b] || 0;
      if (pa[a] !== undefined) pa[a] += scoreB;
      if (pa[b] !== undefined) pa[b] += scoreA;
    });
  });
  return pa;
}

// In-conference record/points/PF computed purely from real posted scores through maxWeek --
// replaces trusting Sleeper's live roster.settings.wins/losses/ties/fpts, which Sleeper updates
// live all week (the same live-mid-week problem this fix targets).
export function computeInConfRecord(managers, season, maxWeek) {
  const records = {};
  managers.forEach(m => { records[m] = { wins: 0, losses: 0, ties: 0, pf: 0 }; });
  for (let w = 1; w <= maxWeek; w++) {
    (season.scheduleByWeek[w] || []).forEach(([a, b]) => {
      const scoreA = season.scoreByWeek[w]?.[a] || 0;
      const scoreB = season.scoreByWeek[w]?.[b] || 0;
      if (!(scoreA > 0 && scoreB > 0)) return;
      if (records[a]) records[a].pf += scoreA;
      if (records[b]) records[b].pf += scoreB;
      if (scoreA > scoreB) { if (records[a]) records[a].wins++; if (records[b]) records[b].losses++; }
      else if (scoreB > scoreA) { if (records[b]) records[b].wins++; if (records[a]) records[a].losses++; }
      else { if (records[a]) records[a].ties++; if (records[b]) records[b].ties++; }
    });
  }
  return records;
}

export function computeCrossWeekRecord(pairsForWeek, afcWeek, nfcWeek) {
  let afcWins = 0, nfcWins = 0, ties = 0, counted = 0;
  pairsForWeek.forEach(m => {
    const aScore = afcWeek[m.afcTeam];
    const nScore = nfcWeek[m.nfcTeam];
    if (aScore > 0 && nScore > 0) {
      counted++;
      if (aScore > nScore) afcWins++;
      else if (nScore > aScore) nfcWins++;
      else ties++;
    }
  });
  return { afcWins, nfcWins, ties, counted };
}

// projectedScoreByManager (optional): { manager: blendedProjectedFinalTotal }, used to also surface
// a projected-final closest/blowout margin while the week is still live (not yet fully completed).
export function computeWeeklyAwards(afcSeason, nfcSeason, week, projectedScoreByManager = null) {
  const afcWeek = afcSeason.scoreByWeek[week] || {};
  const nfcWeek = nfcSeason.scoreByWeek[week] || {};
  const entries = [
    ...Object.entries(afcWeek).filter(([, pts]) => pts > 0).map(([manager, points]) => ({ manager, conf: "AFC", points })),
    ...Object.entries(nfcWeek).filter(([, pts]) => pts > 0).map(([manager, points]) => ({ manager, conf: "NFC", points }))
  ];
  if (entries.length === 0) return null;

  const highScore = [...entries].sort((a, b) => b.points - a.points)[0];
  const lowScore = [...entries].sort((a, b) => a.points - b.points)[0];

  const games = [
    ...(afcSeason.scheduleByWeek[week] || []).map(([a, b]) => ({ a, b, sa: afcWeek[a] || 0, sb: afcWeek[b] || 0 })),
    ...(nfcSeason.scheduleByWeek[week] || []).map(([a, b]) => ({ a, b, sa: nfcWeek[a] || 0, sb: nfcWeek[b] || 0 }))
  ].filter(g => g.sa > 0 && g.sb > 0).map(g => ({ ...g, margin: Math.abs(g.sa - g.sb) }));

  const closest = games.length ? [...games].sort((a, b) => a.margin - b.margin)[0] : null;
  const blowout = games.length ? [...games].sort((a, b) => b.margin - a.margin)[0] : null;

  let projectedClosest = null;
  let projectedBlowout = null;
  let projectedHighScore = null;
  let projectedLowScore = null;
  if (projectedScoreByManager) {
    const projGames = [
      ...(afcSeason.scheduleByWeek[week] || []),
      ...(nfcSeason.scheduleByWeek[week] || [])
    ]
      .map(([a, b]) => ({ a, b, sa: projectedScoreByManager[a], sb: projectedScoreByManager[b] }))
      .filter(g => g.sa != null && g.sb != null)
      .map(g => ({ ...g, margin: Math.abs(g.sa - g.sb) }));
    projectedClosest = projGames.length ? [...projGames].sort((a, b) => a.margin - b.margin)[0] : null;
    projectedBlowout = projGames.length ? [...projGames].sort((a, b) => b.margin - a.margin)[0] : null;

    const projEntries = [
      ...(afcSeason.scheduleByWeek[week] || []).flat(),
      ...(nfcSeason.scheduleByWeek[week] || []).flat()
    ]
      .filter((m, i, arr) => arr.indexOf(m) === i)
      .map(manager => ({ manager, points: projectedScoreByManager[manager] }))
      .filter(e => e.points != null);
    projectedHighScore = projEntries.length ? [...projEntries].sort((a, b) => b.points - a.points)[0] : null;
    projectedLowScore = projEntries.length ? [...projEntries].sort((a, b) => a.points - b.points)[0] : null;
  }

  return { highScore, lowScore, closest, blowout, projectedClosest, projectedBlowout, projectedHighScore, projectedLowScore };
}

// "Trophies" = the cross-conference matchup wins tally for the week (real once final, blended
// live+projected otherwise -- pass whichever `matchupRecord` fits) PLUS the weekly award
// categories (High Score / Low Score / Closest Game / Biggest Blowout) shown as trophy/award
// cards on the Weekly Matchups tab, each attributed to its manager's conference. One function so
// the Home "This Week" card and the Weekly Matchups tab always show the identical number.
export function computeProjectedTrophies(awards, matchupRecord, afcManagers) {
  const afcSet = new Set(afcManagers);
  const tally = { afc: 0, nfc: 0 };
  if (matchupRecord) {
    tally.afc += matchupRecord.afcWins || 0;
    tally.nfc += matchupRecord.nfcWins || 0;
  }
  if (awards) {
    const high = awards.projectedHighScore || awards.highScore;
    const low = awards.projectedLowScore || awards.lowScore;
    const closest = awards.projectedClosest || awards.closest;
    const blowout = awards.projectedBlowout || awards.blowout;
    const award = (rec) => {
      if (!rec) return;
      if (afcSet.has(rec.manager)) tally.afc++; else tally.nfc++;
    };
    const gameWinner = (g) => {
      if (!g || g.sa == null || g.sb == null || g.sa === g.sb) return;
      const winner = g.sa > g.sb ? g.a : g.b;
      if (afcSet.has(winner)) tally.afc++; else tally.nfc++;
    };
    award(high);
    award(low);
    gameWinner(closest);
    gameWinner(blowout);
  }
  return tally;
}

// inConfRecordByManager: output of computeInConfRecord (real, frozen-to-completed-weeks record/PF) --
// replaces reading confData.rosters' live Sleeper wins/losses/ties/fpts.
export function buildConferenceList(managers, confData, crossRecordByManager, pointsAgainstByManager = {}, inConfRecordByManager = {}) {
  return managers.map(mgr => {
    const r = confData.rosters.find(ros => ros.manager === mgr);
    const cross = crossRecordByManager[mgr] || { wins: 0, losses: 0, ties: 0, pts: 0 };
    const inConf = inConfRecordByManager[mgr] || { wins: 0, losses: 0, ties: 0, pf: 0 };
    const inConfPts = (inConf.wins * 2.0) + (inConf.ties * 1.0);
    return {
      manager: mgr,
      inConfRecord: `${inConf.wins}-${inConf.losses}-${inConf.ties}`,
      interConfRecord: `${cross.wins}-${cross.losses}-${cross.ties}`,
      totalPts: inConfPts + cross.pts,
      pf: inConf.pf,
      pa: pointsAgainstByManager[mgr] || 0,
      faab: r ? `$${r.faabLeft}` : "$100"
    };
  });
}

// Locks seeds 1-5 by total Standings Pts, then awards seed 6 to the highest-PF team among the remaining 7
export function seedConference(list, confLabel, oddsByManager) {
  const sortedByPts = [...list].sort((a, b) => b.totalPts - a.totalPts || b.pf - a.pf);
  const lockedSeeds = sortedByPts.slice(0, 5);
  const remaining = sortedByPts.slice(5);
  const remainingByPF = [...remaining].sort((a, b) => b.pf - a.pf);
  const wildcard = remainingByPF[0];
  const eliminated = remainingByPF.slice(1);

  const withMeta = (t, seed, status) => ({
    ...t, conf: confLabel, seed, status,
    playoffPct: oddsByManager ? oddsByManager[t.manager] : null
  });

  return [
    ...lockedSeeds.map((t, i) => withMeta(t, i + 1, null)),
    ...(wildcard ? [withMeta(wildcard, 6, "WILDCARD")] : []),
    ...eliminated.map((t, i) => withMeta(t, null, i === eliminated.length - 1 ? "TOILET_BOWL" : null))
  ];
}

// Plain 1-12 rank by total Standings Pts -- no wildcard reseeding, no status tags. Used for the
// Standings tab display until the season is far enough along for the wildcard picture to be worth flagging.
export function rankConference(list, confLabel, oddsByManager) {
  const sorted = [...list].sort((a, b) => b.totalPts - a.totalPts || b.pf - a.pf);
  return sorted.map((t, i) => ({
    ...t, conf: confLabel, rank: i + 1,
    playoffPct: oddsByManager ? oddsByManager[t.manager] : null
  }));
}
