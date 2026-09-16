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

// Early-season shrinkage: blend a manager's own mean toward the league mean, weighted as if the
// league mean were worth this many "phantom" games. With only 1-2 real games, a single fluky high
// or low week otherwise gets treated as that team's true talent level for the ENTIRE rest of a
// 17-week Monte Carlo simulation, producing wildly overconfident playoff-odds swings. This doesn't
// change the DISPLAYED score/PF anywhere -- it only tempers the simulation's assumed skill level
// until there's enough real data to trust it on its own; the weight matters less and less as
// `gamesPlayed` grows (self-correcting over the season), so this is a one-time tuning constant,
// not something that needs revisiting week to week.
//
// Value chosen by simulating against real Week-1 AFC data (12 teams, real scores) at several
// weights: 3 phantom games (the original pick) reproduced the actual reported bug -- a team could
// land at ~3-5% after a single game purely from one so-so week extrapolated over 13 more weeks at
// full confidence. 12 phantom games keeps the model still respecting real week-1 results (the
// eventual high-PF teams still lead, ~75% vs ~18%) without pinning anyone near the 0%/100%
// extremes a single week of data can't actually support this early.
const SHRINKAGE_PHANTOM_GAMES = 12;

export function computeStats(history, managers) {
  const allScores = Object.values(history).flat();
  const leagueMean = allScores.length ? avg(allScores) : 100;
  const leagueStd = allScores.length ? (stdev(allScores, leagueMean) || 20) : 20;
  const stats = {};
  managers.forEach(m => {
    const scores = history[m] || [];
    const gamesPlayed = scores.length;
    const rawMean = gamesPlayed > 0 ? avg(scores) : leagueMean;
    const mean = gamesPlayed > 0
      ? (gamesPlayed * rawMean + SHRINKAGE_PHANTOM_GAMES * leagueMean) / (gamesPlayed + SHRINKAGE_PHANTOM_GAMES)
      : leagueMean;
    const std = gamesPlayed > 1 ? (stdev(scores, rawMean) || leagueStd) : leagueStd;
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

// Cross-conference Points Against: the same idea as computePointsAgainst, but for each manager's
// interconference opponent each week (the cross `schedule` array, not either conference's own
// intra schedule). Standings' PA needs BOTH -- a manager plays one intra AND one inter game most
// weeks, and only counting the intra one understates real points allowed.
export function computeCrossPointsAgainst(managers, schedule, afcSeason, nfcSeason, maxWeek) {
  const pa = {};
  managers.forEach(m => pa[m] = 0);
  schedule.forEach(({ week, afcTeam, nfcTeam }) => {
    if (week > maxWeek) return;
    const aScore = afcSeason.scoreByWeek[week]?.[afcTeam] || 0;
    const nScore = nfcSeason.scoreByWeek[week]?.[nfcTeam] || 0;
    if (!(aScore > 0 && nScore > 0)) return;
    if (pa[afcTeam] !== undefined) pa[afcTeam] += nScore;
    if (pa[nfcTeam] !== undefined) pa[nfcTeam] += aScore;
  });
  return pa;
}

// How many real intra-conference games a manager has actually played through maxWeek -- the
// denominator for PF/PA AVERAGES (not season totals). Counts real participation directly (both
// sides posted a real score) rather than assuming one game per week, in case of any schedule gaps.
export function computeIntraGamesPlayed(manager, season, maxWeek) {
  let count = 0;
  Object.entries(season.scheduleByWeek).forEach(([week, pairs]) => {
    if (Number(week) > maxWeek) return;
    pairs.forEach(([a, b]) => {
      if (a !== manager && b !== manager) return;
      const scoreA = season.scoreByWeek[week]?.[a] || 0;
      const scoreB = season.scoreByWeek[week]?.[b] || 0;
      if (scoreA > 0 && scoreB > 0) count++;
    });
  });
  return count;
}

// Same idea for cross-conference games, from the cross `schedule` array.
export function computeInterGamesPlayed(manager, schedule, afcSeason, nfcSeason, maxWeek) {
  let count = 0;
  schedule.forEach(({ week, afcTeam, nfcTeam }) => {
    if (week > maxWeek || (afcTeam !== manager && nfcTeam !== manager)) return;
    const aScore = afcSeason.scoreByWeek[week]?.[afcTeam] || 0;
    const nScore = nfcSeason.scoreByWeek[week]?.[nfcTeam] || 0;
    if (aScore > 0 && nScore > 0) count++;
  });
  return count;
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

// The classic fantasy-regret stat: whoever's benched (non-IR) players racked up the most REAL
// points this week that never counted for them. Real posted points only (no projections folded
// in, unlike the other awards) since the whole point is what already, definitely happened.
export function computeBenchPointsAward(afcData, nfcData, afcSeason, nfcSeason, week) {
  const entries = [];
  const ingest = (confData, season) => {
    (confData?.rosters || []).forEach(r => {
      const snapshot = season?.rosterSnapshotByWeek?.[week]?.[r.manager];
      if (!snapshot) return;
      const irIds = r.reserve || [];
      const benchIds = (r.players || []).filter(id => !(snapshot.starters || []).includes(id) && !irIds.includes(id));
      const points = benchIds.reduce((sum, id) => {
        const pts = snapshot.playersPoints?.[id];
        return sum + (pts > 0 ? pts : 0);
      }, 0);
      if (points > 0) entries.push({ manager: r.manager, points });
    });
  };
  ingest(afcData, afcSeason);
  ingest(nfcData, nfcSeason);
  if (entries.length === 0) return null;
  return [...entries].sort((a, b) => b.points - a.points)[0];
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
// NOTE: `pf` here stays a SEASON TOTAL (not an average) -- simulateCombinedPlayoffOdds seeds its
// Monte Carlo state directly from this list's `pf` and then keeps adding raw simulated weekly
// scores on top of it, so it must remain additive. Display-only PF/PA AVERAGES are separate fields
// (`pfAvg`/`paAvg`) computed alongside, so the standings table can show a per-game average without
// corrupting the simulation's running total.
// crossPointsAgainstByManager/intraGamesByManager/interGamesByManager (optional): pass these to
// also get a `paAvg` that accounts for BOTH intra and inter opponents (a manager plays one of each
// most weeks) -- without them, `paAvg` falls back to intra-only, same as `pa`.
export function buildConferenceList(managers, confData, crossRecordByManager, pointsAgainstByManager = {}, inConfRecordByManager = {}, crossPointsAgainstByManager = null, intraGamesByManager = null, interGamesByManager = null) {
  return managers.map(mgr => {
    const r = confData.rosters.find(ros => ros.manager === mgr);
    const cross = crossRecordByManager[mgr] || { wins: 0, losses: 0, ties: 0, pts: 0 };
    const inConf = inConfRecordByManager[mgr] || { wins: 0, losses: 0, ties: 0, pf: 0 };
    const inConfPts = (inConf.wins * 2.0) + (inConf.ties * 1.0);
    const intraGames = intraGamesByManager ? (intraGamesByManager[mgr] || 0) : (inConf.wins + inConf.losses + inConf.ties);
    const interGames = interGamesByManager ? (interGamesByManager[mgr] || 0) : (cross.wins + cross.losses + cross.ties);
    const pa = pointsAgainstByManager[mgr] || 0;
    const totalPa = pa + (crossPointsAgainstByManager ? (crossPointsAgainstByManager[mgr] || 0) : 0);
    const paGames = crossPointsAgainstByManager ? (intraGames + interGames) : intraGames;
    return {
      manager: mgr,
      inConfRecord: `${inConf.wins}-${inConf.losses}-${inConf.ties}`,
      interConfRecord: `${cross.wins}-${cross.losses}-${cross.ties}`,
      totalPts: inConfPts + cross.pts,
      pf: inConf.pf,
      pa,
      pfAvg: intraGames > 0 ? inConf.pf / intraGames : 0,
      paAvg: paGames > 0 ? totalPa / paGames : 0,
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

// Per-week history of Standings Pts / PF / conference rank for every manager, "as of" each
// completed week -- reuses the exact same per-week-bounded functions the live Standings table
// already calls (computeInConfRecord/computeCrossRecords/buildConferenceList/rankConference),
// just called once per week instead of once for the latest week. Prepends a synthetic Week 0
// baseline (0 pts, 0 PF, and the middle rank for every manager -- "nobody's ahead yet") so the
// trend chart has a real starting point before any games exist.
export function buildStandingsHistory(afcManagers, nfcManagers, afcData, nfcData, afcSeason, nfcSeason, schedule, latestCompletedWeek) {
  const afc = {}; afcManagers.forEach(m => { afc[m] = []; });
  const nfc = {}; nfcManagers.forEach(m => { nfc[m] = []; });

  const week0Rank = (managers) => (managers.length + 1) / 2;
  afcManagers.forEach(m => afc[m].push({ week: 0, pts: 0, pf: 0, rank: week0Rank(afcManagers) }));
  nfcManagers.forEach(m => nfc[m].push({ week: 0, pts: 0, pf: 0, rank: week0Rank(nfcManagers) }));

  for (let w = 1; w <= latestCompletedWeek; w++) {
    const crossRecords = computeCrossRecords(schedule, afcSeason, nfcSeason, w);
    const afcInConf = computeInConfRecord(afcManagers, afcSeason, w);
    const nfcInConf = computeInConfRecord(nfcManagers, nfcSeason, w);
    const afcList = buildConferenceList(afcManagers, afcData, crossRecords, {}, afcInConf);
    const nfcList = buildConferenceList(nfcManagers, nfcData, crossRecords, {}, nfcInConf);
    const afcRanked = rankConference(afcList, "AFC");
    const nfcRanked = rankConference(nfcList, "NFC");
    afcRanked.forEach(t => afc[t.manager].push({ week: w, pts: t.totalPts, pf: t.pf, rank: t.rank }));
    nfcRanked.forEach(t => nfc[t.manager].push({ week: w, pts: t.totalPts, pf: t.pf, rank: t.rank }));
  }

  return { afc, nfc };
}

// Per-week (NOT cumulative) PF / PA history for every manager -- their own real score that week
// (weekly PF), their in-conference opponent's real score that week (weekly PA, intra), and their
// cross-conference opponent's real score that week (weekly PA, cross). A week a manager didn't
// play (bye-like gap) or an opponent side with no real score yet is left out entirely rather than
// plotted as a fabricated 0.
export function buildWeeklyPfPaHistory(afcManagers, nfcManagers, afcData, nfcData, afcSeason, nfcSeason, schedule, latestCompletedWeek) {
  const build = (managers, season, oppSeason, isAfc) => {
    const out = {}; managers.forEach(m => { out[m] = []; });
    for (let w = 1; w <= latestCompletedWeek; w++) {
      managers.forEach(m => {
        const pf = season.scoreByWeek[w]?.[m];
        if (!(pf > 0)) return;
        const intraPair = (season.scheduleByWeek[w] || []).find(([a, b]) => a === m || b === m);
        const intraOpp = intraPair ? (intraPair[0] === m ? intraPair[1] : intraPair[0]) : null;
        const paIntra = intraOpp != null ? (season.scoreByWeek[w]?.[intraOpp] || null) : null;
        const crossMatch = schedule.find(x => x.week === w && (isAfc ? x.afcTeam === m : x.nfcTeam === m));
        const crossOpp = crossMatch ? (isAfc ? crossMatch.nfcTeam : crossMatch.afcTeam) : null;
        const paCross = crossOpp != null ? (oppSeason.scoreByWeek[w]?.[crossOpp] || null) : null;
        out[m].push({ week: w, pf, paIntra, paCross });
      });
    }
    return out;
  };
  return {
    afc: build(afcManagers, afcSeason, nfcSeason, true),
    nfc: build(nfcManagers, nfcSeason, afcSeason, false)
  };
}

// Real in-conference W/L/T for every manager for a single week -- used only for the speech
// bubbles' "you're winning/losing right now" flavor line, so it only needs the intra-conference
// result (the more central "your own matchup" outcome), not a full blended intra+inter verdict.
// Real posted scores only; a manager with no score yet this week (bye-like gap, or before
// kickoff) gets null -- no result to riff on.
export function computeWeekResultByManager(afcManagers, nfcManagers, afcSeason, nfcSeason, week) {
  const result = {};
  const fill = (managers, season) => {
    managers.forEach(m => { result[m] = null; });
    (season.scheduleByWeek[week] || []).forEach(([a, b]) => {
      const scoreA = season.scoreByWeek[week]?.[a];
      const scoreB = season.scoreByWeek[week]?.[b];
      if (!(scoreA > 0 && scoreB > 0)) return;
      if (scoreA > scoreB) { result[a] = 'W'; result[b] = 'L'; }
      else if (scoreB > scoreA) { result[b] = 'W'; result[a] = 'L'; }
      else { result[a] = 'T'; result[b] = 'T'; }
    });
  };
  fill(afcManagers, afcSeason);
  fill(nfcManagers, nfcSeason);
  return result;
}

// Each manager's current active streak (W or L), 2+ games, from real week-by-week intra-conference
// results through latestCompletedWeek -- null if their last result broke a streak (or they have
// no completed games yet). Used for both the "Hot/Cold Streak" trophy and the speech bubbles'
// streak-aware flavor lines (a real 3-game skid reads very differently than just "lost this week").
export function computeManagerStreaks(afcManagers, nfcManagers, afcSeason, nfcSeason, latestCompletedWeek) {
  const streaks = {};
  const build = (managers, season) => {
    managers.forEach(m => {
      const results = [];
      for (let w = 1; w <= latestCompletedWeek; w++) {
        const pair = (season.scheduleByWeek[w] || []).find(([a, b]) => a === m || b === m);
        if (!pair) continue;
        const opp = pair[0] === m ? pair[1] : pair[0];
        const myScore = season.scoreByWeek[w]?.[m];
        const oppScore = season.scoreByWeek[w]?.[opp];
        if (!(myScore > 0 && oppScore > 0)) continue;
        results.push(myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T');
      }
      if (results.length === 0) { streaks[m] = null; return; }
      const last = results[results.length - 1];
      let count = 0;
      for (let i = results.length - 1; i >= 0; i--) {
        if (results[i] !== last) break;
        count++;
      }
      streaks[m] = (last !== 'T' && count >= 2) ? { type: last, count } : null;
    });
  };
  build(afcManagers, afcSeason);
  build(nfcManagers, nfcSeason);
  return streaks;
}

// Real "revenge game" detection: does this week's matchup (intra or cross) repeat an EARLIER
// meeting this season, and if so, who won that first one? With only ~11-12 possible opponents in
// a 14-week season, rematches are guaranteed to happen -- this just surfaces them with the real
// prior result, never invents a "rivalry" narrative beyond what actually already happened.
export function computeRevengeGames(afcSeason, nfcSeason, crossSchedule, week) {
  const games = [];
  const checkIntra = (season) => {
    (season.scheduleByWeek[week] || []).forEach(([a, b]) => {
      for (let w = 1; w < week; w++) {
        const prevPairs = season.scheduleByWeek[w] || [];
        if (!prevPairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) continue;
        const sa = season.scoreByWeek[w]?.[a], sb = season.scoreByWeek[w]?.[b];
        if (sa > 0 && sb > 0) {
          games.push({ a, b, priorWeek: w, winner: sa > sb ? a : sb > sa ? b : null, scoreA: sa, scoreB: sb });
        }
        break;
      }
    });
  };
  checkIntra(afcSeason);
  checkIntra(nfcSeason);

  (crossSchedule.filter(m => m.week === week)).forEach(m => {
    for (let w = 1; w < week; w++) {
      const found = crossSchedule.find(x => x.week === w && x.afcTeam === m.afcTeam && x.nfcTeam === m.nfcTeam);
      if (!found) continue;
      const sa = afcSeason.scoreByWeek[w]?.[m.afcTeam], sn = nfcSeason.scoreByWeek[w]?.[m.nfcTeam];
      if (sa > 0 && sn > 0) {
        games.push({ a: m.afcTeam, b: m.nfcTeam, priorWeek: w, winner: sa > sn ? m.afcTeam : sn > sa ? m.nfcTeam : null, scoreA: sa, scoreB: sn });
      }
      break;
    }
  });
  return games;
}

function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Weekly (not cumulative) median real score across a whole conference, week by week -- the
// reference line for "how did this team's PF compare to a typical AFC/NFC score that week".
// Real posted scores only; a week with no real scores yet is simply left out.
export function computeWeeklyConferenceMedian(season, maxWeek) {
  const out = [];
  for (let w = 1; w <= maxWeek; w++) {
    const scores = Object.values(season.scoreByWeek[w] || {}).filter(v => v > 0);
    const m = median(scores);
    if (m != null) out.push({ week: w, value: m });
  }
  return out;
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
