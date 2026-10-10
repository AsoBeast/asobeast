import { QueueBase } from 'bullmq';
import { isRedisUnreachable } from './queue-error-reporter';

export const REGISTRATION_RETRY_MS = 30_000;

const elapse = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms).unref());

async function registerUntilRedisAnswers(
  queue: QueueBase,
  register: () => Promise<void>,
  report: (error: Error) => void,
): Promise<void> {
  while (!queue.closing) {
    try {
      await register();
      return;
    } catch (error) {
      const failure = error as Error;
      report(failure);
      if (!isRedisUnreachable(failure)) return;
      await elapse(REGISTRATION_RETRY_MS);
    }
  }
}

export function registerInBackground(
  queue: QueueBase,
  register: () => Promise<void>,
  report: (error: Error) => void,
): void {
  void registerUntilRedisAnswers(queue, register, report);
}
