import React, { useEffect, useRef, useState } from 'react';
import { Settings, Sun, Moon, Volume2, VolumeX, Sparkles, ExternalLink, Scroll, Lock, Unlock, RefreshCw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import NameDisplayToggle from './NameDisplayToggle';

function Row({ icon: Icon, label, onClick, active, href }) {
  const className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface2)] transition-colors duration-150 text-left";
  const body = (
    <>
      <Icon className="w-4 h-4 text-[var(--text2)] shrink-0" />
      <span className="flex-1">{label}</span>
      {active != null && (
        <span className={`text-[11px] font-bold ${active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>{active ? 'On' : 'Off'}</span>
      )}
    </>
  );
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={className}>{body}</a>;
  return <button type="button" onClick={onClick} className={className}>{body}</button>;
}

// One gear button holding every viewing preference and secondary link, shared by the header and
// Home, so the header itself stays: logo, "I am" picker, search, settings.
export default function SettingsMenu({
  soundMuted, onToggleSoundMuted, funEnabled, onToggleFun,
  afcLeagueId, nfcLeagueId, onOpenCharter, isAdmin, onAdminClick,
  onRefresh, refreshing, lastUpdated
}) {
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (fn) => () => { fn?.(); setOpen(false); };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Settings"
        title="Settings"
        className="grid place-items-center w-10 h-10 rounded-lg bg-[var(--surface2)] text-[var(--text2)] hover:text-[var(--text)] transition-colors duration-150"
      >
        <Settings className="w-5 h-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-[70] w-72 max-w-[calc(100vw-2rem)] bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl p-2">
          <div className="px-3 pt-2 pb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Show</p>
            <NameDisplayToggle />
          </div>
          <div className="border-t border-[var(--border)] pt-1">
            <Row
              icon={mode === 'dark' ? Moon : Sun}
              label={mode === 'dark' ? 'Dark mode' : 'Light mode'}
              onClick={() => setMode(m => (m === 'dark' ? 'light' : 'dark'))}
            />
            <Row icon={soundMuted ? VolumeX : Volume2} label="Team sounds" active={!soundMuted} onClick={onToggleSoundMuted} />
            {onToggleFun && <Row icon={Sparkles} label="Fun animations" active={funEnabled} onClick={onToggleFun} />}
          </div>
          {onRefresh && (
            <div className="border-t border-[var(--border)] pt-1 mt-1">
              <Row
                icon={RefreshCw}
                label={refreshing ? 'Refreshing…' : `Refresh data${lastUpdated ? ` (updated ${lastUpdated.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })})` : ''}`}
                onClick={onRefresh}
              />
            </div>
          )}
          <div className="border-t border-[var(--border)] pt-1 mt-1">
            {onOpenCharter &&<Row icon={Scroll} label="League charter" onClick={run(onOpenCharter)} />}
            {afcLeagueId && <Row icon={ExternalLink} label="AFC league on Sleeper" href={`https://sleeper.com/leagues/${afcLeagueId}/team`} />}
            {nfcLeagueId && <Row icon={ExternalLink} label="NFC league on Sleeper" href={`https://sleeper.com/leagues/${nfcLeagueId}/team`} />}
          </div>
          {onAdminClick && (
            <div className="border-t border-[var(--border)] pt-1 mt-1">
              <Row icon={isAdmin ? Unlock : Lock} label={isAdmin ? 'Log out of admin' : 'Admin login'} onClick={run(onAdminClick)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
