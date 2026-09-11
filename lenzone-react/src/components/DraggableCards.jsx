import { useEffect, useRef } from 'react';

const TRAY_W = 220;
const TRAY_H = 170;
const MARGIN = 16;
const CARD_W = 46;
const CARD_H = 64;
const LABELS = ['🂡', '🂱', '🃁', '🃑', '🃏'];
const COLORS = ['#f87171', '#4ade80', '#60a5fa', '#facc15', '#a78bfa'];

// Unlike the idle-triggered gags (HeaderKnockover, BouncingFootball, BouncingTrophies,
// FallingPhotos), this one is always live whenever mounted: a small bounded "tray" of physics
// cards in the corner the user can click-and-drag to knock into each other, via Matter's Mouse/
// MouseConstraint modules. It doesn't touch gagState -- it's a contained, low-key corner toy, not
// a full-viewport takeover, so it's fine for it to coexist with an idle gag if one happens to fire.
export default function DraggableCards({ enabled }) {
  const containerRef = useRef(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const MatterMod = await import('matter-js');
      const Matter = MatterMod.default ?? MatterMod;
      const { Engine, Runner, Bodies, Composite, Mouse, MouseConstraint } = Matter;
      if (cancelled) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const engine = Engine.create();
      engine.world.gravity.y = 0.6;
      const runner = Runner.create();

      const wallOpts = { isStatic: true, restitution: 0.5 };
      const walls = [
        Bodies.rectangle(rect.width / 2, -10, rect.width, 20, wallOpts),
        Bodies.rectangle(rect.width / 2, rect.height + 10, rect.width, 20, wallOpts),
        Bodies.rectangle(-10, rect.height / 2, 20, rect.height, wallOpts),
        Bodies.rectangle(rect.width + 10, rect.height / 2, 20, rect.height, wallOpts),
      ];
      Composite.add(engine.world, walls);

      const cards = LABELS.map((label, i) => {
        const el = document.createElement('div');
        el.textContent = label;
        el.style.cssText = `position:absolute; left:0; top:0; width:${CARD_W}px; height:${CARD_H}px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:22px; cursor:grab; user-select:none; box-shadow:0 2px 6px rgba(0,0,0,0.25); background:${COLORS[i]}; border:1px solid rgba(0,0,0,0.15); will-change:transform;`;
        container.appendChild(el);
        const x = MARGIN + CARD_W / 2 + Math.random() * (rect.width - CARD_W - MARGIN * 2);
        const y = MARGIN + CARD_H / 2 + Math.random() * (rect.height - CARD_H - MARGIN * 2) * 0.4;
        const body = Bodies.rectangle(x, y, CARD_W, CARD_H, {
          restitution: 0.4, friction: 0.4, frictionAir: 0.02, angle: (Math.random() - 0.5) * 0.6, chamfer: { radius: 6 }
        });
        return { el, body };
      });
      Composite.add(engine.world, cards.map(c => c.body));

      const mouse = Mouse.create(container);
      mouse.pixelRatio = window.devicePixelRatio || 1;
      const mouseConstraint = MouseConstraint.create(engine, {
        mouse,
        constraint: { stiffness: 0.2, render: { visible: false } }
      });
      Composite.add(engine.world, mouseConstraint);
      // Prevent the tray's own scroll/drag gestures from fighting the page while dragging a card.
      container.style.touchAction = 'none';

      Runner.run(runner, engine);

      let rafId;
      const tick = () => {
        for (const { el, body } of cards) {
          el.style.transform = `translate(${body.position.x - CARD_W / 2}px, ${body.position.y - CARD_H / 2}px) rotate(${body.angle}rad)`;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);

      cleanupRef.current = () => {
        cancelAnimationFrame(rafId);
        Runner.stop(runner);
        Engine.clear(engine);
        Mouse.clearSourceEvents(mouse);
        cards.forEach(({ el }) => el.remove());
      };
    })();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div
      ref={containerRef}
      title="Drag the cards"
      className="fixed z-[900] rounded-xl border border-[var(--border)]/60 bg-[var(--surface)]/40 backdrop-blur-sm overflow-hidden hidden lg:block"
      style={{ width: TRAY_W, height: TRAY_H, right: 16, bottom: 16 }}
    />
  );
}
