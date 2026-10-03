import React, { createContext, useContext, useEffect, useState } from 'react';

// The site has a single palette (see index.css) with a light and a dark mode. `scheme` stays as a
// constant so image-export code that stamps data-scheme on its staging node keeps working.
const SCHEME = 'coastal';

const ThemeContext = createContext({ scheme: SCHEME, mode: 'dark', setMode: () => {} });

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
