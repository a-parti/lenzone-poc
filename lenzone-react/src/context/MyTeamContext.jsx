import React, { createContext, useContext } from 'react';

const MyTeamContext = createContext(null);

export function MyTeamProvider({ manager, children }) {
  return <MyTeamContext.Provider value={manager}>{children}</MyTeamContext.Provider>;
}

export function useIsMyTeam(manager) {
  const myTeam = useContext(MyTeamContext);
  return !!myTeam && myTeam === manager;
}
