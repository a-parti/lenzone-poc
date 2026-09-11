import React, { useState, useEffect, useRef } from 'react';
import lenzoneLogoRing from '../assets/lenzone-logo-ring.png';
import lenzoneLogoBall from '../assets/lenzone-logo-ball.png';

// The app's ring+football mark, read as a cartoon eye (the ring is the iris, the ball the pupil).
// Ring and ball spin independently -- different rates, opposite directions, each morphing its own
// squash/stretch -- deliberately goofy/cartoonish rather than a clean mechanical spin. Layered
// interactions, each on its own nested element so their transforms don't fight: the outer zone
// tilts the whole thing toward the cursor (tracked across the whole page, not just on hover), the
// middle layer reacts to hover (both spins speed up, via the .group CSS hook) and click (a
// squash-and-stretch "boing"), and the ball blinks shut every few seconds like an actual eye.
// Shared by the big Home pre-pick placeholder and the small header logo on every other page, so
// it's the same living mark everywhere, not two designs.
export default function AnimatedLogo({ sizeClass = "w-14 h-14", showGlow = false, onClick, label = "LENZONE" }) {
  const zoneRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [clicked, setClicked] = useState(false);
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    let timeoutId;
    const scheduleBlink = () => {
      timeoutId = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => setBlinking(false), 260);
        scheduleBlink();
      }, 2800 + Math.random() * 4200);
    };
    scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, []);

  // Tracks the cursor across the WHOLE page (window listener), not just while hovering the logo
  // itself -- it should lean toward you no matter where on the page your mouse actually is, like
  // eyes following you around a room, not just react when you happen to be right on top of it.
  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      const rect = zoneRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = (e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2);
      const dy = (e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2);
      setTilt({
        x: Math.max(-1, Math.min(1, dx)) * 16,
        y: Math.max(-1, Math.min(1, dy)) * -16
      });
    };
    window.addEventListener('mousemove', handleWindowMouseMove);
    return () => window.removeEventListener('mousemove', handleWindowMouseMove);
  }, []);

  const fireClick = () => {
    setClicked(true);
    setTimeout(() => setClicked(false), 420);
    onClick?.();
  };

  return (
    <div
      ref={zoneRef}
      className="inline-block transition-transform duration-150 ease-out"
      style={{ transform: `perspective(400px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` }}
    >
      <div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={label}
        onClick={onClick ? fireClick : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fireClick(); } } : undefined}
        className={`group relative ${sizeClass} shrink-0 ${onClick ? "cursor-pointer" : ""} ${clicked ? "big-logo-click" : ""}`}
      >
        {showGlow && <div className="big-logo-glow absolute -inset-4 rounded-full" aria-hidden="true" />}
        <img src={lenzoneLogoRing} alt="" aria-hidden="true" className="big-logo-ring absolute inset-0 w-full h-full" />
        <div className={`absolute inset-0 ${blinking ? "big-logo-blink" : ""}`}>
          <img src={lenzoneLogoBall} alt={label} className="big-logo-ball absolute inset-0 w-full h-full" />
        </div>
      </div>
    </div>
  );
}
