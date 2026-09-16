// Shared speech-bubble copy, used by both RosterModal's own bubble and the ambient
// RandomNameBubble -- previously each hardcoded the same flat "I'm {realName}" text
// independently. Now both pull from the same pool, and both can surface something REAL and
// specific (a trophy this manager actually won this week, whether they're winning/losing right
// now, or their real current conference rank) instead of always falling back to a generic line.
// Framing is deliberately varied (not always "I'm {name} —") -- a wall of bubbles that all open
// the exact same way reads as a template, not a personality.
//
// Want a specific manager to say their own specific stuff? Edit lib/speechBubbleOverrides.js --
// that file takes priority over everything below, no changes needed here.
import { MANAGER_OVERRIDES } from './speechBubbleOverrides';

// Playful flavor text only -- never a factual claim about the real person, just their fictional
// fantasy team. Safe to write freely (no sourcing needed for a joke), unlike the trophy/rank/result
// lines below which must only ever state things that are actually true this week.
const GENERIC_LINES = [
  "I'm {name} — {team} isn't done rebuilding, I promise.",
  "{team} plays the waiver wire like a chess match. Badly.",
  "{name} here. {team} definitely has a plan. Definitely.",
  "{team}'s championship window opens real soon now.",
  "Ask me about {team} literally any other week.",
  "{team} is a rebuild, a reload, and a cry for help, in that order.",
  "{team} watches film. Sometimes the wrong film.",
  "{name} would like everyone to stop bringing up last season.",
  "{team} trusts the process. The process has not earned that trust.",
  "{team}'s draft strategy is best described as 'vibes'.",
  "{team} reads the group chat more than the injury report.",
  "I'm {name}, proud owner of {team}. Emotionally, financially invested. Mostly emotionally.",
  "{team} is one lucky Monday night away from a completely different vibe.",
  "Breaking: {team} has once again done something.",
  "{name}'s lineup decisions this week were 'a choice'.",
  "Somewhere, {team}'s bench is outscoring {team}'s starters. Again.",
  "{team}: still mathematically alive. That's the whole update.",
  "{name} refreshes the scoreboard every 4 minutes. It's fine.",
  "{team} has a guy for that. {name} won't say who."
];

// True-this-week win/loss flavor -- still just jokes (never invents the SCORE or OUTCOME itself,
// which comes from real computed data via weekResult), just the tone around a real result.
const WINNING_LINES = [
  "I'm {name} — {team} is winning right now and, frankly, insufferable about it.",
  "{team}'s up this week. Enjoy it, it's usually not like this.",
  "{team} is winning and already trash-talking the group chat.",
  "{name} says everything is currently correct, actually, since {team} is ahead.",
  "Winning! {team} would like this posted in the group chat immediately.",
  "{team} peaked at the right time this week. Suspicious, but we'll allow it."
];
const LOSING_LINES = [
  "I'm {name} — {team} is losing and would like to talk about anything else.",
  "{team}'s down this week. It's the refs. It's always the refs.",
  "{team} is getting cooked right now, no notes.",
  "{name} says the bench looked GREAT on paper this week. The bench did not play.",
  "{team} is losing, but on the bright side, the season is very long.",
  "Down bad. {team} is currently down bad."
];
const TIE_LINES = [
  "{team} is tied right now, which is somehow the most stressful outcome.",
  "I'm {name} — a tie. Nobody involved feels good about this."
];

// Real MULTI-WEEK streak flavor (2+ games, from computeManagerStreaks) -- distinct from
// WINNING/LOSING_LINES above, which only ever know about THIS week in isolation. A 4-game skid
// reads very differently than "lost this week", so this gets its own pool.
const WIN_STREAK_LINES = [
  "I'm {name} — {team} has won {count} straight. Building a dynasty, or a fluke. TBD.",
  "{team} is riding a {count}-game win streak and will not shut up about it.",
  "{count} in a row for {team}. {name} has never been more insufferable."
];
const LOSE_STREAK_LINES = [
  "I'm {name} — {team} has dropped {count} straight. It's fine. It's all fine.",
  "{team} is on a {count}-game losing streak. {name} says the schedule is rigged.",
  "{count} straight losses for {team}. {name} is 'due for one' any week now."
];

function fill(line, name, team) {
  return line.replace(/\{name\}/g, name).replace(/\{team\}/g, team);
}
function pickFrom(pool, name, team) {
  return fill(pool[Math.floor(Math.random() * pool.length)], name, team);
}

// Each manager gets a STABLE personality (same one every time, not re-rolled per bubble) that
// flavors whatever real content they're saying -- rather than rewriting every single line in
// every voice (an enormous, hard-to-maintain content matrix), each persona is a light wrapper:
// an opening interjection, an occasional mid-line aside, and a sign-off, layered onto the same
// real, fact-based content everything else in this file already produces. Assigned by a simple
// stable hash of the team name, so a given team always talks the same way, but not every team
// sounds identical to each other.
const PERSONAS = [
  {
    key: 'surfer',
    openers: ["Duuude — ", "Yo — ", "Bro, "],
    asides: [" (totally gnarly, no cap)", ", stoked either way", ", pretty gnarly ngl"],
    signoffs: [" 🤙", " Catch ya on the flip side.", " Stay stoked."]
  },
  {
    key: 'corporate',
    openers: ["Per my last update: ", "Circling back — ", "Quick sync: "],
    asides: [", per the deck", ", pending stakeholder review", " — flagging for visibility"],
    signoffs: [" Let's take this offline.", " Looping in the group chat.", " Best, management."]
  },
  {
    key: 'robot',
    openers: ["BEEP. ", "SYSTEM STATUS: ", "PROCESSING... "],
    asides: [" [DATA CONFIRMED]", " [PROBABILITY: NONZERO]", " [RECALCULATING]"],
    signoffs: [" END TRANSMISSION.", " BEEP BOOP.", " 010101."]
  },
  {
    key: 'pirate',
    openers: ["Arrr — ", "Shiver me timbers, ", "Yarrr, "],
    asides: [", says I", ", by the code of the sea", ", arr"],
    signoffs: [" Yo ho.", " To Davy Jones with the rest.", " Arrr."]
  },
  {
    key: 'valley',
    openers: ["Okay but like — ", "Ohmygod, ", "So, "],
    asides: [", like, literally", ", I can't even", ", no but for real"],
    signoffs: [" So random.", " Anyway.", " Bye!"]
  },
  {
    key: 'noir',
    openers: ["The name's {name}. ", "It was a rainy Tuesday. ", "Word on the street: "],
    asides: [", if you believe the rumors", ", in this town", ", for what it's worth"],
    signoffs: [" That's the story, and I'm stickin' to it.", " Case closed.", " The rest is history."]
  },
  {
    key: 'southern',
    openers: ["Well butter my biscuit — ", "Bless their heart, ", "Well I'll be, "],
    asides: [", if I do say so myself", ", sweet tea and all", ", y'all"],
    signoffs: [" Y'all take care now.", " That's just how it is."]
  },
  {
    key: 'coach',
    openers: ["ALRIGHT TEAM — ", "LISTEN UP — ", "HERE'S THE PLAY — "],
    asides: [", that's fundamentals", ", run it back", ", eye on the ball"],
    signoffs: [" Now hustle!", " That's how we do it.", " Let's GO."]
  }
];

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function personaFor(manager) {
  return PERSONAS[hashString(manager || '') % PERSONAS.length];
}
function applyPersona(text, manager) {
  const persona = personaFor(manager);
  let out = text;
  if (Math.random() < 0.8) {
    const opener = persona.openers[Math.floor(Math.random() * persona.openers.length)];
    out = opener + out.charAt(0).toLowerCase() + out.slice(1);
  }
  if (persona.asides.length && Math.random() < 0.4) {
    // Insert the aside right before the first sentence-ending punctuation, so it reads as a
    // clause tucked into the sentence rather than always tacked on the very end.
    const idx = out.search(/[.!?]/);
    const aside = persona.asides[Math.floor(Math.random() * persona.asides.length)];
    out = idx >= 0 ? out.slice(0, idx) + aside + out.slice(idx) : out + aside;
  }
  if (Math.random() < 0.5) {
    out += persona.signoffs[Math.floor(Math.random() * persona.signoffs.length)];
  }
  return out;
}

// Varied framings for a real, already-computed trophy call-out (e.g. "put up the week's High
// Score!") -- the trophy TEXT itself is always real, only the sentence wrapped around it varies.
const TROPHY_FRAMES = [
  "I'm {name} — {team} {trophy}",
  "{team} {trophy}",
  "Update: {team} {trophy}",
  "{name} here to confirm {team} {trophy}"
];
// Varied framings for the real current conference rank.
const RANK_FRAMES = [
  "I'm {name}, #{rank} in the {conf}.",
  "{team} sits at #{rank} in the {conf} right now.",
  "#{rank} in the {conf}. {name} is at peace with this.",
  "{team}: currently #{rank} in the {conf}, for better or worse."
];

// trophyContext (optional): { trophyLines?: string[], rank?: number, conf?: string, weekResult?:
// 'W'|'L'|'T', streak?: {type:'W'|'L', count:number}, revengeGame?: {opponent, priorWeek, won} }.
// trophyLines/weekResult/streak/revengeGame are real, already-computed facts about this manager (a
// trophy actually won, whether they're actually winning/losing right now, a real multi-week
// streak, or a real rematch of an earlier loss/win this season) -- built from weeklyAwards/
// standings/live-score/schedule data, never invented here; only the surrounding JOKE text is
// free-written. The finished line is always run through this manager's stable persona (see
// PERSONAS above) before returning, EXCEPT for hand-written overrides -- those are used verbatim,
// since someone who bothered to write a manager's own specific lines meant them exactly as written.
export function pickSpeechBubbleLine(realName, manager, trophyContext = {}) {
  if (!realName) return null;
  // Custom per-manager lines (lib/speechBubbleOverrides.js) always win -- if someone's been
  // given their own specific material, that's what should show, not a generic trophy/rank line.
  const overrides = MANAGER_OVERRIDES[manager];
  if (overrides && overrides.length > 0) {
    return pickFrom(overrides, realName, manager);
  }
  const { trophyLines, rank, conf, weekResult, streak, revengeGame } = trophyContext;
  let line;
  if (trophyLines && trophyLines.length > 0) {
    const trophy = trophyLines[Math.floor(Math.random() * trophyLines.length)];
    const frame = TROPHY_FRAMES[Math.floor(Math.random() * TROPHY_FRAMES.length)];
    line = fill(frame, realName, manager).replace('{trophy}', trophy);
  } else {
    // Priority when more than one real signal exists this tick: revenge game (~25%, the most
    // specific/fun one), streak (~25%), this week's result (~25%), standing (~15%), else generic.
    const roll = Math.random();
    if (revengeGame && roll < 0.25) {
      const pool = revengeGame.won ? REVENGE_LINES_FOR_WINNER : REVENGE_LINES_FOR_LOSER;
      line = fill(pool[Math.floor(Math.random() * pool.length)], realName, manager)
        .replace(/\{opponent\}/g, revengeGame.opponent).replace(/\{priorWeek\}/g, revengeGame.priorWeek);
    } else if (streak && roll < 0.5) {
      const pool = streak.type === 'W' ? WIN_STREAK_LINES : LOSE_STREAK_LINES;
      line = fill(pool[Math.floor(Math.random() * pool.length)], realName, manager).replace(/\{count\}/g, streak.count);
    } else if (weekResult && roll < 0.75) {
      const pool = weekResult === 'W' ? WINNING_LINES : weekResult === 'L' ? LOSING_LINES : TIE_LINES;
      line = pickFrom(pool, realName, manager);
    } else if (rank != null && conf && roll < 0.9) {
      const frame = RANK_FRAMES[Math.floor(Math.random() * RANK_FRAMES.length)];
      line = fill(frame, realName, manager).replace('{rank}', rank).replace('{conf}', conf);
    } else {
      line = pickFrom(GENERIC_LINES, realName, manager);
    }
  }
  return applyPersona(line, manager);
}

// Builds each manager's list of real, true trophy call-outs from already-computed awards/standings
// data (never fabricated) -- e.g. weeklyAwards.highScore.manager gets "put up the week's High
// Score!". `label` lets the same builder produce either "this week" or "last week" phrasing (see
// App.jsx, which calls this twice -- current week + previous week -- and merges both maps, so
// bubbles can riff on either). Call once per data load, share across RosterModal + RandomNameBubble.
export function buildTrophyLinesByManager({ weeklyAwards, benchPointsAward, label = "this week" }) {
  const lines = {};
  const add = (manager, text) => {
    if (!manager) return;
    if (!lines[manager]) lines[manager] = [];
    lines[manager].push(text);
  };
  if (weeklyAwards) {
    add(weeklyAwards.highScore?.manager, `put up ${label}'s High Score!`);
    add(weeklyAwards.lowScore?.manager, `took home ${label}'s Low Score. Rough one.`);
    if (weeklyAwards.closest) {
      add(weeklyAwards.closest.a, `was in ${label}'s Closest Game.`);
      add(weeklyAwards.closest.b, `was in ${label}'s Closest Game.`);
    }
    if (weeklyAwards.blowout) {
      const winner = weeklyAwards.blowout.sa > weeklyAwards.blowout.sb ? weeklyAwards.blowout.a : weeklyAwards.blowout.b;
      add(winner, `delivered ${label}'s Biggest Blowout.`);
    }
  }
  if (benchPointsAward) {
    add(benchPointsAward.manager, `left the most points on the bench ${label}. Ouch.`);
  }
  return lines;
}

// Merges any number of {manager: [lines]} maps (e.g. this week's + last week's trophy lines)
// into one combined map so pickSpeechBubbleLine can pick randomly across all of them.
export function mergeTrophyLines(...maps) {
  const merged = {};
  maps.forEach(map => {
    Object.entries(map || {}).forEach(([manager, lines]) => {
      if (!merged[manager]) merged[manager] = [];
      merged[manager].push(...lines);
    });
  });
  return merged;
}

// A real revenge-game callout: this manager's opponent this week already beat (or lost to) them
// earlier this season. `revengeGame`: { opponent, priorWeek, won: boolean } for THIS manager.
const REVENGE_LINES_FOR_LOSER = [
  "I'm {name} — {team} lost to {opponent} in Week {priorWeek}. Revenge game.",
  "{team} owes {opponent} one from Week {priorWeek}. Today's the day. Probably not, but today's the day.",
  "I'm {name}. {team} has been thinking about Week {priorWeek} against {opponent} ever since."
];
const REVENGE_LINES_FOR_WINNER = [
  "I'm {name} — {team} already beat {opponent} once this season (Week {priorWeek}). Running it back.",
  "{team} has {opponent}'s number. Week {priorWeek} says so, anyway."
];

// Current conference rank for a manager, from the already-computed standings lists.
export function findRankAndConf(manager, afcStandings, nfcStandings) {
  const afc = afcStandings?.find(r => r.manager === manager);
  if (afc) return { rank: afc.rank, conf: "AFC" };
  const nfc = nfcStandings?.find(r => r.manager === manager);
  if (nfc) return { rank: nfc.rank, conf: "NFC" };
  return { rank: null, conf: null };
}
