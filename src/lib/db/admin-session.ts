import {createHmac, timingSafeEqual} from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'robbins_admin_session';
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60;

function sessionSecret(): string {
  const configured = process.env.ADMIN_API_TOKEN?.trim() ?? '';
  if (configured) return configured;
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_LOCAL_AUTH === 'true'
  ) {
    return '__dev_admin_session__';
  }
  return '';
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function getAdminSessionTokenFromRequest(request: Request): string | null {
  const cookies = parseCookies(request.headers.get('cookie'));
  const token = cookies[ADMIN_SESSION_COOKIE]?.trim();
  return token || null;
}

export function createAdminSessionValue(userId: string, now = Date.now()): string | null {
  const secret = sessionSecret();
  if (!secret || !userId) return null;
  const exp = now + ADMIN_SESSION_MAX_AGE_SEC * 1000;
  const payload = `${userId}.${exp}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyAdminSessionValue(token: string, userId: string, now = Date.now()): boolean {
  const secret = sessionSecret();
  if (!secret || !userId) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [subject, expRaw, sig] = parts;
  if (subject !== userId) return false;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || now > exp) return false;

  const payload = `${subject}.${expRaw}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: ADMIN_SESSION_MAX_AGE_SEC,
    path: '/',
  };
}
