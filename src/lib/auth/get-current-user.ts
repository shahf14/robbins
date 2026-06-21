import {NextResponse} from 'next/server';

const LOCAL_USER_ID = process.env.LOCAL_USER_ID ?? 'local-user';
const LOCAL_USER_EMAIL = process.env.LOCAL_USER_EMAIL ?? '';
const LOCAL_AUTH_TOKEN = process.env.LOCAL_AUTH_TOKEN ?? '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOCAL_AUTH_ENABLED = !IS_PRODUCTION || process.env.ALLOW_LOCAL_AUTH === 'true';
/**
 * Outside production (or with ALLOW_LOCAL_AUTH=true) this is a single-user local
 * app, so open API access is intentional. In production we fail closed: access
 * requires a configured LOCAL_AUTH_TOKEN and a matching request token. A missing
 * token must never silently grant access.
 */
const LOCAL_AUTH_OPEN = LOCAL_AUTH_ENABLED;

type LocalUser = {id: string; email: string};

type CurrentUserOk   = {ok: true;  user: LocalUser};
type CurrentUserFail = {ok: false; response: NextResponse};
export type CurrentUserResult = CurrentUserOk | CurrentUserFail;

const unauthorizedResponse = () =>
  NextResponse.json({error: 'Unauthorized'}, {status: 401});

function getLocalTokenFromRequest(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const bearerPrefix = 'Bearer ';

  if (authorization.startsWith(bearerPrefix)) {
    return authorization.slice(bearerPrefix.length).trim();
  }

  return request.headers.get('x-local-auth-token')?.trim() ?? '';
}

function hasValidLocalToken(request: Request) {
  return !!(LOCAL_AUTH_TOKEN && getLocalTokenFromRequest(request) === LOCAL_AUTH_TOKEN);
}

function localUser(): LocalUser {
  return {id: LOCAL_USER_ID, email: LOCAL_USER_EMAIL};
}

export async function requireCurrentUser(request: Request): Promise<CurrentUserResult> {
  if (hasValidLocalToken(request) || LOCAL_AUTH_OPEN) {
    return {ok: true, user: localUser()};
  }

  return {ok: false, response: unauthorizedResponse()};
}
