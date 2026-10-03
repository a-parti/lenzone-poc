import React, { useMemo, useState } from 'react';
import { Siren, X } from 'lucide-react';
import { playerLabel } from '../lib/players';
import TeamMiniLogo from './TeamMiniLogo';
import lenzoneLogoRing from '../assets/lenzone-logo-ring.png';
import lenzoneLogoBall from '../assets/lenzone-logo-ball.png';

// A newscast-style scrolling crawl of real Sleeper league activity along the bottom of the
// screen. Renders nothing when there's no activity yet.
function timestampDate(value) {
  if (!value) return '';
  const raw = typeof value === 'number' && value < 1e12 ? value * 1000 : value;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function compactTimestamp(value) {
  const date = timestampDate(value);
  if (!date) return '';
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function playerNames(playersDB, ids) {
  const names = (ids || []).map(id => playerLabel(playersDB, id).name);
  if (names.length <= 2) return names.join(' + ');
  return `${names.slice(0, 2).join(' + ')} +${names.length - 2}`;
}

function buildLeagueActivityItems(afcTransactions, nfcTransactions, afcRosterIdMap, nfcRosterIdMap, playersDB) {
  const normalize = (transactions, rosterIdMap, conf) => (transactions || [])
    .filter(transaction => transaction.status === 'complete' && ['trade', 'waiver', 'free_agent'].includes(transaction.type))
    .map(transaction => {
      const sides = new Map();
      const sideFor = rosterId => {
        const key = String(rosterId);
        if (!sides.has(key)) {
          sides.set(key, {
            manager: rosterIdMap?.[rosterId] || rosterIdMap?.[key] || `Roster ${rosterId}`,
            adds: [],
            drops: []
          });
        }
        return sides.get(key);
      };
      (transaction.roster_ids || []).forEach(sideFor);
      Object.entries(transaction.adds || {}).forEach(([playerId, rosterId]) => sideFor(rosterId).adds.push(playerId));
      Object.entries(transaction.drops || {}).forEach(([playerId, rosterId]) => sideFor(rosterId).drops.push(playerId));

      const teams = [...sides.values()];
      let detail;
      if (transaction.type === 'trade') {
        detail = teams.map(team => {
          const acquired = playerNames(playersDB, team.adds);
          return acquired ? `${team.manager} gets ${acquired}` : team.manager;
        }).join(' · ');
      } else {
        const team = teams[0];
        if (!team) return null;
        const added = playerNames(playersDB, team.adds);
        const dropped = playerNames(playersDB, team.drops);
        const verb = transaction.type === 'waiver' ? 'claimed' : 'added';
        const faab = transaction.type === 'waiver' && transaction.settings?.waiver_bid > 0
          ? ` for $${transaction.settings.waiver_bid} FAAB`
          : '';
        detail = `${team.manager} ${verb} ${added || 'a player'}${faab}${dropped ? ` · dropped ${dropped}` : ''}`;
      }

      return {
        id: `${conf}-${transaction.transaction_id}`,
        type: transaction.type,
        managers: teams.map(team => team.manager),
        text: `${conf} · ${detail}`,
        created: transaction.created || 0,
        timestamp: transaction.created || null
      };
    })
    .filter(Boolean);

  return [
    ...normalize(afcTransactions, afcRosterIdMap, 'AFC'),
    ...normalize(nfcTransactions, nfcRosterIdMap, 'NFC')
  ].sort((a, b) => b.created - a.created).slice(0, 16);
}

function LogoMark() {
  return (
    <span className="ticker-logo-mark" aria-hidden="true">
      <img src={lenzoneLogoRing} alt="" />
      <img src={lenzoneLogoBall} alt="" />
    </span>
  );
}

function CrawlLine({ items, onItemClick }) {
  const content = item => {
    const date = timestampDate(item.timestamp);
    return (
      <>
        {item.type === 'trade' && (
          <span className="trade-alert-label">
            <Siren className="w-3.5 h-3.5" />
            Trade Alert
          </span>
        )}
        {item.managers?.length > 0 && (
          <span className="inline-flex items-center -space-x-1 mr-1.5 align-middle">
            {item.managers.slice(0, 3).map(m => <TeamMiniLogo key={m} manager={m} size={18} ringColor="var(--surface)" />)}
          </span>
        )}
        <span>{item.text}</span>
        {date && <time className="ticker-item-time" dateTime={date.toISOString()}>{compactTimestamp(item.timestamp)}</time>}
      </>
    );
  };
  return (
    <span className="pr-16">
      {items.map((item, i) => (
        <React.Fragment key={item.id || `${item.text}-${i}`}>
          {i > 0 && <span className="news-ticker-separator mx-4">&bull;</span>}
          {item.link ? (
            <a
              href={item.link} target="_blank" rel="noopener noreferrer"
              className="news-ticker-link hover:underline"
            >
              {content(item)}
            </a>
          ) : onItemClick ? (
            <button
              type="button"
              className={`league-news-item ${item.type === 'trade' ? 'is-trade' : ''}`}
              onClick={onItemClick}
              title="Open league activity"
            >
              {content(item)}
            </button>
          ) : (
            <span>{content(item)}</span>
          )}
        </React.Fragment>
      ))}
    </span>
  );
}

function ScrollingItems({ items, onItemClick }) {
  const totalChars = items.reduce((sum, item) => sum + item.text.length, 0);
  const duration = Math.max(50, Math.round(totalChars / 6));
  return (
    <div className="flex-1 overflow-hidden py-1.5">
      <div
        className="news-ticker-track group-hover:[animation-play-state:paused] whitespace-nowrap text-xs font-semibold"
        style={{ animationDuration: `${duration}s` }}
      >
        <CrawlLine items={items} onItemClick={onItemClick} />
        <CrawlLine items={items} onItemClick={onItemClick} />
      </div>
    </div>
  );
}

// Dismissal lasts for this browser session only -- the crawl comes back on the next visit.
const DISMISS_KEY = 'lenzone_ticker_dismissed';
function readDismissed() {
  try { return sessionStorage.getItem(DISMISS_KEY) === 'true'; } catch { return false; }
}

// One slim league-activity crawl (trades, waiver claims, adds). Personal player news lives on My
// Week instead of a second banner.
export default function NewsTicker({
  afcTransactions, nfcTransactions, afcRosterIdMap, nfcRosterIdMap, playersDB,
  onOpenActivity
}) {
  const [dismissed, setDismissed] = useState(readDismissed);
  const leagueItems = useMemo(
    () => buildLeagueActivityItems(afcTransactions, nfcTransactions, afcRosterIdMap, nfcRosterIdMap, playersDB),
    [afcTransactions, nfcTransactions, afcRosterIdMap, nfcRosterIdMap, playersDB]
  );
  const hasTrade = leagueItems.some(item => item.type === 'trade');
  if (dismissed || leagueItems.length === 0) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, 'true'); } catch {}
  };

  return (
    <div data-bottom-chrome className="news-ticker-stack fixed left-0 right-0 bottom-[calc(52px+env(safe-area-inset-bottom))] md:bottom-0 z-40">
      <div className={`news-ticker-banner league-news-banner backdrop-blur-md border-t overflow-hidden group ${hasTrade ? 'has-trade' : ''}`}>
        <div className="flex items-center min-w-0">
          <button type="button" className="news-ticker-label league-news-label" onClick={onOpenActivity} title="League activity" aria-label="Open league activity">
            <LogoMark />
          </button>
          <ScrollingItems items={leagueItems} onItemClick={onOpenActivity} />
          <button
            type="button" onClick={dismiss} title="Hide for now" aria-label="Hide league activity banner"
            className="shrink-0 p-2.5 text-[var(--muted)] hover:text-[var(--text)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
