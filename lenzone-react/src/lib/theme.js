// Conferences use the two palette accents: AFC = sunset coral, NFC = sea teal (see --afc/--nfc in
// index.css, tuned per light/dark mode).
export const CONF_STYLES = {
  AFC: {
    text: "text-[var(--afc)]",
    badge: "bg-[var(--afc)]/12 text-[var(--afc)] border border-[var(--afc)]/35",
    border: "border-[var(--afc)]/35",
    button: "bg-[var(--afc)] hover:opacity-90",
    bar: "bg-[var(--afc)]"
  },
  NFC: {
    text: "text-[var(--nfc)]",
    badge: "bg-[var(--nfc)]/12 text-[var(--nfc)] border border-[var(--nfc)]/35",
    border: "border-[var(--nfc)]/35",
    button: "bg-[var(--nfc)] hover:opacity-90",
    bar: "bg-[var(--nfc)]"
  }
};

// Position tags, drawn from the same palette tokens rather than a separate rainbow.
export const POSITION_STYLES = {
  QB: "bg-[var(--neg)]/12 text-[var(--neg)] border border-[var(--neg)]/25",
  RB: "bg-[var(--pos)]/12 text-[var(--pos)] border border-[var(--pos)]/25",
  WR: "bg-[var(--proj)]/12 text-[var(--proj)] border border-[var(--proj)]/25",
  TE: "bg-[var(--live)]/12 text-[var(--live)] border border-[var(--live)]/25",
  FLEX: "bg-[var(--accent)]/12 text-[var(--accent)] border border-[var(--accent)]/25",
  K: "bg-[var(--coral)]/12 text-[var(--coral)] border border-[var(--coral)]/25",
  DEF: "bg-[var(--surface2)] text-[var(--text2)] border border-[var(--border2)]",
  BN: "bg-[var(--surface2)] text-[var(--muted)] border border-[var(--border)]"
};

export function positionStyle(pos) {
  return POSITION_STYLES[pos] || POSITION_STYLES.BN;
}

// The states a point total can be in: still projected (game hasn't started); live (a real number
// that's still accumulating mid-game -- its own amber, since it's neither a stable projection nor
// a settled result yet); or final, which itself reads as green (beat the pregame projection) or
// red (fell short of it) rather than a flat "it's over" color -- "final" alone doesn't say whether
// that was good news, and beat/missed projection is the number people actually care about once a
// game is done. When there's no projection to compare against (Sleeper's own projections feed is
// sparse for kickers/defenses especially), falls back to a neutral color rather than green --
// green there would silently assert "beat projection" with no data behind it.
export const SCORE_COLOR = {
  proj: "text-[var(--proj)]",
  live: "text-[var(--live)]",
  final: "text-[var(--text)]",
  "final-pos": "text-[var(--pos)]",
  "final-neg": "text-[var(--neg)]"
};

export function scoreState({ hasActual, isLive, actual, projected }) {
  if (!hasActual) return "proj";
  if (isLive) return "live";
  if (actual != null && projected != null) return actual >= projected ? "final-pos" : "final-neg";
  return "final";
}
