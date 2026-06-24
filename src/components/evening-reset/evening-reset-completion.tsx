'use client';

import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';

export function CompletionScreen({
  t,
  biggestWin,
  tomorrowsWin,
  tomorrowTakeaway,
  gratitudeItems,
  preparedItems,
  readinessScore,
  streak,
}: {
  t: ReturnType<typeof useTranslations>;
  biggestWin: string;
  tomorrowsWin: string;
  tomorrowTakeaway: string;
  gratitudeItems: string[];
  preparedItems: string[];
  readinessScore: number;
  streak: number;
}) {
  const filledGratitude = gratitudeItems.filter((g) => g.trim());

  const scoreColor =
    readinessScore >= 80
      ? 'text-emerald-400'
      : readinessScore >= 50
        ? 'text-amber-400'
        : 'txt-soft';

  return (
    <div className="mx-auto max-w-xl space-y-8 py-8">
      <div className="text-center space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest txt-muted">
          {t('complete.eyebrow')}
        </p>
        <h1 className="text-3xl font-bold">{t('complete.title')}</h1>

        <div className="inline-flex flex-col items-center gap-1 rounded-2xl border border-[color:var(--color-border)] fill-2 px-8 py-4">
          <p className={`text-4xl font-bold ${scoreColor}`}>{readinessScore}/100</p>
          <p className="text-sm txt-muted">{t('complete.readinessLabel')}</p>
          <p className="max-w-xs text-center text-xs txt-muted">{t('complete.readinessHint')}</p>
        </div>
      </div>

      <div className="space-y-3">
        {biggestWin && (
          <SummaryCard label={t('complete.biggestWin')} value={biggestWin} />
        )}
        {tomorrowsWin && (
          <SummaryCard label={t('complete.tomorrowsWin')} value={tomorrowsWin} />
        )}
        {tomorrowTakeaway && (
          <SummaryCard label={t('complete.tomorrowTakeaway')} value={tomorrowTakeaway} />
        )}
        {filledGratitude.length > 0 && (
          <div className="rounded-xl border border-[color:var(--color-border)] fill-2 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest txt-muted">
              {t('complete.gratitude')}
            </p>
            {filledGratitude.map((g) => (
              <p key={g} className="text-sm txt-soft">
                • {g}
              </p>
            ))}
          </div>
        )}
        {preparedItems.length > 0 && (
          <div className="rounded-xl border border-[color:var(--color-border)] fill-2 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest txt-muted">
              {t('complete.prepared')}
            </p>
            {preparedItems.map((item) => (
              <p key={item} className="text-sm txt-soft">
                ✓ {item}
              </p>
            ))}
          </div>
        )}
      </div>

      {streak > 0 && (
        <p className="text-center text-sm txt-muted">
          {t('complete.streakMessage', {count: streak})}
        </p>
      )}

      <Link href="/" className="focus-ring btn-primary block w-full py-3 text-center">
        {t('complete.goToDashboard')}
      </Link>
    </div>
  );
}

function SummaryCard({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] fill-2 p-4 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-widest txt-muted">{label}</p>
      <p className="text-sm txt-strong">{value}</p>
    </div>
  );
}
