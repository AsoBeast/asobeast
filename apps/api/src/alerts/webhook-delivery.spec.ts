import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { AlertPayload } from '@asobeast/shared';
import { Env } from '../config/env';
import { WebhookDelivery } from './webhook-delivery';

const BODY = 'y'.repeat(1024 * 1024);

const PAYLOAD = {
  event: 'rank.drop',
  appId: 'app_1',
  appName: 'Fixture',
  store: 'APP_STORE',
  country: 'us',
  occurredAt: '2026-07-27T00:00:00.000Z',
} as unknown as AlertPayload;

const configOf = () =>
  ({
    get: () => true,
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

  it('frees the socket a delivered webhook used', async () => {
    const delivery = new WebhookDelivery(configOf());

    for (let sent = 0; sent < 5; sent++) {
      await delivery.send(url, null, PAYLOAD);
    }
    await delivery.onModuleDestroy();

    expect(peakSockets).toBeLessThanOrEqual(2);
  });

  it('frees the socket a refused webhook used', async () => {
    status = 500;
    const delivery = new WebhookDelivery(configOf());

    for (let sent = 0; sent < 5; sent++) {
      await expect(delivery.send(url, null, PAYLOAD)).rejects.toThrow(
        'responded 500',
      );
    }
    await delivery.onModuleDestroy();

    expect(peakSockets).toBeLessThanOrEqual(2);
  });

  it('frees the socket a test attempt used', async () => {
    const delivery = new WebhookDelivery(configOf());

    for (let sent = 0; sent < 5; sent++) {
      await expect(delivery.attempt(url, null, PAYLOAD)).resolves.toEqual({
        delivered: true,
        status: 200,
      });
    }
    await delivery.onModuleDestroy();

    expect(peakSockets).toBeLessThanOrEqual(2);
  });
});
