import React, { useMemo, useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { TeamPicker } from './shared';

// Easter egg: a short confetti burst in a team's real brand color, fired only for managers with an
// admin-configured default (lib/teamDefaults.js) -- everyone else gets the normal picker with no
// extra flourish. Pure CSS transforms/opacity (see the .confetti-piece keyframes in index.css), no
// animation library needed for ~20 particles.
function ConfettiBurst({ burst }) {
  const pieces = useMemo(() => {
    if (!burst) return [];
    return Array.from({ length: 22 }, (_, i) => {
      const angle = (i / 22) * 2 * Math.PI + Math.random() * 0.4;
      const distance = 90 + Math.random() * 90;
      return {
        id: i,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 40,
        rotate: Math.random() * 720 - 360,
        delay: Math.random() * 0.12,
        size: 6 + Math.random() * 6
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
          className="confetti-piece absolute rounded-sm"
          style={{
            top: 40, width: p.size, height: p.size,
            backgroundColor: burst.color,
            animationDelay: `${p.delay}s`,
            '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--rot': `${p.rotate}deg`
          }}
        />
      ))}
    </div>
  );
}

function navSections(selectedWeek) {
  return [
    { id: "currentWeek", title: `This Week (${selectedWeek})` },
    { id: "standings", title: "Standings" },
    { id: "matchups", title: "Matchups" },
    { id: "players", title: "Players" }
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
export default function HomeView({ setActiveTab, selectedWeek, afcManagers, nfcManagers, myTeamManager, onChooseMyTeam, teamBurst, soundMuted, onToggleSoundMuted }) {
  const sections = navSections(selectedWeek);

  return (
    <div className="relative min-h-[70vh] flex flex-col items-center gap-8 text-center pt-16 sm:pt-24">
      {/* The header (with its own mute button) is hidden on Home, so this is the ONLY way to mute
          before ever picking a team for the first time -- without it, muting is only reachable
          after the header appears, i.e. after a sound has already had the chance to play once. */}
      {onToggleSoundMuted && (
        <button
          type="button"
          onClick={onToggleSoundMuted}
          title={soundMuted ? "Unmute team easter-egg sounds" : "Mute team easter-egg sounds"}
          aria-label={soundMuted ? "Unmute team easter-egg sounds" : "Mute team easter-egg sounds"}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-full bg-[var(--surface2)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] transition-colors duration-200"
        >
          {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      )}
      <ConfettiBurst burst={teamBurst} />
      <TeamPicker afcManagers={afcManagers} nfcManagers={nfcManagers} value={myTeamManager} onChange={onChooseMyTeam} variant="blend" />

      {myTeamManager && (
        <NavListNumbered sections={sections} onSelect={setActiveTab} />
      )}
    </div>
  );
}
