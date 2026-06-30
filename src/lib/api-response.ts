import {NextResponse} from 'next/server';

export type JsonErrorOptions = {
  exposeDetails?: boolean;
  headers?: HeadersInit;
  extra?: Record<string, unknown>;
};

export function jsonError(
  message: string,
  status = 400,
  details?: unknown,
  options?: JsonErrorOptions
): NextResponse {
  const payload: Record<string, unknown> = {error: message};
  if (options?.extra) {
    Object.assign(payload, options.extra);
  }
  const shouldExpose =
    options?.exposeDetails === true ||
    (details !== undefined && process.env.NODE_ENV !== 'production');
  if (shouldExpose && details !== undefined) {
    payload.details = details;
  }
  return NextResponse.json(payload, {status, headers: options?.headers});
}

export function jsonOk(data: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(data, {status});
}

/**
 * Success response contract:
 * - Reads/lists (GET): `jsonOk({ [resourceKey]: data, ...metadata })` — no `ok` field.
 * - Mutations (POST/PATCH): `jsonMutation()` → `{ ok: true }` or `jsonMutation({ resource })`.
 * - Deletes (DELETE): `jsonNoContent()` → `204` with no body.
 */
export type MutationSuccess<T extends Record<string, unknown> = Record<string, never>> = {
  ok: true;
} & T;

export function jsonMutation<T extends Record<string, unknown>>(
  extra?: T,
  status = 200
): NextResponse {
  return NextResponse.json({ok: true as const, ...extra}, {status});
}

export function jsonNoContent(): NextResponse {
  return new NextResponse(null, {status: 204});
}

/** @deprecated Use jsonError() from @/lib/life-coach/server in API routes. */
export function badRequest(error: string) {
  return jsonError(error, 400);
}

/** @deprecated Use jsonError() from @/lib/life-coach/server in API routes. */
export function serverError(error: string) {
  return jsonError(error, 500);
}

/** @deprecated Use jsonError() from @/lib/life-coach/server in API routes. */
export function notFound(error = 'Not found') {
  return jsonError(error, 404);
}

/** @deprecated Use jsonError() from @/lib/life-coach/server in API routes. */
export function payloadTooLarge(error = 'Payload too large') {
  return jsonError(error, 413);
}

/** @deprecated Use jsonError() from @/lib/life-coach/server in API routes. */
export function tooManyRequests(error = 'Too many requests') {
  return jsonError(error, 429);
}
