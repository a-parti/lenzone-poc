import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SCORE_COLOR, scoreState, positionStyle } from '../lib/theme';
import { playerLabel, projectedPoints } from '../lib/players';
import { STANDINGS_PTS } from '../lib/terms';
import { useNameDisplay } from '../context/NameDisplayContext';
import { useRosterModal } from '../context/RosterModalContext';
import { InjuryBadge } from './shared';
import PlayerAvatar from './PlayerAvatar';
import PlayerNameButton from './PlayerNameButton';
import TeamMiniLogo from './TeamMiniLogo';

// My Week's head-to-head view, laid out like Sleeper's matchup screen: one scoreboard card per game
// (in-conference and cross-conference, side by side from sm up), and the selected game's lineups
// facing off row by row underneath.

const GAMES = [
  { key: 'intra', label: 'In-conference', worth: 2 },
  { key: 'inter', label: 'Cross-conference', worth: 1 }
];

const SLOT_SHORT = { FLEX: 'FLX', SUPER_FLEX: 'SF', REC_FLEX: 'W/T', WRRB_FLEX: 'W/R' };

// "Josh Allen" -> "J. Allen" for the narrow phone columns. Team defenses keep their name.
const shortName = (name, position) => (position === 'DEF' ? name : name.replace(/^(\S)\S*\s+/, '$1. '));

// Same rules as the Matchups tab: the big number is the best real score available (final, or live
// while games are on); before kickoff it is the projection.
function scoreLine(info) {
  const { myScore, oppScore, myLiveScore, oppLiveScore, isFinal, isLive, myHasData, oppHasData, myWinPct } = info;
  const showScores = isFinal || myHasData || oppHasData;
  const result = isFinal && myScore != null && oppScore != null ? (myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T') : null;
  return {
    showScores, result,
    my: isLive ? (myLiveScore ?? 0) : myScore,
    opp: isLive ? (oppLiveScore ?? 0) : oppScore,
    // While live, myScore/oppScore are the projected finals.
    myProj: isLive ? myScore : null,
    oppProj: isLive ? oppScore : null,
    winPct: !isFinal && myWinPct != null ? Math.round(myWinPct * 100) : null
  };
}

function TeamSide({ manager, conf, standing, align, score, scoreClass, proj }) {
  const { openRoster } = useRosterModal();
  const { displayName, managerName } = useNameDisplay();
  const right = align === 'right';
  // The team name, with the other name in parentheses: the manager's real name, or the team name
  // when the site is set to show managers.
  const name = displayName(manager, conf);
  const realName = managerName?.(manager, conf);
  const aside = name === manager ? realName : manager;
  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${right ? 'items-end text-right' : 'items-start'}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); openRoster(manager, conf); }}
        className={`flex flex-col sm:items-center gap-1.5 sm:gap-2 min-w-0 max-w-full ${right ? 'items-end sm:flex-row-reverse text-right' : 'items-start sm:flex-row text-left'}`}
      >
        <TeamMiniLogo manager={manager} size={40} className="shrink-0" />
        <span className="min-w-0 max-w-full">
          <span className="block font-bold text-sm text-[var(--text)] truncate">{name}</span>
          {aside && aside !== name && <span className="block text-xs font-semibold text-[var(--text2)] truncate">({aside})</span>}
          <span className="block text-[11px] text-[var(--muted)] truncate">
            {standing ? `${standing.overallRecord} · #${standing.rank} ${conf}` : conf}
          </span>
        </span>
      </button>
      <span className={`font-mono font-extrabold text-3xl leading-none tracking-tight ${scoreClass}`}>
        {score != null ? score.toFixed(2) : '--'}
      </span>
      {proj != null && <span className="font-mono text-[11px] text-[var(--proj)]">{proj.toFixed(2)} proj</span>}
    </div>
  );
}

function ScoreCard({ game, manager, conf, info, standingOf, selected, onSelect }) {
  if (!info) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)] flex items-center justify-center min-h-[9rem]">
        No {game.label.toLowerCase()} game this week
      </div>
    );
  }
  const s = scoreLine(info);
  const oppConf = info.oppConf || conf;
  const status = info.isFinal
    ? { text: s.result === 'W' ? `Won · +${game.worth} ${STANDINGS_PTS.short}` : s.result === 'T' ? `Tied · +${game.worth / 2} ${STANDINGS_PTS.short}` : 'Lost', cls: s.result === 'L' ? 'text-[var(--neg)]' : 'text-[var(--pos)]' }
    : info.isLive ? { text: 'Live', cls: 'text-[var(--live)]' }
    : { text: s.showScores ? 'Projected' : 'Upcoming', cls: 'text-[var(--proj)]' };
  // Final: the winner's score stands out and the loser's dims. Live: both in the live color.
  const tone = (mine) => {
    if (!s.showScores) return 'text-[var(--muted)]';
    if (info.isLive) return 'text-[var(--live)]';
    if (s.result && s.result !== 'T') return (s.result === 'W') === mine ? 'text-[var(--text)]' : 'text-[var(--muted)]';
    return info.isFinal ? 'text-[var(--text)]' : 'text-[var(--text2)]';
  };
  return (
    <div
      role="button" tabIndex={0} aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      className={`rounded-2xl border p-4 cursor-pointer transition-colors duration-150 bg-[var(--surface)] ${
        selected ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border)] hover:border-[var(--border2)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3 text-[11px] font-semibold uppercase tracking-wider">
        <span className="text-[var(--muted)]">{game.label} <span className="normal-case tracking-normal font-normal">· win = {game.worth} {STANDINGS_PTS.short}</span></span>
        <span className={`shrink-0 ${status.cls}`}>{status.text}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
        <TeamSide manager={manager} conf={conf} standing={standingOf(manager)} score={s.showScores ? s.my : null} scoreClass={tone(true)} proj={s.myProj} />
        <span className="self-center text-[11px] font-bold text-[var(--muted)] pt-12">VS</span>
        <TeamSide manager={info.opponent} conf={oppConf} standing={standingOf(info.opponent)} align="right" score={s.showScores ? s.opp : null} scoreClass={tone(false)} proj={s.oppProj} />
      </div>
      {s.winPct != null && (
        <div className="mt-4" title={info.winPctIsRough ? 'Rough estimate -- limited data so far this week' : undefined}>
          <div className="flex justify-between text-[11px] font-mono font-bold text-[var(--text2)] mb-1">
            <span>{s.winPct}%</span>
            <span className="font-sans font-semibold uppercase tracking-wider text-[10px] text-[var(--muted)]">Win probability</span>
            <span>{100 - s.winPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--surface2)] overflow-hidden">
            <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${s.winPct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

// One side of a lineup row. Mirrored on the right so both scores sit next to the slot label.
function PlayerCell({ id, pts, proj, playersDB, byTeamWeek, week, align }) {
  const p = id && id !== '0' ? playerLabel(playersDB, id) : null;
  const right = align === 'right';
  if (!p) return <div className={`text-xs italic text-[var(--muted)] ${right ? 'text-right' : ''}`}>Empty</div>;
  const state = byTeamWeek?.[p.team]?.[week]?.state;
  const isLive = state === 'in';
  const hasActual = isLive || state === 'post' || pts > 0;
  const actual = hasActual ? (pts ?? 0) : null;
  const color = SCORE_COLOR[scoreState({ hasActual, isLive, actual, projected: proj })];
  return (
    <div className={`flex items-center gap-2 min-w-0 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <PlayerAvatar playerId={id} position={p.position} className="hidden sm:block w-11 h-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <PlayerNameButton
          playerId={id} position={p.position} className={`block max-w-full font-semibold text-[13px] sm:text-base text-[var(--text)] truncate ${right ? 'ml-auto text-right' : ''}`}
          name={<><span className="sm:hidden">{shortName(p.name, p.position)}</span><span className="hidden sm:inline">{p.name}</span></>}
        />
        <div className={`flex items-center gap-1 min-w-0 text-[11px] sm:text-[13px] text-[var(--muted)] ${right ? 'justify-end' : ''}`}>
          <span className="truncate">{p.position}{p.team ? ` · ${p.team}` : ''}</span>
          <InjuryBadge status={p.injuryStatus} />
        </div>
      </div>
      {/* Points scored (big; "--" before kickoff), with the projection labeled underneath. */}
      <div className={`shrink-0 font-mono leading-tight flex flex-col ${right ? 'items-start' : 'items-end'}`}>
        <span className={`text-sm sm:text-xl font-extrabold tabular-nums ${hasActual ? color : 'text-[var(--muted)]'}`}>{hasActual ? actual.toFixed(2) : '--'}</span>
        {proj != null && <span className="text-[10px] sm:text-[13px] font-semibold text-[var(--proj)] whitespace-nowrap"><span className="hidden sm:inline">proj </span>{proj.toFixed(1)}</span>}
      </div>
    </div>
  );
}

function LineupRow({ slot, left, right, shared }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)] items-center gap-2 sm:gap-4 py-2 sm:py-3">
      <PlayerCell {...left} {...shared} />
      <span className={`justify-self-center text-[11px] sm:text-[13px] font-extrabold uppercase rounded-md px-1.5 sm:px-2 py-0.5 sm:py-1 ${positionStyle(slot)}`}>
        {SLOT_SHORT[slot] || slot}
      </span>
      <PlayerCell {...right} {...shared} align="right" />
    </div>
  );
}

function Lineups({ info, mySlots, playersDB, weekProjections, byTeamWeek, week }) {
  const [showBench, setShowBench] = useState(false);
  const { mySnapshot: me, oppSnapshot: opp } = info;
  if (!me && !opp) return <p className="text-sm text-[var(--muted)] italic">No lineups posted for this game yet.</p>;
  const projMine = id => projectedPoints(weekProjections, id, info.myScoringSettings, info.myFallbackField);
  const projTheirs = id => projectedPoints(weekProjections, id, info.oppScoringSettings, info.oppFallbackField);
  const shared = { playersDB, byTeamWeek, week };
  const starters = Math.max(mySlots.length, me?.starters?.length || 0, opp?.starters?.length || 0);
  const myBench = [...(info.myBenchIds || []), ...(info.myIrIds || [])];
  const oppBench = [...(info.oppBenchIds || []), ...(info.oppIrIds || [])];
  const benchRows = Math.max(myBench.length, oppBench.length);
  const benchSlot = (list, i) => ((list === myBench ? info.myIrIds : info.oppIrIds) || []).includes(list[i]) ? 'IR' : 'BN';
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 sm:px-4 py-1">
      <p className="pt-2 pb-1 text-[11px] sm:text-[13px] text-[var(--muted)] text-center">
        Points scored, with the <span className="text-[var(--proj)] font-semibold">projection</span> underneath ·
        <span className="text-[var(--pos)] font-semibold"> green</span> beat it, <span className="text-[var(--neg)] font-semibold">red</span> fell short
      </p>
      <div className="divide-y divide-[var(--border)]/60">
        {Array.from({ length: starters }).map((_, i) => {
          const a = me?.starters?.[i], b = opp?.starters?.[i];
          return (
            <LineupRow
              key={i} slot={mySlots[i] || 'FLEX'} shared={shared}
              left={{ id: a, pts: me?.startersPoints?.[i], proj: projMine(a) }}
              right={{ id: b, pts: opp?.startersPoints?.[i], proj: projTheirs(b) }}
            />
          );
        })}
      </div>
      {benchRows > 0 && (
        <>
          <button
            type="button" onClick={() => setShowBench(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 border-t border-[var(--border)]/60 py-2.5 text-xs font-semibold text-[var(--text2)] hover:text-[var(--text)]"
          >
            {showBench ? 'Hide bench' : 'Show bench'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showBench ? 'rotate-180' : ''}`} />
          </button>
          {showBench && (
            <div className="divide-y divide-[var(--border)]/60 opacity-60 border-t border-[var(--border)]/60">
              {Array.from({ length: benchRows }).map((_, i) => {
                const a = myBench[i], b = oppBench[i];
                return (
                  <LineupRow
                    key={i} slot={a ? benchSlot(myBench, i) : benchSlot(oppBench, i)} shared={shared}
                    left={{ id: a, pts: a ? me?.playersPoints?.[a] : undefined, proj: projMine(a) }}
                    right={{ id: b, pts: b ? opp?.playersPoints?.[b] : undefined, proj: projTheirs(b) }}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MyMatchups({ manager, conf, intra, inter, afcSlots, nfcSlots, standings, playersDB, weekProjections, byTeamWeek, week }) {
  const games = { intra, inter };
  const [picked, setPicked] = useState('intra');
  const selected = games[picked] ? picked : (intra ? 'intra' : 'inter');
  const standingOf = (m) => standings?.get(m) || null;
  const info = games[selected];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {GAMES.map(game => (
          <ScoreCard
            key={game.key} game={game} manager={manager} conf={conf} info={games[game.key]} standingOf={standingOf}
            selected={selected === game.key} onSelect={() => setPicked(game.key)}
          />
        ))}
      </div>
      {info && (
        <Lineups
          key={`${selected}-${week}`} info={info} mySlots={conf === 'AFC' ? afcSlots : nfcSlots}
          playersDB={playersDB} weekProjections={weekProjections} byTeamWeek={byTeamWeek} week={week}
        />
      )}
    </div>
  );
}
