'use client';

import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {clampStepReasoning, stripReasoningPrefix} from '@/lib/life-coach/step-reasoning';

type StepExplainabilityProps = {
  reasoning: string | null | undefined;
  className?: string;
};

/** User-facing "למה קיבלתי את זה?" — always shown with reasoning or generic fallback. */
export function StepExplainability({reasoning, className = ''}: StepExplainabilityProps) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const raw = clampStepReasoning(reasoning);
  const stripped = raw ? stripReasoningPrefix(raw, locale) : '';
  const body =
    stripped.length >= 4
      ? stripped
      : raw && raw.length >= 4
        ? raw
        : t('lifeCoach.stepWhyReceivedFallback');

  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/3 px-3 py-2.5 ${className}`.trim()}
      role="note"
    >
      <p className="text-xs font-semibold text-white/55">{t('lifeCoach.stepWhyReceivedTitle')}</p>
      <p className="mt-1 text-xs leading-5 text-white/70">{body}</p>
    </div>
  );
}
