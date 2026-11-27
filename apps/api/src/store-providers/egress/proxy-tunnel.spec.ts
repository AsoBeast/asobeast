import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { connect, type AddressInfo, type Socket } from 'node:net';
import { Dispatcher, fetch, ProxyAgent } from 'undici';
import { proxyDispatcher } from './egress';
import {
  ProxyTunnelRefusedError,
  TunnelPool,
  tunnelPoolFor,
} from './proxy-tunnel';

const REFUSALS: Record<number, string> = {
  402: 'Payment Required',
  407: 'Proxy Authentication Required',
};

function portOf(server: Server): number {
  return (server.address() as AddressInfo).port;
}

async function listening(server: Server): Promise<Server> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

function refusingProxy(status: number): Server {
  const proxy = createServer((_request, response) => response.end());
  proxy.on('connect', (_request, socket: Socket) => {
    socket.end(
      `HTTP/1.1 ${status} ${REFUSALS[status]}\r\nX-Refusal-Reason: account\r\nContent-Length: 0\r\n\r\n`,
    );
  });
  return proxy;
}

function tunnellingProxy(): Server {
  const proxy = createServer((_request, response) => response.end());
  proxy.on('connect', (request, socket: Socket) => {
    const [host, port] = (request.url ?? '').split(':');
    const upstream = connect(Number(port), host, () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  });
  return proxy;
}

function causeOf(error: unknown): unknown {
  return error instanceof Error ? error.cause : undefined;
}

describe('a proxy tunnel', () => {
  const servers: Server[] = [];
  const dispatchers: Dispatcher[] = [];

  const start = async (server: Server): Promise<number> => {
    servers.push(await listening(server));
    return portOf(server);
  };

  const through = (proxyPort: number): Dispatcher => {
    const dispatcher = proxyDispatcher(`http://127.0.0.1:${proxyPort}`, {
      username: 'pool',
      password: 'secret',
    });
    dispatchers.push(dispatcher);
    return dispatcher;
  };

  afterEach(async () => {
    await Promise.all(dispatchers.splice(0).map((each) => each.close()));
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.closeAllConnections();
            server.close(() => resolve());
          }),
      ),
    );
  });

  it.each([402, 407])(
    'keeps only the status of a %s the proxy answers the tunnel with',
    async (status) => {
      const port = await start(refusingProxy(status));

      const failure: unknown = await fetch('https://store.example/', {
        dispatcher: through(port),
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(TypeError);
      const cause = causeOf(failure);
      expect(cause).toBeInstanceOf(ProxyTunnelRefusedError);
      expect(cause).toMatchObject({
        status,
        message: `refused by the proxy (HTTP ${status})`,
      });
      expect(cause).not.toHaveProperty('headers');
    },
  );

  it('hands over the socket of a tunnel the proxy opens', async () => {
    const originPort = await start(
      createServer((_request, response) =>
        response.end('through', () => response.socket?.end()),
      ),
    );
    const proxyPort = await start(tunnellingProxy());
    const pool = new TunnelPool(`http://127.0.0.1:${proxyPort}`);
    dispatchers.push(pool);

    const { statusCode, socket } = await pool.connect({
      path: `127.0.0.1:${originPort}`,
    });
    socket.end('GET / HTTP/1.1\r\nHost: origin\r\nConnection: close\r\n\r\n');
    const chunks: Buffer[] = [];
    for await (const chunk of socket) chunks.push(chunk as Buffer);

    expect(statusCode).toBe(200);
    expect(Buffer.concat(chunks).toString()).toMatch(/through$/);
  });

  it('carries a whole request through a tunnel the proxy opens', async () => {
    const originPort = await start(
      createServer((_request, response) => response.end('through')),
    );
    const proxyPort = await start(tunnellingProxy());
    const agent = new ProxyAgent({
      uri: `http://127.0.0.1:${proxyPort}`,
      clientFactory: tunnelPoolFor,
      proxyTunnel: true,
    });
    dispatchers.push(agent);

    const response = await fetch(`http://127.0.0.1:${originPort}/`, {
      dispatcher: agent,
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('through');
  });

  it('hands the callback form the socket of a tunnel the proxy opens', async () => {
    const originPort = await start(createServer((_q, r) => r.end()));
    const proxyPort = await start(tunnellingProxy());
    const pool = new TunnelPool(`http://127.0.0.1:${proxyPort}`);
    dispatchers.push(pool);

    const data = await new Promise<Dispatcher.ConnectData>((resolve, reject) =>
      pool.connect({ path: `127.0.0.1:${originPort}` }, (error, answer) =>
        error ? reject(error) : resolve(answer),
      ),
    );
    data.socket.destroy();

    expect(data.statusCode).toBe(200);
  });

  it('hands the callback form the same refusal as the promise form', async () => {
    const proxyPort = await start(refusingProxy(402));
    const pool = new TunnelPool(`http://127.0.0.1:${proxyPort}`);
    dispatchers.push(pool);

    const failure = await new Promise<Error | null>((resolve) =>
      pool.connect({ path: '127.0.0.1:1' }, (error) => resolve(error)),
    );

    expect(failure).toBeInstanceOf(ProxyTunnelRefusedError);
    expect(failure).toMatchObject({ status: 402 });
  });
});
