// Matches real NFL branding convention: AFC = red, NFC = blue.
export const CONF_STYLES = {
  AFC: {
    text: "text-red-400",
    badge: "bg-red-500/10 text-red-400 border border-red-500/30",
    border: "border-red-500/30",
    button: "bg-red-600 hover:bg-red-500",
    bar: "bg-red-500"
  },
  NFC: {
    text: "text-blue-400",
    badge: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
    border: "border-blue-500/30",
    button: "bg-blue-600 hover:bg-blue-500",
    bar: "bg-blue-500"
  }
};

// Standard fantasy-position color convention (not a pixel-exact match to Sleeper's own palette,
// which isn't publicly documented) -- used anywhere a position tag is shown.
export const POSITION_STYLES = {
  QB: "bg-red-500/10 text-red-400 border border-red-500/20",
  RB: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  WR: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  TE: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  FLEX: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
  K: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  DEF: "bg-stone-500/10 text-stone-400 border border-stone-500/20",
  BN: "bg-slate-500/10 text-slate-500 border border-slate-500/20"
};

export function positionStyle(pos) {
  return POSITION_STYLES[pos] || POSITION_STYLES.BN;
}

// The three states a point total can be in: still projected (game hasn't started), live (a real
// number that's still accumulating mid-game), or final (the game is over, the number won't move
// again). Kept as one shared mapping so "green means final/locked-in" reads consistently everywhere
// points are shown, instead of live and final both showing as the same green.
export const SCORE_COLOR = {
  proj: "text-[var(--proj)]",
  live: "text-[var(--live)]",
  final: "text-[var(--pos)]"
};

export function scoreState({ hasActual, isLive }) {
  if (!hasActual) return "proj";
  return isLive ? "live" : "final";
}
