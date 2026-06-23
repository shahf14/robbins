import {badRequest, payloadTooLarge} from '@/lib/api-response';
import type {z} from 'zod';

type ReadJsonBodyOptions<T> = {
  maxBytes: number;
  schema?: z.ZodType<T>;
};

type ReadJsonBodyOk<T> = {ok: true; data: T};
type ReadJsonBodyFail = {ok: false; response: Response};

export async function readJsonBody<T = unknown>(
  request: Request,
  options: ReadJsonBodyOptions<T>
): Promise<ReadJsonBodyOk<T> | ReadJsonBodyFail> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
    return {ok: false, response: payloadTooLarge('Request body is too large')};
  }

  let raw = '';
  try {
    raw = await request.text();
  } catch {
    return {ok: false, response: badRequest('Invalid request body')};
  }

  if (Buffer.byteLength(raw, 'utf8') > options.maxBytes) {
    return {ok: false, response: payloadTooLarge('Request body is too large')};
  }

  let parsed: unknown;
  try {
    parsed = raw.length > 0 ? JSON.parse(raw) : null;
  } catch {
    return {ok: false, response: badRequest('Invalid JSON body')};
  }

  if (options.schema) {
    const result = options.schema.safeParse(parsed);
    if (!result.success) {
      return {ok: false, response: badRequest('Invalid request body')};
    }
    return {ok: true, data: result.data};
  }

  return {ok: true, data: parsed as T};
}

export const JSON_BODY_LIMITS = {
  sessionPost: 256 * 1024,
  dbSync: 2 * 1024 * 1024,
  defaultApi: 128 * 1024,
} as const;
