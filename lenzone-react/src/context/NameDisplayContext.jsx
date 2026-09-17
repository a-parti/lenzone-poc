import React, { createContext, useContext } from 'react';
import { getRealName } from '../lib/realNames';

const NameDisplayContext = createContext({
  mode: 'teams',
  setMode: () => {},
  managerName: () => null,
  displayName: manager => manager || '--'
});

// One site-wide naming preference. The underlying fantasy-team string always remains the stable
// data key used for scores, logos, colors, and modal actions; only the label shown to the viewer is
// swapped. Missing real-name mappings safely fall back to the fantasy name.
export function NameDisplayProvider({ mode, onModeChange, afcData, nfcData, children }) {
  const managerName = (manager, conf = null) => getRealName(afcData, nfcData, manager, conf);
  const displayName = (manager, conf = null) => {
    if (!manager) return '--';
    return mode === 'managers'
      ? (managerName(manager, conf) || manager)
      : manager;
  };

  return (
    <NameDisplayContext.Provider value={{ mode, setMode: onModeChange, managerName, displayName }}>
      {children}
    </NameDisplayContext.Provider>
  );
}

export function useNameDisplay() {
  return useContext(NameDisplayContext);
}
