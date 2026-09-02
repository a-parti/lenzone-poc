export const CONF_STYLES = {
  AFC: {
    text: "text-blue-400",
    badge: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
    border: "border-blue-500/30",
    button: "bg-blue-600 hover:bg-blue-500",
    bar: "bg-blue-500"
  },
  NFC: {
    text: "text-rose-400",
    badge: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
    border: "border-rose-500/30",
    button: "bg-rose-600 hover:bg-rose-500",
    bar: "bg-rose-500"
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
