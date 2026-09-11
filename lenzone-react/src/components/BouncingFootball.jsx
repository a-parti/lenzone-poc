import { useEffect, useRef } from 'react';
import { gagState } from '../lib/gagState';

// Own idle threshold, jittered a few seconds off HeaderKnockover's flat 8s so the two gags don't
// always race to fire on the exact same tick -- whichever's timer crosses first claims gagState
// and the other just waits for the next idle window.
const IDLE_MS = 8000 + Math.random() * 4000;
const MAX_GAG_MS = 14000;
// How often the ball gets a fresh random shove -- keeps it being "thrown around" instead of just
// settling to a stop after the first bounce.
const TOSS_INTERVAL_MS = 1400;
const SIZE = 56;

// A 🏈 rendered as its own fixed-position element (no real DOM element to clone here, unlike the
// header gag) that gets tossed around the viewport as a real Matter.js body -- bouncing off the
// floor, walls, and the same page-content collision proxies HeaderKnockover uses, with a fresh
// random shove every TOSS_INTERVAL_MS so it keeps moving instead of rolling to a stop.
export default function BouncingFootball({ enabled }) {
  const overlayRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const runningRef = useRef(false);
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const markActivity = () => {
      lastActivityRef.current = Date.now();
      if (runningRef.current) endGag();
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach(e => window.addEventListener(e, markActivity, { passive: true }));

    const interval = setInterval(() => {
      if (runningRef.current || gagState.active) return;
      if (Date.now() - lastActivityRef.current >= IDLE_MS) startGag();
    }, 1000);

    function endGag() {
      runningRef.current = false;
      gagState.active = false;
      cleanupRef.current?.();
      cleanupRef.current = null;
      lastActivityRef.current = Date.now();
    }

    async function startGag() {
      if (runningRef.current || gagState.active) return;
      runningRef.current = true;
      gagState.active = true;

      const MatterMod = await import('matter-js');
      const Matter = MatterMod.default ?? MatterMod;
      const { Engine, Runner, Bodies, Body, Composite } = Matter;

      // Bail if activity happened while the module was loading.
      if (!runningRef.current) { runningRef.current = false; gagState.active = false; return; }

      const overlay = overlayRef.current;
      const engine = Engine.create();
      engine.world.gravity.y = 1;
      const runner = Runner.create();

      const startX = window.innerWidth * (0.2 + Math.random() * 0.6);
      const ball = document.createElement('div');
      ball.textContent = '🏈';
      ball.style.cssText = `position:fixed; left:0; top:0; width:${SIZE}px; height:${SIZE}px; font-size:${SIZE * 0.85}px; line-height:1; text-align:center; pointer-events:none; will-change:transform;`;
      overlay.appendChild(ball);

      const body = Bodies.circle(startX, -SIZE, SIZE / 2, {
        restitution: 0.65, friction: 0.15, frictionAir: 0.008, density: 0.002
      });
      Composite.add(engine.world, body);

      // Walls and floor so the ball bounces around inside the viewport rather than exiting it --
      // this gag is meant to bounce around indefinitely (well, for MAX_GAG_MS), not fall off-screen.
      const wallOpts = { isStatic: true, restitution: 0.6 };
      const floor = Bodies.rectangle(window.innerWidth / 2, window.innerHeight + 20, window.innerWidth * 2, 40, wallOpts);
      const leftWall = Bodies.rectangle(-20, window.innerHeight / 2, 40, window.innerHeight * 2, wallOpts);
      const rightWall = Bodies.rectangle(window.innerWidth + 20, window.innerHeight / 2, 40, window.innerHeight * 2, wallOpts);
      Composite.add(engine.world, [floor, leftWall, rightWall]);

      // Static collision proxies matching real page content (same approach as HeaderKnockover) so
      // the ball visibly bounces off the header and whatever's in the open tab, not just the floor.
      const obstacles = [];
      const header = document.querySelector('header') || document.querySelector('main')?.previousElementSibling;
      const main = document.querySelector('main');
      [header, ...(main ? Array.from(main.children) : [])].forEach(el => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 10) return;
        obstacles.push(Bodies.rectangle(r.left + r.width / 2, r.top + r.height / 2, r.width, r.height, { isStatic: true, restitution: 0.5 }));
      });
      Composite.add(engine.world, obstacles);

      const toss = () => {
        Body.setVelocity(body, { x: (Math.random() - 0.5) * 16, y: -6 - Math.random() * 6 });
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.5);
      };
      toss();
      const tossInterval = setInterval(toss, TOSS_INTERVAL_MS);

      Runner.run(runner, engine);

      let rafId;
      const endAt = Date.now() + MAX_GAG_MS;
      const tick = () => {
        const { position, angle } = body;
        ball.style.transform = `translate(${position.x - SIZE / 2}px, ${position.y - SIZE / 2}px) rotate(${angle}rad)`;
        if (Date.now() > endAt) { endGag(); return; }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      cleanupRef.current = () => {
        cancelAnimationFrame(rafId);
        clearInterval(tossInterval);
        Runner.stop(runner);
        Engine.clear(engine);
        ball.remove();
      };
    }

    return () => {
      events.forEach(e => window.removeEventListener(e, markActivity));
      clearInterval(interval);
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (runningRef.current) gagState.active = false;
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return <div ref={overlayRef} className="fixed inset-0 z-[999] overflow-hidden" style={{ pointerEvents: 'none' }} />;
}
