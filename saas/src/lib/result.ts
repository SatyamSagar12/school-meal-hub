/**
 * The single return shape for every server action and service function.
 * Never throw raw errors across a boundary — return a Result.
 */

export type Ok<T> = { ok: true; data: T };

export type Fail = {
  ok: false;
  error: { code: string; message: string };
};

export type Result<T> = Ok<T> | Fail;

export function ok(): Ok<null>;
export function ok<T>(data: T): Ok<T>;
export function ok<T>(data?: T): Ok<T | null> {
  return { ok: true, data: data ?? null };
}

export function fail(code: string, message: string): Fail {
  return { ok: false, error: { code, message } };
}

/** Common error codes, so callers can branch without matching on strings. */
export const ErrorCode = {
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  UNAUTHORIZED: "UNAUTHORIZED",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Wraps a throwing operation. Logs the real error server-side and returns a
 * generic message, so internal detail never reaches a caller.
 */
export async function attempt<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    console.error(`[${label}]`, error);
    return fail(ErrorCode.INTERNAL, "Something went wrong. Please try again.");
  }
}
