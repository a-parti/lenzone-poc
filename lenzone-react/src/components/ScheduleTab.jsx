import React, { useState, useEffect } from 'react';
import TeamName from './TeamName';
import { useRosterModal } from '../context/RosterModalContext';

const SEASON_WEEKS = 14;

function findOpponent(pairs, manager) {
  const pair = (pairs || []).find(([a, b]) => a === manager || b === manager);
  if (!pair) return null;
  return pair[0] === manager ? pair[1] : pair[0];
}

function ScheduleWeekRow({ week, intraOpponent, myConf, interOpponent, interOppConf }) {
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 hover:border-slate-700 transition-all duration-200">
      <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 mb-3">Week {week}</p>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-slate-800 text-slate-200 border border-slate-700 shrink-0 w-16 text-center">Intra</span>
          <span className="text-[10px] font-bold text-slate-600 bg-slate-950 px-2 py-1 rounded shrink-0">VS</span>
          {intraOpponent ? (
            <TeamName manager={intraOpponent} conf={myConf} className="font-semibold" />
          ) : (
            <span className="text-slate-700 italic">No matchup yet</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm pt-2 border-t border-slate-800/60">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-slate-800 text-slate-200 border border-slate-700 shrink-0 w-16 text-center">Inter</span>
          <span className="text-[10px] font-bold text-slate-600 bg-slate-950 px-2 py-1 rounded shrink-0">VS</span>
          {interOpponent ? (
            <TeamName manager={interOpponent} conf={interOppConf} className="font-semibold" />
          ) : (
            <span className="text-slate-700 italic">No matchup yet</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TradeDeadlineMarker({ week }) {
  return (
    <div className="md:col-span-2 flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-rose-500/40" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-1 rounded-full shrink-0">
        Trade Deadline &mdash; Week {week}
      </span>
      <div className="flex-1 h-px bg-rose-500/40" />
    </div>
  );
}

export default function ScheduleTab({ afcSeason, nfcSeason, crossSchedule, afcManagers, nfcManagers, afcTradeDeadlineWeek, nfcTradeDeadlineWeek }) {
  const [conf, setConf] = useState('AFC');
  const [team, setTeam] = useState('');
  const { openRoster } = useRosterModal();

  const teamOptions = conf === 'NFC' ? nfcManagers : afcManagers;
  const tradeDeadlineWeek = conf === 'NFC' ? nfcTradeDeadlineWeek : afcTradeDeadlineWeek;

  useEffect(() => {
    if (!teamOptions.includes(team)) setTeam(teamOptions[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conf, teamOptions.join('|')]);

  const season = conf === 'NFC' ? nfcSeason : afcSeason;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-4 rounded-xl">
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">Conference</label>
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
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-slate-400 block mb-1">Team</label>
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="bg-slate-950 border border-slate-800/80 text-sm rounded-lg px-3 py-1.5 text-slate-200"
          >
            {teamOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {team && (
          <button
            type="button"
            onClick={() => openRoster(team, conf)}
            className="text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-1.5 transition-all duration-200"
          >
            View Roster
          </button>
        )}
      </div>

      {!team && <p className="text-sm text-slate-500 italic">No teams available yet.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {team && Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1).map(week => {
          const intraOpponent = findOpponent(season.scheduleByWeek[week], team);
          const crossMatch = crossSchedule.find(m => m.week === week && (m.afcTeam === team || m.nfcTeam === team));
          const interOpponent = crossMatch ? (crossMatch.afcTeam === team ? crossMatch.nfcTeam : crossMatch.afcTeam) : null;
          const interOppConf = conf === 'AFC' ? 'NFC' : 'AFC';
          return (
            <React.Fragment key={week}>
              <ScheduleWeekRow
                week={week}
                myConf={conf}
                intraOpponent={intraOpponent}
                interOpponent={interOpponent}
                interOppConf={interOppConf}
              />
              {tradeDeadlineWeek === week && <TradeDeadlineMarker week={week} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
