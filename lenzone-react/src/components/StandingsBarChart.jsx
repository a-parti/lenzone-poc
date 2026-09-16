import React, { useState } from 'react';
import { Download, Copy, Check, X as XIcon, Link as LinkIcon, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useRosterModal } from '../context/RosterModalContext';
import { getRealName } from '../lib/realNames';
import lenzoneLogoRing from '../assets/lenzone-logo-ring.png';
import lenzoneLogoBall from '../assets/lenzone-logo-ball.png';

const HEIGHT = 380;
// bottom carries a little extra room for the tied-points bracket row (see `tiers` below), which
// sits right between the bar bottoms and the rotated name labels -- not tacked on below the
// labels, which read as a stray disconnected row down at the very edge of the chart.
const MARGIN = { top: 40, right: 16, bottom: 156, left: 56 };
const MIN_BAR_W = 58;
const BAR_GAP = 10;
const GROUP_GAP = 30;
const LOGO_SIZE = 32;
const AFC_COLOR = "#f87171"; // matches WeeklyScoresBarChart's AFC_COLOR / CONF_STYLES.AFC.text
const NFC_COLOR = "#60a5fa"; // matches WeeklyScoresBarChart's NFC_COLOR / CONF_STYLES.NFC.text
// Same serif/sans split as WeeklyScoresBarChart -- a name is a label (serif), a number is data
// (bold geometric sans) -- so the two chart types read as one consistent visual system.
const DATA_FONT = "'DM Sans', ui-sans-serif, sans-serif";
const SERIF_FONT = "'Lora', Georgia, serif";

function niceStep(max, targetCount = 5) {
  const rawStep = max / targetCount || 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const step = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  return step * magnitude;
}
function niceTicks(max, targetCount = 5) {
  const step = niceStep(max, targetCount);
  const domainMax = max * 1.08;
  const ticks = [];
  for (let v = 0; v <= domainMax; v += step) ticks.push(v);
  return { ticks, domainMax };
}

// One bar per team, ranked left to right, height = that team's average Points For -- the same
// Standings Pts/PF-avg figures the Standings table above already computes (rankConference/
// buildConferenceList in statsMath.js), just laid out as a chart instead of rows. Two modes:
// - "segregated" (default): each conference ranked against just its own 12 -- matches the
//   Standings table's own per-conference rank exactly, so the numbers here and there never
//   disagree. Two separated, labeled groups when both conferences are showing.
// - "combined": one merged 1-24 ranking across both conferences at once (still tie-broken by PF,
//   same as rankConference) -- a genuine "where do I stand among literally everyone" view, which
//   the segregated chart can't answer since its "#1" is only ever relative to a 12-team half.
//   Only meaningfully different from segregated when both conferences are showing; the parent
//   only renders this mode for the ALL filter for exactly that reason.
export default function StandingsBarChart({ afcStandings, nfcStandings, confFilter, logoMap, afcData, nfcData, mode = "segregated" }) {
  const [hovered, setHovered] = useState(null);
  const { openRoster } = useRosterModal();
  const [zoom, setZoom] = useState(1);
  const ZOOM_MIN = 0.5, ZOOM_MAX = 2, ZOOM_STEP = 0.25;
  const [exporting, setExporting] = useState(false);
  const [copyState, setCopyState] = useState("idle");
  const [downloadState, setDownloadState] = useState("idle");
  const [linkCopyState, setLinkCopyState] = useState("idle");

  const groups = [];
  if (mode === "combined") {
    const merged = [...(afcStandings || []), ...(nfcStandings || [])]
      .sort((a, b) => b.totalPts - a.totalPts || b.pf - a.pf)
      .map((row, i) => ({ ...row, rank: i + 1 }));
    if (merged.length) groups.push({ conf: null, rows: merged });
  } else {
    if (confFilter !== "NFC" && afcStandings?.length) groups.push({ conf: "AFC", rows: [...afcStandings].sort((a, b) => a.rank - b.rank) });
    if (confFilter !== "AFC" && nfcStandings?.length) groups.push({ conf: "NFC", rows: [...nfcStandings].sort((a, b) => a.rank - b.rank) });
  }

  if (groups.length === 0 || groups.every(g => g.rows.length === 0)) return null;

  let x = MARGIN.left;
  const bars = [];
  // Tracks each group's own x-span so a conference label/divider can be drawn once per group,
  // above its bars -- color alone (plus a fairly subtle 30px gap) wasn't a strong enough cue that
  // you'd crossed from one conference into the other in the combined ALL view.
  const groupSpans = [];
  groups.forEach((group, gi) => {
    if (gi > 0) x += GROUP_GAP;
    const startX = x;
    group.rows.forEach(row => {
      // group.conf is null in combined mode (one merged group, not per-conference) -- fall back
      // to the row's OWN real conf (already set by rankConference) so each bar still colors by
      // its actual conference instead of every bar losing its color to that null marker.
      bars.push({ ...row, conf: group.conf ?? row.conf, x });
      x += MIN_BAR_W + BAR_GAP;
    });
    groupSpans.push({ conf: group.conf, startX, endX: x - BAR_GAP });
  });

  // Groups consecutive same-Standings-Pts bars into one tier (bars are already sorted by rank,
  // so ties are always adjacent) -- a tier of 2+ gets ONE shared "3.0 pts" bracket drawn once
  // below the chart instead of repeating "(3.0)" in every single one of those bars' own labels.
  // Never spans a conference boundary in segregated mode (a new group always starts a new tier)
  // since AFC's "3.0" and NFC's "3.0" are two separate ties, not one.
  const tiers = [];
  bars.forEach((b, i) => {
    const prev = bars[i - 1];
    // The conference boundary only breaks a tier in segregated mode, where AFC's and NFC's own
    // "3.0" are genuinely two separate ties. In combined mode conf is just a color, not a real
    // grouping boundary -- a tie that happens to straddle an AFC- and NFC-origin team adjacent in
    // the merged rank is still one real tie and belongs in one shared bracket, not two size-1 ones.
    if (i === 0 || (mode !== "combined" && b.conf !== prev.conf) || b.totalPts !== prev.totalPts) {
      tiers.push({ pts: b.totalPts, startX: b.x, endX: b.x + MIN_BAR_W, count: 1 });
    } else {
      const t = tiers[tiers.length - 1];
      t.endX = b.x + MIN_BAR_W;
      t.count++;
    }
    b.tierIdx = tiers.length - 1;
  });
  const plotW = x - BAR_GAP - MARGIN.left;
  const width = MARGIN.left + MARGIN.right + plotW;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const maxPf = Math.max(1, ...bars.map(b => b.pfAvg || 0));
  const { ticks, domainMax } = niceTicks(maxPf);
  const yFor = (v) => MARGIN.top + plotH - (v / domainMax) * plotH;
  // The tied-points bracket sits in its own row between the bar bottoms and the rotated name
  // labels (not tacked on below everything, and not fighting the labels for the same row) --
  // labelStartY is pushed down from where it used to start to make room for that row above it.
  const bracketY = MARGIN.top + plotH + 20;
  const labelStartY = MARGIN.top + plotH + 40;
  const titleSuffix = mode === "combined" ? " (Overall)" : confFilter === "AFC" ? " (AFC)" : confFilter === "NFC" ? " (NFC)" : "";
  const chartTitle = `Standings -- Ranked by Points, PF/Game${titleSuffix}`;

  // ---- Export (PNG download / copy-to-clipboard / deep link) -- same approach as
  // WeeklyScoresBarChart: a deliberately separate, self-built SVG (not a clone of the live one) so
  // the export never depends on the viewer's own theme, webfonts, or hover state; team logos are
  // pre-fetched as base64 data URIs since an isolated SVG rasterization can't load external images.
  const EXPORT = { bg: "#0f172a", text: "#f8fafc", muted: "#94a3b8", border: "#475569" };
  const EXPORT_SANS = "Arial, Helvetica, sans-serif";
  const EXPORT_SERIF = "Georgia, 'Times New Roman', serif";
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('image failed to load'));
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
      const uniqueManagers = [...new Set(bars.filter(b => logoMap?.[b.manager]).map(b => b.manager))];
      const entries = await Promise.all(uniqueManagers.map(async m => [m, await fetchLogoDataUrl(logoMap[m])]));
      logoData = Object.fromEntries(entries.filter(([, data]) => data));
    }
    const [brandRing, brandBall] = await Promise.all([fetchLogoDataUrl(lenzoneLogoRing), fetchLogoDataUrl(lenzoneLogoBall)]);
    const titleH = 56;
    const legendH = 44;
    const exportW = width;
    const exportH = titleH + HEIGHT + legendH;

    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${exportW}" height="${exportH}" viewBox="0 0 ${exportW} ${exportH}">`);
    parts.push(`<defs><linearGradient id="export-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#161c2e"/><stop offset="55%" stop-color="${EXPORT.bg}"/><stop offset="100%" stop-color="#080a12"/></linearGradient></defs>`);
    parts.push(`<rect x="0" y="0" width="${exportW}" height="${exportH}" fill="url(#export-bg)"/>`);
    parts.push(`<text x="${exportW / 2}" y="36" text-anchor="middle" font-family="${EXPORT_SERIF}" font-size="24" font-weight="700" fill="${EXPORT.text}">${esc(chartTitle)}</text>`);
    if (brandRing && brandBall) {
      const logoSize = 32, logoX = 16, logoY = 12;
      parts.push(`<image href="${brandRing}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}"/>`);
      parts.push(`<image href="${brandBall}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}"/>`);
    }

    parts.push(`<g transform="translate(0 ${titleH})">`);
    ticks.forEach(t => {
      const ty = yFor(t);
      parts.push(`<line x1="${MARGIN.left}" x2="${width - MARGIN.right}" y1="${ty}" y2="${ty}" stroke="${EXPORT.border}" stroke-opacity="0.5" stroke-width="1"/>`);
      parts.push(`<text x="${MARGIN.left - 10}" y="${ty}" text-anchor="end" dominant-baseline="middle" font-family="${EXPORT_SANS}" font-size="13" fill="${EXPORT.muted}">${t.toFixed(0)}</text>`);
    });
    parts.push(`<text x="78" y="${MARGIN.top + plotH / 2}" text-anchor="middle" font-family="${EXPORT_SANS}" font-size="13" font-weight="700" fill="${EXPORT.muted}" transform="rotate(-90 78 ${MARGIN.top + plotH / 2})">PF / Game</text>`);

    if (groupSpans.length > 1) {
      groupSpans.forEach(g => {
        parts.push(`<text x="${(g.startX + g.endX) / 2}" y="${MARGIN.top - 16}" text-anchor="middle" font-family="${EXPORT_SANS}" font-size="13" font-weight="800" letter-spacing="1" fill="${g.conf === 'AFC' ? AFC_COLOR : NFC_COLOR}">${g.conf}</text>`);
      });
      const dividerX = groupSpans[0].endX + GROUP_GAP / 2;
      parts.push(`<line x1="${dividerX}" x2="${dividerX}" y1="${MARGIN.top - 8}" y2="${MARGIN.top + plotH}" stroke="${EXPORT.border}" stroke-width="1.5" stroke-dasharray="3 4"/>`);
    }

    bars.forEach(b => {
      const barY = yFor(b.pfAvg || 0);
      const barHeight = MARGIN.top + plotH - barY;
      const color = b.conf === "AFC" ? AFC_COLOR : b.conf === "NFC" ? NFC_COLOR : EXPORT.text;
      const cx = b.x + MIN_BAR_W / 2;
      parts.push(`<rect x="${b.x}" y="${barY}" width="${MIN_BAR_W}" height="${barHeight}" rx="5" fill="${color}" fill-opacity="0.75" stroke="${color}" stroke-width="2"/>`);
      const logoUrl = logoData[b.manager];
      if (logoUrl && barHeight >= LOGO_SIZE + 12) {
        const logoCy = barY + LOGO_SIZE / 2 + 6;
        const clipId = `export-logo-${b.manager.replace(/[^a-zA-Z0-9]/g, '')}`;
        parts.push(`<defs><clipPath id="${clipId}"><circle cx="${cx}" cy="${logoCy}" r="${LOGO_SIZE / 2}"/></clipPath></defs>`);
        parts.push(`<image href="${logoUrl}" x="${cx - LOGO_SIZE / 2}" y="${logoCy - LOGO_SIZE / 2}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`);
        parts.push(`<circle cx="${cx}" cy="${logoCy}" r="${LOGO_SIZE / 2}" fill="none" stroke="${EXPORT.bg}" stroke-width="2"/>`);
      }
      parts.push(`<text x="${cx}" y="${barY - 6}" text-anchor="middle" font-family="${EXPORT_SANS}" font-size="13" font-weight="800" fill="${EXPORT.text}">${(b.pfAvg || 0).toFixed(1)}</text>`);
      const labelY = labelStartY;
      const realName = getRealName(afcData, nfcData, b.manager);
      const ptsSuffix = tiers[b.tierIdx].count === 1 ? ` (${b.totalPts.toFixed(1)})` : '';
      parts.push(`<text font-family="${EXPORT_SERIF}" font-weight="700" fill="${color}" text-anchor="end" transform="rotate(-40 ${cx} ${labelY})">` +
        `<tspan x="${cx}" y="${labelY}" font-size="13">#${b.rank}${ptsSuffix}</tspan>` +
        `<tspan x="${cx}" y="${labelY + 14}" font-size="11" font-weight="600" fill="${EXPORT.muted}">${esc(b.manager)}</tspan>` +
        (realName ? `<tspan x="${cx}" y="${labelY + 27}" font-size="9" font-weight="600" fill="${EXPORT.muted}">(${esc(realName)})</tspan>` : '') +
        `</text>`);
    });
    parts.push(`</g>`);

    // Same tied-points bracket as the live chart (between the bars and the rotated name row,
    // label sitting on the line with a gap behind it), once per tier of 2+ instead of repeating
    // the points value on every bar in that tier. No titleH offset needed -- this whole block
    // already sits inside the translate(0 titleH) `<g>` above.
    tiers.filter(t => t.count > 1).forEach(t => {
      const midX = (t.startX + t.endX) / 2;
      const label = `${t.pts.toFixed(1)} pts`;
      const gapHalf = label.length * 3.3 + 6;
      parts.push(`<line x1="${t.startX}" x2="${midX - gapHalf}" y1="${bracketY}" y2="${bracketY}" stroke="${EXPORT.muted}" stroke-width="1.5"/>`);
      parts.push(`<line x1="${midX + gapHalf}" x2="${t.endX}" y1="${bracketY}" y2="${bracketY}" stroke="${EXPORT.muted}" stroke-width="1.5"/>`);
      parts.push(`<line x1="${t.startX}" x2="${t.startX}" y1="${bracketY - 5}" y2="${bracketY + 5}" stroke="${EXPORT.muted}" stroke-width="1.5"/>`);
      parts.push(`<line x1="${t.endX}" x2="${t.endX}" y1="${bracketY - 5}" y2="${bracketY + 5}" stroke="${EXPORT.muted}" stroke-width="1.5"/>`);
      parts.push(`<text x="${midX}" y="${bracketY}" text-anchor="middle" dominant-baseline="middle" font-family="${EXPORT_SANS}" font-size="11" font-weight="700" fill="${EXPORT.muted}">${label}</text>`);
    });

    let ly = titleH + HEIGHT + 28;
    const legendItems = [{ color: AFC_COLOR, label: 'AFC' }, { color: NFC_COLOR, label: 'NFC' }];
    let lx = exportW / 2 - 60;
    legendItems.forEach(item => {
      parts.push(`<rect x="${lx}" y="${ly - 11}" width="14" height="14" rx="3" fill="${item.color}"/>`);
      parts.push(`<text x="${lx + 20}" y="${ly}" font-family="${EXPORT_SANS}" font-size="14" font-weight="600" fill="${EXPORT.text}">${item.label}</text>`);
      lx += 80;
    });

    parts.push(`</svg>`);
    return { svgText: parts.join(''), exportW, exportH };
  };

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
      link.download = `standings${mode === 'combined' ? '-overall' : confFilter ? `-${confFilter.toLowerCase()}` : ''}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG export failed:', err);
      setDownloadState("error");
      setTimeout(() => setDownloadState("idle"), 2500);
    } finally {
      setExporting(false);
    }
  };
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
  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#standings`;
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
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="tracking-wide text-base text-[var(--text)]" style={{ fontFamily: SERIF_FONT, fontWeight: 700 }}>
          {chartTitle}
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
          <button
            type="button" onClick={copyPng} disabled={exporting}
            title="Copy image -- paste (Ctrl/Cmd+V) straight into an MS Teams or Discord message"
            aria-label="Copy chart image to clipboard"
            className="flex items-center gap-1 text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--text)] px-2 py-1 rounded-md hover:bg-[var(--surface2)] transition-colors duration-150 disabled:opacity-50"
          >
            {copyState === "copied" ? <Check className="w-3.5 h-3.5 text-[var(--pos)]" /> : copyState === "error" ? <XIcon className="w-3.5 h-3.5 text-[var(--neg)]" /> : <Copy className="w-3.5 h-3.5" />}
            {copyState === "copied" ? "Copied!" : copyState === "error" ? "Couldn't copy" : "Copy Image"}
          </button>
          <button
            type="button" onClick={downloadPng} disabled={exporting} title="Download chart as PNG" aria-label="Download chart as PNG"
            className="flex items-center gap-1 text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--text)] px-2 py-1 rounded-md hover:bg-[var(--surface2)] transition-colors duration-150 disabled:opacity-50"
          >
            {downloadState === "error" ? <XIcon className="w-3.5 h-3.5 text-[var(--neg)]" /> : <Download className="w-3.5 h-3.5" />}
            {downloadState === "error" ? "Export failed" : "PNG"}
          </button>
          <button
            type="button" onClick={copyLink} title="Copy a link straight to the Standings tab" aria-label="Copy link to Standings"
            className="flex items-center gap-1 text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--text)] px-2 py-1 rounded-md hover:bg-[var(--surface2)] transition-colors duration-150"
          >
            {linkCopyState === "copied" ? <Check className="w-3.5 h-3.5 text-[var(--pos)]" /> : linkCopyState === "error" ? <XIcon className="w-3.5 h-3.5 text-[var(--neg)]" /> : <LinkIcon className="w-3.5 h-3.5" />}
            {linkCopyState === "copied" ? "Link Copied!" : linkCopyState === "error" ? "Couldn't copy" : "Copy Link"}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label="Standings ranked by points, PF per game"
          style={{ width: width * zoom, height: HEIGHT * zoom, fontFamily: DATA_FONT, transition: 'width 0.2s ease, height 0.2s ease' }}
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yFor(t)} y2={yFor(t)} stroke="var(--border)" strokeOpacity={0.35} strokeWidth={1} />
              <text x={MARGIN.left - 10} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--muted)">
                {t.toFixed(0)}
              </text>
            </g>
          ))}
          <text
            x={16} y={MARGIN.top + plotH / 2} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--muted)"
            transform={`rotate(-90 16 ${MARGIN.top + plotH / 2})`}
          >
            PF / Game
          </text>

          {/* Conference labels + a divider, only when both are showing at once (segregated ALL
              filter) -- a single-conference filter, or combined mode, already says so in the
              title above, so labeling here too would just be redundant. */}
          {groupSpans.length > 1 && groupSpans.map(g => (
            <text
              key={g.conf} x={(g.startX + g.endX) / 2} y={MARGIN.top - 16} textAnchor="middle"
              fontSize={13} fontWeight={800} letterSpacing={1} fill={g.conf === "AFC" ? AFC_COLOR : NFC_COLOR}
            >
              {g.conf}
            </text>
          ))}
          {groupSpans.length > 1 && (
            <line
              x1={groupSpans[0].endX + GROUP_GAP / 2} x2={groupSpans[0].endX + GROUP_GAP / 2}
              y1={MARGIN.top - 8} y2={MARGIN.top + plotH} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="3 4"
            />
          )}

          <defs>
            <linearGradient id="sbc-bar-sheen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.4} />
              <stop offset="55%" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>

          {bars.map(b => {
            const isHovered = hovered === b.manager;
            const isDimmed = hovered && !isHovered;
            const color = b.conf === "AFC" ? AFC_COLOR : b.conf === "NFC" ? NFC_COLOR : "var(--accent)";
            const barY = yFor(b.pfAvg || 0);
            const barHeight = MARGIN.top + plotH - barY;
            const logoUrl = logoMap?.[b.manager];
            const logoCy = barY + LOGO_SIZE / 2 + 6;
            const showLogo = logoUrl && barHeight >= LOGO_SIZE + 10;
            // mode included -- when both this chart and the other StandingsBarChart instance
            // (segregated + combined) are mounted at once, the same manager produces the same
            // clip id in both unless distinguished, and SVG ids must be unique document-wide, not
            // just per-<svg>: a collision makes url(#id) resolve to whichever chart defined it
            // first, silently clipping the OTHER chart's logo into the wrong shape/position.
            const clipId = `sbc-logo-${mode}-${b.conf}-${b.manager.replace(/[^a-zA-Z0-9]/g, '')}`;
            const realName = getRealName(afcData, nfcData, b.manager);
            return (
              <g
                key={`${b.conf}-${b.manager}`}
                opacity={isDimmed ? 0.4 : 1}
                onMouseEnter={() => setHovered(b.manager)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => openRoster(b.manager, b.conf || (afcStandings?.some(r => r.manager === b.manager) ? "AFC" : "NFC"))}
                style={{
                  cursor: 'pointer',
                  filter: isHovered ? `drop-shadow(0 0 8px ${color})` : `drop-shadow(0 2px 3px rgba(0,0,0,0.2))`,
                  transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
                  transformBox: 'fill-box', transformOrigin: 'bottom center',
                  transition: 'filter 0.2s ease, transform 0.2s ease, opacity 0.2s ease'
                }}
              >
                <rect x={b.x} y={barY} width={MIN_BAR_W} height={barHeight} rx={5} fill={color} fillOpacity={isHovered ? 0.9 : 0.7} stroke={color} strokeWidth={2} />
                <rect x={b.x} y={barY} width={MIN_BAR_W} height={barHeight} rx={5} fill="url(#sbc-bar-sheen)" pointerEvents="none" />
                {showLogo && (
                  <>
                    <defs>
                      <clipPath id={clipId}><circle cx={b.x + MIN_BAR_W / 2} cy={logoCy} r={LOGO_SIZE / 2} /></clipPath>
                    </defs>
                    <image
                      href={logoUrl} x={b.x + MIN_BAR_W / 2 - LOGO_SIZE / 2} y={logoCy - LOGO_SIZE / 2}
                      width={LOGO_SIZE} height={LOGO_SIZE} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice"
                    />
                    <circle cx={b.x + MIN_BAR_W / 2} cy={logoCy} r={LOGO_SIZE / 2} fill="none" stroke="var(--surface)" strokeWidth={2} />
                  </>
                )}
                <text x={b.x + MIN_BAR_W / 2} y={barY - 6} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--text)">
                  {(b.pfAvg || 0).toFixed(1)}
                </text>
                {/* X axis is ranking first -- "#1 (28.4)" (Standings Pts in parens) -- with the
                    team name as a smaller second line so a bar's still identifiable at a glance.
                    The "(pts)" part is dropped whenever this bar shares a tier with others (a
                    shared bracket/label sits between the bars and this row instead -- see below),
                    which is also why this row starts lower (labelStartY) than it otherwise would. */}
                <text
                  x={b.x + MIN_BAR_W / 2} y={labelStartY} fontWeight={700} fontFamily={SERIF_FONT}
                  fill={color === "var(--accent)" ? "var(--text)" : color} textAnchor="end" transform={`rotate(-40 ${b.x + MIN_BAR_W / 2} ${labelStartY})`}
                >
                  <tspan x={b.x + MIN_BAR_W / 2} fontSize={13} fontFamily={DATA_FONT} fontWeight={800}>
                    #{b.rank}{tiers[b.tierIdx].count === 1 ? ` (${b.totalPts.toFixed(1)})` : ''}
                  </tspan>
                  <tspan x={b.x + MIN_BAR_W / 2} dy="14" fontSize={11} fontWeight={600} fill="var(--text2)">{b.manager}</tspan>
                  {realName && <tspan x={b.x + MIN_BAR_W / 2} dy="13" fontSize={9} fontWeight={600} fill="var(--muted)">({realName})</tspan>}
                </text>
                <title>#{b.rank} {b.manager}{b.conf ? ` (${b.conf})` : ''} -- {b.totalPts.toFixed(2)} standings pts, {(b.pfAvg || 0).toFixed(2)} PF/game</title>
              </g>
            );
          })}

          {/* One shared bracket per tied-points tier (2+ bars), between the bars and the rotated
              name row -- the "pivot" collapse: "3.0 pts" said once for the whole cluster instead
              of on every bar's own label. Label sits directly ON the bracket line (a gap in the
              line behind it, estimated from the label's own character count since an exact text
              width isn't available at render time), not below it, so it's clearly attached to the
              bars it's grouping rather than reading as a caption for the row underneath it. */}
          {tiers.filter(t => t.count > 1).map((t, i) => {
            const midX = (t.startX + t.endX) / 2;
            const label = `${t.pts.toFixed(1)} pts`;
            const gapHalf = label.length * 3.3 + 6;
            return (
              <g key={i}>
                <line x1={t.startX} x2={midX - gapHalf} y1={bracketY} y2={bracketY} stroke="var(--muted)" strokeWidth={1.5} />
                <line x1={midX + gapHalf} x2={t.endX} y1={bracketY} y2={bracketY} stroke="var(--muted)" strokeWidth={1.5} />
                <line x1={t.startX} x2={t.startX} y1={bracketY - 5} y2={bracketY + 5} stroke="var(--muted)" strokeWidth={1.5} />
                <line x1={t.endX} x2={t.endX} y1={bracketY - 5} y2={bracketY + 5} stroke="var(--muted)" strokeWidth={1.5} />
                <text x={midX} y={bracketY} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={700} fill="var(--muted)">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs font-semibold">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: AFC_COLOR }} /> AFC</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: NFC_COLOR }} /> NFC</span>
      </div>
    </div>
  );
}
