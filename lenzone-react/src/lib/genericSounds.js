// Manifest of the shared easter-egg sound pool at public/sounds/generic/. The browser can't list a
// directory at runtime, so this list has to be kept in sync by hand whenever a file is added or
// removed there. All files in that folder are trimmed to <=4s and loudness-normalized to the same
// target (-16 LUFS) so no one clip is jarringly louder/longer than another.
export const GENERIC_SOUNDS = [
  "areyounotentertained.mp3",
  "bad-to-the-bone-meme.mp3",
  "batman_original.mp3",
  "cbs-nfl-theme.mp3",
  "drum-roll-gaming-sound-effect-hd.mp3",
  "elevator_2jN6tnc.mp3",
  "engineer_no01.mp3",
  "espn-nfl-theme.mp3",
  "faaah.mp3",
  "german-ringtone-call.mp3",
  "grijpers1.mp3",
  "let-it-go-frozen.mp3",
  "mario-odyssey-mario-64-power-star-sound-effect.mp3",
  "nbc-nfl-sunday-night-football-theme-music_alMduUF.mp3",
  "nfl-draft-chime.mp3",
  "nfl-of-fox-theme-song.mp3",
  "nouveau-jingle-netflix.mp3",
  "obi-wan-hello-there.mp3",
  "preview_4.mp3",
  "sad-violin_guTFcJc.mp3",
  "sirens-the-odyssey.mp3",
  "spiderman-meme-song.mp3",
  "star-wars-b1-battle-droid_kampfdroide-roger-roger-sound.mp3",
  "the-weeknd-rizzz.mp3",
  "untitled_zd2ts4l-audiotrimmer.mp3",
  "wii-sports-nice-shot.mp3",
  "windows-xp-startup.mp3",
  "youre-a-wizard.mp3"
];

// Every real manager, mapped to a slug -- if public/sounds/exclusive/<slug>.mp3 exists, that manager
// always gets that exact clip instead of a random pull from the pool above. This is checked live
// (a HEAD request) rather than hardcoded, so dropping a new file in that folder with the right name
// is the ONLY step needed to give someone an exclusive sound -- no code change required. Remove the
// file to fall back to the random pool again.
export const MANAGER_SLUGS = {
  "Daejon Mustard, allegedly": "daejon-mustard",
  "What the Buck(eyes)": "what-the-buckeyes",
  "Blowouts": "blowouts",
  "Fishing for a Win": "fishing-for-a-win",
  "Krush Kiffin": "krush-kiffin",
  "JaimeKelsee": "jaimekelsee",
  "WorldSeriesChamps2026": "worldserieschamps",
  "Bringing the Smoke-y": "bringing-the-smokey",
  "Nikkster11": "nikkster11",
  "magggieburke": "magggieburke",
  "TheRealHousehusbandsOfIB": "therealhousehusbandsofib",
  "TheyKilledKenny": "theykilledkenny",
  "EricWonHisOtherLeague": "ericwonhisotherleague",
  "HailMaryHeroes": "hailmaryheroes",
  "Justhereforthegroupchat": "justhereforthegroupchat",
  "Pharoah of Fan Football": "pharaoh-of-fan-football",
  "FallingForYards": "fallingforyards",
  "ImJustHereSoIDontGetFined": "imjustheresoidontgetfined",
  "Hall & Oates": "hall-and-oates",
  "KrisandMahtab": "krisandmahtab",
  "NotSureIWillWin": "notsureiwillwin",
  "VizzyYardLine": "vizzyyardline",
  "Teardrops On My Lamar": "teardrops-on-my-lamar",
  "ahmadschaudhri": "ahmadschaudhri"
};

function randomGenericSoundUrl() {
  if (GENERIC_SOUNDS.length === 0) return null;
  const file = GENERIC_SOUNDS[Math.floor(Math.random() * GENERIC_SOUNDS.length)];
  return `/sounds/generic/${encodeURIComponent(file)}`;
}

// Resolves which clip should play for this manager: their exclusive file if one exists on disk,
// otherwise a random pick from the shared pool. Always resolves to SOMETHING (falls back to random
// even for an unrecognized manager name), never rejects.
export async function resolveEasterEggSoundUrl(managerName) {
  const slug = MANAGER_SLUGS[managerName?.trim()];
  if (slug) {
    const url = `/sounds/exclusive/${slug}.mp3`;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      // A missing file isn't guaranteed to 404 -- Vite's dev-server SPA fallback (and some static
      // hosts) answer any unmatched path with 200 + the index page rather than a real 404, so status
      // alone isn't trustworthy. Requiring an audio content-type filters that fallback page out.
      if (res.ok && (res.headers.get('content-type') || '').startsWith('audio')) return url;
    } catch {
      // Network hiccup on the HEAD check -- fall through to the random pool rather than playing nothing.
    }
  }
  return randomGenericSoundUrl();
}
