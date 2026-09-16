import React, { useMemo } from 'react';
import { Trophy, Award, TrendingDown, Zap, Flame, Frown, Crosshair, ThumbsDown, Snowflake } from 'lucide-react';
import { useTeamColor } from '../context/TeamColorContext';
import { useTeamLogo } from '../context/TeamLogoContext';
import { useMatchupPreview } from '../context/MatchupPreviewContext';
import { computeLineupAccuracy, computeWorstLineupDecision } from '../lib/players';

// nameManager is the one real manager this card is "about" for logo purposes -- for the two-team
// cards (Closest Game, Biggest Blowout) that's just the first team listed, since showing both
// teams' logos in the same tight card is more clutter than payoff.
function HighlightCard({ icon: Icon, label, name, nameManager, value, accent, onClick }) {
  const color = useTeamColor(nameManager);
  const logoUrl = useTeamLogo(nameManager);
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4 hover:border-[var(--border2)] hover:scale-[1.01] transition-all duration-200 w-full"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">{label}</span>
      </div>
      <div className="flex items-center gap-2.5">
        {logoUrl && <img src={logoUrl} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />}
        <div className="min-w-0">
          {/* line-clamp-2, not truncate -- the two-team cards (Closest Game, Biggest Blowout) show
              "TeamA vs TeamB", which routinely runs longer than the single-manager cards now that
              the logo eats into the card's width; wrapping to a second line reads a lot better than
              an ellipsis chopping one of the two team names in half. */}
          <p className={`font-bold text-sm leading-snug line-clamp-2 ${nameManager ? color.text : "text-[var(--text)]"}`}>{name}</p>
          <p className={`text-xs font-mono ${accent}`}>{value}</p>
        </div>
      </div>
    </button>
  );
}

// The two-team variant of HighlightCard (Closest Game / Biggest Blowout) -- each team gets its OWN
// color (via its own useTeamColor), not one flat color applied to the whole "A vs B" string, so the
// two sides read as distinct teams at a glance. Also shows each side's real score (not just the
// margin) since "2.74 pt margin" alone doesn't tell you who actually won or what the game looked like.
function MatchupHighlightCard({ icon: Icon, label, teamA, teamB, scoreA, scoreB, marginLabel, accent, onClick }) {
  const colorA = useTeamColor(teamA);
  const colorB = useTeamColor(teamB);
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4 hover:border-[var(--border2)] hover:scale-[1.01] transition-all duration-200 w-full"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">{label}</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`font-bold text-sm leading-snug min-w-0 ${colorA.text}`}>{teamA}</span>
          <span className="font-mono text-sm font-bold text-[var(--text)] shrink-0">{scoreA.toFixed(2)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className={`font-bold text-sm leading-snug min-w-0 ${colorB.text}`}>{teamB}</span>
          <span className="font-mono text-sm font-bold text-[var(--text)] shrink-0">{scoreB.toFixed(2)}</span>
        </div>
      </div>
      <p className={`text-xs font-mono mt-1.5 ${accent}`}>{marginLabel}</p>
    </button>
  );
}

// While the week is still live/in-progress, every card is explicitly labeled "Projected" and driven
// by the blended projected-final numbers (not a partial leaderboard of whoever's ahead right now) --
// so it's clear these aren't real trophies yet. Once the week is fully complete, they flip to the
// real Trophy icon and the actual final numbers. Clicking a card pops up that manager's matchup
// as a card (the same global preview the season Grid uses) rather than filtering/navigating away --
// you stay right where you were, with a straightforward way to go see the full matchup if you want it.
export default function WeeklyHighlights({
  awards, benchPointsAward, week, isWeekFinal,
  afcData, nfcData, afcSeason, nfcSeason, playersDB, managerStreaks
}) {
  const { openPreview } = useMatchupPreview();
  const confFor = (manager) => (afcData?.rosters?.some(r => r.manager === manager) ? "AFC" : "NFC");
  const showMatchup = (manager) => openPreview(manager, confFor(manager), week);
  // Longest active real streak league-wide (2+ games, either direction) -- ties broken by
  // whichever manager sorts first, since there's no principled real tiebreaker for "equally hot".
  const longestStreak = useMemo(() => {
    if (!managerStreaks) return null;
    let best = null;
    Object.entries(managerStreaks).forEach(([manager, streak]) => {
      if (streak && (!best || streak.count > best.streak.count)) best = { manager, streak };
    });
    return best;
  }, [managerStreaks]);
  // "Lineup IQ" needs the same roster snapshot data as Bench Points -- only computed once the
  // week is actually final (a live/in-progress optimal-lineup comparison would flip around as
  // scores keep coming in, unlike the other awards which have a live/projected fallback instead).
  const lineupAccuracy = useMemo(
    () => (isWeekFinal && afcData && nfcData ? computeLineupAccuracy(afcData, nfcData, afcSeason, nfcSeason, week, playersDB) : null),
    [isWeekFinal, afcData, nfcData, afcSeason, nfcSeason, week, playersDB]
  );
  // The inverse of Lineup IQ: same optimal-lineup math, but the biggest miss in real POINTS
  // ("what your total would've been if you'd started your higher-scoring bench options") rather
  // than the best decision by percentage.
  const worstLineupDecision = useMemo(
    () => (isWeekFinal && afcData && nfcData ? computeWorstLineupDecision(afcData, nfcData, afcSeason, nfcSeason, week, playersDB) : null),
    [isWeekFinal, afcData, nfcData, afcSeason, nfcSeason, week, playersDB]
  );
  if (!awards) {
    return (
      <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4 text-sm text-[var(--muted)] italic">
        No live scores yet for Week {week}. Highlights populate once Sleeper reports scores.
      </div>
    );
  }
  // Each card's name AND value must come from the SAME record -- previously the name was taken
  // from the real (mostly-empty pre-kickoff) closest/blowout while the margin was taken from the
  // separate projected one, so a card could show one matchup's name next to a different matchup's
  // margin. Swap the whole record together, never just the number.
  const high = isWeekFinal ? awards.highScore : (awards.projectedHighScore || awards.highScore);
  const low = isWeekFinal ? awards.lowScore : (awards.projectedLowScore || awards.lowScore);
  const closest = isWeekFinal ? awards.closest : (awards.projectedClosest || awards.closest);
  const blowout = isWeekFinal ? awards.blowout : (awards.projectedBlowout || awards.blowout);
  const prefix = isWeekFinal ? "" : "Projected ";
  const icon = isWeekFinal ? Trophy : Award;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <HighlightCard
        icon={icon} label={`${prefix}High Score`} name={high.manager} nameManager={high.manager} value={`${high.points.toFixed(2)} pts`} accent="text-amber-400"
        onClick={() => showMatchup(high.manager)}
      />
      <HighlightCard
        icon={TrendingDown} label={`${prefix}Low Score`} name={low.manager} nameManager={low.manager} value={`${low.points.toFixed(2)} pts`} accent="text-rose-400"
        onClick={() => showMatchup(low.manager)}
      />
      {closest && (
        <MatchupHighlightCard
          icon={Zap} label={`${prefix}Closest Game`} teamA={closest.a} teamB={closest.b}
          scoreA={closest.sa} scoreB={closest.sb} marginLabel={`${closest.margin.toFixed(2)} pt margin`}
          accent="text-blue-400" onClick={() => showMatchup(closest.a)}
        />
      )}
      {blowout && (
        <MatchupHighlightCard
          icon={Flame} label={`${prefix}Biggest Blowout`} teamA={blowout.a} teamB={blowout.b}
          scoreA={blowout.sa} scoreB={blowout.sb} marginLabel={`${blowout.margin.toFixed(2)} pt margin`}
          accent="text-orange-400" onClick={() => showMatchup(blowout.a)}
        />
      )}
      {benchPointsAward && (
        <HighlightCard
          icon={Frown} label="Most Points Left on Bench" name={benchPointsAward.manager} nameManager={benchPointsAward.manager}
          value={`${benchPointsAward.points.toFixed(2)} pts benched`} accent="text-violet-400"
          onClick={() => showMatchup(benchPointsAward.manager)}
        />
      )}
      {lineupAccuracy && (
        <HighlightCard
          icon={Crosshair} label="Lineup IQ" name={lineupAccuracy.manager} nameManager={lineupAccuracy.manager}
          value={`${lineupAccuracy.pct.toFixed(0)}% of optimal (${lineupAccuracy.actual.toFixed(2)}/${lineupAccuracy.optimal.toFixed(2)})`}
          accent="text-cyan-400" onClick={() => showMatchup(lineupAccuracy.manager)}
        />
      )}
      {worstLineupDecision && (
        <HighlightCard
          icon={ThumbsDown} label="Left the Most on the Table" name={worstLineupDecision.manager} nameManager={worstLineupDecision.manager}
          value={`Scored ${worstLineupDecision.actual.toFixed(2)}, could've had ${worstLineupDecision.optimal.toFixed(2)} (-${worstLineupDecision.deficit.toFixed(2)})`}
          accent="text-red-400" onClick={() => showMatchup(worstLineupDecision.manager)}
        />
      )}
      {longestStreak && (
        <HighlightCard
          icon={longestStreak.streak.type === 'W' ? Flame : Snowflake}
          label={longestStreak.streak.type === 'W' ? "Hot Streak" : "Cold Streak"}
          name={longestStreak.manager} nameManager={longestStreak.manager}
          value={`${longestStreak.streak.count} straight ${longestStreak.streak.type === 'W' ? "wins" : "losses"}`}
          accent={longestStreak.streak.type === 'W' ? "text-orange-400" : "text-sky-300"}
          onClick={() => showMatchup(longestStreak.manager)}
        />
      )}
    </div>
  );
}
