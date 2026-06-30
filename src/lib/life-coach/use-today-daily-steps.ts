'use client';

import {useCallback, useEffect, useState} from 'react';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import type {DailyBabyStep} from '@/lib/life-coach/types';
import {todayYMD} from '@/lib/date-utils';
import {
  readTodayStepsSnapshot,
  subscribeTodayStepsSnapshot,
  writeTodayStepsSnapshot,
} from '@/lib/life-coach/today-steps-sync';

export function useTodayDailySteps() {
  const today = todayYMD();
  const [todaySteps, setTodaySteps] = useState<DailyBabyStep[]>(
    () => readTodayStepsSnapshot(today) ?? []
  );

  const refreshTodaySteps = useCallback(async () => {
    const response = await lifeCoachApi.getDailySteps(today);
    writeTodayStepsSnapshot(today, response.steps);
    setTodaySteps(response.steps);
    return response.steps;
  }, [today]);

  useEffect(() => {
    return subscribeTodayStepsSnapshot(() => {
      const cached = readTodayStepsSnapshot(today);
      if (cached) {
        setTodaySteps(cached);
      }
    });
  }, [today]);

  useEffect(() => {
    if (readTodayStepsSnapshot(today)) return;
    void refreshTodaySteps();
  }, [today, refreshTodaySteps]);

  return {todaySteps, refreshTodaySteps};
}
