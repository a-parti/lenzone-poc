import React, { useState } from 'react';
import { CONF_STYLES } from '../lib/theme';
import { ConfFilterToggle } from './shared';
import RosterList from './RosterList';
import TeamName from './TeamName';
import { scoringFieldFor, computeTeamWeeklyTotals } from '../lib/players';

const SORT_OPTIONS = {
  DEFAULT: { label: "Default", accessor: null },
  PROJECTED_DESC: { label: "Projected Total (High to Low)", accessor: r => r.teamTotals.projectedAll, dir: -1 },
  ACTUAL_DESC: { label: "Actual Total (High to Low)", accessor: r => r.teamTotals.actualPosted, dir: -1 }
};

export default function RosterTab({ afcData, nfcData, afcSeason, nfcSeason, playersDB, playersLoading, weekProjections, selectedWeek, setSelectedWeek, seasonWeeks, byTeamWeek }) {
  const [conf, setConf] = useState('ALL');
  const [team, setTeam] = useState('ALL');
  const [sortKey, setSortKey] = useState('DEFAULT');

  const afcFallbackField = scoringFieldFor(afcData.receptionPoints || 0);
  const nfcFallbackField = scoringFieldFor(nfcData.receptionPoints || 0);

  const pool = [
    ...(conf !== 'NFC' ? afcData.rosters.map(r => ({
      ...r, conf: 'AFC', startingSlots: afcData.startingSlots || [], irSlotCount: afcData.irSlotCount || 0,
      scoringSettings: afcData.scoringSettings, fallbackField: afcFallbackField,
      playersPoints: afcSeason?.rosterSnapshotByWeek?.[selectedWeek]?.[r.manager]?.playersPoints
    })) : []),
    ...(conf !== 'AFC' ? nfcData.rosters.map(r => ({
      ...r, conf: 'NFC', startingSlots: nfcData.startingSlots || [], irSlotCount: nfcData.irSlotCount || 0,
      scoringSettings: nfcData.scoringSettings, fallbackField: nfcFallbackField,
      playersPoints: nfcSeason?.rosterSnapshotByWeek?.[selectedWeek]?.[r.manager]?.playersPoints
    })) : [])
  ].map(r => ({
    ...r,
    teamTotals: computeTeamWeeklyTotals(r.starters, weekProjections, r.scoringSettings, r.fallbackField, r.playersPoints)
  }));
  const visible = team === 'ALL' ? pool : pool.filter(r => r.manager === team);
  const sortDef = SORT_OPTIONS[sortKey];
  const sorted = sortDef.accessor
    ? [...visible].sort((a, b) => {
        const av = sortDef.accessor(a), bv = sortDef.accessor(b);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av - bv) * sortDef.dir;
      })
    : visible;

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
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">Projected Pts Week</label>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800/80 text-sm rounded-lg px-3 py-1.5 text-slate-200"
          >
            {Array.from({ length: seasonWeeks }, (_, i) => i + 1).map(w => (
              <option key={w} value={w}>Week {w}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">Sort By</label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="bg-slate-950 border border-slate-800/80 text-sm rounded-lg px-3 py-1.5 text-slate-200"
          >
            {Object.entries(SORT_OPTIONS).map(([key, opt]) => (
              <option key={key} value={key}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {playersLoading && <div className="text-sm text-slate-500 italic">Loading player database from Sleeper...</div>}
      {!playersLoading && pool.length === 0 && (
        <div className="text-sm text-slate-500 italic">Connect a Sleeper League ID (Standings tab, admin mode) to view rosters.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.map(r => (
          <div key={r.manager} className={`bg-slate-900/60 backdrop-blur-md border ${CONF_STYLES[r.conf].border} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CONF_STYLES[r.conf].badge}`}>{r.conf}</span>
              <TeamName manager={r.manager} conf={r.conf} className="font-bold" />
            </div>
            <RosterList
              roster={r} startingSlots={r.startingSlots} irSlotCount={r.irSlotCount} playersDB={playersDB}
              weekProjections={weekProjections} scoringSettings={r.scoringSettings} fallbackField={r.fallbackField}
              playersPoints={r.playersPoints} byTeamWeek={byTeamWeek} week={selectedWeek}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
