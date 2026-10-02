import { createServer, connect, type Server, type Socket } from 'node:net';

const LOOPBACK = '127.0.0.1';

export interface RedisOutage {
  port: number;
  sever(): Promise<void>;
  restore(): Promise<void>;
  stop(): Promise<void>;
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, LOOPBACK, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function closed(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

export async function startRedisOutage(
  upstreamPort: number,
): Promise<RedisOutage> {
  const sockets = new Set<Socket>();
  const server = createServer((client) => {
    const upstream = connect(upstreamPort, LOOPBACK);
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.on('error', () => socket.destroy());
      socket.on('close', () => {
        sockets.delete(socket);
        client.destroy();
        upstream.destroy();
      });
    }
    client.pipe(upstream);
    upstream.pipe(client);
  });
  await listen(server, 0);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('the redis proxy did not bind a tcp port');
  }
  const { port } = address;

  const sever = async (): Promise<void> => {
    const stopped = closed(server);
    for (const socket of sockets) socket.destroy();
    await stopped;
  };

  return {
    port,
    sever,
    restore: () => listen(server, port),
    stop: async () => {
      if (server.listening) await sever();
    },
  };
}
