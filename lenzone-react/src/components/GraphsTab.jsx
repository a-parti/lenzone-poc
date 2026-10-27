import React, { useState, lazy, Suspense } from 'react';
import { LuckOfTheWeek, BoomOrBust, LuckMeter, SeasonHeatMap, FleeceMeter, SitStartMeter, PlayerBoomBustMeter, WaiverWireMeter, DraftValueMeter } from './FunVisuals';
import { SkeletonRows } from './shared';

const StandingsTrendChart = lazy(() => import('./StandingsTrendChart'));

// Five chips, no sub-tabs: each chip shows all of its graphs stacked on one page.
const GROUPS = [
  { key: 'luck', label: 'Luck', aliases: [] },
  { key: 'lineups', label: 'Lineups', aliases: ['sitstart', 'boombust'] },
  { key: 'moves', label: 'Roster Moves', aliases: ['fleece', 'waiver', 'draft'] },
  { key: 'trends', label: 'Trends', aliases: ['heat'] },
  { key: 'weekly', label: 'Weekly', aliases: ['week'] }
];

function groupFromHash() {
  const [id, query] = window.location.hash.slice(1).split('?');
  if (id === 'trends') return 'trends';
  const view = query ? new URLSearchParams(query).get('view') : null;
  return GROUPS.find(g => g.key === view || g.aliases.includes(view))?.key || 'luck';
}

export default function GraphsTab({
  luck, heat, completedWeeks, fleece, sitStart, boomBust, waiver, draft, playersLoading,
  standingsHistory, weeklyPfPaHistory, afcManagers, nfcManagers, hexColorMap, latestCompletedWeek,
  selectedWeek, onSelectWeek, seasonWeeks, currentWeek, isWeekFinal, weekRows, logoMap, pregameScores
}) {
  const [group, setGroup] = useState(groupFromHash);
  const choose = (key) => {
    setGroup(key);
    window.history.replaceState(null, '', `#graphs?view=${key}`);
  };
  const loading = playersLoading ? <SkeletonRows rows={5} /> : null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div role="tablist" aria-label="Graphs" className="flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
        {GROUPS.map(g => (
          <button key={g.key} type="button" role="tab" aria-selected={group === g.key} onClick={() => choose(g.key)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold transition-colors ${group === g.key
              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)]'
              : 'border-[var(--border2)] bg-[var(--surface)] text-[var(--text2)] hover:text-[var(--text)]'}`}>
            {g.label}
          </button>
        ))}
      </div>

      {group === 'luck' && <LuckMeter luck={luck} />}
      {group === 'lineups' && (
        <div className="space-y-6">
          {loading || <SitStartMeter rows={sitStart} />}
          <PlayerBoomBustMeter rows={boomBust} />
        </div>
      )}
      {group === 'moves' && (
        <div className="space-y-6">
          {loading || (
            <>
              <FleeceMeter data={fleece} />
              <WaiverWireMeter rows={waiver} />
              <DraftValueMeter data={draft} />
            </>
          )}
        </div>
      )}
      {group === 'trends' && (
        <div className="space-y-6">
          <SeasonHeatMap heat={heat} weeks={completedWeeks} />
          <Suspense fallback={<SkeletonRows rows={5} />}>
            <StandingsTrendChart
              history={standingsHistory} weeklyHistory={weeklyPfPaHistory}
              afcManagers={afcManagers} nfcManagers={nfcManagers}
              hexColorMap={hexColorMap} latestCompletedWeek={latestCompletedWeek}
            />
          </Suspense>
        </div>
      )}
      {group === 'weekly' && (
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/60 p-3">
            <label htmlFor="graphs-week" className="text-xs font-semibold uppercase tracking-wider text-[var(--text2)]">Week</label>
            <select id="graphs-week" value={selectedWeek} onChange={(e) => onSelectWeek(Number(e.target.value))}
              className="rounded-lg border border-[var(--border)]/80 bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)]">
              {Array.from({ length: seasonWeeks }, (_, i) => i + 1).map(w => (
                <option key={w} value={w}>Week {w}{w === currentWeek ? ' (current)' : ''}</option>
              ))}
            </select>
          </div>
          {isWeekFinal ? (
            <>
              <LuckOfTheWeek week={selectedWeek} rows={weekRows} logoMap={logoMap} />
              <BoomOrBust week={selectedWeek} rows={weekRows} pregameScores={pregameScores} />
            </>
          ) : (
            <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
              Week {selectedWeek} isn't final yet. These charts appear once the week is complete.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
