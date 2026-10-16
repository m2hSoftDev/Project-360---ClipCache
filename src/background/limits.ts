/**
 * Plan limit verification for ClipCache.
 *
 * Free users: local storage only, max 20 screenshots.
 * Paid users: higher limit / unlimited cloud sync.
 */

export const FREE_PLAN_LIMIT = 20;

export interface LimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  message?: string;
}

/**
 * Checks whether the user is permitted to capture an additional screenshot.
 */
export function checkCaptureLimit(
  currentCount: number,
  isPaid = false,
  customLimit = FREE_PLAN_LIMIT
): LimitCheckResult {
  if (isPaid) {
    return {
      allowed: true,
      currentCount,
      limit: Infinity,
      remaining: Infinity,
    };
  }

  const allowed = currentCount < customLimit;
  const remaining = Math.max(0, customLimit - currentCount);

  return {
    allowed,
    currentCount,
    limit: customLimit,
    remaining,
    message: allowed
      ? undefined
      : `Free limit reached (${customLimit}/${customLimit}). Delete a capture to add a new one.`,
  };
}

/**
 * Quick boolean check if current count is strictly under limit.
 */
export function isUnderLimit(
  currentCount: number,
  limit = FREE_PLAN_LIMIT
): boolean {
  return currentCount < limit;
}

/**
 * Enforces the capture limit, throwing an error if the limit is reached or exceeded.
 */
export function assertUnderLimit(
  currentCount: number,
  isPaid = false,
  limit = FREE_PLAN_LIMIT
): void {
  const result = checkCaptureLimit(currentCount, isPaid, limit);
  if (!result.allowed) {
    throw new Error(result.message);
  }
}
