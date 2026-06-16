/**
 * Sanity check: "no time" user text → 3-10 minute initial steps.
 * Run: npx tsx scripts/verify-known-blockers.ts
 */
import {
  buildKnownBlockersProfile,
  enforceKnownBlockersOnGoalSteps,
} from '../src/lib/life-coach/known-blockers';
import type {StructuredDailyBabyStep} from '../src/lib/life-coach/types';

const profile = buildKnownBlockersProfile({
  assessment: {
    main_blockers: ['no_time'],
    available_time_per_day: 10,
    current_state: 'אין לי זמן בכלל',
    desired_state: 'להתקדם בכל זאת',
  },
  raw_goal: 'לרוץ מרתון',
  motivation: 'אין לי זמן לאמן',
  constraints: 'עבודה מלאה וילדים',
});

if (!profile.has_no_time_signal || profile.max_initial_step_minutes !== 10) {
  console.error('FAIL: no_time signal not detected', profile);
  process.exit(1);
}

const steps: Array<Omit<StructuredDailyBabyStep, 'domain' | 'goal_id'>> = [
  {
    title: 'Long run 45 minutes',
    description: 'Hard cardio block',
    estimated_minutes: 45,
    difficulty: 'hard',
  },
];

const enforced = enforceKnownBlockersOnGoalSteps(steps, profile)[0];
if (enforced.difficulty !== 'easy' || enforced.estimated_minutes < 3 || enforced.estimated_minutes > 10) {
  console.error('FAIL: time blocker did not cap step', enforced);
  process.exit(1);
}

console.log('OK: no-time profile caps first steps to 3-10 minutes easy');
