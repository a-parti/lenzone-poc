import React from 'react';
import { Shield, UserRound } from 'lucide-react';
import { useNameDisplay } from '../context/NameDisplayContext';

// Shared by the regular header and Home so both controls always reflect the same site-wide mode.
export default function NameDisplayToggle() {
  const { mode: activeMode, setMode } = useNameDisplay();
  const options = [
    ['teams', 'Fantasy team names', Shield],
    ['managers', 'Manager names', UserRound]
  ];

  return (
    <div
      className="inline-flex items-center rounded-full bg-[var(--bg)]/55 border border-[var(--border)]/80 p-0.5 shadow-sm"
      role="group"
      aria-label="Name display"
    >
      {options.map(([mode, label, Icon]) => (
        <button
          key={mode}
          type="button"
          onClick={() => setMode(mode)}
          aria-pressed={activeMode === mode}
          aria-label={`Show ${label.toLowerCase()}`}
          title={label}
          className={`grid h-7 w-7 place-items-center rounded-full transition-all duration-150 ${
            activeMode === mode
              ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow-sm scale-100'
              : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
          }`}
        >
          <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
