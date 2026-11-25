import { Dispatcher, Pool } from 'undici';

const OPEN_TUNNEL = 200;
const CAUSE_DEPTH = 5;

export class ProxyTunnelRefusedError extends Error {
  constructor(readonly status: number) {
    super(`refused by the proxy (HTTP ${status})`);
    this.name = 'ProxyTunnelRefusedError';
  }
}

type TunnelOptions = Parameters<Pool['connect']>[0];

type TunnelCallback = (err: Error | null, data: Dispatcher.ConnectData) => void;

function refusalAfterClosing(
  data: Dispatcher.ConnectData,
): ProxyTunnelRefusedError | null {
  if (data.statusCode === OPEN_TUNNEL) return null;
  data.socket.on('error', () => undefined).destroy();
  return new ProxyTunnelRefusedError(data.statusCode);
}

function openedOrRefused(data: Dispatcher.ConnectData): Dispatcher.ConnectData {
  const refusal = refusalAfterClosing(data);
  if (refusal) throw refusal;
  return data;
}

export class TunnelPool extends Pool {
  override connect(options: TunnelOptions): Promise<Dispatcher.ConnectData>;
  override connect(options: TunnelOptions, callback: TunnelCallback): void;
  override connect(
    options: TunnelOptions,
    callback?: TunnelCallback,
  ): Promise<Dispatcher.ConnectData> | void {
    if (callback) {
      super.connect(options, (error, data) =>
        callback(error ?? refusalAfterClosing(data), data),
      );
      return;
    }
    return super.connect(options).then(openedOrRefused);
  }
}

export function tunnelPoolFor(origin: URL, options: object): Dispatcher {
  return new TunnelPool(origin, options);
}

export function tunnelRefusalOf(
  error: unknown,
): ProxyTunnelRefusedError | null {
  let current: unknown = error;
  for (let depth = 0; depth <= CAUSE_DEPTH; depth++) {
    if (current instanceof ProxyTunnelRefusedError) return current;
    if (typeof current !== 'object' || current === null) return null;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}
