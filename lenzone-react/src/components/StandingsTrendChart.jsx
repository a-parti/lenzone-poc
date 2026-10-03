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
function ChartPanel({ conf, title, series, weeks, yMin, yMax, formatY }) {
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
  const yFor = (v) => MARGIN.top + (1 - (v - yMin) / ((yTop - yMin) || 1)) * PLOT_H;
  const ticks = niceTicks(yMin, yMax, 5);
  const yTop = Math.max(yMax, ticks.at(-1) ?? yMax);
  const fmt = (v) => (formatY ? formatY(v) : Math.round(v));
  const references = series.filter(s => s.isReference);
  const rankedTeams = series
    .filter(s => !s.isReference)
    .slice()
    .sort((a, b) => (b.points.at(-1)?.value ?? -Infinity) - (a.points.at(-1)?.value ?? -Infinity));

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
    <div className="min-w-0">
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
                <span className="w-4 text-right font-bold text-[var(--muted)] shrink-0">{i + 1}</span>
                <TeamMiniLogo manager={s.manager} size={18} ringColor={s.color} />
                <span className="truncate flex-1 font-semibold text-[var(--text2)]">{graphName(s)}</span>
                <span className="font-bold text-[var(--text)] shrink-0">{s.points.length ? fmt(s.points.at(-1).value) : '—'}</span>
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
function TrendCard({ title, chartId, panels, weeks, yMin, yMax, formatY }) {
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
        <ChartPanel conf="AFC" title={title} series={panels.AFC} weeks={weeks} yMin={yMin} yMax={yMax} formatY={formatY} />
        <div className="hidden lg:block w-px bg-[var(--border)]" aria-hidden="true" />
        <ChartPanel conf="NFC" title={title} series={panels.NFC} weeks={weeks} yMin={yMin} yMax={yMax} formatY={formatY} />
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
  history, weeklyHistory, weeklyMedians, afcManagers, nfcManagers, hexColorMap, latestCompletedWeek
}) {
  const [view, setView] = useState("cumulative");
  const weeks = useMemo(() => Array.from({ length: latestCompletedWeek + 1 }, (_, i) => i), [latestCompletedWeek]);
  const weeklyWeeks = useMemo(() => Array.from({ length: latestCompletedWeek }, (_, i) => i + 1), [latestCompletedWeek]);

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
  const ptsPanels = useMemo(() => cumulative('pts'), [history, afcManagers, nfcManagers, hexColorMap]);
  const pfPanels = useMemo(() => cumulative('pf'), [history, afcManagers, nfcManagers, hexColorMap]);
  // Weekly points against, averaged over that week's games (in-conference + cross-conference).
  const weeklyPaPanels = useMemo(() => byConf((m, conf, key) => ({
    manager: m, conf, color: colorOf(m),
    points: (weeklyHistory[key][m] || [])
      .map(r => ({ week: r.week, values: [r.paIntra, r.paCross].filter(v => v != null) }))
      .filter(r => r.values.length > 0)
      .map(r => ({ week: r.week, value: r.values.reduce((a, b) => a + b, 0) / r.values.length }))
  })), [weeklyHistory, afcManagers, nfcManagers, hexColorMap]);
  // Weekly PF, each panel with its own conference's weekly median as a dashed reference line.
  const pfVsMedianPanels = useMemo(() => {
    const panels = byConf((m, conf, key) => ({
      manager: m, conf, color: colorOf(m),
      points: (weeklyHistory[key][m] || []).filter(r => r.pf != null).map(r => ({ week: r.week, value: r.pf }))
    }));
    panels.AFC.push({ manager: "AFC Median", color: "var(--afc)", dashed: true, isReference: true, points: (weeklyMedians?.afc || []) });
    panels.NFC.push({ manager: "NFC Median", color: "var(--nfc)", dashed: true, isReference: true, points: (weeklyMedians?.nfc || []) });
    return panels;
  }, [weeklyHistory, afcManagers, nfcManagers, hexColorMap, weeklyMedians]);

  // One shared max per metric across BOTH conferences, so the panels are directly comparable.
  const maxOf = (panels) => Math.max(1, ...[...panels.AFC, ...panels.NFC].flatMap(s => s.points.map(p => p.value)));

  if (latestCompletedWeek < 1) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--muted)] italic">
        Trends need at least one completed week -- check back after Week 1 wraps up.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-[var(--text)]">Trends</h2>
        <div className="inline-flex rounded-full bg-[var(--surface2)] border border-[var(--border)] p-1 gap-1" role="group" aria-label="Trend view">
          {[["cumulative", "Season so far"], ["weekly", "Week by week"]].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-200 ${
                view === id ? "bg-[var(--accent)] text-[var(--accent-text)]" : "text-[var(--text2)] hover:text-[var(--text)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "cumulative" && (
        <>
          <TrendCard
            chartId="pts" title="League Pts" panels={ptsPanels} weeks={weeks}
            yMin={0} yMax={maxOf(ptsPanels)} formatY={(v) => (Number.isInteger(v) ? v : v.toFixed(1))}
          />
          <TrendCard
            chartId="pf" title="Total Points Scored (PF)" panels={pfPanels} weeks={weeks}
            yMin={0} yMax={maxOf(pfPanels)} formatY={(v) => Math.round(v)}
          />
        </>
      )}

      {view === "weekly" && (
        <>
          <TrendCard
            chartId="wk-pf-median" title="Points Scored Each Week vs. Conference Median" panels={pfVsMedianPanels} weeks={weeklyWeeks}
            yMin={0} yMax={maxOf(pfVsMedianPanels)} formatY={(v) => Math.round(v)}
          />
          <TrendCard
            chartId="wk-pa" title="Points Against Each Week (avg of both games)" panels={weeklyPaPanels} weeks={weeklyWeeks}
            yMin={0} yMax={maxOf(weeklyPaPanels)} formatY={(v) => Math.round(v)}
          />
        </>
      )}
    </section>
  );
}
