// The real person behind each fantasy team, for the Standings page's "Real Name" column.
// Keyed by "<CONF>:<sleeper owner_id>" -- same convention as DEFAULT_TEAM_SCHEME_OVERRIDES in
// teamDefaults.js, and for the same reason: a manager can rename their team on Sleeper at any
// time, and the same Sleeper account can own a roster in both leagues (verified live against the
// real rosters on 2026-09-11), so the display name alone isn't a stable or unique key.
// Collected directly from the league (a filled-out roster sheet), not guessed -- any manager not
// listed here just shows a blank in that column rather than a fabricated name.
export const REAL_NAMES = {
  "AFC:1127736754682888192": "Arjun",       // Daejon Mustard, allegedly
  "AFC:1269178607205371904": "Dan",         // What the Buck(eyes)
  "AFC:1266918079959416832": "Grant",       // Blowouts
  "AFC:1267217928634257408": "Ted",         // Fishing for a Win
  "AFC:550399990800261120": "Mike",         // Krush Kiffin
  "AFC:1395240810907205632": "Jaime + Kelsee", // JaimeKelsee
  "AFC:1395250624269914112": "Mina",        // WorldSeriesChamps2026
  "AFC:1395939801512804352": "Tim",         // Bringing the Smoke-y
  "AFC:1398435079935528960": "Nikko",       // Nikkster11
  "AFC:1398461741003743232": "Maggie",      // magggieburke
  "AFC:1268671474101649408": "Kenny",       // TheRealHousehusbandsOfIB
  "AFC:1268691355266207744": "Rob",         // TheyKilledKenny

  "NFC:639719795276718080": "Mario",        // EricWonHisOtherLeague
  "NFC:1266896622793527296": "Melissa",     // HailMaryHeroes
  "NFC:1395483927644213248": "Melody",      // Justhereforthegroupchat
  "NFC:1268635156139229184": "David C.",    // Pharoah of Fan Football
  "NFC:1268798041574342656": "Sam",         // FallingForYards
  "NFC:604158147258544128": "Jeremy",       // ImJustHereSoIDontGetFined
  "NFC:740328652335677440": "Eric",         // Hall & Oates
  "NFC:1268659673154727936": "Kris + Mahtab", // KrisandMahtab
  "NFC:1398434435048706048": "Chris C.",    // NotSureIWillWin
  "NFC:1398462206726647808": "Clay",        // VizzyYardLine
  "NFC:1398519292193980416": "Kru",         // Teardrops On My Lamar
  "NFC:1398786200331923456": "Ahmad",       // ahmadschaudhri
  "NFC:1127736754682888192": "Arjun",       // nujrap (same Sleeper account as AFC's Daejon Mustard)
  "NFC:1395240810907205632": "Jaime + Kelsee" // JaimeKelsee (same account as AFC)
};

// Resolves a manager's real name the same way managerSchemeKey resolves their scheme key --
// via the stable "<CONF>:<owner_id>", checking whichever league's ownerIdMap has that display
// name. Returns null (not "") for "not listed yet" so callers can render an explicit placeholder.
export function getRealName(afcData, nfcData, managerName) {
  if (!managerName) return null;
  if (afcData?.ownerIdMap?.[managerName] != null) {
    return REAL_NAMES[`AFC:${afcData.ownerIdMap[managerName]}`] ?? null;
  }
  if (nfcData?.ownerIdMap?.[managerName] != null) {
    return REAL_NAMES[`NFC:${nfcData.ownerIdMap[managerName]}`] ?? null;
  }
  return null;
}
