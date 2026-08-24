import { AsyncLocalStorage } from 'node:async_hooks';
import { Dispatcher, ProxyAgent, fetch as undiciFetch } from 'undici';

export interface ProxyCredentials {
  username: string;
  password: string;
}

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

const REFUSED_BY_THE_PATH = new Set([403, 407, 429, 451]);

export type EgressAdmission = () => Promise<void>;

export class EgressMeter {
  private observed = 0;
  private readonly refusals: unknown[] = [];

  constructor(
    readonly dispatcher: Dispatcher,
    private readonly admission?: EgressAdmission,
  ) {}

  admit(): Promise<void> {
    return this.admission ? this.admission() : Promise.resolve();
  }

  get requests(): number {
    return this.observed;
  }

  get failures(): readonly unknown[] {
    return this.refusals;
  }

  observe(): void {
    this.observed++;
  }

  refuse(reason: unknown): void {
    this.refusals.push(reason);
  }
}

const storage = new AsyncLocalStorage<EgressMeter>();

export function currentEgress(): Dispatcher | undefined {
  return storage.getStore()?.dispatcher;
}

export function currentMeter(): EgressMeter | undefined {
  return storage.getStore();
}

export function throughEgress<T>(
  meter: EgressMeter | Dispatcher,
  work: () => Promise<T>,
): Promise<T> {
  const scope = meter instanceof EgressMeter ? meter : new EgressMeter(meter);
  return storage.run(scope, work);
}

export const egressFetch = (async (input: FetchInput, init?: FetchInit) => {
  const meter = storage.getStore();
  await meter?.admit();
  meter?.observe();
  try {
    const response = await undiciFetch(
      input as Parameters<typeof undiciFetch>[0],
      { ...init, dispatcher: meter?.dispatcher },
    );
    if (REFUSED_BY_THE_PATH.has(response.status)) {
      meter?.refuse(new Error(`HTTP ${response.status}`));
    }
    return response;
  } catch (error) {
    meter?.refuse(error);
    throw error;
  }
}) as unknown as typeof fetch;

let directFetch: typeof fetch | undefined;

export function installEgressFetch(): void {
  if (directFetch) return;
  directFetch = globalThis.fetch;
  const direct = directFetch;
  globalThis.fetch = (input: FetchInput, init?: FetchInit) =>
    storage.getStore() ? egressFetch(input, init) : direct(input, init);
}

export function restoreDirectFetch(): void {
  if (!directFetch) return;
  globalThis.fetch = directFetch;
  directFetch = undefined;
}

export function proxyDispatcher(
  origin: string,
  credentials?: ProxyCredentials,
): Dispatcher {
  if (!credentials) return new ProxyAgent({ uri: origin });
  const basic = Buffer.from(
    `${credentials.username}:${credentials.password}`,
  ).toString('base64');
  return new ProxyAgent({ uri: origin, token: `Basic ${basic}` });
}
