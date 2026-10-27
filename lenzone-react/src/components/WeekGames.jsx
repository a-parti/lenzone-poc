import React, { useState } from 'react';
import { useMatchupPreview } from '../context/MatchupPreviewContext';
import { useNameDisplay } from '../context/NameDisplayContext';
import TeamMiniLogo from './TeamMiniLogo';

// The week's games as a Sleeper-style scoreboard list: one row per game, both teams facing each
// other with their scores in the middle. Tap a game for both teams' lineups (the matchup preview).
// Before kickoff the projection shows (muted); while games are on, the score so far with the
// projection underneath; once the week is final, the winner's score stands out.

const FILTERS = [['AFC', 'AFC'], ['NFC', 'NFC'], ['CROSS', 'Cross']];

function Side({ manager, conf, score, proj, tone, align }) {
  const { displayName } = useNameDisplay();
  const right = align === 'right';
  const value = <span className={`font-extrabold ${tone}`}>{score != null ? score.toFixed(2) : '--'}</span>;
  const projText = proj != null && <span className="text-[10px] text-[var(--proj)]">{proj.toFixed(1)} proj</span>;
  // Phones: the score sits under the name so the name gets the full width. Wider: beside it.
  return (
    <div className={`flex items-center gap-2 min-w-0 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <TeamMiniLogo manager={manager} size={32} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-[13px] sm:text-sm text-[var(--text)] truncate">{displayName(manager, conf)}</div>
        <div className={`sm:hidden flex items-baseline gap-1.5 font-mono text-base leading-tight ${right ? 'justify-end' : ''}`}>{value}{projText}</div>
      </div>
      <span className={`hidden sm:flex shrink-0 font-mono text-lg leading-tight flex-col ${right ? 'items-start' : 'items-end'}`}>
        {value}{projText}
      </span>
    </div>
  );
}

export default function WeekGames({ week, afcSeason, nfcSeason, crossPairs, projected, isFinal, myTeam, myConf }) {
  const { openPreview } = useMatchupPreview();
  const [filter, setFilter] = useState(myConf || 'AFC');
  const seasonOf = { AFC: afcSeason, NFC: nfcSeason };
  const games = filter === 'CROSS'
    ? crossPairs.map(p => [[p.afcTeam, 'AFC'], [p.nfcTeam, 'NFC']])
    : (seasonOf[filter]?.scheduleByWeek?.[week] || []).map(([a, b]) => [[a, filter], [b, filter]]);
  // Your own game first.
  const ordered = [...games].sort((x, y) => Number(y.some(([m]) => m === myTeam)) - Number(x.some(([m]) => m === myTeam)));

  const line = (manager, conf) => {
    const actual = seasonOf[conf]?.scoreByWeek?.[week]?.[manager];
    const proj = projected?.[manager];
    if (isFinal) return { score: actual ?? null, proj: null, state: 'final' };
    if (actual > 0) return { score: actual, proj: proj ?? null, state: 'live' };
    return { score: proj ?? null, proj: null, state: 'proj' };
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">Week {week} games</h2>
        <div role="group" aria-label="Games to show" className="inline-flex rounded-full border border-[var(--border2)] bg-[var(--surface)] p-0.5">
          {FILTERS.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${filter === key ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'text-[var(--text2)] hover:text-[var(--text)]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {ordered.length === 0 ? (
        <p className="text-sm text-[var(--muted)] italic">No games scheduled for this week yet.</p>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {ordered.map(([[a, aConf], [b, bConf]]) => {
            const la = line(a, aConf), lb = line(b, bConf);
            const decided = la.state === 'final' && la.score != null && lb.score != null && la.score !== lb.score;
            const tone = (mine, other, l) => {
              if (l.state === 'proj') return 'text-[var(--muted)]';
              if (l.state === 'live') return 'text-[var(--live)]';
              return decided && mine < other ? 'text-[var(--muted)]' : 'text-[var(--text)]';
            };
            const mine = a === myTeam || b === myTeam;
            const opener = b === myTeam ? [b, bConf] : [a, aConf];
            return (
              <button
                key={`${a}-${b}`} type="button" onClick={() => openPreview(opener[0], opener[1], week)}
                className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3 rounded-xl border px-3 py-2.5 text-left bg-[var(--surface)] transition-colors duration-150 ${
                  mine ? 'border-[var(--accent)]' : 'border-[var(--border)] hover:border-[var(--border2)]'
                }`}
              >
                <Side manager={a} conf={aConf} score={la.score} proj={la.proj} tone={tone(la.score, lb.score, la)} />
                <span className="text-[10px] font-bold text-[var(--muted)]">{la.state === 'final' ? 'FINAL' : la.state === 'live' ? 'LIVE' : 'VS'}</span>
                <Side manager={b} conf={bConf} score={lb.score} proj={lb.proj} tone={tone(lb.score, la.score, lb)} align="right" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
