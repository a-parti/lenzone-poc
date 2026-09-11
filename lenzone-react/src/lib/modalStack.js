// Shared z-index counter so whichever modal (Roster/Player/TeamDepthChart) was opened MOST
// RECENTLY always renders on top, no matter what was already open underneath it. Without this,
// two modals sharing a fixed z-index stack purely by DOM/render order, which means a modal opened
// FROM another one (e.g. clicking a player inside a team's depth chart) can end up rendering
// BEHIND the one it was opened from -- clicking the player silently "does nothing" visually even
// though it worked. There's no cap on how many times this can be chained (team -> depth chart ->
// player -> their team -> depth chart -> ...); each call just claims the next-highest layer.
let counter = 60;
export function nextModalZ() {
  counter += 1;
  return counter;
}
