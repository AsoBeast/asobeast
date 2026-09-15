import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerLimitDetail, ThrottlerStorage } from '@nestjs/throttler';
import { RequestThrottledError } from './rate-limit.errors';
import { RetryAfterThrottlerGuard } from './retry-after-throttler.guard';

const DETAIL: ThrottlerLimitDetail = {
  limit: 10,
  ttl: 60_000,
  key: 'key',
  tracker: '203.0.113.7',
  totalHits: 11,
  timeToExpire: 42,
  isBlocked: true,
  timeToBlockExpire: 42,
};

describe('RetryAfterThrottlerGuard', () => {
  const guard = new RetryAfterThrottlerGuard(
    { throttlers: [] },
    {} as ThrottlerStorage,
    new Reflector(),
  );

  it('refuses with the seconds left until the block expires', async () => {
    const refusal = guard['throwThrottlingException'](
      {} as ExecutionContext,
      DETAIL,
    );

    await expect(refusal).rejects.toBeInstanceOf(RequestThrottledError);
    await expect(refusal).rejects.toMatchObject({
      retryAfterSeconds: 42,
      message: 'Too many attempts from this address. Try again in 42 seconds.',
    });
  });
});
