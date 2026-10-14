import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FailFastRedis } from './fail-fast-redis';
import { QueueReachableGuard } from './queue-reachable.guard';
import { QUEUES_WORK_KEY } from './queues-work.decorator';
import { RedisUnavailableError } from './redis.errors';

function contextWith(metadata: Record<string, unknown>): ExecutionContext {
  const handler = () => undefined;
  for (const [key, value] of Object.entries(metadata)) {
    Reflect.defineMetadata(key, value, handler);
  }
  return {
    getHandler: () => handler,
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

function guardWith(run: jest.Mock): QueueReachableGuard {
  return new QueueReachableGuard(new Reflector(), {
    run,
  } as unknown as FailFastRedis);
}

describe('QueueReachableGuard', () => {
  it('lets a route that queues nothing through without asking redis', async () => {
    const run = jest.fn();

    await expect(guardWith(run).canActivate(contextWith({}))).resolves.toBe(
      true,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it('asks redis before a route that queues work', async () => {
    const run = jest.fn().mockResolvedValue('PONG');

    await expect(
      guardWith(run).canActivate(contextWith({ [QUEUES_WORK_KEY]: true })),
    ).resolves.toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('refuses a route that queues work while redis cannot be reached', async () => {
    const run = jest.fn().mockRejectedValue(new RedisUnavailableError(5));

    await expect(
      guardWith(run).canActivate(contextWith({ [QUEUES_WORK_KEY]: true })),
    ).rejects.toBeInstanceOf(RedisUnavailableError);
  });
});
