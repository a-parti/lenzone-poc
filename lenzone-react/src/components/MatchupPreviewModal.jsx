import React, { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useMatchupPreview } from '../context/MatchupPreviewContext';
import { useEscapeKey } from './shared';
import { nextModalZ } from '../lib/modalStack';
import { CONF_STYLES } from '../lib/theme';
import ManagerMatchupRow from './ManagerMatchupRow';
import TeamName from './TeamName';

// Global "quick look" card for a matchup clicked from somewhere that isn't already the Matchups
// tab (currently: the season Grid) -- shows the same scores/W-L-T/"Expand Rosters" card the
// Matchups tab itself uses (ManagerMatchupRow, so nothing here can drift from what that tab
// shows), with a button to jump straight into the full Matchups tab for that manager/week.
// computeIntra/computeInter (functions of (manager, conf, week)): small wrapper closures built in
// App.jsx around the existing getIntraInfo/getInterInfo builders, which already need afcSeason/
// nfcSeason/allStats/etc in scope -- this component stays a plain, focused presentational modal.
export default function MatchupPreviewModal({ computeIntra, computeInter, afcSlots, nfcSlots, playersDB, weekProjections, byTeamWeek, onOpenFullMatchup }) {
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
        {/* The conf badge lives here, once -- ManagerMatchupRow gets hideHeader so it doesn't
            render its own second copy of the same badge + team name right above its own content. */}
        <div className="flex items-center gap-2 mb-3 pr-6 min-w-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${CONF_STYLES[conf].badge}`}>{conf}</span>
          <TeamName manager={manager} conf={conf} className="font-bold min-w-0" />
          <span className="text-xs text-[var(--muted)] ml-auto shrink-0">Week {week}</span>
        </div>
        <ManagerMatchupRow
          manager={manager} conf={conf} intra={intra} inter={inter}
          afcSlots={afcSlots} nfcSlots={nfcSlots} playersDB={playersDB}
          weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={week}
          hideHeader
        />
        <button
          type="button"
          onClick={() => { onOpenFullMatchup(manager, week); closePreview(); }}
          className="w-full mt-3 flex items-center justify-center gap-2 text-sm font-bold px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-text)] hover:brightness-110 transition-all duration-200"
        >
          Open Full Matchup <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
