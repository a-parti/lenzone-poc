import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Check, X as XIcon, RefreshCw, Shuffle, Save } from 'lucide-react';
import { buildMemeBoard, pickIndex } from '../lib/memeBoard';
import { fetchMemeTemplates, savedGifPicks, searchWeekPicks, gifUrl, gifPage, giphyBudget, GIPHY_KEY, GIPHY_HOURLY_CAP } from '../lib/memeSources';
import useElementPngExport from '../hooks/useElementPngExport';
import { useTeamLogo } from '../context/TeamLogoContext';

const IMPACT = {
  fontFamily: "Impact, 'Arial Narrow', 'Arial Black', sans-serif", color: '#fff', letterSpacing: '0.02em',
  textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000'
};
const btn = 'inline-flex items-center gap-1 rounded-md border border-[var(--border)]/80 bg-[var(--surface2)] px-2 py-1 text-[11px] font-bold text-[var(--text2)] hover:text-[var(--text)] disabled:opacity-50';

// Seeded shuffle, so the mix is random but a given week + shuffle number always looks the same.
function shuffled(list, seedText) {
  let h = 0;
  for (let i = 0; i < seedText.length; i++) h = (h * 31 + seedText.charCodeAt(i)) >>> 0;
  const rand = () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

function Captions({ top, bottom, alt }) {
  const style = { ...IMPACT, textTransform: alt ? 'none' : 'uppercase' };
  return (
    <>
      <div className="absolute inset-x-0 top-0 p-2 text-center text-base font-black leading-none sm:text-lg" style={style}>{top}</div>
      <div className="absolute inset-x-0 bottom-0 p-2 text-center text-base font-black leading-none sm:text-lg" style={style}>{bottom}</div>
    </>
  );
}

// A real meme template (Imgflip) captioned with this week's real numbers. Falls back to the team's
// logo if the template list can't be loaded.
function MemePanel({ meme, template, manager }) {
  const logo = useTeamLogo(manager);
  const layout = template ? (meme.layout || 'topbottom') : 'topbottom';
  const src = template?.url || logo;
  const panelBox = { background: '#fff', color: '#000', fontFamily: IMPACT.fontFamily };
  const small = 'text-sm font-black uppercase leading-tight';
  return (
    <div className="relative overflow-hidden bg-neutral-800" style={{ aspectRatio: template ? `${template.width} / ${template.height}` : '1 / 1' }}>
      {src && <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {layout === 'drake' && (
        <>
          <div className={`absolute right-0 top-0 flex h-1/2 w-1/2 items-center justify-center p-2 text-center ${small}`} style={panelBox}>{meme.top}</div>
          <div className={`absolute bottom-0 right-0 flex h-1/2 w-1/2 items-center justify-center p-2 text-center ${small}`} style={panelBox}>{meme.bottom}</div>
        </>
      )}
      {layout === 'split' && (
        <>
          <div className="absolute left-0 top-0 w-1/2 p-1.5 text-center text-sm font-black leading-tight" style={{ ...IMPACT, textTransform: 'uppercase' }}>{meme.top}</div>
          <div className="absolute right-0 top-0 w-1/2 p-1.5 text-center text-sm font-black leading-tight" style={{ ...IMPACT, textTransform: 'uppercase' }}>{meme.bottom}</div>
        </>
      )}
      {layout === 'distracted' && meme.labels.map((label, i) => (
        <div key={label} className={`absolute top-[6%] w-[30%] p-1 text-center ${small}`}
          style={{ ...panelBox, left: `${[2, 35, 68][i]}%`, border: '1px solid #000' }}>{label}</div>
      ))}
      {layout === 'topbottom' && <Captions top={meme.top} bottom={meme.bottom} alt={meme.alt} />}
    </div>
  );
}

// onAnother is only passed for admins; without it there's no "Another" button.
function CardShell({ exp, label, who, onAnother, children, disabled }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {children}
      <figcaption className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
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
      </figcaption>
    </figure>
  );
}

function MemeCard({ situation, week, templates, isAdmin }) {
  const ref = useRef(null);
  const exp = useElementPngExport(ref, `lenzone-meme-${situation.key.replace(/\W+/g, '-')}-week-${week}`, { minWidth: 500 });
  useEffect(() => { exp.setExportTheme('light'); }, [exp.setExportTheme]);
  const [reroll, setReroll] = useState(0);
  // Only variants whose template is available (or all of them while the list is still loading).
  const usable = useMemo(() => {
    const ok = situation.variants.filter(vr => !templates.length || templates.some(t => t.name === vr.template));
    return ok.length ? ok : situation.variants;
  }, [situation, templates]);
  // Opens on the board's pick (chosen so templates don't repeat down the page) when it's available.
  const opening = usable.indexOf(situation.first);
  const meme = usable[((opening >= 0 ? opening : pickIndex(week, situation.key, usable.length)) + reroll) % usable.length];
  const template = templates.find(t => t.name === meme.template);
  return (
    <CardShell exp={exp} label={situation.label} who={situation.manager} onAnother={isAdmin ? () => setReroll(r => r + 1) : undefined}>
      <div ref={ref} data-mode="light" data-scheme={exp.scheme}>
        <MemePanel meme={meme} template={template} manager={situation.manager} />
      </div>
    </CardShell>
  );
}

// A saved GIF pick with a caption written from the week's real numbers. It plays from Giphy's media
// server by ID, so showing it makes no API call. A GIF only moves on screen: Copy/PNG capture a
// still frame, and "Open" links the original GIF. A GIF that fails to load is dropped.
function GifCard({ situation, week, slot, gifs, isAdmin }) {
  const ref = useRef(null);
  const exp = useElementPngExport(ref, `lenzone-gif-${situation.key.replace(/\W+/g, '-')}-${slot}-week-${week}`, { minWidth: 400 });
  useEffect(() => { exp.setExportTheme('light'); }, [exp.setExportTheme]);
  const [reroll, setReroll] = useState(0);
  const [broken, setBroken] = useState(false);
  const captions = useMemo(() => situation.variants.filter(vr => !vr.layout), [situation]);
  if (broken) return null;
  const gif = gifs[(pickIndex(week, `${situation.key}|pick`, gifs.length) + slot * 3 + reroll) % gifs.length];
  const cap = captions.length ? captions[(pickIndex(week, `${situation.key}|cap`, captions.length) + slot + reroll) % captions.length] : null;
  return (
    <CardShell exp={exp} label={`${situation.label} GIF`} who={situation.manager} onAnother={isAdmin ? () => setReroll(r => r + 1) : undefined}>
      <div ref={ref} data-mode="light" data-scheme={exp.scheme} className="relative">
        <img src={gifUrl(gif.id)} alt={gif.title || ''} className="block w-full" onError={() => setBroken(true)} />
        {cap && <Captions top={cap.top} bottom={cap.bottom} alt={cap.alt} />}
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
  const [templates, setTemplates] = useState([]);
  const [shuffleNo, setShuffleNo] = useState(0);
  // An admin's fresh search for this week: previewed here, and downloaded to be committed.
  const [draft, setDraft] = useState(null);
  const [saveState, setSaveState] = useState(null);
  useEffect(() => { fetchMemeTemplates().then(setTemplates); }, []);
  useEffect(() => { setSaveState(null); }, [week]);
  // Open on the latest finished week, not a week still in progress.
  useEffect(() => {
    if (!isWeekFinal && latestCompletedWeek > 0) onSelectWeek(latestCompletedWeek);
  }, []);

  const board = useMemo(() => (isWeekFinal ? buildMemeBoard({ ...boardInput, week }) : null), [isWeekFinal, boardInput, week]);
  const picks = draft?.week === week ? draft.picks : savedGifPicks(week);
  // Memes and saved GIFs (two per situation when it has more than one pick) in a shuffled order.
  const feed = useMemo(() => {
    if (!board) return [];
    const items = board.situations.flatMap(sit => {
      const gifs = (picks?.[sit.key] || []).filter(g => g?.id);
      const slots = gifs.length > 1 ? [0, 1] : gifs.length ? [0] : [];
      return [{ id: `m-${sit.key}`, kind: 'meme', sit }, ...slots.map(slot => ({ id: `g-${sit.key}-${slot}`, kind: 'gif', sit, slot, gifs }))];
    });
    return shuffled(items, `${week}|${shuffleNo}`);
  }, [board, picks, week, shuffleNo]);

  const saveGifs = async () => {
    setSaveState({ busy: true });
    const { picks: found, limited } = await searchWeekPicks(week, board.situations, pickIndex);
    const count = Object.keys(found).length;
    if (count) {
      setDraft({ week, picks: found });
      downloadJson(found, `week-${week}.json`);
    }
    setSaveState({ count, total: board.situations.length, limited, resetMinutes: giphyBudget().resetMinutes });
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
              ? `Save runs one Giphy search per card (cached for a week, capped at ${GIPHY_HOURLY_CAP} an hour, ${giphyBudget().used} used this hour) and downloads week-${week}.json for src/data/gifs/.`
              : 'Saving GIFs only works in local dev (npm run dev) with VITE_GIPHY_API_KEY in .env.'}
          </p>
        )}
      </div>

      {saveState && !saveState.busy && (
        <p className={`rounded-xl border p-3 text-sm text-[var(--text)] ${saveState.limited || !saveState.count ? 'border-[var(--neg)]/40 bg-[var(--neg)]/10' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
          {saveState.count
            ? `Found GIFs for ${saveState.count} of ${saveState.total} cards and downloaded week-${week}.json. They're showing below; move the file into src/data/gifs/ and commit.`
            : 'No GIFs found, so nothing was downloaded.'}
          {saveState.limited && ` Giphy's hourly limit stopped the search early, so this is partial. Try again in about ${saveState.resetMinutes || 60} minutes; finished searches are cached.`}
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
            ? <MemeCard key={item.id} situation={item.sit} week={week} templates={templates} isAdmin={isAdmin} />
            : <GifCard key={item.id} situation={item.sit} week={week} slot={item.slot} gifs={item.gifs} isAdmin={isAdmin} />))}
        </div>
      )}
      {board && feed.some(item => item.kind === 'gif') && <p className="text-center text-[11px] text-[var(--muted)]">GIFs powered by GIPHY</p>}
    </div>
  );
}
