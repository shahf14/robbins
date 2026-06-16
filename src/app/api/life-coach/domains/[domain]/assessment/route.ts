import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {upsertLifeDomainState} from '@/lib/life-coach/repository';
import {jsonError, jsonOk} from '@/lib/life-coach/server';
import {lifeDomainAssessmentInputSchema, lifeDomainSchema} from '@/lib/life-coach/schemas';

export async function POST(
  request: Request,
  {params}: {params: Promise<{domain: string}>}
) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});

  if (!current.ok) {
    return current.response;
  }

  const {domain: rawDomain} = await params;
  const parsedDomain = lifeDomainSchema.safeParse(rawDomain);

  if (!parsedDomain.success) {
    return jsonError('Unsupported domain.', 400);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const parsedBody = lifeDomainAssessmentInputSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError('Invalid assessment payload.', 400, parsedBody.error.flatten());
  }

  try {
    const state = await upsertLifeDomainState(
      current.user.id,
      parsedDomain.data,
      parsedBody.data
    );
    return jsonOk({state});
  } catch (error) {
    return jsonError('Could not save domain assessment.', 500, String(error));
  }
}
