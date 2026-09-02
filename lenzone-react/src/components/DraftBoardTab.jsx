import React, { useState } from 'react';
import { PositionBadge } from './shared';
import TeamName from './TeamName';
import PlayerAvatar from './PlayerAvatar';
import PlayerNameButton from './PlayerNameButton';
import { useTeamColor } from '../context/TeamColorContext';

function DraftPickCard({ p, conf, rosterIdMap }) {
  const manager = rosterIdMap[p.roster_id] || `Roster ${p.roster_id}`;
  const color = useTeamColor(manager);
  const playerName = `${p.metadata?.first_name || ''} ${p.metadata?.last_name || ''}`.trim();
  return (
    <div className={`bg-slate-900/60 backdrop-blur-md border ${color.border} rounded-lg p-3 hover:border-slate-700 transition-all duration-200`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <PlayerAvatar playerId={p.player_id} position={p.metadata?.position} className="w-10 h-10" />
          <PlayerNameButton playerId={p.player_id} name={playerName} position={p.metadata?.position} className="font-bold text-slate-100 text-base leading-tight truncate" />
        </div>
        <span className="text-xs font-extrabold text-slate-200 bg-slate-800 px-2 py-0.5 rounded shrink-0">
          #{p.pick_no} ({p.round}.{p.pick_no - (p.round - 1) * 12})
        </span>
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <PositionBadge position={p.metadata?.position} />
        <span className="text-xs text-slate-500">{p.metadata?.team}</span>
      </div>
      <TeamName manager={manager} conf={conf} className="text-xs font-semibold truncate block" />
    </div>
  );
}

export default function DraftBoardTab({ afcDraft, nfcDraft, afcRosterIdMap, nfcRosterIdMap, loading }) {
  const [conf, setConf] = useState('AFC');

  const draft = conf === 'NFC' ? nfcDraft : afcDraft;
  const rosterIdMap = conf === 'NFC' ? nfcRosterIdMap : afcRosterIdMap;

  const picksByRound = {};
  (draft?.picks || []).forEach(p => {
    if (!picksByRound[p.round]) picksByRound[p.round] = [];
    picksByRound[p.round].push(p);
  });
  Object.values(picksByRound).forEach(list => list.sort((a, b) => a.pick_no - b.pick_no));
  const rounds = Object.keys(picksByRound).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-4 rounded-xl">
        <span className="tracking-wider text-xs uppercase font-semibold text-slate-400">Conference</span>
        <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800/80">
          {["AFC", "NFC"].map(c => (
            <button
              key={c}
              onClick={() => setConf(c)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all duration-200 ${
                conf === c ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-sm text-slate-500 italic">Loading draft results from Sleeper...</div>}
      {!loading && rounds.length === 0 && (
        <div className="text-sm text-slate-500 italic">No completed {conf} draft found yet.</div>
      )}

      <div className="space-y-4">
        {rounds.map(round => (
          <div key={round}>
            <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 mb-2">Round {round}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {picksByRound[round].map(p => (
                <DraftPickCard key={p.pick_no} p={p} conf={conf} rosterIdMap={rosterIdMap} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
