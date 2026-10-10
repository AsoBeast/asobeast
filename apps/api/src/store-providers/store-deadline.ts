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

export function withinStoreDeadline<T>(
  work: () => T,
  ms = ON_DEMAND_STORE_DEADLINE_MS,
): T {
  return storage.run(AbortSignal.timeout(ms), work);
}
