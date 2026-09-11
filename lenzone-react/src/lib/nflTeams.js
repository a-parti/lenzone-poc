// Standard NFL team abbreviation -> full name lookup (static reference data, not from Sleeper).
export const NFL_TEAM_NAMES = {
  ARI: "Arizona Cardinals", ATL: "Atlanta Falcons", BAL: "Baltimore Ravens", BUF: "Buffalo Bills",
  CAR: "Carolina Panthers", CHI: "Chicago Bears", CIN: "Cincinnati Bengals", CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys", DEN: "Denver Broncos", DET: "Detroit Lions", GB: "Green Bay Packers",
  HOU: "Houston Texans", IND: "Indianapolis Colts", JAX: "Jacksonville Jaguars", KC: "Kansas City Chiefs",
  LAC: "Los Angeles Chargers", LAR: "Los Angeles Rams", LV: "Las Vegas Raiders", MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings", NE: "New England Patriots", NO: "New Orleans Saints", NYG: "New York Giants",
  NYJ: "New York Jets", PHI: "Philadelphia Eagles", PIT: "Pittsburgh Steelers", SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers", TB: "Tampa Bay Buccaneers", TEN: "Tennessee Titans", WAS: "Washington Commanders"
};

export function nflTeamName(abbr) {
  return NFL_TEAM_NAMES[abbr] || abbr || null;
}

export function nflTeamLogoUrl(abbr) {
  if (!abbr) return null;
  return `https://sleepercdn.com/images/team_logos/nfl/${abbr.toLowerCase()}.png`;
}

// Official team brand colors, pulled live from ESPN's public teams API
// (site.api.espn.com/apis/site/v2/sports/football/nfl/teams) and verified 2026-09-10 -- not
// guessed. Keyed to this app's Sleeper-style abbreviations (ESPN's "WSH" -> our "WAS").
export const NFL_TEAM_COLORS = {
  ARI: { primary: "#a40227", secondary: "#ffffff" },
  ATL: { primary: "#a71930", secondary: "#000000" },
  BAL: { primary: "#29126f", secondary: "#000000" },
  BUF: { primary: "#00338d", secondary: "#d50a0a" },
  CAR: { primary: "#0085ca", secondary: "#000000" },
  CHI: { primary: "#0b1c3a", secondary: "#e64100" },
  CIN: { primary: "#fb4f14", secondary: "#000000" },
  CLE: { primary: "#472a08", secondary: "#ff3c00" },
  DAL: { primary: "#002a5c", secondary: "#b0b7bc" },
  DEN: { primary: "#0a2343", secondary: "#fc4c02" },
  DET: { primary: "#0076b6", secondary: "#bbbbbb" },
  GB: { primary: "#204e32", secondary: "#ffb612" },
  HOU: { primary: "#021018", secondary: "#eb0028" },
  IND: { primary: "#003b75", secondary: "#ffffff" },
  JAX: { primary: "#007487", secondary: "#d7a22a" },
  KC: { primary: "#e31837", secondary: "#ffb612" },
  LV: { primary: "#000000", secondary: "#a5acaf" },
  LAC: { primary: "#0080c6", secondary: "#ffc20e" },
  LAR: { primary: "#003594", secondary: "#ffd100" },
  MIA: { primary: "#008e97", secondary: "#fc4c02" },
  MIN: { primary: "#4f2683", secondary: "#ffc62f" },
  NE: { primary: "#002a5c", secondary: "#c60c30" },
  NO: { primary: "#d3bc8d", secondary: "#000000" },
  NYG: { primary: "#003c7f", secondary: "#c9243f" },
  NYJ: { primary: "#115740", secondary: "#ffffff" },
  PHI: { primary: "#06424d", secondary: "#000000" },
  PIT: { primary: "#000000", secondary: "#ffb612" },
  SF: { primary: "#aa0000", secondary: "#b3995d" },
  SEA: { primary: "#002a5c", secondary: "#69be28" },
  TB: { primary: "#bd1c36", secondary: "#3e3a35" },
  TEN: { primary: "#4495d2", secondary: "#001532" },
  WAS: { primary: "#5a1414", secondary: "#ffb612" }
};

export function nflTeamColor(abbr) {
  return NFL_TEAM_COLORS[abbr] || null;
}

// Standard WCAG relative-luminance check, used to pick black or white text on a team-color pill so
// it stays readable regardless of theme/light-dark mode (rather than relying on the team's own
// secondary color, which isn't always a strong-contrast pair against its primary).
function relativeLuminance(hex) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16) / 255);
  const lin = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function readableTextOn(hex) {
  return relativeLuminance(hex) > 0.4 ? "#111111" : "#ffffff";
}

// One color-scheme entry per team for the theme picker's team-palette pool. Accent is the primary
// brand color, except where it's too light for the app's white-on-accent buttons to stay readable
// (only New Orleans' khaki-gold primary fails that check) -- there it falls back to the secondary.
export const NFL_TEAM_SCHEMES = Object.keys(NFL_TEAM_COLORS).map(abbr => {
  const { primary, secondary } = NFL_TEAM_COLORS[abbr];
  const accent = readableTextOn(primary) === "#ffffff" ? primary : secondary;
  return { id: `nfl-${abbr.toLowerCase()}`, label: NFL_TEAM_NAMES[abbr], swatch: accent, abbr };
});
