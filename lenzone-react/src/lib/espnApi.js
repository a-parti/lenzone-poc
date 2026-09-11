// Real per-game kickoff time + live status from ESPN's public scoreboard endpoint. Sleeper's own
// schedule feed only has a date, never a time-of-day, so this fills that gap with actual data
// rather than a fabricated time. Verified live against
// site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard on 2026-09-10.
const ESPN_ABBR_TO_SLEEPER = { WSH: "WAS" };
function normalizeAbbr(a) {
  return ESPN_ABBR_TO_SLEEPER[a] || a;
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
