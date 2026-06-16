export type LadderStage = 'day1' | 'week1' | 'month1';

export function deriveLadderStage(
  commitmentStartedAt: string,
  weeklyShowUps: number,
  commitmentDayNumber = 1
): LadderStage {
  void weeklyShowUps;
  if (commitmentDayNumber <= 1) return 'day1';
  if (commitmentDayNumber <= 7) return 'week1';
  return 'month1';
}

export function ladderTarget(stage: LadderStage): {labelKey: string; target: number} {
  switch (stage) {
    case 'day1':
      return {labelKey: 'commitmentLadder.day1', target: 1};
    case 'week1':
      return {labelKey: 'commitmentLadder.week1', target: 3};
    case 'month1':
      return {labelKey: 'commitmentLadder.month1', target: 12};
  }
}
