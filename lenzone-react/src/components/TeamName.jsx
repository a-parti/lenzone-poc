import React, { useState } from 'react';
import { useRosterModal } from '../context/RosterModalContext';
import { useTeamColor } from '../context/TeamColorContext';
import { useTeamLogo } from '../context/TeamLogoContext';

export default function TeamName({ manager, conf, className = "", showLogo = true }) {
  const { openRoster } = useRosterModal();
  const color = useTeamColor(manager);
  const logoUrl = useTeamLogo(manager);
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={() => openRoster(manager, conf)}
      className={`inline-flex items-center gap-1.5 min-w-0 hover:underline decoration-dotted underline-offset-2 text-left cursor-pointer ${color.text} ${className}`}
    >
      {showLogo && logoUrl && !logoFailed && (
        <img
          src={logoUrl}
          alt=""
          className="w-4 h-4 rounded-full object-cover shrink-0"
          onError={() => setLogoFailed(true)}
        />
      )}
      <span className="truncate min-w-0">{manager}</span>
    </button>
  );
}
