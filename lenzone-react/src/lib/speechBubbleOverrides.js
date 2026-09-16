// EDIT THIS FILE to give a specific manager their own custom speech-bubble lines.
//
// Key = their TEAM NAME exactly as it appears on Sleeper/the site right now (the same string
// shown next to their logo everywhere in the app -- e.g. "Daejon Mustard, allegedly", not their
// real name). If a manager renames their team on Sleeper, update the key here to match.
//
// Value = an array of one or more lines. Use {name} for their real name (from lib/realNames.js)
// and {team} for their team name -- both get swapped in automatically. Pick ONE at random each
// time their bubble fires if you list more than one.
//
// When a manager has an entry here, it's used INSTEAD of everything else (generic jokes, trophy
// call-outs, win/loss flavor, rank) -- so this is the place for fully custom, specific-to-them
// material. Leave a manager out entirely to fall back to the normal pool.
//
// Example (uncomment and edit):
// export const MANAGER_OVERRIDES = {
//   "Daejon Mustard, allegedly": [
//     "I'm {name} — {team} drafted a kicker in the third round and has no regrets.",
//     "{name} here. {team} is built different. Mostly worse, but different."
//   ],
//   "Hall & Oates  ": [
//     "I'm {name} — {team} really is going to make your dreams come true."
//   ]
// };

export const MANAGER_OVERRIDES = {};
