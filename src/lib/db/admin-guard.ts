import {isLoopbackHost, requireCurrentUser} from '@/lib/auth/get-current-user';

const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN ?? '';

function forbidden(message = 'Forbidden') {
  return new Response(JSON.stringify({error: message}), {
    status: 403,
    headers: {'Content-Type': 'application/json'},
  });
}

function serviceUnavailable(message: string) {
  return new Response(JSON.stringify({error: message}), {
    status: 503,
    headers: {'Content-Type': 'application/json'},
  });
}

function getAdminTokenFromRequest(request: Request) {
  return request.headers.get('x-admin-api-token')?.trim() ?? '';
}

export async function requireAdmin(request: Request) {
  if (!ADMIN_API_TOKEN) {
    return {
      ok: false as const,
      response: serviceUnavailable('Admin API token is not configured.'),
    };
  }

  if (getAdminTokenFromRequest(request) !== ADMIN_API_TOKEN) {
    return {ok: false as const, response: forbidden()};
  }

  if (process.env.NODE_ENV === 'development' && !isLoopbackHost(request)) {
    return {ok: false as const, response: forbidden('Admin DB routes are loopback-only in development.')};
  }

  const current = await requireCurrentUser(request);
  if (!current.ok) return {ok: false as const, response: current.response};

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || current.user.email !== adminEmail) {
    return {ok: false as const, response: forbidden()};
  }

  return {ok: true as const, user: current.user};
}
