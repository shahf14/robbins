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

const availableTimeSchema = z.union([
  z.literal(AVAILABLE_TIME_OPTIONS[0]),
  z.literal(AVAILABLE_TIME_OPTIONS[1]),
  z.literal(AVAILABLE_TIME_OPTIONS[2]),
  z.literal(AVAILABLE_TIME_OPTIONS[3]),
]);

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
