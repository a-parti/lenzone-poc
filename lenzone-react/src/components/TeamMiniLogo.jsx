import React, { useState } from 'react';
import { useTeamLogo } from '../context/TeamLogoContext';

// A small round team avatar for tight spots (schedule cells, legends, the ticker, the header).
// Falls back to a colored dot (ringColor) or nothing when the team has no logo.
export default function TeamMiniLogo({ manager, size = 16, ringColor, className = '' }) {
  const logoUrl = useTeamLogo(manager);
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, ...(ringColor ? { boxShadow: `0 0 0 2px ${ringColor}` } : {}) };
  if (!logoUrl || failed) {
    return ringColor
      ? <span className={`inline-block rounded-full shrink-0 ${className}`} style={{ ...style, backgroundColor: ringColor }} aria-hidden="true" />
      : null;
  }
  return (
    <img
      src={logoUrl} alt="" aria-hidden="true" loading="lazy"
      onError={() => setFailed(true)}
      className={`inline-block rounded-full object-cover shrink-0 bg-[var(--surface2)] ${className}`}
      style={style}
    />
  );
}
