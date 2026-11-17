// Real record of what each week's actual high-score winner chose for their prize ($15 cash or a
// bottle of wine, per the league's real rule) -- hand-maintained here, the same pattern as
// realNames.js/speechBubbleOverrides.js: a small file someone (the commissioner) edits and pushes
// as each week's real result comes in. Never guessed/inferred -- a week with no entry here just
// isn't shown, rather than defaulting to a fabricated choice.
//
// Keyed by week number. `winner` is that manager's real name (see realNames.js); `owner` is the
// stable "<CONF>:<sleeper owner_id>" key (same as realNames.js), so prize badges stay on the right
// team even after a team rename; `choice` is either "cash" or "wine".
//
// Weeks 1-10 from the commissioner's prize sheet (2026-11-17), each winner cross-checked against
// that week's actual top score across both Sleeper leagues.
export const HIGH_SCORE_PRIZES = {
  1: { winner: "Melody", owner: "NFC:1395483927644213248", choice: "wine" },
  2: { winner: "Tim", owner: "AFC:1395939801512804352", choice: "wine" },
  3: { winner: "Ahmad", owner: "NFC:1398786200331923456", choice: "wine" },
  4: { winner: "Mario", owner: "NFC:639719795276718080", choice: "wine" },
  5: { winner: "Nikko", owner: "AFC:1398435079935528960", choice: "wine" },
  6: { winner: "Mario", owner: "NFC:639719795276718080", choice: "wine" },
  7: { winner: "Kris + Mahtab", owner: "NFC:1268659673154727936", choice: "wine" },
  8: { winner: "Kenny", owner: "AFC:1268671474101649408", choice: "cash" },
  9: { winner: "Kruti", owner: "NFC:1398519292193980416", choice: "wine" },
  10: { winner: "Kenny", owner: "AFC:1268671474101649408", choice: "cash" }
};
