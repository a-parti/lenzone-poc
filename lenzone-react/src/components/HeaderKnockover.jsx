import { useEffect, useRef } from 'react';
import { gagState } from '../lib/gagState';

const IDLE_MS = 8000;
const MAX_GAG_MS = 15000;
// How far past the bottom of the viewport a body has to fall before it's considered "gone" and
// gets removed -- lets it visibly leave the screen rather than being clipped by the overlay's own
// bounds or vanishing right at the fold.
const EXIT_MARGIN = 120;
const LETTER_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6'];

// Splits the "LENZONE 2026" title into one span per letter (spaces excluded -- nothing to collide
// with there) so it scatters as individual letters rather than falling as one rigid block. Each
// letter keeps the title's own classes (font/size/weight/tracking) but swaps the shared gradient
// clip for a solid color from the same rainbow the gradient cycles through, since clipping a full
// multi-stop gradient to a single glyph-sized box would just show one washed-out sliver per letter.
function buildLetterSpans(titleEl) {
  const rect = titleEl.getBoundingClientRect();
  const cs = getComputedStyle(titleEl);
  const text = titleEl.textContent;
  const measurer = document.createElement('span');
  measurer.style.cssText = 'position:fixed; visibility:hidden; white-space:pre;';
  measurer.className = titleEl.className;
  measurer.style.background = 'none';
  document.body.appendChild(measurer);
  const letters = [];
  let cursorX = rect.left;
  [...text].forEach((ch, i) => {
    measurer.textContent = ch;
    const w = measurer.getBoundingClientRect().width || 8;
    if (ch.trim()) {
      const span = document.createElement('span');
      span.textContent = ch;
      span.className = titleEl.className;
      span.style.background = 'none';
      span.style.webkitTextFillColor = LETTER_COLORS[i % LETTER_COLORS.length];
      span.style.color = LETTER_COLORS[i % LETTER_COLORS.length];
      span.style.display = 'inline-block';
      span.style.lineHeight = cs.lineHeight;
      letters.push({ span, left: cursorX, top: rect.top, width: w, height: rect.height });
    }
    cursorX += w;
  });
  measurer.remove();
  return letters;
}

// Collects every independently-scatterable piece of the header row: the logo (the "bowling ball"),
// each letter of the title, the admin badge if present, and every button/link in the icon row and
// the team-picker/theme/mute group -- rather than treating whole rows as single rigid chunks, which
// just slid around as one slab instead of actually splashing apart into pieces going random places.
function collectTargets(container) {
  const children = Array.from(container.children);
  if (children.length < 2) return null;
  const [brandGroup, ...rest] = children;
  const logoEl = brandGroup.querySelector('[role="button"]') || brandGroup.firstElementChild;
  const titleEl = brandGroup.querySelector('h1');
  if (!logoEl || !titleEl) return null;
  const letters = buildLetterSpans(titleEl);
  const chips = [];
  rest.forEach(node => {
    if (node.children.length === 0) { chips.push(node); return; }
    Array.from(node.children).forEach(child => {
      if (child.getBoundingClientRect().width > 0) chips.push(child);
    });
  });
  return { logoEl, letters, chips, hideEls: [titleEl, ...chips] };
}

// A once-in-a-while easter egg: after IDLE_MS of no mouse/keyboard/touch/scroll activity, the
// logo becomes a heavy "bowling ball" that plows into the rest of the header -- the title's
// individual letters, and every icon/button -- scattering them as real, independently-tumbling
// Matter.js bodies that also bounce off the actual page content below (the tab bar and whatever
// tab is open) before falling down off the page under gravity. Any interaction restores everything
// instantly. Matter.js is dynamically imported so the ~85kb physics engine is never fetched at all
// for anyone who just uses the app normally.
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
      const container = targetRef.current;
      if (!container || runningRef.current || gagState.active) return;
      const targets = collectTargets(container);
      if (!targets) return;
      runningRef.current = true;
      gagState.active = true;

      const MatterMod = await import('matter-js');
      const Matter = MatterMod.default ?? MatterMod;
      const { Engine, Runner, Bodies, Body, Composite } = Matter;

      // Bail if activity happened while the module was loading, or the target vanished (tab switch).
      if (!runningRef.current || !targetRef.current) { runningRef.current = false; gagState.active = false; return; }

      const overlay = overlayRef.current;
      const engine = Engine.create();
      engine.world.gravity.y = 1;
      const runner = Runner.create();
      const items = [];

      const addClone = (el, rect, bodyOpts) => {
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
        const body = Bodies.rectangle(rect.left + rect.width / 2, rect.top + rect.height / 2, rect.width, rect.height, bodyOpts);
        items.push({ clone, body, w: rect.width, h: rect.height, exited: false });
      };

      // The logo: a heavy circular "bowling ball" -- much higher density than the light letters/
      // chips it plows into, so real momentum transfer (not just an equal, gentle nudge) sends them
      // scattering while the ball itself barely slows down, the way a real strike works.
      const logoRect = targets.logoEl.getBoundingClientRect();
      const logoClone = targets.logoEl.cloneNode(true);
      logoClone.style.position = 'fixed';
      logoClone.style.left = `${logoRect.left}px`;
      logoClone.style.top = `${logoRect.top}px`;
      logoClone.style.width = `${logoRect.width}px`;
      logoClone.style.height = `${logoRect.height}px`;
      logoClone.style.pointerEvents = 'none';
      logoClone.style.willChange = 'transform';
      overlay.appendChild(logoClone);
      const radius = Math.max(logoRect.width, logoRect.height) / 2;
      const knocker = Bodies.circle(logoRect.left + logoRect.width / 2, logoRect.top + logoRect.height / 2, radius, {
        restitution: 0.5, friction: 0.2, frictionAir: 0.01, density: 0.03
      });
      items.push({ clone: logoClone, body: knocker, w: logoRect.width, h: logoRect.height, exited: false, isCircle: true });
      targets.hideEls.forEach(el => { el.style.visibility = 'hidden'; });
      targets.logoEl.style.visibility = 'hidden';

      targets.letters.forEach(({ span, left, top, width, height }) => {
        addClone(span, { left, top, width, height }, {
          restitution: 0.45, friction: 0.3, frictionAir: 0.015, density: 0.0006,
          angle: 0
        });
      });
      targets.chips.forEach(el => {
        addClone(el, el.getBoundingClientRect(), { restitution: 0.4, friction: 0.3, frictionAir: 0.015 });
      });

      Composite.add(engine.world, items.map(i => i.body));

      // Static, invisible collision proxies matching the actual visible page content below the
      // header (the tab bar and whatever's in the open tab) -- so falling debris visibly bounces
      // off real page furniture on its way down instead of passing straight through it.
      const main = document.querySelector('main');
      const obstacles = [];
      if (main) {
        Array.from(main.children).forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width < 20 || r.height < 10) return;
          obstacles.push(Bodies.rectangle(r.left + r.width / 2, r.top, r.width, 6, { isStatic: true, restitution: 0.3 }));
        });
        Composite.add(engine.world, obstacles);
      }

      // The strike: velocity + spin on the ball alone -- real collisions carry the momentum into
      // everything else, so the letters and chips scatter to genuinely different places and speeds
      // instead of moving together as one slab.
      Body.setVelocity(knocker, { x: 6, y: -0.5 });
      Body.setAngularVelocity(knocker, 0.2);
      // Each letter gets a tiny random jitter of its own so they don't all sit frame-perfectly
      // still before the ball arrives -- little independent life even before the hit lands.
      items.forEach(item => {
        if (item.isCircle) return;
        Body.setAngularVelocity(item.body, (Math.random() - 0.5) * 0.08);
      });

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
        items.forEach(({ clone }) => clone.remove());
        targets.hideEls.forEach(el => { el.style.visibility = ''; });
        targets.logoEl.style.visibility = '';
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
