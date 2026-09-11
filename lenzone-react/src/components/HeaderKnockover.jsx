import { useEffect, useRef } from 'react';

const IDLE_MS = 30000;
const MAX_GAG_MS = 12000;
// How far past the bottom of the viewport a body has to fall before it's considered "gone" and
// gets removed -- lets it visibly leave the screen rather than being clipped by the overlay's own
// bounds or vanishing right at the fold.
const EXIT_MARGIN = 120;

// A once-in-a-while easter egg: after IDLE_MS of no mouse/keyboard/touch/scroll activity, the
// header's own top-level pieces (logo+title, the AFC/NFC/utility icon row, the team picker+theme+
// mute group) turn into real Matter.js rigid bodies, the logo gets knocked sideways into its
// neighbors, and everything tumbles and falls down off the page under real gravity -- until you
// touch the page again, at which point it's restored instantly. Matter.js is dynamically imported
// so the ~100kb physics engine is never fetched at all for anyone who just uses the app normally.
export default function HeaderKnockover({ targetRef, enabled }) {
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
      if (runningRef.current) return;
      if (Date.now() - lastActivityRef.current >= IDLE_MS) startGag();
    }, 1000);

    function endGag() {
      runningRef.current = false;
      cleanupRef.current?.();
      cleanupRef.current = null;
      lastActivityRef.current = Date.now();
    }

    async function startGag() {
      const container = targetRef.current;
      if (!container || runningRef.current) return;
      const children = Array.from(container.children).filter(el => el.getBoundingClientRect().width > 0);
      if (children.length < 2) return;
      runningRef.current = true;

      const MatterMod = await import('matter-js');
      const Matter = MatterMod.default ?? MatterMod;
      const { Engine, Runner, Bodies, Body, Composite } = Matter;

      // Bail if activity happened while the module was loading, or the target vanished (tab switch).
      if (!runningRef.current || !targetRef.current) { runningRef.current = false; return; }

      const overlay = overlayRef.current;
      const engine = Engine.create();
      engine.world.gravity.y = 1;
      const runner = Runner.create();

      const items = children.map(el => {
        const rect = el.getBoundingClientRect();
        const clone = el.cloneNode(true);
        clone.style.position = 'fixed';
        clone.style.margin = '0';
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.pointerEvents = 'none';
        clone.style.willChange = 'transform';
        overlay.appendChild(clone);
        el.style.visibility = 'hidden';
        const body = Bodies.rectangle(rect.left + rect.width / 2, rect.top + rect.height / 2, rect.width, rect.height, {
          restitution: 0.25, friction: 0.35, frictionAir: 0.02
        });
        return { el, clone, body, w: rect.width, h: rect.height, exited: false };
      });

      Composite.add(engine.world, items.map(i => i.body));

      // The knock: the first item (logo + title) gets a modest sideways nudge and spin -- enough to
      // visibly tip into whatever's next to it in the row and start a chain reaction, without
      // launching it (or its collision partners) off the top of the screen before gravity ever gets
      // a chance to carry things down the page, which a much stronger initial kick did in testing.
      const knocker = items[0].body;
      Body.setVelocity(knocker, { x: 3, y: -0.5 });
      Body.setAngularVelocity(knocker, 0.12);

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
        items.forEach(({ el, clone }) => {
          clone.remove();
          el.style.visibility = '';
        });
      };
    }

    return () => {
      events.forEach(e => window.removeEventListener(e, markActivity));
      clearInterval(interval);
      cleanupRef.current?.();
      cleanupRef.current = null;
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return <div ref={overlayRef} className="fixed inset-0 z-[999] overflow-hidden" style={{ pointerEvents: 'none' }} />;
}
