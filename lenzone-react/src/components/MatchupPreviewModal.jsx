import React, { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useMatchupPreview } from '../context/MatchupPreviewContext';
import { useEscapeKey } from './shared';
import { nextModalZ } from '../lib/modalStack';
import { CONF_STYLES } from '../lib/theme';
import MyMatchups from './MyMatchups';
import TeamName from './TeamName';

// Global "quick look" at one team's week, opened from the Matchups tab's games list, the scores
// chart, the season grid and trophy cards -- the same scoreboard cards and head-to-head lineups as
// My Week (MyMatchups), with a button to jump to the Matchups tab for that week.
// computeIntra/computeInter (functions of (manager, conf, week)): small wrapper closures built in
// App.jsx around the existing getIntraInfo/getInterInfo builders, which already need afcSeason/
// nfcSeason/allStats/etc in scope -- this component stays a plain, focused presentational modal.
export default function MatchupPreviewModal({ computeIntra, computeInter, afcSlots, nfcSlots, standings, playersDB, weekProjections, byTeamWeek, onOpenFullMatchup }) {
  const { target, closePreview } = useMatchupPreview();
  useEscapeKey(closePreview);
  const [z, setZ] = useState(60);
  useEffect(() => { if (target) setZ(nextModalZ()); }, [target]);
  if (!target) return null;

  const { manager, conf, week } = target;
  const intra = computeIntra(manager, conf, week);
  const inter = computeInter(manager, conf, week);

  return (
    <div className="fixed inset-0 bg-[var(--bg)]/80 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: z }} onClick={closePreview}>
      <div
        className="bg-[var(--surface)]/95 border border-[var(--border)]/80 rounded-xl p-5 w-full max-w-3xl shadow-2xl relative max-h-[85vh] overflow-y-auto scroll-thin"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${manager} -- Week ${week} matchup preview`}
      >
        <button onClick={closePreview} aria-label="Close" className="absolute top-3 right-3 text-[var(--muted)] hover:text-[var(--text)]">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 mb-3 pr-6 min-w-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${CONF_STYLES[conf].badge}`}>{conf}</span>
          <TeamName manager={manager} conf={conf} className="font-bold min-w-0" />
          <span className="text-xs text-[var(--muted)] ml-auto shrink-0">Week {week}</span>
        </div>
        <MyMatchups
          key={`${manager}-${week}`} manager={manager} conf={conf} intra={intra} inter={inter}
          afcSlots={afcSlots} nfcSlots={nfcSlots} standings={standings} playersDB={playersDB}
          weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={week}
        />
        <button
          type="button"
          onClick={() => { onOpenFullMatchup(manager, week); closePreview(); }}
          className="w-full mt-3 flex items-center justify-center gap-2 text-sm font-bold px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-text)] hover:brightness-110 transition-all duration-200"
        >
          Open Matchups tab <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
