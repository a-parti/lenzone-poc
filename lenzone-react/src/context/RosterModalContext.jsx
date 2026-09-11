import React, { createContext, useContext, useState } from 'react';

const RosterModalContext = createContext(null);

// onOpen (optional): fired with the manager's name every time a roster is opened, from ANY of the
// many places that call openRoster (TeamName, depth chart owner links, etc.) -- one choke point,
// rather than adding the same hook to every individual click site. Used to replay that team's
// sound/color easter egg any time you pull up their roster, not just when picking "I am".
export function RosterModalProvider({ children, onOpen }) {
  const [target, setTarget] = useState(null); // { manager, conf }
  return (
    <RosterModalContext.Provider
      value={{
        target,
        openRoster: (manager, conf) => { setTarget({ manager, conf }); onOpen?.(manager); },
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
