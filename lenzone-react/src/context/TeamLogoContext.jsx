import React, { createContext, useContext } from 'react';

const TeamLogoContext = createContext({});

export function TeamLogoProvider({ logoMap, children }) {
  return <TeamLogoContext.Provider value={logoMap}>{children}</TeamLogoContext.Provider>;
}

export function useTeamLogo(manager) {
  const map = useContext(TeamLogoContext);
  return map[manager] || null;
}
