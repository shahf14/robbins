import {NextResponse} from 'next/server';
import {serverError} from '@/lib/api-response';
import {
  canBootstrapAdminSession,
  requireAdminSessionBootstrap,
} from '@/lib/db/admin-guard';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SEC,
  adminSessionCookieOptions,
  createAdminSessionValue,
  getAdminSessionTokenFromRequest,
  verifyAdminSessionValue,
} from '@/lib/db/admin-session';
import {requireCurrentUser} from '@/lib/auth/get-current-user';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  const token = getAdminSessionTokenFromRequest(request);
  const active = token ? verifyAdminSessionValue(token, current.user.id) : false;

  return NextResponse.json({
    active,
    canBootstrap: canBootstrapAdminSession(request),
    expiresInSec: active ? ADMIN_SESSION_MAX_AGE_SEC : 0,
  });
}

export async function POST(request: Request) {
  const guard = await requireAdminSessionBootstrap(request);
  if (!guard.ok) return guard.response;

  try {
    const sessionValue = createAdminSessionValue(guard.user.id);
    if (!sessionValue) {
      return serverError('Could not create admin session.');
    }

    const response = NextResponse.json({
      ok: true,
      expiresInSec: ADMIN_SESSION_MAX_AGE_SEC,
    });
    response.cookies.set(ADMIN_SESSION_COOKIE, sessionValue, adminSessionCookieOptions());
    return response;
  } catch {
    return serverError('Could not create admin session.');
  }
}

export async function DELETE() {
  const response = NextResponse.json({ok: true});
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    ...adminSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
