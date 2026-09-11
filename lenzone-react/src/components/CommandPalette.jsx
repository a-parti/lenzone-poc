import React, { useEffect, useMemo, useState } from 'react';
import { Search, ArrowUpRight, Users, User } from 'lucide-react';
import { usePlayerModal } from '../context/PlayerModalContext';
import { useRosterModal } from '../context/RosterModalContext';

function SectionLabel({ children }) {
  return <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{children}</p>;
}

// Global Cmd+K / Ctrl+K launcher -- jumps to a tab, a fantasy team's roster, or a specific player's
// card, all from one search box, from anywhere in the app. No visible header button triggers this
// anymore (removed to declutter the header) -- the keyboard shortcut is the only entry point.
export default function CommandPalette({ tabs, onSelect, open, setOpen, playersDB, afcManagers, nfcManagers }) {
  const [query, setQuery] = useState('');
  const { openPlayer } = usePlayerModal();
  const { openRoster } = useRosterModal();

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const q = query.trim().toLowerCase();

  const matchedTabs = tabs.filter(t => t.label.toLowerCase().includes(q));

  const managers = useMemo(() => [
    ...(afcManagers || []).map(m => ({ manager: m, conf: 'AFC' })),
    ...(nfcManagers || []).map(m => ({ manager: m, conf: 'NFC' }))
  ], [afcManagers, nfcManagers]);
  const matchedTeams = q ? managers.filter(t => t.manager.toLowerCase().includes(q)).slice(0, 6) : [];

  // Only searches once 2+ characters are typed (playersDB can be thousands of entries) and skips
  // anyone without a current NFL team (retired/practice-squad-only players aren't fantasy-relevant).
  const matchedPlayers = useMemo(() => {
    if (!q || q.length < 2 || !playersDB) return [];
    const results = [];
    for (const id in playersDB) {
      const p = playersDB[id];
      if (!p?.team) continue;
      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      if (name.toLowerCase().includes(q)) {
        results.push({ id, name, position: p.position, team: p.team });
        if (results.length >= 8) break;
      }
    }
    return results;
  }, [q, playersDB]);

  if (!open) return null;

  const totalResults = matchedTabs.length + matchedTeams.length + matchedPlayers.length;

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg)]/70 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--muted)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a page, team, or player..."
            className="bg-transparent border-0 outline-none text-[var(--text)] placeholder:text-[var(--muted)] w-full font-display text-lg"
          />
          <kbd className="text-[10px] font-mono text-[var(--muted)] bg-[var(--surface2)] border border-[var(--border)] rounded px-1.5 py-0.5 shrink-0">Esc</kbd>
        </div>
        <div className="max-h-96 overflow-y-auto scroll-thin pb-2">
          {totalResults === 0 && <p className="px-4 py-3 text-sm text-[var(--muted)] italic">No matches</p>}

          {matchedTabs.length > 0 && (
            <>
              <SectionLabel>Pages</SectionLabel>
              {matchedTabs.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { onSelect(t.id); setOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--surface2)] transition-colors duration-150"
                >
                  <span className="font-display text-base font-semibold text-[var(--text)]">{t.label}</span>
                  <ArrowUpRight className="w-4 h-4 text-[var(--muted)]" />
                </button>
              ))}
            </>
          )}

          {matchedTeams.length > 0 && (
            <>
              <SectionLabel>Fantasy Teams</SectionLabel>
              {matchedTeams.map(t => (
                <button
                  key={`${t.conf}-${t.manager}`}
                  type="button"
                  onClick={() => { openRoster(t.manager, t.conf); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[var(--surface2)] transition-colors duration-150"
                >
                  <Users className="w-4 h-4 text-[var(--muted)] shrink-0" />
                  <span className="font-semibold text-sm text-[var(--text)] flex-1 truncate">{t.manager}</span>
                  <span className="text-[10px] font-bold text-[var(--muted)] uppercase">{t.conf}</span>
                </button>
              ))}
            </>
          )}

          {matchedPlayers.length > 0 && (
            <>
              <SectionLabel>Players</SectionLabel>
              {matchedPlayers.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { openPlayer(p.id, p.position); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[var(--surface2)] transition-colors duration-150"
                >
                  <User className="w-4 h-4 text-[var(--muted)] shrink-0" />
                  <span className="font-semibold text-sm text-[var(--text)] flex-1 truncate">{p.name}</span>
                  <span className="text-[10px] font-mono text-[var(--muted)]">{p.position} &middot; {p.team}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
