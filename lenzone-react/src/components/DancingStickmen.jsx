import { useEffect, useRef } from 'react';
import { gagState } from '../lib/gagState';

const IDLE_MS = 8000 + Math.random() * 6000;
const MAX_GAG_MS = 16000;
const NUDGE_INTERVAL_MS = 500;
const COUNT = 3;
const COLORS = ['#f87171', '#4ade80', '#60a5fa', '#facc15', '#a78bfa'];

// Builds one ragdoll stickman: head + torso + two arms + two legs as separate rigid bodies held
// together with loose constraints, plus a single stiff-but-swingy constraint from a fixed point
// above the head down to the torso -- like a marionette string -- so gravity doesn't just dump it
// on the floor. It hangs and swings, and a periodic random torque/impulse on each limb (see the
// "nudge" loop below) is what actually makes it "dance": real physics keeps it floppy and a little
// chaotic rather than a smooth choreographed animation, which is the joke.
function buildStickman(Matter, x, y, color) {
  const { Bodies, Constraint, Body } = Matter;
  const headR = 10;
  const torsoW = 10, torsoH = 36;
  const limbW = 7, limbH = 24;

  const head = Bodies.circle(x, y, headR, { friction: 0.1, restitution: 0.3, density: 0.0012 });
  const torso = Bodies.rectangle(x, y + headR + torsoH / 2, torsoW, torsoH, { friction: 0.1, restitution: 0.3, density: 0.0012 });
  const armY = y + headR + limbH / 2 + 2;
  const leftArm = Bodies.rectangle(x - torsoW / 2 - limbW / 2, armY, limbW, limbH, { friction: 0.1, restitution: 0.3, density: 0.0008 });
  const rightArm = Bodies.rectangle(x + torsoW / 2 + limbW / 2, armY, limbW, limbH, { friction: 0.1, restitution: 0.3, density: 0.0008 });
  const legY = y + headR + torsoH + limbH / 2;
  const leftLeg = Bodies.rectangle(x - torsoW / 4, legY, limbW, limbH, { friction: 0.1, restitution: 0.3, density: 0.0008 });
  const rightLeg = Bodies.rectangle(x + torsoW / 4, legY, limbW, limbH, { friction: 0.1, restitution: 0.3, density: 0.0008 });

  const parts = [
    { body: head, shape: 'circle', size: headR * 2 },
    { body: torso, shape: 'rect', w: torsoW, h: torsoH },
    { body: leftArm, shape: 'rect', w: limbW, h: limbH },
    { body: rightArm, shape: 'rect', w: limbW, h: limbH },
    { body: leftLeg, shape: 'rect', w: limbW, h: limbH },
    { body: rightLeg, shape: 'rect', w: limbW, h: limbH },
  ];

  const stiffLoose = { stiffness: 0.5, damping: 0.15 };
  const constraints = [
    Constraint.create({ bodyA: head, pointA: { x: 0, y: headR }, bodyB: torso, pointB: { x: 0, y: -torsoH / 2 }, length: 2, ...stiffLoose }),
    Constraint.create({ bodyA: torso, pointA: { x: -torsoW / 2, y: -torsoH / 2 + 4 }, bodyB: leftArm, pointB: { x: 0, y: -limbH / 2 }, length: 2, ...stiffLoose }),
    Constraint.create({ bodyA: torso, pointA: { x: torsoW / 2, y: -torsoH / 2 + 4 }, bodyB: rightArm, pointB: { x: 0, y: -limbH / 2 }, length: 2, ...stiffLoose }),
    Constraint.create({ bodyA: torso, pointA: { x: -torsoW / 4, y: torsoH / 2 }, bodyB: leftLeg, pointB: { x: 0, y: -limbH / 2 }, length: 2, ...stiffLoose }),
    Constraint.create({ bodyA: torso, pointA: { x: torsoW / 4, y: torsoH / 2 }, bodyB: rightLeg, pointB: { x: 0, y: -limbH / 2 }, length: 2, ...stiffLoose }),
    // The "string": a fixed anchor point in space down to the torso, loose enough to swing.
    Constraint.create({ pointA: { x, y: y - 20 }, bodyB: torso, pointB: { x: 0, y: -torsoH / 2 - 4 }, length: 30, stiffness: 0.04 }),
  ];

  const els = parts.map(p => {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.pointerEvents = 'none';
    el.style.willChange = 'transform';
    el.style.background = color;
    if (p.shape === 'circle') {
      el.style.width = `${p.size}px`;
      el.style.height = `${p.size}px`;
      el.style.borderRadius = '50%';
    } else {
      el.style.width = `${p.w}px`;
      el.style.height = `${p.h}px`;
      el.style.borderRadius = '4px';
    }
    return el;
  });

  return { parts, constraints, els };
}

export default function DancingStickmen({ enabled }) {
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
      const { Engine, Runner, Body, Composite } = Matter;

      if (!runningRef.current) { runningRef.current = false; gagState.active = false; return; }

      const overlay = overlayRef.current;
      const engine = Engine.create();
      engine.world.gravity.y = 1;
      const runner = Runner.create();

      const stickmen = Array.from({ length: COUNT }, (_, i) => {
        const x = window.innerWidth * ((i + 1) / (COUNT + 1));
        const y = window.innerHeight * 0.3 + Math.random() * 80;
        const sm = buildStickman(Matter, x, y, COLORS[i % COLORS.length]);
        sm.els.forEach(el => overlay.appendChild(el));
        Composite.add(engine.world, sm.parts.map(p => p.body));
        Composite.add(engine.world, sm.constraints);
        return sm;
      });

      Runner.run(runner, engine);

      // The "dance": every NUDGE_INTERVAL_MS, give each limb a small random torque/impulse --
      // real constraint physics turns that into floppy, semi-chaotic flailing rather than anything
      // choreographed.
      const nudgeTimer = setInterval(() => {
        stickmen.forEach(sm => {
          sm.parts.forEach(({ body }) => {
            Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.6);
            Body.applyForce(body, body.position, { x: (Math.random() - 0.5) * 0.0025, y: -(Math.random() * 0.002) });
          });
        });
      }, NUDGE_INTERVAL_MS);

      let rafId;
      const endAt = Date.now() + MAX_GAG_MS;
      const tick = () => {
        stickmen.forEach(sm => {
          sm.parts.forEach((p, idx) => {
            const el = sm.els[idx];
            const { position, angle } = p.body;
            const w = p.shape === 'circle' ? p.size : p.w;
            const h = p.shape === 'circle' ? p.size : p.h;
            el.style.transform = `translate(${position.x - w / 2}px, ${position.y - h / 2}px) rotate(${angle}rad)`;
          });
        });
        if (Date.now() > endAt) { endGag(); return; }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      cleanupRef.current = () => {
        cancelAnimationFrame(rafId);
        clearInterval(nudgeTimer);
        Runner.stop(runner);
        Engine.clear(engine);
        stickmen.forEach(sm => sm.els.forEach(el => el.remove()));
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
