import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { fetch } from 'undici';
import { publicOnlyDispatcher } from './webhook-dispatcher';

describe('publicOnlyDispatcher', () => {
  let server: Server;
  let port: number;
  let reached = 0;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      reached += 1;
      res.writeHead(200).end('ok');
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
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

  it('refuses a connection that lands on a loopback address', async () => {
    const dispatcher = publicOnlyDispatcher();
    await expect(
      fetch(`http://127.0.0.1:${port}/hook`, { dispatcher }),
    ).rejects.toThrow();
    expect(reached).toBe(0);
    await dispatcher.close();
  });

  it('refuses a hostname whose dns answer is loopback', async () => {
    const dispatcher = publicOnlyDispatcher();
    await expect(
      fetch(`http://localhost:${port}/hook`, { dispatcher }),
    ).rejects.toThrow();
    expect(reached).toBe(0);
    await dispatcher.close();
  });

  it('reaches the server when private targets are opted in', async () => {
    const dispatcher = publicOnlyDispatcher({ allowPrivate: true });
    const response = await fetch(`http://127.0.0.1:${port}/hook`, {
      dispatcher,
    });
    expect(response.status).toBe(200);
    expect(reached).toBe(1);
    await dispatcher.close();
  });
});
