// Real meme templates (Imgflip's public list of popular memes) and real GIFs (Giphy).
//
// GIFs reach visitors from a saved file, never from live searches: once a week an admin runs the
// searches (needs a Giphy key in a LOCAL .env, dev only) and saves the picks to
// src/data/gifs/week-N.json. The live site only plays GIFs from those saved IDs, so it makes no
// Giphy API calls and the key never ships in the site.

let templatesPromise = null;
export function fetchMemeTemplates() {
  if (!templatesPromise) {
    templatesPromise = fetch('https://api.imgflip.com/get_memes')
      .then(r => r.json())
      .then(j => (j.success ? j.data.memes : []))
      .catch(() => []);
  }
  return templatesPromise;
}

// Only available when running locally (npm run dev); stripped from production builds.
export const GIPHY_KEY = import.meta.env.DEV ? import.meta.env.VITE_GIPHY_API_KEY : undefined;

const savedFiles = import.meta.glob('../data/gifs/week-*.json', { eager: true });
const savedByWeek = {};
Object.entries(savedFiles).forEach(([path, mod]) => {
  const week = Number(/week-(\d+)\.json$/.exec(path)?.[1]);
  if (week) savedByWeek[week] = mod.default || mod;
});

// { situationKey: [{ id, title }] } for a week, or null if the picks haven't been saved yet.
export const savedGifPicks = (week) => savedByWeek[week] || null;
export const gifUrl = (id) => `https://media.giphy.com/media/${id}/giphy.gif`;
export const gifPage = (id) => `https://giphy.com/gifs/${id}`;

// ---- Admin-only search (local dev) ----------------------------------------------------------
// Giphy's free key allows 100 searches an hour. Saving a week takes about 20; searches are cached
// for a week, identical ones share one request, and nothing runs past GIPHY_HOURLY_CAP an hour.
export const GIPHY_HOURLY_CAP = 90;
const HOUR = 60 * 60 * 1000;
const CACHE_KEY = 'lenzone_giphy_cache';
const CALLS_KEY = 'lenzone_giphy_calls';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ } };
const inFlight = new Map();

function recentCalls() {
  const cutoff = Date.now() - HOUR;
  return read(CALLS_KEY, []).filter(t => t > cutoff);
}

export function giphyBudget() {
  const calls = recentCalls();
  const resetMinutes = calls.length ? Math.max(1, Math.ceil((calls[0] + HOUR - Date.now()) / 60000)) : 0;
  return { used: calls.length, left: Math.max(0, GIPHY_HOURLY_CAP - calls.length), resetMinutes };
}

// Up to `limit` PG GIFs for a search: { gifs: [{id, title}], limited }. `limited` means the hourly cap
// stopped the search before it was sent.
export async function fetchGifs(query, limit = 12) {
  if (!GIPHY_KEY) return { gifs: [], limited: false };
  const hit = read(CACHE_KEY, {})[query];
  if (hit && Date.now() - hit.t < CACHE_TTL) return { gifs: hit.gifs, limited: false };
  if (inFlight.has(query)) return inFlight.get(query);
  const calls = recentCalls();
  if (calls.length >= GIPHY_HOURLY_CAP) return { gifs: [], limited: true };
  write(CALLS_KEY, [...calls, Date.now()]);

  const request = (async () => {
    try {
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(GIPHY_KEY)}&q=${encodeURIComponent(query)}&limit=${limit}&rating=pg&lang=en`;
      const res = await fetch(url);
      // Giphy's own limit (shared with anything else using this key): stop for the rest of the hour.
      if (res.status === 429) {
        write(CALLS_KEY, [...recentCalls(), ...Array(GIPHY_HOURLY_CAP).fill(Date.now())]);
        return { gifs: [], limited: true };
      }
      const j = await res.json();
      const gifs = (j.data || []).map(g => ({ id: g.id, title: g.title })).filter(g => g.id);
      if (gifs.length) write(CACHE_KEY, { ...read(CACHE_KEY, {}), [query]: { t: Date.now(), gifs } });
      return { gifs, limited: false };
    } catch {
      return { gifs: [], limited: false };
    } finally {
      inFlight.delete(query);
    }
  })();
  inFlight.set(query, request);
  return request;
}

// Runs one search per situation (its first query for this week) and returns the picks to save.
export async function searchWeekPicks(week, situations, pickIndex) {
  const picks = {};
  let limited = false;
  for (const sit of situations) {
    const query = sit.gifQueries[pickIndex(week, `${sit.key}|gif`, sit.gifQueries.length)];
    const r = await fetchGifs(query);
    if (r.limited) { limited = true; break; }
    if (r.gifs.length) picks[sit.key] = r.gifs.slice(0, 6);
  }
  return { picks, limited };
}
