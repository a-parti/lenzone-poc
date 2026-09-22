import React, { useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { buildWeeklyRecapForWeek } from '../lib/recapText';
import { copyTextToClipboard } from '../lib/clipboard';

// One-click "copy this week's recap as text" -- built for pasting straight into a Microsoft Teams
// (or Slack/email) chat. Every line comes from data already shown on this page (weeklyAwards,
// player highlights, standings, big plays); nothing here is invented or guessed.
export default function CopyRecapButton({
  week, weeklyAwards, isWeekFinal, afcData, nfcData, afcSeason, nfcSeason, weekProjections, playersDB,
  afcStandings, nfcStandings, weekBigPlays, managerStreaks, waiverWireMvp
}) {
  const [copyState, setCopyState] = useState('idle');

  const handleCopy = async () => {
    setCopyState('copying');
    const text = buildWeeklyRecapForWeek({
      week, weeklyAwards, isWeekFinal, afcData, nfcData, afcSeason, nfcSeason, weekProjections, playersDB,
      afcStandings, nfcStandings, bigPlays: weekBigPlays, managerStreaks, waiverWireMvp
    });
    try {
      await copyTextToClipboard(text);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
    setTimeout(() => setCopyState('idle'), 2200);
  };

  if (!weeklyAwards) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={copyState === 'copying'}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--border)]/80 bg-[var(--surface)]/60 text-[var(--text2)] hover:text-[var(--text)] hover:border-[var(--border2)] transition-all duration-200"
    >
      {copyState === 'copied' ? <Check className="w-3.5 h-3.5 text-[var(--pos)]" /> : copyState === 'error' ? <X className="w-3.5 h-3.5 text-[var(--neg)]" /> : <Copy className="w-3.5 h-3.5" />}
      {copyState === 'copying' ? "Copying…" : copyState === 'copied' ? "Copied!" : copyState === 'error' ? "Couldn't copy" : "Copy Recap for Teams"}
    </button>
  );
}
