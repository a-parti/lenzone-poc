import React, { useEffect, useRef, useState } from 'react';
import { CONF_STYLES } from '../lib/theme';
import { useIsMyTeam } from '../context/MyTeamContext';
import { useMatchupPreview } from '../context/MatchupPreviewContext';
import { useNameDisplay } from '../context/NameDisplayContext';
import TeamName from './TeamName';
import TeamMiniLogo from './TeamMiniLogo';
import lenzoneLogoRing from '../assets/lenzone-logo-ring.png';
import lenzoneLogoBall from '../assets/lenzone-logo-ball.png';
import ExportControls from './ExportControls';
import useModuleExportTheme from '../hooks/useModuleExportTheme';
import { readThemeTokens } from '../lib/themeTokens';

// Fixed width so the sticky team column is stable; narrower on phones so the weeks get room.
const TEAM_COL_CLASS = 'w-[120px] min-w-[120px] max-w-[120px] sm:w-[232px] sm:min-w-[232px] sm:max-w-[232px]';
// Every week column is the same fixed width, so the AFC and NFC grids lay out identically and
// open scrolled to exactly the same spot regardless of team-name lengths.
const WEEK_COL_CLASS = 'w-[9rem] min-w-[9rem] max-w-[9rem]';
const EXPORT_SERIF = "'Lora', Georgia, serif";
const EXPORT_SANS = "'DM Sans', Arial, sans-serif";

async function fetchViaFetchApi(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('not an image');
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fetchViaCanvasImg(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || 64;
        canvas.height = image.naturalHeight || 64;
        canvas.getContext('2d').drawImage(image, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error('image failed to load'));
    image.src = url + (url.includes('?') ? '&' : '?') + '_cors=1';
  });
}

async function fetchLogoDataUrl(url) {
  if (!url) return null;
  for (const attempt of [fetchViaFetchApi, fetchViaCanvasImg]) {
    try {
      const dataUrl = await attempt(url);
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) return dataUrl;
    } catch {
      // Try the alternate CORS-safe loading path before falling back to a monogram.
    }
  }
  return null;
}

async function imageDataUrl(url) {
  try {
    return await fetchLogoDataUrl(url);
  } catch {
    return null;
  }
}

function findOpponent(pairs, manager) {
  const pair = (pairs || []).find(([a, b]) => a === manager || b === manager);
  if (!pair) return null;
  return pair[0] === manager ? pair[1] : pair[0];
}

function gridCellData({ manager, conf, season, oppSeason, crossSchedule, week, latestCompletedWeek }) {
  const intraOpponent = findOpponent(season.scheduleByWeek[week], manager);
  const crossMatch = crossSchedule.find(m => m.week === week && (m.afcTeam === manager || m.nfcTeam === manager));
  const interOpponent = crossMatch ? (crossMatch.afcTeam === manager ? crossMatch.nfcTeam : crossMatch.afcTeam) : null;
  const isCompleted = latestCompletedWeek != null && week <= latestCompletedWeek;
  return {
    intraOpponent,
    interOpponent,
    intraResult: isCompleted ? resultFor(season.scoreByWeek[week]?.[manager], season.scoreByWeek[week]?.[intraOpponent]) : null,
    interResult: isCompleted ? resultFor(season.scoreByWeek[week]?.[manager], oppSeason?.scoreByWeek[week]?.[interOpponent]) : null,
    interConf: conf === 'AFC' ? 'NFC' : 'AFC'
  };
}

// One big grid: every manager (rows) x every week (columns), so the whole league's schedule is
// visible at a glance instead of one team at a time. Each cell shows that manager's in-conference
// opponent (bold) and cross-conference opponent (smaller, muted) for that week -- the same two
// matchups ScheduleTab already computes per-team, just laid out for everyone at once. Sticky first
// column (team) and header row (week) since this is wide/tall enough to need scrolling either way
// -- just the team column, though; the current week is only called out with color/tint, not
// frozen in place, so scrolling right doesn't leave two separate frozen columns competing for
// attention.
export default function SeasonGridTab({ afcSeason, nfcSeason, crossSchedule, afcManagers, nfcManagers, seasonWeeks, currentWeek, latestCompletedWeek, logoMap = {}, conference = null, weekDateLabels = {}, focusWeek = null }) {
  // Clicking a week's own header toggles highlighting it -- click the same week again (or a
  // different one) to change/clear it, no separate dropdown control needed.
  const [highlightWeek, setHighlightWeek] = useState(null);
  const scrollRef = useRef(null);
  // Center the grid on the week picked at the top of the page (the current week by default), and
  // highlight it when it isn't the current week (which already has its own styling).
  const targetWeek = focusWeek ?? currentWeek;
  useEffect(() => {
    setHighlightWeek(focusWeek != null && focusWeek !== currentWeek ? focusWeek : null);
  }, [focusWeek, currentWeek]);
  useEffect(() => {
    const container = scrollRef.current;
    const th = container?.querySelector(`[data-week="${targetWeek}"]`);
    const teamCol = container?.querySelector('th');
    if (!container || !th) return;
    const visibleWidth = container.clientWidth - (teamCol?.offsetWidth || 0);
    const left = th.offsetLeft - (teamCol?.offsetWidth || 0) - (visibleWidth - th.offsetWidth) / 2;
    container.scrollTo({ left: Math.max(0, left), behavior: 'auto' });
  }, [targetWeek, seasonWeeks, afcManagers.length, nfcManagers.length]);
  const [exporting, setExporting] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const [downloadState, setDownloadState] = useState('idle');
  const { theme: exportTheme, setTheme: setExportTheme, scheme: exportScheme } = useModuleExportTheme();
  const toggleHighlight = (w) => setHighlightWeek(prev => (prev === w ? null : w));
  const weeks = Array.from({ length: seasonWeeks }, (_, i) => i + 1);
  // With a conference prop the grid shows just that conference (Matchups renders one per side);
  // without it, every manager with an AFC/NFC divider.
  const rows = [
    ...(conference !== 'NFC' ? afcManagers.map(m => ({ manager: m, conf: 'AFC' })) : []),
    ...(conference !== 'AFC' ? nfcManagers.map(m => ({ manager: m, conf: 'NFC' })) : [])
  ];
  const hasDivider = !conference;
  const { mode: nameMode, displayName } = useNameDisplay();

  const buildExportSvg = async (includeLogos = true) => {
    const dark = exportTheme === 'dark';
    // Coastal palette (matches index.css tokens), fixed hex because the PNG is a static image.
    const COLORS = dark ? {
      bg: '#0B1F2A', titleFrom: '#12303B', titleMid: '#0B1F2A', titleTo: '#12303B',
      rowA: '#12303B', rowA2: '#102A34', rowB: '#1A3C49', rowB2: '#173643',
      headerFrom: '#24495A', headerTo: '#1A3C49', ruleBg: '#12303B', ruleBg2: '#1A3C49',
      text: '#EAF4F4', text2: '#EAF4F4', muted: '#93AEB5', border: '#34606F', texture: '#ffffff',
      afc: '#FF5FA2', nfc: '#3EF0E0', win: '#5CD69B', loss: '#FF7B72', tie: '#C2D6DA',
      current: '#5A4A1C', current2: '#463914', currentText: '#F2C14E',
      highlight: '#5A3A33', highlight2: '#46302A', highlightText: '#FFD9D0',
      winBg: '#1B4A3A', winBg2: '#163E31', lossBg: '#4E2A2B', lossBg2: '#412324', accent: '#3EF0E0'
    } : {
      bg: '#FAF7F2', titleFrom: '#FFFFFF', titleMid: '#FAF7F2', titleTo: '#F0ECE4',
      rowA: '#FFFFFF', rowA2: '#FBF9F5', rowB: '#F4F0E9', rowB2: '#EFEAE2',
      headerFrom: '#12303B', headerTo: '#1D3F4B', ruleBg: '#F4F0E9', ruleBg2: '#EAE4DA',
      text: '#12303B', text2: '#FFFFFF', muted: '#5F7680', border: '#CFC7B9', texture: '#12303B',
      afc: '#D9604A', nfc: '#0E8A95', win: '#23845A', loss: '#C2413B', tie: '#5F7680',
      current: '#F6E3B4', current2: '#F0D58F', currentText: '#5A3D05',
      highlight: '#F8D9D1', highlight2: '#F2C8BC', highlightText: '#6B2A1C',
      winBg: '#D6EDE0', winBg2: '#C5E5D3', lossBg: '#F6D8D5', lossBg2: '#EFC6C2', accent: '#0E8A95'
    };
    // Core colors come from the live theme tokens so the PNG matches the site; the tints above stay as accents.
    const t = readThemeTokens(exportTheme);
    Object.assign(COLORS, { bg: t.bg, text: t.text, muted: t.muted, border: t.border2, afc: t.afc, nfc: t.nfc, win: t.pos, loss: t.neg, accent: t.accent, rowA: t.surface, rowA2: t.surface, rowB: t.surface2, rowB2: t.surface2 });
    const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const LABEL_W = 430;
    const WEEK_W = 205;
    const TITLE_H = 126;
    const HEADER_H = 70;
    const ROW_H = 88;
    const CONF_DIVIDER_H = 24;
    const FOOTER_H = 178;
    const exportW = LABEL_W + weeks.length * WEEK_W + 2;
    const dividerH = hasDivider ? CONF_DIVIDER_H : 0;
    const exportH = TITLE_H + HEADER_H + rows.length * ROW_H + dividerH + FOOTER_H + 2;
    const rowY = (rowIndex) => TITLE_H + HEADER_H + rowIndex * ROW_H + (hasDivider && rowIndex >= afcManagers.length ? CONF_DIVIDER_H : 0);
    const measureCtx = document.createElement('canvas').getContext('2d');
    const truncate = (value, maxWidth, font = `700 20px ${EXPORT_SANS}`) => {
      const full = String(value || '--');
      measureCtx.font = font;
      if (measureCtx.measureText(full).width <= maxWidth) return full;
      let short = full;
      while (short.length > 1 && measureCtx.measureText(`${short}...`).width > maxWidth) short = short.slice(0, -1);
      return `${short}...`;
    };
    const resultColor = (result) => result === 'W' ? COLORS.win : result === 'L' ? COLORS.loss : COLORS.tie;
    let logoData = {};
    if (includeLogos) {
      const logoEntries = await Promise.all(rows.map(async ({ manager }) => [manager, await fetchLogoDataUrl(logoMap[manager])]));
      logoData = Object.fromEntries(logoEntries.filter(([, dataUrl]) => dataUrl));
    }
    const [brandRing, brandBall] = await Promise.all([imageDataUrl(lenzoneLogoRing), imageDataUrl(lenzoneLogoBall)]);
    const title = conference ? `LENZONE 2026 ${conference} Schedule` : 'LENZONE 2026 Schedule';
    measureCtx.font = `700 50px ${EXPORT_SERIF}`;
    const titleWidth = measureCtx.measureText(title).width;
    const logoSize = brandRing && brandBall ? 66 : 0;
    const logoGap = logoSize ? 18 : 0;
    const titleGroupX = (exportW - logoSize - logoGap - titleWidth) / 2;
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${exportW}" height="${exportH}" viewBox="0 0 ${exportW} ${exportH}">`,
      `<defs>` +
        `<linearGradient id="schedule-title-bg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${COLORS.titleFrom}"/><stop offset="50%" stop-color="${COLORS.titleMid}"/><stop offset="100%" stop-color="${COLORS.titleTo}"/></linearGradient>` +
        `<linearGradient id="schedule-header-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${COLORS.headerFrom}"/><stop offset="100%" stop-color="${COLORS.headerTo}"/></linearGradient>` +
        `<linearGradient id="row-a-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${COLORS.rowA}"/><stop offset="100%" stop-color="${COLORS.rowA2}"/></linearGradient>` +
        `<linearGradient id="row-b-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${COLORS.rowB}"/><stop offset="100%" stop-color="${COLORS.rowB2}"/></linearGradient>` +
        `<linearGradient id="notes-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${COLORS.ruleBg}"/><stop offset="100%" stop-color="${COLORS.ruleBg2}"/></linearGradient>` +
        `<linearGradient id="current-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${COLORS.current}"/><stop offset="100%" stop-color="${COLORS.current2}"/></linearGradient>` +
        `<linearGradient id="highlight-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${COLORS.highlight}"/><stop offset="100%" stop-color="${COLORS.highlight2}"/></linearGradient>` +
        `<linearGradient id="win-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${COLORS.winBg}"/><stop offset="100%" stop-color="${COLORS.winBg2}"/></linearGradient>` +
        `<linearGradient id="loss-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${COLORS.lossBg}"/><stop offset="100%" stop-color="${COLORS.lossBg2}"/></linearGradient>` +
        `<linearGradient id="schedule-accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${COLORS.afc}"/><stop offset="48%" stop-color="${COLORS.accent}"/><stop offset="52%" stop-color="${COLORS.accent}"/><stop offset="100%" stop-color="${COLORS.nfc}"/></linearGradient>` +
        `<pattern id="material-texture" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M-3 12L12 -3M3 15L15 3" stroke="${COLORS.texture}" stroke-opacity="${dark ? 0.035 : 0.025}" stroke-width="0.7"/></pattern>` +
      `</defs>`,
      `<rect width="${exportW}" height="${exportH}" fill="${COLORS.bg}"/>`,
      `<rect width="${exportW}" height="${TITLE_H}" fill="url(#schedule-title-bg)"/>`,
      `<rect width="${exportW}" height="${TITLE_H}" fill="url(#material-texture)"/>`,
      `<rect width="${exportW}" height="6" fill="url(#schedule-accent)"/>`
    ];

    if (logoSize) {
      parts.push(`<image href="${brandRing}" x="${titleGroupX}" y="13" width="${logoSize}" height="${logoSize}"/>`);
      parts.push(`<image href="${brandBall}" x="${titleGroupX}" y="13" width="${logoSize}" height="${logoSize}"/>`);
    }
    parts.push(`<text x="${titleGroupX + logoSize + logoGap}" y="62" font-family="${EXPORT_SERIF}" font-size="50" font-weight="700" fill="${COLORS.text}">${title}</text>`);
    parts.push(`<text x="${exportW / 2}" y="103" text-anchor="middle" font-family="${EXPORT_SANS}" font-size="22" font-weight="750" fill="${COLORS.muted}">Each cell: in-conference opponent on top • cross-conference opponent below</text>`);
    parts.push(`<rect x="1" y="${TITLE_H}" width="${exportW - 2}" height="${HEADER_H}" fill="url(#schedule-header-bg)"/>`);
    parts.push(`<rect x="1" y="${TITLE_H}" width="${exportW - 2}" height="${HEADER_H}" fill="url(#material-texture)"/>`);

    parts.push(`<text x="24" y="${TITLE_H + 45}" font-family="${EXPORT_SANS}" font-size="22" font-weight="800" letter-spacing="1.5" fill="${COLORS.text2}">${nameMode === 'managers' ? 'MANAGER' : 'FANTASY TEAM'}</text>`);
    weeks.forEach((week, index) => {
      const x = LABEL_W + index * WEEK_W;
      const fill = week === highlightWeek ? 'url(#highlight-bg)' : week === currentWeek ? 'url(#current-bg)' : 'url(#schedule-header-bg)';
      const weekText = week === currentWeek ? COLORS.currentText : week === highlightWeek ? COLORS.highlightText : COLORS.text2;
      parts.push(`<rect x="${x}" y="${TITLE_H}" width="${WEEK_W}" height="${HEADER_H}" fill="${fill}" stroke="${COLORS.border}" stroke-width="1.1"/>`);
      parts.push(`<rect x="${x}" y="${TITLE_H}" width="${WEEK_W}" height="${HEADER_H}" fill="url(#material-texture)"/>`);
      if (weekDateLabels[week]) parts.push(`<text x="${x + WEEK_W / 2}" y="${TITLE_H + 62}" text-anchor="middle" font-family="${EXPORT_SANS}" font-size="15" font-weight="650" fill="${weekText}" opacity="0.85">${esc(weekDateLabels[week])}</text>`);
      parts.push(`<text x="${x + WEEK_W / 2}" y="${TITLE_H + 38}" text-anchor="middle" font-family="${EXPORT_SANS}" font-size="22" font-weight="800" fill="${weekText}">Wk ${week}${week === currentWeek ? ' •' : ''}${week === highlightWeek ? ' ●' : ''}</text>`);
    });

    rows.forEach(({ manager, conf }, rowIndex) => {
      const season = conf === 'AFC' ? afcSeason : nfcSeason;
      const oppSeason = conf === 'AFC' ? nfcSeason : afcSeason;
      const y = rowY(rowIndex);
      const rowFill = rowIndex % 2 === 0 ? 'url(#row-a-bg)' : 'url(#row-b-bg)';
      const confColor = conf === 'AFC' ? COLORS.afc : COLORS.nfc;
      parts.push(`<rect x="1" y="${y}" width="${exportW - 2}" height="${ROW_H}" fill="${rowFill}"/>`);
      parts.push(`<rect x="1" y="${y}" width="${exportW - 2}" height="${ROW_H}" fill="url(#material-texture)"/>`);
      parts.push(`<rect x="14" y="${y + 27}" width="58" height="34" rx="17" fill="${confColor}" fill-opacity="${dark ? 0.22 : 0.14}" stroke="${confColor}" stroke-width="1.5"/>`);
      parts.push(`<text x="43" y="${y + 50}" text-anchor="middle" font-family="${EXPORT_SANS}" font-size="15" font-weight="900" fill="${confColor}">${conf}</text>`);
      const managerLogo = logoData[manager];
      const logoCx = 112;
      const logoCy = y + ROW_H / 2;
      const managerLabel = displayName(manager, conf);
      if (managerLogo) {
        const clipId = `schedule-logo-${rowIndex}-${manager.replace(/[^a-zA-Z0-9]/g, '')}`;
        parts.push(`<defs><clipPath id="${clipId}"><circle cx="${logoCx}" cy="${logoCy}" r="24"/></clipPath></defs>`);
        parts.push(`<image href="${managerLogo}" x="${logoCx - 24}" y="${logoCy - 24}" width="48" height="48" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`);
        parts.push(`<circle cx="${logoCx}" cy="${logoCy}" r="24" fill="none" stroke="${confColor}" stroke-width="2"/>`);
      } else {
        parts.push(`<circle cx="${logoCx}" cy="${logoCy}" r="24" fill="${confColor}" fill-opacity="${dark ? 0.22 : 0.14}" stroke="${confColor}" stroke-width="2"/>`);
        parts.push(`<text x="${logoCx}" y="${logoCy + 8}" text-anchor="middle" font-family="${EXPORT_SANS}" font-size="22" font-weight="900" fill="${confColor}">${esc(managerLabel.trim().charAt(0).toUpperCase() || '?')}</text>`);
      }
      parts.push(`<text x="154" y="${y + 54}" font-family="${EXPORT_SERIF}" font-size="26" font-weight="700" fill="${COLORS.text}">${esc(truncate(managerLabel, LABEL_W - 172, `700 26px ${EXPORT_SERIF}`))}</text>`);

      weeks.forEach((week, weekIndex) => {
        const x = LABEL_W + weekIndex * WEEK_W;
        const data = gridCellData({ manager, conf, season, oppSeason, crossSchedule, week, latestCompletedWeek });
        let fill = rowFill;
        if (week === highlightWeek) fill = 'url(#highlight-bg)';
        else if (data.intraResult === 'W') fill = 'url(#win-bg)';
        else if (data.intraResult === 'L') fill = 'url(#loss-bg)';
        else if (week === currentWeek) fill = 'url(#current-bg)';
        parts.push(`<rect x="${x}" y="${y}" width="${WEEK_W}" height="${ROW_H}" fill="${fill}" stroke="${COLORS.border}" stroke-width="0.9"/>`);
        parts.push(`<rect x="${x}" y="${y}" width="${WEEK_W}" height="${ROW_H}" fill="url(#material-texture)"/>`);

        const intraName = truncate(displayName(data.intraOpponent, conf), WEEK_W - (data.intraResult ? 55 : 28), `700 23px ${EXPORT_SERIF}`);
        const interName = truncate(displayName(data.interOpponent, data.interConf), WEEK_W - (data.interResult ? 55 : 28), `650 21px ${EXPORT_SANS}`);
        if (data.intraResult) parts.push(`<text x="${x + 14}" y="${y + 35}" font-family="${EXPORT_SANS}" font-size="20" font-weight="900" fill="${resultColor(data.intraResult)}">${data.intraResult}</text>`);
        parts.push(`<text x="${x + (data.intraResult ? 47 : 14)}" y="${y + 35}" font-family="${EXPORT_SERIF}" font-size="23" font-weight="700" fill="${COLORS.text}">${esc(intraName)}</text>`);
        if (data.interResult) parts.push(`<text x="${x + 14}" y="${y + 70}" font-family="${EXPORT_SANS}" font-size="18" font-weight="900" fill="${resultColor(data.interResult)}">${data.interResult}</text>`);
        parts.push(`<text x="${x + (data.interResult ? 47 : 14)}" y="${y + 70}" font-family="${EXPORT_SANS}" font-size="21" font-weight="650" fill="${COLORS.muted}">${esc(interName)}</text>`);
      });
    });

    const gridTop = TITLE_H + HEADER_H;
    const conferenceDividerY = gridTop + afcManagers.length * ROW_H;
    parts.push(`<line x1="0" x2="${exportW}" y1="${gridTop}" y2="${gridTop}" stroke="${COLORS.border}" stroke-width="3"/>`);
    rows.forEach((_, rowIndex) => {
      const rowBottom = rowY(rowIndex) + ROW_H;
      parts.push(`<line x1="0" x2="${exportW}" y1="${rowBottom}" y2="${rowBottom}" stroke="${COLORS.border}" stroke-width="4"/>`);
    });
    if (hasDivider) {
      parts.push(`<rect x="0" y="${conferenceDividerY}" width="${exportW}" height="${CONF_DIVIDER_H}" fill="url(#schedule-accent)"/>`);
      parts.push(`<rect x="0" y="${conferenceDividerY}" width="${exportW}" height="${CONF_DIVIDER_H}" fill="url(#material-texture)"/>`);
      parts.push(`<line x1="0" x2="${exportW}" y1="${conferenceDividerY}" y2="${conferenceDividerY}" stroke="${COLORS.text}" stroke-opacity="0.55" stroke-width="3"/>`);
      parts.push(`<line x1="0" x2="${exportW}" y1="${conferenceDividerY + CONF_DIVIDER_H}" y2="${conferenceDividerY + CONF_DIVIDER_H}" stroke="${COLORS.text}" stroke-opacity="0.55" stroke-width="3"/>`);
    }

    const gridBottom = TITLE_H + HEADER_H + rows.length * ROW_H + dividerH;
    const notesY = gridBottom + 14;
    parts.push(`<rect x="22" y="${notesY}" width="${exportW - 44}" height="102" rx="16" fill="url(#notes-bg)" stroke="${COLORS.accent}" stroke-width="1.5"/>`);
    parts.push(`<rect x="22" y="${notesY}" width="${exportW - 44}" height="102" rx="16" fill="url(#material-texture)"/>`);
    parts.push(`<rect x="22" y="${notesY}" width="8" height="102" rx="4" fill="${COLORS.accent}"/>`);
    parts.push(`<text x="50" y="${notesY + 40}" font-family="${EXPORT_SANS}" font-size="18" font-weight="900" letter-spacing="1.5" fill="${COLORS.accent}">LEAGUE NOTES</text>`);
    parts.push(`<line x1="240" x2="240" y1="${notesY + 18}" y2="${notesY + 84}" stroke="${COLORS.border}" stroke-width="1.3"/>`);
    parts.push(`<text x="268" y="${notesY + 38}" font-family="${EXPORT_SANS}" font-size="21" font-weight="800" fill="${COLORS.text}">+2 standings pts for an in-conference win  •  +1 standings pt for a cross-conference win  •  Weekly high score: $15 or wine</text>`);
    parts.push(`<text x="268" y="${notesY + 75}" font-family="${EXPORT_SANS}" font-size="20" font-weight="650" fill="${COLORS.muted}">Playoffs begin Week 15: Top 5 by standings points + one highest-PF wildcard per conference  •  Everyone else dukes it out in the Toilet Bowl</text>`);

    const footerY = gridBottom + 145;
    parts.push(`<text x="${exportW / 2}" y="${footerY}" text-anchor="middle" font-family="${EXPORT_SANS}" font-size="19" font-weight="750" fill="${COLORS.muted}">W/L/T reflects posted results through Week ${latestCompletedWeek ?? 0}</text>`);
    parts.push('</svg>');
    return { svgText: parts.join(''), exportW, exportH, background: COLORS.bg };
  };

  const rasterizeExport = async ({ svgText, exportW, exportH, background }) => {
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      const scale = 1.5;
      canvas.width = exportW * scale;
      canvas.height = exportH * scale;
      const context = canvas.getContext('2d');
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const renderExportCanvas = async () => {
    const withLogos = await buildExportSvg(true);
    try {
      return await rasterizeExport(withLogos);
    } catch (error) {
      console.warn('Schedule export with logos failed to render, retrying with monograms:', error);
      return await rasterizeExport(await buildExportSvg(false));
    }
  };

  const downloadPng = async () => {
    setExporting(true);
    try {
      const canvas = await renderExportCanvas();
      const link = document.createElement('a');
      link.download = `lenzone-2026-${conference ? `${conference.toLowerCase()}-` : ''}schedule-${nameMode === 'managers' ? 'managers' : 'teams'}-${exportTheme}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Grid PNG export failed:', error);
      setDownloadState('error');
      setTimeout(() => setDownloadState('idle'), 2500);
    } finally {
      setExporting(false);
    }
  };

  const copyPng = async () => {
    setExporting(true);
    setCopyState('copying');
    try {
      const canvas = await renderExportCanvas();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (error) {
      console.error('Grid clipboard export failed:', error);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div data-mode={exportTheme} data-scheme={exportScheme} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3 flex-wrap">
          {conference && (
            <h3 className={`font-display text-lg font-bold ${CONF_STYLES[conference].text}`}>{conference} Schedule</h3>
          )}
          <p className="text-xs text-[var(--muted)]">Tap a cell for that matchup. Tap a week to highlight it.</p>
        </div>
        <ExportControls
          theme={exportTheme}
          onThemeChange={setExportTheme}
          onCopy={copyPng}
          onDownload={downloadPng}
          exporting={exporting}
          copyState={copyState}
          downloadState={downloadState}
        />
      </div>

      <div ref={scrollRef} className="schedule-grid-shell material-surface bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl overflow-auto scroll-thin max-h-[75vh] flex items-start">
        <table className="schedule-grid-table border-collapse text-xs">
          <thead>
            <tr>
              <th
                className={`schedule-grid-header ${TEAM_COL_CLASS} sticky top-0 left-0 z-30 bg-[var(--surface)] border-b border-r border-[var(--border)]/80 px-2 sm:px-3 py-2 text-left tracking-wider uppercase font-semibold text-[var(--muted)] overflow-hidden`}
              >
                {nameMode === 'managers' ? 'Manager' : 'Team'}
              </th>
              {weeks.map(w => {
                const isCurrent = w === currentWeek;
                const isHighlighted = w === highlightWeek;
                return (
                  <th
                    key={w}
                    data-week={w}
                    onClick={() => toggleHighlight(w)}
                    className={`schedule-grid-header schedule-week-header ${WEEK_COL_CLASS} ${isCurrent ? "is-current-week" : ""} sticky top-0 z-20 border-b px-2 py-2 font-bold whitespace-nowrap cursor-pointer select-none ${
                      isCurrent
                        ? "bg-[var(--accent)] text-[var(--accent-text)] border-[var(--accent)]"
                        : isHighlighted
                          ? "bg-[var(--surface)] text-[var(--coral)] border-[var(--border)]/80"
                          : "bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]/80 hover:text-[var(--text)]"
                    }`}
                    title={`Click to ${isHighlighted ? "clear" : "highlight"} Week ${w}`}
                  >
                    <div>Wk {w}{isCurrent ? " · This week" : ""}{isHighlighted ? " ●" : ""}</div>
                    {weekDateLabels[w] && <div className={`schedule-week-date text-[11px] font-semibold ${isCurrent ? '' : 'text-[var(--muted)]'}`}>{weekDateLabels[w]}</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ manager, conf }, rowIndex) => {
              const season = conf === 'AFC' ? afcSeason : nfcSeason;
              const oppSeason = conf === 'AFC' ? nfcSeason : afcSeason;
              return (
                <GridRow
                  key={`${conf}-${manager}`}
                  manager={manager} conf={conf} season={season} oppSeason={oppSeason} weeks={weeks}
                  crossSchedule={crossSchedule} currentWeek={currentWeek} highlightWeek={highlightWeek}
                  latestCompletedWeek={latestCompletedWeek}
                  displayName={displayName}
                  isConferenceStart={hasDivider && rowIndex === afcManagers.length}
                  showConfBadge={hasDivider}
                />
              );
            })}
          </tbody>
        </table>
        {/* Trailing spacer so ANY week column -- including the last -- can be scrolled well clear
            of the container's right edge, not just barely past it, giving plenty of room to pull a
            single week into isolated view. */}
        <div className="shrink-0" style={{ width: '60vw', minWidth: 320 }} aria-hidden="true" />
      </div>
    </div>
  );
}

// A sticky/frozen cell MUST have a fully opaque background -- unlike a normal in-flow cell, other
// columns' content scrolls right underneath it, and any translucency (even a light Tailwind /10
// tint) lets that scrolled content visibly ghost through blended with the frozen cell's own text.
// color-mix produces a genuinely opaque solid (no alpha channel) regardless of how faint the tint
// looks, which a Tailwind `bg-color/opacity` utility can't guarantee here.
function opaqueTint(pct) {
  return pct > 0 ? { backgroundColor: `color-mix(in srgb, var(--accent) ${pct}%, var(--surface))` } : { backgroundColor: 'var(--surface)' };
}

// W/L/T for `manager` in a given week against a given real opponent score, from that side's own
// season.scoreByWeek -- real posted scores only (no games played yet just reads as no result).
function resultFor(myScore, oppScore) {
  if (!(myScore > 0 && oppScore > 0)) return null;
  return myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
}
const RESULT_TEXT = { W: 'text-[var(--pos)]', L: 'text-[var(--neg)]', T: 'text-[var(--muted)]' };
const RESULT_BG = { W: 'bg-[var(--pos)]/10', L: 'bg-[var(--neg)]/10', T: '' };

function GridRow({ manager, conf, season, oppSeason, weeks, crossSchedule, currentWeek, highlightWeek, latestCompletedWeek, displayName, isConferenceStart, showConfBadge }) {
  const isMe = useIsMyTeam(manager);
  const { openPreview } = useMatchupPreview();
  return (
    <tr className={`schedule-grid-row ${isConferenceStart ? 'schedule-grid-conference-start' : ''} ${isMe ? "bg-[var(--accent)]/15 outline outline-2 -outline-offset-2 outline-[var(--accent)]" : "hover:bg-[var(--surface2)]/40"}`}>
      {/* width/maxWidth pinned via inline style AND overflow-hidden -- a plain `width` on a <td>
          is only a hint in the browser's auto table-layout; a long team name would otherwise grow
          this column past TEAM_COL_WIDTH. */}
      <td
        style={opaqueTint(isMe ? 28 : 0)}
        className={`schedule-grid-cell schedule-grid-manager-cell ${TEAM_COL_CLASS} sticky left-0 z-10 border-r border-b border-[var(--border)]/60 px-2 sm:px-3 py-1.5 overflow-hidden ${isMe ? "border-l-4 border-l-[var(--accent)]" : ""}`}
      >
        <div className="flex items-center gap-1 min-w-0">
          {isMe && <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent)] text-[var(--accent-text)] shrink-0">You</span>}
          {showConfBadge && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${CONF_STYLES[conf].badge}`}>{conf}</span>}
          <TeamName manager={manager} conf={conf} className="font-semibold min-w-0" />
        </div>
      </td>
      {weeks.map(w => {
        const isCurrent = w === currentWeek;
        const isHighlighted = w === highlightWeek;
        const { intraOpponent, interOpponent, intraResult, interResult, interConf } = gridCellData({
          manager, conf, season, oppSeason, crossSchedule, week: w, latestCompletedWeek
        });
        // A completed week's W/L tint takes priority visually over the plain highlight-week tint,
        // but only when there isn't already a highlight -- highlighting a week is a deliberate user
        // action ("show me week X specifically"), so it should still read clearly on top. The
        // current week gets a light accent tint of its own (not frozen/sticky -- just a normal
        // translucent tint, since nothing scrolls underneath a non-sticky cell).
        const resultBg = !isHighlighted && intraResult ? RESULT_BG[intraResult] : "";
        // The current week is a solid accent-edged column so it reads at a glance.
        const currentBg = isCurrent && !isHighlighted ? "bg-[var(--accent)]/20 border-x-2 border-x-[var(--accent)] font-bold" : "";
        const bgClass = `${isHighlighted ? "bg-[var(--coral)]/15" : ""} ${currentBg} ${isCurrent ? "" : resultBg}`;
        return (
          <td
            key={w}
            className={`schedule-grid-cell ${WEEK_COL_CLASS} border-b border-[var(--border)]/40 px-2 py-1.5 text-center cursor-pointer hover:bg-[var(--surface2)]/60 ${bgClass}`}
            onClick={() => openPreview(manager, conf, w)}
            title={`${displayName(manager, conf)} -- Week ${w}`}
          >
            <div className="truncate max-w-full font-semibold flex items-center justify-center gap-1">
              {intraResult && <span className={`text-xs font-black ${RESULT_TEXT[intraResult]}`}>{intraResult}</span>}
              <TeamMiniLogo manager={intraOpponent} size={16} />
              <span className="truncate">{displayName(intraOpponent, conf)}</span>
            </div>
            <div className="truncate max-w-full text-[var(--muted)] flex items-center justify-center gap-1">
              {interResult && <span className={`text-xs font-black ${RESULT_TEXT[interResult]}`}>{interResult}</span>}
              <TeamMiniLogo manager={interOpponent} size={14} className="opacity-80" />
              <span className="truncate">{displayName(interOpponent, interConf)}</span>
            </div>
          </td>
        );
      })}
    </tr>
  );
}
