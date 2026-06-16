import type {AppLocale} from '@/i18n/config';
import type {PersonalizedVisualization} from '@/lib/formulation/visualization-context';

export async function fetchPersonalizedVisualization(
  locale: AppLocale
): Promise<PersonalizedVisualization | null> {
  try {
    const response = await fetch(
      `/api/ritual/visualization-context?locale=${encodeURIComponent(locale)}`,
      {headers: {'Content-Type': 'application/json'}}
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {visualization?: PersonalizedVisualization | null};
    return data.visualization ?? null;
  } catch {
    return null;
  }
}
