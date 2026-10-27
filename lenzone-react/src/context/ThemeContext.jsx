import React, { createContext, useContext, useEffect, useState } from 'react';

// The site has a single palette (see index.css) with a light and a dark mode. `scheme` stays as a
// constant so image-export code that stamps data-scheme on its staging node keeps working.
const SCHEME = 'coastal';

const ThemeContext = createContext({ scheme: SCHEME, mode: 'dark', setMode: () => {} });

// Seasonal colors and scenery (see the seasonal section of index.css and scripts/season-scenes.mjs).
// Each runs from its first through its last day, [month, day] with January = 1, every year. Any date
// not listed gets the coastal look.
const SEASONS = [
  { id: 'halloween', from: [10, 1], to: [11, 2] },
  { id: 'harvest', from: [11, 3], to: [11, 8] },
  { id: 'salute', from: [11, 9], to: [11, 15] }, // Veterans Day, Nov 11
  { id: 'thanksgiving', from: [11, 16], to: [11, 29] }, // covers the 4th Thursday of November
  { id: 'frost', from: [11, 30], to: [12, 6] },
  { id: 'snowgame', from: [12, 7], to: [12, 13] },
  { id: 'holiday', from: [12, 14], to: [12, 27] },
  { id: 'newyear', from: [12, 28], to: [1, 4] } // wraps into January
];

function currentSeason(now = new Date()) {
  // ?season=frost previews a season's look on any date; ?season=none shows the coastal look.
  try {
    const preview = new URLSearchParams(window.location.search).get('season');
    if (preview === 'none') return null;
    if (SEASONS.some(s => s.id === preview)) return preview;
  } catch { /* no URL to read */ }
  const today = (now.getMonth() + 1) * 100 + now.getDate();
  const found = SEASONS.find(({ from, to }) => {
    const start = from[0] * 100 + from[1], end = to[0] * 100 + to[1];
    return start <= end ? today >= start && today <= end : today >= start || today <= end;
  });
  return found ? found.id : null;
}

function systemMode() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredMode() {
  try { return localStorage.getItem('lenzone_mode'); } catch { return null; }
}

export function ThemeProvider({ children }) {
  // Follows the device's light/dark setting until someone picks a mode with the toggle; after
  // that their choice sticks.
  const [mode, setModeState] = useState(() => readStoredMode() || systemMode());

  // Keep following the device setting live (e.g. phones that switch to dark at sunset) as long
  // as no explicit choice has been made.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const handler = (e) => { if (!readStoredMode()) setModeState(e.matches ? 'dark' : 'light'); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setMode = (next) => {
    setModeState(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      try { localStorage.setItem('lenzone_mode', resolved); } catch {}
      return resolved;
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode);
    document.documentElement.setAttribute('data-scheme', SCHEME);
    const season = currentSeason();
    if (season) document.documentElement.setAttribute('data-season', season);
    else document.documentElement.removeAttribute('data-season');
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ scheme: SCHEME, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
