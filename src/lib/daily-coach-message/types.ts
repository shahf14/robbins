export type EnergyTrend = 'up' | 'down' | 'flat';

export type YesterdayStatus = 'strong' | 'mixed' | 'missed' | 'none';

export type BlockerRiskLevel = 'low' | 'medium' | 'high';

export type DailyCoachMessageInputs = {
  date: string;
  energy_trend: EnergyTrend;
  latest_energy: number | null;
  yesterday_energy: number | null;
  yesterday_status: YesterdayStatus;
  today_step_count: number;
  pending_today: number;
  blocker_risk: BlockerRiskLevel;
  blocker_risk_score: number;
  primary_step_id: string | null;
  primary_step_minutes: number | null;
};

export type DailyCoachMessage = {
  sentence: string;
  action_framing: string;
  text: string;
  primary_step_id: string | null;
  coach_tone: import('@/lib/user-preferences').CoachingStyle;
  inputs: DailyCoachMessageInputs;
};
