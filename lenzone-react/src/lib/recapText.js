// Builds the plain-text weekly recap for pasting into Microsoft Teams. Every line comes from data
// already computed on the site (weekly awards, player highlights, real Sleeper transactions), so
// nothing here is invented; a section with no real data behind it is left out (or, for trades,
// says there were none). The layout mirrors the commissioner's hand-edited Week 3 recap.
import { computePlayerHighlights, computeTopByPosition, playerLabel } from './players';
import { HIGH_SCORE_PRIZES } from './highScorePrizes';

const RULE = '-'.repeat(76);

function signed(n) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

// Higher score first, so every game reads "Winner (score) vs Loser (score)".
function winnerFirst(game) {
  return game.sb > game.sa ? { a: game.b, b: game.a, sa: game.sb, sb: game.sa, margin: game.margin } : game;
}

function gameLine(game) {
  const g = winnerFirst(game);
  return `${g.a} (${g.sa.toFixed(2)}) vs ${g.b} (${g.sb.toFixed(2)}) — ${g.margin.toFixed(2)} pt margin`;
}

function prizeLabel(week) {
  const choice = HIGH_SCORE_PRIZES[week]?.choice;
  if (choice === 'wine') return '(chose wine)';
  if (choice === 'cash') return '(chose $15)';
  return '(TBD)';
}

// Completed Sleeper trades made during `week` (Sleeper's `leg`), one line per trade:
// "AFC: Mina gets WR Tetairoa McMillan + $10 FAAB · Rob gets TE Juwan Johnson".
export function tradeLines(transactions, playersDB, week) {
  return (transactions || [])
    .filter(({ tx }) => tx.type === 'trade' && tx.status === 'complete' && tx.leg === week)
    .sort((x, y) => (x.tx.created || 0) - (y.tx.created || 0))
    .map(({ tx, conf, rosterIdMap }) => {
      const gets = new Map();
      (tx.roster_ids || []).forEach(id => gets.set(String(id), []));
      Object.entries(tx.adds || {}).forEach(([playerId, rosterId]) => {
        const key = String(rosterId);
        if (!gets.has(key)) gets.set(key, []);
        const { name, position } = playerLabel(playersDB || {}, playerId);
        gets.get(key).push(position ? `${position} ${name}` : name);
      });
      (tx.waiver_budget || []).forEach(b => {
        const key = String(b.receiver);
        if (!gets.has(key)) gets.set(key, []);
        gets.get(key).push(`$${b.amount} FAAB`);
      });
      const sides = [...gets.entries()].map(([rosterId, items]) => {
        const manager = rosterIdMap?.[rosterId] || `Roster ${rosterId}`;
        return items.length ? `${manager} gets ${items.join(' + ')}` : manager;
      });
      return `${conf}: ${sides.join(' · ')}`;
    });
}

export function buildWeeklyRecapText({ week, weeklyAwards, playerHighlights, playersDB, waiverWireMvp, topByPosition, trades }) {
  const lines = [`LENZONE — Week ${week} Recap`, RULE];

  if (weeklyAwards) {
    const { highScore, lowScore, closest, blowout } = weeklyAwards;
    if (highScore) lines.push(`🏆 $15/wine ${prizeLabel(week)} High Score: ${highScore.manager} — ${highScore.points.toFixed(2)} pts`);
    if (lowScore) lines.push(`📉 Low Score: ${lowScore.manager} — ${lowScore.points.toFixed(2)} pts`);
    if (closest) lines.push(`⚡ Closest Game: ${gameLine(closest)}`);
    if (blowout) lines.push(`🔥 Biggest Blowout: ${gameLine(blowout)}`);
    lines.push(RULE);
  }

  const positionLeaders = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
    .map(position => ({ position, entry: topByPosition?.[position]?.[0] }))
    .filter(({ entry }) => entry);
  if (positionLeaders.length > 0) {
    lines.push('Top Players by Position:');
    positionLeaders.forEach(({ position, entry }) => {
      lines.push(`  ${position}: ${playerLabel(playersDB || {}, entry.id).name} — ${entry.points.toFixed(2)} pts`);
    });
    lines.push(RULE);
  }

  if (playerHighlights) {
    const { highestActual, biggestRiser, biggestBust, mostReliable } = playerHighlights;
    const name = (entry) => playerLabel(playersDB || {}, entry.id).name;
    const trophies = [];
    if (highestActual) trophies.push(`  Top Score: ${name(highestActual)} — ${highestActual.actual.toFixed(2)} pts`);
    if (biggestRiser) trophies.push(`  Biggest Riser: ${name(biggestRiser)} — ${signed(biggestRiser.actual - biggestRiser.projected)} vs proj`);
    if (biggestBust) trophies.push(`  Biggest Bust: ${name(biggestBust)} — ${signed(biggestBust.actual - biggestBust.projected)} vs proj`);
    if (mostReliable) trophies.push(`  Mr./Ms. Reliable: ${name(mostReliable)} — ${signed(mostReliable.actual - mostReliable.projected)} vs proj`);
    if (waiverWireMvp) trophies.push(`  Waiver Wire MVP: ${name(waiverWireMvp)} — ${waiverWireMvp.points.toFixed(2)} pts for ${waiverWireMvp.manager}`);
    if (trophies.length > 0) {
      lines.push('Player Trophies:');
      lines.push(...trophies);
      lines.push(RULE);
    }
  }

  lines.push('Trade Recap');
  lines.push('');
  if (trades && trades.length > 0) trades.forEach(t => lines.push(`  ${t}`));
  else lines.push(`No trades in Week ${week}!`);
  lines.push('');
  lines.push(RULE);

  // The two charts are pasted in as images by hand; these headings mark where they go.
  lines.push(`Week ${week} Winners and Losers`);
  lines.push('  [paste the weekly scores chart]');
  lines.push(RULE);
  lines.push('Overall Standings');
  lines.push('  [paste the standings chart]');
  lines.push(RULE);
  lines.push('Full standings & scoreboard: https://www.lenzone.xyz/#standings');

  return lines.join('\n');
}

// One source for both copy buttons and the admin preview.
// `transactions` is [{ tx, conf, rosterIdMap }] across both conferences.
export function buildWeeklyRecapForWeek({
  week, weeklyAwards, afcData, nfcData, afcSeason, nfcSeason, weekProjections, playersDB, waiverWireMvp, transactions
}) {
  return buildWeeklyRecapText({
    week,
    weeklyAwards,
    playerHighlights: computePlayerHighlights(afcData, nfcData, afcSeason, nfcSeason, week, weekProjections),
    topByPosition: computeTopByPosition(afcData, nfcData, afcSeason, nfcSeason, week, playersDB),
    playersDB,
    waiverWireMvp,
    trades: tradeLines(transactions, playersDB, week)
  });
}
