import React, { createContext, useContext, useState } from 'react';

const RosterModalContext = createContext(null);

export function RosterModalProvider({ children }) {
  const [target, setTarget] = useState(null); // { manager, conf }
  return (
    <RosterModalContext.Provider
      value={{
        target,
        openRoster: (manager, conf) => setTarget({ manager, conf }),
        closeRoster: () => setTarget(null)
      }}
    >
      {children}
    </RosterModalContext.Provider>
  );
}

export function useRosterModal() {
  const ctx = useContext(RosterModalContext);
  if (!ctx) throw new Error('useRosterModal must be used within RosterModalProvider');
  return ctx;
}
