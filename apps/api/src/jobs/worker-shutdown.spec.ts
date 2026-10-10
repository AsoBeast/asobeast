import { WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { FailFastRedis } from '../redis/fail-fast-redis';
import { WorkerShutdown } from './worker-shutdown';

class ProbeWorker extends WorkerHost {
  constructor(private readonly probe: Worker) {
    super();
  }

  override get worker(): Worker {
    return this.probe;
  }

  process(): Promise<void> {
    return Promise.resolve();
  }
}

class UnstartedWorker extends WorkerHost {
  process(): Promise<void> {
    return Promise.resolve();
  }
}

describe('WorkerShutdown', () => {
  const close = jest.fn<Promise<void>, [boolean?]>();
  const worker = { close } as unknown as Worker;

  const shutdownWith = (ping: () => Promise<string>) => {
    const discovery = {
      getProviders: () =>
        [new ProbeWorker(worker), new UnstartedWorker(), new Date()].map(
          (instance) => ({ instance }),
        ),
    } as unknown as DiscoveryService;
    return new WorkerShutdown(
      discovery,
      new FailFastRedis({ ping } as unknown as Redis),
    );
  };

  beforeEach(() => close.mockReset().mockResolvedValue(undefined));

  afterEach(() => jest.restoreAllMocks());

  it('leaves workers to drain their jobs while redis answers', async () => {
    await shutdownWith(() =>
      Promise.resolve('PONG'),
    ).beforeApplicationShutdown();

    expect(close).not.toHaveBeenCalled();
  });

  it('stops every worker at once when redis is down, since no job can finish', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockReturnValue();
    await shutdownWith(() =>
      Promise.reject(Object.assign(new Error(''), { code: 'ECONNREFUSED' })),
    ).beforeApplicationShutdown();

    expect(close.mock.calls).toEqual([[true]]);
  });
});
