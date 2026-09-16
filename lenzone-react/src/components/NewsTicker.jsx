import React, { useMemo } from 'react';
import { Radio } from 'lucide-react';

// A newscast-style scrolling crawl along the very bottom of the screen -- real ESPN/RotoWire
// items only (your own players' notes/headlines first, since those are the most relevant; the
// general league headlines fill in behind them), never invented text or a fabricated link. Purely
// ambient, so it silently renders nothing rather than showing a placeholder when there's no real
// data yet.
function buildCrawlItems(myPlayerNotes, myPlayerHeadlines, nflHeadlines) {
  const items = [];
  const seen = new Set();
  const push = (text, link) => {
    if (!text || seen.has(text)) return;
    seen.add(text);
    items.push({ text, link: link || null });
  };
  (myPlayerNotes || []).forEach(n => {
    const tag = n.nflTeam && n.position ? ` (${n.nflTeam}${n.number ? ` #${n.number}` : ''} ${n.position})` : '';
    push(`${n.player}${tag}: ${n.headline}`, n.link);
  });
  (myPlayerHeadlines || []).forEach(h => push(h.headline, h.link));
  (nflHeadlines || []).forEach(h => push(h.headline, h.link));
  return items.slice(0, 20);
}

function CrawlLine({ items }) {
  return (
    <span className="pr-16">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="mx-4 text-[var(--muted)]">&bull;</span>}
          {item.link ? (
            <a
              href={item.link} target="_blank" rel="noopener noreferrer"
              className="hover:text-[var(--accent)] hover:underline"
            >
              {item.text}
            </a>
          ) : (
            <span>{item.text}</span>
          )}
        </React.Fragment>
      ))}
    </span>
  );
}

export default function NewsTicker({ myPlayerNotes, myPlayerHeadlines, nflHeadlines }) {
  const items = useMemo(
    () => buildCrawlItems(myPlayerNotes, myPlayerHeadlines, nflHeadlines),
    [myPlayerNotes, myPlayerHeadlines, nflHeadlines]
  );
  if (items.length === 0) return null;

  // A fixed animation-duration reads too fast once there's more than a couple of headlines --
  // scale duration with how much text there actually is so the crawl moves at a roughly constant,
  // readable pace no matter how many real items are in the feed right now.
  const totalChars = items.reduce((sum, item) => sum + item.text.length, 0);
  const duration = Math.max(50, Math.round(totalChars / 6));

  return (
    <div className="fixed left-0 right-0 bottom-[52px] md:bottom-0 z-40 bg-[var(--surface)]/90 backdrop-blur-md border-t border-[var(--border)]/80 overflow-hidden group">
      <div className="flex items-center">
        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-[var(--accent-text)] text-[10px] font-bold uppercase tracking-wider z-10">
          <Radio className="w-3 h-3" />
          <span className="hidden sm:inline">Your News</span>
        </div>
        <div className="flex-1 overflow-hidden py-1.5">
          <div
            className="news-ticker-track group-hover:[animation-play-state:paused] whitespace-nowrap text-xs text-[var(--text2)] font-semibold"
            style={{ animationDuration: `${duration}s` }}
          >
            <CrawlLine items={items} />
            <CrawlLine items={items} />
          </div>
        </div>
      </div>
    </div>
  );
}
