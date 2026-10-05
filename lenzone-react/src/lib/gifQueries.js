// The Giphy searches behind each meme-board story. Only run when an admin saves a week's picks
// (local dev), which become src/data/gifs/week-N.json; the live site never calls Giphy.
export const GIF_QUERIES = {
  top: ["touchdown celebration", "mic drop", "victory dance", "champion", "king"],
  cellar: ["sad waiting", "facepalm", "this is fine fire", "crying", "disappointed", "nope"],
  bench: ["this is fine fire", "facepalm", "oops", "my bad", "bench warmer"],
  robbed: ["robbed", "angry referee", "unfair", "rigged", "shocked"],
  lucky: ["lucky", "got away with it", "sneaky", "whistling", "phew"],
  boom: ["boom", "explosion", "mind blown", "stonks", "unstoppable"],
  bust: ["bust", "fail", "sad trombone", "face palm", "disaster"],
  jump: ["glow up", "level up", "rocket", "comeback", "transformation"],
  drop: ["falling", "crash", "plummet", "downhill", "tumble"],
  close: ["nail biting", "tense", "sweating", "close call", "edge of seat"],
  blowout: ["blowout", "destroyed", "knockout", "flawless victory", "steamroll"],
  waiver: ["found it", "treasure", "jackpot", "bargain", "shopping"],
  trade: ["trade", "deal", "handshake", "negotiating", "shake on it"],
  luckiest: ["lucky", "four leaf clover", "jackpot", "wink"],
  unluckiest: ["bad luck", "unlucky", "rain on me", "dark cloud", "cursed"],
  first: ["number one", "champion", "crown", "winning", "on top"],
  last: ["last place", "sad", "rock bottom", "giving up", "shrug"],
};
