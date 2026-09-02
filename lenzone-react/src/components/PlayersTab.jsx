import React, { useMemo, useState } from 'react';
import { PositionBadge, InjuryBadge } from './shared';
import TeamName from './TeamName';
import { playerLabel } from '../lib/players';

function buildOwnerMap(rosters) {
  const map = {};
  rosters.forEach(r => {
    r.players.forEach(id => { map[id] = r.manager; });
  });
  return map;
}

// Draft record for every drafted player, keyed by player_id
function buildDraftMap(draft) {
  const map = {};
  (draft?.picks || []).forEach(p => {
    if (p.player_id) map[p.player_id] = { round: p.round, pickInRound: p.pick_no - (p.round - 1) * 12, overall: p.pick_no };
  });
  return map;
}

// Full chronological movement history for every player: draft pick, every subsequent waiver/FA/
// trade add, and every drop -- all real Sleeper transaction data, not just the latest event.
function buildAcquisitionHistory(draft, transactions, rosterIdMap) {
  const history = {};
  const push = (id, event) => { if (!history[id]) history[id] = []; history[id].push(event); };

  const draftMap = buildDraftMap(draft);
  Object.entries(draftMap).forEach(([id, d]) => {
    push(id, { label: `Draft #${d.overall} (${d.round}.${d.pickInRound})`, sortValue: d.overall, timestamp: -1 });
  });

  const sorted = [...transactions].filter(t => t.status === 'complete').sort((a, b) => (a.created || 0) - (b.created || 0));
  sorted.forEach(t => {
    const dateStr = t.created ? new Date(t.created).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : '';
    const sortValue = 1000 + (t.created || 0) / 1e10;
    if (t.adds) {
      Object.entries(t.adds).forEach(([playerId, rosterId]) => {
        if (!rosterIdMap[rosterId]) return;
        const label = t.type === 'trade' ? `Trade (${dateStr})`
          : t.type === 'waiver' ? `Waiver (${dateStr}, $${t.settings?.waiver_bid ?? 0})`
          : `FA Add (${dateStr})`;
        push(playerId, { label, sortValue, timestamp: t.created || 0 });
      });
    }
    if (t.drops) {
      Object.entries(t.drops).forEach(([playerId, rosterId]) => {
        if (!rosterIdMap[rosterId]) return;
        push(playerId, { label: `Dropped (${dateStr})`, sortValue, timestamp: t.created || 0 });
      });
    }
  });

  Object.values(history).forEach(events => events.sort((a, b) => a.timestamp - b.timestamp));
  return history;
}

const SORT_ACCESSORS = {
  name: r => r.name.toLowerCase(),
  position: r => r.position || '',
  afcOwner: r => (r.afcOwner || '').toLowerCase(),
  afcAcquired: r => r.afcHistory?.length ? r.afcHistory[0].sortValue : Infinity,
  nfcOwner: r => (r.nfcOwner || '').toLowerCase(),
  nfcAcquired: r => r.nfcHistory?.length ? r.nfcHistory[0].sortValue : Infinity
};

function SortHeader({ label, sortKey, activeKey, dir, onClick }) {
  const active = sortKey === activeKey;
  return (
    <th className="py-3 px-4 cursor-pointer select-none hover:text-slate-200 transition-colors duration-150" onClick={() => onClick(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[9px] ${active ? "text-slate-300" : "text-slate-700"}`}>{active && dir === 'desc' ? "▼" : "▲"}</span>
      </span>
    </th>
  );
}

const FANTASY_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];
const FLEX_POSITIONS = ["RB", "WR", "TE"];

export default function PlayersTab({ afcData, nfcData, afcDraft, nfcDraft, afcTransactions, nfcTransactions, afcManagers, nfcManagers, playersDB, playersLoading }) {
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('ALL');
  const [confFilter, setConfFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [nflTeamFilter, setNflTeamFilter] = useState('ALL');
  const [rosteredOnly, setRosteredOnly] = useState(true);
  const [sortKey, setSortKey] = useState('afcAcquired');
  const [sortDir, setSortDir] = useState('asc');

  const afcOwners = useMemo(() => buildOwnerMap(afcData.rosters), [afcData.rosters]);
  const nfcOwners = useMemo(() => buildOwnerMap(nfcData.rosters), [nfcData.rosters]);
  const afcHistory = useMemo(
    () => buildAcquisitionHistory(afcDraft, afcTransactions, afcData.rosterIdMap),
    [afcDraft, afcTransactions, afcData.rosterIdMap]
  );
  const nfcHistory = useMemo(
    () => buildAcquisitionHistory(nfcDraft, nfcTransactions, nfcData.rosterIdMap),
    [nfcDraft, nfcTransactions, nfcData.rosterIdMap]
  );

  const rows = useMemo(() => {
    const buildRow = (id) => {
      const { name, position, team, injuryStatus, depthChart } = playerLabel(playersDB, id);
      return {
        id,
        name: playersDB[id] ? name : `Player ${id}`,
        position,
        nflTeam: team,
        injuryStatus,
        depthChart,
        afcOwner: afcOwners[id] || null,
        nfcOwner: nfcOwners[id] || null,
        afcHistory: afcHistory[id] || null,
        nfcHistory: nfcHistory[id] || null
      };
    };

    if (rosteredOnly) {
      const ids = new Set([
        ...Object.keys(afcOwners), ...Object.keys(nfcOwners),
        ...Object.keys(afcHistory), ...Object.keys(nfcHistory)
      ]);
      return [...ids].map(buildRow);
    }

    // Full NFL player universe, limited to fantasy-relevant positions to keep the list meaningful
    return Object.keys(playersDB)
      .filter(id => FANTASY_POSITIONS.includes(playersDB[id]?.position))
      .map(buildRow);
  }, [afcOwners, nfcOwners, afcHistory, nfcHistory, playersDB, rosteredOnly]);

  const nflTeamOptions = useMemo(
    () => [...new Set(rows.map(r => r.nflTeam).filter(Boolean))].sort(),
    [rows]
  );
  const fantasyTeamOptions = confFilter === 'NFC' ? nfcManagers : confFilter === 'AFC' ? afcManagers : [...afcManagers, ...nfcManagers];

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = rows
    .filter(r => position === 'ALL' || (position === 'FLEX' ? FLEX_POSITIONS.includes(r.position) : r.position === position))
    .filter(r => nflTeamFilter === 'ALL' || r.nflTeam === nflTeamFilter)
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .filter(r => {
      if (confFilter === 'AFC') return !!r.afcOwner || !!r.afcHistory;
      if (confFilter === 'NFC') return !!r.nfcOwner || !!r.nfcHistory;
      return true;
    })
    .filter(r => teamFilter === 'ALL' || r.afcOwner === teamFilter || r.nfcOwner === teamFilter);

  const sorted = [...filtered].sort((a, b) => {
    const av = SORT_ACCESSORS[sortKey](a);
    const bv = SORT_ACCESSORS[sortKey](b);
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const positions = ["ALL", "QB", "RB", "WR", "TE", "FLEX", "K", "DEF"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-4 rounded-xl">
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">Search Player</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Player name..."
            className="bg-slate-950 border border-slate-800/80 text-sm rounded-lg px-3 py-1.5 text-slate-200 w-44"
          />
        </div>
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">Position</label>
          <select value={position} onChange={(e) => setPosition(e.target.value)} className="bg-slate-950 border border-slate-800/80 text-sm rounded-lg px-3 py-1.5 text-slate-200">
            {positions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">Conference</label>
          <select
            value={confFilter}
            onChange={(e) => { setConfFilter(e.target.value); setTeamFilter('ALL'); }}
            className="bg-slate-950 border border-slate-800/80 text-sm rounded-lg px-3 py-1.5 text-slate-200"
          >
            <option value="ALL">ALL</option>
            <option value="AFC">AFC</option>
            <option value="NFC">NFC</option>
          </select>
        </div>
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">Fantasy Team</label>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="bg-slate-950 border border-slate-800/80 text-sm rounded-lg px-3 py-1.5 text-slate-200 max-w-[10rem]">
            <option value="ALL">All Teams</option>
            {fantasyTeamOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">NFL Team</label>
          <select value={nflTeamFilter} onChange={(e) => setNflTeamFilter(e.target.value)} className="bg-slate-950 border border-slate-800/80 text-sm rounded-lg px-3 py-1.5 text-slate-200">
            <option value="ALL">ALL</option>
            {nflTeamOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer pb-1.5">
          <input
            type="checkbox"
            checked={rosteredOnly}
            onChange={(e) => setRosteredOnly(e.target.checked)}
            className="accent-blue-500 w-4 h-4"
          />
          Rostered only
        </label>
      </div>

      {playersLoading && <div className="text-sm text-slate-500 italic">Loading player database from Sleeper...</div>}

      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 tracking-wider text-xs uppercase font-semibold text-slate-400 border-b border-slate-800/80">
              <tr>
                <SortHeader label="Player" sortKey="name" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="Pos" sortKey="position" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="AFC Owner" sortKey="afcOwner" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="AFC Acquired" sortKey="afcAcquired" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="NFC Owner" sortKey="nfcOwner" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="NFC Acquired" sortKey="nfcAcquired" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sorted.map(r => (
                <tr key={r.id} className="hover:bg-slate-800/30 transition-all duration-200">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">{r.name}</span>
                      <span className="text-xs text-slate-500">{r.nflTeam}</span>
                      <InjuryBadge status={r.injuryStatus} />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <PositionBadge position={r.position} />
                      {r.depthChart && (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">{r.depthChart}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {r.afcOwner ? <TeamName manager={r.afcOwner} conf="AFC" /> : <span className="text-slate-700 italic">Unrostered</span>}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-400">
                    {r.afcHistory ? (
                      <div className="space-y-0.5">
                        {r.afcHistory.map((e, i) => <p key={i}>{e.label}</p>)}
                      </div>
                    ) : "Undrafted / FA"}
                  </td>
                  <td className="py-3 px-4">
                    {r.nfcOwner ? <TeamName manager={r.nfcOwner} conf="NFC" /> : <span className="text-slate-700 italic">Unrostered</span>}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-400">
                    {r.nfcHistory ? (
                      <div className="space-y-0.5">
                        {r.nfcHistory.map((e, i) => <p key={i}>{e.label}</p>)}
                      </div>
                    ) : "Undrafted / FA"}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={6} className="py-6 px-4 text-center text-slate-500 italic">No players match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
