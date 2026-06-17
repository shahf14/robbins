'use client';

import {useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';

type Variant = 'goal' | 'dailySteps';

type Props = {
  variant?: Variant;
};

/**
 * Animated multi-stage progress shown while the AI works, so long waits feel
 * guided instead of a frozen "generating..." label.
 */
export function AiGeneratingProgress({variant = 'goal'}: Props) {
  const t = useTranslations('aiGenerating');
  const stages = useMemo(
    () =>
      variant === 'dailySteps'
        ? [t('dailySteps.stage1'), t('dailySteps.stage2'), t('dailySteps.stage3'), t('dailySteps.stage4')]
        : [t('stage1'), t('stage2'), t('stage3'), t('stage4')],
    [t, variant]
  );
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, stages.length - 1));
    }, variant === 'dailySteps' ? 3500 : 4500);
    return () => window.clearInterval(id);
  }, [stages.length, variant]);

  const percent = Math.round(((stageIndex + 1) / stages.length) * 100);

  return (
    <div className="rounded-2xl border border-[var(--blue)]/20 bg-[rgba(26,109,255,0.06)] p-5" role="status">
      <div className="flex items-center gap-3">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--color-border-strong)] border-t-[var(--blue)]" aria-hidden="true" />
        <p className="text-sm font-bold txt-strong">{stages[stageIndex]}</p>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full fill-3"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={stages[stageIndex]}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--blue)] to-blue-400 transition-all duration-700 ease-out"
          style={{width: `${percent}%`}}
        />
      </div>
      <div className="mt-3 grid gap-1.5">
        {stages.map((stage, i) => (
          <div key={stage} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                i < stageIndex
                  ? 'bg-green-500/20 text-green-400'
                  : i === stageIndex
                    ? 'bg-[var(--blue)] text-white'
                    : 'fill-3 txt-muted'
              }`}
            >
              {i + 1}
            </span>
            <span className={i <= stageIndex ? 'txt-strong' : 'txt-faint'}>{stage}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
