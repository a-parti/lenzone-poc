// All network access to the Sleeper public API lives here.
import { getStartingSlots } from './players';

export async function fetchSleeperLeague(leagueId) {
  if (!leagueId || leagueId.trim().length < 10) return null;
  try {
    const cleanId = leagueId.trim();
    const [leagueRes, usersRes, rostersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${cleanId}`).then(r => r.json()),
      fetch(`https://api.sleeper.app/v1/league/${cleanId}/users`).then(r => r.json()),
      fetch(`https://api.sleeper.app/v1/league/${cleanId}/rosters`).then(r => r.json())
    ]);

    const userMap = {};
    const logoMap = {};
    usersRes.forEach(u => {
      const mgrName = u.metadata?.team_name || u.display_name;
      userMap[u.user_id] = mgrName;
      // Custom uploaded team logo takes priority; otherwise Sleeper's default avatar for that user
      logoMap[mgrName] = u.metadata?.avatar || (u.avatar ? `https://sleepercdn.com/avatars/thumbs/${u.avatar}` : null);
    });

    const rosterIdMap = {};
    const parsedRosters = rostersRes.map(r => {
      const mgrName = userMap[r.owner_id] || `Team ${r.roster_id}`;
      rosterIdMap[r.roster_id] = mgrName;
      const settings = r.settings || {};
      const wins = settings.wins || 0;
      const losses = settings.losses || 0;
      const ties = settings.ties || 0;
      const fpts = settings.fpts || 0;
      const fptsDec = settings.fpts_decimal || 0;
      const pf = parseFloat(`${fpts}.${fptsDec < 10 ? '0' : ''}${fptsDec}`);

      return {
        manager: mgrName,
        rosterId: r.roster_id,
        wins,
        losses,
        ties,
        inConfRecord: `${wins}-${losses}-${ties}`,
        inConfPts: (wins * 2.0) + (ties * 1.0),
        pf: isNaN(pf) ? 0 : pf,
        faabLeft: 100 - (settings.waiver_budget_used || 0),
        players: r.players || [],
        starters: r.starters || [],
        reserve: r.reserve || []
      };
    });

    const startingSlots = getStartingSlots(leagueRes.roster_positions);
    // Sleeper doesn't list "IR" in roster_positions -- IR slot count lives in settings.reserve_slots
    const irSlotCount = leagueRes.settings?.reserve_slots ?? 0;
    const receptionPoints = leagueRes.scoring_settings?.rec ?? 0;
    // Full scoring ruleset, so projections can be computed with this league's exact point values
    const scoringSettings = leagueRes.scoring_settings || {};
    const tradeDeadlineWeek = leagueRes.settings?.trade_deadline ?? null;

    return { name: leagueRes.name || "Conference", rosters: parsedRosters, rosterIdMap, startingSlots, receptionPoints, scoringSettings, logoMap, irSlotCount, tradeDeadlineWeek };
  } catch (err) {
    console.error("Failed to fetch Sleeper league:", err);
    return null;
  }
}

export async function fetchWeekMatchups(leagueId, week, rosterIdMap) {
  if (!leagueId || leagueId.trim().length < 10) return [];
  try {
    const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId.trim()}/matchups/${week}`).then(r => r.json());
    if (!Array.isArray(res)) return [];
    const grouped = {};
    res.forEach(m => {
      if (m.matchup_id === null || m.matchup_id === undefined) return;
      if (!grouped[m.matchup_id]) grouped[m.matchup_id] = [];
      grouped[m.matchup_id].push({
        manager: rosterIdMap[m.roster_id] || `Roster ${m.roster_id}`,
        points: m.points || 0,
        starters: m.starters || [],
        startersPoints: m.starters_points || [],
        // Real per-player points for the WHOLE roster (not just starters) -- Sleeper's own
        // live-updating per-player stat total, keyed by player_id.
        playersPoints: m.players_points || {}
      });
    });
    return Object.values(grouped).filter(teams => teams.length === 2);
  } catch (err) {
    console.error("Failed to fetch weekly matchups:", err);
    return [];
  }
}

// Pulls every week in one shot: powers intra matchups, projections, playoff odds, and weekly awards
export async function fetchFullSeasonData(leagueId, rosterIdMap, seasonWeeks) {
  if (!leagueId || leagueId.trim().length < 10) return { scoreByWeek: {}, scheduleByWeek: {}, rosterSnapshotByWeek: {}, latestCompletedWeek: 0 };
  const weeks = Array.from({ length: seasonWeeks }, (_, i) => i + 1);
  const results = await Promise.all(weeks.map(async w => ({ week: w, pairs: await fetchWeekMatchups(leagueId, w, rosterIdMap) })));
  const scoreByWeek = {};
  const scheduleByWeek = {};
  const rosterSnapshotByWeek = {};
  let latestCompletedWeek = 0;
  results.forEach(({ week, pairs }) => {
    scoreByWeek[week] = {};
    scheduleByWeek[week] = [];
    rosterSnapshotByWeek[week] = {};
    let anyScore = false;
    pairs.forEach(([a, b]) => {
      scoreByWeek[week][a.manager] = a.points;
      scoreByWeek[week][b.manager] = b.points;
      scheduleByWeek[week].push([a.manager, b.manager]);
      rosterSnapshotByWeek[week][a.manager] = { starters: a.starters, startersPoints: a.startersPoints, playersPoints: a.playersPoints };
      rosterSnapshotByWeek[week][b.manager] = { starters: b.starters, startersPoints: b.startersPoints, playersPoints: b.playersPoints };
      if (a.points > 0 || b.points > 0) anyScore = true;
    });
    if (anyScore) latestCompletedWeek = Math.max(latestCompletedWeek, week);
  });
  return { scoreByWeek, scheduleByWeek, rosterSnapshotByWeek, latestCompletedWeek };
}

// Real weekly fantasy-point projections, sourced by Sleeper from RotoWire (a third-party sports
// data provider) via their projections endpoint. Not this app's own estimate -- an actual sourced
// projection, keyed by player_id, with pts_std/pts_half_ppr/pts_ppr variants for different scoring.
export async function fetchWeekProjections(season, week) {
  try {
    const url = `https://api.sleeper.app/projections/nfl/${season}/${week}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF`;
    const res = await fetch(url).then(r => r.json());
    if (!Array.isArray(res)) return {};
    const map = {};
    res.forEach(entry => {
      if (entry.player_id && entry.stats) map[entry.player_id] = entry.stats;
    });
    return map;
  } catch (err) {
    console.error("Failed to fetch weekly projections:", err);
    return {};
  }
}

// All weeks' projections in one shot, keyed by week -- powers the player modal's full-season
// projected/actual table (fetched once per session rather than refetched per player click).
export async function fetchAllWeekProjections(season, seasonWeeks) {
  const weeks = Array.from({ length: seasonWeeks }, (_, i) => i + 1);
  const results = await Promise.all(weeks.map(async w => ({ week: w, data: await fetchWeekProjections(season, w) })));
  const byWeek = {};
  results.forEach(({ week, data }) => { byWeek[week] = data; });
  return byWeek;
}

// Full NFL player dictionary (multi-MB). Fetched once per session, kept in memory only.
export async function fetchPlayersDB() {
  try {
    const res = await fetch(`https://api.sleeper.app/v1/players/nfl`).then(r => r.json());
    return res && typeof res === 'object' ? res : {};
  } catch (err) {
    console.error("Failed to fetch players database:", err);
    return {};
  }
}

export async function fetchWeekTransactions(leagueId, week) {
  if (!leagueId || leagueId.trim().length < 10) return [];
  try {
    const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId.trim()}/transactions/${week}`).then(r => r.json());
    return Array.isArray(res) ? res : [];
  } catch (err) {
    console.error("Failed to fetch transactions:", err);
    return [];
  }
}

export async function fetchSeasonTransactions(leagueId, weeksToCheck) {
  if (!leagueId || leagueId.trim().length < 10) return [];
  const weeks = Array.from({ length: weeksToCheck }, (_, i) => i + 1);
  const results = await Promise.all(weeks.map(w => fetchWeekTransactions(leagueId, w)));
  return results.flat();
}

// Sleeper's own notion of "current NFL week" -- it only advances once a week's games are done
// (typically early Tuesday), so it's the most reliable real signal we have for "is this week over."
export async function fetchNflState() {
  try {
    const res = await fetch(`https://api.sleeper.app/v1/state/nfl`).then(r => r.json());
    return { week: res?.week ?? 1, seasonType: res?.season_type ?? null };
  } catch (err) {
    console.error("Failed to fetch NFL state:", err);
    return { week: 1, seasonType: null };
  }
}

// Real NFL schedule for the season: which two teams play each week, the game date, and its real
// status (pre_game/complete/canceled). No kickoff time-of-day is available from this endpoint --
// only the date -- so that's all we show; never fabricate a specific kickoff time.
export async function fetchNflSchedule(season) {
  try {
    const res = await fetch(`https://api.sleeper.app/schedule/nfl/regular/${season}`).then(r => r.json());
    if (!Array.isArray(res)) return { byTeamWeek: {}, games: [] };
    const byTeamWeek = {};
    res.forEach(g => {
      if (!g.home || !g.away) return;
      const set = (team, opponent, isHome) => {
        if (!byTeamWeek[team]) byTeamWeek[team] = {};
        byTeamWeek[team][g.week] = { opponent, isHome, date: g.date, status: g.status };
      };
      set(g.home, g.away, true);
      set(g.away, g.home, false);
    });
    return { byTeamWeek, games: res };
  } catch (err) {
    console.error("Failed to fetch NFL schedule:", err);
    return { byTeamWeek: {}, games: [] };
  }
}

export async function fetchDraftPicks(leagueId) {
  if (!leagueId || leagueId.trim().length < 10) return { picks: [], rounds: 0 };
  try {
    const drafts = await fetch(`https://api.sleeper.app/v1/league/${leagueId.trim()}/drafts`).then(r => r.json());
    if (!Array.isArray(drafts) || drafts.length === 0) return { picks: [], rounds: 0 };
    const draftId = drafts[0].draft_id;
    const picks = await fetch(`https://api.sleeper.app/v1/draft/${draftId}/picks`).then(r => r.json());
    if (!Array.isArray(picks)) return { picks: [], rounds: 0 };
    const rounds = picks.reduce((max, p) => Math.max(max, p.round || 0), 0);
    return { picks, rounds };
  } catch (err) {
    console.error("Failed to fetch draft picks:", err);
    return { picks: [], rounds: 0 };
  }
}
