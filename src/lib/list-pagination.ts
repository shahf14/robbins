export const MAX_LIST_OFFSET = 10_000;

export function parseLimitOffset(
  searchParams: URLSearchParams,
  options: {
    defaultLimit: number;
    maxLimit: number;
    maxOffset?: number;
  }
): {
  limit: number;
  offset: number;
  requestedOffset: number;
  offsetCapped: boolean;
} {
  const maxOffset = options.maxOffset ?? MAX_LIST_OFFSET;
  const limitRaw = Number(searchParams.get('limit') ?? options.defaultLimit);
  const offsetRaw = Number(searchParams.get('offset') ?? 0);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), options.maxLimit)
    : options.defaultLimit;
  const requestedOffset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;
  const offset = Math.min(requestedOffset, maxOffset);
  return {
    limit,
    offset,
    requestedOffset,
    offsetCapped: requestedOffset > maxOffset,
  };
}

export function offsetCapMetadata(
  requestedOffset: number,
  offsetCapped: boolean,
  maxOffset: number = MAX_LIST_OFFSET
) {
  return offsetCapped
    ? {
        offset_requested: requestedOffset,
        offset_capped: true,
        offset_max: maxOffset,
      }
    : {};
}
