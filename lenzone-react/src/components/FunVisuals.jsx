import React, { useMemo, useRef, useState } from 'react';
import ExportControls from './ExportControls';
import TeamMiniLogo from './TeamMiniLogo';
import useElementPngExport from '../hooks/useElementPngExport';
import { useNameDisplay } from '../context/NameDisplayContext';
import { useMatchupPreview } from '../context/MatchupPreviewContext';
import { useRosterModal } from '../context/RosterModalContext';
import { useMyTeam } from '../context/MyTeamContext';
import { STANDINGS_PTS } from '../lib/terms';

// The "fun" visuals: Luck of the Week + Boom or Bust (Matchups) and Luck Meter + Season Heat Map
// (Standings). Each is a card with the same Light/Dark/Copy PNG export as the other charts so it
// can be pasted into Teams. Data comes from lib/funStats.js (real posted scores only).

function FunCard({ title, subtitle, chartId, children }) {
  const exportRef = useRef(null);
  const imageExport = useElementPngExport(exportRef, `lenzone-${chartId}`, { minWidth: 1000 });
  return (
    <div ref={exportRef} data-mode={imageExport.exportTheme} data-scheme={imageExport.scheme} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="font-display text-lg font-bold text-[var(--text)]">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>}
        </div>
        <div data-export-ignore="true">
          <ExportControls
            theme={imageExport.exportTheme}
            onThemeChange={imageExport.setExportTheme}
            onCopy={imageExport.copyPng}
            onDownload={imageExport.downloadPng}
            exporting={imageExport.exporting}
            copyState={imageExport.copyState}
            downloadState={imageExport.downloadState}
          />
        </div>
      </div>
      {children}
    </div>
  );
}

// The same four result colors as the weekly scores chart.
const RESULT_LEGEND = [['var(--pos)', 'Won both'], ['var(--proj)', 'Won in-conference only'], ['var(--live)', 'Won cross-conference only'], ['var(--neg)', 'No wins']];
function resultColor(r) {
  const wonIntra = r.intraOppScore != null && r.score > r.intraOppScore;
  const wonCross = r.crossOppScore != null && r.score > r.crossOppScore;
  return wonIntra && wonCross ? 'var(--pos)' : wonIntra ? 'var(--proj)' : wonCross ? 'var(--live)' : 'var(--neg)';
}
function ResultLegend() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[var(--text2)]">
      {RESULT_LEGEND.map(([color, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
// Rounds first so tiny values read as a plain 0.0 instead of +0.0 / -0.0.
const signed = (v, digits = 1) => {
  const r = Number(v.toFixed(digits));
  return r === 0 ? (0).toFixed(digits) : `${r > 0 ? '+' : ''}${r.toFixed(digits)}`;
};

// ---------------------------------------------------------------------------------------------
// Luck of the Week: x = your score, y = what your opponents scored (average of both games). The
// dashed diagonal is "even"; the median lines split the league into four labeled corners.
// ---------------------------------------------------------------------------------------------
const SW = 760, SH = 460, SM = { top: 24, right: 24, bottom: 48, left: 60 };

export function LuckOfTheWeek({ week, rows, logoMap }) {
  const { displayName } = useNameDisplay();
  const { openPreview } = useMatchupPreview();
  const [hover, setHover] = useState(null);
  const points = useMemo(() => rows
    .map(r => {
      const opp = [r.intraOppScore, r.crossOppScore].filter(v => v != null);
      if (!opp.length) return null;
      const wins = [r.intraOppScore, r.crossOppScore].filter(v => v != null && r.score > v).length;
      const wonIntra = r.intraOppScore != null && r.score > r.intraOppScore;
      const wonCross = r.crossOppScore != null && r.score > r.crossOppScore;
      return { ...r, oppAvg: opp.reduce((a, b) => a + b, 0) / opp.length, wins, games: opp.length, wonIntra, wonCross };
    })
    .filter(Boolean), [rows]);
  if (points.length < 4) return null;

  const xs = points.map(p => p.score), ys = points.map(p => p.oppAvg);
  const lo = Math.floor((Math.min(...xs, ...ys) - 8) / 10) * 10;
  const hi = Math.ceil((Math.max(...xs, ...ys) + 8) / 10) * 10;
  const px = (v) => SM.left + ((v - lo) / (hi - lo)) * (SW - SM.left - SM.right);
  const py = (v) => SH - SM.bottom - ((v - lo) / (hi - lo)) * (SH - SM.top - SM.bottom);
  const mx = median(xs), my = median(ys);
  const ticks = [];
  for (let t = lo; t <= hi; t += 20) ticks.push(t);
  // Same four result colors as the weekly scores chart: won both / in-conference only /
  // cross-conference only / no wins.
  const ring = resultColor;
  const corner = (x, y, anchor, text, color) => (
    <text x={x} y={y} textAnchor={anchor} fontSize={14} fontWeight={900} letterSpacing="0.14em" fill={color} opacity={0.9}>{text}</text>
  );
  const hovered = hover ? points.find(p => p.manager === hover) : null;

  return (
    <FunCard
      chartId={`luck-week-${week}`}
      title={`Luck of the Week -- Week ${week}`}
      subtitle="Your score vs. your opponents' average"
    >
      <svg viewBox={`0 0 ${SW} ${SH}`} className="w-full h-auto" role="img" aria-label={`Week ${week} luck chart`}>
        {/* quadrant glows, each fading in from its corner */}
        <defs>
          {[['tr', 'var(--live)', '100%', '0%'], ['br', 'var(--pos)', '100%', '100%'], ['tl', 'var(--neg)', '0%', '0%'], ['bl', 'var(--accent)', '0%', '100%']].map(([id, color, cx, cy]) => (
            <radialGradient key={id} id={`luck-${id}-${week}`} cx={cx} cy={cy} r="110%">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="70%" stopColor={color} stopOpacity={0} />
            </radialGradient>
          ))}
          <filter id={`luck-glow-${week}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect x={px(mx)} y={SM.top} width={SW - SM.right - px(mx)} height={py(my) - SM.top} fill={`url(#luck-tr-${week})`} />
        <rect x={px(mx)} y={py(my)} width={SW - SM.right - px(mx)} height={SH - SM.bottom - py(my)} fill={`url(#luck-br-${week})`} />
        <rect x={SM.left} y={SM.top} width={px(mx) - SM.left} height={py(my) - SM.top} fill={`url(#luck-tl-${week})`} />
        <rect x={SM.left} y={py(my)} width={px(mx) - SM.left} height={SH - SM.bottom - py(my)} fill={`url(#luck-bl-${week})`} />
        {ticks.map(t => (
          <g key={t}>
            <line x1={px(t)} x2={px(t)} y1={SM.top} y2={SH - SM.bottom} stroke="var(--border)" strokeOpacity={0.5} />
            <line x1={SM.left} x2={SW - SM.right} y1={py(t)} y2={py(t)} stroke="var(--border)" strokeOpacity={0.5} />
            <text x={px(t)} y={SH - SM.bottom + 20} textAnchor="middle" fontSize={13} fill="var(--muted)">{t}</text>
            <text x={SM.left - 8} y={py(t)} textAnchor="end" dominantBaseline="middle" fontSize={13} fill="var(--muted)">{t}</text>
          </g>
        ))}
        <line x1={px(lo)} y1={py(lo)} x2={px(hi)} y2={py(hi)} stroke="var(--text2)" strokeDasharray="6 5" opacity={0.6} />
        <line x1={px(mx)} x2={px(mx)} y1={SM.top} y2={SH - SM.bottom} stroke="var(--border2)" strokeWidth={1.5} />
        <line x1={SM.left} x2={SW - SM.right} y1={py(my)} y2={py(my)} stroke="var(--border2)" strokeWidth={1.5} />
        {corner(SW - SM.right - 8, SM.top + 22, 'end', 'SHOOTOUT', 'var(--live)')}
        {corner(SW - SM.right - 8, SH - SM.bottom - 12, 'end', 'CRUISED', 'var(--pos)')}
        {corner(SM.left + 8, SM.top + 22, 'start', 'TOUGH DRAW', 'var(--neg)')}
        {corner(SM.left + 8, SH - SM.bottom - 12, 'start', 'LUCKY BREAK', 'var(--accent)')}
        <text x={(SM.left + SW - SM.right) / 2} y={SH - 8} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--muted)">Your score →</text>
        <text x={16} y={(SM.top + SH - SM.bottom) / 2} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--muted)" transform={`rotate(-90 16 ${(SM.top + SH - SM.bottom) / 2})`}>Opponents' score →</text>
        {points.map(p => {
          const cx = px(p.score), cy = py(p.oppAvg), r = hover === p.manager ? 19 : 15;
          const clip = `luck-${week}-${p.manager.replace(/[^a-zA-Z0-9]/g, '')}`;
          return (
            <g key={p.manager} onMouseEnter={() => setHover(p.manager)} onMouseLeave={() => setHover(null)}
              onClick={() => openPreview(p.manager, p.conf, week)} style={{ cursor: 'pointer' }}
              opacity={hover && hover !== p.manager ? 0.45 : 1}>
              <defs><clipPath id={clip}><circle cx={cx} cy={cy} r={r} /></clipPath></defs>
              <circle cx={cx} cy={cy} r={r + 3} fill={ring(p)} filter={`url(#luck-glow-${week})`} />
              {logoMap?.[p.manager]
                ? <image href={logoMap[p.manager]} x={cx - r} y={cy - r} width={r * 2} height={r * 2} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
                : <circle cx={cx} cy={cy} r={r} fill="var(--surface2)" />}
              <title>{`${displayName(p.manager, p.conf)}: ${p.score.toFixed(1)} vs ${p.oppAvg.toFixed(1)} avg (${p.wins}-${p.games - p.wins})`}</title>
            </g>
          );
        })}
        {hovered && (
          <g pointerEvents="none">
            <rect x={Math.min(px(hovered.score) + 22, SW - 260)} y={py(hovered.oppAvg) - 16} width={238} height={32} rx={7} fill="var(--surface)" stroke="var(--border2)" />
            <text x={Math.min(px(hovered.score) + 32, SW - 250)} y={py(hovered.oppAvg) + 5} fontSize={14} fontWeight={700} fill="var(--text)">
              {displayName(hovered.manager, hovered.conf).slice(0, 18)} · {hovered.score.toFixed(1)} vs {hovered.oppAvg.toFixed(1)}
            </text>
          </g>
        )}
      </svg>
      <ResultLegend />
    </FunCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Boom or Bust: pregame projection (hollow dot) to actual score (solid dot), sorted from biggest
// boom to biggest bust.
// ---------------------------------------------------------------------------------------------
export function BoomOrBust({ week, rows, pregameScores }) {
  const { displayName } = useNameDisplay();
  const { openPreview } = useMatchupPreview();
  const items = useMemo(() => rows
    .map(r => (Number.isFinite(pregameScores?.[r.manager]) ? { ...r, pre: pregameScores[r.manager], delta: r.score - pregameScores[r.manager] } : null))
    .filter(Boolean)
    .sort((a, b) => b.delta - a.delta), [rows, pregameScores]);
  if (items.length < 4) return null;
  const all = items.flatMap(i => [i.pre, i.score]);
  const lo = Math.min(...all) - 4, hi = Math.max(...all) + 4;
  const pos = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
  const half = Math.ceil(items.length / 2);
  const Row = ({ i, rank }) => {
    const boom = i.delta >= 0;
    // Boom/bust only (not win/loss): sea teal for beating the projection, sunset coral for missing it.
    const color = boom ? 'var(--accent)' : 'var(--coral)';
    const left = Math.min(i.pre, i.score), right = Math.max(i.pre, i.score);
    return (
      <button type="button" onClick={() => openPreview(i.manager, i.conf, week)}
        className="w-full grid grid-cols-[1.5rem_minmax(0,9.5rem)_1fr_3.5rem] items-center gap-2 py-1 text-left hover:bg-[var(--surface2)]/60 rounded-lg px-1"
        title={`${displayName(i.manager, i.conf)}: projected ${i.pre.toFixed(1)}, scored ${i.score.toFixed(1)}`}>
        <span className="text-xs font-bold text-[var(--muted)] text-right">{rank}</span>
        <span className="flex items-center gap-1.5 min-w-0">
          <TeamMiniLogo manager={i.manager} size={20} />
          <span className="truncate text-xs font-semibold text-[var(--text)]">{displayName(i.manager, i.conf)}</span>
        </span>
        <span className="relative h-5">
          <span className="absolute top-1/2 left-0 right-0 h-px bg-[var(--border)]" />
          <span className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full"
            style={{ left: pos(left), width: `calc(${pos(right)} - ${pos(left)})`, background: boom ? `linear-gradient(90deg, transparent, ${color})` : `linear-gradient(270deg, transparent, ${color})`, boxShadow: `0 0 10px ${color}` }} />
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-[var(--text2)] bg-[var(--surface)]" style={{ left: pos(i.pre) }} />
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full" style={{ left: pos(i.score), backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
        </span>
        <span className={`text-xs font-black text-right ${boom ? 'text-[var(--accent)]' : 'text-[var(--coral)]'}`}>{signed(i.delta)}</span>
      </button>
    );
  };
  return (
    <FunCard
      chartId={`boom-bust-week-${week}`}
      title={`Boom or Bust -- Week ${week}`}
      subtitle="○ projected · ● actual"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
        <div>{items.slice(0, half).map((i, k) => <Row key={i.manager} i={i} rank={k + 1} />)}</div>
        <div>{items.slice(half).map((i, k) => <Row key={i.manager} i={i} rank={half + k + 1} />)}</div>
      </div>
    </FunCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Luck Meter: actual wins minus all-play expected wins, per conference.
// ---------------------------------------------------------------------------------------------
const ConfTag = ({ conf }) => <span className={`shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-full border ${conf === 'AFC' ? 'text-[var(--afc)] border-[var(--afc)]/40 bg-[var(--afc)]/10' : 'text-[var(--nfc)] border-[var(--nfc)]/40 bg-[var(--nfc)]/10'}`}>{conf}</span>;

// Team name with the other name (real name, or team name when showing real names) underneath.
function TeamNameStack({ manager, conf, strong = false }) {
  const { mode, displayName, managerName } = useNameDisplay();
  const real = managerName(manager, conf);
  const secondary = mode === 'managers' ? (real ? manager : null) : real;
  return (
    <span className="min-w-0 flex-1 flex flex-col leading-tight text-left">
      <span className={`truncate text-xs text-[var(--text)] ${strong ? 'font-black' : 'font-semibold'}`}>{displayName(manager, conf)}</span>
      {secondary && <span className="truncate text-[10px] font-medium text-[var(--muted)]">{secondary}</span>}
    </span>
  );
}

// A diverging meter: bars grow right from the centre line for positive values, left for negative,
// split into a positive and a negative group. Used by Luck, Boom/Bust and Fleece.
function DivergingMeterBody({ items, posLabel, negLabel, digits = 1, unit, emptyText }) {
  const { openRoster } = useRosterModal();
  if (!items.length) return <p className="py-6 text-center text-sm text-[var(--muted)]">{emptyText}</p>;
  const maxAbs = Math.max(0.5, ...items.map(i => Math.abs(i.value)));
  // Split on the shown (rounded) value, so a team showing "0.0" never sits beside the negative group.
  const rounded = (i) => Number(i.value.toFixed(digits));
  const isPos = (i) => rounded(i) > 0;
  const sideShade = (i, color) =>
    `color-mix(in srgb, ${color} ${Math.round(15 + 85 * Math.min(1, Math.abs(i.value) / maxAbs))}%, var(--border2))`;
  const groups = [
    { key: 'pos', label: posLabel, color: 'var(--pos)', rows: items.filter(isPos) },
    { key: 'even', label: 'Even', color: 'var(--muted)', rows: items.filter(i => rounded(i) === 0) },
    { key: 'neg', label: negLabel, color: 'var(--neg)', rows: items.filter(i => rounded(i) < 0) }
  ].filter(g => g.rows.length);
  const renderRow = (i) => {
    const w = `${(Math.abs(i.value) / maxAbs) * 50}%`;
    const positive = i.value >= 0;
    return (
      <button key={i.manager} type="button" onClick={() => openRoster(i.manager, i.conf)}
        className="w-full grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,13rem)_1fr_7.5rem] items-center gap-x-2 gap-y-1 py-1.5 text-left hover:bg-[var(--surface2)]/60 px-1"
        title={i.title}>
        <span className="order-1 sm:order-none flex items-center gap-1.5 min-w-0">
          <TeamMiniLogo manager={i.manager} size={20} />
          <TeamNameStack manager={i.manager} conf={i.conf} />
          <ConfTag conf={i.conf} />
        </span>
        <span className="order-3 col-span-2 sm:order-none sm:col-span-1 relative h-4">
          <span className="absolute -inset-y-1.5 left-1/4 border-l border-dashed border-[var(--border)]" />
          <span className="absolute -inset-y-1.5 left-3/4 border-l border-dashed border-[var(--border)]" />
          <span className="absolute -inset-y-1.5 left-1/2 w-px bg-[var(--border2)]" />
          {rounded(i) !== 0 && <span className="absolute top-0.5 bottom-0.5 rounded"
            style={{ ...(positive ? { left: '50%' } : { right: '50%' }), width: w, background: positive ? 'linear-gradient(90deg, color-mix(in srgb, var(--pos) 35%, transparent), var(--pos))' : 'linear-gradient(270deg, color-mix(in srgb, var(--neg) 35%, transparent), var(--neg))', boxShadow: `0 0 10px ${positive ? 'var(--pos)' : 'var(--neg)'}` }} />}
        </span>
        <span className="order-2 sm:order-none text-right leading-tight">
          <span className={`block text-xs font-black ${rounded(i) === 0 ? 'text-[var(--muted)]' : positive ? 'text-[var(--pos)]' : 'text-[var(--neg)]'}`}>{signed(i.value, digits)} {unit}</span>
          {i.detail && <span className="block whitespace-nowrap text-[10px] font-medium text-[var(--muted)]">{i.detail}</span>}
        </span>
      </button>
    );
  };
  return (
    <div className="max-w-3xl mx-auto divide-y divide-[var(--border2)]">
      {groups.map(g => (
        <div key={g.key} className="py-1.5">
          <div className="flex items-center gap-2 px-1 py-1">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] whitespace-nowrap" style={{ color: g.color }}>{g.label}</span>
            <span className="h-[3px] flex-1 rounded-full"
              style={{ background: `linear-gradient(90deg, ${sideShade(g.rows[0], g.color)}, ${sideShade(g.rows[g.rows.length - 1], g.color)})` }} />
          </div>
          <div className="divide-y divide-[var(--border)]/70">
            {g.rows.map(renderRow)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LuckMeter({ luck }) {
  const { displayName } = useNameDisplay();
  if (!luck?.length) return null;
  const items = luck.map(l => ({
    manager: l.manager, conf: l.conf, value: l.luck,
    title: `${displayName(l.manager, l.conf)}: ${l.wins.toFixed(1)} ${STANDINGS_PTS.short} earned vs ${l.expected.toFixed(1)} all-play expected in ${l.games} games`
  }));
  return (
    <FunCard
      chartId="luck-meter"
      title="Luck Meter"
      subtitle={`${STANDINGS_PTS.short} you got vs. what you'd get playing everyone`}
    >
      <DivergingMeterBody items={items} posLabel="Lucky" negLabel="Unlucky" unit={STANDINGS_PTS.short} />
    </FunCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Hot & Cold Weeks: per team, weeks in the league's top 25% (hot) vs. bottom 25% (cold).
// ---------------------------------------------------------------------------------------------
export function PlayerBoomBustMeter({ rows }) {
  const { displayName } = useNameDisplay();
  const items = (rows || []).map(r => ({
    manager: r.manager, conf: r.conf, value: r.net,
    detail: `${r.boom} hot · ${r.bust} cold`,
    title: `${displayName(r.manager, r.conf)}: ${r.boom} hot week${r.boom === 1 ? '' : 's'}${r.boomWeeks.length ? ` (Wk ${r.boomWeeks.join(', ')})` : ''}, ${r.bust} cold week${r.bust === 1 ? '' : 's'}${r.bustWeeks.length ? ` (Wk ${r.bustWeeks.join(', ')})` : ''} out of ${r.weeks}`
  }));
  return (
    <FunCard
      chartId="boom-bust-meter"
      title="Hot & Cold Weeks"
      subtitle="Hot = a top-25% score across the whole league that week. Cold = bottom 25%. Bar = hot weeks minus cold weeks."
    >
      <DivergingMeterBody items={items} posLabel="Hot" negLabel="Cold" digits={0} unit="net" emptyText="No completed weeks yet." />
    </FunCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Season Boom or Bust: the weekly Boom or Bust card (score vs. pregame projection), added up.
// ---------------------------------------------------------------------------------------------
export function SeasonBoomOrBustMeter({ rows }) {
  const { displayName } = useNameDisplay();
  const items = (rows || []).map(r => ({
    manager: r.manager, conf: r.conf, value: r.total,
    detail: `beat it ${r.beat} of ${r.weeks} wks`,
    title: `${displayName(r.manager, r.conf)}: ${signed(r.total)} pts vs. projections over ${r.weeks} weeks (beat it ${r.beat}, missed ${r.missed})${r.best ? `. Best: Week ${r.best.week} (${signed(r.best.delta)})` : ''}${r.worst ? `. Worst: Week ${r.worst.week} (${signed(r.worst.delta)})` : ''}`
  }));
  return (
    <FunCard
      chartId="season-boom-bust-meter"
      title="Season Boom or Bust"
      subtitle="Every week's Boom or Bust added up: your actual score minus your starters' pregame projection, summed over the season."
    >
      <DivergingMeterBody items={items} posLabel="Boom" negLabel="Bust" digits={0} unit="pts" emptyText="Waiting on projections." />
    </FunCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Sit/Start meter: points left on the bench vs. a perfect lineup, season total.
// ---------------------------------------------------------------------------------------------
export function SitStartMeter({ rows }) {
  const { displayName } = useNameDisplay();
  const { openRoster } = useRosterModal();
  const list = rows || [];
  const maxLeft = Math.max(1, ...list.map(r => r.left));
  return (
    <FunCard
      chartId="sit-start-meter"
      title="Sit/Start Meter"
      subtitle="Points you left on the bench. % is how much of your best possible lineup you started."
    >
      {!list.length ? <p className="py-6 text-center text-sm text-[var(--muted)]">Waiting on player data.</p> : (
        <div className="max-w-3xl mx-auto divide-y divide-[var(--border)]/70">
          {list.map(r => (
            <button key={r.manager} type="button" onClick={() => openRoster(r.manager, r.conf)}
              className="w-full grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,13rem)_1fr_7rem] items-center gap-x-2 gap-y-1 py-1.5 text-left hover:bg-[var(--surface2)]/60 px-1"
              title={`${displayName(r.manager, r.conf)}: ${r.left.toFixed(1)} points left on the bench over ${r.weeks} weeks${r.worst ? ` (worst: Week ${r.worst.week}, ${r.worst.left.toFixed(1)})` : ''}`}>
              <span className="order-1 sm:order-none flex items-center gap-1.5 min-w-0">
                <TeamMiniLogo manager={r.manager} size={20} />
                <TeamNameStack manager={r.manager} conf={r.conf} />
                <ConfTag conf={r.conf} />
              </span>
              <span className="order-3 col-span-2 sm:order-none sm:col-span-1 relative h-4 rounded bg-[var(--surface2)]">
                <span className="absolute inset-y-0 left-0 rounded"
                  style={{ width: `${(r.left / maxLeft) * 100}%`, background: 'var(--neg)', opacity: 0.4 + 0.6 * (r.left / maxLeft) }} />
              </span>
              <span className="order-2 sm:order-none text-right leading-tight">
                <span className="block text-xs font-black text-[var(--text)]">{r.left.toFixed(1)} pts</span>
                <span className="block text-[10px] font-medium text-[var(--muted)]">{r.pct.toFixed(1)}%</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </FunCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Trade grades (Fleece meter): real lineup points since each trade, plus each traded player's
// week-by-week line so you can see how he's done since the deal.
// ---------------------------------------------------------------------------------------------
const GRADE_STYLE = {
  Fleece: 'bg-[var(--neg)] text-[var(--surface)]',
  'Clear win': 'bg-[var(--live)] text-[var(--surface)]',
  'Slight edge': 'bg-[var(--surface2)] text-[var(--text)]',
  Even: 'bg-[var(--surface2)] text-[var(--muted)]',
  'Too early': 'border border-dashed border-[var(--border2)] text-[var(--muted)]'
};

// Weekly points bars for one player, Week 1 to the latest completed week. Bars from the trade week
// on are solid (accent when the new team started him, grey when benched); weeks before the trade
// are faint. A dashed line marks the trade; a missing bar means he wasn't on a roster that week.
function PlayerTradeLine({ player, tradeWeek, manager, maxPts }) {
  const W = 9, GAP = 2, H = 28;
  const weeks = player.line.length;
  return (
    <svg width={weeks * (W + GAP)} height={H + 2} className="shrink-0 overflow-visible" aria-hidden="true">
      {player.line.map((wk, i) => {
        if (wk.points == null) return null;
        const h = Math.max(1.5, (Math.max(0, wk.points) / maxPts) * H);
        const after = wk.week >= tradeWeek;
        const startedForNewTeam = after && wk.manager === manager && wk.started;
        const fill = !after ? 'var(--border2)' : startedForNewTeam ? 'var(--accent)' : 'var(--muted)';
        const label = `Wk ${wk.week}: ${wk.points.toFixed(1)} pts${!after ? ' (before the trade)' : startedForNewTeam ? ' (started)' : wk.manager === manager ? ' (on the bench)' : ''}`;
        return (
          <rect key={wk.week} x={i * (W + GAP)} y={H - h + 1} width={W} height={h} rx={1.5} fill={fill} opacity={after ? 1 : 0.55}>
            <title>{label}</title>
          </rect>
        );
      })}
      {tradeWeek <= weeks && (
        <line x1={(tradeWeek - 1) * (W + GAP) - GAP / 2} x2={(tradeWeek - 1) * (W + GAP) - GAP / 2} y1={-1} y2={H + 2}
          stroke="var(--text2)" strokeDasharray="2 2" strokeWidth={1} />
      )}
    </svg>
  );
}

function TradeCard({ trade }) {
  const { displayName } = useNameDisplay();
  const winnerSide = trade.sides.find(s => s.manager === trade.winner);
  const projLeader = trade.sides.find(s => s.manager === trade.projectedLeader);
  const maxPts = Math.max(10, ...trade.sides.flatMap(s => s.got.flatMap(p => p.line.map(w => w.points || 0))));
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-[var(--muted)]">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${GRADE_STYLE[trade.grade]}`}>{trade.grade}</span>
          {winnerSide && <span className="text-[var(--text2)]">{displayName(winnerSide.manager, winnerSide.conf)} got {Math.round(trade.share * 100)}% of the lineup points</span>}
          {trade.grade === 'Too early' && (
            <span className="text-[var(--text2)]">
              {projLeader ? `Projections favor ${displayName(projLeader.manager, projLeader.conf)} (${Math.round(trade.projShare * 100)}%)` : 'Projections see it as even'}
            </span>
          )}
        </span>
        <span>Week {trade.week} · {trade.conf} · {trade.weeks} week{trade.weeks === 1 ? '' : 's'} of results</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {trade.sides.map(s => (
          <div key={s.rosterId} className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-[var(--text)]">
                <TeamMiniLogo manager={s.manager} size={18} />
                <span className="truncate">{displayName(s.manager, s.conf)} got</span>
              </span>
              <span className={`shrink-0 text-right text-xs font-black ${s.manager === trade.winner ? 'text-[var(--pos)]' : trade.winner ? 'text-[var(--neg)]' : 'text-[var(--text2)]'}`}>
                {s.points.toFixed(1)} lineup pts
                <span className="block text-[10px] font-semibold text-[var(--muted)]">{s.projected.toFixed(0)} projected rest of season</span>
              </span>
            </div>
            <ul className="mt-1.5 space-y-1">
              {s.got.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate text-[var(--text2)]">
                    <span className="font-semibold text-[var(--text)]">{p.name}</span>{p.pos ? ` ${p.pos}` : ''}
                    <span className="block text-[10px] text-[var(--muted)]">{p.points.toFixed(1)} pts in {p.starts} start{p.starts === 1 ? '' : 's'} · {p.projected.toFixed(0)} proj.</span>
                  </span>
                  <PlayerTradeLine player={p} tradeWeek={trade.week} manager={s.manager} maxPts={maxPts} />
                </li>
              ))}
              {!s.got.length && <li className="text-[11px] text-[var(--muted)]">No players</li>}
            </ul>
            {s.faab !== 0 && (
              <p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">{s.faab > 0 ? `+$${s.faab} FAAB received` : `$${-s.faab} FAAB sent`}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FleeceMeter({ data }) {
  const { displayName } = useNameDisplay();
  const [showAll, setShowAll] = useState(false);
  const byTeam = (data?.byTeam || []).filter(t => t.trades > t.early);
  const trades = data?.trades || [];
  const items = byTeam.map(t => ({
    manager: t.manager, conf: t.conf, value: t.net,
    detail: `${t.won}W ${t.lost}L${t.trades - t.early - t.won - t.lost ? ` ${t.trades - t.early - t.won - t.lost} even` : ''}`,
    title: `${displayName(t.manager, t.conf)}: ${signed(t.net)} lineup points from trades (won ${t.won}, lost ${t.lost})${t.early ? `; ${t.early} too recent to grade` : ''}`
  }));
  const shown = showAll ? trades : trades.slice(0, 5);
  return (
    <FunCard
      chartId="fleece-meter"
      title="Fleece Meter"
      subtitle="Who actually won each trade? Lineup points = what the players you got scored in weeks you started them, minus what the players you gave up scored for their new team. Byes and injuries count. Graded after 3 weeks: Even under 55% of the points, Slight edge 55–65%, Clear win 65–80%, Fleece 80%+."
    >
      <DivergingMeterBody items={items} posLabel="Fleecers" negLabel="Fleeced" digits={0} unit="pts" emptyText="No trades old enough to grade yet." />
      {trades.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text2)]">Trades</h4>
            <span className="flex items-center gap-3 text-[10px] text-[var(--muted)]">
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-[var(--accent)]" />started for new team</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-[var(--muted)]" />benched / elsewhere</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-[var(--border2)] opacity-60" />before the trade</span>
            </span>
          </div>
          {shown.map(t => <TradeCard key={t.id} trade={t} />)}
          {trades.length > 5 && (
            <div data-export-ignore="true">
              <button type="button" onClick={() => setShowAll(v => !v)} className="text-xs font-bold text-[var(--accent)] hover:underline">
                {showAll ? 'Show fewer' : `Show all ${trades.length} trades`}
              </button>
            </div>
          )}
        </div>
      )}
    </FunCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Season Heat Map: team x week squares, colored by how that week's score ranked league-wide.
// ---------------------------------------------------------------------------------------------
const heatColor = (pct) => `color-mix(in srgb, var(--coral) ${Math.round(pct * 100)}%, var(--proj))`;

export function SeasonHeatMap({ heat, weeks }) {
  const { displayName } = useNameDisplay();
  const { openRoster } = useRosterModal();
  const myTeam = useMyTeam();
  const { openPreview } = useMatchupPreview();
  // Hover highlights a row (and its week column) so one team can be followed across the season.
  const [hover, setHover] = useState(null); // { manager, week? }
  const teams = useMemo(() => Object.values(heat)
    .map(t => {
      const pcts = weeks.map(w => t.weeks[w]?.pct).filter(v => v != null);
      return { ...t, avg: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : -1 };
    })
    .sort((a, b) => b.avg - a.avg), [heat, weeks]);
  if (!weeks.length) return null;
  // All 24 teams in one table (heat is already league-wide), sorted by average heat.
  const table = (
    <div className="min-w-0 overflow-x-auto scroll-thin">
      <table className="w-auto mx-auto border-separate" style={{ borderSpacing: 0 }} onMouseLeave={() => setHover(null)}>
        <thead>
          <tr>
            <th />
            <th />
            {weeks.map(w => (
              <th key={w} className={`text-[11px] font-semibold transition-colors ${hover?.week === w ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>Wk {w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map(t => {
            const isHover = hover?.manager === t.manager;
            const isMe = myTeam === t.manager;
            const dim = hover && !isHover;
            return (
              <tr
                key={t.manager}
                onMouseEnter={() => setHover(h => ({ manager: t.manager, week: h?.manager === t.manager ? h.week : null }))}
                className="transition-opacity duration-150"
                style={{ opacity: dim ? 0.35 : 1 }}
              >
                <td className="pr-1 py-[3px] border-b border-[var(--border)]/70">
                  <ConfTag conf={t.conf} />
                </td>
                <td className="pr-2 py-[3px] border-b border-[var(--border)]/70">
                  <button
                    type="button" onClick={() => openRoster(t.manager, t.conf)}
                    className={`flex items-center gap-1.5 min-w-0 max-w-[11rem] rounded-xl px-1.5 py-0.5 transition-colors ${
                      isHover ? 'bg-[var(--surface2)]' : ''
                    } ${isMe ? 'ring-2 ring-[var(--accent)]' : ''}`}
                  >
                    <TeamMiniLogo manager={t.manager} size={18} />
                    <TeamNameStack manager={t.manager} conf={t.conf} strong={isHover || isMe} />
                  </button>
                </td>
                {weeks.map(w => {
                  const cell = t.weeks[w];
                  const isCell = isHover && hover?.week === w;
                  return (
                    <td key={w} className="px-[1.5px] py-[3px] border-b border-[var(--border)]/70" onMouseEnter={() => setHover({ manager: t.manager, week: w })}>
                      <div
                        role={cell ? 'button' : undefined} tabIndex={cell ? 0 : undefined}
                        onClick={cell ? () => openPreview(t.manager, t.conf, w) : undefined}
                        onKeyDown={cell ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPreview(t.manager, t.conf, w); } } : undefined}
                        className={`h-8 min-w-[2.6rem] rounded-md grid place-items-center text-[11px] font-bold text-white transition-transform duration-150 ${cell ? 'cursor-pointer' : ''} ${isHover ? 'scale-[1.06]' : ''} ${isCell ? 'ring-2 ring-[var(--text)]' : ''}`}
                        style={cell ? { backgroundColor: heatColor(cell.pct), backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 55%)', boxShadow: cell.pct >= 0.85 ? `0 0 10px ${heatColor(cell.pct)}` : 'none', textShadow: '0 1px 2px rgba(0,0,0,0.45)' } : { backgroundColor: 'var(--surface2)' }}
                        title={cell ? `${displayName(t.manager, t.conf)} -- Week ${w}: ${cell.score.toFixed(1)} (click for matchups)` : 'No score'}
                      >
                        {cell ? Math.round(cell.score) : '–'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return (
    <FunCard
      chartId="season-heat-map"
      title="Season Heat Map"
    >
      {table}
      <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-semibold text-[var(--muted)]">
        <span>Cold</span>
        <span className="h-2.5 w-40 rounded-full" style={{ background: 'linear-gradient(90deg, var(--proj), var(--coral))' }} />
        <span>Hot</span>
      </div>
    </FunCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Waiver Wire meter: points over replacement from pickups, per team.
// ---------------------------------------------------------------------------------------------
export function WaiverWireMeter({ rows }) {
  const { displayName } = useNameDisplay();
  const items = (rows || []).map(r => ({
    manager: r.manager, conf: r.conf, value: r.net,
    detail: `${r.pickups} pickup${r.pickups === 1 ? '' : 's'}${r.faab > 0 ? ` · $${r.faab} · ${r.perDollar.toFixed(1)} pts/$` : ' · $0'}`,
    title: `${displayName(r.manager, r.conf)}: ${signed(r.net)} pts over replacement from ${r.pickups} pickups. $${r.faab} FAAB spent${r.perDollar != null ? `, ${r.perDollar.toFixed(1)} pts per $ from paid pickups` : ''}${r.best ? `. Best: ${r.best.name} (${signed(r.best.value)}${r.best.bid ? `, $${r.best.bid}` : ', free'})` : ''}`
  }));
  return (
    <FunCard
      chartId="waiver-wire-meter"
      title="Waiver Wire"
      subtitle="Points your pickups scored over replacement level in the weeks you started them. pts/$ = what your paid pickups returned per FAAB dollar (free pickups not included)."
    >
      <DivergingMeterBody items={items} posLabel="Hot wire" negLabel="Cold wire" unit="pts" emptyText="No pickups yet." />
    </FunCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Draft Value meter: each pick vs. what its round usually returns, per team.
// ---------------------------------------------------------------------------------------------
function PickLine({ pick }) {
  const { displayName } = useNameDisplay();
  const spots = pick.drafters.map(d => `Rd ${d.round}, #${d.pickNo} ${displayName(d.manager, d.conf)}${pick.drafters.length > 1 ? ` (${signed(d.value)})` : ''}`).join(' · ');
  return (
    <li className="flex items-start justify-between gap-2 text-xs">
      <span className="min-w-0 text-[var(--text2)]">
        <span className="font-bold text-[var(--text)]">{pick.name}</span>{pick.pos ? ` (${pick.pos})` : ''}
        <span className="block text-[11px] text-[var(--muted)]">{spots}</span>
      </span>
      <span className={`shrink-0 font-black ${pick.value >= 0 ? 'text-[var(--pos)]' : 'text-[var(--neg)]'}`}>{signed(pick.value)}</span>
    </li>
  );
}

export function DraftValueMeter({ data }) {
  const { displayName } = useNameDisplay();
  const items = (data?.byTeam || []).map(t => ({
    manager: t.manager, conf: t.conf, value: t.net,
    title: `${displayName(t.manager, t.conf)}: ${signed(t.net)} pts vs. what those draft slots usually return, across ${t.picks} picks${t.best ? `. Best: ${t.best.name}, pick #${t.best.pickNo} (${signed(t.best.value)})` : ''}`
  }));
  return (
    <FunCard
      chartId="draft-value-meter"
      title="Draft Value"
      subtitle="Did your picks beat their draft slot? Each pick's points over replacement (weeks you started him) minus the average of the picks made within 6 spots of it in both drafts. A 3rd overall pick playing like a 3rd overall pick is about 0."
    >
      <DivergingMeterBody items={items} posLabel="Good drafts" negLabel="Bad drafts" unit="pts" emptyText="No completed weeks yet." />
      {data?.best?.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--text2)]">Best picks</h4>
            <ul className="space-y-1">{data.best.map(p => <PickLine key={p.playerId} pick={p} />)}</ul>
          </div>
          <div>
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--text2)]">Worst picks</h4>
            <ul className="space-y-1">{data.worst.map(p => <PickLine key={p.playerId} pick={p} />)}</ul>
          </div>
        </div>
      )}
    </FunCard>
  );
}
