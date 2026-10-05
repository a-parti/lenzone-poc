// The meme board: for each thing that happened this week (top score, a starter who laid an egg, a
// bench player who outscored the lineup, a blowout, ...) a set of jokes written from the week's real
// numbers and players. A joke has a "shape" (what kind of joke it is: rejects A for B, a dilemma, a
// trade offer, unbothered while it burns, ...) and is paired with every meme template whose format
// means that (see memeTemplates.js), so each situation has plenty of memes that actually fit.
// Nothing here is invented: a situation with no real data behind it is skipped, and every card
// carries a plain-English line with the real facts behind the joke.
import { computeWorstLineupDecision, playerLabel } from './players';
import { GIF_QUERIES } from './gifQueries';
import { TEMPLATES } from './memeTemplates';

function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}
export const pickIndex = (week, key, count) => (count ? hash(`${week}|${key}`) % count : 0);

// Seeded shuffle: random-looking, but the same week always gives the same order.
export function seededShuffle(list, seedText) {
  let h = hash(seedText);
  const rand = () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const pts = (n) => n.toFixed(1);
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

// Jokes. `macro` is a classic top/bottom caption for any template with that mood; `pin` ties a
// caption to one template whose own catchphrase it uses; `j` is any other shape (texts in the order
// memeTemplates.js lists for that shape).
const macro = (mood, top, bottom, extra = {}) => ({ shape: 'macro', mood, texts: [top, bottom], ...extra });
const pin = (template, top, bottom, extra = {}) => ({ shape: 'macro', template, texts: [top, bottom], ...extra });
const j = (shape, ...texts) => ({ shape, texts });

// Every template a joke fits.
function expand(joke) {
  if (joke.template) return TEMPLATES[joke.template] ? [joke] : [];
  return Object.entries(TEMPLATES)
    .filter(([, t]) => t.shape === joke.shape && (joke.shape !== 'macro' || t.mood === joke.mood))
    .map(([template]) => ({ ...joke, template }));
}

export function buildMemeBoard({
  week, weekRows, weeklyAwards, pregameScores, afcData, nfcData, afcSeason, nfcSeason, playersDB,
  recapTransactions, waiverWireMvp, standingsHistory, luck, playerHighlights, live = false
}) {
  // live: the week is still being played. Only stories that can't flip as games finish are kept
  // (someone who hasn't played yet shows 0, so lows, duds and results wait for the final), and
  // every fact line says "So far".
  const rows = (weekRows || []).filter(r => Number.isFinite(r.score));
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const med = median(rows.map(r => r.score));
  const rankOf = (m) => sorted.findIndex(r => r.manager === m) + 1;
  const wins = (r) => [r.intraOppScore, r.crossOppScore].filter(x => x != null && r.score > x).length;
  const games = (r) => [r.intraOppScore, r.crossOppScore].filter(x => x != null).length;
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  const situations = [];
  // gifQueries: Giphy searches for this situation (used only when an admin saves the week's GIFs).
  // gifFirst: always try the first query (a player's name) before the generic ones.
  const add = (key, label, manager, fact, jokes, gifQueries, extra = {}) => {
    const seen = new Set();
    const variants = jokes.flatMap(expand).filter(vr => {
      const id = `${vr.template}|${vr.texts.join('|')}`;
      return !seen.has(id) && seen.add(id);
    });
    // The team's logo with classic captions, for a change from the templates now and then.
    const logos = jokes.filter(jk => jk.shape === 'macro').slice(0, 2).map(jk => ({ ...jk, template: null, logo: true }));
    if (variants.length) situations.push({ key, label, manager, fact, variants: seededShuffle([...variants, ...logos], `${week}|${key}`), gifQueries, ...extra });
  };

  // Each team's real lineup this week, from Sleeper's matchup snapshot: starters with their points,
  // and every rostered player's points (so bench players too). Players without a real name are left
  // out rather than shown as an ID.
  const nameOf = (id) => {
    const p = playerLabel(playersDB || {}, id);
    return p.name && !p.name.startsWith('Player ') && p.name !== id ? p : null;
  };
  const lineups = [afcSeason, nfcSeason].flatMap(season => Object.entries(season?.rosterSnapshotByWeek?.[week] || {}))
    .filter(([manager]) => rows.some(r => r.manager === manager))
    .map(([manager, snap]) => {
      const starters = (snap?.starters || []).map((id, i) => ({ id, pts: snap.startersPoints?.[i] }))
        .filter(s => s.id && s.id !== '0' && Number.isFinite(s.pts) && nameOf(s.id))
        .map(s => ({ ...s, ...nameOf(s.id) }));
      const startIds = new Set(snap?.starters || []);
      const bench = Object.entries(snap?.playersPoints || {})
        .filter(([id, p]) => !startIds.has(id) && Number.isFinite(p) && nameOf(id))
        .map(([id, p]) => ({ id, pts: p, ...nameOf(id) }));
      const total = starters.reduce((sum, s) => sum + s.pts, 0);
      const benchTotal = bench.reduce((sum, s) => sum + s.pts, 0);
      const byPts = [...starters].sort((a, b) => b.pts - a.pts);
      return { manager, starters, bench, total, benchTotal, best: byPts[0] || null, worstStarter: byPts[byPts.length - 1] || null };
    });
  const lineupOf = (manager) => lineups.find(l => l.manager === manager);
  const N = (p) => p.name;
  const search = (p, more = '') => `${p.name} ${more}`.trim();

  // ---- Top score ------------------------------------------------------------------------------
  {
    const T = top.manager, s = pts(top.score), mvp = lineupOf(T)?.best;
    add('top', 'Top Score', T, `${T} scored ${s}, the most in Week ${week} (league median ${pts(med)}).`, [
      macro('triumph', `Cheers to ${T}`, `${s} points in Week ${week}`),
      pin('Oprah You Get A', `You get ${s} points`, `And you get ${pts(top.score - med)} over the median`),
      pin("I'm The Captain Now", T, `${s} points. I'm the captain now`),
      pin('Absolute Cinema', `${T}: ${s} in Week ${week}`, 'Absolute cinema'),
      pin('Roll Safe Think About It', "Can't lose the week", `If you score ${s}`),
      macro('laughAt', `${T} scoring ${s}`, `Looking at the league median of ${pts(med)}`),
      j('prefer', `Scoring the league median (${pts(med)})`, `Scoring ${s}`),
      j('ignoreNotice', `The league median: ${pts(med)}`, `${T}: ${s}`),
      j('strongWeak', `${T}: ${s}`, `League median: ${pts(med)}`),
      j('notSame', `You scored ${pts(med)}`, `I scored ${s}`),
      j('bus', `${bottom.manager}: ${pts(bottom.score)}`, `${T}: ${s}`),
      ...(mvp ? [
        pin('Leonardo Dicaprio Cheers', `Cheers to ${N(mvp)}`, `${pts(mvp.pts)} of ${T}'s ${s}`),
        j('handshake', T, N(mvp), `Top score in Week ${week}`)
      ] : [])
    ], mvp ? [search(mvp, mvp.team || ''), ...GIF_QUERIES.top] : GIF_QUERIES.top, { gifFirst: !!mvp });
  }

  // ---- Cellar ---------------------------------------------------------------------------------
  {
    const B = bottom.manager, b = pts(bottom.score), low = lineupOf(B)?.worstStarter;
    const lostAll = games(bottom) > 0 && wins(bottom) === 0;
    add('cellar', 'Cellar Dweller', B, `${B} scored ${b}, the lowest in Week ${week} (league median ${pts(med)}).`, [
      pin('This Is Fine', `${B}: ${b} points`, 'This is fine'),
      pin('Waiting Skeleton', `Me waiting for my lineup to score more than ${b}`, 'Still waiting'),
      macro('pain', `Scored ${b}`, `League median was ${pts(med)}`),
      pin('Squidward window', `${B} with ${b}`, `Watching ${top.manager} score ${pts(top.score)}`),
      j('awkward', `${B} looking at ${b} points`, `Then looking at the median: ${pts(med)}`),
      j('strongWeak', `League median: ${pts(med)}`, `${B}: ${b}`),
      j('bus', `${B}: ${b}`, `${top.manager}: ${pts(top.score)}`),
      ...(lostAll ? [j('trophy', `This is where I'd put my Week ${week} win`)] : []),
      ...(low ? [
        j('surprise', `${B} starts ${N(low)}`, `${N(low)} scores ${pts(low.pts)}`),
        pin('Disaster Girl', `${N(low)}: ${pts(low.pts)} points`, `${B}: ${b} total`)
      ] : [])
    ], GIF_QUERIES.cellar);
  }

  // ---- Lineup mistakes ------------------------------------------------------------------------
  // The biggest same-position miss: a bench player who outscored a starter at their position on
  // the same team, by at least 10.
  const benchMiss = lineups.flatMap(l => l.bench.flatMap(b => l.starters
    .filter(s => s.position && s.position === b.position && b.pts - s.pts >= 10)
    .map(s => ({ manager: l.manager, benched: b, started: s, gap: b.pts - s.pts }))))
    .sort((a, b) => b.gap - a.gap)[0];
  if (benchMiss) {
    const { manager: M, benched: B, started: S } = benchMiss;
    const b = pts(B.pts), s = pts(S.pts);
    add('benchStar', 'Benched the Wrong Guy', M, `${M} started ${N(S)} (${s}) over ${N(B)} (${b}, on the bench). Both ${B.position}.`, [
      j('prefer', `Starting ${N(B)}`, `Starting ${N(S)}`),
      j('neglect', `${N(B)}: ${b} on the bench`, `${N(S)}: ${s}`, M),
      j('surprise', `${M} benches ${N(B)}`, `${N(B)} scores ${b} on the bench`),
      j('yell', `${M}: Start ${N(S)}!`, `${N(B)}: ${b} on the bench`),
      j('swerve', `Start ${N(B)}`, `Start ${N(S)}`, M),
      j('escalate', `Bench ${N(B)}`, `Start ${N(S)}`, `${N(S)} scores ${s}`, `${N(B)} scores ${b} on the bench`),
      j('plan', `Bench ${N(B)}`, `Start ${N(S)}`, `${N(S)} scores ${s}`, `${N(B)} scored ${b} on the bench`),
      j('dilemma', `Start ${N(B)}`, `Start ${N(S)}`, M),
      pin('Third World Skeptical Kid', `${b} points from ${N(B)}`, 'And you benched that?'),
      macro('pain', `Benched ${N(B)}`, `${N(B)} scored ${b}`)
    ], [search(B), 'benched', 'sitting on the bench', 'facepalm'], { gifFirst: true });
  }

  const worst = computeWorstLineupDecision(afcData, nfcData, afcSeason, nfcSeason, week, playersDB);
  if (worst && worst.deficit >= 5 && worst.manager !== benchMiss?.manager) {
    const M = worst.manager;
    add('bench', 'Bench Blunder', M, `${M}'s starters scored ${pts(worst.actual)}; the best possible lineup from the same roster was ${pts(worst.optimal)}.`, [
      j('prefer', `My best possible lineup: ${pts(worst.optimal)}`, `My actual lineup: ${pts(worst.actual)}`),
      j('surprise', `${M} sets the lineup`, `${pts(worst.deficit)} points left on the bench`),
      j('strongWeak', `Best possible lineup: ${pts(worst.optimal)}`, `${M}'s lineup: ${pts(worst.actual)}`),
      pin('Futurama Fry', 'Not sure if bench', `Or ${pts(worst.deficit)} points`),
      pin('Pawn Stars Best I Can Do', `${pts(worst.deficit)} points on my bench`, 'Best I can do'),
      j('uno', 'Start your best players', M)
    ], GIF_QUERIES.bench);
  }

  // ---- Schedule luck --------------------------------------------------------------------------
  const unlucky = sorted.find(r => games(r) > 0 && wins(r) === 0 && r.score >= med);
  if (unlucky) {
    const U = unlucky.manager, u = pts(unlucky.score), rk = ordinal(rankOf(U));
    add('robbed', 'Robbed', U, `${U} scored ${u} (${rk} in the league) and lost ${games(unlucky) === 2 ? 'both games' : 'their game'}.`, [
      macro('pain', `Scores ${u}, ${rk} best`, 'Gets 0 wins'),
      j('yell', `${U}: I scored ${u}!`, 'The schedule: 0 wins'),
      j('trophy', `This is where I'd put my Week ${week} win`),
      j('slap', `${u} points, ${rk} in the league`, '0 wins'),
      pin("Y'all Got Any More Of That", `${u} points`, "Y'all got any more wins?"),
      pin('Grandma Finds The Internet', `${u} points and 0 wins`, 'Where do I file a complaint')
    ], GIF_QUERIES.robbed);
  }

  const lucky = [...sorted].reverse().find(r => games(r) === 2 && wins(r) === 2 && r.score < med);
  if (lucky) {
    const L = lucky.manager, l = pts(lucky.score);
    add('lucky', 'Daylight Robbery', L, `${L} won both games with ${l}, below the league median of ${pts(med)}.`, [
      pin('Mocking Spongebob', 'wOn BoTh GaMeS', `wItH ${l} pOiNtS`, { alt: true }),
      pin('Roll Safe Think About It', 'Win twice', `With ${l}, below the median`),
      macro('suspicious', `${L} won twice`, `With ${l} points`),
      macro('laughAt', `${L} sweeping with ${l}`, `The median was ${pts(med)}`),
      j('uno', `Score above the median (${pts(med)})`, L),
      j('same', `${L}: ${l} points`, `${L}: 2-0`)
    ], GIF_QUERIES.lucky);
  }

  // ---- Versus projection ----------------------------------------------------------------------
  const vsProjection = rows
    .filter(r => Number.isFinite(pregameScores?.[r.manager]))
    .map(r => ({ ...r, proj: pregameScores[r.manager], delta: r.score - pregameScores[r.manager] }))
    .sort((a, b) => b.delta - a.delta);
  if (vsProjection.length >= 4) {
    const boom = vsProjection[0], bust = vsProjection[vsProjection.length - 1];
    if (boom.delta >= 10) {
      const M = boom.manager, p = pts(boom.proj), s = pts(boom.score);
      add('boom', 'Boom', M, `${M} was projected for ${p} and scored ${s} (+${pts(boom.delta)}).`, [
        pin('One Does Not Simply', `One does not simply beat a ${p} projection by ${pts(boom.delta)}`, `${M} did`),
        macro('suspicious', `Projected ${p}`, `Scored ${s}`),
        j('prefer', `Scoring the projected ${p}`, `Scoring ${s}`),
        j('ignoreNotice', `${M}'s projection: ${p}`, `${M}: ${s}`),
        j('strongWeak', `${M} actual: ${s}`, `${M} projected: ${p}`),
        j('alwaysHasBeen', `Wait, ${M} was only projected for ${p}?`, `Scored ${s}`)
      ], GIF_QUERIES.boom);
    }
    if (bust.delta <= -10) {
      const M = bust.manager, p = pts(bust.proj), s = pts(bust.score);
      add('bust', 'Bust', M, `${M} was projected for ${p} and scored ${s} (${pts(bust.delta)}).`, [
        macro('pain', `Projected ${p}`, `Scored ${s}`),
        j('surprise', `${M} projected for ${p}`, `${M} scores ${s}`),
        j('awkward', `Looking at the ${p} projection`, `Then looking at ${s}`),
        j('strongWeak', `${M} projected: ${p}`, `${M} actual: ${s}`),
        pin('Evil Kermit', 'Me: the projection says we win', `Also me: ${s} points`)
      ], GIF_QUERIES.bust);
    }
  }

  // ---- Week over week -------------------------------------------------------------------------
  if (week > 1) {
    const prev = { ...(afcSeason?.scoreByWeek?.[week - 1] || {}), ...(nfcSeason?.scoreByWeek?.[week - 1] || {}) };
    const moved = rows
      .filter(r => prev[r.manager] > 0)
      .map(r => ({ ...r, last: prev[r.manager], change: r.score - prev[r.manager] }))
      .sort((a, b) => b.change - a.change);
    if (moved.length >= 4) {
      const jump = moved[0], drop = moved[moved.length - 1];
      if (jump.change >= 15) {
        const M = jump.manager;
        add('jump', 'Biggest Jump', M, `${M} went from ${pts(jump.last)} in Week ${week - 1} to ${pts(jump.score)} (+${pts(jump.change)}).`, [
          j('prefer', `Scoring ${pts(jump.last)} last week`, `Scoring ${pts(jump.score)} this week`),
          j('ignoreNotice', `${M} in Week ${week - 1}: ${pts(jump.last)}`, `${M} in Week ${week}: ${pts(jump.score)}`),
          j('strongWeak', `${M} this week: ${pts(jump.score)}`, `${M} last week: ${pts(jump.last)}`),
          j('notSame', `Week ${week - 1}: ${pts(jump.last)}`, `Week ${week}: ${pts(jump.score)}`),
          macro('suspicious', `${M} up ${pts(jump.change)} points`, `From ${pts(jump.last)} to ${pts(jump.score)}`)
        ], GIF_QUERIES.jump);
      }
      if (drop.change <= -15) {
        const M = drop.manager;
        add('drop', 'Biggest Drop', M, `${M} went from ${pts(drop.last)} in Week ${week - 1} to ${pts(drop.score)} (${pts(drop.change)}).`, [
          j('strongWeak', `${M} last week: ${pts(drop.last)}`, `${M} this week: ${pts(drop.score)}`),
          j('awkward', `${pts(drop.last)} last week`, `${pts(drop.score)} this week`),
          pin('This Is Fine', `${M}: down ${pts(-drop.change)}`, 'This is fine'),
          macro('pain', `${pts(drop.last)} last week`, `${pts(drop.score)} this week`),
          pin('Grandma Finds The Internet', `Down ${pts(-drop.change)} from last week`, 'How do I undo this')
        ], GIF_QUERIES.drop);
      }
    }
  }

  // ---- Games ----------------------------------------------------------------------------------
  const close = weeklyAwards?.closest;
  if (close) {
    const [w1, s1, w2, s2] = close.sa >= close.sb ? [close.a, close.sa, close.b, close.sb] : [close.b, close.sb, close.a, close.sa];
    add('close', 'Nail-Biter', w1, `${w1} beat ${w2} ${pts(s1)} to ${pts(s2)}, the closest game of the week.`, [
      j('handshake', `${w1}: ${pts(s1)}`, `${w2}: ${pts(s2)}`, `Separated by ${pts(close.margin)}`),
      j('slap', `${w2}: ${pts(s2)}`, `${w1}: ${pts(s1)}`),
      j('ignoreNotice', 'A normal game', `A ${pts(close.margin)}-point game`),
      j('same', `${w1}: ${pts(s1)}`, `${w2}: ${pts(s2)}`),
      pin('Squidward window', `Me watching the ${pts(close.margin)}-point game`, `${pts(s1)} to ${pts(s2)}`),
      pin('Futurama Fry', `Not sure if ${pts(close.margin)}-point win`, 'Or a coin flip')
    ], GIF_QUERIES.close, { teams: [w1, w2] });
  }

  const blow = weeklyAwards?.blowout;
  if (blow) {
    const [w1, s1, w2, s2] = blow.sa >= blow.sb ? [blow.a, blow.sa, blow.b, blow.sb] : [blow.b, blow.sb, blow.a, blow.sa];
    add('blowout', 'Not Even Close', w1, `${w1} beat ${w2} ${pts(s1)} to ${pts(s2)}, the biggest margin of the week (${pts(blow.margin)}).`, [
      j('slap', `${w2}: ${pts(s2)}`, `${w1}: ${pts(s1)}`),
      j('bus', `${w2}: ${pts(s2)}`, `${w1}: ${pts(s1)}`),
      j('gloat', `${w2}, Week ${week}`, w1),
      j('strongWeak', `${w1}: ${pts(s1)}`, `${w2}: ${pts(s2)}`),
      pin("I'm The Captain Now", w1, `Won by ${pts(blow.margin)}. I'm the captain now`),
      pin('Pawn Stars Best I Can Do', `${w2} offers ${pts(s2)}`, `${w1}: ${pts(s1)}. No.`)
    ], GIF_QUERIES.blowout, { teams: [w1, w2] });
  }

  // ---- Transactions ---------------------------------------------------------------------------
  if (waiverWireMvp) {
    const info = playerLabel(playersDB || {}, waiverWireMvp.id), M = waiverWireMvp.manager, x = pts(waiverWireMvp.points);
    add('waiver', 'Waiver Wire MVP', M, `${M} started ${info.name}, a waiver/free-agent pickup, for ${x}.`, [
      j('prefer', 'Paying for a star', `Picking up ${info.name} for ${x}`),
      pin('Oprah You Get A', `You get ${info.name}`, `${x} points off the waiver wire`),
      j('pigeon', M, info.name, 'Is this a league winner?'),
      j('tempted', `${info.name}: ${x}`, M, 'The rest of the roster'),
      pin('Roll Safe Think About It', "Can't have a bad draft", `If you pick up ${info.name}`)
    ], [search(info, info.team || ''), ...GIF_QUERIES.waiver], { gifFirst: true });
  }

  const trades = (recapTransactions || []).filter(({ tx }) => tx.type === 'trade' && tx.status === 'complete' && tx.leg === week);
  if (trades.length) {
    const { tx, rosterIdMap } = trades[0];
    const sides = (tx.roster_ids || []).map(id => ({
      manager: rosterIdMap?.[id] || `Roster ${id}`,
      got: Object.entries(tx.adds || {}).filter(([, r]) => r === id).map(([pid]) => playerLabel(playersDB || {}, pid).name)
    })).filter(s => s.got.length);
    if (sides.length >= 2) {
      const [a, b] = sides, ag = a.got.join(' + '), bg = b.got.join(' + ');
      add('trade', 'Trade Desk', a.manager, `${a.manager} got ${ag}; ${b.manager} got ${bg}.`, [
        j('tradeOffer', `${a.manager} receives: ${ag}`, `${b.manager} receives: ${bg}`),
        j('handshake', a.manager, b.manager, 'Trade'),
        pin('Pawn Stars Best I Can Do', `${a.manager} gets ${ag}`, `${b.manager}: best I can do`),
        j('prefer', `${b.manager} keeping ${bg}`, `${a.manager} getting ${ag}`)
      ], GIF_QUERIES.trade, { teams: [a.manager, b.manager] });
    }
  }

  // ---- Season-long ----------------------------------------------------------------------------
  if (luck?.length >= 2 && luck[0].manager !== luck[luck.length - 1].manager) {
    const lk = luck[0], ul = luck[luck.length - 1];
    const sign = (n) => `${n >= 0 ? '+' : ''}${pts(n)}`;
    add('luckiest', `Luckiest Through Week ${week}`, lk.manager, `${lk.manager} has the most schedule luck so far: ${sign(lk.luck)} LP versus their all-play record.`, [
      j('tempted', `${sign(lk.luck)} LP of luck`, lk.manager, 'Skill'),
      pin('Mocking Spongebob', `${lk.manager} hAs ${sign(lk.luck)} Lp Of LuCk`, "iT's AlL sKiLl", { alt: true }),
      macro('suspicious', `${lk.manager}: ${sign(lk.luck)} LP of luck`, 'Suspicious')
    ], GIF_QUERIES.luckiest);
    add('unluckiest', `Unluckiest Through Week ${week}`, ul.manager, `${ul.manager} has the worst schedule luck so far: ${sign(ul.luck)} LP versus their all-play record.`, [
      j('alwaysHasBeen', `Wait, ${ul.manager} has ${sign(ul.luck)} LP of bad luck?`, 'Always has been'),
      macro('pain', 'Plays every week', `${sign(ul.luck)} LP of luck`),
      pin("Y'all Got Any More Of That", `${sign(ul.luck)} LP of luck`, "Y'all got any more luck?")
    ], GIF_QUERIES.unluckiest);
  }

  const standings = ['afc', 'nfc'].flatMap(c => Object.entries(standingsHistory?.[c] || {}).map(([manager, weeks]) => {
    const at = weeks.find(w => w.week === week);
    return at ? { manager, pts: at.pts, pf: at.pf } : null;
  })).filter(Boolean).sort((x, y) => y.pts - x.pts || y.pf - x.pf);
  if (standings.length >= 6) {
    const first = standings[0], last = standings[standings.length - 1];
    add('first', 'League Leader', first.manager, `${first.manager} leads the league with ${pts(first.pts)} LP through Week ${week}.`, [
      pin("I'm The Captain Now", first.manager, `${pts(first.pts)} LP. I'm the captain now`),
      macro('triumph', `${first.manager}: #1`, `${pts(first.pts)} LP through Week ${week}`),
      j('changeMind', `${first.manager} is the best team in the league (${pts(first.pts)} LP)`),
      j('bus', `${last.manager}: ${pts(last.pts)} LP`, `${first.manager}: ${pts(first.pts)} LP`)
    ], GIF_QUERIES.first);
    add('last', 'Basement Dweller', last.manager, `${last.manager} is last with ${pts(last.pts)} LP through Week ${week}.`, [
      pin('This Is Fine', `${last.manager}: ${pts(last.pts)} LP`, 'This is fine'),
      pin('Waiting Skeleton', `Me waiting for a playoff spot with ${pts(last.pts)} LP`, 'Still waiting'),
      macro('pain', `${pts(last.pts)} LP through Week ${week}`, 'Last place'),
      j('awkward', `Looking at ${pts(last.pts)} LP`, 'Then looking at the standings')
    ], GIF_QUERIES.last);
  }

  // Median streaks: weeks in a row above (or below) that week's league median, ending this week.
  const medianByWeek = {};
  const scoreAt = (w, m) => afcSeason?.scoreByWeek?.[w]?.[m] ?? nfcSeason?.scoreByWeek?.[w]?.[m];
  for (let w = 1; w <= week; w++) {
    const all = [...Object.values(afcSeason?.scoreByWeek?.[w] || {}), ...Object.values(nfcSeason?.scoreByWeek?.[w] || {})].filter(x => x > 0);
    if (all.length) medianByWeek[w] = median(all);
  }
  const streak = (m, above) => {
    let n = 0;
    for (let w = week; w >= 1; w--) {
      const s = scoreAt(w, m);
      if (!(s > 0) || medianByWeek[w] == null || (above ? s <= medianByWeek[w] : s >= medianByWeek[w])) break;
      n++;
    }
    return n;
  };
  const hot = rows.map(r => ({ manager: r.manager, n: streak(r.manager, true) })).sort((a, b) => b.n - a.n)[0];
  if (hot?.n >= 4) {
    add('hotStreak', 'Heater', hot.manager, `${hot.manager} has beaten the league median ${hot.n} weeks in a row.`, [
      macro('triumph', hot.manager, `${hot.n} weeks in a row above the median`),
      j('ignoreNotice', 'Beating the median once', `${hot.manager}: ${hot.n} weeks in a row`),
      pin('Star Wars Yoda', `Above the median ${hot.n} straight weeks`, `Strong, ${hot.manager} is`)
    ], ['on fire', 'unstoppable', 'heating up']);
  }
  const cold = rows.map(r => ({ manager: r.manager, n: streak(r.manager, false) })).sort((a, b) => b.n - a.n)[0];
  if (cold?.n >= 3) {
    add('coldStreak', 'Ice Cold', cold.manager, `${cold.manager} has been below the league median ${cold.n} weeks in a row.`, [
      pin('Waiting Skeleton', `${cold.manager} waiting for a week above the median`, `${cold.n} weeks and counting`),
      macro('pain', `${cold.n} weeks in a row`, 'Below the median'),
      j('surprise', `${cold.manager} sets a lineup`, `Below the median for week ${cold.n} in a row`)
    ], ['frozen', 'waiting', 'still waiting']);
  }

  // ---- Players --------------------------------------------------------------------------------
  const ownerOf = (id) => lineups.find(l => l.starters.some(s => s.id === id))?.manager || null;
  const playerInfo = (entry) => {
    if (!entry) return null;
    const info = nameOf(entry.id);
    const owner = ownerOf(entry.id);
    return owner && info ? { ...entry, ...info, owner } : null;
  };
  const star = playerInfo(playerHighlights?.highestActual);
  const riser = playerInfo(playerHighlights?.biggestRiser);
  const bust = playerInfo(playerHighlights?.biggestBust);
  if (star) {
    const P = N(star), x = pts(star.actual), O = star.owner;
    add('playerTop', `Player of the Week: ${P}`, O, `${P} scored ${x} for ${O}, the most by any starter this week.`, [
      pin('Leonardo Dicaprio Cheers', `Cheers to ${P}`, `${x} points for ${O}`),
      pin('Absolute Cinema', `${P}: ${x} points`, 'Absolute cinema'),
      j('prefer', `Benching ${P}`, `Starting ${P}`),
      j('escalate', 'Start your highest projected players', `Start ${P}`, `${P} scores ${x}`, `Top starter in both conferences`),
      j('handshake', O, P, `${x} points`),
      pin('Roll Safe Think About It', "Can't lose the week", `If you start ${P}`)
    ], [search(star, `${star.team || ''}`), `${P} touchdown`, ...GIF_QUERIES.top], { gifFirst: true });
  }
  if (riser && riser.id !== star?.id) {
    const P = N(riser), a = pts(riser.actual), p = pts(riser.projected), O = riser.owner;
    add('playerRiser', `Biggest Riser: ${P}`, O, `${P} was projected for ${p} and scored ${a} for ${O}.`, [
      pin('One Does Not Simply', `One does not simply beat a ${p} projection`, `${P} scored ${a}`),
      macro('suspicious', `${P} beat projection by ${pts(riser.actual - riser.projected)}`, `${p} to ${a}`),
      j('ignoreNotice', `${P} projected: ${p}`, `${P} actual: ${a}`),
      j('strongWeak', `${P} actual: ${a}`, `${P} projected: ${p}`),
      j('prefer', `Projecting ${P} for ${p}`, `${P} scoring ${a}`)
    ], [search(riser, riser.team || ''), `${P} highlights`, ...GIF_QUERIES.boom], { gifFirst: true });
  }
  if (bust) {
    const P = N(bust), a = pts(bust.actual), p = pts(bust.projected), O = bust.owner;
    add('playerBust', `Biggest Bust: ${P}`, O, `${P} was projected for ${p} and scored ${a} for ${O}.`, [
      macro('pain', `${P} projected ${p}`, `${P} scored ${a}`),
      j('surprise', `${O} starts ${P} (projected ${p})`, `${P} scores ${a}`),
      j('strongWeak', `${P} projected: ${p}`, `${P} actual: ${a}`),
      j('awkward', `Starting ${P}`, `${a} points, ${pts(bust.projected - bust.actual)} under projection`),
      j('uno', `Bench ${P}`, O),
      j('plan', `Start ${P}`, `Projected ${p}`, `${P} scores ${a}`, `${P} scores ${a}`)
    ], [search(bust, bust.team || ''), `${P} sad`, ...GIF_QUERIES.bust], { gifFirst: true });
  }

  // One-man show: the team whose best starter scored the biggest share of its points.
  const carry = lineups
    .filter(l => l.best && l.total > 0 && l.best.pts >= 20)
    .map(l => ({ ...l, share: l.best.pts / l.total, rest: l.total - l.best.pts }))
    .sort((a, b) => b.share - a.share)[0];
  if (carry && carry.share >= 0.35 && carry.best.id !== star?.id) {
    const P = N(carry.best), x = pts(carry.best.pts), pct = Math.round(carry.share * 100), M = carry.manager, rest = pts(carry.rest);
    add('carry', 'One-Man Show', M, `${P} scored ${x} of ${M}'s ${pts(carry.total)} starter points (${pct}%).`, [
      j('ignoreNotice', `The rest of ${M}'s lineup: ${rest}`, `${P}: ${x}`),
      j('prefer', 'A balanced lineup', `${P} scoring ${pct}% of the points`),
      j('strongWeak', `${P}: ${x}`, `Everyone else: ${rest}`),
      pin('Oprah You Get A', `${P} gets ${x}`, `The other starters get ${rest} combined`),
      j('notSame', `You need a whole lineup`, `${M} has ${P}`),
      pin('Roll Safe Think About It', "Can't need a lineup", `If ${P} scores ${pct}% of your points`)
    ], [search(carry.best, carry.best.team || ''), 'carrying the team', 'one man army'], { gifFirst: true });
  }

  // Dud of the week: the lowest-scoring named starter (3 points or fewer), unless it's already the
  // biggest bust.
  const dud = lineups.flatMap(l => l.starters.map(s => ({ ...s, manager: l.manager }))).sort((a, b) => a.pts - b.pts)[0];
  if (dud && dud.pts <= 3 && dud.id !== bust?.id) {
    const P = N(dud), x = pts(dud.pts), M = dud.manager;
    add('dud', 'Dud of the Week', M, `${M} started ${P}, who scored ${x}, the fewest of any named starter.`, [
      j('surprise', `${M} starts ${P}`, `${P} scores ${x}`),
      macro('pain', `Started ${P}`, `${x} points`),
      pin('This Is Fine', `${P}: ${x} points`, 'This is fine'),
      j('yell', `${M}: ${P} is a starter!`, `${P}: ${x} points`),
      j('uno', `Bench ${P}`, M),
      j('awkward', `${M} looking at ${P}'s ${x}`, 'Then looking at the bench')
    ], [`${search(dud, dud.team || '')}`, 'zero', 'nothing'], { gifFirst: true });
  }

  // Kicker outscored the quarterback on the same team.
  const kq = lineups.flatMap(l => {
    const k = l.starters.find(s => s.position === 'K'), q = l.starters.find(s => s.position === 'QB');
    return k && q && k.pts >= 10 && k.pts > q.pts ? [{ manager: l.manager, k, q, gap: k.pts - q.pts }] : [];
  }).sort((a, b) => b.gap - a.gap)[0];
  if (kq) {
    const { manager: M, k, q } = kq;
    add('kickerQB', 'Kicker > Quarterback', M, `${M}'s kicker ${N(k)} scored ${pts(k.pts)}; their QB ${N(q)} scored ${pts(q.pts)}.`, [
      j('strongWeak', `${N(k)} (K): ${pts(k.pts)}`, `${N(q)} (QB): ${pts(q.pts)}`),
      pin('Futurama Fry', 'Not sure if kicker', 'Or quarterback'),
      j('surprise', `${M} starts ${N(q)} at QB`, `The kicker scores more`),
      j('notSame', `${N(q)}: ${pts(q.pts)}`, `${N(k)}: ${pts(k.pts)}`)
    ], [search(k, 'field goal'), 'field goal', 'kicker'], { gifFirst: true });
  }

  // Bench outscored the starters.
  const mob = lineups.filter(l => l.benchTotal >= 30 && l.benchTotal > l.total).sort((a, b) => (b.benchTotal - b.total) - (a.benchTotal - a.total))[0];
  if (mob) {
    const M = mob.manager;
    add('benchMob', 'Bench Mob', M, `${M}'s bench scored ${pts(mob.benchTotal)}; the starters scored ${pts(mob.total)}.`, [
      j('ignoreNotice', `${M}'s starters: ${pts(mob.total)}`, `${M}'s bench: ${pts(mob.benchTotal)}`),
      j('strongWeak', `Bench: ${pts(mob.benchTotal)}`, `Starters: ${pts(mob.total)}`),
      j('neglect', `The bench: ${pts(mob.benchTotal)}`, `The starters: ${pts(mob.total)}`, M),
      macro('pain', `Bench: ${pts(mob.benchTotal)}`, `Starters: ${pts(mob.total)}`)
    ], ['sitting on the bench', 'wasted', 'facepalm']);
  }

  // Same player started by two teams (one in each conference can roster him): a high five when he
  // went off, shared misery when he didn't.
  const shared = Object.values(lineups.reduce((byId, l) => {
    l.starters.forEach(s => { (byId[s.id] ||= { p: s, owners: [] }).owners.push(l.manager); });
    return byId;
  }, {})).filter(x => x.owners.length === 2).sort((a, b) => b.p.pts - a.p.pts);
  // Cross-conference opponents who both started him: Spider-Man pointing at Spider-Man.
  const crossOf = (m) => rows.find(r => r.manager === m)?.crossOpp;
  const mirror = shared.find(x => crossOf(x.owners[0]) === x.owners[1] || crossOf(x.owners[1]) === x.owners[0]);
  if (mirror) {
    const [A, B] = mirror.owners, P = N(mirror.p), x = pts(mirror.p.pts);
    add('mirror', 'Mirror Match', A, `${A} and ${B} played each other across conferences and both started ${P} (${x}).`, [
      j('same', `${A}'s ${P}`, `${B}'s ${P}`),
      j('handshake', A, B, `Both started ${P}: ${x}`),
      macro('suspicious', `${A} vs ${B}`, `Both starting ${P}`)
    ], [search(mirror.p, mirror.p.team || ''), 'spiderman pointing', 'twins'],
    { gifFirst: true, teams: [A, B], opener: 'spiderman pointing at spiderman' });
  }
  const others = shared.filter(x => x !== mirror);
  const hi = others[0], lo = others[others.length - 1];
  if (hi && hi.p.pts >= 15) {
    const [A, B] = hi.owners, P = N(hi.p), x = pts(hi.p.pts);
    add('sharedStar', 'High Five', A, `${A} and ${B} both started ${P}, who scored ${x}.`, [
      j('handshake', A, B, `Both started ${P}: ${x}`),
      j('same', `${A}: started ${P}`, `${B}: started ${P}`),
      pin('Leonardo Dicaprio Cheers', `Cheers, ${A} and ${B}`, `${P}: ${x} for both of you`),
      j('bus', `Everyone without ${P}`, `${A} and ${B}`)
    ], [search(hi.p, hi.p.team || ''), 'high five', 'celebration'], { gifFirst: true, teams: [A, B] });
  }
  if (lo && lo !== hi && lo.p.pts <= 3) {
    const [A, B] = lo.owners, P = N(lo.p), x = pts(lo.p.pts);
    add('sharedDud', 'Shared Misery', A, `${A} and ${B} both started ${P}, who scored ${x}.`, [
      j('same', `${A}: started ${P}`, `${B}: started ${P}`),
      j('handshake', A, B, `Both started ${P}: ${x}`),
      pin('This Is Fine', `${A} and ${B} both started ${P}`, 'This is fine'),
      macro('pain', `Both started ${P}`, `${x} points each`)
    ], [search(lo.p, lo.p.team || ''), 'sad', 'together'], { gifFirst: true, teams: [A, B] });
  }

  // Score twins: the two teams whose totals were closest (within 0.5), whoever they played.
  const twins = sorted.slice(1).map((r, i) => ({ a: sorted[i], b: r, gap: sorted[i].score - r.score })).sort((x, y) => x.gap - y.gap)[0];
  if (twins && twins.gap <= 0.5) {
    const { a, b } = twins;
    add('twins', 'Score Twins', a.manager, `${a.manager} scored ${pts(a.score)} and ${b.manager} scored ${pts(b.score)}.`, [
      j('handshake', `${a.manager}: ${pts(a.score)}`, `${b.manager}: ${pts(b.score)}`, twins.gap === 0 ? 'Same score' : `${twins.gap.toFixed(2)} apart`),
      j('same', `${a.manager}: ${pts(a.score)}`, `${b.manager}: ${pts(b.score)}`)
    ], ['twins', 'same', 'high five'], { teams: [a.manager, b.manager] });
  }

  // One card per team per week. Stories are ranked by how good they are and each team keeps its best
  // one (games and trades feature both teams). A team left without a story gets one about its best
  // player that week, so every team shows up once.
  const PRIORITY = ['mirror', 'sharedStar','playerTop', 'benchStar', 'sharedDud', 'twins','top', 'cellar', 'dud', 'carry', 'kickerQB', 'benchMob', 'blowout', 'robbed',
    'lucky', 'close', 'boom', 'bust', 'playerRiser', 'playerBust', 'jump', 'drop', 'trade', 'waiver', 'hotStreak', 'coldStreak',
    'first', 'last', 'luckiest', 'unluckiest', 'bench'];
  const rank = (s) => { const i = PRIORITY.indexOf(s.key); return i < 0 ? PRIORITY.length : i; };
  const LIVE_OK = new Set(['mirror', 'sharedStar', 'playerTop', 'playerRiser', 'carry', 'waiver', 'trade']);
  const featured = new Set();
  const chosen = [...situations].sort((a, b) => rank(a) - rank(b)).filter(s => {
    if (live && !LIVE_OK.has(s.key)) return false;
    const teams = s.teams || [s.manager];
    if (teams.some(t => featured.has(t))) return false;
    teams.forEach(t => featured.add(t));
    return true;
  });
  situations.splice(0, situations.length, ...chosen);
  for (const l of lineups) {
    if (featured.has(l.manager) || !l.best || l.best.pts < 10) continue;
    const P = N(l.best), x = pts(l.best.pts), M = l.manager;
    const others = l.starters.filter(s => s.id !== l.best.id);
    const avg = others.length ? pts((l.total - l.best.pts) / others.length) : null;
    add(`mvp-${M}`, 'Team MVP', M, `${P} was ${M}'s top scorer with ${x} of ${pts(l.total)} starter points.`, [
      pin('Leonardo Dicaprio Cheers', `Cheers to ${P}`, `${x} points for ${M}`),
      j('handshake', M, P, `${x} points in Week ${week}`),
      j('ignoreNotice', `The rest of ${M}'s lineup`, `${P}: ${x}`),
      j('prefer', `Benching ${P}`, `Starting ${P} for ${x}`),
      j('pigeon', M, P, 'Is this a franchise player?'),
      ...(avg ? [
        j('strongWeak', `${P}: ${x}`, `${M}'s other starters: ${avg} avg`),
        j('notSame', `Your starters: ${avg} avg`, `${P}: ${x}`)
      ] : []),
      macro('triumph', P, `${x} points for ${M}`)
    ], [search(l.best, l.best.team || ''), 'celebration', 'lets go'], { gifFirst: true });
    featured.add(M);
  }
  if (live) situations.forEach(s => { s.fact = `So far: ${s.fact}`; });

  // Variety across the whole board: each card opens on the freshest template (not used yet, and its
  // kind of joke used least so far). About one team in four opens on its logo instead (otherwise
  // the logo is one "Another" away).
  const usedTemplates = new Set();
  const shapeCount = {};
  const take = (vr) => {
    if (vr.logo) return;
    usedTemplates.add(vr.template);
    shapeCount[vr.shape] = (shapeCount[vr.shape] || 0) + 1;
  };
  const best = (s) => {
    let at = -1, score = Infinity;
    s.variants.forEach((vr, i) => {
      if (vr.logo) return;
      const sc = (usedTemplates.has(vr.template) ? 100 : 0) + (shapeCount[vr.shape] || 0) * (vr.shape === 'macro' ? 1 : 3);
      if (sc < score) { score = sc; at = i; }
    });
    return at;
  };
  situations.forEach(s => {
    const logoAt = s.variants.findIndex(vr => vr.logo);
    // `opener` pins a story to the template it was written for.
    const pinned = s.opener ? s.variants.findIndex(vr => vr.template === s.opener) : -1;
    s.start = pinned >= 0 ? pinned
      : logoAt >= 0 && pickIndex(week, `${s.key}|logo`, 4) === 0 ? logoAt : Math.max(0, best(s));
    take(s.variants[s.start]);
  });

  return { week, situations };
}
