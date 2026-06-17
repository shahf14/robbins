'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import type {AiCoachingInsight, DailyBabyStep, LifeDomain} from '@/lib/life-coach/types';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import {todayYMD} from '@/lib/date-utils';
import {AIInsightCard} from '../ai-insight-card';
import {AiActionHelpMicrocopy} from '@/components/feedback/ai-action-help-microcopy';
import {EnhancedWeeklyReview} from './enhanced-weekly-review';

type Props = {
  domain: LifeDomain;
  locale: AppLocale;
  insights: AiCoachingInsight[];
  weeklyReview: AiCoachingInsight | null;
  allRecentSteps: DailyBabyStep[];
  onRefresh: () => Promise<void>;
};

export function DomainInsightsTabContent({
  domain,
  locale,
  insights,
  weeklyReview,
  allRecentSteps,
  onRefresh,
}: Props) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-6">
      <p className="text-sm leading-7 txt-muted">{t('lifeCoach.domainTabs.insightsIntro')}</p>

      <EnhancedWeeklyReview
        domain={domain}
        insight={weeklyReview}
        allRecentSteps={allRecentSteps}
        onGenerateReview={async () => {
          await lifeCoachApi.generateWeeklyReview({locale});
          await onRefresh();
        }}
      />

      <section className="panel-surface p-6" aria-label={t('lifeCoach.aiInsights')}>
        <h2 className="text-lg font-bold txt-strong">{t('lifeCoach.patternsAndAdjustments')}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2" aria-live="polite">
          {insights.length > 0 ? (
            insights.map((insight) => <AIInsightCard key={insight.id} insight={insight} />)
          ) : (
            <div className="col-span-2 flex flex-col gap-4 rounded-2xl border border-dashed border-[color:var(--color-border)] fill-1 p-5">
              <p className="text-sm leading-7 text-[var(--muted)]">{t('lifeCoach.insightsEmptyDomain')}</p>
              <button
                type="button"
                className="focus-ring btn-small self-start"
                disabled={busy}
                aria-busy={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const date = todayYMD();
                    await lifeCoachApi.analyzeReflection({
                      locale,
                      date,
                      domain,
                      reflection_text: '',
                      blocker_reason: null,
                    });
                    await onRefresh();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? t('lifeCoach.generatingInsight') : t('lifeCoach.generateInitialInsight')}
              </button>
              <AiActionHelpMicrocopy kind="insight" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
