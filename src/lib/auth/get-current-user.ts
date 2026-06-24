import {NextResponse} from 'next/server';
import {isClerkConfigured, resolveClerkDbUser} from '@/lib/auth/clerk-user';
import type {LocalAuthContext} from '@/lib/auth/local-auth-context';

export {assertLocalAuthConfigured} from '@/lib/auth/assert-local-auth-configured';
export type {LocalAuthContext} from '@/lib/auth/local-auth-context';

const LOCAL_USER_ID = process.env.LOCAL_USER_ID ?? 'local-user';
const LOCAL_USER_EMAIL = process.env.LOCAL_USER_EMAIL ?? '';
const LOCAL_AUTH_TOKEN = process.env.LOCAL_AUTH_TOKEN ?? '';
const ALLOW_LOCAL_AUTH = process.env.ALLOW_LOCAL_AUTH === 'true';

type LocalUser = {id: string; email: string};

type CurrentUserOk = {ok: true; user: LocalUser};
type CurrentUserFail = {ok: false; response: NextResponse};
export type CurrentUserResult = CurrentUserOk | CurrentUserFail;

const unauthorizedResponse = () =>
  NextResponse.json({error: 'Unauthorized'}, {status: 401});

/** Host header only — never trust X-Forwarded-For for loopback decisions. */
export function isLoopbackHost(request: Request): boolean {
  const host = request.headers.get('host')?.split(':')[0]?.trim().toLowerCase() ?? '';
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

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

function allowsLoopbackOpenAccess(request: Request): boolean {
  return ALLOW_LOCAL_AUTH && isLoopbackHost(request);
}

export function getLocalAuthContext(request: Request): LocalAuthContext {
  if (isClerkConfigured()) {
    return {mode: 'clerk'};
  }

  return {
    mode: 'local',
    openAccess: allowsLoopbackOpenAccess(request),
  };
}

function localUser(): LocalUser {
  return {id: LOCAL_USER_ID, email: LOCAL_USER_EMAIL};
}

export async function requireCurrentUser(request: Request): Promise<CurrentUserResult> {
  if (isClerkConfigured()) {
    const clerkUser = await resolveClerkDbUser();
    if (clerkUser) {
      return {ok: true, user: clerkUser};
    }
    return {ok: false, response: unauthorizedResponse()};
  }

  if (hasValidLocalToken(request) || allowsLoopbackOpenAccess(request)) {
    return {ok: true, user: localUser()};
  }

  return {ok: false, response: unauthorizedResponse()};
}
