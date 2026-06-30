import {z} from 'zod';

const maxText = z.string().max(16_384);
const maxShort = z.string().max(512);
const maxId = z.string().min(1).max(128);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTime = z.string().datetime();
const score0to10 = z.number().finite().min(0).max(10);

export const dbSyncCheckinItemSchema = z
  .object({
    id: maxId.optional(),
    date: isoDate.optional(),
    createdAt: isoDateTime.optional(),
    focus: score0to10.optional(),
    energy: score0to10.optional(),
    stateScore: score0to10.optional(),
    momentum: score0to10.optional(),
    primaryTag: maxShort.optional(),
    selectedTags: z.array(maxShort).max(32).optional(),
    priorityAction: maxText.optional(),
    recommendationType: maxShort.optional(),
    insightKey: maxShort.optional(),
    coachSupport: maxText.optional(),
    challengeDone: z.boolean().optional(),
    followUps: z.array(maxShort).max(20).optional(),
    sessionDurationSec: z.number().finite().min(0).max(86_400).optional(),
    sliderAdjustments: z.number().finite().optional(),
    openedCoachSupport: z.boolean().optional(),
    priorityActionWordCount: z.number().finite().min(0).optional(),
    rewrotePriorityActionCount: z.number().int().min(0).optional(),
    tagValenceShift: z.number().finite().optional(),
    energyFocusDivergence: z.number().finite().optional(),
    physicalComplaintMentioned: z.boolean().optional(),
    helpEngagementDepth: maxShort.optional(),
    statedActionCompleted: z.boolean().nullable().optional(),
  })
  .passthrough();

export const dbSyncMorningRitualItemSchema = z
  .object({
    id: maxId.optional(),
    date: isoDate.optional(),
    startedAt: isoDateTime.optional(),
    completedAt: isoDateTime.nullable().optional(),
    moodBefore: z.union([score0to10, maxShort]).nullable().optional(),
    moodAfter: z.union([score0to10, maxShort]).nullable().optional(),
    triggers: z.array(maxShort).max(32).optional(),
    durationSec: z.number().finite().min(0).max(86_400).optional(),
    completed: z.boolean().optional(),
    gratitudeEntries: z.array(maxText).max(20).optional(),
  })
  .passthrough();

export const dbSyncBodySchema = z.object({
  checkins: z.array(dbSyncCheckinItemSchema).max(1000).optional(),
  morning_rituals: z.array(dbSyncMorningRitualItemSchema).max(1000).optional(),
});

export const morningRitualSessionSchema = z
  .object({
    id: maxId,
    mode: z.enum(['quick', 'standard', 'deep']).optional(),
    language: maxShort.optional(),
    startedAt: isoDateTime.optional(),
    completedAt: isoDateTime.nullable().optional(),
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
    startedAt: isoDateTime.optional(),
    completedAt: isoDateTime.nullable().optional(),
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
