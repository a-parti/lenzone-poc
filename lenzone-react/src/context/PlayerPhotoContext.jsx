import React, { createContext, useContext, useState } from 'react';

const PlayerPhotoContext = createContext({ enabled: true, toggle: () => {} });

export function PlayerPhotoProvider({ children }) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('lenzone_show_photos') !== 'false');

  const toggle = () => {
    setEnabled(v => {
      const next = !v;
      localStorage.setItem('lenzone_show_photos', String(next));
      return next;
    });
  };

  return (
    <PlayerPhotoContext.Provider value={{ enabled, toggle }}>
      {children}
    </PlayerPhotoContext.Provider>
  );
}

export function usePlayerPhotos() {
  return useContext(PlayerPhotoContext);
}
