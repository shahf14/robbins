import type {PersonalDifficultyCalibration} from '@/lib/life-coach/personal-difficulty-calibration';
import type {StepValueFeedbackSummary} from './summarize';

/** Tune generation from real value feedback — not just completed/skipped. */
export function applyStepValueFeedbackToCalibration(
  calibration: PersonalDifficultyCalibration,
  summary: StepValueFeedbackSummary | null | undefined
): PersonalDifficultyCalibration {
  if (!summary?.dominant_issue || summary.dominant_issue === 'felt_progress') {
    return calibration;
  }

  if (summary.dominant_issue === 'too_small' && summary.too_small >= 2) {
    return {
      ...calibration,
      target_minutes: Math.min(20, calibration.target_minutes + 3),
      max_minutes: Math.min(20, calibration.max_minutes + 2),
      ramp_mode: calibration.ramp_mode === 'reduce' ? 'hold' : 'raise',
    };
  }

  if (summary.dominant_issue === 'too_generic' && summary.too_generic >= 2) {
    return {
      ...calibration,
      target_minutes: Math.max(8, calibration.target_minutes),
      max_minutes: Math.max(calibration.max_minutes, 15),
    };
  }

  return calibration;
}
