'use client';

import {useEffect, useState} from 'react';
import {daysSinceOnboarding, isOnboardingComplete} from '@/lib/onboarding-state';

type FeatureKey =
  | 'life_coach'
  | 'morning_ritual'
  | 'multi_domain'
  | 'formulation';

type UnlockMap = Record<FeatureKey, {unlocked: boolean; unlocksOnDay: number}>;

const UNLOCK_SCHEDULE: Record<FeatureKey, number> = {
  life_coach:     0,
  morning_ritual: 0,
  multi_domain:   7,
  formulation:    14,
};

function buildMap(days: number, onboardingDone: boolean): UnlockMap {
  const entries = Object.entries(UNLOCK_SCHEDULE) as [FeatureKey, number][];
  return Object.fromEntries(
    entries.map(([key, day]) => [
      key,
      {
        unlocked: !onboardingDone ? key === 'morning_ritual' : days >= day,
        unlocksOnDay: day,
      },
    ])
  ) as UnlockMap;
}

function getCurrentUnlockMap() {
  return buildMap(daysSinceOnboarding(), isOnboardingComplete());
}

export function useFeatureUnlock() {
  const [map, setMap] = useState<UnlockMap>(() => getCurrentUnlockMap());

  useEffect(() => {
    const id = window.setTimeout(() => setMap(getCurrentUnlockMap()), 0);
    return () => window.clearTimeout(id);
  }, []);

  return map;
}
