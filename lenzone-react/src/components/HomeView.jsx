import React, { useMemo, useState, useEffect } from 'react';
import { TeamPicker } from './shared';
import { useTeamLogo } from '../context/TeamLogoContext';
import { Zoomable } from '../context/ImageLightboxContext';
import AnimatedLogo from './AnimatedLogo';

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

// A big, prominent version of the chosen fantasy team's real Sleeper avatar -- small everywhere
// else (roster cards, matchup rows), but here it's the whole point: confirming "yes, this is me"
// right after picking. Fades/scales in rather than just popping in, matching the rest of the
// picker's transition feel.
function BigTeamLogo({ manager }) {
  const logoUrl = useTeamLogo(manager);
  if (!logoUrl) return null;
  return (
    <div className="flex justify-center mb-4" style={{ perspective: '700px' }}>
      <Zoomable
        key={manager}
        src={logoUrl}
        alt={manager}
        className="coin-flip w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-[var(--accent)]/60 shadow-lg shadow-[var(--accent)]/20"
      />
    </div>
  );
}

// Before a team is picked, this fills the same big-logo slot BigTeamLogo takes afterward -- the
// same living AnimatedLogo used in the header, just bigger and with its glow turned on.
function BigAppLogo() {
  return (
    <div className="flex justify-center mb-4 py-6">
      <AnimatedLogo sizeClass="w-28 h-28 sm:w-36 sm:h-36" showGlow />
    </div>
  );
}

// Editorial table-of-contents style list -- serif titles, no index number, underline-style hover.
function NavListNumbered({ sections, onSelect }) {
  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in-up">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          className="w-full flex items-center py-4 border-b border-[var(--border)] text-left group hover:border-[var(--accent)] transition-colors duration-200"
        >
          <span
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            className="text-2xl sm:text-3xl text-[var(--text)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all duration-200"
          >
            {s.title}
          </span>
        </button>
      ))}
    </div>
  );
}

// Deliberately minimal: pick your team, then navigate everywhere else via the menu that appears
// underneath. No stats, no cards, no banners -- that content now lives on the "Week N" tab.
export default function HomeView({
  setActiveTab, sections, afcManagers, nfcManagers, myTeamManager, onChooseMyTeam, teamBurst, settingsMenu
}) {
  return (
    <div className="relative min-h-[80vh] flex flex-col items-center gap-8 text-center">
      {/* The regular header is hidden on Home, so the same settings menu sits in the corner. */}
      <div className="absolute top-2 right-0 sm:top-4">
        {settingsMenu}
      </div>
      <ConfettiBurst burst={teamBurst} />
      {/* Roughly centered in the viewport before a pick (nothing else on the page yet to balance
          against); once the nav list is about to appear below it, the picker eases upward to make
          room instead of the list just abruptly appearing under a still-centered picker. */}
      <div className={`transition-[margin-top] duration-500 ease-out ${myTeamManager ? "mt-16 sm:mt-20" : "mt-[26vh] sm:mt-[30vh]"}`}>
        {myTeamManager ? <BigTeamLogo manager={myTeamManager} /> : <BigAppLogo />}
        <TeamPicker afcManagers={afcManagers} nfcManagers={nfcManagers} value={myTeamManager} onChange={onChooseMyTeam} variant="blend" />
      </div>

      {myTeamManager && (
        <NavListNumbered sections={sections} onSelect={setActiveTab} />
      )}
    </div>
  );
}
