import React, { createContext, useContext, useEffect, useState } from 'react';

// The site has a single palette (see index.css) with a light and a dark mode. `scheme` stays as a
// constant so image-export code that stamps data-scheme on its staging node keeps working.
const SCHEME = 'coastal';

const ThemeContext = createContext({ scheme: SCHEME, mode: 'dark', setMode: () => {} });

function readStoredMode() {
  try { return localStorage.getItem('lenzone_mode'); } catch { return null; }
}

export function ThemeProvider({ children }) {
  // Light mode by default (the sand look); dark only once someone picks it with the toggle.
  const [mode, setModeState] = useState(() => readStoredMode() || 'light');

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
