import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useRosterModal } from '../context/RosterModalContext';
import { useTeamLogo } from '../context/TeamLogoContext';
import { Zoomable } from '../context/ImageLightboxContext';
import { CONF_STYLES } from '../lib/theme';
import RosterList from './RosterList';
import { scoringFieldFor } from '../lib/players';
import { useEscapeKey } from './shared';
import { nextModalZ } from '../lib/modalStack';

export default function RosterModal({ afcData, nfcData, afcSeason, nfcSeason, playersDB, weekProjections, selectedWeek, byTeamWeek }) {
  const { target, closeRoster } = useRosterModal();
  useEscapeKey(closeRoster);
  // Claims a fresh top-of-stack z-index each time this opens, so it renders above whatever else
  // was already open (e.g. opened from inside a depth chart or player card) instead of the two
  // fighting over a shared fixed z-index by DOM order alone.
  const [z, setZ] = useState(60);
  useEffect(() => { if (target) setZ(nextModalZ()); }, [target]);
  if (!target) return null;

  const confData = target.conf === 'AFC' ? afcData : nfcData;
  const season = target.conf === 'AFC' ? afcSeason : nfcSeason;
  const roster = confData.rosters.find(r => r.manager === target.manager);
  const fallbackField = scoringFieldFor(confData.receptionPoints || 0);
  const playersPoints = season?.rosterSnapshotByWeek?.[selectedWeek]?.[target.manager]?.playersPoints;
  const logoUrl = useTeamLogo(target.manager);

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
          {logoUrl && (
            <Zoomable src={logoUrl} alt={target.manager} className="w-16 h-16 rounded-full object-cover shrink-0 border-2 border-[var(--border)]" />
          )}
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
