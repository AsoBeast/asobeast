import { once } from 'node:events';
import { createServer, type Server } from 'node:net';
import { Logger } from '@nestjs/common';
import { RedisUnavailableError } from './redis.errors';
import {
  FAIL_FAST_COMMAND_TIMEOUT_MS,
  FAIL_FAST_RETRY_AFTER_SECONDS,
  FailFastRedis,
} from './fail-fast-redis';

const FAST_REFUSAL_MS = FAIL_FAST_COMMAND_TIMEOUT_MS / 2;
const HUNG_REFUSAL_MS = FAIL_FAST_COMMAND_TIMEOUT_MS * 3;

const OK_REPLY = '+OK\r\n';
const READY_REPLY = '$9\r\nloading:0\r\n';

function commandsIn(chunk: string): string[] {
  return chunk.split(/(?=\*\d+\r\n\$)/).filter((part) => part.length > 0);
}

function listening(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
}

function closed(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function unusedPort(): Promise<number> {
  const server = createServer();
  const port = await listening(server);
  await closed(server);
  return port;
}

async function elapsedMs(work: Promise<unknown>): Promise<number> {
  const started = Date.now();
  await work.catch(() => undefined);
  return Date.now() - started;
}

describe('FailFastRedis', () => {
  const opened: FailFastRedis[] = [];
  const open = (port: number): FailFastRedis => {
    const redis = FailFastRedis.connect({ host: '127.0.0.1', port });
    opened.push(redis);
    return redis;
  };

  afterEach(() => {
    for (const redis of opened.splice(0)) redis.onApplicationShutdown();
    jest.restoreAllMocks();
  });

  it('refuses at once while nothing listens, instead of waiting for redis', async () => {
    const redis = open(await unusedPort());
    const work = redis.run((client) => client.incr('key'));

    await expect(work).rejects.toBeInstanceOf(RedisUnavailableError);
    expect(
      await elapsedMs(redis.run((client) => client.incr('key'))),
    ).toBeLessThan(FAST_REFUSAL_MS);
  });

  it('carries the wait a caller should honour', async () => {
    const redis = open(await unusedPort());

    await expect(
      redis.run((client) => client.incr('key')),
    ).rejects.toMatchObject({
      retryAfterSeconds: FAIL_FAST_RETRY_AFTER_SECONDS,
    });
  });

  it('gives up on a redis that is ready and then stops answering', async () => {
    const stalled = createServer((socket) => {
      socket.on('error', () => undefined);
      socket.on('data', (chunk) => {
        for (const command of commandsIn(chunk.toString())) {
          if (/incr/i.test(command)) continue;
          socket.write(/info/i.test(command) ? READY_REPLY : OK_REPLY);
        }
      });
    });
    const redis = open(await listening(stalled));
    await once(redis.client, 'ready');

    const waited = await elapsedMs(redis.run((client) => client.incr('key')));

    redis.onApplicationShutdown();
    await closed(stalled);
    expect(waited).toBeGreaterThanOrEqual(FAIL_FAST_COMMAND_TIMEOUT_MS - 50);
    expect(waited).toBeLessThan(HUNG_REFUSAL_MS);
  });

  it('answers the fallback when the caller chose to fail open', async () => {
    const redis = open(await unusedPort());

    await expect(
      redis.runOpen((client) => client.incr('key'), -1),
    ).resolves.toBe(-1);
  });

  it('warns once per interval however many commands fail', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockReturnValue();
    const redis = open(await unusedPort());

    for (let attempt = 0; attempt < 5; attempt++) {
      await redis.runOpen((client) => client.incr('key'), 0);
    }

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('closes its connection once the application has shut down', async () => {
    const redis = open(await unusedPort());

    const disconnect = jest.spyOn(redis.client, 'disconnect');

    redis.onApplicationShutdown();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
