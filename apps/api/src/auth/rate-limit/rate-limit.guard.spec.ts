import { EventEmitter } from 'node:events';
import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PLAN_LIMITS } from '@asobeast/shared';
import type { Env } from '../../config/env';
import { AbuseMonitor } from '../abuse/abuse-monitor.service';
import type { AccountUser } from '../auth.types';
import { RateLimitExceededError } from './rate-limit.errors';
import { RateLimitGuard } from './rate-limit.guard';
import { RequestRateLimiter } from './request-rate.limiter';

const USER = {
  workspaceId: 'ws_acme',
  workspace: { plan: 'indie', trialEndsAt: null, planExpiresAt: null },
} as unknown as AccountUser;

const REFUSAL = new RateLimitExceededError({
  window: 'minute',
  rateClass: 'write',
  plan: 'indie',
  limit: PLAN_LIMITS.indie.apiWritesPerMinute as number,
  resetSeconds: 12,
  upgradeTo: 'ultimate',
});

class FakeResponse extends EventEmitter {
  readonly headers: Record<string, string> = {};

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }
}

function contextFor(res: FakeResponse): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ user: USER, method: 'POST', path: '/apps' }),
      getResponse: () => res,
    }),
    getHandler: () => () => undefined,
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  const acquire = jest.fn();
  const consume = jest.fn();
  const recordRefusal = jest.fn();

  const guard = new RateLimitGuard(
    new Reflector(),
    { acquire, consume } as unknown as RequestRateLimiter,
    { get: () => true } as unknown as ConfigService<Env, true>,
    { recordRefusal } as unknown as AbuseMonitor,
  );

  beforeEach(() => {
    acquire.mockReset().mockResolvedValue(null);
    consume.mockReset().mockResolvedValue([]);
    recordRefusal.mockReset().mockResolvedValue(undefined);
  });

  it('admits a request that is inside every window', async () => {
    await expect(
      guard.canActivate(contextFor(new FakeResponse())),
    ).resolves.toBe(true);
  });

  it('releases the parallel slot once the response settles', async () => {
    const release = jest.fn().mockResolvedValue(undefined);
    acquire.mockResolvedValue(release);
    const res = new FakeResponse();

    await guard.canActivate(contextFor(res));
    res.emit('finish');
    res.emit('close');

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('answers a refusal with the headers of the window that closed', async () => {
    consume.mockRejectedValue(REFUSAL);
    const res = new FakeResponse();

    await expect(guard.canActivate(contextFor(res))).rejects.toBe(REFUSAL);
    expect(res.headers).toMatchObject({
      'RateLimit-Limit': String(REFUSAL.detail.limit),
      'RateLimit-Remaining': '0',
      'RateLimit-Reset': '12',
    });
  });

  it('records the refusal for abuse review', async () => {
    consume.mockRejectedValue(REFUSAL);

    await expect(
      guard.canActivate(contextFor(new FakeResponse())),
    ).rejects.toBe(REFUSAL);
    expect(recordRefusal).toHaveBeenCalledWith({
      workspaceId: 'ws_acme',
      method: 'POST',
      route: '/apps',
      rateClass: 'write',
    });
  });

  it('still refuses cleanly when the abuse counter is unreachable', async () => {
    consume.mockRejectedValue(REFUSAL);
    recordRefusal.mockRejectedValue(new Error('redis is down'));

    await expect(
      guard.canActivate(contextFor(new FakeResponse())),
    ).rejects.toBe(REFUSAL);
  });
});
