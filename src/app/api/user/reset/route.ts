import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {deleteUserAccount} from '@/lib/life-coach/repository';
import {jsonError, jsonOk} from '@/lib/life-coach/server';

export async function POST(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  try {
    await deleteUserAccount(current.user.id);
    return jsonOk({reset: true});
  } catch (error) {
    return jsonError('Could not reset user data.', 500, String(error));
  }
}
