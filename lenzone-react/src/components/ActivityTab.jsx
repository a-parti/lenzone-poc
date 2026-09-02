import React, { useState } from 'react';
import { CONF_STYLES } from '../lib/theme';
import { ConfFilterToggle, PositionBadge, InjuryBadge } from './shared';
import { playerLabel } from '../lib/players';
import TeamName from './TeamName';
import PlayerAvatar from './PlayerAvatar';
import PlayerNameButton from './PlayerNameButton';

function normalize(txns, rosterIdMap, confLabel, types) {
  return txns
    .filter(t => t.status === 'complete' && types.includes(t.type))
    .map(t => {
      const byManager = {};
      const bump = (rosterId) => {
        const manager = rosterIdMap[rosterId] || `Roster ${rosterId}`;
        if (!byManager[manager]) byManager[manager] = { manager, adds: [], drops: [] };
        return byManager[manager];
      };
      if (t.adds) Object.entries(t.adds).forEach(([playerId, rosterId]) => bump(rosterId).adds.push(playerId));
      if (t.drops) Object.entries(t.drops).forEach(([playerId, rosterId]) => bump(rosterId).drops.push(playerId));

      return {
        id: t.transaction_id,
        conf: confLabel,
        type: t.type,
        created: t.created,
        teams: Object.values(byManager)
      };
    })
    .filter(t => t.teams.length > 0);
}

export default function ActivityTab({ afcTransactions, nfcTransactions, afcRosterIdMap, nfcRosterIdMap, playersDB, loading, types = ['waiver', 'free_agent', 'trade'], emptyLabel = "No add/drop activity found yet." }) {
  const [conf, setConf] = useState('ALL');

  const combined = [
    ...(conf !== 'NFC' ? normalize(afcTransactions, afcRosterIdMap, 'AFC', types) : []),
    ...(conf !== 'AFC' ? normalize(nfcTransactions, nfcRosterIdMap, 'NFC', types) : [])
  ].sort((a, b) => (b.created || 0) - (a.created || 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-4 rounded-xl">
        <span className="tracking-wider text-xs uppercase font-semibold text-slate-400">Conference</span>
        <ConfFilterToggle value={conf} onChange={setConf} />
      </div>

      {loading && <div className="text-sm text-slate-500 italic">Loading transaction history from Sleeper...</div>}
      {!loading && combined.length === 0 && <div className="text-sm text-slate-500 italic">{emptyLabel}</div>}

      <div className="space-y-3">
        {combined.map(t => (
          <div key={t.id} className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 hover:border-slate-700 transition-all duration-200">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CONF_STYLES[t.conf].badge}`}>{t.conf}</span>
              <span className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">
                {t.type === 'trade' ? 'Trade' : t.type === 'waiver' ? 'Waiver' : 'Free Agent'}
              </span>
              {t.created && (
                <span className="text-xs text-slate-600 ml-auto">
                  {new Date(t.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} &middot; {new Date(t.created).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
            </div>

            <div className={`grid gap-3 ${t.teams.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {t.teams.map(team => (
                <div key={team.manager} className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-3">
                  <TeamName manager={team.manager} conf={t.conf} className="font-bold text-sm mb-2 block" />
                  <div className="space-y-1">
                    {team.adds.map(playerId => {
                      const { name, position, injuryStatus } = playerLabel(playersDB, playerId);
                      return (
                        <div key={`add-${playerId}`} className="flex items-center gap-2 text-sm">
                          <PlayerAvatar playerId={playerId} position={position} className="w-8 h-8" />
                          <span className="text-emerald-400 font-semibold shrink-0">+</span>
                          <PlayerNameButton playerId={playerId} name={name} position={position} className="text-emerald-400 font-semibold truncate min-w-0" />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <PositionBadge position={position} />
                            <InjuryBadge status={injuryStatus} />
                          </div>
                        </div>
                      );
                    })}
                    {team.drops.map(playerId => {
                      const { name, position, injuryStatus } = playerLabel(playersDB, playerId);
                      return (
                        <div key={`drop-${playerId}`} className="flex items-center gap-2 text-sm">
                          <PlayerAvatar playerId={playerId} position={position} className="w-8 h-8" />
                          <span className="text-rose-400 font-semibold shrink-0">-</span>
                          <PlayerNameButton playerId={playerId} name={name} position={position} className="text-rose-400 font-semibold truncate min-w-0" />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <PositionBadge position={position} />
                            <InjuryBadge status={injuryStatus} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
