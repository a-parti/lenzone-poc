import React, { useMemo, useState, useEffect } from 'react';
import { Volume2, VolumeX, Sun, Moon } from 'lucide-react';
import { TeamPicker } from './shared';
import { useTheme } from '../context/ThemeContext';
import { useTeamLogo } from '../context/TeamLogoContext';
import { Zoomable } from '../context/ImageLightboxContext';
import AnimatedLogo from './AnimatedLogo';

// Easter egg: a short burst in the just-picked team's color, fired for EVERY manager selection
// (whichever color they landed on -- an admin-configured default, or this pick's fresh random
// roll) -- not just the handful with an admin-configured default. One of several animation STYLES
// is picked at random each time so it's not the exact same burst every single pick. Pure CSS
// transforms/opacity (see the matching keyframes in index.css), no animation library needed for a
// couple dozen particles.
const BURST_STYLES = ["confetti", "sparkle", "rings", "streamers", "starburst", "spiral", "fireworks"];

function ConfettiBurst({ burst }) {
  const style = useMemo(() => BURST_STYLES[Math.floor(Math.random() * BURST_STYLES.length)], [burst?.nonce]);

  const pieces = useMemo(() => {
    if (!burst) return [];
    if (style === "rings") {
      // Just a few concentric expanding rings, staggered -- not "many small particles" like the
      // others, so it's generated separately below with its own count/shape.
      return Array.from({ length: 3 }, (_, i) => ({ id: i, delay: i * 0.15 }));
    }
    const count = style === "streamers" ? 16 : style === "starburst" ? 20 : style === "fireworks" ? 28 : 24;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * 2 * Math.PI + Math.random() * 0.4;
      const distance = style === "sparkle" ? 40 + Math.random() * 50 : style === "starburst" ? 120 + Math.random() * 60 : 90 + Math.random() * 90;
      const fallBias = style === "streamers" ? 60 + Math.random() * 40 : 0; // streamers drift downward, not just outward
      // Fireworks shoot up first (negative dy), then arc back down past their starting height --
      // needs its own up/down pair since every other style is a single one-way translate.
      const upDist = 50 + Math.random() * 50;
      const downDist = upDist + 60 + Math.random() * 50;
      return {
        id: i,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 40 + fallBias,
        dyUp: -upDist,
        dyDown: downDist,
        rotate: Math.random() * 720 - 360,
        angleDeg: (angle * 180) / Math.PI,
        delay: Math.random() * (style === "streamers" ? 0.2 : style === "fireworks" ? 0.15 : 0.12),
        size: style === "sparkle" ? 4 + Math.random() * 5 : style === "fireworks" ? 3 + Math.random() * 4 : 6 + Math.random() * 6
      };
    });
  }, [burst?.nonce, style]);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!burst) return;
    setVisible(true);
    const duration = style === "streamers" ? 1500 : style === "rings" ? 1000 : style === "fireworks" ? 1300 : style === "spiral" ? 1100 : 1100;
    const t = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(t);
  }, [burst?.nonce, style]);

  if (!burst || !visible) return null;

  if (style === "rings") {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-visible" aria-hidden="true">
        {pieces.map(p => (
          <span
            key={p.id}
            className="ring-piece absolute rounded-full border-2"
            style={{ top: 40, width: 24, height: 24, borderColor: burst.color, animationDelay: `${p.delay}s` }}
          />
        ))}
      </div>
    );
  }

  if (style === "starburst") {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-visible" aria-hidden="true">
        {pieces.map(p => (
          <span
            key={p.id}
            className="ray-piece absolute rounded-full"
            style={{
              top: 40, left: 0, width: 5, height: 2.5,
              backgroundColor: burst.color,
              animationDelay: `${p.delay}s`,
              transformOrigin: 'left center',
              '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.angleDeg}deg`
            }}
          />
        ))}
      </div>
    );
  }

  if (style === "fireworks") {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-visible" aria-hidden="true">
        {pieces.map(p => (
          <span
            key={p.id}
            className="firework-piece absolute rounded-full"
            style={{
              top: 40, width: p.size, height: p.size,
              backgroundColor: burst.color,
              animationDelay: `${p.delay}s`,
              '--dx': `${p.dx}px`, '--dyUp': `${p.dyUp}px`, '--dyDown': `${p.dyDown}px`
            }}
          />
        ))}
      </div>
    );
  }

  const pieceClass = style === "sparkle" ? "sparkle-piece rounded-full" : style === "streamers" ? "streamer-piece rounded-sm" : style === "spiral" ? "spiral-piece rounded-full" : "confetti-piece rounded-sm";
  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-visible" aria-hidden="true">
      {pieces.map(p => (
        <span
          key={p.id}
          className={`absolute ${pieceClass}`}
          style={{
            top: 40,
            width: style === "streamers" ? p.size * 0.6 : p.size,
            height: style === "streamers" ? p.size * 2.4 : p.size,
            backgroundColor: burst.color,
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

function navSections(selectedWeek) {
  return [
    { id: "currentWeek", title: `This Week (${selectedWeek})` },
    { id: "standings", title: "Standings" },
    { id: "matchups", title: "Matchups" },
    { id: "grid", title: "Grid" },
    { id: "players", title: "Players" },
    { id: "news", title: "News" }
  ];
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
  setActiveTab, selectedWeek, afcManagers, nfcManagers, myTeamManager, onChooseMyTeam, teamBurst, soundMuted, onToggleSoundMuted
}) {
  const sections = navSections(selectedWeek);
  const { mode, setMode } = useTheme();

  return (
    <div className="relative min-h-[80vh] flex flex-col items-center gap-8 text-center">
      {/* The header (with its own mute + mode buttons) is hidden on Home, so this is the ONLY way to
          mute or switch light/dark before ever picking a team for the first time. Same left-to-right
          order as the header: mode toggle, then mute as the far-right-most control. */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
          title={mode === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={mode === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
          className="p-2 rounded-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] transition-colors duration-200"
        >
          {mode === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
        {onToggleSoundMuted && (
          <button
            type="button"
            onClick={onToggleSoundMuted}
            title={soundMuted ? "Unmute team easter-egg sounds" : "Mute team easter-egg sounds"}
            aria-label={soundMuted ? "Unmute team easter-egg sounds" : "Mute team easter-egg sounds"}
            className="p-2 rounded-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] transition-colors duration-200"
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}
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
