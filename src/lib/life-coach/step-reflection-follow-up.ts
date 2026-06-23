import type {AppLocale} from '@/i18n/config';
import {todayYMD} from '@/lib/date-utils';
import {lifeCoachApi} from '@/lib/life-coach/api-client';

export type StepReflectionDetail = {
  reflection_text?: string;
  blocker_reason?: string | null;
  writing_duration_sec?: number | null;
  reflection_word_count?: number | null;
  self_blame_language?: boolean;
};

export function shouldRunReflectionFollowUp(detail?: StepReflectionDetail | null): boolean {
  return Boolean(detail?.reflection_text || detail?.blocker_reason);
}

/** Best-effort reflection save + AI analysis. Never throws; reports failures via onError. */
export function runStepReflectionFollowUp(
  locale: AppLocale,
  detail: StepReflectionDetail,
  options?: {date?: string; onError?: (error: unknown) => void}
): void {
  const date = options?.date ?? todayYMD();
  void (async () => {
    try {
      await lifeCoachApi.saveReflection({
        date,
        mood_score: null,
        energy_score: null,
        reflection_text: detail.reflection_text || '',
        blocker_reason: detail.blocker_reason ?? null,
        writing_duration_sec: detail.writing_duration_sec ?? null,
        reflection_word_count: detail.reflection_word_count ?? null,
        self_blame_language: detail.self_blame_language ?? false,
      });
      await lifeCoachApi.analyzeReflection({
        locale,
        date,
        reflection_text: detail.reflection_text || '',
        blocker_reason: detail.blocker_reason ?? null,
      });
    } catch (error) {
      options?.onError?.(error);
    }
  })();
}
