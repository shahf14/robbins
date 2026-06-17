import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {listDomainCardSummaries, listLifeDomainStates} from '@/lib/life-coach/repository';
import {jsonError, jsonOk} from '@/lib/life-coach/server';

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});

  if (!current.ok) {
    return current.response;
  }

  try {
    const [domains, states] = await Promise.all([
      listDomainCardSummaries(current.user.id),
      listLifeDomainStates(current.user.id),
    ]);

    return jsonOk({domains, states});
  } catch (error) {
    return jsonError('Could not load life domains.', 500, String(error));
  }
}
