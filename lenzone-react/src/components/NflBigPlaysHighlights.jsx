import React from 'react';
import { Rocket, Footprints, Goal, Shield, Swords } from 'lucide-react';
import { NflTeamTag } from './shared';

function BigPlayCard({ icon: Icon, label, play, accent, suffix, playerName }) {
  if (!play) return null;
  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">{label}</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        {play.team && <NflTeamTag team={play.team} />}
        <span className={`font-mono font-bold text-lg ${accent}`}>{play.yards} {suffix}</span>
      </div>
      {playerName && <p className="font-bold text-sm text-[var(--text)] leading-snug line-clamp-2">{playerName}</p>}
      <p className="text-xs text-[var(--muted)] leading-snug line-clamp-2">{play.text}</p>
      {play.event && <p className="text-[10px] text-[var(--muted)] mt-1">{play.event}</p>}
    </div>
  );
}

// Real league-wide "big plays" for the week -- from ESPN's actual play-by-play (see
// lib/espnApi.js fetchWeekBigPlays). These are real-NFL facts, not fantasy-team stats, so they
// sit in their own clearly separated section (a divider above, not just another item in the same
// stack) rather than blending into the fantasy trophy cards above. Renders nothing while loading
// or once nothing at all comes back, rather than a placeholder/spinner -- it's a bonus section,
// not something worth calling attention to being unavailable.
export default function NflBigPlaysHighlights({ bigPlays }) {
  if (!bigPlays) return null;
  const { longestReception, longestRun, longestFieldGoal, longestInterceptionReturn, biggestSack } = bigPlays;
  if (!longestReception && !longestRun && !longestFieldGoal && !longestInterceptionReturn && !biggestSack) return null;

  return (
    <div className="pt-6 mt-2 border-t-2 border-dashed border-[var(--border)]/60 space-y-3">
      <p className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">NFL Big Plays (Real, League-Wide)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <BigPlayCard
          icon={Rocket} label="Longest Pass (QB)" play={longestReception} accent="text-sky-400" suffix="yds"
          playerName={longestReception?.passerName}
        />
        <BigPlayCard
          icon={Rocket} label="Longest Reception" play={longestReception} accent="text-cyan-400" suffix="yds"
          playerName={longestReception?.receiverName}
        />
        <BigPlayCard icon={Footprints} label="Longest Run" play={longestRun} accent="text-emerald-400" suffix="yds" playerName={longestRun?.playerName} />
        <BigPlayCard icon={Goal} label="Longest Field Goal" play={longestFieldGoal} accent="text-amber-400" suffix="yds" playerName={longestFieldGoal?.playerName} />
        <BigPlayCard
          icon={Shield} label="Longest Interception Return" play={longestInterceptionReturn} accent="text-indigo-400" suffix="yds"
          playerName={longestInterceptionReturn?.playerName}
        />
        <BigPlayCard icon={Swords} label="Biggest Sack" play={biggestSack} accent="text-rose-400" suffix="yds lost" playerName={biggestSack?.playerName} />
      </div>
    </div>
  );
}
