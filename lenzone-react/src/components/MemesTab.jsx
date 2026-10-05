import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Check, X as XIcon, RefreshCw, Shuffle, Save } from 'lucide-react';
import { buildMemeBoard, pickIndex, seededShuffle } from '../lib/memeBoard';
import { TEMPLATES } from '../lib/memeTemplates';
import { savedGifPicks, searchWeekPicks, gifUrl, gifPage, giphyBudget, GIPHY_KEY, GIPHY_HOURLY_CAP } from '../lib/memeSources';
import useElementPngExport from '../hooks/useElementPngExport';
import { useTeamLogo } from '../context/TeamLogoContext';

const btn = 'inline-flex items-center gap-1 rounded-md border border-[var(--border)]/80 bg-[var(--surface2)] px-2 py-1 text-[11px] font-bold text-[var(--text2)] hover:text-[var(--text)] disabled:opacity-50';
const IMPACT_FONT = "Impact, 'Anton', 'Arial Narrow', 'Arial Black', sans-serif";
const LABEL_FONT = "Arial, Helvetica, sans-serif";
// Classic top/bottom caption boxes, for a team logo or a GIF.
const MACRO_BOXES = [[0, 0, 100, 24, 'i'], [0, 76, 100, 24, 'i']];

// Largest font size (px) at which `text` wraps into a w x h box. Rough character widths: Impact
// caps are narrow, Arial bold is a bit wider.
function fitFont(text, w, h, style) {
  const charW = style === 'i' ? 0.5 : 0.63;
  const words = String(text).split(/\s+/).filter(Boolean);
  for (let fs = Math.min(h * 0.8, w * 0.16, 46); fs > 7; fs -= 0.5) {
    const perLine = Math.floor((w * 0.94) / (fs * charW));
    let lines = 1, len = 0, fits = true;
    for (const word of words) {
      if (word.length > perLine) { fits = false; break; }
      if (!len) len = word.length;
      else if (len + 1 + word.length <= perLine) len += 1 + word.length;
      else { lines++; len = word.length; }
    }
    if (fits && lines * fs * 1.15 <= h * 0.9) return fs;
  }
  return 7;
}

// Width of an element, kept current as it resizes (font sizes are worked out from it).
function useWidth(ref) {
  const [width, setWidth] = useState(360);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const update = () => setWidth(ref.current?.clientWidth || 360);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

// Text boxes over an image: [x, y, w, h] in percent, a style, and optional fixed text (see memeTemplates.js).
function TextBoxes({ boxes, texts, alt, width, aspect }) {
  const height = width / aspect;
  return boxes.map((box, i) => {
    const [x, y, w, h, style, fixed] = box;
    const text = fixed ?? texts[i] ?? '';
    if (!text) return null;
    const shown = style === 'i' && !alt ? text.toUpperCase() : text;
    const fs = fitFont(shown, (w / 100) * width, (h / 100) * height, style);
    const base = { position: 'absolute', left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: 1.1 };
    if (style === 'i') {
      const o = Math.max(1, fs / 14);
      return (
        <div key={i} style={{ ...base, fontFamily: IMPACT_FONT, fontSize: fs, color: '#fff', letterSpacing: '0.01em',
          textShadow: `-${o}px -${o}px 0 #000, ${o}px -${o}px 0 #000, -${o}px ${o}px 0 #000, ${o}px ${o}px 0 #000, 0 ${o}px 0 #000, 0 -${o}px 0 #000` }}>{shown}</div>
      );
    }
    if (style === 't') {
      return (
        <div key={i} style={base}>
          <span style={{ fontFamily: LABEL_FONT, fontWeight: 800, fontSize: fs * 0.92, color: '#000', background: 'rgba(255,255,255,0.93)', border: '1px solid #000', borderRadius: 4, padding: '1px 4px', maxWidth: '100%' }}>{shown}</span>
        </div>
      );
    }
    return <div key={i} style={{ ...base, fontFamily: LABEL_FONT, fontWeight: 800, fontSize: fs, color: '#000', padding: '2%' }}>{shown}</div>;
  });
}

// One meme: a template with its measured text boxes, or the team's logo with classic captions.
function MemeImage({ variant, manager }) {
  const box = useRef(null);
  const width = useWidth(box);
  const logo = useTeamLogo(manager);
  const tpl = variant.logo ? null : TEMPLATES[variant.template];
  const aspect = tpl ? tpl.w / tpl.h : 1;
  return (
    <div ref={box} className="relative overflow-hidden" style={{ aspectRatio: `${aspect}`, background: tpl ? '#222' : '#111' }}>
      {tpl
        ? <img src={tpl.url} alt={variant.template} className="absolute inset-0 h-full w-full" />
        : logo && <img src={logo} alt="" className="absolute inset-[18%] h-[64%] w-[64%] object-contain" />}
      <TextBoxes boxes={tpl ? tpl.boxes : MACRO_BOXES} texts={variant.texts} alt={variant.alt} width={width} aspect={aspect} />
    </div>
  );
}

// onAnother is only passed for admins; without it there's no "Another" button.
function CardShell({ exp, label, who, fact, onAnother, children, disabled }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {children}
      <figcaption className="space-y-1.5 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 text-xs font-bold text-[var(--text)]">
            <span className="uppercase tracking-wider text-[var(--muted)]">{label}</span>
            <span className="ml-1.5 font-semibold">{who}</span>
          </span>
          <span className="flex gap-1.5">
            {onAnother && <button type="button" onClick={onAnother} className={btn}><RefreshCw className="h-3 w-3" /> Another</button>}
            <button type="button" onClick={exp.copyPng} disabled={disabled || exp.exporting} className={btn}>
              {exp.copyState === 'copied' ? <Check className="h-3 w-3 text-[var(--pos)]" /> : exp.copyState === 'error' ? <XIcon className="h-3 w-3 text-[var(--neg)]" /> : <Copy className="h-3 w-3" />} Copy
            </button>
            <button type="button" onClick={exp.downloadPng} disabled={disabled || exp.exporting} className={btn}><Download className="h-3 w-3" /> PNG</button>
          </span>
        </div>
        {fact && <p className="text-[11px] leading-snug text-[var(--muted)]">{fact}</p>}
      </figcaption>
    </figure>
  );
}

function MemeCard({ situation, week, start, slot, isAdmin }) {
  const ref = useRef(null);
  const exp = useElementPngExport(ref, `lenzone-meme-${situation.key.replace(/\W+/g, '-')}-${slot}-week-${week}`, { minWidth: 500 });
  useEffect(() => { exp.setExportTheme('light'); }, [exp.setExportTheme]);
  const [reroll, setReroll] = useState(0);
  const variants = situation.variants;
  const variant = variants[(start + reroll) % variants.length];
  return (
    <CardShell exp={exp} label={situation.label} who={situation.manager} fact={situation.fact} onAnother={isAdmin ? () => setReroll(r => r + 1) : undefined}>
      <div ref={ref} data-mode="light" data-scheme={exp.scheme}>
        <MemeImage variant={variant} manager={situation.manager} />
      </div>
    </CardShell>
  );
}

// A saved GIF pick with a caption written from the week's real numbers. It plays from Giphy's media
// server by ID, so showing it makes no API call. A GIF only moves on screen: Copy/PNG capture a
// still frame, and "Open" links the original GIF. A GIF that fails to load is dropped.
function GifCard({ situation, week, slot, gifs, isAdmin }) {
  const ref = useRef(null);
  const box = useRef(null);
  const width = useWidth(box);
  const exp = useElementPngExport(ref, `lenzone-gif-${situation.key.replace(/\W+/g, '-')}-${slot}-week-${week}`, { minWidth: 400 });
  useEffect(() => { exp.setExportTheme('light'); }, [exp.setExportTheme]);
  const [reroll, setReroll] = useState(0);
  const [broken, setBroken] = useState(false);
  const [aspect, setAspect] = useState(4 / 3);
  const captions = useMemo(() => situation.variants.filter(vr => vr.shape === 'macro' && !vr.logo), [situation]);
  if (broken) return null;
  const gif = gifs[(pickIndex(week, `${situation.key}|pick`, gifs.length) + slot * 3 + reroll) % gifs.length];
  const cap = captions.length ? captions[(pickIndex(week, `${situation.key}|cap`, captions.length) + slot + reroll) % captions.length] : null;
  return (
    <CardShell exp={exp} label={`${situation.label} GIF`} who={situation.manager} fact={situation.fact} onAnother={isAdmin ? () => setReroll(r => r + 1) : undefined}>
      <div ref={ref} data-mode="light" data-scheme={exp.scheme}>
        <div ref={box} className="relative">
          <img src={gifUrl(gif.id)} alt={gif.title || ''} className="block w-full" onError={() => setBroken(true)}
            onLoad={(e) => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || 4 / 3)} />
          {cap && <TextBoxes boxes={MACRO_BOXES} texts={cap.texts} alt={cap.alt} width={width} aspect={aspect} />}
        </div>
      </div>
      <div className="px-3 pb-2 text-[11px]">
        <a href={gifPage(gif.id)} target="_blank" rel="noreferrer" className="font-bold text-[var(--accent)] hover:underline">Open original GIF</a>
      </div>
    </CardShell>
  );
}

function downloadJson(data, filename) {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MemesTab({ week, onSelectWeek, seasonWeeks, latestCompletedWeek, isWeekFinal, boardInput, isAdmin }) {
  const [shuffleNo, setShuffleNo] = useState(0);
  // An admin's fresh search for this week: previewed here, and saved to be committed.
  const [draft, setDraft] = useState(null);
  const [saveState, setSaveState] = useState(null);
  useEffect(() => { setSaveState(null); }, [week]);
  // Open on the latest finished week, not a week still in progress.
  useEffect(() => {
    if (!isWeekFinal && latestCompletedWeek > 0) onSelectWeek(latestCompletedWeek);
  }, []);

  const board = useMemo(() => (isWeekFinal ? buildMemeBoard({ ...boardInput, week }) : null), [isWeekFinal, boardInput, week]);
  const picks = draft?.week === week ? draft.picks : savedGifPicks(week);
  // One card per team: its meme, or (for about a third of teams, when the week has saved GIFs) a
  // GIF instead. Shuffled so the board mixes stories.
  const feed = useMemo(() => {
    if (!board) return [];
    const items = board.situations.map(sit => {
      const gifs = (picks?.[sit.key] || []).filter(g => g?.id);
      return gifs.length && pickIndex(week, `${sit.key}|gifcard`, 3) === 0
        ? { id: `g-${sit.key}`, kind: 'gif', sit, slot: 0, gifs }
        : { id: `m-${sit.key}`, kind: 'meme', sit, slot: 0, start: sit.start };
    });
    return seededShuffle(items, `${week}|${shuffleNo}`);
  }, [board, picks, week, shuffleNo]);

  const saveGifs = async () => {
    setSaveState({ busy: true });
    const { picks: found, limited } = await searchWeekPicks(week, board.situations, pickIndex);
    const count = Object.keys(found).length;
    let written = null;
    if (count) {
      setDraft({ week, picks: found });
      // The dev server writes the file into src/data/gifs/ (see vite.config.js); download it otherwise.
      written = await fetch(`/__save-gifs?week=${week}`, { method: 'POST', body: JSON.stringify(found) })
        .then(r => (r.ok ? r.json() : null)).then(j => j?.file || null).catch(() => null);
      if (!written) downloadJson(found, `week-${week}.json`);
    }
    setSaveState({ count, total: board.situations.length, limited, written, resetMinutes: giphyBudget().resetMinutes });
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/60 p-3">
        <label htmlFor="memes-week" className="text-xs font-semibold uppercase tracking-wider text-[var(--text2)]">Week</label>
        <select id="memes-week" value={week} onChange={(e) => onSelectWeek(Number(e.target.value))}
          className="rounded-lg border border-[var(--border)]/80 bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)]">
          {Array.from({ length: seasonWeeks }, (_, i) => i + 1).map(w => <option key={w} value={w}>Week {w}</option>)}
        </select>
        {isAdmin && <button type="button" onClick={() => setShuffleNo(n => n + 1)} className={btn}><Shuffle className="h-3 w-3" /> Shuffle</button>}
        {isAdmin && GIPHY_KEY && board && (
          <button type="button" onClick={saveGifs} disabled={saveState?.busy}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[var(--accent-text)] disabled:opacity-50">
            <Save className="h-3 w-3" /> {saveState?.busy ? 'Searching…' : `Save Week ${week} GIFs`}
          </button>
        )}
        {isAdmin && (
          <p className="text-xs text-[var(--muted)]">
            {GIPHY_KEY
              ? `Save runs one Giphy search per card (cached for a week, capped at ${GIPHY_HOURLY_CAP} an hour, ${giphyBudget().used} used this hour) and saves the picks to src/data/gifs/week-${week}.json.`
              : 'Saving GIFs only works in local dev (npm run dev) with VITE_GIPHY_API_KEY in .env.'}
          </p>
        )}
      </div>

      {saveState && !saveState.busy && (
        <p className={`rounded-xl border p-3 text-sm text-[var(--text)] ${saveState.limited || !saveState.count ? 'border-[var(--neg)]/40 bg-[var(--neg)]/10' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
          {saveState.count
            ? (saveState.written
              ? `Found GIFs for ${saveState.count} of ${saveState.total} cards and saved them to ${saveState.written}. Commit and push that file to put them on the live site.`
              : `Found GIFs for ${saveState.count} of ${saveState.total} cards and downloaded week-${week}.json. They're showing below; move the file into src/data/gifs/ and commit.`)
            : saveState.limited
              ? 'Giphy refused the search (rate limit), so nothing was saved.'
              : 'No GIFs found, so nothing was saved.'}
          {saveState.limited && saveState.count > 0 && ` Giphy's limit stopped the search early, so this is partial. Try again in about ${saveState.resetMinutes || 60} minutes; finished searches are cached.`}
        </p>
      )}
      {!isWeekFinal && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
          Week {week} isn't final yet. The memes appear once the week is complete.
        </p>
      )}
      {isWeekFinal && !board && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">No scores posted for Week {week}.</p>
      )}

      {board && (
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {feed.map(item => (item.kind === 'meme'
            ? <MemeCard key={item.id} situation={item.sit} week={week} start={item.start} slot={item.slot} isAdmin={isAdmin} />
            : <GifCard key={item.id} situation={item.sit} week={week} slot={item.slot} gifs={item.gifs} isAdmin={isAdmin} />))}
        </div>
      )}
      {board && !picks && <p className="text-center text-[11px] text-[var(--muted)]">No GIFs saved for Week {week} yet.</p>}
      {board && feed.some(item => item.kind === 'gif') && <p className="text-center text-[11px] text-[var(--muted)]">GIFs powered by GIPHY</p>}
    </div>
  );
}
