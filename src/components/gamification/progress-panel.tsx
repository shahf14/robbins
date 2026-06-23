'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import type {GamificationUnlock} from '@/lib/db/repositories/gamification-unlocks';
import {LifeCoachPageShell} from '@/components/life-coach/life-coach-page-shell';

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {month: 'short', day: 'numeric', year: 'numeric'}).format(
      new Date(iso)
    );
  } catch {
    return iso.slice(0, 10);
  }
}

function groupByKindAndKey(unlocks: GamificationUnlock[]) {
  const byKind: Record<string, Map<string, {count: number; latest: string}>> = {
    identity_title: new Map(),
    mystery_unlock: new Map(),
    reflection_loot: new Map(),
  };

  for (const u of unlocks) {
    const map = byKind[u.kind];
    if (!map) continue;
    const existing = map.get(u.reward_key);
    if (existing) {
      existing.count += 1;
      if (u.created_at > existing.latest) existing.latest = u.created_at;
    } else {
      map.set(u.reward_key, {count: 1, latest: u.created_at});
    }
  }

  return byKind;
}

function ProgressPanelContent() {
  const t = useTranslations('gamification.progress');
  const tg = useTranslations('gamification');
  const [unlocks, setUnlocks] = useState<GamificationUnlock[] | null>(null);
  const [locale] = useState(() =>
    typeof document === 'undefined' ? 'en' : document.documentElement.lang || 'en'
  );

  useEffect(() => {
    lifeCoachApi
      .listGamificationUnlocks()
      .then((res) => setUnlocks(res.unlocks))
      .catch(() => setUnlocks([]));
  }, []);

  if (unlocks === null) {
    return <div className="py-10 text-center text-sm txt-muted">…</div>;
  }

  const grouped = groupByKindAndKey(unlocks);
  const titles = [...grouped.identity_title.entries()];
  const mysteryUnlocks = [...grouped.mystery_unlock.entries()];
  const loot = [...grouped.reflection_loot.entries()];

  if (unlocks.length === 0) {
    return (
      <div className="py-10 text-center text-sm txt-muted">{t('empty')}</div>
    );
  }

  return (
    <div className="grid gap-6">
      {titles.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-bold txt-strong">{t('sectionTitles')}</h2>
          <div className="flex flex-wrap gap-2">
            {titles.map(([key, info]) => (
              <span
                key={key}
                className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-black text-amber-200/90"
                title={formatDate(info.latest, locale)}
              >
                {tg(`identityTitles.${key}`)}
              </span>
            ))}
          </div>
        </section>
      )}

      {mysteryUnlocks.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-bold txt-strong">{t('sectionUnlocks')}</h2>
          <div className="flex flex-wrap gap-2">
            {mysteryUnlocks.map(([key, info]) => (
              <span
                key={key}
                className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1.5 text-xs font-semibold text-violet-200/90"
                title={formatDate(info.latest, locale)}
              >
                {t(`unlockKind.mystery_unlock.${key}`)}
                {info.count > 1 ? ` ${t('countSuffix', {count: info.count})}` : ''}
              </span>
            ))}
          </div>
        </section>
      )}

      {loot.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-sm font-bold txt-strong">{t('sectionLoot')}</h2>
          <div className="flex flex-wrap gap-2">
            {loot.map(([key, info]) => (
              <span
                key={key}
                className="rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1.5 text-xs font-semibold text-sky-200/90"
                title={formatDate(info.latest, locale)}
              >
                {tg(`reflectionLoot.${key}.title`)}
                {info.count > 1 ? ` ${t('countSuffix', {count: info.count})}` : ''}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function ProgressPanel() {
  const t = useTranslations('gamification.progress');

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-xl font-black txt-strong">{t('title')}</h1>
        <p className="text-sm txt-soft">{t('subtitle')}</p>
      </div>
      <LifeCoachPageShell>
        <ProgressPanelContent />
      </LifeCoachPageShell>
    </div>
  );
}
