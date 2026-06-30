import {z} from 'zod';
import {LIFE_DOMAINS} from './constants.ts';

const lifeDomainSchema = z.enum(LIFE_DOMAINS);

export const inspireGoalRequestSchema = z.object({
  domain: lifeDomainSchema,
  category: z.string().trim().min(1).max(120),
  locale: z.enum(['he', 'en']).optional(),
  mode: z.enum(['goal', 'milestones']).default('goal'),
  goal_text: z.string().trim().max(1000).optional().default(''),
});

export const expandTextRequestSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  context: z.string().trim().max(2000).optional().default(''),
  locale: z.enum(['he', 'en']).optional(),
});

export const inspireGoalMilestonesResponseSchema = z.object({
  days_30: z.string().trim().min(1),
  days_60: z.string().trim().min(1),
  days_90: z.string().trim().min(1),
});

/** Unified inspire-goal API response — one field set per mode. */
export const inspireGoalResponseSchema = z
  .object({
    inspiration: z.string().trim().min(1).optional(),
    milestones: inspireGoalMilestonesResponseSchema.optional(),
  })
  .refine(
    (value) => Boolean(value.inspiration) !== Boolean(value.milestones),
    {message: 'Provide exactly one of inspiration or milestones.'}
  );

export type InspireGoalResponse = z.infer<typeof inspireGoalResponseSchema>;
