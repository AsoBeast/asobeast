const MINUTE_MS = 60_000;

export interface StoreWorkerOptions {
  concurrency: number;
  limiter?: { max: number; duration: number };
}

export function storeWorkerOptions(input: {
  poolEnabled: boolean;
  rpm: number;
  maxConcurrency: number;
}): StoreWorkerOptions {
  if (!input.poolEnabled) {
    return {
      concurrency: 1,
      limiter: { max: input.rpm, duration: MINUTE_MS },
    };
  }
  return { concurrency: Math.max(input.maxConcurrency, 1) };
}

export function poolEnabledFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (env.PROXY_PROVIDER ?? 'none') !== 'none';
}

export function positiveEnv(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
