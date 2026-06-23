import {getLocalAuthContext} from '@/lib/auth/get-current-user';

/** Public auth mode probe for client-side local-auth gating. */
export async function GET(request: Request) {
  return Response.json(getLocalAuthContext(request));
}
