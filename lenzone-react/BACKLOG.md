# LENZONE Website Backlog

## Office-league features

- **Who to Root For** — For each manager, show which upcoming matchups would most improve their playoff path. Build this from the same completed-week-only simulation used by Playoff Pulse so it never changes during live games. Belongs on the Playoffs tab.
- **Rivalry Cards** — Show current-season head-to-head records, rematches, and bragging-rights summaries for recurring matchups without inventing rivalry history the data does not support. (Parked.)
- **Office Awards Voting** — Add one lightweight peer-voted weekly award alongside the existing data-driven trophies. This requires deciding where shared votes will be stored before implementation. (Parked.)
- **Weekly high-score check** — Flag when the prize log (`src/lib/highScorePrizes.js`) is missing a completed week, using the week's real top score from Sleeper. (Parked.)

## Analytics

- **Web Analytics** — Added 2026-11-17 via the plain script tag in `index.html` (no npm package; `npm install` was blocked on the work network). A `beforeSend` hook rewrites `/#tab` to `/tab` so each tab shows as its own page. After the first deploy, confirm tab switches (not just page loads) appear in the dashboard; if only loads appear, add a manual page view on tab change.
- **Speed Insights / custom events** — Optional. Custom events (e.g. "copied PNG", "opened bracket") need a Vercel Pro plan.

## Technical cleanup

- Reduce the existing lint-warning backlog without changing current behavior.
- Split the main production bundle if its size begins to affect real load performance.
