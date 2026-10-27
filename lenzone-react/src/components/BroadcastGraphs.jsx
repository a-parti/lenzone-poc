import React from 'react';
import WeeklyScoresBarChart from './WeeklyScoresBarChart';
import StandingsBarChart from './StandingsBarChart';
import {
  LuckOfTheWeek, BoomOrBust, LuckMeter, SeasonHeatMap, FleeceMeter, SitStartMeter,
  PlayerBoomBustMeter, WaiverWireMeter, DraftValueMeter
} from './FunVisuals';

function Section({ title, note, children }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--text)]">{title}</h3>
        {note && <p className="text-xs text-[var(--muted)]">{note}</p>}
      </div>
      {children}
    </section>
  );
}

// Every graph worth pasting into the Teams post, each with its own PNG export.
export default function BroadcastGraphs({
  weeklyScoresProps, afcStandings, nfcStandings, logoMap, week, isWeekFinal, weekRows, pregameScores,
  luck, heat, completedWeeks, fleece, sitStart, boomBust, waiver, draft
}) {
  return (
    <div className="space-y-8">
      <Section title="In the recap" note="The two charts the recap text marks for pasting.">
        <WeeklyScoresBarChart {...weeklyScoresProps} />
        <StandingsBarChart afcStandings={afcStandings} nfcStandings={nfcStandings} logoMap={logoMap} mode="combined" />
      </Section>

      <Section title="This week" note={isWeekFinal ? `Week ${week} results.` : `Week ${week} is not final yet, so these will appear once it is.`}>
        {isWeekFinal && (
          <>
            <LuckOfTheWeek week={week} rows={weekRows} logoMap={logoMap} />
            <BoomOrBust week={week} rows={weekRows} pregameScores={pregameScores} />
          </>
        )}
      </Section>

      <Section title="Season so far" note="Optional extras for the post.">
        <LuckMeter luck={luck} />
        <SitStartMeter rows={sitStart} />
        <PlayerBoomBustMeter rows={boomBust} />
        <FleeceMeter data={fleece} />
        <WaiverWireMeter rows={waiver} />
        <DraftValueMeter data={draft} />
        <SeasonHeatMap heat={heat} weeks={completedWeeks} />
      </Section>
    </div>
  );
}
