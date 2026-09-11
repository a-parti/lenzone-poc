// Per-team color scheme defaults that override the random Home-page scheme and stay in effect
// until the viewer picks something else themselves. (Sound used to be mapped per-manager here too,
// but that was scrapped in favor of one shared pool -- see lib/genericSounds.js -- that plays a
// random clip for ANY manager selection, not just these configured ones.)
//
// Keyed by "<CONF>:<sleeper owner_id>" -- the Sleeper user id, NOT the manager display name, since
// a manager can rename their team on Sleeper at any time and the mapping needs to survive that.
// The conference prefix matters because the same Sleeper account can own a roster in BOTH leagues
// (verified live against the real rosters on 2026-09-10 -- e.g. owner 1127736754682888192 is
// "Daejon Mustard, allegedly" in the AFC league and a different team in the NFC league), so the
// bare owner_id isn't unique on its own.
export const DEFAULT_TEAM_SCHEME_OVERRIDES = {
  "AFC:1127736754682888192": { scheme: "nfl-buf" },   // Daejon Mustard, allegedly
  "AFC:1395250624269914112": { scheme: "nfl-lar" },   // WorldSeriesChamps2026
  "AFC:1268691355266207744": { scheme: "nfl-lac" },   // TheyKilledKenny
  "AFC:1268671474101649408": { scheme: "nfl-lac" },   // TheRealHousehusbandsOfIB (Kenny)
  "NFC:639719795276718080": { scheme: "nfl-sf" },     // EricWonHisOtherLeague
  "NFC:1268635156139229184": { scheme: "nfl-cin" },   // Pharoah of Fan Football
  "NFC:1398462206726647808": { scheme: "nfl-cle" },   // VizzyYardLine
  "NFC:1398519292193980416": { scheme: "nfl-chi" },   // Teardrops On My Lamar
  "NFC:1398786200331923456": { scheme: "nfl-pit" }    // ahmadschaudhri
};

const STORAGE_KEY = "lenzone_team_overrides";

// Admin-panel edits layer on top of the shipped defaults above. There's no backend here, so this
// only persists in the browser that made the edit -- it does NOT sync to every visitor. Baking a
// change into DEFAULT_TEAM_SCHEME_OVERRIDES (and redeploying) is the only way to make it universal.
function readStoredOverrides() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function getEffectiveOverrides() {
  const stored = readStoredOverrides();
  const merged = {};
  for (const key of new Set([...Object.keys(DEFAULT_TEAM_SCHEME_OVERRIDES), ...Object.keys(stored)])) {
    const entry = { ...DEFAULT_TEAM_SCHEME_OVERRIDES[key], ...stored[key] };
    if (Object.keys(entry).length > 0) merged[key] = entry;
  }
  return merged;
}

export function setTeamOverride(key, patch) {
  const stored = readStoredOverrides();
  stored[key] = { ...stored[key], ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function clearTeamOverride(key) {
  const stored = readStoredOverrides();
  delete stored[key];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

// Resolves a manager's stable "<CONF>:<owner_id>" key by checking which league's ownerIdMap
// contains that display name -- returns null if the roster data hasn't loaded yet.
export function managerSchemeKey(afcData, nfcData, managerName) {
  if (!managerName) return null;
  if (afcData?.ownerIdMap?.[managerName] != null) return `AFC:${afcData.ownerIdMap[managerName]}`;
  if (nfcData?.ownerIdMap?.[managerName] != null) return `NFC:${nfcData.ownerIdMap[managerName]}`;
  return null;
}
