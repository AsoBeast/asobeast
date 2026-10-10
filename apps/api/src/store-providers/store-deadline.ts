import { AsyncLocalStorage } from 'node:async_hooks';

export const ON_DEMAND_STORE_DEADLINE_MS = 20_000;

export interface Abortable {
  signal?: AbortSignal;
}

const storage = new AsyncLocalStorage<AbortSignal>();

export function storeDeadline(): Abortable {
  const signal = storage.getStore();
  return signal ? { signal } : {};
}

export function storeDeadlinePassed(): boolean {
  return storage.getStore()?.aborted === true;
}

export function withinStoreDeadline<T>(
  work: () => T,
  ms = ON_DEMAND_STORE_DEADLINE_MS,
): T {
  return storage.run(AbortSignal.timeout(ms), work);
}

export function outsideStoreDeadline<T>(work: () => T): T {
  return storage.exit(work);
}

export function pause(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const settle = (elapsed: boolean) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abandon);
      resolve(elapsed);
    };
    const abandon = () => settle(false);
    const timer = setTimeout(() => settle(true), ms);
    signal?.addEventListener('abort', abandon, { once: true });
  });
}
