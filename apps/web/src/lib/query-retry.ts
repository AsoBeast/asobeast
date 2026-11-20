import { ApiError } from "@/lib/api";

const MAX_RETRIES = 3;
const MAX_DELAY_MS = 30_000;

function refusedRequest(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.envelope.statusCode >= 400 &&
    error.envelope.statusCode < 500
  );
}

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (refusedRequest(error)) return false;
  return failureCount < MAX_RETRIES;
}

export function retryDelayFor(failureCount: number, error: unknown): number {
  const seconds =
    error instanceof ApiError ? error.envelope.retryAfterSeconds : undefined;
  if (seconds !== undefined && Number.isInteger(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  return Math.min(1000 * 2 ** failureCount, MAX_DELAY_MS);
}

const BUSY_RETRIES = 1;
const BUSY_STATUS = 503;

const BUSY_RETRY_NOTE = "The server is busy. Trying again in a few seconds.";

function busyServer(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.envelope.statusCode === BUSY_STATUS &&
    error.envelope.retryAfterSeconds !== undefined
  );
}

export const busyRetry = {
  retry: (failureCount: number, error: unknown): boolean =>
    busyServer(error) && failureCount < BUSY_RETRIES,
  retryDelay: retryDelayFor,
} as const;

export function noteWhileBusy(
  mutation: { isPending: boolean; failureCount: number },
  note: string | null,
): string | null {
  const waitingOutBusyServer = mutation.isPending && mutation.failureCount > 0;
  return waitingOutBusyServer ? BUSY_RETRY_NOTE : note;
}

export async function tryAgainIfBusy<T>(request: () => Promise<T>): Promise<T> {
  for (let failureCount = 0; ; failureCount += 1) {
    try {
      return await request();
    } catch (error) {
      if (!busyRetry.retry(failureCount, error)) throw error;
      const delay = busyRetry.retryDelay(failureCount, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
