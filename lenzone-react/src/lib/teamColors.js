// 12 visually distinct colors, one per draft slot. Applied per-conference (so an AFC team and an
// NFC team can share a color) based on real draft position -- not global uniqueness across all 24 teams.
export const TEAM_COLOR_PALETTE = [
  { text: "text-red-400", border: "border-red-500/30" },
  { text: "text-orange-400", border: "border-orange-500/30" },
  { text: "text-amber-400", border: "border-amber-500/30" },
  { text: "text-lime-400", border: "border-lime-500/30" },
  { text: "text-emerald-400", border: "border-emerald-500/30" },
  { text: "text-teal-400", border: "border-teal-500/30" },
  { text: "text-cyan-400", border: "border-cyan-500/30" },
  { text: "text-sky-400", border: "border-sky-500/30" },
  { text: "text-indigo-400", border: "border-indigo-500/30" },
  { text: "text-violet-400", border: "border-violet-500/30" },
  { text: "text-fuchsia-400", border: "border-fuchsia-500/30" },
  { text: "text-pink-400", border: "border-pink-500/30" }
];

// Same 12 colors as TEAM_COLOR_PALETTE above, same order, just as real hex values (the Tailwind
// "-400" shade) instead of class names -- SVG `stroke`/`fill` can't consume a Tailwind class, so
// the trend chart needs the actual color. Keep these two arrays in lockstep by hand; they're
// small and rarely change.
export const TEAM_COLOR_HEX_PALETTE = [
  "#f87171", // red-400
  "#fb923c", // orange-400
  "#fbbf24", // amber-400
  "#a3e635", // lime-400
  "#34d399", // emerald-400
  "#2dd4bf", // teal-400
  "#22d3ee", // cyan-400
  "#38bdf8", // sky-400
  "#818cf8", // indigo-400
  "#a78bfa", // violet-400
  "#e879f9", // fuchsia-400
  "#f472b6"  // pink-400
];

// Real draft_slot (1-12) per manager, from actual Sleeper draft picks -- not invented.
export function getDraftSlotMap(draft, rosterIdMap) {
  const map = {};
  (draft?.picks || []).forEach(p => {
    const manager = rosterIdMap[p.roster_id];
    if (manager && p.draft_slot && !(manager in map)) map[manager] = p.draft_slot;
  });
  return map;
}

// Falls back to roster list order (1-12) for any team without a completed draft yet.
export function buildConferenceColorMap(managers, draft, rosterIdMap) {
  const draftSlots = getDraftSlotMap(draft, rosterIdMap);
  const map = {};
  managers.forEach((m, idx) => {
    const slot = draftSlots[m] || (idx + 1);
    map[m] = TEAM_COLOR_PALETTE[(slot - 1) % TEAM_COLOR_PALETTE.length];
  });
  return map;
}

// Same idea as buildConferenceColorMap, but the hex variant -- for the standings trend chart's
// SVG strokes, which need a real color value rather than a Tailwind class name.
export function buildConferenceHexColorMap(managers, draft, rosterIdMap) {
  const draftSlots = getDraftSlotMap(draft, rosterIdMap);
  const map = {};
  managers.forEach((m, idx) => {
    const slot = draftSlots[m] || (idx + 1);
    map[m] = TEAM_COLOR_HEX_PALETTE[(slot - 1) % TEAM_COLOR_HEX_PALETTE.length];
  });
  return map;
}
