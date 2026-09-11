import React, { useMemo, useState, useEffect } from 'react';
import { PositionBadge, InjuryBadge, SkeletonRows } from './shared';
import TeamName from './TeamName';
import { playerLabel, buildOwnerMap, buildAcquisitionHistory } from '../lib/players';
import PlayerNameButton from './PlayerNameButton';

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
    <th className="py-3 px-4 cursor-pointer select-none hover:text-[var(--text)] transition-colors duration-150" onClick={() => onClick(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[9px] ${active ? "text-[var(--text2)]" : "text-[var(--muted)]"}`}>{active && dir === 'desc' ? "▼" : "▲"}</span>
      </span>
    </th>
  );
}

const FANTASY_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];
const FLEX_POSITIONS = ["RB", "WR", "TE"];

export default function PlayersTab({ afcData, nfcData, afcDraft, nfcDraft, afcTransactions, nfcTransactions, afcManagers, nfcManagers, playersDB, playersLoading, focusManager, focusConf }) {
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('ALL');
  const [confFilter, setConfFilter] = useState(focusConf || 'ALL');
  const [teamFilter, setTeamFilter] = useState(focusManager || 'ALL');
  const [nflTeamFilter, setNflTeamFilter] = useState('ALL');
  const [rosteredOnly, setRosteredOnly] = useState(true);
  const [sortKey, setSortKey] = useState('afcAcquired');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    if (focusManager && focusConf) {
      setConfFilter(focusConf);
      setTeamFilter(focusManager);
    }
  }, [focusManager, focusConf]);

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
      <div className="flex flex-wrap items-end gap-4 bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 p-4 rounded-xl">
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)] block mb-1">Search Player</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Player name..."
            className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm rounded-lg px-3 py-1.5 text-[var(--text)] w-44"
          />
        </div>
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)] block mb-1">Position</label>
          <select value={position} onChange={(e) => setPosition(e.target.value)} className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm rounded-lg px-3 py-1.5 text-[var(--text)]">
            {positions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)] block mb-1">Conference</label>
          <select
            value={confFilter}
            onChange={(e) => { setConfFilter(e.target.value); setTeamFilter('ALL'); }}
            className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm rounded-lg px-3 py-1.5 text-[var(--text)]"
          >
            <option value="ALL">ALL</option>
            <option value="AFC">AFC</option>
            <option value="NFC">NFC</option>
          </select>
        </div>
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)] block mb-1">Fantasy Team</label>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm rounded-lg px-3 py-1.5 text-[var(--text)] max-w-[10rem]">
            <option value="ALL">All Teams</option>
            {fantasyTeamOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)] block mb-1">NFL Team</label>
          <select value={nflTeamFilter} onChange={(e) => setNflTeamFilter(e.target.value)} className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm rounded-lg px-3 py-1.5 text-[var(--text)]">
            <option value="ALL">ALL</option>
            {nflTeamOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text2)] cursor-pointer pb-1.5">
          <input
            type="checkbox"
            checked={rosteredOnly}
            onChange={(e) => setRosteredOnly(e.target.checked)}
            className="accent-[var(--accent)] w-4 h-4"
          />
          Rostered only
        </label>
      </div>

      {playersLoading && <SkeletonRows rows={4} />}

      <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[var(--text2)]">
            <thead className="bg-[var(--bg)]/80 tracking-wider text-xs uppercase font-semibold text-[var(--text2)] border-b border-[var(--border)]/80">
              <tr>
                <SortHeader label="Player" sortKey="name" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="Pos" sortKey="position" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="AFC Owner" sortKey="afcOwner" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="AFC Acquired" sortKey="afcAcquired" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="NFC Owner" sortKey="nfcOwner" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="NFC Acquired" sortKey="nfcAcquired" activeKey={sortKey} dir={sortDir} onClick={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/60">
              {sorted.map(r => (
                <tr key={r.id} className="hover:bg-[var(--surface2)]/30 transition-all duration-200">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <PlayerNameButton playerId={r.id} name={r.name} position={r.position} className="font-semibold text-[var(--text)]" />
                      <span className="text-xs text-[var(--muted)]">{r.nflTeam}</span>
                      <InjuryBadge status={r.injuryStatus} />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <PositionBadge position={r.position} />
                      {r.depthChart && (
                        <span className="text-[10px] font-mono text-[var(--muted)] bg-[var(--surface2)]/60 px-1.5 py-0.5 rounded">{r.depthChart}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {r.afcOwner ? <TeamName manager={r.afcOwner} conf="AFC" /> : <span className="text-[var(--muted)] italic">Unrostered</span>}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-[var(--text2)]">
                    {r.afcHistory ? (
                      <div className="space-y-0.5">
                        {r.afcHistory.map((e, i) => <p key={i}>{e.label}</p>)}
                      </div>
                    ) : "Undrafted / FA"}
                  </td>
                  <td className="py-3 px-4">
                    {r.nfcOwner ? <TeamName manager={r.nfcOwner} conf="NFC" /> : <span className="text-[var(--muted)] italic">Unrostered</span>}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-[var(--text2)]">
                    {r.nfcHistory ? (
                      <div className="space-y-0.5">
                        {r.nfcHistory.map((e, i) => <p key={i}>{e.label}</p>)}
                      </div>
                    ) : "Undrafted / FA"}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={6} className="py-6 px-4 text-center text-[var(--muted)] italic">No players match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
