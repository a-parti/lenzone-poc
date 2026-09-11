import { useEffect, useRef } from 'react';
import { gagState } from '../lib/gagState';

// Own idle threshold, jittered off the other gags' so they don't all race to fire on the same tick.
const IDLE_MS = 8000 + Math.random() * 6000;
const MAX_GAG_MS = 14000;
const TOSS_INTERVAL_MS = 1600;
const SIZE = 44;
const COUNT = 6;
const EMOJI = '🏆';

// A handful of 🏆 -- the same trophy used elsewhere in the app for player-highlight cards --
// tossed around the viewport together as independent Matter.js bodies, each bouncing off the
// floor, walls, and real page-content collision proxies (same approach as BouncingFootball), with
// its own randomly-offset toss timer so they scatter rather than moving in lockstep.
export default function BouncingTrophies({ enabled }) {
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

      if (!runningRef.current) { runningRef.current = false; gagState.active = false; return; }

      const overlay = overlayRef.current;
      const engine = Engine.create();
      engine.world.gravity.y = 1;
      const runner = Runner.create();

      const items = Array.from({ length: COUNT }, (_, i) => {
        const el = document.createElement('div');
        el.textContent = EMOJI;
        el.style.cssText = `position:fixed; left:0; top:0; width:${SIZE}px; height:${SIZE}px; font-size:${SIZE * 0.85}px; line-height:1; text-align:center; pointer-events:none; will-change:transform;`;
        overlay.appendChild(el);
        const startX = window.innerWidth * (0.1 + Math.random() * 0.8);
        const body = Bodies.circle(startX, -SIZE - i * 60, SIZE / 2, {
          restitution: 0.6, friction: 0.15, frictionAir: 0.008, density: 0.002
        });
        return { el, body, tossOffset: Math.random() * TOSS_INTERVAL_MS };
      });
      Composite.add(engine.world, items.map(i => i.body));

      const wallOpts = { isStatic: true, restitution: 0.6 };
      const floor = Bodies.rectangle(window.innerWidth / 2, window.innerHeight + 20, window.innerWidth * 2, 40, wallOpts);
      const leftWall = Bodies.rectangle(-20, window.innerHeight / 2, 40, window.innerHeight * 2, wallOpts);
      const rightWall = Bodies.rectangle(window.innerWidth + 20, window.innerHeight / 2, 40, window.innerHeight * 2, wallOpts);
      Composite.add(engine.world, [floor, leftWall, rightWall]);

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

      const toss = (item) => {
        Body.setVelocity(item.body, { x: (Math.random() - 0.5) * 14, y: -5 - Math.random() * 6 });
        Body.setAngularVelocity(item.body, (Math.random() - 0.5) * 0.5);
      };
      items.forEach(toss);
      const tossTimers = items.map(item => setInterval(() => toss(item), TOSS_INTERVAL_MS + item.tossOffset));

      Runner.run(runner, engine);

      let rafId;
      const endAt = Date.now() + MAX_GAG_MS;
      const tick = () => {
        for (const item of items) {
          const { position, angle } = item.body;
          item.el.style.transform = `translate(${position.x - SIZE / 2}px, ${position.y - SIZE / 2}px) rotate(${angle}rad)`;
        }
        if (Date.now() > endAt) { endGag(); return; }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      cleanupRef.current = () => {
        cancelAnimationFrame(rafId);
        tossTimers.forEach(clearInterval);
        Runner.stop(runner);
        Engine.clear(engine);
        items.forEach(({ el }) => el.remove());
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
