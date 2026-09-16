import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { buildWeeklyRecapText } from '../lib/recapText';
import { computePlayerHighlights, computeLineupAccuracy, computeWorstLineupDecision } from '../lib/players';
import { computeBenchPointsAward } from '../lib/statsMath';

// One-click "copy this week's recap as text" -- built for pasting straight into a Microsoft Teams
// (or Slack/email) chat. Every line comes from data already shown on this page (weeklyAwards,
// player highlights, standings, big plays); nothing here is invented or guessed.
export default function CopyRecapButton({
  week, weeklyAwards, isWeekFinal, afcData, nfcData, afcSeason, nfcSeason, weekProjections, playersDB,
  afcStandings, nfcStandings, weekBigPlays
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const playerHighlights = computePlayerHighlights(afcData, nfcData, afcSeason, nfcSeason, week, weekProjections);
    const lineupAccuracy = isWeekFinal ? computeLineupAccuracy(afcData, nfcData, afcSeason, nfcSeason, week, playersDB) : null;
    const worstLineupDecision = isWeekFinal ? computeWorstLineupDecision(afcData, nfcData, afcSeason, nfcSeason, week, playersDB) : null;
    const benchPointsAward = computeBenchPointsAward(afcData, nfcData, afcSeason, nfcSeason, week);
    // Global recap -- both conferences' top 3, always, regardless of what the viewer happens to
    // be filtered to on-screen right now.
    const text = buildWeeklyRecapText({
      week, weeklyAwards, playerHighlights, lineupAccuracy, worstLineupDecision, benchPointsAward,
      bigPlays: weekBigPlays, playersDB,
      afcStandingsTop3: (afcStandings || []).filter(r => r.rank <= 3),
      nfcStandingsTop3: (nfcStandings || []).filter(r => r.rank <= 3)
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied or unavailable -- nothing more to do, button just doesn't flip
      // to "Copied!" (no error dialog for a purely convenience action).
    }
  };

  if (!weeklyAwards) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/60 text-[var(--text2)] hover:text-[var(--text)] hover:border-[var(--border2)] transition-all duration-200"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[var(--pos)]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy Recap for Teams"}
    </button>
  );
}
