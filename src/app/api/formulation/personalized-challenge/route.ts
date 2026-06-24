import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {
  EMPTY_FORMULATION_COACH_CONTEXT,
  getSupportContextForUser,
} from '@/lib/support-context/formulation-support-context';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  try {
    const context = await getSupportContextForUser(current.user.id);
    return Response.json(context.formulation);
  } catch {
    return Response.json(EMPTY_FORMULATION_COACH_CONTEXT);
  }
}
