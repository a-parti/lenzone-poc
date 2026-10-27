// Generates the seasonal background scenes (one night + one day version per season) that
// index.css shows along the bottom of the page. Run from lenzone-react/:
//   node scripts/season-scenes.mjs
// Writes public/seasons/<season>-night.svg and <season>-day.svg. Every scene is a 1600x360
// silhouette strip anchored to the bottom edge; the moon, stars and snowfall come from CSS.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.argv[2] || 'public/seasons';
const W = 1600, H = 360;

// Deterministic randomness so re-running the script gives identical files.
let seed = 1;
const reseed = n => { seed = n; };
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const between = (a, b) => a + rand() * (b - a);
const pick = list => list[Math.floor(rand() * list.length)];
const r1 = n => Math.round(n * 10) / 10;

// A smooth hill line across the full width. Returns the filled path plus a height lookup so
// trees and buildings can sit on it.
function hills(y, amp, waves, phase) {
  const at = x => y + amp * (0.6 * Math.sin((x / W) * Math.PI * 2 * waves + phase) + 0.4 * Math.sin((x / W) * Math.PI * 2 * waves * 2.3 + phase * 1.7));
  const pts = [];
  for (let x = -40; x <= W + 40; x += 40) pts.push([x, at(x)]);
  let d = `M${pts[0][0]} ${r1(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, yy] = pts[i], [nx, ny] = pts[i + 1];
    d += ` Q${x} ${r1(yy)} ${r1((x + nx) / 2)} ${r1((yy + ny) / 2)}`;
  }
  d += ` L${W + 40} ${H} L-40 ${H} Z`;
  return { d, at };
}
const fillPath = (d, fill, extra = '') => `<path fill="${fill}" ${extra} d="${d}"/>`;

const glowDefs = (id, color, opacity) => `<radialGradient id="${id}">
      <stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>`;

// ---- Shapes --------------------------------------------------------------------------------

const pine = (x, base, h, fill, snow) => {
  const w = h * 0.5;
  let s = `<rect x="${r1(x - h * 0.03)}" y="${r1(base - h * 0.14)}" width="${r1(h * 0.06)}" height="${r1(h * 0.14)}" fill="${fill}"/>`;
  [[0.12, 1, 0.55], [0.35, 0.8, 0.75], [0.58, 0.58, 1]].forEach(([b, wf, t]) => {
    const yb = base - h * b, yt = base - h * t, hw = (w / 2) * wf;
    s += `<path fill="${fill}" d="M${r1(x - hw)} ${r1(yb)} L${r1(x)} ${r1(yt)} L${r1(x + hw)} ${r1(yb)} Z"/>`;
    if (snow) s += `<path fill="${snow}" d="M${r1(x - hw * 0.45)} ${r1(yt + (yb - yt) * 0.55)} L${r1(x)} ${r1(yt)} L${r1(x + hw * 0.45)} ${r1(yt + (yb - yt) * 0.55)} Q${r1(x)} ${r1(yt + (yb - yt) * 0.4)} ${r1(x - hw * 0.45)} ${r1(yt + (yb - yt) * 0.55)} Z"/>`;
  });
  return s;
};

const roundTree = (x, base, h, trunk, leaves) => {
  let s = `<path fill="${trunk}" d="M${r1(x - 4)} ${base} L${r1(x - 2)} ${r1(base - h * 0.55)} L${r1(x + 2)} ${r1(base - h * 0.55)} L${r1(x + 4)} ${base} Z"/>`;
  [[0, 0.72, 0.3], [-0.18, 0.6, 0.22], [0.2, 0.62, 0.22], [0.02, 0.9, 0.2]].forEach(([dx, dy, rr], i) => {
    s += `<circle cx="${r1(x + dx * h)}" cy="${r1(base - dy * h)}" r="${r1(rr * h)}" fill="${leaves[i % leaves.length]}"/>`;
  });
  return s;
};

const leaf = (x, y, r, rot, fill) =>
  `<path transform="translate(${r1(x)} ${r1(y)}) rotate(${Math.round(rot)})" fill="${fill}" d="M0 ${-r} C${r1(r * 0.8)} ${r1(-r * 0.4)} ${r1(r * 0.8)} ${r1(r * 0.4)} 0 ${r} C${r1(-r * 0.8)} ${r1(r * 0.4)} ${r1(-r * 0.8)} ${r1(-r * 0.4)} 0 ${-r} Z"/>`;

const haybale = (x, base, r, body, ring) =>
  `<g><rect x="${x - r * 1.1}" y="${base - r * 2}" width="${r * 1.6}" height="${r * 2}" rx="${r * 0.3}" fill="${body}"/>
    <circle cx="${x + r * 0.5}" cy="${base - r}" r="${r}" fill="${body}"/>
    <circle cx="${x + r * 0.5}" cy="${base - r}" r="${r * 0.62}" fill="none" stroke="${ring}" stroke-width="2"/>
    <circle cx="${x + r * 0.5}" cy="${base - r}" r="${r * 0.28}" fill="none" stroke="${ring}" stroke-width="2"/></g>`;

const cornstalk = (x, base, h, c) =>
  `<g fill="none" stroke="${c}" stroke-linecap="round">
    <path stroke-width="3" d="M${x} ${base} C${x + 2} ${base - h * 0.5} ${x - 2} ${base - h * 0.8} ${x + 3} ${base - h}"/>
    <path stroke-width="2.5" d="M${x} ${r1(base - h * 0.35)} C${x + 14} ${r1(base - h * 0.5)} ${x + 22} ${r1(base - h * 0.45)} ${x + 28} ${r1(base - h * 0.3)}"/>
    <path stroke-width="2.5" d="M${x} ${r1(base - h * 0.55)} C${x - 12} ${r1(base - h * 0.7)} ${x - 20} ${r1(base - h * 0.66)} ${x - 26} ${r1(base - h * 0.5)}"/>
    <path stroke-width="2" d="M${x + 1} ${r1(base - h * 0.75)} C${x + 10} ${r1(base - h * 0.88)} ${x + 16} ${r1(base - h * 0.86)} ${x + 20} ${r1(base - h * 0.76)}"/>
  </g>`;

const fence = (x1, x2, at, c) => {
  let s = `<g fill="${c}">`;
  for (let x = x1; x <= x2; x += 34) s += `<rect x="${x}" y="${r1(at(x) - 26)}" width="4" height="28"/>`;
  s += `</g><g fill="none" stroke="${c}" stroke-width="3">`;
  for (const off of [18, 8]) {
    let d = '';
    for (let x = x1; x <= x2 + 4; x += 17) d += `${d ? 'L' : 'M'}${x} ${r1(at(x) - off)} `;
    s += `<path d="${d}"/>`;
  }
  return s + '</g>';
};

// Gable house with lit windows; `snow` adds a white roof.
const house = (x, base, w, h, c, snow) => {
  const roofTop = base - h - w * 0.38;
  let s = `<g fill="${c.near}">
    <rect x="${x}" y="${base - h}" width="${w}" height="${h}"/>
    <path d="M${x - 10} ${base - h + 2} L${x + w / 2} ${roofTop} L${x + w + 10} ${base - h + 2} Z"/>
    <rect x="${x + w * 0.7}" y="${roofTop + 6}" width="12" height="${w * 0.3}"/>
  </g>`;
  if (snow) s += `<path fill="${snow}" d="M${x - 10} ${base - h + 2} L${x + w / 2} ${roofTop} L${x + w + 10} ${base - h + 2} L${x + w + 4} ${base - h + 7} L${x + w / 2} ${roofTop + 8} L${x - 4} ${base - h + 7} Z"/>`;
  s += `<circle cx="${x + w / 2}" cy="${base - h / 2}" r="${w * 0.45}" fill="url(#window)"/>
    <g fill="${c.window}">
      <rect x="${x + w * 0.15}" y="${base - h * 0.72}" width="${w * 0.16}" height="${h * 0.26}"/>
      <rect x="${x + w * 0.42}" y="${base - h * 0.72}" width="${w * 0.16}" height="${h * 0.26}" opacity="0.7"/>
      <rect x="${x + w * 0.69}" y="${base - h * 0.72}" width="${w * 0.16}" height="${h * 0.26}" opacity="0.85"/>
      <circle cx="${x + w / 2}" cy="${roofTop + (base - h - roofTop) * 0.55}" r="5" opacity="0.8"/>
    </g>`;
  return s;
};

const barn = (x, base, w, h, c) => `<g fill="${c.near}">
    <path d="M${x} ${base} L${x} ${base - h} L${x + w * 0.18} ${base - h - w * 0.22} L${x + w / 2} ${base - h - w * 0.36} L${x + w * 0.82} ${base - h - w * 0.22} L${x + w} ${base - h} L${x + w} ${base} Z"/>
    <rect x="${x + w * 0.38}" y="${base - h - w * 0.5}" width="${w * 0.24}" height="${w * 0.16}"/>
    <path d="M${x + w * 0.34} ${base - h - w * 0.48} L${x + w / 2} ${base - h - w * 0.6} L${x + w * 0.66} ${base - h - w * 0.48} Z"/>
  </g>
  <circle cx="${x + w / 2}" cy="${base - h * 0.4}" r="${w * 0.35}" fill="url(#window)"/>
  <rect x="${x + w * 0.44}" y="${base - h - w * 0.2}" width="${w * 0.12}" height="${w * 0.1}" fill="${c.window}" opacity="0.9"/>
  <path d="M${x + w * 0.3} ${base} L${x + w * 0.3} ${base - h * 0.62} L${x + w * 0.7} ${base - h * 0.62} L${x + w * 0.7} ${base} Z" fill="${c.window}" opacity="0.35"/>`;

const geese = (x, y, n, c) => {
  let s = `<g fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">`;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, k = Math.ceil(i / 2);
    const gx = x - k * 26, gy = y + side * k * 14;
    s += `<path d="M${gx - 8} ${gy - 3} Q${gx - 3} ${gy - 1} ${gx} ${gy + 2} Q${gx + 3} ${gy - 1} ${gx + 8} ${gy - 3}"/>`;
  }
  return s + '</g>';
};

const pumpkinPlain = (x, base, r, body, dark, stem) => `<g transform="translate(${x} ${base - r * 0.8})">
    <ellipse cx="${-r * 0.45}" rx="${r * 0.62}" ry="${r * 0.8}" fill="${dark}"/>
    <ellipse cx="${r * 0.45}" rx="${r * 0.62}" ry="${r * 0.8}" fill="${dark}"/>
    <ellipse rx="${r * 0.6}" ry="${r * 0.82}" fill="${body}"/>
    <rect x="-2" y="${-r * 1.05}" width="4" height="${r * 0.35}" rx="1.5" fill="${stem}"/>
  </g>`;

const starShape = (x, y, r, fill) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r;
    d += `${i ? 'L' : 'M'}${r1(x + rr * Math.cos(a))} ${r1(y + rr * Math.sin(a))} `;
  }
  return `<path fill="${fill}" d="${d}Z"/>`;
};

// A flag waving off a pole: seven stripes and a canton, all following the same ripple.
function flag(px, top, w, h, c) {
  const n = 7, sh = h / n;
  const dy = x => 7 * Math.sin((x / w) * Math.PI * 2.2) * (x / w);
  const band = (x0, x1, y0, y1) => {
    let d = '';
    for (let x = x0; x <= x1; x += 6) d += `${d ? 'L' : 'M'}${r1(px + x)} ${r1(top + y0 + dy(x))} `;
    for (let x = x1; x >= x0; x -= 6) d += `L${r1(px + x)} ${r1(top + y1 + dy(x))} `;
    return d + 'Z';
  };
  let s = `<rect x="${px - 3}" y="${top - 8}" width="5" height="${H}" fill="${c.near}"/><circle cx="${px - 0.5}" cy="${top - 10}" r="5" fill="${c.near}"/>`;
  for (let i = 0; i < n; i++) s += `<path fill="${i % 2 ? c.flagWhite : c.flagRed}" d="${band(0, w, i * sh, (i + 1) * sh + 0.5)}"/>`;
  const cw = w * 0.42, ch = sh * 4;
  s += `<path fill="${c.flagBlue}" d="${band(0, cw, 0, ch)}"/>`;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    const sx = cw * (0.16 + col * 0.23), sy = ch * (0.2 + row * 0.3);
    s += `<circle cx="${r1(px + sx)}" cy="${r1(top + sy + dy(sx))}" r="2" fill="${c.flagWhite}"/>`;
  }
  return s;
}

const smallFlag = (x, base, c) =>
  `<rect x="${x}" y="${base - 34}" width="2" height="34" fill="${c.near}"/>
  <path fill="${c.flagRed}" d="M${x + 2} ${base - 34} q8 3 16 0 v11 q-8 3 -16 0 Z"/>
  <path fill="${c.flagBlue}" d="M${x + 2} ${base - 34} q3.5 1.2 7 0.8 v6 q-3.5 0.4 -7 -0.8 Z"/>`;

// Football stadium seen from outside: bowl, light towers, and a glow over the field.
function stadium(x, base, w, h, c) {
  let s = `<ellipse cx="${x + w / 2}" cy="${base - h}" rx="${w * 0.7}" ry="${h * 0.9}" fill="url(#field)"/>`;
  s += `<path fill="${c.mid}" d="M${x} ${base} L${x + 26} ${base - h} Q${x + w / 2} ${base - h - 22} ${x + w - 26} ${base - h} L${x + w} ${base} Z"/>`;
  s += `<path fill="none" stroke="${c.rim}" stroke-width="3" d="M${x + 26} ${base - h} Q${x + w / 2} ${base - h - 22} ${x + w - 26} ${base - h}"/>`;
  for (let i = 1; i < 9; i++) {
    const tx = x + (w * i) / 9;
    s += `<rect x="${r1(tx - 1)}" y="${base - h + 8}" width="2" height="${h - 8}" fill="${c.rim}" opacity="0.35"/>`;
  }
  for (const tx of [x + 6, x + w - 10]) {
    s += `<rect x="${tx}" y="${base - h - 70}" width="4" height="${h + 70}" fill="${c.mid}"/>
      <circle cx="${tx + 2}" cy="${base - h - 74}" r="46" fill="url(#lamp)"/>
      <rect x="${tx - 14}" y="${base - h - 82}" width="32" height="14" rx="2" fill="${c.lamp}"/>`;
  }
  return s;
}

const goalpost = (x, base, h, color) => `<g fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round">
    <path d="M${x} ${base} L${x} ${base - h * 0.45} L${x + 10} ${base - h * 0.45}"/>
    <path d="M${x - 28} ${base - h * 0.45} L${x + 48} ${base - h * 0.45}"/>
    <path d="M${x - 28} ${base - h * 0.45} L${x - 28} ${base - h}"/>
    <path d="M${x + 48} ${base - h * 0.45} L${x + 48} ${base - h}"/>
  </g>`;

// Log cabin with a snowy roof, string lights along the eaves, a wreath and chimney smoke.
function cabin(x, base, w, h, c) {
  const roofTop = base - h - w * 0.4;
  let s = `<g fill="${c.smoke}" opacity="0.5">
      <circle cx="${x + w * 0.76}" cy="${roofTop - 6}" r="7"/><circle cx="${x + w * 0.8}" cy="${roofTop - 22}" r="10"/><circle cx="${x + w * 0.88}" cy="${roofTop - 42}" r="13" opacity="0.7"/>
    </g>
    <g fill="${c.near}">
      <rect x="${x}" y="${base - h}" width="${w}" height="${h}"/>
      <rect x="${x + w * 0.7}" y="${roofTop}" width="14" height="${w * 0.32}"/>
      <path d="M${x - 14} ${base - h + 3} L${x + w / 2} ${roofTop} L${x + w + 14} ${base - h + 3} Z"/>
    </g>
    <path fill="${c.snowCap}" d="M${x - 14} ${base - h + 3} L${x + w / 2} ${roofTop} L${x + w + 14} ${base - h + 3} L${x + w + 8} ${base - h + 9} L${x + w / 2} ${roofTop + 10} L${x - 8} ${base - h + 9} Z"/>
    <circle cx="${x + w / 2}" cy="${base - h / 2}" r="${w * 0.5}" fill="url(#window)"/>
    <g fill="${c.window}">
      <rect x="${x + w * 0.12}" y="${base - h * 0.7}" width="${w * 0.2}" height="${h * 0.3}"/>
      <rect x="${x + w * 0.68}" y="${base - h * 0.7}" width="${w * 0.2}" height="${h * 0.3}" opacity="0.85"/>
    </g>
    <rect x="${x + w * 0.41}" y="${base - h * 0.62}" width="${w * 0.18}" height="${h * 0.62}" fill="${c.door}"/>
    <circle cx="${x + w / 2}" cy="${base - h * 0.45}" r="7" fill="none" stroke="${c.wreath}" stroke-width="4"/>
    <circle cx="${x + w / 2}" cy="${base - h * 0.38}" r="2.2" fill="${c.bulbs[0]}"/>`;
  // String lights hang in shallow swags along both roof edges.
  const bulbs = [];
  const edge = (ax, ay, bx, by, n) => { for (let i = 0; i <= n; i++) { const t = i / n; bulbs.push([ax + (bx - ax) * t, ay + (by - ay) * t + 4 * Math.sin(t * Math.PI * n / 2) ** 2 + 6]); } };
  edge(x - 10, base - h + 6, x + w / 2, roofTop + 10, 7);
  edge(x + w / 2, roofTop + 10, x + w + 10, base - h + 6, 7);
  bulbs.forEach(([bx, by], i) => {
    const col = c.bulbs[i % c.bulbs.length];
    s += `<circle cx="${r1(bx)}" cy="${r1(by)}" r="7" fill="${col}" opacity="${c.bulbGlow}"/><circle cx="${r1(bx)}" cy="${r1(by)}" r="2.6" fill="${col}"/>`;
  });
  return s;
}

const decoratedTree = (x, base, h, c) => {
  let s = pine(x, base, h, c.near, c.snowCap);
  for (let i = 0; i < 12; i++) {
    const t = between(0.18, 0.88), hw = (h * 0.25) * (1 - t) * 0.95;
    s += `<circle cx="${r1(x + between(-hw, hw))}" cy="${r1(base - h * t)}" r="2.8" fill="${c.bulbs[i % c.bulbs.length]}"/>`;
  }
  return s + starShape(x, base - h - 2, 10, c.star);
};

function skyline(base, c) {
  let s = `<g fill="${c.near}">`, win = `<g fill="${c.window}">`;
  let x = -10;
  while (x < W + 10) {
    const bw = between(40, 110), bh = between(50, 190) * (Math.abs(x - W * 0.55) < 380 ? 1.25 : 0.8);
    s += `<rect x="${r1(x)}" y="${r1(base - bh)}" width="${r1(bw)}" height="${r1(bh + 60)}"/>`;
    if (bh > 170) s += `<rect x="${r1(x + bw / 2 - 1.5)}" y="${r1(base - bh - 30)}" width="3" height="30"/>`;
    for (let wy = base - bh + 10; wy < base - 12; wy += 14) for (let wx = x + 8; wx < x + bw - 10; wx += 13) {
      if (rand() < 0.28) win += `<rect x="${r1(wx)}" y="${r1(wy)}" width="5" height="6" opacity="${r1(between(0.35, 0.9))}"/>`;
    }
    x += bw + between(0, 6);
  }
  return s + '</g>' + win + '</g>';
}

const firework = (x, y, r, color) => {
  let s = `<g stroke="${color}" stroke-linecap="round" fill="${color}">`;
  const n = 20;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x1 = x + Math.cos(a) * r * 0.3, y1 = y + Math.sin(a) * r * 0.3;
    const x2 = x + Math.cos(a) * r, y2 = y + Math.sin(a) * r * 0.95 + r * 0.06;
    s += `<path stroke-width="2" opacity="0.85" d="M${r1(x1)} ${r1(y1)} L${r1(x2)} ${r1(y2)}"/><circle cx="${r1(x2)}" cy="${r1(y2)}" r="2.4" stroke="none"/>`;
  }
  return s + `<circle cx="${x}" cy="${y}" r="${r1(r * 0.12)}" stroke="none" opacity="0.9"/></g>`;
};

// Confetti, each piece tilted around its own center.
const confettiPieces = (n, colors, yMax) => {
  let s = '<g opacity="0.85">';
  for (let i = 0; i < n; i++) {
    const x = r1(between(0, W)), y = r1(between(10, yMax));
    s += `<rect x="${x - 3.5}" y="${y - 1.5}" width="7" height="3" rx="1" fill="${pick(colors)}" transform="rotate(${Math.round(between(0, 180))} ${x} ${y})"/>`;
  }
  return s + '</g>';
};

// ---- Halloween (unchanged from the original scene) ------------------------------------------

const bat = (x, y, s, rot = 0) =>
  `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M-20 0 C-15 -8 -9 -7 -6 -2 C-4 -5 -2 -6 -1 -4 L0 -6 L1 -4 C2 -6 4 -5 6 -2 C9 -7 15 -8 20 0 C15 -3 11 -1 9 4 C6 1 3 2 0 5 C-3 2 -6 1 -9 4 C-11 -1 -15 -3 -20 0 Z"/>`;
const bareTree = (x, base, h, flip = 1) => {
  const f = n => x + n * flip;
  return `<path d="M${f(-7)} ${base} C${f(-5)} ${base - h * 0.4} ${f(-8)} ${base - h * 0.7} ${f(-2)} ${base - h} L${f(2)} ${base - h} C${f(4)} ${base - h * 0.7} ${f(6)} ${base - h * 0.4} ${f(8)} ${base} Z"/>
    <g fill="none" stroke-linecap="round">
      <path stroke-width="5" d="M${f(0)} ${base - h * 0.55} C${f(-18)} ${base - h * 0.65} ${f(-30)} ${base - h * 0.8} ${f(-48)} ${base - h * 0.95}"/>
      <path stroke-width="3" d="M${f(-30)} ${base - h * 0.8} C${f(-36)} ${base - h * 0.95} ${f(-34)} ${base - h * 1.05} ${f(-40)} ${base - h * 1.15}"/>
      <path stroke-width="2" d="M${f(-48)} ${base - h * 0.95} L${f(-62)} ${base - h * 0.98}"/>
      <path stroke-width="5" d="M${f(1)} ${base - h * 0.7} C${f(18)} ${base - h * 0.8} ${f(28)} ${base - h * 0.9} ${f(44)} ${base - h * 1.08}"/>
      <path stroke-width="3" d="M${f(28)} ${base - h * 0.9} C${f(40)} ${base - h * 0.9} ${f(50)} ${base - h * 0.86} ${f(60)} ${base - h * 0.9}"/>
      <path stroke-width="2" d="M${f(44)} ${base - h * 1.08} L${f(50)} ${base - h * 1.2}"/>
      <path stroke-width="3" d="M${f(0)} ${base - h * 0.98} C${f(-4)} ${base - h * 1.1} ${f(4)} ${base - h * 1.2} ${f(-2)} ${base - h * 1.3}"/>
    </g>`;
};
const grave = (x, base, w, h) => `<path d="M${x} ${base} v-${h - w / 2} a${w / 2} ${w / 2} 0 0 1 ${w} 0 v${h - w / 2} Z"/>`;
const cross = (x, base, h) => `<rect x="${x - 2.5}" y="${base - h}" width="5" height="${h}"/><rect x="${x - 9}" y="${base - h * 0.75}" width="18" height="5"/>`;
const jackOLantern = (x, base, r, c) => `
  <g transform="translate(${x} ${base - r * 0.8})">
    <circle r="${r * 2.6}" fill="url(#glow)"/>
    <ellipse cx="${-r * 0.45}" rx="${r * 0.62}" ry="${r * 0.8}" fill="${c.pumpkinDark}"/>
    <ellipse cx="${r * 0.45}" rx="${r * 0.62}" ry="${r * 0.8}" fill="${c.pumpkinDark}"/>
    <ellipse rx="${r * 0.6}" ry="${r * 0.82}" fill="${c.pumpkin}"/>
    <rect x="-2" y="${-r * 1.05}" width="4" height="${r * 0.35}" rx="1.5" fill="${c.stem}"/>
    <path fill="${c.face}" d="M${-r * 0.5} ${-r * 0.15} l${r * 0.18} ${-r * 0.28} l${r * 0.18} ${r * 0.28} Z M${r * 0.14} ${-r * 0.15} l${r * 0.18} ${-r * 0.28} l${r * 0.18} ${r * 0.28} Z M${-r * 0.55} ${r * 0.18} q${r * 0.55} ${r * 0.5} ${r * 1.1} 0 l${-r * 0.2} ${r * 0.08} l${-r * 0.12} ${-r * 0.1} l${-r * 0.14} ${r * 0.12} l${-r * 0.14} ${-r * 0.12} l${-r * 0.12} ${r * 0.1} Z"/>
  </g>`;

function halloween(c) {
  return `<g fill="${c.bat}" opacity="${c.batOpacity}">
    ${bat(980, 70, 1.1, -8)}${bat(1060, 40, 0.8, 6)}${bat(1395, 95, 0.9, -4)}${bat(1330, 52, 0.6, 10)}${bat(260, 80, 0.75, 8)}${bat(330, 118, 0.55, -6)}
  </g>
  <path fill="${c.far}" d="M0 270 C160 238 300 262 460 246 C620 230 760 252 900 236 C1040 220 1160 214 1280 226 C1420 240 1520 228 1600 236 L1600 360 L0 360 Z"/>
  <g fill="${c.near}">
    <rect x="1094" y="170" width="120" height="70"/>
    <path d="M1082 172 L1154 118 L1226 172 Z"/>
    <rect x="1120" y="128" width="12" height="30"/>
    <rect x="1206" y="120" width="40" height="120"/>
    <path d="M1199 122 L1226 64 L1253 122 Z"/>
    <rect x="1225" y="54" width="2" height="12"/>
    <rect x="1060" y="200" width="40" height="40"/>
    <path d="M1054 202 L1080 182 L1106 202 Z"/>
  </g>
  <g>
    <circle cx="1226" cy="150" r="34" fill="url(#window)"/>
    <circle cx="1130" cy="200" r="40" fill="url(#window)"/>
    <g fill="${c.window}">
      <path d="M1218 160 v-12 a8 8 0 0 1 16 0 v12 Z"/>
      <rect x="1110" y="186" width="14" height="18"/><rect x="1136" y="186" width="14" height="18" opacity="0.55"/>
      <rect x="1170" y="186" width="14" height="18" opacity="0.8"/>
      <rect x="1218" y="190" width="16" height="14" opacity="0.6"/>
      <circle cx="1154" cy="152" r="6" opacity="0.85"/>
    </g>
  </g>
  <g fill="${c.near}" stroke="${c.near}">
    ${bareTree(150, 300, 150, 1)}
    ${bareTree(1475, 300, 170, -1)}
    ${bareTree(860, 286, 80, 1)}
  </g>
  <path fill="${c.near}" d="M0 300 C180 284 360 300 540 292 C720 284 900 300 1080 292 C1260 284 1420 298 1600 290 L1600 360 L0 360 Z"/>
  <g fill="${c.near}">
    ${grave(330, 300, 26, 40)}${grave(372, 298, 20, 30)}${cross(420, 298, 38)}${grave(448, 299, 24, 34)}
    ${cross(1340, 296, 32)}${grave(1362, 296, 20, 28)}
  </g>
  <path fill="${c.ground}" d="M0 330 C240 318 520 332 800 324 C1080 316 1340 330 1600 322 L1600 360 L0 360 Z"/>
  ${jackOLantern(560, 304, 17, c)}${jackOLantern(600, 308, 11, c)}${jackOLantern(1010, 302, 14, c)}${jackOLantern(1290, 300, 12, c)}`;
}

// ---- Seasons --------------------------------------------------------------------------------

function harvest(c) {
  reseed(11);
  const far = hills(250, 14, 1.3, 0.4), mid = hills(282, 10, 2.1, 2.2), near = hills(312, 7, 1.7, 1.1);
  let s = fillPath(far.d, c.far);
  for (let x = 40; x < W; x += between(46, 90)) {
    if (x > 1060 && x < 1260) continue;
    s += roundTree(x, mid.at(x) + 6, between(40, 70), c.mid, c.leaves);
  }
  s += barn(1120, far.at(1160) + 6, 110, 52, c);
  s += fillPath(mid.d, c.mid);
  s += fillPath(near.d, c.near);
  for (let x = 30; x < 470; x += 24) s += cornstalk(x, near.at(x) + 4, between(56, 78), c.stalk);
  s += haybale(1290, near.at(1290) + 4, 17, c.hay, c.hayRing) + haybale(1350, near.at(1350) + 5, 13, c.hay, c.hayRing) + haybale(1395, near.at(1395) + 5, 15, c.hay, c.hayRing);
  s += pumpkinPlain(760, near.at(760) + 3, 14, c.pumpkin, c.pumpkinDark, c.stalk) + pumpkinPlain(792, near.at(792) + 4, 9, c.pumpkin, c.pumpkinDark, c.stalk);
  for (let i = 0; i < 26; i++) s += leaf(between(0, W), between(30, 230), between(4, 7), between(0, 360), pick(c.leaves));
  return { defs: glowDefs('window', c.window, 0.5), body: s };
}

function salute(c) {
  reseed(23);
  const far = hills(256, 12, 1.1, 1.4), near = hills(306, 8, 1.6, 0.3);
  let s = fillPath(far.d, c.far);
  for (let x = 980; x < 1480; x += between(30, 55)) s += pine(x, far.at(x) + 8, between(40, 64), c.mid);
  s += fillPath(near.d, c.near);
  s += flag(1170, 92, 170, 98, c);
  for (let x = 140; x < 620; x += 38) s += smallFlag(x, near.at(x) + 6, c);
  s += starShape(860, 70, 6, c.flagWhite) + starShape(905, 104, 4, c.flagWhite) + starShape(820, 118, 3.5, c.flagWhite);
  return { defs: '', body: s };
}

function thanksgiving(c) {
  reseed(37);
  const far = hills(252, 14, 1.2, 2.6), mid = hills(286, 9, 1.9, 0.6), near = hills(314, 6, 1.4, 2.0);
  let s = geese(520, 80, 9, c.goose);
  s += fillPath(far.d, c.far);
  s += house(1000, far.at(1050) + 10, 100, 56, c) + barn(1150, far.at(1200) + 8, 96, 46, c);
  for (const x of [880, 1300, 1360]) s += roundTree(x, far.at(x) + 8, between(60, 80), c.mid, c.leaves);
  s += fillPath(mid.d, c.mid);
  s += fillPath(near.d, c.near);
  s += fence(80, 620, x => near.at(x) + 4, c.fence);
  s += pumpkinPlain(760, near.at(760) + 3, 18, c.pumpkin, c.pumpkinDark, c.stem) + pumpkinPlain(800, near.at(800) + 4, 11, c.gourd, c.gourdDark, c.stem) + pumpkinPlain(826, near.at(826) + 4, 8, c.pumpkin, c.pumpkinDark, c.stem);
  s += haybale(1420, near.at(1420) + 4, 15, c.hay, c.hayRing);
  for (let i = 0; i < 12; i++) s += leaf(between(700, W), between(40, 200), between(4, 6), between(0, 360), pick(c.leaves));
  return { defs: glowDefs('window', c.window, 0.5), body: s };
}

function frost(c) {
  reseed(41);
  let mtn = 'M-40 360 L-40 240 ';
  const peaks = [[120, 168], [300, 214], [470, 150], [660, 206], [900, 176], [1120, 196], [1330, 148], [1520, 200], [1660, 230]];
  let prev = [-40, 240];
  peaks.forEach(([px, py]) => { const vx = (prev[0] + px) / 2, vy = Math.max(prev[1], py) + 40; mtn += `L${vx} ${vy} L${px} ${py} `; prev = [px, py]; });
  mtn += 'L1660 360 Z';
  let s = fillPath(mtn, c.far);
  peaks.forEach(([px, py]) => { s += `<path fill="${c.snowCap}" opacity="0.8" d="M${px - 26} ${py + 30} L${px} ${py} L${px + 26} ${py + 30} L${px + 12} ${py + 24} L${px + 2} ${py + 32} L${px - 10} ${py + 24} Z"/>`; });
  const mid = hills(276, 10, 1.6, 0.9), near = hills(312, 6, 1.3, 2.4);
  for (let x = 0; x < W; x += between(22, 40)) s += pine(x, mid.at(x) + 10, between(46, 86), c.mid, c.snowCap);
  s += fillPath(mid.d, c.midGround);
  s += `<ellipse cx="760" cy="${near.at(760) - 4}" rx="190" ry="16" fill="${c.ice}"/>`;
  s += `<g stroke="${c.iceLine}" stroke-width="2" stroke-linecap="round" opacity="0.7"><path d="M640 ${near.at(760) - 6} h80"/><path d="M760 ${near.at(760) - 1} h110"/><path d="M700 ${near.at(760) + 4} h50"/></g>`;
  s += fillPath(near.d, c.ground, `fill-rule="evenodd"`);
  s += `<ellipse cx="760" cy="${near.at(760) + 2}" rx="170" ry="9" fill="${c.ice}"/>`;
  for (const x of [80, 130, 1420, 1490, 1545]) s += pine(x, near.at(x) + 6, between(90, 130), c.near, c.snowCap);
  return { defs: '', body: s };
}

function snowgame(c) {
  reseed(53);
  const far = hills(262, 10, 1.2, 0.2), near = hills(312, 6, 1.5, 1.6);
  let s = fillPath(far.d, c.far);
  for (let x = 0; x < W; x += between(28, 48)) if (x < 760 || x > 1420) s += pine(x, far.at(x) + 8, between(40, 70), c.mid, c.snowCap);
  s += stadium(820, far.at(1100) + 12, 560, 82, c);
  s += fillPath(near.d, c.ground);
  s += goalpost(300, near.at(300) + 2, 120, c.post);
  s += `<g stroke="${c.yard}" stroke-width="3" opacity="0.5">${[180, 240, 360, 420].map(x => `<path d="M${x} ${r1(near.at(x) + 10)} l-18 26"/>`).join('')}</g>`;
  for (const x of [40, 95, 1500, 1556]) s += pine(x, near.at(x) + 6, between(100, 130), c.near, c.snowCap);
  return { defs: glowDefs('lamp', c.lampGlow, c.lampGlowOpacity) + glowDefs('field', c.fieldGlow, c.fieldGlowOpacity), body: s };
}

function holiday(c) {
  reseed(67);
  const far = hills(258, 12, 1.4, 1.9), mid = hills(290, 8, 1.8, 0.2), near = hills(316, 5, 1.2, 1.2);
  let s = fillPath(far.d, c.far);
  for (let x = 0; x < W; x += between(26, 44)) if (x < 960 || x > 1340) s += pine(x, far.at(x) + 8, between(44, 76), c.mid, c.snowCap);
  s += fillPath(mid.d, c.midGround);
  s += cabin(1060, mid.at(1110) + 6, 120, 62, c);
  s += decoratedTree(1250, mid.at(1250) + 6, 96, c);
  s += fillPath(near.d, c.ground);
  for (const x of [60, 120, 470, 1460, 1530]) s += pine(x, near.at(x) + 6, between(96, 130), c.near, c.snowCap);
  [[680, 'red'], [716, 'gold'], [700, 'green']].forEach(([x, k], i) => {
    const gx = x, gy = near.at(x) + 4, sz = 24 - i * 4;
    s += `<rect x="${gx - sz / 2}" y="${gy - sz}" width="${sz}" height="${sz}" rx="2" fill="${c.gifts[k]}"/><rect x="${gx - 2}" y="${gy - sz}" width="4" height="${sz}" fill="${c.ribbon}"/>`;
  });
  return { defs: glowDefs('window', c.window, 0.55), body: s };
}

function newyear(c) {
  reseed(79);
  let s = '';
  [[260, 90, 54, c.fw[0]], [520, 52, 40, c.fw[1]], [980, 76, 62, c.fw[2]], [1260, 46, 44, c.fw[0]], [1460, 104, 50, c.fw[1]], [740, 128, 30, c.fw[2]]]
    .forEach(([x, y, r, col]) => { s += `<circle cx="${x}" cy="${y}" r="${r * 1.5}" fill="${col}" opacity="${c.burstHalo}"/>` + firework(x, y, r, col); });
  s += confettiPieces(46, c.fw, 230);
  s += skyline(312, c);
  s += fillPath(hills(318, 3, 1, 0).d, c.ground);
  return { defs: '', body: s };
}

const SCENES = {
  halloween: {
    draw: halloween,
    defs: c => glowDefs('glow', c.glow, c.glowOpacity) + glowDefs('window', c.window, 0.55),
    night: { far: '#1A1030', near: '#0C0816', ground: '#07040D', bat: '#05030A', batOpacity: 0.9, window: '#FFB547', glow: '#FF8C2B', glowOpacity: 0.45, pumpkin: '#FF8C2B', pumpkinDark: '#D9650F', stem: '#3D5A2A', face: '#FFE08A' },
    day: { far: '#8E6A8C', near: '#4A2C4E', ground: '#3A2240', bat: '#3A2240', batOpacity: 0.85, window: '#FFC15A', glow: '#FF9A3D', glowOpacity: 0.3, pumpkin: '#F07B1C', pumpkinDark: '#C85E0E', stem: '#4E6A2E', face: '#FFE6A3' }
  },
  harvest: {
    draw: harvest,
    night: { far: '#2A1C14', mid: '#1C130D', near: '#120C08', window: '#FFB547', leaves: ['#B5531A', '#C98A1E', '#8A3A14', '#9A7A22'], stalk: '#3A2A16', hay: '#4A3618', hayRing: '#2E2010', pumpkin: '#D9651A', pumpkinDark: '#A84A10' },
    day: { far: '#D9B98C', mid: '#A9794A', near: '#6E4A2A', window: '#FFD27A', leaves: ['#D2691E', '#E0A93B', '#B5421A', '#A8A23A'], stalk: '#8A6A2E', hay: '#D9AE5A', hayRing: '#A87E34', pumpkin: '#E87A1E', pumpkinDark: '#C25E10' }
  },
  salute: {
    draw: salute,
    night: { far: '#141C2E', mid: '#0E1524', near: '#090E18', flagRed: '#A8323E', flagWhite: '#E6E9F0', flagBlue: '#2A3F78' },
    day: { far: '#B9C2B0', mid: '#7E8C6E', near: '#4E5A40', flagRed: '#B22234', flagWhite: '#FFFFFF', flagBlue: '#2B3F7A' }
  },
  thanksgiving: {
    draw: thanksgiving,
    night: { far: '#26141F', mid: '#1B0E17', near: '#12090F', window: '#FFB547', goose: '#3A2433', fence: '#2A1822', leaves: ['#A8283F', '#C98A1E', '#8A3A14'], pumpkin: '#D9651A', pumpkinDark: '#A84A10', gourd: '#C9A23A', gourdDark: '#9A7A22', stem: '#3D5A2A', hay: '#3E2A1A', hayRing: '#2A1C12' },
    day: { far: '#D8B8A8', mid: '#A8786E', near: '#6E4450', window: '#FFD27A', goose: '#6E4450', fence: '#5A3640', leaves: ['#C2334D', '#E0A93B', '#B5531A'], pumpkin: '#E87A1E', pumpkinDark: '#C25E10', gourd: '#E8C25B', gourdDark: '#C49A2E', stem: '#4E6A2E', hay: '#D9AE5A', hayRing: '#A87E34' }
  },
  frost: {
    draw: frost,
    night: { far: '#16233A', mid: '#0F1A2C', midGround: '#1A2840', near: '#0A1220', ground: '#22324C', snowCap: '#C9D8EE', ice: '#2E4466', iceLine: '#8FB0D8' },
    day: { far: '#C9D6E6', mid: '#3E5A6E', midGround: '#E4ECF4', near: '#2E4A5E', ground: '#F4F8FC', snowCap: '#FFFFFF', ice: '#BFD6EC', iceLine: '#FFFFFF' }
  },
  snowgame: {
    draw: snowgame,
    night: { far: '#14202A', mid: '#0D161E', near: '#0A1218', ground: '#1E2C38', snowCap: '#C9D8EE', rim: '#3A5468', lamp: '#FFF4D6', lampGlow: '#FFE9B0', lampGlowOpacity: 0.55, fieldGlow: '#BFF5D5', fieldGlowOpacity: 0.22, post: '#E8C25B', yard: '#C9D8EE' },
    day: { far: '#C9D6DE', mid: '#4A6070', near: '#2E4452', ground: '#F4F8FA', snowCap: '#FFFFFF', rim: '#8AA2B2', lamp: '#FFFFFF', lampGlow: '#FFFFFF', lampGlowOpacity: 0.5, fieldGlow: '#FFFFFF', fieldGlowOpacity: 0.3, post: '#D9A21A', yard: '#9FB4C4' }
  },
  holiday: {
    draw: holiday,
    night: { far: '#13261C', mid: '#0C1A13', midGround: '#1C2E26', near: '#08120D', ground: '#24382E', snowCap: '#D8E6DE', smoke: '#5A6E64', window: '#FFC15A', door: '#2A1A10', wreath: '#3E8A5A', bulbs: ['#FF5E5E', '#FFD166', '#6FD39A', '#7CC4FF'], bulbGlow: 0.35, star: '#FFD166', gifts: { red: '#C2333E', gold: '#C9A23A', green: '#2E7A50' }, ribbon: '#F2E6C8' },
    day: { far: '#C9D8CE', mid: '#2E5A40', midGround: '#EEF3EF', near: '#1F4A33', ground: '#FAFCFA', snowCap: '#FFFFFF', smoke: '#B8C4BE', window: '#FFD27A', door: '#6E3A1E', wreath: '#1F6B45', bulbs: ['#D62E3A', '#E8A81E', '#1F8A50', '#2F7AC2'], bulbGlow: 0.25, star: '#E8A81E', gifts: { red: '#C2333E', gold: '#D9AE3A', green: '#1F6B45' }, ribbon: '#FFFFFF' }
  },
  newyear: {
    draw: newyear,
    night: { near: '#0B0B10', ground: '#060609', window: '#E6C46A', fw: ['#E6C46A', '#D8DEE8', '#F28CA0'], burstHalo: 0.06 },
    day: { near: '#4A4A55', ground: '#3A3A44', window: '#FFE7A8', fw: ['#C9A23A', '#7A8496', '#D4607A'], burstHalo: 0.05 }
  }
};

mkdirSync(OUT, { recursive: true });
for (const [name, scene] of Object.entries(SCENES)) {
  for (const variant of ['night', 'day']) {
    const c = scene[variant];
    const { defs, body } = scene.defs ? { defs: scene.defs(c), body: scene.draw(c) } : scene.draw(c);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">
  <!-- LENZONE ${name} scene (${variant}). Stylized and decorative. Generated by scripts/season-scenes.mjs. -->
  <defs>${defs}</defs>
  ${body}
</svg>
`;
    writeFileSync(`${OUT}/${name}-${variant}.svg`, svg);
  }
}
console.log(`wrote ${Object.keys(SCENES).length * 2} scenes to ${OUT}`);
