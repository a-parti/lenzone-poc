# LENZONE Website Backlog

## Office-league features

- **Who to Root For** — For each manager, show which upcoming matchups would most improve their playoff path. Build this from the same completed-week-only simulation used by Playoff Pulse so it never changes during live games.
- **Weekly Pulse Movement** — Show each manager's playoff-percentage change from the prior completed week (for example, `+4%` or `-3%`) and call out the biggest riser and faller.
- **Rivalry Cards** — Show current-season head-to-head records, rematches, and bragging-rights summaries for recurring matchups without inventing rivalry history the data does not support.
- **Office Awards Voting** — Add one lightweight peer-voted weekly award alongside the existing data-driven trophies. This requires deciding where shared votes will be stored before implementation.

## Technical cleanup

- Reduce the existing lint-warning backlog without changing current behavior.
- Split the main production bundle if its size begins to affect real load performance.
