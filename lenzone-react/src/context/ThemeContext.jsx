import React, { createContext, useContext, useEffect, useState } from 'react';
import { NFL_TEAM_SCHEMES } from '../lib/nflTeams';

export const COLOR_SCHEMES = [
  { id: 'accent', label: 'Accent', swatch: '#e76f51' },
  { id: 'ocean', label: 'Summer Ocean Breeze', swatch: '#e63946' },
  { id: 'beach', label: 'Monochrome Beach', swatch: '#3c6e71' },
  { id: 'contrast', label: 'Contrast Pop', swatch: '#2ec4b6' },
  { id: 'fireside', label: 'Cozy Fireside', swatch: '#bb4430' }
];

// Team schemes join the 5 curated ones as options in the picker AND as the pool a random pick
// is drawn from on a fresh visit (see initialScheme below).
export const ALL_SCHEMES = [...COLOR_SCHEMES, ...NFL_TEAM_SCHEMES];

const ThemeContext = createContext({ scheme: 'accent', mode: 'dark', setScheme: () => {}, setMode: () => {}, rerollScheme: () => {}, pickRandomScheme: () => {} });

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

// No explicit choice yet -> land on a random team palette. Stashed in sessionStorage (not
// localStorage) so it stays put for this tab -- no re-roll on every re-render -- but rolls again
// the next time the site is opened, rather than a random pick from someone's first-ever visit
// silently becoming their permanent scheme.
function randomTeamSchemeId() {
  const pick = NFL_TEAM_SCHEMES[Math.floor(Math.random() * NFL_TEAM_SCHEMES.length)];
  return pick.id;
}

function initialScheme() {
  const stored = localStorage.getItem('lenzone_scheme');
  if (stored) return stored;
  const sessionPick = sessionStorage.getItem('lenzone_session_scheme');
  if (sessionPick) return sessionPick;
  const picked = randomTeamSchemeId();
  sessionStorage.setItem('lenzone_session_scheme', picked);
  return picked;
}

export function ThemeProvider({ children }) {
  const [scheme, setSchemeState] = useState(initialScheme);
  const [mode, setModeState] = useState(() => localStorage.getItem('lenzone_mode') || (systemPrefersDark() ? 'dark' : 'light'));

  // Follow the OS/browser light-dark setting live until the viewer explicitly picks one here.
  useEffect(() => {
    if (localStorage.getItem('lenzone_mode')) return;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const handler = (e) => setModeState(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setMode = (next) => {
    setModeState(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      localStorage.setItem('lenzone_mode', resolved);
      return resolved;
    });
  };

  // Only applies the attribute here -- persisting to localStorage happens in setScheme itself, so
  // a random default (see initialScheme above) doesn't get written down as a permanent choice.
  useEffect(() => {
    document.documentElement.setAttribute('data-scheme', scheme);
  }, [scheme]);

  const setScheme = (id) => {
    setSchemeState(id);
    localStorage.setItem('lenzone_scheme', id);
  };

  // Called every time the viewer lands back on the home/landing page. Re-rolls a fresh random team
  // palette so each trip back to Home feels new -- but only while nothing's been explicitly picked
  // yet; once someone picks a scheme from the strip, that choice sticks and Home stops re-rolling it.
  const rerollScheme = () => {
    if (localStorage.getItem('lenzone_scheme')) return;
    const picked = randomTeamSchemeId();
    sessionStorage.setItem('lenzone_session_scheme', picked);
    setSchemeState(picked);
  };

  // Unlike rerollScheme above, this ALWAYS picks a fresh random team palette, even if the viewer
  // (or an admin, for a different manager) had previously locked one in manually -- used when
  // picking a manager with no admin-configured color default, so choosing "who you are" always
  // feels like a fresh roll of the dice, the same way it did before anyone had picked anything yet.
  const pickRandomScheme = () => {
    setScheme(randomTeamSchemeId());
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ scheme, setScheme, mode, setMode, rerollScheme, pickRandomScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
