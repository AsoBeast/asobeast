import { MINUTE_SECONDS } from '@asobeast/shared';
import { secondsUntilReset } from '../../src/auth/rate-limit/window';

const BURN_HEADROOM_SECONDS = 15;

export async function awaitBurnHeadroom(): Promise<void> {
  const remaining = secondsUntilReset(MINUTE_SECONDS, new Date());
  if (remaining >= BURN_HEADROOM_SECONDS) return;
  await new Promise((resolve) => setTimeout(resolve, remaining * 1000 + 100));
}
