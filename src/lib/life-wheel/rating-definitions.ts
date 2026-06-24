import type {LifeDomain} from '@/lib/life-coach/types';

const LIFE_WHEEL_BANDS = [
  {id: 'crisis', min: 1, max: 2},
  {id: 'struggling', min: 3, max: 4},
  {id: 'stable', min: 5, max: 6},
  {id: 'progressing', min: 7, max: 8},
  {id: 'thriving', min: 9, max: 10},
] as const;

type LifeWheelBandId = (typeof LIFE_WHEEL_BANDS)[number]['id'];

function clampLifeWheelScore(score: number): number {
  return Math.min(10, Math.max(1, Math.round(score)));
}

function scoreToLifeWheelBandId(score: number): LifeWheelBandId {
  const value = clampLifeWheelScore(score);
  const band = LIFE_WHEEL_BANDS.find((entry) => value >= entry.min && value <= entry.max);
  return band?.id ?? 'stable';
}

type LifeWheelRatingKeys = {
  score: number;
  bandId: LifeWheelBandId;
  bandLabelKey: `lifeWheel.bands.${LifeWheelBandId}`;
  descriptionKey: `lifeWheel.domains.${LifeDomain}.${LifeWheelBandId}`;
};

export function getLifeWheelRatingKeys(domain: LifeDomain, score: number): LifeWheelRatingKeys {
  const clamped = clampLifeWheelScore(score);
  const bandId = scoreToLifeWheelBandId(clamped);

  return {
    score: clamped,
    bandId,
    bandLabelKey: `lifeWheel.bands.${bandId}`,
    descriptionKey: `lifeWheel.domains.${domain}.${bandId}`,
  };
}
