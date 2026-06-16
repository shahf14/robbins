import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {enforceAiRateLimit} from '@/lib/ai-rate-limit';
import {generateDailyStepsForUser} from '@/lib/life-coach/generate-daily-steps-for-user';
import {listDailyBabyStepsForDate} from '@/lib/life-coach/repository';
import {jsonError, jsonOk, resolveLocale, startOfToday} from '@/lib/life-coach/server';
import {aiGenerateDailyStepsRequestSchema} from '@/lib/life-coach/schemas';
import {isFirstWinStep} from '@/lib/formulation/first-win-routing';

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const parsed = aiGenerateDailyStepsRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError('Invalid daily step generation payload.', 400, parsed.error.flatten());
  }

  const date = parsed.data.date ?? startOfToday();
  const force = parsed.data.force === true;
  const includeFirstWin = parsed.data.include_first_win === true;

  try {
    const existing = await listDailyBabyStepsForDate(date, current.user.id);

    if (existing.some((step) => step.generated_by_ai) && !force) {
      const needsFirstWin = includeFirstWin && !existing.some(isFirstWinStep);
      if (!needsFirstWin) {
        return jsonOk({date, steps: existing});
      }
    }

    const limited = enforceAiRateLimit({
      action: 'life-coach:generate-daily-steps',
      userId: current.user.id,
      limit: 8,
    });
    if (limited) return limited;

    const locale = resolveLocale(typeof body.locale === 'string' ? body.locale : null);
    const wakeTime = typeof body.wake_time === 'string' && /^\d{2}:\d{2}$/.test(body.wake_time) ? body.wake_time : '07:00';
    const sleepTime = typeof body.sleep_time === 'string' && /^\d{2}:\d{2}$/.test(body.sleep_time) ? body.sleep_time : '22:30';
    const coachingStyle = typeof body.coaching_style === 'string' ? body.coaching_style : 'supportive';
    const physicalConsiderations = Array.isArray(body.physical_considerations)
      ? (body.physical_considerations as string[]).filter((v): v is import('@/lib/user-preferences').PhysicalConsideration =>
          v === 'low_intensity' || v === 'physical_limitation' || v === 'pregnancy_postpartum'
        )
      : [];
    const preferredActionWindow = (
      body.preferred_action_window === 'morning' ||
      body.preferred_action_window === 'midday' ||
      body.preferred_action_window === 'evening'
        ? body.preferred_action_window
        : 'flexible'
    ) as import('@/lib/user-preferences').PreferredActionWindow;
    const steps = await generateDailyStepsForUser(
      current.user.id,
      date,
      locale,
      wakeTime,
      coachingStyle,
      physicalConsiderations,
      preferredActionWindow,
      sleepTime,
      includeFirstWin
    );
    return jsonOk({date, steps});
  } catch (error) {
    return jsonError('Could not generate daily steps.', 500, String(error));
  }
}
