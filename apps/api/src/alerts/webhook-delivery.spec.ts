import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { AlertPayload } from '@asobeast/shared';
import { Env } from '../config/env';
import { WebhookDelivery } from './webhook-delivery';

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
    get: () => allowPrivate,
  }) as unknown as ConfigService<Env, true>;

describe('WebhookDelivery', () => {
  let server: Server;
  let url: string;
  let status = 200;
  let peakSockets = 0;
  let openSockets = 0;

  beforeAll(async () => {
    server = createServer((_req, res) => res.writeHead(status).end(BODY));
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
    await new Promise<void>((resolve) =>
      server.listen(0, 'localhost', resolve),
    );
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
