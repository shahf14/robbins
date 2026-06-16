import type {HealthWizardContextInput} from '@/lib/ai-life-coach/health-goal-fallback';
import type {
  HealthCategory,
  HealthGoalWizardData,
  HealthSecondaryFocus,
  WeightDirection,
} from '@/lib/life-coach/types';

const KG_PATTERN = /(\d{2,3}(?:[.,]\d)?)\s*(?:ק"?ג|kg)/i;

function parseKgFromText(text: string): number | undefined {
  const match = text.match(KG_PATTERN);
  if (!match) return undefined;
  return Number(match[1].replace(',', '.'));
}

export function inferWeightDirection(
  category: HealthCategory,
  baseline: number,
  target: number,
  explicit?: WeightDirection
): WeightDirection | undefined {
  if (explicit) return explicit;
  if (category === 'weight') {
    if (target > baseline) return 'gain';
    if (target < baseline) return 'loss';
    return 'maintain';
  }
  return undefined;
}

export function inferSecondaryFocus(
  category: HealthCategory,
  milestone30: string,
  milestone60: string,
  milestone90: string,
  weightDirection?: WeightDirection,
  currentKg?: number,
  targetKg?: number
): HealthSecondaryFocus | undefined {
  if (category === 'weight') {
    if (weightDirection === 'gain' || (targetKg && currentKg && targetKg > currentKg)) {
      return 'weight_gain';
    }
    if (weightDirection === 'loss') return 'weight_loss';
  }

  if (category !== 'nutrition') return undefined;

  const texts = [milestone30, milestone60, milestone90].join(' ');
  if (!KG_PATTERN.test(texts)) return undefined;

  const m30 = parseKgFromText(milestone30);
  const m90 = parseKgFromText(milestone90) ?? parseKgFromText(milestone60);
  if (m30 && m90 && m90 > m30) return 'weight_gain';
  if (m30 && m90 && m90 < m30) return 'weight_loss';
  if (weightDirection === 'gain') return 'weight_gain';

  return 'weight_gain';
}

export function wizardDataToContextInput(data: HealthGoalWizardData): HealthWizardContextInput {
  const weight_direction = inferWeightDirection(
    data.category,
    data.metrics.baseline_value,
    data.metrics.target_value,
    data.weight_direction
  );

  const secondary_focus =
    data.secondary_focus ??
    inferSecondaryFocus(
      data.category,
      data.timeline.days_30,
      data.timeline.days_60,
      data.timeline.days_90,
      weight_direction,
      data.current_kg,
      data.target_kg
    );

  return {
    category: data.category,
    metrics: data.metrics,
    weight_direction,
    secondary_focus,
    current_kg: data.current_kg,
    target_kg: data.target_kg,
    timeline: data.timeline,
    why_deep: data.why_deep,
    anchor: data.anchor_habit
      ? {
          habit_key: data.anchor_habit,
          time: data.anchor_time,
          custom_label: data.anchor_custom_label,
        }
      : undefined,
  };
}
