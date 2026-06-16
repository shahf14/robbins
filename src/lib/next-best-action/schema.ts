import {z} from 'zod';
import {NEXT_BEST_ACTION_TYPES} from './types';

export const nextBestActionSchema = z.object({
  label: z.string().trim().min(1).max(120),
  action_type: z.enum(NEXT_BEST_ACTION_TYPES),
  target_id: z.string().trim().min(1).max(80).optional(),
  estimated_minutes: z.number().int().min(1).max(120).optional(),
});

export const coachResponseWithActionSchema = z.object({
  response: z.string().trim().min(1).max(4000),
  next_best_action: nextBestActionSchema,
});
