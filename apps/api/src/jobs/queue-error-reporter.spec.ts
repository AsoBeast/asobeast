import { EventEmitter } from 'node:events';
import { WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Queue, Worker } from 'bullmq';
import { RedisOutageLog } from '../redis/redis-outage-log';
import { isRedisUnreachable, QueueErrorReporter } from './queue-error-reporter';

function unconnected<T extends EventEmitter>(type: { prototype: object }): T {
  const emitter = Object.create(type.prototype) as T;
  EventEmitter.call(emitter);
  return emitter;
}

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

const coded = (code: string, message = '') =>
  Object.assign(new Error(message), { code });

describe('isRedisUnreachable', () => {
  it.each([
    ['a refused connection', coded('ECONNREFUSED')],
    ['an unknown host', coded('ENOTFOUND', 'getaddrinfo ENOTFOUND redis')],
    ['a dns failure', coded('EAI_AGAIN')],
    ['a timed out connection', coded('ETIMEDOUT')],
    ['a reset connection', coded('ECONNRESET')],
    ['an unreachable host', coded('EHOSTUNREACH')],
    ['a network that is down', coded('ENETDOWN')],
    ['an aborted connection', coded('ECONNABORTED')],
    ['an address that is not available', coded('EADDRNOTAVAIL')],
    [
      'an exhausted retry budget',
      Object.assign(
        new Error(
          'Reached the max retries per request limit (which is 20). Refer to "maxRetriesPerRequest" option for details.',
        ),
        { name: 'MaxRetriesPerRequestError' },
      ),
    ],
    ['a closed connection', new Error('Connection is closed.')],
    [
      'a refusal on every address',
      Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' }),
    ],
  ])('treats %s as an outage', (_name, error) => {
    expect(isRedisUnreachable(error)).toBe(true);
  });

  it.each([
    ['a lost job lock', new Error('Missing lock for job 1. moveToFinished')],
    ['a redis reply', new Error('WRONGTYPE Operation against a key')],
  ])('treats %s as a fault, not an outage', (_name, error) => {
    expect(isRedisUnreachable(error)).toBe(false);
  });
});

describe('QueueErrorReporter', () => {
  const refused = () =>
    Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' });

  let queue: Queue;
  let worker: Worker;
  let reporter: QueueErrorReporter;
  let printed: jest.SpyInstance;
  let warned: jest.SpyInstance;
  let failed: jest.SpyInstance;

  beforeEach(() => {
    queue = unconnected<Queue>(Queue);
    worker = unconnected<Worker>(Worker);
    const instances = [
      queue,
      queue,
      new ProbeWorker(worker),
      new UnstartedWorker(),
      new Date(),
    ];
    const discovery = {
      getProviders: () => instances.map((instance) => ({ instance })),
    } as unknown as DiscoveryService;
    reporter = new QueueErrorReporter(discovery, new RedisOutageLog());
    printed = jest.spyOn(console, 'error').mockReturnValue();
    warned = jest.spyOn(Logger.prototype, 'warn').mockReturnValue();
    failed = jest.spyOn(Logger.prototype, 'error').mockReturnValue();
  });

  afterEach(() => jest.restoreAllMocks());

  it('leaves bullmq printing every reconnect attempt until it is attached', () => {
    queue.emit('error', refused());
    worker.emit('error', refused());

    expect(printed).toHaveBeenCalledTimes(2);
  });

  it('names a redis outage once in the log instead of printing every reconnect attempt', () => {
    reporter.onApplicationBootstrap();

    for (let attempt = 0; attempt < 11; attempt++) {
      queue.emit('error', refused());
      worker.emit('error', refused());
    }

    expect(printed).not.toHaveBeenCalled();
    expect(warned).toHaveBeenCalledTimes(1);
    expect(warned).toHaveBeenCalledWith(
      expect.stringMatching(/^redis is unreachable.*: ECONNREFUSED$/),
    );
  });

  it('listens once to a queue listed twice', () => {
    reporter.onApplicationBootstrap();

    expect(queue.listenerCount('error')).toBe(1);
    expect(worker.listenerCount('error')).toBe(1);
  });

  it('logs a worker fault that is not an outage as an error', () => {
    reporter.onApplicationBootstrap();
    const fault = new Error('Missing lock for job 1. moveToFinished');

    worker.emit('error', fault);

    expect(failed).toHaveBeenCalledWith(fault.message, fault.stack);
    expect(warned).not.toHaveBeenCalled();
    expect(printed).not.toHaveBeenCalled();
  });

  it('boots past a worker host whose worker was never created', () => {
    expect(() => reporter.onApplicationBootstrap()).not.toThrow();
    expect(worker.listenerCount('error')).toBe(1);
  });

  it('names a fault that carries no message by its code', () => {
    reporter.onApplicationBootstrap();
    const fault = coded('EPROTO');

    worker.emit('error', fault);

    expect(failed).toHaveBeenCalledWith('EPROTO', fault.stack);
  });
});
