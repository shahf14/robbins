'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {useFeatureUnlock} from '@/hooks/use-feature-unlock';
import {daysSinceOnboarding, isOnboardingComplete} from '@/lib/onboarding-state';

/**
 * Shows an inline progress strip on the Life Coach home page.
 * Tells the user which features unlock next and when.
 */
export function FeatureUnlockBanner() {
  const t       = useTranslations();
  const map     = useFeatureUnlock();
  const [days, setDays] = useState(() => daysSinceOnboarding());
  const [done, setDone] = useState(() => isOnboardingComplete());

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDone(isOnboardingComplete());
      setDays(daysSinceOnboarding());
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Nothing to show if user hasn't done onboarding or all features are unlocked
  if (!done) return null;
  const nextLocked = Object.entries(map)
    .filter(([, v]) => !v.unlocked)
    .sort(([, a], [, b]) => a.unlocksOnDay - b.unlocksOnDay)[0];

  if (!nextLocked) return null;

  const [key, info] = nextLocked;
  const daysLeft    = Math.max(0, info.unlocksOnDay - days);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--blue)]/20 bg-[var(--blue)]/6 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]">
          {t('featureUnlock.hint')}
        </p>
        <p className="mt-0.5 text-sm font-semibold txt-strong">
          {t(`featureUnlock.${key}`)}
          {' — '}
          {daysLeft === 1
            ? t('featureUnlock.unlocksInOneDay')
            : t('featureUnlock.unlocksInDays', {days: daysLeft})}
        </p>
      </div>
      {/* Progress dots */}
      <div className="flex items-center gap-1.5">
        {[0, 3, 7, 14].map((threshold) => (
          <span
            key={threshold}
            className={`h-2 w-2 rounded-full transition-colors ${
              days >= threshold ? 'bg-[var(--blue)]' : 'fill-3'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
