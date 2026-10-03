import React, { useMemo, useRef, useState } from 'react';
import { useNameDisplay } from '../context/NameDisplayContext';
import ExportControls from './ExportControls';
import useElementPngExport from '../hooks/useElementPngExport';

const WIDTH = 900;
const HEIGHT = 320;
const MARGIN = { top: 20, right: 20, bottom: 28, left: 44 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const FALLBACK_COLOR = "#8FA3AD";

function niceTicks(min, max, count = 5) {
  if (min === max) return [min];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + step * i);
}

// One hand-built SVG line chart per metric. No end-of-line logos (too crowded with 12-24 lines):
// hovering a line, a dot, or a legend entry highlights that team and shows its name and value.
function LineChart({ title, series, weeks, yMin, yMax, formatY, chartId }) {
  const [hover, setHover] = useState(null); // { manager, week? }
  const exportRef = useRef(null);
  const imageExport = useElementPngExport(exportRef, `lenzone-${chartId}-trend`, { minWidth: 960 });
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
  const yFor = (v) => MARGIN.top + (1 - (v - yMin) / ((yMax - yMin) || 1)) * PLOT_H;
  const ticks = niceTicks(yMin, yMax, 4);
  const fmt = (v) => (formatY ? formatY(v) : Math.round(v));

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
    <div ref={exportRef} data-mode={imageExport.exportTheme} data-scheme={imageExport.scheme} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
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
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yFor(t)} y2={yFor(t)} stroke="var(--border)" strokeOpacity={0.6} strokeWidth={1} />
            <text x={MARGIN.left - 8} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--muted)">{fmt(t)}</text>
          </g>
        ))}
        {weeks.map(w => (
          <text key={w} x={xFor(w)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">{w}</text>
        ))}
        {series.map(s => {
          const isHovered = hover?.manager === s.manager;
          const isDimmed = hover && !isHovered;
          const points = s.points.map(p => `${xFor(p.week)},${yFor(p.value)}`).join(' ');
          return (
            <g key={s.manager} opacity={isDimmed ? 0.12 : 1}>
              <polyline
                points={points} fill="none" stroke={s.color} strokeWidth={isHovered ? 3.5 : 1.75}
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
                  key={p.week} cx={xFor(p.week)} cy={yFor(p.value)} r={isHovered ? 4 : 2.5} fill={s.color}
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
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {series.map(s => (
          <button
            key={s.manager}
            type="button"
            onMouseEnter={() => setHover({ manager: s.manager })}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover({ manager: s.manager })}
            onBlur={() => setHover(null)}
            className="text-xs font-semibold flex items-center gap-1.5 py-0.5"
            style={{ opacity: hover && hover.manager !== s.manager ? 0.35 : 1 }}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="truncate max-w-[12rem] text-[var(--text2)]">{graphName(s)}</span>
          </button>
        ))}
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
  history, weeklyHistory, weeklyMedians, afcManagers, nfcManagers, hexColorMap, confFilter, latestCompletedWeek
}) {
  const [view, setView] = useState("cumulative");
  const weeks = useMemo(() => Array.from({ length: latestCompletedWeek + 1 }, (_, i) => i), [latestCompletedWeek]);
  const weeklyWeeks = useMemo(() => Array.from({ length: latestCompletedWeek }, (_, i) => i + 1), [latestCompletedWeek]);

  const managers = confFilter === "AFC" ? afcManagers : confFilter === "NFC" ? nfcManagers : [...afcManagers, ...nfcManagers];

  const buildSeries = (metric) => managers.map(m => {
    const isAfc = afcManagers.includes(m);
    const rows = (isAfc ? history.afc[m] : history.nfc[m]) || [];
    return { manager: m, conf: isAfc ? 'AFC' : 'NFC', color: hexColorMap[m] || FALLBACK_COLOR, points: rows.map(r => ({ week: r.week, value: r[metric] })) };
  });
  // Weekly points against, averaged over that week's games (in-conference + cross-conference).
  const buildWeeklyPaSeries = () => managers.map(m => {
    const isAfc = afcManagers.includes(m);
    const rows = (isAfc ? weeklyHistory.afc[m] : weeklyHistory.nfc[m]) || [];
    return {
      manager: m, conf: isAfc ? 'AFC' : 'NFC', color: hexColorMap[m] || FALLBACK_COLOR,
      points: rows
        .map(r => ({ week: r.week, values: [r.paIntra, r.paCross].filter(v => v != null) }))
        .filter(r => r.values.length > 0)
        .map(r => ({ week: r.week, value: r.values.reduce((a, b) => a + b, 0) / r.values.length }))
    };
  });
  const buildWeeklyPfSeries = () => managers.map(m => {
    const isAfc = afcManagers.includes(m);
    const rows = (isAfc ? weeklyHistory.afc[m] : weeklyHistory.nfc[m]) || [];
    return {
      manager: m, conf: isAfc ? 'AFC' : 'NFC', color: hexColorMap[m] || FALLBACK_COLOR,
      points: rows.filter(r => r.pf != null).map(r => ({ week: r.week, value: r.pf }))
    };
  });

  const ptsSeries = useMemo(() => buildSeries('pts'), [history, managers, hexColorMap]);
  const pfSeries = useMemo(() => buildSeries('pf'), [history, managers, hexColorMap]);
  const weeklyPaSeries = useMemo(() => buildWeeklyPaSeries(), [weeklyHistory, managers, hexColorMap]);
  // Weekly PF alongside both conferences' weekly median as dashed reference lines.
  const pfVsMedianSeries = useMemo(() => [
    ...buildWeeklyPfSeries(),
    { manager: "AFC Median", color: "var(--afc)", dashed: true, isReference: true, points: (weeklyMedians?.afc || []) },
    { manager: "NFC Median", color: "var(--nfc)", dashed: true, isReference: true, points: (weeklyMedians?.nfc || []) }
  ], [weeklyHistory, managers, hexColorMap, weeklyMedians]);

  const maxOf = (series) => Math.max(1, ...series.flatMap(s => s.points.map(p => p.value)));

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
          <LineChart
            chartId="pts" title="League Pts" series={ptsSeries} weeks={weeks}
            yMin={0} yMax={maxOf(ptsSeries)} formatY={(v) => (Number.isInteger(v) ? v : v.toFixed(1))}
          />
          <LineChart
            chartId="pf" title="Total Points Scored (PF)" series={pfSeries} weeks={weeks}
            yMin={0} yMax={maxOf(pfSeries)} formatY={(v) => Math.round(v)}
          />
        </>
      )}

      {view === "weekly" && (
        <>
          <LineChart
            chartId="wk-pf-median" title="Points Scored Each Week vs. AFC/NFC Median" series={pfVsMedianSeries} weeks={weeklyWeeks}
            yMin={0} yMax={maxOf(pfVsMedianSeries)} formatY={(v) => Math.round(v)}
          />
          <LineChart
            chartId="wk-pa" title="Points Against Each Week (avg of both games)" series={weeklyPaSeries} weeks={weeklyWeeks}
            yMin={0} yMax={maxOf(weeklyPaSeries)} formatY={(v) => Math.round(v)}
          />
        </>
      )}
    </section>
  );
}
