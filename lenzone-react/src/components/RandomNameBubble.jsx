import { useEffect, useRef } from 'react';
import { getRealName } from '../lib/realNames';

const MIN_INTERVAL_MS = 15000;
const MAX_INTERVAL_MS = 30000;
const BUBBLE_HOLD_MS = 3200;

// A once-in-a-while, low-key personality touch: pick a random team logo currently visible on
// screen whose real name is known (see lib/realNames.js), and pop a tiny "I'm <name>" speech
// bubble over it for a few seconds -- the same introduction the roster modal's own bubble gives
// when you click a team (see RosterModal.jsx), just surfacing it ambiently too, unprompted.
// TeamName.jsx tags its own <img> with data-manager specifically so this can find team logos
// without also matching player headshots, which use the identical rounded-full/object-cover
// classes and would otherwise be indistinguishable by selector alone.
export default function RandomNameBubble({ enabled, afcData, nfcData }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    let timeoutId;
    let cancelled = false;

    const scheduleNext = () => {
      const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
      timeoutId = setTimeout(fire, delay);
    };

    function fire() {
      if (cancelled) return;
      const candidates = Array.from(document.querySelectorAll('img[data-manager]')).filter(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) return false;
        return !!getRealName(afcData, nfcData, el.dataset.manager);
      });
      if (candidates.length > 0) {
        const el = candidates[Math.floor(Math.random() * candidates.length)];
        showBubble(el, getRealName(afcData, nfcData, el.dataset.manager));
      }
      scheduleNext();
    }

    function showBubble(el, realName) {
      const overlay = overlayRef.current;
      if (!overlay) return;

      const bubble = document.createElement('div');
      bubble.style.cssText = 'position:fixed; z-index:999; pointer-events:none; opacity:0; transition:opacity 0.3s ease;';
      bubble.innerHTML = `
        <div style="position:relative; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:5px 10px; box-shadow:0 4px 12px rgba(0,0,0,0.18); font-size:12px; font-weight:600; color:var(--text); font-family:inherit; white-space:nowrap;">
          I'm ${realName}
          <div style="position:absolute; bottom:-5px; left:50%; transform:translateX(-50%) rotate(45deg); width:9px; height:9px; background:var(--surface); border-right:1px solid var(--border); border-bottom:1px solid var(--border);"></div>
        </div>
      `;
      overlay.appendChild(bubble);

      // Position ONCE from the element's rect at creation time, not continuously re-read on a
      // rAF loop -- React can reconcile/reuse that same DOM node for a different row between
      // renders (list re-sorts, live score updates), which would silently drag an already-shown
      // bubble to wherever that node ends up next while still showing the name captured at fire
      // time. A short-lived decorative bubble doesn't need to track scrolling either; it's gone
      // in a few seconds regardless.
      const r = el.getBoundingClientRect();
      bubble.style.left = `${r.left + r.width / 2}px`;
      bubble.style.top = `${r.top - 10}px`;
      bubble.style.transform = 'translate(-50%, -100%)';
      requestAnimationFrame(() => { bubble.style.opacity = '1'; });

      setTimeout(() => {
        bubble.style.opacity = '0';
        setTimeout(() => {
          bubble.remove();
        }, 300);
      }, BUBBLE_HOLD_MS);
    }

    scheduleNext();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, afcData, nfcData]);

  return <div ref={overlayRef} className="fixed inset-0 z-[999] overflow-visible" style={{ pointerEvents: 'none' }} />;
}
