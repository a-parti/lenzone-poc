import React, { useState } from 'react';
import { ALL_SCHEMES } from '../context/ThemeContext';
import { getEffectiveOverrides, setTeamOverride, clearTeamOverride, managerSchemeKey } from '../lib/teamDefaults';

function ManagerRow({ afcData, nfcData, manager, bump }) {
  const key = managerSchemeKey(afcData, nfcData, manager);
  const overrides = getEffectiveOverrides();
  const current = key ? overrides[key] : null;

  if (!key) return null;

  const handleSchemeChange = (e) => {
    const value = e.target.value;
    if (!value) clearTeamOverride(key);
    else setTeamOverride(key, { scheme: value });
    bump();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center py-2 border-b border-[var(--border)]/60">
      <span className="text-sm font-semibold text-[var(--text)] truncate">{manager}</span>
      <select
        value={current?.scheme || ''}
        onChange={handleSchemeChange}
        className="bg-[var(--bg)] border border-[var(--border)]/80 text-xs rounded-lg px-2 py-1.5 text-[var(--text)]"
      >
        <option value="">Random (default)</option>
        {ALL_SCHEMES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    </div>
  );
}

// Lets an admin set a default color scheme per fantasy team, keyed by their stable Sleeper owner id
// (see lib/teamDefaults.js) rather than their display name. The easter-egg SOUND that plays on any
// team selection is a separate, shared pool (public/sounds/generic/, see lib/genericSounds.js) --
// not configured here, since it's no longer tied to who was picked.
// IMPORTANT LIMITATION: there's no backend behind this app, so color choices made here are saved to
// THIS BROWSER's localStorage only -- they don't sync to other visitors. To make a change apply for
// everyone, it has to be baked into DEFAULT_TEAM_SCHEME_OVERRIDES in lib/teamDefaults.js and redeployed.
export default function TeamDefaultsAdmin({ afcData, nfcData, afcManagers, nfcManagers }) {
  const [version, setVersion] = useState(0);
  const bump = () => setVersion(v => v + 1);

  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1 text-[var(--text)]">Team Color Defaults</h2>
        <p className="text-sm text-[var(--text2)]">
          Set a fixed color scheme for specific teams -- it overrides the random Home-page pick and stays until that
          person chooses a different color themselves.
        </p>
        <p className="text-xs text-[var(--muted)] mt-1">
          Saved to this browser only (no backend to sync it to every visitor) -- to make a change permanent for
          everyone, it has to be committed into the app's source and redeployed.
        </p>
      </div>
      <div key={version}>
        {[...afcManagers, ...nfcManagers].map(m => (
          <ManagerRow key={m} afcData={afcData} nfcData={nfcData} manager={m} bump={bump} />
        ))}
      </div>
    </div>
  );
}
