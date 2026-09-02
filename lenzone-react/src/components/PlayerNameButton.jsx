import React from 'react';
import { usePlayerModal } from '../context/PlayerModalContext';

export default function PlayerNameButton({ playerId, name, position, className = "" }) {
  const { openPlayer } = usePlayerModal();
  if (!playerId || playerId === '0') return <span className={className}>{name}</span>;
  return (
    <button
      type="button"
      onClick={() => openPlayer(playerId, position)}
      className={`hover:underline decoration-dotted underline-offset-2 text-left cursor-pointer ${className}`}
    >
      {name}
    </button>
  );
}
