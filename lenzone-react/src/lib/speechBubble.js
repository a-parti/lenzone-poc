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

function fill(line, name, team) {
  return line.replace(/\{name\}/g, name).replace(/\{team\}/g, team);
}
function pickFrom(pool, name, team) {
  return fill(pool[Math.floor(Math.random() * pool.length)], name, team);
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
// 'W'|'L'|'T' }. trophyLines/weekResult are real, already-computed facts about this manager this
// week (a trophy actually won, or whether they're actually winning/losing right now) -- built
// from weeklyAwards/standings/live-score data, never invented here; only the surrounding JOKE
// text is free-written.
export function pickSpeechBubbleLine(realName, manager, trophyContext = {}) {
  if (!realName) return null;
  // Custom per-manager lines (lib/speechBubbleOverrides.js) always win -- if someone's been
  // given their own specific material, that's what should show, not a generic trophy/rank line.
  const overrides = MANAGER_OVERRIDES[manager];
  if (overrides && overrides.length > 0) {
    return pickFrom(overrides, realName, manager);
  }
  const { trophyLines, rank, conf, weekResult } = trophyContext;
  if (trophyLines && trophyLines.length > 0) {
    const trophy = trophyLines[Math.floor(Math.random() * trophyLines.length)];
    const frame = TROPHY_FRAMES[Math.floor(Math.random() * TROPHY_FRAMES.length)];
    return fill(frame, realName, manager).replace('{trophy}', trophy);
  }
  // ~40% chance to riff on the real live win/loss state when we have one, ~25% to mention real
  // standing, otherwise a generic joke -- keeps the ambient bubbles varied rather than always
  // defaulting to whichever real signal happens to be available.
  const roll = Math.random();
  if (weekResult && roll < 0.4) {
    const pool = weekResult === 'W' ? WINNING_LINES : weekResult === 'L' ? LOSING_LINES : TIE_LINES;
    return pickFrom(pool, realName, manager);
  }
  if (rank != null && conf && roll < 0.65) {
    const frame = RANK_FRAMES[Math.floor(Math.random() * RANK_FRAMES.length)];
    return fill(frame, realName, manager).replace('{rank}', rank).replace('{conf}', conf);
  }
  return pickFrom(GENERIC_LINES, realName, manager);
}

// Builds each manager's list of real, true-this-week trophy call-outs from already-computed
// awards/standings data (never fabricated) -- e.g. weeklyAwards.highScore.manager gets
// "put up the week's High Score!". Call once per data load, share across RosterModal + RandomNameBubble.
export function buildTrophyLinesByManager({ weeklyAwards, benchPointsAward, afcStandings, nfcStandings }) {
  const lines = {};
  const add = (manager, text) => {
    if (!manager) return;
    if (!lines[manager]) lines[manager] = [];
    lines[manager].push(text);
  };
  if (weeklyAwards) {
    add(weeklyAwards.highScore?.manager, "put up the week's High Score!");
    add(weeklyAwards.lowScore?.manager, "took home this week's Low Score. Rough one.");
    if (weeklyAwards.closest) {
      add(weeklyAwards.closest.a, "was in the week's Closest Game.");
      add(weeklyAwards.closest.b, "was in the week's Closest Game.");
    }
    if (weeklyAwards.blowout) {
      const winner = weeklyAwards.blowout.sa > weeklyAwards.blowout.sb ? weeklyAwards.blowout.a : weeklyAwards.blowout.b;
      add(winner, "delivered this week's Biggest Blowout.");
    }
  }
  if (benchPointsAward) {
    add(benchPointsAward.manager, "left the most points on the bench this week. Ouch.");
  }
  return lines;
}

// Current conference rank for a manager, from the already-computed standings lists.
export function findRankAndConf(manager, afcStandings, nfcStandings) {
  const afc = afcStandings?.find(r => r.manager === manager);
  if (afc) return { rank: afc.rank, conf: "AFC" };
  const nfc = nfcStandings?.find(r => r.manager === manager);
  if (nfc) return { rank: nfc.rank, conf: "NFC" };
  return { rank: null, conf: null };
}
