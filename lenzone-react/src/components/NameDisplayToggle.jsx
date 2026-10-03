import React from 'react';
import { useNameDisplay } from '../context/NameDisplayContext';

// Text-labelled segmented control (lives in the settings menu) so it's clear on a phone, where
// icon tooltips never show.
export default function NameDisplayToggle() {
  const { mode: activeMode, setMode } = useNameDisplay();
  const options = [
    ['teams', 'Team names'],
    ['managers', 'Real names']
  ];

  return (
    <div className="inline-flex rounded-lg bg-[var(--bg)] p-1 border border-[var(--border)]" role="group" aria-label="Name display">
      {options.map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          onClick={() => setMode(mode)}
          aria-pressed={activeMode === mode}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors duration-150 ${
            activeMode === mode ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
