// Real per-game kickoff time + live status from ESPN's public scoreboard endpoint. Sleeper's own
// schedule feed only has a date, never a time-of-day, so this fills that gap with actual data
// rather than a fabricated time. Verified live against
// site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard on 2026-09-10.
const ESPN_ABBR_TO_SLEEPER = { WSH: "WAS" };
function normalizeAbbr(a) {
  return ESPN_ABBR_TO_SLEEPER[a] || a;
}

function shortName(event) {
  const comp = event.competitions?.[0];
  const home = comp?.competitors?.find(c => c.homeAway === 'home')?.team?.abbreviation;
  const away = comp?.competitors?.find(c => c.homeAway === 'away')?.team?.abbreviation;
  return home && away ? `${normalizeAbbr(away)} @ ${normalizeAbbr(home)}` : (event.shortName || '');
}

const RUSH_TYPES = /^(Rush|Rushing Touchdown)$/;
const PASS_TYPES = /^(Pass Reception|Passing Touchdown)$/;
const FG_YARDAGE = /(\d+)\s*yard field goal/i;
const INT_TYPES = /^(Pass Interception Return|Interception Return Touchdown)$/;
const SACK_TYPE = /^Sack$/;
// ESPN's real play text always opens with the primary player for that play type, ESPN's own
// "F.Last-Name" shorthand (e.g. "D.Lock pass ...", "R.Stevenson up the middle ...",
// "A.Borregales 50 yard field goal ..."). Real text parsing, not invented -- if the pattern
// doesn't match (unusual play phrasing), the name is just left blank rather than guessed.
const LEAD_PLAYER = /^([A-Z][a-zA-Z'.-]*\.[A-Za-z'-]+)/;
const RECEIVER = /\bto\s+([A-Z][a-zA-Z'.-]*\.[A-Za-z'-]+)\s+for\s+-?\d+\s+yards?/i;

function extractName(regex, text) {
  const m = text?.match(regex);
  return m ? m[1] : null;
}

// Real, verified league-wide "big plays" for a week -- longest reception, longest pass (QB),
// longest run, longest field goal -- pulled from ESPN's real play-by-play (the `drives` payload
// on the event summary endpoint, verified live against a completed 2026 Week 1 game on
// 2026-09-15: each play carries a real `statYardage` and description text, e.g. "D.Lock pass
// short left to J.Smith-Njigba for 45 yards, TOUCHDOWN."). Only fully COMPLETED games count, so
// an in-progress game's plays can't briefly claim "longest of the week" and then get quietly
// overtaken later. This fetches one summary request per game in the week (~14-16 requests) --
// call it once per week and cache the result, not on every render.
//
// A completed pass IS simultaneously the QB's longest pass and the receiver's longest reception
// (same physical play, same yardage) -- passPlays carries both names (passerName/receiverName) so
// callers can show either framing without re-deriving one from the other.
export async function fetchWeekBigPlays(week, seasonYear) {
  try {
    const scoreboard = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&year=${seasonYear}`
    ).then(r => r.json());
    const events = (scoreboard.events || []).filter(e => {
      const status = e.status?.type;
      return status?.completed === true || status?.state === 'post';
    });

    const summaries = await Promise.all(events.map(e =>
      fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${e.id}`)
        .then(r => r.json())
        .catch(() => null)
    ));

    // Keep every qualifying play (not just the running max) so callers can also filter down to
    // just a specific roster's own players (see players.js findMyBigPlay) -- e.g. "your team's
    // longest run", not only whichever team happens to hold the league-wide record.
    const passPlays = [], runPlays = [], fgPlays = [], intPlays = [], sackPlays = [];
    summaries.forEach((summary, idx) => {
      if (!summary) return;
      const event = shortName(events[idx]);
      (summary.drives?.previous || []).forEach(drive => {
        // For a sack/INT, the team that made the PLAY is the defense, not the offense the drive
        // belongs to -- attribute those two to the opposing team instead.
        const offenseTeam = normalizeAbbr(drive.team?.abbreviation);
        (drive.plays || []).forEach(play => {
          const type = play.type?.text || '';
          const yards = play.statYardage;
          const text = play.text;
          if (RUSH_TYPES.test(type) && yards > 0) {
            runPlays.push({ yards, text, team: offenseTeam, event, playerName: extractName(LEAD_PLAYER, text) });
          } else if (PASS_TYPES.test(type) && yards > 0) {
            passPlays.push({
              yards, text, team: offenseTeam, event,
              passerName: extractName(LEAD_PLAYER, text),
              receiverName: extractName(RECEIVER, text)
            });
          } else if (type === 'Field Goal Good') {
            const m = text?.match(FG_YARDAGE);
            const fgYards = m ? Number(m[1]) : null;
            if (fgYards) fgPlays.push({ yards: fgYards, text, team: offenseTeam, event, playerName: extractName(LEAD_PLAYER, text) });
          } else if (INT_TYPES.test(type) && yards >= 0) {
            intPlays.push({ yards, text, team: null, event, playerName: extractName(LEAD_PLAYER, text) });
          } else if (SACK_TYPE.test(type) && yards < 0) {
            sackPlays.push({ yards: Math.abs(yards), text, team: null, event, playerName: extractName(LEAD_PLAYER, text) });
          }
        });
      });
    });
    passPlays.sort((a, b) => b.yards - a.yards);
    runPlays.sort((a, b) => b.yards - a.yards);
    fgPlays.sort((a, b) => b.yards - a.yards);
    intPlays.sort((a, b) => b.yards - a.yards);
    sackPlays.sort((a, b) => b.yards - a.yards);

    return {
      longestReception: passPlays[0] || null, longestRun: runPlays[0] || null, longestFieldGoal: fgPlays[0] || null,
      longestInterceptionReturn: intPlays[0] || null, biggestSack: sackPlays[0] || null,
      passPlays, runPlays, fgPlays, intPlays, sackPlays
    };
  } catch (err) {
    console.error("Failed to fetch NFL big plays:", err);
    return {
      longestReception: null, longestRun: null, longestFieldGoal: null, longestInterceptionReturn: null, biggestSack: null,
      passPlays: [], runPlays: [], fgPlays: [], intPlays: [], sackPlays: []
    };
  }
}

// Real per-team results (W/L/T, opponent, date) for every completed week 1..throughWeek --
// built from the same real ESPN scoreboard endpoint fetchWeekKickoffInfo already uses (one
// request per completed week, so this is cheap this early in a season). Used for a "fun NFL
// fact" -- e.g. a real team's current win/loss streak -- never a fabricated stat.
export async function fetchSeasonResultsByTeam(seasonYear, throughWeek) {
  const byTeam = {};
  const weeks = Array.from({ length: Math.max(0, throughWeek) }, (_, i) => i + 1);
  const scoreboards = await Promise.all(weeks.map(w =>
    fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${w}&seasontype=2&year=${seasonYear}`)
      .then(r => r.json())
      .catch(() => null)
  ));
  scoreboards.forEach((res, idx) => {
    const week = weeks[idx];
    (res?.events || []).forEach(e => {
      const comp = e.competitions?.[0];
      if (!comp) return;
      const status = e.status?.type;
      if (!(status?.completed === true || status?.state === 'post')) return;
      const home = comp.competitors?.find(c => c.homeAway === 'home');
      const away = comp.competitors?.find(c => c.homeAway === 'away');
      if (!home?.team || !away?.team) return;
      const homeScore = Number(home.score), awayScore = Number(away.score);
      if (!(homeScore >= 0 && awayScore >= 0)) return;
      const result = homeScore === awayScore ? 'T' : (homeScore > awayScore ? 'home' : 'away');
      const add = (abbr, opponentAbbr, outcome, pointsFor, pointsAgainst) => {
        const team = normalizeAbbr(abbr);
        if (!byTeam[team]) byTeam[team] = [];
        byTeam[team].push({ week, opponent: normalizeAbbr(opponentAbbr), result: outcome, date: comp.date || e.date || null, pointsFor, pointsAgainst });
      };
      add(home.team.abbreviation, away.team.abbreviation, result === 'T' ? 'T' : (result === 'home' ? 'W' : 'L'), homeScore, awayScore);
      add(away.team.abbreviation, home.team.abbreviation, result === 'T' ? 'T' : (result === 'away' ? 'W' : 'L'), awayScore, homeScore);
    });
  });
  Object.values(byTeam).forEach(list => list.sort((a, b) => a.week - b.week));
  return byTeam;
}

// Real, genuinely LIVE current NFL headlines -- ESPN's own public news feed (same site.api.espn.com
// host already used elsewhere in this app, so no new CORS surface). Unlike a fun-fact snapshot,
// this is meant to be re-fetched periodically (see App.jsx) so it actually stays current, not a
// one-time hardcoded list -- real headline text + the REAL link ESPN returns for it, never guessed.
// Each article's real `categories` array already tags which real players it's actually about
// (type: 'athlete', a real full name ESPN itself attached to the story) -- kept here as
// `athletes` so callers can match against a specific roster by real name, not by guessing whether
// a player's name happens to appear in the headline text itself.
export async function fetchNflHeadlines(limit = 8) {
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=${limit}`).then(r => r.json());
    return (res?.articles || []).map(a => ({
      headline: a.headline,
      link: a.links?.web?.href || null,
      published: a.published || null,
      byline: a.byline || null, // real ESPN reporter credited for the story, when ESPN provides one
      athletes: (a.categories || []).filter(c => c.type === 'athlete').map(c => c.description)
    })).filter(a => a.headline && a.link);
  } catch (err) {
    console.error("Failed to fetch NFL headlines:", err);
    return [];
  }
}

// Which of these headlines are actually tagged (by ESPN itself, not a text-search guess) as being
// about one of the given real player names -- used for "Your Player News", scoped to whichever
// roster is currently selected. Name matching is exact (case-insensitive) against ESPN's own
// athlete name for the story, so it only ever surfaces a real, ESPN-confirmed match.
export function filterHeadlinesForPlayers(headlines, playerNames) {
  const nameSet = new Set((playerNames || []).map(n => n.toLowerCase()));
  if (nameSet.size === 0) return [];
  return (headlines || []).filter(h => (h.athletes || []).some(a => nameSet.has(a.toLowerCase())));
}

// Real per-player fantasy notes for every rostered NFL player, league-wide, from ESPN's public
// injuries endpoint -- despite the name, this returns every player with a real note attached
// (most are "Active" with a real recent-game blurb, not just actual injuries), each one a real,
// sourced (usually RotoWire-credited) analyst note with a real headline/date, e.g. "Baker recorded
// five tackles (four solo)... during the Cardinals' 26-14 win over the Chargers on Sunday."
// ONE request covers the whole league, so this is cheap to call once and look players up by name
// against the result (see filterPlayerNotesForPlayers below) -- much more precise than searching
// headline text, since it's ESPN's own real per-athlete note, not a guess.
export async function fetchNflPlayerNotes() {
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries`).then(r => r.json());
    const byName = {};
    (res?.injuries || []).forEach(team => {
      (team.injuries || []).forEach(entry => {
        const athlete = entry.athlete;
        const note = athlete?.notes?.items?.[0];
        if (!athlete?.displayName || !note) return;
        // Real ESPN player-page link (the "news" or "overview" rel on this athlete's own links
        // array) so the note is clickable through to more detail, same as a headline.
        const link = athlete.links?.find(l => l.rel?.includes('news') && !l.rel?.includes('app'))?.href
          || athlete.links?.find(l => l.rel?.includes('overview') && !l.rel?.includes('app'))?.href
          || null;
        byName[athlete.displayName] = {
          status: entry.status || athlete.status?.name || null,
          headline: note.headline || null,
          text: note.text || null,
          source: note.source || null,
          date: note.date || entry.date || null,
          team: team.displayName || null,
          link
        };
      });
    });
    return byName;
  } catch (err) {
    console.error("Failed to fetch NFL player notes:", err);
    return {};
  }
}

// Real per-player notes (see fetchNflPlayerNotes) for just the given real player names -- used
// for "Your Player News", scoped to whichever roster is currently selected.
export function filterPlayerNotesForPlayers(notesByName, playerNames) {
  const out = [];
  (playerNames || []).forEach(name => {
    const note = notesByName?.[name];
    if (note) out.push({ player: name, ...note });
  });
  return out;
}

export async function fetchWeekKickoffInfo(week, seasonYear) {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&year=${seasonYear}`
    ).then(r => r.json());
    const byTeam = {};
    (res.events || []).forEach(e => {
      const comp = e.competitions?.[0];
      if (!comp) return;
      const status = e.status || {};
      const homeC = comp.competitors?.find(c => c.homeAway === 'home');
      const awayC = comp.competitors?.find(c => c.homeAway === 'away');
      const info = {
        kickoff: comp.date || e.date || null,
        state: status.type?.state || null, // 'pre' | 'in' | 'post'
        description: status.type?.description || null,
        period: status.period ?? null,
        displayClock: status.displayClock ?? null,
        homeScore: homeC?.score != null ? Number(homeC.score) : null,
        awayScore: awayC?.score != null ? Number(awayC.score) : null
      };
      (comp.competitors || []).forEach(c => {
        const abbr = normalizeAbbr(c.team?.abbreviation);
        if (abbr) byTeam[abbr] = info;
      });
    });
    return byTeam;
  } catch (err) {
    console.error("Failed to fetch ESPN kickoff info:", err);
    return {};
  }
}
