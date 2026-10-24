import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { AlertPayload } from '@asobeast/shared';
import { Env } from '../config/env';
import { WebhookDelivery, WebhookRateLimitedError } from './webhook-delivery';

const BODY = 'y'.repeat(1024 * 1024);

const SENT = 5;

const PAYLOAD = {
  event: 'rank.drop',
  appId: 'app_1',
  appName: 'Fixture',
  store: 'APP_STORE',
  country: 'us',
  occurredAt: '2026-07-27T00:00:00.000Z',
} as unknown as AlertPayload;

const configOf = (allowPrivate = true) =>
  ({
    get: (key: string) =>
      key === 'WEBHOOK_ALLOW_PRIVATE_TARGETS' ? allowPrivate : undefined,
  }) as unknown as ConfigService<Env, true>;

describe('WebhookDelivery', () => {
  let server: Server;
  let url: string;
  let status = 200;
  let headers: Record<string, string> = {};
  let answer = BODY;
  let peakSockets = 0;
  let openSockets = 0;

  beforeAll(async () => {
    server = createServer((_req, res) =>
      res.writeHead(status, headers).end(answer),
    );
    server.on('connection', (socket) => {
      openSockets += 1;
      peakSockets = Math.max(peakSockets, openSockets);
      socket.on('close', () => {
        openSockets -= 1;
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  beforeEach(() => {
    status = 200;
    headers = {};
    answer = BODY;
    peakSockets = 0;
    openSockets = 0;
  });

  const drainedSockets = async (): Promise<number> => {
    for (let waited = 0; waited < 200 && openSockets > 0; waited += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return openSockets;
  };

  it('frees the socket a delivered webhook used', async () => {
    const delivery = new WebhookDelivery(configOf());

    for (let sent = 0; sent < SENT; sent++) {
      await delivery.send(url, null, PAYLOAD);
    }
    await delivery.onModuleDestroy();

    expect(await drainedSockets()).toBe(0);
    expect(peakSockets).toBeLessThan(SENT);
  });

  it('frees the socket a refused webhook used', async () => {
    status = 500;
    const delivery = new WebhookDelivery(configOf());

    for (let sent = 0; sent < SENT; sent++) {
      await expect(delivery.send(url, null, PAYLOAD)).rejects.toThrow(
        'responded 500',
      );
    }
    await delivery.onModuleDestroy();

    expect(await drainedSockets()).toBe(0);
    expect(peakSockets).toBeLessThan(SENT);
  });

  it('frees the socket a test attempt used', async () => {
    const delivery = new WebhookDelivery(configOf());

    for (let sent = 0; sent < SENT; sent++) {
      await expect(delivery.attempt(url, null, PAYLOAD)).resolves.toEqual({
        delivered: true,
        status: 200,
      });
    }
    await delivery.onModuleDestroy();

    expect(await drainedSockets()).toBe(0);
    expect(peakSockets).toBeLessThan(SENT);
  });

  describe('a rate limited delivery', () => {
    const rejection = async () => {
      status = 429;
      const delivery = new WebhookDelivery(configOf());
      const error = await delivery
        .send(`${url}/secret-token`, null, PAYLOAD)
        .catch((caught: unknown) => caught);
      await delivery.onModuleDestroy();
      return error;
    };

    it('waits as long as the service asks', async () => {
      headers = { 'retry-after': '7' };
      const error = await rejection();

      expect(error).toBeInstanceOf(WebhookRateLimitedError);
      expect((error as WebhookRateLimitedError).retryAfterMs).toBe(7000);
      expect((error as Error).message).toBe(
        `${new URL(url).host}/… asked to retry after 7 s`,
      );
    });

    it('prefers the delay telegram writes in its body', async () => {
      headers = { 'retry-after': '3' };
      answer = JSON.stringify({ ok: false, parameters: { retry_after: 12 } });

      expect(
        ((await rejection()) as WebhookRateLimitedError).retryAfterMs,
      ).toBe(12_000);
    });

    it('reads the header when the body is not json', async () => {
      headers = { 'retry-after': '3' };

      expect(
        ((await rejection()) as WebhookRateLimitedError).retryAfterMs,
      ).toBe(3000);
    });

    it('waits five seconds when the service names no delay', async () => {
      expect(
        ((await rejection()) as WebhookRateLimitedError).retryAfterMs,
      ).toBe(5000);
    });

    it('waits at most fifteen minutes', async () => {
      headers = { 'retry-after': '3600' };

      expect(
        ((await rejection()) as WebhookRateLimitedError).retryAfterMs,
      ).toBe(15 * 60_000);
    });

    it('reads a delay given as a date', async () => {
      headers = {
        'retry-after': new Date(Date.now() + 30_000).toUTCString(),
      };
      const wait = ((await rejection()) as WebhookRateLimitedError)
        .retryAfterMs;

      expect(wait).toBeGreaterThan(20_000);
      expect(wait).toBeLessThanOrEqual(30_000);
    });
  });

  it('names a failed target without its token', async () => {
    status = 500;
    const delivery = new WebhookDelivery(configOf());
    const error = (await delivery
      .send(`${url}/secret-token`, null, PAYLOAD)
      .catch((caught: unknown) => caught)) as Error;
    await delivery.onModuleDestroy();

    expect(error.message).toBe(`Webhook ${new URL(url).host}/… responded 500`);
    expect(error.message).not.toContain('secret-token');
  });

  it('never names the token a telegram url carries', async () => {
    status = 500;
    const delivery = new WebhookDelivery(configOf());
    const target = `${url}/bot123:SECRET/sendMessage?chat_id=-100`;
    const error = (await delivery
      .send(target, null, PAYLOAD)
      .catch((caught: unknown) => caught)) as Error;
    await delivery.onModuleDestroy();

    expect(error.message).not.toContain('SECRET');
  });

  it('reports a rate limit to the test endpoint as undelivered', async () => {
    status = 429;
    const delivery = new WebhookDelivery(configOf());

    await expect(delivery.attempt(url, null, PAYLOAD)).resolves.toEqual({
      delivered: false,
      status: 429,
    });
    await delivery.onModuleDestroy();
  });
});

describe('WebhookDelivery bare hostnames', () => {
  let server: Server;
  let port: number;
  let reached = 0;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      reached += 1;
      res.writeHead(200).end('ok');
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, 'localhost', resolve);
    });
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  beforeEach(() => {
    reached = 0;
  });

  it('delivers to localhost when private targets are opted in', async () => {
    const delivery = new WebhookDelivery(configOf(true));

    await expect(
      delivery.attempt(`http://localhost:${port}/hook`, null, PAYLOAD),
    ).resolves.toEqual({ delivered: true, status: 200 });
    expect(reached).toBe(1);
    await delivery.onModuleDestroy();
  });

  it('accepts a bare hostname at registration when private targets are opted in', async () => {
    const delivery = new WebhookDelivery(configOf(true));

    expect(() => delivery.assertTarget('http://hooks:8080/x')).not.toThrow();
    await delivery.onModuleDestroy();
  });

  it('refuses a bare hostname at registration by default', async () => {
    const delivery = new WebhookDelivery(configOf(false));

    expect(() => delivery.assertTarget('http://hooks:8080/x')).toThrow(
      'resolves inside this network',
    );
    await delivery.onModuleDestroy();
  });

  it('does not deliver to localhost by default', async () => {
    const delivery = new WebhookDelivery(configOf(false));

    await expect(
      delivery.attempt(`http://localhost:${port}/hook`, null, PAYLOAD),
    ).resolves.toEqual({ delivered: false, status: null });
    expect(reached).toBe(0);
    await delivery.onModuleDestroy();
  });
});
