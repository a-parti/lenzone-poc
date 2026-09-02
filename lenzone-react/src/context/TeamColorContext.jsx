import React, { createContext, useContext } from 'react';

const TeamColorContext = createContext({});

export function TeamColorProvider({ colorMap, children }) {
  return <TeamColorContext.Provider value={colorMap}>{children}</TeamColorContext.Provider>;
}

export function useTeamColor(manager) {
  const map = useContext(TeamColorContext);
  return map[manager] || { text: "text-slate-200", border: "border-slate-800/80" };
}
