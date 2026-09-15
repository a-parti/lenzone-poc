import { useEffect, useRef } from 'react';
import { getRealName } from '../lib/realNames';
import { pickSpeechBubbleLine, findRankAndConf } from '../lib/speechBubble';

// Frequent enough that it's a near-constant bit of ambient life on the page, not a rare easter
// egg you might never see.
const MIN_INTERVAL_MS = 4000;
const MAX_INTERVAL_MS = 8000;
const BUBBLE_HOLD_MS = 4200;

// Pops a speech bubble directly over a real, currently-visible team nameplate/logo on screen
// (same "stuck to the actual logo" behavior as before, just louder/more often) -- the same
// introduction the roster modal's own bubble gives when you click a team (see RosterModal.jsx),
// surfaced ambiently and unprompted, now for MULTIPLE teams at once when more than one is visible.
// TeamName.jsx tags its own <img> with data-manager specifically so this can find team logos
// without also matching player headshots, which use the identical rounded-full/object-cover
// classes and would otherwise be indistinguishable by selector alone.
export default function RandomNameBubble({ enabled, afcData, nfcData, trophyLinesByManager, afcStandings, nfcStandings, weekResultByManager }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    let timeoutId;
    let cancelled = false;
    // Elements currently showing a bubble, so a second tick doesn't double-pop the same logo
    // while its first bubble is still up.
    const activeEls = new Set();

    const scheduleNext = () => {
      const delay = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
      timeoutId = setTimeout(fire, delay);
    };

    function fire() {
      if (cancelled) return;
      const candidates = Array.from(document.querySelectorAll('img[data-manager]')).filter(el => {
        if (activeEls.has(el)) return false;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) return false;
        return !!getRealName(afcData, nfcData, el.dataset.manager);
      });
      if (candidates.length > 0) {
        // Multiple teams at once -- shuffle then take the front, so a single tick can show
        // several different real nameplates talking at the same time, not just one.
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const howMany = Math.min(1 + Math.floor(Math.random() * 3), shuffled.length);
        shuffled.slice(0, howMany).forEach(el => {
          const manager = el.dataset.manager;
          const realName = getRealName(afcData, nfcData, manager);
          const { rank, conf } = findRankAndConf(manager, afcStandings, nfcStandings);
          const text = pickSpeechBubbleLine(realName, manager, {
            trophyLines: trophyLinesByManager?.[manager], rank, conf, weekResult: weekResultByManager?.[manager]
          });
          if (text) showBubble(el, text);
        });
      }
      scheduleNext();
    }

    function showBubble(el, text) {
      const overlay = overlayRef.current;
      if (!overlay) return;
      activeEls.add(el);

      // A little playful tilt per bubble (not always dead-straight) plus a bouncy pop-in --
      // reads more like a comic-book speech bubble/sticker than a plain UI tooltip.
      const tilt = (Math.random() * 8 - 4).toFixed(1);
      const bubble = document.createElement('div');
      bubble.style.cssText = `
        position:fixed; z-index:999; pointer-events:none; opacity:0;
        transform:translate(-50%,-100%) scale(0.4) rotate(${tilt}deg);
        transition:opacity 0.25s ease, transform 0.45s cubic-bezier(0.34,1.56,0.64,1);
        max-width:min(70vw, 260px);
      `;
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      bubble.innerHTML = `
        <div style="position:relative; background:var(--surface); border:3px solid var(--accent); border-radius:20px; padding:8px 14px; box-shadow:3px 4px 0 rgba(0,0,0,0.25); font-size:15px; font-weight:800; color:var(--text); font-family:inherit; line-height:1.25;">
          ${escaped}
          <div style="position:absolute; bottom:-11px; left:50%; transform:translateX(-50%) rotate(45deg); width:16px; height:16px; background:var(--surface); border-right:3px solid var(--accent); border-bottom:3px solid var(--accent); border-radius:0 0 4px 0;"></div>
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
      // Overlaps DOWN onto the top portion of the actual logo (not just floating just above it
      // with a gap) -- reads as the bubble sitting right on top of the nameplate, tail included.
      bubble.style.top = `${r.top + r.height * 0.3}px`;
      requestAnimationFrame(() => {
        bubble.style.opacity = '1';
        bubble.style.transform = `translate(-50%,-100%) scale(1) rotate(${tilt}deg)`;
      });

      setTimeout(() => {
        bubble.style.opacity = '0';
        bubble.style.transform = `translate(-50%,-100%) scale(0.6) rotate(${tilt}deg)`;
        setTimeout(() => {
          bubble.remove();
          activeEls.delete(el);
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
