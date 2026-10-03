import React, { createContext, useContext } from 'react';

const MyTeamContext = createContext(null);

export function MyTeamProvider({ manager, children }) {
  return <MyTeamContext.Provider value={manager}>{children}</MyTeamContext.Provider>;
}

// The viewer's own team ("I am"), or null.
export function useMyTeam() {
  return useContext(MyTeamContext);
}

export function useIsMyTeam(manager) {
  const myTeam = useContext(MyTeamContext);
  return !!myTeam && myTeam === manager;
}
