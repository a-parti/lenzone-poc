import React, { useState, useEffect } from 'react';
import { CONF_STYLES } from '../lib/theme';
import { ConfFilterToggle, PositionBadge, InjuryBadge, NflTeamTag, SkeletonRows } from './shared';
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
      // FAAB spent -- only meaningful for waiver claims (Sleeper's own field, verified live against
      // both leagues: a FAAB-bidding league puts the real dollar amount here, e.g. waiver_bid: 2). A
      // free agent add always costs nothing, and a priority-based (non-FAAB) waiver league still has
      // no bid to show -- both read as a plain $0 rather than omitting the figure, so "did this cost
      // anything" is always visible at a glance instead of only sometimes.
      if (t.type === 'waiver' || t.type === 'free_agent') {
        Object.values(byManager).forEach(team => { team.faab = t.type === 'waiver' ? (t.settings?.waiver_bid || 0) : 0; });
      }

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

const TYPE_FILTERS = {
  ALL: ['waiver', 'free_agent', 'trade'],
  TRADES: ['trade']
};

function TypeFilterToggle({ value, onChange }) {
  return (
    <div className="inline-flex bg-[var(--bg)] border border-[var(--border)]/80 rounded-lg p-0.5">
      {[['ALL', 'All Activity'], ['TRADES', 'Trades Only']].map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-150 ${
            value === key ? "bg-[var(--accent)] text-[var(--accent-text)]" : "text-[var(--text2)] hover:text-[var(--text)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function ActivityTab({ afcTransactions, nfcTransactions, afcRosterIdMap, nfcRosterIdMap, playersDB, loading, focusConf }) {
  const [conf, setConf] = useState(focusConf || 'ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    if (focusConf) setConf(focusConf);
  }, [focusConf]);
  const types = TYPE_FILTERS[typeFilter];
  const emptyLabel = typeFilter === 'TRADES' ? "No trades yet this season." : "No add/drop activity found yet.";

  const combined = [
    ...(conf !== 'NFC' ? normalize(afcTransactions, afcRosterIdMap, 'AFC', types) : []),
    ...(conf !== 'AFC' ? normalize(nfcTransactions, nfcRosterIdMap, 'NFC', types) : [])
  ].sort((a, b) => (b.created || 0) - (a.created || 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 p-4 rounded-xl">
        <span className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)]">Conference</span>
        <ConfFilterToggle value={conf} onChange={setConf} />
        <TypeFilterToggle value={typeFilter} onChange={setTypeFilter} />
      </div>

      {loading && <SkeletonRows rows={4} />}
      {!loading && combined.length === 0 && <div className="text-sm text-[var(--muted)] italic">{emptyLabel}</div>}

      <div className="space-y-3">
        {combined.map(t => (
          <div key={t.id} className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4 hover:border-[var(--border2)] transition-all duration-200">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CONF_STYLES[t.conf].badge}`}>{t.conf}</span>
              <span className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">
                {t.type === 'trade' ? 'Trade' : t.type === 'waiver' ? 'Waiver' : 'Free Agent'}
              </span>
              {t.created && (
                <span className="text-xs text-[var(--muted)] ml-auto">
                  {new Date(t.created).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} &middot; {new Date(t.created).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
            </div>

            <div className={`grid gap-3 ${t.teams.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {t.teams.map(team => (
                <div key={team.manager} className="bg-[var(--bg)]/60 border border-[var(--border)]/60 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <TeamName manager={team.manager} conf={t.conf} className="font-bold text-sm" />
                    {team.faab != null && (
                      <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0 ${
                        team.faab > 0 ? "bg-amber-400/15 text-amber-400" : "bg-[var(--surface2)] text-[var(--muted)]"
                      }`}>
                        {team.faab > 0 ? `$${team.faab} FAAB` : "$0"}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {team.adds.map(playerId => {
                      const { name, position, team: nflTeam, number, injuryStatus } = playerLabel(playersDB, playerId);
                      return (
                        <div key={`add-${playerId}`} className="flex items-center gap-2 text-sm">
                          <PlayerAvatar playerId={playerId} position={position} className="w-12 h-12" />
                          <span className="text-emerald-400 font-semibold shrink-0">+</span>
                          <PlayerNameButton playerId={playerId} name={name} position={position} className="text-emerald-400 font-bold truncate min-w-0" />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <PositionBadge position={position} />
                            <NflTeamTag team={nflTeam} number={number} />
                            <InjuryBadge status={injuryStatus} />
                          </div>
                        </div>
                      );
                    })}
                    {t.type !== 'trade' && team.drops.map(playerId => {
                      const { name, position, team: nflTeam, number, injuryStatus } = playerLabel(playersDB, playerId);
                      return (
                        <div key={`drop-${playerId}`} className="flex items-center gap-2 text-sm">
                          <PlayerAvatar playerId={playerId} position={position} className="w-12 h-12" />
                          <span className="text-rose-400 font-semibold shrink-0">-</span>
                          <PlayerNameButton playerId={playerId} name={name} position={position} className="text-rose-400 font-bold truncate min-w-0" />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <PositionBadge position={position} />
                            <NflTeamTag team={nflTeam} number={number} />
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
