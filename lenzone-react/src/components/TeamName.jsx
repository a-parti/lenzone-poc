import React, { useState } from 'react';
import { useRosterModal } from '../context/RosterModalContext';
import { useTeamColor } from '../context/TeamColorContext';
import { useTeamLogo } from '../context/TeamLogoContext';
import { useIsMyTeam } from '../context/MyTeamContext';

export default function TeamName({ manager, conf, className = "", showLogo = true }) {
  const { openRoster } = useRosterModal();
  const color = useTeamColor(manager);
  const logoUrl = useTeamLogo(manager);
  const isMe = useIsMyTeam(manager);
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={() => openRoster(manager, conf)}
      className={`inline-flex items-center gap-1.5 min-w-0 hover:underline decoration-dotted underline-offset-2 text-left cursor-pointer ${color.text} ${className} ${
        isMe ? "font-extrabold bg-[var(--accent)]/15 border border-[var(--accent)]/50 rounded-full px-2 py-0.5 -my-0.5" : ""
      }`}
    >
      {showLogo && logoUrl && !logoFailed && (
        <img
          src={logoUrl}
          alt=""
          className={`rounded-full object-cover shrink-0 ${isMe ? "w-7 h-7 ring-2 ring-[var(--accent)]" : "w-6 h-6"}`}
          onError={() => setLogoFailed(true)}
        />
      )}
      <span className="truncate min-w-0">{manager}</span>
    </button>
  );
}
