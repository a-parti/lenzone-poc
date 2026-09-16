import React, { useState } from 'react';
import { useRosterModal } from '../context/RosterModalContext';
import { getRealName } from '../lib/realNames';

const HEIGHT = 380;
const MARGIN = { top: 40, right: 16, bottom: 130, left: 56 };
const MIN_BAR_W = 58;
const BAR_GAP = 10;
const GROUP_GAP = 30;
const LOGO_SIZE = 32;
const AFC_COLOR = "#f87171"; // matches WeeklyScoresBarChart's AFC_COLOR / CONF_STYLES.AFC.text
const NFC_COLOR = "#60a5fa"; // matches WeeklyScoresBarChart's NFC_COLOR / CONF_STYLES.NFC.text

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

// One bar per team, ranked (within its own conference) left to right, height = that team's
// average Points For -- the same rank/Standings Pts/PF-avg figures the Standings table above
// already computes (rankConference/buildConferenceList in statsMath.js), just laid out as a
// chart instead of rows. Respects whatever conference filter the Standings tab itself is set to:
// ALL shows both conferences as two separated groups (colored red/blue, same convention as the
// weekly scores chart), AFC/NFC shows just that one conference's own ranking.
export default function StandingsBarChart({ afcStandings, nfcStandings, confFilter, logoMap, afcData, nfcData }) {
  const [hovered, setHovered] = useState(null);
  const { openRoster } = useRosterModal();

  const groups = [];
  if (confFilter !== "NFC" && afcStandings?.length) groups.push({ conf: "AFC", rows: [...afcStandings].sort((a, b) => a.rank - b.rank) });
  if (confFilter !== "AFC" && nfcStandings?.length) groups.push({ conf: "NFC", rows: [...nfcStandings].sort((a, b) => a.rank - b.rank) });

  if (groups.length === 0 || groups.every(g => g.rows.length === 0)) return null;

  let x = MARGIN.left;
  const bars = [];
  groups.forEach((group, gi) => {
    if (gi > 0) x += GROUP_GAP;
    group.rows.forEach(row => {
      bars.push({ ...row, conf: group.conf, x });
      x += MIN_BAR_W + BAR_GAP;
    });
  });
  const plotW = x - BAR_GAP - MARGIN.left;
  const width = MARGIN.left + MARGIN.right + plotW;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const maxPf = Math.max(1, ...bars.map(b => b.pfAvg || 0));
  const { ticks, domainMax } = niceTicks(maxPf);
  const yFor = (v) => MARGIN.top + plotH - (v / domainMax) * plotH;

  return (
    <div className="material-surface bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-5">
      <p className="tracking-wide text-base font-bold text-[var(--text)] mb-3">
        Standings -- Ranked by Points, PF/Game{confFilter === "AFC" ? " (AFC)" : confFilter === "NFC" ? " (NFC)" : ""}
      </p>
      <div className="overflow-x-auto scroll-thin">
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} style={{ minWidth: '100%' }} role="img" aria-label="Standings ranked by points, PF per game">
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

          <defs>
            <linearGradient id="sbc-bar-sheen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.4} />
              <stop offset="55%" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>

          {bars.map(b => {
            const isHovered = hovered === b.manager;
            const isDimmed = hovered && !isHovered;
            const color = b.conf === "AFC" ? AFC_COLOR : NFC_COLOR;
            const barY = yFor(b.pfAvg || 0);
            const barHeight = MARGIN.top + plotH - barY;
            const logoUrl = logoMap?.[b.manager];
            const logoCy = barY + LOGO_SIZE / 2 + 6;
            const showLogo = logoUrl && barHeight >= LOGO_SIZE + 10;
            const clipId = `sbc-logo-${b.conf}-${b.manager.replace(/[^a-zA-Z0-9]/g, '')}`;
            const realName = getRealName(afcData, nfcData, b.manager);
            return (
              <g
                key={`${b.conf}-${b.manager}`}
                opacity={isDimmed ? 0.4 : 1}
                onMouseEnter={() => setHovered(b.manager)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => openRoster(b.manager, b.conf)}
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
                    team name as a smaller second line so a bar's still identifiable at a glance. */}
                <text
                  x={b.x + MIN_BAR_W / 2} y={MARGIN.top + plotH + 12} fontWeight={800}
                  fill={color} textAnchor="end" transform={`rotate(-40 ${b.x + MIN_BAR_W / 2} ${MARGIN.top + plotH + 12})`}
                >
                  <tspan x={b.x + MIN_BAR_W / 2} fontSize={13}>#{b.rank} ({b.totalPts.toFixed(1)})</tspan>
                  <tspan x={b.x + MIN_BAR_W / 2} dy="14" fontSize={11} fontWeight={600} fill="var(--text2)">{b.manager}</tspan>
                  {realName && <tspan x={b.x + MIN_BAR_W / 2} dy="13" fontSize={9} fontWeight={600} fill="var(--muted)">({realName})</tspan>}
                </text>
                <title>#{b.rank} {b.manager} ({b.conf}) -- {b.totalPts.toFixed(2)} standings pts, {(b.pfAvg || 0).toFixed(2)} PF/game</title>
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
