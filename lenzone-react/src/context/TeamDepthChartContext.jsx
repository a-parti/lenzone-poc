import React, { createContext, useContext, useState } from 'react';

const TeamDepthChartContext = createContext(null);

export function TeamDepthChartProvider({ children }) {
  const [target, setTarget] = useState(null); // NFL team abbreviation, e.g. "NE"
  return (
    <TeamDepthChartContext.Provider
      value={{
        target,
        openTeamDepthChart: (abbr) => setTarget(abbr),
        closeTeamDepthChart: () => setTarget(null)
      }}
    >
      {children}
    </TeamDepthChartContext.Provider>
  );
}

export function useTeamDepthChart() {
  const ctx = useContext(TeamDepthChartContext);
  if (!ctx) throw new Error('useTeamDepthChart must be used within TeamDepthChartProvider');
  return ctx;
}
