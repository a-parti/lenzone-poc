// One-time reset for the October 2026 redesign. The first time each browser loads the new site it:
// lands on Home (for a plain visit -- a shared #link still opens its page), turns sounds and fun
// animations off, resets the theme to follow the device light/dark setting, and clears settings from removed
// features. The saved "I am" team is kept. Bump RESET_VERSION to run a reset like this again.
// Runs at import time (imported first in main.jsx) so it happens before any component reads
// these settings.
const RESET_VERSION = '2026-10-redesign';
const VERSION_KEY = 'lenzone_reset_version';

function runFreshStart() {
  try {
    if (localStorage.getItem(VERSION_KEY) === RESET_VERSION) return false;
    localStorage.setItem('lenzone_sound_muted', 'true');
    localStorage.setItem('lenzone_fun_enabled', 'false');
    [
      'lenzone_mode', 'lenzone_scheme', 'lenzone_scheme_manual', 'lenzone_bubbles_enabled'
    ].forEach(key => localStorage.removeItem(key));
    try { sessionStorage.removeItem('lenzone_session_scheme'); } catch { /* ignore */ }
    localStorage.setItem(VERSION_KEY, RESET_VERSION);
    return true;
  } catch {
    // Storage blocked (private mode etc.): nothing was saved, so defaults already apply.
    return false;
  }
}

// True only on the visit where the reset just ran.
export const IS_FRESH_START = runFreshStart();
