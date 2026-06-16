'use client';

import {useState, type ReactNode} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import type {AffirmationItem, MorningRitualSession} from '@/lib/morning-ritual-types';
import {MoodPicker} from '@/components/morning-ritual/morning-ritual-shell';

export function CompletionScreen({
  session,
  gratitudeEntries,
  identityText,
  missionText,
  affirmation,
  onMoodAfter,
}: {
  session: MorningRitualSession;
  gratitudeEntries: string[];
  identityText: string;
  missionText: string;
  affirmation: AffirmationItem | null;
  onMoodAfter?: (score: number) => void;
}) {
  const t = useTranslations('morningRitual');
  const locale = useLocale() as AppLocale;
  const [moodAfter, setMoodAfter] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-[var(--blue)] text-3xl text-white">
        &#10003;
      </div>
      <h1 className="mt-6 text-4xl font-black">{t('complete.title')}</h1>

      <div className="mt-6 panel-surface p-5 text-start">
        <MoodPicker
          value={moodAfter}
          onChange={(score) => {
            setMoodAfter(score);
            onMoodAfter?.(score);
          }}
          label={t('complete.moodAfterLabel')}
        />
      </div>

      <div className="mt-6 grid gap-4 text-start">
        {gratitudeEntries.length > 0 && (
          <SummaryCard label={t('complete.gratitude')}>
            <ul className="mt-2 grid gap-1">
              {gratitudeEntries.map((entry) => (
                <li key={entry} className="text-[var(--muted)]">{entry}</li>
              ))}
            </ul>
          </SummaryCard>
        )}

        {identityText && (
          <SummaryCard label={t('complete.identity')}>
            <p className="mt-2 font-bold">{identityText}</p>
          </SummaryCard>
        )}

        {missionText && (
          <SummaryCard label={t('complete.mission')}>
            <p className="mt-2 font-bold">{missionText}</p>
            {session.missionTimeBlock && (
              <p className="mt-1 text-sm text-[var(--muted)]">
                {t(`mission.${session.missionTimeBlock}`)}
              </p>
            )}
          </SummaryCard>
        )}

        {affirmation && (
          <SummaryCard label={t('complete.affirmation')}>
            <p className="mt-2 text-[var(--muted)]">{affirmation.textContent || affirmation.title}</p>
          </SummaryCard>
        )}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a
          href={`/${locale}`}
          className="focus-ring btn-primary"
        >
          {t('complete.goToDashboard')}
        </a>
      </div>
    </div>
  );
}

function SummaryCard({label, children}: {label: string; children: ReactNode}) {
  return (
    <div className="panel-surface p-5">
      <p className="field-label mb-0 text-[var(--accent)]">{label}</p>
      {children}
    </div>
  );
}
