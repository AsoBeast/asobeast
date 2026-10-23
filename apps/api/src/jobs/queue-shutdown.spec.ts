import { WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { FlowProducer, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { FailFastRedis } from '../redis/fail-fast-redis';
import type { HttpDrain } from './http-drain';
import { QueueShutdown, UNREACHABLE_DRAIN_MS } from './queue-shutdown';

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

const refused = () =>
  Promise.reject(Object.assign(new Error(''), { code: 'ECONNREFUSED' }));

function withBackend<T extends object>(
  type: { prototype: T },
  close: jest.Mock,
): T {
  return Object.assign(Object.create(type.prototype) as T, {
    getBackend: () => ({ close }),
  });
}

describe('QueueShutdown', () => {
  const closeWorker = jest.fn<Promise<void>, [boolean?]>();
  const closeQueue = jest.fn<Promise<void>, [boolean?]>();
  const closeFlow = jest.fn<Promise<void>, [boolean?]>();
  const cutAfter = jest.fn<void, [number]>();
  const drain = { cutAfter } as unknown as HttpDrain;
  let warn: jest.SpyInstance;

  const shutdownWith = (ping: jest.Mock<Promise<string>, []>) => {
    const instances = [
      new ProbeWorker({ close: closeWorker } as unknown as Worker),
      new UnstartedWorker(),
      withBackend(Queue, closeQueue),
      withBackend(FlowProducer, closeFlow),
      new Date(),
    ];
    const discovery = {
      getProviders: () => instances.map((instance) => ({ instance })),
    } as unknown as DiscoveryService;
    return new QueueShutdown(
      discovery,
      new FailFastRedis({ ping } as unknown as Redis),
      drain,
    );
  };

  beforeEach(() => {
    for (const close of [closeWorker, closeQueue, closeFlow]) {
      close.mockReset().mockResolvedValue(undefined);
    }
    cutAfter.mockReset();
    warn = jest.spyOn(Logger.prototype, 'warn').mockReturnValue();
  });

  afterEach(() => jest.restoreAllMocks());

  it('leaves queues and workers to drain while redis answers', async () => {
    await shutdownWith(
      jest.fn<Promise<string>, []>().mockResolvedValue('PONG'),
    ).beforeApplicationShutdown();

    expect(closeWorker).not.toHaveBeenCalled();
    expect(closeQueue).not.toHaveBeenCalled();
    expect(closeFlow).not.toHaveBeenCalled();
    expect(cutAfter).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('drains as usual when redis answers on a second try', async () => {
    const ping = jest
      .fn<Promise<string>, []>()
      .mockImplementationOnce(refused)
      .mockResolvedValue('PONG');

    await shutdownWith(ping).beforeApplicationShutdown();

    expect(ping).toHaveBeenCalledTimes(2);
    expect(closeWorker).not.toHaveBeenCalled();
    expect(cutAfter).not.toHaveBeenCalled();
  });

  it('closes every worker, queue and flow producer at once when redis is down', async () => {
    const ping = jest.fn<Promise<string>, []>().mockImplementation(refused);

    await shutdownWith(ping).beforeApplicationShutdown();

    expect(ping).toHaveBeenCalledTimes(3);
    expect(closeWorker.mock.calls).toEqual([[true]]);
    expect(closeQueue.mock.calls).toEqual([[true]]);
    expect(closeFlow.mock.calls).toEqual([[true]]);
    expect(cutAfter.mock.calls).toEqual([[UNREACHABLE_DRAIN_MS]]);
  });

  it('finishes closing the rest when one connection refuses to close', async () => {
    const ping = jest.fn<Promise<string>, []>().mockImplementation(refused);
    closeQueue.mockRejectedValue(new Error('ERR unknown command'));

    await expect(
      shutdownWith(ping).beforeApplicationShutdown(),
    ).resolves.toBeUndefined();

    expect(closeWorker.mock.calls).toEqual([[true]]);
    expect(closeFlow.mock.calls).toEqual([[true]]);
  });

  it('drains as usual when redis answers the ping with an error', async () => {
    const answered = {
      runOpen: jest
        .fn()
        .mockRejectedValue(new Error('NOAUTH Authentication required.')),
    } as unknown as FailFastRedis;
    const discovery = {
      getProviders: () =>
        [withBackend(Queue, closeQueue)].map((instance) => ({ instance })),
    } as unknown as DiscoveryService;

    await expect(
      new QueueShutdown(discovery, answered, drain).beforeApplicationShutdown(),
    ).resolves.toBeUndefined();

    expect(closeQueue).not.toHaveBeenCalled();
    expect(cutAfter).not.toHaveBeenCalled();
  });

  it('arms the http cut before it closes anything', async () => {
    const ping = jest.fn<Promise<string>, []>().mockImplementation(refused);

    await shutdownWith(ping).beforeApplicationShutdown();

    expect(cutAfter.mock.invocationCallOrder[0]).toBeLessThan(
      closeWorker.mock.invocationCallOrder[0],
    );
  });

  it('names what it closed and when the open requests are cut', async () => {
    const ping = jest.fn<Promise<string>, []>().mockImplementation(refused);

    await shutdownWith(ping).beforeApplicationShutdown();

    expect(warn).toHaveBeenCalledWith(
      `shutdown: redis is unreachable, force closed 1 workers and 2 queue connections, open http requests are cut in ${UNREACHABLE_DRAIN_MS} ms`,
    );
  });
});
