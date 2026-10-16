import { describe, it, expect } from 'vitest';
import {
  checkCaptureLimit,
  isUnderLimit,
  assertUnderLimit,
  FREE_PLAN_LIMIT,
} from '@/background/limits';

describe('Plan Limit Logic (Phase 3 Regression & Requirements)', () => {
  it('allows capture when under the free plan limit (0 items)', () => {
    const result = checkCaptureLimit(0, false);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(FREE_PLAN_LIMIT);
    expect(result.message).toBeUndefined();
  });

  it('allows capture when under the free plan limit (10 items)', () => {
    const result = checkCaptureLimit(10, false);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
    expect(result.message).toBeUndefined();
  });

  it('allows capture when just under the limit (19 out of 20 items)', () => {
    const result = checkCaptureLimit(19, false);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
    expect(result.message).toBeUndefined();
  });

  it('blocks capture when exactly AT the free plan limit (20 items) with required message', () => {
    const result = checkCaptureLimit(20, false);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.message).toBe(
      'Free limit reached (20/20). Delete a capture to add a new one.'
    );
  });

  it('blocks capture when OVER the free plan limit (21 items)', () => {
    const result = checkCaptureLimit(21, false);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.message).toBe(
      'Free limit reached (20/20). Delete a capture to add a new one.'
    );
  });

  it('blocks capture when well OVER the free plan limit (25 items)', () => {
    const result = checkCaptureLimit(25, false);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.message).toBe(
      'Free limit reached (20/20). Delete a capture to add a new one.'
    );
  });

  it('adapts message when FREE_PLAN_LIMIT constant or customLimit changes', () => {
    const customLimit = 50;
    const under = checkCaptureLimit(49, false, customLimit);
    expect(under.allowed).toBe(true);
    expect(under.remaining).toBe(1);

    const atLimit = checkCaptureLimit(50, false, customLimit);
    expect(atLimit.allowed).toBe(false);
    expect(atLimit.message).toBe(
      'Free limit reached (50/50). Delete a capture to add a new one.'
    );

    const overLimit = checkCaptureLimit(55, false, customLimit);
    expect(overLimit.allowed).toBe(false);
    expect(overLimit.message).toBe(
      'Free limit reached (50/50). Delete a capture to add a new one.'
    );
  });

  it('always allows capture for paid users regardless of count', () => {
    const result = checkCaptureLimit(100, true);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(Infinity);
    expect(result.limit).toBe(Infinity);
    expect(result.message).toBeUndefined();
  });

  it('isUnderLimit returns correct boolean for under, at, and over limit', () => {
    expect(isUnderLimit(0, 20)).toBe(true);
    expect(isUnderLimit(19, 20)).toBe(true);
    expect(isUnderLimit(20, 20)).toBe(false);
    expect(isUnderLimit(21, 20)).toBe(false);
    expect(isUnderLimit(25, 20)).toBe(false);
  });

  it('assertUnderLimit passes when under limit and throws when at or over limit', () => {
    expect(() => assertUnderLimit(19, false)).not.toThrow();

    expect(() => assertUnderLimit(20, false)).toThrowError(
      'Free limit reached (20/20). Delete a capture to add a new one.'
    );

    expect(() => assertUnderLimit(25, false)).toThrowError(
      'Free limit reached (20/20). Delete a capture to add a new one.'
    );

    expect(() => assertUnderLimit(100, true)).not.toThrow();
  });
});
