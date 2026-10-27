import React, { useMemo, useRef, useState } from 'react';
import { useNameDisplay } from '../context/NameDisplayContext';
import ExportControls from './ExportControls';
import TeamMiniLogo from './TeamMiniLogo';
import useElementPngExport from '../hooks/useElementPngExport';

const WIDTH = 600;
const HEIGHT = 300;
const MARGIN = { top: 20, right: 20, bottom: 36, left: 56 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const FALLBACK_COLOR = "#8FA3AD";

// Round tick steps (1/2/5 x a power of ten) so the axis reads 0, 2, 4, 6... instead of 2.3, 4.5.
function niceTicks(min, max, count = 4) {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  const step = (r > 5 ? 10 : r > 2 ? 5 : r > 1 ? 2 : 1) * mag;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

// One conference's lines for one metric. No end-of-line logos (too crowded): hovering a line, a
// dot, or a legend entry highlights that team and shows its name and value.
function ChartPanel({ conf, title, series, weeks, yMin, yMax, formatY, zeroLine = false, legendMode = "last", invertY = false, fixedTicks = null, lowerIsBetter = false }) {
  const [hover, setHover] = useState(null); // { manager, week? }
  const { mode: nameMode, displayName, managerName } = useNameDisplay();
  const graphName = (s) => {
    if (s.isReference) return s.manager;
    const primary = displayName(s.manager, s.conf);
    const secondary = nameMode === 'teams' ? managerName(s.manager, s.conf) : null;
    return secondary ? `${primary} (${secondary})` : primary;
  };
  const xMin = weeks[0];
  const xSpan = (weeks[weeks.length - 1] - xMin) || 1;
  const xFor = (w) => MARGIN.left + (weeks.length > 1 ? ((w - xMin) / xSpan) * PLOT_W : 0);
  const yFor = (v) => {
    const t = (v - yMin) / ((yTop - yMin) || 1);
    return MARGIN.top + (invertY ? t : 1 - t) * PLOT_H;
  };
  const ticks = fixedTicks || niceTicks(yMin, yMax, 5);
  const yTop = Math.max(yMax, ticks.at(-1) ?? yMax);
  const fmt = (v) => (formatY ? formatY(v) : Math.round(v));
  const references = series.filter(s => s.isReference);
  // Legend value: the latest point (running totals) or the per-week average (weekly charts).
  const legendValue = (s) => {
    if (!s.points.length) return null;
    return legendMode === "avg"
      ? s.points.reduce((sum, p) => sum + p.value, 0) / s.points.length
      : s.points.at(-1).value;
  };
  const rankedTeams = series
    .filter(s => !s.isReference)
    .slice()
    .sort((a, b) => (lowerIsBetter
      ? (legendValue(a) ?? Infinity) - (legendValue(b) ?? Infinity)
      : (legendValue(b) ?? -Infinity) - (legendValue(a) ?? -Infinity)));

  const hoveredSeries = hover ? series.find(s => s.manager === hover.manager) : null;
  const hoveredPoint = hoveredSeries
    ? (hover.week != null ? hoveredSeries.points.find(p => p.week === hover.week) : hoveredSeries.points.at(-1))
    : null;
  // Floating label next to the hovered point; flips to the left side near the right edge.
  const label = hoveredSeries && hoveredPoint ? (() => {
    const text = `${graphName(hoveredSeries)} · Wk ${hoveredPoint.week}: ${fmt(hoveredPoint.value)}`;
    const w = Math.min(380, text.length * 6.6 + 16);
    const px = xFor(hoveredPoint.week);
    const py = yFor(hoveredPoint.value);
    const x = px + 10 + w > WIDTH - 4 ? px - 10 - w : px + 10;
    const y = Math.max(4, Math.min(HEIGHT - 26, py - 11));
    return { text, w, x, y, color: hoveredSeries.color };
  })() : null;

  return (
    <div className="min-w-0 w-full max-w-2xl mx-auto lg:max-w-none">
      <div className="flex items-center gap-3 mb-1">
        <span className={`text-xs font-black tracking-[0.2em] ${conf === 'AFC' ? 'text-[var(--afc)]' : 'text-[var(--nfc)]'}`}>{conf}</span>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label={`${title} -- ${conf}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yFor(t)} y2={yFor(t)} stroke="var(--border)" strokeOpacity={0.6} strokeWidth={1} />
            <text x={MARGIN.left - 8} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize={17} fill="var(--muted)">{fmt(t)}</text>
          </g>
        ))}
        {zeroLine && yMin < 0 && (
          <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yFor(0)} y2={yFor(0)} stroke="var(--text2)" strokeWidth={1.5} strokeDasharray="6 4" />
        )}
        {weeks.map(w => (
          <text key={w} x={xFor(w)} y={HEIGHT - 8} textAnchor="middle" fontSize={17} fill="var(--muted)">{w}</text>
        ))}
        {series.map(s => {
          const isHovered = hover?.manager === s.manager;
          const isDimmed = hover && !isHovered;
          const points = s.points.map(p => `${xFor(p.week)},${yFor(p.value)}`).join(' ');
          return (
            <g key={s.manager} opacity={isDimmed ? 0.12 : 1}>
              <polyline
                points={points} fill="none" stroke={s.color} strokeWidth={isHovered ? 4 : 2.25}
                strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? "5 4" : undefined}
              />
              {/* Wide invisible stroke so the line itself is easy to hover, not just its dots. */}
              <polyline
                points={points} fill="none" stroke="transparent" strokeWidth={12}
                onMouseEnter={() => setHover({ manager: s.manager })}
                style={{ cursor: 'pointer' }}
              />
              {s.points.map(p => (
                <circle
                  key={p.week} cx={xFor(p.week)} cy={yFor(p.value)} r={isHovered ? 5 : 3.5} fill={s.color}
                  onMouseEnter={() => setHover({ manager: s.manager, week: p.week })}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </g>
          );
        })}
        {label && (
          <g pointerEvents="none">
            <rect x={label.x} y={label.y} width={label.w} height={22} rx={6} fill="var(--surface)" stroke={label.color} strokeWidth={1.5} />
            <text x={label.x + 8} y={label.y + 15} fontSize={12} fontWeight={700} fill="var(--text)">{label.text}</text>
          </g>
        )}
      </svg>
      {/* Legend: teams ranked by their latest value (with the value shown), in a tidy grid; the
          median reference lines sit apart under a divider. Hover any entry to spotlight its line. */}
      <div className="mt-3 border-t border-[var(--border)] pt-3">
        {legendMode === "avg" && <p className="text-[11px] font-semibold text-[var(--muted)] mb-1.5">Ranked by average per week</p>}
        <ol className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-x-4 gap-y-1">
          {rankedTeams.map((s, i) => (
            <li key={s.manager}>
              <button
                type="button"
                onMouseEnter={() => setHover({ manager: s.manager })}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover({ manager: s.manager })}
                onBlur={() => setHover(null)}
                className="w-full flex items-center gap-2 py-0.5 text-xs text-left"
                style={{ opacity: hover && hover.manager !== s.manager ? 0.35 : 1 }}
              >
                <span className="w-4 text-right font-bold text-[var(--muted)] shrink-0">{lowerIsBetter && legendValue(s) != null ? Math.round(legendValue(s)) : i + 1}</span>
                <TeamMiniLogo manager={s.manager} size={18} ringColor={s.color} />
                <span className="truncate flex-1 font-semibold text-[var(--text2)]">{graphName(s)}</span>
                {!lowerIsBetter && <span className="font-bold text-[var(--text)] shrink-0">{legendValue(s) != null ? fmt(legendValue(s)) : '—'}</span>}
              </button>
            </li>
          ))}
        </ol>
        {references.length > 0 && (
          <div className="mt-2 pt-2 border-t border-dashed border-[var(--border)] flex flex-wrap gap-x-5 gap-y-1">
            {references.map(s => (
              <button
                key={s.manager}
                type="button"
                onMouseEnter={() => setHover({ manager: s.manager })}
                onMouseLeave={() => setHover(null)}
                className="flex items-center gap-2 text-xs font-semibold text-[var(--text2)]"
              >
                <span className="w-5 border-t-2 border-dashed" style={{ borderColor: s.color }} />
                {s.manager}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// One metric: AFC and NFC panels side by side (stacked on phones) on the SAME y-scale, so the two
// conferences can be compared directly without 24 lines crowding one chart. One export covers both.
function TrendCard({ title, chartId, panels, weeks, yMin, yMax, formatY, zeroLine = false, legendMode = "last", panelOptions = {} }) {
  const exportRef = useRef(null);
  const imageExport = useElementPngExport(exportRef, `lenzone-${chartId}-trend`, { minWidth: 1100 });
  return (
    <div ref={exportRef} data-mode={imageExport.exportTheme} data-scheme={imageExport.scheme} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <p className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">{title}</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6">
        <ChartPanel conf="AFC" title={title} series={panels.AFC} weeks={weeks} yMin={yMin} yMax={yMax} formatY={formatY} zeroLine={zeroLine} legendMode={legendMode} {...panelOptions} />
        <div className="hidden lg:block w-px bg-[var(--border)]" aria-hidden="true" />
        <ChartPanel conf="NFC" title={title} series={panels.NFC} weeks={weeks} yMin={yMin} yMax={yMax} formatY={formatY} zeroLine={zeroLine} legendMode={legendMode} {...panelOptions} />
      </div>
    </div>
  );
}

// history: { afc: {manager: [{week,pts,pf,rank}]}, nfc: {...} } from buildStandingsHistory (week 0
// baseline through latestCompletedWeek, cumulative).
// weeklyHistory: { afc: {manager: [{week,pf,paIntra,paCross}]}, nfc: {...} } from
// buildWeeklyPfPaHistory (week 1 through latestCompletedWeek, per-week NOT cumulative).
// weeklyMedians: { afc: [{week,value}], nfc: [...] } from computeWeeklyConferenceMedian.
// hexColorMap: { manager: '#rrggbb' } (see teamColors.js buildConferenceHexColorMap).
export default function StandingsTrendChart({
  history, weeklyHistory, afcManagers, nfcManagers, hexColorMap, latestCompletedWeek
}) {
  const weeks = useMemo(() => Array.from({ length: latestCompletedWeek + 1 }, (_, i) => i), [latestCompletedWeek]);

  const colorOf = (m) => hexColorMap[m] || FALLBACK_COLOR;
  // Each builder returns { AFC: [...series], NFC: [...series] }.
  const byConf = (build) => ({
    AFC: afcManagers.map(m => build(m, 'AFC', 'afc')),
    NFC: nfcManagers.map(m => build(m, 'NFC', 'nfc'))
  });
  const cumulative = (metric) => byConf((m, conf, key) => ({
    manager: m, conf, color: colorOf(m),
    points: (history[key][m] || []).map(r => ({ week: r.week, value: r[metric] }))
  }));
  // Running total of a per-week value from the weekly PF/PA history, starting at 0 in Week 0 so it
  // lines up with the other season-so-far charts. A week with no value adds nothing.
  const runningTotal = (perWeek) => byConf((m, conf, key) => {
    let sum = 0;
    const rows = weeklyHistory[key][m] || [];
    return {
      manager: m, conf, color: colorOf(m),
      points: [{ week: 0, value: 0 }, ...rows.map(r => {
        const v = perWeek(r);
        if (Number.isFinite(v)) sum += v;
        return { week: r.week, value: sum };
      })]
    };
  });

  // Conference standing after each completed week (Week 0 is a synthetic everyone-tied baseline, so
  // it's left off). Same ranking/tiebreak as the standings table.
  const rankPanels = useMemo(() => {
    const panels = cumulative('rank');
    ['AFC', 'NFC'].forEach(conf => panels[conf].forEach(s => { s.points = s.points.filter(p => p.week >= 1); }));
    return panels;
  }, [history, afcManagers, nfcManagers, hexColorMap]);
  const rankWeeks = useMemo(() => Array.from({ length: latestCompletedWeek }, (_, i) => i + 1), [latestCompletedWeek]);
  const teamsPerConf = Math.max(afcManagers.length, nfcManagers.length, 1);
  const pfPanels = useMemo(() => cumulative('pf'), [history, afcManagers, nfcManagers, hexColorMap]);
  const paIntraPanels = useMemo(() => runningTotal(r => r.paIntra), [weeklyHistory, afcManagers, nfcManagers, hexColorMap]);
  const paCrossPanels = useMemo(() => runningTotal(r => r.paCross), [weeklyHistory, afcManagers, nfcManagers, hexColorMap]);

  const allValues = (panels) => [...panels.AFC, ...panels.NFC].flatMap(s => s.points.map(p => p.value));
  // One shared range per metric across BOTH conferences, so the panels are directly comparable.
  const maxOf = (panels) => Math.max(1, ...allValues(panels));
  const whole = (v) => Math.round(v);

  if (latestCompletedWeek < 1) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--muted)] italic">
        Trends need at least one completed week -- check back after Week 1 wraps up.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold text-[var(--text)]">Trends <span className="text-sm font-semibold text-[var(--muted)]">· season so far</span></h2>
      <TrendCard
        chartId="rank" title="Conference Standing" panels={rankPanels} weeks={rankWeeks}
        yMin={1} yMax={teamsPerConf} formatY={(v) => `#${Math.round(v)}`}
        panelOptions={{ invertY: true, lowerIsBetter: true, fixedTicks: [1, 3, 6, 9, teamsPerConf] }}
      />
      <TrendCard
        chartId="pf" title="Total Points Scored (PF)" panels={pfPanels} weeks={weeks}
        yMin={0} yMax={maxOf(pfPanels)} formatY={whole}
      />
      <TrendCard
        chartId="pa-intra" title="Points Against -- In-Conference" panels={paIntraPanels} weeks={weeks}
        yMin={0} yMax={maxOf(paIntraPanels)} formatY={whole}
      />
      <TrendCard
        chartId="pa-cross" title="Points Against -- Cross-Conference" panels={paCrossPanels} weeks={weeks}
        yMin={0} yMax={maxOf(paCrossPanels)} formatY={whole}
      />
    </section>
  );
}
