/**
 * Unwrap API response from backend.
 * Backend uses TransformInterceptor and returns { data, timestamp }.
 * This helper supports both wrapped and unwrapped responses for backward compatibility.
 */
export function unwrapResponse<T>(res: { data?: T | { data?: T }; [key: string]: unknown }): T {
  const d = res?.data;
  if (d !== null && d !== undefined && typeof d === 'object' && 'data' in (d as object)) {
    return (d as { data?: T }).data as T;
  }
  return d as T;
}

/** Ensure value is an array (for list endpoints that may return wrapped or raw array). */
export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  if (value !== null && typeof value === 'object' && 'data' in (value as object) && Array.isArray((value as { data: unknown }).data)) {
    return (value as { data: T[] }).data;
  }
  return [];
}

/** Normalize list response: handles { data: [], meta? } or raw array. */
export function unwrapListResponse<T, M = { total?: number; page?: number; limit?: number; totalPages?: number }>(
  res: { data?: unknown },
): { data: T[]; meta?: M } {
  const raw = unwrapResponse<{ data?: T[]; meta?: M } | T[]>(res);
  if (Array.isArray(raw)) return { data: raw };
  const list = raw && typeof raw === 'object' && 'data' in (raw as object) ? (raw as { data?: T[] }).data : raw;
  return {
    data: asArray(list),
    meta: raw && typeof raw === 'object' && 'meta' in (raw as object) ? (raw as { meta: M }).meta : undefined,
  };
}
