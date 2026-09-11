import { useEffect, useRef } from 'react';
import { gagState } from '../lib/gagState';
import lenzoneLogoBall from '../assets/lenzone-logo-ball.png';

const DRAG_THRESHOLD = 6;
const VELOCITY_SCALE = 16;
const MAX_FLIGHT_MS = 12000;
const SETTLE_SPEED = 0.15;
const SETTLE_HOLD_MS = 1200;
const EXIT_MARGIN = 150;

// Not an idle gag: the header logo's "ball" (the spinning football-as-pupil at the center of the
// ring, see AnimatedLogo.jsx) is grabbable at any time. Pick it up and fling it and it flies out as
// a real Matter.js body -- bouncing off the header, page content, floor and walls like the other
// physics gags -- then reappears back in its ring once it settles or falls off-screen. A plain
// click with no real movement is left alone so the logo's normal "go home" click still works.
export default function GrabbableFootball({ targetRef, enabled }) {
  const overlayRef = useRef(null);
  const finishFlightRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const container = targetRef.current;
    if (!container) return;

    let ballEl = null;
    let ghost = null;
    let pointerId = null;
    let dragging = false;
    let moved = false;
    let samples = [];

    const suppressClick = (e) => { e.stopPropagation(); e.preventDefault(); };

    const onPointerDown = (e) => {
      if (gagState.active) return;
      const target = e.target.closest('.big-logo-ball');
      if (!target) return;
      ballEl = target;
      pointerId = e.pointerId;
      dragging = true;
      moved = false;
      samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    };

    const ensureGhost = () => {
      const rect = ballEl.getBoundingClientRect();
      ghost = document.createElement('img');
      ghost.src = lenzoneLogoBall;
      ghost.alt = '';
      ghost.style.cssText = `position:fixed; left:${rect.left}px; top:${rect.top}px; width:${rect.width}px; height:${rect.height}px; pointer-events:none; will-change:transform;`;
      overlayRef.current.appendChild(ghost);
      ballEl.style.visibility = 'hidden';
      gagState.active = true;
      container.addEventListener('click', suppressClick, { capture: true, once: true });
    };

    const onPointerMove = (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      const dx = e.clientX - samples[0].x;
      const dy = e.clientY - samples[0].y;
      if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        moved = true;
        ensureGhost();
      }
      if (moved && ghost) {
        const rect = ghost.getBoundingClientRect();
        ghost.style.left = `${e.clientX - rect.width / 2}px`;
        ghost.style.top = `${e.clientY - rect.height / 2}px`;
        samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (samples.length > 6) samples.shift();
      }
    };

    const onPointerUp = (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      if (!moved) { ballEl = null; return; }
      const a = samples[samples.length - 2] || samples[0];
      const b = samples[samples.length - 1];
      const dt = Math.max(1, b.t - a.t);
      const vx = ((b.x - a.x) / dt) * VELOCITY_SCALE;
      const vy = ((b.y - a.y) / dt) * VELOCITY_SCALE;
      const rect = ghost.getBoundingClientRect();
      throwBall(rect, vx, vy);
      ballEl = null;
    };

    async function throwBall(rect, vx, vy) {
      const MatterMod = await import('matter-js');
      const Matter = MatterMod.default ?? MatterMod;
      const { Engine, Runner, Bodies, Body, Composite } = Matter;

      const size = rect.width;
      const engine = Engine.create();
      engine.world.gravity.y = 1;
      const runner = Runner.create();

      const body = Bodies.circle(rect.left + size / 2, rect.top + size / 2, size / 2, {
        restitution: 0.6, friction: 0.2, frictionAir: 0.01, density: 0.002
      });
      Body.setVelocity(body, { x: vx, y: vy });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.3);
      Composite.add(engine.world, body);

      const wallOpts = { isStatic: true, restitution: 0.55 };
      const floor = Bodies.rectangle(window.innerWidth / 2, window.innerHeight + 20, window.innerWidth * 2, 40, wallOpts);
      const leftWall = Bodies.rectangle(-20, window.innerHeight / 2, 40, window.innerHeight * 2, wallOpts);
      const rightWall = Bodies.rectangle(window.innerWidth + 20, window.innerHeight / 2, 40, window.innerHeight * 2, wallOpts);
      Composite.add(engine.world, [floor, leftWall, rightWall]);

      // Same collision-proxy approach as the other physics gags -- the thrown ball bounces off
      // real page furniture (header + whatever's in the open tab) on its way around.
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

      Runner.run(runner, engine);

      let rafId;
      let slowSince = null;
      const endAt = Date.now() + MAX_FLIGHT_MS;
      const finish = () => {
        cancelAnimationFrame(rafId);
        Runner.stop(runner);
        Engine.clear(engine);
        ghost?.remove();
        ghost = null;
        // ballEl reference here belongs to whichever grab most recently opened the ring slot --
        // restoring by re-querying keeps this correct even if the component re-rendered since.
        const originalBall = container.querySelector('.big-logo-ball');
        if (originalBall) originalBall.style.visibility = '';
        gagState.active = false;
        finishFlightRef.current = null;
      };
      finishFlightRef.current = finish;

      const tick = () => {
        const { position, angle, speed } = body;
        ghost.style.left = `${position.x - size / 2}px`;
        ghost.style.top = `${position.y - size / 2}px`;
        ghost.style.transform = `rotate(${angle}rad)`;
        if (position.y - size / 2 > window.innerHeight + EXIT_MARGIN) { finish(); return; }
        if (speed < SETTLE_SPEED) {
          slowSince = slowSince ?? Date.now();
          if (Date.now() - slowSince > SETTLE_HOLD_MS) { finish(); return; }
        } else {
          slowSince = null;
        }
        if (Date.now() > endAt) { finish(); return; }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const hintEl = container.querySelector('.big-logo-ball');
    if (hintEl) hintEl.style.cursor = 'grab';

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('click', suppressClick, { capture: true });
      if (hintEl) hintEl.style.cursor = '';
      finishFlightRef.current?.();
      finishFlightRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, targetRef]);

  return <div ref={overlayRef} className="fixed inset-0 z-[999] overflow-hidden" style={{ pointerEvents: 'none' }} />;
}
