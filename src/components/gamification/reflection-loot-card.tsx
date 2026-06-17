'use client';

import {useTranslations} from 'next-intl';
import type {LootType} from '@/lib/gamification/reflection-loot';

const STYLES: Record<LootType, string> = {
  pattern: 'border-violet-400/25 bg-violet-500/8',
  tomorrowAdvantage: 'border-[var(--blue)]/25 bg-[var(--blue)]/8',
  energyClue: 'border-emerald-400/25 bg-emerald-500/8',
};

export function ReflectionLootCard({loot, onDismiss}: {loot: LootType; onDismiss: () => void}) {
  const t = useTranslations('gamification.reflectionLoot');

  return (
    <div className={`mb-3 rounded-[18px] border px-4 py-3 ${STYLES[loot]}`} aria-label={t(`${loot}.title`)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] txt-muted">
        {t('eyebrow')}
      </p>
      <p className="mt-1 text-sm font-black txt-strong">{t(`${loot}.title`)}</p>
      <p className="mt-1 text-xs leading-5 txt-soft">{t(`${loot}.body`)}</p>
      <button
        type="button"
        className="focus-ring mt-2 text-[10px] font-bold uppercase tracking-wide txt-faint hover:txt-soft"
        onClick={onDismiss}
      >
        {t('dismiss')}
      </button>
    </div>
  );
}
