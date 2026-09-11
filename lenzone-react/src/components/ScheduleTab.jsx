import React, { useState, useEffect } from 'react';
import TeamName from './TeamName';
import { useRosterModal } from '../context/RosterModalContext';
import { CONF_STYLES, SCORE_COLOR } from '../lib/theme';
import { computeBlendedRosterScore, computeRosterProjection, scoringFieldFor } from '../lib/players';

// Real final score once that week is actually over (week <= latestCompletedWeek, the same cutoff
// used by the Matchups tab); otherwise the same per-player blended real+projected total used
// everywhere else in the app (real stat if a player's game already posted one, their pregame
// projection otherwise), computed from that week's own roster snapshot -- so a played week shows
// its real score, the current in-progress week shows a live-blended one, and every future week
// shows an honest "still projected" number instead of nothing. The "projected" comparison figure
// is the same blended total (falling back to the plain pregame roster projection when there's no
// snapshot yet) that buildMatchupInfo in App.jsx uses for the Matchups tab, so this view never
// disagrees with it. "Live" specifically means one of these starters' games is happening RIGHT NOW
// (byTeamWeek state 'in') -- not just "some real stat already exists somewhere in this not-yet-
// final week", which can just mean an earlier game already finished while the rest of the week
// hasn't happened yet.
function weekScore(season, confData, manager, week, weekProjectionsByWeek, latestCompletedWeek, playersDB, byTeamWeek) {
  const isFinalWeek = week <= latestCompletedWeek;
  const fallbackField = scoringFieldFor(confData?.receptionPoints || 0);
  const weekProjections = weekProjectionsByWeek?.[week] || {};
  const snapshot = season.rosterSnapshotByWeek[week]?.[manager];
  const blended = computeBlendedRosterScore(snapshot, weekProjections, confData?.scoringSettings, fallbackField);
  const roster = confData?.rosters?.find(r => r.manager === manager);
  const projected = blended?.total ?? computeRosterProjection(roster, weekProjections, confData?.scoringSettings, fallbackField);
  if (isFinalWeek) {
    const real = season.scoreByWeek[week]?.[manager];
    if (real == null) return null;
    // Compared against its own projection so a final score reads green/red by whether it beat
    // expectations, not a flat "it's over" color.
    return { value: real, projected, state: (projected != null && real < projected) ? 'final-neg' : 'final-pos' };
  }
  if (!snapshot || blended?.total == null) return projected != null ? { value: projected, projected: null, state: 'proj' } : null;
  const isLive = (snapshot.starters || []).some(id => {
    if (!id || id === '0') return false;
    const team = playersDB?.[id]?.team;
    return team && byTeamWeek?.[team]?.[week]?.state === 'in';
  });
  if (!isLive) return { value: projected, projected: null, state: 'proj' };
  return { value: blended.total, projected, state: 'live' };
}

function ScoreTag({ score }) {
  if (!score) return null;
  return (
    <span className={`text-xs font-mono font-bold shrink-0 ${SCORE_COLOR[score.state]}`}>
      {score.value.toFixed(2)}
      {score.projected != null && <span className="text-[10px] font-semibold text-[var(--proj)] ml-1">({score.projected.toFixed(2)})</span>}
    </span>
  );
}

const SEASON_WEEKS = 14;

function findOpponent(pairs, manager) {
  const pair = (pairs || []).find(([a, b]) => a === manager || b === manager);
  if (!pair) return null;
  return pair[0] === manager ? pair[1] : pair[0];
}

function ScheduleWeekRow({ week, intraOpponent, myConf, interOpponent, interOppConf, onGoToMatchup, isCurrentWeek, intraMyScore, intraOppScore, interMyScore, interOppScore }) {
  return (
    <div className={`bg-[var(--surface)]/60 backdrop-blur-md border rounded-xl p-4 transition-all duration-200 ${
      isCurrentWeek ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/50" : "border-[var(--border)]/80 hover:border-[var(--border2)]"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="tracking-wider text-[10px] uppercase font-semibold text-[var(--muted)]">Week {week}</p>
          {isCurrentWeek && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">Current</span>
          )}
        </div>
        {onGoToMatchup && (
          <button
            type="button"
            onClick={() => onGoToMatchup(week)}
            className="text-[10px] font-semibold text-[var(--accent)] hover:text-[var(--accent-ink)] uppercase tracking-wider"
          >
            View Matchup &rarr;
          </button>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[var(--surface2)] text-[var(--text)] border border-[var(--border2)] shrink-0 w-16 text-center">Intra</span>
          <span className="text-[10px] font-bold text-[var(--muted)] bg-[var(--bg)] px-2 py-1 rounded shrink-0">VS</span>
          {intraOpponent ? (
            <>
              <TeamName manager={intraOpponent} conf={myConf} className="font-semibold min-w-0 truncate max-w-[55%] sm:max-w-none" />
              {(intraMyScore || intraOppScore) && (
                <span className="ml-auto flex items-center gap-1.5 shrink-0">
                  <ScoreTag score={intraMyScore} />
                  <span className="text-[var(--muted)] text-xs">-</span>
                  <ScoreTag score={intraOppScore} />
                </span>
              )}
            </>
          ) : (
            <span className="text-[var(--muted)] italic">No matchup yet</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm pt-2 border-t border-[var(--border)]/60">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-[var(--surface2)] text-[var(--text)] border border-[var(--border2)] shrink-0 w-16 text-center">Inter</span>
          <span className="text-[10px] font-bold text-[var(--muted)] bg-[var(--bg)] px-2 py-1 rounded shrink-0">VS</span>
          {interOpponent ? (
            <>
              <TeamName manager={interOpponent} conf={interOppConf} className="font-semibold min-w-0 truncate max-w-[55%] sm:max-w-none" />
              {(interMyScore || interOppScore) && (
                <span className="ml-auto flex items-center gap-1.5 shrink-0">
                  <ScoreTag score={interMyScore} />
                  <span className="text-[var(--muted)] text-xs">-</span>
                  <ScoreTag score={interOppScore} />
                </span>
              )}
            </>
          ) : (
            <span className="text-[var(--muted)] italic">No matchup yet</span>
          )}
        </div>
      </div>
    </div>
  );
}

function TradeDeadlineMarker({ week }) {
  return (
    <div className="md:col-span-2 flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-rose-500/40" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-1 rounded-full shrink-0">
        Trade Deadline &mdash; Week {week}
      </span>
      <div className="flex-1 h-px bg-rose-500/40" />
    </div>
  );
}

export default function ScheduleTab({ afcSeason, nfcSeason, crossSchedule, afcManagers, nfcManagers, afcData, nfcData, weekProjectionsByWeek, afcTradeDeadlineWeek, nfcTradeDeadlineWeek, focusManager, focusConf, onGoToMatchup, currentWeek, latestCompletedWeek, playersDB, byTeamWeek }) {
  const [conf, setConf] = useState(focusConf || 'AFC');
  const [team, setTeam] = useState(focusManager || '');
  const { openRoster } = useRosterModal();

  const teamOptions = conf === 'NFC' ? nfcManagers : afcManagers;
  const tradeDeadlineWeek = conf === 'NFC' ? nfcTradeDeadlineWeek : afcTradeDeadlineWeek;
  const myConfData = conf === 'NFC' ? nfcData : afcData;

  useEffect(() => {
    if (focusManager && focusConf) {
      setConf(focusConf);
      setTeam(focusManager);
    }
  }, [focusManager, focusConf]);

  useEffect(() => {
    if (!teamOptions.includes(team)) setTeam(teamOptions[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conf, teamOptions.join('|')]);

  const season = conf === 'NFC' ? nfcSeason : afcSeason;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 bg-[var(--surface)]/60 backdrop-blur-md border border-[var(--border)]/80 p-4 rounded-xl">
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)] block mb-1">Conference</label>
          <div className="inline-flex rounded-lg bg-[var(--bg)] p-1 border border-[var(--border)]/80">
            {["AFC", "NFC"].map(c => (
              <button
                key={c}
                onClick={() => setConf(c)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all duration-200 ${
                  conf === c ? `${CONF_STYLES[c].button} text-white` : "text-[var(--text2)] hover:text-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="tracking-wider text-xs uppercase font-semibold text-[var(--text2)] block mb-1">Team</label>
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="bg-[var(--bg)] border border-[var(--border)]/80 text-sm rounded-lg px-3 py-1.5 text-[var(--text)]"
          >
            {teamOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {team && (
          <button
            type="button"
            onClick={() => openRoster(team, conf)}
            className="text-xs font-semibold text-[var(--text2)] hover:text-white bg-[var(--surface2)]/80 hover:bg-[var(--surface2)] border border-[var(--border2)] rounded-lg px-3 py-1.5 transition-all duration-200"
          >
            View Roster
          </button>
        )}
      </div>

      {!team && <p className="text-sm text-[var(--muted)] italic">No teams available yet.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {team && Array.from({ length: SEASON_WEEKS }, (_, i) => i + 1).map(week => {
          const intraOpponent = findOpponent(season.scheduleByWeek[week], team);
          const crossMatch = crossSchedule.find(m => m.week === week && (m.afcTeam === team || m.nfcTeam === team));
          const interOpponent = crossMatch ? (crossMatch.afcTeam === team ? crossMatch.nfcTeam : crossMatch.afcTeam) : null;
          const interOppConf = conf === 'AFC' ? 'NFC' : 'AFC';
          const interOppConfData = interOppConf === 'NFC' ? nfcData : afcData;
          const interOppSeason = interOppConf === 'NFC' ? nfcSeason : afcSeason;
          return (
            <React.Fragment key={week}>
              <ScheduleWeekRow
                week={week}
                myConf={conf}
                intraOpponent={intraOpponent}
                interOpponent={interOpponent}
                interOppConf={interOppConf}
                onGoToMatchup={onGoToMatchup ? (w) => onGoToMatchup(w, team, conf) : null}
                isCurrentWeek={week === currentWeek}
                intraMyScore={intraOpponent ? weekScore(season, myConfData, team, week, weekProjectionsByWeek, latestCompletedWeek, playersDB, byTeamWeek) : null}
                intraOppScore={intraOpponent ? weekScore(season, myConfData, intraOpponent, week, weekProjectionsByWeek, latestCompletedWeek, playersDB, byTeamWeek) : null}
                interMyScore={interOpponent ? weekScore(season, myConfData, team, week, weekProjectionsByWeek, latestCompletedWeek, playersDB, byTeamWeek) : null}
                interOppScore={interOpponent ? weekScore(interOppSeason, interOppConfData, interOpponent, week, weekProjectionsByWeek, latestCompletedWeek, playersDB, byTeamWeek) : null}
              />
              {tradeDeadlineWeek === week && <TradeDeadlineMarker week={week} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
