import React, { createContext, useContext, useEffect, useState } from 'react';

// The site has a single palette (see index.css) with a light and a dark mode. `scheme` stays as a
// constant so image-export code that stamps data-scheme on its staging node keeps working.
const SCHEME = 'coastal';

const ThemeContext = createContext({ scheme: SCHEME, mode: 'dark', setMode: () => {} });

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

function readStoredMode() {
  try { return localStorage.getItem('lenzone_mode'); } catch { return null; }
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => readStoredMode() || (systemPrefersDark() ? 'dark' : 'light'));

  // Follow the OS/browser light-dark setting live until the viewer explicitly picks one here.
  useEffect(() => {
    if (readStoredMode()) return;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const handler = (e) => setModeState(e.matches ? 'dark' : 'light');
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
