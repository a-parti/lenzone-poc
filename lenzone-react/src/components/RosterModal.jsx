import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useRosterModal } from '../context/RosterModalContext';
import { useTeamLogo } from '../context/TeamLogoContext';
import { Zoomable } from '../context/ImageLightboxContext';
import { CONF_STYLES } from '../lib/theme';
import RosterList from './RosterList';
import { scoringFieldFor } from '../lib/players';
import { useEscapeKey } from './shared';
import { nextModalZ } from '../lib/modalStack';
import { getRealName } from '../lib/realNames';
import { pickSpeechBubbleLine, findRankAndConf } from '../lib/speechBubble';

export default function RosterModal({ afcData, nfcData, afcSeason, nfcSeason, playersDB, weekProjections, selectedWeek, byTeamWeek, trophyLinesByManager, afcStandings, nfcStandings, weekResultByManager, managerStreaks }) {
  const { target, closeRoster } = useRosterModal();
  useEscapeKey(closeRoster);
  // Claims a fresh top-of-stack z-index each time this opens, so it renders above whatever else
  // was already open (e.g. opened from inside a depth chart or player card) instead of the two
  // fighting over a shared fixed z-index by DOM order alone.
  const [z, setZ] = useState(60);
  useEffect(() => { if (target) setZ(nextModalZ()); }, [target]);
  // useTeamLogo must run on every render, target or not -- a hook called only on the renders
  // where target happens to be set (i.e. after an early return like the one below) changes how
  // many hooks this component calls from one render to the next, which breaks React's hook order
  // and throws in dev. Passing it undefined when there's no target yet is harmless.
  const logoUrl = useTeamLogo(target?.manager);
  // realName/bubbleText must also be computed unconditionally (same reasoning as useTeamLogo
  // above) -- getRealName/pickSpeechBubbleLine are cheap pure functions, safe to call with a null
  // target. Memoized so the random pick doesn't flicker between lines on unrelated re-renders
  // while the same roster stays open.
  const realName = target ? getRealName(afcData, nfcData, target.manager) : null;
  const bubbleText = useMemo(() => {
    if (!target || !realName) return null;
    const { rank, conf } = findRankAndConf(target.manager, afcStandings, nfcStandings);
    return pickSpeechBubbleLine(realName, target.manager, {
      trophyLines: trophyLinesByManager?.[target.manager], rank, conf,
      weekResult: weekResultByManager?.[target.manager], streak: managerStreaks?.[target.manager]
    });
  }, [target, realName, trophyLinesByManager, afcStandings, nfcStandings, weekResultByManager, managerStreaks]);
  if (!target) return null;

  const confData = target.conf === 'AFC' ? afcData : nfcData;
  const season = target.conf === 'AFC' ? afcSeason : nfcSeason;
  const roster = confData.rosters.find(r => r.manager === target.manager);
  const fallbackField = scoringFieldFor(confData.receptionPoints || 0);
  const playersPoints = season?.rosterSnapshotByWeek?.[selectedWeek]?.[target.manager]?.playersPoints;

  return (
    <div className="fixed inset-0 bg-[var(--bg)]/80 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: z }} onClick={closeRoster}>
      <div
        className="bg-[var(--surface)]/95 border border-[var(--border)]/80 rounded-xl p-6 w-full max-w-md shadow-2xl relative max-h-[80vh] overflow-y-auto scroll-thin"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${target.manager} roster`}
      >
        <button onClick={closeRoster} aria-label="Close" className="absolute top-3 right-3 text-[var(--muted)] hover:text-[var(--text)]">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative shrink-0">
            {logoUrl && (
              <Zoomable src={logoUrl} alt={target.manager} className="w-16 h-16 rounded-full object-cover border-2 border-[var(--border)]" />
            )}
            {/* A little speech bubble pointing at the logo, not just plain caption text underneath
                -- "who's actually behind this team" reads more like an introduction that way. */}
            {bubbleText && (
              <div className="absolute -top-2 left-[85%] z-10 w-44 pointer-events-none">
                <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-xl px-2.5 py-1 shadow-md">
                  <span className="text-xs font-semibold text-[var(--text)] leading-snug">{bubbleText}</span>
                  <div className="absolute top-1/2 -left-[5px] -translate-y-1/2 w-2.5 h-2.5 bg-[var(--surface)] border-l border-b border-[var(--border)] rotate-45" />
                </div>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CONF_STYLES[target.conf].badge}`}>{target.conf}</span>
            <h2 className="font-display text-xl font-bold text-[var(--text)] truncate">{target.manager}</h2>
          </div>
          <span className="text-[10px] text-[var(--muted)] ml-auto shrink-0">Week {selectedWeek}</span>
        </div>

        {!roster && <p className="text-sm text-[var(--muted)] italic">No live roster data available for this team yet.</p>}
        {roster && (
          <RosterList
            roster={roster} startingSlots={confData.startingSlots || []} irSlotCount={confData.irSlotCount || 0} playersDB={playersDB}
            weekProjections={weekProjections} scoringSettings={confData.scoringSettings} fallbackField={fallbackField} playersPoints={playersPoints}
            byTeamWeek={byTeamWeek} week={selectedWeek}
          />
        )}
      </div>
    </div>
  );
}
