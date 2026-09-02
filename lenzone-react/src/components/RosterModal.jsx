import React from 'react';
import { X } from 'lucide-react';
import { useRosterModal } from '../context/RosterModalContext';
import { CONF_STYLES } from '../lib/theme';
import RosterList from './RosterList';

export default function RosterModal({ afcData, nfcData, playersDB }) {
  const { target, closeRoster } = useRosterModal();
  if (!target) return null;

  const confData = target.conf === 'AFC' ? afcData : nfcData;
  const roster = confData.rosters.find(r => r.manager === target.manager);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeRoster}>
      <div
        className="bg-slate-900/95 border border-slate-800/80 rounded-xl p-6 w-full max-w-md shadow-2xl relative max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={closeRoster} className="absolute top-3 right-3 text-slate-500 hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CONF_STYLES[target.conf].badge}`}>{target.conf}</span>
          <h2 className="font-bold text-slate-100">{target.manager}</h2>
        </div>

        {!roster && <p className="text-sm text-slate-500 italic">No live roster data available for this team yet.</p>}
        {roster && <RosterList roster={roster} startingSlots={confData.startingSlots || []} irSlotCount={confData.irSlotCount || 0} playersDB={playersDB} />}
      </div>
    </div>
  );
}
