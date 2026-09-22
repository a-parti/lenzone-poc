// Real record of what each week's actual high-score winner chose for their prize ($15 cash or a
// bottle of wine, per the league's real rule) -- hand-maintained here, the same pattern as
// realNames.js/speechBubbleOverrides.js: a small file someone (the commissioner) edits and pushes
// as each week's real result comes in. Never guessed/inferred -- a week with no entry here just
// isn't shown, rather than defaulting to a fabricated choice.
//
// Keyed by week number. `winner` should match that manager's real name (see realNames.js) or
// their team name if no real name is on file; `choice` is either "cash" or "wine".
export const HIGH_SCORE_PRIZES = {
  1: { winner: "Melody", choice: "wine" },
  2: { winner: "Tim", choice: "wine" }
};
