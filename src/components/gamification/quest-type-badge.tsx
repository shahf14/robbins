'use client';

import {useTranslations} from 'next-intl';
import type {QuestType} from '@/lib/gamification/quest-types';

const STYLES: Record<QuestType, string> = {
  focus: 'border-violet-400/30 bg-violet-500/10 text-violet-200',
  courage: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
  recovery: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  connection: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
};

export function QuestTypeBadge({type}: {type: QuestType}) {
  const t = useTranslations('gamification.questTypes');

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${STYLES[type]}`}
    >
      {t(type)}
    </span>
  );
}
