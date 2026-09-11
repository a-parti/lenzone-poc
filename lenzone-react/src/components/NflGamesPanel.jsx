import React, { useRef, useEffect } from 'react';
import { InjuryBadge, NflTeamLogo } from './shared';
import { SCORE_COLOR, scoreState } from '../lib/theme';
import PlayerNameButton from './PlayerNameButton';

function MyPlayersLine({ team, players, isLive }) {
  return (
    <div className="text-xs flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="font-bold text-[var(--text2)]">{team}:</span>
      {players.map((p, i) => {
        const hasActual = p.realPts != null;
        const ptsColor = hasActual ? SCORE_COLOR[scoreState({ hasActual: true, isLive, actual: p.realPts, projected: p.projPts })] : "text-[var(--proj)]";
        return (
          <React.Fragment key={p.playerId}>
            <span className={`inline-flex items-center gap-1 ${p.isBench ? "opacity-60" : ""}`}>
              {p.isBench && (
                <span className="text-[9px] font-bold uppercase px-1 rounded bg-[var(--surface2)] text-[var(--muted)] border border-[var(--border)]">Bench</span>
              )}
              <PlayerNameButton playerId={p.playerId} name={p.name} position={p.position} className={`font-bold ${p.isBench ? "text-[var(--text2)]" : "text-[var(--accent)]"}`} />
              <span className="text-[var(--muted)]">({p.position}{p.number != null ? ` - #${p.number}` : ""} - </span>
              {(hasActual || p.projPts != null) && (
                <span className={`font-semibold ${ptsColor}`}>{hasActual ? p.realPts.toFixed(2) : `${p.projPts.toFixed(2)} proj`}</span>
              )}
              <span className="text-[var(--muted)]">)</span>
              <InjuryBadge status={p.injuryStatus} />
            </span>
            {i < players.length - 1 && <span className="text-[var(--muted)]">&middot;</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// All real NFL games for the selected week, including ones already final -- a played game can
// still be clicked to highlight its players (e.g. reviewing who's in a Thursday-night game after
// the fact), so hiding it once it's over would remove exactly the games someone might want to
// select. Kickoff time + live state come from ESPN's public scoreboard where available (Sleeper's
// own schedule feed only has a date); otherwise falls back to the date, never a fabricated time.
// Shared by the Home "This Week" landing page and the Matchups tab's own "This Week" view so the
// two never drift into showing different things for the same week.
function dayKeyOf(g) {
  if (g.kickoff) return new Date(g.kickoff).toDateString();
  return g.date || null;
}
function dayLabelOf(g) {
  if (g.kickoff) return new Date(g.kickoff).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  return g.date ? new Date(`${g.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : '';
}
function timeKeyOf(g) {
  return g.kickoff || g.date || null;
}

// A thick divider (with the day spelled out) between distinct days, a thin one between distinct
// kickoff times on the same day -- so a lone Wednesday/Thursday game visually stands apart, and a
// block of same-time Sunday games reads as one group instead of a run of identical-looking rows.
function GameDivider({ isNewDay, label }) {
  if (isNewDay) {
    return (
      <div className="flex items-center gap-3 pt-1">
        <div className="flex-1 h-px bg-[var(--border2)]" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text2)] shrink-0">{label}</span>
        <div className="flex-1 h-px bg-[var(--border2)]" />
      </div>
    );
  }
  return <div className="h-px bg-[var(--border)]/50 mx-2" />;
}

export default function NflGamesPanel({ games, week, myTeamNflTeams, myPlayersByNflTeam, selectedGames, onToggleGame, onClearGames, compactCounts }) {
  const weekGames = (games || [])
    .filter(g => g.week === week && g.home && g.away)
    .sort((a, b) => (a.kickoff || a.date || "").localeCompare(b.kickoff || b.date || ""));
  const scrollRef = useRef(null);
  const focusRowRef = useRef(null);
  // Default scroll position: the live game if one is in progress, else the next upcoming game.
  // Scrolls only this card's own internal list -- never the page (scrollIntoView would also drag
  // the whole window down to reveal a row buried near the bottom of the page).
  useEffect(() => {
    const container = scrollRef.current;
    const row = focusRowRef.current;
    if (!container || !row) return;
    container.scrollTop = row.offsetTop - container.offsetTop;
  }, [weekGames.length]);
  if (weekGames.length === 0) return null;
  const now = Date.now();
  const liveIdx = weekGames.findIndex(g => g.state === 'in');
  const nextIdx = liveIdx >= 0 ? liveIdx : weekGames.findIndex(g => {
    if (g.state === 'post' || g.status === 'complete') return false;
    return !g.kickoff || new Date(g.kickoff).getTime() >= now;
  });
  return (
    <div className="bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="tracking-wider text-xs uppercase font-semibold text-[var(--muted)]">NFL Games &middot; Week {week}</p>
        {selectedGames?.length > 0 && (
          <button type="button" onClick={() => onClearGames?.()} className="text-[10px] font-semibold text-[var(--accent)] hover:text-[var(--accent-ink)]">
            Clear Highlight{selectedGames.length > 1 ? ` (${selectedGames.length})` : ""}
          </button>
        )}
      </div>
      <div ref={scrollRef} className="space-y-2 max-h-[28rem] overflow-y-auto scroll-thin pr-1 mt-3">
        {weekGames.map((g, idx) => {
          const prev = idx > 0 ? weekGames[idx - 1] : null;
          const isNewDay = prev ? dayKeyOf(g) !== dayKeyOf(prev) : false;
          const isNewTime = prev && !isNewDay ? timeKeyOf(g) !== timeKeyOf(prev) : false;
          const involvesMyTeam = myTeamNflTeams?.has(g.home) || myTeamNflTeams?.has(g.away);
          const isLive = g.state === 'in';
          const isFinal = g.state === 'post' || g.status === 'complete';
          const isSelected = selectedGames?.some(sg => sg.home === g.home && sg.away === g.away);
          const kickoffLabel = g.kickoff
            ? new Date(g.kickoff).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })
            : g.date
              ? new Date(`${g.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
              : '';
          const awayPlayers = myPlayersByNflTeam?.get(g.away);
          const homePlayers = myPlayersByNflTeam?.get(g.home);
          const awayCount = awayPlayers?.length || 0;
          const homeCount = homePlayers?.length || 0;
          return (
            <React.Fragment key={g.game_id}>
              {(isNewDay || isNewTime) && <GameDivider isNewDay={isNewDay} label={dayLabelOf(g)} />}
              <div
              ref={idx === nextIdx ? focusRowRef : null}
              role={onToggleGame ? "button" : undefined}
              tabIndex={onToggleGame ? 0 : undefined}
              onClick={onToggleGame ? () => onToggleGame({ home: g.home, away: g.away }) : undefined}
              onKeyDown={onToggleGame ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleGame({ home: g.home, away: g.away }); } } : undefined}
              className={`rounded-xl px-4 py-3 border-2 transition-all duration-150 ${onToggleGame ? "cursor-pointer" : ""} ${
                // A game with one of your players gets a different color per status -- amber while
                // it's actually live (most urgent), accent while it just hasn't kicked off yet, a
                // plain neutral surface once it's final (nothing left to watch there) -- so glancing
                // at the list alone tells you which of your players' games still need watching.
                // Games with none of your players stay neutral throughout. A clicked-to-highlight
                // game gets violet -- a THIRD color, distinct from both the amber/accent statuses
                // here and reused exactly (same hue) on the matching player rows in the roster
                // comparisons below (see myHighlighted/oppHighlighted in ManagerMatchupRow.jsx) --
                // so "this game is selected" reads as one consistent highlight across both surfaces
                // instead of two different colors for the same action.
                isSelected
                  ? "bg-violet-400/20 border-violet-400 ring-2 ring-violet-400/70"
                  : involvesMyTeam && !isFinal
                    ? isLive
                      ? "bg-amber-400/15 border-amber-400"
                      : "bg-[var(--accent)]/15 border-[var(--accent)]"
                    : "bg-[var(--surface2)]/50 border-transparent"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
                <div className="flex items-center gap-1 min-w-0 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  <NflTeamLogo team={g.away} />
                  {awayCount > 0 && (
                    <span className="text-xs font-semibold text-[var(--accent)] shrink-0" title={`${awayCount} of your players are on ${g.away}`}>
                      {compactCounts ? `(${awayCount})` : `(${awayCount} of yours)`}
                    </span>
                  )}
                  <span className="text-[var(--muted)] shrink-0 text-xs">@</span>
                  <NflTeamLogo team={g.home} />
                  {homeCount > 0 && (
                    <span className="text-xs font-semibold text-[var(--accent)] shrink-0" title={`${homeCount} of your players are on ${g.home}`}>
                      {compactCounts ? `(${homeCount})` : `(${homeCount} of yours)`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  {(isLive || isFinal) && g.awayScore != null && g.homeScore != null && (
                    <span className="font-mono tabular-nums font-bold text-[var(--text)]">{g.awayScore} - {g.homeScore}</span>
                  )}
                  {isLive ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Live Q{g.period} {g.displayClock}
                    </span>
                  ) : (
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      isFinal ? 'text-emerald-400' : g.status === 'canceled' ? 'text-red-400' : 'text-[var(--muted)]'
                    }`}>
                      {isFinal ? 'Final' : g.status === 'canceled' ? 'Canceled' : kickoffLabel}
                    </span>
                  )}
                </div>
              </div>
              {(awayPlayers?.length > 0 || homePlayers?.length > 0) && (
                <div className="mt-1.5 pl-11 space-y-0.5" onClick={(e) => e.stopPropagation()}>
                  {awayPlayers?.length > 0 && <MyPlayersLine team={g.away} players={awayPlayers} isLive={isLive} />}
                  {homePlayers?.length > 0 && <MyPlayersLine team={g.home} players={homePlayers} isLive={isLive} />}
                </div>
              )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
