'use client';

import {useTranslations} from 'next-intl';
import type {AiCoachingInsight} from '@/lib/life-coach/types';
import type {ReflectionAnalysis} from '@/lib/reflection-analysis/types';
import {NextBestActionCta} from '@/components/next-best-action/next-best-action-cta';

export function AIInsightCard({insight}: {insight: AiCoachingInsight}) {
  const t = useTranslations();
  const metadata = insight.metadata as ReflectionAnalysis | null;
  const nextAction = metadata?.next_best_action ?? null;

  return (
    <article className="panel-surface p-5" aria-label={t(`lifeCoach.insightType.${insight.insight_type}`)}>
      <p className="field-label mb-0 text-[var(--blue)]" aria-hidden="true">{t(`lifeCoach.insightType.${insight.insight_type}`)}</p>
      <p className="mt-3 whitespace-pre-line text-sm leading-7 txt-strong">{insight.content}</p>
      <p className="mt-3 text-xs txt-muted">{t('lifeCoach.aiGeneratedNote')}</p>
      {nextAction ? (
        <div className="mt-4">
          <NextBestActionCta action={nextAction} />
        </div>
      ) : null}
    </article>
  );
}
