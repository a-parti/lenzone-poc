import React, { useRef, useState } from 'react';
import { Check, Crown, Gift, Medal, Minus, Plus, Presentation, Shirt, Trophy, Utensils, Wine } from 'lucide-react';
import { HIGH_SCORE_PRIZES } from '../lib/highScorePrizes';
import ExportControls from './ExportControls';
import useElementPngExport from '../hooks/useElementPngExport';

const WEEKLY_PRIZE = 15;
const WEEKLY_PRIZE_WEEKS = 14;
const BASE_OVERALL_PRIZE = 150;

const TOILET_CHOICES = [
  {
    id: 'costume',
    title: 'Costume Day',
    icon: Shirt
  },
  {
    id: 'lunch',
    title: 'Lunch Service',
    icon: Utensils
  },
  {
    id: 'presentation',
    title: 'The Presentation',
    icon: Presentation
  }
];

function PrizeCard({ icon: Icon, eyebrow, title, amount, accent }) {
  return (
    <article className="prize-card" style={{ '--prize-accent': accent }}>
      <div className="prize-icon"><Icon className="w-5 h-5" /></div>
      <span className="prize-eyebrow">{eyebrow}</span>
      <div className="prize-card-heading">
        <h2>{title}</h2>
        {amount && <strong>{amount}</strong>}
      </div>
    </article>
  );
}

export default function PrizesTab() {
  const exportRef = useRef(null);
  const imageExport = useElementPngExport(exportRef, 'lenzone-prizes', { minWidth: 1100 });
  const knownWineChoices = Object.values(HIGH_SCORE_PRIZES).filter(prize => prize.choice === 'wine').length;
  const [wineWeeks, setWineWeeks] = useState(knownWineChoices);
  const [toiletPicks, setToiletPicks] = useState([]);
  const overallPrize = BASE_OVERALL_PRIZE + wineWeeks * WEEKLY_PRIZE;
  const weeklyCash = (WEEKLY_PRIZE_WEEKS - wineWeeks) * WEEKLY_PRIZE;

  const toggleToiletPick = id => {
    setToiletPicks(current => {
      if (current.includes(id)) return current.filter(choice => choice !== id);
      if (current.length < 2) return [...current, id];
      return [current[1], id];
    });
  };

  return (
    <div ref={exportRef} data-mode={imageExport.exportTheme} data-scheme={imageExport.scheme} className="space-y-7 animate-fade-in">
      <header className="prizes-hero">
        <div>
          <div className="prizes-kicker"><Gift className="w-4 h-4" /> LENZONE prize cabinet</div>
          <h1>Prizes & Consequences</h1>
        </div>
        <div className="prizes-hero-actions">
          <div data-export-ignore="true">
            <ExportControls
              theme={imageExport.exportTheme}
              onThemeChange={imageExport.setExportTheme}
              onCopy={imageExport.copyPng}
              onDownload={imageExport.downloadPng}
              exporting={imageExport.exporting}
              copyState={imageExport.copyState}
              downloadState={imageExport.downloadState}
            />
          </div>
          <div className="prizes-total">
            <span>Base season budget</span>
            <strong>$1,200</strong>
          </div>
        </div>
      </header>

      <section>
        <div className="prizes-section-heading">
          <div>
            <span>Championship payouts</span>
            <h2>The money side</h2>
          </div>
          <Trophy className="w-6 h-6 text-[var(--accent)]" />
        </div>
        <div className="prize-card-grid">
          <PrizeCard icon={Medal} eyebrow="NFC" title="Champion $300 · Runner-up $100" accent="var(--playoff-nfc)" />
          <PrizeCard icon={Medal} eyebrow="AFC" title="Champion $300 · Runner-up $100" accent="var(--playoff-afc)" />
          <PrizeCard icon={Crown} eyebrow={`Overall · $${BASE_OVERALL_PRIZE} + $${WEEKLY_PRIZE} per wine`} title="LENZONE Champion" amount={`$${overallPrize}`} accent="color-mix(in srgb, var(--accent) 62%, var(--text))" />
          <PrizeCard icon={Trophy} eyebrow="Hardware" title="Trophy Budget" amount="$40" accent="var(--live)" />
        </div>
      </section>

      <section className="wine-calculator">
        <div className="wine-calculator-copy">
          <div className="prizes-section-heading compact">
            <div>
              <span>Weekly high score</span>
              <h2>$15 or wine · 14 weeks</h2>
            </div>
            <Wine className="w-6 h-6" />
          </div>
        </div>
        <div className="wine-stepper" aria-label="Wine choices calculator">
          <button type="button" onClick={() => setWineWeeks(value => Math.max(knownWineChoices, value - 1))} disabled={wineWeeks === knownWineChoices} aria-label="Remove one preview wine choice"><Minus className="w-4 h-4" /></button>
          <div>
            <strong>{wineWeeks}</strong>
            <span>wine choice{wineWeeks === 1 ? '' : 's'}</span>
          </div>
          <button type="button" onClick={() => setWineWeeks(value => Math.min(WEEKLY_PRIZE_WEEKS, value + 1))} disabled={wineWeeks === WEEKLY_PRIZE_WEEKS} aria-label="Add one wine choice"><Plus className="w-4 h-4" /></button>
        </div>
        <div className="wine-results">
          <div><span>Weekly cash paid</span><strong>${weeklyCash}</strong></div>
          <div><span>Overall champion</span><strong>${overallPrize}</strong></div>
        </div>
      </section>

      <section className="toilet-prizes">
        <div className="prizes-section-heading">
          <div>
            <span>Toilet Bowl “champion”</span>
            <h2>Pick two consequences</h2>
          </div>
          <span className="toilet-emoji" aria-hidden="true">🚽</span>
        </div>
        <div className="toilet-choice-grid">
          {TOILET_CHOICES.map(({ id, title, icon: Icon }) => {
            const selected = toiletPicks.includes(id);
            return (
              <button key={id} type="button" onClick={() => toggleToiletPick(id)} className={`toilet-choice ${selected ? 'is-selected' : ''}`}>
                <span className="toilet-choice-icon">{selected ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}</span>
                <span>
                  <strong>{title}</strong>
                </span>
              </button>
            );
          })}
        </div>
        <div className="toilet-pick-status">
          {toiletPicks.length < 2 ? `Choose ${2 - toiletPicks.length} more` : 'Two consequences selected'}
        </div>
      </section>
    </div>
  );
}
