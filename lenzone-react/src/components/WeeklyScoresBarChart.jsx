import React, { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { useMatchupPreview } from '../context/MatchupPreviewContext';
import { HIGH_SCORE_PRIZES } from '../lib/highScorePrizes';

const HEIGHT = 440;
// bottom has to fit a -40deg-rotated team name below every bar -- long manager names need real
// room here or they get clipped by the chart's own edge. `left` looks oversized for just the
// y-axis tick labels, but the FIRST bar's rotated name swings up and to the LEFT of its own bar
// (textAnchor="end" + a negative rotation), so it needs just as much clearance on that side as the
// longest name needs vertically, not just enough room for a couple of digits.
// top needs room above the tallest bar for its score number AND (for whoever has the week's
// single highest score) the little cash/wine-glass flourish stacked above that.
const MARGIN = { top: 46, right: 110, bottom: 130, left: 132 };
const MIN_BAR_W = 62;
const BAR_GAP = 12;
const GROUP_GAP = 32;
const AFC_COLOR = "#f87171"; // tailwind red-400, matches CONF_STYLES.AFC.text
const NFC_COLOR = "#60a5fa"; // tailwind blue-400, matches CONF_STYLES.NFC.text
// Split typographic role: title + team names are a serif (Playfair Display -- already loaded and
// already the app's own editorial voice, used for the Home page nav titles), while every number
// on the chart (axis ticks, score values, median labels) is a bold geometric sans (DM Sans at a
// heavy weight) -- a deliberate serif/sans-serif split, not one font doing both jobs.
const DATA_FONT = "'DM Sans', ui-sans-serif, sans-serif";
// Lora, not Playfair Display -- Playfair's hairline-thin strokes (high contrast, built for LARGE
// display headlines) get spindly and hard to read once you're down at a 13px rotated label; Lora
// is a text-optimized serif (moderate, even stroke weight) meant to hold up at small sizes, so it
// keeps real serif character without the legibility trade-off.
const SERIF_FONT = "'Lora', Georgia, serif";
// Four categories for the "All Teams" win breakdown -- every manager plays BOTH an in-conference
// AND a cross-conference matchup each week, so there's up to two wins worth distinguishing instead
// of collapsing everything into one flat W/L. Priority when coloring a bar: winning both beats
// either single win, which beats winning neither (a loss, a tie, or a mix of the two -- "lost both"
// and "no wins" are the same bucket, not two separate ones). Deliberately four genuinely distinct
// hues (not a same-family intensity gradient, which read as too subtle/hard to tell apart at a
// glance) -- green stays reserved for the unambiguous best outcome (both), violet and amber mark
// the two different single-win types, red for no wins at all.
const BOTH_WIN_COLOR = "var(--pos)"; // the app's established "good" green
const INCONF_WIN_COLOR = "#8b5cf6"; // violet-500
const CROSS_WIN_COLOR = "#eab308"; // amber-500
const NO_WIN_COLOR = "var(--neg)"; // the app's established red -- no wins at all this week

// Focus mode's two real opponents get the app's actual green/red (win/loss is a real result).
// Everyone else is a THEORETICAL comparison against the chosen team's own score -- deliberately a
// completely different color family (blue/orange, not a lighter green/red) so "actual" and
// "theoretical" never get mistaken for shades of the same thing at a glance. No further split by
// conference here -- that made this specific chart too busy; same/cross-conference win breakdown
// stays a thing only the "All Teams" chart does.
const THEO_POS = "#3b82f6"; // blue-500 -- would lose to you
const THEO_NEG = "#f97316"; // orange-500 -- would beat you

function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// A round step size (1/2/5/10 x a power of ten) instead of "max / 5" -- otherwise the gap between
// gridlines is a different, ugly number (e.g. every 24.6 pts) depending on whatever the highest
// score happens to be that particular week, instead of a consistent, predictable jump every time.
function niceStep(max, targetCount = 5) {
  const rawStep = max / targetCount || 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const step = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  return step * magnitude;
}

// The plotted domain stays TIGHT to the real max (just a little headroom so the tallest bar isn't
// jammed against the very top edge) -- it does NOT round up to the next full tick step, which
// used to leave a lot of dead empty space above the tallest bar whenever the step happened to be
// large. Gridlines/labels are still standardized round numbers (see niceStep) -- they just stop
// wherever they land under that tight domain instead of always reaching exactly to the top.
function niceTicks(max, targetCount = 5) {
  const step = niceStep(max, targetCount);
  const domainMax = max * 1.08;
  const ticks = [];
  for (let v = 0; v <= domainMax; v += step) ticks.push(v);
  return { ticks, domainMax };
}

// Every team's real score for one specific week, as a bar chart, with the AFC and NFC median
// scores for that same week drawn as dashed reference lines so any bar can be read against "a
// typical score in their conference this week" at a glance. Bars keep a comfortable minimum width
// no matter how many teams there are -- the chart's own width grows to fit them instead of
// squeezing bars down to nothing, wrapped in a horizontally-scrollable container so a phone just
// scrolls sideways rather than everything shrinking illegibly.
//
// Two display modes:
// - Default (Matchups tab / "All Teams"): one flat ranking (AFC+NFC mixed, highest to lowest),
//   colored by real result -- a green intensity gradient for winning both / in-conference only /
//   cross-conference only (see the color constants below), red for no wins.
// - Focus mode (`focusManager` + `focusOpponents` passed, from This Week / "Your Matchups"): the
//   chosen team and their two real opponents (in-conference + cross-conference) come first as
//   their own group, everyone else follows as a second group sorted by score. Coloring in this
//   mode deliberately has nothing to do with beat/missed projection -- only the chosen team (accent
//   color) and their two opponents (green if scoring LESS than the chosen team right now, red if
//   scoring MORE) are colored; everyone else is a flat neutral bar.
// CSS custom properties (var(--pos), etc) resolve fine in the live page, but an exported PNG is
// rasterized from the SVG in isolation (no access to this page's :root styles) -- so before
// export, every var(...) reference gets swapped for its actual current resolved color first.
const THEME_VARS = ["--pos", "--neg", "--muted", "--accent", "--text", "--border", "--surface"];

const LOGO_SIZE = 40;

export default function WeeklyScoresBarChart({ afcManagers, nfcManagers, afcSeason, nfcSeason, schedule, week, focusManager, focusOpponents, logoMap, hexColorMap }) {
  const [hovered, setHovered] = useState(null);
  // Ctrl/Cmd/Shift-click toggles a team into this multi-select set instead of opening its matchup
  // preview (a plain click still does that, unchanged). "Filter to Selection" then narrows the
  // whole chart down to just these bars; "Clear Selection" resets both.
  const [selected, setSelected] = useState(() => new Set());
  const [filterActive, setFilterActive] = useState(false);
  const toggleSelected = (manager) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(manager)) next.delete(manager); else next.add(manager);
    return next;
  });
  const clearSelection = () => { setSelected(new Set()); setFilterActive(false); };
  // A week/mode change invalidates whatever was selected before (different real bars entirely).
  React.useEffect(() => { clearSelection(); }, [week, focusManager]);
  const svgRef = useRef(null);
  const { openPreview } = useMatchupPreview();

  const exportPng = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rootStyle = getComputedStyle(document.documentElement);
    let svgText = new XMLSerializer().serializeToString(svgEl);
    THEME_VARS.forEach(name => {
      const resolved = rootStyle.getPropertyValue(name).trim();
      if (resolved) svgText = svgText.split(`var(${name})`).join(resolved);
    });
    const svgW = svgEl.viewBox.baseVal.width || svgEl.width.baseVal.value;
    const svgH = svgEl.viewBox.baseVal.height || svgEl.height.baseVal.value;
    const scale = 2;
    const img = new Image();
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgW * scale;
      canvas.height = svgH * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = rootStyle.getPropertyValue('--surface').trim() || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = `week-${week}-scores${focusManager ? `-${focusManager}` : ''}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  };

  // Cross-conference opponent/result for one manager this week -- `schedule` is the same
  // {week, afcTeam, nfcTeam} pairing list used throughout the app (App.jsx's cross-conference
  // schedule, see computeCrossRecords in statsMath.js for the identical lookup pattern).
  const crossResultFor = (m, isAfc, ownScore) => {
    const entry = (schedule || []).find(s => s.week === week && (isAfc ? s.afcTeam === m : s.nfcTeam === m));
    if (!entry) return { opponent: null, result: null };
    const opponent = isAfc ? entry.nfcTeam : entry.afcTeam;
    const oppScore = isAfc ? nfcSeason.scoreByWeek?.[week]?.[opponent] : afcSeason.scoreByWeek?.[week]?.[opponent];
    const result = oppScore > 0 && ownScore > 0 ? (ownScore > oppScore ? "W" : ownScore < oppScore ? "L" : "T") : null;
    return { opponent, result };
  };

  const buildGroup = (managers, season, conf) => {
    const pairs = season.scheduleByWeek?.[week] || [];
    const opponentOf = (m) => pairs.find(([a, b]) => a === m || b === m)?.find(x => x !== m) || null;
    return managers
      .map(m => {
        const score = season.scoreByWeek?.[week]?.[m];
        if (!(score > 0)) return null;
        const opp = opponentOf(m);
        const oppScore = opp ? season.scoreByWeek?.[week]?.[opp] : null;
        const result = oppScore > 0 ? (score > oppScore ? "W" : score < oppScore ? "L" : "T") : null;
        const cross = crossResultFor(m, conf === "AFC", score);
        return { manager: m, conf, score, opponent: opp, result, crossResult: cross.result };
      })
      .filter(Boolean);
  };

  const afcBars = buildGroup(afcManagers, afcSeason, "AFC");
  const nfcBars = buildGroup(nfcManagers, nfcSeason, "NFC");
  const afcMedian = median(afcBars.map(b => b.score));
  const nfcMedian = median(nfcBars.map(b => b.score));

  const allBars = [...afcBars, ...nfcBars];
  if (allBars.length === 0) {
    return (
      <div className="material-surface bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-4 text-sm text-[var(--muted)] italic">
        No real scores logged yet for Week {week} -- check back once games kick off.
      </div>
    );
  }

  const focusScore = focusManager ? allBars.find(b => b.manager === focusManager)?.score : null;
  let bars;
  if (focusManager) {
    const focusSet = new Set([focusManager, ...(focusOpponents || [])]);
    const focusList = [focusManager, ...(focusOpponents || [])]
      .map(m => allBars.find(b => b.manager === m))
      .filter(Boolean)
      .map(b => ({ ...b, group: "focus" }));
    const restList = allBars
      .filter(b => !focusSet.has(b.manager))
      .sort((a, b) => b.score - a.score)
      .map(b => ({ ...b, group: "rest" }));
    bars = [...focusList, ...restList];
  } else {
    // Plain left-to-right, highest to lowest, AFC and NFC mixed together -- one flat ranking of
    // every real score this week, not grouped/gapped by conference.
    bars = [...allBars].sort((a, b) => b.score - a.score).map(b => ({ ...b, group: "all" }));
  }
  // "Filter to Selection" narrows the bars actually drawn down to just the ctrl/shift-clicked
  // teams -- medians/high-score flourish below are still computed from the FULL real dataset
  // (allBars), not this filtered view, so they stay a meaningful reference point either way.
  if (filterActive && selected.size > 0) {
    bars = bars.filter(b => selected.has(b.manager));
  }

  // The single highest real score across everyone this week (not per-category -- just the actual
  // league-wide high score) gets a little "cha-ching" flourish above its bar.
  const highScoreManager = allBars.reduce((best, b) => (!best || b.score > best.score ? b : best), null)?.manager;

  const rawMaxScore = Math.max(1, ...allBars.map(b => b.score), afcMedian || 0, nfcMedian || 0);
  const numGroupGaps = bars.filter((b, i) => i > 0 && b.group !== bars[i - 1].group).length;
  const plotW = bars.length * MIN_BAR_W + (bars.length - 1) * BAR_GAP + numGroupGaps * GROUP_GAP;
  const width = MARGIN.left + MARGIN.right + plotW;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const { ticks, domainMax: maxScore } = niceTicks(rawMaxScore);
  const yFor = (v) => MARGIN.top + plotH - (v / maxScore) * plotH;

  // categoryFor returns a stable key (not a color) so the legend can both look up a color AND
  // tally how many real bars fall into each bucket right now.
  const categoryFor = (b) => {
    if (focusManager) {
      if (b.manager === focusManager) return "you";
      if (focusScore == null || b.score === focusScore) return "tie";
      const beatsYou = b.score > focusScore; // this team's real score is better than yours right now
      if (focusOpponents?.includes(b.manager)) return beatsYou ? "actual-ahead" : "actual-behind";
      return beatsYou ? "theo-neg" : "theo-pos";
    }
    // Priority order: winning both matchups beats either single-matchup win, which beats winning
    // neither (a loss, a tie, or a mix of the two -- "lost both" and "no wins" are one category).
    const wins = (b.result === "W" ? 1 : 0) + (b.crossResult === "W" ? 1 : 0);
    if (wins === 2) return "both";
    if (b.result === "W") return "inconf";
    if (b.crossResult === "W") return "cross";
    return "none";
  };
  // Your own bar uses your real Standings-page team color (same hexColorMap the Standings trend
  // chart uses) instead of the generic accent color, so it's recognizably "you" the same way it is
  // everywhere else in the app.
  const CATEGORY_COLOR = {
    you: (focusManager && hexColorMap?.[focusManager]) || "var(--accent)", tie: "var(--muted)",
    "actual-ahead": "var(--neg)", "actual-behind": "var(--pos)",
    "theo-neg": THEO_NEG, "theo-pos": THEO_POS,
    both: BOTH_WIN_COLOR, inconf: INCONF_WIN_COLOR, cross: CROSS_WIN_COLOR, none: NO_WIN_COLOR
  };
  const colorFor = (b) => CATEGORY_COLOR[categoryFor(b)];
  const categoryCounts = allBars.reduce((counts, b) => {
    const cat = categoryFor(b);
    counts[cat] = (counts[cat] || 0) + 1;
    return counts;
  }, {});

  let x = MARGIN.left;
  const positioned = bars.map((b, i) => {
    if (i > 0 && b.group !== bars[i - 1].group) x += GROUP_GAP;
    const cx = x;
    x += MIN_BAR_W + BAR_GAP;
    return { ...b, x: cx };
  });
  // `hovered` also doubles as the key for the AFC/NFC median-line hover dimming ("AFC-median" /
  // "NFC-median"), which aren't real bars -- only look up an actual bar for the hover-reference line.
  const hoveredBarForLine = hovered ? bars.find(b => b.manager === hovered) : null;

  return (
    <div className="material-surface bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p
          className="tracking-wide text-base text-[var(--text)]"
          style={{ fontFamily: SERIF_FONT, fontWeight: 700 }}
        >
          Week {week} Scores {focusManager ? "-- You & Your Opponents" : "-- All Teams"}
        </p>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <button
                type="button" onClick={() => setFilterActive(v => !v)}
                title="Ctrl/Cmd/Shift-click bars to build a selection, then narrow the chart to just those teams"
                className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-colors duration-150 ${
                  filterActive ? "bg-[var(--accent)] text-[var(--accent-text)]" : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)]"
                }`}
              >
                {filterActive ? "Showing Selection" : `Filter to Selection (${selected.size})`}
              </button>
              <button
                type="button" onClick={clearSelection}
                className="text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--text)] px-2 py-1 rounded-md hover:bg-[var(--surface2)] transition-colors duration-150"
              >
                Clear Selection
              </button>
            </>
          )}
          <button
            type="button" onClick={exportPng} title="Export chart as PNG" aria-label="Export chart as PNG"
            className="flex items-center gap-1 text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--text)] px-2 py-1 rounded-md hover:bg-[var(--surface2)] transition-colors duration-150"
          >
            <Download className="w-3.5 h-3.5" /> PNG
          </button>
        </div>
      </div>
      {selected.size > 0 && !filterActive && (
        <p className="text-[10px] text-[var(--muted)] -mt-2 mb-2">
          {selected.size} team{selected.size > 1 ? 's' : ''} selected -- Ctrl/Cmd/Shift-click more, or hit "Filter to Selection" above.
        </p>
      )}
      <div className="overflow-x-auto scroll-thin">
        <svg ref={svgRef} width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} className="h-auto" style={{ minWidth: '100%', fontFamily: DATA_FONT }} role="img" aria-label={`Week ${week} scores by team`}>
          <text
            x={52} y={MARGIN.top + plotH / 2} textAnchor="middle" fontSize={12} fontWeight={700}
            fill="var(--muted)" transform={`rotate(-90 52 ${MARGIN.top + plotH / 2})`}
          >
            Fantasy Points
          </text>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yFor(t)} y2={yFor(t)} stroke="var(--border)" strokeOpacity={0.35} strokeWidth={1} />
              <text x={MARGIN.left - 10} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize={13} fill="var(--muted)">
                {Math.round(t)}
              </text>
            </g>
          ))}

          {/* AFC/NFC median reference lines for this specific week -- in focus mode these are just
              backdrop context (faded/thin), since the chosen team's OWN score below is the actual
              reference point everything else on this chart is being read against. Always stay at
              full opacity regardless of which bar is hovered (never fade with the rest of the
              bars) -- they're a fixed reference point, not something being compared. */}
          {afcMedian != null && (
            <g opacity={focusManager ? 0.4 : 1}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yFor(afcMedian)} y2={yFor(afcMedian)} stroke={AFC_COLOR} strokeWidth={focusManager ? 1.5 : 2.5} strokeDasharray="7 5" />
              <text x={width - MARGIN.right + 8} y={yFor(afcMedian)} dominantBaseline="middle" fontSize={focusManager ? 11 : 13} fontWeight={700} fill={AFC_COLOR}>
                AFC {afcMedian.toFixed(1)}
              </text>
            </g>
          )}
          {nfcMedian != null && (
            <g opacity={focusManager ? 0.4 : 1}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yFor(nfcMedian)} y2={yFor(nfcMedian)} stroke={NFC_COLOR} strokeWidth={focusManager ? 1.5 : 2.5} strokeDasharray="7 5" />
              <text x={width - MARGIN.right + 8} y={yFor(nfcMedian)} dominantBaseline="middle" fontSize={focusManager ? 11 : 13} fontWeight={700} fill={NFC_COLOR}>
                NFC {nfcMedian.toFixed(1)}
              </text>
            </g>
          )}
          {/* Your own score, drawn as the primary reference line in focus mode -- every other bar
              on this chart is being read against this one line, real opponents and hypothetical
              "rest of the league" alike. */}
          {focusManager && focusScore != null && (
            <g>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yFor(focusScore)} y2={yFor(focusScore)} stroke="var(--accent)" strokeWidth={3} strokeDasharray="9 5" />
              <text x={width - MARGIN.right + 8} y={yFor(focusScore)} dominantBaseline="middle" fontSize={13} fontWeight={800} fill="var(--accent)">
                You: {focusScore.toFixed(1)}
              </text>
            </g>
          )}
          {/* Hovering ANY bar drops a temporary reference line at THAT team's score -- lets you
              "what if" compare every other bar against whoever you're currently pointing at, not
              just the one fixed reference line above. Skipped for your own bar in focus mode (the
              accent line above already covers it) and for the median-line hover keys. */}
          {hoveredBarForLine && hoveredBarForLine.manager !== focusManager && (
            <g>
              <line
                x1={MARGIN.left} x2={width - MARGIN.right} y1={yFor(hoveredBarForLine.score)} y2={yFor(hoveredBarForLine.score)}
                stroke={colorFor(hoveredBarForLine)} strokeWidth={2} strokeDasharray="4 4" opacity={0.85}
              />
              <text x={width - MARGIN.right + 8} y={yFor(hoveredBarForLine.score)} dominantBaseline="middle" fontSize={11} fontWeight={700} fill={colorFor(hoveredBarForLine)}>
                {hoveredBarForLine.manager}: {hoveredBarForLine.score.toFixed(1)}
              </text>
            </g>
          )}

          {/* Shared glass-sheen overlay for every bar -- one gradient def reused everywhere instead
              of a flat fill, so bars have some depth/pop instead of reading as flat color blocks. */}
          <defs>
            <linearGradient id="wsbc-bar-sheen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.4} />
              <stop offset="55%" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>
          {positioned.map(b => {
            const isHovered = hovered === b.manager;
            // Your own bar (focus mode) stays highlighted even while hovering someone else -- it's
            // the reference point everything else is being read against, so it shouldn't fade out
            // right when it's most useful to keep an eye on.
            const isDimmed = hovered && !isHovered && b.manager !== focusManager;
            const barY = yFor(b.score);
            const color = colorFor(b);
            const barHeight = MARGIN.top + plotH - barY;
            const logoUrl = logoMap?.[b.manager];
            const clipId = `wsbc-logo-${week}-${(focusManager || 'all').replace(/[^a-zA-Z0-9]/g, '')}-${b.manager.replace(/[^a-zA-Z0-9]/g, '')}`;
            const logoCy = barY + LOGO_SIZE / 2 + 8;
            const showLogo = logoUrl && barHeight >= LOGO_SIZE + 14;
            const isSelected = selected.has(b.manager);
            return (
              <g
                key={b.manager}
                opacity={isDimmed ? 0.35 : 1}
                onMouseEnter={() => setHovered(b.manager)}
                onMouseLeave={() => setHovered(null)}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey) toggleSelected(b.manager);
                  else openPreview(b.manager, b.conf, week);
                }}
                style={{
                  cursor: 'pointer',
                  filter: isHovered ? `drop-shadow(0 0 10px ${color})` : `drop-shadow(0 2px 3px rgba(0,0,0,0.25))`,
                  transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                  transformBox: 'fill-box', transformOrigin: 'bottom center',
                  transition: 'filter 0.2s ease, transform 0.25s cubic-bezier(.34,1.56,.64,1)'
                }}
              >
                <rect
                  x={b.x} y={barY} width={MIN_BAR_W} height={barHeight} rx={5} fill={color}
                  fillOpacity={isHovered ? 0.92 : 0.7} stroke={color} strokeWidth={2}
                  style={{ transition: 'height 0.6s cubic-bezier(.22,1,.36,1), y 0.6s cubic-bezier(.22,1,.36,1), fill-opacity 0.2s ease' }}
                />
                <rect
                  x={b.x} y={barY} width={MIN_BAR_W} height={barHeight} rx={5} fill="url(#wsbc-bar-sheen)" pointerEvents="none"
                  style={{ transition: 'height 0.6s cubic-bezier(.22,1,.36,1), y 0.6s cubic-bezier(.22,1,.36,1)' }}
                />
                {/* Ctrl/Cmd/Shift-click selection ring -- a persistent outline (not just on hover)
                    so it's obvious which bars are picked for "Filter to Selection" below. */}
                {isSelected && (
                  <rect
                    x={b.x - 3} y={barY - 3} width={MIN_BAR_W + 6} height={barHeight + 3} rx={7}
                    fill="none" stroke="var(--text)" strokeWidth={2} strokeDasharray="5 3" pointerEvents="none"
                  />
                )}
                {showLogo && (
                  <>
                    <defs>
                      <clipPath id={clipId}>
                        <circle cx={b.x + MIN_BAR_W / 2} cy={logoCy} r={LOGO_SIZE / 2} />
                      </clipPath>
                    </defs>
                    <image
                      href={logoUrl} x={b.x + MIN_BAR_W / 2 - LOGO_SIZE / 2} y={logoCy - LOGO_SIZE / 2}
                      width={LOGO_SIZE} height={LOGO_SIZE} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice"
                    />
                    <circle cx={b.x + MIN_BAR_W / 2} cy={logoCy} r={LOGO_SIZE / 2} fill="none" stroke="var(--surface)" strokeWidth={2} />
                  </>
                )}
                {b.manager === highScoreManager && (
                  <text x={b.x + MIN_BAR_W / 2} y={barY - 24} textAnchor="middle" fontSize={17}>
                    {HIGH_SCORE_PRIZES[week]?.choice === "wine" ? "\u{1F377}" : HIGH_SCORE_PRIZES[week]?.choice === "cash" ? "\u{1F4B0}" : "\u{1F4B0}\u{1F377}"}
                  </text>
                )}
                <text x={b.x + MIN_BAR_W / 2} y={barY - 6} textAnchor="middle" fontSize={14} fontWeight={800} fill="var(--text)">
                  {b.score.toFixed(1)}
                </text>
                {/* Rotated team label below the bar -- long manager names need the angle to fit.
                    Serif (matching the title), deliberately different from the sans-serif numbers
                    everywhere else on this chart -- a name is a label, not a number. */}
                <text
                  x={b.x + MIN_BAR_W / 2} y={MARGIN.top + plotH + 12} fontSize={13} fontWeight={700}
                  fill={b.conf === "AFC" ? AFC_COLOR : NFC_COLOR}
                  fontFamily={SERIF_FONT}
                  textAnchor="end" transform={`rotate(-40 ${b.x + MIN_BAR_W / 2} ${MARGIN.top + plotH + 12})`}
                >
                  {b.manager}
                </text>
                <title>
                  {b.manager} ({b.conf}): {b.score.toFixed(2)}
                  {b.opponent ? ` vs ${b.opponent}${b.result ? ` (${b.result})` : ''}` : ''}
                </title>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs font-semibold">
        {focusManager ? (
          <>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLOR.you }} /> Your Team</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLOR["actual-behind"] }} /> Actual -- Loses to You ({categoryCounts["actual-behind"] || 0})</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLOR["actual-ahead"] }} /> Actual -- Beats You ({categoryCounts["actual-ahead"] || 0})</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLOR["theo-pos"] }} /> Theoretical -- Would Lose to You ({categoryCounts["theo-pos"] || 0})</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLOR["theo-neg"] }} /> Theoretical -- Would Beat You ({categoryCounts["theo-neg"] || 0})</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: BOTH_WIN_COLOR }} /> Won Both ({categoryCounts.both || 0})</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: INCONF_WIN_COLOR }} /> Won In-Conference Only ({categoryCounts.inconf || 0})</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: CROSS_WIN_COLOR }} /> Won Cross-Conference Only ({categoryCounts.cross || 0})</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: NO_WIN_COLOR }} /> No Wins ({categoryCounts.none || 0})</span>
          </>
        )}
        <span className="flex items-center gap-1.5" style={{ color: AFC_COLOR }}><span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: AFC_COLOR }} /> AFC Median</span>
        <span className="flex items-center gap-1.5" style={{ color: NFC_COLOR }}><span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: NFC_COLOR }} /> NFC Median</span>
      </div>
    </div>
  );
}
