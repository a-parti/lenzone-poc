import React, { useMemo, useRef, useState } from 'react';
import ExportControls from './ExportControls';
import TeamMiniLogo from './TeamMiniLogo';
import useElementPngExport from '../hooks/useElementPngExport';
import { useNameDisplay } from '../context/NameDisplayContext';
import { useMatchupPreview } from '../context/MatchupPreviewContext';
import { useRosterModal } from '../context/RosterModalContext';

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
export function LuckMeter({ luck }) {
  const { displayName } = useNameDisplay();
  const { openRoster } = useRosterModal();
  if (!luck?.length) return null;
  const maxAbs = Math.max(0.5, ...luck.map(l => Math.abs(l.luck)));
  const Panel = ({ conf }) => (
    <div className="min-w-0">
      <div className="flex items-center gap-3 mb-2">
        <span className={`text-xs font-black tracking-[0.2em] ${conf === 'AFC' ? 'text-[var(--afc)]' : 'text-[var(--nfc)]'}`}>{conf}</span>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
      {luck.filter(l => l.conf === conf).map(l => {
        const w = `${(Math.abs(l.luck) / maxAbs) * 50}%`;
        const lucky = l.luck >= 0;
        return (
          <button key={l.manager} type="button" onClick={() => openRoster(l.manager, l.conf)}
            className="w-full grid grid-cols-[minmax(0,9.5rem)_1fr_4.5rem] items-center gap-2 py-1 text-left hover:bg-[var(--surface2)]/60 rounded-lg px-1"
            title={`${displayName(l.manager, l.conf)}: ${l.wins.toFixed(1)} actual wins vs ${l.expected.toFixed(1)} all-play expected in ${l.games} games`}>
            <span className="flex items-center gap-1.5 min-w-0">
              <TeamMiniLogo manager={l.manager} size={20} />
              <span className="truncate text-xs font-semibold text-[var(--text)]">{displayName(l.manager, l.conf)}</span>
            </span>
            <span className="relative h-4">
              <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--border2)]" />
              <span className="absolute top-0.5 bottom-0.5 rounded"
                style={{ ...(lucky ? { left: '50%' } : { right: '50%' }), width: w, background: lucky ? 'linear-gradient(90deg, color-mix(in srgb, var(--pos) 35%, transparent), var(--pos))' : 'linear-gradient(270deg, color-mix(in srgb, var(--neg) 35%, transparent), var(--neg))', boxShadow: `0 0 10px ${lucky ? 'var(--pos)' : 'var(--neg)'}` }} />
            </span>
            <span className={`text-xs font-black text-right ${Math.abs(l.luck) < 0.05 ? 'text-[var(--muted)]' : lucky ? 'text-[var(--pos)]' : 'text-[var(--neg)]'}`}>{signed(l.luck)} W</span>
          </button>
        );
      })}
    </div>
  );
  return (
    <FunCard
      chartId="luck-meter"
      title="Luck Meter"
      subtitle="Actual wins vs. wins if you played everyone each week"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
        <Panel conf="AFC" />
        <Panel conf="NFC" />
      </div>
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
  if (!weeks.length) return null;
  // All 24 teams in one table (heat is already league-wide), sorted by average heat.
  const Panel = () => {
    const teams = Object.values(heat)
      .map(t => {
        const pcts = weeks.map(w => t.weeks[w]?.pct).filter(v => v != null);
        return { ...t, avg: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : -1 };
      })
      .sort((a, b) => b.avg - a.avg);
    return (
      <div className="min-w-0 overflow-x-auto scroll-thin">
        <table className="w-auto mx-auto border-separate" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th />
              <th />
              {weeks.map(w => <th key={w} className="text-[11px] font-semibold text-[var(--muted)]">Wk {w}</th>)}
            </tr>
          </thead>
          <tbody>
            {teams.map(t => (
              <tr key={t.manager}>
                <td className="pr-1">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${t.conf === 'AFC' ? 'text-[var(--afc)] border-[var(--afc)]/40 bg-[var(--afc)]/10' : 'text-[var(--nfc)] border-[var(--nfc)]/40 bg-[var(--nfc)]/10'}`}>{t.conf}</span>
                </td>
                <td className="pr-2">
                  <button type="button" onClick={() => openRoster(t.manager, t.conf)} className="flex items-center gap-1.5 min-w-0 max-w-[10rem]">
                    <TeamMiniLogo manager={t.manager} size={18} />
                    <span className="truncate text-xs font-semibold text-[var(--text)]">{displayName(t.manager, t.conf)}</span>
                  </button>
                </td>
                {weeks.map(w => {
                  const cell = t.weeks[w];
                  return (
                    <td key={w} className="p-0">
                      <div
                        className="h-8 min-w-[2.6rem] rounded-md grid place-items-center text-[11px] font-bold text-white"
                        style={cell ? { backgroundColor: heatColor(cell.pct), backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 55%)', boxShadow: cell.pct >= 0.85 ? `0 0 10px ${heatColor(cell.pct)}` : 'none', textShadow: '0 1px 2px rgba(0,0,0,0.45)' } : { backgroundColor: 'var(--surface2)' }}
                        title={cell ? `${displayName(t.manager, t.conf)} -- Week ${w}: ${cell.score.toFixed(1)}` : 'No score'}
                      >
                        {cell ? Math.round(cell.score) : '–'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  return (
    <FunCard
      chartId="season-heat-map"
      title="Season Heat Map"
    >
      <Panel />
      <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-semibold text-[var(--muted)]">
        <span>Cold</span>
        <span className="h-2.5 w-40 rounded-full" style={{ background: 'linear-gradient(90deg, var(--proj), var(--coral))' }} />
        <span>Hot</span>
      </div>
    </FunCard>
  );
}
