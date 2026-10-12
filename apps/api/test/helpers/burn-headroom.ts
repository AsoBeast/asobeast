import { MINUTE_SECONDS } from '@asobeast/shared';
import { secondsUntilReset } from '../../src/auth/rate-limit/window';

const BURN_HEADROOM_SECONDS = 15;

export const SHORT_BURN_HEADROOM_SECONDS = 3;

export async function awaitBurnHeadroom(
  seconds = BURN_HEADROOM_SECONDS,
): Promise<void> {
  const remaining = secondsUntilReset(MINUTE_SECONDS, new Date());
  if (remaining >= seconds) return;
  await new Promise((resolve) => setTimeout(resolve, remaining * 1000 + 100));
}
