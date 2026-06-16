/**
 * Simple admin guard for DB routes.
 * Checks a separate admin API token and the authenticated user's email.
 * Admin access is disabled until ADMIN_EMAIL is configured.
 * In production, ADMIN_API_TOKEN is also required.
 */
import {requireCurrentUser} from '@/lib/auth/get-current-user';

const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN ?? '';
const ADMIN_TOKEN_REQUIRED =
  process.env.NODE_ENV === 'production' || !!ADMIN_API_TOKEN;

function forbidden(message = 'Forbidden') {
  return new Response(JSON.stringify({error: message}), {
    status: 403,
    headers: {'Content-Type': 'application/json'},
  });
}

function getAdminTokenFromRequest(request: Request) {
  return request.headers.get('x-admin-api-token')?.trim() ?? '';
}

export async function requireAdmin(request: Request) {
  if (ADMIN_TOKEN_REQUIRED) {
    if (!ADMIN_API_TOKEN) {
      return {ok: false as const, response: forbidden('Admin API token is not configured.')};
    }

    if (getAdminTokenFromRequest(request) !== ADMIN_API_TOKEN) {
      return {ok: false as const, response: forbidden()};
    }
  }

  const current = await requireCurrentUser(request);
  if (!current.ok) return {ok: false as const, response: current.response};

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || current.user.email !== adminEmail) {
    return {ok: false as const, response: forbidden()};
  }

  return {ok: true as const, user: current.user};
}
