import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {buildPersonalizedVisualization} from '@/lib/formulation/visualization-context';
import type {AppLocale} from '@/i18n/config';
import {getLatestCompletedFormulation} from '@/lib/life-coach/repository';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  const url = new URL(request.url);
  const localeParam = url.searchParams.get('locale');
  const locale: AppLocale = localeParam === 'en' ? 'en' : 'he';

  try {
    const session = await getLatestCompletedFormulation(current.user.id);
    if (!session) {
      return Response.json({visualization: null});
    }

    const visualization = buildPersonalizedVisualization(
      {...session, locale: session.locale ?? locale},
      session.locale ?? locale
    );

    return Response.json({visualization});
  } catch {
    return Response.json({visualization: null});
  }
}
