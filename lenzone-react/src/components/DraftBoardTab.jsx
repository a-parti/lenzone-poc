import React, { useState } from 'react';
import { PositionBadge, InjuryBadge, NflTeamTag, SkeletonRows } from './shared';
import TeamName from './TeamName';
import PlayerAvatar from './PlayerAvatar';
import PlayerNameButton from './PlayerNameButton';
import { useTeamColor } from '../context/TeamColorContext';
import { playerLabel } from '../lib/players';
import { CONF_STYLES } from '../lib/theme';

function DraftPickCard({ p, conf, rosterIdMap, playersDB }) {
  const manager = rosterIdMap[p.roster_id] || `Roster ${p.roster_id}`;
  const color = useTeamColor(manager);
  const playerName = `${p.metadata?.first_name || ''} ${p.metadata?.last_name || ''}`.trim();
  // Current injury status/team/number (not the draft-day metadata snapshot) -- reflects the
  // player's real, present-day info.
  const live = playersDB ? playerLabel(playersDB, p.player_id) : null;
  return (
    <div className={`bg-[var(--surface)]/60 backdrop-blur-md border ${color.border} rounded-lg p-3 hover:border-[var(--border2)] transition-all duration-200`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <PlayerAvatar playerId={p.player_id} position={p.metadata?.position} className="w-10 h-10" />
          <PlayerNameButton playerId={p.player_id} name={playerName} position={p.metadata?.position} className="font-bold text-[var(--text)] text-base leading-tight truncate" />
        </div>
        <span className="text-xs font-extrabold text-[var(--text)] bg-[var(--surface2)] px-2 py-0.5 rounded shrink-0">
          #{p.pick_no} ({p.round}.{p.pick_no - (p.round - 1) * 12})
        </span>
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <PositionBadge position={p.metadata?.position} />
        <NflTeamTag team={live?.team || p.metadata?.team} number={live?.number} />
        <InjuryBadge status={live?.injuryStatus} />
      </div>
      <TeamName manager={manager} conf={conf} className="text-xs font-semibold truncate block" />
    </div>
  );
}

export default function DraftBoardTab({ afcDraft, nfcDraft, afcRosterIdMap, nfcRosterIdMap, loading, playersDB }) {
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
      <div className="flex items-center gap-4 bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 p-4 rounded-xl">
        <span className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)]">Conference</span>
        <div className="inline-flex rounded-lg bg-[var(--bg)] p-1 border border-[var(--border)]/80">
          {["AFC", "NFC"].map(c => (
            <button
              key={c}
              onClick={() => setConf(c)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all duration-200 ${
                conf === c ? `${CONF_STYLES[c].button} text-white` : "text-[var(--text2)] hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading && <SkeletonRows rows={4} />}
      {!loading && rounds.length === 0 && (
        <div className="text-sm text-[var(--muted)] italic">No completed {conf} draft found yet.</div>
      )}

      <div className="space-y-4">
        {rounds.map(round => (
          <div key={round}>
            <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] mb-2">Round {round}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {picksByRound[round].map(p => (
                <DraftPickCard key={p.pick_no} p={p} conf={conf} rosterIdMap={rosterIdMap} playersDB={playersDB} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
