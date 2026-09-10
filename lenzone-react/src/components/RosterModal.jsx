import React from 'react';
import { X } from 'lucide-react';
import { useRosterModal } from '../context/RosterModalContext';
import { CONF_STYLES } from '../lib/theme';
import RosterList from './RosterList';
import { scoringFieldFor } from '../lib/players';

export default function RosterModal({ afcData, nfcData, afcSeason, nfcSeason, playersDB, weekProjections, selectedWeek, byTeamWeek }) {
  const { target, closeRoster } = useRosterModal();
  if (!target) return null;

  const confData = target.conf === 'AFC' ? afcData : nfcData;
  const season = target.conf === 'AFC' ? afcSeason : nfcSeason;
  const roster = confData.rosters.find(r => r.manager === target.manager);
  const fallbackField = scoringFieldFor(confData.receptionPoints || 0);
  const playersPoints = season?.rosterSnapshotByWeek?.[selectedWeek]?.[target.manager]?.playersPoints;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeRoster}>
      <div
        className="bg-slate-900/95 border border-slate-800/80 rounded-xl p-6 w-full max-w-md shadow-2xl relative max-h-[80vh] overflow-y-auto scroll-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={closeRoster} className="absolute top-3 right-3 text-slate-500 hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CONF_STYLES[target.conf].badge}`}>{target.conf}</span>
          <h2 className="font-bold text-slate-100">{target.manager}</h2>
          <span className="text-[10px] text-slate-500 ml-auto">Week {selectedWeek}</span>
        </div>

        {!roster && <p className="text-sm text-slate-500 italic">No live roster data available for this team yet.</p>}
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
