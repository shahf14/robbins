import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {badRequest, payloadTooLarge} from '@/lib/api-response';
import {JSON_BODY_LIMITS, readJsonBody} from '@/lib/read-json-body';
import type {z} from 'zod';

export async function readAuthenticatedJsonBody<T>(
  request: Request,
  options: {maxBytes?: number; schema?: z.ZodType<T>} = {}
) {
  const current = await requireCurrentUser(request);
  if (!current.ok) {
    return {ok: false as const, response: current.response, user: null};
  }

  const parsed = await readJsonBody(request, {
    maxBytes: options.maxBytes ?? JSON_BODY_LIMITS.defaultApi,
    schema: options.schema,
  });

  if (!parsed.ok) {
    return {ok: false as const, response: parsed.response, user: null};
  }

  return {ok: true as const, data: parsed.data, user: current.user};
}

export {badRequest, payloadTooLarge, JSON_BODY_LIMITS};
