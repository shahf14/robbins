import {z} from 'zod';
import {
  intensityPreferenceSchema,
  lifeContextStatusSchema,
  lifeDomainSchema,
} from '@/lib/life-coach/schemas';
import {AVAILABLE_TIME_OPTIONS} from '@/lib/life-coach/types';

/** Matches step-3 clarification inputs (maxLength 500 in UI). */
const answerFieldSchema = z.string().trim().max(500);

const onboardingAnswersSchema = z.object({
  whyThisDomain: answerFieldSchema,
  whatBothersToday: answerFieldSchema,
  whatIfNothingChanges: answerFieldSchema,
  whatIfSucceeds: answerFieldSchema,
});

const scheduleTimeSchema = z.string().regex(/^\d{2}:\d{2}$/);

const availableTimeSchema = z.union([
  z.literal(AVAILABLE_TIME_OPTIONS[0]),
  z.literal(AVAILABLE_TIME_OPTIONS[1]),
  z.literal(AVAILABLE_TIME_OPTIONS[2]),
  z.literal(AVAILABLE_TIME_OPTIONS[3]),
]);

/** Optional profile context echoed into prompts — bounded to prevent token abuse. */
const onboardingUserContextSchema = z.object({
  domainScore: z.number().int().min(1).max(10).optional().default(5),
  availableTime: availableTimeSchema.optional(),
  intensityPreference: intensityPreferenceSchema.optional(),
  coachingStyle: z.enum(['supportive', 'direct', 'motivational']).optional(),
  familyStatus: z
    .enum(['single', 'in_relationship', 'married', 'married_with_kids', 'other'])
    .optional(),
  age: z.number().int().min(16).max(120).optional(),
  gender: z.enum(['male', 'female']).optional(),
  lifeContextStatuses: z.array(lifeContextStatusSchema).max(6).optional(),
  wakeTime: scheduleTimeSchema.optional(),
  sleepTime: scheduleTimeSchema.optional(),
  preferredActionWindow: z.enum(['morning', 'midday', 'evening', 'flexible']).optional(),
  physicalConsiderations: z
    .array(z.enum(['low_intensity', 'physical_limitation', 'pregnancy_postpartum']))
    .max(3)
    .optional(),
});

const onboardingAiBaseSchema = z
  .object({
    locale: z.enum(['he', 'en']),
    domain: lifeDomainSchema,
  })
  .merge(onboardingUserContextSchema);

const onboardingAiInsightRequestSchema = onboardingAiBaseSchema.extend({
  mode: z.literal('insight'),
  answers: onboardingAnswersSchema,
  articulationHelp: z.boolean().optional().default(false),
});

const onboardingAiGoalProposalRequestSchema = onboardingAiBaseSchema.extend({
  mode: z.literal('goal_proposal'),
  answers: onboardingAnswersSchema,
  tone: z.enum(['default', 'smaller', 'bolder']).optional().default('default'),
  previousTitle: z.string().trim().max(140).optional(),
});

const onboardingAiInsightAndGoalRequestSchema = onboardingAiBaseSchema.extend({
  mode: z.literal('insight_and_goal'),
  answers: onboardingAnswersSchema,
  tone: z.enum(['default', 'smaller', 'bolder']).optional().default('default'),
  previousTitle: z.string().trim().max(140).optional(),
});

const onboardingAiFirstStepRequestSchema = onboardingAiBaseSchema.extend({
  mode: z.literal('first_step'),
  goalText: z.string().trim().min(1).max(500),
  excludeStepTitle: z.string().trim().max(180).optional(),
});

export const onboardingAiRequestSchema = z.discriminatedUnion('mode', [
  onboardingAiInsightRequestSchema,
  onboardingAiGoalProposalRequestSchema,
  onboardingAiInsightAndGoalRequestSchema,
  onboardingAiFirstStepRequestSchema,
]);

export type OnboardingUserContext = z.infer<typeof onboardingUserContextSchema>;

/** Payload for persisting onboarding completion + AI personalization summary. */
export const onboardingCompleteRequestSchema = z.object({
  primaryDomain: lifeDomainSchema.nullable().optional(),
  locale: z.enum(['he', 'en']).optional(),
  life_context_note: z.string().trim().max(500).optional(),
  life_context_statuses: z.array(lifeContextStatusSchema).max(6).optional(),
  available_time: availableTimeSchema.optional(),
  intensity_preference: intensityPreferenceSchema.optional(),
  coaching_style: z.enum(['supportive', 'direct', 'motivational']).optional(),
  answers: onboardingAnswersSchema.optional(),
  insight: z.string().trim().max(2000).nullable().optional(),
  goal_title: z.string().trim().max(500).optional(),
  goal_description: z.string().trim().max(2000).optional(),
  domain_score: z.number().int().min(1).max(10).optional(),
});
