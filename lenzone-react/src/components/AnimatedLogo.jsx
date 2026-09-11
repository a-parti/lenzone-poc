import React, { useState, useEffect, useRef } from 'react';
import lenzoneLogoRing from '../assets/lenzone-logo-ring.png';
import lenzoneLogoBall from '../assets/lenzone-logo-ball.png';

// The app's ring+football mark, read as a cartoon eye (the ring is the iris, the ball the pupil).
// Ring and ball spin independently at a CONSTANT rate -- different rates, opposite directions --
// deliberately goofy/cartoonish rather than a clean mechanical spin. The cursor never changes spin
// speed: instead, getting closer (tracked across the whole page, not just on hover) makes the
// squash/stretch morph more dramatic, and directly hovering it slows both spins way down instead of
// speeding them up. Layered interactions, each on its own nested element so their transforms don't
// fight: the outer zone tilts the whole thing toward the cursor, the middle layer reacts to hover
// and click (a squash-and-stretch "boing"), the ball blinks shut every few seconds like an actual
// eye, and two independent random timers occasionally fire a speed burst or a head-wobble so it
// never feels like one predictable loop. Shared by the big Home pre-pick placeholder and the small
// header logo on every other page, so it's the same living mark everywhere, not two designs.
export default function AnimatedLogo({ sizeClass = "w-14 h-14", showGlow = false, onClick, label = "LENZONE" }) {
  const zoneRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [morphAmt, setMorphAmt] = useState(0.1);
  const [clicked, setClicked] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [bursting, setBursting] = useState(false);
  const [wobbling, setWobbling] = useState(false);

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

  // Two more random, occasional flourishes on top of the steady spin/morph/blink -- a sudden
  // speed burst (both spins rev up briefly, like it got excited) and a side-to-side head-wobble
  // (like it noticed something). Each on its own independent random timer so they don't always
  // land together, which keeps it feeling alive rather than on a predictable loop.
  useEffect(() => {
    let timeoutId;
    const scheduleBurst = () => {
      timeoutId = setTimeout(() => {
        setBursting(true);
        setTimeout(() => setBursting(false), 700);
        scheduleBurst();
      }, 7000 + Math.random() * 9000);
    };
    scheduleBurst();
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    let timeoutId;
    const scheduleWobble = () => {
      timeoutId = setTimeout(() => {
        setWobbling(true);
        setTimeout(() => setWobbling(false), 600);
        scheduleWobble();
      }, 5000 + Math.random() * 8000);
    };
    scheduleWobble();
    return () => clearTimeout(timeoutId);
  }, []);

  // Tracks the cursor across the WHOLE page (window listener), not just while hovering the logo
  // itself -- it should lean toward you no matter where on the page your mouse actually is, like
  // eyes following you around a room, not just react when you happen to be right on top of it.
  // Distance from the cursor also drives --morph-amt (closer = more dramatic squash/stretch) --
  // proximity reads as "more alive", never as "spinning faster".
  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      const rect = zoneRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (window.innerWidth / 2);
      const dy = (e.clientY - cy) / (window.innerHeight / 2);
      setTilt({
        x: Math.max(-1, Math.min(1, dx)) * 16,
        y: Math.max(-1, Math.min(1, dy)) * -16
      });
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      const proximity = Math.max(0, 1 - dist / 500);
      setMorphAmt(0.06 + proximity * 0.32);
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
      style={{ transform: `perspective(400px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)`, '--morph-amt': morphAmt }}
    >
      <div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={label}
        onClick={onClick ? fireClick : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fireClick(); } } : undefined}
        className={`group relative ${sizeClass} shrink-0 ${onClick ? "cursor-pointer" : ""} ${clicked ? "big-logo-click" : ""} ${bursting ? "big-logo-burst" : ""} ${wobbling ? "big-logo-wobble" : ""}`}
      >
        {showGlow && <div className="big-logo-glow absolute -inset-4 rounded-full" aria-hidden="true" />}
        <div className="big-logo-morph absolute inset-0">
          <img src={lenzoneLogoRing} alt="" aria-hidden="true" className="big-logo-ring absolute inset-0 w-full h-full" />
        </div>
        <div className={`absolute inset-0 ${blinking ? "big-logo-blink" : ""}`}>
          <div className="big-logo-morph absolute inset-0">
            <img src={lenzoneLogoBall} alt={label} className="big-logo-ball absolute inset-0 w-full h-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
