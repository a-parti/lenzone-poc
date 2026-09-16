// Builds a plain-text weekly recap for pasting into Microsoft Teams (or Slack, email, etc) --
// every line comes from data already computed on the This Week page (weeklyAwards,
// playerHighlights, standings, big plays) so nothing here is invented; a category simply isn't
// included if there's no real data behind it yet (e.g. week still in progress).
import { signed } from '../components/PlayerHighlights';
import { playerLabel } from './players';

// afcStandingsTop3/nfcStandingsTop3: the recap is a global, whole-league summary -- not scoped to
// whichever conference the viewer happens to be looking at -- so both conferences' top 3 are
// always included, regardless of who copies it or what they're currently filtered to on-screen.
export function buildWeeklyRecapText({
  week, weeklyAwards, playerHighlights, lineupAccuracy, worstLineupDecision, benchPointsAward, bigPlays,
  managerStreaks, afcStandingsTop3, nfcStandingsTop3, playersDB
}) {
  const lines = [`LENZONE — Week ${week} Recap`, ''];

  if (weeklyAwards) {
    const { highScore, lowScore, closest, blowout } = weeklyAwards;
    if (highScore) lines.push(`🏆 High Score: ${highScore.manager} — ${highScore.points.toFixed(2)} pts`);
    if (lowScore) lines.push(`📉 Low Score: ${lowScore.manager} — ${lowScore.points.toFixed(2)} pts`);
    if (closest) lines.push(`⚡ Closest Game: ${closest.a} (${closest.sa.toFixed(2)}) vs ${closest.b} (${closest.sb.toFixed(2)}) — ${closest.margin.toFixed(2)} pt margin`);
    if (blowout) lines.push(`🔥 Biggest Blowout: ${blowout.a} (${blowout.sa.toFixed(2)}) vs ${blowout.b} (${blowout.sb.toFixed(2)}) — ${blowout.margin.toFixed(2)} pt margin`);
  }

  if (playerHighlights) {
    const { highestActual, biggestRiser, biggestBust, mostReliable } = playerHighlights;
    const name = (entry) => playerLabel(playersDB || {}, entry.id).name;
    lines.push('');
    lines.push('Player Trophies:');
    if (highestActual) lines.push(`  Top Score: ${name(highestActual)} — ${highestActual.actual.toFixed(2)} pts`);
    if (biggestRiser) lines.push(`  Biggest Riser: ${name(biggestRiser)} — ${signed(biggestRiser.actual - biggestRiser.projected)} vs proj`);
    if (biggestBust) lines.push(`  Biggest Bust: ${name(biggestBust)} — ${signed(biggestBust.actual - biggestBust.projected)} vs proj`);
    if (mostReliable) lines.push(`  Mr./Ms. Reliable: ${name(mostReliable)} — ${signed(mostReliable.actual - mostReliable.projected)} vs proj`);
  }

  // The "stir the pot" section -- real, specific, and named, which is exactly what makes it worth
  // razzing someone about in the group chat (a vague "someone made a mistake" isn't).
  const potStirrers = [];
  if (worstLineupDecision) {
    potStirrers.push(
      `😬 ${worstLineupDecision.manager} started ${worstLineupDecision.actual.toFixed(2)} when the optimal lineup was sitting right there at ${worstLineupDecision.optimal.toFixed(2)} (-${worstLineupDecision.deficit.toFixed(2)} pts left on the table).`
    );
  }
  if (benchPointsAward) {
    potStirrers.push(`🪑 ${benchPointsAward.manager} left ${benchPointsAward.points.toFixed(2)} real points on the bench this week.`);
  }
  if (lineupAccuracy && lineupAccuracy.pct >= 99.5) {
    potStirrers.push(`✅ ${lineupAccuracy.manager} ran the literal best possible lineup this week (${lineupAccuracy.pct.toFixed(0)}% of optimal). Nothing to say here.`);
  }
  if (managerStreaks) {
    Object.entries(managerStreaks).forEach(([manager, streak]) => {
      if (!streak || streak.count < 3) return; // only worth calling out at 3+
      potStirrers.push(streak.type === 'W'
        ? `🔥 ${manager} has won ${streak.count} straight.`
        : `🥶 ${manager} has dropped ${streak.count} straight.`);
    });
  }
  if (potStirrers.length > 0) {
    lines.push('');
    lines.push('Stuff to Stir the Pot:');
    potStirrers.forEach(l => lines.push(`  ${l}`));
  }

  if (bigPlays) {
    const { longestReception, longestRun, longestFieldGoal } = bigPlays;
    const plays = [];
    if (longestReception) plays.push(`  Longest Pass: ${longestReception.passerName || '?'} to ${longestReception.receiverName || '?'} for ${longestReception.yards} yds`);
    if (longestRun) plays.push(`  Longest Run: ${longestRun.playerName || '?'} for ${longestRun.yards} yds`);
    if (longestFieldGoal) plays.push(`  Longest FG: ${longestFieldGoal.playerName || '?'} from ${longestFieldGoal.yards} yds`);
    if (plays.length > 0) {
      lines.push('');
      lines.push('NFL Big Plays (Real, League-Wide):');
      plays.forEach(l => lines.push(l));
    }
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
