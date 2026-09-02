import React, { useState } from 'react';
import { usePlayerPhotos } from '../context/PlayerPhotoContext';

// Real Sleeper-hosted images: player headshots (many bench/practice-squad guys have none on file)
// and, for DEF entries (player_id is the team abbreviation itself), the NFL team's logo.
// Fails silently to a blank slot rather than a broken-image icon, and renders nothing at all
// when the viewer has turned photos off.
export default function PlayerAvatar({ playerId, position, className = "w-6 h-6" }) {
  const { enabled } = usePlayerPhotos();
  const [failed, setFailed] = useState(false);

  if (!enabled) return null;
  if (!playerId || playerId === '0' || failed) {
    return <div className={`${className} rounded-full bg-slate-800 shrink-0`} />;
  }

  const src = position === 'DEF'
    ? `https://sleepercdn.com/images/team_logos/nfl/${playerId.toLowerCase()}.png`
    : `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;

  return (
    <img
      src={src}
      alt=""
      className={`${className} rounded-full object-cover shrink-0 bg-slate-800`}
      onError={() => setFailed(true)}
    />
  );
}
