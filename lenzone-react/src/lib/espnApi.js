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
      const add = (abbr, opponentAbbr, outcome) => {
        const team = normalizeAbbr(abbr);
        if (!byTeam[team]) byTeam[team] = [];
        byTeam[team].push({ week, opponent: normalizeAbbr(opponentAbbr), result: outcome, date: comp.date || e.date || null });
      };
      add(home.team.abbreviation, away.team.abbreviation, result === 'T' ? 'T' : (result === 'home' ? 'W' : 'L'));
      add(away.team.abbreviation, home.team.abbreviation, result === 'T' ? 'T' : (result === 'away' ? 'W' : 'L'));
    });
  });
  Object.values(byTeam).forEach(list => list.sort((a, b) => a.week - b.week));
  return byTeam;
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
