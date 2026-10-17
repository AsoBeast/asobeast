export const MAX_RECONNECT_DELAY_MS = 2_000;

const RECONNECT_STEP_MS = 50;

export const reconnectDelay = (attempt: number): number =>
  Math.min(attempt * RECONNECT_STEP_MS, MAX_RECONNECT_DELAY_MS);
