import { Abortable, pause, storeDeadline } from './store-deadline';

export const STORE_RETRY_DELAYS_MS = [2000, 5000] as const;

export async function retryStoreCall<T>(
  call: (deadline: Abortable) => Promise<T>,
  retryable: (error: unknown) => boolean,
): Promise<T> {
  const deadline = storeDeadline();
  let lastError: unknown;
  for (let attempt = 0; attempt <= STORE_RETRY_DELAYS_MS.length; attempt++) {
    try {
      deadline.signal?.throwIfAborted();
      const result = await call(deadline);
      deadline.signal?.throwIfAborted();
      return result;
    } catch (error) {
      lastError = error;
      const delay = STORE_RETRY_DELAYS_MS[attempt];
      if (
        delay === undefined ||
        !retryable(error) ||
        !(await pause(delay, deadline.signal))
      ) {
        break;
      }
    }
  }
  throw lastError;
}
