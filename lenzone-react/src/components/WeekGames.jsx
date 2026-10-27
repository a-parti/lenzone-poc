import React from 'react';
import { useMatchupPreview } from '../context/MatchupPreviewContext';
import { useNameDisplay } from '../context/NameDisplayContext';
import { CONF_STYLES } from '../lib/theme';
import { STANDINGS_PTS } from '../lib/terms';
import TeamMiniLogo from './TeamMiniLogo';

// The week at a glance, one row per team: its one score, and how that score did in both of its
// games (in-conference first, then cross-conference), so nobody has to switch views or tap to see
// both. Each conference is sorted by score. Before kickoff the scores are projections (labeled);
// while games are on, the score so far; once the week is final, filled W/L badges and the LP earned.
// Tap a team for both lineups (the matchup preview).

const BADGE = {
  W: 'bg-[var(--pos)] text-[var(--surface)]',
  L: 'bg-[var(--neg)] text-[var(--surface)]',
  T: 'bg-[var(--muted)] text-[var(--surface)]'
};

function opponentIn(pairs, manager) {
  const pair = (pairs || []).find(([a, b]) => a === manager || b === manager);
  return pair ? (pair[0] === manager ? pair[1] : pair[0]) : null;
}

function GameChip({ label, opponent, conf, result }) {
  const { displayName } = useNameDisplay();
  if (!opponent) return <span className="flex-1 min-w-0 text-xs text-[var(--muted)] italic">No {label} game</span>;
  return (
    <span className="flex-1 min-w-0 flex items-center gap-1.5 text-xs sm:text-[13px] text-[var(--text2)]" title={`${label}: vs ${displayName(opponent, conf)}`}>
      <span className={`w-5 h-5 shrink-0 grid place-items-center rounded text-[11px] font-black ${result ? BADGE[result] : 'border border-[var(--border2)] text-[var(--muted)]'}`}>
        {result || (label === 'In-conference' ? 'IN' : 'X')}
      </span>
      <TeamMiniLogo manager={opponent} size={16} />
      <span className="truncate">{displayName(opponent, conf)}</span>
    </span>
  );
}

function TeamRow({ team, rank, isMe, onOpen }) {
  const { displayName } = useNameDisplay();
  const { manager, conf, score, state, proj, intra, cross, lp } = team;
  const scoreColor = state === 'final' ? 'text-[var(--text)]' : state === 'live' ? 'text-[var(--live)]' : 'text-[var(--proj)]';
  return (
    <button
      type="button" onClick={onOpen}
      className={`w-full text-left px-3 py-2.5 border-l-[3px] transition-colors duration-150 hover:bg-[var(--surface2)]/60 ${
        isMe ? 'border-l-[var(--accent)] bg-[var(--accent)]/10' : 'border-l-transparent'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-5 shrink-0 text-xs font-bold text-[var(--muted)] tabular-nums">{rank}</span>
        <TeamMiniLogo manager={manager} size={32} />
        <span className="flex-1 min-w-0 font-bold text-sm sm:text-[15px] text-[var(--text)] truncate">{displayName(manager, conf)}</span>
        <span className="shrink-0 text-right leading-tight">
          <span className={`block font-mono text-lg sm:text-xl font-extrabold tabular-nums ${scoreColor}`}>{score != null ? score.toFixed(2) : '--'}</span>
          <span className={`block text-[10px] font-bold uppercase tracking-wide ${state === 'live' ? 'text-[var(--live)]' : state === 'proj' ? 'text-[var(--proj)]' : 'text-[var(--muted)]'}`}>
            {state === 'final' ? 'Final' : state === 'live' ? (proj != null ? `Live · proj ${proj.toFixed(1)}` : 'Live') : 'Projected'}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:pl-[3.25rem]">
        <GameChip label="In-conference" opponent={intra.opponent} conf={conf} result={intra.result} />
        <GameChip label="Cross-conference" opponent={cross.opponent} conf={cross.conf} result={cross.result} />
        {lp != null && (
          <span className={`shrink-0 text-xs font-extrabold tabular-nums ${lp > 0 ? 'text-[var(--pos)]' : 'text-[var(--muted)]'}`}>+{lp} {STANDINGS_PTS.short}</span>
        )}
      </div>
    </button>
  );
}

export default function WeekGames({ week, afcSeason, nfcSeason, crossPairs, projected, isFinal, myTeam }) {
  const { openPreview } = useMatchupPreview();
  const seasonOf = { AFC: afcSeason, NFC: nfcSeason };
  const actualOf = (m, conf) => seasonOf[conf]?.scoreByWeek?.[week]?.[m];

  // A team's score line: final, live (score so far + projected final), or projected.
  const scoreOf = (m, conf) => {
    const actual = actualOf(m, conf);
    if (isFinal) return { score: actual ?? null, state: 'final', proj: null };
    if (actual > 0) return { score: actual, state: 'live', proj: projected?.[m] ?? null };
    return { score: projected?.[m] ?? null, state: 'proj', proj: null };
  };
  const resultOf = (mine, theirs) => {
    if (!isFinal || !(mine > 0 && theirs > 0)) return null;
    return mine > theirs ? 'W' : mine < theirs ? 'L' : 'T';
  };

  const buildConf = (conf) => {
    const otherConf = conf === 'AFC' ? 'NFC' : 'AFC';
    const managers = (seasonOf[conf]?.scheduleByWeek?.[week] || []).flat();
    return managers.map(m => {
      const line = scoreOf(m, conf);
      const intraOpp = opponentIn(seasonOf[conf]?.scheduleByWeek?.[week], m);
      const pair = crossPairs.find(p => p.afcTeam === m || p.nfcTeam === m);
      const crossOpp = pair ? (pair.afcTeam === m ? pair.nfcTeam : pair.afcTeam) : null;
      const intraResult = resultOf(actualOf(m, conf), actualOf(intraOpp, conf));
      const crossResult = resultOf(actualOf(m, conf), actualOf(crossOpp, otherConf));
      const worth = { W: 1, T: 0.5, L: 0 };
      const lp = isFinal && (intraResult || crossResult)
        ? (intraResult ? worth[intraResult] * 2 : 0) + (crossResult ? worth[crossResult] : 0)
        : null;
      return {
        manager: m, conf, ...line,
        intra: { opponent: intraOpp, result: intraResult },
        cross: { opponent: crossOpp, conf: otherConf, result: crossResult },
        lp
      };
    }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  };
  const confs = ['AFC', 'NFC'].map(conf => ({ conf, teams: buildConf(conf) }));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">Week {week} at a glance</h2>
        <p className="text-xs text-[var(--muted)]">
          Each score plays two games: <span className="font-semibold text-[var(--text2)]">in-conference</span> (win = 2 {STANDINGS_PTS.short}),
          then <span className="font-semibold text-[var(--text2)]">cross-conference</span> (win = 1). Tap a team for lineups.
        </p>
      </div>
      {confs.every(c => c.teams.length === 0) ? (
        <p className="text-sm text-[var(--muted)] italic">No games scheduled for this week yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {confs.map(({ conf, teams }) => (
            <div key={conf} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--surface2)] border-b border-[var(--border)]">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${CONF_STYLES[conf].badge}`}>{conf}</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted)]">
                  {isFinal ? 'Final scores' : 'Highest score first'}
                </span>
              </div>
              <div className="divide-y divide-[var(--border)]/70">
                {teams.map((team, i) => (
                  <TeamRow key={team.manager} team={team} rank={i + 1} isMe={team.manager === myTeam} onOpen={() => openPreview(team.manager, conf, week)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
