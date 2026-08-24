import { ProxyOutcome } from '@prisma/client';

const RATE_LIMITED = /\b429\b|too many requests|rate.?limit/i;
const BLOCKED = /\b(403|407|451)\b|forbidden|captcha|unusual traffic|consent/i;
const TRANSPORT =
  /econnrefused|econnreset|etimedout|ehostunreach|enetunreach|epipe|socket hang up|fetch failed|network|timed? ?out|und_err|tunneling socket|proxy/i;

const BASE_COOLDOWN_MS: Record<ProxyOutcome, number> = {
  SUCCESS: 0,
  TRANSPORT: 30_000,
  RATE_LIMITED: 300_000,
  SILENT: 900_000,
  BLOCKED: 1_800_000,
};

const MAX_COOLDOWN_MS = 24 * 60 * 60_000;
const MAX_DOUBLINGS = 16;

export function classifyFailure(message: string): ProxyOutcome | null {
  if (RATE_LIMITED.test(message)) return ProxyOutcome.RATE_LIMITED;
  if (BLOCKED.test(message)) return ProxyOutcome.BLOCKED;
  if (TRANSPORT.test(message)) return ProxyOutcome.TRANSPORT;
  return null;
}

export function worstOutcome(
  outcomes: readonly ProxyOutcome[],
): ProxyOutcome | null {
  return outcomes.reduce<ProxyOutcome | null>(
    (worst, outcome) =>
      worst === null || BASE_COOLDOWN_MS[outcome] > BASE_COOLDOWN_MS[worst]
        ? outcome
        : worst,
    null,
  );
}

export function cooldownMs(
  outcome: ProxyOutcome,
  consecutiveFailures: number,
): number {
  const base = BASE_COOLDOWN_MS[outcome];
  if (base === 0) return 0;
  const doublings = Math.min(
    Math.max(consecutiveFailures - 1, 0),
    MAX_DOUBLINGS,
  );
  return Math.min(base * 2 ** doublings, MAX_COOLDOWN_MS);
}
