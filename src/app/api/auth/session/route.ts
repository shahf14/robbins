import {jsonMutation} from '@/lib/life-coach/server';
import {requireCurrentUser} from '@/lib/auth/get-current-user';

/** Lightweight auth check for client-side token validation. */
export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  return jsonMutation({userId: current.user.id});
}
