import React, { createContext, useContext, useState } from 'react';

const PlayerModalContext = createContext(null);

export function PlayerModalProvider({ children }) {
  const [target, setTarget] = useState(null); // { playerId, position }
  return (
    <PlayerModalContext.Provider
      value={{
        target,
        openPlayer: (playerId, position) => setTarget({ playerId, position }),
        closePlayer: () => setTarget(null)
      }}
    >
      {children}
    </PlayerModalContext.Provider>
  );
}

export function usePlayerModal() {
  const ctx = useContext(PlayerModalContext);
  if (!ctx) throw new Error('usePlayerModal must be used within PlayerModalProvider');
  return ctx;
}
