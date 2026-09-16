import { useEffect, useRef } from 'react';
import { getRealName } from '../lib/realNames';
import { pickSpeechBubbleLine, findRankAndConf } from '../lib/speechBubble';

// Toned back down after "too frequent" feedback -- still a regular bit of ambient life, not
// constant noise.
const MIN_INTERVAL_MS = 12000;
const MAX_INTERVAL_MS = 22000;
const BUBBLE_HOLD_MS = 4200;
// Usually just one bubble at a time; occasionally two. Three-at-once was part of what made it
// feel chaotic/not clearly tied to a specific logo.
const MAX_AT_ONCE = 2;

// Pops a speech bubble directly over a real, currently-visible team nameplate/logo on screen --
// the same introduction the roster modal's own bubble gives when you click a team (see
// RosterModal.jsx), surfaced ambiently and unprompted. TeamName.jsx tags its own <img> with
// data-manager specifically so this can find team logos without also matching player headshots,
// which use the identical rounded-full/object-cover classes and would otherwise be
// indistinguishable by selector alone.
export default function RandomNameBubble({ enabled, afcData, nfcData, trophyLinesByManager, afcStandings, nfcStandings, weekResultByManager, managerStreaks, revengeGameByManager }) {
  const overlayRef = useRef(null);
  // afcStandings/nfcStandings (this app's OWN computed lenzone.xyz standings -- see
  // rankConference() in App.jsx, never raw Sleeper roster.settings) update every time a week's
  // real scores change. The firing loop below is intentionally NOT restarted on every data change
  // (that would reset its timing/cadence constantly), so it reads these through a ref instead of
  // closing over the prop directly -- otherwise it would freeze on whatever standings existed the
  // moment the loop first started and silently go stale forever after.
  const latestRef = useRef({});
  useEffect(() => {
    latestRef.current = { afcData, nfcData, trophyLinesByManager, afcStandings, nfcStandings, weekResultByManager, managerStreaks, revengeGameByManager };
  }, [afcData, nfcData, trophyLinesByManager, afcStandings, nfcStandings, weekResultByManager, managerStreaks, revengeGameByManager]);

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
      const { afcData, nfcData, trophyLinesByManager, afcStandings, nfcStandings, weekResultByManager, managerStreaks, revengeGameByManager } = latestRef.current;
      const candidates = Array.from(document.querySelectorAll('img[data-manager]')).filter(el => {
        if (activeEls.has(el)) return false;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) return false;
        return !!getRealName(afcData, nfcData, el.dataset.manager);
      });
      if (candidates.length > 0) {
        // Multiple teams at once (capped) -- shuffle then take the front, so a tick can
        // occasionally show two different real nameplates at once, not just always one.
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const howMany = Math.min(1 + Math.floor(Math.random() * MAX_AT_ONCE), shuffled.length);
        shuffled.slice(0, howMany).forEach(el => {
          const manager = el.dataset.manager;
          const realName = getRealName(afcData, nfcData, manager);
          const { rank, conf } = findRankAndConf(manager, afcStandings, nfcStandings);
          const text = pickSpeechBubbleLine(realName, manager, {
            trophyLines: trophyLinesByManager?.[manager], rank, conf,
            weekResult: weekResultByManager?.[manager], streak: managerStreaks?.[manager],
            revengeGame: revengeGameByManager?.[manager]
          });
          if (text) showBubble(el, manager, text);
        });
      }
      scheduleNext();
    }

    function showBubble(el, manager, text) {
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

      // Tracked EVERY frame while visible (not positioned once at creation) -- a 4+ second hold
      // is plenty of time for the page (or a horizontally/vertically scrollable panel like the
      // Grid) to scroll underneath a fixed-position bubble, which used to leave it floating
      // behind wherever the logo had been at the moment it popped, not where the logo actually
      // is now. Bails out early (fades out) if the underlying DOM node gets reused for a
      // different manager between renders (a list re-sort) or removed from the page entirely --
      // better to cut a bubble short than have it follow the wrong team's logo around.
      let rafId;
      let finished = false;
      const track = () => {
        if (finished) return;
        if (el.dataset.manager !== manager || !document.body.contains(el)) {
          finish();
          return;
        }
        const r = el.getBoundingClientRect();
        bubble.style.left = `${r.left + r.width / 2}px`;
        // Sits right on top of the actual logo -- anchored to its top edge (not overlapping down
        // into it), tail pointing straight down at it.
        bubble.style.top = `${r.top - 8}px`;
        rafId = requestAnimationFrame(track);
      };
      track();
      requestAnimationFrame(() => {
        bubble.style.opacity = '1';
        bubble.style.transform = `translate(-50%,-100%) scale(1) rotate(${tilt}deg)`;
      });

      function finish() {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(rafId);
        bubble.style.opacity = '0';
        bubble.style.transform = `translate(-50%,-100%) scale(0.6) rotate(${tilt}deg)`;
        setTimeout(() => {
          bubble.remove();
          activeEls.delete(el);
        }, 300);
      }
      setTimeout(finish, BUBBLE_HOLD_MS);
    }

    scheduleNext();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [enabled]);

  return <div ref={overlayRef} className="fixed inset-0 z-[999] overflow-visible" style={{ pointerEvents: 'none' }} />;
}
