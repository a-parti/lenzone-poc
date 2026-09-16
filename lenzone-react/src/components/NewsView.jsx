import React from 'react';
import NflFunFact from './NflFunFact';
import NflHeadlines from './NflHeadlines';
import YourPlayerNews from './YourPlayerNews';

// The one place all the real, dynamic NFL news/fun-fact widgets live -- full page width like
// every other tab (Standings, Matchups, etc.) instead of a narrow centered column, with room for
// both cards to show a lot more real content at once via their own internal scroll.
export default function NewsView({
  seasonResultsByTeam, nflHeadlines, onRefreshHeadlines, myTeamManager, myPlayerNotes, myPlayerHeadlines, onRefreshPlayerNews, className
}) {
  return (
    <div className={`max-w-7xl mx-auto w-full space-y-6 ${className || ""}`}>
      <NflFunFact resultsByTeam={seasonResultsByTeam} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <NflHeadlines headlines={nflHeadlines} onRefresh={onRefreshHeadlines} />
        <YourPlayerNews
          manager={myTeamManager} notes={myPlayerNotes} headlines={myPlayerHeadlines}
          onRefresh={onRefreshPlayerNews}
        />
      </div>
    </div>
  );
}
