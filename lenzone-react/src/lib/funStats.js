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
// win = 1, ties = half) vs. all-play expected points -- each game weighted the same way, times the
// share of the rest of the league you outscored that week.
export function allPlayLuck(latestCompletedWeek, afcSeason, nfcSeason, schedule, afcManagers, nfcManagers) {
  const totals = {};
  for (let w = 1; w <= latestCompletedWeek; w++) {
    const rows = weekTeamResults(w, afcSeason, nfcSeason, schedule, afcManagers, nfcManagers);
    rows.forEach(r => {
      const others = rows.filter(o => o.manager !== r.manager);
      if (!others.length) return;
      const beat = others.reduce((s, o) => s + (r.score > o.score ? 1 : r.score === o.score ? 0.5 : 0), 0) / others.length;
      const t = totals[r.manager] || (totals[r.manager] = { manager: r.manager, conf: r.conf, wins: 0, games: 0, expected: 0 });
      [[outcome(r.score, r.intraOppScore), 2], [outcome(r.score, r.crossOppScore), 1]].forEach(([result, weight]) => {
        if (result == null) return;
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
