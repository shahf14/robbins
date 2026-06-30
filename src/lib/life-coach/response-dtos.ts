import type {
  AiCoachingInsight,
  DailyBabyStep,
  DailyReflection,
  FormulationSession,
  Goal,
  LifeDomainState,
  Milestone,
  UserProfile,
} from './types';

export type GoalResponse = Omit<Goal, 'user_id' | 'updated_at'>;
export type MilestoneResponse = Milestone;
export type GoalWithMilestonesResponse = GoalResponse & {milestones?: MilestoneResponse[]};
export type DailyBabyStepResponse = Omit<DailyBabyStep, 'user_id' | 'updated_at'>;
export type LifeDomainStateResponse = Omit<LifeDomainState, 'user_id' | 'created_at' | 'updated_at'>;
export type DailyReflectionResponse = Omit<DailyReflection, 'user_id'>;
export type AiCoachingInsightResponse = Omit<AiCoachingInsight, 'user_id'>;
export type FormulationSessionResponse = Omit<FormulationSession, 'user_id' | 'updated_at'>;

export type ParticipantProfileResponse = {
  gender: UserProfile['gender'];
  age: UserProfile['age'];
  life_context_statuses: UserProfile['life_context_statuses'];
  life_context_note: string | null;
  wake_time: string | null;
  sleep_time: string | null;
  preferred_action_window: UserProfile['preferred_action_window'];
};

export function toParticipantProfileResponse(profile: UserProfile): ParticipantProfileResponse {
  return {
    gender: profile.gender,
    age: profile.age,
    life_context_statuses: profile.life_context_statuses,
    life_context_note: profile.life_context_note ?? null,
    wake_time: profile.wake_time ?? null,
    sleep_time: profile.sleep_time ?? null,
    preferred_action_window: profile.preferred_action_window ?? null,
  };
}

export function toGoalResponse(goal: Goal): GoalResponse {
  const {user_id: _userId, updated_at: _updatedAt, ...rest} = goal;
  return rest;
}

export function toGoalsResponse(goals: Goal[]): GoalResponse[] {
  return goals.map(toGoalResponse);
}

export function toGoalWithMilestonesResponse(
  goal: Goal,
  milestones?: Milestone[]
): GoalWithMilestonesResponse {
  return {
    ...toGoalResponse(goal),
    ...(milestones ? {milestones} : {}),
  };
}

export function toGoalsWithMilestonesResponse(
  goals: Array<Goal & {milestones?: Milestone[]}>
): GoalWithMilestonesResponse[] {
  return goals.map((goal) => toGoalWithMilestonesResponse(goal, goal.milestones));
}

export function toDailyBabyStepResponse(step: DailyBabyStep): DailyBabyStepResponse {
  const {user_id: _userId, updated_at: _updatedAt, ...rest} = step;
  return rest;
}

export function toDailyBabyStepsResponse(steps: DailyBabyStep[]): DailyBabyStepResponse[] {
  return steps.map(toDailyBabyStepResponse);
}

export function toLifeDomainStateResponse(state: LifeDomainState): LifeDomainStateResponse {
  const {user_id: _userId, created_at: _createdAt, updated_at: _updatedAt, ...rest} = state;
  return rest;
}

export function toLifeDomainStatesResponse(states: LifeDomainState[]): LifeDomainStateResponse[] {
  return states.map(toLifeDomainStateResponse);
}

export function toDailyReflectionResponse(reflection: DailyReflection): DailyReflectionResponse {
  const {user_id: _userId, ...rest} = reflection;
  return rest;
}

export function toAiCoachingInsightResponse(insight: AiCoachingInsight): AiCoachingInsightResponse {
  const {user_id: _userId, ...rest} = insight;
  return rest;
}

export function toAiCoachingInsightsResponse(
  insights: AiCoachingInsight[]
): AiCoachingInsightResponse[] {
  return insights.map(toAiCoachingInsightResponse);
}

export function toFormulationSessionResponse(
  session: FormulationSession
): FormulationSessionResponse {
  const {user_id: _userId, updated_at: _updatedAt, ...rest} = session;
  return rest;
}

export function toFormulationSessionsResponse(
  sessions: FormulationSession[]
): FormulationSessionResponse[] {
  return sessions.map(toFormulationSessionResponse);
}

export function toNullableLifeDomainStateResponse(
  state: LifeDomainState | null
): LifeDomainStateResponse | null {
  return state ? toLifeDomainStateResponse(state) : null;
}

export function toNullableFormulationSessionResponse(
  session: FormulationSession | null
): FormulationSessionResponse | null {
  return session ? toFormulationSessionResponse(session) : null;
}

export function toNullableAiCoachingInsightResponse(
  insight: AiCoachingInsight | null
): AiCoachingInsightResponse | null {
  return insight ? toAiCoachingInsightResponse(insight) : null;
}
