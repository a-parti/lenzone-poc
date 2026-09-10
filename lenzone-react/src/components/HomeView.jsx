import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CONF_STYLES } from '../lib/theme';
import { nflTeamName, nflTeamLogoUrl } from '../lib/nflTeams';

const NAV_SECTIONS = [
  { id: "standings", title: "Standings", description: "Conference records, Standings Pts, and playoff odds." },
  { id: "schedule", title: "Schedule", description: "Every team's full-season slate, in-conference and cross-conference." },
  { id: "matchups", title: "Weekly Matchups", description: "Live and projected scores for the selected week." },
  { id: "rosters", title: "Rosters", description: "Every roster with real and projected points per player." },
  { id: "activity", title: "Activity", description: "Waivers, free agent adds, and trades across both conferences." },
  { id: "players", title: "Players", description: "Search the player pool, ownership, and the draft board." }
];

function NavListItem({ title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 py-6 border-b border-slate-800/60 text-left group hover:border-slate-600 transition-colors duration-200"
    >
      <div className="min-w-0">
        <h3 className="font-display text-2xl sm:text-3xl text-slate-100 group-hover:text-white transition-colors duration-200">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
      <ArrowUpRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 shrink-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </button>
  );
}

function StatLine({ label, value, accent }) {
  return (
    <div>
      <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500">{label}</p>
      <p className={`font-display text-lg ${accent || "text-slate-200"}`}>{value}</p>
    </div>
  );
}

// Real NFL games for the selected week (date + status only -- Sleeper's schedule feed has no
// kickoff time-of-day and this app has no live NFL scoreboard, so status is limited to
// pre_game/complete/canceled, never a fabricated live score).
function GamesThisWeek({ games, week }) {
  const weekGames = (games || []).filter(g => g.week === week && g.home && g.away);
  if (weekGames.length === 0) return null;
  const byDate = {};
  weekGames.forEach(g => { (byDate[g.date] = byDate[g.date] || []).push(g); });
  const dates = Object.keys(byDate).sort();
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-5">
      <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 mb-3">NFL Games -- Week {week}</p>
      <div className="space-y-3 max-h-72 overflow-y-auto scroll-thin pr-1">
        {dates.map(date => (
          <div key={date}>
            <p className="text-[10px] font-mono text-slate-600 mb-1">
              {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            <div className="space-y-1.5">
              {byDate[date].map(g => (
                <div key={g.game_id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <img src={nflTeamLogoUrl(g.away)} alt="" className="w-4 h-4 object-contain shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                    <span className="text-slate-300 truncate">{nflTeamName(g.away)}</span>
                    <span className="text-slate-600 shrink-0">@</span>
                    <img src={nflTeamLogoUrl(g.home)} alt="" className="w-4 h-4 object-contain shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                    <span className="text-slate-300 truncate">{nflTeamName(g.home)}</span>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider shrink-0 ml-2 ${
                    g.status === 'complete' ? 'text-emerald-400' : g.status === 'canceled' ? 'text-rose-400' : 'text-slate-500'
                  }`}>
                    {g.status === 'complete' ? 'Final' : g.status === 'canceled' ? 'Canceled' : 'Scheduled'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomeView({ setActiveTab, selectedWeek, isWeekFinal, weeklyAwards, weekPoints, seasonRecord, nflGames }) {
  const topHighScore = isWeekFinal ? weeklyAwards?.highScore : (weeklyAwards?.projectedHighScore || weeklyAwards?.highScore);
  return (
    <div className="space-y-10">
      <div className="text-center py-6">
        <h1 className="font-display text-5xl sm:text-6xl text-slate-100 tracking-tight">LENZONE</h1>
        <p className="text-slate-500 mt-2">2026 Season &middot; Week {selectedWeek}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-5">
          <p className="tracking-wider text-[10px] uppercase font-semibold text-slate-500 mb-4">This Week</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {weekPoints?.afcTotal != null && (
              <StatLine
                label="Total Points"
                value={<><span className={CONF_STYLES.AFC.text}>{weekPoints.afcTotal.toFixed(0)}</span><span className="text-slate-600 mx-1">-</span><span className={CONF_STYLES.NFC.text}>{weekPoints.nfcTotal.toFixed(0)}</span></>}
              />
            )}
            {topHighScore && (
              <StatLine label={isWeekFinal ? "High Score" : "Projected High Score"} value={topHighScore.manager} accent="text-amber-400" />
            )}
            <StatLine
              label="Season Series"
              value={<><span className={CONF_STYLES.AFC.text}>{seasonRecord.afcWins}</span><span className="text-slate-600 mx-1">-</span><span className={CONF_STYLES.NFC.text}>{seasonRecord.nfcWins}</span></>}
            />
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("matchups")}
            className="mt-5 text-xs font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
          >
            View Weekly Matchups <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <GamesThisWeek games={nflGames} week={selectedWeek} />
      </div>

      <div>
        {NAV_SECTIONS.map(s => (
          <NavListItem key={s.id} title={s.title} description={s.description} onClick={() => setActiveTab(s.id)} />
        ))}
      </div>
    </div>
  );
}
