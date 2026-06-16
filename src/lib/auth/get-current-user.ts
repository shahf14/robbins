import {NextResponse} from 'next/server';

const LOCAL_USER_ID = process.env.LOCAL_USER_ID ?? 'local-user';
const LOCAL_USER_EMAIL = process.env.LOCAL_USER_EMAIL ?? '';
const LOCAL_AUTH_TOKEN = process.env.LOCAL_AUTH_TOKEN ?? '';
const LOCAL_AUTH_ENABLED =
  process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCAL_AUTH === 'true';
/** When no token is configured, this is a single-user local app — allow API access. */
const LOCAL_AUTH_OPEN = LOCAL_AUTH_ENABLED || !LOCAL_AUTH_TOKEN;

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
