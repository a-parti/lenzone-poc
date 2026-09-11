import { useEffect, useRef } from 'react';
import { gagState } from '../lib/gagState';

const IDLE_MS = 8000 + Math.random() * 6000;
const MAX_GAG_MS = 15000;
const EXIT_MARGIN = 120;
const MAX_PHOTOS = 8;

// Every team logo (TeamName.jsx) and player headshot (PlayerAvatar.jsx) in this app renders as an
// `<img class="rounded-full object-cover">` of some size -- a consistent enough shape that we can
// just grab whichever of them happen to be on screen right now, regardless of which tab is open.
function collectVisiblePhotos() {
  const candidates = Array.from(document.querySelectorAll('img.rounded-full.object-cover'));
  const inView = candidates.filter(img => {
    const r = img.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  });
  // Shuffle and cap -- falling out ALL of them at once (a busy Matchups roster view can have
  // dozens) would be visual noise; a random handful sells the "oops, a few fell out" gag better.
  for (let i = inView.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [inView[i], inView[j]] = [inView[j], inView[i]];
  }
  return inView.slice(0, MAX_PHOTOS);
}

// A once-in-a-while easter egg: a random handful of the team logos/player headshots currently
// visible on screen "fall out" of their circular slots and tumble down off the page under gravity,
// leaving their (still-laid-out) empty slot behind, before scattering off the bottom of the
// viewport. Any interaction restores everything instantly.
export default function FallingPhotos({ enabled }) {
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
      const photos = collectVisiblePhotos();
      if (photos.length === 0) return;
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

      const items = photos.map(img => {
        const rect = img.getBoundingClientRect();
        const clone = img.cloneNode(true);
        clone.style.position = 'fixed';
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.pointerEvents = 'none';
        clone.style.willChange = 'transform';
        overlay.appendChild(clone);
        img.style.visibility = 'hidden';
        const body = Bodies.circle(rect.left + rect.width / 2, rect.top + rect.height / 2, rect.width / 2, {
          restitution: 0.4, friction: 0.3, frictionAir: 0.015, density: 0.001
        });
        Body.setVelocity(body, { x: (Math.random() - 0.5) * 4, y: 0 });
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);
        return { img, clone, body, w: rect.width, h: rect.height, exited: false };
      });
      Composite.add(engine.world, items.map(i => i.body));

      // Same collision-proxy approach as the other gags -- falling photos bounce off real page
      // furniture (header + whatever's in the open tab) on their way down.
      const obstacles = [];
      const header = document.querySelector('header') || document.querySelector('main')?.previousElementSibling;
      const main = document.querySelector('main');
      [header, ...(main ? Array.from(main.children) : [])].forEach(el => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 10) return;
        obstacles.push(Bodies.rectangle(r.left + r.width / 2, r.top + r.height / 2, r.width, r.height, { isStatic: true, restitution: 0.3 }));
      });
      Composite.add(engine.world, obstacles);

      Runner.run(runner, engine);

      let rafId;
      const maxUntil = Date.now() + MAX_GAG_MS;
      const tick = () => {
        let anyLeft = false;
        for (const item of items) {
          if (item.exited) continue;
          anyLeft = true;
          const { position, angle } = item.body;
          item.clone.style.left = `${position.x - item.w / 2}px`;
          item.clone.style.top = `${position.y - item.h / 2}px`;
          item.clone.style.transform = `rotate(${angle}rad)`;
          if (position.y - item.h / 2 > window.innerHeight + EXIT_MARGIN) {
            item.exited = true;
            item.clone.remove();
            Composite.remove(engine.world, item.body);
          }
        }
        if (!anyLeft || Date.now() > maxUntil) { endGag(); return; }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      cleanupRef.current = () => {
        cancelAnimationFrame(rafId);
        Runner.stop(runner);
        Engine.clear(engine);
        items.forEach(({ img, clone }) => { clone.remove(); img.style.visibility = ''; });
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
