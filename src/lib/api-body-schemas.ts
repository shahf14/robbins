import {z} from 'zod';

const maxText = z.string().max(16_384);
const maxShort = z.string().max(512);
const maxId = z.string().min(1).max(128);

export const morningRitualSessionSchema = z
  .object({
    id: maxId,
    mode: z.enum(['quick', 'standard', 'deep']).optional(),
    language: maxShort.optional(),
    startedAt: maxShort.optional(),
    completedAt: maxShort.nullable().optional(),
    durationSeconds: z.number().finite().optional(),
    completed: z.boolean().optional(),
    gratitudeEntries: z.array(maxText).max(20),
    identityText: maxText.optional(),
    dailyMission: maxText.optional(),
    visualizationText: maxText.optional(),
  })
  .passthrough();

export const eveningResetSessionSchema = z
  .object({
    id: maxId,
    mode: z.enum(['quick', 'standard', 'deep']).optional(),
    language: maxShort.optional(),
    biggestWin: maxText.optional(),
    successFactors: maxText.optional(),
    blockers: maxText.optional(),
    emotionalDump: maxText.optional(),
    gratitudeItems: z.array(maxText).max(20).optional(),
    aiInsight: maxText.optional(),
    tomorrowsWin: maxText.optional(),
    tomorrow_takeaway: maxText.nullable().optional(),
  })
  .passthrough();

export const dbSyncBodySchema = z.object({
  user_id: maxId.optional(),
  checkins: z.array(z.record(z.string(), z.unknown())).max(1000).optional(),
  morning_rituals: z.array(z.record(z.string(), z.unknown())).max(1000).optional(),
});
