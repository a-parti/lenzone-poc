import React, { createContext, useContext, useState } from 'react';

const MatchupPreviewContext = createContext(null);

// A lightweight "which matchup card is open" target -- the actual score/roster data is computed
// where it's already available (App.jsx already builds intra/inter matchup info for
// ManagerMatchupRow) and handed to MatchupPreviewModal as props, same division of labor as
// RosterModalContext/RosterModal. Any click point (Grid cells today, potentially others later)
// can open a quick preview card without a full navigation away from where it was clicked.
export function MatchupPreviewProvider({ children }) {
  const [target, setTarget] = useState(null); // { manager, conf, week }
  return (
    <MatchupPreviewContext.Provider
      value={{
        target,
        openPreview: (manager, conf, week) => setTarget({ manager, conf, week }),
        closePreview: () => setTarget(null)
      }}
    >
      {children}
    </MatchupPreviewContext.Provider>
  );
}

export function useMatchupPreview() {
  const ctx = useContext(MatchupPreviewContext);
  if (!ctx) throw new Error('useMatchupPreview must be used within MatchupPreviewProvider');
  return ctx;
}
