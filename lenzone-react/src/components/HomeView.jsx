import React, { useMemo, useState, useEffect } from 'react';
import { useNameDisplay } from '../context/NameDisplayContext';
import { useTeamLogo } from '../context/TeamLogoContext';
import AnimatedLogo from './AnimatedLogo';
import { ModeToggle } from './SettingsMenu';

// A short confetti burst when a team is picked. Pure CSS transforms/opacity (see the
// .confetti-piece keyframes in index.css), cycling through the palette's accent colors.
const CONFETTI_COLORS = ['var(--accent)', 'var(--coral)', 'var(--live)', 'var(--proj)'];

function ConfettiBurst({ burst }) {
  const pieces = useMemo(() => {
    if (!burst) return [];
    const count = 24;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * 2 * Math.PI + Math.random() * 0.4;
      const distance = 90 + Math.random() * 90;
      return {
        id: i,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 40,
        rotate: Math.random() * 720 - 360,
        delay: Math.random() * 0.12,
        size: 6 + Math.random() * 6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]
      };
    });
  }, [burst?.nonce]);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!burst) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1100);
    return () => clearTimeout(t);
  }, [burst?.nonce]);

  if (!burst || !visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-visible" aria-hidden="true">
      {pieces.map(p => (
        <span
          key={p.id}
          className="absolute confetti-piece rounded-sm"
          style={{
            top: 40, width: p.size, height: p.size,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rotate}deg`
          }}
        />
      ))}
    </div>
  );
}

// One tappable team tile: logo + team name (+ real name underneath). Your current team is ringed.
function TeamTile({ manager, conf, rank, selected, onPick }) {
  const logoUrl = useTeamLogo(manager);
  const { displayName, managerName } = useNameDisplay();
  const [failed, setFailed] = useState(false);
  const name = displayName(manager, conf);
  const sub = managerName(manager, conf);
  const confText = conf === 'AFC' ? 'text-[var(--afc)]' : 'text-[var(--nfc)]';
  const confBorder = conf === 'AFC' ? 'border-[var(--afc)]' : 'border-[var(--nfc)]';
  // Fixed geometry so every tile matches: same card size, same logo size, a two-line name slot,
  // and a one-line real-name row -- long names clamp instead of changing the layout.
  return (
    <button
      type="button"
      onClick={() => onPick(manager)}
      aria-pressed={selected}
      className={`group relative w-full h-[11.5rem] flex flex-col items-center rounded-2xl border px-2 pt-4 pb-3 bg-[var(--surface)]/75 backdrop-blur-sm shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        selected ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]' : 'border-[var(--border)]'
      }`}
    >
      {rank != null && (
        <span className={`absolute top-2 left-2 min-w-[1.9rem] h-6 px-1.5 grid place-items-center rounded-full text-[11px] font-black text-white shadow ${conf === 'AFC' ? 'bg-[var(--afc)]' : 'bg-[var(--nfc)]'}`}>#{rank}</span>
      )}
      <span className={`grid place-items-center w-16 h-16 shrink-0 rounded-full overflow-hidden border-2 bg-[var(--surface2)] transition-transform duration-200 group-hover:scale-105 ${confBorder}`}>
        {logoUrl && !failed
          ? <img src={logoUrl} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
          : <span className={`text-2xl font-black ${confText}`}>{(name || '?').charAt(0)}</span>}
      </span>
      <span className={`mt-2.5 h-[2.5rem] w-full flex items-center justify-center font-bold leading-tight text-[var(--text)] line-clamp-2 [overflow-wrap:anywhere] ${(name || '').length > 20 ? 'text-[11px]' : 'text-[13px]'}`}>{name}</span>
      <span className="mt-1 h-6 w-full flex items-center justify-center">
        {sub && sub !== name && (
          <span className={`max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-bold leading-tight border ${
            conf === 'AFC' ? 'bg-[var(--afc)]/12 text-[var(--afc)] border-[var(--afc)]/35' : 'bg-[var(--nfc)]/12 text-[var(--nfc)] border-[var(--nfc)]/35'
          }`}>{sub}</span>
        )}
      </span>
    </button>
  );
}

// Ordered by current conference rank (with a #N badge) once standings have loaded; roster order
// until then.
function ConferenceGrid({ conf, managers, standings, myTeamManager, onPick }) {
  const rankByManager = new Map((standings || []).map(row => [row.manager, row.rank]));
  const ordered = standings
    ? [...managers].sort((a, b) => (rankByManager.get(a) ?? 99) - (rankByManager.get(b) ?? 99))
    : managers;
  return (
    <section className="w-full">
      <div className="flex items-center justify-center gap-3 mb-3">
        <span className="h-px flex-1 bg-[var(--border)]" />
        <span className={`text-sm font-black tracking-[0.25em] ${conf === 'AFC' ? 'text-[var(--afc)]' : 'text-[var(--nfc)]'}`}>{conf}</span>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
        {ordered.map(m => (
          <TeamTile key={m} manager={m} conf={conf} rank={rankByManager.get(m)} selected={m === myTeamManager} onPick={onPick} />
        ))}
      </div>
    </section>
  );
}

// Home is just "who are you?": tap your team's logo and you're taken straight to My Week.
export default function HomeView({ afcManagers, nfcManagers, afcStandings, nfcStandings, myTeamManager, onChooseMyTeam, teamBurst, settingsMenu }) {
  return (
    <div className="relative min-h-[80vh] flex flex-col items-center gap-6 text-center">
      {/* The regular header is hidden on Home, so the same controls sit in the corner. */}
      <div className="absolute top-2 right-0 sm:top-4 flex items-center gap-2">
        <ModeToggle />
        {settingsMenu}
      </div>
      <ConfettiBurst burst={teamBurst} />
      <div className="mt-14 sm:mt-10 flex flex-col items-center gap-3">
        <AnimatedLogo sizeClass="w-24 h-24 sm:w-28 sm:h-28" showGlow />
        <h1 className="lenzone-title font-display text-4xl sm:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent">LENZONE 2026</h1>
        <p className="font-display text-lg sm:text-xl text-[var(--text2)]">Who are you?</p>
      </div>
      {/* AFC and NFC side by side, as equals, with a divider between them. */}
      <div className="w-full max-w-6xl grid grid-cols-[1fr_auto_1fr] gap-3 sm:gap-6 px-1 items-start">
        <ConferenceGrid conf="AFC" managers={afcManagers} standings={afcStandings} myTeamManager={myTeamManager} onPick={onChooseMyTeam} />
        <div className="self-stretch w-px bg-gradient-to-b from-transparent via-[var(--border2)] to-transparent" aria-hidden="true" />
        <ConferenceGrid conf="NFC" managers={nfcManagers} standings={nfcStandings} myTeamManager={myTeamManager} onPick={onChooseMyTeam} />
      </div>
    </div>
  );
}
