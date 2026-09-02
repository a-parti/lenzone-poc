import React, { useState } from 'react';
import { CONF_STYLES } from '../lib/theme';
import { ConfFilterToggle } from './shared';
import RosterList from './RosterList';
import TeamName from './TeamName';

export default function RosterTab({ afcData, nfcData, playersDB, playersLoading }) {
  const [conf, setConf] = useState('ALL');
  const [team, setTeam] = useState('ALL');

  const pool = [
    ...(conf !== 'NFC' ? afcData.rosters.map(r => ({ ...r, conf: 'AFC', startingSlots: afcData.startingSlots || [], irSlotCount: afcData.irSlotCount || 0 })) : []),
    ...(conf !== 'AFC' ? nfcData.rosters.map(r => ({ ...r, conf: 'NFC', startingSlots: nfcData.startingSlots || [], irSlotCount: nfcData.irSlotCount || 0 })) : [])
  ];
  const visible = team === 'ALL' ? pool : pool.filter(r => r.manager === team);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-4 rounded-xl">
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">Conference</label>
          <ConfFilterToggle value={conf} onChange={(v) => { setConf(v); setTeam('ALL'); }} />
        </div>
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">Team</label>
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="bg-slate-950 border border-slate-800/80 text-sm rounded-lg px-3 py-1.5 text-slate-200"
          >
            <option value="ALL">All Teams</option>
            {pool.map(r => <option key={r.manager} value={r.manager}>{r.manager}</option>)}
          </select>
        </div>
      </div>

      {playersLoading && <div className="text-sm text-slate-500 italic">Loading player database from Sleeper...</div>}
      {!playersLoading && pool.length === 0 && (
        <div className="text-sm text-slate-500 italic">Connect a Sleeper League ID (Standings tab, admin mode) to view rosters.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.map(r => (
          <div key={r.manager} className={`bg-slate-900/60 backdrop-blur-md border ${CONF_STYLES[r.conf].border} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CONF_STYLES[r.conf].badge}`}>{r.conf}</span>
              <TeamName manager={r.manager} conf={r.conf} className="font-bold" />
            </div>
            <RosterList roster={r} startingSlots={r.startingSlots} irSlotCount={r.irSlotCount} playersDB={playersDB} />
          </div>
        ))}
      </div>
    </div>
  );
}
