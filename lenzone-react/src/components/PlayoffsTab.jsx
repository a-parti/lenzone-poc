import React, { useMemo, useRef, useState } from 'react';
import { Check, Clipboard, Crown, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { useNameDisplay } from '../context/NameDisplayContext';
import { useTeamLogo } from '../context/TeamLogoContext';
import { buildPostseasonSeeds } from '../lib/statsMath';
import ExportControls from './ExportControls';
import useElementPngExport from '../hooks/useElementPngExport';

const PLAYOFF_WEEKS = [15, 16, 17];

function seededTeams(standings) {
  return new Map(buildPostseasonSeeds(standings, standings[0]?.conf).map(team => [team.seed, team]));
}

function findSleeperMatchup(pairs, teamA, teamB) {
  if (!teamA?.manager || !teamB?.manager) return null;
  const matchup = (pairs || []).find(([a, b]) => {
    const managers = new Set([a.manager, b.manager]);
    return managers.has(teamA.manager) && managers.has(teamB.manager);
  });
  if (!matchup) return null;
  return Object.fromEntries(matchup.map(team => [team.manager, Number(team.points) || 0]));
}

function resolveMatchup(teamA, teamB, week, postseasonByWeek, currentWeek, lowerAdvances = false) {
  const scores = findSleeperMatchup(postseasonByWeek?.[week], teamA, teamB);
  const hasBothTeams = Boolean(teamA?.manager && teamB?.manager);
  const isFinal = hasBothTeams && currentWeek > week;
  const hasStarted = Boolean(scores && Object.values(scores).some(score => score > 0));
  const isLive = hasBothTeams && currentWeek === week && hasStarted;
  let advancing = null;

  if (isFinal && scores) {
    const scoreA = scores[teamA.manager];
    const scoreB = scores[teamB.manager];
    if (scoreA !== scoreB) {
      const aAdvances = lowerAdvances ? scoreA < scoreB : scoreA > scoreB;
      advancing = aAdvances ? teamA : teamB;
    }
  }

  return {
    teamA,
    teamB,
    week,
    scores,
    advancing,
    status: isFinal
      ? (scores ? 'final' : 'missing')
      : isLive
        ? 'live'
        : hasBothTeams && currentWeek >= week && !scores
          ? 'missing'
          : 'upcoming'
  };
}

function buildConferenceBracket(standings, postseasonByWeek, currentWeek, toilet = false) {
  const seeds = seededTeams(standings);
  const first = toilet
    ? [
        resolveMatchup(seeds.get(7), seeds.get(9), 15, postseasonByWeek, currentWeek, true),
        resolveMatchup(seeds.get(8), seeds.get(10), 15, postseasonByWeek, currentWeek, true)
      ]
    : [
        resolveMatchup(seeds.get(4), seeds.get(5), 15, postseasonByWeek, currentWeek),
        resolveMatchup(seeds.get(3), seeds.get(6), 15, postseasonByWeek, currentWeek)
      ];
  const byes = toilet ? [seeds.get(12), seeds.get(11)] : [seeds.get(1), seeds.get(2)];
  const second = [
    resolveMatchup(byes[0], first[0].advancing, 16, postseasonByWeek, currentWeek, toilet),
    resolveMatchup(byes[1], first[1].advancing, 16, postseasonByWeek, currentWeek, toilet)
  ];
  const final = resolveMatchup(second[0].advancing, second[1].advancing, 17, postseasonByWeek, currentWeek, toilet);
  return { seeds, byes, first, second, final, champion: final.advancing };
}

function BracketLogo({ manager }) {
  const logoUrl = useTeamLogo(manager);
  const [failed, setFailed] = useState(false);
  return logoUrl && !failed
    ? <img src={logoUrl} alt="" className="playoff-team-logo" onError={() => setFailed(true)} />
    : <span className="playoff-team-logo-fallback" />;
}

function TeamRow({ team, score, placeholder, conf, activeManager, onHover, onSelect, winner }) {
  const { mode, displayName, managerName } = useNameDisplay();
  if (!team?.manager) {
    return (
      <div className="playoff-team-row playoff-team-placeholder">
        <span className="playoff-seed">—</span>
        <span className="truncate">{placeholder || 'TBD'}</span>
      </div>
    );
  }

  const primary = displayName(team.manager, conf);
  const secondary = mode === 'teams' ? managerName(team.manager, conf) : team.manager;
  const teamKey = `${conf}:${team.manager}`;
  const isActive = activeManager === teamKey;
  const isDimmed = activeManager && !isActive;

  return (
    <button
      type="button"
      className={`playoff-team-row ${isActive ? 'is-highlighted' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
      onMouseEnter={() => onHover(teamKey)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(teamKey)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(teamKey)}
      title={`Highlight ${primary}'s bracket path`}
    >
      <span className="playoff-seed">{team.seed}</span>
      <BracketLogo key={team.manager} manager={team.manager} />
      <span className="min-w-0 flex-1 text-left">
        <span className="playoff-team-name">{primary}</span>
        {secondary && secondary !== primary && <span className="playoff-team-secondary">{secondary}</span>}
      </span>
      {winner && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-label="Advances" />}
      {score != null && <span className="playoff-score">{score.toFixed(2)}</span>}
    </button>
  );
}

function MatchupCard({ game, conf, accent, activeManager, onHover, onSelect, placeholders = [] }) {
  const statusLabel = game.status === 'final'
    ? 'Final'
    : game.status === 'live'
      ? 'Live'
      : game.status === 'missing'
        ? 'Needs Sleeper update'
        : `Week ${game.week}`;
  return (
    <div className={`playoff-matchup-card ${game.status === 'live' ? 'is-live' : ''}`} style={{ '--conf': accent }}>
      <TeamRow
        team={game.teamA}
        score={game.scores?.[game.teamA?.manager]}
        placeholder={placeholders[0]}
        conf={conf}
        activeManager={activeManager}
        onHover={onHover}
        onSelect={onSelect}
        winner={game.advancing?.manager === game.teamA?.manager}
      />
      <div className="playoff-matchup-divider" />
      <TeamRow
        team={game.teamB}
        score={game.scores?.[game.teamB?.manager]}
        placeholder={placeholders[1]}
        conf={conf}
        activeManager={activeManager}
        onHover={onHover}
        onSelect={onSelect}
        winner={game.advancing?.manager === game.teamB?.manager}
      />
      <span className={`playoff-matchup-status status-${game.status}`}>{statusLabel}</span>
    </div>
  );
}

function ByeCard({ team, conf, accent, activeManager, onHover, onSelect }) {
  return (
    <div className="playoff-bye-card" style={{ '--conf': accent }}>
      <TeamRow team={team} conf={conf} activeManager={activeManager} onHover={onHover} onSelect={onSelect} />
      <span className="playoff-bye-label">First-round bye</span>
    </div>
  );
}

function ConnectorLines({ mirrored, accent, highlighted }) {
  return (
    <svg className={`playoff-connectors ${highlighted ? 'is-highlighted' : ''}`} viewBox="0 0 600 520" preserveAspectRatio="none" aria-hidden="true" style={{ '--conf': accent, transform: mirrored ? 'scaleX(-1)' : undefined }}>
      <path d="M180 75 H195 V128 H210 M180 180 H195 V128 H210" />
      <path d="M180 340 H195 V393 H210 M180 445 H195 V393 H210" />
      <path d="M390 128 H405 V260 H420 M390 393 H405 V260 H420" />
      <path d="M590 260 H600" />
    </svg>
  );
}

function ConferenceTree({ conf, bracket, mirrored, toilet, activeManager, onHover, onSelect }) {
  const accent = conf === 'NFC' ? 'var(--playoff-nfc)' : 'var(--playoff-afc)';
  const isHighlightedConference = activeManager?.startsWith(`${conf}:`);
  const positions = mirrored
    ? { opening: '420px', second: '210px', final: '0px' }
    : { opening: '0px', second: '210px', final: '420px' };
  const advanceWord = toilet ? 'Loser' : 'Winner';
  const stages = [
    ['opening', `${conf} Quarterfinals`, 'Week 15'],
    ['second', `${conf} Semifinals`, 'Week 16'],
    ['final', `${conf} Final`, 'Week 17'],
  ];

  return (
    <section className="playoff-conference-tree" style={{ '--conf': accent }}>
      <div className="playoff-conf-heading">
        <span className="playoff-conf-dot" />
        <span>{conf}</span>
        <span className="text-[var(--muted)] font-medium">{toilet ? 'Toilet Bowl Bracket' : 'Playoff Bracket'}</span>
      </div>
      <div className="playoff-stage-headings">
        {(mirrored ? [...stages].reverse() : stages).map(([key, title, week]) => (
          <div key={key}>
            <strong>{title}</strong>
            <span>{week}</span>
          </div>
        ))}
      </div>
      <div className="playoff-tree-canvas">
        <ConnectorLines mirrored={mirrored} accent={accent} highlighted={isHighlightedConference} />
        <div className="playoff-stage" style={{ left: positions.opening }}>
          <div className="absolute inset-x-0 top-[49px]">
            <ByeCard team={bracket.byes[0]} conf={conf} accent={accent} activeManager={activeManager} onHover={onHover} onSelect={onSelect} />
          </div>
          <div className="absolute inset-x-0 top-[130px]">
            <MatchupCard game={bracket.first[0]} conf={conf} accent={accent} activeManager={activeManager} onHover={onHover} onSelect={onSelect} />
          </div>
          <div className="absolute inset-x-0 top-[314px]">
            <ByeCard team={bracket.byes[1]} conf={conf} accent={accent} activeManager={activeManager} onHover={onHover} onSelect={onSelect} />
          </div>
          <div className="absolute inset-x-0 top-[395px]">
            <MatchupCard game={bracket.first[1]} conf={conf} accent={accent} activeManager={activeManager} onHover={onHover} onSelect={onSelect} />
          </div>
        </div>
        <div className="playoff-stage" style={{ left: positions.second }}>
          <div className="absolute inset-x-0 top-[78px]">
            <MatchupCard game={bracket.second[0]} conf={conf} accent={accent} activeManager={activeManager} onHover={onHover} onSelect={onSelect} placeholders={[`Seed ${bracket.byes[0]?.seed || '—'}`, `${advanceWord} ${bracket.first[0].teamA?.seed || '—'}/${bracket.first[0].teamB?.seed || '—'}`]} />
          </div>
          <div className="absolute inset-x-0 top-[343px]">
            <MatchupCard game={bracket.second[1]} conf={conf} accent={accent} activeManager={activeManager} onHover={onHover} onSelect={onSelect} placeholders={[`Seed ${bracket.byes[1]?.seed || '—'}`, `${advanceWord} ${bracket.first[1].teamA?.seed || '—'}/${bracket.first[1].teamB?.seed || '—'}`]} />
          </div>
        </div>
        <div className="playoff-stage" style={{ left: positions.final }}>
          <div className="absolute inset-x-0 top-[210px]">
            <MatchupCard game={bracket.final} conf={conf} accent={accent} activeManager={activeManager} onHover={onHover} onSelect={onSelect} placeholders={[`${advanceWord} semifinal`, `${advanceWord} semifinal`]} />
          </div>
        </div>
      </div>
    </section>
  );
}

function OverallChampion({ nfc, afc, toilet, currentWeek, activeManager, onHover, onSelect }) {
  const nfcTeam = nfc.champion;
  const afcTeam = afc.champion;
  const nfcScore = nfc.final.scores?.[nfcTeam?.manager];
  const afcScore = afc.final.scores?.[afcTeam?.manager];
  const resolved = currentWeek > 17 && nfcTeam && afcTeam && nfcScore !== afcScore;
  const champion = resolved
    ? (toilet ? (nfcScore < afcScore ? nfcTeam : afcTeam) : (nfcScore > afcScore ? nfcTeam : afcTeam))
    : null;

  return (
    <div className="playoff-overall-card">
      <div className="playoff-overall-icon">{toilet ? '🚽' : <Trophy className="w-6 h-6" />}</div>
      <span className="playoff-overall-kicker">Overall</span>
      <h3>{toilet ? 'Toilet Bowl Champion' : 'LENZONE Champion'}</h3>
      <div className="w-full space-y-2 mt-3">
        <TeamRow team={nfcTeam} score={nfcScore} placeholder="NFC Champion" conf="NFC" activeManager={activeManager} onHover={onHover} onSelect={onSelect} winner={champion?.manager === nfcTeam?.manager} />
        <TeamRow team={afcTeam} score={afcScore} placeholder="AFC Champion" conf="AFC" activeManager={activeManager} onHover={onHover} onSelect={onSelect} winner={champion?.manager === afcTeam?.manager} />
      </div>
      <p>{toilet ? 'Lower Week 17 score takes the throne.' : 'Higher Week 17 score wins it all.'}</p>
    </div>
  );
}

function setupText(conf, bracket, toilet) {
  const label = team => team ? `#${team.seed} ${team.manager}` : 'TBD';
  if (toilet) {
    return `${conf} TOILET BOWL\nByes: ${label(bracket.byes[0])}, ${label(bracket.byes[1])}\n${label(bracket.first[0].teamA)} vs ${label(bracket.first[0].teamB)}\n${label(bracket.first[1].teamA)} vs ${label(bracket.first[1].teamB)}`;
  }
  return `${conf} PLAYOFFS\nByes: ${label(bracket.byes[0])}, ${label(bracket.byes[1])}\n${label(bracket.first[0].teamA)} vs ${label(bracket.first[0].teamB)}\n${label(bracket.first[1].teamA)} vs ${label(bracket.first[1].teamB)}`;
}

function BracketSection({ toilet, afc, nfc, currentWeek, activeManager, onHover, onSelect, copied, onCopy }) {
  const exportRef = useRef(null);
  const imageExport = useElementPngExport(exportRef, toilet ? 'lenzone-toilet-bowl' : 'lenzone-playoff-bracket', { minWidth: 1550 });

  return (
    <section ref={exportRef} className="space-y-5">
      <div className="playoff-hero">
        <div>
          <div className="flex items-center gap-2 text-[var(--accent)] text-xs font-black uppercase tracking-[0.2em] mb-2">
            <Sparkles className="w-4 h-4" /> {toilet ? 'Consolation bracket' : 'LENZONE postseason'}
          </div>
          <h1>{toilet ? 'Toilet Bowl' : 'Playoff Bracket'}</h1>
          <p>{toilet ? 'Seeds 7–12 · same format as the winners bracket, but the lower score advances.' : 'Six teams per conference · seeds 1–2 earn a first-round bye.'}</p>
        </div>
        <div className="playoff-actions" data-export-ignore="true">
          <ExportControls
            theme={imageExport.exportTheme}
            onThemeChange={imageExport.setExportTheme}
            onCopy={imageExport.copyPng}
            onDownload={imageExport.downloadPng}
            exporting={imageExport.exporting}
            copyState={imageExport.copyState}
            downloadState={imageExport.downloadState}
          />
          <button type="button" className="playoff-copy-button" onClick={onCopy}>
            {copied ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy Sleeper setup'}
          </button>
        </div>
      </div>

      <div className="playoff-board-shell">
        <div className="playoff-board-scroll">
          <div className="playoff-board">
            <ConferenceTree conf="NFC" bracket={nfc} toilet={toilet} activeManager={activeManager} onHover={onHover} onSelect={onSelect} />
            <OverallChampion nfc={nfc} afc={afc} toilet={toilet} currentWeek={currentWeek} activeManager={activeManager} onHover={onHover} onSelect={onSelect} />
            <ConferenceTree conf="AFC" bracket={afc} mirrored toilet={toilet} activeManager={activeManager} onHover={onHover} onSelect={onSelect} />
          </div>
        </div>
      </div>

      <div className="playoff-footnote">
        <Crown className="w-4 h-4" />
        <span>{toilet ? 'The lowest scorer advances each round. The lower-scoring conference survivor in Week 17 becomes the overall Toilet Bowl champion.' : 'Conference champions are decided in Week 17. Their same Week 17 totals decide the overall LENZONE champion—no extra matchup.'}</span>
      </div>
    </section>
  );
}

export default function PlayoffsTab({ afcStandings, nfcStandings, afcPostseason, nfcPostseason, currentWeek, latestCompletedWeek }) {
  const [hoveredManager, setHoveredManager] = useState(null);
  const [selectedManager, setSelectedManager] = useState(null);
  const [copiedSection, setCopiedSection] = useState(null);
  const activeManager = hoveredManager || selectedManager;
  const winnersAfc = useMemo(() => buildConferenceBracket(afcStandings, afcPostseason, currentWeek, false), [afcStandings, afcPostseason, currentWeek]);
  const winnersNfc = useMemo(() => buildConferenceBracket(nfcStandings, nfcPostseason, currentWeek, false), [nfcStandings, nfcPostseason, currentWeek]);
  const toiletAfc = useMemo(() => buildConferenceBracket(afcStandings, afcPostseason, currentWeek, true), [afcStandings, afcPostseason, currentWeek]);
  const toiletNfc = useMemo(() => buildConferenceBracket(nfcStandings, nfcPostseason, currentWeek, true), [nfcStandings, nfcPostseason, currentWeek]);
  const seedsLocked = latestCompletedWeek >= 14;

  const selectManager = manager => setSelectedManager(current => current === manager ? null : manager);
  const copySetup = async (toilet, afc, nfc) => {
    const section = toilet ? 'toilet' : 'winners';
    const text = [
      `LENZONE 2026 ${toilet ? 'TOILET BOWL' : 'PLAYOFF'} SETUP`,
      seedsLocked ? 'Official seeds after Week 14' : `Projected seeds after Week ${latestCompletedWeek}`,
      '',
      setupText('NFC', nfc, toilet),
      '',
      setupText('AFC', afc, toilet),
      '',
      toilet ? 'Lower score advances.' : 'Higher score advances.'
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setCopiedSection(section);
    window.setTimeout(() => setCopiedSection(null), 1800);
  };

  return (
    <div className="space-y-10 animate-fade-in">
      <BracketSection
        afc={winnersAfc} nfc={winnersNfc} currentWeek={currentWeek}
        activeManager={activeManager} onHover={setHoveredManager} onSelect={selectManager}
        copied={copiedSection === 'winners'} onCopy={() => copySetup(false, winnersAfc, winnersNfc)}
      />

      <div className={`playoff-status-banner ${seedsLocked ? 'is-locked' : ''}`}>
        <span className="playoff-status-dot" />
        <strong>{seedsLocked ? 'Official seeds' : 'Projected brackets'}</strong>
        <span>{seedsLocked ? 'Week 14 is complete. Use either “Copy Sleeper setup” button to enter the pairings.' : `Both brackets use completed results through Week ${latestCompletedWeek}. Seeds lock after Week 14.`}</span>
        {selectedManager && (
          <button type="button" onClick={() => setSelectedManager(null)}><RotateCcw className="w-3.5 h-3.5" /> Clear highlight</button>
        )}
      </div>

      <BracketSection
        toilet afc={toiletAfc} nfc={toiletNfc} currentWeek={currentWeek}
        activeManager={activeManager} onHover={setHoveredManager} onSelect={selectManager}
        copied={copiedSection === 'toilet'} onCopy={() => copySetup(true, toiletAfc, toiletNfc)}
      />
    </div>
  );
}

export { PLAYOFF_WEEKS };
