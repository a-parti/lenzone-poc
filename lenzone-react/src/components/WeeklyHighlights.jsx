import React from 'react';
import { Trophy, Award, TrendingDown, Zap, Flame } from 'lucide-react';
import { useTeamColor } from '../context/TeamColorContext';

function HighlightCard({ icon: Icon, label, name, nameManager, value, accent, onClick }) {
  const color = useTeamColor(nameManager);
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
      <p className={`font-bold text-sm ${nameManager ? color.text : "text-[var(--text)]"}`}>{name}</p>
      <p className={`text-xs font-mono ${accent}`}>{value}</p>
    </button>
  );
}

// While the week is still live/in-progress, every card is explicitly labeled "Projected" and driven
// by the blended projected-final numbers (not a partial leaderboard of whoever's ahead right now) --
// so it's clear these aren't real trophies yet. Once the week is fully complete, they flip to the
// real Trophy icon and the actual final numbers. Clicking a card jumps the matchup grid to that manager.
export default function WeeklyHighlights({ awards, week, isWeekFinal, onSelectManager }) {
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
        icon={icon} label={`${prefix}High Score`} name={high.manager} value={`${high.points.toFixed(2)} pts`} accent="text-amber-400"
        onClick={() => onSelectManager(high.manager)}
      />
      <HighlightCard
        icon={TrendingDown} label={`${prefix}Low Score`} name={low.manager} value={`${low.points.toFixed(2)} pts`} accent="text-rose-400"
        onClick={() => onSelectManager(low.manager)}
      />
      {closest && (
        <HighlightCard
          icon={Zap} label={`${prefix}Closest Game`} name={`${closest.a} vs ${closest.b}`}
          value={`${closest.margin.toFixed(2)} pt margin`} accent="text-blue-400"
          onClick={() => onSelectManager(closest.a)}
        />
      )}
      {blowout && (
        <HighlightCard
          icon={Flame} label={`${prefix}Biggest Blowout`} name={`${blowout.a} vs ${blowout.b}`}
          value={`${blowout.margin.toFixed(2)} pt margin`} accent="text-orange-400"
          onClick={() => onSelectManager(blowout.a)}
        />
      )}
    </div>
  );
}
