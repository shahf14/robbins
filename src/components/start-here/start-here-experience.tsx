'use client';

import {useState} from 'react';
import {useLocale} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {enContent, heContent, type StartMode} from '@/lib/start-here/content';
import {StartHereAccordions} from './start-here-accordions';
import {StartHereFeatureMap} from './start-here-feature-map';
import {StartHereHero} from './start-here-hero';
import {StartHereMastery} from './start-here-mastery';
import {StartHereModePanel} from './start-here-mode-panel';
import {StartHereRhythm} from './start-here-rhythm';
import {StartHereSectionNav} from './start-here-section-nav';

export function StartHereExperience() {
  const locale = useLocale();
  const content = locale === 'he' ? heContent : enContent;
  const [mode, setMode] = useState<StartMode>('new');
  const activeMode = content.modes[mode];

  return (
    <main className="pb-12">
      <section className="page-shell py-5 sm:py-6">
        <div className="hero-surface px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <StartHereHero content={content} />
            <StartHereModePanel content={content} mode={mode} onModeChange={setMode} />
          </div>
        </div>
      </section>

      <StartHereSectionNav content={content} />

      <StartHereRhythm content={content} />
      <StartHereFeatureMap content={content} />
      <StartHereAccordions content={content} />
      <StartHereMastery content={content} />

      <section className="page-shell pt-4 pb-12">
        <div className="rounded-[28px] border border-[var(--blue)]/25 bg-[linear-gradient(135deg,rgba(26,109,255,0.16),rgba(232,87,42,0.08),rgba(255,255,255,0.03))] px-6 py-8 text-center sm:px-8">
          <h2 className="text-3xl font-black">{content.finalTitle}</h2>
          <p className="mx-auto mt-3 max-w-3xl leading-8 txt-soft">{content.finalBody}</p>
          <Link href={activeMode.href} className="focus-ring btn-primary mt-6">
            {content.finalCta}
          </Link>
        </div>
      </section>
    </main>
  );
}
