'use client';

import {useEffect} from 'react';
import {markFeatureSeen, type DiscoverableFeature} from '@/lib/feature-discovery';

/** Mark a feature as discovered when the user opens its screen. */
export function useFeatureVisit(feature: DiscoverableFeature) {
  useEffect(() => {
    markFeatureSeen(feature);
  }, [feature]);
}
