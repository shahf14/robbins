import {ensureCommitmentDailySteps, listGoals} from '@/lib/life-coach/repository';

/** Backfills missing commitment-window steps for all active goals. */
export async function ensureAllActiveCommitmentSteps(userId: string): Promise<void> {
  const goals = await listGoals({userId, status: 'active'});
  for (const goal of goals) {
    await ensureCommitmentDailySteps(userId, goal);
  }
}
