import React, { useRef, useState } from 'react';
import { Check, X as XIcon, Link as LinkIcon, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useMatchupPreview } from '../context/MatchupPreviewContext';
import { HIGH_SCORE_PRIZES } from '../lib/highScorePrizes';
import { useNameDisplay } from '../context/NameDisplayContext';
import lenzoneLogoRing from '../assets/lenzone-logo-ring.png';
import lenzoneLogoBall from '../assets/lenzone-logo-ball.png';
import ExportControls from './ExportControls';

const HEIGHT = 440;
// bottom has to fit a -40deg-rotated team name below every bar -- long manager names need real
// room here or they get clipped by the chart's own edge. `left` looks oversized for just the
// y-axis tick labels, but the FIRST bar's rotated name swings up and to the LEFT of its own bar
// (textAnchor="end" + a negative rotation), so it needs just as much clearance on that side as the
// longest name needs vertically, not just enough room for a couple of digits.
// top needs room above the tallest bar for its score number AND (for whoever has the week's
// single highest score) the little cash/wine-glass flourish stacked above that.
const MARGIN = { top: 46, right: 110, bottom: 170, left: 160 };
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
const LOGO_SIZE = 40;

export default function WeeklyScoresBarChart({ afcManagers, nfcManagers, afcSeason, nfcSeason, schedule, week, focusManager, focusOpponents, logoMap, hexColorMap, projectedScores = {}, isWeekFinal = false }) {
  const [hovered, setHovered] = useState(null);
  const { mode: nameMode, displayName, managerName } = useNameDisplay();
  const graphName = (manager, conf) => {
    const primary = displayName(manager, conf);
    const secondary = nameMode === 'teams' ? managerName(manager, conf) : null;
    return secondary ? `${primary} (${secondary})` : primary;
  };
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
  // Click (not hover) pulls a team's two real opponents into the slots next to it -- click the
  // same bar again, or a different one, to release/switch. Hover alone used to drive this, but a
  // bar sliding out from under (or into) a stationary cursor mid-transition fired spurious
  // enter/leave events against a pointer that never actually moved, which read as the hover state
  // randomly flickering. A click is a discrete, deliberate action with none of that ambiguity.
  const [pinned, setPinned] = useState(null);
  // A week/mode change invalidates whatever was selected/pinned before (different real bars
  // entirely).
  React.useEffect(() => { clearSelection(); setPinned(null); }, [week, focusManager]);
  const svgRef = useRef(null);
  const { openPreview } = useMatchupPreview();
  const [exporting, setExporting] = useState(false);
  // Keep every hook above the no-scores early return below. Weeks without posted scores and weeks
  // with scores must execute the same hooks in the same order when the selector changes.
  const [copyState, setCopyState] = useState("idle"); // idle | copying | copied | error
  const [downloadState, setDownloadState] = useState("idle"); // idle | error
  const [exportTheme, setExportTheme] = useState('dark');
  const [linkCopyState, setLinkCopyState] = useState("idle");
  // Zoom scales the SVG's rendered CSS size while its viewBox stays fixed -- the browser scales
  // every coordinate, line and font in the drawing proportionally (real vector zoom, not a blurry
  // raster stretch), and the existing horizontal-scroll wrapper below already handles whatever
  // doesn't fit at zoom > 100%.
  const [zoom, setZoom] = useState(1);
  const ZOOM_MIN = 0.5, ZOOM_MAX = 2, ZOOM_STEP = 0.25;

  // Cross-conference opponent/result for one manager this week -- `schedule` is the same
  // {week, afcTeam, nfcTeam} pairing list used throughout the app (App.jsx's cross-conference
  // schedule, see computeCrossRecords in statsMath.js for the identical lookup pattern).
  const displayedScoreFor = (manager, season) => {
    const actualScore = season.scoreByWeek?.[week]?.[manager];
    const projectedScore = projectedScores?.[manager];
    const useProjection = !isWeekFinal && Number.isFinite(projectedScore);
    return {
      score: useProjection ? projectedScore : (actualScore > 0 ? actualScore : null),
      actualScore: actualScore > 0 ? actualScore : null,
      scoreType: useProjection ? "Proj" : "Actual"
    };
  };

  const crossResultFor = (m, isAfc, ownScore) => {
    const entry = (schedule || []).find(s => s.week === week && (isAfc ? s.afcTeam === m : s.nfcTeam === m));
    if (!entry) return { opponent: null, result: null };
    const opponent = isAfc ? entry.nfcTeam : entry.afcTeam;
    const oppScore = displayedScoreFor(opponent, isAfc ? nfcSeason : afcSeason).score;
    const result = oppScore != null && ownScore != null ? (ownScore > oppScore ? "W" : ownScore < oppScore ? "L" : "T") : null;
    return { opponent, result };
  };

  const buildGroup = (managers, season, conf) => {
    const pairs = season.scheduleByWeek?.[week] || [];
    const opponentOf = (m) => pairs.find(([a, b]) => a === m || b === m)?.find(x => x !== m) || null;
    return managers
      .map(m => {
        const scoreInfo = displayedScoreFor(m, season);
        if (scoreInfo.score == null) return null;
        const { score, actualScore, scoreType } = scoreInfo;
        const opp = opponentOf(m);
        const oppScore = opp ? displayedScoreFor(opp, season).score : null;
        const result = oppScore != null ? (score > oppScore ? "W" : score < oppScore ? "L" : "T") : null;
        const cross = crossResultFor(m, conf === "AFC", score);
        return { manager: m, conf, score, actualScore, scoreType, opponent: opp, result, crossResult: cross.result, crossOpponent: cross.opponent };
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
        No actual or projected scores are available for Week {week} yet.
      </div>
    );
  }

  const focusScore = focusManager ? allBars.find(b => b.manager === focusManager)?.score : null;
  const hasProjectedBars = allBars.some(b => b.scoreType === "Proj");
  const hasActualBars = allBars.some(b => b.scoreType === "Actual");
  const scoreTypeLabel = hasProjectedBars && hasActualBars ? "Actual / Proj" : hasProjectedBars ? "Proj" : "Actual";
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
  const highScoreManager = hasProjectedBars ? null : allBars.reduce((best, b) => (!best || b.score > best.score ? b : best), null)?.manager;

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
    // A fixed, distinctive silver rather than your own Standings-page team color -- that color
    // can coincidentally match (or nearly match) another bar's category color, or just blend in;
    // silver never occurs anywhere else on this chart, so "which bar is me" never needs a second
    // look regardless of which team colors happen to be in play this week. A mid-tone slate
    // (not a pale near-white silver) so it reads with real contrast against both a light and a
    // dark chart background, not just one of them.
    you: "#94a3b8", tie: "var(--muted)",
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

  // Clicking a bar pulls that team's two real opponents into the slots right after it, sliding
  // every other bar out of the way -- a new group, the same way the focus-mode "you" group already
  // sits first. In focus mode your own group stays anchored first no matter who else gets clicked
  // (it's the chart's fixed reference point); the clicked team's own cluster becomes a second group
  // right after it. Clicking yourself is a no-op for layout -- your own two opponents are already
  // grouped next to you by the default focus-mode sort. Only reorders LAYOUT (x position via a
  // transform below); the actual `bars` array/DOM order never changes, so sorting, grouping and
  // selection are untouched.
  const pinnedBar = pinned ? bars.find(b => b.manager === pinned) : null;
  // Clicking yourself, or a team that's already one of your own two real opponents, is a no-op
  // for layout -- they're already grouped right next to you, so there's nothing left to pull
  // together. Without this check, that team would try to form a SECOND group whose own "real
  // opponents" list includes you, fighting the "you" segment over where you actually belong.
  const alreadyInFocusGroup = !!focusManager && pinnedBar &&
    (pinnedBar.manager === focusManager || (focusOpponents || []).includes(pinnedBar.manager));
  let pinXByManager = null;
  if (pinnedBar && !alreadyInFocusGroup) {
    const placedNames = new Set();
    // Three distinct, clearly separated clusters -- "you and your matchups" (focus mode only),
    // "your selection and their matchups" (whoever got clicked, plus their real opponents), then
    // everyone else -- with a full GROUP_GAP between each, same visual language the base layout
    // already uses to separate the focus group from the rest.
    const focusSegment = [];
    if (focusManager) {
      const focusBar = bars.find(b => b.manager === focusManager);
      if (focusBar) {
        focusSegment.push(focusBar);
        placedNames.add(focusManager);
        // Your own two real opponents stay grouped with you -- they're the default focus-mode
        // grouping already, and clicking a different team shouldn't break that up.
        (focusOpponents || []).forEach(name => {
          if (name && !placedNames.has(name) && bars.some(b => b.manager === name)) {
            focusSegment.push(positioned.find(b => b.manager === name));
            placedNames.add(name);
          }
        });
      }
    }
    const pinnedSegment = [pinnedBar];
    placedNames.add(pinnedBar.manager);
    [pinnedBar.opponent, pinnedBar.crossOpponent].forEach(name => {
      if (name && !placedNames.has(name) && bars.some(b => b.manager === name)) {
        pinnedSegment.push(positioned.find(b => b.manager === name));
        placedNames.add(name);
      }
    });
    const restSegment = positioned.filter(b => !placedNames.has(b.manager));
    pinXByManager = {};
    let px = MARGIN.left;
    [focusSegment, pinnedSegment, restSegment].filter(seg => seg.length > 0).forEach((segment, si) => {
      if (si > 0) px += GROUP_GAP;
      segment.forEach(b => {
        pinXByManager[b.manager] = px;
        px += MIN_BAR_W + BAR_GAP;
      });
    });
  }

  // Shared between the live HTML legend below and the export image, so the two never drift apart.
  const legendItems = focusManager
    ? [
        { color: CATEGORY_COLOR.you, label: "Your Team" },
        { color: CATEGORY_COLOR["actual-behind"], label: `${hasProjectedBars ? "Proj" : "Actual"} -- Trails You (${categoryCounts["actual-behind"] || 0})` },
        { color: CATEGORY_COLOR["actual-ahead"], label: `${hasProjectedBars ? "Proj" : "Actual"} -- Leads You (${categoryCounts["actual-ahead"] || 0})` },
        { color: CATEGORY_COLOR["theo-pos"], label: `Theoretical -- Would Lose to You (${categoryCounts["theo-pos"] || 0})` },
        { color: CATEGORY_COLOR["theo-neg"], label: `Theoretical -- Would Beat You (${categoryCounts["theo-neg"] || 0})` }
      ]
    : hasProjectedBars
      ? [
          { color: BOTH_WIN_COLOR, label: `Projected to Win Both (${categoryCounts.both || 0})` },
          { color: INCONF_WIN_COLOR, label: `Projected In-Conference Win Only (${categoryCounts.inconf || 0})` },
          { color: CROSS_WIN_COLOR, label: `Projected Cross-Conference Win Only (${categoryCounts.cross || 0})` },
          { color: NO_WIN_COLOR, label: `Projected to Win Neither (${categoryCounts.none || 0})` }
        ]
      : [
          { color: BOTH_WIN_COLOR, label: `Won Both (${categoryCounts.both || 0})` },
          { color: INCONF_WIN_COLOR, label: `Won In-Conference Only (${categoryCounts.inconf || 0})` },
          { color: CROSS_WIN_COLOR, label: `Won Cross-Conference Only (${categoryCounts.cross || 0})` },
          { color: NO_WIN_COLOR, label: `No Wins (${categoryCounts.none || 0})` }
        ];
  const medianLegendItems = [
    { color: AFC_COLOR, label: "AFC Median", dashed: true },
    { color: NFC_COLOR, label: "NFC Median", dashed: true }
  ];

  // ---- Export (PNG download / copy-to-clipboard) ----
  // A deliberately separate, self-built SVG -- not a clone of the live interactive one -- so the
  // export never depends on: the viewer's own color scheme (a fixed, neutral palette is used
  // instead, just for background/text/border/muted -- the meaningful bar colors are untouched),
  // custom webfonts (isolated SVG rasterization can't load Google Fonts OR external images at all,
  // a real browser security restriction -- so this uses safe system fonts and pre-fetches each
  // team logo as a base64 data URI first), or any hover/CSS-transform state (none of that is
  // meaningful in a static export anyway). It also includes the legend and title, which the old
  // "just serialize the live <svg>" approach silently left out.
  const EXPORT = exportTheme === 'dark'
    ? { bg: "#0f172a", bgFrom: "#1b2338", bgTo: "#080a12", text: "#f8fafc", muted: "#aeb9c8", border: "#526178" }
    : { bg: "#f5f1e8", bgFrom: "#fffaf1", bgTo: "#e8edf0", text: "#172033", muted: "#526073", border: "#9ba8b8" };
  const EXPORT_SANS = "Arial, Helvetica, sans-serif";
  const EXPORT_SERIF = "Georgia, 'Times New Roman', serif";
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Real bar-meaning colors (var(--pos)/var(--neg)/etc) get resolved to fixed hex equivalents --
  // NOT collapsed to the neutral text/muted export colors, which would silently erase the
  // win/loss meaning the user specifically asked to keep intact. Pinned to this app's own actual
  // dark-mode values (index.css), so the export doesn't depend on the exporting viewer's own
  // light/dark mode or color scheme either.
  const EXPORT_VAR_RESOLVE = exportTheme === 'dark'
    ? { "var(--pos)": "#34d399", "var(--neg)": "#fb7185", "var(--muted)": EXPORT.muted, "var(--accent)": "#f08a6d" }
    : { "var(--pos)": "#047857", "var(--neg)": "#be123c", "var(--muted)": EXPORT.muted, "var(--accent)": "#c45138" };
  const resolveExportColor = (c) => EXPORT_VAR_RESOLVE[c] || c;

  // Best-effort: fetch a logo and convert it to a base64 data URI so it can be embedded directly
  // in the export SVG (a plain external <image href> pointing at Sleeper's CDN won't render at all
  // -- browsers refuse to load external resources when rasterizing an SVG through an <img>/canvas,
  // a real security restriction). Validated before use -- a malformed/truncated result gets
  // dropped instead of embedded, since a broken data URI in the middle of the SVG text can corrupt
  // the whole document, not just that one logo.
  // Two different techniques, tried in order -- some CDNs answer a raw fetch() without CORS
  // headers but still allow an <img crossOrigin> read (or vice versa), so trying only one is
  // giving up early. Either way, a genuinely CORS-blocked resource still fails both, silently
  // (never breaks the export -- see renderExportCanvas's own fallback).
  const fetchViaFetchApi = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('not an image');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
  const fetchViaCanvasImg = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || 64;
        c.height = img.naturalHeight || 64;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch (err) {
        reject(err); // canvas came back tainted -- this resource genuinely isn't CORS-readable
      }
    };
    img.onerror = () => reject(new Error('image failed to load'));
    // A cache-buster so this doesn't silently reuse an already-cached, non-CORS copy of the same
    // URL from elsewhere on the page (a plain <img> without crossOrigin, e.g. the live chart's own
    // logos) -- a stale opaque cache hit would taint the canvas the same way a real block does.
    img.src = url + (url.includes('?') ? '&' : '?') + '_cors=1';
  });
  const fetchLogoDataUrl = async (url) => {
    for (const attempt of [fetchViaFetchApi, fetchViaCanvasImg]) {
      try {
        const dataUrl = await attempt(url);
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) return dataUrl;
      } catch {
        // try the next technique
      }
    }
    return null;
  };

  const buildExportSvg = async (includeLogos) => {
    let logoData = {};
    if (includeLogos) {
      const uniqueLogoManagers = [...new Set(positioned.filter(b => logoMap?.[b.manager]).map(b => b.manager))];
      const entries = await Promise.all(uniqueLogoManagers.map(async m => [m, await fetchLogoDataUrl(logoMap[m])]));
      logoData = Object.fromEntries(entries.filter(([, data]) => data));
    }
    // The app's own brand mark (ring + football, bundled assets served from this same origin --
    // no CORS concerns at all, unlike team logos) as a small watermark in the corner.
    const [brandRing, brandBall] = await Promise.all([fetchLogoDataUrl(lenzoneLogoRing), fetchLogoDataUrl(lenzoneLogoBall)]);
    const titleH = 64;
    const exportW = width;

    // Real text measurement (not a guess) so the legend can wrap into centered rows instead of
    // one tall left-aligned column with a huge dead zone to its right -- a temporary canvas 2d
    // context gives accurate widths for the exact font/size/weight used below.
    const measureCtx = document.createElement('canvas').getContext('2d');
    const SWATCH = 16, SWATCH_GAP = 8, ITEM_GAP = 30;
    measureCtx.font = `600 15px ${EXPORT_SANS}`;
    const allLegend = [...legendItems, ...medianLegendItems];
    const measured = allLegend.map(item => ({
      ...item,
      w: SWATCH + SWATCH_GAP + measureCtx.measureText(item.label).width
    }));
    const maxRowW = exportW - 64;
    const legendRows = [];
    let row = [], rowW = 0;
    measured.forEach(item => {
      const addedW = item.w + (row.length ? ITEM_GAP : 0);
      if (row.length && rowW + addedW > maxRowW) { legendRows.push({ items: row, w: rowW }); row = []; rowW = 0; }
      row.push(item);
      rowW += item.w + (row.length > 1 ? ITEM_GAP : 0);
    });
    if (row.length) legendRows.push({ items: row, w: rowW });

    const legendRowH = 30;
    const legendTopPad = 24;
    const legendH = legendTopPad + legendRows.length * legendRowH + 20;
    const exportH = titleH + HEIGHT + legendH;

    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${exportW}" height="${exportH}" viewBox="0 0 ${exportW} ${exportH}">`);
    parts.push(`<defs><linearGradient id="export-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${EXPORT.bgFrom}"/><stop offset="55%" stop-color="${EXPORT.bg}"/><stop offset="100%" stop-color="${EXPORT.bgTo}"/></linearGradient><pattern id="export-texture" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M-4 14L14 -4M3 17L17 3" stroke="${EXPORT.text}" stroke-opacity="${exportTheme === 'dark' ? 0.03 : 0.02}" stroke-width="0.7"/></pattern></defs>`);
    parts.push(`<rect x="0" y="0" width="${exportW}" height="${exportH}" fill="url(#export-bg)"/>`);
    parts.push(`<rect x="0" y="0" width="${exportW}" height="${exportH}" fill="url(#export-texture)"/>`);
    parts.push(`<text x="${exportW / 2}" y="40" text-anchor="middle" font-family="${EXPORT_SERIF}" font-size="30" font-weight="700" fill="${EXPORT.text}">${esc(`Week ${week} Scores - ${scoreTypeLabel} ${focusManager ? '- You & Your Opponents' : '- All Teams'}`)}</text>`);
    // Brand watermark, top-left corner -- doesn't compete with the centered title for space and
    // stays in the same spot regardless of how long the title text is.
    if (brandRing && brandBall) {
      const logoSize = 36, logoX = 16, logoY = 14;
      parts.push(`<image href="${brandRing}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}"/>`);
      parts.push(`<image href="${brandBall}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}"/>`);
    }

    parts.push(`<g transform="translate(0 ${titleH})">`);
    ticks.forEach(t => {
      const ty = yFor(t);
      parts.push(`<line x1="${MARGIN.left}" x2="${width - MARGIN.right}" y1="${ty}" y2="${ty}" stroke="${EXPORT.border}" stroke-opacity="0.5" stroke-width="1"/>`);
      parts.push(`<text x="${MARGIN.left - 10}" y="${ty}" text-anchor="end" dominant-baseline="middle" font-family="${EXPORT_SANS}" font-size="15" fill="${EXPORT.muted}">${Math.round(t)}</text>`);
    });
    parts.push(`<text x="84" y="${MARGIN.top + plotH / 2}" text-anchor="middle" font-family="${EXPORT_SANS}" font-size="14" font-weight="700" fill="${EXPORT.muted}" transform="rotate(-90 84 ${MARGIN.top + plotH / 2})">Fantasy Points</text>`);

    if (afcMedian != null) {
      const my = yFor(afcMedian);
      parts.push(`<line x1="${MARGIN.left}" x2="${width - MARGIN.right}" y1="${my}" y2="${my}" stroke="${AFC_COLOR}" stroke-width="${focusManager ? 1.5 : 2.5}" stroke-dasharray="7 5" opacity="${focusManager ? 0.4 : 1}"/>`);
      parts.push(`<text x="${width - MARGIN.right + 8}" y="${my}" dominant-baseline="middle" font-family="${EXPORT_SANS}" font-size="15" font-weight="700" fill="${AFC_COLOR}">AFC ${afcMedian.toFixed(1)} ${scoreTypeLabel}</text>`);
    }
    if (nfcMedian != null) {
      const my = yFor(nfcMedian);
      parts.push(`<line x1="${MARGIN.left}" x2="${width - MARGIN.right}" y1="${my}" y2="${my}" stroke="${NFC_COLOR}" stroke-width="${focusManager ? 1.5 : 2.5}" stroke-dasharray="7 5" opacity="${focusManager ? 0.4 : 1}"/>`);
      parts.push(`<text x="${width - MARGIN.right + 8}" y="${my}" dominant-baseline="middle" font-family="${EXPORT_SANS}" font-size="15" font-weight="700" fill="${NFC_COLOR}">NFC ${nfcMedian.toFixed(1)} ${scoreTypeLabel}</text>`);
    }
    if (focusManager && focusScore != null) {
      const fy = yFor(focusScore);
      const accentColor = (hexColorMap?.[focusManager]) || "#e76f51";
      parts.push(`<line x1="${MARGIN.left}" x2="${width - MARGIN.right}" y1="${fy}" y2="${fy}" stroke="${accentColor}" stroke-width="3" stroke-dasharray="9 5"/>`);
      parts.push(`<text x="${width - MARGIN.right + 8}" y="${fy}" dominant-baseline="middle" font-family="${EXPORT_SANS}" font-size="15" font-weight="800" fill="${accentColor}">You: ${focusScore.toFixed(2)} ${scoreTypeLabel}</text>`);
    }

    positioned.forEach(b => {
      const barY = yFor(b.score);
      const barHeight = MARGIN.top + plotH - barY;
      const color = resolveExportColor(colorFor(b));
      const cx = b.x + MIN_BAR_W / 2;
      parts.push(`<rect x="${b.x}" y="${barY}" width="${MIN_BAR_W}" height="${barHeight}" rx="5" fill="${color}" fill-opacity="0.75" stroke="${color}" stroke-width="2"/>`);
      const logoUrl = logoData[b.manager];
      if (logoUrl && barHeight >= LOGO_SIZE + 14) {
        const logoCy = barY + LOGO_SIZE / 2 + 8;
        const clipId = `export-logo-${b.manager.replace(/[^a-zA-Z0-9]/g, '')}`;
        parts.push(`<defs><clipPath id="${clipId}"><circle cx="${cx}" cy="${logoCy}" r="${LOGO_SIZE / 2}"/></clipPath></defs>`);
        parts.push(`<image href="${logoUrl}" x="${cx - LOGO_SIZE / 2}" y="${logoCy - LOGO_SIZE / 2}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`);
        parts.push(`<circle cx="${cx}" cy="${logoCy}" r="${LOGO_SIZE / 2}" fill="none" stroke="${EXPORT.bg}" stroke-width="2"/>`);
      }
      if (b.manager === highScoreManager) {
        const emoji = HIGH_SCORE_PRIZES[week]?.choice === "wine" ? "\u{1F377}" : HIGH_SCORE_PRIZES[week]?.choice === "cash" ? "\u{1F4B0}" : "\u{1F4B0}\u{1F377}";
        parts.push(`<text x="${cx}" y="${barY - 24}" text-anchor="middle" font-size="17">${emoji}</text>`);
      }
      parts.push(`<text x="${cx}" y="${barY - 15}" text-anchor="middle" font-family="${EXPORT_SANS}" font-size="17" font-weight="800" fill="${EXPORT.text}">${b.score.toFixed(2)}</text>`);
      parts.push(`<text x="${cx}" y="${barY - 2}" text-anchor="middle" font-family="${EXPORT_SANS}" font-size="10" font-weight="800" fill="${EXPORT.muted}">${b.scoreType}</text>`);
      const labelY = MARGIN.top + plotH + 12;
      const visibleName = displayName(b.manager, b.conf);
      const secondaryName = nameMode === 'teams' ? managerName(b.manager, b.conf) : null;
      const labelColor = b.conf === 'AFC' ? AFC_COLOR : NFC_COLOR;
      parts.push(`<text font-family="${EXPORT_SERIF}" font-weight="700" fill="${labelColor}" text-anchor="end" transform="rotate(-40 ${cx} ${labelY})">` +
        `<tspan x="${cx}" y="${labelY}" font-size="16">${esc(visibleName)}</tspan>` +
        (secondaryName ? `<tspan x="${cx}" y="${labelY + 18}" font-size="13" font-weight="600" fill="${EXPORT.muted}">(${esc(secondaryName)})</tspan>` : '') +
        `</text>`);
    });
    parts.push(`</g>`);

    let ly = titleH + HEIGHT + legendTopPad;
    legendRows.forEach(({ items, w: rowW2 }) => {
      let ix = (exportW - rowW2) / 2;
      items.forEach((item, i) => {
        if (i > 0) ix += ITEM_GAP;
        if (item.dashed) {
          parts.push(`<line x1="${ix}" x2="${ix + SWATCH}" y1="${ly - 5}" y2="${ly - 5}" stroke="${item.color}" stroke-width="2.5" stroke-dasharray="4 3"/>`);
        } else {
          parts.push(`<rect x="${ix}" y="${ly - 11}" width="${SWATCH}" height="${SWATCH}" rx="3" fill="${resolveExportColor(item.color)}"/>`);
        }
        parts.push(`<text x="${ix + SWATCH + SWATCH_GAP}" y="${ly}" font-family="${EXPORT_SANS}" font-size="15" font-weight="600" fill="${EXPORT.text}">${esc(item.label)}</text>`);
        ix += item.w;
      });
      ly += legendRowH;
    });

    parts.push(`</svg>`);
    return { svgText: parts.join(''), exportW, exportH };
  };

  // Rasterizes one built SVG string into a canvas. Broken out from renderExportCanvas so that can
  // try WITH logos first and, only if that specific render fails to decode, automatically retry
  // WITHOUT them -- the export always succeeds either way, it just silently loses the logos if
  // something about them (a CORS-blocked fetch that still slipped through, a decode issue) breaks
  // the image, instead of failing outright with nothing to show for it.
  const rasterize = async (svgText, exportW, exportH) => {
    const scale = 2;
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = exportW * scale;
      canvas.height = exportH * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = EXPORT.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const renderExportCanvas = async () => {
    const withLogos = await buildExportSvg(true);
    try {
      return await rasterize(withLogos.svgText, withLogos.exportW, withLogos.exportH);
    } catch (err) {
      console.warn('Export with logos failed to render, retrying without logos:', err);
      const withoutLogos = await buildExportSvg(false);
      return await rasterize(withoutLogos.svgText, withoutLogos.exportW, withoutLogos.exportH);
    }
  };

  const downloadPng = async () => {
    setExporting(true);
    try {
      const canvas = await renderExportCanvas();
      const link = document.createElement('a');
      link.download = `week-${week}-scores${focusManager ? `-${focusManager}` : ''}-${exportTheme}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      // Never fail silently -- a broken export used to just do nothing with no visible sign why.
      console.error('PNG export failed:', err);
      setDownloadState("error");
      setTimeout(() => setDownloadState("idle"), 2500);
    } finally {
      setExporting(false);
    }
  };
  // Copies the image directly to the system clipboard -- lets you just Ctrl/Cmd+V it straight
  // into an MS Teams or Discord message instead of downloading a file and re-attaching it.
  const copyPng = async () => {
    setExporting(true);
    setCopyState("copying");
    try {
      const canvas = await renderExportCanvas();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2000);
    } finally {
      setExporting(false);
    }
  };
  // A real, deep-linked URL to this exact week/chart (see weekFromHash in App.jsx) -- the closest
  // thing to an "interactive embed" Teams/Discord actually support: not a live widget inside the
  // chat itself (neither platform allows that), but a link that opens the real, fully-interactive
  // chart the moment someone clicks it.
  const copyLink = async () => {
    const targetTab = focusManager ? "currentWeek" : "matchups";
    const url = `${window.location.origin}${window.location.pathname}#${targetTab}?week=${week}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopyState("copied");
    } catch {
      setLinkCopyState("error");
    }
    setTimeout(() => setLinkCopyState("idle"), 2000);
  };

  return (
    <div className="material-surface bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p
          className="tracking-wide text-base text-[var(--text)]"
          style={{ fontFamily: SERIF_FONT, fontWeight: 700 }}
        >
          Week {week} Scores {focusManager ? "-- You & Your Opponents" : "-- All Teams"}
          <span className="ml-2 text-xs font-bold uppercase tracking-wide text-[var(--proj)]">{scoreTypeLabel}</span>
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 mr-1 border-r border-[var(--border)]/60 pr-2">
            <button
              type="button" onClick={() => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
              disabled={zoom <= ZOOM_MIN} title="Zoom out" aria-label="Zoom out"
              className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors duration-150"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button" onClick={() => setZoom(1)} disabled={zoom === 1}
              title="Reset zoom" aria-label="Reset zoom"
              className="w-11 text-center text-[10px] font-semibold tabular-nums text-[var(--muted)] hover:text-[var(--text)] disabled:hover:text-[var(--muted)] transition-colors duration-150"
            >
              {zoom === 1 ? <RotateCcw className="w-3 h-3 mx-auto opacity-40" /> : `${Math.round(zoom * 100)}%`}
            </button>
            <button
              type="button" onClick={() => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
              disabled={zoom >= ZOOM_MAX} title="Zoom in" aria-label="Zoom in"
              className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors duration-150"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          {pinned && (
            <button
              type="button" onClick={() => setPinned(null)}
              title="Stop grouping this team's opponents next to it"
              className="text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--text)] px-2 py-1 rounded-md hover:bg-[var(--surface2)] transition-colors duration-150"
            >
              Clear Grouping
            </button>
          )}
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
          <ExportControls
            theme={exportTheme}
            onThemeChange={setExportTheme}
            onCopy={copyPng}
            onDownload={downloadPng}
            exporting={exporting}
            copyState={copyState}
            downloadState={downloadState}
          />
          <button
            type="button" onClick={copyLink} title="Copy a link straight to this week's chart" aria-label="Copy link to this chart"
            className="flex items-center gap-1 text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--text)] px-2 py-1 rounded-md hover:bg-[var(--surface2)] transition-colors duration-150"
          >
            {linkCopyState === "copied" ? <Check className="w-3.5 h-3.5 text-[var(--pos)]" /> : linkCopyState === "error" ? <XIcon className="w-3.5 h-3.5 text-[var(--neg)]" /> : <LinkIcon className="w-3.5 h-3.5" />}
            {linkCopyState === "copied" ? "Link Copied!" : linkCopyState === "error" ? "Couldn't copy" : "Copy Link"}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-[var(--muted)] -mt-2 mb-3">
        <span className="font-bold text-[var(--text2)]">Actual</span> = posted score&nbsp;&nbsp;&bull;&nbsp;&nbsp;
        <span className="font-bold text-[var(--proj)]">Proj</span> = projected finish
      </p>
      {selected.size > 0 && !filterActive && (
        <p className="text-[10px] text-[var(--muted)] -mt-2 mb-2">
          {selected.size} team{selected.size > 1 ? 's' : ''} selected -- Ctrl/Cmd/Shift-click more, or hit "Filter to Selection" above.
        </p>
      )}
      <div className="overflow-x-auto scroll-thin">
        <svg
          ref={svgRef} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={`Week ${week} scores by team`}
          style={{ width: width * zoom, height: HEIGHT * zoom, fontFamily: DATA_FONT, transition: 'width 0.2s ease, height 0.2s ease' }}
        >
          <text
            x={84} y={MARGIN.top + plotH / 2} textAnchor="middle" fontSize={12} fontWeight={700}
            fill="var(--muted)" transform={`rotate(-90 84 ${MARGIN.top + plotH / 2})`}
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
                AFC {afcMedian.toFixed(1)} {scoreTypeLabel}
              </text>
            </g>
          )}
          {nfcMedian != null && (
            <g opacity={focusManager ? 0.4 : 1}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yFor(nfcMedian)} y2={yFor(nfcMedian)} stroke={NFC_COLOR} strokeWidth={focusManager ? 1.5 : 2.5} strokeDasharray="7 5" />
              <text x={width - MARGIN.right + 8} y={yFor(nfcMedian)} dominantBaseline="middle" fontSize={focusManager ? 11 : 13} fontWeight={700} fill={NFC_COLOR}>
                NFC {nfcMedian.toFixed(1)} {scoreTypeLabel}
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
                You: {focusScore.toFixed(2)} {scoreTypeLabel}
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
                {graphName(hoveredBarForLine.manager, hoveredBarForLine.conf)}: {hoveredBarForLine.score.toFixed(2)} {hoveredBarForLine.scoreType}
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
            // Hovering a bar also keeps its two REAL opponents (in-conference + cross-conference)
            // fully visible instead of fading them out with everyone else -- makes it obvious at a
            // glance who that team actually played this week, not just what they scored.
            const isOpponentOfHovered = !!hoveredBarForLine && (b.manager === hoveredBarForLine.opponent || b.manager === hoveredBarForLine.crossOpponent);
            // Your own bar (focus mode) stays highlighted even while hovering someone else -- it's
            // the reference point everything else is being read against, so it shouldn't fade out
            // right when it's most useful to keep an eye on. A ctrl/shift-selected bar is a
            // deliberate, persistent choice too -- it shouldn't fade out (dashed ring and all)
            // just because you're now hovering a different bar to compare against.
            const isDimmed = hovered && !isHovered && !isOpponentOfHovered && b.manager !== focusManager && !selected.has(b.manager);
            const barY = yFor(b.score);
            const color = colorFor(b);
            const barHeight = MARGIN.top + plotH - barY;
            const logoUrl = logoMap?.[b.manager];
            const clipId = `wsbc-logo-${week}-${(focusManager || 'all').replace(/[^a-zA-Z0-9]/g, '')}-${b.manager.replace(/[^a-zA-Z0-9]/g, '')}`;
            const logoCy = barY + LOGO_SIZE / 2 + 8;
            const showLogo = logoUrl && barHeight >= LOGO_SIZE + 14;
            const isSelected = selected.has(b.manager);
            const visibleName = displayName(b.manager, b.conf);
            const secondaryName = nameMode === 'teams' ? managerName(b.manager, b.conf) : null;
            // The actual "move out of the way / slide in next to" animation: dx shifts this bar
            // from its normal sorted position to its slot in the click-pinned reflow (0 when
            // nothing's pinned, or when this bar isn't affected by the current pin), and the
            // transform transition below is what makes that shift slide instead of jump.
            const dx = pinXByManager ? (pinXByManager[b.manager] - b.x) : 0;
            const isPinned = pinned === b.manager;
            return (
              <g
                key={b.manager}
                opacity={isDimmed ? 0.35 : 1}
                onMouseEnter={() => setHovered(b.manager)}
                onMouseLeave={() => setHovered(null)}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey) { toggleSelected(b.manager); return; }
                  setPinned(prev => (prev === b.manager ? null : b.manager));
                }}
                style={{
                  cursor: 'pointer',
                  filter: isHovered ? `drop-shadow(0 0 10px ${color})` : `drop-shadow(0 2px 3px rgba(0,0,0,0.25))`,
                  transform: `translate(${dx}px, ${isHovered ? -4 : 0}px)`,
                  transformBox: 'fill-box', transformOrigin: 'bottom center',
                  transition: 'filter 0.2s ease, transform 0.45s cubic-bezier(.22,1,.36,1)'
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
                {/* Pinned (grouped-with-opponents) ring -- solid, not dashed, so it reads as a
                    different state from the selection ring above rather than a duplicate of it. */}
                {isPinned && (
                  <rect
                    x={b.x - 4} y={barY - 4} width={MIN_BAR_W + 8} height={barHeight + 4} rx={8}
                    fill="none" stroke={color} strokeWidth={2.5} pointerEvents="none"
                  />
                )}
                {showLogo && (
                  <>
                    <defs>
                      <clipPath id={clipId}>
                        <circle cx={b.x + MIN_BAR_W / 2} cy={logoCy} r={LOGO_SIZE / 2} />
                      </clipPath>
                    </defs>
                    {/* Logo/name click opens the full matchup preview (stopPropagation so it
                        doesn't also toggle this bar's pin) -- the bar body itself is what
                        groups/ungroups opponents now. */}
                    <image
                      href={logoUrl} x={b.x + MIN_BAR_W / 2 - LOGO_SIZE / 2} y={logoCy - LOGO_SIZE / 2}
                      width={LOGO_SIZE} height={LOGO_SIZE} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice"
                      onClick={(e) => { e.stopPropagation(); openPreview(b.manager, b.conf, week); }}
                      style={{ cursor: 'pointer' }}
                    />
                    <circle cx={b.x + MIN_BAR_W / 2} cy={logoCy} r={LOGO_SIZE / 2} fill="none" stroke="var(--surface)" strokeWidth={2} />
                  </>
                )}
                {b.manager === highScoreManager && (
                  <text x={b.x + MIN_BAR_W / 2} y={barY - 24} textAnchor="middle" fontSize={17}>
                    {HIGH_SCORE_PRIZES[week]?.choice === "wine" ? "\u{1F377}" : HIGH_SCORE_PRIZES[week]?.choice === "cash" ? "\u{1F4B0}" : "\u{1F4B0}\u{1F377}"}
                  </text>
                )}
                <text x={b.x + MIN_BAR_W / 2} y={barY - 16} textAnchor="middle" fontSize={14} fontWeight={800} fill="var(--text)">
                  {b.score.toFixed(2)}
                </text>
                <text x={b.x + MIN_BAR_W / 2} y={barY - 4} textAnchor="middle" fontSize={9} fontWeight={800} fill={b.scoreType === "Proj" ? "var(--proj)" : "var(--muted)"}>
                  {b.scoreType}
                </text>
                {/* Rotated team label below the bar -- long manager names need the angle to fit.
                    Serif (matching the title), deliberately different from the sans-serif numbers
                    everywhere else on this chart -- a name is a label, not a number. Real manager
                    name (when we actually have one on file -- never guessed) as a smaller second
                    line, in parens, right underneath. */}
                <text
                  x={b.x + MIN_BAR_W / 2} y={MARGIN.top + plotH + 12} fontWeight={700}
                  fill={b.conf === "AFC" ? AFC_COLOR : NFC_COLOR}
                  fontFamily={SERIF_FONT}
                  textAnchor="end" transform={`rotate(-40 ${b.x + MIN_BAR_W / 2} ${MARGIN.top + plotH + 12})`}
                  onClick={(e) => { e.stopPropagation(); openPreview(b.manager, b.conf, week); }}
                  style={{ cursor: 'pointer' }}
                >
                  <tspan x={b.x + MIN_BAR_W / 2} fontSize={13}>{visibleName}</tspan>
                  {secondaryName && <tspan x={b.x + MIN_BAR_W / 2} dy="14" fontSize={10} fontWeight={600} fill="var(--muted)">({secondaryName})</tspan>}
                </text>
                <title>
                  {graphName(b.manager, b.conf)} ({b.conf}): {b.score.toFixed(2)} {b.scoreType}
                  {b.scoreType === "Proj" && b.actualScore != null ? `; ${b.actualScore.toFixed(2)} Actual posted` : ''}
                  {b.opponent ? ` vs ${graphName(b.opponent, b.conf)}${b.result ? ` (${b.result})` : ''}` : ''}
                </title>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs font-semibold">
        {legendItems.map(item => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} /> {item.label}
          </span>
        ))}
        {medianLegendItems.map(item => (
          <span key={item.label} className="flex items-center gap-1.5" style={{ color: item.color }}>
            <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: item.color }} /> {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
