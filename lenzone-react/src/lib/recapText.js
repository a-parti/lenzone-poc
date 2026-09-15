// Builds a plain-text weekly recap for pasting into Microsoft Teams (or Slack, email, etc) --
// every line comes from data already computed on the This Week page (weeklyAwards,
// playerHighlights, standings) so nothing here is invented; a category simply isn't included if
// there's no real data behind it yet (e.g. week still in progress).
import { signed } from '../components/PlayerHighlights';
import { playerLabel } from './players';

// afcStandingsTop3/nfcStandingsTop3: the recap is a global, whole-league summary -- not scoped to
// whichever conference the viewer happens to be looking at -- so both conferences' top 3 are
// always included, regardless of who copies it or what they're currently filtered to on-screen.
export function buildWeeklyRecapText({ week, weeklyAwards, playerHighlights, lineupAccuracy, afcStandingsTop3, nfcStandingsTop3, playersDB }) {
  const lines = [`LENZONE — Week ${week} Recap`, ''];

  if (weeklyAwards) {
    const { highScore, lowScore, closest, blowout } = weeklyAwards;
    if (highScore) lines.push(`🏆 High Score: ${highScore.manager} — ${highScore.points.toFixed(2)} pts`);
    if (lowScore) lines.push(`📉 Low Score: ${lowScore.manager} — ${lowScore.points.toFixed(2)} pts`);
    if (closest) lines.push(`⚡ Closest Game: ${closest.a} (${closest.sa.toFixed(2)}) vs ${closest.b} (${closest.sb.toFixed(2)}) — ${closest.margin.toFixed(2)} pt margin`);
    if (blowout) lines.push(`🔥 Biggest Blowout: ${blowout.a} (${blowout.sa.toFixed(2)}) vs ${blowout.b} (${blowout.sb.toFixed(2)}) — ${blowout.margin.toFixed(2)} pt margin`);
  }

  if (lineupAccuracy) {
    lines.push(`🎯 Lineup IQ: ${lineupAccuracy.manager} — ${lineupAccuracy.pct.toFixed(0)}% of optimal`);
  }

  if (playerHighlights) {
    const { highestActual, biggestRiser, biggestBust } = playerHighlights;
    const name = (entry) => playerLabel(playersDB || {}, entry.id).name;
    lines.push('');
    lines.push('Player Trophies:');
    if (highestActual) lines.push(`  Top Score: ${name(highestActual)} — ${highestActual.actual.toFixed(2)} pts`);
    if (biggestRiser) lines.push(`  Biggest Riser: ${name(biggestRiser)} — ${signed(biggestRiser.actual - biggestRiser.projected)} vs proj`);
    if (biggestBust) lines.push(`  Biggest Bust: ${name(biggestBust)} — ${signed(biggestBust.actual - biggestBust.projected)} vs proj`);
  }

  const standingsBlock = (label, rows) => {
    if (!rows || rows.length === 0) return;
    lines.push('');
    lines.push(`Standings (${label}):`);
    rows.forEach(row => lines.push(`  ${row.rank}. ${row.manager} — ${row.totalPts.toFixed(1)} pts`));
  };
  standingsBlock('AFC', afcStandingsTop3);
  standingsBlock('NFC', nfcStandingsTop3);

  return lines.join('\n');
}
