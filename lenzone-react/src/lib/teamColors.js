// 12 distinguishable "coastal" colors, one per draft slot, mid-tone so they read on both the light
// (sand) and dark (night ocean) backgrounds. Applied per-conference (an AFC team and an NFC team can
// share a color) by real draft position. These are the one deliberate exception to "only use the
// palette tokens": 12 lines on one chart need 12 hues.
export const TEAM_COLOR_HEX_PALETTE = [
  "#0E8A95", // sea teal
  "#E8715A", // sunset coral
  "#D99A2B", // sand gold
  "#3B7BC4", // ocean blue
  "#2F9E6B", // kelp green
  "#B5628A", // sea-urchin rose
  "#6C8EBF", // dusk blue
  "#C8553D", // terracotta
  "#4FB0A5", // seafoam
  "#8C6BB1", // twilight purple
  "#7A9A3A", // coastal sage
  "#A47148"  // driftwood
];

// Class-name twin of the hex palette (literal strings so Tailwind generates them).
export const TEAM_COLOR_PALETTE = [
  { text: "text-[#0E8A95]", border: "border-[#0E8A95]/30" },
  { text: "text-[#E8715A]", border: "border-[#E8715A]/30" },
  { text: "text-[#D99A2B]", border: "border-[#D99A2B]/30" },
  { text: "text-[#3B7BC4]", border: "border-[#3B7BC4]/30" },
  { text: "text-[#2F9E6B]", border: "border-[#2F9E6B]/30" },
  { text: "text-[#B5628A]", border: "border-[#B5628A]/30" },
  { text: "text-[#6C8EBF]", border: "border-[#6C8EBF]/30" },
  { text: "text-[#C8553D]", border: "border-[#C8553D]/30" },
  { text: "text-[#4FB0A5]", border: "border-[#4FB0A5]/30" },
  { text: "text-[#8C6BB1]", border: "border-[#8C6BB1]/30" },
  { text: "text-[#7A9A3A]", border: "border-[#7A9A3A]/30" },
  { text: "text-[#A47148]", border: "border-[#A47148]/30" }
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
