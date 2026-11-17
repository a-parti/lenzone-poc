import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Lock } from 'lucide-react';
import { fetchWeekGames } from '../lib/espnApi';
import { startPolling } from '../lib/polling';

// Sleeper closes trades when the deadline week's final NFL game ends (support.sleeper.com,
// "When is my trade deadline?"). The deadline week itself comes from the league's own Sleeper
// setting (`settings.trade_deadline`), and the final game, its kickoff and its live state come
// from ESPN's scoreboard -- so the banner never states a clock time nobody actually knows (when
// MNF ends). Three phases:
//   before -> "Trades close at the end of MNF" + countdown to the final game's kickoff
//   live   -> the final game is under way; trades close at the final whistle
//   passed -> every game that week is final; shown until Sleeper rolls to the next week
// Hidden outside the week before the deadline and the deadline week itself.

function formatCountdown(ms) {
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatKickoff(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Sleeper's schedule only has dates; used for the fallback line if ESPN can't be reached.
function lastGameDateFromSleeper(sleeperGames, week) {
  const dates = (sleeperGames || []).filter(g => g.week === week && g.date).map(g => g.date).sort();
  const last = dates[dates.length - 1];
  if (!last) return null;
  const d = new Date(`${last}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TradeDeadlineBanner({ deadlineWeek, nflWeek, seasonYear, sleeperGames }) {
  const inWindow = Boolean(deadlineWeek && nflWeek && nflWeek >= deadlineWeek - 1 && nflWeek <= deadlineWeek);
  const [games, setGames] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!inWindow) return undefined;
    // Every 2 minutes is plenty to catch the final whistle, and polling pauses on hidden tabs.
    return startPolling(() => fetchWeekGames(deadlineWeek, seasonYear).then(setGames), 120000);
  }, [inWindow, deadlineWeek, seasonYear]);

  useEffect(() => {
    if (!inWindow) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, [inWindow]);

  const status = useMemo(() => {
    if (!games || games.length === 0) return null;
    const sorted = [...games].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
    const last = sorted[sorted.length - 1];
    const lastKick = new Date(last.kickoff).getTime();
    const allFinal = games.every(g => g.state === 'post');
    const phase = allFinal ? 'passed' : (last.state === 'in' || now >= lastKick) ? 'live' : 'before';
    return { phase, last, lastKick };
  }, [games, now]);

  if (!inWindow) return null;

  const fallbackDate = lastGameDateFromSleeper(sleeperGames, deadlineWeek);

  if (!status) {
    return (
      <Shell tone="warn" icon={ArrowLeftRight} title={`Trade deadline: end of Week ${deadlineWeek}`}>
        Trades close when the last Week {deadlineWeek} game ends{fallbackDate ? ` (${fallbackDate})` : ''}.
      </Shell>
    );
  }

  const { phase, last, lastKick } = status;
  const matchup = `${last.away} @ ${last.home}`;

  if (phase === 'passed') {
    return (
      <Shell tone="done" icon={Lock} title="The trade deadline has passed">
        Week {deadlineWeek} is final, so trading is closed for the season. Waivers and free agents are still open.
      </Shell>
    );
  }

  if (phase === 'live') {
    const score = last.awayScore != null && last.homeScore != null
      ? ` ${last.away} ${last.awayScore}, ${last.home} ${last.homeScore}${last.period ? ` · Q${last.period}${last.displayClock ? ` ${last.displayClock}` : ''}` : ''}`
      : '';
    return (
      <Shell tone="live" icon={ArrowLeftRight} title="Last call: trades close at the final whistle" pulse>
        The final Week {deadlineWeek} game ({matchup}) is under way.{score && <span className="font-bold">{score}</span>}
      </Shell>
    );
  }

  const countdown = formatCountdown(lastKick - now);
  return (
    <Shell
      tone="warn" icon={ArrowLeftRight}
      title="Trade deadline: end of Monday Night Football"
      aside={countdown && (
        <div className="text-right shrink-0">
          <div className="font-display text-2xl sm:text-3xl font-extrabold leading-none tabular-nums">{countdown}</div>
          <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80 mt-1">until MNF kickoff</div>
        </div>
      )}
    >
      Trades close when the last Week {deadlineWeek} game ends: {matchup}, {formatKickoff(last.kickoff)} kickoff.
    </Shell>
  );
}

const TONES = {
  warn: 'border-[var(--live)]/50 bg-[var(--live)]/12 text-[var(--text)] [--banner-icon:var(--live)]',
  live: 'border-[var(--neg)]/55 bg-[var(--neg)]/12 text-[var(--text)] [--banner-icon:var(--neg)]',
  done: 'border-[var(--border)] bg-[var(--surface)]/70 text-[var(--text2)] [--banner-icon:var(--muted)]'
};

function Shell({ tone, icon: Icon, title, children, aside, pulse = false }) {
  return (
    <div role="status" className={`max-w-7xl mx-auto mb-6 rounded-2xl border-2 px-4 py-3 sm:px-5 sm:py-4 shadow-lg flex items-center gap-3 sm:gap-4 ${TONES[tone]}`}>
      <span className={`grid place-items-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl shrink-0 bg-[var(--surface)] text-[var(--banner-icon)] ${pulse ? 'animate-pulse' : ''}`}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-base sm:text-xl font-extrabold leading-tight">{title}</div>
        <div className="text-xs sm:text-sm mt-0.5 text-[var(--text2)]">{children}</div>
      </div>
      {aside}
    </div>
  );
}
