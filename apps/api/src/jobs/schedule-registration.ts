import { QueueBase } from 'bullmq';

export const REGISTRATION_RETRY_MS = 30_000;

const elapse = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms).unref());

async function registerUntilDone(
  queue: QueueBase,
  register: () => Promise<void>,
  report: (error: Error) => void,
): Promise<void> {
  while (!queue.closing) {
    try {
      await register();
      return;
    } catch (error) {
      report(error instanceof Error ? error : new Error(String(error)));
      await elapse(REGISTRATION_RETRY_MS);
    }
  }
}

export function registerInBackground(
  queue: QueueBase,
  register: () => Promise<void>,
  report: (error: Error) => void,
): void {
  void registerUntilDone(queue, register, report);
}
