// The meme board: for each thing that happened this week (lowest score, bench blunder, blowout, ...)
// a pool of real meme templates (Imgflip) and GIF searches (Giphy), captioned with real numbers
// from the week. Which variant shows is picked from the week number, so every week looks different,
// and an admin can cycle to another. Nothing here is invented: a situation with no real data behind
// it is skipped.
import { computeWorstLineupDecision, playerLabel } from './players';
import { GIF_QUERIES } from './gifQueries';

function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}
export const pickIndex = (week, key, count) => (count ? hash(`${week}|${key}`) % count : 0);

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const pts = (n) => n.toFixed(1);
const up = (s) => String(s).toUpperCase();
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

// A variant is { template, layout?, top, bottom, labels?, alt? }. Layouts: 'topbottom' (default),
// 'drake' (two stacked panels on the right), 'split' (left and right captions), 'distracted'.
const v = (template, top, bottom, extra = {}) => ({ template, top: up(top), bottom: up(bottom), ...extra });
const drake = (template, top, bottom) => ({ template, layout: 'drake', top: up(top), bottom: up(bottom) });
const split = (template, left, right) => ({ template, layout: 'split', top: up(left), bottom: up(right) });

export function buildMemeBoard({
  week, weekRows, weeklyAwards, pregameScores, afcData, nfcData, afcSeason, nfcSeason, playersDB,
  recapTransactions, waiverWireMvp, standingsHistory, luck, playerHighlights
}) {
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
  const add = (key, label, manager, variants, gifQueries) => situations.push({ key, label, manager, variants, gifQueries });

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
      const byPts = [...starters].sort((a, b) => b.pts - a.pts);
      return { manager, starters, bench, total, best: byPts[0] || null, worstStarter: byPts[byPts.length - 1] || null };
    });
  const lineupOf = (manager) => lineups.find(l => l.manager === manager);
  const N = (p) => up(p.name);
  const topMvp = lineupOf(top.manager)?.best;
  const cellarLow = lineupOf(bottom.manager)?.worstStarter;

  add('top', 'Top Score', top.manager, [
    v('Oprah You Get A', `YOU GET ${pts(top.score)} POINTS`, `AND YOU GET ${pts(top.score - med)} OVER THE MEDIAN`),
    v('Leonardo Dicaprio Cheers', `CHEERS TO ${top.manager}`, `${pts(top.score)} POINTS IN WEEK ${week}`),
    v("I'm The Captain Now", top.manager, `${pts(top.score)} POINTS. I'M THE CAPTAIN NOW`),
    v('Roll Safe Think About It', "CAN'T LOSE THE WEEK", `IF YOU SCORE ${pts(top.score)}`),
    v('Laughing Leo', `${top.manager} SCORING ${pts(top.score)}`, `LOOKING AT THE LEAGUE MEDIAN OF ${pts(med)}`),
    drake('Drake Hotline Bling', 'SCORING THE MEDIAN', `SCORING ${pts(top.score)}`),
    v('Sleeping Shaq', 'ME LOOKING AT A NORMAL SCORE', `${top.manager} SCORING ${pts(top.score)}`),
    v('Star Wars Yoda', `${top.manager} SCORED ${pts(top.score)}`, 'DO OR DO NOT. THEY DID.'),
    v('Absolute Cinema', `${pts(top.score)} POINTS IN WEEK ${week}`, 'ABSOLUTE CINEMA'),
    ...(topMvp ? [
      v('Leonardo Dicaprio Cheers', `CHEERS TO ${N(topMvp)}`, `${pts(topMvp.pts)} OF ${top.manager}'S ${pts(top.score)} POINTS`),
      v('Oprah You Get A', `${N(topMvp)} GETS ${pts(topMvp.pts)}`, `${top.manager} GETS THE TOP SCORE`)
    ] : [])
  ], GIF_QUERIES.top);

  add('cellar', 'Cellar Dweller', bottom.manager, [
    v('Waiting Skeleton', `ME WAITING FOR MY LINEUP TO SCORE MORE THAN ${pts(bottom.score)}`, 'STILL WAITING'),
    v('This Is Fine', `${bottom.manager}: ${pts(bottom.score)} POINTS`, 'THIS IS FINE'),
    v('Hide the Pain Harold', `SCORED ${pts(bottom.score)}, LEAGUE MEDIAN WAS ${pts(med)}`, "FINE. I'M FINE."),
    v('Bad Luck Brian', 'STARTS THE BEST LINEUP', `SCORES ${pts(bottom.score)}`),
    ...(cellarLow ? [
      v('Surprised Pikachu', `${bottom.manager} STARTS ${N(cellarLow)}`, `${N(cellarLow)} SCORES ${pts(cellarLow.pts)}`),
      v('Disaster Girl', `${N(cellarLow)}: ${pts(cellarLow.pts)} POINTS`, `${bottom.manager}: ${pts(bottom.score)} TOTAL`)
    ] : []),
    v('Monkey Puppet', `LOOKING AT ${pts(bottom.score)} POINTS`, `THEN LOOKING AT THE MEDIAN OF ${pts(med)}`),
    v('Disaster Girl', `${bottom.manager} AFTER ${pts(bottom.score)} POINTS`, 'I DID THIS'),
    v('Sleeping Shaq', 'MY LINEUP BEFORE KICKOFF', `MY LINEUP AFTER ${pts(bottom.score)} POINTS`),
    v('Grandma Finds The Internet', `${bottom.manager} SCORING ${pts(bottom.score)}`, 'WHERE DO I FIND THE BENCH BUTTON')
  ], GIF_QUERIES.cellar);

  // The biggest same-position miss in the league: a bench player who outscored a starter at their
  // position on the same team, by at least 10.
  const benchMiss = lineups.flatMap(l => l.bench.flatMap(b => l.starters
    .filter(s => s.position && s.position === b.position && b.pts - s.pts >= 10)
    .map(s => ({ manager: l.manager, benched: b, started: s, gap: b.pts - s.pts }))))
    .sort((a, b) => b.gap - a.gap)[0];
  if (benchMiss) {
    const { manager, benched: B, started: S } = benchMiss;
    add('benchStar', 'Benched the Wrong Guy', manager, [
      drake('Drake Hotline Bling', `STARTING ${N(B)} (${pts(B.pts)} POINTS)`, `STARTING ${N(S)} (${pts(S.pts)} POINTS)`),
      v('Surprised Pikachu', `${manager} BENCHES ${N(B)}`, `${N(B)} SCORES ${pts(B.pts)} ON THE BENCH`),
      split('Woman Yelling At Cat', `${manager}: START ${N(S)}!`, `${N(B)}: ${pts(B.pts)} ON THE BENCH`),
      v('Monkey Puppet', `${N(S)} IN MY LINEUP: ${pts(S.pts)}`, `${N(B)} ON MY BENCH: ${pts(B.pts)}`),
      v('Third World Skeptical Kid', `${pts(B.pts)} POINTS FROM ${N(B)}`, 'AND YOU BENCHED THAT?')
    ], ['benched', 'sitting on the bench', 'why would you do that', 'facepalm']);
  }

  const worst = computeWorstLineupDecision(afcData, nfcData, afcSeason, nfcSeason, week, playersDB);
  if (worst && worst.deficit >= 5 && worst.manager !== benchMiss?.manager) {
    add('bench', 'Bench Blunder', worst.manager, [
      drake('Drake Hotline Bling', `STARTING THE LINEUP THAT SCORED ${pts(worst.actual)}`, `LEAVING ${pts(worst.deficit)} POINTS ON THE BENCH`),
      v('Third World Skeptical Kid', `${pts(worst.deficit)} POINTS ON THE BENCH`, 'YOU SET THAT LINEUP YOURSELF?'),
      v('Futurama Fry', 'NOT SURE IF BENCH', `OR ${pts(worst.deficit)} POINTS`),
      v('Evil Kermit', 'ME: START THE HOT HAND', `ALSO ME: LEAVING ${pts(worst.deficit)} POINTS ON THE BENCH`),
      split('spiderman pointing at spiderman', `MY STARTERS: ${pts(worst.actual)}`, `MY PERFECT LINEUP: ${pts(worst.optimal)}`),
      v('Pawn Stars Best I Can Do', `${pts(worst.deficit)} POINTS ON MY BENCH`, "BEST I CAN DO")
    ], GIF_QUERIES.bench);
  }

  const unlucky = sorted.find(r => games(r) > 0 && wins(r) === 0 && r.score >= med);
  if (unlucky) {
    add('robbed', 'Robbed', unlucky.manager, [
      v('Disaster Girl', `SCORED ${pts(unlucky.score)}, ${ordinal(rankOf(unlucky.manager))} IN THE LEAGUE`, 'GOT 0 WINS'),
      v('Bad Luck Brian', `SCORES ${pts(unlucky.score)}`, 'GETS 0 WINS'),
      split('Woman Yelling At Cat', `ME: I SCORED ${pts(unlucky.score)}!`, 'THE SCHEDULE: 0 WINS'),
      v("Y'all Got Any More Of That", `${pts(unlucky.score)} POINTS`, "Y'ALL GOT ANY MORE WINS"),
      v('Third World Skeptical Kid', `${pts(unlucky.score)} POINTS, ${ordinal(rankOf(unlucky.manager))} BEST`, 'AND YOU GOT 0 WINS?'),
    v('Grandma Finds The Internet', `${pts(unlucky.score)} POINTS AND 0 WINS`, 'WHERE DO I FILE A COMPLAINT')
    ], GIF_QUERIES.robbed);
  }

  const lucky = [...sorted].reverse().find(r => games(r) === 2 && wins(r) === 2 && r.score < med);
  if (lucky) {
    add('lucky', 'Daylight Robbery', lucky.manager, [
      v('Mocking Spongebob', 'wOn BoTh GaMeS', `wItH ${pts(lucky.score)} pOiNtS`, { alt: true }),
      v('Roll Safe Think About It', 'WIN TWICE', `WITH ${pts(lucky.score)}, BELOW THE MEDIAN`),
      v('Leonardo Dicaprio Cheers', `${lucky.manager} WINS BOTH GAMES`, `WITH ${pts(lucky.score)} POINTS`),
      v('Laughing Leo', `${lucky.manager} SWEEPING WITH ${pts(lucky.score)}`, `THE MEDIAN WAS ${pts(med)}`),
      v('Ancient Aliens', 'WON TWICE', `WITH ${pts(lucky.score)}. ALIENS.`),
    v('Sleeping Shaq', 'LOSING WITH A BELOW-MEDIAN SCORE', `WINNING TWICE WITH ${pts(lucky.score)}`),
    v('Star Wars Yoda', `${pts(lucky.score)} POINTS SWEPT THE WEEK`, 'LUCKY, THE SCHEDULE WAS')
    ], GIF_QUERIES.lucky);
  }

  const vsProjection = rows
    .filter(r => Number.isFinite(pregameScores?.[r.manager]))
    .map(r => ({ ...r, proj: pregameScores[r.manager], delta: r.score - pregameScores[r.manager] }))
    .sort((a, b) => b.delta - a.delta);
  if (vsProjection.length >= 4) {
    const boom = vsProjection[0], bust = vsProjection[vsProjection.length - 1];
    if (boom.delta >= 10) {
      add('boom', 'Boom', boom.manager, [
        v('One Does Not Simply', `ONE DOES NOT SIMPLY BEAT A ${pts(boom.proj)} PROJECTION`, `${up(boom.manager)} SCORED ${pts(boom.score)}`),
        v('Ancient Aliens', `${boom.manager} BEAT PROJECTION BY ${pts(boom.delta)}`, 'ALIENS'),
        v('Roll Safe Think About It', `PROJECTED ${pts(boom.proj)}`, `SCORED ${pts(boom.score)}`),
        v('Leonardo Dicaprio Cheers', `${boom.manager} BEATS THE FORECAST BY ${pts(boom.delta)}`, 'CHEERS'),
        drake('Tuxedo Winnie The Pooh', `SCORING THE PROJECTED ${pts(boom.proj)}`, `SCORING ${pts(boom.score)}`)
      ], GIF_QUERIES.boom);
    }
    if (bust.delta <= -10) {
      add('bust', 'Bust', bust.manager, [
        v('Hide the Pain Harold', `PROJECTED ${pts(bust.proj)}`, `SCORED ${pts(bust.score)}`),
        v('Disaster Girl', `${bust.manager} MISSED PROJECTION BY ${pts(-bust.delta)}`, 'WATCHES IT BURN'),
        v('Bad Luck Brian', `PROJECTED ${pts(bust.proj)}`, `SCORES ${pts(bust.score)}`),
        v('Monkey Puppet', `LOOKING AT A ${pts(bust.proj)} PROJECTION`, `LOOKING AT ${pts(bust.score)}`),
        v('Evil Kermit', 'ME: THE PROJECTION SAYS WE WIN', `ALSO ME: ${pts(bust.score)} POINTS`)
      ], GIF_QUERIES.bust);
    }
  }

  if (week > 1) {
    const prev = { ...(afcSeason?.scoreByWeek?.[week - 1] || {}), ...(nfcSeason?.scoreByWeek?.[week - 1] || {}) };
    const moved = rows
      .filter(r => prev[r.manager] > 0)
      .map(r => ({ ...r, last: prev[r.manager], change: r.score - prev[r.manager] }))
      .sort((a, b) => b.change - a.change);
    if (moved.length >= 4) {
      const jump = moved[0], drop = moved[moved.length - 1];
      if (jump.change >= 15) {
        add('jump', 'Biggest Jump', jump.manager, [
          drake('Drake Hotline Bling', `SCORING ${pts(jump.last)} LAST WEEK`, `SCORING ${pts(jump.score)} THIS WEEK`),
          v('Sleeping Shaq', `${jump.manager} LAST WEEK: ${pts(jump.last)}`, `THIS WEEK: ${pts(jump.score)}`),
          v('Roll Safe Think About It', `${pts(jump.last)} TO ${pts(jump.score)}`, `UP ${pts(jump.change)} POINTS. NOTHING TO FIX`),
          v('Ancient Aliens', `${jump.manager} UP ${pts(jump.change)} POINTS`, 'ALIENS')
        ], GIF_QUERIES.jump);
      }
      if (drop.change <= -15) {
        add('drop', 'Biggest Drop', drop.manager, [
          drake('Drake Hotline Bling', `SCORING ${pts(drop.last)} LAST WEEK`, `SCORING ${pts(drop.score)} THIS WEEK`),
          v('Monkey Puppet', `${pts(drop.last)} LAST WEEK`, `${pts(drop.score)} THIS WEEK`),
          v('This Is Fine', `${drop.manager}: DOWN ${pts(-drop.change)} POINTS`, 'THIS IS FINE'),
          v('Grandma Finds The Internet', `DOWN ${pts(-drop.change)} POINTS FROM LAST WEEK`, 'HOW DO I UNDO THIS')
        ], GIF_QUERIES.drop);
      }
    }
  }

  const close = weeklyAwards?.closest;
  if (close) {
    const w1 = close.sa >= close.sb ? close.a : close.b;
    const w2 = close.sa >= close.sb ? close.b : close.a;
    add('close', 'Nail-Biter', w1, [
      v('Squidward window', `ME WATCHING THE ${pts(close.margin)}-POINT GAME`, `${pts(Math.max(close.sa, close.sb))} TO ${pts(Math.min(close.sa, close.sb))}`),
      split('Batman Slapping Robin', `${w2}: I'M GOING TO WIN`, `${w1}: ${pts(close.margin)}-POINT SLAP`),
      v('Futurama Fry', `NOT SURE IF ${pts(close.margin)}-POINT WIN`, 'OR A GAME NOBODY SLEPT FOR'),
      v('Laughing Leo', `${w1} WINNING BY ${pts(close.margin)}`, `${w2} CHECKING THE SCOREBOARD`),
      split('Woman Yelling At Cat', `${w2} AFTER LOSING BY ${pts(close.margin)}`, `${w1}: IT WAS A GAME`),
    v('Sleeping Shaq', 'A NORMAL GAME', `A ${pts(close.margin)}-POINT GAME`)
    ], GIF_QUERIES.close);
  }

  const blow = weeklyAwards?.blowout;
  if (blow) {
    const w1 = blow.sa >= blow.sb ? blow.a : blow.b;
    const w2 = blow.sa >= blow.sb ? blow.b : blow.a;
    add('blowout', 'Not Even Close', w1, [
      split('Batman Slapping Robin', `${w2}: I HAVE A CHANCE`, `${w1}: ${pts(blow.margin)} POINT MARGIN`),
      v('Ancient Aliens', `${pts(blow.margin)}-POINT BLOWOUT`, 'ALIENS'),
      v("I'm The Captain Now", w1, `${pts(blow.margin)} POINT WIN. I'M THE CAPTAIN NOW`),
      v('Disaster Girl', `${w2} AFTER LOSING BY ${pts(blow.margin)}`, 'SMILES'),
      v('Pawn Stars Best I Can Do', `${w2} OFFERS A COMEBACK`, `${w1}: ${pts(blow.margin)} POINTS. NO.`),
    v('Sleeping Shaq', 'A CLOSE GAME', `A ${pts(blow.margin)}-POINT BLOWOUT`)
    ], GIF_QUERIES.blowout);
  }

  if (waiverWireMvp) {
    const info = playerLabel(playersDB || {}, waiverWireMvp.id);
    add('waiver', 'Waiver Wire MVP', waiverWireMvp.manager, [
      drake('Tuxedo Winnie The Pooh', 'STARTING THE GUY I DRAFTED', `STARTING ${up(info.name)} FROM THE WAIVER WIRE FOR ${pts(waiverWireMvp.points)}`),
      drake('Drake Hotline Bling', 'PAYING FOR A STAR', `PICKING UP ${up(info.name)} FOR ${pts(waiverWireMvp.points)}`),
      v('Oprah You Get A', `YOU GET ${up(info.name)}`, `${pts(waiverWireMvp.points)} POINTS FROM THE WAIVER WIRE`),
      v('Evil Kermit', 'ME: THE WAIVER WIRE IS EMPTY', `ALSO ME: STARTING ${up(info.name)} FOR ${pts(waiverWireMvp.points)}`),
      v('Roll Safe Think About It', "CAN'T HAVE A BAD DRAFT", `IF YOU PICK UP ${up(info.name)}`)
    ], GIF_QUERIES.waiver);
  }

  // Trades made this week (real transactions): first completed trade.
  const trades = (recapTransactions || []).filter(({ tx }) => tx.type === 'trade' && tx.status === 'complete' && tx.leg === week);
  if (trades.length) {
    const { tx, rosterIdMap } = trades[0];
    const sides = (tx.roster_ids || []).map(id => ({
      manager: rosterIdMap?.[id] || `Roster ${id}`,
      got: Object.entries(tx.adds || {}).filter(([, r]) => r === id).map(([pid]) => playerLabel(playersDB || {}, pid).name)
    })).filter(s => s.got.length);
    if (sides.length >= 2) {
      const [a, b] = sides;
      add('trade', 'Trade Desk', a.manager, [
        v('Pawn Stars Best I Can Do', `${a.manager} GETS ${a.got.join(' + ')}`, `${b.manager}: BEST I CAN DO`),
        drake('Drake Hotline Bling', `${b.manager} KEEPING ${b.got.join(' + ')}`, `${a.manager} GETTING ${a.got.join(' + ')}`),
        v('Roll Safe Think About It', "CAN'T LOSE THE TRADE", `IF YOU TRADE FOR ${a.got.join(' + ')}`),
        v('Evil Kermit', 'ME: THE TRADE MARKET IS QUIET', `ALSO ME: TRADING FOR ${a.got.join(' + ')}`)
      ], GIF_QUERIES.trade);
    }
  }

  if (luck?.length >= 2 && luck[0].manager !== luck[luck.length - 1].manager) {
    const lk = luck[0], ul = luck[luck.length - 1];
    add('luckiest', `Luckiest Through Week ${week}`, lk.manager, [
      { template: 'Distracted Boyfriend', layout: 'distracted', labels: ['SKILL', up(lk.manager), `${lk.luck >= 0 ? '+' : ''}${pts(lk.luck)} LP OF LUCK`], top: '', bottom: '' },
      v('Mocking Spongebob', `${lk.manager} HAS ${pts(lk.luck)} LP OF LUCK`, 'iT\'s AlL SkIlL', { alt: true }),
      v('Ancient Aliens', `${lk.manager}: +${pts(lk.luck)} LP OF LUCK`, 'ALIENS')
    ], GIF_QUERIES.luckiest);
    add('unluckiest', `Unluckiest Through Week ${week}`, ul.manager, [
      split('Always Has Been', `WAIT, ${ul.manager} HAS ${pts(ul.luck)} LP OF BAD LUCK?`, 'ALWAYS HAS BEEN'),
      v('Bad Luck Brian', 'PLAYS EVERY WEEK', `${pts(ul.luck)} LP OF BAD LUCK`),
      v('Hide the Pain Harold', `${pts(ul.luck)} LP OF BAD LUCK`, "IT'S FINE"),
      v('Disaster Girl', `${ul.manager} AND THE SCHEDULE`, `${pts(ul.luck)} LP OF BAD LUCK`)
    ], GIF_QUERIES.unluckiest);
  }

  const standings = ['afc', 'nfc'].flatMap(c => Object.entries(standingsHistory?.[c] || {}).map(([manager, weeks]) => {
    const at = weeks.find(w => w.week === week);
    return at ? { manager, pts: at.pts, pf: at.pf } : null;
  })).filter(Boolean).sort((x, y) => y.pts - x.pts || y.pf - x.pf);
  if (standings.length >= 6) {
    const first = standings[0], last = standings[standings.length - 1];
    add('first', 'League Leader', first.manager, [
      v("I'm The Captain Now", first.manager, `${pts(first.pts)} LP. I'M THE CAPTAIN NOW`),
      v('Leonardo Dicaprio Cheers', `CHEERS TO ${first.manager}`, `#1 WITH ${pts(first.pts)} LP`),
      v('Roll Safe Think About It', "CAN'T MISS THE PLAYOFFS", `IF YOU'RE #1 WITH ${pts(first.pts)} LP`),
      v('Laughing Leo', `${first.manager} AT THE TOP`, `${pts(first.pts)} LP. EVERYONE ELSE IS BELOW`)
    ], GIF_QUERIES.first);
    add('last', 'Basement Dweller', last.manager, [
      v('This Is Fine', `${last.manager}: ${pts(last.pts)} LP`, 'THIS IS FINE'),
      v('Waiting Skeleton', `ME WAITING FOR A PLAYOFF SPOT WITH ${pts(last.pts)} LP`, 'STILL WAITING'),
      v('Hide the Pain Harold', `${pts(last.pts)} LP THROUGH WEEK ${week}`, "FINE. I'M FINE."),
      v('Monkey Puppet', `LOOKING AT ${pts(last.pts)} LP`, 'THEN LOOKING AT THE STANDINGS')
    ], GIF_QUERIES.last);
  }

  // Best and worst players of the week: real starters, with the team that started them.
  const ownerOf = (id) => {
    for (const [data, season] of [[afcData, afcSeason], [nfcData, nfcSeason]]) {
      for (const r of data?.rosters || []) {
        if (season?.rosterSnapshotByWeek?.[week]?.[r.manager]?.starters?.includes(id)) return r.manager;
      }
    }
    return null;
  };
  const playerInfo = (entry) => {
    if (!entry) return null;
    const info = playerLabel(playersDB || {}, entry.id);
    const owner = ownerOf(entry.id);
    return owner && info.name && !info.name.startsWith('Player ') ? { ...entry, name: info.name, owner, search: `${info.name} ${info.team || ''}`.trim() } : null;
  };
  const star = playerInfo(playerHighlights?.highestActual);
  const riser = playerInfo(playerHighlights?.biggestRiser);
  const bust = playerInfo(playerHighlights?.biggestBust);
  if (star) {
    const N = up(star.name);
    add('playerTop', `Player of the Week: ${star.name}`, star.owner, [
      v('Leonardo Dicaprio Cheers', `CHEERS TO ${N}`, `${pts(star.actual)} POINTS FOR ${up(star.owner)}`),
      drake('Drake Hotline Bling', `BENCHING ${N}`, `STARTING ${N} FOR ${pts(star.actual)}`),
      v('Oprah You Get A', `YOU GET ${pts(star.actual)} POINTS`, `${N} GETS ${pts(star.actual)} POINTS`),
      v('Roll Safe Think About It', `CAN'T LOSE THE WEEK`, `IF YOU START ${N}`),
      v('Absolute Cinema', `${N}: ${pts(star.actual)} POINTS`, 'ABSOLUTE CINEMA')
    ], [`${star.search} touchdown`, star.search, `${star.name} celebration`]);
  }
  if (riser && (!star || riser.id !== star.id)) {
    const N = up(riser.name);
    add('playerRiser', `Biggest Riser: ${riser.name}`, riser.owner, [
      v('One Does Not Simply', `ONE DOES NOT SIMPLY BEAT A ${pts(riser.projected)} PROJECTION`, `${N} SCORED ${pts(riser.actual)}`),
      v('Ancient Aliens', `${N} BEAT PROJECTION BY ${pts(riser.actual - riser.projected)}`, 'ALIENS'),
      v('Sleeping Shaq', `${N} PROJECTED ${pts(riser.projected)}`, `${N} SCORED ${pts(riser.actual)}`),
      drake('Tuxedo Winnie The Pooh', `PROJECTING ${N} FOR ${pts(riser.projected)}`, `${N} SCORING ${pts(riser.actual)}`)
    ], [`${riser.search} touchdown`, riser.search, `${riser.name} highlights`]);
  }
  if (bust) {
    const N = up(bust.name);
    add('playerBust', `Biggest Bust: ${bust.name}`, bust.owner, [
      v('Hide the Pain Harold', `${N} PROJECTED ${pts(bust.projected)}`, `${N} SCORED ${pts(bust.actual)}`),
      v('Disaster Girl', `${up(bust.owner)} STARTED ${N}`, `${pts(bust.actual)} POINTS`),
      v('Monkey Puppet', `STARTING ${N}`, `${pts(bust.actual)} POINTS, ${pts(bust.projected - bust.actual)} UNDER PROJECTION`),
      v('This Is Fine', `${N}: ${pts(bust.actual)} POINTS`, 'THIS IS FINE'),
      v('Bad Luck Brian', `STARTS ${N}`, `${pts(bust.actual)} POINTS`)
    ], [`${bust.search} fail`, `${bust.search}`, `${bust.name} sad`]);
  }

  // One-man show: the team whose best starter scored the biggest share of its points.
  const carry = lineups
    .filter(l => l.best && l.total > 0 && l.best.pts >= 20)
    .map(l => ({ ...l, share: l.best.pts / l.total, rest: l.total - l.best.pts }))
    .sort((a, b) => b.share - a.share)[0];
  if (carry && carry.share >= 0.35 && carry.best.id !== star?.id) {
    const P = carry.best, pct = Math.round(carry.share * 100);
    add('carry', 'One-Man Show', carry.manager, [
      v('Sleeping Shaq', `THE REST OF ${carry.manager}'S LINEUP`, `${N(P)}: ${pts(P.pts)} POINTS`),
      drake('Drake Hotline Bling', 'A BALANCED LINEUP', `${N(P)} SCORING ${pct}% OF THE POINTS`),
      v('Oprah You Get A', `${N(P)} GETS ${pts(P.pts)}`, `THE OTHER STARTERS GET ${pts(carry.rest)} COMBINED`),
      v('Roll Safe Think About It', "CAN'T NEED A LINEUP", `IF ${N(P)} SCORES ${pct}% OF YOUR POINTS`)
    ], [`${P.name} ${P.team || ''}`.trim(), 'carrying the team', 'one man army', 'doing all the work']);
  }

  // Dud of the week: the lowest-scoring named starter in the league (3 points or fewer), unless
  // it's the player already shown as the biggest bust.
  const dud = lineups.flatMap(l => l.starters.map(s => ({ ...s, manager: l.manager })))
    .sort((a, b) => a.pts - b.pts)[0];
  if (dud && dud.pts <= 3 && dud.id !== bust?.id) {
    add('dud', 'Dud of the Week', dud.manager, [
      v('Surprised Pikachu', `${dud.manager} STARTS ${N(dud)}`, `${N(dud)} SCORES ${pts(dud.pts)}`),
      v('Hide the Pain Harold', `STARTED ${N(dud)}`, `${pts(dud.pts)} POINTS. FINE.`),
      v('Bad Luck Brian', `STARTS ${N(dud)}`, `GETS ${pts(dud.pts)} POINTS`),
      v('This Is Fine', `${N(dud)}: ${pts(dud.pts)} POINTS`, 'THIS IS FINE'),
      split('Woman Yelling At Cat', `${dud.manager}: ${N(dud)} IS A STARTER!`, `${N(dud)}: ${pts(dud.pts)} POINTS`)
    ], [`${dud.name} ${dud.team || ''} fail`.trim(), 'zero', 'nothing', 'empty']);
  }

  // Variety: each card opens on a template no card above it already used, when it has one.
  // `first` is that opening variant; the tab falls back to the week pick if it's unavailable.
  const used = new Set();
  situations.forEach(s => {
    const n = s.variants.length, base = pickIndex(week, s.key, n);
    const at = Array.from({ length: n }, (_, i) => (base + i) % n).find(i => !used.has(s.variants[i].template)) ?? base;
    s.first = s.variants[at];
    used.add(s.first.template);
  });

  return { week, situations };
}
