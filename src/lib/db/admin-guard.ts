import {isLoopbackHost, requireCurrentUser} from '@/lib/auth/get-current-user';
import {
  getAdminSessionTokenFromRequest,
  verifyAdminSessionValue,
} from '@/lib/db/admin-session';

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

export function getAdminTokenFromRequest(request: Request) {
  return request.headers.get('x-admin-api-token')?.trim() ?? '';
}

export function allowsDevLoopbackAdminBypass(request: Request): boolean {
  if (!isLoopbackHost(request)) return false;
  if (process.env.NODE_ENV === 'development') return true;
  return process.env.ALLOW_LOCAL_AUTH === 'true';
}

function hasAdminApiToken(request: Request): boolean {
  return !!(ADMIN_API_TOKEN && getAdminTokenFromRequest(request) === ADMIN_API_TOKEN);
}

function hasValidAdminSession(request: Request, userId: string): boolean {
  const token = getAdminSessionTokenFromRequest(request);
  if (!token) return false;
  return verifyAdminSessionValue(token, userId);
}

async function authenticateAdminUser(request: Request) {
  if (process.env.NODE_ENV === 'development' && !isLoopbackHost(request)) {
    return {
      ok: false as const,
      response: forbidden('Admin DB routes are loopback-only in development.'),
    };
  }

  const current = await requireCurrentUser(request);
  if (!current.ok) return {ok: false as const, response: current.response};

  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (adminEmail && current.user.email !== adminEmail) {
    return {ok: false as const, response: forbidden()};
  }
  if (
    !adminEmail &&
    process.env.NODE_ENV === 'production' &&
    !allowsDevLoopbackAdminBypass(request)
  ) {
    return {
      ok: false as const,
      response: serviceUnavailable('ADMIN_EMAIL is not configured.'),
    };
  }

  return {ok: true as const, user: current.user};
}

export function isAdminAccessGranted(request: Request, userId: string): boolean {
  return (
    hasValidAdminSession(request, userId) ||
    hasAdminApiToken(request) ||
    allowsDevLoopbackAdminBypass(request)
  );
}

export function canBootstrapAdminSession(request: Request): boolean {
  return hasAdminApiToken(request) || allowsDevLoopbackAdminBypass(request);
}

export async function requireAdmin(request: Request) {
  const auth = await authenticateAdminUser(request);
  if (!auth.ok) return auth;

  if (isAdminAccessGranted(request, auth.user.id)) {
    return {ok: true as const, user: auth.user};
  }

  if (!ADMIN_API_TOKEN) {
    return {
      ok: false as const,
      response: serviceUnavailable('Admin API token is not configured.'),
    };
  }

  return {ok: false as const, response: forbidden()};
}

export async function requireAdminSessionBootstrap(request: Request) {
  const auth = await authenticateAdminUser(request);
  if (!auth.ok) return auth;

  if (hasAdminApiToken(request) || allowsDevLoopbackAdminBypass(request)) {
    return {ok: true as const, user: auth.user};
  }

  if (!ADMIN_API_TOKEN) {
    return {
      ok: false as const,
      response: serviceUnavailable('Admin API token is not configured.'),
    };
  }

  return {
    ok: false as const,
    response: forbidden('Valid admin API token required to start an admin session.'),
  };
}
