import React, { useMemo, useState } from 'react';
import { useNameDisplay } from '../context/NameDisplayContext';

const WIDTH = 900;
const HEIGHT = 320;
const MAX_LOGO_SIZE = 18;
const MIN_LOGO_SIZE = 9;
// Right margin sized for the LARGEST possible logo -- the actual per-chart logo size (below) only
// ever shrinks from this, so reserving space for the max keeps the plot area's own width constant
// across charts with different team counts.
const MARGIN = { top: 16, right: 16 + MAX_LOGO_SIZE + 10, bottom: 28, left: 40 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

function niceTicks(min, max, count = 5) {
  if (min === max) return [min];
  const span = max - min;
  const step = span / count;
  const ticks = [];
  for (let i = 0; i <= count; i++) ticks.push(min + step * i);
  return ticks;
}

// How big can each end-of-line logo be and still let `count` of them fit, spaced at least their
// own diameter apart, inside the available plot height? Shrinks automatically as more teams share
// one chart (e.g. "ALL" conferences = ~24 lines) instead of a fixed size that would force
// overlap or run off the chart entirely once there isn't room for everyone at full size.
function logoSizeFor(count, availableHeight) {
  if (count <= 1) return MAX_LOGO_SIZE;
  const bySpace = availableHeight / count;
  return Math.max(MIN_LOGO_SIZE, Math.min(MAX_LOGO_SIZE, Math.floor(bySpace)));
}

// Vertical de-clutter for end-of-line logos: given their natural y positions (sorted), space any
// that are closer than `minGap` apart. If there are more items than can possibly fit spaced that
// far apart within [min, max] (more teams than room even at the smallest logo size), falls back to
// evenly distributing all of them across the full available range instead of a greedy push that
// can silently shove the first few items past `min` and off the top of the chart.
function declutter(items, minGap, min, max) {
  const n = items.length;
  if (n === 0) return [];
  const available = max - min;
  if ((n - 1) * minGap > available) {
    return items.map((it, i) => ({ ...it, y: n === 1 ? (min + max) / 2 : min + (available * i) / (n - 1) }));
  }
  const arr = items.map(it => ({ ...it }));
  for (let i = 1; i < n; i++) {
    if (arr[i].y < arr[i - 1].y + minGap) arr[i].y = arr[i - 1].y + minGap;
  }
  if (arr[n - 1].y > max) {
    arr[n - 1].y = max;
    for (let i = n - 2; i >= 0; i--) {
      const desired = arr[i + 1].y - minGap;
      if (arr[i].y > desired) arr[i].y = desired;
    }
  }
  return arr;
}

// One hand-built SVG line chart per metric -- no charting library in this project, and a single
// small responsive SVG is simpler than pulling one in for three line charts. `invertY` flips the
// y-axis (used for Rank, where #1 should plot at the TOP). `logoMap`/`chartId` are for the
// end-of-line team logo (chartId keeps each chart's SVG clipPath ids unique on a page with three
// of these charts at once).
function LineChart({ title, series, weeks, yMin, yMax, invertY, formatY, logoMap, chartId }) {
  const [hovered, setHovered] = useState(null);
  const { mode: nameMode, displayName, managerName } = useNameDisplay();
  const graphName = (manager, conf) => {
    const primary = displayName(manager, conf);
    const secondary = nameMode === 'teams' ? managerName(manager, conf) : null;
    return secondary ? `${primary} (${secondary})` : primary;
  };
  const xMin = weeks[0];
  const xSpan = (weeks[weeks.length - 1] - xMin) || 1;
  const xFor = (w) => MARGIN.left + (weeks.length > 1 ? ((w - xMin) / xSpan) * PLOT_W : 0);
  const yFor = (v) => {
    const t = (v - yMin) / ((yMax - yMin) || 1);
    return invertY ? MARGIN.top + t * PLOT_H : MARGIN.top + (1 - t) * PLOT_H;
  };
  const ticks = niceTicks(yMin, yMax, 4);

  // Each series' natural end-of-line y, de-cluttered so close/tied teams don't stack their
  // logos/labels on top of each other. Reference lines (isReference, e.g. a conference median)
  // get a short text label here instead of a team logo -- there's no team to show a crest for.
  // Logo size shrinks automatically as more lines share this chart (see logoSizeFor) so a full
  // "ALL" conference view (~24 lines) doesn't cram/overlap or spill outside the plot area.
  const withPositions = series.filter(s => s.points.length > 0).length;
  const logoSize = useMemo(() => logoSizeFor(withPositions, PLOT_H), [withPositions]);
  const endX = MARGIN.left + PLOT_W + 6;
  const logoPositions = useMemo(() => {
    const natural = series
      .filter(s => s.points.length > 0)
      .map(s => ({ manager: s.manager, conf: s.conf, color: s.color, isReference: !!s.isReference, y: yFor(s.points[s.points.length - 1].value) }))
      .sort((a, b) => a.y - b.y);
    return declutter(natural, logoSize + 2, MARGIN.top, MARGIN.top + PLOT_H);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, yMin, yMax, invertY, logoSize]);

  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4">
      <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)] mb-2">{title}</p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" aria-label={title}>
        {/* Gridlines + y-axis labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yFor(t)} y2={yFor(t)} stroke="var(--border)" strokeOpacity={0.4} strokeWidth={1} />
            <text x={MARGIN.left - 8} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--muted)">
              {formatY ? formatY(t) : Math.round(t)}
            </text>
          </g>
        ))}
        {/* x-axis week labels */}
        {weeks.map(w => (
          <text key={w} x={xFor(w)} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill="var(--muted)">{w}</text>
        ))}
        {/* One polyline per manager */}
        {series.map(s => {
          const isHovered = hovered === s.manager;
          const isDimmed = hovered && !isHovered;
          const points = s.points.map(p => `${xFor(p.week)},${yFor(p.value)}`).join(' ');
          return (
            <g key={s.manager} opacity={isDimmed ? 0.15 : 1}>
              <polyline
                points={points} fill="none" stroke={s.color} strokeWidth={isHovered ? 3 : 1.75}
                strokeLinejoin="round" strokeLinecap="round"
                strokeDasharray={s.dashed ? "5 4" : undefined}
              />
              {s.points.map(p => (
                <circle
                  key={p.week} cx={xFor(p.week)} cy={yFor(p.value)} r={isHovered ? 3.5 : 2.5} fill={s.color}
                  onMouseEnter={() => setHovered(s.manager)} onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <title>{`${s.isReference ? s.manager : graphName(s.manager, s.conf)} — Wk ${p.week}: ${formatY ? formatY(p.value) : p.value}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {/* End-of-line team logo -- a small circular clip per manager so each line ends on a
            recognizable team mark instead of just trailing off at the right edge. Reference lines
            (e.g. a conference median) get a short text label instead -- there's no team crest for
            "AFC Median" to show. */}
        <defs>
          {logoMap && logoPositions.filter(p => !p.isReference).map(p => logoMap[p.manager] && (
            <clipPath key={p.manager} id={`trend-logo-${chartId}-${p.manager.replace(/[^a-zA-Z0-9]/g, '')}`}>
              <circle cx={endX + logoSize / 2} cy={p.y} r={logoSize / 2} />
            </clipPath>
          ))}
        </defs>
        {logoPositions.map(p => {
          const isHovered = hovered === p.manager;
          const isDimmed = hovered && !isHovered;
          if (p.isReference) {
            return (
              <text
                key={p.manager} x={endX} y={p.y} dominantBaseline="middle" fontSize={10} fontWeight={700}
                fill={p.color} opacity={isDimmed ? 0.25 : 1}
                onMouseEnter={() => setHovered(p.manager)} onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                {p.manager}
              </text>
            );
          }
          const logoUrl = logoMap?.[p.manager];
          const clipId = `trend-logo-${chartId}-${p.manager.replace(/[^a-zA-Z0-9]/g, '')}`;
          return (
            <g
              key={p.manager}
              opacity={isDimmed ? 0.25 : 1}
              onMouseEnter={() => setHovered(p.manager)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              {logoUrl ? (
                <image
                  href={logoUrl} x={endX} y={p.y - logoSize / 2} width={logoSize} height={logoSize}
                  clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <circle cx={endX + logoSize / 2} cy={p.y} r={logoSize / 2} fill={p.color} />
              )}
              <circle cx={endX + logoSize / 2} cy={p.y} r={logoSize / 2} fill="none" stroke={p.color} strokeWidth={isHovered ? 2 : 1} />
              <title>{graphName(p.manager, p.conf)}</title>
            </g>
          );
        })}
      </svg>
      {/* Legend -- also hoverable, so you can find a line by name instead of only by hovering a dot */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {series.map(s => (
          <button
            key={s.manager}
            type="button"
            onMouseEnter={() => setHovered(s.manager)}
            onMouseLeave={() => setHovered(null)}
            className="text-[10px] font-semibold flex items-center gap-1"
            style={{ opacity: hovered && hovered !== s.manager ? 0.35 : 1 }}
          >
            {logoMap?.[s.manager] ? (
              <img src={logoMap[s.manager]} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" style={{ border: `1px solid ${s.color}` }} />
            ) : (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            )}
            <span className="truncate max-w-[12rem]" style={{ color: s.color }}>{s.isReference ? s.manager : graphName(s.manager, s.conf)}</span>
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
// hexColorMap: { manager: '#rrggbb' } (see teamColors.js buildConferenceHexColorMap) -- SVG can't
// consume the Tailwind text-color classes the rest of the app uses for team color.
// logoMap: { manager: url } (App.jsx's existing teamLogoMap) -- for the end-of-line and legend logos.
export default function StandingsTrendChart({
  history, weeklyHistory, weeklyMedians, afcManagers, nfcManagers, hexColorMap, logoMap, confFilter, latestCompletedWeek
}) {
  const [view, setView] = useState("cumulative");
  const weeks = useMemo(() => Array.from({ length: latestCompletedWeek + 1 }, (_, i) => i), [latestCompletedWeek]);
  const weeklyWeeks = useMemo(() => Array.from({ length: latestCompletedWeek }, (_, i) => i + 1), [latestCompletedWeek]);

  const managers = confFilter === "AFC" ? afcManagers : confFilter === "NFC" ? nfcManagers : [...afcManagers, ...nfcManagers];

  const buildSeries = (metric) => managers.map(m => {
    const isAfc = afcManagers.includes(m);
    const rows = (isAfc ? history.afc[m] : history.nfc[m]) || [];
    return { manager: m, conf: isAfc ? 'AFC' : 'NFC', color: hexColorMap[m] || "#94a3b8", points: rows.map(r => ({ week: r.week, value: r[metric] })) };
  });
  const buildWeeklySeries = (metric) => managers.map(m => {
    const isAfc = afcManagers.includes(m);
    const rows = (isAfc ? weeklyHistory.afc[m] : weeklyHistory.nfc[m]) || [];
    return {
      manager: m, conf: isAfc ? 'AFC' : 'NFC', color: hexColorMap[m] || "#94a3b8",
      points: rows.filter(r => r[metric] != null).map(r => ({ week: r.week, value: r[metric] }))
    };
  });

  const ptsSeries = useMemo(() => buildSeries('pts'), [history, managers, hexColorMap]);
  const pfSeries = useMemo(() => buildSeries('pf'), [history, managers, hexColorMap]);
  const rankSeries = useMemo(() => buildSeries('rank'), [history, managers, hexColorMap]);

  const weeklyPfSeries = useMemo(() => buildWeeklySeries('pf'), [weeklyHistory, managers, hexColorMap]);
  const weeklyPaCrossSeries = useMemo(() => buildWeeklySeries('paCross'), [weeklyHistory, managers, hexColorMap]);
  const weeklyPaIntraSeries = useMemo(() => buildWeeklySeries('paIntra'), [weeklyHistory, managers, hexColorMap]);

  // Weekly PF alongside both conferences' weekly median as flat dashed reference lines -- lets a
  // single team be read against "a typical AFC score" and "a typical NFC score" at a glance,
  // regardless of which conference's teams are currently shown.
  const pfVsMedianSeries = useMemo(() => [
    ...weeklyPfSeries,
    { manager: "AFC Median", color: "#64748b", dashed: true, isReference: true, points: (weeklyMedians?.afc || []) },
    { manager: "NFC Median", color: "#334155", dashed: true, isReference: true, points: (weeklyMedians?.nfc || []) }
  ], [weeklyPfSeries, weeklyMedians]);

  const maxOf = (series) => Math.max(1, ...series.flatMap(s => s.points.map(p => p.value)));
  const maxRank = confFilter === "ALL" || !confFilter ? Math.max(afcManagers.length, nfcManagers.length) : managers.length;

  if (latestCompletedWeek < 1) {
    return (
      <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4 text-sm text-[var(--muted)] italic">
        Trends need at least one completed week -- check back after Week 1 wraps up.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full bg-[var(--surface2)] border border-[var(--border)] p-1 gap-1">
        {[["cumulative", "Cumulative"], ["weekly", "Weekly"]].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-200 ${
              view === id ? "bg-[var(--accent)] text-[var(--accent-text)]" : "text-[var(--text2)] hover:text-[var(--text)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "cumulative" && (
        <>
          <LineChart
            chartId="pts" title="Cumulative Standings Pts" series={ptsSeries} weeks={weeks}
            yMin={0} yMax={maxOf(ptsSeries)} formatY={(v) => v.toFixed(1)} logoMap={logoMap}
          />
          <LineChart
            chartId="pf" title="Cumulative PF" series={pfSeries} weeks={weeks}
            yMin={0} yMax={maxOf(pfSeries)} formatY={(v) => Math.round(v)} logoMap={logoMap}
          />
          <LineChart
            chartId="rank" title="Conference Rank" series={rankSeries} weeks={weeks} yMin={1} yMax={maxRank} invertY
            formatY={(v) => `#${Math.round(v)}`} logoMap={logoMap}
          />
        </>
      )}

      {view === "weekly" && (
        <>
          <LineChart
            chartId="wk-pf-median" title="Weekly PF vs. AFC/NFC Median" series={pfVsMedianSeries} weeks={weeklyWeeks}
            yMin={0} yMax={maxOf(pfVsMedianSeries)} formatY={(v) => Math.round(v)} logoMap={logoMap}
          />
          <LineChart
            chartId="wk-pf" title="Weekly PF" series={weeklyPfSeries} weeks={weeklyWeeks}
            yMin={0} yMax={maxOf(weeklyPfSeries)} formatY={(v) => Math.round(v)} logoMap={logoMap}
          />
          <LineChart
            chartId="wk-pa-cross" title="Weekly PA (Cross-Conference)" series={weeklyPaCrossSeries} weeks={weeklyWeeks}
            yMin={0} yMax={maxOf(weeklyPaCrossSeries)} formatY={(v) => Math.round(v)} logoMap={logoMap}
          />
          <LineChart
            chartId="wk-pa-intra" title="Weekly PA (In-Conference)" series={weeklyPaIntraSeries} weeks={weeklyWeeks}
            yMin={0} yMax={maxOf(weeklyPaIntraSeries)} formatY={(v) => Math.round(v)} logoMap={logoMap}
          />
        </>
      )}
    </div>
  );
}
