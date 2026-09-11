// Shared lock so independent physics easter eggs (header knockover, football toss, whatever comes
// next) never run at the same time and stack visually on top of each other. Each gag checks
// gagState.active before starting and clears it when it ends -- a plain mutable object rather than
// React state since nothing needs to re-render off of it, it's just a coordination flag read/written
// from setInterval callbacks in a few unrelated components.
export const gagState = { active: false };
