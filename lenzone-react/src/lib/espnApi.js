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

// Real, verified league-wide "big plays" for a week -- longest pass, longest run, longest field
// goal -- pulled from ESPN's real play-by-play (the `drives` payload on the event summary
// endpoint, verified live against a completed 2026 Week 1 game on 2026-09-15: each play carries a
// real `statYardage` and description text, e.g. "D.Lock pass short left to J.Smith-Njigba for 45
// yards, TOUCHDOWN."). Only fully COMPLETED games count, so an in-progress game's plays can't
// briefly claim "longest of the week" and then get quietly overtaken later. This fetches one
// summary request per game in the week (~14-16 requests) -- call it once per week and cache the
// result, not on every render.
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
    const passPlays = [], runPlays = [], fgPlays = [];
    summaries.forEach((summary, idx) => {
      if (!summary) return;
      const event = shortName(events[idx]);
      (summary.drives?.previous || []).forEach(drive => {
        const team = normalizeAbbr(drive.team?.abbreviation);
        (drive.plays || []).forEach(play => {
          const type = play.type?.text || '';
          const yards = play.statYardage;
          if (RUSH_TYPES.test(type) && yards > 0) {
            runPlays.push({ yards, text: play.text, team, event });
          } else if (PASS_TYPES.test(type) && yards > 0) {
            passPlays.push({ yards, text: play.text, team, event });
          } else if (type === 'Field Goal Good') {
            const m = play.text?.match(FG_YARDAGE);
            const fgYards = m ? Number(m[1]) : null;
            if (fgYards) fgPlays.push({ yards: fgYards, text: play.text, team, event });
          }
        });
      });
    });
    passPlays.sort((a, b) => b.yards - a.yards);
    runPlays.sort((a, b) => b.yards - a.yards);
    fgPlays.sort((a, b) => b.yards - a.yards);

    return {
      longestPass: passPlays[0] || null, longestRun: runPlays[0] || null, longestFieldGoal: fgPlays[0] || null,
      passPlays, runPlays, fgPlays
    };
  } catch (err) {
    console.error("Failed to fetch NFL big plays:", err);
    return { longestPass: null, longestRun: null, longestFieldGoal: null, passPlays: [], runPlays: [], fgPlays: [] };
  }
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
