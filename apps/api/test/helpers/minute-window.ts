import { MINUTE_SECONDS } from '@asobeast/shared';
import { secondsUntilReset } from '../../src/auth/rate-limit/window';

export async function awaitMinuteHeadroom(seconds: number): Promise<void> {
  const remaining = secondsUntilReset(MINUTE_SECONDS, new Date());
  if (remaining >= seconds) return;
  await new Promise((resolve) => setTimeout(resolve, remaining * 1000 + 100));
}
